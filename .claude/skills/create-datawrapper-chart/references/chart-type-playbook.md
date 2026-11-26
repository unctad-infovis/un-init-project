# Chart-type playbook: types `create`/`to-web` don't build metadata for yet

`src/create-datawrapper-pipeline.js` only builds metadata directly for
`SUPPORTED_CHART_TYPES` (`d3-lines`, `column-chart`, `d3-bars`) and `to-web` only
applies its full overlay to whatever type the source print chart already is. Every
type below still has to be built by hand – `copyChart()` from an existing styled
template, then `uploadData()` + `patchMetadata()` for the differences – following the
same pattern Datawrapper's own docs recommend and `references/api-gotchas.md`'s
"Finding an undocumented metadata shape" section describes. Promoted out of `SKILL.md`
so that file doesn't keep growing with type-specific prose; nothing here changes how
`check`/`create`/`to-web` behave.

## Building a `d3-scatter-plot` chart

First built 2026-09-09, a real chart (`fqrFs`, PCI input-missing-rate vs.
World Bank SPI index, coloured by country group, 184 points). No print
source chart existed for this one and the `create` CLI doesn't support
this chart type yet (see `TODO.md`) — followed the brief's own suggested
approach: `copyChart()` from an existing, already-UNCTAD-styled
`d3-scatter-plot` chart (any real one already on the team's Datawrapper,
e.g. `ISjSH`) as a template, then `uploadData()` with the new CSV and
patch just what differs. Real findings from that first build, all still
manual (nothing here is wired into `to-web`/`create` yet):

- **CSV column headers become the axis titles directly** — same "the
  label comes from the data, not a metadata override" rule as the
  `multiple-columns` bar-chart caveat in `SKILL.md`, but here it's the norm, not
  a caveat: give the CSV real header text (`"SPI Index"`, `"PCI Input
  Missing Rate (%)"`), not a code-style column name (`spi_index`) — the
  chart shows the header verbatim as its axis title.
- **The tooltip template's variable names don't just lowercase-and-
  underscore the header** — confirmed by trial and error: `"SPI Index"`
  → `spi_index` (as expected), but `"PCI Input Missing Rate (%)"` →
  `pci_input_missing_rate` (keeps "input", drops "(%)" and "missing
  rate"'s own words differently than a naive guess predicts). **Don't
  guess the tooltip variable name from the header text** — hover a real
  point in the editor first; a wrong variable name fails silently in the
  saved metadata and only shows as "Woops! There's a javascript error in
  your template: undefined variable: ..." live on hover, not at save time.
- **Copying from a template chart carries over that chart's own
  chart-specific settings that don't apply to the new data** — confirmed
  on `ISjSH` → `fqrFs`: the template's `y-axis.range` (`[-18, 18]`, a
  jittered scatter spread specific to *that* chart's own data), its
  `x-format`/`y-format` (`0%` on an axis that isn't a percentage in the
  new chart), `text-annotations`/`range-annotations` (threshold lines
  specific to the template's own story), and `auto-labels: true` (which
  auto-picked outlier country labels irrelevant to the new chart) all
  came across and had to be reset by hand. Always visually check both
  axes' range/format and clear any inherited annotations before treating
  a copied scatter plot as ready — this template-copy approach carries
  more chart-specific baggage across than `to-web`'s own copy step does.
- **Axis number format should match what the underlying value actually
  is** — corrected by the user after the first pass: a percentage-valued
  column (`"PCI Input Missing Rate (%)"`) needs `y-format: '0%'`, not a
  bare `'0'` — a plain index score (`"SPI Index"`) correctly stays `'0'`.
  Don't default every numeric axis to the same format; check what the
  column actually represents. (See `references/api-gotchas.md` – `0%`
  takes 0–100, not a fraction.)
- **A regression line's equation/R² doesn't render automatically** —
  Datawrapper's own `regression: true` / `regression-method: 'linear'`
  draws the line but shows no equation text. If the source figure had one
  (a real print chart's own headline stat), compute it independently from
  the same CSV being uploaded (simple OLS: slope, intercept, R²) rather
  than copying the print figure's printed numbers uncross-checked, then
  add it as a `text-annotations` entry — computing it independently and
  getting the same numbers as the print figure is itself a good sanity
  check that the extracted data matches.
- **The user's own follow-up edits after a first pass** (`fqrFs`, layout
  tab): tightened `x-axis.range` to the real data's span with a little
  padding (`[20, 100]` instead of `[0, 100]`, since the real minimum was
  ~27.5) rather than leaving the full 0–100 default; reduced marker size
  (`fixed-size: 16 → 8`) for a dense scatter (184 points) to cut
  overplotting; turned on full gridlines both axes (`x-grid-lines`/
  `y-grid-lines: 'on'`); slightly taller plot (`plotHeightFixed: 280 →
  300`). Only one real example so far — worth checking for on a future
  dense scatter plot, not yet confident enough to bake in as an automatic
  rule at a specific point count.

## Building a `tables` chart

First built 2026-09-14, three real charts for a Nigeria poverty report
(`mHmuy`, `yCMU7`, `O9FXa` – redoing three print tables as Datawrapper
"Table" visualizations, titles/descriptions from a content-brief `.odt`
rather than a `.docx`). No print source chart existed for any of them (the
originals were plain print-layout tables, not Datawrapper charts at all),
and the `create` CLI doesn't support this type yet – built directly via
`createChart`/`uploadData`/`patchMetadata`, using `buildBaseMetadata` for
the standard web overlay (theme/language/publish blocks/sharing) plus a
manual `visualize` overlay for table-specific display (`striped: true`,
`sortTable: false`, `searchable: false`, `pagination: {enabled: false}`
for a small static table, `header.style.bold: true` with a `2px` bottom
border – matched to an existing well-styled real chart in the account,
`6bCrU`, found by filtering the account's charts for `type: 'tables'`).

- **A `tables` chart's "auto" number format silently rounds decimals away
  on some columns but not others, with no error or warning** – confirmed
  on two of the three real charts above: `27.2` rendered as `27`, `112.47`
  as `112`, `7.5` as `8`. The third chart's columns (all consistent
  2-decimal values, e.g. `1.59`, `-3.47`) rendered correctly with `auto`
  and needed no fix – the rounding isn't consistent-precision-triggered
  (one of the broken columns, Table 10's Gini index, was *itself*
  consistently 1-decimal throughout and still got rounded to integers),
  so don't assume a column is safe just because its own values share a
  decimal count. **Always set an explicit format** rather than trusting
  `auto` on a `tables` chart with any non-integer data: `visualize.columns`
  keyed by the exact CSV column header text, `{ type: 'number', format:
  '0.[00]' }` per column (the `[00]` square brackets mean "up to 2 decimal
  places, trailing zeros trimmed" – so `65` still renders as `65`, not
  `65.00`, while `112.47` renders exactly, not rounded). Confirmed only
  after an `exportChart` PNG re-render – the raw metadata/API response
  gives no indication anything is wrong, since `auto` is a legitimate,
  silently-accepted value.
- **`exportChart`'s default render height cuts off a `tables` chart with
  more than a handful of rows** – unlike an axis-based chart type, a table
  has no `plotHeightFixed` to size the render by default. Pass an explicit
  `height` query param (e.g. `900` for a 5-row table, scale up for more
  rows) directly in the export request – `exportChart` in
  `src/datawrapper-api.js` doesn't expose this param yet, so call the API
  directly with an extra `height` entry in the `URLSearchParams` until
  that's added. Purely a verification-render issue – the live chart itself
  isn't cropped, only the PNG snapshot used to check it without a browser.
- **A print table's own "Source:" line sometimes bundles a citation and a
  methodology note together** (e.g. "Computed based on data from
  UNCTADstat, and World Bank PIP database. For each variable, the first
  and last year for which data is available, in the phase under
  consideration, was used in the computation of the annualized growth
  rates.") – split by hand into `describe['source-name']` (the citation,
  run through the same "UN Trade and Development (UNCTAD) based on ..."
  convention as every other chart type, `normalizeSourceLine` from
  `src/datawrapper-metadata.js`) and `annotate.notes` (the methodology
  explanation), rather than jamming the whole sentence into one over-long
  source line. `normalizeSourceLine` assumes the remainder already reads
  naturally after "UN Trade and Development (UNCTAD)" – a source starting
  with its own verb already ("Computed based on...") needs the split done
  manually first, since running the whole sentence through the function
  verbatim produces an awkward doubled "based on ... based on ...".
- **A brief's suggested title/description for a table can be narrower in
  scope than the table's actual columns** – confirmed on Table 10
  ("Selected inequality indicators for Nigeria", 3 columns: Gini index,
  income share of the highest 10%, income share of the lowest 20%): the
  brief's own suggested figure text only described "Gini index, Nigeria,
  1985–2022" – written for a simpler Gini-only line chart the brief
  separately flagged as a "Suggested graph" alternative to the full table.
  Used the brief's title verbatim (it's still accurate as an umbrella
  headline) but flagged the scope mismatch to the user rather than either
  dropping two real columns to match the narrower description, or silently
  expanding the brief's own wording to cover them.
- Datawrapper's per-row highlight styling on the original print table (a
  distinct background colour on a "Remarks" row) has no equivalent applied
  here – the converted table uses only the standard alternating stripe,
  not a special one-off row colour. Not automated; worth a manual
  `visualize.rows` override (per-row style, distinct from `visualize.
  columns`) if it matters for a specific table, not attempted this time.

## Faking a chart type Datawrapper doesn't have: the beeswarm technique

Datawrapper has no beeswarm chart type (a one-dimensional scatter where points of
similar value pack sideways instead of overlapping). A real worked example – the
UNCTAD seaweed-exports beeswarm, 110 economies – is ported in full at
`references/examples/seaweed/` (`build_beeswarm.py`, `seaweed_v2.csv`,
`datawrapper-setup.md`). The general technique, reusable for any "Datawrapper has no
chart type for this" request:

- **Precompute the layout, then plot it as an ordinary `d3-scatter-plot`.** Datawrapper
  doesn't rearrange anything – it plots exactly the x/y columns it's given. The trick is
  computing a `Position` (y) column yourself: sort points by size descending (biggest
  nearest the centre line), then for each point find the y value closest to zero that
  doesn't collide with any already-placed circle at a nearby x. `build_beeswarm.py`'s
  `pack()` function is a complete, deterministic reference implementation of this.
- **Express radii in x-axis units**, not pixels, so the packing geometry is internally
  consistent regardless of final render size.
- **Two settings become load-bearing, not cosmetic, once the layout is precomputed**:
  the y-axis range must be fixed manually to cover the packing's actual extent (on
  "automatic" Datawrapper rescales and the circles overlap), and `plotHeightMode:
  'ratio'` + `plotHeightRatio` must match the aspect ratio the packing assumed (a
  taller/shorter plot than that turns the circles into ellipses and reopens gaps).
  `build_beeswarm.py`'s own CLI output prints both numbers after a run.
- Still subject to the `<`/`>` category-value gotcha above if any category label needs a
  numeric threshold in it – strip it into the notes instead, exactly as
  `build_beeswarm.py`'s `load()` function already does.
- Hiding the y-axis entirely (`y-pos: 'off'`) is normal here – the Position column has
  no meaning of its own, it only exists to keep circles apart.
