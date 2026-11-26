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
