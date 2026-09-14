import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Publications-only cover JPG, per step 9 of UNCTAD_PDF_Prep_Instructions.txt
 * and the publications guideline's "cover image (size 1000x1414 px)"
 * requirement: renders page 1 (pdftoppm) then resizes/compresses to exactly
 * 1000x1414 with macOS's built-in `sips` — no extra dependency needed. A4's
 * aspect ratio (595.32x842.04 pt = 0.7071) is already within a fraction of a
 * percent of 1000:1414 (0.7072), so `sips -z` (which stretches to an exact
 * box rather than cropping) introduces negligible distortion for the A4
 * publications this pipeline handles.
 */
export function generateCoverImage(pdfPath, outputJpgPath, { width = 1000, height = 1414, dpi = 200, quality = 80 } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'un-upload-documents-cover-'));
  const tmpPrefix = path.join(tmpDir, 'cover');

  try {
    execFileSync('pdftoppm', ['-jpeg', '-r', String(dpi), '-f', '1', '-l', '1', pdfPath, tmpPrefix]);

    const rendered = fs.readdirSync(tmpDir).find((f) => f.startsWith('cover') && f.endsWith('.jpg'));
    if (!rendered) throw new Error(`pdftoppm did not produce a cover image for ${pdfPath}`);
    const renderedPath = path.join(tmpDir, rendered);

    fs.mkdirSync(path.dirname(outputJpgPath), { recursive: true });
    execFileSync('sips', [
      '-z', String(height), String(width),
      '-s', 'format', 'jpeg',
      '-s', 'formatOptions', String(quality),
      renderedPath,
      '--out', outputJpgPath,
    ]);

    return outputJpgPath;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
