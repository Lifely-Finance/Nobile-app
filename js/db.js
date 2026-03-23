/* Auto-split from original js/app.js. Global scripts only: no imports/exports. */

/* ═══════════════════════════════════════
   STATE — единое хранилище данных
═══════════════════════════════════════ */
let DB = {
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
  settings: { monthOffset: 0, selectedRate: 10, riskAutoRule: { mode: 'warn_count', minSeverity: 'warn', minCount: 3 } }
};

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
const AI_KEY_STORE = 'nobile_ai_key'; // Anthropic API key

let _cryptoKey = null; // CryptoKey in memory for session

function getAIKey() {
  return localStorage.getItem(AI_KEY_STORE) || '';
}

function saveAIKey(val) {
  localStorage.setItem(AI_KEY_STORE, val.trim());
}

function getAIHeaders() {
  const key = getAIKey();
  return {
    'Content-Type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true'
  };
}

// Load AI key into settings field when sheet opens
function loadAIKeyField() {
  const el = document.getElementById('set-ai-api-key');
  if (el) el.value = getAIKey();
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

async function hashPin(pin, salt) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', new Uint8Array([...enc.encode(pin), ...salt]));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

// ── Public API ──
async function saveDB() {
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
      DB = { ...DB, ...data };
      return true;
    } catch(e) { return false; } // wrong key
  }
  // Fallback: plaintext (migration path)
  try {
    const raw = localStorage.getItem('nobile_db');
    if (raw) DB = { ...DB, ...JSON.parse(raw) };
    return true;
  } catch(e) { return false; }
}
