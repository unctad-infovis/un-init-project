import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFStream } from 'pdf-lib';

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

function hasQlmanage() {
  try {
    execFileSync('qlmanage', ['-h'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Not `/Normal` or `/Compatible` (PDF spec treats the two as equivalent).
const NORMAL_BLEND_MODES = new Set(['Normal', 'Compatible']);

function asDict(context, value) {
  if (value === undefined) return undefined;
  const resolved = value instanceof PDFDict || value instanceof PDFStream ? value : context.lookup(value);
  if (resolved instanceof PDFDict) return resolved;
  if (resolved instanceof PDFStream) return resolved.dict;
  return undefined;
}

function nameOf(obj) {
  return obj?.asString ? obj.asString().replace(/^\//, '') : undefined;
}

/**
 * Walks a page's (or a Form XObject's) `/Resources`, looking for a
 * non-`/Normal` blend mode (`/ExtGState`'s `/BM`) and an image
 * (`/XObject` with `/Subtype /Image`) anywhere in the same resource tree,
 * recursing into nested Form XObjects (common in InDesign exports, which
 * wrap nearly every placed image in its own transparency group).
 */
function scanResourcesForRiskyBlend(context, resDict, depth, state) {
  if (!resDict || depth > 8) return;
  const extGState = asDict(context, resDict.get(PDFName.of('ExtGState')));
  if (extGState) {
    for (const [, gsRef] of extGState.entries()) {
      const bm = asDict(context, gsRef)?.get(PDFName.of('BM'));
      if (!bm) continue;
      const bmStr = nameOf(bm instanceof PDFArray ? bm.get(0) : bm);
      if (bmStr && !NORMAL_BLEND_MODES.has(bmStr)) state.blendModes.add(bmStr);
    }
  }
  const xObject = asDict(context, resDict.get(PDFName.of('XObject')));
  if (xObject) {
    for (const [, xoRef] of xObject.entries()) {
      const xoDict = asDict(context, xoRef);
      if (!xoDict) continue;
      const subtype = nameOf(xoDict.get(PDFName.of('Subtype')));
      if (subtype === 'Image') state.hasImage = true;
      if (subtype === 'Form') scanResourcesForRiskyBlend(context, asDict(context, xoDict.get(PDFName.of('Resources'))), depth + 1, state);
    }
  }
}

/**
 * Finds pages combining an image with a non-`/Normal` blend mode (`Multiply`,
 * `HardLight`, etc.) — the precondition for a real, confirmed Ghostscript
 * `pdfwrite` bug (found 2026-11-26, see TODO.md): a transparency group whose
 * own blending colour space doesn't match an image drawn inside it (e.g. a
 * `/CS /DeviceCMYK` group wrapping an RGB photo) can get silently dropped –
 * replaced with a flat colour, no error, exit 0 – when Ghostscript rewrites
 * the page. Confirmed on a real document: only 1 of 52 CMYK transparency
 * groups (and only 1 page) actually broke, but there is no reliable way to
 * predict *which* blend-mode page will break without re-deriving a chunk of
 * Ghostscript's own transparency-compositing code – so every page matching
 * this (deliberately broader-than-strictly-necessary) heuristic is treated
 * as unsafe to recompress, trading a little extra file size on documents
 * that use blend effects for guaranteed content safety.
 *
 * @returns {Promise<number[]>} 0-indexed page numbers to exclude from recompression.
 */
async function findRiskyBlendPages(pdfBytes) {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
  const risky = [];
  doc.getPages().forEach((page, i) => {
    const state = { blendModes: new Set(), hasImage: false };
    scanResourcesForRiskyBlend(doc.context, page.node.Resources(), 0, state);
    if (state.hasImage && state.blendModes.size > 0) risky.push(i);
  });
  return risky;
}

/**
 * Rebuilds `compressedDoc` (already a full, same-page-order recompression of
 * the whole original) with `brokenPages` (0-indexed) swapped back for their
 * equivalent in `originalDoc` instead – a structural copy via `pdf-lib` (it
 * doesn't re-encode streams, so the restored pages' content is exact).
 */
async function swapInOriginalPages(originalDoc, compressedDoc, brokenPages) {
  const brokenSet = new Set(brokenPages);
  const totalPages = originalDoc.getPageCount();
  const final = await PDFDocument.create();
  for (let i = 0; i < totalPages; i++) {
    const [page] = await final.copyPages(brokenSet.has(i) ? originalDoc : compressedDoc, [i]);
    final.addPage(page);
  }
  return final.save();
}

/** A minimal PNG decoder: 8-bit, non-interlaced, RGB or RGBA only (what `qlmanage -t` produces) — enough for the pixel-diff check below, nothing more. Throws on anything else. */
function decodePNG(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('Not a PNG file.');
  let pos = 8;
  let width, height, bitDepth, colorType, interlace;
  const idatChunks = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const dataStart = pos + 8;
    if (type === 'IHDR') {
      width = buf.readUInt32BE(dataStart);
      height = buf.readUInt32BE(dataStart + 4);
      bitDepth = buf.readUInt8(dataStart + 8);
      colorType = buf.readUInt8(dataStart + 9);
      interlace = buf.readUInt8(dataStart + 12);
    } else if (type === 'IDAT') {
      idatChunks.push(buf.subarray(dataStart, dataStart + len));
    } else if (type === 'IEND') {
      break;
    }
    pos = dataStart + len + 4; // skip CRC
  }
  if (bitDepth !== 8) throw new Error(`Unsupported PNG bit depth ${bitDepth}.`);
  if (interlace !== 0) throw new Error('Interlaced PNG not supported.');
  if (colorType !== 2 && colorType !== 6) throw new Error(`Unsupported PNG colour type ${colorType}.`);
  const channels = colorType === 6 ? 4 : 3;

  const raw = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let rawPos = 0;
  for (let y = 0; y < height; y++) {
    const filterType = raw[rawPos++];
    const rowStart = y * stride;
    const prevRowStart = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[rawPos++];
      const a = x >= channels ? out[rowStart + x - channels] : 0;
      const b = y > 0 ? out[prevRowStart + x] : 0;
      const c = y > 0 && x >= channels ? out[prevRowStart + x - channels] : 0;
      let value;
      if (filterType === 0) value = rawByte;
      else if (filterType === 1) value = rawByte + a;
      else if (filterType === 2) value = rawByte + b;
      else if (filterType === 3) value = rawByte + Math.floor((a + b) / 2);
      else if (filterType === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        value = rawByte + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      } else {
        throw new Error(`Unsupported PNG filter type ${filterType}.`);
      }
      out[rowStart + x] = value & 0xff;
    }
  }
  return { width, height, channels, data: out };
}

/** Mean absolute per-channel difference over the RGB channels only (ignores alpha). -1 if dimensions don't match. */
function meanAbsRgbDiff(a, b) {
  if (a.width !== b.width || a.height !== b.height) return -1;
  const pixelCount = a.width * a.height;
  let sum = 0;
  for (let i = 0; i < pixelCount; i++) {
    const ai = i * a.channels;
    const bi = i * b.channels;
    sum += Math.abs(a.data[ai] - b.data[bi]) + Math.abs(a.data[ai + 1] - b.data[bi + 1]) + Math.abs(a.data[ai + 2] - b.data[bi + 2]);
  }
  return sum / (pixelCount * 3);
}

/**
 * Empirically calibrated against 3 real UNCTAD documents (2026-11-26): a
 * page's ordinary JPEG/downsampling recompression noise measured 0.0–1.4 on
 * this scale, while a page where Ghostscript actually dropped an image (the
 * confirmed bug – see findRiskyBlendPages above) measured 36+. Leaves wide
 * margin on both sides without being overfit to a single sample.
 */
const BLEND_CORRUPTION_DIFF_THRESHOLD = 5;

/** Renders a single already-extracted page's PDF via macOS Quick Look (PDFKit – the same rendering stack the known bug actually manifests in) and decodes the resulting PNG. */
function renderPageViaQuickLook(singlePageBytes, tmpDir, label) {
  const pdfPath = path.join(tmpDir, `${label}.pdf`);
  fs.writeFileSync(pdfPath, singlePageBytes);
  execFileSync('qlmanage', ['-t', '-s', '400', '-o', tmpDir, pdfPath], { stdio: 'ignore' });
  return decodePNG(fs.readFileSync(path.join(tmpDir, `${label}.pdf.png`)));
}

/**
 * Checks whether a specific page actually changed in a way that looks like
 * the blend-mode content-loss bug, by rendering that same page from both the
 * original and the candidate-compressed document via Quick Look (PDFKit) and
 * comparing pixels — directly testing the real symptom, rather than trying
 * to statically predict which blend-mode pages Ghostscript will mishandle
 * (confirmed unreliable: blend mode and group/image colour-space mismatch
 * are both present just as often on pages that compress perfectly fine).
 */
async function pageWasCorrupted(originalDoc, compressedDoc, pageIndex, tmpDir) {
  const origSingle = await PDFDocument.create();
  (await origSingle.copyPages(originalDoc, [pageIndex])).forEach((p) => origSingle.addPage(p));

  const compSingle = await PDFDocument.create();
  (await compSingle.copyPages(compressedDoc, [pageIndex])).forEach((p) => compSingle.addPage(p));

  const before = renderPageViaQuickLook(await origSingle.save(), tmpDir, `orig-${pageIndex}`);
  const after = renderPageViaQuickLook(await compSingle.save(), tmpDir, `comp-${pageIndex}`);
  return meanAbsRgbDiff(before, after) > BLEND_CORRUPTION_DIFF_THRESHOLD;
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
 * @returns {Promise<{bytes: Uint8Array, originalSize: number, compressedSize: number, skipped: boolean, preservedPages: number[]}>}
 *   `skipped` is true when compression didn't actually shrink the file — `bytes` is then the original, byte-for-byte unchanged.
 *   `preservedPages` (1-indexed) lists any pages excluded from recompression by the blend-mode safety net below —
 *   empty on the overwhelming majority of documents, which don't use a non-`Normal` blend mode at all.
 */
export async function compressPdf(pdfBytes, { quality = 'ebook', dpi, monoDpi = 300, timeoutMs = 120_000 } = {}) {
  if (!VALID_QUALITIES.includes(quality)) {
    throw new PdfCompressError(`Invalid quality "${quality}" — use one of ${VALID_QUALITIES.join(', ')}.`);
  }
  if (!hasGhostscript()) {
    throw new PdfCompressError('Ghostscript (gs) not found. Install it: brew install ghostscript');
  }

  const originalSize = pdfBytes.length;
  let riskyPages = [];
  try {
    riskyPages = await findRiskyBlendPages(pdfBytes);
  } catch (err) {
    // The scan is a safety net, not a requirement — a PDF pdf-lib can't
    // parse (encrypted, malformed enough to confuse it) just forgoes the
    // safeguard rather than blocking compression outright.
    console.error(`[pdf-compress] Couldn't scan for risky blend-mode pages, compressing normally: ${err.message}`);
  }

  if (riskyPages.length === 0) {
    const compressedBytes = await runGhostscriptCompress(pdfBytes, { quality, dpi, monoDpi, timeoutMs });
    const compressedSize = compressedBytes.length;
    if (compressedSize >= originalSize) return { bytes: pdfBytes, originalSize, compressedSize, skipped: true, preservedPages: [] };
    return { bytes: compressedBytes, originalSize, compressedSize, skipped: false, preservedPages: [] };
  }

  // One or more pages combine an image with a non-`/Normal` blend mode — the
  // precondition for the confirmed bug (see findRiskyBlendPages above), but
  // not a reliable predictor of it by itself (empirically, pages that
  // compress perfectly fine trigger the same static signal just as often).
  // Compress the whole document normally first, then verify only the
  // candidate pages against the real symptom and swap back just the ones
  // that actually broke — maximizes compression while never shipping
  // silently-corrupted content.
  const compressedWhole = await runGhostscriptCompress(pdfBytes, { quality, dpi, monoDpi, timeoutMs });

  let brokenPages;
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'un-pdf-verify-'));
  try {
    if (hasQlmanage()) {
      const original = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
      const compressed = await PDFDocument.load(compressedWhole, { ignoreEncryption: true, updateMetadata: false });
      brokenPages = [];
      for (const i of riskyPages) {
        try {
          if (await pageWasCorrupted(original, compressed, i, tmpDir)) brokenPages.push(i);
        } catch (err) {
          // Couldn't verify this specific page (e.g. qlmanage choked on it) — fail safe, treat as broken.
          console.error(`[pdf-compress] Couldn't verify page ${i + 1}, preserving it to be safe: ${err.message}`);
          brokenPages.push(i);
        }
      }
    } else {
      // No Quick Look (non-macOS) — can't verify precisely, so every
      // candidate page is conservatively treated as broken.
      brokenPages = riskyPages;
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const preservedPages = brokenPages.map((i) => i + 1);
  if (brokenPages.length === 0) {
    const compressedSize = compressedWhole.length;
    if (compressedSize >= originalSize) return { bytes: pdfBytes, originalSize, compressedSize, skipped: true, preservedPages };
    return { bytes: compressedWhole, originalSize, compressedSize, skipped: false, preservedPages };
  }

  const original = await PDFDocument.load(pdfBytes, { ignoreEncryption: true, updateMetadata: false });
  const compressed = await PDFDocument.load(compressedWhole, { ignoreEncryption: true, updateMetadata: false });
  const compressedBytes = await swapInOriginalPages(original, compressed, brokenPages);

  const compressedSize = compressedBytes.length;
  if (compressedSize >= originalSize) return { bytes: pdfBytes, originalSize, compressedSize, skipped: true, preservedPages };
  return { bytes: compressedBytes, originalSize, compressedSize, skipped: false, preservedPages };
}

/** The actual Ghostscript invocation — recompresses every page's images, no preserved-page safety net. */
async function runGhostscriptCompress(pdfBytes, { quality, dpi, monoDpi, timeoutMs }) {
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

    return fs.readFileSync(outPath);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
