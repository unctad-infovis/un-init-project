import { parseSymbol, LANGUAGES } from './doc-naming.js';

/**
 * The cover page usually prints the symbol in the top-right corner before
 * any other text pdftotext -layout picks up. Used to cross-check the
 * symbol claimed in the gDoc2.0 email against what's actually in the file.
 */
export function extractSymbolFromPdfText(text) {
  const match = text.match(/\b(TD\/B[^\s]*|UNCTAD\/[^\s]*|[A-Z]+\/[A-Z0-9.()/-]+)\b/);
  if (match) return match[1];

  // Some cover/colophon page designs render a symbol's slashes with
  // surrounding whitespace in pdftotext's extracted output — e.g. a
  // wide-letter-spaced "UNCTAD / SDDS / INF / 2026 / 1" line — confirmed
  // 2026-09-14 on a real Publication (UNCTAD/SDDS/INF/2026/1, on its last
  // page). Requires at least two "/segment" groups (three segments total)
  // so this doesn't fire on an unrelated capitalized word that happens to
  // sit near an unrelated slash elsewhere on the page. Whitespace around
  // each slash is stripped from the result, so the returned symbol always
  // matches the tight form (buildFilenames etc.) expects.
  const spaced = text.match(/\b([A-Z]{2,})(?:\s*\/\s*[A-Z0-9.()-]+){2,}\b/);
  return spaced ? spaced[0].replace(/\s*\/\s*/g, '/') : null;
}

/**
 * Classify a document per the three CER guideline PDFs:
 * - Symbol starts UNCTAD/... -> Publication
 *   (cer-how-to-prepare-and-log-publications.pdf)
 * - Otherwise -> Sessional Document
 *   (cer-how-to-prepare-and-log-sessional-documents.pdf), which is marked
 *   Restricted when it's an English-only "[ADVANCE COPY]", carries
 *   "Distr.: Restricted", has a "/R." symbol segment, or is a Conference
 *   Room Paper ("/CRP.") — all four are listed as Restricted-document
 *   categories in cer-how-to-deal-with-restricted-documents.pdf.
 *
 * `pdfText` should be the extracted text of the (usually English) source
 * PDF — used both to detect the Restricted signals that don't show up in
 * the symbol alone, and to cross-check the email's claimed symbol.
 */
export function classifyDocument({ symbol, pdfText = '' }) {
  const parsed = parseSymbol(symbol);
  const documentType = parsed.kind === 'publication' ? 'Publication' : 'Sessional Document';

  const restrictedReasons = [];
  if (parsed.restricted) restrictedReasons.push('symbol has an /R. segment');
  if (parsed.crp) restrictedReasons.push('Conference Room Paper (/CRP.)');
  if (/\[?advance copy\]?/i.test(pdfText)) restrictedReasons.push('marked "Advance copy"');
  if (/Distr\.?\s*:?\s*Restricted/i.test(pdfText)) restrictedReasons.push('"Distr.: Restricted" on the cover page');

  const restricted = documentType === 'Sessional Document' && restrictedReasons.length > 0;

  const pdfSymbol = extractSymbolFromPdfText(pdfText);
  const symbolMismatch = pdfSymbol && pdfSymbol.replace(/[.,]$/, '') !== symbol.trim() ? pdfSymbol : null;

  return {
    documentType,
    restricted,
    crp: parsed.crp,
    restrictedReasons,
    // Sessional documents skip the cover JPG regardless of Restricted
    // status — step 0 of UNCTAD_PDF_Prep_Instructions.txt and both
    // sessional/restricted guideline PDFs are explicit about this. Taxonomy
    // is NOT a simple skip for sessional documents (see upload-pipeline.js)
    // — Angela confirmed (2026-08-26) that Product Taxonomy, from her own
    // small curated list, does apply to them; only Publications use the
    // large general Thematic Taxonomy list.
    skipCoverImage: documentType === 'Sessional Document',
    parsedSymbol: parsed,
    symbolMismatch, // non-null means the email's symbol and the PDF's own printed symbol disagree — surface, don't silently trust either
  };
}

// An "Advance copy" is Restricted only because the other language versions
// don't exist yet, per case (1) of cer-how-to-deal-with-restricted-
// documents.pdf ("As this is not always possible, UNCTAD will publish the
// original, English [ADVANCE COPY] as a 'Restricted Document'"). Once every
// language is actually filed, that justification is gone — confirmed
// against a real production example (TD/B/73/5: Restricted while
// English-only, unrestricted once the translated set arrived, per explicit
// user direction). This deliberately does NOT apply to a "/R." symbol or a
// Conference Room Paper — those are Restricted for reasons unrelated to
// translation completeness, and stay Restricted regardless of how many
// languages are attached.
const TRANSLATION_PENDING_REASONS = new Set(['marked "Advance copy"']);

/**
 * Re-check a Restricted classification once the actual set of collected
 * language files is known (the CLI only knows this after gathering
 * attachments, later than `classifyDocument` runs) and clear it if the
 * only reason was a now-resolved Advance-copy status.
 *
 * @param {ReturnType<typeof classifyDocument>} classification
 * @param {string[]} collectedLanguages
 */
export function reconcileRestrictedWithLanguages(classification, collectedLanguages) {
  if (!classification.restricted) return classification;
  if (!classification.restrictedReasons.every((r) => TRANSLATION_PENDING_REASONS.has(r))) return classification;

  const present = new Set(collectedLanguages);
  const allLanguagesPresent = LANGUAGES.every((lang) => present.has(lang));
  if (!allLanguagesPresent) return classification;

  return {
    ...classification,
    restricted: false,
    restrictedReasons: [],
    autoUnrestrictedNote: 'All 6 languages are attached, so the "Advance copy" justification for Restricted no longer applies — cleared automatically.',
  };
}
