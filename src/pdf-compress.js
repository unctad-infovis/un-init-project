import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/** Ghostscript itself is missing, or failed on this specific file — the caller should print `.message` plainly. */
export class PdfCompressError extends Error {}

const VALID_QUALITIES = ['screen', 'ebook', 'printer', 'prepress'];

function hasGhostscript() {
  try {
    execFileSync('gs', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Compress a PDF's embedded images via Ghostscript — ported from the
 * standalone `compress-pdf.sh` tool (originally at ~/Downloads/pdf/
 * compress-pdf.sh) into this project as a reusable module. Big UNCTAD
 * PDFs are almost always big because of embedded images at print
 * resolution (300+ dpi); downsampling those (the `screen`/`ebook`/
 * `printer`/`prepress` presets, matching Ghostscript's own
 * `-dPDFSETTINGS`) is the same thing pdf24-style online compressors do —
 * text and vectors are untouched. Confirmed on a real 81.6 MB UNCTAD
 * document (tcsditcinf2026d4_en.pdf): compresses to 9.7 MB (-88%) at the
 * default `ebook` quality.
 *
 * **Ordering matters if this is combined with `applyPdfMetadata`**:
 * Ghostscript regenerates the PDF from scratch via its own `pdfwrite`
 * device, so it always overwrites `/Producer` and `/Creator` with its own
 * signature. `applyPdfMetadata` deliberately preserves whatever
 * Producer/Creator is already on the file it's given (`updateMetadata:
 * false`, to match real Angela-edited files keeping the original
 * "Microsoft® Word for Microsoft 365" etc.) — so compress FIRST, then
 * apply metadata, never the other way around, or the metadata step will
 * end up preserving Ghostscript's own signature instead of the original.
 *
 * @param {Uint8Array} pdfBytes
 * @param {object} [opts]
 * @param {'screen'|'ebook'|'printer'|'prepress'} [opts.quality] - default 'ebook' (~150 dpi, general-purpose;
 *   `screen` ~72 dpi smallest/on-screen-only, `printer`/`prepress` ~300 dpi near-original with little savings)
 * @param {number} [opts.dpi] - override colour/grayscale image resolution; unset uses the quality preset's own default
 * @param {number} [opts.monoDpi] - resolution for 1-bit (scanned/line-art) images, default 300
 * @returns {Promise<{bytes: Uint8Array, originalSize: number, compressedSize: number, skipped: boolean}>}
 *   `skipped` is true when compression didn't actually shrink the file — `bytes` is then the original, byte-for-byte unchanged.
 */
export async function compressPdf(pdfBytes, { quality = 'ebook', dpi, monoDpi = 300 } = {}) {
  if (!VALID_QUALITIES.includes(quality)) {
    throw new PdfCompressError(`Invalid quality "${quality}" — use one of ${VALID_QUALITIES.join(', ')}.`);
  }
  if (!hasGhostscript()) {
    throw new PdfCompressError('Ghostscript (gs) not found. Install it: brew install ghostscript');
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'un-pdf-compress-'));
  const inPath = path.join(tmpDir, 'in.pdf');
  const outPath = path.join(tmpDir, 'out.pdf');
  fs.writeFileSync(inPath, pdfBytes);

  try {
    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.7',
      '-dNOPAUSE', '-dBATCH', '-dQUIET',
      '-dDetectDuplicateImages=true',
      '-dCompressFonts=true',
      '-dSubsetFonts=true',
      `-dPDFSETTINGS=/${quality}`,
      // Confirmed 2026-09-14 on a real UNCTAD publication
      // (tcsditcinf2026d4_en.pdf): every `-dPDFSETTINGS` preset
      // (reproduced with bare `/ebook`, nothing else) sets a
      // ColorConversionStrategy that Ghostscript cannot apply to a
      // "Blending colour space" — this document's cover-page gradient
      // panel uses a transparency group with a blend mode, and
      // Ghostscript's response to the incompatibility isn't an error, it
      // silently DROPS the whole panel (and the white title text sitting
      // on it) from the output. Not a quality/colour tradeoff — real
      // content loss, confirmed across the whole 112-page document
      // (cover, back cover, and interior pages) once this is set.
      // `LeaveColorUnchanged` skips color-space conversion entirely,
      // avoiding the whole class of bug — compression still works (this
      // same file: 81.6 MB -> 9.7 MB, -88%, vs -94% before this fix), just
      // slightly less aggressively since colour spaces aren't also being
      // optimised, only image resolution.
      '-dColorConversionStrategy=/LeaveColorUnchanged',
    ];
    if (dpi !== undefined) {
      args.push(
        '-dDownsampleColorImages=true', '-dColorImageDownsampleType=/Bicubic', `-dColorImageResolution=${dpi}`,
        '-dDownsampleGrayImages=true', '-dGrayImageDownsampleType=/Bicubic', `-dGrayImageResolution=${dpi}`,
        '-dColorImageDownsampleThreshold=1.0',
        '-dGrayImageDownsampleThreshold=1.0',
      );
    }
    args.push(
      '-dDownsampleMonoImages=true', '-dMonoImageDownsampleType=/Subsample', `-dMonoImageResolution=${monoDpi}`,
      `-sOutputFile=${outPath}`, '--', inPath,
    );

    try {
      execFileSync('gs', args, { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (err) {
      const stderr = err.stderr ? err.stderr.toString() : err.message;
      throw new PdfCompressError(`Ghostscript failed to compress the PDF:\n${stderr}`);
    }

    const originalSize = pdfBytes.length;
    const compressedBytes = fs.readFileSync(outPath);
    const compressedSize = compressedBytes.length;

    // Matches compress-pdf.sh's own "keep original if no gain" behaviour —
    // a PDF that's already well-compressed (or mostly text/vectors, no
    // large raster images) can come back the same size or larger.
    if (compressedSize >= originalSize) {
      return { bytes: pdfBytes, originalSize, compressedSize, skipped: true };
    }
    return { bytes: compressedBytes, originalSize, compressedSize, skipped: false };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
