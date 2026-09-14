import { SOURCE_LINE_PATTERN, SOURCE_IS_SENTENCE_RE, KNOWN_ABBREVIATIONS } from './datawrapper-constants.js';

// "A simple verb list plus is/are/was/were/has/have is good enough – this
// is a nudge, not a parser" (brief section 5). Common finding-statement
// verbs, present/past/3rd-person forms; deliberately not exhaustive.
const VERB_WORDS = [
  'is', 'are', 'was', 'were', 'has', 'have', 'had', 'will', 'does', 'do', 'did',
  'rise', 'rises', 'rose', 'risen', 'fall', 'falls', 'fell', 'fallen',
  'grow', 'grows', 'grew', 'grown', 'increase', 'increases', 'increased',
  'decrease', 'decreases', 'decreased', 'drop', 'drops', 'dropped',
  'remain', 'remains', 'remained', 'reach', 'reaches', 'reached',
  'surge', 'surges', 'surged', 'decline', 'declines', 'declined',
  'widen', 'widens', 'widened', 'narrow', 'narrows', 'narrowed',
  'outpace', 'outpaces', 'outpaced', 'lag', 'lags', 'lagged',
  'top', 'tops', 'topped', 'hit', 'hits', 'lead', 'leads', 'led',
  'drive', 'drives', 'driven', 'slow', 'slows', 'slowed',
  'accelerate', 'accelerates', 'accelerated', 'exceed', 'exceeds', 'exceeded',
  'overtake', 'overtakes', 'overtook', 'double', 'doubles', 'doubled', 'halve', 'halves', 'halved',
];
const VERB_RE = new RegExp(`\\b(${VERB_WORDS.join('|')})\\b`, 'i');

const FIGURE_NUMBERING_RE = /^(figure|fig\.?|chart|table|map)\s*\d/i;
const HYPHEN_BETWEEN_YEARS_RE = /\b(1[89]|20)\d{2}-(1[89]|20)\d{2}\b/;
const EM_DASH = '—';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkEmDash(field, text, findings) {
  if (text && text.includes(EM_DASH)) {
    findings.push({ severity: 'warning', field, message: `Contains an em dash (${EM_DASH}) – UNCTAD house style is the en dash (–).` });
  }
}

function validateTitle(title, findings) {
  if (!title || !title.trim()) {
    findings.push({ severity: 'error', field: 'title', message: 'Title is empty.' });
    return;
  }
  if (FIGURE_NUMBERING_RE.test(title.trim())) {
    findings.push({ severity: 'error', field: 'title', message: 'Title starts with figure/chart/table numbering – that numbering does not travel to the web.' });
  }
  if (!VERB_RE.test(title)) {
    findings.push({ severity: 'warning', field: 'title', message: 'No verb found – a title should state a finding as a sentence with a verb, not just a topic label.' });
  }
  if (title.trim().endsWith('.')) {
    findings.push({ severity: 'warning', field: 'title', message: 'Ends with a full stop – titles conventionally don’t.' });
  }
  if (title.length > 90) {
    findings.push({ severity: 'warning', field: 'title', message: `${title.length} characters – three lines on a phone is fine, four is not (aim for ≤90).` });
  }
}

function validateDescription(description, findings) {
  if (!description || !description.trim()) {
    findings.push({ severity: 'error', field: 'description', message: 'Description is empty.' });
    return;
  }
  if (!description.includes(',')) {
    findings.push({ severity: 'warning', field: 'description', message: 'No comma found – the four elements (what, breakdown, unit, period) should be comma-separated.' });
  }
  if (description.trim().endsWith('.')) {
    findings.push({ severity: 'warning', field: 'description', message: 'Ends with a full stop – descriptions conventionally don’t.' });
  }
  if (!/\d/.test(description)) {
    findings.push({ severity: 'warning', field: 'description', message: 'No digits found – the period (e.g. a year range) is usually missing when there are none.' });
  }
  for (const abbr of KNOWN_ABBREVIATIONS) {
    const abbrRe = new RegExp(`\\b${escapeRegex(abbr)}\\b`, 'g');
    if (!abbrRe.test(description)) continue;
    const spelledOutRe = new RegExp(`\\(${escapeRegex(abbr)}\\)`);
    if (!spelledOutRe.test(description)) {
      findings.push({ severity: 'warning', field: 'description', message: `"${abbr}" appears without being spelled out first, e.g. "... (${abbr})".` });
    }
  }
  if (HYPHEN_BETWEEN_YEARS_RE.test(description)) {
    findings.push({ severity: 'warning', field: 'description', message: 'Uses a hyphen between two years (e.g. "2010-2024") – should be an en dash (–).' });
  }
}

function validateSource(source, findings) {
  if (!source || !source.trim()) {
    findings.push({ severity: 'error', field: 'source', message: 'Source is empty.' });
    return;
  }
  const trimmedSource = source.trim();
  if (!SOURCE_LINE_PATTERN.test(trimmedSource)) {
    findings.push({ severity: 'warning', field: 'source', message: 'Doesn’t match one of the four source-line templates (see datawrapper-constants.js).' });
  }
  const isSentence = SOURCE_IS_SENTENCE_RE.test(trimmedSource);
  if (isSentence && !trimmedSource.endsWith('.')) {
    findings.push({ severity: 'warning', field: 'source', message: 'Doesn’t end with a full stop – a "based on ..." clause makes this a sentence, which should end with one.' });
  } else if (!isSentence && trimmedSource.endsWith('.')) {
    findings.push({ severity: 'warning', field: 'source', message: 'Ends with a full stop, but without a "based on ..." clause this isn’t a sentence – drop the full stop.' });
  }
  if (/^UNCTAD\b/.test(source.trim())) {
    findings.push({ severity: 'warning', field: 'source', message: 'Starts with bare "UNCTAD" – use the full name "UN Trade and Development (UNCTAD)".' });
  }
}

/**
 * Section 5 of the brief: text-field checks. Returns
 * `{severity: 'error'|'warning', field, message}[]` – errors should stop
 * `create` unless the caller passes `--strict` is off (i.e. errors always
 * block; `--strict` is for promoting warnings to errors, handled by the
 * caller).
 */
export function validateChartText({ title, description, source, notes }) {
  const findings = [];
  validateTitle(title, findings);
  validateDescription(description, findings);
  validateSource(source, findings);
  checkEmDash('title', title, findings);
  checkEmDash('description', description, findings);
  checkEmDash('source', source, findings);
  checkEmDash('notes', notes, findings);
  return findings;
}
