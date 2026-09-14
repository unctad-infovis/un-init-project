import fs from 'node:fs';
import { parse } from 'csv-parse/sync';

// Node has no built-in CSV module the way Python does; a hand-rolled
// splitter would get quoted-field/embedded-comma handling subtly wrong in
// exactly the cases this module most needs to get right (a thousands
// separator like "1,234" inside a quoted numeric cell). csv-parse is a
// small, dependency-free, well-tested sync parser – one new dependency,
// but correctness here matters more than avoiding it.

const YEAR_RE = /^(1[89]|20)\d{2}$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PLACEHOLDER_VALUES = new Set(['n/a', 'na', '..', '-', 'null', '#n/a']);
const THOUSANDS_SEPARATOR_RE = /^-?\d{1,3}([, ]\d{3})+(\.\d+)?$/; // e.g. "1,234" or "1 234.5"
const UNIT_SUFFIX_RE = /^-?\d[\d.,\s]*\s*(%|kg|km|usd|\$|€|£)$/i;

/** Read a CSV file into a header row + data rows, all raw strings. */
export function readCsv(filePath) {
  let text = fs.readFileSync(filePath, 'utf8');
  // Excel's "CSV UTF-8" export writes a leading byte-order mark, which
  // Node decodes as a literal U+FEFF character glued onto the first
  // header cell (e.g. "﻿Year") – csv-parse doesn't strip it. Most
  // `.trim()` calls elsewhere already remove it incidentally (U+FEFF is
  // whitespace per the JS spec), but the raw header array returned here
  // is also displayed as-is in a couple of places, so strip it once at
  // the source rather than relying on every downstream trim to catch it.
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const records = parse(text, { columns: false, skip_empty_lines: false, relax_column_count: true });
  if (records.length === 0) throw new Error(`"${filePath}" is empty.`);
  const [header, ...rows] = records;
  return { header, rows };
}

function isYearLike(value) {
  return YEAR_RE.test(value.trim());
}

function isDateLike(value) {
  const trimmed = value.trim();
  return isYearLike(trimmed) || ISO_DATE_RE.test(trimmed);
}

function isNumericLike(value) {
  const trimmed = value.trim();
  if (trimmed === '') return false;
  if (!Number.isNaN(Number(trimmed))) return true;
  return THOUSANDS_SEPARATOR_RE.test(trimmed);
}

/** Classify each column (by index) as 'date' | 'numeric' | 'text', from its non-empty values. */
export function detectColumnTypes(header, rows) {
  return header.map((_, colIdx) => {
    const values = rows.map((r) => (r[colIdx] ?? '').trim()).filter((v) => v !== '' && !PLACEHOLDER_VALUES.has(v.toLowerCase()));
    if (values.length === 0) return 'text';
    if (values.every(isDateLike)) return 'date';
    if (values.every(isNumericLike)) return 'numeric';
    return 'text';
  });
}

/**
 * Data problems a human should fix before charting: blank rows, duplicate
 * or empty header cells, numbers stored as text with thousands separators
 * or embedded units, and "n/a"/".."-style placeholders that should be
 * empty cells instead.
 */
/**
 * A header cell that's itself a number (e.g. "3.14") is essentially never a
 * real column name – it means the file has no header row at all and its
 * first data row got consumed as one, silently dropping that row from the
 * chart entirely. Exported separately (not just folded into
 * `detectDataProblems`'s string list) because `create` needs to block on
 * this specifically, not just warn – unlike the other problems here, this
 * one silently loses data rather than just reading them oddly.
 */
export function detectMissingHeaderRow(header) {
  const numericHeaderIdx = header.findIndex((h) => isNumericLike(h ?? ''));
  if (numericHeaderIdx === -1) return null;
  return `Column ${numericHeaderIdx + 1}'s header is "${header[numericHeaderIdx]}" – a number, not a label. This file likely has no header row; its first data row is being read as column names and silently dropped from the data. Add a header row before charting.`;
}

export function detectDataProblems(header, rows) {
  const problems = [];

  const missingHeaderProblem = detectMissingHeaderRow(header);
  if (missingHeaderProblem) problems.push(missingHeaderProblem);

  const emptyHeaderIdx = header.findIndex((h) => !h || !h.trim());
  if (emptyHeaderIdx !== -1) problems.push(`Column ${emptyHeaderIdx + 1} has no header – likely a merged/split header row.`);

  const seenHeaders = new Map();
  header.forEach((h, i) => {
    const key = h.trim().toLowerCase();
    if (!key) return;
    if (seenHeaders.has(key)) problems.push(`Duplicate header "${h}" (columns ${seenHeaders.get(key) + 1} and ${i + 1}).`);
    else seenHeaders.set(key, i);
  });

  rows.forEach((row, rowIdx) => {
    if (row.every((cell) => !cell || !cell.trim())) {
      problems.push(`Row ${rowIdx + 2} is blank.`); // +2: 1-indexed, plus the header row
    }
  });

  const thousandsCols = new Set();
  const unitCols = new Set();
  const placeholderCols = new Set();
  for (const row of rows) {
    row.forEach((cell, colIdx) => {
      const trimmed = (cell ?? '').trim();
      if (!trimmed) return;
      if (PLACEHOLDER_VALUES.has(trimmed.toLowerCase())) placeholderCols.add(colIdx);
      else if (THOUSANDS_SEPARATOR_RE.test(trimmed)) thousandsCols.add(colIdx);
      else if (UNIT_SUFFIX_RE.test(trimmed)) unitCols.add(colIdx);
    });
  }
  for (const colIdx of thousandsCols) problems.push(`Column "${header[colIdx] ?? colIdx + 1}" has numbers stored as text with a thousands separator (e.g. "1,234") – Datawrapper will read these as text, not numbers.`);
  for (const colIdx of unitCols) problems.push(`Column "${header[colIdx] ?? colIdx + 1}" has units embedded in the numbers (e.g. "5%") – move the unit to the column header/description and leave cells numeric.`);
  for (const colIdx of placeholderCols) problems.push(`Column "${header[colIdx] ?? colIdx + 1}" uses "n/a"/".."-style placeholders – leave these cells empty instead so Datawrapper treats them as missing data, not zero.`);

  return problems;
}

/**
 * Weak signal for "these values are parts of a whole", used to decide
 * between d3-donuts and column-chart for the same 2-5-category, one-series
 * shape – column count/row count alone can't tell them apart (a column
 * chart of 4 countries' GDP per capita has the exact same shape as a
 * donut of 4 regions' market share), so this only fires when the column
 * header hints at it or the values themselves sum close to 100.
 */
function looksLikeShareOfWhole(header, rows, seriesColIdx) {
  const headerText = (header[seriesColIdx] || '').toLowerCase();
  if (/%|percent|share/.test(headerText)) return true;

  const values = rows
    .map((r) => Number((r[seriesColIdx] || '').replace(/[, ]/g, '')))
    .filter((v) => !Number.isNaN(v));
  if (values.length === 0) return false;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum > 95 && sum < 105;
}

/**
 * Chart-type recommendation, per the brief's own shape table. Deliberately
 * simple and explainable – a suggestion with a one-line reason, never
 * applied automatically. The "sums to a total" vs. "independent series"
 * distinction for multi-series category data is a genuine judgment call
 * (detecting it generically is unreliable) – defaults to
 * grouped-column-chart unless the numeric columns visibly sum to a
 * separate total column, which is called out explicitly in the reason
 * either way.
 */
export function recommendChartType({ header, rows, columnTypes }) {
  const firstColType = columnTypes[0];
  const numericCols = columnTypes.slice(1).filter((t) => t === 'numeric').length;
  const rowCount = rows.length;
  const longestLabel = firstColType === 'text' ? Math.max(0, ...rows.map((r) => (r[0] ?? '').length)) : 0;

  if (firstColType === 'date' && numericCols >= 1 && numericCols <= 6) {
    return { type: 'd3-lines', reason: `First column looks like years/dates with ${numericCols} numeric series.` };
  }

  // "Two numeric columns, no time dimension": only reachable when the
  // first column is itself numeric (not categorical) and there's exactly
  // one more numeric column alongside it.
  if (columnTypes[0] === 'numeric' && numericCols === 1) {
    return { type: 'd3-scatter-plot', reason: 'Two numeric columns, no time dimension.' };
  }

  if (firstColType === 'text' && numericCols === 1) {
    const seriesColIdx = columnTypes.findIndex((t, i) => i > 0 && t === 'numeric');
    if (rowCount >= 2 && rowCount <= 5 && looksLikeShareOfWhole(header, rows, seriesColIdx)) {
      return { type: 'd3-donuts', reason: `${rowCount} categories whose values sum to roughly 100% – looks like a share of a whole.` };
    }
    if (rowCount > 12 || longestLabel > 20) {
      return { type: 'd3-bars', reason: `${rowCount} categories${longestLabel > 20 ? ' with long labels' : ''} – horizontal bars read better than a column chart here.` };
    }
    return { type: 'column-chart', reason: `${rowCount} categories, one series – fits a simple column chart.` };
  }

  if (firstColType === 'text' && numericCols >= 2) {
    const totalColIdx = header.findIndex((h) => /^total$/i.test(h.trim()));
    if (totalColIdx !== -1) {
      return { type: 'stacked-column-chart', reason: `Multiple series plus a "${header[totalColIdx]}" column suggest they sum to a total.` };
    }
    return { type: 'grouped-column-chart', reason: `Multiple series across ${rowCount} categories, no total column found – assuming independent series, not parts of a whole. If these DO sum to a total, use stacked-column-chart instead.` };
  }

  return { type: null, reason: 'Could not confidently match a known shape – inspect the columns and pick a type manually.' };
}

/** Full inspection report for `check` and as pre-flight validation inside `create`. */
export function inspectCsv(filePath) {
  const { header, rows } = readCsv(filePath);
  const columnTypes = detectColumnTypes(header, rows);
  const problems = detectDataProblems(header, rows);
  const recommendation = recommendChartType({ header, rows, columnTypes });

  return {
    filePath,
    header,
    rowCount: rows.length,
    columnCount: header.length,
    columnTypes,
    isTimeSeries: columnTypes[0] === 'date',
    seriesCount: columnTypes.slice(1).filter((t) => t === 'numeric').length,
    problems,
    recommendation,
  };
}
