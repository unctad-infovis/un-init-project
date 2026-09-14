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

// No timeout at all here used to mean a single degraded/hanging registry
// call (npm's own default is a 300s timeout *per request*, times 2
// retries) could block an entire batch run silently, with no output
// distinguishing "stuck" from "just slow" — found for real 2026-09-04
// against a live project when registry.npmjs.org's bulk advisories
// endpoint was returning intermittent 503s. Every command now gets an
// explicit timeout (network-ish commands default shorter, real-work
// commands like install/build/sync-prod get a longer one passed in by the
// caller) and a one-line "→ <cmd>" progress print before it runs, so a
// slow step is visible while it's happening rather than only inferable
// after the fact from a project that never finished.
const DEFAULT_TIMEOUT_MS = 120_000; // network-ish queries: audit, audit fix --dry-run, explain, grep
const LONG_TIMEOUT_MS = 300_000; // real work: install, update, audit fix, build, sync-prod

function announce(cmd, args) {
  process.stdout.write(`  → ${cmd} ${args.join(' ')}\n`);
}

function run(cmd, args, dir, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  announce(cmd, args);
  try {
    const stdout = execFileSync(cmd, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout });
    return { ok: true, stdout };
  } catch (err) {
    const timedOut = err.signal === 'SIGTERM' && err.killed;
    const stderr = err.stderr?.toString() ?? String(err.message ?? err);
    return {
      ok: false,
      stdout: err.stdout?.toString() ?? '',
      stderr: timedOut ? `timed out after ${Math.round(timeout / 1000)}s: ${cmd} ${args.join(' ')}` : stderr,
    };
  }
}

function runJson(cmd, args, dir, { timeout = DEFAULT_TIMEOUT_MS } = {}) {
  announce(cmd, args);
  // npm audit / audit fix --dry-run exit non-zero when vulnerabilities are
  // present even though they still print valid JSON on stdout.
  try {
    const stdout = execFileSync(cmd, args, { cwd: dir, encoding: 'utf8', timeout });
    return JSON.parse(stdout);
  } catch (err) {
    if (err.signal === 'SIGTERM' && err.killed) {
      process.stderr.write(`  ✗ timed out after ${Math.round(timeout / 1000)}s: ${cmd} ${args.join(' ')}\n`);
      return null;
    }
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

/**
 * `null` in, `null` out — deliberately not "0 vulnerabilities" — a null
 * `auditJson` means the `npm audit` call itself failed (registry 503,
 * timeout, etc.), which is a different, worse thing than a clean audit and
 * must never be displayed the same way. Found for real 2026-09-04: two
 * projects hit the registry's flaky bulk-advisories endpoint mid-batch and
 * silently reported as "0c/0h/0m/0l" (report.js's own `vulnStr` already
 * renders a null summary as "-", so returning null here is the whole fix
 * on this side — no report.js change needed for the table itself).
 */
function vulnSummary(auditJson) {
  if (!auditJson) return null;
  const v = auditJson.metadata?.vulnerabilities ?? {};
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
      run('npm', ['install'], dir, { timeout: LONG_TIMEOUT_MS });
    }

    const baselineAudit = runJson('npm', ['audit', '--json'], dir);
    const vulnsBefore = vulnSummary(baselineAudit);
    const baselineAuditFailed = baselineAudit === null;

    if (dryRun) {
      const preview = runJson('npm', ['audit', 'fix', '--dry-run', '--json'], dir);
      const remainingProdImpact = classifyRemainingVulns(dir, baselineAudit, outDirPath).filter((v) => !v.devOnly);
      return {
        name,
        path: dir,
        status: 'dry-run',
        bundler: bundler.tool,
        vulnsBefore,
        wouldFix: vulnSummary(preview),
        remainingProdImpact,
        auditFailed: baselineAuditFailed,
      };
    }

    run('npm', ['update'], dir, { timeout: LONG_TIMEOUT_MS });
    run('npm', ['audit', 'fix'], dir, { timeout: LONG_TIMEOUT_MS });

    const postFixAudit = runJson('npm', ['audit', '--json'], dir);
    const vulnsAfter = vulnSummary(postFixAudit);
    const auditFailed = baselineAuditFailed || postFixAudit === null;
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
        auditFailed,
      };
    }

    const install = run('npm', ['install'], dir, { timeout: LONG_TIMEOUT_MS });
    if (!install.ok) {
      rollbackDependencyFiles(dir);
      return {
        name,
        path: dir,
        status: 'error',
        error: `npm install failed after update: ${install.stderr}`,
        vulnsBefore,
        vulnsAfter,
        auditFailed,
      };
    }

    const build = run('npm', ['run', 'build'], dir, { timeout: LONG_TIMEOUT_MS });
    if (!build.ok) {
      rollbackDependencyFiles(dir);
      run('npm', ['install'], dir, { timeout: LONG_TIMEOUT_MS });
      return {
        name,
        path: dir,
        status: 'build-failed',
        bundler: bundler.tool,
        vulnsBefore,
        vulnsAfter,
        error: build.stderr,
        auditFailed,
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
          const sync = run('npm', ['run', 'sync-prod'], dir, { timeout: LONG_TIMEOUT_MS });
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
      auditFailed,
    };
  } catch (err) {
    return { name, path: dir, status: 'error', error: err.message ?? String(err) };
  }
}
