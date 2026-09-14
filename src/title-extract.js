// Best-effort title extraction for EN/FR/ES sessional documents, which is
// all the guideline actually asks for (cer-how-to-prepare-and-log-sessional-
// documents.pdf step 7: "copy-paste text ... for the titles in English,
// French, and Spanish" — AR/CH/RU are explicitly not required, and are
// skipped here too since word-boundary/line-wrap heuristics don't
// generalize to those scripts).
//
// UN sessional document cover pages consistently place the title between
// the agenda-item line ("Item N of the provisional agenda" / "Point N de
// l'ordre du jour provisoire" / "Tema N del programa provisional", or
// "Other business" / "Questions diverses" / "Otros asuntos") and the
// "Note by the UNCTAD secretariat" line (or its FR/ES equivalent),
// separated by blank lines in pdftotext -layout output. Verified against
// five real documents (TD/B/73/1 EN, TD/B/73/5 EN/FR/ES).
const NOTE_MARKER = /Note by the UNCTAD secretariat|Note du secr[ée]tariat de la CNUCED|Nota de la secretar[íi]a de la UNCTAD/i;

/**
 * @param {string} pdfText - pdftotext -layout output for one language file
 * @returns {string|null} the extracted title, or null if the "Note by..."
 *   anchor wasn't found (e.g. non-sessional documents, or a cover page that
 *   doesn't follow the standard template — caller should fall back to
 *   surfacing the raw text excerpt for a human/AI to read instead).
 */
export function extractSessionalTitle(pdfText) {
  const lines = pdfText.split(/\r?\n/);
  const noteIdx = lines.findIndex((line) => NOTE_MARKER.test(line));
  if (noteIdx === -1) return null;

  let i = noteIdx - 1;
  while (i >= 0 && lines[i].trim() === '') i--;

  const titleLines = [];
  while (i >= 0 && lines[i].trim() !== '') {
    titleLines.unshift(lines[i].trim());
    i--;
  }
  if (titleLines.length === 0) return null;

  return titleLines.join(' ').replace(/\s+/g, ' ').trim();
}
