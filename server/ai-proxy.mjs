import http from 'node:http';

const PORT = process.env.PORT || 8787;
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY environment variable');
  process.exit(1);
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Payload must be an object');
  }
  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  const cleanMessages = messages
    .filter(msg => msg && typeof msg === 'object' && typeof msg.role === 'string')
    .map(msg => ({ role: msg.role, content: msg.content }));

  return {
    model: typeof payload.model === 'string' ? payload.model : 'claude-3-haiku-20240307',
    max_tokens: Number.isFinite(payload.max_tokens) ? Math.min(4096, Math.max(64, payload.max_tokens)) : 1024,
    system: typeof payload.system === 'string' ? payload.system : undefined,
    messages: cleanMessages
  };
}

function sendJson(res, code, payload) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
  if (req.method !== 'POST' || req.url !== '/api/ai/messages') {
    return sendJson(res, 404, { error: 'Not found' });
  }

  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', async () => {
    try {
      const payload = sanitizePayload(JSON.parse(raw || '{}'));
      if (!payload.messages.length) {
        return sendJson(res, 400, { error: 'messages are required' });
      }
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload)
      });
      const data = await upstream.json();
      sendJson(res, upstream.status, data);
    } catch (error) {
      sendJson(res, 500, { error: error.message || 'Proxy error' });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Nobile AI proxy listening on http://localhost:${PORT}/api/ai/messages`);
});
