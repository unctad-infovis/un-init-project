# Good practices and common denominators – live folder review, 2026-11-26

Empirical findings from reviewing every chart in six real UNCTAD Datawrapper folders
(`464125` ASEAN, `464017` COMESA, `464305` Comoros, `462921` Lao PDR, `460832`, `455356`
plastics-trade) via `GET /v3/charts?folderId=<id>` and `GET /v3/charts/{id}` – not
inferred from documentation, read directly off real, currently-published charts. These
are conventions, not settings `lint` enforces – useful for judging whether a new chart
"looks like the others", which none of the 11 settings or text rules capture on their
own.

## Conventions seen on nearly every real bar/column chart

- **`visualize['value-label-visibility']: 'always'`** – data values are shown directly
  on the bars, not left to hover-only tooltips. Seen on every bar-family chart sampled
  except the one abandoned draft (see below).
- **`visualize['sort-by']: 'first'`** – bars sorted by the first/largest series by
  default, unless there's a specific reason for a different order (e.g. one chart used
  `sort-by: 'Developing economies'` to sort by a particular series instead of the
  first).
- **`thick: true`** on charts with few bars/groups (confirmed: a 2-category COMESA
  licensing chart, a 2-series portal-coverage chart), `thick: false` on charts with
  more series or categories – matches the existing "thick bars for 2–3 rows" guidance
  in `SKILL.md`'s "Preparing a chart directly" checklist, now confirmed against real
  production examples rather than just stated as a rule.

## The benchmark-line annotation pattern

Seen on a real Lao PDR productive-capacities chart (`yM0wn`): a group/peer benchmark
value is shown as a dashed vertical reference line plus a matching text label, not as
an extra bar or a note-only mention:

```json
"range-annotations": [{
  "id": "ldcsAsiaLine", "type": "x", "display": "line", "strokeType": "dashed",
  "strokeWidth": 2, "color": "#4C4847",
  "position": { "x0": "37.8", "x1": "37.8", "y0": "0", "y1": "1" }
}],
"text-annotations": [{
  "text": "LDCs: Asia 37.8", "bold": true, "size": 16, "align": "tc",
  "color": "#4C4847", "position": { "x": "37.8014", "y": "100%", "rowOffset": -33 }
}]
```

A vertical line is `x0 === x1`; a horizontal one would be `y0 === y1` with `type: 'y'`.
Worth reaching for whenever a chart's point is "how does X compare to the group
average/peer benchmark" rather than building a second series just to show one number.

## Notes and source conventions actually in use

- Multi-fact notes fields use `<br />` between facts rather than one run-on sentence or
  a bulleted list Datawrapper doesn't render – confirmed on a real COMESA chart's notes
  field (four separate facts, each its own `<br />`-separated line).
- `describe['source-url']` is left blank on most charts and only filled when a genuine
  public landing page exists (confirmed: UNCTADstat's Productive Capacities Index
  dataviewer, filled on three related Lao PDR charts; blank on every chart whose source
  is UNCTAD's own unpublished internal calculation).
- Source lines seen in production are close to, but not always an exact match for, the
  four documented templates – e.g. `"UN Trade and Development (UNCTAD) research 2026,
  based on desk review of legal texts and platforms."` adds context the plain templates
  don't have a slot for. `lint`'s source-line check will flag these as non-matching;
  that's a real content judgement call for the reviewer, not a bug in the checker.

## Cautions from real counter-examples found in the same review

- **Not every chart in a folder is a good one to copy from.** Folder `460832` contains
  exactly one chart (`vX09U`): `language: 'en-US'` (wrong locale), title still reading
  Datawrapper's own placeholder `"[ Insert title here ]"`, `sharing.enabled: false`,
  `y-grid-labels: 'auto'` – an abandoned draft, not a template. `lint vX09U` correctly
  reports all of this as non-compliant (see `src/datawrapper-lint.js`'s test run in the
  commit history for the exact output) – a live, concrete demonstration that `lint`
  catches what it's supposed to, and a reminder to check a chart's own compliance
  before treating it as a reference example.
- **Stale metadata survives harmlessly.** The published Comoros remittances chart
  (`zpDzx`) carries a leftover `"Comores": "#A05FB4"` key in its `color-category.map`
  alongside the correct `"Comoros (the)": "#FBAF17"` – a real, current instance of the
  "PATCH merges deeply, nothing ever tidies a map" gotcha in `references/api-gotchas.md`.
  It does no harm (nothing in the live data uses the old key) and isn't worth a one-off
  fix – published charts aren't retrofitted – but it's a useful concrete example of why
  `lint`'s palette check only flags genuinely unknown colours, not "does this map have
  extra keys".
