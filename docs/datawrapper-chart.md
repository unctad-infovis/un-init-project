# Making a first-draft Datawrapper chart

See the [root README](../README.md) for the rest of this repo.

Every UNCTAD web chart currently gets made by hand in the Datawrapper
editor, then reviewed – and most of what that review fixes is mechanical:
wrong locale/theme, axis labels left on automatic, a differently-phrased
source line, palette order off. `un-create-datawrapper-chart` takes a CSV
and a few flags and creates a **draft** chart via the Datawrapper API with
those settings already correct, so a human only has to judge the two
things that actually need judgment: is this the right chart type, and does
the title state the right finding. It never publishes – that stays a
manual step in the Datawrapper editor.

**Three things apply to every chart built or converted this way, whatever
the specific request was and regardless of this CLI's own defaults:**
a destination folder should always be an explicit, confirmed decision –
don't rely on the `437477` fallback described below as a substitute for
deciding where a chart actually belongs; every chart still needs a human
to look at it before anything is considered finished, automated checks
included; and a real look in the Datawrapper editor (in a logged-in
browser) beats trusting the API response alone whenever how something
actually renders is in question. See the `/create-datawrapper-chart`
skill's "Every run needs these three things" section for the full
version of this.

```
un-create-datawrapper-chart check <data.csv> [--json]
un-create-datawrapper-chart create <data.csv> --type <id> --title <t> --description <d> --source <s>
  [--source-url <url>] [--notes <text>] [--folder <id>] [--highlight <series>] [--other <series>]
  [--print] [--strict] [--dry-run] [--json]
```

`check` reads a CSV and, with no API call and no token needed, reports
column types, data problems (thousands separators, `n/a`/`..`
placeholders, blank rows, duplicate/empty headers, a category value
containing `<`/`>` which silently breaks Datawrapper's colour matching, a
percent-like column whose values look like a 0–1 fraction instead of
0–100, an informal country name in the category column such as "Turkey"
instead of "Türkiye" – see [Country names](#country-names) below), and a
recommended chart type with a one-line reason – this is what to run
first.

`create` validates the CSV and the title/description/source text against
UNCTAD's own conventions (figure numbering, missing verbs, abbreviations
not spelled out first, em dashes, the four source-line templates – see
`src/datawrapper-validate.js`), assigns the UN palette in the fixed order
(with `--highlight`/`--other` support and the "more than 6 series" error /
"5–6 series" warning), then creates the chart, uploads the data, and
patches the metadata with all 11 settings from
`src/datawrapper-constants.js`. `--dry-run` prints the exact payloads
without calling the API at all. Chart types currently supported:
`d3-lines`, `column-chart`, `d3-bars` – anything else, including any map
type, is rejected with a clear message before any network call.

The API token lives outside the repo, at `~/.un-datawrapper/config.json`
(`{"apiToken": "..."}`) – never as an env var, never committed, never
logged. New charts default to UNCTAD's `437477` Datawrapper folder unless
`--folder` overrides it.

## Checking and fixing an existing chart's settings

```
un-create-datawrapper-chart lint <chartId> [--json]
un-create-datawrapper-chart apply-settings <chartId> [--dry-run] [--json]
```

`lint` is read-only: it fetches the chart and reports which of the 11
standard settings already match, which don't, and which don't apply to
that chart type (e.g. a donut chart has no `y-grid-labels`), plus any text
findings (`src/datawrapper-validate.js`), a best-effort palette check, an
informal-country-name check (see below), and whether the chart is a map
(UNCTAD doesn't publish Datawrapper maps). `apply-settings` patches only
those 11 settings – never the data, title, description, source, notes, or
colours – and always reports the chart as not published, since nothing
here ever calls `/publish`. Both are the automated form of
`.claude/skills/create-datawrapper-chart/references/apply-unctad-settings.md`.

Deferred, not built yet: `publish`, `export`, and support for chart types
beyond the three above (which need a real created chart's
`GET /v3/charts/{id}` response to verify the metadata shape against first
– see `TODO.md` and `references/chart-type-playbook.md` for the manual
workaround for `d3-scatter-plot`/`tables`/beeswarm charts in the meantime).
A reference Python script for two other chart types lives at
`tmp/create_datawrapper_charts.py` if extending this further.

## Turning a print chart into a web chart

```
un-create-datawrapper-chart to-web <sourceChartId> [--folder <id>] [--dry-run] [--json]
```

Copies an existing chart (`POST /charts/{id}/copy` – the source is never
edited) and converts the copy to the web theme: text fields cleaned of
print-era inline HTML, hyphens between years turned into en dashes,
country-group series (developed/developing/LDCs/SIDS) recoloured to the UN
palette and their abbreviations opened up, custom ticks cleared, y-axis
labels forced inside. See `.claude/skills/create-datawrapper-chart/
SKILL.md` for the full workflow this is one step of – finding the right
source chart from a content brief, publishing (which needs a browser
session, not this CLI – the API token has no publish scope), and logging
the result as a Drupal "Datawrapper" media item.

## Country names

Individual country names must use the official UNCTAD name (e.g.
`Türkiye`, not `Turkey`; `Viet Nam`, not `Vietnam`) – one standing
exception, `United States` rather than the official long form. `check`/
`create` (CSV category column), `to-web` and `lint` (an existing chart's
`color-category.map` keys) all flag a value against
`COMMON_INFORMAL_TO_OFFICIAL` in `src/datawrapper-country-names.js` as a
non-blocking warning. **This only covers that curated fast-path list of
commonly-seen informal names, not the full 249-economy
`data/UN_Country_Names.csv`**, and never checks prose fields
(title/description/notes) – a clean report doesn't guarantee every
country name is correct. See the skill's "Country names" section for the
full manual-check process.

## Reference material and the human-facing handbook

`.claude/skills/create-datawrapper-chart/references/` holds the supporting
material behind all of the above: `api-gotchas.md` (silent-failure
gotchas), `to-web-conversion-rules.md` (bugs found and fixed in the `to-web`
conversion pipeline itself), `chart-type-playbook.md` (scatter plot, tables,
and the beeswarm-faking technique), `good-practices-2026-11-review.md`
(empirical conventions from a live review of real published charts),
`apply-unctad-settings.md` (the procedure `lint`/`apply-settings`
automate), and `UNCTAD-datawrapper-ai-guide.md` – a single, portable,
dependency-free Markdown file that can be emailed or pasted into a fresh AI
session on a colleague's machine without this repo, with everything needed
to do this work from raw API calls. `npm run build-handbook` regenerates
the human-facing visual PDF guidelines handbook at
`references/handbook/UNCTAD-datawrapper-chart-guidelines.pdf` from
`references/handbook/handbook.html` via headless Chromium (`playwright`).
