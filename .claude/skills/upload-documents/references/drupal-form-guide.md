# Driving the Drupal "Add content → Official Document" form

The full field-by-field walkthrough for Step 3 of `/upload-documents` —
promoted out of `SKILL.md` so that file doesn't keep growing. Read this
once you've confirmed the Drupal login (`SKILL.md`'s Step 2) and have the
pipeline's manifest in hand.

Content → **Add content** → **Official Document** → Document Type dropdown.
**The real dropdown has four options — Agenda, Publication, Publication
Chapter, Sessional Document** (confirmed 2026-09-02) — not the
Publication/Sessional-Document binary `classification.documentType`
currently produces (`src/doc-classify.js` hasn't been taught the
Agenda/Publication-Chapter distinction yet, see `TODO.md`):
- `classification.documentType === 'Publication'` → select "Publication".
- `classification.documentType === 'Sessional Document'` **and the title
  reads as a provisional agenda** (e.g. "Provisional agenda and
  annotations") → select **"Agenda"**, not "Sessional Document" — this
  also matches the OneDrive folder category convention (see
  `MEM_SERIES_TOPICS`/`guessMemDocCategory` in `src/doc-naming.js`, e.g.
  `67 (Agenda)`). If it's genuinely unclear which of the four options
  fits, ask the user rather than defaulting to "Sessional Document".
- Tick **Restricted Document** if `classification.restricted` is true —
  note this checkbox doesn't appear at all for the "Agenda" Document Type
  on at least one real form seen so far; if it's not there, the document
  simply isn't restricted-flaggable under that type and you don't need to
  set anything.

Then:
- Fill **Title** (English), **Symbol**, **Agenda Item** (sessional only —
  publications ignore this field), **Published Date**. **Before Save,
  search `admin/content?title=<the title>&type=official_document` for a
  same-titled sibling** — a CRP that supplements a main sessional report
  naturally carries the exact same descriptive title as that report, and
  real precedent (confirmed 2026-09-07: `TD/B/WP/287`, no suffix, paired
  with `TD/B/WP(75)/CRP.2`, titled with a trailing `" [Supporting
  materials]"`) is to disambiguate the CRP's Drupal title with that exact
  suffix when this happens. This isn't derivable from the symbol alone —
  check by hand every time a CRP's title looks like it might already exist
  as another node.
- Leave **Embargo** blank unless the user says otherwise.
- **Taxonomy (Thematic/Sitemap/Product)**: ask the user whether this
  document needs taxonomies at all before doing the matching work below —
  see `taxonomy-workflow.md` for the full three-taxonomy process (sourcing,
  mention-count evidence, the per-taxonomy bar, presentation format).
  Applies to every content type, not just Publications — for a Sessional
  Document, still run the process and still ask; don't assume blank by
  default just because that was the old guidance (see that file's own
  note on what's superseded). Always confirm candidates with the user
  before applying any of the three fields — never apply unconfirmed.
  Sitemap Taxonomy, when used, conventionally includes "UNCTAD Home" for
  a Publication so it appears under "Latest Publications" — still subject
  to the same confirm-first rule, not an automatic addition.
- Do **not** change the **Language** field on the node itself — that's the
  website's display language, not the document's language (guideline is
  explicit about this).
- For each language file in `manifest.languages` that has a `stagedPath`,
  in this fixed order — English, French, Spanish, Arabic, Chinese, Russian
  — click **Add file** (after the first), select the language, upload the
  staged PDF (not the original), and only fill the Title field for French
  or Spanish uploads (the English title is already on the node; other
  languages don't get a Title field at all).
- Fill **Associated meetings**: don't guess the meeting title from the
  symbol's session number — **search for the real node first**:
  `<site>/admin/content?title=<keywords>&type=meeting` (e.g.
  `title=commodities+and+development&type=meeting`), find the matching
  row, and open its **Edit** link to read the node id straight out of the
  URL (`/node/<nid>/edit`). Then, in the Associated meetings field, click
  the first autocomplete box and **don't click the suggestion** — clicking
  it has been observed to *append* the canonical `"Label (nid)"` text
  after whatever you'd typed instead of replacing it, leaving a malformed
  value. Instead type the exact canonical string yourself:
  `<Label> (<nid>)`, using the node's real title and the nid you just
  looked up. Verify by re-reading the field before moving on.
  **UAT and production are not kept in sync**: a Meeting that exists on
  `unctad.org` may simply not exist yet on `uat-unctad.org` (confirmed
  case: a just-published 17th-session Meeting existed on production the
  same week it was still missing from UAT). A missing meeting on UAT is
  expected, not a bug — ask the user whether to leave the field blank for
  that run rather than inventing an id or pulling one from production.

  **The field can be entirely absent from the Create form — that's not a
  bug either.** Confirmed 2026-09-03 on production, twice, on independent
  fresh page loads (full page-text dump showed the form jumping straight
  from "Bibliographic type" to "Create publication", no Associated
  meetings section anywhere): file the document anyway, don't block on
  it. After Save, open `node/<id>/edit` — for a Sessional Document whose
  Symbol/committee matches an existing Meeting, the Associated meetings
  section reappears there **already correctly populated**, and the live
  node page shows it too, labelled "Referenced:". This is a computed
  reverse reference resolved from the Meeting side (not a value this form
  actually writes), so it is never fillable on Create for this content
  type — the earlier "search admin/content, type the canonical string"
  procedure above only actually applies on the runs where the field does
  show up on Create. If it's missing, just check the edit page after
  Save rather than treating the gap as something to fix or ask about.

## Companion Publication-type page (important publications)

Some publications also have a separate **Publication** content type node
(not to be confused with the Official Document's "Publication" Document
Type) — a richer landing page/microsite at `unctad.org/publication/<slug>`,
built independently by the dev team, often with heavy custom paragraph
content (dashboards, data-viz sections, timelines). It can **pre-exist**
the Official Document filing by weeks — confirmed case: node `52673`
("Looking Beyond GDP") was created 17/08/2026 by a developer, a full month
before the companion Official Document node `52790` was filed
(14/09/2026). Do not create one yourself; only fill an existing one.

After filing/updating the Official Document node, check whether a
companion Publication node exists:
`admin/content?title=<the title>&type=publication`. If unsure whether this
particular publication is "important" enough to have one, ask the user
rather than assuming — most documents don't get one.

If a companion node is found, open its edit form and fill/verify these
fields (confirmed machine names from node `52673`, 2026-09-15):
- `field_subtitle` — same subtitle text used on the Official Document node.
- `field_symbol` — same symbol.
- `field_cover_image` — the cover JPG the pipeline already generates for
  every Publication at `manifest.coverImagePath`
  (`<parsed.base>_en_cover.jpg`, from `generateCoverImage()` in
  `src/upload-pipeline.js`). That file is produced on every run today but
  nothing currently uploads it anywhere — the Official Document content
  type has no cover-image field at all, so this companion node is the only
  place it belongs. Upload it here.
- `field_documents` (labelled "Downloads", a paragraph-based repeating
  field with per-row weight + entity-autocomplete) — reference the same
  English PDF already uploaded to the Official Document node. Exact click
  interaction not yet confirmed against a real form — screenshot each step
  and verify the resulting reference before trusting it, same caution as
  the Associated-meetings autocomplete elsewhere in this doc.

Also present on this content type but **out of scope for auto-fill**
unless the user asks: Thematic/Sitemap/Product Taxonomy (same three
fields as the Official Document node — confirm whether to mirror the same
choices rather than assuming), `field_alternative_title`,
`field_media_collection`, `field_minisite_link`, `field_featured`, and
others unrelated to this incident.

**Never overwrite a value a human already set** — read the field's current
value first (same rule as everywhere else in this skill) and only fill it
if genuinely empty, or confirm with the user before changing something
already populated.

This step exists because of a real incident (2026-09-15): node `52673`
sat with these four fields empty for a month after being built, until a
colleague (Timothy Sullivan) noticed and filled them in by hand — initially
reported as if something had gone missing/broken, but the actual root
cause (confirmed via both nodes' revision histories) was simply that no
step in this process had ever filled the companion node at all, even
though the source data (and, for the cover image, the generated file
itself) was sitting right there in the Official Document filing the whole
time.
