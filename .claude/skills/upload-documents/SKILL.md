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

This skill's supporting reference material lives under `references/`:
- `references/drupal-form-guide.md` — the full "Add content → Official
  Document" field-by-field walkthrough (Step 3).
- `references/taxonomy-workflow.md` — the Thematic/Sitemap/Product
  taxonomy process.
- `references/troubleshooting.md` — known edge cases and recovery steps.
- `references/thematic_taxonomy_list.md`,
  `references/Product_and_Sitemap_Taxonomies.xlsx` — original source
  copies for the taxonomy term lists (`data/*.txt`/`*.csv` are the
  converted, actually-loaded copies — see `taxonomy-workflow.md`).

See also [docs/upload-documents.md](../../../docs/upload-documents.md) in
the root README's documentation for the CLI/pipeline half of this tool.

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

Then fill Title, Symbol, Agenda Item, Published Date, Taxonomy, the
per-language file uploads, and Associated meetings — including the CRP
same-titled-sibling check, the taxonomy confirm-first rule, the fixed
language upload order, and the Associated-meetings autocomplete gotcha
(don't click the suggestion; UAT/production aren't in sync; the field is
sometimes computed, not fillable, on Create). Also check for a companion
**Publication**-type landing-page node (distinct from the Official
Document's "Publication" Document Type) and fill its four relevant fields
if one exists. **All of this is in
`references/drupal-form-guide.md`** — read it before filling the form,
don't re-derive it from memory.

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

## Taxonomy, troubleshooting, and known gaps

Three topics are documented in their own reference files rather than
inline here, so this file doesn't keep growing:

- **`references/taxonomy-workflow.md`** — the Thematic/Sitemap/Product
  taxonomy process: where the term lists live, the mention-counting
  tooling, the different "main area" bar per taxonomy, and lessons from a
  real human review that corrected the mechanical candidates. Read this
  before filling any of the three taxonomy fields in Step 3 — always ask
  the user first whether the document needs taxonomies at all.
- **`references/troubleshooting.md`** — correcting a file on an
  already-filed document (the "Replace this file" flow, a stale-click
  gotcha, and a real Cloudflare-caching gotcha when verifying the fix);
  unctad.org/uat-unctad.org being intermittently slow or 503ing and what
  that means for Save/Add-File clicks; the Restricted → Final lifecycle
  rule (all 6 languages attached ⇒ clear Restricted, unless it's a `/R.`
  symbol or a CRP); the file-naming underscore convention; and one known
  gap (a wrong file/language caught only after Save) with no guideline
  answer — ask the user rather than guessing.
