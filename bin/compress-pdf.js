#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

import { compressPdf, PdfCompressError } from '../src/pdf-compress.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      const takesValue = next !== undefined && !next.startsWith('-');
      flags[key] = takesValue ? next : true;
      if (takesValue) i++;
    } else if (args[i].startsWith('-') && args[i].length === 2) {
      const key = args[i].slice(1);
      const next = args[i + 1];
      const takesValue = next !== undefined && !next.startsWith('-');
      flags[key] = takesValue ? next : true;
      if (takesValue) i++;
    } else {
      positional.push(args[i]);
    }
  }
  return { files: positional, flags };
}

function hsize(bytes) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function printUsage() {
  console.error('Usage: un-compress-pdf [options] file1.pdf [file2.pdf ...]');
  console.error('  -q, --quality PRESET  screen | ebook | printer | prepress   (default: ebook)');
  console.error('  -d, --dpi N           Override the image resolution (colour + grayscale).');
  console.error('      --mono-dpi N      Resolution for 1-bit (scanned / line-art) images. Default 300.');
  console.error('  -o, --outdir DIR      Where to write results. Default: ./compressed');
  console.error('  -i, --in-place        Overwrite the originals (a .bak copy is kept next to each).');
}

async function main() {
  const { files, flags } = parseArgs(process.argv);
  const quality = flags.q || flags.quality || 'ebook';
  const dpi = flags.d || flags.dpi ? Number(flags.d || flags.dpi) : undefined;
  const monoDpi = flags['mono-dpi'] ? Number(flags['mono-dpi']) : undefined;
  const outdir = flags.o || flags.outdir || 'compressed';
  const inPlace = Boolean(flags.i || flags['in-place']);

  if (files.length === 0) {
    printUsage();
    process.exit(1);
  }

  if (!inPlace) fs.mkdirSync(outdir, { recursive: true });

  let totalIn = 0;
  let totalOut = 0;
  let fail = false;

  for (const src of files) {
    if (!fs.existsSync(src)) {
      console.log(chalk.yellow(`skip  ${src}  (not found)`));
      fail = true;
      continue;
    }

    const bytes = fs.readFileSync(src);
    try {
      const result = await compressPdf(bytes, { quality, dpi, monoDpi });
      totalIn += result.originalSize;
      totalOut += result.skipped ? result.originalSize : result.compressedSize;

      if (result.skipped) {
        console.log(`keep  ${src}  (${hsize(result.originalSize)}) — compression gained nothing, original left as-is`);
        continue;
      }

      const dest = inPlace ? src : path.join(outdir, path.basename(src));
      if (inPlace) fs.copyFileSync(src, `${src}.bak`);
      fs.writeFileSync(dest, result.bytes);

      const pct = Math.round((1 - result.compressedSize / result.originalSize) * 100);
      console.log(chalk.green(`ok    ${src}  ${hsize(result.originalSize)} -> ${hsize(result.compressedSize)}  (-${pct}%)  =>  ${dest}`));
    } catch (err) {
      if (err instanceof PdfCompressError) {
        console.log(chalk.red(`FAIL  ${src}\n      ${err.message}`));
        fail = true;
        continue;
      }
      throw err;
    }
  }

  if (totalIn > 0) {
    const pct = Math.round((1 - totalOut / totalIn) * 100);
    console.log(chalk.bold(`\ntotal: ${hsize(totalIn)} -> ${hsize(totalOut)}  (-${pct}%)`));
  }

  process.exit(fail ? 1 : 0);
}

main().catch((err) => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
