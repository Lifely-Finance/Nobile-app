/* Auto-split from original js/app.js. Global scripts only: no imports/exports. */

/* ═══════════════════════════════════════
   DATES & MONTH UTILS
═══════════════════════════════════════ */
const MONTHS_RU = ['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
const DAYS_RU   = ['вс','пн','вт','ср','чт','пт','сб'];

function currentPeriod() {
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
  });
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
  listEl.innerHTML = presets.map((p,i) => `
    <div class="preset-habit" onclick="selectPreset(${i},'${cat}')" id="preset-${cat}-${i}">
      <div class="preset-habit-ico">${p.emoji}</div>
      <div class="preset-habit-info">
        <div class="preset-habit-name">${p.name}</div>
        <div class="preset-habit-why">${p.why}</div>
      </div>
      <div class="preset-habit-chk">✓</div>
    </div>`).join('');
}

function selectPreset(idx, cat) {
  _selectedPreset = idx;
  const preset = HABIT_PRESETS[cat][idx];
  document.querySelectorAll('.preset-habit').forEach(el=>el.classList.remove('selected'));
  document.getElementById(`preset-${cat}-${idx}`)?.classList.add('selected');
  document.getElementById('habit-name').value = preset.name;
  _habitEmoji = preset.emoji;
  document.querySelectorAll('#emoji-picker .seg').forEach(s=>s.className='seg');
  const benefitEl = document.getElementById('habit-benefit');
  benefitEl.style.display = 'block';
  benefitEl.innerHTML = `💡 <b>Почему работает:</b> ${preset.why}`;
  // Показываем заметку для финансовых привычек
  document.getElementById('finance-habit-note').style.display = cat==='finance' ? 'block' : 'none';
}

function pickEmoji(el, emoji) {
  _habitEmoji = emoji;
  document.querySelectorAll('#emoji-picker .seg').forEach(s=>s.className='seg');
  el.className = 'seg on-income';
}

function saveHabit() {
  const name = document.getElementById('habit-name').value.trim();
  if (!name) { showToast('Введите название'); return; }
  const days = getSelectedDays();
  if (days.length === 0) { showToast('Выберите хотя бы один день'); return; }
  const freq = _freqMode === 'daily' ? 'daily' : _freqMode === 'weekdays' ? 'weekdays' : _freqMode === 'weekend' ? 'weekend' : 'custom:' + days.join(',');

  if (_editHabitId) {
    const h = DB.habits.find(x=>x.id===_editHabitId);
    if (h) { h.name=name; h.emoji=_habitEmoji; h.freq=freq; h.category=_selectedHabitCat; }
    showToast('✅ Привычка обновлена');
  } else {
    DB.habits.push({ id:Date.now(), name, emoji:_habitEmoji, freq, category:_selectedHabitCat, completions:{} });
    showToast('✅ Привычка добавлена');
  }
  saveDB(); closeSheet('habit'); renderAll();
  _editHabitId = null;
}

function deleteHabit(id) {
  DB.habits = DB.habits.filter(h => h.id !== id);
  saveDB(); renderAll(); showToast('🗑 Привычка удалена');
}

function toggleHabitToday(habitId, dateStr) {
  // Unified with toggleHabit
  toggleHabit(habitId, dateStr);
}


function toggleHabit(habitId, dateStr) {
  const h = DB.habits.find(h => h.id === habitId);
  if (!h) return;
  if (!h.completions) h.completions = {};
  h.completions[dateStr] = !h.completions[dateStr];
  if (!h.completions[dateStr]) delete h.completions[dateStr];
  saveDB();
  // Reset animation flag so it can replay when all habits done again
  window._habAllDoneAnimating = false;
  checkDailyChallengeAuto();
  renderAll();
}

function getHabitStreak(habit) {
  let streak = 0, d = new Date();
  while (true) {
    const key = localDateISO(d);
    if (habit.completions?.[key]) streak++;
    else break;
    d.setDate(d.getDate()-1);
  }
  return streak;
}

/* ═══════════════════════════════════════
   ASSETS
═══════════════════════════════════════ */
function saveAsset() {
  const name = document.getElementById('asset-name').value.trim();
  const amount = parseFloat(document.getElementById('asset-amount').value);
  const presetType = document.getElementById('asset-type').value;
  const customType = document.getElementById('asset-type-custom')?.value.trim() || '';
  const type = customType || (presetType === 'custom' ? '' : presetType);
  if (!name) { showToast('Введите название'); return; }
  if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
  if (!type) { showToast('Укажите тип актива'); return; }

  if (_editAssetId) {
    const idx = DB.assets.findIndex(a => a.id === _editAssetId);
    if (idx >= 0) DB.assets[idx] = { ...DB.assets[idx], name, amount, type };
    _editAssetId = null;
    showToast('✅ Актив обновлён');
  } else {
    DB.assets.push({ id: Date.now(), name, amount, type });
    showToast('✅ Актив добавлен');
  }

  saveDB(); closeSheet('asset'); renderAll();
  document.getElementById('asset-name').value = '';
  document.getElementById('asset-amount').value = '';
  const customTypeEl = document.getElementById('asset-type-custom');
  if (customTypeEl) customTypeEl.value = '';
  if (typeof renderAssetTypeOptions === 'function') renderAssetTypeOptions('savings', '');
}

function deleteAsset(id) {
  DB.assets = DB.assets.filter(a => a.id !== id);
  saveDB(); renderAll(); showToast('Актив удалён');
}

/* ═══════════════════════════════════════
   INSIGHTS
═══════════════════════════════════════ */
const TAG_ICONS = { finance:'💰', habits:'⚡', book:'📚', life:'🌱', idea:'💡' };
const TAG_NAMES = { finance:'Финансы', habits:'Привычки', book:'Книга', life:'Жизнь', idea:'Идея' };

function saveInsight() {
  const title = document.getElementById('insight-title-inp').value.trim();
  const body  = document.getElementById('insight-body-inp').value.trim();
  const tag   = document.getElementById('insight-tag').value;
  if (!title) { showToast('Введите заголовок'); return; }
  DB.insights.push({ id: Date.now(), title, body, tag, date: todayISO() });
  saveDB(); checkDailyChallengeAuto(); closeSheet('insight'); showToast('✅ Инсайт сохранён'); renderInsights();
  document.getElementById('insight-title-inp').value = '';
  document.getElementById('insight-body-inp').value = '';
}

function deleteInsight(id) {
  DB.insights = DB.insights.filter(i => i.id !== id);
  saveDB(); renderInsights(); showToast('Инсайт удалён');
}

function filterInsights() {
  renderInsights(document.getElementById('insight-search').value);
}

/* ═══════════════════════════════════════
   TASKS & MOOD
═══════════════════════════════════════ */
function openAddTaskSheet() {
  const ti = document.getElementById('task-input');
  const tt = document.getElementById('task-time');
  if (ti) ti.value = '';
  if (tt) tt.value = '';
  openSheet('add-task');
  setTimeout(() => { if (ti) ti.focus(); }, 300);
}

function addTask() {
  const text = document.getElementById('task-input')?.value.trim();
  const pri  = document.getElementById('task-pri')?.value || 'mid';
  const time = document.getElementById('task-time')?.value || '';
  if (!text) { showToast('Введите задачу'); return; }
  const date = _plannerSelDate || todayISO();
  DB.tasks.push({ id: Date.now(), text, priority: pri, done: false, date, time });
  saveDB();
  document.getElementById('task-input').value = '';
  document.getElementById('task-time').value = '';
  closeSheet('add-task');
  renderPlanner();
  updatePlannerStats();
  showToast('✅ Задача добавлена');
}

// Quick add task from template
function quickAddTask(text) {
  const date = _plannerSelDate || todayISO();
  const pri = text.includes('💰') ? 'high' : text.includes('💳') ? 'high' : 'mid';
  DB.tasks.push({ id: Date.now(), text, priority: pri, done: false, date, time: '' });
  saveDB();
  renderPlanner();
  updatePlannerStats();
  showToast('✅ ' + text);
}

// Update planner statistics
function updatePlannerStats() {
  const total = DB.tasks.length;
  const done = DB.tasks.filter(t => t.done).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  
  const totalEl = document.getElementById('pl-stat-total');
  const doneEl = document.getElementById('pl-stat-done');
  const pctEl = document.getElementById('pl-stat-pct');
  
  if (totalEl) totalEl.textContent = total;
  if (doneEl) doneEl.textContent = done;
  if (pctEl) pctEl.textContent = pct + '%';
}

function toggleTask(id) {
  const t = DB.tasks.find(t => t.id === id);
  if (!t) return;
  t.done = !t.done;
  saveDB();
  renderPlanner();
  updatePlannerStats();
  renderAll();
}

function deleteTask(id) {
  DB.tasks = DB.tasks.filter(t => t.id !== id);
  saveDB(); renderPlanner(); updatePlannerStats(); renderAll();
}

// _plannerSelDate: currently selected date in planner
let _plannerSelDate = todayISO();
let _plannerCalOffset = 0; // months offset from today

function addMoodEntry(val) {
  const date = _plannerSelDate || todayISO();
  const now = new Date();
  const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
  // Migrate legacy single-value mood
  let entries = DB.mood[date];
  if (typeof entries === 'number') entries = [{ t: '—', v: entries }];
  if (!Array.isArray(entries)) entries = [];
  entries.push({ t: timeStr, v: val });
  DB.mood[date] = entries;
  saveDB();
  renderPlanner();
  showToast({5:'😄 Отлично!',4:'🙂 Хорошо',3:'😐 Нейтрально',2:'😕 Не очень',1:'😣 Плохо'}[val]);
}

function deleteMoodEntry(date, idx) {
  let entries = DB.mood[date];
  if (!Array.isArray(entries)) return;
  entries.splice(idx, 1);
  if (entries.length === 0) delete DB.mood[date];
  saveDB(); renderPlanner();
}

// Legacy setMood kept for compatibility
function setMood(el) { addMoodEntry(parseInt(el.dataset.mood)); }

/* ═══════════════════════════════════════
   CALCULATIONS
═══════════════════════════════════════ */
function calcStats() {
  const txs       = getMonthTx();
  const income    = txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount, 0);
  const savedAmount = txs.filter(t=>t.type==='expense'&&t.category==='savings').reduce((s,t)=>s+t.amount, 0);
  const expense   = txs.filter(t=>t.type==='expense'&&t.category!=='savings').reduce((s,t)=>s+t.amount, 0);
  const balance   = income - expense - savedAmount;
  const savingsRate = income > 0 ? Math.round(savedAmount/income*100) : 0;
  return { income, expense, savedAmount, balance, savingsRate };
}

function calcBudget5020(income, expense) {
  if (income === 0) return null;
  const needs   = income * 0.50;
  const wants   = income * 0.30;
  const savings = income * 0.20;
  const txs = getMonthTx();
  const cats = { needs: ['food','transport','housing','health'], wants: ['entertainment','clothes','other'], savings: ['savings'] };
  const factNeeds   = txs.filter(t=>t.type==='expense'&&cats.needs.includes(t.category)).reduce((s,t)=>s+t.amount,0);
  const factWants   = txs.filter(t=>t.type==='expense'&&cats.wants.includes(t.category)).reduce((s,t)=>s+t.amount,0);
  const factSavings = txs.filter(t=>t.type==='expense'&&cats.savings.includes(t.category)).reduce((s,t)=>s+t.amount,0);
  return { needs:{limit:needs,fact:factNeeds}, wants:{limit:wants,fact:factWants}, savings:{limit:savings,fact:factSavings} };
}

function renderBudgetItems(budget) {
  const defs = [
    { key:'needs',   label:'На жизнь',   pct:50, emoji:'🏠', ...budget.needs,   isSavings: false },
    { key:'wants',   label:'На желания', pct:30, emoji:'✨', ...budget.wants,   isSavings: false },
    { key:'savings', label:'Копилка',    pct:20, emoji:'🏦', ...budget.savings, isSavings: true  }
  ];
  return defs.map(i => {
    const factPct = i.limit > 0 ? Math.round(i.fact / i.limit * 100) : 0;
    let statusClass, statusText, barClass;
    if (i.isSavings) {
      if (factPct >= 100)      { statusClass='ok';   statusText='Цель достигнута ✓'; barClass='mint'; }
      else if (factPct >= 50)  { statusClass='warn'; statusText='Откладываем · '+factPct+'%'; barClass='gold'; }
      else if (factPct > 0)    { statusClass='warn'; statusText='Мало · '+factPct+'%'; barClass='gold'; }
      else                      { statusClass='warn'; statusText='Не откладывалось'; barClass='coral'; }
    } else {
      if (factPct <= 85)       { statusClass='ok';   statusText='В норме · '+factPct+'%'; barClass='mint'; }
      else if (factPct <= 100) { statusClass='warn'; statusText='Почти лимит · '+factPct+'%'; barClass='gold'; }
      else                      { statusClass='warn'; statusText='Перерасход · '+factPct+'%'; barClass='coral'; }
    }
    const barWidth = Math.min(100, factPct);
    const accentColor = barClass==='mint' ? 'var(--mint)' : barClass==='gold' ? 'var(--gold)' : 'var(--coral)';
    return `<div class="budget-item ${statusClass}" onclick="openBudgetDetail('${i.key}')" style="cursor:pointer;transition:transform .12s,box-shadow .12s" onmouseenter="this.style.transform='translateY(-1px)'" onmouseleave="this.style.transform=''">
      <div class="bi-top">
        <div class="bi-name">${i.emoji} ${i.label} <span style="color:var(--muted);font-weight:500;font-size:.75rem">${i.pct}%</span></div>
        <div class="bi-stat ${statusClass}">${statusText}</div>
      </div>
      <div class="pbar-track"><div class="pbar-fill ${barClass}" style="width:${barWidth}%"></div></div>
      <div class="bi-amounts mt4" style="display:flex;justify-content:space-between;align-items:center">
        <span>Факт: <b style="color:${accentColor}">${fmtRub(i.fact)}</b></span>
        <span style="color:var(--muted)">из ${fmtRub(Math.round(i.limit))}</span>
        <span style="font-size:.65rem;color:var(--muted)">Подробнее →</span>
      </div>
    </div>`;
  }).join('');
}

function calcScore(stats) {
  if (stats.income === 0) return null;
  let score = 0;
  if (stats.savingsRate >= 20) score += 40;
  else if (stats.savingsRate >= 10) score += 20;
  // Use monthly transactions count (not all-time) for fair scoring
  const monthTxCount = getMonthTx().length;
  if (monthTxCount >= 5) score += 30;
  else score += monthTxCount * 6;
  if (DB.habits.length > 0) score += 15;
  if (DB.assets.length > 0) score += 15;
  return Math.min(100, score);
}

/* ═══════════════════════════════════════
   STRATEGY CALC
═══════════════════════════════════════ */
let _selectedRate = 10;
function setRate(el, r) {
  _selectedRate = r; DB.settings.selectedRate = r; saveDB();
  document.querySelectorAll('#cap-strat .seg').forEach(s=>{s.className='seg'});
  el.className='seg on-income';
}
function calcStrategy() {
  const monthly = parseFloat(document.getElementById('strat-monthly').value) || 10000;
  const r = _selectedRate/100/12, n = 7*12;
  const start = DB.assets.reduce((s,a)=>s+a.amount,0);
  // Guard: avoid division by zero when r=0
  const fv = r === 0
    ? start + monthly * n
    : start*Math.pow(1+r,n) + monthly*((Math.pow(1+r,n)-1)/r);
  const total = Math.round(fv);
  const contributions = Math.round(monthly*n);
  const interest = total - contributions - start;
  const goal = DB.user.goal || 7900000;
  // Guard: yearsEst formula requires r > 0 and monthly*r < goal*r (i.e. goal reachable)
  let yearsEst = '?';
  if (r > 0 && monthly > 0) {
    const rawYears = Math.log((goal - start) * r / monthly + 1) / Math.log(1 + r) / 12;
    if (isFinite(rawYears) && rawYears > 0) yearsEst = Math.ceil(rawYears);
  }
  const goalPct = goal > 0 ? Math.round(total/goal*100) : 0;
  document.getElementById('strat-result').style.display='block';
  document.getElementById('sr-total').textContent = total.toLocaleString('ru') + ' ₽';
  document.getElementById('sr-rows').innerHTML = `
    <div style="display:flex;justify-content:space-between;font-size:.75rem;padding:3px 0;border-bottom:1px solid var(--line)"><span style="color:var(--muted)">Взносы за 7 лет</span><span style="font-weight:700">${contributions.toLocaleString('ru')} ₽</span></div>
    <div style="display:flex;justify-content:space-between;font-size:.75rem;padding:3px 0;border-bottom:1px solid var(--line)"><span style="color:var(--muted)">Процентный доход</span><span style="font-weight:700;color:var(--mint)">${Math.round(interest).toLocaleString('ru')} ₽</span></div>
    <div style="display:flex;justify-content:space-between;font-size:.75rem;padding:3px 0"><span style="color:var(--muted)">До цели ${goal.toLocaleString('ru')} ₽ (~${yearsEst} лет)</span><span style="font-weight:700;color:var(--gold)">${goalPct}%</span></div>
  `;
}

/* ═══════════════════════════════════════
   ACADEMY ENGINE
═══════════════════════════════════════ */

// ── Курсы (полная база) ──
const COURSES = [
  // ══════════════════════════════════════
  //  УРОВЕНЬ 1 — ОСНОВЫ
  // ══════════════════════════════════════
  { id:'c1', level:1, icon:'💰', color:'rgba(45,232,176,.12)', title:'Правило 50/30/20',
    desc:'Главный инструмент личного бюджета. Научись распределять каждый рубль автоматически.', xp:60, time:'5 мин',
    steps:[
      { type:'read', title:'Что такое правило 50/30/20?',
        body:'Правило 50/30/20 — самая простая система управления деньгами без сложных таблиц.\n\n**50%** дохода — на необходимое: еда, жильё, транспорт, коммуналка, кредиты.\n\n**30%** дохода — на желания: рестораны, развлечения, одежда, подписки.\n\n**20%** дохода — на будущее: накопления, инвестиции, погашение долгов сверх минимума.\n\nСистема работает на автопилоте — ты знаешь лимиты до того, как тратишь.' },
      { type:'example', title:'Кейс: Антон, 80 000 ₽/мес',
        story:'Антон получает 80 000 ₽ в месяц. Он никогда не вёл бюджет и каждый месяц удивлялся куда уходят деньги. Применил правило 50/30/20 и обнаружил что тратил 65% на желания.',
        calc:[
          {label:'50% — необходимое (аренда, еда, транспорт)', val:'40 000 ₽'},
          {label:'30% — желания (кафе, одежда, Netflix)', val:'24 000 ₽'},
          {label:'20% — накопления / инвестиции', val:'16 000 ₽'},
          {label:'За год накоплений:', val:'192 000 ₽'},
        ],
        conclusion:'За первый год по системе Антон накопил подушку безопасности в 3 месяца расходов. До этого у него не было ничего.' },
      { type:'quiz_multi', title:'Проверь себя — 3 вопроса',
        questions:[
          { q:'Если доход 120 000 ₽, сколько максимум на желания по правилу?',
            opts:['24 000 ₽','36 000 ₽','60 000 ₽','48 000 ₽'], correct:1,
            explain:'30% от 120 000 = 36 000 ₽. Всё что сверху — уже нарушение системы.' },
          { q:'Что входит в категорию «необходимое»?',
            opts:['Netflix и кафе','Аренда, еда, коммуналка','Одежда и развлечения','Любые регулярные платежи'], correct:1,
            explain:'Необходимое — то без чего нельзя жить. Подписки и рестораны — желания.' },
          { q:'Ты зарабатываешь 60 000 ₽. Сколько в месяц откладывать минимум?',
            opts:['6 000 ₽','10 000 ₽','12 000 ₽','20 000 ₽'], correct:2,
            explain:'20% от 60 000 = 12 000 ₽. Даже это за год даст 144 000 ₽ — хорошую подушку.' },
        ] },
      { type:'read', title:'Что если не получается откладывать 20%?',
        body:'Правило — это цель, а не приговор.\n\n**Начни с 5%** — это лучше чем 0%. Потом увеличивай на 1% каждые 2–3 месяца.\n\nЛайфхак: настрой автоплатёж на накопительный счёт в день зарплаты. Деньги уходят до того, как ты их увидел — и привыкаешь жить на остаток.\n\n**Маленький старт > идеальная система, которую ты никогда не начнёшь.**' },
      { type:'practice', title:'Рассчитай свой бюджет',
        desc:'Введи свой ежемесячный доход — посчитаем сколько куда идёт по правилу.',
        fields:[{id:'pr_income', label:'Доход в месяц (₽)', placeholder:'80000', type:'number'}],
        formula:`const v=parseFloat(f.pr_income)||0;
        if(!v) return '';
        const fmt=n=>Math.round(n).toLocaleString('ru');
        return \`<div class="prc-line"><span class="prc-lbl">🏠 Необходимое (50%)</span><span class="prc-val">\${fmt(v*.5)} ₽</span></div><div class="prc-line"><span class="prc-lbl">✨ Желания (30%)</span><span class="prc-val">\${fmt(v*.3)} ₽</span></div><div class="prc-line"><span class="prc-lbl">🏦 Накопления (20%)</span><span class="prc-val" style="color:var(--mint)">\${fmt(v*.2)} ₽</span></div><div class="prc-line"><span class="prc-lbl">📅 За год (копилка)</span><span class="prc-val" style="color:var(--gold)">\${fmt(v*.2*12)} ₽</span></div>\`;`,
        result:'' },
      { type:'task', title:'Действие: проверь свой бюджет сегодня',
        body:'Открой страницу Капитал → вкладка Бюджет. Посмотри в каком секторе (50/30/20) у тебя сейчас перерасход. Это твоя точка роста.',
        action:'Открыть бюджет →', target:'capital' },
    ]
  },

  { id:'c2', level:1, icon:'🏦', color:'rgba(77,166,255,.12)', title:'Сложный процент',
    desc:'Почему Эйнштейн называл его «восьмым чудом света» и как заставить его работать на тебя.', xp:70, time:'6 мин',
    steps:[
      { type:'read', title:'Сложный процент — деньги делают деньги',
        body:'Простой процент начисляется только на основную сумму.\nСложный — на сумму ПЛЮС уже начисленные проценты.\n\n**10 000 ₽ под 15% годовых:**\n• Год 1: 11 500 ₽\n• Год 3: 15 209 ₽\n• Год 7: 26 600 ₽\n• Год 15: 81 371 ₽\n• Год 20: 163 665 ₽\n\nДеньги умножились в 16 раз за 20 лет без единого действия с твоей стороны.' },
      { type:'example', title:'История двух друзей: Маша и Катя',
        story:'Обе хотели накопить на пенсию. В 25 лет Маша начала инвестировать 5 000 ₽/мес под 12% годовых и остановилась в 35. Катя начала в 35 и инвестировала до 65. Кто накопил больше?',
        calc:[
          {label:'Маша: инвестировала 10 лет (25–35)', val:'600 000 ₽ вложено'},
          {label:'Маша к 65 годам:', val:'≈ 15 900 000 ₽'},
          {label:'Катя: инвестировала 30 лет (35–65)', val:'1 800 000 ₽ вложено'},
          {label:'Катя к 65 годам:', val:'≈ 14 700 000 ₽'},
        ],
        conclusion:'Маша вложила в 3 раза меньше денег, но получила больше — потому что начала раньше. Время работает сильнее суммы.' },
      { type:'read', title:'Правило 72 — быстрый расчёт в уме',
        body:'Хочешь быстро понять когда удвоятся деньги?\n\n**72 ÷ годовая ставка % = лет до удвоения**\n\n• При 8% → 72÷8 = 9 лет\n• При 12% → 72÷12 = 6 лет\n• При 16% → 72÷16 = 4,5 года\n• При 24% → 72÷24 = 3 года\n\nКаждый год промедления с инвестициями — это упущенное удвоение.' },
      { type:'quiz_multi', title:'Проверь себя — 3 вопроса',
        questions:[
          { q:'При 12% годовых, через сколько лет удвоятся деньги по правилу 72?',
            opts:['4 года','6 лет','8 лет','12 лет'], correct:1,
            explain:'72 ÷ 12 = 6 лет. Запомни эту формулу — она пригодится всю жизнь.' },
          { q:'В чём разница между простым и сложным процентом?',
            opts:['В ставке','Простой — на сумму, сложный — на сумму и проценты','В сроке','Нет разницы'], correct:1,
            explain:'Именно реинвестирование процентов создаёт экспоненциальный рост.' },
          { q:'Маша начала инвестировать в 20, Петя в 40. При одинаковых ежемесячных взносах кто накопит больше к 65?',
            opts:['Петя — он опытнее','Маша — у неё больше времени','Одинаково','Зависит от суммы'], correct:1,
            explain:'Время — главный актив инвестора. 20 дополнительных лет часто важнее суммы взносов.' },
        ] },
      { type:'practice', title:'Калькулятор роста накоплений',
        desc:'Посчитай как вырастут твои деньги через годы.',
        fields:[
          {id:'cp_sum', label:'Начальная сумма (₽)', placeholder:'50000', type:'number'},
          {id:'cp_monthly', label:'Ежемесячный взнос (₽)', placeholder:'10000', type:'number'},
          {id:'cp_rate', label:'Годовая ставка (%)', placeholder:'12', type:'number'},
          {id:'cp_years', label:'Лет', placeholder:'10', type:'number'},
        ],
        formula:`const s=parseFloat(f.cp_sum)||0,m=parseFloat(f.cp_monthly)||0,r=(parseFloat(f.cp_rate)||12)/100/12,n=(parseFloat(f.cp_years)||10)*12;
if(!s && !m) return '';
const fut=Math.round(s*Math.pow(1+r,n)+m*(Math.pow(1+r,n)-1)/r);
const inv=Math.round(s+m*n);
const profit=Math.round(fut-inv);
const fmt=v=>v.toLocaleString('ru');
return \`<div class="prc-line"><span class="prc-lbl">💰 Итоговая сумма</span><span class="prc-val" style="color:var(--gold)">\${fmt(fut)} ₽</span></div><div class="prc-line"><span class="prc-lbl">📥 Вложено всего</span><span class="prc-val">\${fmt(inv)} ₽</span></div><div class="prc-line"><span class="prc-lbl">📈 Доход от процентов</span><span class="prc-val" style="color:var(--mint)">\${fmt(profit)} ₽</span></div><div class="prc-line"><span class="prc-lbl">📊 Прибыль x</span><span class="prc-val">\${inv>0?(fut/inv).toFixed(1):'∞'}×</span></div>\`;`,
        result:'' },
      { type:'task', title:'Открой калькулятор стратегии',
        body:'Зайди в Капитал → Стратегия. Поставь реальную сумму ежемесячных накоплений и посмотри когда достигнешь своей цели.',
        action:'К стратегии →', target:'capital' },
    ]
  },

  { id:'c3', level:1, icon:'🎯', color:'rgba(245,200,66,.12)', title:'Финансовая цель $100k',
    desc:'Как поставить первую большую цель и построить систему её достижения шаг за шагом.', xp:70, time:'5 мин',
    steps:[
      { type:'read', title:'Почему $100 000 — особая цифра?',
        body:'$100 000 (≈9 млн ₽) — это не просто красивое число. Это **первый порог финансовой свободы**.\n\nНа $100k при доходности 10% годовых ты получаешь $10 000 в год — пассивно.\nЭто ≈ 75 000 ₽/мес без какой-либо работы.\n\nДо этого порога ты работаешь на деньги.\nПосле — деньги начинают работать на тебя серьёзно.\n\nВот почему первый $100k — главная цель любого, кто хочет финансовой независимости.' },
      { type:'example', title:'Три пути к $100k — реальные цифры',
        story:'Три человека с одинаковым доходом 80 000 ₽/мес выбрали разные стратегии. Кто дошёл быстрее?',
        calc:[
          {label:'Иван: откладывает 10% (8 000 ₽) под 8%', val:'≈ 63 месяца = 5,3 года'},
          {label:'Дмитрий: откладывает 20% (16 000 ₽) под 12%', val:'≈ 36 месяца = 3 года'},
          {label:'Ольга: откладывает 30% (24 000 ₽) под 15%', val:'≈ 25 месяцев = 2 года'},
          {label:'Разница между Иваном и Ольгой:', val:'3,3 года жизни'},
        ],
        conclusion:'Норма сбережений важнее доходности. Каждый дополнительный процент откладываемого дохода экономит месяцы на пути к цели.' },
      { type:'read', title:'Система достижения большой цели',
        body:'Большая цель без системы — просто мечта. Вот как превратить $100k в план:\n\n**1. Разбей на годовые подцели**\nЕсли цель за 4 года — каждый год +2,25 млн ₽.\n\n**2. Установи автоплатёж**\nВ день зарплаты деньги автоматически уходят на накопительный счёт.\n\n**3. Увеличивай взнос с каждым ростом дохода**\nПовысили зарплату на 10 000 ₽ → добавь ещё 5 000 к накоплениям.\n\n**4. Не трогай**\nГлавное правило — не откатываться назад при искушениях.' },
      { type:'quiz_multi', title:'Проверь себя — 2 вопроса',
        questions:[
          { q:'Что даёт $100k при доходности 10% годовых?',
            opts:['Ничего особенного','$10 000/год пассивного дохода','$100 000/год','Возможность купить квартиру'], correct:1,
            explain:'10% от $100k = $10k/год ≈ 75 000 ₽/мес без усилий. Это и есть порог свободы.' },
          { q:'Что важнее для скорости достижения цели?',
            opts:['Высокая доходность','Большая начальная сумма','Высокая норма сбережений','Удача'], correct:2,
            explain:'Норма сбережений (% дохода который ты откладываешь) — главный рычаг. Её ты контролируешь полностью.' },
        ] },
      { type:'task', title:'Поставь свою цель прямо сейчас',
        body:'Зайди в Профиль → нажми «Изменить» цель. Введи реальную сумму к которой стремишься — хоть 500 000 ₽. Nobile будет показывать прогресс к ней каждый день.',
        action:'Открыть профиль →', target:'profile' },
    ]
  },

  { id:'c9', level:1, icon:'🛡️', color:'rgba(45,232,176,.1)', title:'Подушка безопасности',
    desc:'Почему это первое что нужно сделать с деньгами — и как рассчитать нужный размер.', xp:65, time:'5 мин',
    steps:[
      { type:'read', title:'Подушка безопасности — твой финансовый иммунитет',
        body:'Подушка безопасности — деньги на счёте, которые покрывают расходы если что-то пойдёт не так:\n\n• Потерял работу\n• Сломалась машина\n• Заболел и не можешь работать\n• Срочный ремонт\n\n**Без подушки** → любая неприятность = кредит или просьба у родных.\n**С подушкой** → спокойствие и время найти решение без давления.\n\nЭто не деньги «на чёрный день». Это твой финансовый иммунитет.' },
      { type:'example', title:'Кейс: Катя потеряла работу',
        story:'Катя работала менеджером с зарплатой 70 000 ₽. Компания сократила отдел. Сценарий А — подушки нет. Сценарий Б — есть 3 месяца расходов.',
        calc:[
          {label:'Сценарий А: нет подушки', val:'Взяла кредит 150 000 ₽ под 25%'},
          {label:'Нашла работу через 2 месяца', val:'Но платит кредит ещё 1,5 года'},
          {label:'Переплата за кредит:', val:'~45 000 ₽ лишних трат'},
          {label:'Сценарий Б: есть подушка 210 000 ₽', val:'Жила спокойно 3 месяца'},
          {label:'Нашла работу без спешки', val:'Выбрала лучший оффер, а не первый'},
          {label:'Финансовые потери:', val:'0 ₽'},
        ],
        conclusion:'Подушка — это не пассив. Это инвестиция в твою переговорную силу и психологическое спокойствие.' },
      { type:'read', title:'Сколько должна быть подушка?',
        body:'**Минимум:** 1 месяц расходов. Хоть что-то.\n**Норма:** 3 месяца расходов.\n**Идеал:** 6 месяцев расходов.\n\nГде хранить:\n• Накопительный счёт в банке — лучший вариант. Деньги доступны мгновенно и приносят 10–16%.\n• НЕ в инвестициях — рынок может упасть именно когда нужны деньги.\n• НЕ наличными дома — не защищены от инфляции.\n\n**Правило:** подушка не инвестируется, не тратится на «выгодные» покупки. Это неприкосновенный запас.' },
      { type:'quiz_multi', title:'Проверь себя — 2 вопроса',
        questions:[
          { q:'Где лучше всего хранить подушку безопасности?',
            opts:['В акциях для роста','На накопительном счёте','В криптовалюте','Дома наличными'], correct:1,
            explain:'Накопительный счёт: доступность + доходность 10–16%. Идеально для подушки.' },
          { q:'Ты тратишь 50 000 ₽/мес. Какой минимальный размер подушки — норма?',
            opts:['50 000 ₽','100 000 ₽','150 000 ₽','300 000 ₽'], correct:2,
            explain:'3 месяца × 50 000 = 150 000 ₽. Это норма. 300 000 — идеал (6 месяцев).' },
        ] },
      { type:'practice', title:'Рассчитай свою подушку',
        desc:'Сколько тебе нужно накопить и за сколько ты это сделаешь?',
        fields:[
          {id:'pb_expense', label:'Расходы в месяц (₽)', placeholder:'50000', type:'number'},
          {id:'pb_months', label:'Месяцев подушки (3–6)', placeholder:'3', type:'number'},
          {id:'pb_monthly', label:'Могу откладывать в мес (₽)', placeholder:'10000', type:'number'},
        ],
        formula:`const e=parseFloat(f.pb_expense)||50000,mo=parseFloat(f.pb_months)||3,s=parseFloat(f.pb_monthly)||5000;
const target=Math.round(e*mo);const months=s>0?Math.ceil(target/s):999;
const fmt=v=>v.toLocaleString('ru');
if(!s) return '';
return \`<div class="prc-line"><span class="prc-lbl">🎯 Цель подушки</span><span class="prc-val" style="color:var(--gold)">\${fmt(target)} ₽</span></div><div class="prc-line"><span class="prc-lbl">📅 Достигнешь за</span><span class="prc-val">\${months} мес. (~\${(months/12).toFixed(1)} лет)</span></div><div class="prc-line"><span class="prc-lbl">💰 Откладываю в мес.</span><span class="prc-val" style="color:var(--mint)">\${fmt(s)} ₽</span></div><div class="prc-line"><span class="prc-lbl">🛡 Покрытие расходов</span><span class="prc-val">\${mo} месяц(а)</span></div>\`;`,
        result:'' },
      { type:'task', title:'Начни копить прямо сейчас',
        body:'Добавь накопительный счёт как актив в Nobile. Даже 5 000 ₽ — это начало. Отложи в накопления сегодня, не завтра.',
        action:'Добавить накопления →', target:'capital' },
    ]
  },

  { id:'c10', level:1, icon:'💳', color:'rgba(255,107,107,.12)', title:'Долги и кредиты',
    desc:'Как отличить хороший долг от плохого и быстро выбраться из долговой ямы.', xp:75, time:'6 мин',
    steps:[
      { type:'read', title:'Хороший долг vs плохой долг',
        body:'Не все долги одинаково вредны.\n\n**Хороший долг** — приносит больше чем стоит:\n• Ипотека (актив растёт в цене)\n• Кредит на образование (увеличивает доход)\n• Бизнес-кредит с ROI > ставки\n\n**Плохой долг** — деньги утекают:\n• Кредитные карты (25–40%/год)\n• Микрозаймы (до 365%/год!)\n• Потребительские кредиты на гаджеты/одежду\n• Рассрочки на «необходимые» вещи\n\nПравило: если покупка дешевеет (телефон, одежда, отпуск) — не берёшь кредит.' },
      { type:'example', title:'Сколько реально стоит кредитная карта',
        story:'Алексей купил телевизор за 60 000 ₽ в кредит под 28% годовых и платит минимальный платёж 2 000 ₽/мес.',
        calc:[
          {label:'Стоимость телевизора:', val:'60 000 ₽'},
          {label:'Минимальный платёж:', val:'2 000 ₽/мес'},
          {label:'Срок погашения:', val:'≈ 7 лет (84 мес)'},
          {label:'Итого заплатит:', val:'≈ 108 000 ₽'},
          {label:'Переплата за телевизор:', val:'48 000 ₽ (80% от цены!)'},
          {label:'Ещё через 7 лет тот телевизор стоит:', val:'0–5 000 ₽ (устарел)'},
        ],
        conclusion:'Минимальный платёж — ловушка. Всегда плати максимум что можешь — экономишь месяцы и тысячи рублей.' },
      { type:'read', title:'Два метода погашения долгов',
        body:'Если есть несколько долгов — вот как их убивать:\n\n**Метод лавины (математически выгодный):**\nПлати минимум по всем → весь лишний свободный кэш на долг с НАИБОЛЬШЕЙ ставкой.\nКогда погасил — весь платёж на следующий по ставке.\n\n**Метод снежного кома (психологически лёгкий):**\nПлати минимум по всем → лишний кэш на НАИМЕНЬШИЙ долг.\nКаждое погашение = мотивация продолжать.\n\nВыбери тот, которому будешь следовать. Лучший метод — тот, который ты не бросишь.' },
      { type:'quiz_multi', title:'Проверь себя — 3 вопроса',
        questions:[
          { q:'Какой кредит можно считать «хорошим»?',
            opts:['На новый iPhone','На отпуск','Ипотека на квартиру','На шубу в рассрочку'], correct:2,
            explain:'Хороший долг — когда актив растёт или приносит доход больше ставки кредита.' },
          { q:'У тебя 3 долга: 8%, 22%, 35%. Метод лавины — куда направлять доп. платёж?',
            opts:['На долг 8%','На самый маленький','На долг 35%','Равными частями'], correct:2,
            explain:'Лавина — сначала самая дорогая ставка. Экономишь больше всего процентов.' },
          { q:'Алексей платит минимум 2 000 ₽ по карте с долгом 60 000 ₽ под 28%. Что правильнее?',
            opts:['Продолжать платить минимум','Платить 5–10 000 ₽ в месяц','Взять новый кредит','Забыть про долг'], correct:1,
            explain:'Каждый дополнительный рубль сверх минимума экономит годы и тысячи рублей процентов.' },
        ] },
      { type:'challenge', title:'7-дневный вызов: Аудит долгов',
        desc:'Выполни за неделю — и получи ясную картину своих обязательств.',
        days:[
          {day:1, task:'Запиши все свои долги: кому, сколько, под какой %'},
          {day:2, task:'Посчитай сколько платишь процентов в месяц суммарно'},
          {day:3, task:'Выбери метод (лавина или снежный ком) и запиши порядок погашения'},
          {day:4, task:'Найди где можно сократить расходы на 2 000–5 000 ₽ для доп. платежей'},
          {day:7, task:'Сделай первый доп. платёж сверх минимума по приоритетному долгу'},
        ] },
    ]
  },

  { id:'c11', level:1, icon:'📋', color:'rgba(167,139,250,.1)', title:'Бюджет на месяц',
    desc:'Зеро-бюджет и конвертный метод — два способа взять контроль над деньгами полностью.', xp:60, time:'5 мин',
    steps:[
      { type:'read', title:'Зеро-бюджетирование: каждый рубль получает задание',
        body:'Обычный бюджет: тратишь и смотришь что осталось.\n**Зеро-бюджет**: распределяешь весь доход ДО того как потратил.\n\nДоход − (все расходы + накопления) = 0\n\nКаждый рубль получает категорию:\n«Еда — 15 000», «Аренда — 30 000», «Кафе — 5 000», «Накопления — 10 000».\n\nЕсли деньги уже распределены — импульсивно потратить сложнее. Ты решаешь заранее.' },
      { type:'example', title:'Месячный бюджет Сергея, 90 000 ₽',
        story:'Сергей раньше не знал куда уходят деньги. Составил первый зеро-бюджет — и обнаружил что 12 000 ₽/мес уходит на подписки которыми он не пользуется.',
        calc:[
          {label:'Аренда + ЖКХ:', val:'32 000 ₽'},
          {label:'Продукты + хозтовары:', val:'14 000 ₽'},
          {label:'Транспорт:', val:'5 000 ₽'},
          {label:'Кафе и рестораны:', val:'8 000 ₽'},
          {label:'Одежда и прочее:', val:'6 000 ₽'},
          {label:'Подписки (выявил, часть отменил):', val:'3 000 ₽ (было 12k)'},
          {label:'Накопления:', val:'22 000 ₽ (было 0)'},
        ],
        conclusion:'Не урезав образ жизни, а просто сделав план — Сергей начал откладывать 22 000 ₽/мес. Деньги были, просто утекали незаметно.' },
      { type:'read', title:'Конвертный метод — для тех кто любит простоту',
        body:'Старый добрый метод: делишь наличные (или мысленно — суммы) по конвертам.\n\n**Конверт «Еда»:** 15 000 ₽. Закончились — не докладываешь из другого конверта.\n**Конверт «Развлечения»:** 8 000 ₽. Всё потратил — в этом месяце без кино.\n\nЖёсткие рамки создают осознанность. Ты физически видишь что осталось.\n\nЦифровой вариант: отдельные карты или счета для каждой категории.' },
      { type:'quiz_multi', title:'Проверь себя — 2 вопроса',
        questions:[
          { q:'В чём главная идея зеро-бюджета?',
            opts:['Тратить ноль денег','Доход минус расходы = 0 (всё распределено)','Экономить 50%','Не тратить на желания'], correct:1,
            explain:'Каждый рубль получает задание заранее — нет «лишних» денег которые непонятно куда уходят.' },
          { q:'Сергей обнаружил что платит 12 000 ₽/мес за неиспользуемые подписки. За год это:',
            opts:['72 000 ₽','120 000 ₽','144 000 ₽','36 000 ₽'], correct:2,
            explain:'12 000 × 12 = 144 000 ₽ в год. Больше месячной зарплаты среднего россиянина — за ничто.' },
        ] },
      { type:'task', title:'Составь бюджет следующего месяца',
        body:'Запиши свой доход в Nobile. Посмотри расходы прошлого месяца и составь план категорий. Это займёт 10 минут — и изменит твоё отношение к деньгам.',
        action:'Добавить доход →', target:'tx-income' },
    ]
  },

  // ══════════════════════════════════════
  //  УРОВЕНЬ 2 — СРЕДНИЙ
  // ══════════════════════════════════════
  { id:'c4', level:2, icon:'📈', color:'rgba(167,139,250,.12)', title:'Первые инвестиции',
    desc:'С чего начать, куда вложить первые деньги и как не потерять всё на старте.', xp:110, time:'7 мин',
    steps:[
      { type:'read', title:'Три инструмента начинающего инвестора',
        body:'**1. Накопительный счёт / вклад**\nРиск: нулевой. Доход: 10–16%/год. АСВ страхует до 1,4 млн ₽.\nИдеально для: подушки безопасности и краткосрочных целей (до 2 лет).\n\n**2. ОФЗ — гособлигации**\nРиск: минимальный. Доход: 11–14%/год. Государство гарантирует.\nИдеально для: консервативной части портфеля, горизонт 1–5 лет.\n\n**3. Индексные фонды (ETF)**\nРиск: средний. Доход: исторически 15–20%/год (долгосрочно).\nИдеально для: долгосрочных целей 5+ лет. Не для денег которые могут понадобиться.' },
      { type:'example', title:'Ольга инвестирует 10 000 ₽/мес — 3 стратегии',
        story:'Ольга, 30 лет, хочет накопить к 45. Сравниваем три подхода за 15 лет.',
        calc:[
          {label:'Только вклад 12%:', val:'≈ 4 990 000 ₽'},
          {label:'Только ОФЗ 13%:', val:'≈ 5 380 000 ₽'},
          {label:'Только ETF ~17% (исторически):', val:'≈ 7 900 000 ₽'},
          {label:'Смешанный 40/20/40:', val:'≈ 6 200 000 ₽'},
          {label:'Всего вложено Ольгой:', val:'1 800 000 ₽'},
        ],
        conclusion:'Разница между самой консервативной и агрессивной стратегией — почти 3 миллиона. Но ETF требует не трогать деньги при падениях рынка.' },
      { type:'read', title:'Золотое правило новичка',
        body:'**Не инвестируй деньги, которые могут понадобиться в течение года.**\n\nПочему? Рынок может упасть на 30–50% именно тогда когда тебе нужны деньги. Продать придётся в убыток.\n\nПорядок действий:\n1. Подушка безопасности (3–6 мес расходов на вкладе) ✓\n2. Погаши дорогие долги (> 15%) ✓\n3. ИИС с ОФЗ — начни с этого\n4. ETF — когда горизонт 5+ лет\n\nДа, скучно. Но это то что реально работает.' },
      { type:'read', title:'Риск и доходность — нерасторжимая пара',
        body:'Любое обещание «высокой доходности без риска» — ложь.\n\n**Треугольник инвестора:**\n• Надёжность\n• Доходность\n• Ликвидность\n\nМожно выбрать только ДВА из трёх. Всегда.\n\nВклад: надёжный + ликвидный = невысокая доходность.\nETF: доходный + ликвидный = риск просадок.\nНедвижимость: надёжная + доходная = низкая ликвидность.\n\nЗапомни треугольник — и ни один мошенник тебя не обманет.' },
      { type:'quiz_multi', title:'Проверь себя — 3 вопроса',
        questions:[
          { q:'Что нужно сделать ДО начала инвестирования в акции/ETF?',
            opts:['Найти горячие акции','Создать подушку безопасности','Изучить биткоин','Взять кредит на инвестиции'], correct:1,
            explain:'Без подушки ты рискуешь продать инвестиции в убыток при первой же необходимости.' },
          { q:'ОФЗ — это что?',
            opts:['Акции госкомпаний','Облигации федерального займа (гос.долг)','Криптовалюта ЦБ','Фонд недвижимости'], correct:1,
            explain:'ОФЗ — государственные облигации РФ. Государство берёт у тебя в долг и платит процент. Минимальный риск.' },
          { q:'Что из этого НЕЛЬЗЯ одновременно — надёжность, доходность, ликвидность?',
            opts:['Можно всё три','Нельзя — только два из трёх','Зависит от инструмента','Только в криптовалюте можно всё'], correct:1,
            explain:'Треугольник инвестора — фундаментальный закон. Обещание всего сразу = мошенничество.' },
        ] },
      { type:'practice', title:'Какой инструмент тебе подходит?',
        desc:'Ответь на вопросы — получишь рекомендацию.',
        fields:[
          {id:'inv_horizon', label:'Горизонт (лет)', placeholder:'5', type:'number'},
          {id:'inv_risk', label:'Готовность к риску (1=низкая, 3=высокая)', placeholder:'2', type:'number'},
        ],
        formula:`const h=parseFloat(f.inv_horizon)||3,r=parseFloat(f.inv_risk)||1;
let rec='',ico='',color='var(--blue)';
if(h<2||r==1){rec='Накопительный счёт или ОФЗ';ico='🏦';color='var(--blue)'}
else if(h<5||r==2){rec='60% ОФЗ + 40% индексный ETF';ico='⚖️';color='var(--gold)'}
else{rec='Широкий ETF на акции (MOEX / S&P500)';ico='📈';color='var(--mint)'}
const riskLabel=['','Низкая','Средняя','Высокая'][Math.round(r)]||'Средняя';
return \`<div class="prc-line"><span class="prc-lbl">\${ico} Рекомендация</span><span class="prc-val" style="color:\${color}">\${rec}</span></div><div class="prc-line"><span class="prc-lbl">⏱ Горизонт</span><span class="prc-val">\${h} лет</span></div><div class="prc-line"><span class="prc-lbl">📊 Готовность к риску</span><span class="prc-val">\${riskLabel}</span></div>\`;`,
        result:'' },
      { type:'task', title:'Посмотри на свои активы',
        body:'Открой Капитал → Активы. Сколько у тебя сейчас? Достаточно ли для подушки? Если да — пора думать об инвестициях.',
        action:'Мои активы →', target:'capital' },
    ]
  },

  { id:'c5', level:2, icon:'🧠', color:'rgba(255,107,107,.1)', title:'Психология денег',
    desc:'Почему умные люди принимают глупые финансовые решения — и как это остановить.', xp:100, time:'6 мин',
    steps:[
      { type:'read', title:'Мозг против кошелька: 3 главных врага',
        body:'Мы — плохие финансовые машины по умолчанию. Наш мозг эволюционировал для выживания, а не инвестиций.\n\n**1. Немедленное вознаграждение**\nМозг оценивает удовольствие СЕЙЧАС в 3–5 раз выше чем удовольствие в будущем. Купить iPhone сейчас кажется лучше чем +50 000 ₽ к пенсии.\n\n**2. Избегание потерь**\nПотеря 1000 ₽ причиняет боль в 2 раза сильнее чем радость от выигрыша 1000 ₽. Отсюда — держим убыточные акции и продаём прибыльные.\n\n**3. Стадное мышление**\nКогда все покупают — хочется купить. Когда все продают — хочется продать. Именно поэтому большинство покупает на пике и продаёт на дне.' },
      { type:'example', title:'Сколько стоят импульсивные покупки за год',
        story:'Алексей, 28 лет, подсчитал все незапланированные покупки за месяц. Результат его шокировал.',
        calc:[
          {label:'Кофе «на бегу» (2 × 250 ₽ × 22 дня):', val:'11 000 ₽/мес'},
          {label:'Незапланированные вещи Wildberries:', val:'8 000 ₽/мес'},
          {label:'Приложения и подписки не в том плане:', val:'3 500 ₽/мес'},
          {label:'Еда «пока жду заказ»:', val:'4 000 ₽/мес'},
          {label:'ИТОГО незапланированных трат:', val:'26 500 ₽/мес'},
          {label:'За год:', val:'318 000 ₽'},
          {label:'За 10 лет под 12%:', val:'≈ 6 100 000 ₽'},
        ],
        conclusion:'Это не про кофе. Это про систему. Алексей не жертвовал жизнью — он просто ввёл правило «24 часа» для покупок дороже 1 500 ₽.' },
      { type:'read', title:'Эффект якоря — как магазины крадут деньги',
        body:'Маркетологи знают: первая цифра которую ты видишь — якорь для всех следующих решений.\n\nПример:\n• Куртка за 15 000 ₽ рядом с курткой за 45 000 ₽ кажется «выгодной».\n• Телефон за 90 000 ₽ делает iPhone за 120 000 ₽ «нормальной ценой».\n• Зачёркнутая цена 3 000 ₽, новая 1 500 ₽ — ты экономишь или тратишь?\n\n**Защита:** спрашивай не «дёшево ли это?» а «нужно ли мне это вообще? сколько часов моей работы это стоит?»' },
      { type:'read', title:'3 работающих приёма контроля трат',
        body:'**1. Правило 24 часов**\nЛюбая незапланированная покупка > 1 500 ₽ → ждёшь сутки. 80% желание проходит.\n\n**2. Цена в часах работы**\nКуртка за 12 000 ₽ при зарплате 100 ₽/ч = 120 часов работы. Стоит ли?\n\n**3. Правило одного входящего**\nКупил новую вещь → убрал одну старую. Создаёт осознанность и не даёт накапливать барахло.\n\nЭти правила работают не потому что ты становишься скупым — а потому что ты начинаешь думать перед тем как тратить.' },
      { type:'quiz_multi', title:'Проверь себя — 3 вопроса',
        questions:[
          { q:'Почему мы держим убыточные акции слишком долго?',
            opts:['Из-за жадности','Из-за избегания потерь — продать = зафиксировать боль','Из-за незнания','Из-за роста рынка'], correct:1,
            explain:'Потеря ощущается в 2 раза сильнее выигрыша. Продать убыточную акцию = признать ошибку. Мозг сопротивляется.' },
          { q:'Что такое «эффект якоря» в покупках?',
            opts:['Скидка на второй товар','Первая увиденная цена влияет на оценку следующих','Покупка с большим весом','Кешбэк за покупку'], correct:1,
            explain:'Любая первая цена — якорь. Вся «выгода» часто искусственна и создана маркетологами.' },
          { q:'Правило 24 часов помогает потому что:',
            opts:['Находишь скидку','80% импульсных желаний проходит за сутки','Дольше выбираешь','Товар пропадает из корзины'], correct:1,
            explain:'Импульс живёт часы. Мозг в режиме «хочу прямо сейчас» — ненадёжный советник по финансам.' },
        ] },
      { type:'challenge', title:'7-дневный вызов: Осознанный кошелёк',
        desc:'Неделя практики меняет паттерны трат навсегда.',
        days:[
          {day:1, task:'Запиши ВСЕ траты дня (включая кофе и мелочи)'},
          {day:2, task:'Найди одну незапланированную трату — почему купил? Был ли импульс?'},
          {day:3, task:'Посчитай стоимость ежедневных мелких трат (кофе/перекус) × 22 дня × 12 мес'},
          {day:4, task:'Откажись от одной импульсной покупки — примени правило 24 часов'},
          {day:5, task:'Посчитай одну трату в часах работы. Изменило ли это решение?'},
          {day:7, task:'Отмени одну подписку которой давно не пользуешься'},
        ] },
    ]
  },

  { id:'c6', level:2, icon:'💼', color:'rgba(45,232,176,.08)', title:'Рост дохода',
    desc:'Как увеличить доход в 2–3 раза за 2–3 года через правильное развитие навыков.', xp:120, time:'7 мин',
    steps:[
      { type:'read', title:'Навыки с наибольшим ROI',
        body:'Инвестиции в себя — самые доходные. Навыки не падают в цене, не облагаются налогом на прибыль и работают всю жизнь.\n\n**Топ навыков с высокой рыночной оценкой:**\n• **Программирование** — junior 100–150k, middle 200–400k, senior 400–700k ₽\n• **Data Science / аналитика** — спрос растёт 30%/год\n• **Продажи и переговоры** — нужны в любой сфере\n• **Английский** — открывает международный рынок (x2–3 к зарплате)\n• **Digital-маркетинг** — можно зарабатывать фрилансом уже через 3 мес обучения\n• **Управление проектами** — руководители зарабатывают в 1,5–2 раза больше исполнителей' },
      { type:'example', title:'История Кирилла: +240 000 ₽/год за 18 месяцев',
        story:'Кирилл работал офис-менеджером за 55 000 ₽/мес. Потратил 18 месяцев на курс аналитики данных (занимаясь 1 час вечером после работы).',
        calc:[
          {label:'Было: офис-менеджер', val:'55 000 ₽/мес'},
          {label:'Стало: Junior Data Analyst', val:'120 000 ₽/мес'},
          {label:'Рост дохода в месяц:', val:'+65 000 ₽'},
          {label:'Рост дохода в год:', val:'+780 000 ₽'},
          {label:'Стоимость курсов:', val:'45 000 ₽'},
          {label:'ROI инвестиции в навык:', val:'1 733% за первый год'},
          {label:'Через 2 года — middle-позиция:', val:'200 000 ₽/мес'},
        ],
        conclusion:'Никакая инвестиция в акции или ETF не даст 1700% за год. Навыки — самый доходный актив.' },
      { type:'read', title:'Правило 5 часов',
        body:'Билл Гейтс, Уоррен Баффет, Марк Цукерберг — все тратят минимум 5 часов в неделю на целенаправленное обучение.\n\n**5 часов × 52 недели = 260 часов в год**\nЭто 1 новый навык или 24 книги в год.\n\nКак найти время:\n• 1 час вечером × 5 будних дней = 5 часов\n• Замени 30 мин ленты соцсетей на чтение/курс\n• Аудиокниги и подкасты во время дороги\n\n**Маленький старт:** начни с 30 минут в день. Главное — ежедневно.' },
      { type:'read', title:'Стратегия «стека навыков»',
        body:'Быть лучшим в одном навыке сложно — рынок конкурентен.\nНо **топ-25% в 2–3 смежных навыках** = редкое сочетание которое высоко оплачивается.\n\n**Примеры сильных стеков:**\n• Программирование + финансы = финтех-специалист (400–600k ₽)\n• Маркетинг + аналитика = growth-маркетолог (200–350k ₽)\n• Продажи + английский = международные продажи (250–500k ₽)\n• Медицина + данные = медицинская аналитика (250–400k ₽)\n\nПодумай: что ты уже умеешь? Что можно добавить для уникального сочетания?' },
      { type:'quiz_multi', title:'Проверь себя — 2 вопроса',
        questions:[
          { q:'Кирилл потратил 45 000 ₽ на курсы и вырос с 55 до 120k ₽/мес. ROI за год:',
            opts:['~100%','~500%','~1700%','~50%'], correct:2,
            explain:'Доп. доход 65k × 12 = 780k ₽. ROI = 780k/45k = 1733%. Никакие акции так не работают.' },
          { q:'В чём суть «стека навыков»?',
            opts:['Стать лучшим в одном','Топ-25% в нескольких смежных — уникальная комбинация','Учить всё подряд','Иметь два диплома'], correct:1,
            explain:'Редкое сочетание навыков ценится дороже чем быть одним из многих специалистов в одной области.' },
        ] },
      { type:'task', title:'Добавь привычку «Обучение — 30 мин»',
        body:'Выбери навык который хочешь развить. Добавь привычку в Систему: «Изучение [навык] — 30 мин». 5 часов в неделю — и через год ты другой человек.',
        action:'Добавить привычку →', target:'system' },
    ]
  },

  { id:'c12', level:2, icon:'📉', color:'rgba(255,107,107,.08)', title:'Инфляция: враг сбережений',
    desc:'Как инфляция съедает деньги и какие инструменты защищают капитал.', xp:85, time:'5 мин',
    steps:[
      { type:'read', title:'Что такое инфляция на практике',
        body:'Инфляция — это рост цен. Это значит что деньги в матрасе дешевеют каждый год.\n\n**Пример:** 100 000 ₽ в 2015 году и в 2025 году — это разные суммы.\n\nПри инфляции 10%/год:\n• Через 1 год: 100 000 ₽ покупают как 90 909 ₽ сейчас\n• Через 5 лет: покупательная сила упала до 62 092 ₽\n• Через 10 лет: до 38 554 ₽\n• Через 20 лет: 14 864 ₽ — в 6,7 раза меньше!\n\nДержать деньги под подушкой — это медленная потеря.' },
      { type:'example', title:'Что купить на 1 000 000 ₽ в разные годы',
        story:'Представь что в 2010 году ты положил 1 000 000 ₽ в матрас. Сравниваем с теми кто держал на вкладе или инвестировал.',
        calc:[
          {label:'В матрасе — реальная стоимость к 2025:', val:'≈ 290 000 ₽ (в ценах 2010)'},
          {label:'На вкладе под 10%/год:', val:'≈ 4 177 000 ₽'},
          {label:'В индексе MOEX:', val:'≈ 5 100 000 ₽'},
          {label:'В недвижимости Москва (условно):', val:'≈ 3 500 000 ₽'},
          {label:'Проигрыш «матраса» за 15 лет:', val:'≈ 3 900 000 ₽'},
        ],
        conclusion:'Инфляция — невидимый налог на хранение наличных. Любой инструмент выше инфляции — лучше бездействия.' },
      { type:'read', title:'Как защититься от инфляции',
        body:'Правило: доходность твоих накоплений должна быть ВЫШЕ инфляции.\n\n**Инструменты защиты:**\n• Вклад / накопительный счёт — при ставке выше инфляции (сейчас обычно выше)\n• ОФЗ-ИН (линкеры) — облигации с индексацией к инфляции\n• ETF на акции — исторически обгоняют инфляцию на длинном горизонте\n• Недвижимость — защита + рентный доход\n• Валюта — защита от рублёвой инфляции, но риск регуляторных ограничений\n\nГлавное: не держи большие суммы наличными дольше нескольких недель.' },
      { type:'quiz_multi', title:'Проверь себя — 2 вопроса',
        questions:[
          { q:'Если инфляция 12% а вклад приносит 10% — что происходит с реальной стоимостью денег?',
            opts:['Растёт на 2%','Падает на 2% в год','Остаётся той же','Падает на 12%'], correct:1,
            explain:'Реальная доходность = доходность минус инфляция = 10% − 12% = −2%. Деньги дешевеют даже на вкладе.' },
          { q:'100 000 ₽ в матрасе при инфляции 10% через 10 лет — это в реальном выражении:',
            opts:['90 000 ₽','50 000 ₽','38 554 ₽','70 000 ₽'], correct:2,
            explain:'100 000 × (0,909)^10 ≈ 38 554 ₽. Деньги потеряли 61% реальной стоимости.' },
        ] },
      { type:'task', title:'Проверь доходность своих накоплений',
        body:'Открой Капитал → Активы. Посчитай: все ли накопления работают выше инфляции? Если есть «мёртвые» деньги — перемести их на накопительный счёт.',
        action:'Мои активы →', target:'capital' },
    ]
  },

  { id:'c13', level:2, icon:'📊', color:'rgba(77,166,255,.1)', title:'Фондовый рынок',
    desc:'Как устроены акции и ETF — доступно и без воды. Первые шаги без риска.', xp:110, time:'7 мин',
    steps:[
      { type:'read', title:'Акции, облигации, ETF — в чём разница',
        body:'**Акция** — ты владеешь долей компании. Если компания растёт — акция дорожает. Если упала — дешевеет. Можно получать дивиденды.\n\n**Облигация** — ты даёшь деньги в долг (компании или государству). Получаешь фиксированный процент. Меньше риска, меньше доходности.\n\n**ETF (биржевой фонд)** — корзина из десятков или сотен акций/облигаций одновременно. Купил одну «акцию» ETF — купил долю в 500+ компаниях.\n\nДля начинающих: ETF на индекс — лучший старт. Не нужно выбирать компании, не нужен брокерский анализ.' },
      { type:'example', title:'MOEX индекс vs. банковский вклад — 10 лет',
        story:'Иван вложил 300 000 ₽ в 2015 году. Его друг Павел положил ту же сумму на вклад под 11% среднегодовых. Кто выиграл?',
        calc:[
          {label:'Иван: индексный ETF на MOEX, ~16%/год:', val:'≈ 1 323 000 ₽'},
          {label:'Павел: вклад 11%/год:', val:'≈ 857 000 ₽'},
          {label:'Разница:', val:'466 000 ₽ в пользу Ивана'},
          {label:'НО: в 2022 году портфель Ивана временно падал до:', val:'≈ 160 000 ₽ (−47%)'},
          {label:'Павел в 2022:', val:'≈ 680 000 ₽ (без просадок)'},
          {label:'Иван продержался и восстановился к 2024:', val:'✓ Итог: +1 323 000 ₽'},
        ],
        conclusion:'ETF выигрывает на длинном горизонте, но требует стальных нервов при просадках. Кто продаёт на панике — фиксирует убытки и теряет весь выигрыш.' },
      { type:'read', title:'Как купить ETF в России: пошаговый план',
        body:'**Шаг 1: Открой брокерский счёт или ИИС**\nСбер, Т-Банк (Тинькофф), БКС, Финам — все подходят.\nДля налоговой льготы — открывай ИИС.\n\n**Шаг 2: Выбери ETF на Мосбирже**\n• TMOS (Т-Инвестиции) — индекс Мосбиржи\n• SBMX (Сбер) — тот же индекс, меньше комиссия\n• LQDT / SBMM — денежный рынок (как вклад, но гибче)\n\n**Шаг 3: Покупай регулярно**\nКаждый месяц на фиксированную сумму — не пытайся угадать «правильный» момент.\n\n**Шаг 4: Держи, не паникуй**\nРынок падает — ты покупаешь дешевле. Рынок растёт — твои акции дорожают.' },
      { type:'quiz_multi', title:'Проверь себя — 3 вопроса',
        questions:[
          { q:'ETF — это что?',
            opts:['Один вид акций','Корзина из множества акций/облигаций','Вид вклада','Государственная облигация'], correct:1,
            explain:'Купил 1 акцию ETF = купил долю в сотнях компаний. Диверсификация по умолчанию.' },
          { q:'Иван купил ETF, рынок упал на 40%. Правильное действие:',
            opts:['Продать чтобы сохранить','Продолжать покупать — акции дешевле','Ничего не делать (оба варианта)','Купить другой ETF'], correct:2,
            explain:'Продавать на падении = фиксировать убыток. Продолжать покупать на просадке — выгоднее в долгосрочной перспективе.' },
          { q:'Почему не нужно пытаться угадать «лучший момент» для покупки ETF?',
            opts:['Брокеры запрещают','Даже профессионалы не могут стабильно угадывать рынок','Слишком дорого','Нужна лицензия'], correct:1,
            explain:'Time in market beats timing the market. Регулярные покупки в любой момент в долгосроке лучше угадывания.' },
        ] },
      { type:'practice', title:'Сравни ETF и вклад',
        desc:'Посчитай разницу для твоей ситуации.',
        fields:[
          {id:'etf_sum', label:'Начальная сумма (₽)', placeholder:'100000', type:'number'},
          {id:'etf_years', label:'Лет', placeholder:'10', type:'number'},
        ],
        formula:`const s=parseFloat(f.etf_sum)||100000,y=parseFloat(f.etf_years)||10;
if(!s) return '';
const etf=Math.round(s*Math.pow(1.16,y));
const dep=Math.round(s*Math.pow(1.12,y));
const fmt=v=>v.toLocaleString('ru');
return \`<div class="prc-line"><span class="prc-lbl">📈 ETF (16%/год)</span><span class="prc-val" style="color:var(--mint)">\${fmt(etf)} ₽</span></div><div class="prc-line"><span class="prc-lbl">🏦 Вклад (12%/год)</span><span class="prc-val" style="color:var(--blue)">\${fmt(dep)} ₽</span></div><div class="prc-line"><span class="prc-lbl">💡 ETF выгоднее на</span><span class="prc-val" style="color:var(--gold)">\${fmt(etf-dep)} ₽</span></div>\`;`,
        result:'' },
      { type:'task', title:'Исследуй инвестиции',
        body:'Открой раздел Капитал → Стратегия. Посмотри на калькулятор роста. Попробуй ввести разные ставки (12% вклад vs 16% ETF) и сравни результаты.',
        action:'К стратегии →', target:'capital' },
    ]
  },

  // ══════════════════════════════════════
  //  УРОВЕНЬ 3 — ПРОДВИНУТЫЙ
  // ══════════════════════════════════════
  { id:'c7', level:3, icon:'🏗️', color:'rgba(245,200,66,.1)', title:'Портфель активов',
    desc:'Как собрать диверсифицированный портфель и автоматически «покупать дёшево».', xp:160, time:'8 мин',
    steps:[
      { type:'read', title:'Диверсификация: почему корзин должно быть много',
        body:'«Не клади все яйца в одну корзину» — не просто поговорка, это математика.\n\nЕсли 100% в акциях одной компании — одно плохое решение CEO и ты теряешь всё.\nЕсли 100% в одном секторе — падение сектора = твоё падение.\nЕсли 100% в рублях — девальвация = потеря.\n\n**Класс активов, которые падают в РАЗНОЕ время:**\n• Акции роста (хорошо при экономическом подъёме)\n• Облигации (хорошо при падении рынка)\n• Золото / товары (хорошо при инфляции)\n• Валюта (хорошо при девальвации рубля)\n• Недвижимость (долгосрочная защита)' },
      { type:'example', title:'Портфель: три модели для разного риска',
        story:'Три инвестора с разным отношением к риску выбрали разные распределения активов.',
        calc:[
          {label:'Консервативный (риск: низкий):', val:'60% ОФЗ, 20% вклады, 10% золото, 10% валюта'},
          {label:'Ожидаемая доходность:', val:'10–12%/год, просадка не более 10%'},
          {label:'Сбалансированный (риск: средний):', val:'40% ETF акции, 30% ОФЗ, 15% золото, 15% валюта'},
          {label:'Ожидаемая доходность:', val:'14–16%/год, просадка до 25%'},
          {label:'Агрессивный (риск: высокий):', val:'70% ETF акции, 15% крипто, 15% отдельные акции'},
          {label:'Ожидаемая доходность:', val:'18–25%/год, просадка 40–60%'},
        ],
        conclusion:'Нет «правильного» портфеля — есть портфель который ты не продашь на панике. Выбирай исходя из своей реакции на просадки.' },
      { type:'read', title:'Ребалансировка: как зарабатывать на коррекциях',
        body:'Портфель со временем смещается — выросшие активы занимают большую долю.\n\n**Пример:** начал с 50% акции / 50% ОФЗ.\nАкции выросли → стало 70% акции / 30% ОФЗ.\nРебалансировка: продаёшь часть акций, покупаешь ОФЗ → возвращаешься к 50/50.\n\n**Магия:** ты автоматически **продаёшь дорогое** и **покупаешь дешёвое**. Это и есть стратегия «Buy Low, Sell High» на практике.\n\nРебалансировку достаточно делать раз в 6–12 месяцев.' },
      { type:'read', title:'Корреляция активов — ключевой принцип',
        body:'Лучшая диверсификация — когда активы движутся в РАЗНЫХ направлениях (низкая или отрицательная корреляция).\n\n**Примеры:**\n• Золото часто растёт когда акции падают ✓\n• USD/EUR часто растёт при падении рубля ✓\n• Короткие ОФЗ стабильны при падении акций ✓\n• Разные секторы акций часто падают вместе ✗\n\n**Практически:** добавь в портфель хотя бы один «антикризисный» актив (золото или валюту). Это снижает максимальную просадку без значительной потери доходности.' },
      { type:'quiz_multi', title:'Проверь себя — 3 вопроса',
        questions:[
          { q:'Что такое ребалансировка портфеля?',
            opts:['Продать всё и начать заново','Восстановить целевые доли продав подорожавшее и купив подешевевшее','Купить новые активы','Вывести прибыль'], correct:1,
            explain:'Ребалансировка = механический buy low / sell high. Дисциплина, которая работает без эмоций.' },
          { q:'Почему золото полезно в портфеле акций?',
            opts:['Оно дорогое','Часто растёт когда акции падают (низкая корреляция)','Без него нельзя','Высокая доходность'], correct:1,
            explain:'Отрицательная корреляция с акциями смягчает просадки портфеля. Это страховка, а не основной актив.' },
          { q:'Портфель: 60% акции / 40% облигации. Акции выросли до 75%. Действие при ребалансировке:',
            opts:['Ничего не делать','Продать часть акций, купить облигации до 60/40','Продать все облигации','Добавить ещё акций'], correct:1,
            explain:'Возвращаем к целевым 60/40: продаём 15% акций, покупаем облигации. Фиксируем часть прибыли.' },
        ] },
      { type:'practice', title:'Собери свой портфель',
        desc:'Введи суммы по классам активов — проверь диверсификацию.',
        fields:[
          {id:'pf_stocks', label:'Акции / ETF (₽)', placeholder:'100000', type:'number'},
          {id:'pf_bonds', label:'Облигации / ОФЗ (₽)', placeholder:'60000', type:'number'},
          {id:'pf_gold', label:'Золото / металлы (₽)', placeholder:'20000', type:'number'},
          {id:'pf_cash', label:'Валюта / наличные (₽)', placeholder:'20000', type:'number'},
        ],
        formula:`const s=parseFloat(f.pf_stocks)||0,b=parseFloat(f.pf_bonds)||0,g=parseFloat(f.pf_gold)||0,cc=parseFloat(f.pf_cash)||0;
const total=s+b+g+cc;
if(!total) return '';
const pct=v=>Math.round(v/total*100);
const fmt=v=>Math.round(v).toLocaleString('ru');
const risk=pct(s);
const quality=risk<30?'🟢 Консервативный':risk<50?'🟡 Сбалансированный':risk<70?'🟠 Умеренный':'🔴 Агрессивный';
return \`<div class="prc-line"><span class="prc-lbl">💰 Итого портфель</span><span class="prc-val" style="color:var(--gold)">\${fmt(total)} ₽</span></div><div class="prc-line"><span class="prc-lbl">📈 Акции/ETF</span><span class="prc-val">\${pct(s)}%</span></div><div class="prc-line"><span class="prc-lbl">🏦 Облигации</span><span class="prc-val">\${pct(b)}%</span></div><div class="prc-line"><span class="prc-lbl">🥇 Золото</span><span class="prc-val">\${pct(g)}%</span></div><div class="prc-line"><span class="prc-lbl">💵 Кэш/Валюта</span><span class="prc-val">\${pct(cc)}%</span></div><div class="prc-line"><span class="prc-lbl">📊 Тип портфеля</span><span class="prc-val">\${quality}</span></div>\`;`,
        result:'' },
      { type:'task', title:'Проверь диверсификацию сейчас',
        body:'Открой раздел Капитал → Активы. Посмотри: сколько у тебя разных классов активов? Если всё в одном месте — это риск.',
        action:'Мои активы →', target:'capital' },
    ]
  },

  { id:'c8', level:3, icon:'📋', color:'rgba(77,166,255,.1)', title:'Налоги и вычеты',
    desc:'Как законно получить десятки тысяч рублей от государства — и платить меньше налогов.', xp:140, time:'8 мин',
    steps:[
      { type:'read', title:'Вычеты: деньги которые тебе должны',
        body:'13% НДФЛ которые удерживает работодатель — не всегда окончательная сумма. Государство возвращает их при определённых расходах.\n\n**Основные налоговые вычеты:**\n• **Имущественный** (покупка жилья) — возврат до 260 000 ₽ + 390 000 ₽ с ипотечных процентов\n• **Социальный** — лечение, обучение, фитнес: до 150 000 ₽ базы = до 19 500 ₽ возврата\n• **ИИС тип А** — взнос на ИИС: до 400 000 ₽/год = до 52 000 ₽ возврата\n• **Стандартный** — на детей: 1 400 ₽/мес на 1-го ребёнка\n\nОформляется через Госуслуги или налоговый кабинет. Обычно занимает 2–3 часа.' },
      { type:'example', title:'Кейс: Надежда получила 113 500 ₽ от государства',
        story:'Надежда, 34 года, работает с зарплатой 90 000 ₽/мес (НДФЛ = 140 400 ₽/год). За год применила три вычета.',
        calc:[
          {label:'ИИС тип А (внесла 400 000 ₽):', val:'Возврат 52 000 ₽'},
          {label:'Лечение (стоматолог 60 000 ₽):', val:'Возврат 7 800 ₽'},
          {label:'Обучение ребёнка (50 000 ₽):', val:'Возврат 6 500 ₽'},
          {label:'Фитнес-абонемент (40 000 ₽):', val:'Возврат 5 200 ₽'},
          {label:'Покупка квартиры (льгота):', val:'Возврат 42 000 ₽ (часть)'},
          {label:'ИТОГО возврат за год:', val:'113 500 ₽'},
          {label:'При этом уплачено НДФЛ:', val:'140 400 ₽ (возврат в рамках суммы)'},
        ],
        conclusion:'113 500 ₽ — почти полторы зарплаты. Большинство россиян не знают о вычетах и оставляют эти деньги государству.' },
      { type:'read', title:'ИИС — главный инструмент инвестора в России',
        body:'ИИС (Индивидуальный Инвестиционный Счёт) — брокерский счёт с налоговыми льготами.\n\n**Тип А (вычет на взнос):**\nВнёс до 400 000 ₽/год → получи 13% обратно = до 52 000 ₽/год.\nМожно держать хоть ОФЗ под 13% + 13% вычета = ~26% годовых. Почти без риска.\n\n**Тип Б (вычет на доход):**\nНе платишь НДФЛ с прибыли совсем. Выгодно при высокой доходности.\n\n**Правило:** минимальный срок счёта 3 года (иначе льготы теряются).\n**Максимальный взнос:** 1 000 000 ₽/год (но вычет считается с 400 000 ₽).' },
      { type:'read', title:'Дивиденды, купоны и налоги на инвестиционный доход',
        body:'С инвестиционного дохода тоже берут 13% (или 15% при доходе > 5 млн ₽/год).\n\n**Когда не платишь НДФЛ:**\n• Держишь акции/ETF более 3 лет (ЛДВ — льгота долгосрочного владения)\n• Используешь ИИС тип Б\n• Убыток в текущем году перекрывает прибыль\n\n**Хитрость:** убыток в одних акциях можно зачесть против прибыли в других. Это называется «налоговая оптимизация». Брокер делает это автоматически в большинстве случаев.' },
      { type:'quiz_multi', title:'Проверь себя — 3 вопроса',
        questions:[
          { q:'Сколько максимально можно вернуть через ИИС тип А в год?',
            opts:['13 000 ₽','26 000 ₽','52 000 ₽','400 000 ₽'], correct:2,
            explain:'13% от 400 000 ₽ = 52 000 ₽. При этом деньги остаются на счёте и инвестируются.' },
          { q:'ЛДВ (льгота долгосрочного владения) освобождает от налога если:',
            opts:['Продал дешевле чем купил','Держал акции более 3 лет','Использовал ИИС','Купил государственные акции'], correct:1,
            explain:'Держи ETF/акции 3+ года — при продаже не платишь НДФЛ с прибыли. Мощный инструмент.' },
          { q:'Вычет на лечение относится к категории:',
            opts:['Имущественный','Социальный','Стандартный','Инвестиционный'], correct:1,
            explain:'Социальные вычеты: лечение, обучение, фитнес, благотворительность. Лимит 150 000 ₽/год.' },
        ] },
      { type:'challenge', title:'5-дневный вызов: Получи свои деньги',
        desc:'За 5 дней оформи хотя бы один налоговый вычет.',
        days:[
          {day:1, task:'Зайди на сайт nalog.ru, открой личный кабинет налогоплательщика'},
          {day:2, task:'Проверь: есть ли у тебя основания для вычетов (лечение, обучение, ИИС, жильё)'},
          {day:3, task:'Собери документы: справки 2-НДФЛ от работодателя, чеки расходов'},
          {day:4, task:'Заполни декларацию 3-НДФЛ в личном кабинете (есть пошаговый помощник)'},
          {day:5, task:'Отправь заявление на возврат. Деньги придут в течение 1–3 месяцев'},
        ] },
      { type:'task', title:'Рассчитай свой потенциальный возврат',
        body:'Запиши в инсайты: какие расходы у тебя были за год (лечение, обучение, взносы ИИС). Посчитай 13% — это деньги которые можно вернуть.',
        action:'Добавить инсайт →', target:'academy' },
    ]
  },

  { id:'c14', level:3, icon:'🏠', color:'rgba(245,200,66,.08)', title:'Недвижимость как актив',
    desc:'Когда покупать выгоднее чем арендовать и как считать реальную доходность.', xp:150, time:'8 мин',
    steps:[
      { type:'read', title:'Покупать или арендовать? Честный расчёт',
        body:'«Аренда — выброшенные деньги» — популярный миф. Разберём честно.\n\n**Реальные расходы при покупке квартиры (Москва, 10 млн ₽, ипотека 20%):**\n• Первый взнос: 2 000 000 ₽\n• Ежемесячный платёж при 15%/25 лет: ≈ 101 000 ₽/мес\n• За 25 лет выплатишь: ≈ 30 300 000 ₽\n• Переплата: 20 300 000 ₽ (203%!)\n• + налоги, страховка, ремонт: ещё 3–4 млн ₽\n\nАренда аналогичной квартиры: ≈ 55 000 ₽/мес.\nРазница: 46 000 ₽/мес которые можно инвестировать.' },
      { type:'example', title:'Сравнение: ипотека vs аренда + инвестиции',
        story:'Алиса купила квартиру за 10 млн с ипотекой. Борис арендует такую же и вкладывает разницу в ETF. Через 25 лет...',
        calc:[
          {label:'Алиса (ипотека): квартира стоит через 25 лет', val:'≈ 30 млн ₽ (рост 5%/год)'},
          {label:'Алиса заплатила всего:', val:'≈ 34 млн ₽ (взнос + платежи + расходы)'},
          {label:'Борис: 2 млн (взнос) + 46k/мес в ETF 15%:', val:'≈ 67 млн ₽'},
          {label:'Борис живёт в аналогичной квартире:', val:'✓ (на ренту из портфеля)'},
          {label:'Итог Алисы (актив минус долг):', val:'≈ 30 млн'},
          {label:'Итог Бориса (портфель):', val:'≈ 67 млн'},
        ],
        conclusion:'Математика часто в пользу инвестиций vs. ипотеки. НО: недвижимость даёт стабильность и физический актив. Всё зависит от дисциплины и регина.' },
      { type:'read', title:'Когда недвижимость выгодна как инвестиция',
        body:'Покупка ИМЕЕТ смысл если:\n• Доходность аренды > 7% годовых от стоимости (в Москве сейчас ~5–6%, в регионах ~8–12%)\n• Ты покупаешь по цене ниже рынка\n• Горизонт 10+ лет\n• Используешь рычаг ипотеки при низкой ставке\n\n**Считаем реальную доходность аренды:**\nКвартира за 5 млн ₽, аренда 35 000 ₽/мес\n→ 420 000 ₽/год ÷ 5 000 000 ₽ = 8,4% годовых\n→ Вычти налог, ремонт, простой = реальные ~6%\n→ Ниже вклада! Но есть рост стоимости самой квартиры.\n\nВывод: недвижимость — не «всегда выгодно». Считай конкретные числа.' },
      { type:'quiz_multi', title:'Проверь себя — 2 вопроса',
        questions:[
          { q:'Квартира стоит 6 млн ₽, аренда приносит 36 000 ₽/мес. Валовая доходность:',
            opts:['3%','6%','7,2%','10%'], correct:2,
            explain:'432 000 ₽/год ÷ 6 000 000 ₽ = 7,2%. Это до вычета расходов. Чистая доходность — 4–5%.' },
          { q:'Ипотека под 20% на 25 лет — квартира за 10 млн. Переплата:',
            opts:['10 млн','15 млн','20+ млн','5 млн'], correct:2,
            explain:'При 20% на 25 лет переплата составит ~20 млн ₽. Итого отдашь ~30 млн за квартиру стоимостью 10 млн.' },
        ] },
      { type:'task', title:'Посчитай стоимость жилья в твоём городе',
        body:'Найди стоимость квартиры которую ты мог бы купить. Найди аренду аналогичной. Посчитай доходность по формуле: (аренда × 12 ÷ стоимость × 100). Запиши вывод как инсайт.',
        action:'Добавить инсайт →', target:'academy' },
    ]
  },

  { id:'c15', level:3, icon:'💎', color:'rgba(167,139,250,.12)', title:'Пассивный доход',
    desc:'Реальные способы создать доход который работает пока ты спишь — без миллионного стартового капитала.', xp:170, time:'8 мин',
    steps:[
      { type:'read', title:'Что такое пассивный доход на самом деле',
        body:'Популярный миф: пассивный доход = деньги без труда. Реальность иная.\n\nЛюбой пассивный доход требует:\n• **Капитала** (деньги работают вместо тебя) или\n• **Активных усилий заранее** (создал продукт, получаешь роялти)\n\n**Реальные источники пассивного дохода:**\n1. Дивиденды и купоны от инвестиций\n2. Процент от вклада/ОФЗ\n3. Аренда недвижимости\n4. Авторские отчисления (книги, курсы, музыка)\n5. Партнёрские программы\n6. Бизнес на автопилоте\n\nСамый доступный путь: инвестиции. Без большого капитала начать — через фондовый рынок.' },
      { type:'example', title:'Путь к 100 000 ₽/мес пассивного дохода',
        story:'Какой капитал нужен чтобы получать 100 000 ₽/мес от инвестиций при разной доходности?',
        calc:[
          {label:'При доходности 10%/год (вклад):', val:'Нужно 12 000 000 ₽'},
          {label:'При доходности 15%/год (ОФЗ+ETF):', val:'Нужно 8 000 000 ₽'},
          {label:'При доходности 20%/год (агрессивно):', val:'Нужно 6 000 000 ₽'},
          {label:'Откладывая 20 000 ₽/мес под 15%, до 8 млн:', val:'≈ 17–18 лет'},
          {label:'Откладывая 50 000 ₽/мес под 15%, до 8 млн:', val:'≈ 10–11 лет'},
          {label:'Откладывая 100 000 ₽/мес под 15%, до 8 млн:', val:'≈ 6–7 лет'},
        ],
        conclusion:'Пассивный доход = результат многолетней дисциплины. Нет волшебного способа. Но дорога к нему начинается с первого рубля.' },
      { type:'read', title:'Стратегия «дивидендный портфель»',
        body:'Российские акции с хорошими дивидендами:\n• Лукойл — исторически 8–12% дивдоходности\n• Сбербанк — 6–10%\n• МТС — 8–12%\n• Северсталь/НЛМК — 8–15% (цикличные)\n\n**Стратегия:** накапливаешь дивидендные акции → реинвестируешь дивиденды → портфель растёт + доход растёт.\n\nРиски: дивиденды могут отменить (2022, многие компании не платили). Поэтому диверсификация — обязательна.\n\nЛучший старт: дивидендный ETF (напр. DIVD) — корзина из 50+ дивидендных акций автоматически.' },
      { type:'read', title:'Цифровые источники пассивного дохода',
        body:'Если капитала ещё нет — можно создавать пассивный доход через интеллектуальный труд:\n\n• **Онлайн-курсы** — создал раз, продаёшь бесконечно (Stepik, GetCourse)\n• **Книга / гайд** — публикуй на Ridero, Литрес\n• **Шаблоны, пресеты, инструменты** — Etsy, маркетплейсы\n• **YouTube канал** — монетизация от 1 000 подписчиков\n• **Блог / канал Telegram** — рекламные интеграции\n\nЭти пути требуют 6–18 месяцев интенсивной работы. Зато стартовый капитал — нулевой.' },
      { type:'quiz_multi', title:'Проверь себя — 2 вопроса',
        questions:[
          { q:'Какой капитал нужен чтобы получать 100 000 ₽/мес при доходности 15%?',
            opts:['1 200 000 ₽','8 000 000 ₽','15 000 000 ₽','100 000 ₽'], correct:1,
            explain:'100 000 ₽/мес = 1 200 000 ₽/год. 1 200 000 ÷ 0,15 = 8 000 000 ₽ капитала.' },
          { q:'Самый доступный способ начать пассивный доход без большого капитала:',
            opts:['Купить квартиру','Инвестировать даже 1 000 ₽/мес в ETF','Ждать наследства','Криптовалюта'], correct:1,
            explain:'Маленькие регулярные инвестиции + сложный процент = пассивный доход через годы. Начинать нужно сейчас.' },
        ] },
      { type:'challenge', title:'30-дневный вызов: Первый пассивный рубль',
        desc:'Цель — получить первый реальный пассивный доход за месяц.',
        days:[
          {day:1, task:'Открой накопительный счёт если ещё нет. Переведи туда свободные деньги.'},
          {day:7, task:'Первый процент начислен на счёт. Это и есть пассивный доход — пусть и маленький.'},
          {day:14, task:'Открой ИИС или брокерский счёт. Купи первый ETF или ОФЗ.'},
          {day:21, task:'Подпишись на финансовый Telegram-канал или YouTube. Образование — тоже инвестиция.'},
          {day:30, task:'Посчитай: сколько ты получил процентов за месяц? Умножь × 12 — это твой текущий пассивный доход в год.'},
        ] },
    ]
  },

  { id:'c16', level:3, icon:'🌍', color:'rgba(45,232,176,.06)', title:'FIRE: финансовая независимость',
    desc:'Что такое движение FIRE и как рассчитать свой «номер свободы» — сумму после которой можно не работать.', xp:180, time:'7 мин',
    steps:[
      { type:'read', title:'Что такое FIRE?',
        body:'FIRE = Financial Independence, Retire Early (Финансовая независимость, ранний выход на пенсию).\n\nОсновная идея: накопить достаточно активов чтобы жить на пассивный доход — не зависимо от работы.\n\n**Правило 4%:**\nЕсли ежегодно снимать 4% от портфеля — портфель статистически прослужит 30+ лет (правило из исследования Тринити, США).\n\n**Формула:**\nТвой «номер свободы» = годовые расходы × 25\n\nПри расходах 600 000 ₽/год:\n600 000 × 25 = 15 000 000 ₽ — и можно «выйти на пенсию» в любом возрасте.' },
      { type:'example', title:'Три варианта FIRE для разного образа жизни',
        story:'Разные семьи с разными целями и расходами. Все хотят финансовой независимости.',
        calc:[
          {label:'Lean FIRE (минималистичный): расходы 30 000 ₽/мес', val:'Нужно: 9 000 000 ₽'},
          {label:'Regular FIRE: расходы 80 000 ₽/мес', val:'Нужно: 24 000 000 ₽'},
          {label:'Fat FIRE (комфортный): расходы 200 000 ₽/мес', val:'Нужно: 60 000 000 ₽'},
          {label:'Barista FIRE (гибрид): полпортфеля + небольшая работа', val:'Нужно: ~12 000 000 ₽'},
          {label:'Coast FIRE: накопил раньше, дал вырасти без пополнений', val:'Самый реалистичный'},
        ],
        conclusion:'FIRE — не обязательно «ранняя пенсия». Это опция. Возможность работать потому что хочешь, а не потому что вынужден.' },
      { type:'read', title:'Coast FIRE — самый реалистичный путь',
        body:'Coast FIRE — накапливаешь «ядро» портфеля достаточно рано, потом просто даёшь ему расти без пополнений.\n\n**Пример:**\nАнна начала в 25 лет. Хочет иметь 20 млн ₽ к 55 годам.\nПри росте 12%/год достаточно вложить сегодня:\n20 000 000 ÷ (1.12)^30 ≈ 1 000 000 ₽\n\nДа, всего 1 млн ₽ в 25 лет → 20 млн в 55 при доходности 12%.\n\nЕсли уже накоплено достаточно для «прибрежного» FIRE — можно работать на расходы и не трогать ядро.' },
      { type:'quiz_multi', title:'Проверь себя — 2 вопроса',
        questions:[
          { q:'По правилу 4% — твой «номер свободы» если тратишь 60 000 ₽/мес:',
            opts:['7 200 000 ₽','18 000 000 ₽','720 000 ₽','60 000 000 ₽'], correct:1,
            explain:'60 000 × 12 = 720 000 ₽/год. 720 000 × 25 = 18 000 000 ₽. Это твой «номер» при этих расходах.' },
          { q:'Coast FIRE отличается от обычного FIRE тем что:',
            opts:['Нужно больше денег','Накапливаешь ядро рано и даёшь расти без пополнений','Продаёшь берег','Работаешь всю жизнь'], correct:1,
            explain:'Coast = прибрежный. Накопил «ядро» — теперь можно работать только на текущие расходы.' },
        ] },
      { type:'practice', title:'Рассчитай свой номер свободы',
        desc:'Сколько тебе нужно накопить для финансовой независимости?',
        fields:[
          {id:'fire_monthly', label:'Желаемые расходы в мес (₽)', placeholder:'80000', type:'number'},
          {id:'fire_age', label:'Сколько тебе сейчас лет', placeholder:'30', type:'number'},
          {id:'fire_target_age', label:'В каком возрасте хочешь свободу', placeholder:'50', type:'number'},
          {id:'fire_saved', label:'Уже накоплено (₽)', placeholder:'500000', type:'number'},
        ],
        formula:`const m=parseFloat(f.fire_monthly)||80000,a=parseFloat(f.fire_age)||30,ta=parseFloat(f.fire_target_age)||50,s=parseFloat(f.fire_saved)||0;
const target=Math.round(m*12*25);
const years=ta-a;
const needed=Math.max(0,target-s);
const monthly=years>0?Math.round(needed/(years*12)):needed;
const fmt=v=>v.toLocaleString('ru');
return \`<div class="prc-line"><span class="prc-lbl">🎯 Число FIRE</span><span class="prc-val" style="color:var(--gold)">\${fmt(target)} ₽</span></div><div class="prc-line"><span class="prc-lbl">⏳ Лет до цели</span><span class="prc-val">\${years} лет</span></div><div class="prc-line"><span class="prc-lbl">💰 Уже накоплено</span><span class="prc-val">\${fmt(s)} ₽</span></div><div class="prc-line"><span class="prc-lbl">📥 Нужно ещё</span><span class="prc-val">\${fmt(needed)} ₽</span></div><div class="prc-line"><span class="prc-lbl">📅 Откладывать в мес.</span><span class="prc-val" style="color:var(--mint)">\${fmt(monthly)} ₽</span></div>\`;`,
        result:'' },
      { type:'task', title:'Установи свой «номер свободы» как цель',
        body:'Открой профиль и установи свой «номер свободы» как финансовую цель. Это число которое теперь будет мотивировать каждое финансовое решение.',
        action:'Открыть профиль →', target:'profile' },
    ]
  },
];



// ══════════════════════════════════════════
//   БАЗА ЗАДАЧ АКАДЕМИИ
//   type: 'number'   — ввести число
//         'choice'   — выбрать вариант
//         'distribute' — распределить бюджет по категориям
//         'scenario' — выбрать стратегию + объяснение
// ══════════════════════════════════════════
const PROBLEMS = [

  // ─── БЮДЖЕТ ────────────────────────────────────────────
  {
    id:'p1', cat:'budget', diff:'easy', xp:20,
    icon:'💰', color:'rgba(45,232,176,.12)',
    title:'Правило 50/30/20 — базовый расчёт',
    story:'Алина получила зарплату 75 000 ₽. Она хочет следовать правилу 50/30/20 и откладывать ровно 20% на накопления.',
    question:'Сколько рублей Алина должна перевести на накопительный счёт в день зарплаты?',
    type:'number', answer:15000, tolerance:0,
    unit:'₽',
    hint:'20% от 75 000 = ?',
    solution:'75 000 × 0.20 = **15 000 ₽**. Остаток 60 000 ₽ делится: 37 500 ₽ на необходимое и 22 500 ₽ на желания.',
  },

  {
    id:'p2', cat:'budget', diff:'easy', xp:25,
    icon:'💰', color:'rgba(45,232,176,.12)',
    title:'Найти перерасход',
    story:'Доход Михаила — 90 000 ₽/мес. За месяц он потратил: аренда+еда+транспорт = 52 000 ₽, кафе+одежда+развлечения = 38 000 ₽, накопления = 0 ₽.',
    question:'На сколько рублей Михаил превысил лимит «желаний» по правилу 50/30/20?',
    type:'number', answer:11000, tolerance:0,
    unit:'₽',
    hint:'Лимит желаний = 30% от дохода. Сколько это? Сравни с реальными тратами.',
    solution:'Лимит желаний: 90 000 × 0.30 = **27 000 ₽**. Реально потрачено: 38 000 ₽. Перерасход: 38 000 − 27 000 = **11 000 ₽**.',
  },

  {
    id:'p3', cat:'budget', diff:'medium', xp:35,
    icon:'💰', color:'rgba(45,232,176,.12)',
    title:'Распредели бюджет',
    story:'Ты получил зарплату 100 000 ₽. Нужно распределить её строго по правилу 50/30/20 между тремя категориями.',
    question:'Введи суммы для каждой категории (итого должно быть ровно 100 000 ₽):',
    type:'distribute',
    fields:[
      {id:'d_life',  label:'Необходимое (50%)', correct:50000},
      {id:'d_want',  label:'Желания (30%)',      correct:30000},
      {id:'d_save',  label:'Накопления (20%)',   correct:20000},
    ],
    total:100000,
    solution:'**50 000 ₽** — необходимое (аренда, еда, транспорт). **30 000 ₽** — желания. **20 000 ₽** — накопления. Сумма = 100 000 ₽ ✓',
  },

  {
    id:'p4', cat:'budget', diff:'medium', xp:30,
    icon:'💰', color:'rgba(45,232,176,.12)',
    title:'Скрытые расходы за год',
    story:'Сергей каждый день покупает кофе за 280 ₽ и обед «на бегу» за 450 ₽. Оба — незапланированные траты, рабочих дней в году 250.',
    question:'Сколько рублей Сергей тратит на эти привычки за год?',
    type:'number', answer:182500, tolerance:500,
    unit:'₽',
    hint:'(280 + 450) × 250 = ?',
    solution:'(280 + 450) × 250 = 730 × 250 = **182 500 ₽/год**. Это почти 2 месячные зарплаты среднего россиянина — за кофе и обеды.',
  },

  {
    id:'p5', cat:'budget', diff:'hard', xp:45,
    icon:'💰', color:'rgba(45,232,16,.12)',
    title:'Зеро-бюджет: закрой дыры',
    story:'Доход Натальи — 85 000 ₽. Она составила зеро-бюджет: аренда 28 000, продукты 12 000, транспорт 5 000, кафе 9 000, одежда 7 000, подписки 4 500, спорт 3 000, накопления 12 000. Итого: 80 500 ₽.',
    question:'Сколько рублей «неприсвоенных» осталось в бюджете Натальи?',
    type:'number', answer:4500, tolerance:0,
    unit:'₽',
    hint:'Зеро-бюджет: доход − все категории = 0. Найди остаток.',
    solution:'85 000 − 80 500 = **4 500 ₽**. В зеро-бюджете это нельзя оставлять «просто так» — нужно добавить категорию (например, увеличить накопления до 16 500 ₽).',
  },

  {
    id:'p6', cat:'budget', diff:'medium', xp:35,
    icon:'💰', color:'rgba(45,232,176,.12)',
    title:'Цена привычки',
    story:'Анна курит пачку сигарет в день (200 ₽). Подруга предлагает: «Если бросишь и будешь класть эти деньги на накопительный счёт под 14% годовых, через 5 лет купишь себе что хочешь».',
    question:'Сколько рублей накопит Анна за 5 лет (без учёта процентов, просто сумма взносов)?',
    type:'number', answer:365000, tolerance:1000,
    unit:'₽',
    hint:'200 ₽/день × 365 дней × 5 лет = ?',
    solution:'200 × 365 × 5 = **365 000 ₽** только взносами. С процентами 14%/год — уже около **480 000 ₽**. Это новый автомобиль.',
  },


  // ─── ИНВЕСТИЦИИ ────────────────────────────────────────
  {
    id:'p7', cat:'invest', diff:'easy', xp:20,
    icon:'📈', color:'rgba(77,166,255,.12)',
    title:'Правило 72 — время удвоения',
    story:'Дмитрий открыл вклад под 12% годовых. Он хочет знать через сколько лет его деньги удвоятся.',
    question:'По правилу 72 — через сколько лет удвоятся деньги?',
    type:'number', answer:6, tolerance:0,
    unit:'лет',
    hint:'72 ÷ ставку = лет до удвоения',
    solution:'72 ÷ 12 = **6 лет**. При 12% годовых деньги удваиваются каждые 6 лет.',
  },

  {
    id:'p8', cat:'invest', diff:'easy', xp:25,
    icon:'📈', color:'rgba(77,166,255,.12)',
    title:'Сложный процент — итог за 3 года',
    story:'Оля положила 50 000 ₽ на накопительный счёт под 10% годовых. Проценты начисляются раз в год и реинвестируются.',
    question:'Сколько рублей будет на счёте ровно через 3 года (округли до рублей)?',
    type:'number', answer:66550, tolerance:100,
    unit:'₽',
    hint:'Каждый год: сумма × 1.10. Три раза подряд.',
    solution:'50 000 × 1.10 = 55 000 → × 1.10 = 60 500 → × 1.10 = **66 550 ₽**. Прибыль 16 550 ₽ вместо 15 000 ₽ простого процента.',
  },

  {
    id:'p9', cat:'invest', diff:'medium', xp:40,
    icon:'📈', color:'rgba(77,166,255,.12)',
    title:'Когда начинать инвестировать?',
    story:'Два друга: Артём начал инвестировать 5 000 ₽/мес в 25 лет, Борис — в 35 лет. Оба инвестируют до 65 лет под 12% годовых.',
    question:'Во сколько раз накопления Артёма БОЛЬШЕ накоплений Бориса к 65 годам? (округли до целых)',
    type:'number', answer:3, tolerance:1,
    unit:'раз',
    hint:'Артём инвестирует 40 лет, Борис — 30 лет. Формула FV = PMT × ((1+r)^n − 1)/r',
    solution:'Артём (40 лет): ≈ **53 000 000 ₽**. Борис (30 лет): ≈ **17 500 000 ₽**. Разница: ~3 раза. Каждые 10 лет промедления стоят половину итогового капитала.',
  },

  {
    id:'p10', cat:'invest', diff:'medium', xp:40,
    icon:'📈', color:'rgba(77,166,255,.12)',
    title:'Реальная доходность с учётом инфляции',
    story:'Вклад приносит 13% годовых. Инфляция за год составила 9%.',
    question:'Какова реальная доходность вклада (в процентах)?',
    type:'number', answer:4, tolerance:0,
    unit:'%',
    hint:'Реальная доходность = номинальная − инфляция (упрощённая формула)',
    solution:'13% − 9% = **4% реальной доходности**. Деньги растут, но не так быстро как кажется — покупательная сила увеличивается лишь на 4%.',
  },

  {
    id:'p11', cat:'invest', diff:'hard', xp:55,
    icon:'📈', color:'rgba(77,166,255,.12)',
    title:'Портфель: ребалансировка',
    story:'Максим собрал портфель: вложил 200 000 ₽ в акции (50%) и 200 000 ₽ в облигации (50%). Через год акции выросли до 280 000 ₽, облигации — до 216 000 ₽. Итого портфель стал 496 000 ₽.',
    question:'Сколько рублей акций нужно ПРОДАТЬ чтобы вернуть соотношение 50/50?',
    type:'number', answer:32000, tolerance:500,
    unit:'₽',
    hint:'Целевая доля акций = 50% от 496 000 ₽. Сколько должно быть акций? Сколько есть? Разница.',
    solution:'50% от 496 000 = 248 000 ₽ — цель. Сейчас акций 280 000 ₽. Продать: 280 000 − 248 000 = **32 000 ₽** акций, купить облигаций на 32 000 ₽.',
  },

  {
    id:'p12', cat:'invest', diff:'hard', xp:60,
    icon:'📈', color:'rgba(77,166,255,.12)',
    title:'ИИС тип А: считаем выгоду',
    story:'Ирина открыла ИИС и внесла 400 000 ₽. Купила ОФЗ под 13% годовых. В конце года она подаст на налоговый вычет (тип А). Официальная зарплата — 80 000 ₽/мес.',
    question:'Сколько рублей Ирина получит СУММАРНО (купонный доход + налоговый вычет) за первый год?',
    type:'number', answer:104000, tolerance:1000,
    unit:'₽',
    hint:'Купон = 400 000 × 13%. Вычет тип А = 13% от суммы взноса (до 400 000 ₽).',
    solution:'Купонный доход: 400 000 × 0.13 = **52 000 ₽**. Вычет тип А: 400 000 × 0.13 = **52 000 ₽**. Итого: **104 000 ₽** = 26% годовых практически без риска.',
  },

  {
    id:'p13', cat:'invest', diff:'medium', xp:35,
    icon:'📈', color:'rgba(77,166,255,.12)',
    title:'Подушка безопасности: хватит ли?',
    story:'Расходы Кирилла — 65 000 ₽/мес. На накопительном счёте лежит 180 000 ₽.',
    question:'На сколько ПОЛНЫХ месяцев хватит подушки безопасности Кирилла?',
    type:'number', answer:2, tolerance:0,
    unit:'мес',
    hint:'180 000 ÷ 65 000 = ? (целое число месяцев)',
    solution:'180 000 ÷ 65 000 = 2.76 → **2 полных месяца**. Это ниже рекомендуемого минимума (3 мес). Кириллу нужно ещё 15 000 ₽ для достижения 3-месячной подушки.',
  },


  // ─── ДОЛГИ ─────────────────────────────────────────────
  {
    id:'p14', cat:'debt', diff:'easy', xp:25,
    icon:'💳', color:'rgba(255,107,107,.12)',
    title:'Реальная цена покупки в кредит',
    story:'Павел купил телефон за 60 000 ₽ в рассрочку на 12 месяцев под 0%. Но магазин добавил «страховку» 800 ₽/мес.',
    question:'Сколько рублей Павел реально заплатит за телефон (с учётом страховки)?',
    type:'number', answer:69600, tolerance:0,
    unit:'₽',
    hint:'60 000 + (800 × 12) = ?',
    solution:'60 000 + (800 × 12) = 60 000 + 9 600 = **69 600 ₽**. «Бесплатная рассрочка» стоила 16% от цены телефона.',
  },

  {
    id:'p15', cat:'debt', diff:'medium', xp:40,
    icon:'💳', color:'rgba(255,107,107,.12)',
    title:'Метод лавины: порядок погашения',
    story:'У Андрея три долга: кредитная карта 80 000 ₽ под 28%, автокредит 450 000 ₽ под 10%, потребкредит 120 000 ₽ под 19%.',
    question:'В каком порядке Андрей должен гасить долги методом лавины? Введи номера через запятую (1=карта, 2=авто, 3=потребкредит)',
    type:'choice',
    options:['1 → 3 → 2 (от дорогого к дешёвому)','2 → 3 → 1 (от большого к маленькому)','3 → 1 → 2 (средний первый)','1 → 2 → 3 (просто по порядку)'],
    correct:0,
    solution:'**Лавина = от наибольшей ставки**. Порядок: карта (28%) → потребкредит (19%) → авто (10%). Это экономит максимум на процентах. Снежный ком был бы: потребкредит → карта → авто (от меньшей суммы).',
  },

  {
    id:'p16', cat:'debt', diff:'medium', xp:45,
    icon:'💳', color:'rgba(255,107,107,.12)',
    title:'Переплата по минимальным платежам',
    story:'Света взяла кредит 100 000 ₽ под 24% годовых. Минимальный платёж — 3 000 ₽/мес. При таком темпе выплаты растягиваются на 5 лет (60 месяцев).',
    question:'Сколько рублей Света переплатит, если будет платить только минимум?',
    type:'number', answer:80000, tolerance:5000,
    unit:'₽',
    hint:'Всего выплатит = 3 000 × 60. Переплата = итого − долг.',
    solution:'3 000 × 60 = **180 000 ₽** суммарных выплат. Переплата: 180 000 − 100 000 = **80 000 ₽** (80% от суммы кредита!). Если платить по 5 000 ₽/мес — закроет за 26 мес и переплатит ~30 000 ₽.',
  },

  {
    id:'p17', cat:'debt', diff:'hard', xp:55,
    icon:'💳', color:'rgba(255,107,107,.12)',
    title:'Хороший vs плохой долг',
    story:'Вася рассматривает три варианта кредита: А) 200 000 ₽ на ремонт квартиры под 15% (квартира после ремонта вырастет в цене на 400 000 ₽), Б) 150 000 ₽ на новый телевизор под 22%, В) 300 000 ₽ на курсы программирования — ожидаемый рост дохода +60 000 ₽/мес.',
    question:'Какие из этих кредитов можно считать «хорошими»? (выбери один ответ)',
    type:'choice',
    options:['Только А (ремонт)', 'Только В (образование)', 'А и В (актив растёт или доход растёт)', 'Все три (любой кредит нормален)'],
    correct:2,
    solution:'**А и В — хорошие долги**: А) квартира подорожает на 400к при затратах ~30к процентов = выгодно. В) курсы дадут +720 000 ₽/год, кредит стоит ~66 000 ₽/год процентами = ROI огромный. Б) телевизор обесценится — классический плохой долг.',
  },

  {
    id:'p18', cat:'debt', diff:'easy', xp:20,
    icon:'💳', color:'rgba(255,107,107,.12)',
    title:'Эффективная ставка микрозайма',
    story:'Реклама МФО: «Займ 10 000 ₽ на 10 дней, комиссия 1% в день». Вася решил взять 10 000 ₽.',
    question:'Сколько рублей Вася заплатит в виде процентов за 10 дней?',
    type:'number', answer:1000, tolerance:0,
    unit:'₽',
    hint:'1% в день × 10 дней × 10 000 ₽',
    solution:'10 000 × 1% × 10 = **1 000 ₽** за 10 дней. Это 36 500% годовых. Если не вернуть вовремя — долг начнёт расти по той же ставке.',
  },


  // ─── СЦЕНАРИИ ──────────────────────────────────────────
  {
    id:'p19', cat:'scenario', diff:'medium', xp:40,
    icon:'🎭', color:'rgba(167,139,250,.12)',
    title:'Неожиданный доход: как распорядиться?',
    story:'Катя получила премию 80 000 ₽. У неё есть: кредит 50 000 ₽ под 24%, подушка безопасности на 1 месяц (нужно 3), и мечта о путешествии за 60 000 ₽.',
    question:'Какая стратегия использования премии наиболее финансово грамотная?',
    type:'choice',
    options:[
      '80 000 ₽ — сразу в путешествие, жизнь одна',
      '50 000 ₽ закрыть кредит, 30 000 ₽ в подушку',
      '40 000 ₽ в подушку, 40 000 ₽ погасить часть кредита',
      '80 000 ₽ инвестировать в акции',
    ],
    correct:1,
    solution:'**Закрыть кредит (50k) + добавить в подушку (30k)** — оптимально. Кредит под 24% «стоит» больше чем любая инвестиция гарантированно. Путешествие можно запланировать через 2–3 месяца экономии, когда долг закрыт.',
  },

  {
    id:'p20', cat:'scenario', diff:'hard', xp:60,
    icon:'🎭', color:'rgba(167,139,250,.12)',
    title:'FIRE-номер: хватит ли капитала?',
    story:'Денис накопил 12 000 000 ₽ и хочет «выйти на пенсию» в 42 года. Его текущие расходы — 55 000 ₽/мес. Он планирует снимать 4% от портфеля в год (правило 4%).',
    question:'Хватит ли 12 млн ₽ для финансовой независимости при таких расходах? Введи 1 = да, 0 = нет',
    type:'number', answer:0, tolerance:0,
    unit:'(1=да, 0=нет)',
    hint:'Правило 4%: безопасный ежегодный вывод = капитал × 4%. Сравни с реальными расходами в год.',
    solution:'Расходы: 55 000 × 12 = **660 000 ₽/год**. 4% от 12 млн = **480 000 ₽/год**. 480 000 < 660 000 — не хватает! Нужно: 660 000 ÷ 0.04 = **16 500 000 ₽**. Денису нужно ещё 4,5 млн.',
  },

  {
    id:'p21', cat:'scenario', diff:'medium', xp:45,
    icon:'🎭', color:'rgba(167,139,250,.12)',
    title:'Покупать или арендовать?',
    story:'Ваня выбирает: купить квартиру за 8 млн ₽ (ипотека 20%, 20 лет, платёж ~74 000 ₽/мес) или арендовать аналогичную за 45 000 ₽/мес и вкладывать разницу в ETF под 15%.',
    question:'Если Ваня арендует и инвестирует разницу 29 000 ₽/мес под 15% — сколько накопит за 10 лет (в миллионах, округли до целых)?',
    type:'number', answer:8, tolerance:1,
    unit:'млн ₽',
    hint:'FV = 29 000 × ((1.0118)^120 − 1) / 0.0118. Или приблизительно: ~29 000 × 270 = 7,8 млн',
    solution:'29 000 ₽/мес под 15%/год за 10 лет ≈ **8 000 000 ₽** (почти стоимость квартиры). При этом Ваня сохраняет ликвидность и может продолжить инвестировать дальше. Математика часто в пользу аренды + инвестиций.',
  },

  {
    id:'p22', cat:'scenario', diff:'easy', xp:25,
    icon:'🎭', color:'rgba(167,139,250,.12)',
    title:'Психология: эффект якоря',
    story:'В магазине ты видишь куртку со стикером «Было 12 000 ₽ → Скидка 50% → 6 000 ₽». Ты чувствуешь что это выгодно.',
    question:'Какой вопрос НЕ позволит маркетологам тебя обмануть? Выбери самый правильный.',
    type:'choice',
    options:[
      'Сколько стоит эта куртка в других магазинах?',
      'Нужна ли мне эта куртка вообще и сколько она стоит в часах моей работы?',
      'Настоящая ли скидка или нарисованная цена «было»?',
      'Есть ли ещё скидки в этом магазине?',
    ],
    correct:1,
    solution:'Правильный вопрос: **«Нужна ли мне куртка и сколько это стоит в часах работы?»** Он разрывает якорный эффект и включает рациональное мышление. Вопросы о «настоящей» скидке всё равно держат тебя в рамке «выгодно/невыгодно», а не «нужно/не нужно».',
  },

  {
    id:'p23', cat:'scenario', diff:'hard', xp:65,
    icon:'🎭', color:'rgba(167,139,250,.12)',
    title:'Инвестиционный выбор под давлением',
    story:'Друг зовёт вложить 200 000 ₽ в его «бизнес». Обещает 40% за 3 месяца. Документов нет, договора нет. У тебя эти деньги — подушка безопасности.',
    question:'Что правильнее всего сделать? Выбери ответ.',
    type:'choice',
    options:[
      'Вложить — 40% за 3 месяца это 160% годовых, отличная доходность',
      'Вложить только 50 000 ₽ — диверсификация',
      'Не вкладывать — это признаки финансовой пирамиды или мошенничества',
      'Попросить месяц на размышление и тогда решить',
    ],
    correct:2,
    solution:'**Не вкладывать** — это признаки мошенничества: обещание аномальной доходности (160%/год!), отсутствие документов, личные отношения как замена договору, давление на решение. Подушка безопасности — неприкосновенна по определению. Любой «гарантированный» высокий доход — красный флаг.',
  },

  {
    id:'p24', cat:'scenario', diff:'medium', xp:40,
    icon:'🎭', color:'rgba(167,139,250,.12)',
    title:'Рост дохода: куда направить прибавку?',
    story:'Ольге повысили зарплату с 70 000 до 90 000 ₽/мес (+20 000 ₽). У неё нет долгов, подушка = 3 месяца расходов, и уже есть ИИС.',
    question:'Как оптимально распорядиться дополнительными 20 000 ₽/мес?',
    type:'distribute',
    fields:[
      {id:'ds_save',  label:'Накопления / инвестиции', correct:14000, tolerance:4000},
      {id:'ds_life',  label:'Улучшение жизни',         correct:4000,  tolerance:3000},
      {id:'ds_fund',  label:'Образование / развитие',  correct:2000,  tolerance:2000},
    ],
    total:20000,
    solution:'Рекомендация: **≥70% (14 000 ₽) инвестировать** (ИИС/ETF) — ты уже привыкла жить на 70 000 ₽. **~20% на улучшение жизни** — заслуженно. **~10% на развитие** — навыки увеличат следующую прибавку. Главное — не раздуть образ жизни пропорционально доходу.',
  },

  {
    id:'p25', cat:'scenario', diff:'hard', xp:55,
    icon:'🎭', color:'rgba(167,139,250,.12)',
    title:'Инфляция съедает сбережения',
    story:'Бабушка Тамара Ивановна хранит 500 000 ₽ наличными «на всякий случай». Инфляция — 10% в год.',
    question:'Через 5 лет реальная покупательная сила этих денег составит примерно сколько рублей (в ценах сегодняшнего дня)?',
    type:'number', answer:310000, tolerance:15000,
    unit:'₽',
    hint:'Каждый год покупательная сила × 0.91 (теряет 10%). Пять раз.',
    solution:'500 000 × (0.9)^5 = 500 000 × 0.59 ≈ **295 000 ₽** (≈310 000 при точной формуле). За 5 лет деньги «сгорели» почти на 190 000 ₽ — 38% от суммы. Даже простой вклад под 12% сохранил бы и приумножил.',
  },

  {
    id:'p26', cat:'scenario', diff:'medium', xp:40,
    icon:'🎭', color:'rgba(167,139,250,.12)',
    title:'Налоговый вычет: считаем выгоду',
    story:'Артём зарабатывает 100 000 ₽/мес и в этом году потратил: на лечение зубов 80 000 ₽, на курсы английского 40 000 ₽, на абонемент в зал 36 000 ₽.',
    question:'Сколько рублей Артём может вернуть через налоговый социальный вычет? (лимит базы 150 000 ₽/год)',
    type:'number', answer:19500, tolerance:500,
    unit:'₽',
    hint:'Суммируй расходы. Если > 150 000 ₽, берёшь 150 000. Считаешь 13% от базы.',
    solution:'80 000 + 40 000 + 36 000 = 156 000 ₽. Лимит базы: **150 000 ₽**. Возврат: 150 000 × 13% = **19 500 ₽**. Оформляется через nalog.ru за 2–3 часа.',
  },

  {
    id:'p27', cat:'invest', diff:'hard', xp:60,
    icon:'📈', color:'rgba(77,166,255,.12)',
    title:'Сколько лет до цели?',
    story:'У Марины 0 ₽ накоплений. Она хочет накопить 3 000 000 ₽ на первый взнос по ипотеке. Может откладывать 30 000 ₽/мес под 13% годовых.',
    question:'Примерно через сколько лет Марина накопит 3 000 000 ₽? (округли до целых)',
    type:'number', answer:6, tolerance:1,
    unit:'лет',
    hint:'При 30 000/мес без процентов = 100 месяцев. С процентами быстрее. Ответ около 6–7 лет.',
    solution:'По формуле будущей стоимости аннуитета: при 30 000 ₽/мес и 13%/год нужно ~**72–74 месяца = ~6 лет**. Без процентов ушло бы 100 месяцев (8,3 года). Сложный процент экономит более 2 лет.',
  },

  {
    id:'p28', cat:'budget', diff:'hard', xp:50,
    icon:'💰', color:'rgba(45,232,176,.12)',
    title:'Лайфстайл-инфляция',
    story:'Рост зарплаты Игоря за 3 года: 60 000 → 80 000 → 110 000 ₽. Его накопления остались 0. Каждый раз с ростом дохода росли и расходы.',
    question:'Если бы Игорь откладывал ТОЛЬКО половину каждой прибавки — сколько накопил бы за 3 года (без процентов)? Первая прибавка — через год, вторая — через 2 года.',
    type:'number', answer:390000, tolerance:5000,
    unit:'₽',
    hint:'Прибавка 1: +20 000, половина = 10 000 ₽/мес × 24 мес. Прибавка 2: +30 000, половина = 15 000 ₽/мес × 12 мес.',
    solution:'Прибавка 1: 10 000 × 24 = 240 000 ₽. Прибавка 2: 15 000 × 12 = 180 000 ₽. Итого: **390 000 ₽** — без единого ущемления, просто откладывая половину прибавок. Это называется «антилайфстайл-инфляция».',
  },

  {
    id:'p29', cat:'debt', diff:'hard', xp:55,
    icon:'💳', color:'rgba(255,107,107,.12)',
    title:'Рефинансирование: стоит ли?',
    story:'У Николая ипотека: остаток 2 500 000 ₽, ставка 17%, платёж 38 000 ₽/мес, осталось 10 лет. Банк предлагает рефинансирование: 12%, платёж снизится до 29 500 ₽/мес. Комиссия за рефинансирование: 50 000 ₽.',
    question:'За сколько месяцев окупится комиссия за счёт снижения платежа? (округли до целых)',
    type:'number', answer:6, tolerance:1,
    unit:'мес',
    hint:'Ежемесячная экономия = разница платежей. Окупаемость = комиссия ÷ экономия.',
    solution:'Экономия: 38 000 − 29 500 = **8 500 ₽/мес**. Окупаемость: 50 000 ÷ 8 500 = **~6 месяцев**. За оставшиеся 114 месяцев сэкономит 8 500 × 114 − 50 000 = **~919 000 ₽**. Однозначно выгодно.',
  },

  {
    id:'p30', cat:'scenario', diff:'hard', xp:70,
    icon:'🎭', color:'rgba(167,139,250,.12)',
    title:'Итоговая задача: финансовый план',
    story:'Дано: доход 85 000 ₽/мес, расходы 60 000 ₽, долг по карте 45 000 ₽ (24%), подушка — 1 месяц расходов (цель 3 мес), инвестиций нет, цель — FIRE через 20 лет при расходах 60 000 ₽/мес.',
    question:'Что нужно сделать В ПЕРВУЮ ОЧЕРЕДЬ из перечисленного?',
    type:'choice',
    options:[
      'Начать инвестировать в ETF — время работает',
      'Закрыть долг по карте (24%) — это гарантированная доходность 24%',
      'Сначала довести подушку до 3 месяцев',
      'Купить ОФЗ на ИИС — налоговая льгота важнее долга',
    ],
    correct:1,
    solution:'**Закрыть долг под 24% — первый приоритет.** Нет ни одной гарантированной инвестиции с доходностью 24%+. Пока карта открыта, любые «инвестиции» дают отрицательный реальный эффект. После долга — пополнить подушку до 3 мес, затем ИИС и ETF. Правильный порядок: долг → подушка → инвестиции.',
  },
];


// ── XP и уровни ──
const XP_LEVELS = [
  { level:1, name:'Новичок',     xpNeeded:0,    badge:'⭐ 1' },
  { level:2, name:'Осознанный',  xpNeeded:150,  badge:'⭐ 2' },
  { level:3, name:'Дисциплина',  xpNeeded:350,  badge:'🌟 3' },
  { level:4, name:'Инвестор',    xpNeeded:650,  badge:'🌟 4' },
  { level:5, name:'Стратег',     xpNeeded:1000, badge:'💎 5' },
  { level:6, name:'Мастер',      xpNeeded:1500, badge:'💎 6' },
  { level:7, name:'Легенда',     xpNeeded:2200, badge:'👑 7' },
];

// ── Достижения ──
const ACHIEVEMENTS = [
  // ── Знания ──
  { id:'first_lesson',   icon:'📚', name:'Первый шаг',        desc:'Пройдён первый урок Академии',         cat:'knowledge', condition: s => s.lessonsCompleted >= 1 },
  { id:'five_lessons',   icon:'🎓', name:'Студент',            desc:'Завершено 5 уроков',                    cat:'knowledge', condition: s => s.lessonsCompleted >= 5 },
  { id:'all_lessons',    icon:'🏛️', name:'Академик',           desc:'Завершены все курсы Академии',          cat:'knowledge', condition: s => s.lessonsCompleted >= 16 },
  { id:'all_basic',      icon:'✅', name:'Основы заложены',    desc:'Пройдены курсы по 50/30/20, сложному проценту и цели', cat:'knowledge', condition: s => ['c1','c2','c3'].every(id=>s.completedCourses.includes(id)) },
  { id:'streak3',        icon:'🔥', name:'Три дня огня',       desc:'3 дня подряд в Академии',               cat:'knowledge', condition: s => s.learningStreak >= 3 },
  { id:'streak7',        icon:'⚡', name:'Недельный марафон',  desc:'7 дней подряд без перерыва',            cat:'knowledge', condition: s => s.learningStreak >= 7 },
  // ── Задачи ──
  { id:'first_problem',  icon:'🧮', name:'Первый расчёт',      desc:'Решена первая задача',                  cat:'tasks', condition: s => s.solvedProblems && Object.keys(s.solvedProblems).length >= 1 },
  { id:'prob5',          icon:'🔢', name:'Пять задач',         desc:'Решено 5 практических задач',           cat:'tasks', condition: s => s.solvedProblems && Object.keys(s.solvedProblems).length >= 5 },
  { id:'prob15',         icon:'🏅', name:'Мастер счёта',       desc:'Решено 15 задач — серьёзный уровень',   cat:'tasks', condition: s => s.solvedProblems && Object.keys(s.solvedProblems).length >= 15 },
  { id:'prob_all',       icon:'🥇', name:'Легенда задач',      desc:'Все 30 задач пройдены!',                cat:'tasks', condition: s => s.solvedProblems && Object.keys(s.solvedProblems).length >= 30 },
  // ── Финансы ──
  { id:'first_tx',       icon:'💳', name:'Первая операция',    desc:'Первая транзакция записана',            cat:'finance', condition: () => DB.transactions.length >= 1 },
  { id:'budget_master',  icon:'📊', name:'Бюджет под контролем',desc:'Записано 20 операций',                cat:'finance', condition: () => DB.transactions.length >= 20 },
  { id:'saver',          icon:'🏦', name:'Накопитель',         desc:'Первое накопление зафиксировано',       cat:'finance', condition: () => (DB.savings||[]).length >= 1 },
  { id:'investor',       icon:'📈', name:'Инвестор',           desc:'Первый актив добавлен в портфель',      cat:'finance', condition: () => DB.assets.length >= 1 },
  // ── Привычки ──
  { id:'first_habit',    icon:'🌱', name:'Первая привычка',    desc:'Создана первая привычка',               cat:'habits', condition: () => DB.habits.length >= 1 },
  { id:'habit5',         icon:'💪', name:'Пять привычек',      desc:'5 активных привычек',                   cat:'habits', condition: () => DB.habits.length >= 5 },
  { id:'insight_guru',   icon:'💡', name:'Гуру инсайтов',      desc:'5 финансовых инсайтов записано',        cat:'habits', condition: () => DB.insights.length >= 5 },
];

// ── Daily challenges ──
const DAILY_CHALLENGES = [
  {
    text: 'Добавь сегодняшний расход — даже самый маленький. Осознанность начинается с учёта.',
    xp: 20, action: 'Добавить расход', target: 'tx-expense',
    check: () => {
      const today = todayISO();
      return DB.transactions.some(t => t.type === 'expense' && t.date === today);
    }
  },
  {
    text: 'Отметь хотя бы одну привычку выполненной сегодня.',
    xp: 15, action: 'К привычкам', target: 'system',
    check: () => {
      const today = todayISO();
      return DB.habits.some(h => h.completions?.[today]);
    }
  },
  {
    text: 'Проверь свой бюджет 50/30/20: в каком секторе ты сейчас?',
    xp: 20, action: 'Открыть бюджет', target: 'capital',
    check: () => false // навигационное задание, выполняется кликом
  },
  {
    text: 'Запиши один финансовый инсайт — мысль, вывод или урок из своего опыта.',
    xp: 25, action: 'Добавить инсайт', target: 'academy',
    check: () => {
      const today = todayISO();
      return DB.insights.some(i => i.date === today);
    }
  },
  {
    text: 'Посмотри на страницу Рост: как изменился твой финансовый счёт?',
    xp: 15, action: 'Открыть Рост', target: 'growth',
    check: () => false
  },
  {
    text: 'Добавь или обнови сумму одного из своих активов.',
    xp: 20, action: 'Мои активы', target: 'capital',
    check: () => DB.assets.length > 0
  },
  {
    text: 'Пройди хотя бы один урок в Академии сегодня.',
    xp: 30, action: 'Выбрать урок', target: 'academy',
    check: () => {
      const s = getAcademyState();
      return s.lastLearnDate === todayISO() && s.lessonsCompleted > 0;
    }
  },
];

function getAcademyState() {
  if (!DB.academy) DB.academy = { completedCourses:[], totalXP:0, lessonsCompleted:0, learningStreak:0, lastLearnDate:'', dailyChallengeDate:'', dailyChallengeDone:false };
  return DB.academy;
}

// Auto-complete daily challenge if its condition is already met
function checkDailyChallengeAuto() {
  const s = getAcademyState();
  const today = todayISO();
  if (s.dailyChallengeDate === today && s.dailyChallengeDone) return; // already done
  const challengeIdx = new Date().getDay();
  const challenge = DAILY_CHALLENGES[challengeIdx];
  if (!challenge?.check) return;
  if (challenge.check()) {
    s.dailyChallengeDate = today;
    s.dailyChallengeDone = true;
    s.totalXP += challenge.xp;
    saveDB();
    showToast('⭐ Задание дня выполнено! +' + challenge.xp + ' XP');
  }
}

function getCurrentLevel(xp) {
  let cur = XP_LEVELS[0];
  for (const lv of XP_LEVELS) { if (xp >= lv.xpNeeded) cur = lv; }
  return cur;
}

function getNextLevel(xp) {
  return XP_LEVELS.find(lv => lv.xpNeeded > xp);
}

function addXP(amount) {
  const s = getAcademyState();
  const prevLevel = getCurrentLevel(s.totalXP).level;
  s.totalXP += amount;
  const newLevel = getCurrentLevel(s.totalXP).level;
  saveDB();
  if (newLevel > prevLevel) {
    const lv = getCurrentLevel(s.totalXP);
    showToast('🎉 Новый уровень: ' + lv.name + '!');
  } else {
    showToast('⭐ +' + amount + ' XP');
  }
  renderAcademy();
}

function renderAcademy() {
  const s = getAcademyState();
  const lv = getCurrentLevel(s.totalXP);
  const nxt = getNextLevel(s.totalXP);

  // XP bar
  document.getElementById('aca-level-name').textContent = lv.name;
  document.getElementById('aca-level-badge').textContent = lv.badge;
  document.getElementById('aca-xp-label').textContent = s.totalXP + ' XP';
  const solvedCount = s.solvedProblems ? Object.keys(s.solvedProblems).length : 0;
  const probEl = document.getElementById('aca-problems-done');
  if (probEl) probEl.textContent = solvedCount;
  document.getElementById('aca-lessons-done').textContent = s.lessonsCompleted;
  document.getElementById('aca-xp-total').textContent = s.totalXP;
  document.getElementById('aca-streak').textContent = s.learningStreak + ' 🔥';
  if (nxt) {
    const pct = Math.round((s.totalXP - lv.xpNeeded) / (nxt.xpNeeded - lv.xpNeeded) * 100);
    document.getElementById('aca-xp-bar').style.width = pct + '%';
    document.getElementById('aca-xp-next').textContent = 'до ' + nxt.name + ': ' + (nxt.xpNeeded - s.totalXP) + ' XP';
  } else {
    document.getElementById('aca-xp-bar').style.width = '100%';
    document.getElementById('aca-xp-next').textContent = 'Максимальный уровень!';
  }

  // Daily challenge
  const today = todayISO();
  const challengeIdx = new Date().getDay(); // 0-6
  const challenge = DAILY_CHALLENGES[challengeIdx];

  // Auto-complete: check if user already satisfied the condition (e.g. marked a habit)
  const alreadyDoneManually = s.dailyChallengeDate === today && s.dailyChallengeDone;
  const conditionMet = challenge.check ? challenge.check() : false;

  if (!alreadyDoneManually && conditionMet) {
    // Silently award XP without showing toast or navigating
    s.dailyChallengeDate = today;
    s.dailyChallengeDone = true;
    s.totalXP += challenge.xp;
    saveDB();
  }

  const isDone = (s.dailyChallengeDate === today && s.dailyChallengeDone);
  document.getElementById('daily-challenge-xp').textContent = '+' + challenge.xp + ' XP';
  document.getElementById('daily-challenge-body').textContent = challenge.text;
  const btn = document.getElementById('daily-challenge-btn');
  if (isDone) {
    btn.textContent = '✓ Выполнено сегодня';
    btn.style.background = 'rgba(45,232,176,.15)';
    btn.style.color = 'var(--mint)';
    btn.style.boxShadow = 'none';
    btn.onclick = null;
  } else {
    btn.textContent = challenge.action + ' →';
    btn.style.background = '';
    btn.style.color = '';
    btn.style.boxShadow = '';
    btn.onclick = () => completeDailyChallenge(challenge, challengeIdx);
  }

  // Achievements — trophy shelf
  if (!DB.seenAchievements) DB.seenAchievements = [];
  const earned = ACHIEVEMENTS.filter(a => a.condition(s));
  document.getElementById('aca-achiev-count').textContent = earned.length + '/' + ACHIEVEMENTS.length;

  // Achievement check handled by checkNewAchievements() in renderAll

  // Render trophy shelf by categories
  const CATS = [
    { key:'knowledge', label:'📚 Знания и Академия' },
    { key:'tasks',     label:'🧮 Задачи' },
    { key:'finance',   label:'💰 Финансы' },
    { key:'habits',    label:'⚡ Привычки' },
  ];
  const achHTML = CATS.map(cat => {
    const catAchs = ACHIEVEMENTS.filter(a => a.cat === cat.key);
    if (catAchs.length === 0) return '';
    const items = catAchs.map(a => {
      const isEarned = a.condition(s);
      return `<div class="trophy-item ${isEarned?'earned':'locked'}" ${isEarned?`onclick="showAchievementDetail('${a.id}')"`:''}
        title="${isEarned ? a.name+': '+a.desc : 'Закрыто — '+a.name}">
        <div class="trophy-icon-wrap">
          ${isEarned
            ? `<span style="position:relative;z-index:1">${a.icon}</span><div class="trophy-shine"></div>`
            : `<span style="font-size:1.1rem;opacity:.5">🔒</span>`}
        </div>
        <div class="trophy-name">${isEarned ? a.name : '???'}</div>
        ${isEarned && a.xp ? `<div style="font-size:.55rem;color:var(--gold);font-weight:800;margin-top:-2px">+${a.xp} XP</div>` : (isEarned ? '' : '')}
      </div>`;
    }).join('');
    return `<div class="trophy-shelf-row"><div class="trophy-shelf-label">${cat.label}</div><div class="trophy-shelf">${items}</div></div>`;
  }).join('');
  document.getElementById('achievements-list').innerHTML = achHTML;
  // Next lesson
  const nextCourse = COURSES.find(c => !s.completedCourses.includes(c.id));
  const nextCard = document.getElementById('next-lesson-card');
  if (nextCourse) {
    nextCard.style.display = 'block';
    document.getElementById('next-lesson-preview').innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;cursor:pointer" onclick="openLesson('${nextCourse.id}')">
        <div style="width:46px;height:46px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;background:${nextCourse.color};flex-shrink:0">${nextCourse.icon}</div>
        <div style="flex:1">
          <div style="font-family:var(--font-head);font-size:.88rem;font-weight:800">${nextCourse.title}</div>
          <div style="font-size:.68rem;color:var(--muted);margin-top:2px">${nextCourse.time} · +${nextCourse.xp} XP</div>
        </div>
        <div style="font-size:1.2rem;color:var(--gold)">▶</div>
      </div>`;
  } else {
    nextCard.style.display = 'none';
  }

  // Hero's Path (Skill Tree 2.0)
  renderHeroPath();

  // Benefit Tasks 2.0
  renderBenefitTasks();

  // Trophy Hall (Achievements 2.0)
  renderTrophyHall();

  // Check for new achievements
  checkStreakAchievements();

  // Insights
  renderInsights();
}

let _courseFilter = 'all';

/* ═══════════════════════════════════════
   AI — Claude API
═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   AI ASSISTANT
═══════════════════════════════════════ */
let _aiChatOpen = false;
let _aiMessages = [];
let _aiContextSnapshot = '';


/* ═══════════════════════════════════════════════════════════════
   PREDICTIVE FINANCIAL RISK ENGINE
   Система раннего предупреждения — анализирует все данные
   пользователя и генерирует ИИ-персонализированные риски.
═══════════════════════════════════════════════════════════════ */

let _riskCache = null;
let _riskCacheTime = 0;
let _riskDismissed = new Set();
const RISK_CACHE_TTL = 55 * 60 * 1000; // 55 минут

/* ── Математический движок рисков ── */
function calcPredictiveRisks() {
  const today  = new Date();
  const stats  = calcStats();
  const budget = calcBudget5020(stats.income, stats.expense);
  const daysInMonth  = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  const dayOfMonth   = today.getDate();
  const daysLeft     = daysInMonth - dayOfMonth;
  const risks = [];

  // ── 1. Баланс → ноль (дней до отрицательного баланса) ──────
  if (stats.expense > 0 && stats.income > 0) {
    const dailyExpense = stats.expense / dayOfMonth;
    const projectedExpenseEOM = dailyExpense * daysInMonth;
    const projectedBalance = stats.income - projectedExpenseEOM - stats.savedAmount;
    if (projectedBalance < 0) {
      const daysUntilNeg = dailyExpense > 0
        ? Math.max(1, Math.round(stats.balance / dailyExpense))
        : null;
      risks.push({
        id: 'balance_negative',
        severity: 'critical',
        ico: '🔴',
        headline: 'Баланс уйдёт в минус',
        metric: {
          daysUntilNeg,
          dailyExpense: Math.round(dailyExpense),
          projectedBalance: Math.round(projectedBalance),
          income: stats.income,
          expense: stats.expense,
          balance: stats.balance,
          daysLeft
        }
      });
    }
  }

  // ── 2. Подушка безопасности (сколько протянет без дохода) ───
  const totalSavings = DB.savings.reduce((s,e)=>s+e.amount,0);
  const totalAssets  = DB.assets.reduce((s,a)=>s+a.amount,0);
  const cushion      = totalSavings + totalAssets;
  const monthlyExpenseAvg = stats.expense > 0 ? stats.expense : 0;
  if (monthlyExpenseAvg > 0) {
    const cushionMonths = cushion / monthlyExpenseAvg;
    if (cushionMonths < 3 && cushion >= 0) {
      risks.push({
        id: 'cushion_low',
        severity: cushionMonths < 1 ? 'critical' : cushionMonths < 2 ? 'warn' : 'info',
        ico: '🛡',
        headline: cushionMonths < 1 ? 'Подушки безопасности почти нет' : 'Подушка слишком мала',
        metric: {
          cushionMonths: Math.round(cushionMonths * 10) / 10,
          cushion: Math.round(cushion),
          monthlyExpense: Math.round(monthlyExpenseAvg),
          recommended: Math.round(monthlyExpenseAvg * 3)
        }
      });
    }
  }

  // ── 3. Категория трат превысит лимит до конца месяца ──────
  if (budget && daysLeft > 0 && dayOfMonth > 3) {
    const checkCat = (catKey, catLabel, ico) => {
      const cat = budget[catKey];
      if (!cat || cat.limit <= 0) return;
      const dailyRate = cat.fact / dayOfMonth;
      const projectedFact = dailyRate * daysInMonth;
      const pct = projectedFact / cat.limit;
      if (pct >= 1.15) {
        risks.push({
          id: `budget_overrun_${catKey}`,
          severity: pct >= 1.5 ? 'critical' : 'warn',
          ico,
          headline: `Перерасход «${catLabel}» к концу месяца`,
          metric: {
            catLabel, catKey,
            currentFact: Math.round(cat.fact),
            projectedFact: Math.round(projectedFact),
            limit: Math.round(cat.limit),
            overrunPct: Math.round((pct-1)*100),
            daysLeft
          }
        });
      }
    };
    checkCat('needs', 'На жизнь', '🏠');
    checkCat('wants', 'Желания',  '✨');
  }

  // ── 4. Плановые платежи vs текущий баланс ─────────────────
  const recTotal   = DB.recurringPayments.reduce((s,r)=>s+r.amount,0);
  const upcoming7  = DB.recurringPayments.filter(r => {
    if (isPaymentPaid(r.id)) return false;
    const diff = Math.ceil((new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth) - today) / 86400000);
    return diff >= 0 && diff <= 14;
  });
  const upcoming7Sum = upcoming7.reduce((s,r)=>s+r.amount,0);
  if (upcoming7.length > 0 && stats.balance < upcoming7Sum * 1.1 && stats.balance >= 0) {
    risks.push({
      id: 'recurring_tight',
      severity: stats.balance < upcoming7Sum ? 'critical' : 'warn',
      ico: '💳',
      headline: 'Баланс едва покрывает платежи',
      metric: {
        upcoming: upcoming7.map(r=>({name:r.name, amount:r.amount, day:r.dayOfMonth})),
        upcomingSum: Math.round(upcoming7Sum),
        balance: Math.round(stats.balance),
        shortfall: Math.round(upcoming7Sum - stats.balance)
      }
    });
  }

  // ── 5. Скорость накоплений — отстаём от цели ──────────────
  if (DB.goals && DB.goals.length > 0) {
    DB.goals.forEach(goal => {
      if (!goal.deadline || goal.saved >= goal.target) return;
      const deadlineDate = new Date(goal.deadline);
      const monthsLeft = Math.max(0,
        (deadlineDate.getFullYear() - today.getFullYear()) * 12
        + (deadlineDate.getMonth() - today.getMonth())
      );
      if (monthsLeft <= 0) return;
      const needed = (goal.target - goal.saved) / monthsLeft;
      const monthlySav = DB.savings.filter(s => {
        const d = new Date(s.date);
        return d.getFullYear()===today.getFullYear() && d.getMonth()===today.getMonth();
      }).reduce((s,e)=>s+e.amount,0);
      if (monthlySav < needed * 0.6 && needed > 0) {
        risks.push({
          id: `goal_slow_${goal.id}`,
          severity: monthsLeft <= 3 ? 'critical' : monthlySav < needed * 0.3 ? 'warn' : 'info',
          ico: goal.emoji || '🎯',
          headline: `«${goal.name}» — не успеваем`,
          metric: {
            goalName: goal.name,
            target: goal.target,
            saved: goal.saved,
            remaining: goal.target - goal.saved,
            monthsLeft,
            neededMonthly: Math.round(needed),
            currentMonthly: Math.round(monthlySav),
            gap: Math.round(needed - monthlySav),
            deadline: goal.deadline
          }
        });
      }
    });
  }

  // ── 6. Доходы упали по сравнению с прошлым месяцем ────────
  const prevMonth = new Date(today.getFullYear(), today.getMonth()-1, 1);
  const prevTx = DB.transactions.filter(t => {
    const d = new Date(t.date);
    return d.getFullYear()===prevMonth.getFullYear() && d.getMonth()===prevMonth.getMonth();
  });
  const prevIncome = prevTx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
  if (prevIncome > 0 && stats.income > 0) {
    const dropPct = (prevIncome - stats.income) / prevIncome;
    if (dropPct >= 0.25) {
      risks.push({
        id: 'income_drop',
        severity: dropPct >= 0.5 ? 'critical' : 'warn',
        ico: '📉',
        headline: 'Доход значительно упал',
        metric: {
          prevIncome: Math.round(prevIncome),
          currIncome: Math.round(stats.income),
          dropPct: Math.round(dropPct*100),
          dayOfMonth
        }
      });
    }
  }

  // ── 7. Зависимость от одного источника дохода ─────────────
  if (stats.income > 0) {
    const incomeTx = DB.transactions.filter(t=>t.type==='income');
    const byCat = {};
    incomeTx.forEach(t => { byCat[t.category||'other'] = (byCat[t.category||'other']||0) + t.amount; });
    const catKeys = Object.keys(byCat);
    if (catKeys.length === 1) {
      const singleCat = catKeys[0];
      const singleTotal = byCat[singleCat];
      if (singleTotal >= 30000) {
        risks.push({
          id: 'income_single_source',
          severity: 'info',
          ico: '⚠️',
          headline: 'Единственный источник дохода',
          metric: {
            source: singleCat,
            amount: Math.round(singleTotal)
          }
        });
      }
    }
  }

  // ── 8. Норма сбережений слишком низкая ────────────────────
  if (stats.income > 0 && stats.savingsRate < 10 && dayOfMonth >= 10) {
    risks.push({
      id: 'savings_rate_low',
      severity: stats.savingsRate === 0 ? 'warn' : 'info',
      ico: '🏦',
      headline: 'Норма сбережений ниже нормы',
      metric: {
        savingsRate: stats.savingsRate,
        savedAmount: stats.savedAmount,
        income: stats.income,
        recommended: Math.round(stats.income * 0.20),
        gap: Math.round(stats.income * 0.20 - stats.savedAmount)
      }
    });
  }

  // ── 9. Долговая нагрузка высокая ─────────────────────────
  if (stats.income > 0 && recTotal > 0) {
    const debtRatio = recTotal / stats.income;
    if (debtRatio >= 0.4) {
      risks.push({
        id: 'debt_ratio_high',
        severity: debtRatio >= 0.6 ? 'critical' : 'warn',
        ico: '💸',
        headline: 'Высокая долговая нагрузка',
        metric: {
          recTotal: Math.round(recTotal),
          income: Math.round(stats.income),
          debtRatioPct: Math.round(debtRatio*100),
          safeLimit: Math.round(stats.income * 0.40)
        }
      });
    }
  }

  // ── 10. Траты растут каждый день (тренд) ─────────────────
  if (dayOfMonth >= 7 && stats.expense > 0) {
    const daysArr = Array.from({length: dayOfMonth}, (_,i) => i+1);
    const midpoint = Math.floor(dayOfMonth / 2);
    const firstHalfDays  = daysArr.filter(d => d <= midpoint).length;
    const secondHalfDays = daysArr.filter(d => d > midpoint).length;
    const allExpTx = DB.transactions.filter(t => {
      const d = new Date(t.date);
      const {year,month} = currentPeriod();
      return t.type==='expense' && t.category!=='savings'
        && d.getFullYear()===year && d.getMonth()===month;
    });
    const firstHalf  = allExpTx.filter(t => new Date(t.date).getDate() <= midpoint).reduce((s,t)=>s+t.amount,0);
    const secondHalf = allExpTx.filter(t => new Date(t.date).getDate() > midpoint).reduce((s,t)=>s+t.amount,0);
    const rate1 = firstHalfDays  > 0 ? firstHalf  / firstHalfDays  : 0;
    const rate2 = secondHalfDays > 0 ? secondHalf / secondHalfDays : 0;
    if (rate1 > 0 && rate2 > rate1 * 1.4 && secondHalfDays >= 3) {
      risks.push({
        id: 'expense_trend_up',
        severity: 'warn',
        ico: '📈',
        headline: 'Расходы ускоряются',
        metric: {
          rate1: Math.round(rate1),
          rate2: Math.round(rate2),
          growthPct: Math.round((rate2/rate1 - 1)*100),
          projectedMonth: Math.round(rate2 * daysInMonth)
        }
      });
    }
  }

  return risks;
}

/* ── Форматирование контекста для ИИ ── */
function buildRiskAIPrompt(risks) {
  const ctx = buildAIContext();
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  const dayOfMonth  = today.getDate();
  const daysLeft    = daysInMonth - dayOfMonth;

  const riskDescriptions = risks.map((r, i) => {
    const m = r.metric;
    let desc = '';
    switch(r.id) {
      case 'balance_negative':
        desc = `РИСК 1 (КРИТИЧЕСКИЙ): Баланс уйдёт в ноль.
  Текущий баланс: ${m.balance.toLocaleString('ru')} ₽. Средние ежедневные расходы: ${m.dailyExpense.toLocaleString('ru')} ₽/день.
  ${m.daysUntilNeg ? `При текущем темпе баланс станет отрицательным через ~${m.daysUntilNeg} дн.` : ''}
  До конца месяца: ${daysLeft} дн. Прогнозируемый баланс на конец месяца: ${m.projectedBalance.toLocaleString('ru')} ₽.`; break;
      case 'cushion_low':
        desc = `РИСК: Маленькая подушка безопасности.
  Накоплено всего: ${m.cushion.toLocaleString('ru')} ₽ = ${m.cushionMonths} мес. расходов.
  Рекомендуемый минимум: ${m.recommended.toLocaleString('ru')} ₽ (3 мес). Если потерять доход — хватит на ${m.cushionMonths} мес.`; break;
      case 'recurring_tight':
        desc = `РИСК: Баланс едва покрывает платежи.
  Ближайшие платежи: ${m.upcoming.map(p=>`${p.name} (${p.amount.toLocaleString('ru')} ₽, ${p.day} числа)`).join(', ')}.
  Сумма: ${m.upcomingSum.toLocaleString('ru')} ₽. Текущий баланс: ${m.balance.toLocaleString('ru')} ₽.
  ${m.balance < m.upcomingSum ? `ДЕФИЦИТ: ${m.shortfall.toLocaleString('ru')} ₽` : 'Едва хватает.'}`; break;
      case 'income_drop':
        desc = `РИСК: Доход упал на ${m.dropPct}%.
  Прошлый месяц: ${m.prevIncome.toLocaleString('ru')} ₽. Текущий (${m.dayOfMonth} дн.): ${m.currIncome.toLocaleString('ru')} ₽.`; break;
      case 'savings_rate_low':
        desc = `РИСК: Норма сбережений ${m.savingsRate}% (норма ≥20%).
  Доход: ${m.income.toLocaleString('ru')} ₽. Отложено: ${m.savedAmount.toLocaleString('ru')} ₽.
  Рекомендуется откладывать: ${m.recommended.toLocaleString('ru')} ₽/мес. Разрыв: ${m.gap.toLocaleString('ru')} ₽.`; break;
      case 'debt_ratio_high':
        desc = `РИСК: Долговая нагрузка ${m.debtRatioPct}% от дохода (критично >40%).
  Плановые платежи: ${m.recTotal.toLocaleString('ru')} ₽. Доход: ${m.income.toLocaleString('ru')} ₽. Безопасный порог: ${m.safeLimit.toLocaleString('ru')} ₽.`; break;
      case 'expense_trend_up':
        desc = `РИСК: Расходы ускоряются (рост ${m.growthPct}%).
  1-я половина месяца: ${m.rate1.toLocaleString('ru')} ₽/день. 2-я половина: ${m.rate2.toLocaleString('ru')} ₽/день.
  Прогноз расходов за месяц при текущем темпе: ${m.projectedMonth.toLocaleString('ru')} ₽.`; break;
      case 'income_single_source':
        desc = `РИСК: Единственный источник дохода — ${m.source}, ${m.amount.toLocaleString('ru')} ₽/мес.
  100% дохода из одного источника — высокий риск при потере работы/клиента.`; break;
      default:
        if (r.id.startsWith('budget_overrun_')) {
          const mm = m;
          desc = `РИСК: Перерасход «${mm.catLabel}». Потрачено ${mm.currentFact.toLocaleString('ru')} ₽, прогноз на конец месяца ${mm.projectedFact.toLocaleString('ru')} ₽ при лимите ${mm.limit.toLocaleString('ru')} ₽ (+${mm.overrunPct}%).`; break;
        }
        if (r.id.startsWith('goal_slow_')) {
          const mm = m;
          desc = `РИСК: Цель «${mm.goalName}» — не успеваем к сроку.
  Нужно: ${mm.neededMonthly.toLocaleString('ru')} ₽/мес, откладываем: ${mm.currentMonthly.toLocaleString('ru')} ₽/мес (разрыв ${mm.gap.toLocaleString('ru')} ₽). Осталось ${mm.monthsLeft} мес.`; break;
        }
    }
    return desc;
  }).filter(Boolean).join('\n\n');

  return `${ctx}

=== ЗАДАЧА — ПРЕДИКТИВНЫЕ ФИНАНСОВЫЕ РИСКИ ===
Проанализированы данные пользователя. Выявленные риски:

${riskDescriptions}

Для КАЖДОГО риска выше напиши ОДНО короткое предупреждение (1-2 предложения).
ТРЕБОВАНИЯ:
- Конкретные цифры и сроки ("через 18 дней", "через 4 месяца", "к 25-му числу").
- Живой, дружелюбный тон. Без паники, но с чёткостью.
- Начни каждое с маркера: [RISK_1], [RISK_2], ... — соответственно порядку рисков выше.
- Только текст предупреждений, без лишних объяснений.
- Язык: русский.
Пример: [RISK_1] Если траты останутся такими же, через 18 дней баланс станет отрицательным — сейчас тратишь ${m_example} ₽/день, а зарабатываешь меньше.`;
}

/* ── Отрисовка карточек рисков ── */
function renderPredictiveRisks(risks, aiTexts) {
  // compact mode: риски показываем через диалог из аватарки
  const block = document.getElementById('predictive-risks-block');
  if (block) block.innerHTML = '';

  const visible = (risks || []).filter(r => !_riskDismissed.has(r.id));
  _lastRisks = visible;
  _lastRiskTexts = aiTexts;

  updateRiskBadge(visible.length);
  renderRiskDialogContent(visible, aiTexts);

  // Автопоказ — по правилу пользователя (по умолчанию: warn+ и >=3 риска)
  const rule = (DB.settings && DB.settings.riskAutoRule) ? DB.settings.riskAutoRule : { mode: 'warn_count', minSeverity: 'warn', minCount: 3 };
  const warnPlus = visible.filter(r => r.severity === 'warn' || r.severity === 'critical').length;
  const hasCritical = visible.some(r => r.severity === 'critical');

  let shouldAuto = false;
  if (rule.mode === 'critical_any') {
    shouldAuto = hasCritical;
  } else if (rule.mode === 'warn_count') {
    const minCount = Math.max(1, +rule.minCount || 3);
    shouldAuto = warnPlus >= minCount;
  } else {
    // fallback
    shouldAuto = hasCritical;
  }

  if (!_riskAutoShown && shouldAuto && visible.length) {
    _riskAutoShown = true;
    setTimeout(() => { try { openRiskDialog(); } catch(e) {} }, 450);
  }
}


/* ── Обновить текст конкретной карточки от ИИ ── */
function updateRiskCardText(riskId, text) {
  const el = document.getElementById('risk-text-' + riskId);
  if (!el) return;
  el.textContent = text;
  el.classList.remove('loading');
}

/* ── Закрыть карточку риска ── */
function dismissRisk(id) {
  _riskDismissed.add(id);
  /* patch: risk dialog badge */
  try {
    _lastRisks = (_lastRisks||[]).filter(r => r.id !== id);
    updateRiskBadge(_lastRisks.length);
    renderRiskDialogContent(_lastRisks, _lastRiskTexts);
  } catch(e) {}
  const el = document.getElementById('rcard-' + id);
  if (el) {
    el.style.transition = 'all .28s ease';
    el.style.opacity = '0';
    el.style.transform = 'scale(.96) translateY(-4px)';
    setTimeout(() => {
      el.remove();
      // Если блок пуст — скрываем
      const block = document.getElementById('predictive-risks-block');
      if (block && !block.querySelector('.risk-card')) {
        block.innerHTML = '';
      }
    }, 300);
  }
}

/* ── Открыть чат с ИИ про этот риск ── */
function openRiskChat(riskId) {
  const PROMPTS = {
    balance_negative:     'Как мне избежать отрицательного баланса? Дай конкретный план.',
    cushion_low:          'Как мне быстрее нарастить подушку безопасности?',
    recurring_tight:      'У меня не хватает денег на плановые платежи — что делать?',
    income_drop:          'Мой доход упал — как скорректировать расходы и накопления?',
    savings_rate_low:     'Как увеличить норму сбережений с минимальными жертвами?',
    debt_ratio_high:      'Долговая нагрузка слишком высокая — как снизить?',
    expense_trend_up:     'Расходы растут — как остановить этот тренд?',
    income_single_source: 'Как диверсифицировать источники дохода?',
  };
  const prompt = PROMPTS[riskId] || (riskId.startsWith('budget_overrun_') ? 'Как контролировать расходы по категориям?' : riskId.startsWith('goal_slow_') ? 'Как ускорить накопления на цель?' : 'Объясни этот финансовый риск и как с ним справиться.');
  // Открываем AI ассистент и отправляем вопрос
  navTo('today');
  const aiCard = document.getElementById('ai-assistant-card');
  if (aiCard) aiCard.scrollIntoView({behavior:'smooth', block:'center'});
  setTimeout(() => {
    if (!_aiChatOpen) toggleAIChat();
    setTimeout(() => sendQuickPrompt(prompt), 200);
  }, 400);
}

/* ── Принудительное обновление ── */
function refreshPredictiveRisks() {
  _riskCache = null;
  _riskCacheTime = 0;
  _riskDismissed.clear();
  loadAIPredictiveRisks();
}

/* ── Главная функция: запуск системы рисков ── */
async function loadAIPredictiveRisks() {
  // Проверяем кэш
  const now = Date.now();
  if (_riskCache && (now - _riskCacheTime) < RISK_CACHE_TTL) {
    renderPredictiveRisks(_riskCache.risks, _riskCache.texts);
    return;
  }

  const risks = calcPredictiveRisks();
  if (risks.length === 0) {
    const el = document.getElementById('predictive-risks-block');
    if (el) el.innerHTML = '';
    return;
  }

  // Рендерим скелетоны немедленно
  renderPredictiveRisks(risks, null);

  // Если нет API ключа — показываем математические дефолты
  const key = getAIKey();
  if (!key) {
    const fallbacks = risks.map(r => _getRiskFallbackText(r));
    risks.forEach((r, i) => updateRiskCardText(r.id, fallbacks[i]));
    _riskCache = { risks, texts: fallbacks };
    _riskCacheTime = now;
    return;
  }

  // Вызов ИИ — генерация всех текстов одним запросом
  try {
    const prompt = buildRiskAIPrompt(risks);
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: getAIHeaders(),
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await res.json();
    const rawText = data.content?.[0]?.text?.trim() || '';

    // Парсим ответ — ищем [RISK_1], [RISK_2] ...
    const texts = risks.map((r, i) => {
      const idx = i + 1;
      const marker = `[RISK_${idx}]`;
      const nextMarker = `[RISK_${idx + 1}]`;
      const start = rawText.indexOf(marker);
      if (start === -1) return _getRiskFallbackText(r);
      const end = rawText.indexOf(nextMarker, start);
      const chunk = end === -1 ? rawText.slice(start) : rawText.slice(start, end);
      return chunk.replace(marker, '').trim();
    });

    // Обновляем карточки
    risks.forEach((r, i) => updateRiskCardText(r.id, texts[i]));

    // Кэшируем
    _riskCache = { risks, texts };
    _riskCacheTime = now;

  } catch(e) {
    // Fallback на математические тексты
    const fallbacks = risks.map(r => _getRiskFallbackText(r));
    risks.forEach((r, i) => updateRiskCardText(r.id, fallbacks[i]));
    _riskCache = { risks, texts: fallbacks };
    _riskCacheTime = now;
  }
}

/* ── Фоллбэк-тексты (без ИИ) ── */
function _getRiskFallbackText(r) {
  const m = r.metric;
  switch(r.id) {
    case 'balance_negative':
      return `При текущих тратах (${m.dailyExpense.toLocaleString('ru')} ₽/день)${m.daysUntilNeg ? ` баланс станет отрицательным через ~${m.daysUntilNeg} дн.` : ''} — до конца месяца прогноз: ${m.projectedBalance.toLocaleString('ru')} ₽.`;
    case 'cushion_low':
      return `Подушка безопасности (${m.cushion.toLocaleString('ru')} ₽) покроет лишь ${m.cushionMonths} мес. расходов. Рекомендуется минимум 3 месяца — нужно ещё ${(m.recommended - m.cushion).toLocaleString('ru')} ₽.`;
    case 'recurring_tight':
      return `Ближайшие платежи: ${m.upcomingSum.toLocaleString('ru')} ₽, а на балансе ${m.balance.toLocaleString('ru')} ₽. ${m.balance < m.upcomingSum ? `Нехватка: ${m.shortfall.toLocaleString('ru')} ₽.` : 'Едва хватает — не трать лишнего.'}`;
    case 'income_drop':
      return `Доход упал на ${m.dropPct}% по сравнению с прошлым месяцем (${m.prevIncome.toLocaleString('ru')} → ${m.currIncome.toLocaleString('ru')} ₽). Пересмотри расходы.`;
    case 'savings_rate_low':
      return `Откладываешь ${m.savingsRate}% дохода вместо рекомендуемых 20%. До нормы не хватает ${m.gap.toLocaleString('ru')} ₽/мес.`;
    case 'debt_ratio_high':
      return `Плановые платежи (${m.recTotal.toLocaleString('ru')} ₽) — это ${m.debtRatioPct}% твоего дохода. Безопасный порог — до 40%.`;
    case 'expense_trend_up':
      return `Расходы ускоряются: +${m.growthPct}%. Если темп сохранится, потратишь ${m.projectedMonth.toLocaleString('ru')} ₽ за месяц.`;
    case 'income_single_source':
      return `100% дохода (${m.amount.toLocaleString('ru')} ₽/мес) из одного источника — высокий риск финансовой нестабильности.`;
    default:
      if (r.id.startsWith('budget_overrun_'))
        return `«${m.catLabel}»: уже потрачено ${m.currentFact.toLocaleString('ru')} ₽, к концу месяца прогноз ${m.projectedFact.toLocaleString('ru')} ₽ при лимите ${m.limit.toLocaleString('ru')} ₽ (+${m.overrunPct}%).`;
      if (r.id.startsWith('goal_slow_'))
        return `«${m.goalName}»: нужно ${m.neededMonthly.toLocaleString('ru')} ₽/мес, откладываешь ${m.currentMonthly.toLocaleString('ru')} ₽/мес — разрыв ${m.gap.toLocaleString('ru')} ₽. До срока: ${m.monthsLeft} мес.`;
      return 'Выявлен потенциальный финансовый риск.';
  }
}

function buildAIContext() {
  const stats = calcStats();
  const todayKey = todayISO();
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  const daysLeft = daysInMonth - today.getDate();
  const monthNames = ['январе','феврале','марте','апреле','мае','июне','июле','августе','сентябре','октябре','ноябре','декабре'];

  const doneHabits   = DB.habits.filter(h =>  h.completions?.[todayKey]);
  const undoneHabits = DB.habits.filter(h => !h.completions?.[todayKey]);
  const todayTasks   = DB.tasks.filter(t => t.date === todayKey);
  const doneTasks    = todayTasks.filter(t => t.done);
  const undoneTasks  = todayTasks.filter(t => !t.done);
  const urgentPayments = DB.recurringPayments.filter(r => {
    if (isPaymentPaid(r.id)) return false;
    const diff = Math.ceil((new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth) - today) / 86400000);
    return diff >= 0 && diff <= 7;
  });
  const monthlySavings = DB.savings.filter(s => {
    const d = new Date(s.date);
    return d.getFullYear()===today.getFullYear() && d.getMonth()===today.getMonth();
  }).reduce((s,e)=>s+e.amount, 0);
  const totalAssets = DB.assets.reduce((s,a)=>s+a.amount, 0);
  const goalPct = Math.round((totalAssets+monthlySavings)/(DB.user.goal||7900000)*100);
  const recentInsights = DB.insights.slice(-2).map(i=>i.title).join(', ');
  const acSt = getAcademyState();
  const acLv = getCurrentLevel(acSt.totalXP);

  const GOAL_FOCUS = {
    save:    'Основная цель: создать финансовую подушку безопасности. Делай акцент на сбережениях, резервном фонде (3-6 месяцев расходов), снижении трат.',
    invest:  'Основная цель: начать инвестировать. Делай акцент на инвестиционных инструментах (акции, облигации, ETF, ИИС), долгосрочном росте капитала.',
    control: 'Основная цель: контролировать расходы. Делай акцент на анализе трат по категориям, бюджетировании, нахождении лишних расходов.',
    '100k':  'Основная цель: накопить $100k (≈9 млн ₽). Делай акцент на конкретном плане накоплений, инвестициях для роста, промежуточных чекпоинтах.',
    habits:  'Основная цель: выработать финансовую дисциплину. Делай акцент на регулярных привычках (трекинг трат, автоматические сбережения), мотивации.',
  };
  const LEVEL_DESC = {
    starter: 'Финансовый уровень: новичок. Накоплений нет или минимум. Нужны базовые советы, без сложных инструментов.',
    stable:  'Финансовый уровень: стабильный. Есть доход, но нет чёткой системы. Готов к базовым инструментам.',
    cushion: 'Финансовый уровень: средний. Есть подушка безопасности. Можно говорить об инвестициях и росте.',
    capital: 'Финансовый уровень: продвинутый. Есть свободный капитал. Интересует оптимизация и инвестиционные стратегии.',
  };
  const goalFocus = GOAL_FOCUS[DB.user.goalType] || GOAL_FOCUS.save;
  const levelDesc = LEVEL_DESC[DB.user.socialLevel] || LEVEL_DESC.starter;

  const ctx = `=== NOBILE AI — КОНТЕКСТ ПОЛЬЗОВАТЕЛЯ ===
СЕГОДНЯ: ${today.getDate()} ${['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][today.getMonth()]} ${today.getFullYear()} г. (${['воскресенье','понедельник','вторник','среда','четверг','пятница','суббота'][today.getDay()]})
До конца месяца: ${daysLeft === 0 ? 'сегодня последний день месяца' : `${daysLeft} дн.`}

ЦЕЛЬ ПОЛЬЗОВАТЕЛЯ: ${goalFocus}
УРОВЕНЬ: ${levelDesc}

ФИНАНСЫ (${['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'][today.getMonth()]} ${today.getFullYear()}):
- Доходы: ${stats.income.toLocaleString('ru')} ₽ | Расходы: ${stats.expense.toLocaleString('ru')} ₽ | Баланс: ${stats.balance.toLocaleString('ru')} ₽
- Норма сбережений: ${stats.savingsRate}%
- Накоплено в этом месяце: ${monthlySavings.toLocaleString('ru')} ₽
- Чистый капитал (все активы): ${totalAssets.toLocaleString('ru')} ₽
- Прогресс к цели (${(DB.user.goal||7900000).toLocaleString('ru')} ₽): ${goalPct}%

ПРИВЫЧКИ СЕГОДНЯ (${doneHabits.length}/${DB.habits.length}):
- Выполнены: ${doneHabits.map(h=>h.name).join(', ')||'нет'}
- Не выполнены: ${undoneHabits.map(h=>h.name).join(', ')||'нет'}

ЗАДАЧИ СЕГОДНЯ (${doneTasks.length}/${todayTasks.length} выполнено):
- Не выполнены: ${undoneTasks.map(t=>t.text).join(', ')||'нет'}

ПЛАНОВЫЕ ПЛАТЕЖИ (ближайшие 7 дней, неоплаченные):
${urgentPayments.length>0 ? urgentPayments.map(r=>`- ${r.name}: ${r.amount.toLocaleString('ru')} ₽ (${r.dayOfMonth} числа)`).join('\n') : '- нет срочных'}

АКАДЕМИЯ: уровень ${acLv.badge} ${acLv.name}, ${acSt.totalXP} XP, пройдено уроков: ${acSt.lessonsCompleted}, стрик: ${acSt.learningStreak} дн.
${recentInsights ? `ИНСАЙТЫ: ${recentInsights}` : ''}

НАВИГАЦИЯ В ПРИЛОЖЕНИИ (используй когда советуешь что-то найти):
- «Сегодня» (🏠) — главная: баланс, привычки, задачи, платежи, ИИ-ассистент
- «Рост» (✦) — динамика, бюджет 50/30/20, активы, калькулятор цели
- «Капитал» (💰) — операции (доходы/расходы), бюджет по категориям, плановые платежи, активы
- «Система» (✅) — привычки, задачи, настроение, инсайты
- «Академия» (🎓) — уроки, курсы, прогресс, ежедневные задания
- Кнопка «+» (FAB внизу) — быстро добавить доход, расход, привычку, инсайт
===`;

  _aiContextSnapshot = ctx;
  return ctx;
}

function buildDigest() {
  const todayKey = todayISO();
  const today = new Date();
  const stats = calcStats();
  const doneH    = DB.habits.filter(h =>  h.completions?.[todayKey]);
  const undoneH  = DB.habits.filter(h => !h.completions?.[todayKey]);
  const undoneTasks = DB.tasks.filter(t => t.date===todayKey && !t.done);
  const urgentPay   = DB.recurringPayments.filter(r => {
    if (isPaymentPaid(r.id)) return false;
    const diff = Math.ceil((new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth) - today) / 86400000);
    return diff >= 0 && diff <= 3;
  });
  const rows = [];

  if (stats.balance < 0) {
    rows.push({ ico:'🔴', text:`Баланс отрицательный: <b>${stats.balance.toLocaleString('ru')} ₽</b> — расходы превысили доходы.`, cls:'urgent' });
  } else if (stats.balance > 0) {
    rows.push({ ico:'💰', text:`Свободных средств: <b>${stats.balance.toLocaleString('ru')} ₽</b>. Норма сбережений: ${stats.savingsRate}%.`, cls:'ok' });
  }

  urgentPay.forEach(r => {
    const diff = Math.ceil((new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth) - today) / 86400000);
    const when = diff===0?'сегодня':`через ${diff} дн.`;
    rows.push({ ico:'⏰', text:`Платёж <b>${r.name}</b> — ${r.amount.toLocaleString('ru')} ₽ <b>${when}</b>!`, cls:'urgent' });
  });

  if (undoneTasks.length > 0) {
    rows.push({ ico:'📋', text:`Незавершённых задач: <b>${undoneTasks.length}</b> — ${undoneTasks.slice(0,2).map(t=>t.text).join(', ')}${undoneTasks.length>2?`...`:''}`, cls:'warn' });
  }

  if (DB.habits.length > 0) {
    if (undoneH.length === 0) {
      rows.push({ ico:'✅', text:`Все ${doneH.length} привычек выполнены! Отличный день.`, cls:'ok' });
    } else if (doneH.length > 0) {
      rows.push({ ico:'⚡', text:`Привычки ${doneH.length}/${DB.habits.length}. Осталось: <b>${undoneH.slice(0,2).map(h=>h.name).join(', ')}</b>${undoneH.length>2?` +${undoneH.length-2}`:''}`, cls:'warn' });
    } else {
      rows.push({ ico:'⚡', text:`Сегодня ещё не отмечено ни одной привычки из ${undoneH.length}.`, cls:'warn' });
    }
  }

  if (rows.length === 0) {
    rows.push({ ico:'💡', text:'Добавьте транзакции, привычки и задачи — тогда дам персональный анализ.', cls:'' });
  }
  return rows;
}

async function loadAIAdvice() {
  const digestEl = document.getElementById('ai-digest');
  if (!digestEl) return;
  const rows = buildDigest();
  digestEl.innerHTML = rows.map(r =>
    `<div class="ai-digest-row"><span class="ai-digest-ico">${r.ico}</span><span class="ai-digest-${r.cls||'ok'}">${r.text}</span></div>`
  ).join('');
  const statusEl = document.getElementById('ai-status-label');
  if (statusEl) {
    const hasUrgent = rows.some(r=>r.cls==='urgent');
    const hasWarn   = rows.some(r=>r.cls==='warn');
    statusEl.textContent = hasUrgent ? '⚠️ Есть срочное' : hasWarn ? '💬 Есть напоминания' : '✓ Всё под контролем';
  }
  renderQuickPrompts();
  if (!window._aiInsightLoaded) { window._aiInsightLoaded = true; loadAIInsight(); }
}

async function loadAIInsight() {
  const ctx = buildAIContext();
  const _h = new Date().getHours();
  const _greeting = _h >= 5 && _h < 12 ? 'доброе утро' : _h >= 12 && _h < 18 ? 'добрый день' : _h >= 18 && _h < 23 ? 'добрый вечер' : 'доброй ночи';
  const prompt = `${ctx}

Ты — Nobile AI, персональный ассистент. Сейчас ${_h}:00, значит нужно сказать "${_greeting}".
Проанализируй данные и дай ОДНО короткое (2-3 предложения) сообщение:
если есть срочный платёж — упомяни; если невыполненные задачи — напомни; если привычки не отмечены — мотивируй.
Живой тон, без канцелярщины. Только текст.`;
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:getAIHeaders(),
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:180, messages:[{role:'user',content:prompt}] })
    });
    const data = await res.json();
    const text = data.content?.[0]?.text?.trim();
    if (text) {
      if (_aiMessages.length === 0) {
        _aiMessages.push({ role:'assistant', content:text });
        if (_aiChatOpen) renderChatMessages();
      }
      const digestEl = document.getElementById('ai-digest');
      if (digestEl) {
        const row = document.createElement('div');
        row.className = 'ai-digest-row';
        row.style.marginTop = '4px';
        row.innerHTML = `<span class="ai-digest-ico">🤖</span><span style="color:var(--text);font-style:italic">${text}</span>`;
        digestEl.appendChild(row);
      }
    }
  } catch(e) {}
}

function toggleAIChat() {
  _aiChatOpen = !_aiChatOpen;
  const area = document.getElementById('ai-chat-area');
  const btn  = document.getElementById('ai-expand-btn');
  if (area) area.style.display = _aiChatOpen ? 'block' : 'none';
  if (btn)  btn.style.transform = _aiChatOpen ? 'rotate(180deg)' : '';
  if (_aiChatOpen) { renderChatMessages(); setTimeout(()=>document.getElementById('ai-input')?.focus(), 100); }
}

function renderChatMessages() {
  const el = document.getElementById('ai-messages');
  if (!el) return;
  if (_aiMessages.length === 0) {
    el.innerHTML = `<div style="text-align:center;color:var(--muted);font-size:.75rem;padding:12px 0">Задайте любой вопрос о финансах,<br>привычках или задачах</div>`;
    return;
  }
  el.innerHTML = _aiMessages.map(m =>
    `<div class="ai-msg ${m.role==='user'?'user':'bot'}">${m.content.replace(/\n/g,'<br>').replace(/\*\*(.+?)\*\*/g,'<b>$1</b>')}</div>`
  ).join('');
  el.scrollTop = el.scrollHeight;
}

function renderQuickPrompts() {
  const el = document.getElementById('ai-quick-prompts');
  if (!el) return;
  const todayKey = todayISO();
  const undoneH = DB.habits.filter(h=>!h.completions?.[todayKey]);
  const undoneTasks = DB.tasks.filter(t=>t.date===todayKey&&!t.done);
  const urgentPay = DB.recurringPayments.filter(r=>{
    if (isPaymentPaid(r.id)) return false;
    const today = new Date();
    const diff = Math.ceil((new Date(today.getFullYear(),today.getMonth(),r.dayOfMonth)-today)/86400000);
    return diff>=0&&diff<=7;
  });

  // Goal-specific prompts
  const level = DB.user.socialLevel || 'starter';
  const GOAL_PROMPTS = {
    save: {
      starter: ['🏦 Как начать копить?', '📝 Куда уходят мои деньги?', '💡 Первые шаги к подушке', '⚡ Привычки для накоплений'],
      stable:  ['🏦 Как быстрее накопить?', '📊 Анализ расходов', '💡 Где урезать бюджет?', '🎯 Стратегия подушки'],
      cushion: ['🚀 Сколько уже накоплено?', '📈 Куда вложить подушку?', '🎯 Следующая цель', '📊 Анализ расходов'],
      capital: ['📈 Оптимизация портфеля', '🎯 Следующий уровень', '💼 Диверсификация', '📊 Анализ расходов'],
    },
    invest: {
      starter: ['📚 Что такое инвестиции?', '💡 С чего начать новичку?', '⚠️ Как не потерять деньги?', '🏦 Сначала подушка?'],
      stable:  ['📈 С чего начать инвестировать?', '💼 Куда вложить деньги?', '📊 Анализ расходов', '🔄 Пассивный доход'],
      cushion: ['📈 ИИС или брокерский счёт?', '💼 ETF для начинающих', '🔄 Пассивный доход', '📊 Мой портфель'],
      capital: ['💼 Ребалансировка портфеля', '🌍 Зарубежные активы', '🔄 Дивиденды vs рост', '📊 Анализ портфеля'],
    },
    control: {
      starter: ['📝 Куда уходят деньги?', '💡 Топ-3 лишних трат', '✂️ Как начать экономить?', '📋 Простой бюджет'],
      stable:  ['📊 Анализ расходов', '💡 Где я трачу лишнее?', '📋 Бюджет на месяц', '✂️ Как сократить траты?'],
      cushion: ['📊 Оптимизация расходов', '💡 Где урезать ещё?', '📋 Бюджет месяца', '✂️ Умная экономия'],
      capital: ['📊 Расходы vs доходы', '💡 Налоговая оптимизация', '📋 Бюджет бизнеса', '✂️ Крупные расходы'],
    },
    '100k': {
      starter: ['🎯 Что такое $100k?', '📅 За сколько лет реально?', '💡 Первые шаги к цели', '🏦 Начни с малого'],
      stable:  ['🎯 План к $100k', '💰 Сколько откладывать?', '📈 Инвестиции для роста', '📊 Анализ расходов'],
      cushion: ['🎯 Прогресс к $100k', '📈 Ускорить накопление', '💰 Сколько ещё осталось?', '📊 Мой план'],
      capital: ['🏆 $100k близко!', '📈 Максимизировать доход', '💼 Следующий рубеж', '📊 Итоги квартала'],
    },
    habits: {
      starter: ['⚡ С какой привычки начать?', '🧠 Почему срываемся?', '📅 Система для новичка', '💡 5 минут в день'],
      stable:  ['⚡ Мои привычки', '🧠 Как не срываться?', '📅 Система дисциплины', '💡 Привычки богатых'],
      cushion: ['⚡ Прокачать привычки', '🧠 Автоматизация финансов', '📅 Система недели', '💡 Следующий уровень'],
      capital: ['⚡ Привычки 1%', '🧠 Системное мышление', '📅 Долгосрочные стратегии', '💼 Ментальные модели'],
    },
  };
  const gt = DB.user.goalType || 'save';
  const basePrompts = [...((GOAL_PROMPTS[gt] || GOAL_PROMPTS.save)[level] || (GOAL_PROMPTS[gt] || GOAL_PROMPTS.save).stable)];

  const prompts = [];
  if (urgentPay.length>0) prompts.push('⏰ Про платежи');
  if (undoneTasks.length>0) prompts.push('📋 Мои задачи');
  if (undoneH.length>0) prompts.push('⚡ Привычки');
  // fill remaining with goal-specific prompts, avoid duplicates
  for (const p of basePrompts) {
    if (prompts.length >= 4) break;
    if (!prompts.includes(p)) prompts.push(p);
  }
  el.innerHTML = prompts.slice(0,4).map(p =>
    `<div class="ai-quick-chip" onclick="sendQuickPrompt('${p}')">${p}</div>`
  ).join('');
}

async function sendQuickPrompt(text) {
  if (!_aiChatOpen) toggleAIChat();
  document.getElementById('ai-input').value = text;
  await sendAIMessage();
}

async function sendAIMessage() {
  const input = document.getElementById('ai-input');
  const text = input?.value?.trim();
  if (!text) return;
  input.value = ''; input.style.height = 'auto';
  _aiMessages.push({ role:'user', content:text });
  _aiMessages.push({ role:'assistant', content:'...' });
  renderChatMessages();
  const ctx = buildAIContext();
  const systemPrompt = `Ты — Nobile AI, персональный ассистент приложения для финансов и развития.
${ctx}
Отвечай кратко (2-4 предложения), по делу, на русском. Используй конкретные цифры из данных пользователя где уместно.`;
  const msgs = _aiMessages.slice(0,-1).map(m=>({role:m.role,content:m.content}));
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:getAIHeaders(),
      body: JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:350, system:systemPrompt, messages:msgs })
    });
    const data = await res.json();
    const reply = data.content?.[0]?.text?.trim() || 'Не удалось получить ответ.';
    _aiMessages[_aiMessages.length-1] = { role:'assistant', content:reply };
  } catch(e) {
    _aiMessages[_aiMessages.length-1] = { role:'assistant', content:'Ошибка соединения. Проверьте интернет.' };
  }
  renderChatMessages();
  renderQuickPrompts();
}

/* ═══════════════════════════════════════
   CURRENCY RATES
═══════════════════════════════════════ */
async function loadCurrency() {
  const pairs = [
    {code:'USD', flag:'🇺🇸', name:'Доллар'},
    {code:'EUR', flag:'🇪🇺', name:'Евро'},
    {code:'CNY', flag:'🇨🇳', name:'Юань'},
    {code:'AED', flag:'🇦🇪', name:'Дирхам'},
  ];

  function renderRates(rates, source) {
    const listEl = document.getElementById('currency-list');
    const timeEl = document.getElementById('currency-time');
    listEl.innerHTML = pairs.map(p => {
      const rub = rates[p.code] ? Math.round(rates[p.code] * 100) / 100 : null;
      if (!rub) return '';
      return `<div class="cur-row">
        <div><span class="cur-flag">${p.flag}</span><span class="cur-name">${p.name} ${p.code}</span></div>
        <div class="cur-val">${rub.toLocaleString('ru', {minimumFractionDigits:2, maximumFractionDigits:2})} ₽</div>
      </div>`;
    }).join('');
    const now = new Date();
    timeEl.textContent = now.getHours() + ':' + String(now.getMinutes()).padStart(2,'0') + ' · онлайн';
  }

  // Attempt 1: frankfurter.app — fetch from USD, then get RUB rate
  try {
    const res = await fetch('https://api.frankfurter.app/latest?from=USD&to=RUB,EUR,CNY');
    const data = await res.json();
    if (!data.rates || !data.rates.RUB) throw new Error('no RUB rate');
    const rubPerUsd = data.rates.RUB;
    const rates = {
      USD: rubPerUsd,
      EUR: Math.round(rubPerUsd / data.rates.EUR * 100) / 100,
      CNY: Math.round(rubPerUsd / data.rates.CNY * 100) / 100,
      AED: Math.round(rubPerUsd / 3.6725 * 100) / 100, // AED pegged to USD
    };
    renderRates(rates, 'frankfurter');
    return;
  } catch(e) {}

  // Attempt 2: fawazahmed0 via jsdelivr CDN — no CORS, free
  try {
    const res = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
    const data = await res.json();
    if (!data.usd || !data.usd.rub) throw new Error('no data');
    const rubPerUsd = data.usd.rub;
    const rates = {
      USD: Math.round(rubPerUsd * 100) / 100,
      EUR: data.usd.eur ? Math.round(rubPerUsd / data.usd.eur * 100) / 100 : null,
      CNY: data.usd.cny ? Math.round(rubPerUsd / data.usd.cny * 100) / 100 : null,
      AED: Math.round(rubPerUsd / 3.6725 * 100) / 100,
    };
    renderRates(rates, 'jsdelivr');
    return;
  } catch(e) {}

  // Attempt 3: exchangerate.host free API
  try {
    const res = await fetch('https://api.exchangerate.host/latest?base=USD&symbols=RUB,EUR,CNY,AED&access_key=free');
    const data = await res.json();
    if (!data.rates || !data.rates.RUB) throw new Error('no rates');
    const rubPerUsd = data.rates.RUB;
    const rates = {
      USD: rubPerUsd,
      EUR: Math.round(rubPerUsd / data.rates.EUR * 100) / 100,
      CNY: Math.round(rubPerUsd / data.rates.CNY * 100) / 100,
      AED: Math.round(rubPerUsd / (data.rates.AED||3.6725) * 100) / 100,
    };
    renderRates(rates, 'exchangerate');
    return;
  } catch(e) {}

  // All failed — show last known rates (approximate)
  document.getElementById('currency-list').innerHTML = pairs.map(p => {
    const approx = {USD:90, EUR:98, CNY:12.5, AED:24.5}[p.code];
    return `<div class="cur-row">
      <div><span class="cur-flag">${p.flag}</span><span class="cur-name">${p.name} ${p.code}</span></div>
      <div class="cur-val" style="color:var(--muted)">≈${approx} ₽</div>
    </div>`;
  }).join('');
  document.getElementById('currency-time').textContent = 'офлайн · приблизительно';
}

/* ═══════════════════════════════════════
   ONBOARDING
═══════════════════════════════════════ */
let _onbGoal = 'save';
let _onbLevel = 'starter';

function onbGoBack() {
  document.getElementById('onboarding-overlay').style.display = 'none';
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) {
    authScreen.style.display = 'block';
    authShowView('welcome');
  } else {
    localStorage.removeItem('nobile_auth');
    localStorage.removeItem('nobile_db');
    location.reload();
  }
}

function checkOnboarding() {
  if (!DB.user.onboarded) {
    const nameInput = document.getElementById('onb-name');
    if (DB.user.name && DB.user.name !== 'Пользователь' && DB.user.name !== 'Гость') {
      if (nameInput) nameInput.value = DB.user.name;
      const step1 = document.getElementById('onb-step-1');
      if (step1) {
        const firstName = DB.user.name.split(' ')[0];
        step1.innerHTML = `
          <div class="card mb16" style="text-align:center;padding:28px 20px">
            <div style="font-size:3rem;margin-bottom:12px">👋</div>
            <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:900;margin-bottom:8px">
              Привет, <span style="color:var(--gold)">${firstName}</span>!
            </div>
            <div style="font-size:.84rem;color:var(--muted);line-height:1.6">
              Рады видеть тебя в Nobile.<br>Осталось пара вопросов — и ты готов.
            </div>
          </div>
          <button class="btn-primary" onclick="onbNext(1)">Начать →</button>`;
      }
    }
    document.getElementById('onboarding-overlay').style.display = 'block';
  }
  updateAvatar();
}

function selectLevel(el, level) {
  _onbLevel = level;
  document.querySelectorAll('#onb-level-list .onb-goal-opt').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
}

function selectGoal(el, goal) {
  _onbGoal = goal;
  document.querySelectorAll('#onb-goal-list .onb-goal-opt').forEach(b => b.classList.remove('on'));
  el.classList.add('on');
}

// Which goals make sense for each social level
const ONB_RECOMMENDED = {
  starter: ['control', 'save', 'habits'],
  stable:  ['save', 'habits', 'control'],
  cushion: ['save', 'invest', '100k'],
  capital: ['invest', '100k', 'save'],
};

// Default goal amounts by level
const ONB_GOAL_AMOUNTS = {
  starter: 300000,
  stable:  600000,
  cushion: 1500000,
  capital: 9000000,
};

// Sub-label on goal step based on level
const ONB_LEVEL_SUBLABEL = {
  starter: 'На старте важнее всего — понять куда уходят деньги и создать первую подушку.',
  stable:  'У тебя есть база — теперь нужна система и конкретная цель.',
  cushion: 'Подушка есть, значит можно думать о росте капитала.',
  capital: 'С капиталом главный вопрос — как заставить деньги работать.',
};

function onbNext(step) {
  if (step === 1) {
    const nameInput = document.getElementById('onb-name');
    const name = nameInput ? nameInput.value.trim() : DB.user.name;
    if (!name) { if (nameInput) nameInput.focus(); return; }
    DB.user.name = name;
    document.getElementById('onb-step-1').style.display = 'none';
    document.getElementById('onb-step-2').style.display = 'block';

  } else if (step === 2) {
    DB.user.socialLevel = _onbLevel;
    // Highlight recommended goals for this level
    const recs = ONB_RECOMMENDED[_onbLevel] || [];
    // Default select first recommended
    _onbGoal = recs[0] || 'save';
    document.querySelectorAll('#onb-goal-list .onb-goal-opt').forEach(b => b.classList.remove('on'));
    const firstRec = document.getElementById('og-' + _onbGoal);
    if (firstRec) firstRec.classList.add('on');
    // Show/hide recommended badges
    ['save','control','invest','100k','habits'].forEach(g => {
      const badge = document.querySelector('#og-' + g + ' .onb-rec-badge');
      if (badge) badge.style.display = recs.includes(g) ? 'block' : 'none';
    });
    // Set sublabel
    const sub = document.getElementById('onb-goal-sublabel');
    if (sub) sub.textContent = ONB_LEVEL_SUBLABEL[_onbLevel] || '';
    document.getElementById('onb-step-2').style.display = 'none';
    document.getElementById('onb-step-3').style.display = 'block';

  } else if (step === 3) {
    DB.user.goalType = _onbGoal;
    // Set smart default goal amount
    const goalInput = document.getElementById('onb-goal-amount');
    if (goalInput && !goalInput.value) goalInput.value = ONB_GOAL_AMOUNTS[_onbLevel] || 600000;
    // Set hint
    const GOAL_HINTS = {
      save:    'Рекомендуем откладывать 20% дохода ежемесячно для финансовой подушки.',
      invest:  'Для инвестиций хорошо начинать с 10–15% дохода. Подушка безопасности — первый шаг.',
      control: 'Для контроля расходов важно сначала зафиксировать текущие траты.',
      '100k':  'Цель $100k ≈ 9 млн ₽. Мы поможем составить план с учётом твоего дохода.',
      habits:  'Ежедневная привычка фиксировать траты — основа финансовой дисциплины.',
    };
    const hintEl = document.getElementById('onb-goal-hint');
    if (hintEl) { hintEl.textContent = GOAL_HINTS[_onbGoal] || ''; hintEl.style.display = 'block'; }
    document.getElementById('onb-step-3').style.display = 'none';
    document.getElementById('onb-step-4').style.display = 'block';
  }
}

function onbFinish() {
  const income  = parseFloat(document.getElementById('onb-income')?.value) || 0;
  const savings = parseFloat(document.getElementById('onb-savings')?.value) || 0;
  const goalAmt = parseFloat(document.getElementById('onb-goal-amount')?.value) || 0;
  DB.user.onboarded = true;
  // Always save goal: use entered value, or smart default based on level
  const GOAL_DEFAULTS = { starter:600000, stable:1200000, cushion:3000000, capital:7900000 };
  DB.user.goal = goalAmt > 0 ? goalAmt : (GOAL_DEFAULTS[DB.user.socialLevel] || 600000);
  if (savings > 0) {
    DB.assets.push({ id: Date.now(), name: 'Начальные накопления', amount: savings, type: 'savings' });
  }
  if (income > 0) {
    DB.transactions.push({
      id: Date.now()+1, type:'income', amount:income,
      desc:'Ежемесячный доход', category:'salary', date: todayISO()
    });
  }
  // Apply personalization: add starter habits based on goal+level
  applyPersonalization();
  saveDB();
  document.getElementById('onboarding-overlay').style.display = 'none';
  updateAvatar();
  renderAll();
  showToast('🎉 Добро пожаловать, ' + DB.user.name + '!');
}

// Starter habits by goal+level combination
const STARTER_HABITS = {
  starter_control: [
    { name: 'Записывать каждую трату', emoji: '📝', freq: 'daily' },
    { name: 'Не покупать спонтанно > 500 ₽', emoji: '🛑', freq: 'daily' },
  ],
  starter_save: [
    { name: 'Записывать каждую трату', emoji: '📝', freq: 'daily' },
    { name: 'Откладывать хоть что-то в день зарплаты', emoji: '🏦', freq: 'weekly' },
  ],
  starter_habits: [
    { name: 'Утренний финансовый ревью (5 мин)', emoji: '🌅', freq: 'daily' },
    { name: 'Записывать каждую трату', emoji: '📝', freq: 'daily' },
  ],
  stable_save: [
    { name: 'Откладывать 20% от дохода', emoji: '🏦', freq: 'monthly' },
    { name: 'Еженедельный обзор расходов', emoji: '📊', freq: 'weekly' },
  ],
  stable_invest: [
    { name: 'Читать про инвестиции 15 мин', emoji: '📚', freq: 'daily' },
    { name: 'Откладывать 15% дохода для инвестиций', emoji: '📈', freq: 'monthly' },
  ],
  stable_habits: [
    { name: 'Еженедельный обзор расходов', emoji: '📊', freq: 'weekly' },
    { name: 'Не есть вне дома по будням', emoji: '🥗', freq: 'daily' },
  ],
  cushion_invest: [
    { name: 'Читать про инвестиции 15 мин', emoji: '📚', freq: 'daily' },
    { name: 'Пополнять инвестсчёт ежемесячно', emoji: '📈', freq: 'monthly' },
  ],
  cushion_100k: [
    { name: 'Пополнять инвестсчёт ежемесячно', emoji: '📈', freq: 'monthly' },
    { name: 'Читать про инвестиции 15 мин', emoji: '📚', freq: 'daily' },
  ],
  capital_invest: [
    { name: 'Анализировать портфель раз в неделю', emoji: '📊', freq: 'weekly' },
    { name: 'Читать финансовые новости', emoji: '📰', freq: 'daily' },
  ],
  capital_100k: [
    { name: 'Анализировать портфель раз в неделю', emoji: '📊', freq: 'weekly' },
    { name: 'Пополнять инвестсчёт ежемесячно', emoji: '📈', freq: 'monthly' },
  ],
};

function applyPersonalization() {
  const level = DB.user.socialLevel || 'starter';
  const goal  = DB.user.goalType   || 'save';
  const key   = level + '_' + goal;
  const habits = STARTER_HABITS[key] || STARTER_HABITS['starter_save'] || [];
  // Only add if user has no habits yet
  if (DB.habits.length === 0) {
    habits.forEach((h, i) => {
      DB.habits.push({
        id: Date.now() + i,
        name: h.name,
        emoji: h.emoji,
        frequency: h.freq,
        streak: 0,
        done: false,
        history: [],
        createdAt: todayISO(),
      });
    });
  }
}



function updateAvatar() {
  const fullName = DB.user.name || 'Профиль';
  // Format name: show full name with capitalized patronymic initial (e.g., "Иванов И.И.")
  const nameParts = fullName.split(' ').filter(p => p.length > 0);
  let displayName = fullName;
  if (nameParts.length >= 2) {
    const lastName = nameParts[0];
    const firstInitial = nameParts[1]?.[0]?.toUpperCase() || '';
    const patronymicInitial = nameParts[2]?.[0]?.toUpperCase() || '';
    displayName = lastName + ' ' + firstInitial + '.' + (patronymicInitial ? patronymicInitial + '.' : '');
  }
  const initials = nameParts.map(w=>w[0]).join('').toUpperCase().slice(0,2) || 'НБ';
  const gradient = DB.user.avatarColor || '#8b5cf6,#4f46e5';

  // Header pill
  const ico  = document.getElementById('hdr-avatar-ico');
  const nm   = document.getElementById('hdr-avatar-name');
  const lvlEl= document.getElementById('hdr-avatar-lvl');
  if (ico) { ico.textContent = initials; ico.style.background = `linear-gradient(135deg,${gradient})`; }
  if (nm)  nm.textContent = displayName.length > 18 ? displayName.slice(0,18) + '…' : displayName;
  if (lvlEl) {
    try {
      const xp  = (getAcademyState ? getAcademyState() : { xp:0 }).xp || 0;
      const lvl = xp < 150 ? 'Новичок' : xp < 400 ? 'Осознанный' : xp < 800 ? 'Мастер' : 'Эксперт';
      const stars = xp < 150 ? '★' : xp < 400 ? '★★' : xp < 800 ? '★★★' : '★★★★';
      lvlEl.textContent = stars + ' ' + lvl;
    } catch(e) {}
  }

  // Legacy compat (desktop sidebar avatar)
  const sideAv = document.getElementById('bnav-avatar');
  const sideNm = document.getElementById('bnav-username');
  if (sideAv) { sideAv.textContent = initials; sideAv.style.background = `linear-gradient(135deg,${gradient})`; }
  if (sideNm) sideNm.textContent = name;

  // Notif dot
  const nd = document.getElementById('notif-dot-hdr');
  if (nd) nd.style.display = 'none'; // will be set by checkAlerts

  // Sync predictive risks dialog avatar
  try { const ra=document.getElementById('riskdlg-ava'); const ha=document.getElementById('hdr-avatar-ico'); if (ra && ha) ra.textContent = ha.textContent || ra.textContent; } catch(e) {}
}

/* ═══════════════════════════════════════
   AUTH SYSTEM
═══════════════════════════════════════ */
const AUTH_KEY  = 'nobile_auth';   // {email, nameHash, passHash, salt, pin, has2fa, totpSecret, provider}
const ACCT_KEY  = 'nobile_accounts'; // list of accounts for switching

// ── Helpers ──
// ── Change PIN (from settings) ──
async function changePin() {
  closeSheet('settings');
  // Create a PIN overlay since auth-screen may already be gone
  const existing = document.getElementById('pin-change-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'pin-change-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:#0d0f14;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;box-sizing:border-box';
  modal.innerHTML = `
    <div style="text-align:center;margin-bottom:32px">
      <div style="font-size:2rem;margin-bottom:8px">🔑</div>
      <div style="font-family:var(--font-head);font-size:1.4rem;font-weight:900" id="cpm-title">Новый PIN-код</div>
      <div style="font-size:.78rem;color:var(--muted);margin-top:4px" id="cpm-sub">Введите 4 цифры</div>
    </div>
    <div style="display:flex;gap:16px;margin-bottom:24px" id="cpm-dots">
      <div class="pin-dot" id="cpm-d0"></div><div class="pin-dot" id="cpm-d1"></div>
      <div class="pin-dot" id="cpm-d2"></div><div class="pin-dot" id="cpm-d3"></div>
    </div>
    <div id="cpm-hint" style="font-size:.72rem;color:var(--muted);min-height:18px;margin-bottom:16px;text-align:center"></div>
    <div style="display:grid;grid-template-columns:repeat(3,72px);gap:12px">
      ${['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d,i) => d==='' ? '<div></div>' :
        `<button class="np-btn${d==='⌫'?' np-del':''}" onclick="cpmInput('${d}')">${d}</button>`).join('')}
    </div>
    <button onclick="document.getElementById('pin-change-modal').remove()" style="margin-top:24px;font-size:.72rem;color:var(--muted);background:none;border:none;cursor:pointer">Отмена</button>`;
  document.body.appendChild(modal);

  let buf='', first='', mode='new';
  function updateDots(state='normal') {
    for(let i=0;i<4;i++){const d=document.getElementById('cpm-d'+i);if(!d)return;d.className='pin-dot';if(state==='error')d.classList.add('error');else if(state==='ok')d.classList.add('ok');else if(i<buf.length)d.classList.add('filled');}
  }
  window.cpmInput = async (d) => {
    if(d==='⌫'){buf=buf.slice(0,-1);updateDots();return;}
    if(buf.length>=4)return;
    buf+=d; updateDots();
    if(buf.length<4)return;
    if(mode==='new'){first=buf;buf='';mode='confirm';document.getElementById('cpm-title').textContent='Повторите PIN';document.getElementById('cpm-sub').textContent='Введите тот же код';updateDots();return;}
    if(mode==='confirm'){
      if(buf!==first){document.getElementById('cpm-hint').textContent='Коды не совпадают';document.getElementById('cpm-hint').style.color='var(--coral)';updateDots('error');setTimeout(()=>{buf='';first='';mode='new';document.getElementById('cpm-title').textContent='Новый PIN';document.getElementById('cpm-hint').textContent='';updateDots();},1200);return;}
      updateDots('ok');
      const salt=getOrCreateSalt();const hash=await hashPin(buf,salt);
      localStorage.setItem(HASH_KEY,hash);
      const auth=getAuth()||{};auth.pinHash=hash;saveAuth(auth);
      _cryptoKey=await deriveKey(buf,salt);
      await saveDB();
      document.getElementById('cpm-hint').textContent='PIN изменён ✓';document.getElementById('cpm-hint').style.color='var(--mint)';
      setTimeout(()=>{modal.remove();showToast('🔑 PIN-код изменён');},800);
    }
  };
}

function authShowView(name) {
  document.querySelectorAll('.auth-view').forEach(v => {
    v.classList.remove('auth-active');
    v.style.display = 'none';
  });
  const el = document.getElementById('auth-view-' + name);
  if (el) {
    el.style.display = 'block';
    el.classList.add('auth-active');
    el.scrollTop = 0;
    window.refreshAuthLogos?.(el);
    if (name === 'unlock') {
      _unlockPinBuf = '';
      updateUnlockDots();
      const hint = document.getElementById('unlock-hint');
      if (hint) hint.textContent = '';
    }
  }
}


function showAuthLoading(msg) {
  // Remove existing loading overlay
  document.querySelectorAll('.auth-loading-overlay').forEach(el => el.remove());
  const view = document.querySelector('.auth-view.auth-active');
  if (!view) return;
  const overlay = document.createElement('div');
  overlay.className = 'auth-loading-overlay';
  overlay.innerHTML = `<div class="auth-spinner"></div><div class="auth-loading-txt">${msg || 'Загрузка...'}</div>`;
  view.style.position = 'relative';
  view.appendChild(overlay);
}

function hideAuthLoading() {
  document.querySelectorAll('.auth-loading-overlay').forEach(el => el.remove());
}

async function enterAsGuest() {
  try {
    _cryptoKey = null;
    try { await loadDB(); } catch(e) { console.warn('loadDB failed in guest mode', e); }
    if (!DB.user.name || DB.user.name === 'Пользователь') DB.user.name = 'Гость';
    await afterAuthSuccess();
  } catch(e) {
    console.error('enterAsGuest error:', e);
    // Force show main app even if something fails
    const screen = document.getElementById('auth-screen');
    if (screen) screen.remove();
    checkOnboarding();
  }
}

function authShowError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function authHideError(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function togglePassVis(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

function checkPassStrength(val) {
  const bar = document.getElementById('reg-pass-bar');
  const lbl = document.getElementById('reg-pass-label');
  if (!bar || !lbl) return;
  let score = 0;
  if (val.length >= 8) score++;
  if (val.length >= 12) score++;
  if (/[A-Z]/.test(val) || /[а-яА-Я]/.test(val)) score++;
  if (/[0-9]/.test(val)) score++;
  if (/[^A-Za-z0-9а-яА-Я]/.test(val)) score++;
  const pct = [0, 25, 50, 70, 90, 100][score];
  const clr = score <= 1 ? 'var(--coral)' : score <= 2 ? 'var(--gold)' : 'var(--mint)';
  const lbts = ['', 'Слабый', 'Средний', 'Хороший', 'Сильный', 'Отличный'][score];
  bar.style.width = pct + '%';
  bar.style.background = clr;
  lbl.textContent = val.length ? lbts : '';
  lbl.style.color = clr;
}

async function hashStr(str) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(str));
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function getAuth() {
  try { return JSON.parse(localStorage.getItem(AUTH_KEY)) || null; } catch { return null; }
}
function saveAuth(data) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(data));
}

// ── Guest mode — enter without account ──
// ── Register ──
async function authRegister() {
  authHideError('reg-error');
  const name  = document.getElementById('reg-name')?.value?.trim();
  const email = document.getElementById('reg-email')?.value?.trim();
  const pass  = document.getElementById('reg-pass')?.value;
  const pass2 = document.getElementById('reg-pass2')?.value;

  if (!name)               return authShowError('reg-error', 'Введите имя');
  if (!email || !email.includes('@')) return authShowError('reg-error', 'Введите корректный email');
  if (!pass || pass.length < 8)       return authShowError('reg-error', 'Пароль минимум 8 символов');
  if (pass !== pass2)      return authShowError('reg-error', 'Пароли не совпадают');

  const salt     = crypto.getRandomValues(new Uint8Array(16));
  const saltB64  = btoa(String.fromCharCode(...salt));
  const passHash = await hashStr(pass + saltB64);
  const emailH   = await hashStr(email.toLowerCase());

  const auth = { name, email, emailH, passHash, saltB64, pinHash: null, provider: 'local', createdAt: new Date().toISOString() };
  saveAuth(auth);

  // Set user name in DB
  DB.user.name = name;
  DB.user.email = email;

  // Offer PIN setup
  authShowView('pin');
  resetPinSetupState('first');
}

// ── Login ──
async function authLogin() {
  authHideError('login-error');
  const email = document.getElementById('login-email')?.value?.trim();
  const pass  = document.getElementById('login-pass')?.value;

  if (!email) return authShowError('login-error', 'Введите email');
  if (!pass)  return authShowError('login-error', 'Введите пароль');

  const auth = getAuth();
  if (!auth || auth.provider !== 'local') return authShowError('login-error', 'Аккаунт не найден');

  const passHash = await hashStr(pass + auth.saltB64);
  if (passHash !== auth.passHash) {
    return authShowError('login-error', 'Неверный email или пароль');
  }

  // Restore user name
  if (auth.name) DB.user.name = auth.name;

  if (auth.pinHash) {
    // Has PIN — show unlock screen
    document.getElementById('unlock-username').textContent = auth.name || 'Пользователь';
    const emailEl = document.getElementById('unlock-useremail');
    if (emailEl) emailEl.textContent = auth.email || '';
    _unlockPinBuf = '';
    updateUnlockDots();
    authShowView('unlock');
    tryBiometric();
  } else {
    // No PIN — go to app
    await afterAuthSuccess();
  }
}

// ── Social Auth ──
const SOCIAL_OAUTH_CONFIG = window.NOBILE_OAUTH || {};
const SOCIAL_PROVIDERS = {
  yandex: {
    name: 'Яндекс ID',
    buttonLabel: 'Яндекс',
    color: '#FC3F1D',
    desc: 'Вход через Яндекс ID с реальной OAuth-конфигурацией приложения.',
    note: 'Нужны ваш client_id и redirect_uri. Данные Nobile не передаются Яндексу, кроме профиля, который вы сами разрешите.',
    iconSvg: '<span class="auth-social-icon-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M13.5 4.8h-1.1c-2.5 0-4 1.3-4 3.6 0 1.9.8 3.1 2.5 4.3l1 .7-3.1 5H6.3l3.1-4.9c-1.8-1.2-2.9-2.6-2.9-5.1 0-3.4 2.4-5.4 6-5.4H16v15.3h-2.5V4.8z" fill="white"></path></svg></span>',
    getAuthUrl() {
      const cfg = SOCIAL_OAUTH_CONFIG.yandex || {};
      if (!cfg.clientId || !cfg.redirectUri) return null;
      return 'https://oauth.yandex.ru/authorize?response_type=code&client_id=' + encodeURIComponent(cfg.clientId) + '&redirect_uri=' + encodeURIComponent(cfg.redirectUri);
    }
  },
  vk: {
    name: 'VK ID',
    buttonLabel: 'VK',
    color: '#0077FF',
    desc: 'Вход через VK ID с реальной OAuth-конфигурацией приложения.',
    note: 'Для VK ID нужен app_id / client_id и redirect_uri, зарегистрированные в кабинете разработчика VK.',
    iconSvg: '<span class="auth-social-icon-badge" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none"><path d="M25.5 33.5h2.4s.7-.1 1.1-.5c.4-.4.4-1.1.4-1.1s-.1-3.4 1.5-3.9c1.6-.5 3.6 3.3 5.8 4.7.6.4 1.8.9 1.8.9l3.7-.1s1.9-.1 1-.7c-.1-.1-.6-.6-2.4-2.3-2.5-2.4-2.2-2-.7-4.1 1-1.4 3.2-5 2-5.8-.3-.2-.9-.3-.9-.3l-4.1.1s-.3 0-.5.2c-.2.2-.3.5-.3.5s-.8 2.2-1.9 4.1c-2.3 3.8-3.2 4-3.5 3.8-.9-.5-.7-2.1-.7-3.2 0-3.5.5-4.9-.9-5.3-.4-.1-.8-.2-2-.2-1.5 0-2.8.1-3.5.4-1.3.6-.5.8-.5.8s1 .4 1.4 1.7c.5 1.7.5 5.5-.3 6.3-.8.8-2.7-2.7-3.9-5.4-.7-1.4-1-2.3-1-2.3s-.1-.3-.3-.5c-.2-.2-.7-.3-.7-.3l-3.9.1s-.6 0-.8.3c-.2.2 0 .7 0 .7s3 7.2 6.4 10.8c3.1 3.4 6.7 3.1 6.7 3.1h-.1z" fill="white"></path></svg></span>',
    getAuthUrl() {
      const cfg = SOCIAL_OAUTH_CONFIG.vk || {};
      if (!(cfg.clientId || cfg.appId) || !cfg.redirectUri) return null;
      const id = cfg.clientId || cfg.appId;
      return 'https://id.vk.com/authorize?response_type=code&client_id=' + encodeURIComponent(id) + '&redirect_uri=' + encodeURIComponent(cfg.redirectUri) + '&scope=email';
    }
  },
  gosuslugi: {
    name: 'Госуслуги',
    buttonLabel: 'Госуслуги',
    color: '#0050A0',
    desc: 'Вход через ЕСИА (Госуслуги) с реальной интеграцией вашей организации.',
    note: 'Для ЕСИА нужна зарегистрированная организация и рабочие параметры интеграции. Без них кнопка не может завершить вход честно и безопасно.',
    iconSvg: '<span class="auth-social-icon-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M7 6.5h10M7 12h10M7 17.5h10" stroke="white" stroke-width="2.2" stroke-linecap="round"/><circle cx="5" cy="6.5" r="1.2" fill="white"/><circle cx="5" cy="12" r="1.2" fill="white"/><circle cx="5" cy="17.5" r="1.2" fill="white"/></svg></span>',
    getAuthUrl() {
      const cfg = SOCIAL_OAUTH_CONFIG.gosuslugi || {};
      if (!cfg.clientId || !cfg.redirectUri) return null;
      return 'https://esia.gosuslugi.ru/aas/oauth2/ac?response_type=code&client_id=' + encodeURIComponent(cfg.clientId) + '&redirect_uri=' + encodeURIComponent(cfg.redirectUri) + '&scope=openid+fullname+email';
    }
  },
  max: {
    name: 'MAX',
    buttonLabel: 'MAX',
    color: '#6C63FF',
    desc: 'Вход через MAX с использованием реальной OAuth-конфигурации проекта.',
    note: 'Для MAX нужны выданные приложению client_id и redirect_uri. Фейковая авторизация в коде отключена.',
    iconSvg: '<span class="auth-social-icon-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><path d="M5 18V6h2.4l4.6 6.1L16.6 6H19v12h-2.4v-8.2l-4.4 5.8h-.4L7.4 9.8V18H5z" fill="white"></path></svg></span>',
    getAuthUrl() {
      const cfg = SOCIAL_OAUTH_CONFIG.max || {};
      if (!cfg.clientId || !cfg.redirectUri) return null;
      return 'https://connect.mail.ru/oauth/authorize?response_type=code&client_id=' + encodeURIComponent(cfg.clientId) + '&redirect_uri=' + encodeURIComponent(cfg.redirectUri);
    }
  },
};

let _currentSocialProvider = null;

function hydrateAuthSocialButtons() {
  document.querySelectorAll('.auth-social-btn').forEach(btn => {
    const provider = btn.getAttribute('data-provider') || (btn.getAttribute('onclick') || '').match(/authSocial\('([^']+)'\)/)?.[1];
    const p = provider ? SOCIAL_PROVIDERS[provider] : null;
    if (!p) return;
    btn.setAttribute('data-provider', provider);
    btn.innerHTML = p.iconSvg + '<span class="auth-social-label">' + p.buttonLabel + '</span>';
    btn.setAttribute('aria-label', 'Войти через ' + p.name);
  });
}

function authSocial(provider) {
  const p = SOCIAL_PROVIDERS[provider];
  if (!p) return;
  _currentSocialProvider = provider;

  const iconEl = document.getElementById('social-icon');
  if (iconEl) iconEl.innerHTML = p.iconSvg;
  document.getElementById('social-title').textContent = p.name;
  document.getElementById('social-sub').textContent   = 'Быстрый и безопасный вход';
  document.getElementById('social-info-block').innerHTML = `
    <div class="social-info-row">
      <span style="font-size:1.1rem">ℹ️</span>
      <div style="font-size:.76rem;color:var(--muted);line-height:1.5">${p.desc}</div>
    </div>
    <div class="social-info-row" style="margin-top:8px">
      <span style="font-size:1.1rem">🔒</span>
      <div style="font-size:.76rem;color:var(--muted);line-height:1.5">${p.note}</div>
    </div>`;
  document.getElementById('social-main-btn').textContent = 'Продолжить через ' + p.name;
  document.getElementById('social-main-btn').style.background = p.color;
  authShowView('social');
}

function doSocialConnect() {
  const p = SOCIAL_PROVIDERS[_currentSocialProvider];
  if (!p) return;
  const authUrl = typeof p.getAuthUrl === 'function' ? p.getAuthUrl() : null;
  if (!authUrl) {
    showToast('Для ' + p.name + ' не настроены client_id и redirect_uri. Добавьте window.NOBILE_OAUTH в index.html.');
    return;
  }
  window.location.href = authUrl;
}

// ── Forgot password ──
function authForgotSubmit() {
  const email = document.getElementById('forgot-email')?.value?.trim();
  if (!email || !email.includes('@')) { showToast('Введите email'); return; }
  const sub  = 'Nobile - Восстановление доступа';
  const bodyText = 'Здравствуйте!%0A%0AЯ потерял доступ к аккаунту Nobile.%0AEmail: ' + encodeURIComponent(email) + '%0A%0AПожалуйста, помогите.%0A%0AС уважением';
  window.location.href = 'mailto:support@nobile.app?subject=' + encodeURIComponent(sub) + '&body=' + bodyText;
  const msg = document.getElementById('forgot-msg');
  if (msg) { msg.textContent = 'Запрос открыт в почтовом клиенте. Пароль хранится только у вас — восстановить без резервной копии невозможно.'; msg.style.display = 'block'; }
}

// ── PIN Setup (new account) ──
let _setupPinBuf = '', _setupPinFirst = '', _setupPinMode = 'first';

function resetPinSetupState(mode = 'first') {
  _setupPinBuf = ''; _setupPinFirst = ''; _setupPinMode = mode;
  document.getElementById('pin-view-title').textContent = 'Установите PIN-код';
  document.getElementById('pin-view-sub').textContent   = '4 цифры для быстрого входа в приложение';
  document.getElementById('pin-setup-hint').textContent = '';
  document.getElementById('pin-setup-hint').style.color = 'var(--muted)';
  updateSetupDots();
}

function updateSetupDots(state = 'normal') {
  for (let i = 0; i < 4; i++) {
    const d = document.getElementById('spd-' + i);
    if (!d) continue;
    d.className = 'pin-dot';
    if (state === 'error') d.classList.add('error');
    else if (state === 'ok') d.classList.add('ok');
    else if (i < _setupPinBuf.length) d.classList.add('filled');
  }
}

function setupPinInput(digit) {
  if (_setupPinBuf.length >= 4) return;
  _setupPinBuf += digit;
  updateSetupDots();
  if (_setupPinBuf.length === 4) setTimeout(handleSetupPinComplete, 80);
}

function setupPinDel() {
  _setupPinBuf = _setupPinBuf.slice(0, -1);
  updateSetupDots();
}

async function handleSetupPinComplete() {
  if (_setupPinMode === 'first') {
    _setupPinFirst = _setupPinBuf; _setupPinBuf = ''; _setupPinMode = 'confirm';
    document.getElementById('pin-view-title').textContent = 'Повторите PIN-код';
    document.getElementById('pin-view-sub').textContent   = 'Введите тот же код для подтверждения';
    updateSetupDots(); return;
  }
  if (_setupPinMode === 'confirm') {
    if (_setupPinBuf !== _setupPinFirst) {
      document.getElementById('pin-setup-hint').textContent = 'Коды не совпадают — попробуйте снова';
      document.getElementById('pin-setup-hint').style.color = 'var(--coral)';
      updateSetupDots('error');
      setTimeout(() => resetPinSetupState('first'), 1200);
      return;
    }
    // Save PIN
    updateSetupDots('ok');
    const hintEl = document.getElementById('pin-setup-hint');
    if (hintEl) { hintEl.textContent = '🔐 Создаём ключ...'; hintEl.style.color = 'var(--muted)'; }
    showAuthLoading('Создаём ключ шифрования...');
    const salt = getOrCreateSalt();
    const hash = await hashPin(_setupPinBuf, salt);
    const auth = getAuth() || {};
    auth.pinHash = hash;
    saveAuth(auth);
    localStorage.setItem(HASH_KEY, hash);
    _cryptoKey = await deriveKey(_setupPinBuf, salt);
    hideAuthLoading();
    if (hintEl) { hintEl.textContent = '✅ PIN установлен'; hintEl.style.color = 'var(--mint)'; }
    setTimeout(async () => { await afterAuthSuccess(); }, 600);
  }
}

async function skipPinSetup() {
  showAuthLoading('Входим в приложение...');
  _cryptoKey = null;
  try { await afterAuthSuccess(); } catch(e) { hideAuthLoading(); }
}

// ── Unlock with PIN (returning user) ──
let _unlockPinBuf = '', _unlockAttempts = 0;

function syncUnlockStatusIndicator(state = 'idle') {
  const indicator = document.getElementById('unlock-status-indicator');
  if (!indicator) return;

  indicator.className = 'pin-status-indicator';
  if (state === 'typing') indicator.classList.add('is-typing');
  if (state === 'ok') indicator.classList.add('is-ok');
  if (state === 'error') indicator.classList.add('is-error');

  const activeCount = (state === 'ok' || state === 'error') ? 4 : _unlockPinBuf.length;
  indicator.querySelectorAll('.pin-status-dot').forEach((dot, index) => {
    dot.className = 'pin-status-dot';
    if (index < activeCount) dot.classList.add('is-active');
  });
}

function triggerUnlockShake() {
  ['unlock-status-indicator', 'unlock-pin-dots'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('shake');
    void el.offsetWidth;
    el.classList.add('shake');
  });
}

function updateUnlockDots(state = 'normal') {
  const wrap = document.getElementById('unlock-pin-dots');
  if (wrap) wrap.className = 'unlock-pin-dots';

  for (let i = 0; i < 4; i++) {
    const d = document.getElementById('upd-' + i);
    if (!d) continue;
    d.className = 'pin-dot';
    if (state === 'error') d.classList.add('error');
    else if (state === 'ok') d.classList.add('ok');
    else if (i < _unlockPinBuf.length) d.classList.add('filled');
  }

  if (state === 'error') {
    if (wrap) wrap.classList.add('is-error');
    syncUnlockStatusIndicator('error');
    triggerUnlockShake();
    return;
  }

  if (state === 'ok') {
    if (wrap) wrap.classList.add('is-ok');
    syncUnlockStatusIndicator('ok');
    return;
  }

  syncUnlockStatusIndicator(_unlockPinBuf.length ? 'typing' : 'idle');
}

function unlockPinInput(digit) {
  if (_unlockPinBuf.length >= 4) return;
  _unlockPinBuf += digit;
  updateUnlockDots();
  if (_unlockPinBuf.length === 4) setTimeout(handleUnlockPin, 80);
}

function unlockPinDel() {
  _unlockPinBuf = _unlockPinBuf.slice(0, -1);
  updateUnlockDots();
}

async function handleUnlockPin() {
  const salt = getOrCreateSalt();
  const hash = await hashPin(_unlockPinBuf, salt);
  const storedHash = localStorage.getItem(HASH_KEY);

  if (hash !== storedHash) {
    _unlockAttempts++;
    _unlockPinBuf = '';
    const el = document.getElementById('unlock-hint');
    if (el) el.textContent = '';
    updateUnlockDots('error');
    setTimeout(() => { updateUnlockDots(); }, 900);
    return;
  }

  updateUnlockDots('ok');
  const hintEl2 = document.getElementById('unlock-hint');
  if (hintEl2) hintEl2.textContent = '';
  showAuthLoading('Расшифровка данных...');
  try {
    _cryptoKey = await deriveKey(_unlockPinBuf, salt);
    const ok = await loadDB();
    if (!ok) {
      hideAuthLoading();
      _cryptoKey = null;
      _unlockPinBuf = '';
      updateUnlockDots('error');
      setTimeout(() => { updateUnlockDots(); }, 900);
      return;
    }
    const auth = getAuth();
    if (auth?.name) { DB.user.name = auth.name; }
    hideAuthLoading();
    setTimeout(() => afterAuthSuccess(), 420);
  } catch(e) {
    hideAuthLoading();
    _cryptoKey = null;
    _unlockPinBuf = '';
    updateUnlockDots('error');
    setTimeout(() => { updateUnlockDots(); }, 900);
  }
}

// ── Biometric ──
async function tryBiometric() {
  const row = document.getElementById('biometric-row');
  if (row) row.style.display = 'none';
  return false;
}

async function unlockBiometric() {
  showToast('Биометрический вход временно скрыт до полноценной безопасной интеграции. Используйте PIN.');
}

function authSwitchAccount() {
  if (confirm('Выйти из аккаунта? Данные на устройстве останутся.')) {
    _cryptoKey = null;
    authShowView('welcome');
  }
}

function authForgotPin() {
  if (confirm('Сбросить PIN и войти заново? Данные приложения будут удалены.')) {
    localStorage.clear();
    location.reload();
  }
}

// ── After successful auth — enter app ──
async function afterAuthSuccess() {
  // Load data if not loaded yet
  if (!DB.transactions?.length && !DB.habits?.length) {
    await loadDB();
  }
  // Restore user info from auth
  const auth = getAuth();
  if (auth?.name && (!DB.user.name || DB.user.name === 'Пользователь')) DB.user.name = auth.name;
  if (auth?.email) DB.user.email = auth.email;

  try { renderAll(); } catch(e) { console.error('renderAll error in afterAuthSuccess:', e); }

  // Slide out auth screen
  const screen = document.getElementById('auth-screen');
  if (screen) {
    screen.style.transition = 'opacity .4s, transform .4s';
    screen.style.opacity = '0';
    screen.style.transform = 'scale(.97)';
    setTimeout(() => screen.remove(), 420);
  }

  // Start async features
  loadCurrency();
  setTimeout(loadAIAdvice, 800);
  checkOnboarding();
  setTimeout(() => {
    const ns = getNotifSettings?.() || {};
    if (ns.pushEnabled && Notification.permission === 'granted') scheduleNotifications?.();
  }, 1000);
}

// ── Boot ──

// PWA setup: generate manifest that uses the real app logo
function setupPWA() {
  try {
    const icon192 = './icons/nobile-logo-192.png';
    const icon512 = './icons/nobile-logo-512.png';
    const apple180 = './icons/nobile-logo-180.png';
    const manifest = {
      name: 'Nobile', short_name: 'Nobile', start_url: './',
      display: 'standalone', background_color: '#000000', theme_color: '#000000',
      icons: [
        { src: icon192, sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
        { src: icon512, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
      ]
    };
    const blob = new Blob([JSON.stringify(manifest)], {type:'application/json'});
    const url  = URL.createObjectURL(blob);
    const el   = document.getElementById('pwa-manifest');
    if (el) el.href = url;
    const apple = document.getElementById('apple-touch-icon');
    if (apple) apple.href = apple180;
  } catch(e) { /* PWA not supported */ }
}

async function bootApp() {
  setupPWA();

  const auth        = getAuth();
  const hasPIN      = !!localStorage.getItem(HASH_KEY);
  const hasEnc      = !!localStorage.getItem(DB_KEY);
  const hasPlain    = !!localStorage.getItem('nobile_db');

  // Migration: old plaintext data, no auth yet
  if (!auth && hasPlain) {
    try { const raw = localStorage.getItem('nobile_db'); if (raw) DB = { ...DB, ...JSON.parse(raw) }; } catch {}
    authShowView('welcome');
    return;
  }

  // Returning user with PIN
  if (auth && hasPIN) {
    const name = auth.name || 'Пользователь';
    const unlockNameEl = document.getElementById('unlock-username');
    const unlockEmailEl = document.getElementById('unlock-useremail');
    if (unlockNameEl) unlockNameEl.textContent = name;
    if (unlockEmailEl) unlockEmailEl.textContent = auth.email || '';
    _unlockPinBuf = ''; updateUnlockDots();
    authShowView('unlock');
    tryBiometric();
    return;
  }

  // Returning user without PIN
  if (auth && !hasPIN) {
    await loadDB();
    if (auth.name) DB.user.name = auth.name;
    await afterAuthSuccess();
    return;
  }

  // New user
  authShowView('welcome');
}

hydrateAuthSocialButtons();
try { bootApp(); } catch(e) { console.error('Boot error:', e); }

// Global: close habit swipe panels on outside tap
document.addEventListener('click', e => {
  if (!e.target.closest('.hab-swipe-wrap')) {
    document.querySelectorAll('.hab-swipe-wrap.swiped').forEach(w => w.classList.remove('swiped'));
  }
});

// Header buttons
// settings button removed from header; opened via profile dropdown

// profile menu wired below
document.getElementById('btn-profile').addEventListener('click', function(e) {
  e.stopPropagation();
  const menu = document.getElementById('prof-menu');
  if (menu) menu.classList.toggle('open');
});
document.addEventListener('click', function() {
  const menu = document.getElementById('prof-menu');
  if (menu) menu.classList.remove('open');
});
function closeProfMenu() {
  const menu = document.getElementById('prof-menu');
  if (menu) menu.classList.remove('open');
}

// Set today's date in tx form (safe)
const _txDateEl = document.getElementById('tx-date');
if (_txDateEl) _txDateEl.value = todayISO();

/* ═══════════════════════════════════════
   NOTIFICATION SYSTEM
═══════════════════════════════════════ */

// ── State ──
const NOTIF_KEY = 'nobile_notif_settings';

function getNotifSettings() {
  try {
    return JSON.parse(localStorage.getItem(NOTIF_KEY)) || {
      pushEnabled: false,
      email: '',
      reminderTime: '20:00',
      types: { payments: true, budget: true, habits: false, weekly: true, ai: true }
    };
  } catch { return { pushEnabled: false, email: '', reminderTime: '20:00', types: { payments: true, budget: true, habits: false, weekly: true, ai: true } }; }
}

function saveNotifSettings() {
  const ns = getNotifSettings();
  ns.email        = document.getElementById('set-email')?.value?.trim() || ns.email;
  ns.reminderTime = document.getElementById('set-notif-time')?.value || ns.reminderTime;
  ns.types = {
    payments: document.getElementById('nt-payments')?.checked ?? ns.types.payments,
    budget:   document.getElementById('nt-budget')?.checked   ?? ns.types.budget,
    habits:   document.getElementById('nt-habits')?.checked   ?? ns.types.habits,
    weekly:   document.getElementById('nt-weekly')?.checked   ?? ns.types.weekly,
    ai:       document.getElementById('nt-ai')?.checked       ?? ns.types.ai,
  };
  localStorage.setItem(NOTIF_KEY, JSON.stringify(ns));
  scheduleNotifications();
}

// ── Populate settings fields ──
function loadNotifSettingsUI() {
  const ns = getNotifSettings();
  const emailEl = document.getElementById('set-email');
  const timeEl  = document.getElementById('set-notif-time');
  const pushEl  = document.getElementById('tog-push');
  if (emailEl) emailEl.value = ns.email || '';
  if (timeEl)  timeEl.value  = ns.reminderTime || '20:00';
  if (pushEl)  pushEl.checked = ns.pushEnabled && Notification.permission === 'granted';
  Object.entries(ns.types || {}).forEach(([key, val]) => {
    const el = document.getElementById('nt-' + key);
    if (el) el.checked = val;
  });
  updatePushStatusLabel();
}

function updatePushStatusLabel() {
  const el = document.getElementById('push-status-label');
  if (!el) return;
  if (!('Notification' in window)) { el.textContent = 'Не поддерживается браузером'; return; }
  const perm = Notification.permission;
  if (perm === 'granted') el.textContent = '✓ Включены и работают';
  else if (perm === 'denied') el.textContent = '✗ Заблокированы в браузере — разрешите в настройках сайта';
  else el.textContent = 'Нажмите чтобы включить';
}

// ── Push Notifications ──
async function togglePushNotif(enabled) {
  if (!('Notification' in window)) {
    showToast('❌ Браузер не поддерживает уведомления');
    document.getElementById('tog-push').checked = false;
    return;
  }
  if (enabled) {
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      const ns = getNotifSettings();
      ns.pushEnabled = true;
      localStorage.setItem(NOTIF_KEY, JSON.stringify(ns));
      showToast('🔔 Пуш-уведомления включены!');
      updatePushStatusLabel();
      scheduleNotifications();
      // Immediate welcome push
      sendPush('🎉 Nobile уведомления включены!', 'Теперь вы будете получать напоминания о платежах и привычках.');
    } else {
      showToast('❌ Разрешение отклонено. Разрешите в настройках сайта.');
      document.getElementById('tog-push').checked = false;
      updatePushStatusLabel();
    }
  } else {
    const ns = getNotifSettings();
    ns.pushEnabled = false;
    localStorage.setItem(NOTIF_KEY, JSON.stringify(ns));
    clearScheduledNotifications();
    showToast('🔕 Пуш-уведомления отключены');
    updatePushStatusLabel();
  }
}

function sendPush(title, body, tag = 'nobile') {
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="%231a1a2e"/><text y="24" x="4" font-size="22">◈</text></svg>',
      badge: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill="%234DA6FF"/></svg>',
      tag,
      requireInteraction: false,
      silent: false
    });
    n.onclick = () => { window.focus(); n.close(); };
    setTimeout(() => n.close(), 8000);
  } catch(e) {}
}

// ── Scheduled notifications with setInterval ──
let _notifTimers = [];

function clearScheduledNotifications() {
  _notifTimers.forEach(t => clearTimeout(t));
  _notifTimers = [];
}

function scheduleNotifications() {
  clearScheduledNotifications();
  const ns = getNotifSettings();
  if (!ns.pushEnabled || Notification.permission !== 'granted') return;

  const now = new Date();

  // ── Daily reminder at set time ──
  if (ns.types.habits) {
    const [hh, mm] = (ns.reminderTime || '20:00').split(':').map(Number);
    const target = new Date(now);
    target.setHours(hh, mm, 0, 0);
    if (target <= now) target.setDate(target.getDate() + 1);
    const msUntil = target - now;
    const t = setTimeout(() => {
      const ns2 = getNotifSettings();
      if (!ns2.types.habits) return;
      const todayKey = todayISO();
      const undone = DB.habits.filter(h => !h.completions?.[todayKey]);
      if (undone.length > 0) {
        sendPush(
          `⚡ Привычки: ${undone.length} не выполнено`,
          undone.slice(0,3).map(h=>h.name).join(', ') + (undone.length>3?` +${undone.length-3} ещё`:''),
          'habits'
        );
      }
      // Re-schedule for next day
      scheduleNotifications();
    }, msUntil);
    _notifTimers.push(t);
  }

  // ── Payment reminders — check every hour ──
  if (ns.types.payments) {
    const checkPayments = () => {
      const today = new Date();
      const ns2 = getNotifSettings();
      if (!ns2.pushEnabled || !ns2.types.payments) return;
      const urgent = DB.recurringPayments.filter(r => {
        if (isPaymentPaid(r.id)) return false;
        const diff = Math.ceil((new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth) - today) / 86400000);
        return diff >= 0 && diff <= 3;
      });
      urgent.forEach(r => {
        const diff = Math.ceil((new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth) - today) / 86400000);
        const when = diff === 0 ? 'сегодня' : `через ${diff} дн.`;
        sendPush(
          `⏰ Платёж: ${r.name}`,
          `${r.amount.toLocaleString('ru')} ₽ — ${when} (${r.dayOfMonth} числа)`,
          `payment-${r.id}`
        );
      });
    };
    // Check now + every 4 hours
    setTimeout(checkPayments, 2000);
    const interval = setInterval(checkPayments, 4 * 3600 * 1000);
    _notifTimers.push(interval);
  }

  // ── Weekly summary — Sunday evening ──
  if (ns.types.weekly) {
    const nextSunday = new Date(now);
    const daysUntilSun = (7 - now.getDay()) % 7 || 7;
    nextSunday.setDate(nextSunday.getDate() + daysUntilSun);
    nextSunday.setHours(19, 0, 0, 0);
    const t = setTimeout(() => {
      const ns2 = getNotifSettings();
      if (!ns2.pushEnabled || !ns2.types.weekly) return;
      const stats = calcStats();
      sendPush(
        '📊 Недельная сводка Nobile',
        `Доходы: +${stats.income.toLocaleString('ru')} ₽ · Расходы: −${stats.expense.toLocaleString('ru')} ₽ · Баланс: ${stats.balance.toLocaleString('ru')} ₽`,
        'weekly'
      );
    }, nextSunday - now);
    _notifTimers.push(t);
  }
}

// ── Budget push alert (called from checkAlerts) ──
function triggerBudgetPush(title, body) {
  const ns = getNotifSettings();
  if (!ns.pushEnabled || !ns.types.budget) return;
  sendPush(title, body, 'budget');
}

// ── Email System (mailto-based, universal) ──
function buildEmailBody(type = 'summary') {
  const stats  = calcStats();
  const todayD = new Date();
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const dateStr = `${todayD.getDate()} ${months[todayD.getMonth()]} ${todayD.getFullYear()}`;
  const totalAssets = DB.assets.reduce((s,a)=>s+a.amount, 0);
  const totalSaved  = DB.savings.reduce((s,e)=>s+e.amount, 0);
  const goalPct = Math.min(100, Math.round((totalAssets+totalSaved)/(DB.user.goal||7900000)*100));

  const todayKey = todayISO();
  const doneHabits  = DB.habits.filter(h =>  h.completions?.[todayKey]);
  const undoneHabits = DB.habits.filter(h => !h.completions?.[todayKey]);
  const urgentPay = DB.recurringPayments.filter(r => {
    if (isPaymentPaid(r.id)) return false;
    const diff = Math.ceil((new Date(todayD.getFullYear(), todayD.getMonth(), r.dayOfMonth) - todayD) / 86400000);
    return diff >= 0 && diff <= 7;
  });

  const lines = [
    `NOBILE — Финансовая сводка · ${dateStr}`,
    `Пользователь: ${DB.user.name}`,
    ``,
    `═══ ФИНАНСЫ ═══`,
    `Доходы:   +${stats.income.toLocaleString('ru')} ₽`,
    `Расходы:  −${stats.expense.toLocaleString('ru')} ₽`,
    `Баланс:    ${stats.balance.toLocaleString('ru')} ₽`,
    `Норма сбережений: ${stats.savingsRate}%`,
    `Капитал: ${(totalAssets+totalSaved).toLocaleString('ru')} ₽ (${goalPct}% к цели)`,
    ``,
    `═══ ПРИВЫЧКИ СЕГОДНЯ (${doneHabits.length}/${DB.habits.length}) ═══`,
    doneHabits.length > 0 ? `✓ Выполнены: ${doneHabits.map(h=>h.name).join(', ')}` : '',
    undoneHabits.length > 0 ? `✗ Не выполнены: ${undoneHabits.map(h=>h.name).join(', ')}` : '',
    ``,
  ];

  if (urgentPay.length > 0) {
    lines.push(`═══ СРОЧНЫЕ ПЛАТЕЖИ ═══`);
    urgentPay.forEach(r => {
      const diff = Math.ceil((new Date(todayD.getFullYear(), todayD.getMonth(), r.dayOfMonth) - todayD) / 86400000);
      lines.push(`⏰ ${r.name}: ${r.amount.toLocaleString('ru')} ₽ — ${diff===0?'СЕГОДНЯ':`через ${diff} дн.`}`);
    });
    lines.push('');
  }

  lines.push(`Открыть Nobile: ${window.location.href}`);
  lines.push(`— Nobile AI Assistant`);

  return lines.filter(l => l !== null).join('%0D%0A');
}

function sendEmailSummary() {
  const ns = getNotifSettings();
  const email = ns.email || document.getElementById('set-email')?.value?.trim() || '';
  const subject = encodeURIComponent(`Nobile — Финансовая сводка · ${new Date().toLocaleDateString('ru')}`);
  const body = buildEmailBody('summary');
  const mailto = `mailto:${email}?subject=${subject}&body=${body}`;
  window.location.href = mailto;
  showToast('📧 Открываем почтовый клиент...');
}

function testEmailNotif() {
  const email = document.getElementById('set-email')?.value?.trim();
  if (!email || !email.includes('@')) {
    showToast('❌ Введите корректный email');
    return;
  }
  const ns = getNotifSettings();
  ns.email = email;
  localStorage.setItem(NOTIF_KEY, JSON.stringify(ns));
  const subject = encodeURIComponent('✅ Nobile — Тестовое уведомление');
  const body = buildEmailBody('test');
  window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
  showToast('📧 Тест отправлен!');
}

// ── Hook into settings open ──
// ── On load: restore and schedule ──
setTimeout(() => {
  const ns = getNotifSettings();
  if (ns.pushEnabled && Notification.permission === 'granted') {
    scheduleNotifications();
  }
  // Check for urgent payments on load and notify if push enabled
  if (ns.pushEnabled && ns.types.payments && Notification.permission === 'granted') {
    const today = new Date();
    const urgent = DB.recurringPayments.filter(r => {
      if (isPaymentPaid(r.id)) return false;
      const diff = Math.ceil((new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth) - today) / 86400000);
      return diff === 0;
    });
    urgent.forEach(r => {
      sendPush(`⏰ Платёж сегодня: ${r.name}`, `${r.amount.toLocaleString('ru')} ₽ нужно оплатить сегодня`, `payment-today-${r.id}`);
    });
  }
}, 2000);

/* ═══════════════════════════════════════
   AUTOPILOT ENGINE
═══════════════════════════════════════ */

const AP_KEY = 'nobile_autopilot';

function getAutopilotSettings() {
  try {
    const raw = localStorage.getItem(AP_KEY);
    const defaults = { enabled: true, life: 50, goals: 30, savings: 10, goalContrib: 10 };
    return raw ? { ...defaults, ...JSON.parse(raw) } : defaults;
  } catch { return { enabled: true, life: 50, goals: 30, savings: 10, goalContrib: 10 }; }
}

function saveAutopilotSettings() {
  const enabled = document.getElementById('set-autopilot-enabled')?.checked ?? true;
  const life        = parseInt(document.getElementById('ap-pct-life')?.value) || 50;
  const goals       = parseInt(document.getElementById('ap-pct-goals')?.value) || 30;
  const savings     = parseInt(document.getElementById('ap-pct-savings')?.value) || 10;
  const goalContrib = parseInt(document.getElementById('ap-pct-goalcontrib')?.value) || 10;
  const total = life + goals + savings + goalContrib;
  const warn = document.getElementById('ap-pct-warning');
  if (warn) warn.style.display = total !== 100 ? 'block' : 'none';
  const detail = document.getElementById('ap-settings-detail');
  if (detail) detail.style.display = enabled ? 'block' : 'none';
  localStorage.setItem(AP_KEY, JSON.stringify({ enabled, life, goals, savings, goalContrib }));
}

function loadAutopilotSettings() {
  const ap = getAutopilotSettings();
  const el = document.getElementById('set-autopilot-enabled');
  if (el) el.checked = ap.enabled;
  const fields = { 'ap-pct-life': ap.life, 'ap-pct-goals': ap.goals,
    'ap-pct-savings': ap.savings, 'ap-pct-goalcontrib': ap.goalContrib };
  Object.entries(fields).forEach(([id, val]) => {
    const input = document.getElementById(id);
    if (input) input.value = val;
  });
  const detail = document.getElementById('ap-settings-detail');
  if (detail) detail.style.display = ap.enabled ? 'block' : 'none';
}

// ── Dynamic adaptation logic ──
function calcAvgIncome(monthsBack = 3) {
  const now = new Date();
  let total = 0, count = 0;
  for (let i = 1; i <= monthsBack; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const sum = DB.transactions
      .filter(t => { const td = new Date(t.date); return t.type==='income' && td.getFullYear()===y && td.getMonth()===m; })
      .reduce((s,t) => s + t.amount, 0);
    if (sum > 0) { total += sum; count++; }
  }
  return count > 0 ? Math.round(total / count) : 0;
}

function adaptSplits(amount, baseSplits) {
  const avg = calcAvgIncome(3);
  if (!avg || avg === 0) return { splits: baseSplits, adapted: false, reason: '' };

  const ratio = amount / avg;
  let splits = { ...baseSplits };
  let adapted = false, reason = '';

  if (ratio < 0.8) {
    // Доход ниже нормы — снижаем накопления и взнос, добавляем к жизни
    const reduction = Math.round((1 - ratio) * 10);
    splits.savings    = Math.max(0, splits.savings    - reduction);
    splits.goalContrib= Math.max(0, splits.goalContrib - reduction);
    splits.life       = Math.min(70, splits.life + reduction * 2);
    const diff = 100 - (splits.life + splits.goals + splits.savings + splits.goalContrib);
    splits.goals = Math.max(0, splits.goals + diff);
    adapted = true;
    reason = `low`;
  } else if (ratio > 1.25) {
    // Доход выше нормы — увеличиваем накопления
    const bonus = Math.min(10, Math.round((ratio - 1) * 15));
    splits.savings     = Math.min(40, splits.savings + bonus);
    splits.life        = Math.max(30, splits.life - bonus);
    adapted = true;
    reason = `high`;
  }
  return { splits, adapted, reason, avg, ratio };
}

// ── Current autopilot plan (for confirm) ──
let _apPlan = null;

function triggerAutopilot(amount) {
  const ap = getAutopilotSettings();
  if (!ap.enabled) return;

  const base = { life: ap.life, goals: ap.goals, savings: ap.savings, goalContrib: ap.goalContrib };
  const { splits, adapted, reason, avg, ratio } = adaptSplits(amount, base);

  // Normalize to 100%
  const sum = splits.life + splits.goals + splits.savings + splits.goalContrib;
  if (sum !== 100 && sum > 0) {
    const diff = 100 - sum;
    splits.life = Math.max(0, splits.life + diff);
  }

  _apPlan = { amount, splits, adapted, reason, avg, ratio };
  showAutopilotModal(_apPlan);
}

function showAutopilotModal(plan) {
  const { amount, splits, adapted, reason, avg, ratio } = plan;

  document.getElementById('ap-income-badge').textContent = '+ ' + amount.toLocaleString('ru') + ' ₽';
  document.getElementById('ap-adapted-tag').style.display = adapted ? 'inline-flex' : 'none';

  // AI commentary
  let aiText = '';
  if (!adapted) {
    const savAmt = Math.round(amount * splits.savings / 100);
    aiText = `Отличное поступление! По твоей схеме <b>${splits.life}/${splits.goals}/${splits.savings+splits.goalContrib}</b> всё в норме. Откладываем <b>${savAmt.toLocaleString('ru')} ₽</b> сразу — до того, как успеешь потратить.`;
  } else if (reason === 'low') {
    const pct = Math.round((1 - ratio) * 100);
    aiText = `Этот доход на <b>${pct}% ниже</b> твоего среднего (${avg.toLocaleString('ru')} ₽). Немного снизил накопления, чтобы не было стресса. Важнее сохранить привычку, чем гнаться за идеальным %.`;
  } else if (reason === 'high') {
    const pct = Math.round((ratio - 1) * 100);
    aiText = `Доход на <b>${pct}% выше</b> обычного! Увеличил долю накоплений — это отличный момент чтобы ускорить прогресс к цели.`;
  }

  document.getElementById('ap-ai-text').innerHTML = aiText;
  document.getElementById('ap-subtitle').textContent =
    adapted ? 'ИИ адаптировал план под текущий доход' : 'Вот как ИИ предлагает распределить поступление';

  // Splits
  const ROWS = [
    { key:'life',        icon:'🏠', label:'Повседневная жизнь', desc:'Еда, транспорт, жильё, коммуналка', color:'var(--blue)' },
    { key:'goals',       icon:'🎯', label:'Цели и желания',     desc:'Отдых, развлечения, покупки',       color:'var(--gold)' },
    { key:'savings',     icon:'🏦', label:'Накопления',          desc:'Подушка безопасности',              color:'var(--mint)' },
    { key:'goalContrib', icon:'📈', label:'Взнос в цель',        desc:'Крупная финансовая цель',           color:'#a78bfa' },
  ];

  const splitsEl = document.getElementById('ap-splits-list');
  splitsEl.innerHTML = ROWS.map(r => {
    const pct = splits[r.key];
    const amt = Math.round(amount * pct / 100);
    return `<div class="ap-split-row ${r.key==='savings'?'highlighted':''}">
      <div class="ap-split-ico">${r.icon}</div>
      <div class="ap-split-info">
        <div class="ap-split-label">${r.label}</div>
        <div class="ap-split-desc">${r.desc}</div>
      </div>
      <div style="text-align:right">
        <div class="ap-split-amount" style="color:${r.color}">${amt.toLocaleString('ru')} ₽</div>
        <div class="ap-split-pct">${pct}%</div>
      </div>
    </div>`;
  }).join('');

  const overlay = document.getElementById('ap-overlay');
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeAutopilot() {
  const overlay = document.getElementById('ap-overlay');
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  _apPlan = null;
}

function apOverlayClick(e) {
  if (e.target === document.getElementById('ap-overlay')) closeAutopilot();
}

function confirmAutopilot() {
  if (!_apPlan) { closeAutopilot(); return; }
  const { amount, splits } = _apPlan;
  const today = todayISO();

  // Add savings entry
  const savingsAmt = Math.round(amount * splits.savings / 100);
  if (savingsAmt > 0) {
    DB.savings.push({ id: Date.now(), amount: savingsAmt, note: '🤖 Автопилот — накопления', date: today });
  }

  // Add goal contribution entry
  const goalAmt = Math.round(amount * splits.goalContrib / 100);
  if (goalAmt > 0 && DB.goals.length > 0) {
    // Add to first active goal
    const g = DB.goals.find(g => g.saved < g.target);
    if (g) {
      g.saved = (g.saved || 0) + goalAmt;
      showToast(`📈 +${goalAmt.toLocaleString('ru')} ₽ → ${g.name}`);
    } else {
      DB.savings.push({ id: Date.now()+1, amount: goalAmt, note: '🤖 Автопилот — взнос в цель', date: today });
    }
  }

  saveDB();
  renderAll();
  closeAutopilot();
  showToast('✅ Автопилот применён!');
}

// ── Init settings on sheet open ──
// Patch to load autopilot settings when settings sheet opens
const _apSettingsObserver = new MutationObserver(() => {
  const sheet = document.getElementById('sheet-settings');
  if (sheet && sheet.classList.contains('open')) {
    loadAutopilotSettings();
  }
});
document.addEventListener('DOMContentLoaded', () => {
  const sheet = document.getElementById('sheet-settings');
  if (sheet) _apSettingsObserver.observe(sheet, { attributes: true, attributeFilter: ['class'] });
  loadAutopilotSettings();
});

/* ═══════════════════════════════════════
   LIFE SIMULATOR ENGINE
═══════════════════════════════════════ */
(function() {

  // ── State ──
  const _simActive = { car: false, move: false, job: false, loan: false };

  // ── Toggle scenario card ──
  window.simToggle = function(key, forceState) {
    const state = forceState !== undefined ? forceState : !_simActive[key];
    _simActive[key] = state;

    const card = document.getElementById('sim-sc-' + key);
    const chk  = document.getElementById('sim-chk-' + key);
    if (card)  card.classList.toggle('active', state);
    if (chk)   chk.checked = state;
  };

  window.simToggleSettings = function() {
    const body = document.getElementById('sim-body-settings');
    const arr  = document.getElementById('sim-settings-arrow');
    if (!body) return;
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : 'block';
    if (arr) arr.textContent = open ? '▼' : '▲';
  };

  // ── Read DB base values ──
  function getBaseMonthly() {
    try {
      const stats = calcStats ? calcStats() : null;
      if (stats) {
        return { income: stats.income || 0, expense: stats.expense || 0 };
      }
    } catch(e) {}
    // fallback: compute from transactions
    const now = new Date();
    const monthKey = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0');
    let inc = 0, exp = 0;
    (DB.transactions || []).forEach(t => {
      if ((t.date || '').startsWith(monthKey)) {
        if (t.type === 'income') inc += (t.amount || 0);
        else exp += (t.amount || 0);
      }
    });
    return { income: inc, expense: exp };
  }

  // ── Update hero base info ──
  window.renderSimulator = function() {
    const base = getBaseMonthly();
    const free = base.income - base.expense;
    const fmt = v => Math.abs(v) >= 1000000
      ? (v/1000000).toFixed(1) + 'M'
      : Math.abs(v) >= 1000
        ? Math.round(v/1000) + 'K'
        : String(Math.round(v));
    const el = (id) => document.getElementById(id);
    if (el('sim-base-income'))  el('sim-base-income').textContent  = fmt(base.income) + ' ₽';
    if (el('sim-base-expense')) el('sim-base-expense').textContent = fmt(base.expense) + ' ₽';
    if (el('sim-base-savings')) el('sim-base-savings').textContent = fmt(Math.max(0,free)) + ' ₽';
    // Pre-fill new-job salary with current income
    const jobInput = el('sim-job-salary');
    if (jobInput && !jobInput._prefilled && base.income > 0) {
      jobInput.value = Math.round(base.income);
      jobInput._prefilled = true;
    }
  };

  // ── Loan monthly payment (annuity) ──
  function annuityPayment(principal, annualRate, months) {
    if (months <= 0) return 0;
    if (annualRate <= 0) return principal / months;
    const r = annualRate / 100 / 12;
    return principal * r * Math.pow(1+r, months) / (Math.pow(1+r, months) - 1);
  }

  // ── Core simulation ──
  function simulateYear(yearN, baseIncome, baseExpense, scenarios, settings) {
    const inflation   = settings.inflation / 100;
    const savRate     = settings.savingsRate / 100;
    let income  = baseIncome;
    let expense = baseExpense;
    let oneTime = 0;    // one-time costs at start
    let extraDebt = 0;  // monthly debt payment
    let assetValue = 0; // car / loan asset value

    // Inflate base (each year compounds inflation)
    const inflFactor = Math.pow(1 + inflation, yearN);
    income  *= inflFactor;
    expense *= inflFactor;

    // ── Car ──
    if (scenarios.car) {
      const price = scenarios.car.price;
      const down  = scenarios.car.down;
      const rate  = scenarios.car.rate;
      const term  = scenarios.car.term;
      const monthlyCar = scenarios.car.monthly;
      const depr  = scenarios.car.depr / 100;
      const loanAmt = price - down;

      // Monthly loan payment (if loan not yet finished)
      const monthsIn = yearN * 12;
      if (monthsIn < term) {
        const remainMonths = term - monthsIn;
        if (loanAmt > 0) {
          extraDebt += annuityPayment(loanAmt, rate, term);
        }
      }
      // Ongoing car expenses (inflated)
      expense += monthlyCar * inflFactor;
      // Down payment as one-time cost (only year 0 → accounted separately)
      if (yearN === 0) oneTime += down;
      // Car asset value at end of yearN
      assetValue += price * Math.pow(1 - depr, yearN);
    }

    // ── Move ──
    if (scenarios.move) {
      const rentDelta   = scenarios.move.rentNew - scenarios.move.rentOld;
      const incDelta    = scenarios.move.incomeDelta;
      const expDelta    = scenarios.move.expenseDelta;
      income  += (incDelta) * inflFactor;
      expense += (rentDelta + expDelta) * inflFactor;
      if (yearN === 0) oneTime += scenarios.move.moveCost;
    }

    // ── Job ──
    if (scenarios.job) {
      const newSalary  = scenarios.job.salary;
      const gapMonths  = yearN === 0 ? scenarios.job.gap : 0;
      const salGrowth  = Math.pow(1 + scenarios.job.growth / 100, yearN);
      // Replace income with new salary (inflated + raises)
      income = newSalary * salGrowth * inflFactor;
      if (yearN === 0) oneTime += scenarios.job.train;
      // Months without income in first year
      if (yearN === 0 && gapMonths > 0) {
        income = income * (12 - gapMonths) / 12;
      }
    }

    // ── Loan ──
    if (scenarios.loan) {
      const loanAmt  = scenarios.loan.amount;
      const rate     = scenarios.loan.rate;
      const term     = scenarios.loan.term;
      const purpose  = scenarios.loan.purpose;
      const monthReturn = scenarios.loan.monthReturn;
      const monthsIn = yearN * 12;
      if (monthsIn < term) {
        extraDebt += annuityPayment(loanAmt, rate, term);
      }
      if (purpose === 'investment' || purpose === 'education') {
        income += monthReturn * inflFactor;
      }
    }

    // Monthly free cash
    const monthlySave = income - expense - extraDebt;
    return { monthlySave, oneTime, assetValue };
  }

  function buildProjection(baseIncome, baseExpense, scenarios, settings, years) {
    const savRate = settings.savingsRate / 100;
    let baseSavings = 0;
    let scenSavings = 0;

    const baseArr = [];
    const scenArr = [];

    // One-time cost at t=0
    let scenStartCost = 0;
    if (scenarios.car)  scenStartCost += (scenarios.car.price - scenarios.car.down);
    // (down already in oneTime at yearN=0)

    for (let y = 1; y <= years; y++) {
      const inflFactor = Math.pow(1 + settings.inflation / 100, y - 1);
      // Base: just monthly free cash, invested at savRate
      const baseFree = (baseIncome - baseExpense) * inflFactor;
      baseSavings = baseSavings * (1 + savRate / 12 * 12) + Math.max(0, baseFree) * 12;

      // Scenario
      const res = simulateYear(y - 1, baseIncome, baseExpense, scenarios, settings);
      if (y === 1 && res.oneTime > 0) scenSavings -= res.oneTime;
      scenSavings = scenSavings * (1 + savRate / 12 * 12) + res.monthlySave * 12;
      scenSavings += res.assetValue > 0 && y === years ? 0 : 0; // asset already tracked

      baseArr.push(Math.round(baseSavings));
      scenArr.push(Math.round(scenSavings));
    }
    return { baseArr, scenArr };
  }

  // ── Format large numbers ──
  function fmtMoney(v) {
    const abs = Math.abs(v);
    const sign = v < 0 ? '−' : '';
    if (abs >= 1000000) return sign + (abs/1000000).toFixed(1) + ' млн ₽';
    if (abs >= 1000) return sign + Math.round(abs/1000) + ' тыс ₽';
    return sign + Math.round(abs) + ' ₽';
  }

  function fmtDelta(diff) {
    const sign = diff >= 0 ? '+' : '−';
    return sign + fmtMoney(Math.abs(diff));
  }

  // ── Generate AI text ──
  function buildAIText(scenarios, proj5base, proj5scen, proj10base, proj10scen, monthlySave0) {
    const diff5  = proj5scen  - proj5base;
    const diff10 = proj10scen - proj10base;
    const isPos5  = diff5  >= 0;
    const isPos10 = diff10 >= 0;

    let lines = [];

    // Intro
    const activeScens = Object.entries(scenarios).filter(([,v]) => v).map(([k]) => k);
    const names = { car:'покупки машины', move:'переезда', job:'смены работы', loan:'взятия кредита' };
    const namesList = activeScens.map(k => names[k]).join(', ');

    if (activeScens.length === 0) {
      return 'Активируйте хотя бы один сценарий, чтобы увидеть анализ.';
    }

    lines.push(`Я проанализировал влияние <strong>${namesList}</strong> на твои финансы.`);

    // 5-year summary
    if (isPos5) {
      lines.push(`📈 За 5 лет сценарий <strong>улучшает</strong> твою ситуацию на <strong>${fmtMoney(diff5)}</strong> относительно текущего пути.`);
    } else {
      lines.push(`📉 За 5 лет сценарий <strong>снижает</strong> накопления на <strong>${fmtMoney(Math.abs(diff5))}</strong> — но это временно.`);
    }

    // 10-year
    if (isPos10) {
      lines.push(`🚀 Через 10 лет разрыв в пользу сценария составит <strong>${fmtMoney(diff10)}</strong>.`);
    } else {
      lines.push(`⚠️ Через 10 лет накопления по сценарию ниже на <strong>${fmtMoney(Math.abs(diff10))}</strong>.`);
    }

    // Monthly cash flow
    if (monthlySave0 < 0) {
      lines.push(`💸 Ежемесячный дефицит в первый год: <strong style="color:var(--coral)">${fmtMoney(monthlySave0)}/мес</strong>. Убедись, что есть резерв.`);
    } else {
      lines.push(`✅ Свободный денежный поток в первый год: <strong style="color:var(--mint)">${fmtMoney(monthlySave0)}/мес</strong>.`);
    }

    // Car-specific
    if (scenarios.car) {
      const pay = annuityPayment(scenarios.car.price - scenarios.car.down, scenarios.car.rate, scenarios.car.term);
      lines.push(`🚗 Ежемесячный платёж по автокредиту: <strong>${fmtMoney(pay)}</strong>.`);
    }

    // Job-specific
    if (scenarios.job && scenarios.job.gap > 0) {
      lines.push(`💼 Учти ${scenarios.job.gap} мес без дохода в период поиска — создай подушку минимум на этот срок.`);
    }

    // Loan-specific
    if (scenarios.loan) {
      const pay = annuityPayment(scenarios.loan.amount, scenarios.loan.rate, scenarios.loan.term);
      const totalPay = pay * scenarios.loan.term;
      const overpay = totalPay - scenarios.loan.amount;
      lines.push(`💳 Переплата по кредиту: <strong style="color:var(--coral)">${fmtMoney(overpay)}</strong> (итого отдашь ${fmtMoney(totalPay)}).`);
    }

    return lines.join(' ');
  }

  // ── Build tips ──
  function buildTips(scenarios, diff5, diff10, monthlySave0) {
    const tips = [];

    if (monthlySave0 < 0) {
      tips.push({ ico: '🚨', text: 'Отрицательный денежный поток в первый год. Создай финансовую подушку на 3–6 месяцев расходов до реализации сценария.' });
    }
    if (scenarios.car) {
      tips.push({ ico: '🔑', text: 'Рассмотри вариант б/у авто — снизит кредитную нагрузку и ускорит накопление капитала.' });
    }
    if (scenarios.loan && scenarios.loan.rate > 15) {
      tips.push({ ico: '📉', text: 'Ставка по кредиту высокая. Погаси его досрочно как только появятся свободные средства — каждый месяц экономит тысячи на процентах.' });
    }
    if (scenarios.job && scenarios.job.growth > 0) {
      tips.push({ ico: '🎯', text: 'Направляй каждое повышение зарплаты на инвестиции — не давай образу жизни расти пропорционально доходу (lifestyle inflation).' });
    }
    if (diff10 < 0) {
      tips.push({ ico: '⚖️', text: 'Через 10 лет сценарий уступает текущей траектории. Подумай: даёт ли он нефинансовую ценность (комфорт, здоровье, время), которая оправдывает разницу?' });
    }
    if (diff10 > 1000000) {
      tips.push({ ico: '💡', text: 'Сценарий значительно выгоден на горизонте 10 лет. Чем раньше ты его реализуешь — тем больше выгода за счёт сложного процента.' });
    }
    tips.push({ ico: '📊', text: 'Пересматривай симуляцию каждые 6 месяцев — реальные цифры дохода и расходов будут уточняться.' });

    return tips.slice(0, 4);
  }

  // ── Update horizon displays ──
  window.updateSimulation = function() {
    const h1 = parseInt(document.getElementById('sim-horizon-1')?.value) || 5;
    const h2 = parseInt(document.getElementById('sim-horizon-2')?.value) || 10;
    document.getElementById('sim-h1-display').textContent = h1;
    document.getElementById('sim-h2-display').textContent = h2;
  };

  // ── Main run function ──
  window.runSimulation = function() {
    const btn = document.getElementById('sim-run-btn');
    if (btn) { btn.classList.add('loading'); btn.textContent = '⏳ Считаю...'; }

    setTimeout(() => {
      try { _runSimulation(); } catch(e) { console.error('Sim error:', e); showToast('Ошибка симуляции'); }
      if (btn) { btn.classList.remove('loading'); btn.textContent = '🔮 Запустить симуляцию'; }
    }, 600);
  };

  function _runSimulation() {
    const base = getBaseMonthly();
    const baseIncome  = base.income  || 80000;
    const baseExpense = base.expense || 50000;

    // Get custom horizons
    const h1 = parseInt(document.getElementById('sim-horizon-1')?.value) || 5;
    const h2 = parseInt(document.getElementById('sim-horizon-2')?.value) || 10;
    const maxYears = Math.max(h1, h2, 10);

    // Update horizon displays
    document.getElementById('sim-h1-display').textContent = h1;
    document.getElementById('sim-h2-display').textContent = h2;

    // Gather scenarios
    const g = (id) => parseFloat(document.getElementById(id)?.value) || 0;

    const scenarios = {};

    if (_simActive.car) {
      scenarios.car = {
        price: g('sim-car-price'),
        down:  g('sim-car-down'),
        rate:  g('sim-car-rate'),
        term:  g('sim-car-term'),
        monthly: g('sim-car-monthly'),
        depr: g('sim-car-depr') || 15
      };
    }
    if (_simActive.move) {
      scenarios.move = {
        rentOld: g('sim-move-rent-old'),
        rentNew: g('sim-move-rent-new'),
        incomeDelta: g('sim-move-income-delta'),
        expenseDelta: g('sim-move-expense-delta'),
        moveCost: g('sim-move-cost')
      };
    }
    if (_simActive.job) {
      scenarios.job = {
        salary: g('sim-job-salary') || baseIncome,
        gap: g('sim-job-gap'),
        growth: g('sim-job-growth') || 10,
        train: g('sim-job-train')
      };
    }
    if (_simActive.loan) {
      scenarios.loan = {
        amount: g('sim-loan-amount'),
        rate: g('sim-loan-rate'),
        term: g('sim-loan-term'),
        purpose: document.getElementById('sim-loan-purpose')?.value || 'consumption',
        monthReturn: g('sim-loan-return')
      };
    }

    if (Object.keys(scenarios).length === 0) {
      showToast('⚠️ Включите хотя бы один сценарий');
      return;
    }

    const settings = {
      inflation:    g('sim-inflation')    || 8,
      savingsRate:  g('sim-savings-rate') || 12
    };

    // Dynamic projection based on max horizon
    const proj = buildProjection(baseIncome, baseExpense, scenarios, settings, maxYears);

    const base5  = proj.baseArr[h1-1] || 0;
    const scen5  = proj.scenArr[h1-1] || 0;
    const base10 = proj.baseArr[h2-1] || 0;
    const scen10 = proj.scenArr[h2-1] || 0;
    const diff5  = scen5 - base5;
    const diff10 = scen10 - base10;

    // Monthly in year 1
    const res0 = simulateYear(0, baseIncome, baseExpense, scenarios, settings);
    const monthlySave0 = res0.monthlySave;

    // ── Fill horizon cards ──
    const el = (id) => document.getElementById(id);
    if (el('sim-y5-val'))   el('sim-y5-val').textContent   = fmtMoney(scen5);
    if (el('sim-y10-val'))  el('sim-y10-val').textContent  = fmtMoney(scen10);

    const d5El = el('sim-y5-delta');
    if (d5El) {
      d5El.innerHTML = `<span>${diff5 >= 0 ? '▲' : '▼'} ${fmtMoney(Math.abs(diff5))} vs без изменений</span>`;
      d5El.className = 'sim-horizon-delta ' + (diff5 >= 0 ? 'pos' : 'neg');
    }
    const d10El = el('sim-y10-delta');
    if (d10El) {
      d10El.innerHTML = `<span>${diff10 >= 0 ? '▲' : '▼'} ${fmtMoney(Math.abs(diff10))} vs без изменений</span>`;
      d10El.className = 'sim-horizon-delta ' + (diff10 >= 0 ? 'pos' : 'neg');
    }

    // ── Bar chart ──
    const chartEl = el('sim-chart-bars');
    if (chartEl) {
      // Years to show: 1,2,3,5,7,10
      const years = [1,2,3,5,7,10];
      const vals = years.map(y => ({
        y,
        base: proj.baseArr[y-1] || 0,
        scen: proj.scenArr[y-1] || 0
      }));
      const maxVal = Math.max(...vals.map(v => Math.max(Math.abs(v.base), Math.abs(v.scen))), 1);

      chartEl.innerHTML = vals.map(v => {
        const bH = Math.round(Math.abs(v.base) / maxVal * 100);
        const sH = Math.round(Math.abs(v.scen) / maxVal * 100);
        const isNeg = v.scen < 0;
        return `
          <div class="sim-bar-group">
            <div class="sim-bar-pair">
              <div class="sim-bar base" style="height:${bH}px"></div>
              <div class="sim-bar scen ${isNeg ? 'neg-bar' : ''}" style="height:${sH}px"></div>
            </div>
            <div class="sim-bar-lbl">${v.y}л</div>
          </div>`;
      }).join('');
    }

    // ── Metrics ──
    const metricsEl = el('sim-metrics-list');
    if (metricsEl) {
      const rows = [
        { lbl: '📅 Свободно / мес (год 1)', base: baseIncome - baseExpense, scen: monthlySave0, unit: '/мес' },
        { lbl: '📈 Накопления через 5 лет',  base: base5,  scen: scen5 },
        { lbl: '🚀 Накопления через 10 лет', base: base10, scen: scen10 },
      ];
      if (scenarios.car) {
        const pay = annuityPayment(scenarios.car.price - scenarios.car.down, scenarios.car.rate, scenarios.car.term);
        rows.push({ lbl: '🚗 Платёж по автокредиту', base: 0, scen: -pay, unit: '/мес', special: 'car' });
      }
      if (scenarios.loan) {
        const pay = annuityPayment(scenarios.loan.amount, scenarios.loan.rate, scenarios.loan.term);
        rows.push({ lbl: '💳 Платёж по кредиту', base: 0, scen: -pay, unit: '/мес', special: 'loan' });
      }

      metricsEl.innerHTML = rows.map(r => {
        const diff = r.scen - r.base;
        const cls  = diff >= 0 ? 'pos' : 'neg';
        const sign = diff >= 0 ? '+' : '';
        const unit = r.unit || '';
        return `
          <div class="sim-metric-row">
            <div class="sim-metric-lbl">${r.lbl}</div>
            <div class="sim-metric-vals">
              ${r.base !== 0 ? `<div class="sim-metric-base">${fmtMoney(r.base)}${unit}</div>` : ''}
              <div class="sim-metric-new ${cls}">${fmtMoney(r.scen)}${unit}</div>
            </div>
          </div>`;
      }).join('');
    }

    // ── AI text ──
    const aiEl = el('sim-ai-text');
    if (aiEl) {
      aiEl.innerHTML = buildAIText(scenarios, base5, scen5, base10, scen10, monthlySave0);
    }

    // ── Tips ──
    const tipsEl = el('sim-tips');
    if (tipsEl) {
      const tips = buildTips(scenarios, diff5, diff10, monthlySave0);
      tipsEl.innerHTML = tips.map(t =>
        `<div class="sim-tip"><span class="sim-tip-ico">${t.ico}</span><span>${t.text}</span></div>`
      ).join('');
    }

    // ── Show results ──
    const resEl = el('sim-results');
    if (resEl) {
      resEl.classList.add('show');
      setTimeout(() => resEl.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    }
  }

  window.resetSimulation = function() {
    // Hide results
    const resEl = document.getElementById('sim-results');
    if (resEl) resEl.classList.remove('show');
    // Deactivate all
    ['car','move','job','loan'].forEach(k => window.simToggle(k, false));
    window.scrollTo(0, 0);
  };

  // ── Auto-render when page is shown ──
  document.addEventListener('DOMContentLoaded', () => {
    const _origNavTo = window.navTo;
    window.navTo = function(key) {
      if (_origNavTo) _origNavTo(key);
      if (key === 'simulator') {
        setTimeout(() => { try { renderSimulator(); } catch(e) {} }, 100);
      }
    };
  });

})();

/* ═══════════════════════════════════════
   HABIT TIPS ENGINE
═══════════════════════════════════════ */

// Кешируем подсказки чтобы не дёргать API каждый раз
const _tipsCache = {};

// Статичные подсказки для популярных типов привычек
const HABIT_TIPS_STATIC = {
  breakfast: {
    tag: 'recipe', label: '🥗 Рецепт',
    cards: [
      { title: 'Овсянка с ягодами',
        body: 'Овёс + молоко/вода + горсть ягод + орехи. Готовится 5 мин, держит сытость 4–5 ч. Клетчатка стабилизирует сахар в крови.',
        links: [
          { label: '🔍 Рецепты Google', url: 'https://www.google.com/search?q=%D1%80%D0%B5%D1%86%D0%B5%D0%BF%D1%82+%D0%BE%D0%B2%D1%81%D1%8F%D0%BD%D0%BA%D0%B0+%D0%B7%D0%B0%D0%B2%D1%82%D1%80%D0%B0%D0%BA' },
          { label: '🍽 Открыть eda.ru', url: 'https://eda.ru' },
        ]},
      { title: 'Яичница с авокадо',
        body: '2 яйца + авокадо + цельнозерновой тост. Белок + полезные жиры = устойчивая энергия до обеда. Без скачков сахара.',
        links: [
          { label: '🔍 Рецепты Google', url: 'https://www.google.com/search?q=%D1%80%D0%B5%D1%86%D0%B5%D0%BF%D1%82+%D1%8F%D0%B9%D1%86%D0%B0+%D0%B0%D0%B2%D0%BE%D0%BA%D0%B0%D0%B4%D0%BE+%D0%B7%D0%B0%D0%B2%D1%82%D1%80%D0%B0%D0%BA' },
          { label: '🍽 Открыть eda.ru', url: 'https://eda.ru' },
        ]},
      { title: 'Греческий йогурт + гранола',
        body: '150 г йогурта + 30 г гранолы + банан. 20–25 г белка, пробиотики, быстро. Идеально если мало времени.',
        links: [
          { label: '🔍 Рецепты Google', url: 'https://www.google.com/search?q=%D0%B3%D1%80%D0%B5%D1%87%D0%B5%D1%81%D0%BA%D0%B8%D0%B9+%D0%B9%D0%BE%D0%B3%D1%83%D1%80%D1%82+%D0%B3%D1%80%D0%B0%D0%BD%D0%BE%D0%BB%D0%B0+%D0%B7%D0%B0%D0%B2%D1%82%D1%80%D0%B0%D0%BA' },
          { label: '🍽 Открыть eda.ru', url: 'https://eda.ru' },
        ]},
    ]
  },
  reading: {
    tag: 'book', label: '📚 Книга',
    cards: [
      { title: 'Психология денег — Морган Хаузел',
        body: '«Деньги — это не о том, насколько ты умён. Это о том, как ты себя ведёшь.» Лучшая книга о личных финансах.',
        links: [
          { label: '📖 Найти на Литрес', url: 'https://www.litres.ru/search/?q=%D0%BF%D1%81%D0%B8%D1%85%D0%BE%D0%BB%D0%BE%D0%B3%D0%B8%D1%8F+%D0%B4%D0%B5%D0%BD%D0%B5%D0%B3' },
          { label: '🎧 Storytel (аудио)', url: 'https://www.storytel.com/ru' },
        ]},
      { title: 'Богатый папа, бедный папа — Кийосаки',
        body: 'Почему богатые богатеют, а бедные беднеют. Основы финансового мышления, активы vs пассивы. Обязательная база.',
        links: [
          { label: '📖 Найти на Литрес', url: 'https://www.litres.ru/search/?q=%D0%B1%D0%BE%D0%B3%D0%B0%D1%82%D1%8B%D0%B9+%D0%BF%D0%B0%D0%BF%D0%B0' },
          { label: '🎧 Storytel (аудио)', url: 'https://www.storytel.com/ru' },
        ]},
      { title: 'Атомные привычки — Джеймс Клир',
        body: 'Система формирования любой привычки. 1% улучшений каждый день = результат × 37 за год.',
        links: [
          { label: '📖 Найти на Литрес', url: 'https://www.litres.ru/search/?q=%D0%B0%D1%82%D0%BE%D0%BC%D0%BD%D1%8B%D0%B5+%D0%BF%D1%80%D0%B8%D0%B2%D1%8B%D1%87%D0%BA%D0%B8' },
          { label: '🎧 Storytel (аудио)', url: 'https://www.storytel.com/ru' },
        ]},
      { title: 'Думай медленно, решай быстро — Канеман',
        body: 'Почему мы принимаем плохие финансовые решения. Когнитивные искажения которые стоят тебе денег каждый день.',
        links: [
          { label: '📖 Найти на Литрес', url: 'https://www.litres.ru/search/?q=%D0%B4%D1%83%D0%BC%D0%B0%D0%B9+%D0%BC%D0%B5%D0%B4%D0%BB%D0%B5%D0%BD%D0%BD%D0%BE' },
          { label: '🎧 Storytel (аудио)', url: 'https://www.storytel.com/ru' },
        ]},
    ]
  },
  podcast: {
    tag: 'podcast', label: '🎙 Подкаст',
    cards: [
      { title: 'Деньги не спят (Финсайд)',
        body: 'Главный русскоязычный финансовый подкаст. Инвестиции, личные финансы, интервью с экспертами.',
        links: [
          { label: '▶ YouTube канал', url: 'https://www.youtube.com/@finsight_media' },
          { label: '🎵 Найти в Spotify', url: 'https://open.spotify.com/search/%D0%B4%D0%B5%D0%BD%D1%8C%D0%B3%D0%B8%20%D0%BD%D0%B5%20%D1%81%D0%BF%D1%8F%D1%82' },
        ]},
      { title: 'How I Built This — Guy Raz',
        body: 'Истории основателей компаний от нуля до успеха. Мышление предпринимателя. Eng, но стоит усилий.',
        links: [
          { label: '🎵 Открыть Spotify', url: 'https://open.spotify.com/search/how%20i%20built%20this' },
          { label: '▶ YouTube', url: 'https://www.youtube.com/results?search_query=how+i+built+this+guy+raz' },
        ]},
      { title: 'The Tim Ferriss Show',
        body: 'Интервью с топ-перформерами: от инвесторов до спортсменов. Инструменты для жизни и бизнеса. Eng.',
        links: [
          { label: '🌐 Сайт подкаста', url: 'https://tim.blog' },
          { label: '🎵 Открыть Spotify', url: 'https://open.spotify.com/search/tim%20ferriss%20show' },
        ]},
      { title: 'Huberman Lab',
        body: 'Нейробиология привычек, сна, продуктивности. Научно подтверждённые методы улучшения жизни. Eng.',
        links: [
          { label: '▶ YouTube канал', url: 'https://www.youtube.com/@hubermanlab' },
          { label: '🌐 Сайт подкаста', url: 'https://www.hubermanlab.com' },
        ]},
    ]
  },
  meditation: {
    tag: 'tip', label: '🧘 Техника',
    cards: [
      { title: 'Метод 4-7-8',
        body: 'Вдох 4 сек → задержка 7 сек → выдох 8 сек. 4 цикла. Снижает кортизол за 3–5 минут.',
        links: [
          { label: '🧘 Insight Timer (бесплатно)', url: 'https://insighttimer.com' },
          { label: '▶ Видео-гид YouTube', url: 'https://www.youtube.com/results?search_query=4-7-8+breathing+technique' },
        ]},
      { title: 'Сканирование тела (Body Scan)',
        body: 'Лёжа, 10 минут. Медленно переводи внимание от пальцев ног до макушки. Снимает напряжение, помогает заснуть.',
        links: [
          { label: '🧘 Insight Timer (бесплатно)', url: 'https://insighttimer.com' },
          { label: '😌 Calm', url: 'https://www.calm.com' },
        ]},
      { title: 'Медитация на дыхание',
        body: 'Фокус на вдохе/выдохе. Когда мысли уходят — мягко возвращай внимание. Даже 5 минут утром меняют качество дня.',
        links: [
          { label: '🧘 Insight Timer (бесплатно)', url: 'https://insighttimer.com' },
          { label: '▶ YouTube на русском', url: 'https://www.youtube.com/results?search_query=%D0%BC%D0%B5%D0%B4%D0%B8%D1%82%D0%B0%D1%86%D0%B8%D1%8F+%D0%B4%D1%8B%D1%85%D0%B0%D0%BD%D0%B8%D0%B5+5+%D0%BC%D0%B8%D0%BD%D1%83%D1%82' },
        ]},
    ]
  },
  exercise: {
    tag: 'tip', label: '💪 Совет',
    cards: [
      { title: 'Принцип прогрессивной нагрузки',
        body: 'Увеличивай нагрузку на 2–5% каждые 1–2 недели. Мышцы растут только при адаптации к новому стрессу.',
        links: [
          { label: '▶ AthleanX на YouTube', url: 'https://www.youtube.com/@AthleanX' },
          { label: '▶ Тренировки на русском', url: 'https://www.youtube.com/results?search_query=%D0%BF%D1%80%D0%BE%D0%B3%D1%80%D0%B5%D1%81%D1%81%D0%B8%D0%B2%D0%BD%D0%B0%D1%8F+%D0%BD%D0%B0%D0%B3%D1%80%D1%83%D0%B7%D0%BA%D0%B0+%D1%82%D1%80%D0%B5%D0%BD%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B0' },
        ]},
      { title: 'Восстановление важнее тренировки',
        body: 'Рост происходит не на тренировке, а во время отдыха. 7–8 часов сна + 48 ч восстановления мышечной группы.',
        links: [
          { label: '📱 Трекер Hevy', url: 'https://www.hevy.com' },
          { label: '💪 Strong App', url: 'https://www.strong.app' },
        ]},
      { title: 'Белок — ключ к результату',
        body: '1.6–2.2 г белка на кг веса в день. Без достаточного белка прогресс в зале будет минимальным.',
        links: [
          { label: '🥩 FatSecret RU', url: 'https://www.fatsecret.ru' },
          { label: '📊 Cronometer', url: 'https://cronometer.com' },
        ]},
    ]
  },
  savings: {
    tag: 'tip', label: '💰 Стратегия',
    cards: [
      { title: 'Автоматизация — главный секрет',
        body: 'Настрой автоперевод в накопления в день зарплаты. Не "сохраняй что останется" — сохраняй сразу, трать остаток.',
        links: [
          { label: '📖 Тинькофф Журнал', url: 'https://journal.tinkoff.ru' },
          { label: '📖 vc.ru — финансы', url: 'https://vc.ru/finance' },
        ]},
      { title: 'Правило «заплати себе первым»',
        body: 'Первый платёж месяца — себе. 10–20% дохода до любых трат. Это основа финансовой дисциплины успешных людей.',
        links: [
          { label: '📖 Тинькофф Журнал', url: 'https://journal.tinkoff.ru' },
          { label: '📖 Финансы на vc.ru', url: 'https://vc.ru/finance' },
        ]},
      { title: 'Сила маленьких сумм',
        body: '500 ₽/день × 365 = 182 500 ₽ в год. При 10% годовых через 10 лет — 3 млн ₽.',
        links: [
          { label: '🔢 Калькулятор на calcus.ru', url: 'https://calcus.ru' },
          { label: '🏦 Калькулятор banki.ru', url: 'https://www.banki.ru' },
        ],
        action: { label: '⚡ Попробовать прямо сейчас', type: 'smallSum' }},
    ]
  },
  walk: {
    tag: 'tip', label: '🚶 Факт',
    cards: [
      { title: '10 000 шагов — миф?',
        body: 'Исследования Harvard показывают: оптимум — 7 000–8 000 шагов. Но важна регулярность, а не точная цифра.',
        links: [
          { label: '📍 Трекер Strava', url: 'https://www.strava.com' },
          { label: '❤️ Google Fit', url: 'https://www.google.com/fit' },
        ]},
      { title: 'Ходьба для мозга',
        body: 'Прогулка на свежем воздухе повышает креативность на 60% (Stanford). Лучшее время для аудиокниг.',
        links: [
          { label: '🎧 Storytel — аудиокниги', url: 'https://www.storytel.com/ru' },
          { label: '📚 Яндекс Книги', url: 'https://books.yandex.ru' },
        ]},
      { title: 'Послеобеденная прогулка',
        body: '15-минутная прогулка после еды снижает уровень сахара в крови на 22%. Замена послеобеденной сонливости.',
        links: [
          { label: '❤️ Яндекс Здоровье', url: 'https://health.yandex.ru' },
          { label: '📍 Трекер Strava', url: 'https://www.strava.com' },
        ]},
    ]
  },
  language: {
    tag: 'tip', label: '🗣 Метод',
    cards: [
      { title: 'Метод Spaced Repetition (SRS)',
        body: 'Повторяй слова через интервалы: 1 день → 3 дня → 1 неделя → 1 месяц. Anki — лучший инструмент. 15 мин/день > 2 ч в выходные.',
        links: [
          { label: '🃏 Скачать Anki', url: 'https://apps.ankiweb.net' },
          { label: '🦜 Duolingo', url: 'https://www.duolingo.com' },
        ]},
      { title: 'Input Hypothesis Крашена',
        body: 'Лучший способ выучить язык — потреблять контент чуть выше твоего уровня. Сериалы, подкасты, книги.',
        links: [
          { label: '🎬 Кинопоиск', url: 'https://www.kinopoisk.ru' },
          { label: '▶ YouTube', url: 'https://www.youtube.com' },
        ]},
      { title: 'Говори с первого дня',
        body: 'Нет «пока не готов». HelloTalk, Tandem, iTalki — найди носителя. Разговор × 30 мин > грамматика × 3 часа.',
        links: [
          { label: '💬 HelloTalk', url: 'https://www.hellotalk.com' },
          { label: '👨‍🏫 italki — репетиторы', url: 'https://www.italki.com' },
        ]},
    ]
  }
,
  cold_shower: {
    tag: 'tip', label: '🚿 Метод',
    cards: [
      { title: 'Протокол Уима Хофа',
        body: '30 глубоких вдохов → задержи дыхание → холодный душ 1–3 мин. Снижает кортизол, повышает иммунитет. Начни с 30 секунд, добавляй по 10 сек каждую неделю.',
        links: [
          { label: '▶ Метод Хофа', url: 'https://www.youtube.com/watch?v=tybOi4hjZFQ' },
          { label: '📖 Wimhofmethod.com', url: 'https://www.wimhofmethod.com' },
        ]},
      { title: 'Постепенная адаптация',
        body: 'Неделя 1: заканчивай тёплый душ 30 сек холодным. Неделя 2: 1 мин. Неделя 3+: полностью холодный. Резкий переход → стресс. Плавный → адаптация.',
        links: [
          { label: '🔬 Huberman Lab', url: 'https://www.youtube.com/watch?v=nV2wn3eTI90' },
        ]},
      { title: 'Польза для продуктивности',
        body: 'Холодная вода повышает норадреналин на 200–300%. Дофаминовый всплеск держится до 3 часов. Лучшее время — утром, до кофе. Можно заменить 2-ю чашку кофе.',
        links: [
          { label: '🧠 Andrew Huberman', url: 'https://www.youtube.com/watch?v=nV2wn3eTI90' },
          { label: '🔍 Исследования', url: 'https://www.google.com/search?q=холодный+душ+наука+польза' },
        ]},
    ]
  },
  water: {
    tag: 'tip', label: '💧 Факт',
    cards: [
      { title: 'Сколько воды нужно?',
        body: '30–35 мл на 1 кг веса. При весе 70 кг — 2,1–2,5 л/день. Кофе и чай не считаются. Дефицит воды на 2% = снижение когнитивных функций на 20%.',
        links: [
          { label: '💧 Счётчик воды', url: 'https://www.google.com/search?q=приложение+счётчик+воды' },
        ]},
      { title: 'Техника «стакан с утра»',
        body: 'Сразу после пробуждения — стакан воды (300–400 мл). Запускает метаболизм, выводит токсины после сна, даёт энергию до завтрака. Поставь стакан рядом с кроватью.',
        links: [
          { label: '🔍 Польза воды утром', url: 'https://www.google.com/search?q=стакан+воды+утром+польза' },
        ]},
    ]
  },
  sleep: {
    tag: 'tip', label: '😴 Сон',
    cards: [
      { title: 'Правило 90 минут',
        body: 'Цикл сна = 90 мин. Спи 6, 7.5 или 9 часов — так просыпаешься в конце цикла и чувствуешь себя бодрым. Будильник на 7.5 ч лучше, чем на 8 ч.',
        links: [
          { label: '⏰ Калькулятор сна', url: 'https://sleepyti.me' },
        ]},
      { title: 'Протокол «холодного» отхода ко сну',
        body: 'За 1 час до сна: выключи яркий свет, убери телефон, снизь температуру в комнате до 18–20°C. Мелатонин вырабатывается только в темноте и прохладе.',
        links: [
          { label: '🧠 Huberman Protocol', url: 'https://www.youtube.com/watch?v=nm1TxQj9IsQ' },
        ]},
    ]
  },
  running: {
    tag: 'tip', label: '🏃 Бег',
    cards: [
      { title: 'Зона 2 — основа выносливости',
        body: 'Бег в зоне 2 (можешь говорить предложениями) = 80% тренировок. Развивает митохондрии. 3–4 раза в неделю по 30–45 мин — лучше, чем 1 раз 2 часа.',
        links: [
          { label: '▶ Zone 2 training', url: 'https://www.youtube.com/watch?v=NNOyAVLGPbA' },
          { label: '📱 Strava', url: 'https://www.strava.com' },
        ]},
      { title: 'Прогрессия без травм',
        body: 'Правило 10%: увеличивай недельный километраж не более чем на 10% в неделю. Большинство травм — от резкого увеличения нагрузки, не от бега как такового.',
        links: [
          { label: '🔍 План тренировок', url: 'https://www.google.com/search?q=план+тренировок+бег+для+начинающих' },
        ]},
    ]
  },
  yoga: {
    tag: 'tip', label: '🧘 Практика',
    cards: [
      { title: 'Утренние 10 минут — меняют день',
        body: 'Сурья Намаскар (12 поз) занимает 7–10 мин и охватывает всё тело. Даже 10 мин утренней йоги снижают уровень кортизола и улучшают концентрацию на 4 часа.',
        links: [
          { label: '▶ Surya Namaskar', url: 'https://www.youtube.com/watch?v=qBBnCR3agX8' },
          { label: '📱 Йога с Адриен', url: 'https://www.youtube.com/c/yogawithadriene' },
        ]},
      { title: 'Дыхание важнее поз',
        body: 'Если не можешь сделать позу — делай дыхание. Дыхание 4–7–8 (вдох 4 сек, задержка 7, выдох 8) активирует парасимпатику за 2–3 цикла. Работает мгновенно.',
        links: [
          { label: '🔍 Техника 4-7-8', url: 'https://www.google.com/search?q=техника+дыхания+4-7-8' },
        ]},
    ]
  },
  journal: {
    tag: 'tip', label: '✍️ Метод',
    cards: [
      { title: '3 вопроса на день',
        body: 'Утром: 1) За что я благодарен? 2) Что сделает день отличным? 3) Моя аффирмация. Вечером: 1) Что хорошего произошло? 2) Что можно улучшить? 5 минут, меняет мышление.',
        links: [
          { label: '📓 Five Minute Journal', url: 'https://www.google.com/search?q=пятиминутный+дневник+метод' },
        ]},
      { title: 'Дневник и финансы',
        body: 'Запись финансовых мыслей снижает импульсивные покупки. Попробуй «правило 24 часов»: запиши желаемую покупку в дневник и купи только если хочешь через сутки.',
        links: [
          { label: '🔍 Финансовый дневник', url: 'https://www.google.com/search?q=финансовый+дневник+ведение' },
        ]},
    ]
  },
  health_habit: {
    tag: 'tip', label: '💊 Здоровье',
    cards: [
      { title: 'Стабильность > интенсивность',
        body: 'Любая полезная привычка работает через накопление. 1% улучшений в день = 37x за год. Главное — не пропускать 2 дня подряд. Пропустил один — не катастрофа.',
        links: [
          { label: '📖 Атомные привычки', url: 'https://www.litres.ru/search/?q=атомные+привычки' },
        ]},
    ]
  }
};

// Категория-ключевые слова
function detectHabitType(name, category) {
  const n = name.toLowerCase();
  if (/завтрак|breakfast|еда утром/.test(n)) return 'breakfast';
  if (/холодн.*душ|душ.*холодн|cold.*shower|shower.*cold/.test(n)) return 'cold_shower';
  if (/душ|shower/.test(n)) return 'cold_shower';
  if (/вод[уаы]|попить|выпив|water|hydrat/.test(n)) return 'water';
  if (/сон|засып|лечь спать|sleep/.test(n)) return 'sleep';
  if (/йога|yoga|растяжк|stretch/.test(n)) return 'yoga';
  if (/дыхани|breathing|pranayama|медитац|meditation|mindful/.test(n)) return 'meditation';
  if (/книг|чтени|read/.test(n)) return 'reading';
  if (/подкаст|podcast/.test(n)) return 'podcast';
  if (/бег|пробежк|run|jogging/.test(n)) return 'running';
  if (/зал|трениров|силов|качалк|gym|workout|fitness|жим|присед/.test(n)) return 'exercise';
  if (/спорт|физкульт|exercise/.test(n)) return 'exercise';
  if (/накопл|сбереж|откладыв|saving/.test(n)) return 'savings';
  if (/прогулк|walk|шаги|steps/.test(n)) return 'walk';
  if (/язык|english|spanish|german|french|learning|учу/.test(n)) return 'language';
  if (/дневник|journa|запис/.test(n)) return 'journal';
  if (/витамин|supplement|таблетк/.test(n)) return 'health_habit';
  if (category === 'finance') return 'savings';
  // Don't blindly map health→exercise — let AI handle unknown health habits
  return null;
}

// Курсы академии подходящие к типу привычки
const HABIT_ACADEMY_MAP = {
  reading:     ['c2','c3','c6'],
  savings:     ['c1','c2','c3'],
  podcast:     ['c5','c6'],
  exercise:    ['c5'],
  running:     ['c5'],
  yoga:        ['c5'],
  meditation:  ['c5'],
  cold_shower: ['c5'],
  water:       [],
  sleep:       ['c5'],
  language:    ['c6'],
  journal:     ['c5','c6'],
  breakfast:   [],
  walk:        [],
  health_habit:[],
};

async function openHabitTips(habitId) {
  const h = DB.habits.find(x => x.id === habitId);
  if (!h) return;

  const el = document.getElementById('habit-tips-content');
  const catColors = {health:'rgba(45,232,176,.1)',mind:'rgba(77,166,255,.1)',discipline:'rgba(245,200,66,.1)',finance:'rgba(45,232,176,.1)',social:'rgba(167,139,250,.1)',custom:'rgba(107,114,128,.1)'};
  const bg = catColors[h.category] || 'rgba(77,166,255,.1)';

  el.innerHTML = `
    <div class="tips-header">
      <div class="tips-hab-ico" style="background:${bg}">${h.emoji}</div>
      <div>
        <div style="font-family:var(--font-head);font-size:1rem;font-weight:800">${h.name}</div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:2px">Персональные рекомендации</div>
      </div>
    </div>
    <div class="tips-loader"><span class="spinner"></span> Подбираю рекомендации...</div>`;

  openSheet('habit-tips');

  // Определяем тип
  const type = detectHabitType(h.name, h.category);
  const staticData = type ? HABIT_TIPS_STATIC[type] : null;

  // Проверяем кеш
  const cacheKey = `${h.id}_${h.name}`;
  let aiTips = _tipsCache[cacheKey];

  if (!aiTips) {
    // AI генерирует контекстные советы
    try {
      const stats = calcStats();
      const streak = getHabitStreak(h);
      const prompt = `Ты наставник в приложении Nobile — экосистеме личного развития с уклоном на финансовую грамотность.

Пользователь имеет привычку: "${h.name}" (категория: ${h.category}, стрик: ${streak} дней)
Его финансовые данные: доход ${stats.income} ₽/мес, норма сбережений ${stats.savingsRate}%.

Дай 3 конкретных персонализированных совета для ЭТОЙ привычки. 
Советы должны быть практичными, с конкретными числами/именами/примерами.
Если уместно — свяжи привычку с финансовым ростом или личным развитием.

Ответь ТОЛЬКО JSON массивом (без markdown):
[
  {"title": "Заголовок совета", "body": "2-3 предложения конкретного совета с примерами"},
  {"title": "...", "body": "..."},
  {"title": "...", "body": "..."}
]`;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: getAIHeaders(),
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await res.json();
      const raw = data.content?.[0]?.text || '[]';
      aiTips = JSON.parse(raw.replace(/```json|```/g, '').trim());
      _tipsCache[cacheKey] = aiTips;
    } catch(e) {
      aiTips = null;
    }
  }

  // Связанные курсы академии
  const relatedCourseIds = HABIT_ACADEMY_MAP[type] || [];
  const acSt = getAcademyState();
  const relatedCourses = relatedCourseIds
    .map(id => COURSES.find(c => c.id === id))
    .filter(c => c && !acSt.completedCourses.includes(c.id))
    .slice(0, 2);

  // Рендерим итог
  let html = `
    <div class="tips-header">
      <div class="tips-hab-ico" style="background:${bg}">${h.emoji}</div>
      <div>
        <div style="font-family:var(--font-head);font-size:1rem;font-weight:800">${h.name}</div>
        <div style="font-size:.7rem;color:var(--muted);margin-top:2px">Персональные рекомендации</div>
      </div>
    </div>`;

  // Статичный контент (рецепты/книги/подкасты)
  if (staticData) {
    const TAG_LABELS = { recipe:'🥗 Рецепт', book:'📚 Книга', podcast:'🎙 Подкаст', tip:'💡 Совет' };
    html += `<div class="tips-section">
      <div class="tips-section-title">${TAG_LABELS[staticData.tag] || '💡 Советы'}</div>`;
    html += staticData.cards.map(card => {
      const linkRow = card.links && card.links.length ? `
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
          ${card.links.map((lnk, i) => `
            <a href="${lnk.url}" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:5px;${i===0?'background:rgba(77,166,255,.12);border:1px solid rgba(77,166,255,.25);color:var(--blue);':'background:var(--s2);border:1px solid var(--line);color:var(--muted);'}font-size:.7rem;font-weight:700;padding:6px 12px;border-radius:20px;text-decoration:none;white-space:nowrap">${lnk.label}</a>`).join('')}
        </div>` : '';
      const actionRow = card.action ? `
        <button class="tip-action-btn" onclick="tryMicroAction('${card.action.type}')">
          <span>${card.action.label.split(' ')[0]}</span> ${card.action.label.split(' ').slice(1).join(' ')}
        </button>` : '';
      return `<div class="tip-card">
        <div class="tip-tag tag-${staticData.tag}">${TAG_LABELS[staticData.tag]}</div>
        <div class="tip-card-title">${card.title}</div>
        <div class="tip-card-body">${card.body}</div>
        ${linkRow}
        ${actionRow}
      </div>`;
    }).join('');
    html += `</div>`;
  }

  // AI советы
  if (aiTips && aiTips.length > 0) {
    html += `<div class="tips-section">
      <div class="tips-section-title">✨ Персональный совет</div>`;
    html += aiTips.map(tip => `
      <div class="tip-card">
        <div class="tip-tag tag-tip">💡 Для тебя</div>
        <div class="tip-card-title">${tip.title}</div>
        <div class="tip-card-body">${tip.body}</div>
      </div>`).join('');
    html += `</div>`;
  }

  // Академия
  if (relatedCourses.length > 0) {
    html += `<div class="tips-section">
      <div class="tips-section-title">🎓 Прокачай в Академии</div>`;
    html += relatedCourses.map(course => `
      <div class="tips-to-academy" onclick="closeSheet('habit-tips');navTo('academy');setTimeout(()=>openLesson('${course.id}'),300)">
        <div style="width:40px;height:40px;border-radius:12px;background:${course.color};display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">${course.icon}</div>
        <div style="flex:1">
          <div style="font-size:.82rem;font-weight:700">${course.title}</div>
          <div style="font-size:.68rem;color:var(--muted);margin-top:2px">${course.time} · +${course.xp} XP</div>
        </div>
        <div style="color:var(--gold);font-size:1rem">▶</div>
      </div>`).join('');
    html += `</div>`;
  }

  // Кнопка отметить привычку
  const todayKey = todayISO();
  const isDone = h.completions?.[todayKey];
  if (!isDone) {
    html += `<button class="btn-primary mt12" onclick="toggleHabit(${h.id},'${todayKey}');closeSheet('habit-tips');renderAll();showToast('✅ ${h.name} — выполнено!')">✓ Отметить выполненной</button>`;
  } else {
    html += `<div style="text-align:center;padding:12px;background:rgba(45,232,176,.07);border:1px solid rgba(45,232,176,.18);border-radius:14px;font-size:.82rem;color:var(--mint);font-weight:700">✅ Уже выполнено сегодня — отличная работа!</div>`;
  }

  el.innerHTML = html;
}
