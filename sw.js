/* Nobile Service Worker — push + offline cache */
const CACHE = 'nobile-v1';
const ASSETS = ['./','./index.html','./index_nobile_v4.css','./js/db.js','./js/logic.js','./js/ui.js','./js/main.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(clients.claim());
});
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match('./index.html')))
  );
});
// Show notification from main thread message
self.addEventListener('message', e => {
  if (e.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body, tag, icon } = e.data;
    e.waitUntil(
      self.registration.showNotification(title, {
        body,
        tag: tag || 'nobile',
        icon: icon || './icons/nobile-logo-192.png',
        badge: './icons/nobile-logo-192.png',
        vibrate: [100, 50, 100],
        requireInteraction: false,
        silent: false
      })
    );
  }
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
      if (list.length) return list[0].focus();
      return clients.openWindow('./');
    })
  );
});
