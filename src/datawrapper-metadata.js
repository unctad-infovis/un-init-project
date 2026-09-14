import {
  buildBaseMetadata, SERIES_PALETTE, WARM_GREY, PALE_GREY,
  MAX_COLOURED_SERIES, RECOMMENDED_MAX_SERIES, isOtherSeriesName,
  LINE_WIDTH_THICKEST, classifyCountryGroup, COUNTRY_GROUP_LABELS,
} from './datawrapper-constants.js';

// Only the handful of entities actually seen in real print-chart text
// (trailing `&nbsp;` from a copy-pasted title, `&amp;` in "R&D" etc.) —
// not a general HTML-entity decoder, since anything more exotic is worth
// seeing raw rather than silently guessing at.
const HTML_ENTITIES = { '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };

/**
 * Strip inline HTML (e.g. old print charts' `<span style="font-size:
 * 14px;">...</span>` styling) and decode the common entities down to
 * plain text. Confirmed 2026-09-04: tag-stripping alone left a literal
 * trailing "&nbsp;" in a real chart's title, since `&nbsp;` isn't a tag.
 */
export function stripHtml(text) {
  let result = (text ?? '').replace(/<[^>]+>/g, '');
  for (const [entity, char] of Object.entries(HTML_ENTITIES)) {
    result = result.replaceAll(entity, char);
  }
  return result.trim();
}

/**
 * Which of a chart's series names need their legend/axis label "opened up"
 * from a bare abbreviation – confirmed by the user 2026-09-03: "LDC"/"LDCs"
 * and "SIDS" must never stand alone in a legend, unlike "Developed"/
 * "Developing" which are already full words and don't need touching.
 * Returns `{name: expandedLabel}` only for the names that actually need it.
 *
 * Also opens up an "excl." qualifier inside a "developing"-classified name
 * – confirmed 2026-09-09, the user's own edit to a real chart's legend:
 * "Developing (excl. LDCs)" → "Developing (excluding LDCs)". Unlike the
 * ldc/sids case above (bare abbreviation → full replacement name), this
 * preserves the original qualifier structure and only spells out the
 * abbreviated word inside it – bare "Developing" has no "excl." substring
 * so this never touches it.
 */
export function buildCountryGroupLabelOverrides(names) {
  const overrides = {};
  for (const name of names ?? []) {
    const group = classifyCountryGroup(name);
    if (group === 'ldc' || group === 'sids') overrides[name] = COUNTRY_GROUP_LABELS[group];
    else if (group === 'developing' && /excl\.?/i.test(name)) overrides[name] = name.replace(/excl\.?/i, 'excluding');
  }
  return overrides;
}

/**
 * Normalise a source line to guarantee "UN Trade and Development (UNCTAD)"
 * is present, per user instruction – older/print charts sometimes have a
 * source line that never mentions UNCTAD at all (just the underlying data
 * provider). If the text already carries a "based on"/"calculations based
 * on"/"estimates based on" clause it's kept as-is (just re-prefixed);
 * otherwise "based on" is the default verb when none is specified. A
 * source that, once the UNCTAD prefix is accounted for, has no remaining
 * text collapses to the bare name (no clause, no trailing period – see
 * SOURCE_IS_SENTENCE_RE).
 */
export function normalizeSourceLine(rawSource) {
  // A hyphen surrounded by spaces is always standing in for a dash between
  // clauses (e.g. "based on ITU - Aggregation based on ...") – a real
  // hyphenated compound word never has spaces around it, so this is safe
  // to rewrite unconditionally, not just in year ranges.
  const cleaned = stripHtml(rawSource).replace(/\.$/, '').replace(/ - /g, ' – ').trim();
  if (!cleaned) return 'UN Trade and Development (UNCTAD)';

  // The prefix can be followed by a comma before its own "based on" clause
  // (e.g. "UN Trade and Development (UNCTAD), based on Clarksons ...") –
  // confirmed 2026-09-04 as a real bug: leaving the comma in `remainder`
  // meant it never matched the "based on" test below, so the function
  // prepended a *second* "based on" in front of the comma, producing a
  // malformed "based on , based on Clarksons ..." on a real chart.
  // Also confirmed the same day: some real source lines spell the prefix
  // as bare "UN Trade and Development," with no "(UNCTAD)" at all – that
  // didn't match either prefix pattern before, so the whole line (prefix
  // included) got treated as the "remainder" and re-wrapped, producing
  // "UN Trade and Development (UNCTAD) based on UN Trade and Development,
  // based on ...". Stripped as its own pattern now, tried before the
  // "(UNCTAD)" one so it still matches when the parenthetical is missing.
  let remainder = cleaned
    .replace(/^UN Trade and Development \(UNCTAD\)[,\s]*/i, '')
    .replace(/^UN Trade and Development\b[,\s]*/i, '')
    .replace(/^UNCTAD\b[.,]?\s*/i, '');

  if (!remainder) return 'UN Trade and Development (UNCTAD)';

  if (!/^(calculations |estimates )?based on\s+/i.test(remainder)) {
    remainder = `based on ${remainder}`;
  }

  // A literal doubled "based on based on" is a real typo seen in actual
  // source data (not something this function introduces) – safe to
  // collapse unconditionally, same reasoning as the en-dash/space-hyphen
  // fixes above: no legitimate source line ever repeats the verb.
  remainder = remainder.replace(/\bbased on\s+based on\b/gi, 'based on');

  return `UN Trade and Development (UNCTAD) ${remainder}.`;
}

/**
 * Assign palette colours to a list of series names, per section 3.2:
 * - A series matching `--other` or the auto "Other/Rest of world" pattern
 *   always gets WARM_GREY and moves to the end of the order, regardless
 *   of its position in the CSV.
 * - `--highlight <name>` is a different mode entirely, not just "give this
 *   one a colour first": the highlighted series gets UN blue and every
 *   *other* coloured series gets PALE_GREY instead of its own palette
 *   colour (acceptance test 6 in the brief) – Other-named series still
 *   get WARM_GREY and move last even in this mode.
 * - Otherwise, palette colours are assigned in strict order to the
 *   remaining (non-Other) series in their original CSV order.
 *
 * Returns `{ colorMap, orderedNames, errors, warnings }` – errors mean
 * `create` should stop (too many series, or `--highlight`/`--other` naming
 * something not in the CSV); warnings print and continue.
 */
export function assignPalette(seriesNames, { highlight, other } = {}) {
  const errors = [];
  const warnings = [];

  if (highlight && !seriesNames.includes(highlight)) {
    errors.push(`--highlight "${highlight}" is not one of the series in the CSV: ${seriesNames.join(', ')}.`);
  }
  if (other && !seriesNames.includes(other)) {
    errors.push(`--other "${other}" is not one of the series in the CSV: ${seriesNames.join(', ')}.`);
  }
  if (errors.length) return { colorMap: {}, orderedNames: [], errors, warnings };

  const otherNames = new Set(seriesNames.filter((name) => name === other || isOtherSeriesName(name)));
  const colouredNames = seriesNames.filter((name) => !otherNames.has(name));

  const colorMap = {};

  if (highlight) {
    for (const name of colouredNames) {
      colorMap[name] = name === highlight ? SERIES_PALETTE[0].hex : PALE_GREY;
    }
  } else {
    if (colouredNames.length > MAX_COLOURED_SERIES) {
      errors.push(`${colouredNames.length} coloured series exceeds the maximum of ${MAX_COLOURED_SERIES} – use --other to group the tail, or split into two charts.`);
      return { colorMap: {}, orderedNames: [], errors, warnings };
    }
    if (colouredNames.length >= 5) {
      warnings.push(`${colouredNames.length} coloured series – the guidelines say aim for ${RECOMMENDED_MAX_SERIES}.`);
    }
    colouredNames.forEach((name, i) => {
      colorMap[name] = SERIES_PALETTE[i].hex;
    });
  }

  for (const name of otherNames) colorMap[name] = WARM_GREY;

  const orderedNames = [...colouredNames, ...seriesNames.filter((n) => otherNames.has(n))];
  return { colorMap, orderedNames, errors, warnings };
}

/**
 * Build the `visualize.lines` block for a d3-lines chart, per series –
 * verified against a real chart's `GET /v3/charts/{id}` response (see
 * TODO.md): thickest available line width always; never a direct label
 * next to the line end (it clutters the plot area and doesn't scale past
 * one series); a colour-key legend only when there's more than one
 * series – with a single series, the title/description already say what
 * the line is, so no legend or label at all; always solid, never dashed –
 * confirmed 2026-09-14 on a real chart (QeVNv/M1cHm): a print chart's own
 * dash pattern (e.g. `dash: 'style1'`) silently carried over untouched,
 * since this function never set the field at all, only relying on the
 * caller never having one to begin with. `dash: null` is the value that
 * actually clears an existing dash on `PATCH /v3/charts/{id}` (confirmed
 * by testing – omitting the key entirely leaves whatever the source had,
 * since `visualize` deep-merges).
 */
export function buildLineStyles(orderedNames) {
  const showLegend = orderedNames.length > 1;
  const lines = {};
  for (const name of orderedNames) {
    lines[name] = {
      width: LINE_WIDTH_THICKEST,
      dash: null,
      directLabel: false,
      ...(showLegend ? { colorKey: true } : {}),
    };
  }
  return lines;
}

/**
 * Build the full `{ theme, language, metadata }` shape for
 * `POST /v3/charts` (theme/language) and `PATCH /v3/charts/{id}`
 * (metadata) – the section 3.1 settings, the palette from `assignPalette`,
 * and the describe/annotate text fields. Shared across d3-lines,
 * column-chart and d3-bars, which the brief identifies as not needing
 * chart-type-specific structure for these particular fields – real risk
 * (per the brief's own caveat that the metadata schema is chart-type-
 * specific and not fully documented) is verified against a real created
 * chart's `GET /v3/charts/{id}` response, not assumed here.
 */
export function buildChartMetadata({ type, print, description, source, sourceUrl, notes, seriesNames, highlight, other }) {
  const base = buildBaseMetadata({ print });
  const palette = assignPalette(seriesNames, { highlight, other });

  const metadata = {
    ...base.metadata,
    describe: {
      intro: description,
      'source-name': source,
      ...(sourceUrl ? { 'source-url': sourceUrl } : {}),
    },
    annotate: { notes: notes || '' },
    visualize: {
      ...base.metadata.visualize,
      'color-category': { map: palette.colorMap },
      ...(type === 'd3-lines' ? { lines: buildLineStyles(palette.orderedNames) } : {}),
    },
  };

  return { theme: base.theme, language: base.language, metadata, palette };
}
