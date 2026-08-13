import { execFileSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

function commandExists(cmd) {
  try {
    execFileSync('which', [cmd], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * true = confirmed logged in, false = confirmed not logged in,
 * null = couldn't check (azcopy not installed) — caller should proceed
 * optimistically and let individual sync-prod calls fail/report on their own.
 */
export function checkAzureAuth() {
  if (!commandExists('azcopy')) return null;
  try {
    execFileSync('azcopy', ['login', 'status'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifies azcopy auth once up front. If not authenticated, pauses once and
 * asks the user to run `azcopy login` in another terminal, then re-checks.
 * Returns the final auth status (true/false/null) to drive per-project
 * sync-prod decisions for the rest of the batch.
 */
export async function ensureAzureAuth() {
  const status = checkAzureAuth();
  if (status === true) return true;

  if (status === null) {
    console.log('Could not verify azcopy login (azcopy not found locally) — proceeding; sync-prod steps will run and report failures individually if not authenticated.');
    return null;
  }

  console.log('\nazcopy session not found. `sync-prod` needs `azcopy login` to have been run first.');
  const rl = readline.createInterface({ input, output });
  await rl.question('Run it now in another terminal, then press Enter to continue... ');
  rl.close();

  const revalidated = checkAzureAuth();
  if (revalidated !== true) {
    console.log('Still not authenticated — sync-prod will be skipped and flagged for manual follow-up this run.\n');
  }
  return revalidated;
}
