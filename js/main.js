/* Nobile: Main Logic Wrapper */

// 1. Создаем дату сразу, чтобы не было ReferenceError
const getTodayISO = () => new Date().toISOString().split('T')[0];
const todayISO = getTodayISO();

function bindGlobalEventHandlers() {
    // Обработка кликов по меню профиля
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
        if (menu) {
            if (menu.classList.contains('open')) menu.classList.remove('open');
        }
    });

    // Свайпы для привычек
    document.addEventListener('click', e => {
        if (!e.target.closest('.hab-swipe-wrap')) {
            document.querySelectorAll('.hab-swipe-wrap.swiped').forEach(w => w.classList.remove('swiped'));
        }
    });
}

function initApp() {
    console.log("Nobile: Инициализация...");
    const txDateEl = document.getElementById('tx-date');
    if (txDateEl) txDateEl.value = todayISO;

    try {
        // Проверяем, загружена ли функция входа, прежде чем запускать
        if (typeof bootApp === 'function') {
            bootApp();
        } else {
            console.warn("Nobile: bootApp еще не загружена.");
        }
    } catch (e) {
        console.error('Nobile: Ошибка загрузки (Boot error):', e);
    }
}

// Запуск при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        bindGlobalEventHandlers();
        initApp();
    });
} else {
    bindGlobalEventHandlers();
    initApp();
}
