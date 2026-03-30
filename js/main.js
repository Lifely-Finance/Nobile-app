/* Auto-split from original js/app.js. Global scripts only: no imports/exports. */

(function () {
  function bindGlobalEventHandlers() {
    document.addEventListener('click', e => {
      if (!e.target.closest('.hab-swipe-wrap')) {
        document.querySelectorAll('.hab-swipe-wrap.swiped').forEach(w => w.classList.remove('swiped'));
      }
    });
  }

  function wireServiceWorkerMessages() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.addEventListener('message', event => {
      const data = event.data || {};
      if (data.type !== 'NOTIF_CLICK' || data.action === 'dismiss') return;
      const pageByCategory = {
        payment: 'capital',
        budget: 'growth',
        habit: 'system',
        weekly: 'today',
        welcome: 'today',
        default: 'today'
      };
      const page = pageByCategory[data.category] || 'today';
      if (typeof navTo === 'function') navTo(page);
      if (data.category === 'payment') {
        setTimeout(() => {
          const btn = document.querySelector('[data-cap="payments"]');
          if (btn) btn.click();
        }, 150);
      }
    });
  }

  async function ensureServiceWorkerRegistered() {
    if (!('serviceWorker' in navigator)) return null;
    if (window._swReg) return window._swReg;
    try {
      const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      window._swReg = reg;
      navigator.serviceWorker.ready.then(() => {
        try { if (typeof scheduleNotifications === 'function') scheduleNotifications(); } catch (e) {}
      });
      return reg;
    } catch (e) {
      console.warn('SW registration failed:', e);
      return null;
    }
  }

  function initApp() {
    const txDateEl = document.getElementById('tx-date');
    if (txDateEl) txDateEl.value = todayISO();
    ensureServiceWorkerRegistered();
    wireServiceWorkerMessages();

    try {
      bootApp();
    } catch (e) {
      console.error('Boot error:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindGlobalEventHandlers();
      initApp();
    });
  } else {
    bindGlobalEventHandlers();
    initApp();
  }
})();
