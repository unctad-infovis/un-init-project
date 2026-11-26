# Taxonomy workflow: Thematic, Sitemap, Product

Standing process (2026-09-14), applies to **every content type**, not
just Publications — supersedes the older per-content-type rules that used
to live inline in `SKILL.md` (not reproduced here; treat this file as
current).

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
