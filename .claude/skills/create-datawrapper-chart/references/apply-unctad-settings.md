# Procedure: bring a Datawrapper chart to UNCTAD web settings

**This is now automated** – `node bin/create-datawrapper-chart.js lint <chartId>`
(read-only report) and `apply-settings <chartId> [--dry-run]` (applies the fix) do
exactly what this procedure describes, via `src/datawrapper-lint.js`. Keep reading if
you need to do this by hand (no repo access, or driving the editor directly), or just
want to understand what those two commands check.

**Scope.** This procedure changes *settings only*. It never changes the data, the
title, the description, the source, the notes, the chart type, or the colours. If
those look wrong, report it – don't fix it here (`lint` surfaces content findings
separately, from `validateChartText`, but doesn't fix them either).

**When to use it.** On charts being prepared for publication now: a new chart, a
chart being updated, or one submitted for review. Charts already published are not
being retrofitted, so don't run this across the archive.

## 0. Preconditions

1. You have the chart ID (5 characters, e.g. `ISjSH`), or a URL containing it –
   `https://app.datawrapper.de/chart/<ID>/visualize` or `.../edit/<ID>/...`.
2. You have a Datawrapper API token with `chart:read`/`chart:write` scope (this repo:
   `~/.un-datawrapper/config.json`, see `src/datawrapper-config.js`), or an
   authenticated browser session on `app.datawrapper.de`.
3. The chart is a **web** chart. If it's a figure for a PDF publication, stop –
   different theme (`unctad-print`), and the download/logo settings don't apply.
4. The chart is **not a map**. UNCTAD doesn't publish Datawrapper maps – the
   boundaries don't follow UN cartographic conventions. `isMapChartType()` in
   `src/datawrapper-constants.js` checks this; `lint` reports it directly.

## 1. Read the current state

Public API, bearer token (what this repo's tooling always uses):

```
GET https://api.datawrapper.de/v3/charts/<ID>
Authorization: Bearer <TOKEN>
```

Same-origin app API, from an authenticated browser session instead (needs a CSRF
crumb on every write – see `references/api-gotchas.md`):

```js
await (await fetch('/api/v3/charts/<ID>', {credentials: 'include'})).json()
```

## 2. The target settings

| # | Setting | Path in the chart object | Target value |
|---|---|---|---|
| 1 | Locale | `language` | `"en-CH"` |
| 2 | Theme | `theme` | `"unctad"` |
| 3 | Logo | `metadata.publish.blocks.logo` | `{"id": "arrow", "enabled": true}` |
| 4 | Data download | `metadata.publish.blocks.get-the-data` | `true` |
| 5 | Image download (PNG) | `metadata.publish.blocks.download-image` | `true` |
| 6 | SVG download | `metadata.publish.blocks.download-svg` | `false` |
| 7 | PDF download | `metadata.publish.blocks.download-pdf` | `false` |
| 8 | Embed block | `metadata.publish.blocks.embed` | `false` |
| 9 | Social sharing | `metadata.visualize.sharing.enabled` | `true` |
| 10 | Share target | `metadata.visualize.sharing.auto` | `true` |
| 11 | Vertical axis labels | `metadata.visualize.y-grid-labels` | `"inside"` |

This exact table is `buildBaseMetadata({print: false})` in `src/datawrapper-constants.js`
– the two should never drift apart; if you ever change one, change the other.

- **`theme`** – `"unctad"` is *UNCTAD 2024 – Web and social media*. Don't use
  `"unctad-print"` (*UNCTAD 2024 – Publications*) on a web chart.
- **`sharing.auto: true`** means "share the site the chart is embedded in", which is
  what UNCTAD wants. `auto: false` shares the standalone Datawrapper URL. Leave
  `sharing.url` alone – it's managed automatically when `auto` is `true`.
- **`y-grid-labels`** – valid values are `"auto"`, `"inside"`, `"outside"`.
- A target field **absent** from the chart's own `metadata.visualize` (not just
  differently-valued) means that chart type doesn't support the setting – report it
  as "not applicable", not as a failure. `lintChart()` already implements this rule.

## 3. Apply the change

One PATCH. Datawrapper merges `metadata` deeply, so only the keys you send are
touched and everything else is preserved (except `describe`/`annotate` – see
`references/api-gotchas.md`, not relevant here since this procedure never touches
either).

Public API:

```
PATCH https://api.datawrapper.de/v3/charts/<ID>
Authorization: Bearer <TOKEN>
Content-Type: application/json

{
  "language": "en-CH",
  "theme": "unctad",
  "metadata": {
    "publish": { "blocks": {
      "logo": {"id": "arrow", "enabled": true},
      "get-the-data": true,
      "download-image": true,
      "download-svg": false,
      "download-pdf": false,
      "embed": false
    }},
    "visualize": {
      "sharing": {"enabled": true, "auto": true},
      "y-grid-labels": "inside"
    }
  }
}
```

Same-origin app API: same body to `PATCH /api/v3/charts/<ID>`, with the CSRF crumb
header (see `references/api-gotchas.md`).

**If working through the interface instead**, the same eleven settings are:

- *Layout* tab → Locale, Theme, Logo, "Data download", "Image download" (PNG on, SVG
  and PDF off), "Social sharing" (on, "Share the site the chart is embedded in")
- *Refine* tab → Vertical axis → Labels → **Inside**

## 4. Verify

Re-fetch the chart and confirm all eleven values. Don't rely on the PATCH response
alone. If any value didn't take, report which one and stop – don't retry blindly,
because a rejected value usually means the chart type doesn't support that setting.

## 5. Stop before publishing

**Don't publish or republish the chart.** A PATCH changes the draft; the live version
only changes when the chart is republished, and that's a decision for a person.
Report that the draft is updated and that republishing is needed for the changes to
appear publicly, then wait for an explicit instruction. This repo's tooling never
calls `/publish` at all (see `SKILL.md`'s "Publishing" section) – `applySettingsToChart`
always prints "not published" even on a successful write.

## 6. Report

```
Chart <ID> – <chart title>
Changed:
  language        en-GB  →  en-CH
  y-grid-labels   auto   →  inside
Already correct: theme, logo, get-the-data, download-image, download-svg,
                 download-pdf, embed, sharing.enabled, sharing.auto
Not applicable:  (none)
Not published – republish required for these to go live.
```

Then, separately, flag anything noticed that this procedure doesn't fix: a title that
names a subject instead of stating a finding, a missing unit in the description, a
source line that doesn't follow the UNCTAD templates, more than seven coloured
series, or a Datawrapper map. Report these; don't change them. (`lint` already does
this via `validateChartText` and the palette check.)

## Several charts at once

Only when someone hands you a specific list – a set of charts for one article or one
report, all being prepared now. This isn't a tool for sweeping the archive: existing
published charts are deliberately left as they are. For a given list, run steps 1–4
per chart and produce one table of results. Keep concurrency modest, and stop the
whole run if two consecutive charts fail rather than working through a list against a
broken condition. Step 5 still applies: nothing is republished without a person
asking for it.
