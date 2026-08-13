import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STATE_DIR = path.join(os.homedir(), '.un-audit-project');
const STATE_FILE = path.join(STATE_DIR, 'state.json');

export function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return {};
  }
}

export function saveState(state) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

export function recordProject(state, projectPath, record) {
  state[projectPath] = { ...record, lastRun: new Date().toISOString() };
  return state;
}
