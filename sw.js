/* =====================================================
   NOBILE SERVICE WORKER v4.2.2
   ✓ Offline caching
   ✓ Scheduled notifications
   ✓ Deep-link navigation on notification tap
   ===================================================== */

const SW_VERSION = '4.2.2';
const CACHE_NAME = `nobile-cache-${SW_VERSION}`;

/* ── Assets to pre-cache ── */
const PRECACHE = [
  './',
  './index.html',
  './index_nobile_v4.css',
  './js/db.js',
  './js/logic.js',
  './js/ui.js',
  './js/main.js',
  './icons/nobile-logo-192.png',
  './icons/nobile-logo-512.png',
  './icons/nobile-notification.png',
  './icons/nobile-notification-large.png',
];

/* ── Notification icon paths ── */
const NOTIF_ICON  = './icons/nobile-notification-large.png';
const NOTIF_BADGE = './icons/nobile-notification.png';

/* ─────────────────────────────────────────────────
   INSTALL – cache assets
───────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE).catch(() => {}))
  );
  self.skipWaiting();
});

/* ─────────────────────────────────────────────────
   ACTIVATE – clean old caches
───────────────────────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ─────────────────────────────────────────────────
   FETCH – network-first, fall back to cache
───────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, copy));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});

/* ─────────────────────────────────────────────────
   MESSAGE – main thread → SW commands
───────────────────────────────────────────────── */
self.addEventListener('message', event => {
  const { type, payload } = event.data || {};

  switch (type) {
    case 'SCHEDULE_NOTIFICATIONS':
      scheduleAllNotifications(payload);
      break;
    case 'CANCEL_NOTIFICATIONS':
      cancelAll();
      break;
    case 'SEND_PUSH':
      showNotification(payload.title, payload.body, payload.tag, payload.deeplink, payload.actions);
      break;
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
  }
});

/* ─────────────────────────────────────────────────
   NOTIFICATION CLICK – deep-link navigation
───────────────────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  const deeplink = event.notification.data?.deeplink || '';
  const actionId = event.action;

  // Handle action buttons
  let targetDeeplink = deeplink;
  if (actionId === 'open_section') {
    targetDeeplink = event.notification.data?.actionDeeplink || deeplink;
  } else if (actionId === 'dismiss') {
    return; // Just close
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // Find existing open window
      const existing = clients.find(c => c.url && c.url.includes('index.html') || c.url.endsWith('/'));
      if (existing) {
        existing.focus();
        if (targetDeeplink) {
          existing.postMessage({ type: 'NAVIGATE', deeplink: targetDeeplink });
        }
        return;
      }
      // Open new window
      const url = self.registration.scope + (targetDeeplink ? `?deeplink=${encodeURIComponent(targetDeeplink)}` : '');
      return self.clients.openWindow(url);
    })
  );
});

/* ─────────────────────────────────────────────────
   PUSH (from server – future use)
───────────────────────────────────────────────── */
self.addEventListener('push', event => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      showNotification(data.title, data.body, data.tag || 'push', data.deeplink, data.actions)
    );
  } catch(e) {}
});

/* ─────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────── */
function showNotification(title, body, tag = 'nobile', deeplink = '', actions = []) {
  return self.registration.showNotification(title, {
    body,
    icon:  NOTIF_ICON,
    badge: NOTIF_BADGE,
    tag,
    data:  { deeplink },
    actions: actions.length ? actions : [
      { action: 'open_section', title: '→ Открыть' },
      { action: 'dismiss',      title: 'Закрыть' },
    ],
    requireInteraction: false,
    silent: false,
    vibrate: [200, 100, 200],
  });
}

/* ─────────────────────────────────────────────────
   SCHEDULED NOTIFICATIONS (alarm-based via postMessage)
   The main thread sends schedules; SW stores them and 
   fires via setTimeout chains kept alive in SW.
───────────────────────────────────────────────── */
let _timers = [];

function cancelAll() {
  _timers.forEach(t => clearTimeout(t));
  _timers = [];
}

function scheduleAllNotifications(schedule = []) {
  cancelAll();
  const now = Date.now();
  schedule.forEach(item => {
    const delay = item.ts - now;
    if (delay < 0) return;
    const t = setTimeout(() => {
      showNotification(item.title, item.body, item.tag, item.deeplink, item.actions || []);
    }, delay);
    _timers.push(t);
  });
}
