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

  // Strip any XMP metadata stream. Real UN document PDFs (Word exports)
  // commonly already carry one with the translator's own Word "Author" and
  // a Title the translator typed (sometimes just the symbol, sometimes
  // nothing at all) — and Ghostscript's pdfwrite device, which
  // compressPdf() always runs before this function, re-serializes that
  // same stale packet into its rewritten output rather than dropping it.
  // Confirmed real bug, 2026-09-15, TD/B/73/L.3: Acrobat
  // prefers XMP dc:title/dc:creator over the classic /Info Title/Author
  // whenever both are present, so the stale XMP (translator's name as
  // Author, the bare symbol or even a literal "'Untitled'" placeholder as
  // Title) silently shadowed the correct values this function had just
  // written — Subject/Keywords only looked correct in that incident
  // because the stale XMP happened to carry no dc:description. Deleting
  // /Metadata here makes the /Info dictionary this function writes the
  // only source a viewer can read from, avoiding the whole class of
  // "shows old data" bugs rather than trying to keep a second metadata
  // representation in sync.
  //
  // Deleting the catalog key alone isn't enough: pdf-lib's writer
  // serializes every object still registered in the document's context
  // regardless of whether anything references it, so the orphaned XMP
  // stream's raw bytes — including the translator's real name — would
  // otherwise survive, unreadable to a compliant viewer but still sitting
  // in the file. Look the object up first and delete it from the context
  // itself so the bytes are actually gone, not just unlinked.
  const metadataRef = doc.catalog.get(PDFName.of('Metadata'));
  doc.catalog.delete(PDFName.of('Metadata'));
  if (metadataRef) doc.context.delete(metadataRef);

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
