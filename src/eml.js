import fs from 'node:fs';

// Angela forwards gDoc2.0 notifications as Outlook .eml exports — a nested
// multipart MIME structure (mixed > related > alternative, typically) with
// the actual zip/PDF as a base64 attachment part. This is a purpose-built
// parser for that shape, not a general RFC 822 implementation.

function unfoldHeaders(headerBlock) {
  return headerBlock.replace(/\r?\n[ \t]+/g, ' ');
}

function parseHeaders(headerBlock) {
  const headers = {};
  for (const line of unfoldHeaders(headerBlock).split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
  }
  return headers;
}

function parseHeaderValue(value) {
  if (!value) return { primary: '', params: {} };
  const parts = value.split(';').map((s) => s.trim());
  const params = {};
  for (const p of parts.slice(1)) {
    const match = p.match(/^([^=]+)=(.*)$/);
    if (!match) continue;
    let v = match[2].trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    params[match[1].trim().toLowerCase()] = v;
  }
  return { primary: parts[0].toLowerCase(), params };
}

function decodeQuotedPrintable(str) {
  return str
    .replace(/=\r?\n/g, '') // soft line break
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/** Split a raw MIME entity (headers + body, as a latin1 string) into its parts. */
function splitHeaderBody(entityStr) {
  const match = entityStr.match(/\r?\n\r?\n/);
  if (!match) return { headers: {}, bodyStr: entityStr };
  const idx = match.index;
  return {
    headers: parseHeaders(entityStr.slice(0, idx)),
    bodyStr: entityStr.slice(idx + match[0].length),
  };
}

function parsePart(entityStr, results) {
  const { headers, bodyStr } = splitHeaderBody(entityStr);
  const contentType = parseHeaderValue(headers['content-type']);

  if (contentType.primary.startsWith('multipart/')) {
    const boundary = contentType.params.boundary;
    if (!boundary) return;
    const segments = bodyStr.split(`--${boundary}`);
    // segments[0] is the preamble (ignored); a segment starting with "--"
    // is the closing delimiter (and anything after it is the epilogue).
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].startsWith('--')) break;
      const seg = segments[i].replace(/^\r?\n/, '').replace(/\r?\n$/, '');
      parsePart(seg, results);
    }
    return;
  }

  const cte = (headers['content-transfer-encoding'] || '7bit').toLowerCase();
  let decodedStr = bodyStr;
  if (cte === 'base64') {
    decodedStr = Buffer.from(bodyStr.replace(/[^A-Za-z0-9+/=]/g, ''), 'base64').toString('latin1');
  } else if (cte === 'quoted-printable') {
    decodedStr = decodeQuotedPrintable(bodyStr);
  }
  const buffer = Buffer.from(decodedStr, 'latin1');

  const disposition = parseHeaderValue(headers['content-disposition']);
  const filename = disposition.params.filename || contentType.params.name || null;

  let isAttachment;
  if (disposition.primary === 'attachment') isAttachment = true;
  else if (disposition.primary === 'inline') isAttachment = false;
  else isAttachment = Boolean(filename) && !contentType.primary.startsWith('text/');

  results.push({
    contentType: contentType.primary,
    charset: contentType.params.charset || 'utf-8',
    filename,
    isAttachment,
    buffer,
  });
}

/**
 * Parse an Outlook .eml file, returning the plain-text body (for
 * `parseGdocEmail`) and any real attachments (filtering out inline images).
 * @returns {{ subject: string|null, bodyText: string|null, attachments: {filename: string, contentType: string, buffer: Buffer}[] }}
 */
export function parseEml(filePath) {
  const raw = fs.readFileSync(filePath);
  const entityStr = raw.toString('latin1');
  const results = [];
  parsePart(entityStr, results);

  const { headers: topHeaders } = splitHeaderBody(entityStr);
  const subject = topHeaders.subject ? unfoldHeaders(topHeaders.subject) : null;

  const textPart = results.find((r) => r.contentType === 'text/plain' && !r.isAttachment);
  const bodyText = textPart ? new TextDecoder(textPart.charset.toLowerCase()).decode(textPart.buffer) : null;

  const attachments = results
    .filter((r) => r.isAttachment && r.filename)
    .map((r) => ({ filename: r.filename, contentType: r.contentType, buffer: r.buffer }));

  return { subject, bodyText, attachments };
}
