# `to-web` conversion rules baked into the code

Real bugs found and fixed in the `to-web` print→web conversion pipeline
itself (not generic Datawrapper API behaviour — see `api-gotchas.md` for
that). Promoted out of `SKILL.md` so that file doesn't keep growing; these
don't need re-deriving by hand, `to-web` already applies them.

All in `src/datawrapper-constants.js` unless noted, confirmed against real
UNCTAD charts 2026-09-03:

- **Country-group colours** (`classifyCountryGroup`/`resolveCountryGroupColors`):
  a fixed two-family pairing, confirmed 2026-09-04 (an earlier version of
  this rule tried to avoid colour clashes conditionally — replaced
  entirely once the real fixed mapping was confirmed, since there's no
  clash left to avoid): developed → UN blue (`#009EDB`); developing → UN
  yellow (`#FBAF17`); SIDS → UN dark blue (`#004987`); LDCs → UN dark
  yellow (`#B06E2A`). Always this mapping, regardless of which subset of
  the four groups a given chart actually shows — developed/SIDS share the
  blue family, developing/LDCs share the yellow family. Matching also
  recognises the already-opened-up label form (e.g. "Least developed
  countries (LDCs)"), not just the bare abbreviation, since a chart whose
  data values were renamed per the label-opening rule below no longer has
  the bare form as its series key.
- **Country-group label opening** (`COUNTRY_GROUP_LABELS`/
  `buildCountryGroupLabelOverrides`, `src/datawrapper-metadata.js`):
  "LDC"/"LDCs" → "Least developed countries (LDCs)"; "SIDS" → "Small
  island developing states (SIDS)". "Developed"/"Developing" are already
  full words and are left alone.
- **HTML stripping**: applies to title, intro/description, source line,
  *and* notes — the last one only got added 2026-09-03 after finding a
  real chart whose notes still had print-era `<span style="font-size:
  14px;">...<span>` markup (note: the closing tag is often malformed too,
  `stripHtml`'s regex handles that fine since it strips any `<...>`, not
  just well-formed pairs).
- **En dashes**: a hyphen between two years (`2010-2024`) or a
  space-hyphen-space acting as a clause separator (`"ITU - Aggregation"`)
  both become en dashes, in both the source line and the description.
- **Custom ticks**: `custom-ticks`/`custom-ticks-x`/`custom-ticks-y`
  always cleared on conversion, whether or not the source had any set.
- **Y-axis label placement**: forced to `inside` (`visualize.yAxisLabels.
  placement`) whenever the chart type has that field at all — this is
  separate from the already-existing `y-grid-labels: inside` rule and was
  missing before 2026-09-03 (found via a real chart whose value went
  `outside`).
- **Copy-time metadata can be richer than the source's stored metadata** —
  Datawrapper's own `/copy` endpoint can regenerate a `color-category.map`
  with more keys than the source chart's `GET` response shows (confirmed:
  a copied `multiple-columns` chart had a bare `"Developed"` key its print
  source didn't have alongside `"Developed economies"`). `to-web` re-fetches
  the *new copy's own* map after `copyChart` and resolves colours against
  that, not the source's map, specifically to avoid silently dropping keys
  the copy picked up on its own.
- **A d3-lines line's own custom title needs stripping too, not just the
  country-group ones** — `buildLineStyles` never set a `title` at all
  before 2026-09-03, so a converted chart's non-country-group lines (e.g.
  "Developed"/"Developing") kept their print-era HTML forever until this
  was added.
- **`buildLineStyles`'s series list must include `visualize.lines`' own
  keys, not just `color-category.map`** — confirmed 2026-09-14 on a real
  single-series chart (`QeVNv`/`M1cHm`, "Real income per capita"): a
  genuinely single-series d3-lines chart has no reason to ever have a
  populated `color-category.map` (nothing to assign distinct colours
  between), so `existingSeriesNames` came back empty and the whole
  line-width/legend/dash overlay silently never ran, leaving the print
  chart's own thin dashed line untouched on the "converted" web copy.
  Same root shape as the computed-columns gap below – three different
  places a real series name can live (`color-category.map` keys,
  `describe['computed-columns']` names, `visualize.lines`' own keys), and
  a correct conversion needs the union of all three, not any single one.
- **`buildLineStyles` must explicitly clear `dash`, not just leave it
  unset** — found alongside the fix above: web line charts are always
  solid (colour is the only thing that should distinguish series), but a
  print chart's own dash pattern (e.g. `dash: 'style1'`) silently carried
  over untouched since this function never touched the field at all.
  Confirmed by testing that `dash: null` (not omitting the key, and not
  `false`/`'none'`) is what actually clears an existing dash via `PATCH
  /v3/charts/{id}` – omitting the key leaves whatever the source had,
  since `visualize` deep-merges. Retroactively fixed on `FiT2J` (5 of its
  8 lines were still dashed from before this fix existed).
- **A computed column (`describe['computed-columns']`, e.g. a formula
  series like "All cross-regional" derived from other columns at render
  time) is a real line but was never a key in `color-category.map`
  either** — confirmed 2026-09-14 on a real chart (`FiT2J`): one such line
  was silently skipped by the same `existingSeriesNames` logic, leaving it
  without `colorKey`/`directLabel` set at all so it fell back to
  Datawrapper's own default (next-to-line label) instead of the shared
  legend every other line got. Always include computed-column names
  alongside the map's own keys and `visualize.lines`' own keys (see above).
- **`categoryLabels.enabled` must be forced explicitly, not merely spread
  from the source** — confirmed 2026-09-14 on the same chart (`FiT2J`): a
  bar-chart-family source chart's own `categoryLabels` object had already
  picked up `enabled: true` at some point in its own history, so spreading
  it looked like the "stacked-chart series labels default to a colour-key
  legend" rule below worked correctly – but a d3-lines source with no
  `categoryLabels` object at all (the common case) spread to `{}` and left
  the legend never actually switched on, even though `show-color-key`/
  `stack-color-legend` were both set "correctly". Fixed by setting
  `enabled: true` explicitly in the overlay rather than trusting the
  source to already have it.
- **Default gridlines** — confirmed 2026-09-14, same chart: a genuinely
  print-only d3-lines chart (never run through `create`) can carry forward
  both axes' gridlines switched off, unnoticed. `to-web` now sets `y-grid:
  'on'` whenever the chart type has that field at all (matching the one
  working precedent found – a converted bar chart whose print source
  already had `y-grid: 'on', x-grid: 'off'`) – `x-grid` is deliberately
  left alone.
- **HTML entity decoding, not just tag stripping** — `stripHtml` only
  stripped `<tag>` patterns until 2026-09-04, when a real chart's title
  came through with a literal trailing `&nbsp;` (not a tag, so untouched).
  Now also decodes the handful of entities actually seen in print-chart
  text (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`) — deliberately
  not a general entity decoder, since anything more exotic is worth seeing
  raw rather than silently guessing at.
- **Year-pair colours** (`resolveYearPairColors`): a second, narrower
  colour rule alongside the country-group one — confirmed 2026-09-04 on a
  real two-year comparison chart: when a chart's colour-category map is
  *exactly* two bare four-digit years (e.g. "2024"/"2025"), the more
  recent one is UN blue and the earlier one is UN yellow. Scoped tight on
  purpose so it can never misfire on an unrelated two-series chart. The
  country-group and year-pair rules are mutually exclusive by construction
  (year-pair only runs when the country-group rule found nothing to
  change) — a chart genuinely needs at most one of them.
  **A "most relevant vs comparison" pairing that isn't a plain year pair
  (e.g. a focal group like "G20 economies" vs a residual "Other
  economies") is deliberately not auto-detected** — which side is "most
  relevant" is a judgment call about that specific chart's content, not
  something safely inferable from series names alone. Ask the user, then
  apply UN blue to the relevant side and UN yellow to the comparison side
  by hand (same mechanism as the country-group rule: `color-category.map`,
  see the `color-by-column` gotcha right below).
- **A colour-category map has no visible effect unless `color-by-column`
  is also `true`** — confirmed 2026-09-04: patching `color-category.map`
  alone left the chart's colours completely unchanged, silently. Only
  matters for chart types that actually have this field (`d3-lines` colours
  straight from the map with no such gate) — `to-web` now sets it
  automatically whenever it writes a real colour override, but if you
  ever patch colours by hand outside the pipeline, set this too or nothing
  will change on screen.
- **Bar-chart-family defaults** — confirmed 2026-09-04 on a real grouped-
  bar chart, each only applied when the source chart type actually has the
  field (so a no-op on `d3-lines` etc.): never auto-sort bars by value
  (`sort-bars: false`) — row order is meaningful, not something to
  reshuffle; value labels sit to the right of their bar
  (`value-label-alignment`/`label-alignment: 'right'`).
  **Caveat found 2026-09-09 on `HipZo`** (a 100%-stacked horizontal bar
  with row *categories* on the y-axis, e.g. "Trade share in volume"/
  "Trade share in value" as the rows, not a category axis of individual
  bars): `label-alignment` there controls the row-category labels'
  left/right position, not the value labels shown inside each stacked
  segment — confirmed by toggling the Refine panel's "Alignment" control
  live and watching what actually moved. Field presence alone
  (`!== undefined`) isn't enough to trust this rule blindly on every bar
  chart shape — check what the field visibly does on that specific chart
  before applying `'right'`, and leave it alone if it's clearly the wrong
  thing (a row/category label, not a value label).
- **Stacked-chart series labels default to a colour-key legend, never
  "direct" connector-line labels** — confirmed 2026-09-04 on a real
  stacked-column chart whose series names ("G20 economies"/"Other
  economies") were shown as text floating next to each segment with a
  leader line instead of a shared legend. The controlling field is
  `visualize.categoryLabels.position` (`'direct'` → `'color-key'`) alone,
  plus `show-color-key: true` alongside it — gated on `stack-color-legend`
  existing on the source at all, since that field only exists on chart
  types with this direct-vs-legend choice in the first place (this is
  *not* the same field as the `d3-bars-grouped` "Alignment: Left/Right"
  control, which is a plain `label-alignment` with no direct/legend
  distinction — don't conflate the two when a future chart type's Refine
  panel looks similar but the underlying field names differ).
- **`stack-color-legend` itself ("Stack labels" in the Refine panel) is a
  separate, cosmetic toggle — not the direct-vs-legend switch above, and
  should be left `false` in most cases** — corrected 2026-09-08, found
  live-testing a real chart (`KRN0n`): an earlier version of this doc
  (and the pipeline) wrongly assumed `stack-color-legend: true` was
  needed *together with* `categoryLabels.position` to get a legend at
  all. Toggling "Stack labels" alone (with `categoryLabels.position`
  held at `'color-key'` throughout) only changed whether the resulting
  colour-key legend renders as a stacked one-per-line list or a
  flowing/wrapped inline list — confirmed by diffing the chart's full
  metadata before/after the click, isolating `stack-color-legend` as the
  only field that changed. Per the user: "the stack labels should NOT be
  enabled in most cases" — `to-web` now sets it `false`, the opposite of
  the old (wrong) default.
