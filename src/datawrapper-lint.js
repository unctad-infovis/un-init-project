import { getChart, patchMetadata } from './datawrapper-api.js';
import { validateChartText } from './datawrapper-validate.js';
import { buildBaseMetadata, isMapChartType, SERIES_PALETTE, WARM_GREY, PALE_GREY, RESERVED_RED } from './datawrapper-constants.js';
import { COMMON_INFORMAL_TO_OFFICIAL } from './datawrapper-country-names.js';

/**
 * The 11 settings from procedures/apply-unctad-settings.md (and
 * src/datawrapper-constants.js's buildBaseMetadata), each as a getter off
 * the live chart object and its target value. Shared by lintChart (report
 * only) and applySettingsToChart (report + patch) so the two commands can
 * never silently drift apart on what "compliant" means.
 *
 * A getter returning `undefined` means the chart has no such field at all
 * (e.g. a donut chart has no y-grid-labels) – reported as "not applicable",
 * never as "non-compliant", per the procedure doc's own guidance: a
 * rejected/absent value usually means the chart type doesn't support that
 * setting, not that something is wrong.
 */
function buildSettingsChecks(chart) {
  const base = buildBaseMetadata({ print: false });
  const blocks = chart.metadata?.publish?.blocks;
  const visualize = chart.metadata?.visualize;

  return [
    { name: 'language', get: () => chart.language, target: base.language },
    { name: 'theme', get: () => chart.theme, target: base.theme },
    { name: 'logo', get: () => blocks?.logo && JSON.stringify(blocks.logo), target: JSON.stringify(base.metadata.publish.blocks.logo) },
    { name: 'get-the-data', get: () => blocks?.['get-the-data'], target: base.metadata.publish.blocks['get-the-data'] },
    { name: 'download-image', get: () => blocks?.['download-image'], target: base.metadata.publish.blocks['download-image'] },
    { name: 'download-svg', get: () => blocks?.['download-svg'], target: base.metadata.publish.blocks['download-svg'] },
    { name: 'download-pdf', get: () => blocks?.['download-pdf'], target: base.metadata.publish.blocks['download-pdf'] },
    { name: 'embed', get: () => blocks?.embed, target: base.metadata.publish.blocks.embed },
    { name: 'sharing.enabled', get: () => visualize?.sharing?.enabled, target: base.metadata.visualize.sharing.enabled },
    { name: 'sharing.auto', get: () => visualize?.sharing?.auto, target: base.metadata.visualize.sharing.auto },
    { name: 'y-grid-labels', get: () => visualize?.['y-grid-labels'], target: base.metadata.visualize['y-grid-labels'] },
  ];
}

const KNOWN_PALETTE_HEXES = new Set([
  ...SERIES_PALETTE.map((c) => c.hex.toUpperCase()),
  WARM_GREY.toUpperCase(),
  PALE_GREY.toUpperCase(),
  RESERVED_RED.toUpperCase(),
  '#B06E2A', // UN dark yellow – not in the generic sequence, but a deliberate role colour (LDCs)
]);

/**
 * Best-effort palette check: flags any series colour that isn't one of the
 * known UNCTAD palette/role colours. Deliberately not a strict order check –
 * country-group, year-pair and --highlight assignment all have legitimate
 * reasons to depart from the plain CSV-order sequence, so asserting order
 * from outside would false-positive on exactly the charts doing it right.
 */
function checkPaletteColors(chart) {
  const map = chart.metadata?.visualize?.['color-category']?.map;
  if (!map) return [];
  const unknown = [...new Set(Object.values(map).map((hex) => String(hex).toUpperCase()))].filter((hex) => !KNOWN_PALETTE_HEXES.has(hex));
  if (unknown.length === 0) return [];
  return [{ severity: 'warning', field: 'color-category', message: `Uses colour(s) outside the UNCTAD palette/role set: ${unknown.join(', ')}.` }];
}

/**
 * Flags series/category names in `color-category.map` that are informal
 * country names (e.g. "Turkey" instead of "Türkiye") against the same
 * curated `COMMON_INFORMAL_TO_OFFICIAL` list used for the CSV-side check
 * in `csv-inspect.js` and the `to-web` conversion check. A style
 * convention, not a render break, so warning severity.
 */
function checkCountryNames(chart) {
  const map = chart.metadata?.visualize?.['color-category']?.map;
  if (!map) return [];
  return Object.keys(map)
    .filter((name) => Object.hasOwn(COMMON_INFORMAL_TO_OFFICIAL, name))
    .map((name) => ({ severity: 'warning', field: 'color-category', message: `Category "${name}" is an informal country name – the official UNCTAD name is "${COMMON_INFORMAL_TO_OFFICIAL[name]}".` }));
}

/**
 * Read-only compliance report for an existing chart – the automated form
 * of procedures/apply-unctad-settings.md + the brief's `dwchart lint`.
 * Never calls the API except GET.
 */
export async function lintChart({ token, chartId }) {
  const chart = await getChart({ token, chartId });
  const checks = buildSettingsChecks(chart);

  const changed = [];
  const alreadyCorrect = [];
  const notApplicable = [];
  for (const check of checks) {
    const current = check.get();
    if (current === undefined) {
      notApplicable.push({ name: check.name });
    } else if (current === check.target) {
      alreadyCorrect.push({ name: check.name });
    } else {
      changed.push({ name: check.name, current, target: check.target });
    }
  }

  const textFindings = validateChartText({
    title: chart.title,
    description: chart.metadata?.describe?.intro,
    source: chart.metadata?.describe?.['source-name'],
    notes: chart.metadata?.annotate?.notes,
  });

  const paletteFindings = checkPaletteColors(chart);
  const countryNameFindings = checkCountryNames(chart);
  const isMap = isMapChartType(chart.type);

  return {
    chartId,
    title: chart.title,
    type: chart.type,
    compliant: changed.length === 0 && !isMap && textFindings.every((f) => f.severity !== 'error'),
    changed,
    alreadyCorrect,
    notApplicable,
    textFindings: [...textFindings, ...paletteFindings, ...countryNameFindings],
    isMapChart: isMap,
  };
}

/**
 * Applies only the 11 settings to an existing draft – never touches
 * content (title/describe/annotate/data/chart type). Mirrors
 * runConvertToWebPipeline's dry-run convention: --dry-run computes and
 * reports the patch without calling PATCH. Always reports "not published –
 * republish required", per procedures/apply-unctad-settings.md's own
 * stop-before-publishing rule – this tool never publishes.
 */
export async function applySettingsToChart({ token, chartId, dryRun = false }) {
  const before = await lintChart({ token, chartId });
  const base = buildBaseMetadata({ print: false });

  const result = {
    chartId,
    title: before.title,
    changed: before.changed,
    alreadyCorrect: before.alreadyCorrect,
    notApplicable: before.notApplicable,
    dryRun,
    patch: { language: base.language, theme: base.theme, metadata: base.metadata },
    verified: null,
  };
  if (dryRun || before.changed.length === 0) return result;

  await patchMetadata({ token, chartId, language: base.language, theme: base.theme, metadata: base.metadata });
  const after = await lintChart({ token, chartId });
  result.verified = { changed: after.changed, alreadyCorrect: after.alreadyCorrect, notApplicable: after.notApplicable };
  return result;
}
