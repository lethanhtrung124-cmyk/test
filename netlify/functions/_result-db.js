const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

function isConfigured() {
  return Boolean(supabaseUrl && supabaseServiceKey);
}

async function supabaseRequest(path, options = {}) {
  if (!isConfigured()) {
    throw new Error('Supabase service database is not configured.');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path.replace(/^\/+/, '')}`, {
    ...options,
    headers: {
      apikey: supabaseServiceKey,
      authorization: `Bearer ${supabaseServiceKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation,resolution=merge-duplicates',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed: ${response.status} ${await response.text()}`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function normalizeSupabaseUrl(value) {
  return String(value || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/i, '');
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  };
}

function requireIngestToken(event) {
  const expected = process.env.RESULTS_INGEST_TOKEN;
  if (!expected) return true;
  const header = event.headers.authorization || event.headers.Authorization || '';
  return header === `Bearer ${expected}`;
}

module.exports = {
  isConfigured,
  json,
  requireIngestToken,
  supabaseRequest
};
