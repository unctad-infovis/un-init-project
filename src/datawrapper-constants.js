// UNCTAD web-chart guideline constants, distilled from
// tmp/claude-code-brief-datawrapper-cli.md section 3 (the two source
// guideline documents it was itself distilled from –
// unctad-datawrapper-settings-procedure.md and UNCTAD-chart-guidelines.pdf
// – aren't available in this repo or found anywhere else on this machine).
// Verified against the live UNCTAD Datawrapper team per the brief.
//
// 2026-11-26: SERIES_PALETTE's default sequential order was re-aligned to
// match the live `unctad` theme's own categorical colour list
// (`GET /v3/themes/unctad?extend=true` -> data.colors.groups[0].colors[1]:
// #004987, #009EDB, #C5DFEF, #FBAF17, #AEA29A, #A05FB4, #72BF44) rather than
// the other way around – an explicit user decision, even though this means
// the generic default order no longer matches some earlier written
// guidance (and the theme has no slot at all for #B06E2A/#DED9D5). The
// named colour constants below (UN_BLUE, UN_DARK_YELLOW, etc.) are literal
// hex values, not array-index lookups into SERIES_PALETTE – this matters
// because resolveCountryGroupColors/resolveYearPairColors below depend on
// exact named colours (e.g. LDCs = UN_DARK_YELLOW = #B06E2A, a colour the
// theme's own categorical list doesn't carry) that must never silently
// shift just because the generic palette order changed.

export const DEFAULT_ORGANIZATION_ID = 'unctad';
// Confirmed by the user against a real folder URL
// (https://app.datawrapper.de/unctad/archive/team/unctad/437477) – the
// "archive" segment in that URL is worth a one-off sanity check with the
// user that this is genuinely meant to be where new draft mockups land,
// not a folder of already-archived charts.
export const DEFAULT_FOLDER_ID = '437477';

export const THEME_WEB = 'unctad'; // "UNCTAD 2024 – Web and social media"
export const THEME_PRINT = 'unctad-print'; // "UNCTAD 2024 – Publications"
export const LOCALE = 'en-CH';

/**
 * The 11 settings every UNCTAD web chart must have, per section 3.1.
 * `print: true` (the --print flag) swaps the theme and drops the logo +
 * download blocks – "the logo and download blocks do not apply" for a
 * chart destined for a PDF publication – everything else holds.
 */
export function buildBaseMetadata({ print = false } = {}) {
  const publishBlocks = print
    ? {}
    : {
        logo: { id: 'arrow', enabled: true },
        'get-the-data': true,
        'download-image': true,
        'download-svg': false,
        'download-pdf': false,
        embed: false,
      };

  return {
    theme: print ? THEME_PRINT : THEME_WEB,
    language: LOCALE,
    metadata: {
      publish: { blocks: publishBlocks },
      visualize: {
        sharing: { enabled: true, auto: true },
        'y-grid-labels': 'inside',
      },
    },
  };
}

// Named colours, as literal hex values – deliberately NOT derived from
// SERIES_PALETTE's array order (see the 2026-11-26 note above). Rules below
// that name one of these (country groups, year pairs) keep working exactly
// as before no matter how the generic sequential order changes.
export const UN_BLUE = '#009EDB';
export const UN_YELLOW = '#FBAF17';
export const UN_DARK_BLUE = '#004987';
export const UN_DARK_YELLOW = '#B06E2A'; // not in the theme's own categorical list – a deliberate semantic choice for LDCs, not a default-sequence pick
export const LIGHT_BLUE = '#C5DFEF';
export const PURPLE = '#A05FB4';
export const GREEN = '#72BF44';

export const WARM_GREY = '#AEA29A'; // named group: "Other", "Rest of world"
export const PALE_GREY = '#DED9D5'; // background/context series, not what the title is about
// Reserved for highlighting/annotation lines only – never assigned to a series automatically.
export const RESERVED_RED = '#ED1847';

// Assigned to ordinary (non-country-group) series strictly in this order.
// Matches the live `unctad` theme's own default categorical colour list –
// see the 2026-11-26 note above for why this is the theme's order rather
// than the earlier documented UN-blue-first order.
export const SERIES_PALETTE = [
  { name: 'UN dark blue', hex: UN_DARK_BLUE },
  { name: 'UN blue', hex: UN_BLUE },
  { name: 'light blue', hex: LIGHT_BLUE },
  { name: 'UN yellow', hex: UN_YELLOW },
  { name: 'warm grey', hex: WARM_GREY },
  { name: 'purple', hex: PURPLE },
  { name: 'green', hex: GREEN },
];

export const MAX_COLOURED_SERIES = 7;
export const RECOMMENDED_MAX_SERIES = 4;

/**
 * Country-group colour rule – final form confirmed by the user 2026-09-04
 * against N4qHf and 1N7t5 (both show all four groups as separate series):
 * a fixed two-family pairing, no longer conditional on which other groups
 * are present in the same chart (an earlier version of this rule was –
 * see git history/TODO.md if the reasoning matters). Developed/SIDS share
 * the blue family, developing/LDCs share the yellow family:
 *   developed  → UN_BLUE
 *   developing → UN_YELLOW
 *   SIDS       → UN_DARK_BLUE
 *   LDCs       → UN_DARK_YELLOW
 * Always this mapping, regardless of which subset of the four groups a
 * given chart actually shows – there's no clash left to resolve since
 * every group now has its own colour.
 * Keys are matched case-insensitively and tolerate an " economies" suffix
 * (e.g. "Developed economies") since real charts use both forms, and also
 * match the already-opened-up label form (e.g. "Least developed countries
 * (LDCs)", "Small island developing states (SIDS)") since a chart whose
 * data values were renamed per COUNTRY_GROUP_LABELS below no longer has
 * the bare abbreviation as its series key.
 *
 * Also matches "Developing (excl. LDCs)" as "developing" – confirmed
 * 2026-09-09, a real 3-group scatter plot (PCI/SPI analysis) whose groups
 * were exactly "Developed"/"Developing (excl. LDCs)"/"LDC", where the
 * bare `/^developing$/i` check missed the qualifier entirely and this
 * group fell through to `null` (uncoloured). Narrowly scoped to this one
 * confirmed real variant, not a general "starts with Developing" match,
 * matching this function's existing precedent of only matching evidenced
 * shapes (e.g. the `(LDCs)`/`(SIDS)` suffix forms above).
 */
export function classifyCountryGroup(name) {
  const trimmed = (name ?? '').trim().replace(/\s+economies$/i, '');
  if (/^developed$/i.test(trimmed)) return 'developed';
  if (/^developing$/i.test(trimmed) || /^developing\s*\(excl\.?\s*ldcs?\)$/i.test(trimmed)) return 'developing';
  if (/^ldcs?$/i.test(trimmed) || /\(ldcs?\)$/i.test(trimmed)) return 'ldc';
  if (/^sids$/i.test(trimmed) || /\(sids\)$/i.test(trimmed)) return 'sids';
  return null;
}

// Full names for the country-group abbreviations that must never appear
// bare in a chart's legend/series titles – confirmed by the user
// 2026-09-03. Unlike KNOWN_ABBREVIATIONS (which only nudges description
// text to spell an abbreviation out once), these are the exact strings to
// substitute directly into a series/category display label.
export const COUNTRY_GROUP_LABELS = {
  developed: 'Developed',
  developing: 'Developing',
  ldc: 'Least developed countries (LDCs)',
  sids: 'Small island developing states (SIDS)',
};

/**
 * Given the {name: hex} map already on a chart's `visualize.color-category`
 * (or `visualize.lines`), return a corrected copy per classifyCountryGroup's
 * rule above. Only touches keys that are recognised country groups – any
 * other series name's colour is left exactly as-is. Names that don't
 * appear in `allNames` at all can't happen here since the map's own keys
 * are always drawn from the chart's real series.
 */
const COUNTRY_GROUP_COLORS = {
  developed: UN_BLUE,
  developing: UN_YELLOW,
  sids: UN_DARK_BLUE,
  ldc: UN_DARK_YELLOW,
};

export function resolveCountryGroupColors(colorMap) {
  const resolved = { ...colorMap };
  for (const name of Object.keys(colorMap ?? {})) {
    const group = classifyCountryGroup(name);
    if (group) resolved[name] = COUNTRY_GROUP_COLORS[group];
  }
  return resolved;
}

const YEAR_RE = /^(?:19|20)\d{2}$/;

/**
 * A different, narrower colour rule than the country-group one above –
 * confirmed 2026-09-04 on a real two-year comparison chart (xxjf3, "2024"
 * vs "2025" series): the more recent/relevant period is UN_BLUE, the
 * earlier one is UN_YELLOW. Deliberately scoped tight – only fires when
 * the map has *exactly* two keys and both are bare four-digit years – so
 * it can never misfire on an unrelated two-series chart. A chart needing
 * this same "most relevant vs comparison" treatment for something that
 * isn't a plain year pair (e.g. this session's "G20 economies" vs "Other
 * economies", which needed a human to say which side was the focus) is
 * deliberately not auto-detected – ask, don't guess which series is
 * "most relevant" when it isn't a year.
 */
export function resolveYearPairColors(colorMap) {
  const names = Object.keys(colorMap ?? {});
  if (names.length !== 2 || !names.every((n) => YEAR_RE.test(n.trim()))) return colorMap;
  const [a, b] = names;
  const later = Number(a) >= Number(b) ? a : b;
  const earlier = later === a ? b : a;
  return { ...colorMap, [later]: UN_BLUE, [earlier]: UN_YELLOW };
}

// d3-lines line styling, verified against a real chart's `GET /v3/charts/{id}`
// response (see TODO.md) rather than assumed from the brief – Datawrapper's
// own naming for "4 pixels" (the thickest of the 4 solid width options) is
// the literal string "style2", not anything tied to the pixel count.
export const LINE_WIDTH_THICKEST = 'style2';

/**
 * Case-insensitive match for a series that should be auto-assigned
 * WARM_GREY and moved to the end of the colour order, regardless of its
 * position in the CSV – "Other", "Others", "Rest of world", "All other …".
 */
export function isOtherSeriesName(name) {
  const trimmed = name.trim();
  return /^others?$/i.test(trimmed) || /^rest of world$/i.test(trimmed) || /^all other\b/i.test(trimmed);
}

// The four shapes a source line must match. "based on" = reproduced as
// published; "calculations based on" = UNCTAD computed the figures;
// "estimates based on" = UNCTAD modelled/imputed them. A full stop only
// belongs at the end when a "based on ..." clause makes the line an actual
// sentence – bare "UN Trade and Development (UNCTAD)" is a name, not a
// sentence, and shouldn't end with one.
export const SOURCE_LINE_PATTERN = /^UN Trade and Development \(UNCTAD\)(?: (?:calculations |estimates )?based on .+\.)?$/;

// Whether a source line contains a "based on ..." clause, i.e. reads as an
// actual sentence rather than just the organisation name – used to decide
// whether it should end with a full stop.
export const SOURCE_IS_SENTENCE_RE = /\bbased on\b/i;

export const KNOWN_ABBREVIATIONS = ['GDP', 'FDI', 'LDC', 'SIDS', 'ODA', 'ICT', 'SME', 'WTO', 'IMF', 'OECD', 'GVC', 'PPP', 'R&D'];

// Datawrapper chart type ids UNCTAD never publishes as web/print charts –
// the boundaries don't follow UN cartographic conventions.
export function isMapChartType(type) {
  return type.startsWith('d3-maps-') || type === 'locator-map';
}

// The three chart types this tool can build metadata for directly from
// these constants (per the brief's own build-order: verify these before
// adding template-chart-copy support for anything else).
export const SUPPORTED_CHART_TYPES = ['d3-lines', 'column-chart', 'd3-bars'];
