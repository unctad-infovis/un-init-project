import { PDFDocument, PDFName, Duplex, PrintScaling, ReadingDirection } from 'pdf-lib';

// UNCTAD_PDF_Prep_Instructions.txt, step 2: author string depends on the
// language of the PDF, not the language of the caller.
export const AUTHOR_BY_LANGUAGE = {
  en: 'UN Trade and Development (UNCTAD)',
  fr: 'ONU commerce et développement (CNUCED)',
  es: 'ONU Comercio y Desarrollo (UNCTAD)',
  ar: 'UN Trade and Development (UNCTAD)',
  ch: 'UN Trade and Development (UNCTAD)',
  ru: 'UN Trade and Development (UNCTAD)',
};

// RFC 3066 tags for the PDF's /Lang field. Note this is distinct from the
// "ch" used in filenames/URLs for Chinese (an UNCTAD-specific convention,
// not a real language tag) — the /Lang field needs the real tag "zh".
const LANGUAGE_TAGS = { en: 'en', fr: 'fr', es: 'es', ar: 'ar', ch: 'zh', ru: 'ru' };

// Reading Options > Binding in Acrobat's Document Properties dialog (the
// PDF's /Direction viewer preference). Arabic is the only RTL language of
// our 6 — everything else is L2R (pdf-lib's own default when unset), but
// set it explicitly for every language so it's never left to chance.
const RTL_LANGUAGES = new Set(['ar']);

/**
 * Apply the UNCTAD PDF metadata + viewer-preference conventions
 * (UNCTAD_PDF_Prep_Instructions.txt) to one language file's bytes.
 *
 * @param {Uint8Array} pdfBytes
 * @param {object} opts
 * @param {'en'|'fr'|'es'|'ar'|'ch'|'ru'} opts.lang
 * @param {string} opts.title - exact title text for this language (never translated by this tool)
 * @param {string[]} [opts.keywords] - defaults to [title], matching observed real-world practice
 * @param {boolean} [opts.bookmarks] - true for publications >100 pages that carry chapter bookmarks;
 *   changes the Navigation tab from "Page Only" to "Bookmarks Panel and Page"
 *   per step 7 of cer-how-to-prepare-and-log-publications.pdf
 * @returns {Promise<Uint8Array>}
 */
export async function applyPdfMetadata(pdfBytes, { lang, title, keywords, bookmarks = false }) {
  if (!AUTHOR_BY_LANGUAGE[lang]) {
    throw new Error(`Unknown language code "${lang}" — expected one of ${Object.keys(AUTHOR_BY_LANGUAGE).join(', ')}`);
  }

  // updateMetadata: false — pdf-lib otherwise stamps Producer/Creator with
  // its own name on load. Real Angela-edited files keep the original
  // Producer/Creator (e.g. "Microsoft® Word for Microsoft 365"); Acrobat's
  // "Document Properties > Description" tab, which is what the guideline
  // screenshots show, only ever touches Title/Author/Subject/Keywords.
  const doc = await PDFDocument.load(pdfBytes, { updateMetadata: false });

  doc.setTitle(title);
  doc.setAuthor(AUTHOR_BY_LANGUAGE[lang]);
  doc.setSubject(title);
  doc.setKeywords(keywords && keywords.length ? keywords : [title]);
  doc.setLanguage(LANGUAGE_TAGS[lang]);
  doc.setModificationDate(new Date());

  // Printing dialogue presets: "Default" print scaling + "Duplex flip long edge"
  const viewerPrefs = doc.catalog.getOrCreateViewerPreferences();
  viewerPrefs.setDuplex(Duplex.DuplexFlipLongEdge);
  viewerPrefs.setPrintScaling(PrintScaling.AppDefault);
  viewerPrefs.setCenterWindow(true);
  viewerPrefs.setReadingDirection(RTL_LANGUAGES.has(lang) ? ReadingDirection.R2L : ReadingDirection.L2R);

  // Initial View: Single Page layout, Fit Page magnification, open to page 1.
  doc.catalog.set(PDFName.of('PageLayout'), PDFName.of('SinglePage'));
  doc.catalog.set(PDFName.of('PageMode'), PDFName.of(bookmarks ? 'UseOutlines' : 'UseNone'));

  const [firstPage] = doc.getPages();
  if (firstPage) {
    const openAction = doc.context.obj([firstPage.ref, PDFName.of('Fit')]);
    doc.catalog.set(PDFName.of('OpenAction'), openAction);
  }

  return doc.save();
}
