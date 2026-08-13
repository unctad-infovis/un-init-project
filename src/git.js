import { execFileSync } from 'node:child_process';

function git(dir, args) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

export function isClean(dir) {
  const out = git(dir, ['status', '--porcelain']);
  return out.trim().length === 0;
}

/**
 * Names of changed .js/.css files inside outDir, relative to HEAD.
 * Only meaningful right after a rebuild, on a tree that was clean beforehand.
 */
export function diffBuildFiles(dir, outDir) {
  const out = git(dir, [
    'diff',
    '--name-only',
    'HEAD',
    '--',
    `${outDir}/**/*.js`,
    `${outDir}/**/*.css`,
  ]);
  return out.split('\n').map((l) => l.trim()).filter(Boolean);
}

export function hasDependencyChanges(dir) {
  try {
    git(dir, ['diff', '--quiet', '--', 'package.json', 'package-lock.json']);
    return false;
  } catch {
    return true;
  }
}

export function rollbackDependencyFiles(dir) {
  git(dir, ['checkout', '--', 'package.json', 'package-lock.json']);
}

export function commitAll(dir, message) {
  git(dir, ['add', '-A']);
  git(dir, ['commit', '-m', message]);
  return git(dir, ['rev-parse', 'HEAD']).trim();
}

export function remotes(dir) {
  return git(dir, ['remote'])
    .split('\n')
    .map((r) => r.trim())
    .filter(Boolean);
}

export function push(dir) {
  const available = new Set(remotes(dir));
  const branch = git(dir, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (available.has('origin')) git(dir, ['push', 'origin', branch]);
  if (available.has('unctad')) git(dir, ['push', 'unctad', branch]);
}
