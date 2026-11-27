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

3. **Checking/fixing an existing chart's settings** (`lint`/`apply-settings`
   commands) — read-only compliance report against the 11 standard settings
   plus text conventions, or a settings-only `PATCH` that never touches
   content. The automated form of `references/apply-unctad-settings.md`.

This skill's supporting reference material now lives under `references/`
rather than all being inline here:
- `references/api-gotchas.md` — the consolidated silent-failure gotchas list.
- `references/to-web-conversion-rules.md` — bugs found and fixed in the
  `to-web` conversion pipeline itself (country-group colours, en dashes,
  HTML stripping, line/gridline/label defaults, and more).
- `references/chart-type-playbook.md` — chart types `create`/`to-web` don't
  build metadata for yet (scatter plot, tables, the beeswarm-faking technique).
- `references/good-practices-2026-11-review.md` — conventions confirmed from a
  live review of six real UNCTAD Datawrapper folders.
- `references/apply-unctad-settings.md` — the settings procedure `lint`/
  `apply-settings` automate, with the raw-`fetch()` equivalent for driving it
  by hand.
- `references/UNCTAD-datawrapper-ai-guide.md` — a single, portable,
  dependency-free Markdown file with everything an AI session on a colleague's
  machine (no access to this repo) needs to do this work from raw API calls.
- `references/handbook/` — the human-facing visual PDF guidelines handbook
  (`npm run build-handbook` to regenerate it).

See also [docs/datawrapper-chart.md](../../../docs/datawrapper-chart.md) in
the root README's documentation for the CLI command reference.

## Every run needs these three things, regardless of how the request is phrased

These apply to **every** path through this skill — `check`/`create`,
`to-web`, `lint`/`apply-settings`, or preparing a chart directly — no
matter how the user's request happens to be worded this time. Don't let
the specific phrasing of a prompt be what decides whether these happen;
they're standing requirements, not something to infer from context.

1. **A confirmed destination folder, always.** Ask the user which
   Datawrapper folder the chart belongs in if they haven't said — same as
   the OneDrive destination confirmation in `/upload-documents`. **Never
   silently rely on `create`/`to-web`'s `DEFAULT_FOLDER_ID` fallback
   (`437477`) as a substitute for asking** — that folder is a confirmed,
   legitimate default for draft mockups when there's genuinely no other
   context (see `TODO.md`, confirmed with the user 2026-08-27), not a
   stand-in for the question. State the resolved folder back to the user
   (in the dry-run preview or right after creating the chart), so it's
   visible and correctable before — or immediately after — the chart
   exists, not discovered later.
2. **A final human check before calling any chart done.** `check`/
   `create`/`lint`/`to-web`'s automated findings catch mechanical issues —
   they don't judge whether the chart type fits the question, whether the
   title states the right finding, or whether the data tells the story it
   should. Every run ends with handing back the editor URL
   (`https://app.datawrapper.de/chart/<id>/visualize`) and saying plainly
   that a human still needs to look at it before it's published — even
   when every automated check passed clean. This is the standing
   "a human always makes the final call" rule, not a formality to skip
   when things look obviously fine.
3. **Use the user's own Chrome for a real look, when one is needed.**
   This skill's `allowed-tools` already include the `claude-in-chrome`
   browser tools (see the frontmatter) — reach for them, not just
   `exportChart`'s PNG render, whenever confirming how a chart actually
   looks or behaves needs more than an API response: checking the live
   editor's own Refine-panel state, confirming tooltip/hover text, or any
   visual judgment a static export can't settle. `exportChart` (see
   "Verifying a fix without a browser" below) is the fallback for when a
   browser session genuinely isn't available in-session — not the default
   first choice over actually looking at the real thing in the user's own
   logged-in browser.

## Step 0 — find the source charts and the brief

A request to build web charts for a webpage/report almost always comes
with two things, both needed before touching Datawrapper:
- **The destination folder** — see "Every run needs these three things"
  above; confirm it here, before matching any "Figure N" charts.
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
- **Dollar amounts in prose: spell out "dollars", never "US$" or "US
  dollars"** — confirmed with the user 2026-11-27: there's room in a
  description/subtitle to spell the unit out (`"US$ million"` →
  `"millions of dollars"`), and UN convention already assumes a bare
  dollar figure is in US dollars, so spelling out "US" too is redundant.
  **Only name the currency explicitly ("US dollars") when it's genuinely
  ambiguous** — e.g. the chart also shows another currency, or the figure
  could otherwise be misread as a different one. This is the same
  bracketed-unit-abbreviation principle as the bullet above, just for the
  one unit common enough to call out by name.
- **Never double up on highlighting the same thing** — confirmed
  2026-11-27 on a real chart: a bar already singled out by colour (e.g.
  one country's bar in UN yellow against a field of UN blue, with its
  category label already bold) doesn't also need its *value label* text
  coloured to match (`visualize['value-label-colors']`) — that's a third
  signal pointing at the same bar, which reads as visual noise rather
  than extra information. Pick one dominant highlight mechanism (colour +
  bold label is usually enough) and leave the value labels neutral.
  Applies generally, not just to country-group highlighting.
- **Thick bars for a chart with few-to-moderate bars/rows** — broadened
  2026-11-27 (previously "roughly 2–3" only): confirmed against a real
  10-row single-series bar chart that a bar count up to roughly a dozen
  still reads better thick when there isn't much else filling the plot.
  `visualize.thick: true`; a chart with many more rows/categories, or
  several series per category, should stay thin. Still a judgment call,
  not a hard threshold — check what the chart actually looks like before
  deciding, same as before.
- **Value labels inside the bar/column, not floating above it** — for a
  column-type chart, a label placed *above* the column makes the column
  read as taller than its actual value (the label's own height visually
  extends it). Prefer the inside placement (`visualize.valueLabels.
  placement: 'inside'`, field name varies slightly by chart type) unless
  a specific bar is too short for the label to fit legibly inside it.
- **Separating lines between bars/groups can help readability, but
  aren't a default** — worth considering on a grouped/multi-series bar
  chart with many categories, where a line can help the eye track which
  bars belong to which group; often unnecessary on a single-series chart
  or one with few categories. Judgment call per chart, not a rule to
  apply automatically.
- **Check country names even when nothing else about the chart changed**
  — see "Country names: use the official UNCTAD name" below. Confirmed
  2026-11-27: this is easy to skip when a chart otherwise looks finished
  (colours fixed, text fixed) — it's a separate check, not something the
  other fixes surface on their own, and the user had to ask for it
  directly before it got done.

## Country names: use the official UNCTAD name

Confirmed with the user 2026-10-06, applies to **every** chart-building path
(`create`, `to-web`, and preparing a chart directly) whenever a country name
appears anywhere user-visible — a category/row label, a legend entry, a
title, a description, a note: individual country names (not region/country-
group aggregates like "Africa" or "Developing countries", which are a
separate, already-documented rule) must use the **official UNCTAD name**,
not a common/informal one. **One standing exception**: "United States", not
the official "United States of America" — don't invent further exceptions
on your own judgement; ask the user first if a chart seems to call for one.

- **Source list**: `data/UN_Country_Names.csv` (249 current economies, Code
  + "Official UNCTAD name"), a snapshot of UNCTADstat's own classification –
  <https://unctadstat.unctad.org/EN/Classifications/DimCountries_TargetEconomies_Classification.xls>.
  Load it via `loadOfficialCountryNames()` in
  `src/datawrapper-country-names.js` rather than re-fetching the XLS live
  (the source file drifts over time – this is a snapshot, not guaranteed
  current years from now).
- **Fast path**: `COMMON_INFORMAL_TO_OFFICIAL` in the same module maps the
  handful of informal names actually seen in real charts so far (Turkey →
  Türkiye, Vietnam → Viet Nam, Russia → Russian Federation, South/North
  Korea → Republic of Korea / Dem. People's Rep. of Korea, Laos → Lao
  People's Dem. Rep., Bolivia/Venezuela/Iran/Moldova/Tanzania's long-form
  names, Czech Republic → Czechia, Cape Verde → Cabo Verde, Swaziland →
  Eswatini, Macedonia → North Macedonia, Ivory Coast → Côte d'Ivoire,
  Brunei → Brunei Darussalam, DR Congo → Dem. Rep. of the Congo, Congo-
  Brazzaville → Congo, Syria → Syrian Arab Republic, Micronesia's long
  form) plus the "United States" exception itself. Not exhaustive — fall
  back to `loadOfficialCountryNames()` for anything not listed there.
- **How to apply**: whenever a source chart/CSV/brief names an individual
  country, check it against the list before it goes into the web copy — in
  category/row labels this is a data edit (same mechanism as the LDC/SIDS
  label-opening rule: a direct CSV/`metadata.data.changes` edit, since the
  label comes from the data, not a metadata override), in prose
  (title/description/notes) it's a plain text edit.
- **Partially automated since 2026-11-26**: `check`/`create` (CSV category
  column), `to-web` (a source chart's `color-category.map` keys), and
  `lint` (an existing chart's `color-category.map` keys) all flag a value
  that matches `COMMON_INFORMAL_TO_OFFICIAL`'s fast-path list as a
  non-blocking warning naming the official replacement. **This only
  covers that curated fast-path list, not the full 249-economy
  `data/UN_Country_Names.csv`** — a less common informal name, or one in
  prose (title/description/notes) rather than a category/row value, still
  needs the manual check above; don't treat a clean automated report as
  proof every country name is correct.

## Rules baked into the code (don't re-derive these by hand)

The full list — country-group colours and label-opening, HTML/entity
stripping, en dashes, custom-tick clearing, y-axis label placement,
copy-time metadata quirks, line-style/dash/gridline defaults, year-pair
colours, `color-by-column`, and bar/stacked-chart label defaults — now
lives in `references/to-web-conversion-rules.md`, promoted out of this
file so it doesn't keep growing. `to-web` already applies all of it; read
that file when debugging why a converted chart looks wrong, not to
re-derive these by hand. A couple of the most-consulted ones, verbatim:

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
- **A colour-category map has no visible effect unless `color-by-column`
  is also `true`** — confirmed 2026-09-04: patching `color-category.map`
  alone left the chart's colours completely unchanged, silently. Only
  matters for chart types that actually have this field (`d3-lines` colours
  straight from the map with no such gate) — `to-web` now sets it
  automatically whenever it writes a real colour override, but if you
  ever patch colours by hand outside the pipeline, set this too or nothing
  will change on screen.

See `references/to-web-conversion-rules.md` for the rest: country-group
label opening, HTML/entity stripping, en dashes, custom-tick clearing,
y-axis label placement, copy-time metadata quirks, line-style/dash/
gridline defaults, year-pair colours, and bar/stacked-chart label
defaults.

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
2. Click **Publish now** (or **Republish** if already published) — **often
   needs a 2nd, sometimes a 3rd, click**; confirmed 2026-10-06 across a
   20-chart batch, roughly a third silently failed on the first 2 clicks.
   Don't trust the banner text or the version-history panel alone (both
   can show a stale "published"/"Published version" state for several
   seconds, or never reflect a click that didn't register) — check that
   the `publicUrl` version number in the "Share & Embed" box actually
   incremented before moving to the next chart.
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
   **Caveat found 2026-10-05, checking 20 already-published charts before
   a Drupal-logging batch**: the `lastModifiedAt` vs `publishedAt`
   timestamp heuristic has both false positives and needs a browser
   confirmation either way — most charts showed a 1-second gap (just
   Datawrapper's own internal publish-process noise, not a real edit),
   while one chart showed a genuine 13-minute gap yet the editor's
   Publish & Embed page still read "Your visualization is published."
   with no "needs to be republished" banner at all (not stale). Only one
   of the 20 (a 3-hour gap) was actually stale. **Don't trust the
   timestamp diff alone to decide which charts need republishing** —
   it's a reasonable first filter to prioritize checking, but the
   authoritative signal is the Publish & Embed page's own banner text,
   checked per chart in the browser.
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

## Building chart types `create`/`to-web` don't support yet

`d3-scatter-plot`, `tables`, and a documented beeswarm-faking technique (for when
Datawrapper has no chart type at all for the shape needed) are now in
`references/chart-type-playbook.md`, promoted out of this file so it doesn't keep
growing — read that file before building any of these by hand. `references/api-gotchas.md`
has the consolidated list of silent-failure gotchas (the `<`/`>` category bug, the `0%`
format, `color-by-column`, metadata merge behaviour) referenced from several places in
this file. `references/good-practices-2026-11-review.md` has empirical conventions
confirmed from a live review of six real UNCTAD Datawrapper folders (value-label
visibility, sort order, the benchmark-annotation pattern, and more).

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
