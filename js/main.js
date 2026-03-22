/* Auto-split from original js/app.js. Global scripts only: no imports/exports. */

(function () {
  function bindGlobalEventHandlers() {
    document.addEventListener('click', e => {
      if (!e.target.closest('.hab-swipe-wrap')) {
        document.querySelectorAll('.hab-swipe-wrap.swiped').forEach(w => w.classList.remove('swiped'));
      }
    });

    const profileBtn = document.getElementById('btn-profile');
    if (profileBtn) {
      profileBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        const menu = document.getElementById('prof-menu');
        if (menu) menu.classList.toggle('open');
      });
    }

    document.addEventListener('click', function () {
      const menu = document.getElementById('prof-menu');
      if (menu) menu.classList.remove('open');
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

