import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  isClean,
  diffBuildFiles,
  hasDependencyChanges,
  rollbackDependencyFiles,
  commitAll,
  push,
} from './git.js';
import { checkAzureAuth } from './auth.js';

function readPkg(dir) {
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
}

function run(cmd, args, dir) {
  try {
    const stdout = execFileSync(cmd, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, stdout };
  } catch (err) {
    return { ok: false, stdout: err.stdout?.toString() ?? '', stderr: err.stderr?.toString() ?? String(err.message ?? err) };
  }
}

function runJson(cmd, args, dir) {
  // npm audit / audit fix --dry-run exit non-zero when vulnerabilities are
  // present even though they still print valid JSON on stdout.
  try {
    const stdout = execFileSync(cmd, args, { cwd: dir, encoding: 'utf8' });
    return JSON.parse(stdout);
  } catch (err) {
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {
        // fall through
      }
    }
    return null;
  }
}

function detectBundler(dir) {
  const entries = fs.readdirSync(dir);
  if (entries.some((f) => f === 'vite.config.js' || f === 'vite.config.ts')) {
    return { tool: 'vite', outDir: 'dist' };
  }
  if (entries.some((f) => /^webpack.*\.(js|cjs|mjs)$/.test(f))) {
    return { tool: 'webpack', outDir: 'public' };
  }
  const pkg = readPkg(dir);
  if (pkg.devDependencies?.vite) return { tool: 'vite', outDir: 'dist' };
  if (pkg.devDependencies?.webpack) return { tool: 'webpack', outDir: 'public' };
  return null;
}

function vulnSummary(auditJson) {
  const v = auditJson?.metadata?.vulnerabilities ?? {};
  return {
    critical: v.critical ?? 0,
    high: v.high ?? 0,
    moderate: v.moderate ?? 0,
    low: v.low ?? 0,
  };
}

/**
 * Is this package reachable from the root via at least one dependency path
 * that never crosses a "dev" edge? npm's own resolved tree (from `npm
 * explain --json`) is the only reliable source for this — direct
 * dependencies vs devDependencies in package.json says nothing about
 * *transitive* packages (e.g. postcss/nanoid pulled in only by vite, a
 * devDependency, are dev-only even though they're not listed anywhere in
 * package.json themselves).
 */
function isProdReachable(node, visited = new Set()) {
  for (const dependent of node.dependents ?? []) {
    if (dependent.type === 'dev') continue;
    const from = dependent.from;
    if (!from?.name) return true; // reached the root project via a non-dev edge
    const key = `${from.name}@${from.version ?? ''}@${from.location ?? ''}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (isProdReachable(from, visited)) return true;
  }
  return false;
}

/**
 * The same package name can be installed at multiple locations in the tree
 * (e.g. a top-level `uuid` alongside a separate, older `uuid` nested inside
 * `sockjs`). npm audit's `nodes` field on each vulnerability tells us
 * exactly which physical install(s) are actually the vulnerable ones — we
 * must check reachability of *those* locations specifically, not just any
 * install sharing the package name, or a healthy top-level dependency can
 * mask/misattribute a vulnerable nested one (and vice versa).
 */
function isPackageProdReachable(dir, name, vulnerableNodePaths) {
  const explain = run('npm', ['explain', name, '--json'], dir);
  if (!explain.ok || !explain.stdout) return true; // can't prove otherwise — be conservative
  try {
    const entries = JSON.parse(explain.stdout);
    const relevant = vulnerableNodePaths?.length
      ? entries.filter((e) => vulnerableNodePaths.includes(e.location))
      : entries;
    if (relevant.length === 0) return true; // couldn't match — be conservative
    return relevant.some((n) => isProdReachable(n));
  } catch {
    return true;
  }
}

/**
 * Prod-impact classification for remaining vulnerabilities, using npm's
 * resolved dependency tree as the source of truth (see isPackageProdReachable).
 * Secondary signal: grep the built bundle for the package name — best
 * effort only, since minification can hide it; never used to downgrade a
 * prod-reachable finding, only to add confidence.
 */
function classifyRemainingVulns(dir, auditJson, outDirPath) {
  const vulns = auditJson?.vulnerabilities ?? {};

  return Object.entries(vulns).map(([name, info]) => {
    const devOnly = !isPackageProdReachable(dir, name, info.nodes);

    let bundleConfirmed = null;
    if (!devOnly && outDirPath && fs.existsSync(outDirPath)) {
      bundleConfirmed = run('grep', ['-rl', name, outDirPath], dir).ok;
    }

    return { package: name, severity: info.severity, devOnly, bundleConfirmed };
  });
}

export async function auditProject(projectPath, options = {}) {
  const { dryRun = false, noPush = false, skipSyncProd = false, azureAuthOk = null } = options;
  const dir = projectPath;
  const name = path.basename(dir);

  try {
    if (!isClean(dir)) {
      return { name, path: dir, status: 'skipped-dirty' };
    }

    const bundler = detectBundler(dir);
    if (!bundler) {
      return { name, path: dir, status: 'error', error: 'no vite/webpack config found' };
    }
    const outDirPath = path.join(dir, bundler.outDir);

    // `npm explain` (used for prod-reachability classification) needs an
    // actual installed tree — `npm audit` alone works off package-lock.json
    // and doesn't need this, which is why a missing node_modules only shows
    // up as a classification bug, not an audit failure.
    if (!fs.existsSync(path.join(dir, 'node_modules'))) {
      run('npm', ['install'], dir);
    }

    const baselineAudit = runJson('npm', ['audit', '--json'], dir);
    const vulnsBefore = vulnSummary(baselineAudit);

    if (dryRun) {
      const preview = runJson('npm', ['audit', 'fix', '--dry-run', '--json'], dir);
      const remainingProdImpact = classifyRemainingVulns(dir, baselineAudit, outDirPath).filter((v) => !v.devOnly);
      return {
        name,
        path: dir,
        status: 'dry-run',
        bundler: bundler.tool,
        vulnsBefore,
        wouldFix: preview ? vulnSummary(preview) : null,
        remainingProdImpact,
      };
    }

    run('npm', ['update'], dir);
    run('npm', ['audit', 'fix'], dir);

    const postFixAudit = runJson('npm', ['audit', '--json'], dir);
    const vulnsAfter = vulnSummary(postFixAudit);
    const remainingProdImpact = classifyRemainingVulns(dir, postFixAudit, outDirPath).filter((v) => !v.devOnly);

    const depsChanged = hasDependencyChanges(dir);
    if (!depsChanged) {
      return {
        name,
        path: dir,
        status: 'up-to-date',
        bundler: bundler.tool,
        vulnsBefore,
        vulnsAfter,
        remainingProdImpact,
        depsUpdated: false,
        buildChanged: false,
      };
    }

    const install = run('npm', ['install'], dir);
    if (!install.ok) {
      rollbackDependencyFiles(dir);
      return {
        name,
        path: dir,
        status: 'error',
        error: `npm install failed after update: ${install.stderr}`,
        vulnsBefore,
        vulnsAfter,
      };
    }

    const build = run('npm', ['run', 'build'], dir);
    if (!build.ok) {
      rollbackDependencyFiles(dir);
      run('npm', ['install'], dir);
      return {
        name,
        path: dir,
        status: 'build-failed',
        bundler: bundler.tool,
        vulnsBefore,
        vulnsAfter,
        error: build.stderr,
      };
    }

    const changedFiles = diffBuildFiles(dir, bundler.outDir);
    const buildChanged = changedFiles.length > 0;

    let commit = null;
    let pushed = false;
    if (!noPush) {
      commit = commitAll(dir, 'chore: npm audit fix + update');
      push(dir);
      pushed = true;
    } else {
      commit = commitAll(dir, 'chore: npm audit fix + update');
    }

    let syncProdRun = false;
    let syncProdStatus = 'not-needed';
    if (buildChanged) {
      if (noPush || skipSyncProd) {
        syncProdStatus = 'skipped-by-flag';
      } else {
        // Always re-check right before the call, not just once at batch
        // start — an OAuth token (e.g. azcopy's DeviceCodeCredential) can
        // expire partway through a long batch even if the initial check,
        // or an earlier project's sync-prod, succeeded.
        const authNow = checkAzureAuth();
        if (authNow === false) {
          syncProdStatus = 'needs-manual-auth';
        } else {
          const sync = run('npm', ['run', 'sync-prod'], dir);
          syncProdRun = sync.ok;
          syncProdStatus = sync.ok ? 'done' : `failed: ${sync.stderr || 'unknown error (see project for details)'}`;
        }
      }
    }

    return {
      name,
      path: dir,
      status: 'ok',
      bundler: bundler.tool,
      vulnsBefore,
      vulnsAfter,
      remainingProdImpact,
      depsUpdated: true,
      buildChanged,
      changedFiles,
      commit,
      pushed,
      syncProdRun,
      syncProdStatus,
    };
  } catch (err) {
    return { name, path: dir, status: 'error', error: err.message ?? String(err) };
  }
}
