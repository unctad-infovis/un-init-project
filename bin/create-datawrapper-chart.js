#!/usr/bin/env node
import chalk from 'chalk';

import { runCheckPipeline, runCreatePipeline, runConvertToWebPipeline, CreateChartError } from '../src/create-datawrapper-pipeline.js';
import { DatawrapperConfigError } from '../src/datawrapper-config.js';
import { DatawrapperApiError } from '../src/datawrapper-api.js';
import { SERIES_PALETTE } from '../src/datawrapper-constants.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args[0];
  const rest = args.slice(1);
  const positional = [];
  const flags = {};
  for (let i = 0; i < rest.length; i++) {
    if (rest[i].startsWith('--')) {
      const key = rest[i].slice(2);
      const next = rest[i + 1];
      const takesValue = next !== undefined && !next.startsWith('--');
      flags[key] = takesValue ? next : true;
      if (takesValue) i++;
    } else {
      positional.push(rest[i]);
    }
  }
  return { command, csvPath: positional[0], flags };
}

function printUsage() {
  console.error('Usage:');
  console.error('  un-create-datawrapper-chart check <data.csv> [--json]');
  console.error('  un-create-datawrapper-chart create <data.csv> --type <id> --title <t> --description <d> --source <s>');
  console.error('    [--source-url <url>] [--notes <text>] [--folder <id>] [--highlight <series>] [--other <series>]');
  console.error('    [--print] [--strict] [--dry-run] [--json]');
  console.error('  un-create-datawrapper-chart to-web <sourceChartId> [--folder <id>] [--dry-run] [--json]');
}

function printCheck(report, json) {
  if (json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.log(chalk.bold(report.filePath));
  console.log(`  ${report.rowCount} rows, ${report.columnCount} columns`);
  report.header.forEach((h, i) => console.log(`  - ${h || '(no header)'} (${report.columnTypes[i]})`));
  console.log(`  Time series: ${report.isTimeSeries ? 'yes' : 'no'}   Series: ${report.seriesCount}`);

  if (report.problems.length) {
    console.log(chalk.yellow(`\n  ${report.problems.length} data problem(s):`));
    for (const p of report.problems) console.log(chalk.yellow(`   - ${p}`));
  } else {
    console.log(chalk.gray('\n  No data problems found.'));
  }

  console.log(chalk.bold(`\n  Recommended: ${report.recommendation.type ?? '(none confident)'}`));
  console.log(`  ${report.recommendation.reason}`);
}

function printCreateResult(result, { print, json }) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.csvReport.problems.length) {
    console.log(chalk.yellow(`${result.csvReport.problems.length} data problem(s):`));
    for (const p of result.csvReport.problems) console.log(chalk.yellow(`  - ${p}`));
    console.log('');
  }

  if (result.dryRun) {
    console.log(chalk.bold('DRY RUN – no API calls made. Payloads that would be sent:\n'));
    console.log(chalk.bold('POST /v3/charts (theme/language):'), JSON.stringify({ theme: result.theme, language: result.language, folderId: result.folderId }, null, 2));
    console.log(chalk.bold('\nPATCH /v3/charts/{id} (metadata):'), JSON.stringify(result.metadata, null, 2));
  } else {
    console.log(chalk.bold(`Created  ${result.chartId}  (draft, not published)`));
    console.log(`Editor   ${result.editorUrl}`);
  }

  const settingsCount = print ? 5 : 11;
  console.log(chalk.bold(`\nSettings   ${settingsCount}/${settingsCount} applied${print ? ' (print theme – logo/download blocks don’t apply)' : ''}`));

  const paletteNames = Object.entries(result.palette.colorMap)
    .filter(([, hex]) => hex !== '#DED9D5' && hex !== '#AEA29A')
    .map(([name, hex]) => `${name} (${SERIES_PALETTE.find((c) => c.hex === hex)?.name ?? hex})`);
  console.log(chalk.bold('Palette   '), paletteNames.length ? paletteNames.join(', ') : '(none – check the CSV series)');

  const allFindings = [...result.textFindings, ...result.palette.warnings.map((w) => ({ severity: 'warning', field: 'palette', message: w }))];
  if (allFindings.length) {
    console.log(chalk.yellow(`\n${allFindings.length} warning(s):`));
    for (const f of allFindings) console.log(chalk.yellow(`  - ${f.field}: ${f.message}`));
  }

  if (!result.dryRun) {
    console.log(chalk.bold('\nNot published.') + ' Publishing isn’t implemented in this tool yet – review and publish from the Datawrapper editor.');
  }
}

function printConvertResult(result, { json }) {
  if (json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log(chalk.bold(`Source   ${result.sourceChartId}`), `"${result.sourceTitle}" (${result.sourceType}, theme: ${result.sourceTheme})`);
  console.log(`Target folder   ${result.resolvedFolderId}`);

  if (result.dryRun) {
    console.log(chalk.bold('\nDRY RUN – no chart copied, no API writes made. Metadata that would be patched onto the copy:\n'));
    console.log(JSON.stringify({ title: result.finalTitle, theme: 'unctad', language: 'en-CH', folderId: result.resolvedFolderId, metadata: result.overlayMetadata }, null, 2));
  } else {
    console.log(chalk.bold(`\nCreated  ${result.newChartId}  (draft copy, not published)`));
    console.log(`Editor   ${result.editorUrl}`);
  }

  // Unlike `create`, `to-web` never blocks on text findings – the source
  // chart's content already exists and a human reviews the copy before
  // publishing anyway – but an 'error'-severity finding (e.g. a title
  // still carrying its print "Figure 10 ..." numbering) is more urgent
  // than a stylistic warning, so keep the two visually distinct here
  // rather than flattening both into one generic "warning(s)" list.
  const allFindings = [...result.textFindings, ...result.warnings.map((w) => ({ severity: 'warning', field: 'convert', message: w }))];
  const errors = allFindings.filter((f) => f.severity === 'error');
  const warnings = allFindings.filter((f) => f.severity !== 'error');
  if (errors.length) {
    console.log(chalk.red(`\n${errors.length} needs fixing before publishing:`));
    for (const f of errors) console.log(chalk.red(`  - ${f.field}: ${f.message}`));
  }
  if (warnings.length) {
    console.log(chalk.yellow(`\n${warnings.length} warning(s):`));
    for (const f of warnings) console.log(chalk.yellow(`  - ${f.field}: ${f.message}`));
  }

  if (!result.dryRun) {
    console.log(chalk.bold('\nNot published.') + ' Review the copy in the editor, then publish from there.');
  }
}

async function main() {
  const { command, csvPath, flags } = parseArgs(process.argv);

  if (!command || !csvPath || !['check', 'create', 'to-web'].includes(command)) {
    printUsage();
    process.exit(1);
  }

  const json = Boolean(flags.json);

  try {
    if (command === 'check') {
      printCheck(runCheckPipeline(csvPath), json);
      return;
    }

    if (command === 'to-web') {
      const result = await runConvertToWebPipeline({
        sourceChartId: csvPath,
        folderId: flags.folder,
        dryRun: Boolean(flags['dry-run']),
      });
      printConvertResult(result, { json });
      return;
    }

    if (!flags.type || !flags.title || !flags.description || !flags.source) {
      console.error(chalk.red('create requires --type, --title, --description and --source.'));
      process.exit(1);
    }

    const result = await runCreatePipeline({
      csvPath,
      type: flags.type,
      title: flags.title,
      description: flags.description,
      source: flags.source,
      sourceUrl: flags['source-url'],
      notes: flags.notes,
      folderId: flags.folder,
      highlight: flags.highlight,
      other: flags.other,
      print: Boolean(flags.print),
      strict: Boolean(flags.strict),
      dryRun: Boolean(flags['dry-run']),
    });
    printCreateResult(result, { print: Boolean(flags.print), json });
  } catch (err) {
    if (err instanceof CreateChartError || err instanceof DatawrapperConfigError || err instanceof DatawrapperApiError) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
    throw err;
  }
}

main().catch((err) => {
  console.error(chalk.red('Fatal error:'), err);
  process.exit(1);
});
