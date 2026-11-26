# Datawrapper API gotchas

Things that cost real time to find, confirmed against either the real Datawrapper
API/editor or a real UNCTAD chart. Read this before writing anything new against
`src/datawrapper-api.js` or chasing a chart that "looks right in the metadata but wrong
in the preview". Merges what an earlier Cowork session's handover documented with what
this repo's own dev history (`TODO.md`) and this session's live review of six real
Datawrapper folders turned up.

## Fails silently – the dangerous kind

**A category value containing `<` or `>` breaks colour matching, with no error
anywhere.** `metadata.visualize['color-category'].map` can't match a key like
`"Limited reported trade (<$100k)"` – the category vanishes from the legend and every
row in it falls back to the default series colour. A real chart lost correct colouring
for 39 rows this way before it was caught by eye. Now enforced in code:
`detectAngleBracketCategories()` in `src/csv-inspect.js` blocks `create` on this, and
`runConvertToWebPipeline` (`to-web`) raises it as an **error**-severity finding (not a
warning) when a source print chart's own category labels already have the problem.

**`0%` number format doesn't multiply by 100.** Feed it `0.85` and the axis reads `0`
(rounded to the format's precision); feed it `85` and it reads `85%`. Percentage data
goes in as 0–100, the opposite of d3/Excel/most charting libraries, which is exactly
why it's easy to get backwards. `detectDataProblems()` now warns when a percent-looking
column's values all sit inside roughly [-1.5, 1.5] – a likely sign it's still a
fraction.

**`color-by-column` must be set explicitly.** Pointing `metadata.axes.color` at a
column, or populating `color-category.map`, isn't enough on its own – the chart keeps
rendering every point in the base colour until `metadata.visualize['color-by-column']`
is also `true`. Already handled: `runConvertToWebPipeline` sets it whenever it touches
a chart's colour map and the field exists on that chart type.

## Fails loudly, but opaquely

**The same-origin app API (`app.datawrapper.de/api/v3/*`) needs a CSRF crumb** on every
`POST`/`PUT`/`PATCH`, read from the `crumb` cookie and sent back as `X-CSRF-Token`, or
every write 403s with no useful body. **This doesn't apply to this repo's code** –
`src/datawrapper-api.js` only ever calls the public, CORS-blocked-from-browsers host
(`api.datawrapper.de`) with a bearer token, which needs no crumb. It matters if you
(or a colleague) ever drive the editor's own same-origin API directly from a browser
console instead – see `references/UNCTAD-datawrapper-ai-guide.md` for exactly that case.

## Easy to get subtly wrong

**`PATCH` deep-merges `metadata.visualize`, but `describe`/`annotate` replace
wholesale.** Confirmed destructively twice (2026-09-04): sending `metadata: { describe:
{ intro: '...' } }` to change only the description silently blanked `source-name` (and
every other `describe` field not included). Same for `annotate.notes`. Always `GET` the
chart first and spread its current `describe`/`annotate` object before patching either
one – see `SKILL.md`'s "Step 1" section for the exact pattern this codebase now always
follows.

**Stale entries accumulate in `color-category.map` and nothing tidies them.** Because
`PATCH` merges deeply, you can't clear a map by omitting a key. Confirmed still live
this session: `zpDzx` (the published Comoros remittances chart) carries a leftover
`"Comores": "#A05FB4"` entry alongside the correct `"Comoros (the)": "#FBAF17"` key –
harmless (nothing in the current data uses the old key), but a real, present example of
exactly this. Don't expect a `PATCH` to clean anything up on its own; if a stale key
ever becomes actively wrong (collides with a real category), it needs an explicit
overwrite of the whole map, not a partial one.

## Finding an undocumented metadata shape

The metadata object is chart-type specific and undocumented. Don't guess it: build one
chart manually in the editor exactly as wanted, `GET /v3/charts/{id}`, and read what it
produced. For UNCTAD work specifically, the team already has charts of most types –
`GET /v3/charts?folderId=<id>&limit=100` across the team's folders usually turns up a
real example in seconds. For anything beyond the simplest types,
`POST /v3/charts/{id}/copy` from a pre-styled template chart beats assembling metadata
from scratch – Datawrapper's own docs recommend the same thing, and it's what `to-web`
already does.

## The theme's own default colours don't match the documented palette

Confirmed live, 2026-11-26, via `GET /v3/themes/unctad?extend=true` →
`data.colors.groups[0].colors[1]`: the `unctad` theme's own default categorical colour
list is `#004987, #009EDB, #C5DFEF, #FBAF17, #AEA29A, #A05FB4, #72BF44` – a different
order, and missing `#B06E2A` (UN dark yellow) and `#DED9D5` (pale grey), from what this
repo documented before that date. **Per an explicit user decision, this repo's tooling
now matches the theme's own live order rather than asking for the theme to be edited**
(see `src/datawrapper-constants.js`'s 2026-11-26 header note) – so picking colours by
hand in the editor and using this repo's `create`/`to-web` commands now agree. The one
exception: `UN_DARK_YELLOW` (`#B06E2A`) is kept as a named constant purely for the
LDC country-group colour rule (`resolveCountryGroupColors`), a deliberate semantic
choice already proven on real published charts (e.g. `4pcRS`), not a default-sequence
pick – it isn't in the theme's categorical list and was never meant to be.
