import fs from 'node:fs';
import path from 'node:path';

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'public']);
const IGNORE_FILE = '.un-audit-ignore';

function readPackageJson(dir) {
  const pkgPath = path.join(dir, 'package.json');
  if (!fs.existsSync(pkgPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  } catch {
    return null;
  }
}

function isProject(dir) {
  const pkg = readPackageJson(dir);
  return Boolean(pkg?.scripts?.build);
}

function isIgnored(dir) {
  return fs.existsSync(path.join(dir, IGNORE_FILE));
}

/**
 * Recursively discover project roots under startPath.
 * A directory with a package.json exposing a `build` script is treated as a
 * project leaf and is not descended into further. Anything else is treated
 * as a container and walked. A directory containing a `.un-audit-ignore`
 * file (project or container) is skipped entirely, whether targeted
 * directly or found while walking.
 */
export function discoverProjects(startPath) {
  const absStart = path.resolve(startPath);
  if (!fs.existsSync(absStart) || !fs.statSync(absStart).isDirectory()) {
    throw new Error(`Not a directory: ${absStart}`);
  }

  if (isIgnored(absStart)) return [];
  if (isProject(absStart)) return [absStart];

  const projects = [];
  const stack = [absStart];

  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;

      const childPath = path.join(dir, entry.name);
      if (isIgnored(childPath)) continue;
      if (isProject(childPath)) {
        projects.push(childPath);
      } else {
        stack.push(childPath);
      }
    }
  }

  return projects.sort();
}
