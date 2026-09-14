import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const MASTER_DOCS_ROOT = path.join(
  os.homedir(),
  'Library/CloudStorage/OneDrive-UnitedNations/General - CER/Web/WEB UNIT/!MASTER_DOCS_and_PUB',
);

/**
 * Resolve (creating if necessary) a destination folder under
 * !MASTER_DOCS_and_PUB, per "If a folder does not exist, create one"
 * (cer-how-to-prepare-and-log-sessional-documents.pdf, step 3).
 */
export function resolveDestinationFolder(relativeFolderPath, { root = MASTER_DOCS_ROOT } = {}) {
  const dest = path.join(root, relativeFolderPath);
  const existed = fs.existsSync(dest);
  if (!existed) fs.mkdirSync(dest, { recursive: true });
  return { path: dest, created: !existed };
}

/**
 * Find an existing "TD_B_WP (Working Party)/<itemNum> (<label>)" folder by
 * its item number alone — the human label half (e.g. "Review of the
 * technical cooperation activities") isn't derivable from the symbol, but
 * for an item that's already been filed before (an Add./Corr./Rev. to an
 * existing item, or a resubmission) the folder already exists on disk and
 * doesn't need to be guessed, just found. Confirmed 2026-09-04: item 343
 * already has a real folder ("343 (Review of the technical cooperation
 * activities)") from its base document, needed when filing its Add.2.
 * Returns the relative folder path only on exactly one match — zero or
 * multiple matches both mean "ask", same as the rest of this module's
 * null-means-ask convention.
 *
 * Also used (2026-09-07) for a session number, not just an item number —
 * e.g. finding "90 (January 2026)" for a TD/B/WP(90)/... document. Works
 * unchanged because session folders and item folders are literal siblings
 * under this same directory (confirmed: "54 (November 2009)" ... "90
 * (January 2026)" sit alongside "218" ... "343 (Review of the technical
 * cooperation activities)"). Known, currently-accepted risk, not fixed
 * here: nothing enforces that a session number and an item number can
 * never collide — it's safe today only because observed ranges don't
 * overlap (sessions in the low hundreds at most so far, items starting
 * around 200+), and at least one real session folder (`78`) has no
 * parenthetical label at all, the exact same bare-number shape an item
 * folder has. If this function is ever called with a number in a range
 * where both a session and an item could plausibly exist, treat a single
 * match with real suspicion rather than blind trust.
 */
export function findExistingWorkingPartyFolder(itemNum, { root = MASTER_DOCS_ROOT } = {}) {
  const wpRoot = path.join(root, 'TD_B_WP (Working Party)');
  if (!fs.existsSync(wpRoot)) return null;
  const matches = fs.readdirSync(wpRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (entry.name === itemNum || entry.name.startsWith(`${itemNum} (`)))
    .map((entry) => entry.name);
  return matches.length === 1 ? `TD_B_WP (Working Party)/${matches[0]}` : null;
}

/**
 * Copy files into a destination folder. This is a real, shared production
 * drive that already holds Angela's actual filed documents (our own
 * TD/B/73/5 test symbol already has real files under it) — refuses to
 * silently overwrite an existing file unless `overwrite: true` is passed
 * explicitly per call.
 *
 * @param {string} destFolder
 * @param {{sourcePath: string, targetName: string}[]} files
 * @param {{overwrite?: boolean}} [options]
 */
export function fileDocuments(destFolder, files, { overwrite = false } = {}) {
  const results = [];
  for (const { sourcePath, targetName } of files) {
    const targetPath = path.join(destFolder, targetName);
    const alreadyExists = fs.existsSync(targetPath);
    if (alreadyExists && !overwrite) {
      results.push({ sourcePath, targetPath, status: 'skipped-exists' });
      continue;
    }
    fs.copyFileSync(sourcePath, targetPath);
    results.push({ sourcePath, targetPath, status: alreadyExists ? 'overwritten' : 'copied' });
  }
  return results;
}
