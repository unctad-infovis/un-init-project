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
- Surfaces taxonomy candidates either way, from two entirely different
  vocabularies: publications get the large general Thematic Taxonomy list
  (`manifest.taxonomySuggestions`); sessional documents get Angela's own
  small curated Product Taxonomy list — confirmed 2026-08-26, overriding
  the guideline PDF's "skip taxonomy" default for sessional documents
  specifically for this field (`manifest.sessionalProductTaxonomy`). Both
  are candidates only — never auto-applied, and for the sessional list
  capped at **5 selections, never more**, chosen by actually reading the
  document, not by trusting the weak substring-match candidates alone.
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
- Sessional documents: leave **Thematic** and **Sitemap Taxonomy** blank
  (guideline: "unless you are 100% clear"). **Product Taxonomy** is
  different — Angela confirmed it does apply to sessional documents, from
  her own curated list (`manifest.sessionalProductTaxonomy.fullList`, each
  with a Drupal term ID). Read the English PDF yourself and pick **up to
  5, never more** (`maxSelectable`) — `.candidates` is only a weak
  substring-match hint on the list, not a substitute for actually reading
  the document; it will often be empty even when real matches exist.
  Confirm your picks with the user before applying, same as publications.
- Publications: fill **Thematic Taxonomy** from
  `manifest.taxonomySuggestions` (ask the user to confirm/prune first —
  never apply unconfirmed), **Product Taxonomy** with the series if there
  is one, and **Sitemap Taxonomy** always including "UNCTAD Home" so the
  item appears under "Latest Publications".
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

## Resolved: sessional-document Product Taxonomy

The sessional guideline PDF is actually conditional about taxonomy — "Do
NOT complete the Product, Thematic or Sitemap Taxonomy Fields **unless you
are 100% clear**" — and `UNCTAD_PDF_Prep_Instructions.txt` (separate
AI-prep notes, not one of the three Drupal guideline PDFs) went further and
said skip it unconditionally. Angela's answer (2026-08-26) splits the
difference for **Product Taxonomy specifically**: it does apply to
sessional documents, from her own small curated list (20 terms with Drupal
IDs, `data/Sessional_Document_Product_Taxonomy.txt`) — pick up to 5, never
more, by reading the document. Thematic and Sitemap Taxonomy stay blank
for sessional documents as the guideline originally said; only Product
Taxonomy changed. Tim's training follow-up also flagged
taxonomy-during-extended-leave-coverage as a gap — still genuinely open,
ask if it comes up.

## Known gaps — ask, don't guess

One thing isn't answered by any of the three guideline PDFs — if you hit
it live, stop and ask the user rather than picking an answer:

- **Wrong file/language caught after Save**: the guideline only covers
  catching a wrong upload before saving.
