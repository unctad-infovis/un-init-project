import fs from 'node:fs';
import { parse } from 'csv-parse/sync';

/**
 * Thematic_Taxonomy_List.txt is a one-column list with a header row
 * ("Existing Taxonomy Name").
 */
export function loadTaxonomyList(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(1); // drop header
}

/**
 * Suggest thematic taxonomy terms whose exact phrase appears (whole-word,
 * case-insensitive) in the document's title + extracted text. Publications
 * only (cer-how-to-prepare-and-log-publications.pdf step 7); sessional
 * documents skip taxonomy entirely per step 0 of
 * UNCTAD_PDF_Prep_Instructions.txt.
 *
 * This is intentionally a plain substring match, not a relevance model —
 * the guideline requires a human to apply taxonomy fields ("Do NOT complete
 * ... unless you are 100% clear"), so this only needs to produce a
 * reasonable candidate list for the user to confirm/prune, alphabetized per
 * the guideline's own instruction.
 */
export function suggestTaxonomyTerms(text, terms) {
  const matches = new Set();
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Lookaround, not \b: several terms themselves start/end with
    // non-word characters (e.g. "Generalized System of Preferences
    // (GSP)", "COVID-19") — \b only fires on a word/non-word transition,
    // so it silently fails to match a term like "(GSP)" sitting right
    // before a sentence-ending period (non-word next to non-word).
    const pattern = new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, 'i');
    if (pattern.test(text)) matches.add(term);
  }
  return [...matches].sort((a, b) => a.localeCompare(b));
}

/**
 * Angela's curated Product Taxonomy list for Sessional Documents
 * (data/Sessional_Document_Product_Taxonomy.txt, confirmed 2026-08-26) —
 * a much smaller, hand-picked subset of terms, each with its Drupal term
 * ID, distinct from the large general Thematic Taxonomy list above (which
 * is for Publications' Thematic Taxonomy field, a different vocabulary).
 * Guideline PDFs say skip taxonomy entirely on sessional documents; Angela
 * overrides that — Product Taxonomy specifically, from this list, does
 * apply. Format: one "Term Name (id)" per line, no header.
 */
export function loadSessionalProductTaxonomyList(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.*)\((\d+)\)$/);
      return match ? { name: match[1].trim(), id: match[2] } : { name: line, id: null };
    });
}

/**
 * Surface literal-substring candidate matches from Angela's curated
 * Sessional-Document Product Taxonomy list. Deliberately uncapped and
 * unranked — Angela: pick UP TO 5, never more, by actually reading the
 * document; narrowing this candidate list to the final ≤5 is a judgment
 * call, not something to truncate arbitrarily here (e.g. "first 5
 * alphabetically" would just as often drop the actually-relevant ones).
 */
export function suggestSessionalProductTaxonomy(text, terms) {
  const matches = [];
  for (const term of terms) {
    const escaped = term.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, 'i');
    if (pattern.test(text)) matches.push(term);
  }
  return matches;
}

/**
 * Count case-insensitive occurrences of `phrase` in `text`, matched as a
 * whole phrase with the same lookaround boundary rule as the other
 * suggest* functions here (not \b — several terms start/end with
 * punctuation, e.g. "Generalized System of Preferences (GSP)", see
 * suggestTaxonomyTerms' own comment).
 */
export function countMentions(text, phrase) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`(?<![a-zA-Z0-9])${escaped}(?![a-zA-Z0-9])`, 'gi');
  return (text.match(pattern) || []).length;
}

/**
 * Thematic candidates with a real mention count each — same source list
 * as `suggestTaxonomyTerms` (data/Thematic_Taxonomy_List.txt), but exposes
 * the count instead of collapsing to presence/absence, per the taxonomy
 * workflow documented in the /upload-documents skill: Thematic Taxonomy
 * terms have no ID in their source list, so the count is the only piece
 * of evidence shown alongside each candidate. Sorted alphabetically, per
 * the guideline's own instruction for this field.
 */
export function suggestThematicCandidatesWithCounts(text, terms) {
  return terms
    .map((name) => ({ name, mentions: countMentions(text, name) }))
    .filter((t) => t.mentions > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Load a Product/Sitemap taxonomy export (data/Product_Taxonomy.csv,
 * data/Sitemap_Taxonomy.csv — converted from the source .xlsx workbook's
 * Product/Sitemap sheets; columns: Term ID, Term name, Hierarchy role,
 * Parent names, Full hierarchy path(s)). Terms whose name contains "DO NOT
 * USE" are hierarchy-scaffolding placeholders, never valid tags themselves
 * — always excluded here rather than left for the caller to filter (the
 * exact bracket wording varies across the real workbook — "[DO NOT USE]",
 * "[PARENT DO NOT USE]", "[PARENT TERM - DO NOT USE]", "[PARENT - DO NOT
 * USE]" all appear — matched on the substring, not one exact phrase).
 */
export function loadProductOrSitemapTaxonomy(csvPath) {
  const records = parse(fs.readFileSync(csvPath, 'utf8'), { columns: true, skip_empty_lines: true });
  return records
    .filter((r) => !r['Term name'].includes('DO NOT USE'))
    .map((r) => ({
      id: r['Term ID'],
      name: r['Term name'],
      hierarchyRole: r['Hierarchy role'],
      parentNames: r['Parent names'],
      fullPath: r['Full hierarchy path(s)'],
    }));
}

/**
 * Candidate Product/Sitemap terms with a real mention count and Term ID
 * each, for the caller (a human, reading the actual document) to apply
 * the per-taxonomy judgment call documented in the /upload-documents
 * skill — this deliberately doesn't rank-and-cut or threshold anything
 * itself, since "how many mentions counts as a main area" depends on
 * document length and which of the two taxonomies is being judged
 * (Sitemap: stricter, page-placement; Product: real judgment, often
 * correctly "none"). Only terms with at least one mention are returned,
 * sorted by mention count descending — the caller still has to read the
 * document and each candidate's hierarchy context, not just take the top N.
 */
export function suggestProductOrSitemapCandidates(text, terms) {
  return terms
    .map((t) => ({ ...t, mentions: countMentions(text, t.name) }))
    .filter((t) => t.mentions > 0)
    .sort((a, b) => b.mentions - a.mentions);
}
