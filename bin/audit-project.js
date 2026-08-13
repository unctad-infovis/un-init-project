#!/usr/bin/env node
import { discoverProjects } from '../src/discover.js';
import { auditProject } from '../src/pipeline.js';
import { loadState, saveState, recordProject } from '../src/state.js';
import { printReport } from '../src/report.js';
import { ensureAzureAuth, checkAzureAuth } from '../src/auth.js';

function parseArgs(argv) {
  const args = argv.slice(2);
  const flags = {
    dryRun: args.includes('--dry-run'),
    noPush: args.includes('--no-push'),
    skipSyncProd: args.includes('--skip-sync-prod'),
  };
  const target = args.find((a) => !a.startsWith('--'));
  return { target, flags };
}

async function main() {
  const { target, flags } = parseArgs(process.argv);

  if (!target) {
    console.error('Usage: un-audit-project <path> [--dry-run] [--no-push] [--skip-sync-prod]');
    process.exit(1);
  }

  console.log(`Discovering projects under ${target} ...`);
  const projects = discoverProjects(target);

  if (projects.length === 0) {
    console.log('No projects found (looked for package.json with a "build" script).');
    return;
  }
  console.log(`Found ${projects.length} project(s).`);

  let azureAuthOk = null;
  const needsSyncProdCheck = !flags.dryRun && !flags.noPush && !flags.skipSyncProd;
  if (needsSyncProdCheck) {
    azureAuthOk = await ensureAzureAuth();
  }

  const state = loadState();
  const results = [];

  for (const projectPath of projects) {
    process.stdout.write(`\n> ${projectPath}\n`);
    let auth = azureAuthOk;
    if (needsSyncProdCheck && auth === false) {
      // Give the batch one more chance in case the user logged in between projects.
      auth = checkAzureAuth();
      if (auth === true) azureAuthOk = true;
    }

    const result = await auditProject(projectPath, { ...flags, azureAuthOk: auth });
    results.push(result);
    recordProject(state, projectPath, result);
    saveState(state);
  }

  printReport(results);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
