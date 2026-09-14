const BASE_URL = 'https://api.datawrapper.de/v3';
const MAX_ATTEMPTS = 3;

/** A Datawrapper API failure – `.status` is the HTTP status, `.message` never contains the token. */
export class DatawrapperApiError extends Error {
  constructor(message, { status } = {}) {
    super(message);
    this.status = status;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Concurrency is deliberately not a parameter – Datawrapper's rate limits
 * aren't publicly documented in detail, and this is a CLI making a
 * handful of calls per run, not a bulk job, so every call here is already
 * sequential by construction (the pipeline awaits each one in turn).
 */
async function request(method, url, { token, body, isText = false } = {}) {
  const headers = { Authorization: `Bearer ${token}` };
  let fetchBody;
  if (body !== undefined) {
    if (isText) {
      headers['Content-Type'] = 'text/csv';
      fetchBody = body;
    } else {
      headers['Content-Type'] = 'application/json';
      fetchBody = JSON.stringify(body);
    }
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const res = await fetch(url, { method, headers, body: fetchBody });
    if (res.ok) return res;

    const retryable = res.status === 429 || res.status >= 500;
    if (retryable && attempt < MAX_ATTEMPTS) {
      await sleep(2 ** attempt * 500); // 1s, 2s
      continue;
    }

    // Surface Datawrapper's own error message, not a bare status code –
    // but never the token, which only ever lives in the request headers.
    let message = `Datawrapper API error: ${res.status} ${res.statusText}`;
    try {
      const errJson = await res.json();
      const detail = errJson?.message || errJson?.error || errJson?.title;
      if (detail) message = `Datawrapper API error: ${detail}`;
    } catch {
      // no JSON body – keep the bare status message
    }
    throw new DatawrapperApiError(message, { status: res.status });
  }
}

export async function createChart({ token, title, type, theme, language, folderId, organizationId, metadata }) {
  const res = await request('POST', `${BASE_URL}/charts`, {
    token,
    body: { title, type, theme, language, folderId, organizationId, metadata },
  });
  const json = await res.json();
  return json.id;
}

export async function uploadData({ token, chartId, csvText }) {
  await request('PUT', `${BASE_URL}/charts/${chartId}/data`, { token, body: csvText, isText: true });
}

export async function patchMetadata({ token, chartId, metadata, theme, language, folderId, title }) {
  await request('PATCH', `${BASE_URL}/charts/${chartId}`, {
    token,
    body: { metadata, theme, language, folderId, title },
  });
}

export async function getChart({ token, chartId }) {
  const res = await request('GET', `${BASE_URL}/charts/${chartId}`, { token });
  return res.json();
}

/**
 * Clone an existing chart (data + full metadata) rather than rebuilding it
 * from scratch – used by the print-to-web conversion workflow, where the
 * source chart's colours/axes/describe text were already deliberately
 * chosen and should carry over untouched; only the print/web-specific
 * settings get patched afterwards.
 */
export async function copyChart({ token, chartId }) {
  const res = await request('POST', `${BASE_URL}/charts/${chartId}/copy`, { token });
  const json = await res.json();
  return json.id;
}

// Not wired into any v1 CLI command – see TODO.md – but the client's own
// shape is trivial to include now and matches createChart/getChart/etc.
export async function publishChart({ token, chartId }) {
  const res = await request('POST', `${BASE_URL}/charts/${chartId}/publish`, { token });
  return res.json();
}

export async function exportChart({ token, chartId, format = 'png', zoom = 2, plain = false, borderWidth }) {
  const params = new URLSearchParams({ unit: 'px', zoom: String(zoom), plain: String(plain) });
  if (borderWidth !== undefined) params.set('borderWidth', String(borderWidth));
  const res = await request('GET', `${BASE_URL}/charts/${chartId}/export/${format}?${params}`, { token });
  return Buffer.from(await res.arrayBuffer());
}
