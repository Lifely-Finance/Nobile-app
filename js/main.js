/* Auto-split from original js/app.js. Global scripts only: no imports/exports. */

(function () {
  function bindGlobalEventHandlers() {
    document.addEventListener('click', e => {
      if (!e.target.closest('.hab-swipe-wrap')) {
        document.querySelectorAll('.hab-swipe-wrap.swiped').forEach(w => w.classList.remove('swiped'));
      }
    });
  }

  function initApp() {
    const txDateEl = document.getElementById('tx-date');
    if (txDateEl) txDateEl.value = todayISO();

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
