// [ \t]* (not \s*) deliberately stops at the line break — otherwise an
// empty field (e.g. "User Remarks:" with nothing after it) would greedily
// match content from a later, unrelated line like the email's sign-off.
const FIELD_PATTERNS = {
  requestId: /^Request:[ \t]*(\S+)/m,
  symbol: /^Symbol:[ \t]*(\S.*)$/m,
  title: /^Title:[ \t]*(\S.*)$/m,
  remarks: /^User Remarks:[ \t]*(\S.*)$/m,
};

function classifyStatusFromBody(text) {
  if (/\bis issued\b/i.test(text) && /final file\(s\) are ready for download/i.test(text)) return 'issued';
  if (/\bis registered\b/i.test(text)) return 'registered';
  return null;
}

function extractField(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].trim() : null;
}

/**
 * gDoc2.0's own notification subject line has the form
 * "Issued: R2609890 - TD/B/73/5 - <title>" (or "Registered: ..."). Real
 * forwards (Outlook "FW:") keep this subject intact even when the *body*
 * gets replaced by whoever forwards it with their own note — so the
 * subject is often the more reliable source once an email has been
 * forwarded a hop or two. " - " (space-hyphen-space) is used as the field
 * separator rather than a bare "-" because some symbols contain a literal,
 * space-less hyphen of their own (e.g. "TD/B(S-XXXI)/1").
 */
export function parseSubjectLine(subject) {
  if (!subject) return null;
  const cleaned = subject.replace(/^(?:(?:FW|FWD|RE|TR)\s*:\s*)+/i, '').trim();
  const match = cleaned.match(/^(Issued|Registered)\s*:\s*(R\d+)\s*-\s*(.+)$/i);
  if (!match) return null;

  const [, statusWord, requestId, rest] = match;
  const sepIdx = rest.indexOf(' - ');
  return {
    status: statusWord.toLowerCase(),
    requestId,
    symbol: (sepIdx === -1 ? rest : rest.slice(0, sepIdx)).trim(),
    title: sepIdx === -1 ? null : rest.slice(sepIdx + 3).trim(),
  };
}

/**
 * Parse a gDoc2.0 "Document Request" notification — either the
 * auto-generated body directly, or a forward of one, in which case the
 * body may have been replaced by a human note (see `note` below) and the
 * subject line becomes the more reliable source. Returns null fields for
 * anything not found rather than throwing — the caller decides what's
 * mandatory.
 *
 * @param {string} bodyText
 * @param {{subject?: string}} [options]
 */
export function parseGdocEmail(bodyText, { subject } = {}) {
  const text = bodyText || '';
  const fromSubject = parseSubjectLine(subject);

  const status = classifyStatusFromBody(text) || fromSubject?.status || 'unknown';
  const requestId = extractField(text, FIELD_PATTERNS.requestId) || fromSubject?.requestId || null;
  const symbol = extractField(text, FIELD_PATTERNS.symbol) || fromSubject?.symbol || null;
  const title = extractField(text, FIELD_PATTERNS.title) || fromSubject?.title || null;
  const remarks = extractField(text, FIELD_PATTERNS.remarks);

  // A real forward often prepends a short human instruction (e.g. "Could
  // you please post it on web and remove the advance from DP?") above the
  // quoted original gDoc2.0 notification — that's operationally important
  // and shouldn't be silently discarded just because the template fields
  // were also found (in the quoted portion below it). Whichever comes
  // first — the quoted "Request:" field, or Outlook's own "From: ..."
  // quote-block header — marks where the human's own text ends.
  //
  // Confirmed 2026-09-04, a real bug: this used `/^From:.*\n/m` — but JS
  // `.` excludes `\r` (a line terminator) as well as `\n`, so on a normal
  // Outlook CRLF email the "From:" line's own `\r` sits between what `.*`
  // can consume and the literal `\n` the pattern requires next, and the
  // whole match silently fails to find the quote-block header at all. That
  // left only the (much later) "Request:" field as the boundary, so the
  // gDoc2.0 boilerplate ("Dear Colleague... Please be informed...") got
  // merged into the preamble alongside the human's real note — tripping
  // `isBoilerplate` and discarding the entire note, human instruction
  // included. `\r?\n` tolerates both line-ending styles.
  const quoteStart = [text.search(/^Request:/m), text.search(/^From:.*\r?\n/m)]
    .filter((i) => i !== -1)
    .sort((a, b) => a - b)[0];
  const preamble = (quoteStart === undefined ? text : text.slice(0, quoteStart)).trim();
  // gDoc2.0's own boilerplate opener ("Dear Colleague, Please be informed
  // that...") isn't a human instruction — only surface a note when there's
  // an actual person's text in front of the quoted/templated notification.
  const isBoilerplate = /Dear Colleague/i.test(preamble) && /Please be informed/i.test(preamble);
  const note = preamble && !isBoilerplate ? preamble : null;

  return {
    status,
    actionable: status === 'issued',
    requestId,
    symbol,
    title,
    remarks: remarks || null,
    note,
  };
}
