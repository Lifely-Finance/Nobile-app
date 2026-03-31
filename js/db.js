/* Auto-split from original js/app.js. Global scripts only: no imports/exports. */

/* ═══════════════════════════════════════
   STATE — единое хранилище данных
═══════════════════════════════════════ */
const DB_SCHEMA_VERSION = 2;

const DEFAULT_DB = {
  schemaVersion: DB_SCHEMA_VERSION,
  user: { name: 'Пользователь', goal: 7900000, goalType: 'save', socialLevel: '', alertThreshold: 85, onboarded: false },
  seenAchievements: [],   // [id, ...]
  transactions: [],       // {id, type, amount, desc, category, date}
  habits: [],             // {id, name, emoji, freq, completions:{}}
  assets: [],             // {id, name, amount, type} // type: preset id или произвольный текст
  insights: [],           // {id, title, body, tag, date}
  tasks: [],              // {id, text, priority, done, date}
  mood: {},               // {'YYYY-MM-DD': 1-5}
  recurringPayments: [],  // {id, name, amount, dayOfMonth, category}
  paidPayments: [],       // {recurringId, paidDate, monthKey, txId?, assetId?}
  savings: [],            // {id, amount, note, date}
  goals: [],              // {id, emoji, name, target, saved, color, deadline?}
  currencyRates: {},
  settings: {
    monthOffset: 0,
    selectedRate: 10,
    aiPersonality: 'coach',
    aiProxyUrl: '/api/ai/messages',
    riskAutoRule: { mode: 'warn_count', minSeverity: 'warn', minCount: 3 }
  }
};

let DB = JSON.parse(JSON.stringify(DEFAULT_DB));

const ASSET_TYPE_PRESETS = [
  { id: 'savings', label: 'Сбережения', icon: '💰' },
  { id: 'cash',    label: 'Наличные',   icon: '💵' },
  { id: 'card',    label: 'Карта',      icon: '💳' },
  { id: 'bank',    label: 'Банковский счёт', icon: '🏦' },
  { id: 'deposit', label: 'Вклад',      icon: '🏛️' },
  { id: 'invest',  label: 'Инвестиции', icon: '📈' },
  { id: 'stocks',  label: 'Акции',      icon: '📊' },
  { id: 'bonds',   label: 'Облигации',  icon: '🧾' },
  { id: 'crypto',  label: 'Крипта',     icon: '🪙' },
  { id: 'gold',    label: 'Золото',     icon: '🥇' },
  { id: 'realty',  label: 'Недвижимость', icon: '🏠' },
  { id: 'business',label: 'Бизнес',     icon: '🏢' },
  { id: 'custom',  label: 'Свой вариант', icon: '✏️', custom: true }
];

const LIQUID_ASSET_TYPE_IDS = ['cash', 'card', 'bank', 'deposit', 'savings'];

function getAssetTypeMeta(type) {
  const rawType = (type || '').toString().trim();
  const normalized = rawType.toLowerCase();
  const preset = ASSET_TYPE_PRESETS.find(item => item.id === normalized);
  if (preset) return preset;

  const aliasMap = {
    'сбережения': 'savings',
    'накопления': 'savings',
    'наличные': 'cash',
    'карта': 'card',
    'карты': 'card',
    'банковский счёт': 'bank',
    'банковский счет': 'bank',
    'счёт': 'bank',
    'счет': 'bank',
    'вклад': 'deposit',
    'инвестиции': 'invest',
    'акции': 'stocks',
    'облигации': 'bonds',
    'крипта': 'crypto',
    'криптовалюта': 'crypto',
    'недвижимость': 'realty',
    'золото': 'gold',
    'бизнес': 'business'
  };

  const aliasId = aliasMap[normalized];
  if (aliasId) return ASSET_TYPE_PRESETS.find(item => item.id === aliasId);

  return {
    id: 'custom',
    label: rawType || 'Свой вариант',
    icon: '✏️',
    custom: true
  };
}

// Xbox browser: make UI 20% smaller
(function(){
  try {
    if (/Xbox/i.test(navigator.userAgent||'')) document.documentElement.classList.add('is-xbox');
  } catch(e) {}
})();

/* ═══════════════════════════════════════
   LOCALSTORAGE PERSISTENCE
═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   CRYPTO ENGINE (AES-GCM + PBKDF2)
═══════════════════════════════════════ */
const DB_KEY   = 'nobile_enc';   // encrypted data
const SALT_KEY = 'nobile_salt';  // random salt (not secret)
const HASH_KEY = 'nobile_phash'; // PIN verifier hash
const AI_PROXY_URL_KEY = 'nobile_ai_proxy_url';
const DEFAULT_AI_PROXY_URL = '';

let _cryptoKey = null; // CryptoKey in memory for session

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatSafeRichText(value, { allowBold = false } = {}) {
  let safe = escapeHTML(value).replace(/\n/g, '<br>');
  if (allowBold) {
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }
  return safe;
}

function mergeWithDefaults(defaults, incoming) {
  if (Array.isArray(defaults)) {
    return Array.isArray(incoming) ? incoming : [...defaults];
  }
  if (defaults && typeof defaults === 'object') {
    const source = incoming && typeof incoming === 'object' && !Array.isArray(incoming) ? incoming : {};
    const result = {};
    Object.keys(defaults).forEach(key => {
      result[key] = mergeWithDefaults(defaults[key], source[key]);
    });
    Object.keys(source).forEach(key => {
      if (!(key in result)) result[key] = source[key];
    });
    return result;
  }
  return incoming === undefined ? defaults : incoming;
}

function migrateDB(data) {
  const next = data && typeof data === 'object' && !Array.isArray(data)
    ? JSON.parse(JSON.stringify(data))
    : {};

  const currentVersion = Number(next.schemaVersion || 1);

  if (!next.settings || typeof next.settings !== 'object' || Array.isArray(next.settings)) next.settings = {};
  if (!next.user || typeof next.user !== 'object' || Array.isArray(next.user)) next.user = {};

  if (!next.settings.aiPersonality && next.user.aiPersonality) {
    next.settings.aiPersonality = next.user.aiPersonality;
  }
  delete next.user.aiPersonality;

  if (!next.currencyRates || typeof next.currencyRates !== 'object' || Array.isArray(next.currencyRates)) {
    next.currencyRates = {};
  }

  if (!Array.isArray(next.transactions)) next.transactions = [];
  if (!Array.isArray(next.habits)) next.habits = [];
  if (!Array.isArray(next.assets)) next.assets = [];
  if (!Array.isArray(next.insights)) next.insights = [];
  if (!Array.isArray(next.tasks)) next.tasks = [];
  if (!Array.isArray(next.recurringPayments)) next.recurringPayments = [];
  if (!Array.isArray(next.paidPayments)) next.paidPayments = [];
  if (!Array.isArray(next.savings)) next.savings = [];
  if (!Array.isArray(next.goals)) next.goals = [];
  if (!Array.isArray(next.seenAchievements)) next.seenAchievements = [];
  if (!next.mood || typeof next.mood !== 'object' || Array.isArray(next.mood)) next.mood = {};

  next.schemaVersion = Math.max(currentVersion, DB_SCHEMA_VERSION);
  return next;
}

function normalizeDB(data) {
  const migrated = migrateDB(data);
  const normalized = mergeWithDefaults(DEFAULT_DB, migrated || {});
  normalized.schemaVersion = DB_SCHEMA_VERSION;
  return normalized;
}

function validateImportedDB(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Импорт должен быть JSON-объектом');
  }
  const candidate = data.data && typeof data.data === 'object' && !Array.isArray(data.data)
    ? data.data
    : data;

  if (!candidate.user && !candidate.transactions && !candidate.settings) {
    throw new Error('Не похоже на резервную копию Nobile');
  }

  const arrayFields = ['transactions', 'habits', 'assets', 'insights', 'tasks', 'recurringPayments', 'paidPayments', 'savings', 'goals', 'seenAchievements'];
  arrayFields.forEach(key => {
    if (key in candidate && !Array.isArray(candidate[key])) {
      throw new Error(`Поле ${key} должно быть массивом`);
    }
  });

  if ('user' in candidate && (typeof candidate.user !== 'object' || !candidate.user || Array.isArray(candidate.user))) {
    throw new Error('Поле user должно быть объектом');
  }
  if ('settings' in candidate && (typeof candidate.settings !== 'object' || !candidate.settings || Array.isArray(candidate.settings))) {
    throw new Error('Поле settings должно быть объектом');
  }

  return normalizeDB(candidate);
}

function getAIProxyUrl() {
  const fromSettings = DB?.settings?.aiProxyUrl;
  const fromStorage = localStorage.getItem(AI_PROXY_URL_KEY);
  const url = (fromSettings || fromStorage || DEFAULT_AI_PROXY_URL || '').trim();
  return url || '';
}

function saveAIProxyUrl(val) {
  const next = (val || '').trim();
  if (!DB.settings) DB.settings = {};
  DB.settings.aiProxyUrl = next;
  localStorage.setItem(AI_PROXY_URL_KEY, next);
  saveDB();
}

function loadAIProxyField() {
  const el = document.getElementById('set-ai-proxy-url');
  if (el) el.value = getAIProxyUrl();
}

async function callAI(payload) {
  const endpoint = getAIProxyUrl();
  if (!endpoint) throw new Error('AI proxy не настроен');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const message = data?.error || data?.message || `AI proxy error (${res.status})`;
    throw new Error(message);
  }
  return data || {};
}

function extractAIText(data) {
  return data?.content?.[0]?.text?.trim() || '';
}

function getAIPersonality() {
  return DB?.settings?.aiPersonality || 'coach';
}

async function deriveKey(pin, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function getOrCreateSalt() {
  const stored = localStorage.getItem(SALT_KEY);
  if (stored) return new Uint8Array(JSON.parse(stored));
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(SALT_KEY, JSON.stringify(Array.from(salt)));
  return salt;
}

async function encryptData(data, key) {
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(data))
  );
  // Store iv + ciphertext together as base64
  const combined = new Uint8Array(iv.byteLength + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.byteLength);
  return btoa(String.fromCharCode(...combined));
}

async function decryptData(b64, key) {
  const combined = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv        = combined.slice(0, 12);
  const data      = combined.slice(12);
  const dec       = new TextDecoder();
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return JSON.parse(dec.decode(decrypted));
}

async function hashPinLegacy(pin, salt) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', new Uint8Array([...enc.encode(pin), ...salt]));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function hashPin(pin, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(pin), { name: 'PBKDF2' }, false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 210000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

async function verifyPinHash(pin, salt, storedHash) {
  const nextHash = await hashPin(pin, salt);
  if (nextHash === storedHash) return { ok: true, needsUpgrade: false, hash: nextHash };
  const legacyHash = await hashPinLegacy(pin, salt);
  if (legacyHash === storedHash) return { ok: true, needsUpgrade: true, hash: nextHash };
  return { ok: false, needsUpgrade: false, hash: nextHash };
}

// ── Public API ──
async function saveDB() {
  DB = normalizeDB(DB);
  if (!_cryptoKey) { try { localStorage.setItem('nobile_db', JSON.stringify(DB)); } catch(e) {} return; }
  try {
    const enc = await encryptData(DB, _cryptoKey);
    localStorage.setItem(DB_KEY, enc);
    localStorage.removeItem('nobile_db'); // remove old plaintext if exists
  } catch(e) { console.error('saveDB encrypt error', e); }
}

async function loadDB() {
  // Try encrypted first
  const enc = localStorage.getItem(DB_KEY);
  if (enc && _cryptoKey) {
    try {
      const data = await decryptData(enc, _cryptoKey);
      DB = normalizeDB(data);
      return true;
    } catch(e) { return false; } // wrong key
  }
  // Fallback: plaintext (migration path)
  try {
    const raw = localStorage.getItem('nobile_db');
    if (raw) DB = normalizeDB(JSON.parse(raw));
    else DB = normalizeDB(DB);
    return true;
  } catch(e) { return false; }
}
