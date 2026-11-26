# Compressing a PDF's embedded images

See the [root README](../README.md) for the rest of this repo.

`un-compress-pdf` shrinks a PDF's embedded images via Ghostscript while
leaving text and vectors untouched – ported from a standalone
`compress-pdf.sh` tool. [`un-upload-documents`](upload-documents.md) calls
this automatically on every PDF it stages, before editing its metadata
(compression must come first – Ghostscript regenerates the PDF and always
overwrites `/Producer`/`/Creator`, which would otherwise silently replace
the original values `un-upload-documents` is careful to preserve). It's
also usable standalone, or as a library function (`compressPdf()` in
`src/pdf-compress.js`) from other tooling.

Requires Ghostscript (`gs`) on `PATH` — `brew install ghostscript` on
macOS.

```
un-compress-pdf [options] file1.pdf [file2.pdf ...]
  -q, --quality PRESET  screen | ebook | printer | prepress   (default: ebook)
  -d, --dpi N           Override the image resolution (colour + grayscale).
      --mono-dpi N      Resolution for 1-bit (scanned / line-art) images. Default 300.
  -o, --outdir DIR      Where to write results. Default: ./compressed
  -i, --in-place        Overwrite the originals (a .bak copy is kept next to each).
```

By default, compressed copies are written to `./compressed/` (created if
needed), named the same as each input file, leaving the originals
untouched. `--in-place` overwrites the source file directly instead,
after saving a `.bak` copy alongside it first.

Quality presets, in order of increasing size/fidelity:
`screen` (72 dpi, smallest, lowest quality) < `ebook` (150 dpi, the
default – the right balance for a document that's mostly going to be
read on screen) < `printer` (300 dpi) < `prepress` (300 dpi, colour
preserved for print production). `--dpi`/`--mono-dpi` override a preset's
own resolution if you need something in between.

If compressing a file would make it *larger* (can happen on a PDF that's
already heavily optimized, or has very little raster image content to
begin with), the tool keeps the original as-is rather than writing a
larger "compressed" copy, and reports it as such.

Example output:

```
ok    report.pdf  4.2 MB -> 0.6 MB  (-86%)  =>  compressed/report.pdf
keep  cover.pdf  (0.1 MB) — compression gained nothing, original left as-is

total: 4.3 MB -> 0.7 MB  (-84%)
```

Exits non-zero if any input file was missing or failed to compress, so
it's safe to check the exit code in a script.

## Blend-mode safety net

Some InDesign exports place a photo inside a transparency group using a
colour-blend effect (e.g. `Multiply`, common on cover pages) in a way that
can trigger a genuine Ghostscript `pdfwrite` bug: it silently drops the
image and replaces it with a flat colour, with no error and exit code 0
(see `TODO.md` for the full technical writeup). Every compression run
automatically guards against this:

1. Pages combining an image with a non-`Normal` blend mode are flagged as
   candidates (cheap, near-zero cost on the overwhelming majority of
   documents, which don't use blend effects at all — flagging alone isn't
   proof of breakage, since the same construct is just as often used on
   pages that compress perfectly fine).
2. The whole document is compressed normally, then each candidate page is
   independently verified — rendered before/after via macOS Quick Look
   (the same PDFKit rendering stack the bug actually manifests in) and
   pixel-diffed.
3. Only pages that actually changed in a way consistent with real content
   loss are reverted to their original, untouched bytes; every other page
   keeps full compression.

If a page was preserved this way, the CLI prints which one(s) and why:

```
      page(s) 1 use a colour-blend effect Ghostscript can silently corrupt — left at original resolution, not recompressed (see docs/compress-pdf.md).
ok    report.pdf  23.7 MB -> 9.1 MB  (-62%)  =>  compressed/report.pdf
```

This precise, per-page verification requires `qlmanage` (built into
macOS). On a platform without it, every candidate page is conservatively
preserved instead (no pixel-diff check) — still safe, just less precise.
