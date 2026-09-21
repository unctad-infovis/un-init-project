import { execFileSync, spawnSync } from 'node:child_process';
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
 * @param {number} [opts.timeoutMs] - kill Ghostscript if it hasn't finished after this long, default 120000 (2 min).
 *   Without this a malformed or degenerate PDF can hang the subprocess — and this whole function — indefinitely.
 * @returns {Promise<{bytes: Uint8Array, originalSize: number, compressedSize: number, skipped: boolean}>}
 *   `skipped` is true when compression didn't actually shrink the file — `bytes` is then the original, byte-for-byte unchanged.
 */
export async function compressPdf(pdfBytes, { quality = 'ebook', dpi, monoDpi = 300, timeoutMs = 120_000 } = {}) {
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
      // Same class of bug as the color-conversion one above, found on
      // code review 2026-09-15 rather than by a visible failure: every
      // `-dPDFSETTINGS` preset also sets `/AutoRotatePages` — `/ebook`
      // (this project's default) to `/All`, `/screen` to `/PageByPage` —
      // meaning Ghostscript will silently rotate any page its internal
      // text-orientation heuristic misjudges (a landscape table/chart on
      // an otherwise-portrait document, a scanned page, a page the
      // heuristic just gets wrong) with no error or warning. Only
      // `/printer` and `/prepress`, neither used here, default this to
      // `/None`. Force it off for every quality so page orientation is
      // never left to a heuristic.
      '-dAutoRotatePages=/None',
      // Real, user-reported bug, 2026-09-15/16: node 52790's published
      // "Looking Beyond GDP" English PDF was missing its photos on
      // iPhone (and macOS Preview — both are Apple's PDFKit). Root cause
      // is narrower and more precise than it first looked: this is NOT
      // "JPEG2000-in-PDF is broadly fragile" (that theory produced an
      // incorrect secondary finding, since retracted — see TODO.md).
      // Diffing the raw JPX stream bytes directly (not just comparing
      // `pdfimages -list` sizes, which matched and looked clean)
      // found it: Ghostscript's `pdfwrite` device appends a spurious
      // 2-byte `0D 0A` (`\r\n`) immediately after the JPEG2000
      // codestream's own End-Of-Codestream marker (`FF D9`) — confirmed
      // present even in a bare `-sDEVICE=pdfwrite` rewrite with *no*
      // other flags at all, so this is `pdfwrite`'s own generic stream
      // serialization, unrelated to any PDFSETTINGS/quality/color/
      // rotation option. PDFKit rejects the corrupted codestream and
      // renders the image blank; Poppler and OpenJPEG's own decoder both
      // tolerate the trailing garbage and decode fine regardless — which
      // is exactly why every check done with non-Apple tools passed.
      // Confirmed by a surgical test: stripping only those 2 bytes from
      // an otherwise-untouched Ghostscript output flips it from broken
      // to correct, verified via `qlmanage -t` (macOS Quick Look — same
      // PDFKit rendering stack as iOS, and the first tool found that
      // actually reproduces this locally without a physical device).
      // Fixed here by skipping the buggy pass-through path entirely:
      // forcing Ghostscript to fully decode and re-encode JPX images as
      // JPEG sidesteps the corruption rather than patching around it.
      // Verified pixel-identical to the original across 3 diverse pages,
      // and the file came out *smaller* overall as a side effect (JPEG
      // beat the source JPX encoding's own settings here). This is a
      // real, if fragile, reliance on Ghostscript's built-in openjpeg
      // decoder actually succeeding — see the "unspec CS" warning
      // handling below, now surfaced instead of silently discarded, as
      // the safety net if a future JPX image is malformed enough that
      // this decode fails outright.
      '-dPassThroughJPXImages=false',
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

    // spawnSync, not execFileSync: execFileSync's return value is stdout
    // only (null here, since stdout is ignored) — there's no way to see
    // stderr on a successful run through it. spawnSync always returns
    // `{ stdout, stderr, status, signal, error }` regardless of outcome,
    // which is what the warning-visibility fix below needs.
    const result = spawnSync('gs', args, { stdio: ['ignore', 'ignore', 'pipe'], timeout: timeoutMs });
    if (result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM') {
      throw new PdfCompressError(`Ghostscript timed out after ${timeoutMs}ms compressing the PDF.`);
    }
    if (result.error) {
      throw new PdfCompressError(`Failed to run Ghostscript: ${result.error.message}`);
    }
    const stderr = result.stderr ? result.stderr.toString().trim() : '';
    if (result.status !== 0) {
      throw new PdfCompressError(`Ghostscript failed to compress the PDF:\n${stderr}`);
    }
    // -dQUIET should leave nothing here on a normal run, but don't rely on
    // that silently — a future Ghostscript version could print a
    // compatibility warning (the same shape of message that first hinted
    // at the color-conversion bug above) on an otherwise-successful (exit
    // 0) run. Surface it instead of discarding it, so a warning like that
    // leaves a trace in the logs rather than only being catchable by
    // another manual visual audit of the output.
    if (stderr) console.error(`[pdf-compress] Ghostscript warning (exit 0):\n${stderr}`);

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
