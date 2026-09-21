---
name: upload-documents
description: Take a forwarded gDoc2.0 "Document Request" email + its attachment(s), rename and edit the PDFs per CER convention, file them under OneDrive, and log the document in Drupal (unctad.org "Official Document" content). Use when the user drops in a document-request email and attachment(s) and asks to log/upload/file the document, or explicitly invokes /upload-documents.
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
  - mcp__claude-in-chrome__file_upload
---

# /upload-documents — log an official document to Drupal

This is the third leg of `un-init-project`'s tooling, alongside
`un-init-project` (scaffold) and `un-audit-project` (audit). It automates
the job Angela does by hand per the three CER guideline PDFs in `tmp/`
(`cer-how-to-prepare-and-log-sessional-documents.pdf`,
`cer-how-to-deal-with-restricted-documents.pdf`,
`cer-how-to-prepare-and-log-publications.pdf`): receive a gDoc2.0 email,
rename + edit the PDF(s), file them under the team OneDrive, and log the
document in Drupal.

**Default target is `uat-unctad.org`, not production**, until the user says
otherwise. Never touch `unctad.org` itself unless explicitly told to.

## What this does, given an email

- Reads the email — either a real `.eml` (pulling both the body and its
  zip/PDF attachment straight out) or a plain forwarded-text email with a
  separate attachment.
- Requires a real attachment to do anything — per explicit user direction,
  gDoc2.0's own "issued"/"registered" wording isn't a reliable signal (this
  tool only ever gets run when there's already real content to push), so
  the only actionability gate is "is there an actual file". `email.status`
  is still recorded in the manifest for context, just not enforced.
- Requires a UN symbol. If the email itself doesn't state one — confirmed
  2026-09-07 as a real, recurring case: a direct forward from
  Docsubmission/DMS staff, not a gDoc2.0-template "Issued" notification,
  has a free-text subject/body `parseGdocEmail()` can't parse a symbol out
  of — the tool falls back to reading it straight off the attached PDF's
  own cover page (`extractSymbolFromPdfText()`) before giving up. Only a
  document with no symbol in *either* place isn't this tool's job — per
  the user, divisions upload non-symbol documents themselves; push those
  back to the originating division rather than logging them here. The
  manifest's `resolvedSymbol` field is what the pipeline actually used
  (email's own symbol, or the PDF-recovered one) — `manifest.email.symbol`
  stays a faithful record of what the email literally said and may be
  `null` even when `resolvedSymbol` isn't; read `resolvedSymbol`, not
  `email.symbol`, when copy-pasting or displaying the symbol. A
  PDF-recovered symbol also gets its own `symbol-from-pdf` note entry.
- Reads any human note added on top of the auto-generated gDoc2.0 text
  (e.g. "please post this on Delegates Portal") and surfaces it
  separately, since it can carry an instruction beyond just logging the
  document — sometimes including an explicit Restricted instruction, not
  just something inferable from the PDF itself.
- **Always read the email's own subject line too, not just
  `email.note`.** Confirmed twice now that the actual Restricted
  instruction can live in the subject rather than the forwarder's typed
  note: `TD/B/WP(91)/CRP.1`'s subject read "...post on web as restricted",
  and `TD/B/73/L.3`'s read "ONLY FOR PUBLISHING on The Delegates Portal" —
  the second one was missed on first filing (2026-09-15) because its PDF
  cover only said "Distr.: Limited" (not "Distr.: Restricted"), and
  `email.note` only captured the forwarder's generic "Another one for
  you" — nothing in `classification.restricted` or the note field flagged
  it, so **Restricted Document went unticked until the user caught it and
  fixed it manually after the node was already saved.**
  **The two wordings seen so far** (per the user, 2026-09-15) — the word
  "restricted" itself, or a mention of the **Delegates Portal** (the
  Portal is delegate-only access by definition) — **but treat this as
  "read the actual email text for intent," not a fixed keyword list**:
  the user explicitly said other phrasings are possible. Read the whole
  subject and note for anything implying delegate-only/restricted
  circulation, tick **Restricted Document** if so, and ask the user if a
  phrase's intent genuinely isn't clear — regardless of what the PDF's
  own "Distr.:" line says or what `classification.restricted` computed
  (that field is symbol/PDF-text-only and won't catch an email-only
  instruction like this). Treat reading the subject/note for this as a
  checklist item on every run, not something to rely on the PDF text to
  surface on its own.
- Classifies the document: Publication vs. Sessional Document vs.
  Restricted vs. Conference Room Paper — from the symbol shape and
  signals in the PDF itself (e.g. "Advance copy", "Distr.: Restricted").
- If a document was only Restricted because it was an English-only
  advance copy, and all 6 languages are now attached, automatically
  clears Restricted — that justification no longer applies once
  translations exist.
- Computes the correct filename and OneDrive folder for the symbol,
  matching the real, current naming convention (verified against actual
  files already on OneDrive, not just the written guideline) — **not yet
  verified against a real end-to-end OneDrive write**, see TODO.md.
- Edits each PDF's metadata (Title, Author, Subject, Keywords, Language,
  print presets, Initial View) automatically for English, French and
  Spanish — the only languages the guideline requires copy-paste title
  text for. This happens **before** anything is copied to OneDrive, never
  after.
- For publications only: generates a 1000×1414 cover JPG. Skipped for
  sessional documents (guideline is explicit and unconditional about this
  one).
- Surfaces Thematic Taxonomy candidates for publications
  (`manifest.taxonomySuggestions`) as a starting point — but see "Taxonomy
  workflow" below for the current, full three-taxonomy process (all
  content types, mention-count evidence, per-taxonomy bar); that section
  supersedes treating this as publications-only or as a bare
  presence/absence candidate list. Never auto-applied either way.
- **Always ignores any `.docx` a zip/`.eml` carries alongside the `.pdf`,
  regardless of the email's source** — Angela originally confirmed
  (2026-08-26) gDoc2.0 always sends both with identical content, only the
  PDF matters; the user reconfirmed this as a standing rule (2026-09-07)
  after it applied cleanly to a non-gDoc2.0 direct DMS forward too
  (`TD/B/WP(91)/CRP.1`, which arrived as a direct `.docx`+`.pdf` pair, not
  a zip). Never stage, edit metadata on, or file a `.docx` to OneDrive or
  Drupal — only the PDF ever gets logged, no matter how the email arrived.
  `collectAttachments()` in `src/upload-pipeline.js` already only looks at
  `.pdf` files, so this happens automatically; don't add `.docx` handling
  to work around a missing PDF — if there's no PDF, that's a real problem
  to flag, not a reason to fall back to the Word file.
- Copies the metadata-edited files to the team's OneDrive **last**, once
  everything else has succeeded, and never overwrites a file already
  there.
- Produces a manifest with copy-paste-ready EN/FR/ES titles, the symbol,
  and the agenda item, plus warnings for anything low-confidence or that
  needs a human decision.

See `TODO.md` in the repo root for what's still unverified against real
documents.

## Inputs

The user will paste or drop in either:
1. A real Outlook `.eml` export — pass it alone, no attachment path needed.
   `src/eml.js` pulls the email body **and** its zip/PDF attachment straight
   out of the MIME structure. It also surfaces a forwarder's own note
   separately from the auto-generated gDoc2.0 template text (e.g. "Could
   you please post it on web and remove the advance from DP?") as
   `email.note` in the manifest — **read this**, it can carry an
   instruction (like "remove the advance copy from the Delegates Portal")
   that changes what you need to do beyond just logging the new document.
2. Or a plain forwarded-text email (paste as text, or a `.txt` file) plus
   the attachment(s) separately: a single PDF, a directory of PDFs, or the
   "final documents" zip gDoc2.0 sends (files named
   `<requestNumber><LetterCode>.pdf`, e.g. `2609890E.pdf` for English).

If the email text is pasted inline rather than given as a file, write it to
a scratch file first (use the session's scratchpad directory) before running
the CLI below.

## Step 1 — run the deterministic pipeline

```
node <repo>/bin/upload-documents.js <email-file>.eml --out <scratch-dir>
# or, for a plain-text email with a separate attachment:
node <repo>/bin/upload-documents.js <email-file> <attachment-path> --out <scratch-dir>
```

(Or `un-upload-documents ...` if the user has `npm install -g`'d this repo,
per the root README.) Omit `--root` to use the real OneDrive location
(`~/Library/CloudStorage/OneDrive-UnitedNations/General - CER/Web/WEB
UNIT/!MASTER_DOCS_and_PUB`) — this is a real, shared, already-populated
drive; `src/onedrive-filing.js` refuses to silently overwrite an existing
file, but still treat it with care. **Always run `--dry-run` first** and
show the user the resolved `destinationFolder` from the manifest — get
their explicit confirmation that it's the right folder before ever running
the real (non-`--dry-run`) copy. A wrong folder guess isn't just noise on
this drive: it puts a real file where other people (Angela's team) expect
to find something else.

**Never delete anything from OneDrive.** `fileDocuments()` only ever
copies (refusing to overwrite unless told to) — don't add or invoke any
delete/cleanup behavior on this drive without the user asking for it, each
time, explicitly. If a filed document turns out to be wrong (wrong
metadata, wrong binding direction, etc.) and needs replacing, that's an
overwrite of an existing file — get the user's explicit one-time
go-ahead for that specific file before doing it; it is not covered by
your standing permission to file new documents.

All the orchestration lives in `src/upload-pipeline.js`
(`runUploadPipeline()`) — `bin/upload-documents.js` is a thin CLI wrapper
around it (parse args, call it, print the result), matching this repo's
existing `bin/audit-project.js` + `src/pipeline.js` pattern. This does the
mechanical, evidence-backed part of the job automatically:
- Classifies Publication vs Sessional Document vs Restricted vs CRP
  (`src/doc-classify.js`).
- Computes the filename and OneDrive folder per the real, current
  convention verified against actual files on OneDrive, not just the
  guideline text (`src/doc-naming.js` — see its module header for exactly
  which symbol shapes are high-confidence vs a best-effort guess).
- Compresses each staged PDF's embedded images via Ghostscript first
  (`src/pdf-compress.js`, `ebook` quality — text/vectors untouched, often
  80%+ smaller on a print-resolution scan or InDesign export), then
  applies PDF metadata (Title/Author/Subject/Keywords/Language, print
  presets, Initial View) automatically for English, French and Spanish,
  since those are the only languages the guideline requires copy-paste
  title text for (`src/pdf-metadata.js`, `src/title-extract.js`). Always
  compress before editing metadata, never after — Ghostscript regenerates
  the PDF and always overwrites `/Producer`/`/Creator`, which would
  otherwise silently replace the real original that `applyPdfMetadata`'s
  own `updateMetadata: false` is careful to preserve (real Angela-edited
  files keep e.g. "Microsoft® Word for Microsoft 365" as Producer). If you
  ever apply metadata by hand (AR/CH/RU below), call `compressPdf()`
  yourself first on the same bytes for the same reason.
- Generates a 1000×1414 cover JPG for publications (skipped for sessional
  documents), and surfaces taxonomy candidates for both document types —
  see "What this does" above for which vocabulary applies to which
  (`src/taxonomy.js`).
- Writes a JSON manifest (`<out>/manifest.json`) with everything above,
  plus copy-paste-ready EN/FR/ES title text, the symbol, and the agenda item.

Read the manifest and the console warnings. **Show the user the manifest
summary — classification, filename, destination folder, and the copy-paste
title text — before doing anything else.** Treat any warning as something
to resolve with the user, not something to silently proceed past:
low-confidence filename shapes, a symbol mismatch between the email and the
PDF's own cover page, or a missing destination folder all mean "ask", not
"guess".

### Finishing Arabic / Chinese / Russian metadata — and any other language the pipeline couldn't auto-title

The CLI deliberately does **not** auto-apply PDF metadata to AR/CH/RU files
— there's no reliable script-based way to extract their titles, and the
guideline doesn't require copy-paste text for them anyway (the website
doesn't render in those languages). But you can read any script directly:
open the PDF's cover page with the `Read` tool (it renders PDF pages as
images), read off the title in that language, then apply metadata yourself:

```js
import { compressPdf } from './src/pdf-compress.js';
import { applyPdfMetadata } from './src/pdf-metadata.js';
const bytes = fs.readFileSync(sourcePath);
const compressed = await compressPdf(bytes, { quality: 'ebook' }); // always before metadata, see above
const edited = await applyPdfMetadata(compressed.bytes, { lang: 'ar', title: '<title you read off the page>' });
fs.writeFileSync(stagedPath, edited);
```

Then file it the same way the CLI filed the others
(`src/onedrive-filing.js`'s `fileDocuments`).

**The same manual step also applies to EN/FR/ES whenever automatic title
extraction genuinely couldn't run** — confirmed 2026-09-07, filing
`TD/B/WP(91)/CRP.1`: English relies solely on `email.title` (never
extracted from the PDF), which stays `null` for any non-gDoc2.0 email (see
the symbol-fallback note above); FR/ES fall back to `extractSessionalTitle()`,
which anchors on the "Note by the UNCTAD secretariat" line (or its FR/ES
equivalent) and returns `null` for any cover page that doesn't have it —
true of Conference Room Papers, whose covers read differently (e.g. this
one: agenda-item line, then straight to the title, then "Supporting
materials", no "Note by..." line at all). The manifest's own warning
("No confirmed title for '<lang>'...") is the trigger to do this by hand —
read the excerpt (or the PDF itself), confirm the real title, and apply it
with the same `applyPdfMetadata()` snippet above (just with `lang: 'en'`/
`'fr'`/`'es'` instead of `'ar'`). Real worked example: this document's
English title is "External evaluation of UNCTAD subprogramme 4: Technology
and logistics" (the cover's trailing `*` footnote marker isn't part of the
title). Don't try to generalize a new automatic heuristic from a single
non-standard cover page — one example isn't enough evidence.

## Step 2 — confirm Drupal login before touching the browser

**Hard precondition, before any `mcp__claude-in-chrome__*` call**: navigate
to `https://uat-unctad.org/admin/content` and check the page — a logged-in
session shows the black admin toolbar (Workbench / Manage / Shortcuts /
username) across the top, per the guideline screenshots. If instead you
land on a login form, **stop** and tell the user to log into
`uat-unctad.org` first. Don't attempt to log in on their behalf.

Confirmed live on UAT (2026-08-26): the "Add Content → Official Document"
form has an **Associated meetings** field near the bottom (below Zotero/DOI,
above "Create publication"/"Published") that none of the three guideline
PDFs mention. It's a two-entry autocomplete over Meeting nodes — this is
how a document actually gets linked to its meeting. See Step 3 below for
how to fill it.

## Step 3 — drive the Drupal form

Content → **Add content** → **Official Document** → Document Type dropdown.
**The real dropdown has four options — Agenda, Publication, Publication
Chapter, Sessional Document** (confirmed 2026-09-02) — not the
Publication/Sessional-Document binary `classification.documentType`
currently produces (`src/doc-classify.js` hasn't been taught the
Agenda/Publication-Chapter distinction yet, see TODO.md):
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
  see "Taxonomy workflow" for the full three-taxonomy process (sourcing,
  mention-count evidence, the per-taxonomy bar, presentation format).
  Applies to every content type, not just Publications — for a Sessional
  Document, still run the process and still ask; don't assume blank by
  default just because that was the old guidance (see that section's own
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

### Companion Publication-type page (important publications)

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

## Never publish — leave that to the user

**Never tick the Published checkbox, on any target, UAT or production,
ever, unless the user has explicitly said so for that specific
document.** Always leave the node unpublished/draft after Save, and tell
the user to review and publish it themselves. This is a hard standing
rule (2026-09-02), not merely a permission check — treat "tick Published"
anywhere else in older notes as superseded by this.

**Stop here and get explicit confirmation from the user before clicking
Save**, even though Save alone no longer publishes anything. Creating a
node (even a draft) on a real, shared production Drupal instance isn't
fully reversible with a simple "undo" — read back what you're about to
save (document type, title, symbol, restricted status, which languages,
associated meeting if any) as the confirmation prompt before Save.

**Don't trust a coordinate-based click for the Save button, or for any
"Add File" button** — the page can reflow between when you screenshot and
when the click lands (an AJAX file-upload or autocomplete response
landing in between is enough). Prefer `find` to get a fresh `ref`
immediately before each click rather than reusing one from an earlier
step, especially after each per-language file upload (each one triggers
its own AJAX partial-page update). This has misfired twice in practice:
once a stale ref landed on Save mid-way through filling the form
(created the node early, correctly still unpublished, but without the
intended confirmation step); treat that as the reason for this rule, not
a one-off.

After clicking Save, **don't assume nothing happened just because the
page didn't visibly change** — see "unctad.org / uat-unctad.org can be
slow or unresponsive" below before clicking Save again. Once you believe
it went through, independently confirm via `admin/content` (filtered by
title, sorted by Updated) — check both that the node exists with the
right field values **and** that only one was created, not a duplicate —
before telling the user it's done.

**A file entry's "Remove" button doesn't finish the job by itself.**
Drupal's Paragraphs widget only marks the entry `Deleted Paragraph: File`
on Remove — it still runs "Language field is required" / "file or link
required" validation against it on Save and rejects the whole form until
you separately click the **Confirm removal** button that appears next to
that deleted-paragraph row. This matters because an extra empty file
entry auto-appears after each language is attached (normal — it's how
you'd add the next one); if you have exactly 6 languages you'll end up
Removing that trailing empty 7th entry, and Save will fail with the above
error message until you click Confirm removal on it, not just Remove.

**A one-off `403 Forbidden` on the very first "Add File" AJAX submit of a
run** has been seen once on production (2026-09-03) — the network log
showed a Cloudflare challenge resource around the same time, so likely a
transient bot-check hiccup rather than anything wrong with the form.
Reloading the page fresh (re-entering the fields lost by the reload) and
retrying fixed it; every subsequent AJAX call that run returned `200`.
Treat a 403 here as "reload and retry once" before treating it as a real
blocker.

## Correcting a file on an already-filed document

If a filed document's PDF turns out to be wrong (bad metadata, missing
images, wrong content) and the user has given explicit one-time
permission to fix that specific file (see the overwrite rule in Step 1),
don't recreate the node — replace the file in place:

1. Open the node's edit page, find the Files entry, and use its
   **"Replace this file"** link — it opens a dedicated page at
   `admin/content/files/replace/<fid>`, separate from the node edit form.
2. That page shows the current filename/size under "Original" — **read
   it and confirm it matches the file you actually mean to replace**
   before uploading, especially when replacing several languages in a
   row (fid order isn't always the same as the on-page language order).
3. Upload the corrected file and click **Save**. The filename stays the
   same (confirmed: uploading a differently-named local file still saves
   under the original's filename) — Drupal replaces the bytes at the
   same fid, so the node's own reference to it needs no further edit.
4. **A stale-click gotcha, seen repeatedly on this exact page**: the
   first Save click after an upload frequently doesn't register (the
   page still shows the file selected, no "The file was replaced."
   status message) — screenshot or re-read the page after clicking, and
   click Save again if the status message hasn't appeared. Don't assume
   one click was enough just because nothing errored.
5. **Verify the live public URL afterward, with caching disabled — don't
   trust the "The file was replaced." message alone.** Confirmed
   2026-09-15: right after a successful save, the very first fetch of
   `unctad.org/system/files/official-document/<filename>` still returned
   the *old* file — Cloudflare was serving a cached copy
   (`cf-cache-status: HIT`, the site's `Cache-Control` is `max-age=2592000`,
   30 days). It resolved on its own within roughly 10-20 seconds (a
   second fetch showed `age: 7`, i.e. a freshly-cached copy), consistent
   with the save triggering a purge rather than waiting out the full
   TTL — but that window is real. From a logged-in tab,
   `await fetch(url, { cache: 'no-store' }).then(r => r.arrayBuffer())`
   via `javascript_tool` and checking `.byteLength` against the size you
   just uploaded is a fast, reliable way to confirm the public copy has
   actually caught up before telling the user it's fixed.

## unctad.org / uat-unctad.org can be slow or unresponsive

Both sites are known to be intermittently slow, or to return `503
Service Unavailable`, independent of anything this tool does (confirmed
by the user 2026-09-02 as a recurring condition, not a one-off — hit
directly around a Save action that day, response page 503'd even though
the node had actually saved). Consequences for driving these forms:
- A click (Save, Add File, etc.) that appears to do nothing is not
  necessarily a failed click — wait a few seconds and re-check the page
  before assuming you need to click again.
- **Never repeat a Save click just because nothing visibly happened.**
  Check `admin/content` (filtered by title, sorted by Updated) to see
  whether the node was already created first. Repeating Save blind risks
  creating duplicate nodes.
- File-upload AJAX responses on the Files widget can take several
  seconds longer than usual on a slow day — wait for the spinner next to
  "Choose File" to actually clear (confirm the filename + size appear)
  before doing anything else with that file entry.
- If a page (or the whole site) is 503ing, wait and retry navigation a
  couple of times before concluding something is actually broken; it's
  usually transient.

After Save: verify every uploaded language is listed on the resulting page.
**Never click the browser back button afterward** — the guideline is
explicit that this returns you to the just-submitted form, not the node.
Instead return to Content and filter **Authored by** on the current user to
confirm the entry logged correctly, per the guideline's own closing step.

## Resolved: Restricted → Final lifecycle

An English-only "Advance copy" gets logged as Restricted; later the full
translated set arrives (this is literally what TD/B/73/5 was — Restricted
on 2026-08-26 while English-only, unrestricted the same day once all 6
languages were attached). The guideline itself never says what to do here,
but the user gave an explicit standing rule: **when all 6 languages are
attached, Restricted should not be used** — `reconcileRestrictedWithLanguages`
in `src/doc-classify.js` applies this automatically (only when the *sole*
reason for Restricted was the Advance-copy marking; a `/R.` symbol or a
Conference Room Paper stays Restricted regardless of language completeness,
since those are Restricted for reasons unrelated to translation status).
Still open: whether completing the record means editing that *same* node
(this is what was done for TD/B/73/5) or creating a fresh one and
unpublishing/deleting the restricted original — ask if it's not obvious
from context which the user wants.

## Resolved: file-naming underscore convention

Angela confirmed (2026-08-26): follow the written guideline exactly — a
single underscore only before the language suffix, nowhere else — not her
own past OneDrive practice (which had inconsistently added one before the
d/r/l segment too). Implemented in `src/doc-naming.js`. Her reply also
surfaced `TD/B/WP/...` (Working Party) needing "TD/B/" dropped entirely
like the commissions, which wasn't previously handled — see that module's
header comment for the full worked-example set.

## Taxonomy workflow: Thematic, Sitemap, Product

Standing process (2026-09-14), applies to **every content type**, not
just Publications — supersedes the older per-content-type rules below
(kept for their historical context, not as current instructions).

**Always ask the user first whether this document needs taxonomies at
all** before doing any of the matching work below — not every document
warrants tagging, and this is a judgment call for the user to make, not
something to assume from content type alone.

**Sources — only suggest terms that already exist in these, never invent
one:**
- **Thematic** — `data/Thematic_Taxonomy_List.txt` (one term per line, no
  ID; original source copy at `.claude/skills/upload-documents/
  references/thematic_taxonomy_list.md`).
- **Sitemap** — `data/Sitemap_Taxonomy.csv`, converted from the Sitemap
  sheet of `.claude/skills/upload-documents/references/
  Product_and_Sitemap_Taxonomies.xlsx` (the original workbook, kept for
  provenance/re-conversion if it's ever updated).
- **Product** — `data/Product_Taxonomy.csv`, converted from that same
  workbook's Product sheet. **This is now the canonical Product Taxonomy
  source for every content type, including Sessional Documents** — the
  older `data/Sessional_Document_Product_Taxonomy.txt` (Angela's
  hand-curated 20-term subset, 2026-08-26) is superseded by this fuller
  sheet plus the judgment process below, not a separate track anymore.

Each Sitemap/Product CSV row carries **Term ID, Term name, Hierarchy
role, Parent names, Full hierarchy path(s)** — the hierarchy columns are
real evidence for judging fit, not just decoration: a term's place in the
tree often clarifies what it actually covers (e.g. a "Leaf child" term's
`Full hierarchy path(s)` shows the exact parent category it sits under).
**Exclude any row whose Term name contains the substring "DO NOT USE"** —
these are hierarchy-scaffolding placeholders, never valid tags themselves;
the exact bracket wording varies (`[DO NOT USE]`, `[PARENT DO NOT USE]`,
`[PARENT TERM - DO NOT USE]`, `[PARENT - DO NOT USE]` all appear in the
real workbook) — match on the substring, not one exact phrase.
`loadProductOrSitemapTaxonomy()` in `src/taxonomy.js` does this filtering
automatically; don't re-implement it inline.

**Tooling** (`src/taxonomy.js`): `loadTaxonomyList()` /
`suggestThematicCandidatesWithCounts(text, terms)` for Thematic;
`loadProductOrSitemapTaxonomy(csvPath)` /
`suggestProductOrSitemapCandidates(text, terms)` for Sitemap and Product
— both return every term with at least one mention, plus its count
(`countMentions()`, a whole-phrase case-insensitive match), sorted by
count descending (Sitemap/Product) or alphabetically (Thematic, per the
guideline's own instruction for that field). **This tooling only surfaces
candidates with evidence — it never decides "is this a main area", that's
still your judgment call**, reading the actual document, applying the bar
below.

**Shared "main area" rule, different bar per taxonomy.** Only suggest a
term that reflects a recurring theme, a substantive section, or a central
focus of the document — not a passing or single-sentence mention.
Calibrate to document length: a handful of mentions can be significant in
a short paper but not in a 200-page report — don't apply a fixed numeric
threshold across documents of very different lengths.
- **Sitemap — stricter.** It determines page placement, so suggest fewer
  terms, only the ones you're genuinely confident about.
- **Thematic — looser.** It's just on-site keywords, so err on the side
  of inclusion.
- **Product — real judgment, not best-effort pattern-matching.** Many
  publications belong to an existing series (a flagship report series,
  etc.) — if a Product term for that series exists, it likely fits. A
  Product term for a parent event or series is for that event's/series'
  own page, not automatically for every document connected to it — check
  the actual fit, a family resemblance alone isn't enough. **If no
  existing series or term genuinely matches, the correct answer is no
  Product taxonomy suggestion at all** — don't force a near-fit just to
  have something to show.

**Presenting suggestions to the user:**
- Thematic: alphabetical, `Term name [N mentions]`.
- Sitemap and Product: `Term name (Term ID) [N mentions]` — e.g. `Africa
  (1067) [30 mentions]` — plus a short reason it clears the bar (or, for
  Product, a short reason nothing qualifies if that's the honest answer).
  This gives the user the actual evidence to make their own call, not
  just a claim to trust.

**Lessons from a real review (Beyond GDP, node 52790, colleague Timothy
Sullivan, 2026-09-15)** — his edits confirmed the mechanical
mention-counting above is a starting point, not the final answer:
- **Concept vs. literal name is the biggest gap, confirmed repeatedly.**
  Several of his additions had zero literal occurrences of the term's own
  name — e.g. Development indicators matched on the word "indicator"
  (13×), Gender equality on a "women's pay" example section (4×), SDG 16
  on "institution"/"trust"/"peace" (8+7+3×), Statistics and data on
  "statistic" (9×). A literal-substring count will always miss these —
  when reading the document yourself, actively look for the *concept*
  each taxonomy term represents, not just its exact name string.
- **A repeated example within one section isn't the same as a document-wide
  theme.** Africa was in the original candidate list (30 mentions) but got
  removed from both Thematic and Sitemap on final review — it turned out
  to be one recurring regional example inside a single chart/section, not
  a genuine focus of the publication as a whole. High mention count is
  evidence to check, not evidence to apply automatically.
- **Parent and child Sitemap terms can both genuinely apply** — Statistics
  and Beyond GDP (its own child page) were both added; don't assume adding
  the more specific term makes the broader parent redundant, or vice
  versa.
- **Watch for stray punctuation when an autocomplete value gets typed
  in** — one applied term round-tripped as `"SDG 16 Peace, Justice and
  Strong Institutions (1157)"` with literal, stored quote marks around it.
  Re-read a taxonomy field's actual saved value after applying it, the
  same way this skill already double-checks the Associated-meetings
  autocomplete elsewhere.

## Known gaps — ask, don't guess

One thing isn't answered by any of the three guideline PDFs — if you hit
it live, stop and ask the user rather than picking an answer:

- **Wrong file/language caught after Save**: the guideline only covers
  catching a wrong upload before saving.
