# TODO

Repo-wide tracking of what's still unverified before a tool is trusted for
real, unsupervised use.

## `un-init-project`

- [x] **Scaffolded projects kept filesystem-absolute symlinks back into
      this repo instead of real copies – and one of them silently
      corrupted a shared template file** – found and fixed 2026-09-11,
      reported by the user on a real project (`2026-global_trade_update`).
      `bin/init-project.js` deliberately passes `cpSync(src, dest, {
      recursive: true, dereference: true })` so that files symlinked
      *within* `templates/*` → `templates/shared/*` (a DRY pattern: edit
      `LICENSE.md`/`index.html`/`.npmrc`/`vite.config.js`/`biome.json`/
      `src/meta.json` once, every template that shares it picks it up)
      get copied into a new project as real, independent files, not
      symlinks. **Confirmed a genuine Node.js regression, not a bug in
      this script's own logic**: reproduced directly against Node
      20.19.2/22.22.2/24.15.0/26.1.0 via `nvm` – on Node 20, `dereference:
      true` correctly follows a symlink found anywhere while recursing
      `src`; on Node 22+ it only dereferences the top-level `src` path
      itself, leaving any symlink found *inside* the tree untouched. The
      user's own nvm default had moved from 20 to 24, which is exactly
      when this started silently regressing.
      **This was worse than just non-portability**: `index.html` is both
      one of the symlinked files *and* one of the three files
      `injectProjectName()` writes the new project's name into
      (`INJECT_FILES`) – `fs.writeFileSync` follows a symlink by default,
      so every real scaffold on Node 22+ was writing straight through to
      `templates/shared/index.html` in this repo, overwriting its
      `__PROJECT_NAME__` placeholder with that run's own project name.
      Confirmed this had already happened for real – `git status` showed
      `templates/shared/index.html` modified, containing
      `2026-global_trade_update` baked in in place of the placeholder;
      restored via `git checkout` before any other project could pick up
      the wrong name.
      **Fixed**: added `dereferenceSymlinks()` to `bin/init-project.js`,
      called right after the `cpSync` copy – walks the new project,
      replaces any symlink (file or directory) that made it through with
      a real copy of its target, recursively. Verified with a real
      scaffold run afterward: zero symlinks in the output, correct
      per-project title injected, and `templates/shared/` left untouched
      by `git status` this time. The one real pre-existing affected
      project (`2026-global_trade_update` – confirmed via `find -type l`
      across every `~/Work/unctad/2026/*` project that it was the only
      one) had its 6 symlinked files replaced with real copies by hand,
      and `index.html`'s `__PROJECT_NAME__` placeholders (never actually
      injected for that project, since the write had gone to the shared
      template instead) filled in with its real name after the fact.

## `un-upload-documents` / `/upload-documents`

Everything below has only been tested against synthetic or scratch-root
cases – nothing has run against the real OneDrive location or a real
Drupal production save yet.

### Needs verification against a real document

- [ ] **PDF metadata editing** (`src/pdf-metadata.js`): confirm against a
      real document, opened in Acrobat, that Title/Author/Subject/Keywords/
      Language/print-presets/Initial View all look right to Angela – not
      just structurally correct per `pdf-lib`'s own read-back.
- [x] **Reading Options > Binding missing for Arabic** – fixed 2026-09-02,
      found by the user inspecting a real Arabic PDF's Document Properties
      in Acrobat: `applyPdfMetadata()` never set the `/Direction` viewer
      preference (Acrobat's "Binding" field), so every language silently
      defaulted to `L2R` ("Left Edge") – wrong for Arabic, which needs
      `R2L` ("Right Edge"). Added `RTL_LANGUAGES` + explicit
      `setReadingDirection()` call for every language (not just Arabic),
      so it's never left to pdf-lib's default again. Caught only because
      the user opened the actual file in Acrobat – structural/pdf-lib-only
      verification would not have surfaced this.
- [ ] **Publications path** (cover JPG + thematic taxonomy suggestions):
      completely untested – no real publication example has gone through
      the tool yet. Needs a real `UNCTAD/...`-symbol document.
- [ ] **Sessional Product Taxonomy suggestions**: new 2026-08-26, zero real
      documents tested against Angela's curated list
      (`data/Sessional_Document_Product_Taxonomy.txt`). Confirm the
      candidate-matching is actually useful (or at least not misleading)
      once a real sessional document goes through, and that reading the
      document + picking ≤5 terms in practice feels right to Angela.
- [x] **File-naming underscore convention** – resolved 2026-08-26. Angela:
      follow the written guideline exactly, single underscore only before
      the language suffix, nowhere else – not her own past OneDrive
      practice. Implemented in `src/doc-naming.js`; verified against all
      her worked examples plus every previously-tested real symbol shape.
      New sub-item: `TD/B/WP/...` (Working Party) needed its own case
      (drops "TD/B/" like the commissions do) – found via her example,
      wasn't previously handled at all.
- [x] **Add./Corr./Rev. compound symbol suffixes – confirmed for
      board-working-party** – fixed 2026-09-04, first real compound-suffix
      document (`TD/B/WP/343/Add.2`, request R2612878). Two real bugs found
      together:
      1. `parseSymbol()`'s `board-working-party` branch read
         `rest[rest.length - 1]` for the item number, which for a 3-segment
         symbol (`WP`/`343`/`Add.2`) grabbed the suffix segment instead and
         silently dropped the item number entirely – produced `wpdAdd2`
         instead of the real convention (`wpd343add2`, confirmed against
         sibling files already on OneDrive: `wpd325add1_en.pdf`,
         `wpd325add2_en.pdf`, `wpd343add1_en.pdf`). Fixed with a new shared
         `classifySuffixSegment()` helper (`add<n>`/`corr<n>`/`rev<n>`) and
         `rest[1]`/`rest[2]` read explicitly instead of `rest[length-1]`.
      2. `buildFolderPath()` had no `board-working-party` case at all (the
         human-labelled half of a WP item folder, e.g. "343 (Review of the
         technical cooperation activities)", isn't derivable from the
         symbol). Added `findExistingWorkingPartyFolder()`
         (`src/onedrive-filing.js`) instead: for an item already filed
         before, scan `TD_B_WP (Working Party)/` for a folder starting with
         the item number and use it if there's exactly one match – zero or
         multiple matches still fall through to `null` (ask), same
         convention as the rest of this module.
      Still unconfirmed for any other symbol shape (a hypothetical
      `TD/B/73/5/Add.1`) or for `Corr.`/`Rev.` themselves (only `Add.` has a
      real example so far) – ask for a real example before extending
      beyond `board-working-party`.
- [x] **Forwarder-note extraction silently failed on real Outlook (CRLF)
      emails** – fixed 2026-09-04, found while filing R2612878.
      `gdoc-email.js`'s quote-boundary regex was `/^From:.*\n/m` – JS `.`
      excludes `\r` as well as `\n`, so on a normal `\r\n`-terminated
      Outlook "From: ..." quote-block header the match failed outright
      (silently, no error). With that boundary gone, only the much-later
      `^Request:` field bounded the preamble, so the gDoc2.0 boilerplate
      ("Dear Colleague... Please be informed...") got merged into the
      preamble alongside the forwarder's real note, tripped
      `isBoilerplate`, and discarded the entire note – human instruction
      included. Confirmed as a real, consequential loss: the discarded note
      contained the only source for this document's Associated Meeting
      link (Kseniia Kelly's forward, meeting URL for the WP 91st session).
      Fixed with `/^From:.*\r?\n/m`. Since every real forward in this
      project so far has come via Outlook (CRLF), this bug would have hit
      *every* prior and future run with a forwarder's note attached –
      worth treating any previously-filed document's recorded `note` as
      possibly having been silently empty when it shouldn't have been.
- [x] **Real OneDrive write** – done 2026-09-02 for the first time, on a
      real document: `TD/B/C.I/MEM.2/67` ("Provisional agenda and
      annotations"), all 6 languages filed to
      `TD_B_CI_MEM (Trade and Development)/MEM-2 (Commodities and
      Development)/67 (Agenda)`. New standing rule from the user (see
      `[[upload-documents-safety-rules]]` memory): always show the
      resolved destination path and get explicit confirmation before the
      real (non-`--dry-run`) copy; never delete from OneDrive without
      asking; a mistaken file (see the Arabic binding fix above) may only
      be replaced with the user's explicit one-time exception, not by
      default.
- [x] **Commission filename prefix used the Roman numeral, not Arabic** –
      fixed 2026-09-02, found by the user. `doc-naming.js`'s commission
      branch (`TD/B/C.I/...`, `TD/B/C.II/...`) built the filename prefix
      from the Roman numeral itself (`ci`/`cii`) – wrong; real OneDrive
      filenames use an Arabic digit (`c1`/`c2`), confirmed independently
      by inspecting sibling files already on OneDrive (`c1mem2d66_en.pdf`,
      a loose `c1mem4_2026_prog_en.pdf`). The *folder* genuinely does use
      the Roman numeral (`TD_B_CI_MEM (Trade and Development)`) – only the
      filename was wrong. Fixed in `parseSymbol()`.
- [x] **`TD/B/C.I/MEM.<n>/<seq>` folder shape** – added 2026-09-02, first
      real MEM-series document. `buildFolderPath()` previously returned
      `null` unconditionally for every `board-commission` shape; now
      resolves the real 3-level folder
      (`TD_B_CI_MEM (Trade and Development)/MEM-<n> (<topic>)/<seq>
      (<category>)`) when both the MEM series number and the document's
      category are in the new lookup tables – confirmed for series 2
      ("Commodities and Development") and category "Agenda" only (both
      independently verified against real sibling OneDrive folders, e.g.
      `66 (Report)`, `64 (Agenda)`). Any other series number or title that
      doesn't read as an agenda document still falls back to `null` (ask,
      don't guess) rather than inventing a topic/category name.
- [ ] **Drupal "Document Type" has more options than the tool assumes**:
      found 2026-09-02 – the real `Create Official Document` form's
      Document Type field has *four* options (Agenda, Publication,
      Publication Chapter, Sessional Document), not the Publication /
      Sessional-Document binary `doc-classify.js` currently produces. A
      provisional-agenda-type document should be logged as **Agenda**, not
      the generic Sessional Document `doc-classify.js` defaults to for any
      non-publication symbol – confirmed by the user for this specific
      case, but `doc-classify.js` itself hasn't been taught this
      distinction yet (still only classifies Publication vs. Sessional
      Document). Needs more real examples (what makes something
      "Publication Chapter" vs "Sessional Document" vs "Agenda") before
      encoding a rule.
- [x] **Second MEM.2 document confirms the pattern** – `TD/B/C.I/MEM.2/68`
      ("Navigating commodity price volatility", a Note by the secretariat
      for agenda item 4), filed 2026-09-02 to UAT (`node/51490`, no
      accidental-save incident this time – confirmed via readback that
      "Add File" refs stayed fresh throughout). Confirms:
      - The MEM-series folder category label is genuinely bespoke per
        document topic, not just Agenda/Report – no `68` folder existed
        yet, and the closest real precedent (`57 (Price volatility)` for
        the same recurring agenda item in an earlier session) matched
        this document's own title well enough to propose "68 (Price
        volatility)" to the user rather than guess blindly; confirmed and
        filed. `guessMemDocCategory()` correctly still returns `null` for
        this case (only "Agenda" is hardcoded) – left as `null`
        deliberately, not extended, since one precedent isn't enough to
        generalize a "match the title to any prior sibling folder" rule.
      - Document Type "Sessional Document" is correct for a Note-by-the-
        secretariat-style document (as opposed to "Agenda"), and its
        Restricted Document checkbox **is** present on the form (unlike
        "Agenda", where it wasn't seen at all) – consistent with the
        88-93 item above.
      - `extractSessionalTitle()` (`src/title-extract.js`) successfully
        auto-extracted FR *and* ES titles for this document (unlike the
        pure-agenda `/67` document, where it found neither) – its
        "Item N of the provisional agenda" → "Note by the secretariat"
        anchor pattern works for this document shape as originally
        designed; AR/CH/RU still always manual, per design.

- [ ] **Browser automation: AJAX "Add File" clicks can hit a stale Save
      ref** – 2026-09-02, filing `TD/B/C.I/MEM.2/67`: after several
      "Add File" AJAX partial-page-updates on the Create Official Document
      form, a later click (meant for another "Add File" button) landed on
      the real Save button instead – the node got created as an accidental
      side effect, mid-way through filling the form. No real harm this
      time (it saved unpublished, per the "never publish" rule, and every
      field was already correct) but it happened without the intended
      explicit pre-Save confirmation. Re-fetch a fresh element ref (or use
      `find` again) after every AJAX update on this specific form rather
      than reusing one from before a re-render – matches the general
      stale-ref caution already known for other editor UIs, worth treating
      as a standing rule for this form specifically since it repeats a
      partial-page-update per language.
- [ ] **UAT Meeting content isn't kept in sync with production**: found
      2026-09-02 – the "Associated meetings" field expects a real node
      reference, looked up by title on the target site; a Meeting that
      exists on `unctad.org` (production) may simply not exist yet on
      `uat-unctad.org`. Confirmed by the user as expected/normal, not a
      tool bug. When this happens, ask the user how to proceed (e.g. leave
      the field blank on UAT) rather than guessing an ID or trying to
      pull it from production.
- [x] **Filed on production (`unctad.org`)** – 2026-09-02, node `52741`,
      same document (`TD/B/C.I/MEM.2/67`), same content as the UAT run
      (`node/51489`) plus `Associated meetings` filled in this time (the
      17th-session Meeting node exists on production: `51492`, looked up
      by title, canonical `<Label> (<nid>)` string typed manually per the
      skill). Saved **unpublished** – confirmed via the edit page's "Not
      published" sidebar and the admin Content list – never published, per
      the standing rule. One real hiccup worth recording: production
      returned intermittent `503 Service Unavailable` responses around the
      Save action (unrelated to this tool – a transient site-wide issue),
      so the first couple of Save clicks appeared to silently do nothing;
      confirmed via the Content list (filtered by title, sorted by
      Updated) that only **one** node was actually created, not a
      duplicate, before treating the run as complete. Lesson: when a form
      submit looks like a no-op, check the Content list for a real
      duplicate before clicking Save again – don't assume-and-repeat.

- [x] **Second MEM.2 document filed to production (`unctad.org`)** –
      2026-09-03, node `52749`, same document as the UAT run above
      (`TD/B/C.I/MEM.2/68`, `node/51490`). Saved **unpublished**, confirmed
      via `admin/content` (title-filtered): exactly one node, no duplicate.
      Three new real findings from this run:
      - **"Associated meetings" is absent on Create, but present on Edit.**
        The production `node/add/official_document` form had no Associated
        meetings field at all this time (confirmed via a full page-text
        dump, twice, on two independent fresh loads – not a render glitch).
        Per the user's call, filed without it. But after Save, opening
        `node/<id>/edit` *does* show an "Associated meetings" section – and
        it already listed "Multi-year Expert Meeting on Commodities and
        Development, 17th session" with no action taken to set it. The
        live node page confirms it too, labelled "Referenced:". Conclusion:
        this is a computed/reverse reference (resolved from the other
        side – likely by Symbol/committee pattern – not a field this form
        actually writes), so it's *never* fillable on Create for this
        content type and doesn't need to be; the Create-form gap isn't a
        bug to route around, it's just how this field works. Skill still
        needs updating to say so explicitly instead of treating a missing
        Associated-meetings field as something to ask the user about.
      - **One-off 403 on the first "Add File" AJAX submit.** The very first
        `Add File` click of the run returned `403 Forbidden` on the AJAX
        POST; a full page reload (losing the in-progress fields, which had
        to be re-entered) fixed it and every subsequent AJAX call that run
        returned `200`. Network log briefly showed a Cloudflare challenge
        resource around the same time, so likely a transient bot-check
        hiccup rather than anything wrong with the form or this tool.
        Treat a 403 on this specific AJAX endpoint as "reload and retry
        once" before treating it as a real blocker.
      - **A removed empty file entry still fails "required" validation
        until you click "Confirm removal".** Clicking a file entry's
        `Remove` button only marks it `Deleted Paragraph: File` – Drupal's
        Paragraphs widget still runs "Language field is required" / "file
        or link required" validation against it on Save, failing the whole
        form, until you separately click the `Confirm removal` button that
        appears next to the deleted-paragraph row. Happened here because
        an extra empty 7th file entry auto-appears after the 6th language
        is attached (normal – it's how you'd add a 7th, if needed) and had
        to be removed since only 6 languages exist. Worth remembering for
        any future document with fewer than the auto-added row count.

- [x] **First `board-working-party` document filed to production** –
      2026-09-04, node `52764`, `TD/B/WP/343/Add.2` ("... Annex II:
      Statistical tables", English only). Saved **unpublished**, confirmed
      via `admin/content` (title-filtered): exactly one node, no duplicate;
      opened the live node page and eyeballed correct rendering. Real
      OneDrive copy confirmed on disk (`wpd343add2_en.pdf`, status
      `copied`, not overwrite). Two pipeline bugs found and fixed before
      filing – see the compound-suffix and forwarder-note entries above.
      One new confirming data point: **"Associated meetings" was present
      on Create this time** (unlike both MEM.2 runs above, where it was
      missing on Create for that content/committee combo) – filled by
      searching `admin/content?title=...&type=meeting`, opening the
      matching Meeting's Edit link to read its real nid (`51491`), and
      typing the canonical `<Label> (<nid>)` string directly into the
      field (never clicking the autocomplete suggestion, per the
      documented procedure) – worked cleanly, and the live node page's
      "Referenced:" line confirms the link took. So the field's presence
      on Create looks content/committee-dependent, not something this tool
      controls or should treat as a bug either way when it's missing.

- [x] **`TD/B/WP(<n>)/<item>` session-parenthesized symbol shape, plus a
      non-gDoc2.0 direct-forward email shape** – both found and fixed
      2026-09-07, filing a real document: `TD/B/WP(91)/CRP.1`, "External
      evaluation of UNCTAD subprogramme 4: Technology and logistics",
      Restricted, from `tmp/TD_B_WP(91)_CRP.1 - post on web as
      restricted.eml`. Two distinct real bugs, both blocking this one
      filing:
      1. **Naming bug**: `TD/B/WP(91)/CRP.1` matched no existing
         `parseSymbol()` branch (`WP(91)` isn't `EX(nn)`'s shape, and fails
         the plain `WP/<item>` branch's exact `rest[0] === 'WP'` check) and
         fell all the way to the generic `board-regular` fallback, which
         spliced the raw uppercase `WP(91)` token straight into the
         filename – `tdbWP(91)crp1`, wrongly marked `confidence: 'high'`.
         Fixed with a new `board-working-party-session` branch in
         `doc-naming.js`, confirmed against real OneDrive siblings
         (`wp84crp1_en.pdf`, `wp88crp1_en.pdf`, `wp90crp2_en.pdf`): the real
         convention drops `TD/B/` and uses `wp<sessionNum><itemType>
         <itemNum>`, same rule as the plain `WP/<item>` branch – **not**
         `EX(nn)`'s `tdbex...` convention despite the visual resemblance
         (documented explicitly in the new branch's comment, since it's an
         easy shape to mis-generalize from). Only the bare-CRP item-type is
         evidenced; anything else under a `WP(<n>)` session is flagged
         `confidence: 'low'`, not guessed at `'high'`.
      2. **Symbol-gate bug**: this email is a free-text forward from
         Docsubmission/DMS staff (Kseniia Kelly), not a gDoc2.0-template
         "Issued" notification – `parseGdocEmail()` correctly returns
         `symbol: null` for it (neither the body nor the manually-written
         subject match its expected shapes), and `runUploadPipeline()` used
         to throw immediately ("No UN symbol found...") *before* even
         reading the attached PDF, whose own cover page states the symbol
         in plain text. This is a real, recurring input shape (any direct
         DMS forward, not just this one), not a one-off – fixed by
         reordering `runUploadPipeline()` to collect attachments and
         extract PDF text *before* the symbol check, then falling back to
         `extractSymbolFromPdfText()` (already existed, previously only
         used for mismatch-detection) when the email itself has none. Only
         throws if *neither* source has a symbol. The manifest now carries
         a `resolvedSymbol` field (what the pipeline actually used) plus a
         `symbol-from-pdf` note when the email's own `email.symbol` stayed
         null – `email.symbol` itself is left unmutated as a faithful
         record of the raw input.
      Verified end-to-end via a real dry run: `naming.base === 'wp91crp1'`,
      `confidence: 'high'`, `resolvedSymbol === 'TD/B/WP(91)/CRP.1'`,
      `classification.documentType === 'Sessional Document'`,
      `classification.restricted === true` (both `/CRP.` and the PDF's own
      `"Distr.: Restricted"` fire independently – this detection was
      already correct before either fix, unaffected by the naming bug).
      `findExistingWorkingPartyFolder()` (added 2026-09-04) was extended to
      also cover this new kind via `parsed.sessionNum` – works unchanged
      since session folders (`90 (January 2026)`) and item folders
      (`343 (...)`) are literal siblings under the same `TD_B_WP (Working
      Party)/` directory. No `91` folder existed yet, so `destinationFolder`
      correctly stayed `null` (ask, don't guess the `(Month Year)` label
      from one example) – confirmed `TD_B_WP (Working Party)/91 (October
      2026)/CRP-1` with the user (matching the `CRP-<n>` subfolder
      convention seen in the two most recent real siblings, sessions 88 and
      90, rather than session 84's older no-subfolder pattern) before
      creating it and filing `wp91crp1_en.pdf` there for real.
      English title also didn't auto-extract – this cover page (a CRP) has
      no "Note by the UNCTAD secretariat" anchor line, which
      `extractSessionalTitle()` needs and which only FR/ES ever fall back
      to anyway (English relies solely on `email.title`, always null for a
      non-gDoc2.0 email) – applied manually via `applyPdfMetadata()`, same
      pattern already used for AR/CH/RU, title "External evaluation of
      UNCTAD subprogramme 4: Technology and logistics" (footnote marker
      stripped). Not treated as a bug worth a generic heuristic: one
      example without the standard anchor isn't enough evidence to
      generalize a new title-extraction pattern.
      Two secondary findings from this run, flagged but deliberately **not**
      fixed (no second real example to confirm a fix shape against):
      - `findExistingWorkingPartyFolder()` reusing the same lookup for
        session numbers isn't collision-proof – nothing enforces that a
        session number and an item number can never coincide (currently
        safe only by observed range), and at least one real session folder
        (`78`) has no parenthetical label at all, the same bare-number shape
        an item folder has. Documented in the function's own comment as an
        accepted risk.
      - `detectLanguageFromPdfText()` (`upload-pipeline.js`) only matches a
        cover page's bare `"English"`/`"Français"`/etc., not the
        `"<Language> only"` phrasing this document's cover actually uses
        ("English only") – harmless here since detection silently falls
        through to the correct `'en'` default, but a real latent
        mis-detection risk for a genuinely non-English single-language
        "advance copy" cover (e.g. `"Français seulement"`). No real
        non-English example seen yet to confirm the right fix shape
        against.
- [ ] **`--symbol`/`--title` CLI override flags** – deferred, not built.
      The PDF-text symbol fallback above already resolves the one real case
      that motivated this; a generic manual-override escape hatch on
      `bin/upload-documents.js` (`--symbol`/`--title`, threaded through as
      `options.symbolOverride`/`options.titleOverride`, checked before the
      email/PDF-derived values) would be easy to add later if a case shows
      up where even the PDF fallback fails, but building it now would be
      speculative scope with no second evidenced need yet.
- [x] **Drupal Title needs a manual `[Supporting materials]` suffix for a
      CRP that accompanies a main sessional report of the same name** –
      found and fixed 2026-09-07, right after Saving `TD/B/WP(91)/CRP.1`.
      Its title ("External evaluation of UNCTAD subprogramme 4: Technology
      and logistics") is identical to the already-published main report's
      title (`TD/B/WP/342`, node `52702`) – a CRP that supplements a report
      naturally shares its descriptive title. Real, direct precedent found
      on production from the *same document series*' previous cycle:
      `TD/B/WP/287` (main report, no suffix) pairs with `TD/B/WP(75)/CRP.2`
      (node `7841`, title suffixed `" [Supporting materials]"`) from 2017.
      Applied the same suffix to this node's title after Save (edited
      node `52766`, re-saved, still unpublished) to match. **Not
      automated** – this depends on recognizing a same-titled sibling
      already exists, which needs an admin/content title search per
      filing, not a rule `doc-naming.js`/`doc-classify.js` can derive from
      the symbol alone. Worth checking for a same-titled Sessional
      Document sibling by hand on every future CRP filing, not just when
      something looks obviously duplicated.

### Open product decisions (ask, don't guess)

- [ ] **Restricted → Final lifecycle**: when the full translated set
      arrives after an Advance-copy Restricted record already exists, is
      completing it always an edit to the *same* Drupal node (what was
      done for TD/B/73/5), or sometimes a fresh node + unpublish/delete the
      restricted original? Only one case has been tested.
- [x] **Sessional-document taxonomy** – resolved 2026-08-26. Angela: Product
      Taxonomy specifically applies to sessional documents (her own curated
      20-term list, pick ≤5 by reading the document); Thematic/Sitemap stay
      blank as originally documented. Implemented in `src/taxonomy.js` +
      `src/upload-pipeline.js` (`manifest.sessionalProductTaxonomy`).
- [ ] **Wrong file/language caught after Save**: no guideline covers this;
      no process defined yet.

### Scaling beyond a single user

- [ ] **OneDrive path is hardcoded and Mac-specific**
      (`src/onedrive-filing.js`'s `MASTER_DOCS_ROOT`:
      `~/Library/CloudStorage/OneDrive-UnitedNations/...`). Works for the
      current user's Mac mount point only – a Windows user's OneDrive sync
      folder lives at a different path entirely, and even on Mac another
      user's mount could differ. Needs to become configurable (env var,
      config file, or auto-detection across known OneDrive mount
      conventions) before this goes beyond the current single user.
      Rollout is expected to go 1 user → ~4 users → wider, so this needs
      solving before the second stage, not the third.

## `un-create-datawrapper-chart`

Built from `tmp/claude-code-brief-datawrapper-cli.md` (a build brief, not
followed strictly) and `tmp/datawrapper_api_reference.md`. `check`,
`create` (`d3-lines`/`column-chart`/`d3-bars`) and `to-web` (print→web
chart conversion) exist. Token is configured at
`~/.un-datawrapper/config.json`; `d3-lines` (chart `ZkeeG`), `d3-bars`
(chart `ZmNe2`) and `to-web` (source `T4lIe` → copy `lw8LX`) have all been
run for real and verified against `GET /v3/charts/{id}`.

- [x] **`to-web` command** – added 2026-08-27: turns an existing print/
      Publications chart into a new web-theme chart via `POST /charts/{id}
      /copy` + a settings patch, landing in the default folder (`437477`)
      like a brand-new chart would. Preserves the source's data/colours/
      axes untouched; only patches what differs between print and web
      (theme, publish blocks, sharing, y-grid-labels), plus this tool's
      own `d3-lines` line-width/legend rules on the copy's existing series
      names. The original chart is never modified – verified via readback
      that `T4lIe` (source) was unchanged after creating `lw8LX` (copy).
- [x] **Print-chart text cleanup on `to-web`** – added 2026-08-27 per user
      instruction, found via `T4lIe`'s real content: strips inline HTML
      styling (`<span style="font-size:...">`) from intro/source text
      (`stripHtml()`); normalises the source line to always include "UN
      Trade and Development (UNCTAD)", defaulting to a "based on" clause
      when the source has no calculations/estimates verb of its own
      (`normalizeSourceLine()`, both in `src/datawrapper-metadata.js`);
      always sets `hide-title: false` on the copy. Also handles the
      **hide-title + styled-intro convention** – confirmed common on older
      print charts: `hide-title: true` with the real visible headline
      living as styled HTML inside `describe.intro` and no true separate
      description. In that case (or when the title is simply empty), the
      unreliable/hidden title is replaced with an explicit "TITLE NEEDED"
      placeholder rather than silently carried over, and the cleaned intro
      text is demoted to its proper role as the subtitle instead of
      standing in as a fake title. Verified visually in the editor on
      `lw8LX`: title now reads "TITLE NEEDED" and is visible (not hidden),
      subtitle is the cleaned intro text, source line is grammatically
      correct and matches the UNCTAD template.
- [ ] **`to-web` for `column-chart`/`d3-bars` bar-specific styling**: like
      the still-open `d3-bars` question above, `to-web` doesn't yet touch
      any bar-specific styling (only `d3-lines` gets the line-width/legend
      overlay) – revisit once that's answered.
- [x] **Country-group colour + label-opening rules, notes HTML-stripping,
      wider en-dash fix, custom-tick clearing, y-axis-label placement** –
      added 2026-09-03, first real multi-chart run of `to-web` (four print
      charts from the GTU report → `Q9ULE`/`1N7t5`/`N4qHf`/`kqCGe`, all
      published and logged as Drupal media – see `.claude/skills/create-
      datawrapper-chart/SKILL.md`, which is now the authoritative,
      portable writeup of this whole workflow; this entry is the pointer,
      not the source of truth). Everything below lives in `src/datawrapper
      -constants.js`/`src/datawrapper-metadata.js`/`src/create-datawrapper
      -pipeline.js`:
      - `classifyCountryGroup`/`resolveCountryGroupColors`: **superseded
        2026-09-04, see the dated entry below** – this first version tried
        to avoid a colour clash conditionally (LDCs shared developing's
        yellow unless SIDS was absent); replaced with a fixed mapping once
        the real rule was confirmed.
      - `buildCountryGroupLabelOverrides`: "LDC(s)"/"SIDS" opened to their
        full names in whichever field actually drives that chart type's
        legend/axis (`visualize.lines.<key>.title` for `d3-lines`,
        `color-category.categoryLabels` for everything else that supports
        it).
      - `annotate.notes` now gets the same `stripHtml()` treatment as
        title/intro/source – previously untouched, so a converted chart's
        notes silently kept print-era inline HTML forever.
      - En-dash fix widened: previously only caught a hyphen between two
        years in the *description*; now also fixes a mid-sentence
        space-hyphen-space (e.g. "ITU - Aggregation" → "ITU – Aggregation")
        in the *source line*, and the year-range fix now also applies to
        the source line and description consistently.
      - `custom-ticks`/`-x`/`-y` always cleared on conversion.
      - `visualize.yAxisLabels.placement` forced to `inside` whenever the
        chart type has that field – a gap distinct from the existing
        `y-grid-labels: inside` rule, found via a real chart that had
        drifted to `outside`.
      - `to-web` now re-fetches the *new copy's own* `color-category.map`
        after `copyChart` before resolving colours against it, since
        Datawrapper's `/copy` can regenerate a richer map (more keys) than
        the source chart's own stored metadata shows – patching from the
        source's map alone would have silently dropped the extra keys.
      - `buildLineStyles` now also strips existing HTML from every
        `d3-lines` line's own title, not just the two country-group ones –
        previously it never set `title` at all, so non-country-group lines
        (e.g. "Developed"/"Developing") kept print-era HTML on every
        conversion.
      - **Not automated, deliberately**: for `multiple-columns` charts the
        x-axis bar label is read straight from the uploaded data's row
        values, not any metadata field – `categoryLabels` does nothing
        visible there. Confirmed by fixing one for real (`N4qHf`): required
        re-uploading the CSV with "SIDS"/"LDCs" spelled out in the actual
        category column, plus renaming the matching `color-category.map`/
        `excludeFromKey` keys to match. This is a data edit, not a
        presentation one – always ask before doing it for a given chart,
        per the skill.
      - **Real mistake made and fixed this run, worth remembering**:
        re-running `runConvertToWebPipeline` in dry-run against an
        already-corrected chart and blindly patching its `finalTitle`/
        `describe` back clobbers manual corrections, since those fields
        are always freshly recomputed from the *source* chart, not the
        already-fixed copy. Wiped out four correct titles and reverted two
        en-dash fixes back to hyphens before being caught and fixed. The
        skill now explicitly warns against this pattern.
      - **Publishing needs a browser session, not the API** – the shared
        team token returns `403 Insufficient scope` on `POST /charts/{id}
        /publish`; publishing only works via the authenticated Datawrapper
        editor UI. Also: any metadata patch made *after* a chart is
        already published leaves the live version stale until you click
        Republish again – caught once this run (a text fix landed on
        `Q9ULE` after its first publish, and the live chart kept serving
        the old text until re-published).
      - **Drupal "Datawrapper" media logging** – new, `unctad.org/media/
        add/datawrapper`: URL field takes the exact published `https://
        datawrapper.dwcdn.net/<id>/<version>/` link; Directory must be set
        to the "Datawrapper" taxonomy term (id `1696` seen this run, don't
        hardcode – read it off the dropdown); the admin/content/media
        `?type=datawrapper` URL filter shortcut doesn't work (silently
        empty), must use the page's own filter form instead.
- [x] **Country-group colour rule corrected to a fixed mapping** –
      2026-09-04, found by the user reviewing `N4qHf` and `1N7t5` (both
      show all four groups – developed/developing/LDCs/SIDS – as separate
      series). The 2026-09-03 version's conditional clash-avoidance was
      simply wrong: the real rule is a fixed two-family pairing with no
      conditions at all – developed→UN blue, developing→UN yellow, SIDS→UN
      dark blue, LDCs→UN dark yellow, always, regardless of which subset of
      the four groups a chart shows. `classifyCountryGroup` also now
      matches the already-opened-up label form (e.g. "Least developed
      countries (LDCs)"), not just the bare abbreviation, needed because
      `N4qHf`'s data values had already been renamed per the 2026-09-03
      label-opening fix and no longer carry the bare key. Applied to both
      live charts and republished. Same run: `N4qHf`'s "Mean fixed-
      broadband 5GB affordability (% GNI p.c.)" panel title fixed by hand
      (not automated – free-form column-header text, unlike the fixed
      country-group vocabulary) to "... (per cent of Gross National Income
      (GNI) per capita)" – a bare `%` inside prose should read "per cent"
      (the symbol itself is fine in an axis tick/data value, not in
      written text), and "GNI p.c." needed the same treat-every-
      abbreviation-as-LDC/SIDS scrutiny. `.claude/skills/create-datawrapper
      -chart/SKILL.md` updated to match.
- [x] **Year-pair colours, HTML entity decoding, bar-chart-family
      defaults, stacked-chart legend style** – 2026-09-04, two more real
      charts (`xxjf3`/`DEkvW`, GSFO folder). All in `src/datawrapper-
      constants.js`/`src/create-datawrapper-pipeline.js` unless noted; see
      `.claude/skills/create-datawrapper-chart/SKILL.md` for the full
      writeup, this is the pointer:
      - `resolveYearPairColors`: a second, narrower colour rule alongside
        the country-group one – when the colour-category map is *exactly*
        two bare 4-digit years, the later one is UN blue and the earlier
        is UN yellow. Deliberately not generalised to any other "most
        relevant vs comparison" pairing (e.g. "G20 economies" vs "Other
        economies", confirmed on `DEkvW` this same run) – which side is
        relevant there needed the user to say, not something inferable
        from series names.
      - `stripHtml` now decodes a small fixed set of HTML entities
        (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`), not just
        `<tag>`s – found via a real title with a literal trailing
        `&nbsp;` that tag-stripping alone left untouched.
      - **`color-category.map` silently does nothing without
        `color-by-column: true`** – a real colour patch had zero visible
        effect until this was also set. `to-web` now sets it automatically
        alongside any real colour-category write, gated on the field
        existing on the source at all (`d3-lines` doesn't have it and
        doesn't need it).
      - Bar-chart-family defaults, each gated on the source having the
        field: `sort-bars: false` always; `value-label-alignment`/
        `label-alignment: 'right'` always.
      - Stacked-chart series labels default to a colour-key legend
        (`categoryLabels.position: 'color-key'` + `stack-color-legend`/
        `show-color-key: true`), never the "direct" connector-line style –
        gated on `stack-color-legend` existing on the source (chart-type-
        specific field, only present where this direct-vs-legend choice
        exists at all).
      - Confirmed limitation, not a bug: the colour rules can only
        auto-fire when the *source* chart's `color-category.map` already
        has real keys to correct (`HmAZs`'s source map was completely
        empty – colours came from an auto-shaded `base-color` instead – so
        a future identical chart still needs a human to notice and supply
        the map by hand, same as this run).

- [x] **Headerless-CSV data loss** – fixed 2026-08-27, found via the
      user's real `tmp/data-7U4iN.csv` (no header row at all – its first
      data row, "Total palm oil (CPO+CPKO), 3.14", was being silently read
      as column names and dropped entirely). Added
      `detectMissingHeaderRow()` in `src/csv-inspect.js` (a header cell
      that itself parses as a number is essentially never a real column
      name); `check` now surfaces it as a problem, and `create` blocks on
      it outright rather than just warning, since unlike the other data
      problems this one silently loses a data point rather than just
      reading it oddly.

### Needs verification against a real API call

- [x] **Metadata shape for `d3-lines`** – verified 2026-08-27. Real
      `create` (not `--dry-run`) against `tmp/data-eff8j.csv`, chart
      `ZkeeG` (draft, never published), then `GET /v3/charts/{id}` to
      compare. Everything sent landed exactly as intended: theme,
      language, folder, `describe.intro`/`source-name`, `visualize.
      sharing`/`y-grid-labels`/`color-category.map`, all `publish.blocks`.
      No silent renaming/dropping by the API. Noted for later: Datawrapper
      fills in unrelated defaults we never set (`dark-mode-invert: true`,
      a `basemap`/`map-type-set` pair even on a line chart) – harmless
      now, but a future `lint`/`apply-settings` command comparing full
      metadata trees should ignore these rather than flag them as drift.
- [x] **Line thickness + label/legend for `d3-lines`** – added 2026-08-27
      per user feedback on chart `ZkeeG`. Confirmed by manually setting
      each option in the editor then re-reading `GET /v3/charts/{id}`:
      thickest width is the literal string `"style2"` under
      `visualize.lines.<series name>.width` (not tied to the pixel count
      shown in the UI); `directLabel: false` always (never label next to
      the line end); `colorKey: true` only when there's more than one
      series (a legend), omitted entirely for a single series (the
      title/description already say what the line is, so no legend or
      label at all). Implemented in `buildLineStyles()` in
      `src/datawrapper-metadata.js`, wired in only for `type === 'd3-lines'`
      – not yet checked whether `column-chart`/`d3-bars` have an
      equivalent per-series styling block worth setting the same way.
- [x] **Source line full stop only when it's a sentence** – fixed
      2026-08-27. Was requiring a trailing full stop on every source
      line; a bare "UN Trade and Development (UNCTAD)" isn't a sentence
      and shouldn't have one – only a "based on ..." clause makes it one.
      Fixed `SOURCE_LINE_PATTERN` and `validateSource()` to check both
      directions (missing period when there's a clause; stray period when
      there isn't).
- [x] **Metadata shape for `d3-bars`** – verified 2026-08-27. Real `create`
      against `tmp/data-7U4iN-clean.csv`, chart `ZmNe2` (draft, never
      published), then `GET /v3/charts/{id}` to compare, plus a visual
      check in the editor. Same shared-metadata fields (theme/language/
      folder/describe/sharing/y-grid-labels/color-category) landed exactly
      as sent, same as `d3-lines`. Not yet checked: whether `d3-bars` has
      its own equivalent of `d3-lines`'s per-series `visualize.lines`
      block (bar thickness, value-label styling) worth setting the same
      deliberate way – nothing bar-specific has been set yet, Datawrapper's
      own defaults were left as-is and looked fine on inspection.
- [ ] **Metadata shape for `column-chart`**: still unverified – only
      `d3-lines` and `d3-bars` have been checked against a real response
      so far.
- [x] **Default folder `437477`** – confirmed 2026-08-27. User: "archive"
      is just how Datawrapper names that part of the folder path in the
      URL, not a signal the folder holds archived charts – the real
      folder name is the one at the end of the URL/page title. Fine as
      the permanent default.
- [ ] **Retry/error-handling behaviour**: verified against a mocked
      `fetch` (429/5xx retry, error-message extraction, token never
      leaking into error text) – not yet exercised against the real API's
      actual error response shapes.
- [x] **8 already-published charts sat stale for 45+ minutes after a
      standalone metadata-patch script** – found 2026-09-04, the user
      asking "did you already make the changes based on the word? ... all
      should be already in unctad.org" is what actually surfaced it, not a
      self-check. Context: the 8 "Batch 3" charts (`njBZh`/`bJdyJ`/`X1rUb`/
      `shByA`/`Gj8Yd`/`9sKiZ`/`2r05c`/`VSLLb`) got title/description/notes
      fixes from a tracked-changes docx applied via a one-off script
      (`/private/tmp/apply-hormuz-edits.mjs` + follow-up wipe-bug-fix
      scripts) that called `patchMetadata()` directly – outside this
      skill's normal create/copy-then-publish flow, so the "always
      republish as the last step" rule (already documented, see the entry
      above from 2026-09-03) never got applied. Confirmed via `GET
      /v3/charts/{id}` on all 8: every chart's `lastModifiedAt` was minutes
      after its `publishedAt`. Republished all 8 through the browser
      (`/edit/<id>/publish` → Republish) and re-verified timestamps
      converged (a ~1s `lastModifiedAt`-after-`publishedAt` gap is normal –
      Datawrapper touches both fields within the same publish request, not
      a sign of stale content). Lesson generalized in the skill: the
      republish rule applies to *any* script that PATCHes an
      already-published chart's metadata, not just edits made through this
      skill's own steps – and when asked to confirm a batch is live, check
      `publishedAt` vs `lastModifiedAt` rather than assume a prior publish
      still covers it.

- [x] **`stack-color-legend` was wrongly forced `true` — should default
      `false`** – corrected 2026-09-08, live-testing a real chart (`KRN0n`,
      a stacked-bar sector breakdown). The pipeline (and this doc) had
      conflated two different fields: `categoryLabels.position` (the real
      direct-vs-legend switch) and `stack-color-legend` (a separate,
      cosmetic stacked-vs-flowing legend-layout toggle), assuming both
      needed to be `true` together. Isolated by toggling the "Stack
      labels" checkbox alone in the browser and diffing the chart's full
      metadata before/after — only `stack-color-legend` changed. Per the
      user, it should default `false` (flowing/wrapped legend) in most
      cases. Fixed in `create-datawrapper-pipeline.js` and documented in
      SKILL.md's "Rules baked into the code" section.
- [x] **Renaming a category/column label breaks its `color-category.map`
      key unless the map key is renamed too — and renaming a map key via
      `PATCH` doesn't remove the old one** – found and fixed 2026-09-08 on
      `KRN0n`. Someone had renamed 3 of 6 column headers in the chart's
      data ("Wholesale, retail & hotels" → "... and hotels", etc. — via
      Datawrapper's own `metadata.data.changes` edit-tracking) without
      updating `color-category.map`'s matching keys, which would have
      silently left those 3 series uncoloured (or default-coloured) once
      converted. Fixed by renaming the map keys to match. **Real gotcha
      hit while fixing it**: `PATCH`ing `color-category.map` with a
      renamed key (different property name) doesn't remove the old
      key — nested `visualize` objects deep-merge, so the old and new
      key both ended up in the map (9 keys instead of 6) until the old
      keys were explicitly set to `null` in a follow-up patch, which does
      delete them. **Not yet generalized into `to-web`** — this was a
      manual, chart-specific fix (comparing the map's keys against the
      real uploaded data's column headers via `GET /charts/{id}/data`,
      which needed a one-off `fetch` since `datawrapper-api.js` has no
      `getData` helper yet); worth automating a real-column-order-vs-map-
      keys consistency check if this recurs.
- [ ] **Non-country-group multi-category charts should get `SERIES_PALETTE`
      colours assigned in real data-column order, not left untouched** –
      found 2026-09-08 on `KRN0n` (6 sector categories, no country groups
      or year pairs involved). `to-web` today only recolours
      `color-category.map` for the country-group and year-pair cases —
      any other multi-category chart's colours pass through from the
      print source completely untouched. Per the user: "the colours
      should be un blue, un yellow, un dark blue, un dark yellow, un
      purple, un green if we have this many categories... for non country
      groups we should follow that logic" — i.e. `SERIES_PALETTE` (already
      defined in `datawrapper-constants.js`, already used by the
      from-CSV `create` path's `assignPalette()`) should also apply here,
      assigned in the **real uploaded-data column order** — confirmed
      distinct from `color-category.map`'s own key order, which can drift
      (see the entry above): the true order has to come from the chart's
      actual data (`GET /charts/{id}/data`), not the metadata map.
      Applied by hand this time (`Construction`→blue, `Wholesale, retail
      and hotels`→yellow, `Transport and telecoms`→dark blue, `Finance
      and insurance`→dark yellow, `Business services`→purple, `Other
      services`→green — the last two happened to already be right).
      **Deferred, not yet built into `to-web`**: needs (a) a new
      `getChartData()` helper in `datawrapper-api.js` (no such call
      exists yet), (b) a rule for what happens with fewer than 6 or more
      than `MAX_COLOURED_SERIES` (6) categories — `assignPalette()`
      already handles the `--other`/highlight/overflow cases for the
      from-CSV path, worth reusing rather than reimplementing, (c)
      deciding whether/how this interacts with a chart that already has
      an "Other"-style category (WARM_GREY rule) mixed in with regular
      ones. Ask for a second real example before generalizing further.
      **Second real confirmation, 2026-09-09, `HipZo`** (5 seaweed-product
      categories, "Food-grade seaweed"/"Non-food grade seaweed"/"Agar-agar"/
      "Carrageenan*"/"Alginic acid"): same rule applied by hand again, and
      this time it fixed a real visible bug as a side effect — "Alginic
      acid" had no colour of its own in `color-category.map` at all, so it
      silently rendered in the same colour as "Food-grade seaweed"
      (confirmed visually: identical legend swatch, and the two adjacent
      stacked segments visually merged into one in the chart itself). Also
      found 2 more orphaned map keys ("Food applications"/"Non-food
      applications") that matched nothing in the real data — same class of
      issue as the `KRN0n` key-rename entry above, different cause (never
      matched anything, not a post-hoc rename) — removed the same way (set
      to `null` in the patch). The rule now has two independent real
      confirmations; still not built into `to-web` itself (same blockers
      as before), but the "ask for a second example" bar has been met.
- [ ] **`normalizeSourceLine()` mishandles a `"<name> (<year>) analysis
      based on ..."` source shape** – found 2026-09-09 on `HipZo`. Input
      `"UNCTAD (2025) analysis based on UN Comtrade data for 2022"`
      produced `"UN Trade and Development (UNCTAD) based on (2025)
      analysis based on UN Comtrade data for 2022."` – a stray `(2025)`
      landing right after the prepended "based on", plus an effectively
      doubled "based on ... based on" (not literally identical strings, so
      the existing doubled-"based on" collapse regex doesn't catch it
      either). Root cause: the function's `^UNCTAD\b[.,]?\s*` strip only
      accounts for `UNCTAD` being followed by a comma/period or nothing,
      not by a parenthetical year – the remainder (`"(2025) analysis based
      on ..."`) doesn't itself start with "based on", so the function
      prepends a second one. Not fixed generically – exactly how to phrase
      an org+year citation is a judgment call (tried by hand here:
      `"UN Trade and Development (UNCTAD) (2025) analysis based on UN
      Comtrade data for 2022."`), not a mechanical transform safe to bake
      into the function without a couple more real examples of this shape.
- [ ] **`label-alignment` doesn't mean "value-label position" for every
      chart shape** – found 2026-09-09 on `HipZo`, a 100%-stacked
      horizontal bar chart with the two rows ("Trade share in volume"/
      "Trade share in value") as row categories on the y-axis. The
      existing bar-chart-family rule (`label-alignment: 'right'`, meant
      for "value labels sit to the right of their bar") does NOT apply
      here the way the field name suggests – toggling the Refine panel's
      "Alignment: Left/Right" control (which patches `label-alignment`)
      only moved the row-category labels ("Trade share in volume" text
      itself) left/right against the y-axis; it had no effect on the %
      value labels shown inside each stacked segment. Confirmed by
      toggling it live in the browser and screenshotting before/after –
      reverted back to `left` (the original value) since there was no
      real reason found to prefer right-aligned row labels, and blindly
      applying the existing rule here would have changed the wrong thing.
      **Not fixed in the pipeline** – `to-web`'s existing `label-alignment`
      rule stays as-is for the chart shapes it was actually confirmed
      against (real grouped-bar charts, `xxjf3`); this is a new caveat to
      check for, not a contradiction to resolve: on a 100%-stacked
      horizontal bar with row categories (rather than a category axis of
      bars), verify what "Alignment" actually moves before assuming it's
      the value-label rule from the grouped-bar case.
- [x] **Three more `HipZo` misses, found by the user after publish** –
      2026-09-09, all three now documented in SKILL.md's new "Preparing a
      chart directly" checklist:
      1. `language` was left at whatever the chart already had (`en-US`)
         instead of being set to `LOCALE` (`'en-CH'`) – only `to-web`'s own
         `patchMetadata` call sets this; driving a chart manually (not
         through `to-web`) has to do it explicitly too.
      2. The description still had bracketed unit shorthand –
         `"...by volume (kg) and value (USD), 2022"` – the user changed it
         to `"...by volume in kilograms and value in dollars, 2022"`.
         Generalizes the existing `%`/"GNI p.c." finding (see the
         multiple-columns caveat above) from axis/panel labels to
         description prose generally – but doesn't apply to a genuine
         citation parenthetical like `"(UNCTAD)"` or a year `"(2025)"`,
         only to bracketed unit/measure abbreviations.
      3. The user set `visualize.thick: true` – "as there are only two"
         [rows] – thick bars read better than the default thin ones when
         a chart has very few bars/rows and little else filling the plot.
         Judgment call, not automated (no fixed row-count threshold).
- [x] **First real `d3-scatter-plot` build, plus two more `classifyCountryGroup`
      /label-opening gaps** – 2026-09-09, `fqrFs` (PCI input-missing-rate vs.
      World Bank SPI index, 184 countries, no print source chart existed –
      built by copying an existing scatter chart, `ISjSH`, as a styling
      template per the brief's own suggested approach for untested chart
      types, then uploading new data). Full build notes now live in
      SKILL.md's new "Building a `d3-scatter-plot` chart" section
      (tooltip-variable-name gotcha, inherited-template-baggage caveat,
      percentage-vs-plain axis format, regression line has no auto equation
      text). Two real code fixes from this same chart:
      1. `classifyCountryGroup()` didn't recognise "Developing (excl.
         LDCs)" at all (only bare `/^developing$/i`) – would have left
         that whole group uncoloured. Fixed with a narrowly-scoped second
         pattern, not a general "starts with Developing" match.
      2. `buildCountryGroupLabelOverrides()` only opened up bare `ldc`/
         `sids` abbreviations, not a qualifier living inside an otherwise-
         fine "developing" name – the user's own edit expanded "Developing
         (excl. LDCs)" to "Developing (excluding LDCs)" in the legend.
         Fixed by spelling out an `excl.` substring in place when present,
         leaving bare "Developing" (no such substring) untouched.
      Both fixes verified against `classifyCountryGroup`/
      `buildCountryGroupLabelOverrides` directly, not just visually.

### Deferred, not built yet

- [ ] `lint` – fetch an existing chart, report it against the guidelines.
- [ ] `apply-settings` – apply just the section-3.1 settings to an
      existing draft.
- [ ] `publish` – the only command that would make anything public;
      `publishChart()` exists in `src/datawrapper-api.js` but is
      deliberately never called from any CLI command yet.
- [ ] `export` – PNG export via `GET /charts/{id}/export/png`;
      `exportChart()` exists but is unwired.
- [ ] Chart types beyond `d3-lines`/`column-chart`/`d3-bars` – e.g.
      `d3-scatter-plot`, `stacked-column-chart` as its own explicit type
      rather than just a `check` recommendation. The brief's suggested
      approach for these is `POST /charts/{id}/copy` from a manually
      pre-styled template chart, not guessing the metadata shape from
      scratch. `tmp/create_datawrapper_charts.py` (a real script from the
      UNCTAD media-intelligence project) covers `d3-scatter-plot` and
      `d3-maps-choropleth` (the latter n/a here – UNCTAD doesn't publish
      Datawrapper maps) and could inform the scatter-plot case.
- [ ] `--json` output on `create`/`check` – implemented, not yet checked
      against a real downstream consumer.
