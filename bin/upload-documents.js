#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';

import { runUploadPipeline, UploadPipelineError } from '../src/upload-pipeline.js';

function hsize(bytes) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      const takesValue = next !== undefined && !next.startsWith('--');
      flags[key] = takesValue ? next : true;
      if (takesValue) i++; // consume the value so it's never treated as positional
    } else {
      positional.push(args[i]);
    }
  }
  return { emailPath: positional[0], attachmentPath: positional[1], flags };
}

function printManifest(manifest, manifestPath) {
  for (const note of manifest.notes) {
    if (note.type === 'forwarder-note') {
      console.log(chalk.magenta(`  Note from forwarder: ${note.text.split('\n')[0]}${note.text.includes('\n') ? ' […]' : ''}`));
    } else if (note.type === 'extracted-attachment') {
      console.log(chalk.gray(`  Extracted attachment from .eml: ${note.filename} (${note.bytes} bytes)`));
    }
  }

  console.log(chalk.bold(`\n${manifest.requestId} — ${manifest.resolvedSymbol}`));
  console.log(`  ${manifest.classification.documentType}${manifest.classification.restricted ? chalk.red(' (Restricted)') : ''}${manifest.classification.crp ? ' (CRP)' : ''}`);
  console.log(`  Filename base: ${chalk.cyan(manifest.naming.base)}  (confidence: ${manifest.naming.confidence})`);
  console.log(`  Destination:   ${manifest.destinationFolder ?? chalk.yellow('(not determined)')}`);
  console.log(`  Languages:     ${manifest.languages.map((l) => l.lang).join(', ')}`);
  for (const l of manifest.languages) {
    if (!l.compression) continue;
    const { originalSize, compressedSize, skipped } = l.compression;
    if (skipped) {
      console.log(chalk.gray(`    ${l.lang}: compression gained nothing (${hsize(originalSize)}), original kept`));
    } else {
      const pct = Math.round((1 - compressedSize / originalSize) * 100);
      console.log(chalk.gray(`    ${l.lang}: compressed ${hsize(originalSize)} -> ${hsize(compressedSize)}  (-${pct}%)`));
    }
  }
  if (manifest.warnings.length) {
    console.log(chalk.yellow(`\n  ${manifest.warnings.length} warning(s):`));
    for (const w of manifest.warnings) console.log(chalk.yellow(`   - ${w}`));
  }
  console.log(chalk.gray(`\n  Manifest: ${manifestPath}`));
}

async function main() {
  const { emailPath, attachmentPath, flags } = parseArgs(process.argv);

  if (!emailPath) {
    console.error('Usage: un-upload-documents <email-file> [attachment-path] [--out <dir>] [--root <onedrive-root>] [--dry-run]');
    console.error('  attachment-path may be omitted for a .eml that carries its own zip/PDF attachment.');
    process.exit(1);
  }

  let manifest;
  try {
    manifest = await runUploadPipeline({
      emailPath,
      attachmentPath,
      outDir: flags.out,
      root: flags.root,
      dryRun: Boolean(flags['dry-run']),
    });
  } catch (err) {
    if (err instanceof UploadPipelineError) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
    throw err;
  }

  const manifestPath = path.join(manifest.outDir, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  printManifest(manifest, manifestPath);

  return manifest;
}

main().catch((err) => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
