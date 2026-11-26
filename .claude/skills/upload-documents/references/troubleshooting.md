# Troubleshooting and known edge cases

Edge cases and recovery steps for `/upload-documents`, promoted out of
`SKILL.md` so that file doesn't keep growing. Read this when something
during Step 3 (or afterward) doesn't match the straightforward path in
`drupal-form-guide.md`.

## Correcting a file on an already-filed document

If a filed document's PDF turns out to be wrong (bad metadata, missing
images, wrong content) and the user has given explicit one-time
permission to fix that specific file (see the overwrite rule in Step 1 of
`SKILL.md`), don't recreate the node — replace the file in place:

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

## Known gaps — ask, don't guess

One thing isn't answered by any of the three guideline PDFs — if you hit
it live, stop and ask the user rather than picking an answer:

- **Wrong file/language caught after Save**: the guideline only covers
  catching a wrong upload before saving.
