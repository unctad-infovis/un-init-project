---
name: create-datawrapper-chart
description: Build UNCTAD-compliant Datawrapper charts – either from a CSV via the CLI, or by copying and converting an existing print/Publications chart to the web theme – then optionally publish them and log them in Drupal as Datawrapper media. Use when the user wants a new chart made from data, wants print charts turned into web charts for a specific Drupal folder/webpage, or asks to publish/embed Datawrapper charts in unctad.org.
user-invocable: true
allowed-tools:
  - Bash
  - Read
  - Write
  - AskUserQuestion
  - mcp__claude-in-chrome__tabs_context_mcp
  - mcp__claude-in-chrome__tabs_create_mcp
  - mcp__claude-in-chrome__tabs_close_mcp
  - mcp__claude-in-chrome__navigate
  - mcp__claude-in-chrome__computer
  - mcp__claude-in-chrome__read_page
  - mcp__claude-in-chrome__get_page_text
  - mcp__claude-in-chrome__find
  - mcp__claude-in-chrome__form_input
---

# /create-datawrapper-chart — build, fix, publish and log UNCTAD Datawrapper charts

The fourth leg of `un-init-project`'s tooling, alongside `un-init-project`
(scaffold), `un-audit-project` (audit) and `/upload-documents` (Drupal
Official Documents). Two entry points, same destination quality bar:

1. **From data** (`bin/create-datawrapper-chart.js check`/`create`) — a CSV
   becomes a draft chart with UNCTAD's theme/locale/palette/text
   conventions already applied. See the README's "Making a first-draft
   Datawrapper chart" section for the CLI's own flags and what `check`/
   `create` do; this skill doesn't repeat that.
2. **From an existing print chart** (`to-web` command, this skill's main
   subject) — a chart made for a PDF publication gets **copied** (never
   edited in place) and converted to the web theme, for embedding on
   unctad.org. This is what a "turn Figure N into a web chart" request
   means.

Both paths share `src/datawrapper-constants.js` / `src/datawrapper-
metadata.js` / `src/create-datawrapper-pipeline.js` — real bugs found and
fixed in one (see "Rules baked into the code" below) apply to both.

## Step 0 — find the source charts and the brief

A request to build web charts for a webpage/report almost always comes
with two things, both needed before touching Datawrapper:
- **The destination folder** (a Datawrapper folder URL/id) — confirm it
  with the user if not given explicitly, the same as OneDrive destination
  confirmation in `/upload-documents`. Never invent one.
- **The source folder** the print charts already live in, and **the
  content brief** (a `.docx`/similar) naming which "Figure N" maps to
  which suggested web chart, with its own title and description text.
  **The brief's wording is authoritative for title/description** — a
  print chart's own headline or intro is only a fallback when the brief
  doesn't give exact text (`to-web`'s auto-extraction exists for exactly
  that fallback case, not to be preferred over the brief).

Read a `.docx` brief with `textutil -convert txt -stdout <file>` (macOS;
no `pandoc`/`python-docx` install expected in this environment). Match
"Figure N" mentions in the doc to chart titles in the source folder via
the API (`GET /v3/charts?folderId=<id>&limit=100`, then match on the
`Figure N` text baked into each chart's `title`) rather than guessing ids
by eye.

**If the brief might be a copyedit round with tracked changes (a filename
like "...light_copyedit_for_web.docx" is a strong signal, and the user may
say so directly), `textutil`'s plain-text conversion is not to be trusted
at face value** — confirmed 2026-09-04: a `.docx` with real Word tracked
changes (insertions *and* deletions) converts through `textutil` without
distinguishing which is which, so the flattened text can silently mix
deleted and inserted wording together in edited sentences. Check first:

```
unzip -q brief.docx -d /tmp/brief-docx && grep -c '<w:ins ' /tmp/brief-docx/word/document.xml && grep -c '<w:del ' /tmp/brief-docx/word/document.xml
```

Any non-zero counts mean real tracked changes are present. In that case,
parse `word/document.xml` directly instead of trusting `textutil`: deleted
text lives in `<w:delText>` elements, kept/inserted text in plain `<w:t>`
elements (standard OOXML) — extracting only `<w:t>` content per paragraph
gives the correct final, post-edit text with deletions cleanly excluded.
A `word/comments.xml` file, if present, is worth a separate read too (a
`<w:comment>`'s text can carry an editorial instruction that the tracked
changes alone don't capture). Cross-check the `textutil` version against
the properly-parsed version before trusting either — in the one real case
seen so far they agreed once whitespace differences were accounted for,
but that's not guaranteed and the XML-based extraction is the one to
trust if they ever disagree.

## Step 1 — copy and convert, never edit the source

```
node bin/create-datawrapper-chart.js to-web <sourceChartId> --folder <id> --dry-run --json
node bin/create-datawrapper-chart.js to-web <sourceChartId> --folder <id> --json
```

`--dry-run` first, always — review `overlayMetadata`, `finalTitle` and
`warnings` before the real copy. **The source chart is never patched** —
`to-web` only ever calls `copyChart` (a fresh `POST /charts/{id}/copy`)
then patches the *new* chart. Verify this after the fact if in doubt: `GET
/v3/charts/<sourceId>` should still show `theme: "unctad-print"` and the
original title, untouched, in its original folder.

What `to-web` now does automatically (confirmed against four real charts,
2026-09-03 — see "Rules baked into the code" for exactly which fields):
web theme + standard publish/sharing blocks; title/intro/notes/source-line
HTML stripped; source-line and description hyphens between years and
mid-sentence dashes turned into en dashes; country-group series recoloured
per the UN palette rule; "LDC(s)"/"SIDS" opened up from bare abbreviations
in whichever field actually drives the legend/axis for that chart type;
custom tick values cleared; y-axis labels forced inside. None of this
needs re-doing by hand anymore — but **always visually check the result in
the editor** (`https://app.datawrapper.de/chart/<id>/visualize#refine`)
before publishing, since new chart-type shapes this hasn't been taught yet
will still slip through silently (see the multiple-columns caveat below).

### Set title/description from the brief, not just the auto-extraction

`to-web`'s own title/intro are a legitimate fallback (stripped HTML,
best-effort), not what should ship when a brief gives exact wording. After
the real `to-web` run, patch the correct text directly:

```js
import { patchMetadata } from './src/datawrapper-api.js';
await patchMetadata({ token, chartId, title: briefTitle, metadata: { describe: { intro: briefDescription } } });
// briefTitle/briefDescription = the exact strings from the content brief, not the pipeline's own finalTitle/finalIntro.
```

**Never call `runConvertToWebPipeline` again against an already-corrected
chart to "re-apply" something** — its `finalTitle`/`finalIntro` are always
freshly recomputed from the *source* chart, so replaying it clobbers any
manual correction already made (this happened for real, 2026-09-03: a
reapply script wiped out four already-fixed titles and un-fixed two en
dashes back to hyphens). If a code fix needs re-applying to an
already-created chart, patch only the specific field that changed — never
pass a blindly-recomputed `title`/`describe` back through `patchMetadata`.

### `metadata.describe`/`metadata.annotate` replace wholesale, not merge — unlike `visualize`

**Confirmed 2026-09-04, a real destructive bug**: `PATCH /v3/charts/{id}` deep-merges nested `visualize` objects (e.g. `visualize.lines`, confirmed elsewhere in this doc), but `describe` and `annotate` do **not** follow the same rule — sending `metadata: { describe: { intro: '...' } }` to change *only* the description silently blanked out that chart's `source-name` (and every other `describe` field not included in the payload) on two real charts. Same for `annotate.notes` on a third chart whose `notes` field wasn't included in a title/intro-only patch. All three were caught by a full post-patch re-fetch and repaired — but the bug is real and will recur if you patch either of these two objects with anything less than every field you want kept.

**When patching `describe` or `annotate` for anything other than a brand-new chart's very first write, always `GET` the chart first and spread its current `describe`/`annotate` object, overriding only the field(s) actually changing** — never build a fresh object with just the field you're touching:

```js
const current = await getChart({ token, chartId });
await patchMetadata({
  token, chartId,
  metadata: {
    describe: { ...current.metadata.describe, intro: newIntro }, // spread first, override second
    annotate: { ...current.metadata.annotate, notes: newNotes },
  },
});
```

Applying several unrelated copyedits (title/description/source/notes) across many charts from a brief document is exactly the situation this bites hardest in — a batch script touching only the 1–2 fields each chart actually needs to change, for many charts in a row, is precisely how this went unnoticed until a full post-patch diff caught it. **Always re-fetch and diff every touched field afterward**, not just the ones you intended to change, when patching these two objects.

### The multiple-columns axis-label caveat (not automated)

For a `d3-lines` chart, "LDC" → "Least developed countries (LDCs)" is a
pure display-label patch (`visualize.lines.<key>.title`) — safe, and
`to-web` does it automatically. For `multiple-columns` (and possibly other
bar-family types), the x-axis bar label comes straight from the
**uploaded data's row values**, not from any metadata override — a
`categoryLabels` patch changes nothing visible. Confirmed 2026-09-03 on a
real chart (`N4qHf`): fixing it required re-uploading the CSV with "SIDS"/
"LDCs" spelled out in the actual category column, *and* renaming the
matching `color-category.map`/`excludeFromKey` keys to the new strings so
the colours keep applying. This is a genuinely different, slightly riskier
kind of edit (data, not presentation) — confirm with the user before doing
it (`AskUserQuestion`, not a silent guess), and always re-check the
editor's chart preview afterward, not just the API response, since this
chart type's rendering doesn't reliably match what the raw metadata
implies.

### Cosmetic text fixes on data-derived labels: `metadata.data.changes`, not a re-upload

A **purely cosmetic** text fix on a label that comes from the data (a
hyphen that should be an en dash in a column header like `"2000-2009"`, a
typo in a row name) does **not** need a CSV re-upload or a `color-category`
rename – confirmed 2026-09-14 on two real charts (`wTlCC`'s period column
headers, four risk-perception panel charts' own header row). This is a
genuinely different case from the `multiple-columns` caveat above (a real
*rename* – "LDC" → "Least developed countries (LDCs)" – which also has to
propagate into `color-category.map`/`excludeFromKey` keys): a cosmetic
punctuation-only fix has no matching-key to break, since nothing else
references the exact old string.

Datawrapper's own per-cell edit-without-touching-the-source-CSV mechanism
lives at `metadata.data.changes`, an array of `{id, row, column, previous,
value, ignored, time}` objects (`row`/`column` are 0-indexed against the
raw CSV including its header row, so `row: 0` edits a column header).
Discovered by finding a real chart in the account with a populated
`changes` array (from the editor's own "Annotate" → data-cell-edit UI) and
reading its shape, then confirmed by patching a test change and diffing an
`exportChart` PNG render before/after – the *exported raw CSV*
(`GET /charts/{id}/data`) stays completely untouched; only the chart's own
rendering reflects the override. Apply via `patchMetadata` on
`metadata.data` – spread the chart's *current* `data` object and append to
its existing `changes` array (same non-merge risk as `describe`/`annotate`,
see below):

```js
const c = await getChart({ token, chartId });
const changes = [{ id: 'anyUniqueString', row: 0, column: 1, previous: '2000-2009', value: '2000–2009', ignored: false, time: Date.now() }];
await patchMetadata({ token, chartId, metadata: { data: { ...c.metadata.data, changes: [...c.metadata.data.changes, ...changes] } } });
```

Always verify with an `exportChart` PNG render (see below), not just the
API response – this is exactly the kind of change that "looks right" in
raw metadata but needs an actual visual check, especially since you may
not have a live browser session available.

### Verifying a fix without a browser: `exportChart` renders

When the Chrome browser tool isn't available in-session, `exportChart`
(`src/datawrapper-api.js`, `format: 'png', zoom: 2`) renders the chart
exactly as published and can be read as an image directly – a real,
reliable substitute for an editor screenshot when checking whether a
metadata patch actually changed what's visible (confirmed 2026-09-14: used
this to rule out a suspected cross-panel number-format bug that turned out
to be a false alarm – Datawrapper's CSV parser silently strips a literal
`%` suffix and renders it identically to a bare number, so two panels
storing `"9.00%"` vs `8.2` in their raw data rendered pixel-identical value
labels, no fix needed – and to confirm the `data.changes` en-dash fix
above actually took effect). Prefer this over trusting the API response
alone whenever the fix touches anything rendering-related (labels, colours,
legend position) rather than a describe/annotate text field's own content.

While already re-uploading data for this reason, check the other column
headers too for the same class of problem — confirmed 2026-09-04 on the
same chart (`N4qHf`): a panel title read "Mean fixed-broadband 5GB
affordability (% GNI p.c.)", which has two separate issues worth fixing
together: a bare `%` symbol inside prose text should read "per cent" (or
"percentage") — the symbol is fine in an axis tick/data value, not inside
a written label — and "GNI p.c." is exactly the kind of unexplained
abbreviation the country-group rule already treats LDC/SIDS as (here
expanded to "Gross National Income (GNI) per capita"). Neither of these
is automated — panel/column-header text is free-form and chart-specific,
unlike the fixed LDC/SIDS/country-group vocabulary — so read every column
header on any chart you're already re-uploading data for, not just the
category column.

### Preparing a chart directly (not via `to-web`) — a checklist the pipeline doesn't cover

When the user hands over an existing chart to "prepare" or "edit directly"
(rather than running it through `to-web`), the automated conversion rules
above never run at all — nothing sets `language`, strips bracketed unit
abbreviations, or picks bar thickness. Confirmed 2026-09-09 on a real
chart (`HipZo`): all three were missed on the first pass and the user
fixed them by hand afterward. Check for all three whenever driving this
workflow manually:
- **Language**: set to `LOCALE` (`'en-CH'`, from `datawrapper-constants.js`)
  explicitly — don't assume it's already right just because the chart
  looks otherwise prepared; it isn't set automatically outside `to-web`'s
  own `patchMetadata` call.
- **No bracketed unit abbreviations in the description/intro prose** —
  generalizes the `%`/"GNI p.c." finding above beyond just axis/panel
  labels: `"Share of ... by volume (kg) and value (USD), 2022"` should
  read `"Share of ... by volume in kilograms and value in dollars, 2022"`.
  This does **not** apply to a genuine citation parenthetical like
  `"UN Trade and Development (UNCTAD)"` or a year `"(2025)"` in the source
  line — only to unit/measure shorthand written as a bracketed aside.
- **Thick bars for a chart with very few bars/rows** (roughly 2–3) —
  `visualize.thick: true` reads better than the default thin bars when
  there's little else on the plot to fill the space; a chart with many
  rows/categories should stay thin. Judgment call, not a hard threshold —
  check what the chart actually looks like with few rows before deciding.

## Rules baked into the code (don't re-derive these by hand)

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

## Publishing (only when explicitly asked)

The CLI/API path **never publishes** — `publishChart()` exists in
`src/datawrapper-api.js` but the shared team API token doesn't have
publish scope (`403 Insufficient scope`, confirmed 2026-09-03), so it
can't be called from a script at all. Same standing default as
`/upload-documents`: don't publish unless the user says so for that
specific chart, this run.

When told to publish, do it through the **authenticated browser session**
(`https://app.datawrapper.de/chart/<id>/publish`), which the logged-in
Datawrapper editor session can do that the API token can't:
1. Navigate to the publish step, screenshot to confirm the preview looks
   right (title, colours, legend text, source line) — this is the same
   visual check as Step 1, just as the last gate before it goes live.
2. Click **Publish now** (or **Republish** if already published).
3. **Any metadata patch made after a chart was already published leaves
   the live version stale** — the publish step will show "Republish", not
   "Publish now", and the "Current version" history panel's top entry
   won't be tagged "Published version" until you click it again. This bit
   real work twice: 2026-09-03, a single title/intro fix applied via API
   after an earlier publish left the live chart serving old text until
   caught and re-published; then again 2026-09-04, at batch scale — 8
   already-published charts got title/description/notes fixes from a
   tracked-changes docx applied via a standalone API script (outside the
   normal create/copy-then-publish flow this section describes), and
   **all 8** sat unpublished for over 45 minutes before the user asked
   "did you already make the changes... all should be already in
   unctad.org", which is what actually surfaced it — not a self-check.
   Caught by comparing every chart's `publishedAt` vs `lastModifiedAt` via
   `GET /v3/charts/<id>` (a stale chart has `lastModifiedAt` after
   `publishedAt`); all 8 were then republished through the browser and the
   timestamps re-verified. **The rule applies to *any* metadata write to
   an already-published chart, not just ones made during this skill's own
   create/copy flow** — a standalone script (like a docx-copyedit
   apply-script) that PATCHes a chart's `describe`/`annotate`/`visualize`
   must end with the same republish step, or explicitly flag to the user
   that republishing is still needed. **Always republish as the very last
   step**, after every other fix, not before — and when in doubt whether a
   batch of already-published charts is current, check timestamps rather
   than assume.
4. Note the exact published URL from the "Link to your visualization"
   field for the Drupal step below — it includes a version number
   (`https://datawrapper.dwcdn.net/<id>/<publicVersion>/`) that changes
   each time you republish; `GET /v3/charts/<id>` also reports this as
   `publicUrl`/`publicVersion` if scripting it.

## Logging in Drupal (unctad.org "Datawrapper" media)

Only after the chart is actually published (the Drupal media form embeds
the live URL, not the draft). Per the user (2026-09-03): **Datawrapper
charts always go into the "Datawrapper" media directory**, never Root or
any other folder.

1. `https://unctad.org/media/add/datawrapper` (expect the same Cloudflare
   "Just a moment…" interstitial as other unctad.org pages — wait a few
   seconds, it clears on its own, same as documented in `/upload-
   documents`).
2. **Datawrapper URL** field: paste the exact `publicUrl` from the publish
   step (`https://datawrapper.dwcdn.net/<id>/<version>/`) — the form's own
   placeholder example shows the required shape.
3. **Directory**: select "Datawrapper" (its taxonomy term id was `1696` on
   2026-09-03 — confirm via the dropdown's own options rather than
   hardcoding the id, since term ids aren't guaranteed stable across
   environments/time; `form_input` with the visible label text can fail
   with a "not found" error if the option has a leading dash glyph in its
   rendered label, as this one does — pass the numeric `value` instead).
4. **Published** checkbox is on by default — leave it as the user's own
   "publish the charts" instruction already covers this; unlike a Drupal
   node, a media entity isn't given a separate never-publish default in
   this workflow.
5. Save, then verify via `https://unctad.org/admin/content/media` filtered
   by Directory = Datawrapper (use the filter form's own dropdown + submit
   button — the `?type=datawrapper` URL query shortcut doesn't work,
   confirmed 2026-09-03, it silently returns "No media available"; also
   watch for a stray browser-autofill value landing in the "Media name"
   filter field, which will do the same) — confirm each item shows
   "Published" and the right title, not just that Save redirected without
   an error.

## Known transient conditions (not tool bugs)

- **Chrome extension can drop mid-session** — a `tabs_context_mcp`/
  `navigate` call returns "Browser extension is not connected". Nothing to
  fix on this side; tell the user, then retry `tabs_context_mcp` once
  they've confirmed the extension/Chrome is back.
- **Cloudflare "Just a moment…" interstitial** on unctad.org pages
  (`media/add/datawrapper` included) — a plain JS challenge, clears on its
  own in a few seconds for a real browser session; wait and re-check
  rather than treating it as a login/permission problem.
- **Datawrapper's `PATCH /v3/charts/{id}` deep-merges nested metadata
  objects** (confirmed by observation, not documented) — patching
  `visualize.lines` with only 2 of 4 keys does *not* wipe the other 2, so
  a targeted single-field fix after the fact is safe without re-sending
  the whole object back. Still prefer sending back a fully-formed object
  when in doubt (as `to-web`'s overlay logic does) rather than relying on
  this for anything load-bearing.

## Building a `d3-scatter-plot` chart (no CLI support yet)

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
  `multiple-columns` bar-chart caveat above, but here it's the norm, not
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
  column actually represents.
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

## Building a `tables` chart (no CLI support yet)

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

## Open, not automated

- The `multiple-columns` (and untested other bar-family) axis-label
  data-rename case above — deliberately not automated; always ask.
- `to-web`'s bar-specific per-series styling gap noted in `TODO.md` still
  applies (only `d3-lines` gets a styling overlay beyond colour/labels) —
  visually check bar charts' width/padding/value-label settings too, not
  just colour and text.
- Publish itself still requires a human-authenticated browser session,
  not just this skill running unattended — see TODO.md if that's ever
  worth revisiting (e.g. a scoped publish-capable token).
