// File-naming and OneDrive-foldering rules for UNCTAD document symbols.
//
// File naming: confirmed directly by Angela (2026-08-26, in response to the
// underscore question) — follow the written guideline exactly, a single
// underscore only before the language suffix, nowhere else, even though
// her own real files on OneDrive have been inconsistent about this (e.g.
// "tdb73_d5_en.pdf" for TD/B/73/5, with an extra underscore). Going
// forward this tool follows the guideline, not that past practice:
//
//   TD/B/WP/212             -> wpd212_en.pdf         (Angela's own example)
//   TD/B(S-XXXI)/1          -> tdsxxxid1_en.pdf      (Angela's own example)
//   TD/B/56/1               -> tdb56d1_en.pdf        (Angela's own example)
//   TD/B/73/5               -> tdb73d5_en.pdf
//   TD/B/71/R.1             -> tdb71r1_en.pdf
//   TD/B/71/L.1             -> tdb71l1_en.pdf
//   TD/B/71/CRP.1           -> tdb71crp1_en.pdf
//   TD/B/WP(91)/CRP.1       -> wp91crp1_en.pdf      (WP session-parenthesized — see below;
//                                                     NOT the EX(nn) convention despite the
//                                                     visual resemblance)
//   TD/B/EX(70)/R.1         -> tdbex70r1_en.pdf
//   TD/B(S-XXXI)/INF/1      -> tdsxxxiinf1_en.pdf
//   TD/B/C.I/CLP/5          -> c1clpd5_en.pdf        (no "TD/B/" prefix — see commission handling below)
//   UNCTAD/DITC/TED/2015/6  -> ditcted2015d6_en.pdf  (no "UNCTAD/" prefix)
//
// Add./Corr./Rev. compound suffixes: confirmed 2026-09-04 for the
// board-working-party shape specifically, against real OneDrive files
// (TD_B_WP (Working Party)/343 (.../wpd343_en.pdf, wpd343add1_en.pdf) and
// .../325 (.../wpd325add1_en.pdf, wpd325add2_en.pdf) — the suffix is just
// appended directly after the item number, lowercase, no separator:
//   TD/B/WP/343/Add.2       -> wpd343add2_en.pdf
// Still not evidenced for any other symbol shape (e.g. "TD/B/73/5/Add.1")
// — Angela's reply listed these as valid UNCTAD symbol suffixes generally,
// but gave no filename example outside the WP case above. Ask for a real
// example before extending this to board-regular/board-commission/etc.;
// see TODO.md.
//
// Working Party, session-parenthesized: TD/B/WP(<n>)/<item> — confirmed
// 2026-09-07 against a real document (TD/B/WP(91)/CRP.1, a Conference Room
// Paper) and real OneDrive precedent (TD_B_WP (Working Party)/84 (October
// 2022)/wp84crp1_en.pdf, .../88 (August 2024)/CRP-1/wp88crp1_en.pdf,
// .../90 (January 2026)/CRP-2/wp90crp2_en.pdf). This shape superficially
// resembles EX(nn) — a parenthesized number right after the body code —
// but is NOT that convention: EX(nn) keeps the "tdb" prefix because it's
// still the Board itself, just addressed by a different session format;
// WP(<n>) drops "TD/B/" entirely, exactly like the plain WP/<item> branch
// above, because the Working Party is its own subsidiary body — the
// parenthesized number here is just how *that body's* session count is
// written, unrelated to why EX keeps "tdb". Only the CRP item-type is
// evidenced by the real files above; a plain/R/L item under a WP(<n>)
// session has zero real precedent, hence the reduced confidence below.
//
// LANGUAGES intentionally spells out "ch" for Chinese, per explicit
// instruction in UNCTAD_PDF_Prep_Instructions.txt ("For Chinese, use 'ch'
// NOT 'zh'").
export const LANGUAGES = ['en', 'fr', 'es', 'ar', 'ch', 'ru'];

// Committee-I "MEM" (Multi-year Expert Meeting) series folders — real
// OneDrive structure confirmed 2026-09-01 for TD/B/C.I/MEM.2/67:
//   TD_B_CI_MEM (Trade and Development)/MEM-2 (Commodities and Development)/67 (Agenda)
// Only series 2 and the "Agenda" category are confirmed so far. Any other
// series number, or a title that doesn't obviously read as an agenda
// document, isn't guessed here — buildFolderPath() falls back to null
// (ask) exactly like the unconfirmed board-commission shapes below.
const MEM_SERIES_TOPICS = { 2: 'Commodities and Development' };

/** Best-effort document-category label for the final MEM folder segment, from the title. Returns null (ask, don't guess) when unconfirmed. */
function guessMemDocCategory(title) {
  if (/agenda/i.test(title ?? '')) return 'Agenda';
  return null;
}

const ROMAN = '[IVXLCDM]+';

function cleanSegment(seg) {
  return seg.replace(/[^a-zA-Z0-9]/g, '');
}

/** Detect the item type (d/r/l/crp) from the last symbol segment. */
function classifyItemSegment(seg) {
  const crp = seg.match(/^CRP\.?(\d+)/i);
  if (crp) return { type: 'crp', num: crp[1] };

  const restricted = seg.match(/^R\.?(\d+)/i);
  if (restricted) return { type: 'r', num: restricted[1] };

  const limited = seg.match(/^L\.?(\d+)/i);
  if (limited) return { type: 'l', num: limited[1] };

  return { type: 'd', num: cleanSegment(seg) };
}

/** Detect a trailing Add./Corr./Rev. compound suffix (e.g. "Add.2" -> "add2"). Returns '' when the segment isn't one of these. */
function classifySuffixSegment(seg) {
  const add = seg?.match(/^Add\.?(\d+)$/i);
  if (add) return `add${add[1]}`;
  const corr = seg?.match(/^Corr\.?(\d+)$/i);
  if (corr) return `corr${corr[1]}`;
  const rev = seg?.match(/^Rev\.?(\d+)$/i);
  if (rev) return `rev${rev[1]}`;
  return '';
}

/**
 * Parse a UN symbol into a structured description of how to build its
 * filename base (without language suffix) and, where evidenced, its
 * OneDrive folder path. `confidence: 'low'` means the shape wasn't directly
 * verified against a real file and should be treated as a best-effort guess.
 */
export function parseSymbol(symbol) {
  const raw = symbol.trim();
  const segments = raw.split('/').map((s) => s.trim()).filter(Boolean);

  // Publications: UNCTAD/[Division]/[Branch .../ ]<Year>/<Number>
  if (segments[0]?.toUpperCase() === 'UNCTAD') {
    const rest = segments.slice(1).map(cleanSegment);
    const last = rest.pop();
    const base = `${rest.join('').toLowerCase()}d${last.toLowerCase()}`;
    return {
      raw,
      kind: 'publication',
      restricted: false,
      crp: false,
      base,
      confidence: 'high',
      division: segments[1] ?? null,
      branch: segments.length > 3 ? segments[2] : null,
      folderYear: segments[segments.length - 2] ?? null,
      folderNumber: segments[segments.length - 1] ?? null,
    };
  }

  if (segments[0]?.toUpperCase() !== 'TD') {
    // A/, E/, ST/ and other UN-body symbols aren't covered by the CER
    // guidelines at all — best-effort generic fallback, flagged low.
    const cleaned = segments.map(cleanSegment);
    const last = cleaned.pop();
    return {
      raw,
      kind: 'other',
      restricted: false,
      crp: false,
      base: `${cleaned.join('').toLowerCase()}d${last.toLowerCase()}`,
      confidence: 'low',
    };
  }

  // Special session: TD/B(S-XXXV)/<item> or TD/B(S-XXXV)/INF/<item>
  const specialSession = segments[1]?.match(new RegExp(`^B\\(S-(${ROMAN})\\)$`, 'i'));
  if (specialSession) {
    const roman = specialSession[1].toLowerCase();
    const rest = segments.slice(2);
    if (rest[0]?.toUpperCase() === 'INF') {
      const num = cleanSegment(rest[1] ?? '');
      return {
        raw,
        kind: 'board-special-session',
        restricted: false,
        crp: false,
        base: `tds${roman}inf${num}`,
        confidence: 'high',
      };
    }
    const item = classifyItemSegment(rest[0] ?? '');
    return {
      raw,
      kind: 'board-special-session',
      restricted: item.type === 'r',
      crp: item.type === 'crp',
      base: `tds${roman}${item.type}${item.num}`,
      confidence: 'high',
      sessionLabel: `S-${specialSession[1]}`,
    };
  }

  // Everything else lives under TD/B/...
  if (segments[1]?.toUpperCase() !== 'B') {
    const cleaned = segments.map(cleanSegment);
    const last = cleaned.pop();
    return {
      raw,
      kind: 'other',
      restricted: false,
      crp: false,
      base: `${cleaned.join('').toLowerCase()}d${last.toLowerCase()}`,
      confidence: 'low',
    };
  }

  const rest = segments.slice(2);

  // Working Party on the Programme Plan and Programme Performance:
  // TD/B/WP/<item> — Angela's own worked example (2026-08-26): "TD/B/WP/212"
  // -> "wpd212_en.pdf". Like the commissions below, "TD/B/" is dropped
  // entirely, keeping only the subsidiary body's own short code — unlike
  // an Executive session (TD/B/EX(nn)/...), which keeps "tdb" because it's
  // still the Board itself, just a different session format, not a
  // separate subsidiary body.
  if (rest[0]?.toUpperCase() === 'WP') {
    // rest[1] is always the item number itself (e.g. "343"); an optional
    // rest[2] carries an Add./Corr./Rev. compound suffix on top of it (e.g.
    // "Add.2") — previously this read rest[rest.length - 1] instead, which
    // meant a compound symbol like "TD/B/WP/343/Add.2" silently dropped the
    // "343" and produced "wpdAdd2" instead of "wpd343add2".
    const item = classifyItemSegment(rest[1] ?? '');
    const suffix = classifySuffixSegment(rest[2]);
    return {
      raw,
      kind: 'board-working-party',
      restricted: item.type === 'r',
      crp: item.type === 'crp',
      base: `wp${item.type}${item.num}${suffix}`,
      confidence: 'high',
      itemNum: item.num,
    };
  }

  // Working Party, session-parenthesized: TD/B/WP(<n>)/<item> — e.g.
  // "TD/B/WP(91)/CRP.1". See the header comment above for the real
  // evidence and why this is NOT the EX(nn) convention despite the visual
  // resemblance (a parenthesized number right after the body code).
  const wpSession = rest[0]?.match(/^WP\((\d+)\)$/i);
  if (wpSession) {
    const sessionNum = wpSession[1];
    const item = classifyItemSegment(rest[1] ?? '');
    const suffix = classifySuffixSegment(rest[2]); // unconfirmed for this shape, kept for consistency with the plain-WP branch above
    return {
      raw,
      kind: 'board-working-party-session',
      restricted: item.type === 'r',
      crp: item.type === 'crp',
      base: `wp${sessionNum}${item.type}${item.num}${suffix}`,
      // Only the bare CRP shape (e.g. "CRP.1") is evidenced against a real
      // file — a suffixed CRP or any r/l/d item under a session number has
      // no real precedent yet, so it's flagged low rather than guessed at
      // with false confidence.
      confidence: item.type === 'crp' && !suffix ? 'high' : 'low',
      sessionNum,
      itemType: item.type,
      itemNum: item.num,
    };
  }

  // Commission under the Board: TD/B/C.I/... or TD/B/C.II/... — the
  // training note (tmp/email after training.txt) is explicit that "TD/B/"
  // is omitted entirely for these, not just "UNCTAD/".
  const commissionMatch = rest[0]?.match(/^C\.(I{1,2})$/i);
  if (commissionMatch) {
    const commission = commissionMatch[1].toLowerCase(); // 'i' or 'ii'
    // Filenames use an Arabic digit ("c1"/"c2"), not the Roman numeral —
    // the OneDrive *folder* genuinely is labeled with the Roman numeral
    // (e.g. "TD_B_CI_MEM"), but that's just how the folder happens to be
    // named, not logic worth mirroring in a filename, where a digit is
    // unambiguous and extends cleanly to any future committee number.
    const commissionPrefix = commission === 'i' ? 'c1' : 'c2';
    const memMatch = rest[1]?.match(/^MEM\.?(\d+)$/i);
    const seriesRest = rest.slice(1).map(cleanSegment);
    const last = seriesRest.pop();
    return {
      raw,
      kind: 'board-commission',
      restricted: false,
      crp: false,
      base: `${commissionPrefix}${seriesRest.join('').toLowerCase()}d${last.toLowerCase()}`,
      confidence: 'high',
      commission,
      commissionPrefix,
      series: seriesRest.join('').toLowerCase() || null,
      memSeries: memMatch ? memMatch[1] : null,
      itemNum: last,
    };
  }

  // Executive session: TD/B/EX(nn)/... — the guideline's own worked
  // example (a real Acrobat screenshot) shows no underscore anywhere.
  const exMatch = rest[0]?.match(/^EX\((\d+)\)$/i);
  if (exMatch) {
    const item = classifyItemSegment(rest[1] ?? '');
    return {
      raw,
      kind: 'board-ex',
      restricted: item.type === 'r',
      crp: item.type === 'crp',
      base: `tdbex${exMatch[1]}${item.type}${item.num}`,
      confidence: 'high',
      sessionLabel: `EX(${exMatch[1]})`,
    };
  }

  // Plain numbered Board session: TD/B/<session>/<item>
  const sessionNum = rest[0];
  const item = classifyItemSegment(rest[rest.length - 1] ?? '');
  return {
    raw,
    kind: 'board-regular',
    restricted: item.type === 'r',
    crp: item.type === 'crp',
    base: `tdb${sessionNum}${item.type}${item.num}`,
    confidence: 'high',
    sessionNum,
    itemNum: item.num,
    itemType: item.type,
  };
}

/**
 * Per-language filenames (without extension) for a symbol, e.g.
 * { en: 'tdb73d5_en', fr: 'tdb73d5_fr', ... }
 */
export function buildFilenames(symbol, languages = LANGUAGES) {
  const parsed = parseSymbol(symbol);
  const names = {};
  for (const lang of languages) {
    names[lang] = `${parsed.base}_${lang}`;
  }
  return { parsed, names };
}

/**
 * Best-effort OneDrive folder path (relative to !MASTER_DOCS_and_PUB) for a
 * symbol. `year` is the document's issue year (from its Distr. date, not
 * derivable from the symbol alone) and is required for board-regular
 * documents, matching the real "TD_B_<session> (<year>)/<item>/" pattern.
 * `title` is used only for the Committee-I MEM-series case, to pick the
 * confirmed "Agenda" document-category folder label (see
 * MEM_SERIES_TOPICS/guessMemDocCategory above).
 * Returns null (not a guess) when the shape isn't well-evidenced enough to
 * propose a folder — the skill should ask the user in that case.
 */
export function buildFolderPath(symbol, { year, title } = {}) {
  const parsed = parseSymbol(symbol);

  if (parsed.kind === 'board-commission' && parsed.commission === 'i' && parsed.memSeries) {
    const topic = MEM_SERIES_TOPICS[Number(parsed.memSeries)];
    const category = guessMemDocCategory(title);
    if (topic && category) {
      return `TD_B_CI_MEM (Trade and Development)/MEM-${parsed.memSeries} (${topic})/${parsed.itemNum} (${category})`;
    }
    // Series number or document category not yet confirmed — ask rather
    // than guess a topic/category name that might not match the real
    // OneDrive folder. Falls through to the generic null below.
  }

  if (parsed.kind === 'board-regular' || parsed.kind === 'board-ex') {
    if (!year) return null;
    const sessionFolder = parsed.kind === 'board-ex'
      ? `TD_B_${parsed.sessionLabel}`
      : `TD_B_${parsed.sessionNum} (${year})`;
    const itemFolder = parsed.crp
      ? `CRP-${parsed.itemNum ?? ''}`
      : parsed.restricted
        ? `R-${parsed.itemNum ?? ''}`
        : parsed.itemType === 'l'
          ? `L-${parsed.itemNum ?? ''}`
          : `${parsed.itemNum ?? ''}`;
    return `${sessionFolder}/${itemFolder}`;
  }

  if (parsed.kind === 'publication') {
    if (!parsed.division || !parsed.folderYear || !parsed.folderNumber) return null;
    const divisionFolder = parsed.branch ? `UNCTAD_${parsed.division}_${parsed.branch}` : `UNCTAD_${parsed.division}`;
    return `${divisionFolder}/${parsed.folderYear}-${parsed.folderNumber}`; // (Short Title) appended by the caller once known
  }

  // board-commission / board-special-session / other: real folders exist
  // (TD_B_CI_CLP, TD_B_S_XXXV (35th Special Session), ...) but their exact
  // naming isn't derivable from the symbol alone (session ordinal labels,
  // commission series folder names aren't 1:1 with the symbol text) — safer
  // to ask than to create a folder that doesn't match the existing one.
  return null;
}
