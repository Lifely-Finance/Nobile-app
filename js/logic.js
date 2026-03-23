/* Auto-split from original js/app.js. Global scripts only: no imports/exports. */

/* ═══════════════════════════════════════
   DATES & MONTH UTILS
═══════════════════════════════════════ */
const MONTHS_RU = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const DAYS_RU   = ['вс','пн','вт','ср','чт','пт','сб'];


  const now = new Date();
  now.setMonth(now.getMonth() + (DB.settings.monthOffset || 0));
  return { year: now.getFullYear(), month: now.getMonth() };
}

function periodLabel() {
  const { year, month } = currentPeriod();
  return MONTHS_RU[month] + ' ' + year;
}

function fmtDate(isoStr) {
  const d = new Date(isoStr);
  return d.getDate() + ' ' + MONTHS_RU[d.getMonth()].slice(0,3) + '.';
}

function todayISO() {
  return localDateISO(new Date());
}
function localDateISO(d) {
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}

function changeMonth(dir) {
  DB.settings.monthOffset = (DB.settings.monthOffset || 0) + dir;
  saveDB(); renderAll();
}

/* ═══════════════════════════════════════
   TRANSACTIONS
═══════════════════════════════════════ */
let _txType = 'income';
let _editTxId = null;
let _editAssetId = null;

function setTxType(type) {
  _txType = type;
  const segs = { income: document.getElementById('seg-income'), expense: document.getElementById('seg-expense') };
  Object.entries(segs).forEach(([k,el]) => {
    el.className = 'seg' + (k===type ? ' on-'+type : '');
  
  document.getElementById('tx-sheet-title').textContent = type==='income' ? 'Добавить доход' : 'Добавить расход';
}

function saveTx() {
  const amount = parseFloat(document.getElementById('tx-amount').value);
  const desc   = document.getElementById('tx-desc').value.trim();
  const cat    = document.getElementById('tx-category').value;
  const date   = document.getElementById('tx-date').value || todayISO();

  if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
  if (!desc) { showToast('Введите описание'); return; }

  const wasEdit = !!_editTxId; // capture BEFORE any reset

  if (_editTxId) {
    const idx = DB.transactions.findIndex(t => t.id === _editTxId);
    if (idx >= 0) DB.transactions[idx] = { ...DB.transactions[idx], type: _txType, amount, desc, category: cat, date };
    _editTxId = null;
    showToast('✅ Операция обновлена');
  } else {
    DB.transactions.push({ id: Date.now(), type: _txType, amount, desc, category: cat, date });
    showToast(_txType === 'income' ? '✅ Доход добавлен' : '✅ Расход добавлен');
  }

  saveDB();
  checkDailyChallengeAuto();
  closeSheet('tx');
  renderAll();
  document.getElementById('tx-amount').value = '';
  document.getElementById('tx-desc').value = '';
  // Trigger Smart Income Entry for NEW income entries (not edits)
  if (_txType === 'income' && !wasEdit) {
    setTimeout(() => showSmartIncomeOverlay(amount), 300);
    return; // Wait for user confirmation before closing
  }
}

function deleteTx(id) {
  DB.transactions = DB.transactions.filter(t => t.id !== id);
  saveDB(); renderAll(); showToast('Операция удалена');
}

function swipeTx(id) {
  const card = document.querySelector(`[data-tx-id="${id}"]`);
  if (!card) return;
  const isOpen = card.classList.contains('swiped');
  document.querySelectorAll('.tx-swipe-wrap.swiped').forEach(c => c.classList.remove('swiped'));
  if (!isOpen) card.classList.add('swiped');
  // Close on outside click
  setTimeout(() => {
    document.addEventListener('click', function closeTxSwipes(e) {
      if (!e.target.closest('.tx-swipe-wrap')) {
        document.querySelectorAll('.tx-swipe-wrap.swiped').forEach(c => c.classList.remove('swiped'));
        document.removeEventListener('click', closeTxSwipes);
      }
    });
  }, 0);
}

function swipeAsset(id) {
  const card = document.querySelector(`[data-asset-id="${id}"]`);
  if (!card) return;
  const isOpen = card.classList.contains('swiped');
  document.querySelectorAll('[data-asset-id].swiped').forEach(c => c.classList.remove('swiped'));
  if (!isOpen) card.classList.add('swiped');
}

function deleteTxConfirm(id) {
  document.querySelectorAll('.tx-swipe-wrap.swiped').forEach(c => c.classList.remove('swiped'));
  const t = DB.transactions.find(x => x.id === id);
  const name = t ? `«${t.desc || t.category}»` : 'эту операцию';
  const amt  = t ? ` — ${t.amount.toLocaleString('ru')} ₽` : '';
  if (!confirm(`Удалить операцию ${name}${amt}?`)) return;
  DB.transactions = DB.transactions.filter(x => x.id !== id);
  saveDB(); renderAll(); showToast('🗑 Операция удалена');
}

function deleteAssetConfirm(id) {
  document.querySelectorAll('[data-asset-id].swiped').forEach(c => c.classList.remove('swiped'));
  const a = DB.assets.find(x => x.id === id);
  const name = a ? `«${a.name}»` : 'этот актив';
  const amt  = a ? ` — ${a.amount.toLocaleString('ru')} ₽` : '';
  if (!confirm(`Удалить актив ${name}${amt}?`)) return;
  DB.assets = DB.assets.filter(x => x.id !== id);
  saveDB(); renderAll(); showToast('🗑 Актив удалён');
}

function editTx(id) {
  document.querySelectorAll('.tx-swipe-wrap.swiped').forEach(c => c.classList.remove('swiped'));
  const t = DB.transactions.find(x => x.id === id);
  if (!t) return;
  _editTxId = id;
  // Pre-fill tx sheet
  const typeEl = document.getElementById('tx-type-income');
  const typeExpEl = document.getElementById('tx-type-expense');
  if (t.type === 'income') { typeEl && typeEl.click(); }
  else { typeExpEl && typeExpEl.click(); }
  const amountEl = document.getElementById('tx-amount');
  const descEl   = document.getElementById('tx-desc');
  const dateEl   = document.getElementById('tx-date');
  if (amountEl) amountEl.value = t.amount;
  if (descEl)   descEl.value   = t.desc || '';
  if (dateEl)   dateEl.value   = t.date;
  // Select category using the <select> element
  const catEl = document.getElementById('tx-category');
  if (catEl) catEl.value = t.category || 'other';
  openSheet('tx');
}

function openNewAssetSheet() {
  _editAssetId = null;
  openSheet('asset');
  setTimeout(() => {
    const nameEl = document.getElementById('asset-name');
    const amountEl = document.getElementById('asset-amount');
    const customTypeEl = document.getElementById('asset-type-custom');
    if (nameEl) nameEl.value = '';
    if (amountEl) amountEl.value = '';
    if (customTypeEl) customTypeEl.value = '';
    if (typeof renderAssetTypeOptions === 'function') renderAssetTypeOptions('savings', '');
  }, 0);
}

function editAsset(id) {
  document.querySelectorAll('[data-asset-id].swiped').forEach(c => c.classList.remove('swiped'));
  openSheet('asset');
  setTimeout(() => {
    const a = DB.assets.find(x => x.id === id);
    if (!a) return;
    _editAssetId = id;
    const nameEl = document.getElementById('asset-name');
    const amountEl = document.getElementById('asset-amount');
    if (nameEl) nameEl.value = a.name;
    if (amountEl) amountEl.value = a.amount;

    const meta = typeof getAssetTypeMeta === 'function' ? getAssetTypeMeta(a.type) : { id: a.type, custom: false };
    const selectType = meta.custom ? 'custom' : meta.id;
    const customType = meta.custom ? (a.type || '') : '';
    if (typeof renderAssetTypeOptions === 'function') renderAssetTypeOptions(selectType, customType);
  }, 50);
}

function getMonthTx() {
  const { year, month } = currentPeriod();
  return DB.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear()===year && d.getMonth()===month;
  });
}

/* ═══════════════════════════════════════
   HABITS — категории, пресеты, факты
═══════════════════════════════════════ */
const HABIT_PRESETS = {
  health: [
    { name:'Спортзал / тренировка', emoji:'🏃', why:'80% миллионеров занимаются спортом минимум 4 раза в неделю' },
    { name:'Прогулка 30 минут', emoji:'🚶', why:'Прогулка снижает кортизол и улучшает фокус на 2–3 часа' },
    { name:'Стакан воды утром', emoji:'💧', why:'Регидратация после сна запускает метаболизм и мозг' },
    { name:'Здоровый завтрак', emoji:'🥗', why:'Люди с регулярным завтраком продуктивнее на 40%' },
    { name:'Сон 7–8 часов', emoji:'😴', why:'Уолтер Айзексон: Джобс считал сон главным инструментом креативности' },
    { name:'Холодный душ', emoji:'🧊', why:'Повышает уровень дофамина на 250% — природный антидепрессант' },
  ],
  mind: [
    { name:'Чтение 20–30 минут', emoji:'📚', why:'Баффет читает 500 страниц в день. Билл Гейтс — 50 книг в год' },
    { name:'Изучение языка', emoji:'🦜', why:'Билингвы принимают более взвешенные финансовые решения' },
    { name:'Медитация 10 минут', emoji:'🧘', why:'Mediation — обязательная практика 80% топ-CEO из Forbes' },
    { name:'Ведение дневника', emoji:'✍️', why:'Марк Аврелий, Дарвин, Эйнштейн — все вели ежедневные записи' },
    { name:'Подкаст / аудиокнига', emoji:'🎧', why:'Слушая 1 ч/день — это эквивалент 1 книги в неделю' },
    { name:'Изучение нового навыка', emoji:'🎯', why:'Люди, учащиеся постоянно, зарабатывают на 30% больше за 5 лет' },
  ],
  discipline: [
    { name:'Ранний подъём (до 7:00)', emoji:'⏰', why:'90% успешных людей встают до 6 утра — Apple, Disney, Twitter CEO' },
    { name:'Планирование дня с утра', emoji:'📋', why:'5 минут планирования экономят 2 часа хаоса' },
    { name:'Без соцсетей до 10:00', emoji:'📵', why:'Первый час — самый продуктивный. Соцсети его крадут' },
    { name:'Правило 2 минут', emoji:'⚡', why:'Если задача занимает &lt;2 мин — делай сразу. Правило Дэвида Аллена' },
    { name:'Вечерний разбор дня', emoji:'🌙', why:'Стоики называли это «экзамен совести» — ежедневный личный аудит' },
    { name:'Список 3 главных задач', emoji:'✅', why:'Фокус на 3 делах даёт больше результата чем список из 20' },
  ],
  finance: [
    { name:'Записывать все траты', emoji:'💸', why:'Люди, ведущие учёт трат, тратят на 15–20% меньше' },
    { name:'Не тратить первые 24 ч', emoji:'🛑', why:'Правило 24 часов устраняет 80% импульсивных покупок' },
    { name:'Изучать финансы 15 мин', emoji:'📈', why:'Уоррен Баффет стал миллионером в 30 — начал в 11 лет' },
    { name:'Проверять баланс каждый день', emoji:'💰', why:'Осознанность = контроль. Нельзя управлять тем, что не замеряешь' },
    { name:'Откладывать % с каждого дохода', emoji:'🏦', why:'Правило Рокфеллера: платить себе первым — до всех расходов' },
  ],
  social: [
    { name:'Звонок близкому человеку', emoji:'📞', why:'Крепкие связи — #1 предиктор счастья (Гарвардское исследование)' },
    { name:'Сказать кому-то «спасибо»', emoji:'🙏', why:'Благодарность повышает уровень дофамина и укрепляет отношения' },
    { name:'Нетворкинг / новое знакомство', emoji:'🤝', why:'85% вакансий закрываются через личные связи, не резюме' },
    { name:'Помочь кому-то', emoji:'❤️', why:'Альтруизм снижает стресс и повышает самооценку — доказано наукой' },
  ],
  custom: []
};

const HABIT_FACTS = [
  'Аристотель: «Мы — это то, что мы делаем постоянно. Совершенство — не действие, а привычка»',
  '66 дней — столько нужно для формирования настоящей привычки (UCL, 2010)',
  'Тим Кук (Apple CEO) встаёт в 3:45 утра и начинает день с чтения email и тренировки',
  'Баффет читает 500 страниц в день и называет знания «сложными процентами для ума»',
  'Навальный Джо (Naval Ravikant): «Дай мне твои привычки — и я скажу кем ты станешь через 5 лет»',
  'Исследование Duke University: 40% действий в день — это не решения, а автоматические привычки',
  'Джеймс Клир: «Вы не растёте до уровня своих целей. Вы падаете до уровня своих систем»',
  'Марк Цукерберг, Стив Джобс, Эйнштейн — все носили одну одежду, чтобы сэкономить силу воли',
  'Каждая пропущенная привычка снижает самооценку. Каждое выполнение — повышает',
  'Люди с 5+ регулярными привычками достигают целей в 3 раза чаще (исследование Stanford)',
];

let _selectedHabitCat = 'health';
let _selectedPreset   = null;
let _habitEmoji       = '🏃';
let _editHabitId      = null;
let _freqMode         = 'daily'; // 'daily','weekdays','weekend','custom'

function swipeHabit(id) {
  const wrap = document.querySelector(`.hab-swipe-wrap[data-hab-id="${id}"]`);
  if (!wrap) return;
  const isSwiped = wrap.classList.contains('swiped');
  document.querySelectorAll('.hab-swipe-wrap.swiped').forEach(w => w.classList.remove('swiped'));
  if (!isSwiped) wrap.classList.add('swiped');
}

// Attach touch-swipe listeners to all habit cards
function initHabSwipe() {
  document.querySelectorAll('.hab-swipe-wrap').forEach(wrap => {
    if (wrap._swipeInit) return;
    wrap._swipeInit = true;
    let tx0 = 0, ty0 = 0;

    wrap.addEventListener('touchstart', e => {
      tx0 = e.touches[0].clientX;
      ty0 = e.touches[0].clientY;
    }, {passive: true});

    wrap.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - tx0;
      const dy = e.changedTouches[0].clientY - ty0;
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return; // tap, not swipe
      if (Math.abs(dy) > Math.abs(dx)) return;             // vertical scroll
      if (dx < -40) {
        document.querySelectorAll('.hab-swipe-wrap.swiped').forEach(w => w.classList.remove('swiped'));
        wrap.classList.add('swiped');
      } else if (dx > 40) {
        wrap.classList.remove('swiped');
      }
    }, {passive: true});
  });
}

function deleteHabitConfirm(id) {
  const h = DB.habits.find(x=>x.id===id);
  if (!h) return;
  const ov = document.createElement('div');
  ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:19999;display:flex;align-items:flex-end;padding:16px;box-sizing:border-box';
  const box = document.createElement('div');
  box.style.cssText = 'background:var(--s1);border:1px solid var(--line);border-radius:20px;padding:20px;width:100%;max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:12px';
  box.innerHTML = `<div style="font-size:1.4rem;text-align:center">${h.emoji}</div>
    <div style="font-family:Syne,sans-serif;font-size:.95rem;font-weight:800;text-align:center">Удалить привычку?</div>
    <div style="font-size:.8rem;color:var(--muted);text-align:center;line-height:1.5">«${h.name}» — вся история выполнений будет удалена.</div>`;
  const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px';
  const bc = document.createElement('button'); bc.style.cssText = 'flex:1;background:var(--s2);border:1px solid var(--line);color:var(--text);padding:13px;border-radius:14px;font-family:Syne,sans-serif;font-size:.88rem;font-weight:700;cursor:pointer'; bc.textContent='Отмена'; bc.onclick=()=>ov.remove();
  const bd = document.createElement('button'); bd.style.cssText = 'flex:1;background:var(--coral);border:none;color:white;padding:13px;border-radius:14px;font-family:Syne,sans-serif;font-size:.88rem;font-weight:700;cursor:pointer'; bd.textContent='Удалить'; bd.onclick=()=>{ deleteHabit(id); ov.remove(); };
  row.append(bc,bd); box.appendChild(row);
  ov.appendChild(box); document.body.appendChild(ov);
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.remove(); });
}

function openHabitSheet(editId) {
  _editHabitId    = editId || null;
  _selectedPreset = null;
  _freqMode       = 'daily';

  // Reset form fields
  document.getElementById('habit-name').value = '';
  document.getElementById('habit-benefit').style.display = 'none';
  document.getElementById('finance-habit-note').style.display = 'none';
  // Reset freq to daily
  document.querySelectorAll('#freq-presets .seg').forEach((s,i) => s.classList.toggle('on', i===0));
  document.getElementById('custom-days-picker').style.display = 'none';
  document.querySelectorAll('.day-btn').forEach(b => b.classList.add('on'));

  // Reset category to health using selectHabitCat (ensures list is also reset)
  const firstCatBtn = document.querySelector('.habit-cat-btn[data-cat="health"]');
  if (firstCatBtn) {
    _selectedHabitCat = 'health';
    document.querySelectorAll('.habit-cat-btn').forEach(b => b.classList.remove('on'));
    firstCatBtn.classList.add('on');
    renderHabitPresets('health');
  }

  // Random fact
  const fact = HABIT_FACTS[Math.floor(Math.random() * HABIT_FACTS.length)];
  const factEl = document.getElementById('habit-fact-text');
  if (factEl) factEl.textContent = fact;

  // Edit mode — restore all fields
  if (_editHabitId) {
    const h = DB.habits.find(x=>x.id===_editHabitId);
    if (h) {
      document.getElementById('habit-name').value = h.name;
      _habitEmoji = h.emoji;

      // Restore category
      const cat = h.category || 'health';
      _selectedHabitCat = cat;
      document.querySelectorAll('.habit-cat-btn').forEach(b => b.classList.toggle('on', b.dataset.cat === cat));
      renderHabitPresets(cat);
      if (cat === 'finance') document.getElementById('finance-habit-note').style.display = 'block';

      // Restore frequency
      if (h.freq) {
        const isCustom = h.freq.startsWith('custom:');
        const mode = isCustom ? 'custom' : h.freq;
        _freqMode = mode;
        document.querySelectorAll('#freq-presets .seg').forEach(s => {
          s.classList.toggle('on', s.getAttribute('onclick')?.includes("'" + mode + "'"));
        });
        if (isCustom) {
          const customDays = h.freq.replace('custom:','').split(',').map(Number);
          document.getElementById('custom-days-picker').style.display = 'flex';
          document.querySelectorAll('.day-btn').forEach(b => {
            b.classList.toggle('on', customDays.includes(parseInt(b.dataset.day)));
          });
        } else {
          const dayMap = { daily:[0,1,2,3,4,5,6], weekdays:[1,2,3,4,5], weekend:[0,6] };
          document.querySelectorAll('.day-btn').forEach(b => {
            b.classList.toggle('on', (dayMap[mode]||[0,1,2,3,4,5,6]).includes(parseInt(b.dataset.day)));
          });
        }
      }

      document.querySelector('#sheet-habit .sheet-title').textContent = 'Редактировать привычку';
      document.querySelector('#sheet-habit [onclick="saveHabit()"]').textContent = 'Сохранить изменения';
    }
  } else {
    _habitEmoji = '🏃';
    document.querySelector('#sheet-habit .sheet-title').textContent = 'Новая привычка';
    document.querySelector('#sheet-habit [onclick="saveHabit()"]').textContent = 'Добавить привычку';
  }

  openSheet('habit');
}

function setFreqPreset(el, mode) {
  _freqMode = mode;
  document.querySelectorAll('#freq-presets .seg').forEach(s => s.classList.remove('on'));
  el.classList.add('on');
  const picker = document.getElementById('custom-days-picker');
  if (mode === 'custom') {
    picker.style.display = 'flex';
  } else {
    picker.style.display = 'none';
    // Preset days visual
    const dayMap = { daily:[0,1,2,3,4,5,6], weekdays:[1,2,3,4,5], weekend:[0,6] };
    document.querySelectorAll('.day-btn').forEach(b => {
      b.classList.toggle('on', (dayMap[mode]||[]).includes(parseInt(b.dataset.day)));
    });
  }
}

function getSelectedDays() {
  if (_freqMode === 'daily') return [0,1,2,3,4,5,6];
  if (_freqMode === 'weekdays') return [1,2,3,4,5];
  if (_freqMode === 'weekend') return [0,6];
  // custom
  return [...document.querySelectorAll('.day-btn.on')].map(b=>parseInt(b.dataset.day));
}

function toggleDayBtn(el) {
  el.classList.toggle('on');
}

function selectHabitCat(el, cat) {
  _selectedHabitCat = cat;
  _selectedPreset   = null;
  document.querySelectorAll('.habit-cat-btn').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  renderHabitPresets(cat);
  document.getElementById('habit-name').value = '';
  document.getElementById('habit-benefit').style.display = 'none';
  document.getElementById('finance-habit-note').style.display = cat==='finance' ? 'block' : 'none';
}

function renderHabitPresets(cat) {
  const presets = HABIT_PRESETS[cat] || [];
  const listEl  = document.getElementById('preset-habits-list');
  const groupEl = document.getElementById('preset-habits-group');
  if (presets.length === 0) { groupEl.style.display='none'; return; }
  groupEl.style.display = 'block';
  listEl.innerHT
