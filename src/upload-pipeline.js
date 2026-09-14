import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { parseGdocEmail } from './gdoc-email.js';
import { parseEml } from './eml.js';
import { classifyDocument, reconcileRestrictedWithLanguages, extractSymbolFromPdfText } from './doc-classify.js';
import { buildFilenames, buildFolderPath } from './doc-naming.js';
import { extractSessionalTitle } from './title-extract.js';
import { applyPdfMetadata } from './pdf-metadata.js';
import { compressPdf } from './pdf-compress.js';
import { generateCoverImage } from './cover-image.js';
import { loadTaxonomyList, suggestTaxonomyTerms, loadSessionalProductTaxonomyList, suggestSessionalProductTaxonomy } from './taxonomy.js';
import { resolveDestinationFolder, fileDocuments, findExistingWorkingPartyFolder, MASTER_DOCS_ROOT } from './onedrive-filing.js';

const TAXONOMY_LIST_PATH = path.resolve(import.meta.dirname, '../data/Thematic_Taxonomy_List.txt');
const SESSIONAL_PRODUCT_TAXONOMY_PATH = path.resolve(import.meta.dirname, '../data/Sessional_Document_Product_Taxonomy.txt');

// gDoc2.0 final-documents zips name each language file
// "<requestNumber><LetterCode>.pdf" (e.g. request R2609890 -> "2609890E.pdf").
const GDOC_LETTER_TO_LANG = { E: 'en', F: 'fr', S: 'es', A: 'ar', C: 'ch', R: 'ru' };

const LANG_WORD_TO_CODE = {
  English: 'en', Français: 'fr', Francais: 'fr', Español: 'es', Espanol: 'es',
  Arabic: 'ar', Chinese: 'ch', Russian: 'ru',
};

// Arabic (and other RTL) cover pages wrap words in Unicode bidi control
// characters (LRM/RLM, LRE/RLE/PDF/LRO/RLO, LRI/RLI/FSI/PDI) that pdftotext
// preserves — invisible on screen, but they break a plain .endsWith() check
// since the line doesn't actually end with the bare word. Built from code
// points, not a regex literal, so the invisible characters themselves never
// have to appear (or survive being copy-pasted/edited) in this source file.
const BIDI_CODEPOINTS = [0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069];
const BIDI_CONTROL_CHARS = new RegExp(`[${BIDI_CODEPOINTS.map((c) => String.fromCodePoint(c)).join('')}]`, 'g');

/** A user-facing failure (bad/missing input) — the caller should print `.message` plainly, no stack trace. */
export class UploadPipelineError extends Error {}

function pdfText(filePath) {
  return execFileSync('pdftotext', ['-layout', filePath, '-'], { encoding: 'utf8' });
}

function detectLanguageFromFilename(filePath) {
  const base = path.basename(filePath, path.extname(filePath));
  const letter = base.match(/([EFSACR])$/)?.[1];
  return letter ? GDOC_LETTER_TO_LANG[letter] : null;
}

function detectLanguageFromPdfText(text) {
  // The cover page's masthead is two columns (org name on the left,
  // Distr./date/language on the right); pdftotext -layout renders both on
  // the same physical line, so the language word sits at the END of a line
  // like "sur le commerce                               Français", not
  // alone on its own line — checking the whole line for equality misses
  // every language except when the left column happens to be empty.
  const lines = text.split(/\r?\n/).map((l) => l.replace(BIDI_CONTROL_CHARS, '').trim());
  for (const line of lines.slice(0, 15)) {
    const word = Object.keys(LANG_WORD_TO_CODE).find((w) => line.endsWith(w));
    if (word) return LANG_WORD_TO_CODE[word];
  }
  return null;
}

function extractAgendaItem(text) {
  const match = text.match(/Item\s+([\d]+(?:\s*\([a-z]\))?)\s+of the provisional agenda/i);
  return match ? match[1].trim() : null;
}

function extractYear(text) {
  const match = text.match(/\b(20\d{2})\b/);
  return match ? match[1] : null;
}

/**
 * Read the email, whichever form it comes in: a plain forwarded-text file
 * (the historical gDoc2.0 case), or a real Outlook `.eml` export — which
 * also carries the actual zip/PDF as a MIME attachment, so the caller can
 * skip passing an attachment path separately.
 */
function loadEmail(emailPath) {
  if (emailPath.toLowerCase().endsWith('.eml')) {
    const eml = parseEml(emailPath);
    return { bodyText: eml.bodyText || '', subject: eml.subject, emlAttachments: eml.attachments };
  }
  return { bodyText: fs.readFileSync(emailPath, 'utf8'), subject: null, emlAttachments: [] };
}

/**
 * Pick which .eml attachment to use when more than one is present (e.g. a
 * gDoc2.0 zip typically pairs each language's .pdf with a matching .docx,
 * and a forward can also carry an inline image). Only .pdf/.zip are
 * actually processable downstream (collectAttachments pdftotext's
 * whatever this returns), so those are strictly preferred over anything
 * else — including a .docx that happens to match the request number too.
 */
function chooseEmlAttachment(emlAttachments, requestId) {
  const isProcessable = (a) => /\.(pdf|zip)$/i.test(a.filename);
  const requestDigits = requestId?.replace(/^R/i, '');

  const byRequestAndType = requestDigits && emlAttachments.find((a) => a.filename.includes(requestDigits) && isProcessable(a));
  if (byRequestAndType) return byRequestAndType;

  const byRequest = requestDigits && emlAttachments.find((a) => a.filename.includes(requestDigits));
  if (byRequest) return byRequest;

  return emlAttachments.find(isProcessable) || emlAttachments[0];
}

/** Collect one PDF per language from a zip, directory, or single file. */
function collectAttachments(attachmentPath) {
  const stat = fs.statSync(attachmentPath);
  let files = [];

  if (attachmentPath.endsWith('.zip')) {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'un-upload-documents-zip-'));
    execFileSync('unzip', ['-o', '-q', attachmentPath, '-d', tmpDir]);
    files = fs.readdirSync(tmpDir).filter((f) => f.toLowerCase().endsWith('.pdf')).map((f) => path.join(tmpDir, f));
  } else if (stat.isDirectory()) {
    files = fs.readdirSync(attachmentPath).filter((f) => f.toLowerCase().endsWith('.pdf')).map((f) => path.join(attachmentPath, f));
  } else {
    files = [attachmentPath];
  }

  if (files.length === 0) {
    throw new UploadPipelineError(`No PDF files found in "${attachmentPath}".`);
  }

  const attachments = files.map((filePath) => {
    const lang = detectLanguageFromFilename(filePath) || detectLanguageFromPdfText(pdfText(filePath)) || 'en';
    return { lang, sourcePath: filePath };
  });

  // Two attachments resolving to the same language (most likely: language
  // detection failed on one of them and both landed on the 'en' default)
  // would silently overwrite each other's staged output later — same
  // target filename, one write clobbering the other before OneDrive's own
  // overwrite protection ever gets a say. Fail loudly instead.
  const seen = new Map();
  for (const { lang, sourcePath } of attachments) {
    if (seen.has(lang)) {
      throw new UploadPipelineError(
        `Both "${seen.get(lang)}" and "${sourcePath}" were detected as language "${lang}" — language detection likely failed on one of them. Resolve manually (rename the file so it ends in the gDoc2.0 letter suffix, e.g. "...F.pdf" for French) and retry.`,
      );
    }
    seen.set(lang, sourcePath);
  }

  return attachments;
}

/**
 * Run the full deterministic pipeline for one document: parse the email,
 * classify the document, compute names/folder, edit PDF metadata for
 * EN/FR/ES, generate publication extras, and (unless `dryRun`) file
 * everything under OneDrive. Returns the manifest; throws
 * `UploadPipelineError` for expected input problems (no attachment, no
 * symbol, etc.) and lets any other error propagate as a real bug.
 *
 * @param {object} options
 * @param {string} options.emailPath
 * @param {string} [options.attachmentPath]
 * @param {string} [options.outDir] - defaults to a fresh temp dir
 * @param {string} [options.root] - OneDrive root override, defaults to the real location
 * @param {boolean} [options.dryRun]
 */
export async function runUploadPipeline({ emailPath, attachmentPath, outDir, root, dryRun = false }) {
  const { bodyText, subject, emlAttachments } = loadEmail(emailPath);
  const email = parseGdocEmail(bodyText, { subject });

  // gDoc2.0's own "issued"/"registered" wording turned out not to be a
  // reliable actionability signal in practice — per explicit user
  // direction, this tool is only ever run when there's already real
  // content to push, so the only thing that actually matters is whether a
  // real attachment exists. `email.status` is kept in the manifest for
  // context but no longer gates anything.
  const hasDirectAttachment = Boolean(attachmentPath) || emlAttachments.length > 0;
  if (!hasDirectAttachment) {
    throw new UploadPipelineError('No attachment given, and the email itself has no attachment to fall back to — nothing to act on.');
  }

  const notes = [];
  if (email.note) notes.push({ type: 'forwarder-note', text: email.note });

  let resolvedAttachmentPath = attachmentPath;
  if (!resolvedAttachmentPath) {
    const chosen = chooseEmlAttachment(emlAttachments, email.requestId);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'un-upload-documents-eml-'));
    resolvedAttachmentPath = path.join(tmpDir, chosen.filename);
    fs.writeFileSync(resolvedAttachmentPath, chosen.buffer);
    notes.push({ type: 'extracted-attachment', filename: chosen.filename, bytes: chosen.buffer.length });
  }

  const attachments = collectAttachments(resolvedAttachmentPath);
  const enAttachment = attachments.find((a) => a.lang === 'en') ?? attachments[0];
  const enText = pdfText(enAttachment.sourcePath);

  // Confirmed 2026-09-07, a real case: not every real document request
  // arrives as a gDoc2.0-template email — a DMS/Docsubmission staff member
  // forwarding a document directly (free-text subject/body, no "Issued:
  // R<n> - ..." shape) leaves `parseGdocEmail()` unable to find a symbol
  // in the body or subject at all, even though the attached PDF's own
  // cover page states it in plain text. Falling back to the PDF text
  // (reusing the same extractor already used for symbol-mismatch checking)
  // means this tool still works for that real, recurring input shape
  // instead of giving up before ever reading the attachment.
  const symbol = email.symbol || extractSymbolFromPdfText(enText);
  if (!symbol) {
    // Per the user: documents without an assigned UN symbol aren't this
    // tool's job — divisions upload those themselves, or the request
    // should be pushed back to the originating division.
    throw new UploadPipelineError('No UN symbol found in the email or the PDF\'s own cover page — this tool only handles documents with an assigned symbol. Push this back to the originating division rather than logging it here.');
  }
  if (!email.symbol) {
    notes.push({ type: 'symbol-from-pdf', text: `Email had no symbol; recovered "${symbol}" from the PDF's own cover page.` });
  }

  const classification = reconcileRestrictedWithLanguages(
    classifyDocument({ symbol, pdfText: enText }),
    attachments.map((a) => a.lang),
  );
  const { parsed, names } = buildFilenames(symbol, attachments.map((a) => a.lang));
  const year = extractYear(enText);
  let folderPath = buildFolderPath(symbol, { year, title: email.title });
  // Working-party item folders carry a human label (e.g. "343 (Review of
  // the technical cooperation activities)") that isn't derivable from the
  // symbol — but for an item (or, since 2026-09-07, a session number —
  // same folder-naming scheme, same lookup) already filed before (a fresh
  // Add./Corr./Rev., a resubmission, or another CRP for the same session),
  // the real folder already exists on disk and can be found rather than
  // guessed. Zero or multiple matches still fall through to "ask"
  // (folderPath stays null).
  if (!folderPath && (parsed.kind === 'board-working-party' || parsed.kind === 'board-working-party-session')) {
    const folderNum = parsed.kind === 'board-working-party' ? parsed.itemNum : parsed.sessionNum;
    if (folderNum) folderPath = findExistingWorkingPartyFolder(folderNum, { root: root || MASTER_DOCS_ROOT });
  }
  const agendaItem = extractAgendaItem(enText);

  const warnings = [];
  if (classification.autoUnrestrictedNote) warnings.push(classification.autoUnrestrictedNote);
  if (classification.symbolMismatch) warnings.push(`Email claims symbol "${email.symbol}" but the PDF's own cover page shows "${classification.symbolMismatch}" — verify before proceeding.`);
  if (parsed.confidence !== 'high') warnings.push(`Filename convention for this symbol shape ("${parsed.kind}") isn't well-evidenced against real OneDrive examples — double-check "${parsed.base}" before filing.`);
  if (!folderPath) warnings.push('Could not determine an OneDrive destination folder automatically — resolve manually before filing.');

  const resolvedOutDir = outDir || fs.mkdtempSync(path.join(os.tmpdir(), 'un-upload-documents-'));
  fs.mkdirSync(resolvedOutDir, { recursive: true });

  const languages = [];
  for (const { lang, sourcePath } of attachments) {
    const text = sourcePath === enAttachment.sourcePath ? enText : pdfText(sourcePath);
    const extractedTitle = ['en', 'fr', 'es'].includes(lang)
      ? (lang === 'en' ? email.title : extractSessionalTitle(text))
      : null;

    const renamedFilename = `${names[lang]}.pdf`;
    let stagedPath = null;
    let compression = null;
    if (extractedTitle) {
      const bytes = fs.readFileSync(sourcePath);
      // Compress before editing metadata, never after — Ghostscript
      // regenerates the PDF from scratch and always overwrites /Producer
      // and /Creator with its own signature, which would otherwise get
      // preserved (and so silently replace the real original) by
      // applyPdfMetadata's own `updateMetadata: false`. See pdf-compress.js
      // — also see its ColorConversionStrategy note: a real content-loss
      // bug (an entire gradient-filled cover panel silently dropped by
      // Ghostscript) was found and fixed here 2026-09-14, confirmed across
      // a full real 112-page document before re-enabling this call.
      const compressed = await compressPdf(bytes, { quality: 'ebook' });
      compression = { originalSize: compressed.originalSize, compressedSize: compressed.compressedSize, skipped: compressed.skipped };
      const edited = await applyPdfMetadata(compressed.bytes, { lang, title: extractedTitle });
      stagedPath = path.join(resolvedOutDir, renamedFilename);
      fs.writeFileSync(stagedPath, edited);
    } else {
      warnings.push(`No confirmed title for "${lang}" — PDF metadata not auto-applied; review the text excerpt and finish manually.`);
    }

    languages.push({
      lang,
      sourcePath,
      renamedFilename,
      extractedTitle,
      stagedPath,
      compression,
      textExcerpt: text.slice(0, 700),
    });
  }

  // Cover image: publications only.
  let coverImagePath = null;
  if (!classification.skipCoverImage) {
    coverImagePath = path.join(resolvedOutDir, `${parsed.base}_en_cover.jpg`);
    generateCoverImage(enAttachment.sourcePath, coverImagePath);
  }

  // Taxonomy: two entirely different vocabularies depending on document
  // type, per Angela (2026-08-26). Publications use the large general
  // Thematic Taxonomy list, unranked/uncapped. Sessional documents use her
  // own small curated Product Taxonomy list (with Drupal term IDs) — the
  // guideline PDFs say skip taxonomy on sessional documents entirely, but
  // she overrode that specifically for Product Taxonomy. Either way these
  // are *candidates* only: literal-substring matches are a weak signal at
  // best (especially against the sessional list's compound term names) —
  // the skill must actually read the document and pick, never auto-apply.
  let taxonomySuggestions = null;
  let sessionalProductTaxonomy = null;
  if (classification.documentType === 'Publication') {
    const terms = loadTaxonomyList(TAXONOMY_LIST_PATH);
    taxonomySuggestions = suggestTaxonomyTerms(`${email.title ?? ''}\n${enText}`, terms);
  } else if (classification.documentType === 'Sessional Document') {
    const terms = loadSessionalProductTaxonomyList(SESSIONAL_PRODUCT_TAXONOMY_PATH);
    sessionalProductTaxonomy = {
      fullList: terms, // always surfaced — the candidate matches below are a weak hint, not a substitute for reading the list
      candidates: suggestSessionalProductTaxonomy(`${email.title ?? ''}\n${enText}`, terms),
      maxSelectable: 5, // Angela: up to 5, never more
    };
  }

  // OneDrive filing is deliberately the very last step: every PDF above is
  // already metadata-edited and staged before anything gets copied there.
  let filingResults = null;
  if (!dryRun && folderPath) {
    const { path: destFolder, created } = resolveDestinationFolder(folderPath, { root: root || MASTER_DOCS_ROOT });
    const filesToCopy = languages
      .filter((l) => l.stagedPath)
      .map((l) => ({ sourcePath: l.stagedPath, targetName: l.renamedFilename }));
    filingResults = { destFolder, created, copies: fileDocuments(destFolder, filesToCopy) };
  }

  return {
    requestId: email.requestId,
    email,
    // Faithful record of what the email itself literally stated is kept
    // under `email.symbol` (possibly null); `resolvedSymbol` is what the
    // rest of this pipeline actually used — the email's own symbol when
    // present, otherwise the one recovered from the PDF's cover page (see
    // the `symbol-from-pdf` note above when that happened).
    resolvedSymbol: symbol,
    classification,
    naming: { base: parsed.base, kind: parsed.kind, confidence: parsed.confidence, folderPath },
    year,
    agendaItem,
    languages,
    copyPasteText: {
      symbol,
      agendaItem,
      en: languages.find((l) => l.lang === 'en')?.extractedTitle ?? null,
      fr: languages.find((l) => l.lang === 'fr')?.extractedTitle ?? null,
      es: languages.find((l) => l.lang === 'es')?.extractedTitle ?? null,
    },
    coverImagePath,
    taxonomySuggestions,
    sessionalProductTaxonomy,
    destinationFolder: folderPath,
    filingResults,
    warnings,
    notes,
    outDir: resolvedOutDir,
  };
}
