/* Nobile Service Worker v2 — push, offline cache, rich notifications */
const CACHE_NAME = 'nobile-v2';
const ASSETS = [
  './', './index.html', './index_nobile_v4.css',
  './js/db.js', './js/logic.js', './js/ui.js', './js/main.js',
  './icons/nobile-logo-192.png', './icons/nobile-logo-512.png'
];

// Monochrome badge SVG (white N on transparent — Android shows as tinted)
const BADGE_SVG = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 96 96'><rect width='96' height='96' rx='18' fill='white'/><text x='50%' y='72' text-anchor='middle' font-family='Arial Black,sans-serif' font-weight='900' font-size='64' fill='black'>N</text></svg>`;

const ICON = './icons/nobile-logo-192.png';

/* ── Install & Activate ── */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => clients.claim())
  );
});

/* ── Fetch — network first, fallback to cache ── */
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone)).catch(() => {});
        }
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

/* ── Message from main thread ── */
self.addEventListener('message', e => {
  if (!e.data) return;

  if (e.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, category, amount, date } = e.data;

    const options = buildNotifOptions(tag, body, category, amount, date);
    e.waitUntil(self.registration.showNotification(title, options));
  }

  if (e.data.type === 'SCHEDULE_CHECK') {
    // Periodic check triggered by main thread keepalive
    e.waitUntil(checkAndNotify(e.data.payload));
  }
});

/* ── Build rich notification options ── */
function buildNotifOptions(tag, body, category, amount, date) {
  // Category-specific accent colors and actions
  const categoryMap = {
    'payment':  { color: '#FF6B6B', actions: [{ action: 'open', title: '📋 Открыть' }, { action: 'dismiss', title: 'Позже' }] },
    'habit':    { color: '#4DA6FF', actions: [{ action: 'open', title: '⚡ Отметить' }, { action: 'dismiss', title: 'Позже' }] },
    'budget':   { color: '#F5C842', actions: [{ action: 'open', title: '📊 Посмотреть' }, { action: 'dismiss', title: 'ОК' }] },
    'weekly':   { color: '#2DE8B0', actions: [{ action: 'open', title: '📈 Открыть' }] },
    'welcome':  { color: '#4DA6FF', actions: [{ action: 'open', title: '🎉 Открыть' }] },
    'default':  { color: '#4DA6FF', actions: [{ action: 'open', title: 'Открыть' }] }
  };
  const cat = categoryMap[category] || categoryMap['default'];

  return {
    body,
    tag:   tag || 'nobile-' + (category || 'default'),
    icon:  ICON,
    badge: BADGE_SVG,
    image: category === 'weekly' ? undefined : undefined, // placeholder for future rich images
    vibrate: category === 'payment' ? [200, 100, 200, 100, 400] : [150, 80, 150],
    requireInteraction: category === 'payment',
    silent: false,
    actions: cat.actions,
    data: { category, amount, date, url: './' },
    // Android: these show in the notification shade
    timestamp: Date.now(),
    renotify: false
  };
}

/* ── Notification click ── */
self.addEventListener('notificationclick', e => {
  e.notification.close();

  const action = e.action;
  const data   = e.notification.data || {};

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Focus existing window or open new
      const existing = list.find(c => c.url && c.url.includes('nobile'));
      if (existing) {
        existing.focus();
        // Post message to navigate if needed
        existing.postMessage({ type: 'NOTIF_CLICK', category: data.category, action });
        return;
      }
      return clients.openWindow(data.url || './');
    })
  );
});

/* ── Notification close ── */
self.addEventListener('notificationclose', e => {
  // Analytics placeholder
});

/* ── Background check (called via message) ── */
async function checkAndNotify(payload) {
  if (!payload) return;
  const { recurringPayments, todayKey } = payload;

  if (!recurringPayments) return;

  const today = new Date();
  recurringPayments.forEach(r => {
    if (!r || !r.id) return;
    const due = new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth);
    const diff = Math.round((due - today) / 86400000);
    if (diff >= 0 && diff <= 3) {
      const when = diff === 0 ? 'сегодня' : `через ${diff} дн.`;
      self.registration.showNotification(
        `⏰ Платёж: ${r.name}`,
        buildNotifOptions(
          `payment-${r.id}`,
          `${(+r.amount).toLocaleString('ru')} ₽ — ${when} (${r.dayOfMonth} числа)`,
          'payment', r.amount, r.dayOfMonth
        )
      );
    }
  });
}
