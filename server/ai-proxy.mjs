/**
 * Nobile AI Proxy – безопасный прокси к Anthropic API
 *
 * Переменные окружения:
 *   ANTHROPIC_API_KEY  – обязательно; ключ Anthropic
 *   PROXY_AUTH_TOKEN   – обязательно; секрет, который фронтенд должен передавать
 *                        в заголовке X-Proxy-Token
 *   ALLOWED_ORIGINS    – опционально; список origins через запятую
 *                        (по умолчанию: только localhost/127.0.0.1)
 *   PORT               – опционально; порт сервера (по умолчанию 8787)
 *   RATE_LIMIT_RPM     – опционально; макс. запросов в минуту с одного IP
 *                        (по умолчанию 20)
 */

import http from 'node:http';

/* ── Конфигурация ── */
const PORT           = process.env.PORT           || 8787;
const API_KEY        = process.env.ANTHROPIC_API_KEY;
const PROXY_TOKEN    = process.env.PROXY_AUTH_TOKEN;
const RATE_LIMIT_RPM = parseInt(process.env.RATE_LIMIT_RPM || '20', 10);

// Origins, которым разрешено обращаться к прокси.
// В проде замените на ваш реальный домен, например: https://app.nobile.ru
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : [
      'http://localhost',
      'http://127.0.0.1',
      'http://localhost:3000',
      'http://localhost:8080',
    ];

/* ── Проверка обязательных переменных ── */
if (!API_KEY) {
  console.error('[ai-proxy] ОШИБКА: ANTHROPIC_API_KEY не задан');
  process.exit(1);
}
if (!PROXY_TOKEN) {
  console.error('[ai-proxy] ОШИБКА: PROXY_AUTH_TOKEN не задан. Задайте случайный секрет и передавайте его из фронтенда в заголовке X-Proxy-Token');
  process.exit(1);
}

/* ── Rate limiter (скользящее окно 1 минута) ── */
const _rateBuckets = new Map(); // IP → { count, windowStart }

function isRateLimited(ip) {
  const now    = Date.now();
  const window = 60_000;
  const bucket = _rateBuckets.get(ip) || { count: 0, windowStart: now };

  if (now - bucket.windowStart > window) {
    bucket.count       = 1;
    bucket.windowStart = now;
    _rateBuckets.set(ip, bucket);
    return false;
  }
  bucket.count++;
  _rateBuckets.set(ip, bucket);
  return bucket.count > RATE_LIMIT_RPM;
}

setInterval(() => {
  const cutoff = Date.now() - 120_000;
  for (const [ip, b] of _rateBuckets) {
    if (b.windowStart < cutoff) _rateBuckets.delete(ip);
  }
}, 60_000);

/* ── Вспомогательные функции ── */
function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
}

function isOriginAllowed(origin) {
  if (!origin) return false;
  return ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.startsWith(allowed));
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
    model:      typeof payload.model === 'string' ? payload.model : 'claude-3-haiku-20240307',
    max_tokens: Number.isFinite(payload.max_tokens) ? Math.min(4096, Math.max(64, payload.max_tokens)) : 1024,
    system:     typeof payload.system === 'string' ? payload.system : undefined,
    messages:   cleanMessages,
  };
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
    'Access-Control-Allow-Origin':  origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Proxy-Token',
    'Vary': 'Origin',
  };
}

/* ── HTTP-сервер ── */
const server = http.createServer((req, res) => {
  const origin = req.headers['origin'] || '';
  const ip     = getClientIp(req);

  if (req.method === 'OPTIONS') {
    if (!isOriginAllowed(origin)) return sendJson(res, 403, { error: 'Origin not allowed' });
    return sendJson(res, 200, { ok: true }, corsHeaders(origin));
  }

  if (req.method !== 'POST' || req.url !== '/api/ai/messages') {
    return sendJson(res, 404, { error: 'Not found' });
  }

  if (!isOriginAllowed(origin)) {
    console.warn(`[ai-proxy] Заблокирован origin: ${origin} (IP: ${ip})`);
    return sendJson(res, 403, { error: 'Origin not allowed' }, corsHeaders(origin));
  }

  const clientToken = req.headers['x-proxy-token'] || '';
  if (clientToken !== PROXY_TOKEN) {
    console.warn(`[ai-proxy] Неверный токен с IP: ${ip}`);
    return sendJson(res, 401, { error: 'Unauthorized' }, corsHeaders(origin));
  }

  if (isRateLimited(ip)) {
    console.warn(`[ai-proxy] Rate limit exceeded для IP: ${ip}`);
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
      if (!payload.messages.length) {
        return sendJson(res, 400, { error: 'messages are required' }, corsHeaders(origin));
      }

      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(payload),
      });

      const data = await upstream.json();
      sendJson(res, upstream.status, data, corsHeaders(origin));
    } catch (error) {
      console.error('[ai-proxy] Ошибка:', error.message);
      sendJson(res, 500, { error: 'Proxy error' }, corsHeaders(origin));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[ai-proxy] Запущен на http://localhost:${PORT}/api/ai/messages`);
  console.log(`[ai-proxy] Разрешённые origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`[ai-proxy] Rate limit: ${RATE_LIMIT_RPM} req/min`);
});
