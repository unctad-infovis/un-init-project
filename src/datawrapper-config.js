import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const CONFIG_PATH = path.join(os.homedir(), '.un-datawrapper', 'config.json');

/** A user-facing failure (bad/missing config) – the caller should print `.message` plainly, no stack trace. */
export class DatawrapperConfigError extends Error {}

/**
 * Read the Datawrapper API token from `~/.un-datawrapper/config.json`
 * (outside the repo, per explicit user choice over an env var). Never
 * logs the token itself – only ever returns it to the caller, which must
 * likewise never print it.
 */
export function loadApiToken({ configPath = CONFIG_PATH } = {}) {
  if (!fs.existsSync(configPath)) {
    throw new DatawrapperConfigError(
      `No Datawrapper config found at ${configPath}. Create it with:\n` +
      `  mkdir -p ${path.dirname(configPath)}\n` +
      `  echo '{"apiToken": "<your token from app.datawrapper.de/account/api-tokens>"}' > ${configPath}\n` +
      `  chmod 600 ${configPath}`,
    );
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    throw new DatawrapperConfigError(`Could not parse ${configPath} as JSON – expected {"apiToken": "..."}.`);
  }

  if (!parsed.apiToken || typeof parsed.apiToken !== 'string') {
    throw new DatawrapperConfigError(`${configPath} is missing a string "apiToken" field.`);
  }

  return parsed.apiToken;
}
