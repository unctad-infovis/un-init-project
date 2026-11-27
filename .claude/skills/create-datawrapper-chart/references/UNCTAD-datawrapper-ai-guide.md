# UNCTAD Datawrapper chart guide — for an AI assistant with no access to this repo

**Snapshot taken 2026-11-26** of the values and rules maintained as code in
`src/datawrapper-constants.js`, `datawrapper-metadata.js`, `datawrapper-validate.js` and
`datawrapper-lint.js` of the `un-init-project` repository. This file is meant to be
emailed or pasted whole into a fresh AI session on a colleague's machine that doesn't
have that repo — it stands on its own with plain `curl`/`fetch` calls against the public
Datawrapper API, no installed tooling required. If you *do* have the repo, use its CLI
instead (`bin/create-datawrapper-chart.js check`/`create`/`to-web`/`lint`/`apply-settings`)
and this repo's own `SKILL.md` — this file is a periodic snapshot of the same values,
not a second place to maintain them, and it will drift from the code over time.

A human always makes the final call on a chart before it's published. Nothing here
removes that step — it exists to make the mechanical 90% of a review (locale, theme,
axis labels, source-line phrasing, palette order) unnecessary to redo by hand.

## Authentication

A personal access token, created at `app.datawrapper.de/account/api-tokens`, scoped to
at least `chart:read`/`chart:write`, sent as:

```
Authorization: Bearer <TOKEN>
```

All calls below are against `https://api.datawrapper.de/v3` (the public, CORS-blocked-
from-browsers API — call it from a script/backend, not a page's own JavaScript). This
path needs **no CSRF token**. If instead you're driving `app.datawrapper.de`'s own
same-origin app API from an authenticated browser session, every `POST`/`PUT`/`PATCH`
needs a CSRF crumb read from the `crumb` cookie and sent as `X-CSRF-Token`, or it 403s
with no useful body — pick one API and stay on it.

## Hard rules, never negotiable

1. **Never publish or republish a chart without being explicitly asked.** A `PATCH`
   changes the draft only; `POST /charts/{id}/publish` makes it live on unctad.org.
   Build drafts, hand back the editor URL (`https://app.datawrapper.de/chart/<ID>/visualize`),
   stop.
2. **Never delete a chart.** No delete path in this workflow.
3. **No Datawrapper maps for public UNCTAD charts** — refuse `d3-maps-*` and
   `locator-map` chart types; the boundaries don't follow UN cartographic conventions.
4. **Don't retrofit the archive.** These rules apply to new/updated charts, not a sweep
   of everything already published.
5. **The API token never appears in a repository, a log, or error output.**
6. **En dash (`–`), never em dash (`—`)**, in every text field — title, description,
   source, notes.
7. Every individual country name uses the **official UNCTAD name** (e.g. `Türkiye`, not
   `Turkey`; `Viet Nam`, not `Vietnam`; `Comoros (the)`, not `Comoros`), except
   `United States` (not the official long form) as the one standing exception. If
   unsure of a name, ask rather than guess — this snapshot doesn't carry the full
   249-economy list (see `data/UN_Country_Names.csv` in the repo for that).
8. **Always ask which folder a chart belongs in before creating it, every time** —
   don't guess a folder id from an earlier chart in the conversation, and don't
   default to "no folder"/the account's root just because the person didn't
   mention one. This should not depend on how the request happens to be phrased;
   treat the destination folder as a required piece of information, the same way
   a missing title or data source would be.
9. **A human still needs to look at the actual chart before it's considered
   done** — every rule above (and every settings check) catches mechanical
   issues, not whether the chart type fits the question or the title states
   the right finding. Always hand back the editor URL and say so explicitly,
   even when everything mechanical checks out. If your environment has a way
   to actually view the live editor (browser automation, a screenshot tool),
   prefer that over trusting the API response alone whenever how something
   renders is genuinely in question — a `GET` can confirm the metadata was
   saved, not that it looks right.

## The 11 settings every UNCTAD web chart needs

| # | Setting | Path | Target |
|---|---|---|---|
| 1 | Locale | `language` | `"en-CH"` |
| 2 | Theme | `theme` | `"unctad"` (*"UNCTAD 2024 – Web and social media"*; use `"unctad-print"` only for a PDF-publication figure, and skip settings 3–8 for those) |
| 3 | Logo | `metadata.publish.blocks.logo` | `{"id": "arrow", "enabled": true}` |
| 4 | Data download | `metadata.publish.blocks.get-the-data` | `true` |
| 5 | Image download | `metadata.publish.blocks.download-image` | `true` |
| 6 | SVG download | `metadata.publish.blocks.download-svg` | `false` |
| 7 | PDF download | `metadata.publish.blocks.download-pdf` | `false` |
| 8 | Embed block | `metadata.publish.blocks.embed` | `false` |
| 9 | Social sharing | `metadata.visualize.sharing.enabled` | `true` |
| 10 | Share target | `metadata.visualize.sharing.auto` | `true` (shares the embedding site, not the standalone Datawrapper URL) |
| 11 | Vertical axis labels | `metadata.visualize['y-grid-labels']` | `"inside"` |

A target field **absent** from a chart's own `metadata.visualize` (not just a
different value) means that chart type doesn't support the setting — report "not
applicable", don't force it or treat it as an error.

Apply with one `PATCH` (merges deeply — only the keys you send are touched):

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
      "get-the-data": true, "download-image": true,
      "download-svg": false, "download-pdf": false, "embed": false
    }},
    "visualize": { "sharing": {"enabled": true, "auto": true}, "y-grid-labels": "inside" }
  }
}
```

**Exception**: `metadata.describe` and `metadata.annotate` do **not** merge like
`visualize` does — a `PATCH` touching only `describe.intro` silently blanks every other
`describe` field (confirmed destructively, twice). Always `GET` the chart first and
spread its full current `describe`/`annotate` object before patching either one.

## Palette

Confirmed live against the `unctad` theme itself (`GET /v3/themes/unctad?extend=true`
→ `data.colors.groups[0].colors[1]`), 2026-11-26 — this repo's tooling deliberately
matches the theme's own order rather than an earlier, different documented order:

**Default sequence for ordinary series, assigned strictly in this order:**

| Slot | Name | Hex |
|---|---|---|
| 1 | UN dark blue | `#004987` |
| 2 | UN blue | `#009EDB` |
| 3 | light blue | `#C5DFEF` |
| 4 | UN yellow | `#FBAF17` |
| 5 | warm grey | `#AEA29A` |
| 6 | purple | `#A05FB4` |
| 7 | green | `#72BF44` |

- **More than 7 coloured series → stop and suggest grouping the tail ("Other") or
  splitting into two charts.** 5–7 is already a lot — four is the recommended target
  for readability.
- A series named `Other`/`Others`/`Rest of world`/`All other …` (case-insensitive)
  always gets warm grey `#AEA29A` and moves last, regardless of CSV order.
- **Red `#ED1847` is never assigned to a series automatically** — highlighting/
  annotation lines only.
- **Pale grey `#DED9D5`** is for muting non-focus series, e.g. "highlight one series in
  UN blue, every other coloured series goes pale grey instead of its own colour".

**A separate, deliberate semantic rule — not part of the generic sequence above** —
applies whenever series are named by **country group**: `Developed` → UN blue
`#009EDB`; `Developing` → UN yellow `#FBAF17`; `SIDS`/`"Small island developing states
(SIDS)"` → UN dark blue `#004987`; `LDC(s)`/`"Least developed countries (LDCs)"` → UN
dark yellow `#B06E2A` (a colour **not** in the theme's own default list — kept purely
for this rule, proven on real published charts). Always this mapping, regardless of
which subset of the four groups a chart shows. Spell the bare abbreviations out in the
legend: `LDC(s)` → `"Least developed countries (LDCs)"`, `SIDS` → `"Small island
developing states (SIDS)"`.

A **year-pair** special case: if a colour map has *exactly two* keys and both are bare
4-digit years, the later year gets UN blue and the earlier gets UN yellow.

A **focus-entity-vs-aggregate** special case (confirmed 2026-11-27, e.g. a single
country vs the region it belongs to): the broader aggregate/baseline gets UN blue, the
specific focus entity gets UN yellow — especially if that entity is already shown
highlighted in yellow elsewhere in the same project. This is the opposite assignment
from a "focal peer-group vs residual" comparison (e.g. "G20 economies" vs "Other
economies", where the focal group gets blue) — the difference is part-vs-whole vs
two-peer-groups; a human should confirm which shape a given chart actually is.
**Never colour a two-category chart with two shades from the same family** (e.g. UN
dark blue + UN blue, no yellow at all) — they read as barely distinguishable even
though the hex values differ; a real two-category chart should always end up one
blue-family colour and one yellow-family colour.

Don't stack more than one highlight mechanism on the same series for the same reason —
e.g. a bar already coloured + bold-labelled to call it out doesn't also need its value
label text coloured to match; that's a third, redundant signal.

In prose (title/description/notes), spell dollar amounts out as "dollars", never "US$"
or "US dollars" — UN convention already assumes a bare dollar figure is in US dollars.
Only name the currency explicitly when genuinely ambiguous (e.g. another currency is
also shown).

`color-category.map` alone isn't enough to show distinct colours — `metadata.visualize['color-by-column']`
must also be set to `true`, or the chart silently stays monochrome.

**Category values must never contain `<` or `>`** — e.g. `"Limited reported trade
(<$100k)"` silently fails to colour-match and the whole category vanishes from the
legend with no error. Strip the bracket, move the detail into a note.

## Text conventions

**Title**: states a finding as a sentence with a verb, not a subject/topic label.
Never starts with `"Figure N"`/`"Fig. N"`/`"Chart N"`/`"Table N"` (print numbering
doesn't travel to the web). No trailing full stop. Under ~90 characters — three lines
on a phone is fine, four is not.

**Description** (`metadata.describe.intro`): what the data is, the breakdown, the
unit, the period — comma-separated, in that order. E.g. `"Vegetable oil production, by
crop, millions of metric tons, 1961–2023"`. No trailing full stop. En dash for year
ranges (`2010–2024`, not `2010-2024`). Spell out an abbreviation on first use:
`"Gross domestic product (GDP) per capita"`. Brackets are for abbreviations only — use
commas for everything else.

**Source** (`metadata.describe['source-name']`): always starts with the full name,
never bare "UNCTAD", never a French form on an English page:

| When | Template |
|---|---|
| UNCTAD's own data | `UN Trade and Development (UNCTAD).` |
| Someone else's, reproduced | `UN Trade and Development (UNCTAD) based on [source].` |
| UNCTAD computed the figures | `UN Trade and Development (UNCTAD) calculations based on [source].` |
| UNCTAD modelled/imputed | `UN Trade and Development (UNCTAD) estimates based on [source].` |

The source line is the **only** field that ends with a full stop, and only when it
reads as an actual "based on ..." sentence (a bare organisation name isn't a sentence
and shouldn't end with one). Fill `metadata.describe['source-url']` only when a real
public landing page exists.

**Percent data goes in as 0–100, not a fraction** — Datawrapper's `0%` number format
appends the `%` sign without multiplying; `0.85` renders as `0`, `85` renders as `85%`.

## Chart form

Bars/columns start at zero (rare, stated exception: a measure with no natural zero —
consider a line chart first). Never two vertical axes — two charts, or index both
series to a common base. Sort by value unless another order carries meaning. Straight
lines only, never smoothed/curved; dashed for estimates. Legend at the top for web
charts. Axis tick labels on automatic — annotate instead of hand-setting them. Pies/
donuts: five categories at most, largest slice first from twelve o'clock clockwise,
"Other" last.

**Conventions confirmed from real published UNCTAD charts, not written down
elsewhere**: `visualize['value-label-visibility']: 'always'` (values shown directly on
bars) and `visualize['sort-by']: 'first'` are the de facto defaults on nearly every
real bar/column chart. A group/peer benchmark value is usually shown as a dashed
`range-annotations` vertical line plus a matching `text-annotations` label, not as an
extra bar. For a column-type chart, place value labels *inside* the column
(`'inside'` placement) rather than floating above it — a label above the column makes
it visually read as taller than its real value. `thick: true` reads better than the
default thin bars on a chart with few-to-moderate bars (confirmed up to roughly a
dozen) and little else filling the plot; stay thin with more rows/series. Separating
lines between bars/groups can help a multi-series chart with many categories, but
aren't a default.

## Workflow

0. Confirm the destination `folderId` with the person first — see hard rule 8
   above. Don't start step 1 without one.
1. `POST /charts` — `{"title", "type", "theme": "unctad", "language": "en-CH",
   "folderId", "organizationId": "unctad"}`. Refuse `type` starting with `d3-maps-` or
   equal to `locator-map` before this call.
2. `PUT /charts/{id}/data` — raw CSV text body (`Content-Type: text/csv`).
3. `PATCH /charts/{id}` — the 11 settings above, plus `metadata.describe`
   (`intro`/`source-name`/`source-url`), `metadata.annotate.notes`, and
   `metadata.visualize['color-category'].map` + `color-by-column: true`.
4. Report the chart id and editor URL, and say plainly that a human still
   needs to review it before it's published. **Stop — don't publish.**

For an undocumented, chart-type-specific metadata shape: build one example by hand in
the editor exactly as wanted, `GET /charts/{id}`, and copy its `metadata` as a
template — faster and more reliable than guessing, and what Datawrapper's own docs
recommend too. `POST /charts/{id}/copy` from an already-styled template chart beats
assembling metadata from scratch for anything beyond the simplest chart types.
