/**
 * Nobile Gemini Proxy – опциональный прокси к Google Gemini API.
 *
 * Фронтенд приложения уже умеет работать с Gemini напрямую «из коробки».
 * Этот файл оставлен как более безопасный серверный пример для продакшена,
 * чтобы позже можно было вынести API-ключ с клиента на сервер.
 *
 * Переменные окружения:
 *   GEMINI_API_KEY    – обязательно; ключ Google Gemini
 *   PROXY_AUTH_TOKEN  – опционально; дополнительный токен клиента (X-Proxy-Token)
 *   ALLOWED_ORIGINS   – опционально; список origins через запятую
 *   PORT              – опционально; порт сервера (по умолчанию 8787)
 *   RATE_LIMIT_RPM    – опционально; лимит запросов в минуту на IP
 */

import http from 'node:http';

const PORT = process.env.PORT || 8787;
const API_KEY = process.env.GEMINI_API_KEY;
const PROXY_TOKEN = process.env.PROXY_AUTH_TOKEN;
const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '20', 10);
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost',
      'http://127.0.0.1',
      'http://localhost:3000',
      'http://localhost:8080',
    ];

if (!API_KEY) {
  console.error('[gemini-proxy] ОШИБКА: GEMINI_API_KEY не задан');
  process.exit(1);
}
if (!PROXY_TOKEN) {
  console.warn('[gemini-proxy] PROXY_AUTH_TOKEN не задан — прокси запущен без дополнительного токена. Используйте это только для локальной разработки.');
}

const rateBuckets = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const window = 60_000;
  const bucket = rateBuckets.get(ip) || { count: 0, windowStart: now };

  if (now - bucket.windowStart > window) {
    bucket.count = 1;
    bucket.windowStart = now;
    rateBuckets.set(ip, bucket);
    return false;
  }

  bucket.count++;
  rateBuckets.set(ip, bucket);
  return bucket.count > RATE_LIMIT_RPM;
}

setInterval(() => {
  const cutoff = Date.now() - 120_000;
  for (const [ip, bucket] of rateBuckets) {
    if (bucket.windowStart < cutoff) rateBuckets.delete(ip);
  }
}, 60_000);

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.startsWith(allowed));
}

function sendJson(res, code, payload, extraHeaders = {}) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Token',
    'Vary': 'Origin',
  };
}

function normalizeText(content) {
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content.map(part => {
      if (typeof part === 'string') return part;
      if (part && typeof part === 'object') return part.text || part.content || '';
      return '';
    }).join('\\n').trim();
  }
  if (content && typeof content === 'object') return String(content.text || content.content || '').trim();
  return '';
}

function sanitizePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('Payload must be an object');
  }

  const contents = (Array.isArray(payload.messages) ? payload.messages : [])
    .filter(msg => msg && typeof msg === 'object' && typeof msg.role === 'string')
    .map(msg => {
      const text = normalizeText(msg.content);
      if (!text) return null;
      return {
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text }],
      };
    })
    .filter(Boolean);

  return {
    contents,
    systemInstruction: typeof payload.system === 'string' && payload.system.trim()
      ? { parts: [{ text: payload.system.trim() }] }
      : undefined,
    generationConfig: {
      maxOutputTokens: Number.isFinite(payload.max_tokens)
        ? Math.max(64, Math.min(4096, payload.max_tokens))
        : 1024,
    },
  };
}

const server = http.createServer((req, res) => {
  const origin = req.headers.origin || '';
  const ip = getClientIp(req);

  if (req.method === 'OPTIONS') {
    if (!isOriginAllowed(origin)) return sendJson(res, 403, { error: 'Origin not allowed' });
    return sendJson(res, 200, { ok: true }, corsHeaders(origin));
  }

  if (req.method !== 'POST' || req.url !== '/api/ai/messages') {
    return sendJson(res, 404, { error: 'Not found' });
  }

  if (!isOriginAllowed(origin)) {
    console.warn(`[gemini-proxy] Заблокирован origin: ${origin} (IP: ${ip})`);
    return sendJson(res, 403, { error: 'Origin not allowed' }, corsHeaders(origin));
  }

  const clientToken = req.headers['x-proxy-token'] || '';
  if (PROXY_TOKEN && clientToken !== PROXY_TOKEN) {
    console.warn(`[gemini-proxy] Неверный токен с IP: ${ip}`);
    return sendJson(res, 401, { error: 'Unauthorized' }, corsHeaders(origin));
  }

  if (isRateLimited(ip)) {
    console.warn(`[gemini-proxy] Rate limit exceeded для IP: ${ip}`);
    return sendJson(res, 429, { error: 'Too many requests' }, {
      ...corsHeaders(origin),
      'Retry-After': '60',
    });
  }

  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', async () => {
    try {
      const payload = sanitizePayload(JSON.parse(raw || '{}'));
      if (!payload.contents.length) {
        return sendJson(res, 400, { error: 'messages are required' }, corsHeaders(origin));
      }

      const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await upstream.json();
      sendJson(res, upstream.status, data, corsHeaders(origin));
    } catch (error) {
      console.error('[gemini-proxy] Ошибка:', error.message);
      sendJson(res, 500, { error: 'Proxy error' }, corsHeaders(origin));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[gemini-proxy] Запущен на http://localhost:${PORT}/api/ai/messages`);
  console.log(`[gemini-proxy] Разрешённые origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`[gemini-proxy] Rate limit: ${RATE_LIMIT_RPM} req/min`);
});
