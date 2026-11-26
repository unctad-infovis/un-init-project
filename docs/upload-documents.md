# Logging official documents to Drupal

See the [root README](../README.md) for the rest of this repo.

CER's Web Unit receives official UN documents (sessional documents,
restricted documents, publications) by email from gDoc2.0/Doc Submission
and has to rename them per UN symbol convention, edit their PDF metadata,
file them under the team OneDrive, and log them in Drupal as "Official
Document" content. `un-upload-documents` automates the mechanical half of
that job (orchestration lives in `src/upload-pipeline.js`; `bin/upload-
documents.js` is a thin CLI wrapper around it, same pattern as
`un-audit-project`); the `/upload-documents` Claude Code skill
(`.claude/skills/upload-documents/SKILL.md`) drives the rest, including
the Drupal upload itself via browser automation.

```
un-upload-documents <email-file> <attachment-path> [--out <dir>] [--root <onedrive-root>] [--dry-run]
```

Given the forwarded gDoc2.0 notification email and its attachment (a
single PDF, a directory of PDFs, or the "final documents" zip gDoc2.0
sends), it:

- classifies the document (Publication / Sessional Document / Restricted / CRP),
- computes the correct filename and OneDrive destination folder – per the
  real, current convention verified against actual files already on
  OneDrive, not just the written guideline text (see `src/doc-naming.js`
  for exactly which symbol shapes are high-confidence vs. best-effort),
- compresses each staged PDF's embedded images via
  [`un-compress-pdf`](compress-pdf.md) (Ghostscript, `ebook` quality)
  before editing its metadata – text and vectors untouched, but a
  print-resolution PDF often shrinks by 80%+,
- applies UNCTAD's PDF metadata conventions (Title/Author/Subject/Keywords/
  Language, print presets, Initial View) for English, French and Spanish,
- generates a cover JPG for publications (skipped for sessional documents),
  and surfaces taxonomy candidates for both – the large general Thematic
  Taxonomy list for publications, or a small curated Product Taxonomy list
  for sessional documents (pick up to 5, by reading the document),
- files everything under `!MASTER_DOCS_and_PUB` on OneDrive, and
- writes a JSON manifest – including copy-paste-ready EN/FR/ES titles –
  for the skill (or a human) to review before anything touches Drupal.

It never silently overwrites an existing OneDrive file, and it never
touches Drupal itself – that's the skill's job, gated on the user already
being logged into `uat-unctad.org` (never production, unless told
otherwise) and on explicit confirmation before the final Save.

The taxonomy lists this tool suggests from are checked in at
`data/Thematic_Taxonomy_List.txt` (publications) and
`data/Sessional_Document_Product_Taxonomy.txt` (sessional documents). The
three source guideline PDFs and reference AI PDF-prep instructions this
was built from are local reference material only (`tmp/`, gitignored) –
not needed to run the tool, just useful if you're changing how it
behaves.

`un-upload-documents` also accepts a real Outlook `.eml` export directly –
`un-upload-documents <email>.eml [--out <dir>]` – and will pull both the
email body and its zip/PDF attachment straight out of the `.eml`, so a
second attachment-path argument isn't needed in that case.

## The rest of the workflow (Drupal, taxonomy, troubleshooting)

Everything past "write a manifest" — confirming the Drupal login, driving
the "Add content → Official Document" form field by field, the companion
Publication-type page, the Thematic/Sitemap/Product taxonomy process, and
known edge cases (slow/unresponsive Drupal, replacing an already-filed
file, the file-naming convention) — is documented in the
`/upload-documents` Claude Code skill, not here:

- `.claude/skills/upload-documents/SKILL.md` — the main workflow.
- `.claude/skills/upload-documents/references/drupal-form-guide.md` — the
  full "Add content" form walkthrough.
- `.claude/skills/upload-documents/references/taxonomy-workflow.md` — the
  Thematic/Sitemap/Product taxonomy process.
- `.claude/skills/upload-documents/references/troubleshooting.md` —
  known edge cases and recovery steps.
