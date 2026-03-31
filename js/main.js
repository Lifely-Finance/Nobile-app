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

      // SW отправляет { type: 'NAVIGATE', deeplink: '...' } при клике на уведомление
      if (data.type === 'NAVIGATE' && data.deeplink) {
        handleDeeplink(data.deeplink);
        return;
      }

      // Оставлено для обратной совместимости на случай других источников
      if (data.type === 'NOTIF_CLICK' && data.action !== 'dismiss') {
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
      }
    });
  }

  /**
   * Разбирает deeplink и выполняет навигацию.
   * Формат deeplink: "page" или "page/sub" или "page?param=value"
   */
  function handleDeeplink(deeplink) {
    if (!deeplink || typeof navTo !== 'function') return;
    try {
      const [pathPart] = deeplink.split('?');
      const [page, sub] = pathPart.split('/');
      navTo(page || 'today');
      if (sub) {
        // Небольшая задержка, чтобы страница успела отрисоваться
        setTimeout(() => {
          const btn = document.querySelector(`[data-cap="${sub}"]`);
          if (btn) btn.click();
        }, 150);
      }
    } catch (e) {
      console.warn('handleDeeplink error:', e);
    }
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

  /**
   * При возврате на вкладку переотправляем расписание в SW.
   * Это компенсирует потерю setTimeout-таймеров при выгрузке SW браузером.
   */
  function wireVisibilityReschedule() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        try {
          if (typeof scheduleNotifications === 'function') scheduleNotifications();
        } catch (e) {}
      }
    });
  }

  function initApp() {
    const txDateEl = document.getElementById('tx-date');
    if (txDateEl) txDateEl.value = todayISO();
    ensureServiceWorkerRegistered();
    wireServiceWorkerMessages();
    wireVisibilityReschedule();

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
