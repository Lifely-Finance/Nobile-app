/* Auto-split from original js/app.js. Global scripts only: no imports/exports. */

/* ═══════════════════════════════════════
   RENDER FUNCTIONS
═══════════════════════════════════════ */
function renderFocusCard() {
  const el = document.getElementById('home-focus-card');
  if (!el) return;
  const level = DB.user.socialLevel || '';
  const goal  = DB.user.goalType   || 'save';
  if (!level) { el.innerHTML = ''; return; } // no card until onboarding done

  const FOCUS = {
    starter_control: { icon:'📝', title:'Фокус: понять куда уходят деньги', color:'var(--blue)',
      text:'Пока не знаешь куда уходит — невозможно изменить. Начни с записи каждой траты.' },
    starter_save:    { icon:'🏦', title:'Фокус: первая финансовая подушка', color:'var(--mint)',
      text:'Цель — накопить 3 месяца расходов. Начни с любой суммы — даже 500 ₽ в неделю.' },
    starter_habits:  { icon:'⚡', title:'Фокус: выработать систему', color:'var(--gold)',
      text:'5 минут утром на финансовый ревью — это всё что нужно для старта.' },
    stable_save:     { icon:'🛡️', title:'Фокус: создать подушку безопасности', color:'var(--mint)',
      text:'Автоматически откладывай 20% с каждой зарплаты — и через год будет солидный резерв.' },
    stable_invest:   { icon:'📈', title:'Фокус: первые инвестиции', color:'var(--blue)',
      text:'Сначала подушка на 3 месяца, потом ИИС и ETF. Не наоборот.' },
    stable_habits:   { icon:'📊', title:'Фокус: финансовая дисциплина', color:'var(--gold)',
      text:'Еженедельный обзор расходов — главная привычка людей с деньгами.' },
    stable_control:  { icon:'💡', title:'Фокус: взять расходы под контроль', color:'var(--coral)',
      text:'Найди 3 категории трат где можно сократить на 20% — это изменит всё.' },
    cushion_invest:  { icon:'📈', title:'Фокус: запустить деньги в работу', color:'var(--blue)',
      text:'У тебя есть подушка — значит можно инвестировать. Старт: ИИС + ETF на индекс МосБиржи.' },
    cushion_save:    { icon:'🚀', title:'Фокус: ускорить накопления', color:'var(--mint)',
      text:'Подушка есть. Теперь увеличь норму сбережений до 30% и поставь конкретную цель.' },
    cushion_100k:    { icon:'🎯', title:'Фокус: путь к $100k', color:'var(--gold)',
      text:'До $100k — это марафон. Ключ: регулярное инвестирование + сложный процент.' },
    capital_invest:  { icon:'💼', title:'Фокус: оптимизация портфеля', color:'var(--blue)',
      text:'Диверсификация и ребалансировка раз в квартал — основа грамотного управления.' },
    capital_100k:    { icon:'🏆', title:'Фокус: $100k на горизонте', color:'var(--gold)',
      text:'При правильном распределении активов цель реальна за 2-4 года.' },
  };

  const key  = level + '_' + goal;
  const data = FOCUS[key] || FOCUS['starter_save'];
  const stats = calcStats();
  const totalAssets = (DB.assets||[]).reduce((s,a)=>s+a.amount,0);

  // Only show if has any data or not a fresh user
  el.innerHTML = `
    <div style="background:var(--s2);border:1px solid var(--line);border-radius:18px;padding:14px 16px;margin-bottom:12px;position:relative;overflow:hidden">
      <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${data.color};opacity:.6;border-radius:18px 18px 0 0"></div>
      <div style="display:flex;align-items:flex-start;gap:10px">
        <div style="font-size:1.6rem;flex-shrink:0;margin-top:1px">${data.icon}</div>
        <div>
          <div style="font-family:var(--font-head);font-size:.82rem;font-weight:800;margin-bottom:4px;color:${data.color}">${data.title}</div>
          <div style="font-size:.76rem;color:var(--muted);line-height:1.5">${data.text}</div>
        </div>
      </div>
    </div>`;
}

/* ═══════════════════════════════════════
   FINANCIAL STRESS INDEX (Today)
═══════════════════════════════════════ */
function _monthKeyForDate(d) { return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0'); }

function _calcIncomeSeries(monthsBack=4) {
  const now = new Date();
  const series = [];
  for (let i=monthsBack-1; i>=0; i--) {
    const dt = new Date(now.getFullYear(), now.getMonth()-i, 1);
    const y = dt.getFullYear();
    const m = dt.getMonth();
    const income = (DB.transactions||[]).filter(t=>{
      if (t.type!=='income') return false;
      const d = new Date(t.date);
      return d.getFullYear()===y && d.getMonth()===m;
    }).reduce((s,t)=>s+(+t.amount||0),0);
    series.push({ key:_monthKeyForDate(dt), year:y, month:m, income });
  }
  return series;
}

function calcFinancialStress() {
  const today = new Date();
  const stats = calcStats();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth()+1, 0).getDate();
  const dayOfMonth  = today.getDate();

  const fmtMoney = (n) => (Math.round(n)||0).toLocaleString('ru');

  // 1) Spend ratio
  const spendRatio = stats.income > 0 ? (stats.expense / stats.income) : (stats.expense>0 ? 1.2 : 0);
  const spendScore = Math.max(0, Math.min(100,
    spendRatio < 0.55 ? 10 : spendRatio < 0.75 ? 28 : spendRatio < 0.95 ? 55 : spendRatio < 1.10 ? 75 : 92
  ));

  // 2) Income volatility (4 months)
  const series = _calcIncomeSeries(4);
  const vals = series.map(x=>x.income).filter(v=>v>0);
  let vol = 0;
  if (vals.length >= 2) {
    const mean = vals.reduce((a,b)=>a+b,0)/vals.length;
    const varr = vals.reduce((a,v)=>a+(v-mean)*(v-mean),0)/vals.length;
    const sd = Math.sqrt(varr);
    vol = mean>0 ? sd/mean : 0;
  }
  const volScore = Math.max(0, Math.min(100,
    vol < 0.08 ? 10 : vol < 0.18 ? 28 : vol < 0.28 ? 50 : vol < 0.40 ? 72 : 90
  ));

  // 3) Debts: classify recurring payments into bad/good (heuristics)
  const rec = (DB.recurringPayments||[]);
  const isDebtLike = (r) => {
    const n = (r.name||'').toLowerCase();
    const c = (r.category||'').toLowerCase();
    return /кредит|займ|долг|ипотек|карта|микро|рассроч/.test(n)
      || /debt|loan|credit|mortgage/.test(n)
      || c === 'debt' || /debt|loan|credit/.test(c);
  };
  const debtClass = (r) => {
    if (r && (r.debtType==='good' || r.debtType==='bad')) return r.debtType;
    const n = (r.name||'').toLowerCase();
    // good debt: asset/income
    if (/ипотек|образован|обуч|курс|бизнес|инвест|студ/.test(n)) return 'good';
    // bad debt: expensive/consumer
    if (/карта|кредитк|микро|payday|рассроч|потреб|гаджет|телевизор|айфон/.test(n)) return 'bad';
    return 'bad';
  };

  const debtRows = rec.filter(isDebtLike);
  const debtMonthlyBad  = debtRows.filter(r=>debtClass(r)==='bad').reduce((a,r)=>a+(+r.amount||0),0);
  const debtMonthlyGood = debtRows.filter(r=>debtClass(r)==='good').reduce((a,r)=>a+(+r.amount||0),0);
  const debtMonthlyAll  = debtMonthlyBad + debtMonthlyGood;

  const debtRatioBad = stats.income > 0 ? (debtMonthlyBad / stats.income) : (debtMonthlyBad>0 ? 1 : 0);
  const debtRatioAll = stats.income > 0 ? (debtMonthlyAll / stats.income) : (debtMonthlyAll>0 ? 1 : 0);

  let debtScore = 10;
  if (debtRatioBad > 0) {
    debtScore = debtRatioBad < 0.12 ? 25
      : debtRatioBad < 0.22 ? 45
      : debtRatioBad < 0.35 ? 70
      : debtRatioBad < 0.50 ? 85
      : 97;
  }
  if (debtRatioAll > 0.40) debtScore = Math.min(100, debtScore + 10);

  // 4) Cushion/runway + EOM forecast
  const totalSavings = (DB.savings||[]).reduce((a,e)=>a+(+e.amount||0),0);
  const totalAssets  = (DB.assets||[]).reduce((a,x)=>a+(+x.amount||0),0);
  const cushion = totalSavings + totalAssets;
  const monthlyExpenseAvg = stats.expense > 0 ? stats.expense : 0;
  const cushionMonths = monthlyExpenseAvg>0 ? (cushion / monthlyExpenseAvg) : (cushion>0 ? 99 : 0);

  const dailyExpense = dayOfMonth>0 ? (stats.expense / dayOfMonth) : 0;
  const projectedExpenseEOM = dailyExpense * daysInMonth;
  const projectedBalance = stats.income - projectedExpenseEOM - stats.savedAmount;

  let runwayScore = 0;
  if (monthlyExpenseAvg<=0 && stats.income<=0) runwayScore = 35;
  else runwayScore = (cushionMonths >= 6) ? 10 : (cushionMonths >= 3) ? 22 : (cushionMonths >= 1.5) ? 55 : (cushionMonths >= 0.75) ? 78 : 92;
  if (projectedBalance < 0) runwayScore = Math.min(100, runwayScore + 14);

  // 5) Daily cashflow + days-to-zero
  const netToDate = (stats.income - stats.expense - stats.savedAmount);
  const netDaily = dayOfMonth>0 ? (netToDate / dayOfMonth) : 0;
  const currentBalance = (typeof stats.balance==='number') ? stats.balance : netToDate;

  let daysToZero = null;
  if (netDaily < 0) {
    if (currentBalance <= 0) daysToZero = 0;
    else daysToZero = Math.max(0, Math.floor(currentBalance / (-netDaily)));
  }

  let cashflowScore = 10;
  if (netDaily < 0) {
    if (daysToZero !== null && daysToZero <= 7) cashflowScore = 98;
    else if (daysToZero !== null && daysToZero <= 14) cashflowScore = 90;
    else if (daysToZero !== null && daysToZero <= 30) cashflowScore = 72;
    else cashflowScore = 55;
  }

  // Total score (rebalanced)
  const score = Math.round(
    0.25*spendScore +
    0.15*volScore +
    0.25*debtScore +
    0.20*runwayScore +
    0.15*cashflowScore
  );
  const level = score < 35 ? 'low' : score < 70 ? 'med' : 'high';

  // Factors (ranked)
  const factors = [
    { key:'spend', label:'Траты', text: stats.income>0 ? `${Math.round(spendRatio*100)}% от дохода` : 'нет данных', score: spendScore },
    { key:'cashflow', label:'Дневной кешфлоу', text: `${netDaily>=0?'+':''}${fmtMoney(netDaily)} ₽/день${daysToZero!==null?` · ~${daysToZero} дн. до нуля`:''}`, score: cashflowScore },
    { key:'debt', label:'Плохие долги', text: stats.income>0 ? `${Math.round(debtRatioBad*100)}% от дохода · ${fmtMoney(debtMonthlyBad)} ₽/мес` : (debtMonthlyBad>0?`${fmtMoney(debtMonthlyBad)} ₽/мес`:'нет'), score: debtScore },
    { key:'runway', label:'Подушка', text: monthlyExpenseAvg>0 ? `${Math.round(cushionMonths*10)/10} мес. расходов` : (cushion>0?`${fmtMoney(cushion)} ₽`:'нет данных'), score: runwayScore },
    { key:'vol', label:'Стабильность дохода', text: vals.length>=2 ? `волатильность ~${Math.round(vol*100)}%` : 'нужно 2+ месяца данных', score: volScore },
  ].sort((a,b)=>b.score-a.score);

  // Recommendations (short, actionable)
  const recs = [];

  if (daysToZero !== null && daysToZero <= 14) {
    const targetDailyExpense = (stats.income - stats.savedAmount) / Math.max(1, daysInMonth);
    const delta = Math.max(0, dailyExpense - targetDailyExpense);
    if (delta > 0) recs.push(`Сократи средние траты на ~${fmtMoney(delta)} ₽/день (это вернёт баланс в безопасную зону до конца месяца).`);
    else recs.push('Похоже, проблема в разовых платежах/долгах — проверь ближайшие платежи и обязательства.');
  }

  if (cushionMonths < 1.5) {
    const need = Math.max(0, monthlyExpenseAvg*3 - cushion);
    if (need > 0) recs.push(`Подушка < 3 мес. Попробуй довести её до минимума: ещё ~${fmtMoney(need)} ₽.`);
  }

  if (debtMonthlyBad > 0) {
    recs.push(`Выдели «плохие долги»: ${fmtMoney(debtMonthlyBad)} ₽/мес. Сначала снижай дорогие долги/кредитки, а «хорошие» оставь как есть.`);
  }

  if (spendRatio > 0.95) recs.push('Траты почти равны доходу — поставь лимиты по категориям на 7 дней и проверь «подписки/еда/такси».');
  if (vol > 0.28) recs.push('Доход нестабилен — заложи буфер и планируй обязательные платежи от минимального дохода за 4 месяца.');

  return {
    score, level, factors,
    projectedBalance,
    netDaily,
    daysToZero,
    debtMonthlyBad,
    debtMonthlyGood,
    recommendations: recs.slice(0,4)
  };
}

function openStressAIPlan() {
  const d = calcFinancialStress();
  const levelTxt = d.level==='low' ? 'НИЗКИЙ' : d.level==='med' ? 'СРЕДНИЙ' : 'ВЫСОКИЙ';
  const top = (d.factors||[]).slice(0,4).map(f=>`- ${f.label}: ${f.text}`).join('\n');
  const recs = (d.recommendations||[]).map(x=>`- ${x}`).join('\n');

  const prompt = `Сделай короткий, практичный план на 7 дней по снижению финансового стресса.

`+
`Индекс: ${d.score}/100 (${levelTxt}).
`+
`Дневной кешфлоу: ${d.netDaily>=0?'+':''}${Math.round(d.netDaily).toLocaleString('ru')} ₽/день.
`+
`${d.daysToZero!==null ? `Дней до нуля: ~${d.daysToZero}.
` : ''}`+
`Факторы:
${top}

`+
`${recs ? `Мои рекомендации (встроенные):
${recs}

` : ''}`+
`Дай: 1) 3 быстрых действия сегодня, 2) план на неделю, 3) что автоматизировать в приложении (трекинг/лимиты/платежи/долги). Язык: русский. Формат: списки.`;

  navTo('today');
  const aiCard = document.getElementById('ai-assistant-card');
  if (aiCard) aiCard.scrollIntoView({behavior:'smooth', block:'center'});
  setTimeout(() => {
    if (!_aiChatOpen) toggleAIChat();
    setTimeout(() => sendQuickPrompt(prompt), 200);
  }, 400);
}

function renderStressIndex() {
  const el = document.getElementById('stress-index-block');
  if (!el) return;

  const d = calcFinancialStress();
  const levelTxt = d.level==='low' ? 'НИЗКИЙ' : d.level==='med' ? 'СРЕДНИЙ' : 'ВЫСОКИЙ';
  const pillClass = d.level==='low' ? 'low' : d.level==='med' ? 'med' : 'high';

  const f = d.factors || [];
  const c1 = f[0] ? `${f[0].label}: ${f[0].text}` : '—';
  const c2 = f[1] ? `${f[1].label}: ${f[1].text}` : '—';

  const netDailyTxt = `${d.netDaily>=0?'+':''}${Math.round(d.netDaily).toLocaleString('ru')} ₽/день`;
  const daysTxt = (d.daysToZero===null) ? '—' : `~${d.daysToZero} дн.`;

  const hint = d.level==='high'
    ? `<div class="stress-hint"><b style="color:var(--coral)">Высокий стресс.</b> Ниже — причины и быстрые шаги.</div>`
    : d.level==='med'
      ? `<div class="stress-hint">Есть зоны риска. Стабилизируй 1–2 фактора — индекс быстро упадёт.</div>`
      : `<div class="stress-hint">Ситуация стабильная. Следи за динамикой и не давай тратам расти.</div>`;

  const recs = (d.recommendations||[]).slice(0,3);
  const recHtml = recs.length
    ? `<div class="stress-recs">
        <div class="stress-recs-h">Персональные рекомендации</div>
        ${recs.map(x=>`<div class="stress-rec"><div class="dot"></div><div class="t">${x}</div></div>`).join('')}
      </div>`
    : '';

  // Compact: keep only essentials visible, details are expandable.
  const primaryCtaLabel = d.level==='high' ? 'План действий' : 'Что улучшить?';

  const detailActions = [
    `<button class="stress-btn primary" onclick="openStressAIPlan()">Спросить Nobile AI</button>`,
    `<button class="stress-btn" onclick="navTo('growth')">Расходы</button>`,
    `<button class="stress-btn" onclick="navTo('capital')">Платежи</button>`,
  ].filter(Boolean).join('');

  el.innerHTML = `
    <div class="stress-card stress-compact">
      <div class="stress-top">
        <div>
          <div class="stress-title">Индекс финансового стресса</div>
          <div class="stress-sub stress-sub-compact">Насколько спокойно «дышит» бюджет сейчас (0 — ок, 100 — тяжело)</div>
        </div>
        <div class="stress-pill ${pillClass}">${levelTxt}</div>
      </div>

      <div class="stress-meter">
        <div class="stress-bar"><div id="stress-bar-fill"></div></div>
        <div class="stress-meta"><span>0</span><span class="stress-score">${d.score}/100</span><span>100</span></div>
      </div>

      <div class="stress-summary">
        <div class="stress-summary-left">
          <div class="stress-summary-k">Главное сейчас</div>
          <div class="stress-summary-v">${c1}</div>
        </div>
        <button class="stress-btn primary" onclick="openStressAIPlan()">${primaryCtaLabel}</button>
      </div>

      <details class="stress-details">
        <summary>Подробнее</summary>
        <div class="stress-sub" style="margin-top:8px">ИИ учитывает: траты · колебания дохода · долги (плохие/хорошие) · подушку · дневной кешфлоу</div>

        <div class="stress-grid" style="margin-top:10px">
          <div class="stress-chip"><div class="k">Ключевой фактор</div><div class="v">${c1}</div></div>
          <div class="stress-chip"><div class="k">Второй фактор</div><div class="v">${c2}</div></div>
          <div class="stress-chip"><div class="k">Дневной кешфлоу</div><div class="v" style="color:${d.netDaily>=0?'var(--mint)':'var(--coral)'}">${netDailyTxt}</div></div>
          <div class="stress-chip"><div class="k">Дней до нуля</div><div class="v">${daysTxt}</div></div>
        </div>

        ${hint}
        ${recHtml}

        <div class="stress-actions">${detailActions}</div>
      </details>
    </div>`;

  const bar = document.getElementById('stress-bar-fill');
  if (bar) bar.style.width = Math.max(4, Math.min(100, d.score)) + '%';

  // Apply glow effect to header and body based on stress level
  const hdr = document.querySelector('.hdr');
  const body = document.body;

  // Remove existing glow classes
  if (hdr) {
    hdr.classList.remove('hdr-stress-glow-low', 'hdr-stress-glow-med', 'hdr-stress-glow-high');
    hdr.classList.add('hdr-stress-glow-' + d.level);
  }
  if (body) {
    body.classList.remove('stress-glow-low', 'stress-glow-med', 'stress-glow-high');
    body.classList.add('stress-glow-' + d.level);
  }
}

/* ═══════════════════════════════════════
   BEZIER CHART TOOLTIP FUNCTIONS
═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   PREDICTIVE RISKS — show as avatar dialog
═══════════════════════════════════════ */
let _lastRisks = [];
let _lastRiskTexts = null;
let _riskAutoShown = false;

function openRiskDialogFromBadge(e) {
  try { e.stopPropagation(); e.preventDefault(); } catch {}
  openRiskDialog();
}

function updateRiskBadge(count) {
  const b = document.getElementById('hdr-risk-badge');
  if (!b) return;
  if (!count || count<=0) { b.style.display='none'; return; }
  b.style.display='flex';
  b.textContent = count>9 ? '9+' : '!';
}

function renderRiskDialogContent(risks, aiTexts) {
  const list = document.getElementById('risk-dialog-list');
  if (!list) return;
  if (!risks || risks.length===0) {
    list.innerHTML = `<div style="padding:14px 10px;color:var(--muted);font-size:.78rem;line-height:1.45">Сейчас всё спокойно. Когда появятся риски — они будут здесь.</div>`;
    return;
  }

  const ACTION_MAP = {
    balance_negative:     { label: 'Снизить расходы', fn: "navTo('capital')" },
    cushion_low:          { label: '+ В накопления',  fn: "openSheet('savings')" },
    recurring_tight:      { label: 'Мои платежи',     fn: "navTo('capital')" },
    income_drop:          { label: '+ Доход',         fn: "openSheet('tx','income')" },
    savings_rate_low:     { label: 'Откладывать',     fn: "openSheet('savings')" },
    debt_ratio_high:      { label: 'Обзор платежей',  fn: "navTo('capital')" },
    expense_trend_up:     { label: 'Анализ расходов', fn: "navTo('growth')" },
    income_single_source: { label: 'Рост доходов',    fn: "navTo('growth')" },
  };

  list.innerHTML = risks.map((r, i) => {
    const aiText = aiTexts && aiTexts[i] ? aiTexts[i] : null;
    const action = ACTION_MAP[r.id]
      || (r.id.startsWith('budget_overrun_') ? {label:'Открыть бюджет', fn:"navTo('growth')"}
      : r.id.startsWith('goal_slow_') ? {label:'К целям', fn:"navTo('today')"}
      : null);

    return `
      <div class="riskdlg-item ${r.severity}" id="rdlg-${r.id}">
        <div class="riskdlg-row">
          <div class="riskdlg-ico">${r.ico}</div>
          <div style="flex:1;min-width:0">
            <div class="riskdlg-h">${r.headline}</div>
            <div class="riskdlg-t" id="rdlg-text-${r.id}">${aiText ? aiText : '⏳ Nobile AI анализирует...'}</div>
            <div class="riskdlg-actions">
              ${action ? `<div class="riskdlg-chip" onclick="${action.fn};closeRiskDialog()">${action.label}</div>` : ''}
              <div class="riskdlg-chip" onclick="openRiskChat('${r.id}');closeRiskDialog()">💬 Что делать?</div>
            </div>
          </div>
        </div>
        <div class="riskdlg-x" onclick="dismissRisk('${r.id}')">✕</div>
      </div>`;
  }).join('');
}

function openRiskDialog() {
  const ov = document.getElementById('risk-dialog-overlay');
  if (!ov) return;
  const a  = document.getElementById('hdr-avatar-ico');
  const av = document.getElementById('riskdlg-ava');
  if (a && av) av.textContent = a.textContent || 'НБ';
  renderRiskDialogContent(_lastRisks, _lastRiskTexts);
  ov.style.display = 'flex';
}

function closeRiskDialog() {
  const ov = document.getElementById('risk-dialog-overlay');
  if (ov) ov.style.display = 'none';
}

function riskDialogOverlayClick(e) {
  if (e.target && e.target.id === 'risk-dialog-overlay') closeRiskDialog();
}

function renderAssetTypeOptions(selectedType = null, customValue = null) {
  const select = document.getElementById('asset-type');
  const customInput = document.getElementById('asset-type-custom');
  if (!select) return;

  const currentSelected = selectedType ?? select.value ?? 'savings';
  const currentCustom = typeof customValue === 'string' ? customValue : (customInput?.value || '');
  const knownIds = ASSET_TYPE_PRESETS.map(item => item.id);
  const isKnown = knownIds.includes(currentSelected);

  select.innerHTML = ASSET_TYPE_PRESETS.map(item => `<option value="${item.id}">${item.icon} ${item.label}</option>`).join('');
  select.value = isKnown ? currentSelected : 'custom';

  if (customInput) {
    customInput.value = typeof customValue === 'string'
      ? customValue
      : (!isKnown && currentSelected ? currentSelected : currentCustom);
  }
}

function syncAssetCustomTypeInput() {
  const select = document.getElementById('asset-type');
  const customInput = document.getElementById('asset-type-custom');
  if (!select || !customInput) return;
  if (customInput.value.trim()) select.value = 'custom';
}

function applyPaidPaymentToAsset(paymentEntry, recurring, direction = 1) {
  if (!Array.isArray(DB.assets) || DB.assets.length === 0) return;

  if (direction < 0 && paymentEntry?.assetId) {
    const asset = DB.assets.find(a => a.id === paymentEntry.assetId);
    if (asset) asset.amount = Number(asset.amount || 0) + Number(recurring.amount || 0);
    return;
  }

  const liquidAssets = DB.assets.filter(a => LIQUID_ASSET_TYPE_IDS.includes(getAssetTypeMeta(a.type).id));
  if (liquidAssets.length === 0) return;

  const targetAsset = liquidAssets.find(a => Number(a.amount || 0) >= Number(recurring.amount || 0))
    || [...liquidAssets].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
  if (!targetAsset) return;

  targetAsset.amount = Number(targetAsset.amount || 0) - Number(recurring.amount || 0);
  if (paymentEntry) paymentEntry.assetId = targetAsset.id;
}

function renderAll() {
  try { renderAssetTypeOptions(); } catch(e) {}
  const fns = [renderToday, renderStressIndex, renderFocusCard, renderGrowth, renderCapital, renderHabits, renderTasks, renderInsights, renderAcademy, renderSavings, renderGoals, renderRecurring, renderUpcomingPayments, checkAlerts, renderSimulator];
  if (typeof loadAIAdvice === 'function') try { loadAIAdvice(); } catch(e) {}
  if (typeof loadAIPredictiveRisks === 'function') try { loadAIPredictiveRisks(); } catch(e) {}
  for (const fn of fns) {
    try { fn(); } catch(e) { console.warn('renderAll error in ' + fn.name + ':', e); }
  }
  setTimeout(() => { try { checkNewAchievements(); } catch(e) {} }, 600);
}

function flyCheckToAvatar() {
  const checkEl = document.getElementById('hab-done-check');
  // On desktop btn-profile is hidden — use sidebar avatar instead
  const isDesktop = window.innerWidth >= 1024;
  const avatarEl = isDesktop
    ? (document.getElementById('bnav-avatar') || document.getElementById('hdr-avatar-ico'))
    : document.getElementById('hdr-avatar-ico');
  const wrap = document.getElementById('habits-today-wrap');
  if (!checkEl || !avatarEl || !wrap) return;

  // Calculate flight vector: from checkmark center to avatar center
  const cr = checkEl.getBoundingClientRect();
  const ar = avatarEl.getBoundingClientRect();
  const dx = (ar.left + ar.width/2)  - (cr.left + cr.width/2);
  const dy = (ar.top  + ar.height/2) - (cr.top  + cr.height/2);

  // IMPORTANT: animate a detached fixed clone on top of everything
  // (prevents the checkmark from going under other blocks due to stacking contexts/overflow)
  const floatEl = checkEl.cloneNode(true);
  floatEl.id = 'hab-done-check-float';
  floatEl.classList.add('hab-done-check-float');
  floatEl.style.left = cr.left + 'px';
  floatEl.style.top  = cr.top  + 'px';
  floatEl.style.width  = cr.width + 'px';
  floatEl.style.height = cr.height + 'px';

  // Set CSS vars for animation endpoint
  floatEl.style.setProperty('--fly-x', dx + 'px');
  floatEl.style.setProperty('--fly-y', dy + 'px');

  // Hide original to avoid a double checkmark
  const prevOpacity = checkEl.style.opacity;
  checkEl.style.opacity = '0';

  document.body.appendChild(floatEl);
  // Force reflow so initial fixed position is committed
  floatEl.offsetHeight; // eslint-disable-line

  // Animate checkmark flying to avatar
  floatEl.style.animation = 'flyToAvatar 0.75s cubic-bezier(.4,0,.6,1) forwards';

  // Cleanup after animation
  floatEl.addEventListener('animationend', () => {
    try { floatEl.remove(); } catch(e) {}
    checkEl.style.opacity = prevOpacity;
  }, { once: true });

  // After checkmark lands — pulse the avatar briefly
  setTimeout(() => {
    if (avatarEl) {
      avatarEl.style.transition = 'transform .15s, box-shadow .15s';
      avatarEl.style.transform = 'scale(1.25)';
      avatarEl.style.boxShadow = '0 0 0 4px rgba(45,232,176,.45)';
      setTimeout(() => {
        avatarEl.style.transform = '';
        avatarEl.style.boxShadow = '';
      }, 250);
    }
  }, 700);

  // Collapse the entire habits block smoothly
  setTimeout(() => {
    if (!wrap) return;
    const h = wrap.scrollHeight;
    wrap.style.transition = 'max-height .55s cubic-bezier(.4,0,.2,1), opacity .4s, margin-bottom .55s';
    wrap.style.maxHeight = h + 'px';
    // Force reflow
    wrap.offsetHeight; // eslint-disable-line
    wrap.style.maxHeight = '0px';
    wrap.style.opacity = '0';
    wrap.style.marginBottom = '0px';
  }, 800);
}

function renderToday() {
  const stats = calcStats();
  const today = new Date();
  const days = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  document.getElementById('today-date-sub').textContent = days[today.getDay()] + ', ' + today.getDate() + ' ' + MONTHS_RU[today.getMonth()];
  document.getElementById('today-username').textContent = DB.user.name;
  // Sync sidebar avatar & username
  updateAvatar();
  // (sidebar username synced via updateAvatar)
  // Баланс = доход − расходы − накопления
  const balEl = document.getElementById('today-balance');
  if (balEl) {
    const isPos = stats.balance >= 0;
    balEl.textContent = stats.balance.toLocaleString('ru');
    balEl.style.color = isPos ? 'var(--text)' : 'var(--coral)';
  }
  document.getElementById('today-income').textContent   = stats.income.toLocaleString('ru') + ' ₽';
  // Расходы без накоплений
  document.getElementById('today-expense').textContent  = stats.expense.toLocaleString('ru') + ' ₽';
  const deltaEl = document.getElementById('today-delta');
  if (stats.balance >= 0) {
    deltaEl.textContent = '▲ +' + stats.balance.toLocaleString('ru') + ' ₽ за месяц';
    deltaEl.style.background = 'rgba(45,232,176,.14)';
    deltaEl.style.borderColor = 'rgba(45,232,176,.22)';
    deltaEl.style.color = 'var(--mint)';
  } else {
    deltaEl.textContent = '▼ ' + stats.balance.toLocaleString('ru') + ' ₽ за месяц';
    deltaEl.style.background = 'rgba(255,107,107,.14)';
    deltaEl.style.borderColor = 'rgba(255,107,107,.22)';
    deltaEl.style.color = 'var(--coral)';
  }

  // Habits today
  const todayKey = todayISO();
  const undone = DB.habits.filter(h => !h.completions?.[todayKey]);
  const doneH  = DB.habits.filter(h =>  h.completions?.[todayKey]);
  document.getElementById('habits-today-count').textContent = doneH.length + '/' + DB.habits.length;

  // Always render goals regardless of habit state
  renderTodayGoals();

  const habContainer = document.getElementById('habits-today-list');
  const habCard = habContainer ? habContainer.closest('.card') : null;

  if (!habContainer) return; // safety

  const habWrap = document.getElementById('habits-today-wrap');

  if (DB.habits.length === 0) {
    habContainer.innerHTML = `<div class="empty"><div class="empty-ico">🌱</div><div class="empty-t">Нет привычек</div><div class="empty-s">Добавьте в разделе «Система»</div></div>`;
    if (habWrap) { habWrap.style.maxHeight = '500px'; habWrap.style.opacity = '1'; habWrap.style.marginBottom = ''; }
  } else if (undone.length === 0 && DB.habits.length > 0) {
    // All habits done — show celebration then fly & collapse
    if (habWrap) { habWrap.style.maxHeight = '500px'; habWrap.style.opacity = '1'; habWrap.style.marginBottom = ''; }
    habContainer.innerHTML = `
      <div class="hab-all-done">
        <div class="hab-done-check" id="hab-done-check">✓</div>
        <div class="hab-done-title">Все привычки выполнены!</div>
        <div class="hab-done-sub">Отличная работа сегодня 🎉</div>
      </div>`;
    // Trigger fly animation after short delay (let user see the checkmark)
    if (!window._habAllDoneAnimating) {
      window._habAllDoneAnimating = true;
      setTimeout(() => flyCheckToAvatar(), 1200);
    }
    return; // skip swipe init
  } else {
    window._habAllDoneAnimating = false;
    if (habWrap) { habWrap.style.maxHeight = '500px'; habWrap.style.opacity = '1'; habWrap.style.marginBottom = ''; }
    const allHabitsToday = DB.habits.slice(0, 6);
    habContainer.innerHTML = allHabitsToday.map(h => {
      const isDone = !!h.completions?.[todayKey];
      return `<div class="hab-swipe-wrap" data-hab-id="${h.id}" style="margin-bottom:6px">
        <div class="hab-swipe-inner">
          <div class="hfr-ico" style="background:${isDone?'rgba(45,232,176,.15)':'var(--s2)'};cursor:pointer;flex-shrink:0;transition:background .2s"
               onclick="event.stopPropagation();toggleHabit(${h.id},'${todayKey}')">${h.emoji}</div>
          <div class="hfr-inf" style="flex:1;min-width:0">
            <div class="hfr-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${isDone?'text-decoration:line-through;opacity:.5':''}">${h.name}</div>
            <div class="hfr-meta" style="font-size:.65rem">🔥${getHabitStreak(h)} дн. ${isDone?'· <span style=\"color:var(--mint)\">Выполнено ✓</span>':''}</div>
            ${buildHabitSparkline(h)}
          </div>
          <div class="habit-chk ${isDone?'done':'open'}" style="flex-shrink:0;cursor:pointer"
               onclick="event.stopPropagation();toggleHabit(${h.id},'${todayKey}')">${isDone?'✓':''}</div>
        </div>
        <div class="hab-swipe-actions">
          <button class="hab-sw-tips" onclick="event.stopPropagation();swipeHabit(${h.id});openHabitTips(${h.id})"><span>💡</span><span>Советы</span></button>
          <button class="hab-sw-edit" onclick="event.stopPropagation();swipeHabit(${h.id});openHabitSheet(${h.id})"><span>✏️</span><span>Ред.</span></button>
          <button class="hab-sw-del"  onclick="event.stopPropagation();swipeHabit(${h.id});deleteHabitConfirm(${h.id})"><span>🗑</span><span>Удал.</span></button>
        </div>
      </div>`;
    }).join('') + (DB.habits.length > 6 ? `<div style="font-size:.72rem;color:var(--muted);text-align:center;padding:8px 0">+${DB.habits.length-6} ещё — открой «Система»</div>` : '');
  }

  // Attach swipe gestures to today habits
  setTimeout(initHabSwipe, 0);

  // Recent transactions (last 6) — receipt style
  const recent = [...DB.transactions].sort((a,b)=>b.id-a.id).slice(0,6);
  if (recent.length === 0) {
    document.getElementById('today-tx-list').innerHTML = `<div class="empty"><div class="empty-ico">📋</div><div class="empty-t">Нет операций</div><div class="empty-s">Нажмите кнопку выше для добавления</div></div>`;
  } else {
    const CAT_DOTS  = {salary:'#2DE8B0',freelance:'#F5C842',food:'#FF6B6B',transport:'#4DA6FF',housing:'#4DA6FF',entertainment:'#a78bfa',health:'#2DE8B0',clothes:'#FF6B6B',savings:'#2DE8B0',other:'#6B7280'};
    const CAT_ICONS = {salary:'💼',freelance:'🎨',food:'🛒',transport:'🚗',housing:'🏠',entertainment:'🎬',health:'💊',clothes:'👗',savings:'💰',other:'📦'};
    const totalIn  = recent.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const totalOut = recent.filter(t=>t.type==='expense').reduce((s,t)=>s+t.amount,0);
    const nowT = new Date();
    const timeStr = nowT.getHours()+':'+String(nowT.getMinutes()).padStart(2,'0');
    const rows = recent.map(t => {
      const lbl = t.desc || CAT_ICONS[t.category] || '•';
      const d = new Date(t.date);
      const dateStr = d.getDate()+'/'+(d.getMonth()+1);
      return `<div class="receipt-row">
        <div class="receipt-cat-dot" style="background:${CAT_DOTS[t.category]||'#6B7280'}"></div>
        <div class="receipt-name">${lbl}</div>
        <div class="receipt-date-lbl">${dateStr}</div>
        <div class="receipt-amount" style="color:${t.type==='income'?'var(--mint)':'var(--coral)'}">${t.type==='income'?'+':'−'}${t.amount.toLocaleString('ru')}<span style="font-size:.55rem;opacity:.7"> ₽</span></div>
      </div>`;
    }).join('');
    document.getElementById('today-tx-list').innerHTML = `
      <div class="receipt-wrap">
        <div class="receipt-header">
          <span class="receipt-title">◈ NOBILE · ОПЕРАЦИИ</span>
          <span style="font-size:.56rem;color:var(--muted);font-family:var(--font-head);letter-spacing:.05em">${timeStr}</span>
        </div>
        ${rows}
        <div class="receipt-footer">
          <span style="font-size:.62rem">${totalIn>0?`<span style="color:var(--mint)">+${totalIn.toLocaleString('ru')} ₽</span> `:''}${totalOut>0?`<span style="color:var(--coral)">−${totalOut.toLocaleString('ru')} ₽</span>`:''}</span>
          <span style="font-size:.55rem;color:rgba(255,255,255,.12);letter-spacing:.18em;font-family:var(--font-head)">▌▌▌ ▌▌ ▌▌▌▌</span>
        </div>
      </div>`;
  }

  // Month labels
  const lbl = periodLabel();
  document.getElementById('fab-month-label').textContent = lbl.charAt(0).toUpperCase()+lbl.slice(1);
}

function drawRing(pct, color, size, stroke, textVal, subVal) {
  size = size || 86; stroke = stroke || 7;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.min(Math.max(pct, 0), 100);
  const dash = filled / 100 * circ;
  const fs = size > 90 ? '1rem' : size > 76 ? '.82rem' : '.7rem';
  const animId = 'ring-' + Math.random().toString(36).substr(2, 9);
  return `<div class="ring-wrap" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <filter id="glow-${animId}" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <circle cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="rgba(255,255,255,.06)" stroke-width="${stroke}"/>
      <circle id="${animId}" cx="${size/2}" cy="${size/2}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="0 ${circ.toFixed(1)}" stroke-dashoffset="${(circ/4).toFixed(1)}"
        stroke-linecap="round" filter="url(#glow-${animId})"
        style="transition:stroke-dasharray 1.2s cubic-bezier(.34,1.56,.64,1)"/>
    </svg>
    <div class="ring-inner">
      <div class="ring-val" style="font-size:${fs};color:${color};text-shadow:0 0 10px ${color}66">${textVal}</div>
      ${subVal ? `<div class="ring-sub">${subVal}</div>` : ''}
    </div>
  </div>
  <script>
    (function(){
      setTimeout(function(){
        const c = document.getElementById('${animId}');
        if(c) c.style.strokeDasharray = '${dash.toFixed(1)} ${circ.toFixed(1)}';
      }, 100);
    })();
  <\/script>`;
}

function getLast6Months() {
  const result = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear(), m = d.getMonth();
    const txs = DB.transactions.filter(t => {
      const td = new Date(t.date);
      return td.getFullYear() === y && td.getMonth() === m;
    });
    const income  = txs.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount,0);
    const savings = txs.filter(t=>t.type==='expense'&&t.category==='savings').reduce((s,t)=>s+t.amount,0);
    const expense = txs.filter(t=>t.type==='expense'&&t.category!=='savings').reduce((s,t)=>s+t.amount,0);
    const mn = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][m];
    result.push({ month: mn, income, expense, savings });
  }
  return result;
}

function renderGrowth() {
  const stats = calcStats();
  const totalAssets = DB.assets.reduce((s,a)=>s+a.amount, 0);
  const totalSaved  = DB.savings.reduce((s,e)=>s+e.amount, 0);
  const goal        = DB.user.goal || 7900000;
  const goalPct     = Math.min(100, Math.round((totalAssets+totalSaved)/goal*1000)/10);
  const score       = calcScore(stats);
  const level       = DB.user.socialLevel || '';
  const isNewbie    = level === 'starter';

  document.getElementById('growth-month').textContent = periodLabel();

  // ① Rings
  const ringsEl = document.getElementById('growth-rings');
  if (ringsEl) {
    const srColor  = stats.savingsRate >= 20 ? '#2de8b0' : stats.savingsRate >= 10 ? '#f5c842' : '#ff6b6b';
    const goalColor = goalPct >= 75 ? '#2de8b0' : goalPct >= 30 ? '#f5c842' : '#4da6ff';
    const scoreColor = (score||0) >= 75 ? '#2de8b0' : (score||0) >= 50 ? '#f5c842' : '#4da6ff';
    ringsEl.innerHTML =
      `<div class="ring-cell">${drawRing(stats.savingsRate*5, srColor, 86, 7, stats.savingsRate+'%', 'сбережений')}<div class="ring-label">Норма сбережений</div></div>` +
      `<div class="ring-cell">${drawRing(goalPct, goalColor, 100, 8, goalPct+'%', 'к цели')}<div class="ring-label">Прогресс к цели</div></div>` +
      `<div class="ring-cell">${drawRing(score||0, scoreColor, 86, 7, score !== null ? score : '—', 'баллов')}<div class="ring-label">Финздоровье</div></div>`;
  }

  // ② Budget
  const budget = calcBudget5020(stats.income, stats.expense);
  const budgetEl = document.getElementById('budget-items');
  const budgetTitle = document.getElementById('budget-title');
  if (budgetTitle) {
    budgetTitle.innerHTML = isNewbie
      ? '📊 Как распределяются деньги <span style="font-size:.68rem;color:var(--blue);font-weight:600;cursor:pointer;margin-left:6px" onclick="openCourse(\'c1\')">Что это? →</span>'
      : '📊 Бюджет 50/30/20';
  }
  if (!budget) {
    budgetEl.innerHTML = '<div class="empty"><div class="empty-s">Добавьте транзакции для анализа</div></div>';
  } else {
    const html = renderBudgetItems(budget);
    budgetEl.innerHTML = html + (isNewbie ? '<div style="margin-top:10px;padding:10px 12px;background:rgba(77,166,255,.07);border:1px solid rgba(77,166,255,.15);border-radius:12px;font-size:.73rem;color:var(--muted);line-height:1.5">💡 <b style="color:var(--blue)">Правило 50/30/20</b> — простой способ распределять деньги: 50% на нужное, 30% на желания, 20% в копилку. <span style="color:var(--blue);font-weight:600;cursor:pointer" onclick="openCourse(\'c1\')"> Пройти урок →</span></div>' : '');
  }

  // ③ High-Tech Bezier Chart — last 6 months
  const months = getLast6Months();
  const hasData = months.some(m => m.income > 0 || m.expense > 0);
  const barEl = document.getElementById('growth-barchart');
  if (!hasData) {
    barEl.innerHTML = '<div class="empty"><div class="empty-s">Добавьте транзакции за несколько месяцев</div></div>';
  } else {
    const maxVal = Math.max(...months.map(m => Math.max(m.income, m.expense)), 1);
    const W = 320, H = 100;
    const padding = { top: 10, right: 10, bottom: 20, left: 10 };
    const chartW = W - padding.left - padding.right;
    const chartH = H - padding.top - padding.bottom;

    // Generate points for Bézier curves
    const incomePoints = months.map((m, i) => {
      const x = padding.left + (i / (months.length - 1)) * chartW;
      const y = padding.top + chartH - (m.income / maxVal) * chartH;
      return { x, y, value: m.income, month: m.month };
    });
    const expensePoints = months.map((m, i) => {
      const x = padding.left + (i / (months.length - 1)) * chartW;
      const y = padding.top + chartH - (m.expense / maxVal) * chartH;
      return { x, y, value: m.expense, month: m.month };
    });

    // Generate smooth Bézier path
    function bezierPath(points) {
      if (points.length === 0) return '';
      let d = `M ${points[0].x} ${points[0].y}`;
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i === 0 ? 0 : i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = points[i + 2] || p2;
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
      }
      return d;
    }

    // Area paths (closed)
    const incomeAreaD = bezierPath(incomePoints) + ` L ${incomePoints[incomePoints.length-1].x} ${H} L ${incomePoints[0].x} ${H} Z`;
    const expenseAreaD = bezierPath(expensePoints) + ` L ${expensePoints[expensePoints.length-1].x} ${H} L ${expensePoints[0].x} ${H} Z`;

    // Generate interactive points with click handlers
    const incomeCircles = incomePoints.map((p, i) => {
      const expValue = expensePoints[i]?.value || 0;
      return `<circle class="bezier-point bezier-point-income" cx="${p.x}" cy="${p.y}" r="4" 
       data-month="${p.month}" data-value="${p.value.toLocaleString('ru')}" data-type="income"
       onmouseenter="showBezierTooltip(evt, '${p.month}', ${p.value}, 'income')" 
       onmouseleave="hideBezierTooltip()"
       ontouchstart="showBezierTooltip(evt, '${p.month}', ${p.value}, 'income')"
       onclick="showBezierClickTooltip('${p.month}', ${p.value}, ${expValue})" />`;
    }).join('');
    const expenseCircles = expensePoints.map((p, i) => {
      const incValue = incomePoints[i]?.value || 0;
      return `<circle class="bezier-point bezier-point-expense" cx="${p.x}" cy="${p.y}" r="4" 
       data-month="${p.month}" data-value="${p.value.toLocaleString('ru')}" data-type="expense"
       onmouseenter="showBezierTooltip(evt, '${p.month}', ${p.value}, 'expense')" 
       onmouseleave="hideBezierTooltip()"
       ontouchstart="showBezierTooltip(evt, '${p.month}', ${p.value}, 'expense')"
       onclick="showBezierClickTooltip('${p.month}', ${incValue}, ${p.value})" />`;
    }).join('');

    // Grid lines
    const gridLines = [0.25, 0.5, 0.75].map(pct => 
      `<line class="bezier-grid-line" x1="${padding.left}" y1="${padding.top + chartH * pct}" x2="${W - padding.right}" y2="${padding.top + chartH * pct}" />`
    ).join('');

    // Month labels
    const monthLabels = months.map((m, i) => {
      const x = padding.left + (i / (months.length - 1)) * chartW;
      return `<text class="bezier-axis-text" x="${x}" y="${H - 4}" text-anchor="middle">${m.month}</text>`;
    }).join('');

    barEl.innerHTML = `
      <div class="bezier-chart" id="bezier-chart-container">
        <svg class="bezier-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          <defs>
            <linearGradient id="incomeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#2de8b0"/>
              <stop offset="100%" style="stop-color:#4da6ff"/>
            </linearGradient>
            <linearGradient id="expenseGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" style="stop-color:#ff6b6b"/>
              <stop offset="100%" style="stop-color:#ff9f43"/>
            </linearGradient>
            <linearGradient id="incomeAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#2de8b0;stop-opacity:0.4"/>
              <stop offset="100%" style="stop-color:#2de8b0;stop-opacity:0"/>
            </linearGradient>
            <linearGradient id="expenseAreaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#ff6b6b;stop-opacity:0.4"/>
              <stop offset="100%" style="stop-color:#ff6b6b;stop-opacity:0"/>
            </linearGradient>
          </defs>
          ${gridLines}
          <path class="bezier-area-income" d="${incomeAreaD}" />
          <path class="bezier-area-expense" d="${expenseAreaD}" />
          <path class="bezier-curve-income" d="${bezierPath(incomePoints)}" />
          <path class="bezier-curve-expense" d="${bezierPath(expensePoints)}" />
          ${incomeCircles}
          ${expenseCircles}
          ${monthLabels}
        </svg>
        <div class="bezier-tooltip" id="bezier-tooltip">
          <div class="bezier-tooltip-month" id="tooltip-month"></div>
          <div class="bezier-tooltip-row">
            <div class="bezier-tooltip-dot" id="tooltip-dot"></div>
            <span id="tooltip-value"></span>
          </div>
        </div>
      </div>
      <div class="bar-legend">
        <div class="bar-leg-item"><div class="bar-leg-dot" style="background:#2de8b0;box-shadow:0 0 8px #2de8b0"></div>Доходы</div>
        <div class="bar-leg-item"><div class="bar-leg-dot" style="background:#ff6b6b;box-shadow:0 0 8px #ff6b6b"></div>Расходы</div>
      </div>`;
  }

  // ④ Category breakdown
  const CAT_LABELS = { food:'🛒 Питание', transport:'🚗 Транспорт', housing:'🏠 Жильё',
    health:'💊 Здоровье', entertainment:'🎮 Развлечения', clothes:'👗 Одежда',
    education:'📚 Образование', cafe:'☕ Кафе', other:'📦 Прочее', savings:'🏦 Накопления' };
  const CAT_COLORS = { food:'#4da6ff', transport:'#f5c842', housing:'#a78bfa',
    health:'#2de8b0', entertainment:'#ff6b6b', clothes:'#ff9f43', education:'#26de81',
    cafe:'#fd9644', other:'#6b7280', savings:'#2de8b0' };
  const expTxs = getMonthTx().filter(t=>t.type==='expense'&&t.category!=='savings');
  const catTotals = {};
  expTxs.forEach(t => { catTotals[t.category] = (catTotals[t.category]||0) + t.amount; });
  const totalExp = Object.values(catTotals).reduce((s,v)=>s+v,0);
  const catEl = document.getElementById('growth-categories');
  const expTotalEl = document.getElementById('growth-expense-total');
  if (expTotalEl) expTotalEl.textContent = totalExp > 0 ? totalExp.toLocaleString('ru') + ' ₽' : '';
  if (totalExp === 0) {
    catEl.innerHTML = '<div class="empty"><div class="empty-s">Нет расходов в этом месяце</div></div>';
  } else {
    const sorted = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
    catEl.innerHTML = sorted.map(([cat, amt]) => {
      const pct = Math.round(amt/totalExp*100);
      const color = CAT_COLORS[cat] || '#6b7280';
      const label = CAT_LABELS[cat] || cat;
      return `<div class="cat-row">
        <div class="cat-name">${label}</div>
        <div class="cat-bar-wrap"><div class="cat-bar-fill" style="width:${pct}%;background:${color}88"></div></div>
        <div class="cat-amount" style="color:${color}">${amt.toLocaleString('ru')} ₽</div>
      </div>`;
    }).join('');
  }

  // ⑤ Forecast to goal
  const forecastEl = document.getElementById('growth-forecast');
  const monthlySavingsAvg = (() => {
    const m = getLast6Months();
    const active = m.filter(x=>x.savings>0);
    if (active.length === 0) return stats.savedAmount;
    return active.reduce((s,x)=>s+x.savings,0) / active.length;
  })();
  const currentCapital = totalAssets + totalSaved;
  if (monthlySavingsAvg <= 0 || goal <= currentCapital) {
    if (goal <= currentCapital && currentCapital > 0) {
      forecastEl.innerHTML = `<div style="text-align:center;padding:14px 0">
        <div style="font-size:2rem;margin-bottom:8px">🏆</div>
        <div style="font-family:Syne,sans-serif;font-size:1rem;font-weight:800;color:var(--gold)">Цель достигнута!</div>
        <div style="font-size:.76rem;color:var(--muted);margin-top:4px">${currentCapital.toLocaleString('ru')} ₽ из ${goal.toLocaleString('ru')} ₽</div>
      </div>`;
    } else {
      forecastEl.innerHTML = '<div class="empty"><div class="empty-s">Начните откладывать для прогноза</div></div>';
    }
  } else {
    const monthsLeft = Math.ceil((goal - currentCapital) / monthlySavingsAvg);
    const yearsLeft  = (monthsLeft / 12).toFixed(1);
    const targetDate = new Date(); targetDate.setMonth(targetDate.getMonth() + monthsLeft);
    const targetStr  = targetDate.getDate() + ' ' + ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'][targetDate.getMonth()] + ' ' + targetDate.getFullYear();
    // Mini SVG forecast curve
    const pts = 7;
    const W = 280, H = 64;
    const projPts = Array.from({length: pts}, (_,i) => {
      const x = Math.round(i/(pts-1)*W);
      const val = currentCapital + monthlySavingsAvg * i * monthsLeft/(pts-1);
      const y = Math.round(H - Math.min(val/goal, 1) * H * 0.9);
      return `${x},${y}`;
    });
    const goalY = Math.round(H * 0.08);
    forecastEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:12px">
        <div><div style="font-size:.68rem;color:var(--muted)">Текущий капитал</div><div style="font-family:Syne,sans-serif;font-weight:800;font-size:.95rem;color:var(--mint)">${currentCapital.toLocaleString('ru')} ₽</div></div>
        <div style="text-align:right"><div style="font-size:.68rem;color:var(--muted)">До цели</div><div style="font-family:Syne,sans-serif;font-weight:800;font-size:.95rem;color:var(--gold)">${yearsLeft} лет</div></div>
      </div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:${H}px;display:block;margin-bottom:8px">
        <defs><linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#4da6ff" stop-opacity=".25"/>
          <stop offset="100%" stop-color="#4da6ff" stop-opacity="0"/>
        </linearGradient></defs>
        <line x1="0" y1="${goalY}" x2="${W}" y2="${goalY}" stroke="rgba(245,200,66,.3)" stroke-width="1" stroke-dasharray="4 4"/>
        <polyline points="${projPts.join(' ')}" fill="none" stroke="#4da6ff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <polygon points="0,${H} ${projPts.join(' ')} ${W},${H}" fill="url(#fcGrad)"/>
        <circle cx="${projPts[projPts.length-1].split(',')[0]}" cy="${projPts[projPts.length-1].split(',')[1]}" r="4" fill="#4da6ff"/>
      </svg>
      <div style="display:flex;align-items:center;gap:8px;font-size:.72rem;color:var(--muted)">
        <span>При откладывании</span>
        <span style="color:var(--mint);font-weight:700">${Math.round(monthlySavingsAvg).toLocaleString('ru')} ₽/мес</span>
        <span>→ достигнешь цели</span>
        <span style="color:var(--gold);font-weight:700">${targetStr}</span>
      </div>`;
  }

  // ⑥ Financial profile card
  const profileEl = document.getElementById('growth-profile');
  const LEVEL_LABELS = { starter:'🌱 Только начинаю', stable:'💼 Стабильный доход', cushion:'🛡️ Есть подушка', capital:'📈 Есть капитал' };
  const GOAL_LABELS2 = { save:'🏦 Копить', invest:'📈 Инвестировать', control:'💡 Контролировать расходы', '100k':'🎯 $100k', habits:'⚡ Дисциплина' };
  if (!level) {
    profileEl.innerHTML = '<div class="empty"><div class="empty-s">Пройдите онбординг</div></div>';
  } else {
    const doneHabitsToday = DB.habits.filter(h => h.completions?.[new Date().toISOString().split('T')[0]]).length;
    const topStreak = DB.habits.reduce((max,h) => Math.max(max, getHabitStreak(h)), 0);
    const txCount = DB.transactions.length;
    profileEl.innerHTML = `
      <div style="display:flex;gap:10px;align-items:center;margin-bottom:12px">
        <div style="flex:1">
          <div style="font-size:.7rem;color:var(--muted);margin-bottom:3px">Уровень</div>
          <div style="font-size:.82rem;font-weight:700">${LEVEL_LABELS[level]||level}</div>
        </div>
        <div style="flex:1;text-align:right">
          <div style="font-size:.7rem;color:var(--muted);margin-bottom:3px">Цель</div>
          <div style="font-size:.82rem;font-weight:700">${GOAL_LABELS2[DB.user.goalType||'save']}</div>
        </div>
      </div>
      <div class="profile-stat-grid">
        <div class="profile-stat"><div class="profile-stat-val" style="color:var(--gold)">${txCount}</div><div class="profile-stat-lbl">Транзакций</div></div>
        <div class="profile-stat"><div class="profile-stat-val" style="color:var(--mint)">${doneHabitsToday}/${DB.habits.length}</div><div class="profile-stat-lbl">Привычек сегодня</div></div>
        <div class="profile-stat"><div class="profile-stat-val" style="color:var(--coral)">🔥${topStreak}</div><div class="profile-stat-lbl">Макс. стрик</div></div>
        <div class="profile-stat"><div class="profile-stat-val" style="color:var(--blue)">${(totalAssets+totalSaved).toLocaleString('ru')}</div><div class="profile-stat-lbl">Капитал ₽</div></div>
        <div class="profile-stat"><div class="profile-stat-val" style="color:var(--mint)">${stats.savingsRate}%</div><div class="profile-stat-lbl">Норма сбер.</div></div>
        <div class="profile-stat"><div class="profile-stat-val" style="color:var(--gold)">${score !== null ? score : '—'}</div><div class="profile-stat-lbl">Здоровье</div></div>
      </div>`;
  }

  // ⑦ Score (keep existing)
  if (score !== null) {
    document.getElementById('score-val').textContent = score;
    const labels = [[80,'Отлично ✦'],[60,'Хорошо'],[40,'Растём'],[0,'Начало']];
    const badge = labels.find(([min])=>score>=min)?.[1] || 'Начало';
    document.getElementById('score-badge').textContent = badge;
    document.getElementById('score-rows').innerHTML = `
      <div class="score-row"><div class="score-row-l">Транзакции</div><div style="font-weight:700;color:var(--mint)">${DB.transactions.length}</div></div>
      <div class="score-row"><div class="score-row-l">Норма сбережений</div><div style="font-weight:700;color:${stats.savingsRate>=20?'var(--mint)':'var(--gold)'}">${stats.savingsRate}%</div></div>
      <div class="score-row"><div class="score-row-l">Привычки</div><div style="font-weight:700;color:${DB.habits.length>0?'var(--mint)':'var(--muted)'}">${DB.habits.length > 0 ? '✓' : '—'}</div></div>
      <div class="score-row"><div class="score-row-l">Активы</div><div style="font-weight:700;color:${DB.assets.length>0?'var(--mint)':'var(--muted)'}">${DB.assets.length > 0 ? '✓' : '—'}</div></div>`;
  }
}

function renderCapital() {
  const stats = calcStats();
  document.getElementById('capital-month').textContent = periodLabel();
  const mtx     = getMonthTx();
  const income  = mtx.filter(t=>t.type==='income').reduce((s,t)=>s+t.amount, 0);
  const expense = mtx.filter(t=>t.type==='expense'&&t.category!=='savings').reduce((s,t)=>s+t.amount, 0);
  const saved   = mtx.filter(t=>t.type==='expense'&&t.category==='savings').reduce((s,t)=>s+t.amount, 0);
  const balance = income - expense - saved;

  // Mini summary top
  document.getElementById('cap-income-sum').textContent  = income.toLocaleString('ru') + ' ₽';
  document.getElementById('cap-expense-sum').textContent = expense.toLocaleString('ru') + ' ₽';
  document.getElementById('cap-saved-sum').textContent   = saved.toLocaleString('ru') + ' ₽';
  document.getElementById('cap-balance-sum').textContent = balance.toLocaleString('ru') + ' ₽';
  document.getElementById('cap-balance-sum').style.color = balance >= 0 ? 'var(--gold)' : 'var(--coral)';

  const CAT_ICONS = {salary:'💼',freelance:'🎨',food:'🛒',transport:'🚗',housing:'🏠',entertainment:'🎬',health:'💊',clothes:'👗',savings:'💰',other:'📦'};
  const CAT_COLORS = {salary:'rgba(45,232,176,.1)',freelance:'rgba(245,200,66,.1)',food:'rgba(255,107,107,.1)',transport:'rgba(77,166,255,.1)',housing:'rgba(77,166,255,.1)',entertainment:'rgba(167,139,250,.1)',health:'rgba(45,232,176,.1)',clothes:'rgba(255,107,107,.1)',savings:'rgba(45,232,176,.1)',other:'rgba(107,114,128,.1)'};

  const txSorted = [...mtx].sort((a,b)=>b.id-a.id);
  document.getElementById('cap-tx-list').innerHTML = txSorted.length === 0
    ? `<div class="empty"><div class="empty-ico">📋</div><div class="empty-t">Нет операций</div></div>`
    : txSorted.map(t=>`<div class="tx-swipe-wrap" data-tx-id="${t.id}">
      <div class="tx-swipe-inner" onclick="swipeTx(${t.id})">
        <div class="tx-ico" style="background:${CAT_COLORS[t.category]||'var(--s2)'}">${CAT_ICONS[t.category]||'📦'}</div>
        <div class="tx-info"><div class="tx-name">${t.desc}</div><div class="tx-date">${fmtDate(t.date)}</div></div>
        <div class="tx-amt ${t.type==='income'?'pos':'neg'}">${t.type==='income'?'+':'−'}${t.amount.toLocaleString('ru')} ₽</div>
      </div>
      <div class="tx-swipe-actions">
        <button class="tx-swipe-edit" onclick="editTx(${t.id})"><span>✏️</span><span>Ред.</span></button>
        <button class="tx-swipe-del"  onclick="deleteTxConfirm(${t.id})"><span>🗑</span><span>Удал.</span></button>
      </div>
    </div>`).join('');

  // Budget in capital
  const budget = calcBudget5020(stats.income, stats.expense);
  const capBudEl = document.getElementById('cap-budget-items');
  if (!budget) {
    capBudEl.innerHTML = `<div class="empty"><div class="empty-s">Добавьте транзакции</div></div>`;
  } else {
    capBudEl.innerHTML = renderBudgetItems(budget);
  }

  // Categories
  const catMap = {};
  mtx.forEach(t=>{
    if(!catMap[t.category]) catMap[t.category]={income:0,expense:0};
    catMap[t.category][t.type] += t.amount;
  });
  const catNames = {salary:'Зарплата',freelance:'Фриланс',food:'Питание',transport:'Транспорт',housing:'Жильё',entertainment:'Развлечения',health:'Здоровье',clothes:'Одежда',savings:'Сбережения',other:'Другое'};
  document.getElementById('cap-categories').innerHTML = Object.keys(catMap).length===0
    ? `<div class="empty"><div class="empty-s">Нет данных</div></div>`
    : Object.entries(catMap).map(([cat,vals])=>`
      <div class="tx-row">
        <div class="tx-ico" style="background:${CAT_COLORS[cat]||'var(--s2)'}">${CAT_ICONS[cat]||'📦'}</div>
        <div class="tx-info"><div class="tx-name">${catNames[cat]||cat}</div></div>
        ${vals.income>0?`<div class="tx-amt pos">+${vals.income.toLocaleString('ru')} ₽</div>`:''}
        ${vals.expense>0?`<div class="tx-amt neg">−${vals.expense.toLocaleString('ru')} ₽</div>`:''}
      </div>`).join('');

  // Assets
  const assetsEl = document.getElementById('assets-list');
  assetsEl.innerHTML = DB.assets.length === 0
    ? `<div class="empty"><div class="empty-ico">💎</div><div class="empty-t">Нет активов</div></div>`
    : DB.assets.map(a => {
      const meta = typeof getAssetTypeMeta === 'function' ? getAssetTypeMeta(a.type) : { icon: '💎', label: a.type || 'Актив' };
      return `<div class="tx-swipe-wrap" data-asset-id="${a.id}">
      <div class="tx-swipe-inner" onclick="swipeAsset(${a.id})">
        <div class="tx-ico" style="background:rgba(45,232,176,.1)">${meta.icon || '💎'}</div>
        <div class="tx-info"><div class="tx-name">${a.name}</div><div class="tx-date">${meta.label || a.type || 'Актив'}</div></div>
        <div class="tx-amt pos">${a.amount.toLocaleString('ru')} ₽</div>
      </div>
      <div class="tx-swipe-actions">
        <button class="tx-swipe-edit" onclick="editAsset(${a.id})"><span>✏️</span><span>Ред.</span></button>
        <button class="tx-swipe-del"  onclick="deleteAssetConfirm(${a.id})"><span>🗑</span><span>Удал.</span></button>
      </div>
    </div>`;
    }).join('');
  const assetsTotal = DB.assets.reduce((s,a)=>s+a.amount, 0);
  document.getElementById('assets-total').textContent = assetsTotal.toLocaleString('ru') + ' ₽';
}

function buildHabitSparkline(habit) {
  const N = 21; // 3 weeks of history
  const W = 200, H = 22;
  const today = new Date();
  const days = [];
  for (let i = N-1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = localDateISO(d);
    days.push(habit.completions?.[key] ? 1 : 0);
  }
  // Smooth with rolling average for nicer curve
  const smoothed = days.map((v, i) => {
    const slice = days.slice(Math.max(0,i-2), i+3);
    return slice.reduce((s,x)=>s+x,0) / slice.length;
  });
  const step = W / (N - 1);
  const pts = smoothed.map((v, i) => `${Math.round(i*step)},${Math.round(H - v*(H-4) - 2)}`);
  const ptsStr = pts.join(' ');
  // Count recent completions (last 7 days)
  const recent = days.slice(-7).filter(Boolean).length;
  const color = recent >= 5 ? '#2de8b0' : recent >= 3 ? '#f5c842' : '#4da6ff';
  const polyClose = `${Math.round((N-1)*step)},${H+2} 0,${H+2}`;
  return `<div class="hab-sparkline">
    <svg viewBox="0 0 ${W} ${H+4}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg-${habit.id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity=".3"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <polygon points="${ptsStr} ${polyClose}" fill="url(#sg-${habit.id})"/>
      <polyline points="${ptsStr}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>
      ${days.map((v,i) => v ? `<circle cx="${Math.round(i*step)}" cy="${Math.round(H - smoothed[i]*(H-4) - 2)}" r="1.8" fill="${color}" opacity=".7"/>` : '').filter(Boolean).join('')}
    </svg>
  </div>`;
}

function renderHabits() {
  // Week grid
  const grid = document.getElementById('week-grid');
  const now = new Date();
  const days = [];
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay()+6)%7));
  for (let i=0;i<7;i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate()+i);
    days.push(d);
  }
  const dNamesShort = ['пн','вт','ср','чт','пт','сб','вс'];
  const todayKey = todayISO();
  grid.innerHTML = days.map((d,i)=>{
    const key = localDateISO(d);
    const isToday = key === todayKey;
    const isPast  = d < now && !isToday;
    const doneCount = DB.habits.filter(h=>h.completions?.[key]).length;
    const dotColor = doneCount===0?'var(--dim)':doneCount===DB.habits.length?'var(--mint)':'var(--gold)';
    return `<div class="wday ${isToday?'today':''} ${isPast?'past':''}">
      <div class="wd-n">${dNamesShort[i]}</div>
      <div class="wd-d">${d.getDate()}</div>
      <div class="wd-dot" style="background:${dotColor}"></div>
    </div>`;
  }).join('');

  // Habit full list
  const listEl = document.getElementById('habit-list-full');
  if (DB.habits.length===0) {
    listEl.innerHTML=`<div class="empty"><div class="empty-ico">🌱</div><div class="empty-t">Нет привычек</div><div class="empty-s">Нажмите «+ Привычка» чтобы начать</div></div>`;
    return;
  }
  const FREQ_LABELS = {daily:'Каждый день',weekdays:'Будни',weekend:'Выходные'};
  const freqLabel = f => {
    if (FREQ_LABELS[f]) return FREQ_LABELS[f];
    if (f && f.startsWith('custom:')) {
      const dn = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];
      return f.replace('custom:','').split(',').map(d=>dn[+d]).join(', ');
    }
    return f || 'Каждый день';
  };
  listEl.innerHTML = DB.habits.map(h=>{
    const monthDays = Object.values(h.completions||{}).filter(Boolean).length;
    const streak = getHabitStreak(h);
    const isDone = !!h.completions?.[todayKey];
    return `<div class="hab-swipe-wrap" data-hab-id="${h.id}">
      <div class="hab-swipe-inner">
        <div class="hfr-ico" style="background:${isDone?'rgba(45,232,176,.15)':'var(--s2)'};cursor:pointer;flex-shrink:0;transition:background .2s"
             onclick="event.stopPropagation();toggleHabit(${h.id},'${todayKey}')">${h.emoji}</div>
        <div class="hfr-inf" style="flex:1;min-width:0">
          <div class="hfr-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;${isDone?'text-decoration:line-through;opacity:.5':''}">${h.name}</div>
          <div class="hfr-meta">${freqLabel(h.freq)} ${streak>0?'· 🔥'+streak+' дн.':''} · ${monthDays} отметок</div>
          ${buildHabitSparkline(h)}
        </div>
        <div class="habit-chk ${isDone?'done':'open'}" style="flex-shrink:0;cursor:pointer"
             onclick="event.stopPropagation();toggleHabit(${h.id},'${todayKey}')">${isDone?'✓':''}</div>
      </div>
      <div class="hab-swipe-actions">
        <button class="hab-sw-tips" onclick="event.stopPropagation();swipeHabit(${h.id});openHabitTips(${h.id})"><span>💡</span><span>Советы</span></button>
        <button class="hab-sw-edit" onclick="event.stopPropagation();swipeHabit(${h.id});openHabitSheet(${h.id})"><span>✏️</span><span>Ред.</span></button>
        <button class="hab-sw-del"  onclick="event.stopPropagation();swipeHabit(${h.id});deleteHabitConfirm(${h.id})"><span>🗑</span><span>Удал.</span></button>
      </div>
    </div>`;
  }).join('');

  // Attach swipe gestures
  setTimeout(initHabSwipe, 0);

  // System week header
  const weekStart = days[0];
  const weekEnd   = days[6];
  document.getElementById('system-week').textContent =
    weekStart.getDate()+' '+MONTHS_RU[weekStart.getMonth()].slice(0,3)+'. — '+weekEnd.getDate()+' '+MONTHS_RU[weekEnd.getMonth()].slice(0,3)+'.';
}

function renderTasks() { renderPlanner(); } // compat shim

function plannerNavMonth(dir) {
  _plannerCalOffset += dir;
  renderPlanner();
}

function plannerSelectDay(dateStr) {
  _plannerSelDate = dateStr;
  // Auto-scroll to day detail on mobile
  if (window.innerWidth < 1024) {
    setTimeout(() => {
      const el = document.getElementById('pl-sel-day');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
  renderPlanner();
  loadPlannerAIHint();
}

async function loadPlannerAIHint() {
  const hintEl = document.getElementById('pl-ai-hint');
  const textEl = document.getElementById('pl-ai-hint-text');
  if (!hintEl || !textEl) return;
  const date = _plannerSelDate || todayISO();
  const tasks = DB.tasks.filter(t => t.date === date);
  const done  = tasks.filter(t => t.done).length;
  const total = tasks.length;
  const moodArr = DB.mood[date];
  const lastMood = Array.isArray(moodArr) ? moodArr[moodArr.length-1]?.v : (typeof moodArr==='number' ? moodArr : null);
  const todayKey = todayISO();
  const isToday = date === todayKey;
  const isPast  = date < todayKey;
  // Show hint only if there's something to say
  if (total === 0 && !lastMood) { hintEl.style.display = 'none'; return; }
  hintEl.style.display = 'block';
  const moodLabel = {5:'отличное',4:'хорошее',3:'нейтральное',2:'плохое',1:'очень плохое'}[lastMood] || '';
  const ctxParts = [];
  if (total > 0) ctxParts.push(`задачи: ${done}/${total} выполнено`);
  if (moodLabel) ctxParts.push(`настроение: ${moodLabel}`);
  const dayLabel = isToday ? 'сегодня' : isPast ? `${date}` : `предстоящий день ${date}`;
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:getAIHeaders(),
      body: JSON.stringify({ model:'claude-3-haiku-20240307', max_tokens:120,
        messages:[{role:'user',content:`Планер Nobile. День: ${dayLabel}. ${ctxParts.join(', ')}. Дай короткий (1-2 предложения) практичный совет или мотивацию. Только текст, без emoji в начале.`}]
      })
    });
    const d = await r.json();
    const text = d.content?.[0]?.text?.trim();
    if (text) { textEl.textContent = text; hintEl.style.display = 'block'; }
  } catch(e) {
    textEl.textContent = total > 0 ? (done === total ? 'Все задачи выполнены — отличная работа!' : `Осталось ${total-done} ${total-done===1?'задача':'задач'}. Не откладывай.`) : '';
  }
}

function renderPlanner() {
  const todayStr = todayISO();
  const now = new Date();
  // Calendar month to show
  const calDate = new Date(now.getFullYear(), now.getMonth() + _plannerCalOffset, 1);
  const calYear  = calDate.getFullYear();
  const calMonth = calDate.getMonth();

  // Update calendar title
  const titleEl = document.getElementById('pl-cal-title');
  if (titleEl) titleEl.textContent = MONTHS_RU[calMonth].charAt(0).toUpperCase() + MONTHS_RU[calMonth].slice(1) + ' ' + calYear;

  // Build calendar days
  const daysEl = document.getElementById('pl-cal-days');
  if (!daysEl) return;

  const firstDay = new Date(calYear, calMonth, 1);
  const lastDay  = new Date(calYear, calMonth + 1, 0);
  // Mon=0 grid offset
  const startDow = (firstDay.getDay() + 6) % 7;
  const MOOD_EMOJIS = {5:'😄',4:'🙂',3:'😐',2:'😕',1:'😣'};

  let cells = [];
  // Prev month filler
  for (let i = 0; i < startDow; i++) {
    const d = new Date(calYear, calMonth, 1 - (startDow - i));
    cells.push({ date: d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'), day: d.getDate(), cur: false });
  }
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const cd = new Date(calYear, calMonth, d);
    cells.push({ date: cd.getFullYear()+'-'+String(cd.getMonth()+1).padStart(2,'0')+'-'+String(cd.getDate()).padStart(2,'0'), day: d, cur: true });
  }
  // Next month filler (complete last row)
  const remaining = cells.length % 7 === 0 ? 0 : 7 - (cells.length % 7);
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(calYear, calMonth + 1, i);
    cells.push({ date: d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'), day: d.getDate(), cur: false });
  }

  daysEl.innerHTML = cells.map(cell => {
    const isToday    = cell.date === todayStr;
    const isSelected = cell.date === _plannerSelDate;
    const hasTasks   = DB.tasks.some(t => t.date === cell.date);
    const moodRaw    = DB.mood[cell.date];
    const lastMood   = Array.isArray(moodRaw) ? moodRaw[moodRaw.length-1]?.v : (typeof moodRaw==='number' ? moodRaw : null);
    const cls = [
      'pl-day',
      !cell.cur ? 'other-month' : '',
      isToday    ? 'today'    : '',
      isSelected ? 'selected' : '',
    ].filter(Boolean).join(' ');

    const dots = [
      hasTasks  ? `<div class="pl-dot" style="background:${isSelected?'rgba(13,15,20,.5)':'var(--blue)'}"></div>` : '',
      lastMood  ? `<div class="pl-dot" style="background:${isSelected?'rgba(13,15,20,.5)':lastMood>=4?'var(--mint)':lastMood===3?'var(--gold)':'var(--coral)'}"></div>` : '',
    ].join('');

    return `<div class="${cls}" onclick="plannerSelectDay('${cell.date}')">
      <div class="pl-day-num">${cell.day}</div>
      ${dots ? `<div class="pl-dots">${dots}</div>` : ''}
    </div>`;
  }).join('');

  // ── Day panel ──
  const selDate = _plannerSelDate || todayStr;
  const selD    = new Date(selDate + 'T12:00:00');
  const dayNames = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
  const isToday  = selDate === todayStr;
  const isFuture = selDate > todayStr;

  const titleEl2 = document.getElementById('pl-sel-title');
  const subEl    = document.getElementById('pl-sel-sub');
  if (titleEl2) titleEl2.textContent = isToday ? 'Сегодня' : dayNames[selD.getDay()];
  if (subEl)    subEl.textContent = selD.getDate() + ' ' + MONTHS_RU[selD.getMonth()] + ' ' + selD.getFullYear();

  // Mood log
  const moodRaw = DB.mood[selDate];
  const moodEntries = Array.isArray(moodRaw) ? moodRaw : (typeof moodRaw==='number' ? [{t:'—',v:moodRaw}] : []);
  const logEl = document.getElementById('pl-mood-log');
  const chipEl = document.getElementById('pl-day-mood-chip');
  const MOOD_LABELS = {5:'Отлично',4:'Хорошо',3:'Нейтрально',2:'Плохо',1:'Очень плохо'};
  if (logEl) {
    logEl.innerHTML = moodEntries.length === 0
      ? `<div style="font-size:.72rem;color:var(--dim);padding:4px 0 8px">${isFuture?'Запланируй настроение 🙂':'Ещё нет записей настроения'}</div>`
      : moodEntries.map((e,i) => `
        <div class="mood-entry">
          <div class="mood-entry-time">${e.t}</div>
          <div class="mood-entry-emoji">${MOOD_EMOJIS[e.v]||'😐'}</div>
          <div class="mood-entry-label">${MOOD_LABELS[e.v]||''}</div>
          <div class="mood-entry-del" onclick="deleteMoodEntry('${selDate}',${i})">✕</div>
        </div>`).join('');
  }
  const lastMoodVal = moodEntries.length ? moodEntries[moodEntries.length-1].v : null;
  if (chipEl) chipEl.textContent = lastMoodVal ? MOOD_EMOJIS[lastMoodVal] : '—';

  // Task list
  const dayTasks = DB.tasks.filter(t => t.date === selDate).sort((a,b) => {
    const priO = {high:0,mid:1,low:2};
    if (a.done !== b.done) return a.done ? 1 : -1;
    return (priO[a.priority]||1) - (priO[b.priority]||1);
  });
  const taskEl = document.getElementById('task-list');
  const priClass = {high:'high',mid:'mid',low:'low'};
  const priLabel = {high:'Высокий',mid:'Средний',low:'Низкий'};
  if (taskEl) {
    taskEl.innerHTML = dayTasks.length === 0
      ? `<div class="empty" style="padding:20px 0"><div class="empty-ico">📋</div><div class="empty-t">Нет задач</div><div class="empty-s">${isFuture?'Запланируй на этот день':'Добавьте задачи на этот день'}</div></div>`
      : dayTasks.map(t => `
        <div class="task-item ${t.done?'done-item':''}">
          <div class="task-cb ${t.done?'done':''}" onclick="toggleTask(${t.id})">${t.done?'✓':''}</div>
          <div class="task-body">
            <div class="task-name ${t.done?'done':''}">${t.text}</div>
            <div class="task-meta">
              <span class="task-pri ${priClass[t.priority]||'mid'}">${priLabel[t.priority]||'Средний'}</span>
              ${t.time ? `<span class="task-time-lbl">⏰ ${t.time}</span>` : ''}
            </div>
          </div>
          <div class="task-del" onclick="deleteTask(${t.id})">✕</div>
        </div>`).join('');
  }
  
  // Update planner stats
  updatePlannerStats();
}


function renderInsights(query='') {
  const list = query
    ? DB.insights.filter(i=>i.title.toLowerCase().includes(query.toLowerCase())||i.body.toLowerCase().includes(query.toLowerCase()))
    : DB.insights;
  const el = document.getElementById('insights-list');
  if (list.length===0) {
    el.innerHTML=`<div class="empty"><div class="empty-ico">💡</div><div class="empty-t">Нет инсайтов</div><div class="empty-s">${query?'Ничего не найдено':'Сохраняйте мысли и выводы'}</div></div>`;
    return;
  }
  el.innerHTML = [...list].reverse().map(i=>`
    <div style="background:var(--s2);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:8px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="display:flex;gap:5px">
          <span style="font-size:.62rem;font-weight:700;padding:2px 8px;border-radius:20px;background:var(--s3);color:var(--muted);border:1px solid var(--line)">${TAG_ICONS[i.tag]} ${TAG_NAMES[i.tag]}</span>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:.62rem;color:var(--dim)">${fmtDate(i.date)}</span>
          <button onclick="deleteInsight(${i.id})" class="tx-del">✕</button>
        </div>
      </div>
      <div style="font-size:.86rem;font-weight:700;margin-bottom:5px">${i.title}</div>
      <div style="font-size:.76rem;color:var(--muted);line-height:1.45">${i.body}</div>
    </div>`).join('');
}

/* ═══════════════════════════════════════
   SKILL TREE FUNCTIONS
═══════════════════════════════════════ */
const SKILL_TREE = [
  // Level 1: Fundamentals (bottom row)
  { id: 's1', x: 0, y: 2, icon: '🏦', name: 'База', level: 1, xp: 50, courseId: 'c1', prereq: null },
  { id: 's2', x: 1, y: 2, icon: '📊', name: 'Бюджет', level: 1, xp: 50, courseId: 'c3', prereq: null },
  { id: 's3', x: 2, y: 2, icon: '💰', name: 'Накопления', level: 1, xp: 50, courseId: 'c5', prereq: null },

  // Level 2: Intermediate (middle row)
  { id: 's4', x: 0, y: 1, icon: '📈', name: 'Инвестиции', level: 2, xp: 100, courseId: 'c2', prereq: 's1' },
  { id: 's5', x: 1, y: 1, icon: '🎯', name: 'Цели', level: 2, xp: 100, courseId: 'c6', prereq: 's2' },
  { id: 's6', x: 2, y: 1, icon: '🛡️', name: 'Страховка', level: 2, xp: 100, courseId: 'c7', prereq: 's3' },

  // Level 3: Advanced (top row)
  { id: 's7', x: 0, y: 0, icon: '🏛️', name: 'Налоги', level: 3, xp: 150, courseId: 'c4', prereq: 's4' },
  { id: 's8', x: 1, y: 0, icon: '🌊', name: 'Пассив', level: 3, xp: 150, courseId: 'c8', prereq: 's5' },
  { id: 's9', x: 2, y: 0, icon: '🚀', name: 'Стартап', level: 3, xp: 150, courseId: 'c9', prereq: 's6' },

  // Hidden: FIRE (center top, unlocks with achievement)
  { id: 's10', x: 1, y: -1, icon: '🔥', name: 'FIRE', level: 4, xp: 500, courseId: 'c10', prereq: 'achievement_master', hidden: true }
];


/* ═══════════════════════════════════════════════════════════════
   HERO'S PATH - Skill Tree 2.0 JavaScript
═══════════════════════════════════════════════════════════════ */

const HERO_PATH_NODES = [
  // ROOT - Foundation (bottom)
  { id: 'hp1', x: 50, y: 85, icon: '🏦', name: 'База', level: 1, xp: 50, courseId: 'c1', stage: 'fundamentals', type: 'root' },

  // Level 2 - Branches from root
  { id: 'hp2', x: 25, y: 65, icon: '📊', name: 'Бюджет', level: 1, xp: 50, courseId: 'c3', stage: 'fundamentals', prereq: 'hp1' },
  { id: 'hp3', x: 75, y: 65, icon: '💰', name: 'Накопления', level: 1, xp: 50, courseId: 'c5', stage: 'fundamentals', prereq: 'hp1' },

  // Level 3 - Intermediate
  { id: 'hp4', x: 15, y: 45, icon: '📈', name: 'Инвестиции', level: 2, xp: 100, courseId: 'c2', stage: 'intermediate', prereq: 'hp2' },
  { id: 'hp5', x: 50, y: 45, icon: '🎯', name: 'Цели', level: 2, xp: 100, courseId: 'c6', stage: 'intermediate', prereq: 'hp2' },
  { id: 'hp6', x: 85, y: 45, icon: '🛡️', name: 'Страховка', level: 2, xp: 100, courseId: 'c7', stage: 'intermediate', prereq: 'hp3' },

  // Level 4 - Advanced
  { id: 'hp7', x: 20, y: 25, icon: '🏛️', name: 'Налоги', level: 3, xp: 150, courseId: 'c4', stage: 'advanced', prereq: 'hp4' },
  { id: 'hp8', x: 50, y: 25, icon: '🌊', name: 'Пассив', level: 3, xp: 150, courseId: 'c8', stage: 'advanced', prereq: 'hp5' },
  { id: 'hp9', x: 80, y: 25, icon: '🚀', name: 'Стартап', level: 3, xp: 150, courseId: 'c9', stage: 'advanced', prereq: 'hp6', type: 'endgame' },

  // FIRE - Hidden (top center)
  { id: 'hp10', x: 50, y: 8, icon: '🔥', name: 'FIRE', level: 4, xp: 500, courseId: 'c10', stage: 'advanced', prereq: 'achievement_master', hidden: true, type: 'endgame' }
];

function renderHeroPath() {
  const container = document.getElementById('skill-tree-grid');
  if (!container) return;

  container.className = 'hero-path-container';
  container.innerHTML = `
    <div class="hero-path-bg"></div>
    <div class="hero-path-trail"></div>
    <div class="hero-path-energy"></div>
    <div id="fiber-connections"></div>
    <div id="hero-nodes"></div>
  `;

  const s = getAcademyState();
  const completedCourses = s.completedCourses || [];
  const inProgress = s.inProgressCourse;

  // Check for hidden course unlock
  const hasMasterAchievement = checkAchievement('master_discipline');

  // Render fiber connections
  renderFiberConnections(completedCourses);

  // Render nodes
  const nodesContainer = document.getElementById('hero-nodes');
  HERO_PATH_NODES.forEach(node => {
    if (node.hidden && !hasMasterAchievement) return;

    const isCompleted = completedCourses.includes(node.courseId);
    const isInProgress = inProgress === node.courseId;
    const prereqNode = node.prereq ? HERO_PATH_NODES.find(n => n.id === node.prereq) : null;
    const isPrereqMet = !node.prereq || node.prereq.startsWith('achievement')
      ? checkAchievement(node.prereq?.replace('achievement_', ''))
      : completedCourses.includes(prereqNode?.courseId);

    let status = 'locked';
    let orbClass = node.type || '';

    if (isCompleted) {
      status = 'completed';
      orbClass = 'root';
    } else if (isInProgress) {
      status = 'in-progress';
      orbClass = 'in-progress';
    } else if (isPrereqMet) {
      status = 'available';
      orbClass = 'available';
    }

    if (node.type === 'endgame' && isPrereqMet) {
      orbClass = 'endgame';
    }

    const nodeEl = document.createElement('div');
    nodeEl.className = 'skill-node-hologram';
    nodeEl.style.left = `calc(${node.x}% - 36px)`;
    nodeEl.style.top = `calc(${node.y}% - 36px)`;

    nodeEl.innerHTML = `
      <div class="hologram-orb ${orbClass}">
        <div class="orb-inner-glow"></div>
        <span class="orb-icon">${node.icon}</span>
      </div>
      <div class="node-label ${orbClass}">${node.name}</div>
      <div class="node-xp">+${node.xp} XP</div>
    `;

    if (status !== 'locked') {
      nodeEl.onclick = () => openLesson(node.courseId);
    }

    nodesContainer.appendChild(nodeEl);
  });

  // Add stage labels
  addStageLabels();
}

function renderFiberConnections(completedCourses) {
  const container = document.getElementById('fiber-connections');
  if (!container) return;

  container.innerHTML = '';

  HERO_PATH_NODES.forEach(node => {
    if (!node.prereq || node.prereq.startsWith('achievement')) return;

    const prereq = HERO_PATH_NODES.find(n => n.id === node.prereq);
    if (!prereq) return;

    const isActive = completedCourses.includes(prereq.courseId);

    const length = Math.sqrt(
      Math.pow(node.x - prereq.x, 2) + 
      Math.pow(node.y - prereq.y, 2)
    );

    const angle = Math.atan2(node.y - prereq.y, node.x - prereq.x) * 180 / Math.PI;

    const fiber = document.createElement('div');
    fiber.className = `fiber-connection ${isActive ? 'active' : ''}`;
    fiber.style.left = `calc(${prereq.x}%)`;
    fiber.style.top = `calc(${prereq.y}%)`;
    fiber.style.width = `${length}%`;
    fiber.style.transform = `rotate(${angle}deg)`;

    if (isActive) {
      const particle = document.createElement('div');
      particle.className = 'fiber-particle';
      fiber.appendChild(particle);
    }

    container.appendChild(fiber);
  });
}

function addStageLabels() {
  const container = document.querySelector('.hero-path-container');
  if (!container) return;

  const stages = [
    { y: 75, label: 'Основы', stage: 'fundamentals' },
    { y: 55, label: 'Продвинутый', stage: 'intermediate' },
    { y: 35, label: 'Эксперт', stage: 'advanced' }
  ];

  stages.forEach(s => {
    const label = document.createElement('div');
    label.className = `path-stage ${s.stage}`;
    label.textContent = s.label;
    label.style.left = '8px';
    label.style.top = `calc(${s.y}% - 12px)`;
    container.appendChild(label);
  });
}

function renderSkillTree() {
  const grid = document.getElementById('skill-tree-grid');
  const connectionsGroup = document.getElementById('skill-connections-group');
  if (!grid) return;

  const s = getAcademyState();
  const completedCourses = s.completedCourses || [];
  const inProgress = s.inProgressCourse;

  // Check for hidden course unlock
  const hasMasterAchievement = checkAchievement('master_discipline');

  // Clear previous
  grid.innerHTML = '';
  if (connectionsGroup) connectionsGroup.innerHTML = '';

  // Render connections first (so they're behind nodes)
  SKILL_TREE.forEach(node => {
    if (node.prereq && !node.hidden) {
      const prereqNode = SKILL_TREE.find(n => n.id === node.prereq);
      if (prereqNode && connectionsGroup) {
        const isActive = completedCourses.includes(prereqNode.courseId);
        const x1 = (prereqNode.x * 33.33 + 16.67) + '%';
        const y1 = ((2 - prereqNode.y) * 33.33 + 16.67) + '%';
        const x2 = (node.x * 33.33 + 16.67) + '%';
        const y2 = ((2 - node.y) * 33.33 + 16.67) + '%';

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', x1);
        line.setAttribute('y1', y1);
        line.setAttribute('x2', x2);
        line.setAttribute('y2', y2);
        line.setAttribute('class', 'skill-connection ' + (isActive ? 'active' : ''));
        connectionsGroup.appendChild(line);
      }
    }
  });

  // Render nodes
  SKILL_TREE.forEach(node => {
    if (node.hidden && !hasMasterAchievement) return;

    const isCompleted = completedCourses.includes(node.courseId);
    const isInProgress = inProgress === node.courseId;
    const prereqNode = node.prereq ? SKILL_TREE.find(n => n.id === node.prereq) : null;
    const isPrereqMet = !node.prereq || node.prereq.startsWith('achievement') 
      ? checkAchievement(node.prereq?.replace('achievement_', ''))
      : completedCourses.includes(prereqNode?.courseId);

    let status = 'locked';
    if (isCompleted) status = 'completed';
    else if (isInProgress) status = 'in-progress';
    else if (isPrereqMet) status = 'available';

    const nodeEl = document.createElement('div');
    nodeEl.className = 'skill-node ' + status + (node.hidden ? ' unlocking' : '');
    nodeEl.style.gridColumn = node.x + 1;
    nodeEl.style.gridRow = (3 - node.y);
    nodeEl.innerHTML = `
      <div class="skill-node-orb">
        ${node.icon}
        ${status !== 'locked' ? '<div class="skill-node-ring"></div>' : ''}
      </div>
      <div class="skill-node-label">${node.name}</div>
      <div class="skill-node-xp">+${node.xp} XP</div>
    `;

    if (status !== 'locked') {
      nodeEl.onclick = () => openLesson(node.courseId);
    }

    grid.appendChild(nodeEl);
  });
}

function checkAchievement(achievementId) {
  const s = getAcademyState();
  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  return achievement ? achievement.condition(s) : false;
}

function openHiddenCourse() {
  document.getElementById('hidden-course-unlock').classList.remove('show');
  openLesson('c10');
}

function filterCourses(el, level) {
  _courseFilter = level;
  document.querySelectorAll('#course-level-filter .stab').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  renderCoursesList(level);
}

/* ═══════════════════════════════════════
   DYNAMIC TASKS - Real User Data
═══════════════════════════════════════ */
const DYNAMIC_TASK_TEMPLATES = [
  {
    id: 'dt_wishes_savings',
    type: 'calculation',
    icon: '✨',
    title: 'Экономия на желаниях',
    generate: () => {
      const budget = calcBudget5020(getMonthStats().income, getMonthStats().expense);
      const wishesAmount = budget?.wants?.actual || 5000;
      const savings10 = Math.round(wishesAmount * 0.1);
      const yearlySavings = savings10 * 12;
      return {
        text: `Твой лимит на "Желания" — ${wishesAmount.toLocaleString('ru')} ₽. Рассчитай, сколько ты сэкономишь за год, если сократишь их на 10%.`,
        data: { wishesAmount, savings10, yearlySavings },
        answer: yearlySavings,
        tolerance: 100,
        xp: 50
      };
    }
  },
  {
    id: 'dt_coffee_yearly',
    type: 'calculation',
    icon: '☕',
    title: 'Стоимость кофе',
    generate: () => {
      const coffeePrice = 250;
      const days = 250; // work days
      const yearly = coffeePrice * days;
      return {
        text: `Чашка кофе стоит ${coffeePrice} ₽. Если покупать её каждый рабочий день (${days} дней в году), сколько потратишь за год?`,
        data: { coffeePrice, days, yearly },
        answer: yearly,
        tolerance: 0,
        xp: 40
      };
    }
  },
  {
    id: 'dt_emergency_fund',
    type: 'calculation',
    icon: '🛡️',
    title: 'Подушка безопасности',
    generate: () => {
      const monthlyExpense = getMonthStats().expense || 30000;
      const target = monthlyExpense * 6;
      return {
        text: `Твои ежемесячные расходы — ${monthlyExpense.toLocaleString('ru')} ₽. Сколько нужно накопить для подушки безопасности на 6 месяцев?`,
        data: { monthlyExpense, target },
        answer: target,
        tolerance: monthlyExpense * 0.1,
        xp: 60
      };
    }
  },
  {
    id: 'dt_compound_interest',
    type: 'calculation',
    icon: '📈',
    title: 'Сложный процент',
    generate: () => {
      const principal = 100000;
      const rate = 10;
      const years = 5;
      const result = Math.round(principal * Math.pow(1 + rate/100, years));
      return {
        text: `Если вложить ${principal.toLocaleString('ru')} ₽ под ${rate}% годовых, сколько будет через ${years} лет (сложный процент)?`,
        data: { principal, rate, years, result },
        answer: result,
        tolerance: result * 0.05,
        xp: 80
      };
    }
  },
  {
    id: 'dt_debt_payoff',
    type: 'calculation',
    icon: '💳',
    title: 'Погашение долга',
    generate: () => {
      const debt = 50000;
      const monthly = 5000;
      const months = Math.ceil(debt / monthly);
      return {
        text: `Долг ${debt.toLocaleString('ru')} ₽. Платёж ${monthly.toLocaleString('ru')} ₽/мес. Сколько месяцев до погашения?`,
        data: { debt, monthly, months },
        answer: months,
        tolerance: 0,
        xp: 45
      };
    }
  }
];

function generateDynamicTasks() {
  const tasks = [];
  const usedIndices = new Set();

  // Generate 3 unique tasks
  while (tasks.length < 3 && usedIndices.size < DYNAMIC_TASK_TEMPLATES.length) {
    const idx = Math.floor(Math.random() * DYNAMIC_TASK_TEMPLATES.length);
    if (!usedIndices.has(idx)) {
      usedIndices.add(idx);
      const template = DYNAMIC_TASK_TEMPLATES[idx];
      tasks.push({ ...template, ...template.generate() });
    }
  }

  return tasks;
}


/* ═══════════════════════════════════════════════════════════════
   BENEFIT TASKS 2.0 - Dynamic Tasks with Visualization
═══════════════════════════════════════════════════════════════ */

const BENEFIT_TASKS = [
  {
    id: 'bt_coffee',
    type: 'calculation',
    icon: '☕',
    title: 'Цена привычки',
    story: (data) => `Сергей каждый день покупает кофе за ${data.coffeePrice} ₽ и обед «на бегу» за ${data.lunchPrice} ₽. Оба — незапланированные траты, рабочих дней в году ${data.workDays}.`,
    question: 'Сколько рублей Сергей тратит на эти привычки за год?',
    generateData: () => ({
      coffeePrice: 280,
      lunchPrice: 450,
      workDays: 250
    }),
    calculate: (d) => (d.coffeePrice + d.lunchPrice) * d.workDays,
    xp: 35,
    visualType: 'coffee-to-coins'
  },
  {
    id: 'bt_5020',
    type: 'calculation',
    icon: '💰',
    title: 'Правило 50/30/20',
    story: (data) => `Алина получила зарплату ${data.salary.toLocaleString('ru')} ₽. Она хочет следовать правилу 50/30/20 и откладывать ровно 20% на накопления.`,
    question: 'Сколько рублей Алина должна перевести на накопительный счёт в день зарплаты?',
    generateData: () => ({ salary: 75000 }),
    calculate: (d) => Math.round(d.salary * 0.2),
    xp: 20,
    visualType: 'percentage'
  },
  {
    id: 'bt_overspend',
    type: 'calculation',
    icon: '⚠️',
    title: 'Найти перерасход',
    story: (data) => `Доход Михаила — ${data.income.toLocaleString('ru')} ₽/мес. За месяц он потратил: аренда+еда+транспорт = ${data.needs.toLocaleString('ru')} ₽, кафе+одежда+развлечения = ${data.wants.toLocaleString('ru')} ₽, накопления = ${data.savings} ₽.`,
    question: 'На сколько рублей Михаил превысил лимит «желаний» по правилу 50/30/20?',
    generateData: () => ({
      income: 90000,
      needs: 52000,
      wants: 38000,
      savings: 0
    }),
    calculate: (d) => d.wants - Math.round(d.income * 0.3),
    xp: 25,
    visualType: 'comparison'
  },
  {
    id: 'bt_emergency',
    type: 'calculation',
    icon: '🛡️',
    title: 'Подушка безопасности',
    story: (data) => `Твои ежемесячные расходы — ${data.expenses.toLocaleString('ru')} ₽. Финансовые консультанты рекомендуют иметь запас на 6 месяцев.`,
    question: 'Сколько нужно накопить для надёжной подушки безопасности?',
    generateData: () => ({ expenses: 45000 }),
    calculate: (d) => d.expenses * 6,
    xp: 45,
    visualType: 'shield'
  },
  {
    id: 'bt_compound',
    type: 'calculation',
    icon: '📈',
    title: 'Сложный процент',
    story: (data) => `Если вложить ${data.principal.toLocaleString('ru')} ₽ под ${data.rate}% годовых, сколько будет через ${data.years} лет?`,
    question: 'Рассчитай итоговую сумму (сложный процент).',
    generateData: () => ({ principal: 100000, rate: 10, years: 5 }),
    calculate: (d) => Math.round(d.principal * Math.pow(1 + d.rate/100, d.years)),
    xp: 50,
    visualType: 'growth'
  }
];

function renderBenefitTasks() {
  const container = document.getElementById('problems-list');
  if (!container) return;

  // Check if we already have tasks for today
  const today = todayISO();
  if (!DB.benefitTasks || DB.benefitTasks.date !== today) {
    DB.benefitTasks = {
      date: today,
      tasks: generateBenefitTasks(),
      completed: []
    };
    saveDB();
  }

  const tasks = DB.benefitTasks.tasks;
  const completed = DB.benefitTasks.completed || [];

  // Filter out completed
  const activeTasks = tasks.filter((t, i) => !completed.includes(i));

  if (activeTasks.length === 0) {
    container.innerHTML = `
      <div class="grail-card" style="text-align:center;padding:40px">
        <div style="font-size:4rem;margin-bottom:16px">🎉</div>
        <div style="font-family:var(--font-head);font-size:1.3rem;font-weight:800;margin-bottom:8px">Все задачи выполнены!</div>
        <div style="color:var(--muted)">Заходи завтра за новыми вызовами</div>
      </div>
    `;
    return;
  }

  container.innerHTML = activeTasks.map((task, idx) => renderBenefitTaskCard(task, idx)).join('');
}

function generateBenefitTasks() {
  const tasks = [];
  const used = new Set();

  while (tasks.length < 3 && used.size < BENEFIT_TASKS.length) {
    const idx = Math.floor(Math.random() * BENEFIT_TASKS.length);
    if (!used.has(idx)) {
      used.add(idx);
      const template = BENEFIT_TASKS[idx];
      const data = template.generateData();
      const answer = template.calculate(data);
      tasks.push({ ...template, data, answer });
    }
  }

  return tasks;
}

function renderBenefitTaskCard(task, idx) {
  const visualHTML = renderTaskVisualization(task);

  return `
    <div class="benefit-task-card" id="bt-card-${idx}">
      <div class="benefit-task-header">
        <div class="benefit-task-icon-wrap">${task.icon}</div>
        <div class="benefit-task-meta">
          <div class="benefit-task-type">Задача дня</div>
          <div class="benefit-task-title">${task.title}</div>
        </div>
        <div class="benefit-task-xp">🏆 +${task.xp} XP</div>
      </div>

      <div class="benefit-task-story">
        ${task.story(task.data)}
      </div>

      <div style="font-weight:700;margin-bottom:16px;color:#fff">${task.question}</div>

      ${visualHTML}

      <div class="benefit-input-section">
        <div class="benefit-input-row">
          <input type="number" class="benefit-input" id="bt-input-${idx}" placeholder="Твой ответ..." />
          <button class="benefit-submit-btn" onclick="submitBenefitTask(${idx}, ${task.answer}, ${task.xp})">
            Проверить
          </button>
        </div>
      </div>

      <div id="bt-feedback-${idx}"></div>
    </div>
  `;
}

function renderTaskVisualization(task) {
  if (task.visualType === 'coffee-to-coins') {
    const daily = task.data.coffeePrice + task.data.lunchPrice;
    const yearly = task.answer;

    return `
      <div class="benefit-visualization">
        <div class="visual-item">
          <div class="visual-icon coffee">☕</div>
          <div class="visual-label">${daily} ₽/день</div>
        </div>
        <div class="visual-arrow">→</div>
        <div class="visual-item">
          <div class="visual-icon money">💰</div>
          <div class="visual-label">за ${task.data.workDays} дней</div>
        </div>
      </div>
    `;
  }

  if (task.visualType === 'percentage') {
    return `
      <div class="benefit-visualization">
        <div class="visual-item">
          <div style="font-size:2.5rem;font-weight:800;color:var(--gold)">100%</div>
          <div class="visual-label">= ${task.data.salary.toLocaleString('ru')} ₽</div>
        </div>
        <div class="visual-arrow">→</div>
        <div class="visual-item">
          <div style="font-size:2.5rem;font-weight:800;color:var(--mint)">20%</div>
          <div class="visual-label">на накопления</div>
        </div>
      </div>
    `;
  }

  if (task.visualType === 'shield') {
    return `
      <div class="benefit-visualization">
        <div class="visual-item">
          <div class="visual-icon" style="font-size:3rem">🛡️</div>
          <div class="visual-label">${task.data.expenses.toLocaleString('ru')} ₽ × 6</div>
        </div>
        <div class="visual-arrow">=</div>
        <div class="visual-item">
          <div style="font-size:2rem;font-weight:800;color:var(--mint)">${(task.data.expenses * 6).toLocaleString('ru')} ₽</div>
          <div class="visual-label">подушка безопасности</div>
        </div>
      </div>
    `;
  }

  return '';
}

function submitBenefitTask(idx, correctAnswer, xp) {
  const input = document.getElementById(`bt-input-${idx}`);
  const feedback = document.getElementById(`bt-feedback-${idx}`);
  const userAnswer = parseInt(input.value) || 0;

  const tolerance = correctAnswer * 0.05; // 5% tolerance
  const isCorrect = Math.abs(userAnswer - correctAnswer) <= tolerance;

  if (isCorrect) {
    feedback.innerHTML = `
      <div class="benefit-feedback success">
        <div class="feedback-emoji">🤑</div>
        <div class="feedback-text">Отлично! Правильный ответ!</div>
        <div class="feedback-subtext">Ты понял, как работают деньги</div>
        <div class="benefit-amount">
          <div class="benefit-amount-label">Твоя награда</div>
          <div class="benefit-amount-value">+${xp} XP</div>
        </div>
      </div>
    `;

    // Award XP
    const s = getAcademyState();
    s.totalXP += xp;
    s.solvedProblemsCount = (s.solvedProblemsCount || 0) + 1;
    saveDB();

    // Mark as completed
    if (!DB.benefitTasks.completed) DB.benefitTasks.completed = [];
    DB.benefitTasks.completed.push(idx);
    saveDB();

    // Re-render after delay
    setTimeout(renderBenefitTasks, 2500);
    setTimeout(renderAcademy, 2500);

    // Check for new achievements
    checkStreakAchievements();
  } else {
    feedback.innerHTML = `
      <div class="benefit-feedback error">
        <div class="feedback-emoji">🤯</div>
        <div class="feedback-text">Почти! Попробуй ещё раз</div>
        <div class="feedback-subtext">Подсказка: проверь свои расчёты</div>
      </div>
    `;
  }
}


/* ═══════════════════════════════════════════════════════════════
   TROPHY HALL - Achievements 2.0 JavaScript
═══════════════════════════════════════════════════════════════ */

const TROPHY_DATA = [
  // Knowledge & Academy
  {
    id: 'tr_knowledge_1',
    category: 'knowledge',
    name: 'Первый урок',
    desc: 'Завершил первый урок',
    icon: '📖',
    rarity: 'common',
    xp: 25,
    condition: (s) => (s.completedCourses?.length || 0) >= 1
  },
  {
    id: 'tr_knowledge_2',
    category: 'knowledge',
    name: 'Ученик',
    desc: 'Завершил 5 уроков',
    icon: '📚',
    rarity: 'common',
    xp: 50,
    condition: (s) => (s.completedCourses?.length || 0) >= 5
  },
  {
    id: 'tr_knowledge_3',
    category: 'knowledge',
    name: 'Знаток',
    desc: 'Завершил все курсы',
    icon: '🎓',
    rarity: 'rare',
    xp: 200,
    condition: (s) => (s.completedCourses?.length || 0) >= 9
  },

  // Tasks
  {
    id: 'tr_tasks_1',
    category: 'tasks',
    name: 'Решала',
    desc: 'Решил 10 задач',
    icon: '🧮',
    rarity: 'common',
    xp: 50,
    condition: (s) => (s.solvedProblemsCount || 0) >= 10
  },
  {
    id: 'tr_tasks_2',
    category: 'tasks',
    name: 'Математик',
    desc: 'Решил 50 задач',
    icon: '📐',
    rarity: 'rare',
    xp: 200,
    condition: (s) => (s.solvedProblemsCount || 0) >= 50
  },

  // Finance
  {
    id: 'tr_finance_1',
    category: 'finance',
    name: 'Первая операция',
    desc: 'Добавил первую транзакцию',
    icon: '💳',
    rarity: 'common',
    xp: 25,
    condition: (s) => (DB.transactions?.length || 0) >= 1
  },
  {
    id: 'tr_finance_2',
    category: 'finance',
    name: 'Накопитель',
    desc: 'Накопил 100 000 ₽',
    icon: '🏦',
    rarity: 'rare',
    xp: 150,
    condition: (s) => (s.totalSavings || 0) >= 100000
  },
  {
    id: 'tr_finance_3',
    category: 'finance',
    name: 'Миллионер',
    desc: 'Накопил 1 000 000 ₽',
    icon: '💎',
    rarity: 'epic',
    xp: 500,
    condition: (s) => (s.totalSavings || 0) >= 1000000
  },

  // Habits & Streaks
  {
    id: 'tr_habits_1',
    category: 'habits',
    name: 'Первая привычка',
    desc: 'Создал первую привычку',
    icon: '🌱',
    rarity: 'common',
    xp: 25,
    condition: (s) => (DB.habits?.length || 0) >= 1
  },
  {
    id: 'tr_streak_7',
    category: 'habits',
    name: 'Неделя дисциплины',
    desc: '7 дней подряд',
    icon: '🔥',
    rarity: 'common',
    xp: 50,
    streak: 7,
    condition: (s) => (s.habitStreak || 0) >= 7
  },
  {
    id: 'tr_streak_30',
    category: 'habits',
    name: 'Месяц дисциплины',
    desc: '30 дней подряд',
    icon: '🔥🔥',
    rarity: 'rare',
    xp: 150,
    streak: 30,
    condition: (s) => (s.habitStreak || 0) >= 30
  },
  {
    id: 'tr_master_discipline',
    category: 'habits',
    name: 'Мастер дисциплины',
    desc: '90 дней подряд!',
    icon: '👑',
    rarity: 'legendary',
    xp: 1000,
    streak: 90,
    unlocks: 'c10',
    condition: (s) => (s.habitStreak || 0) >= 90
  }
];

function renderTrophyHall() {
  const container = document.getElementById('achievements-list');
  if (!container) return;

  container.className = 'trophy-hall';

  const s = getAcademyState();
  const unlocked = DB.unlockedAchievements || [];

  // Group by category
  const categories = {
    knowledge: { icon: '📚', title: 'Знания и Академия' },
    tasks: { icon: '📝', title: 'Задачи' },
    finance: { icon: '💰', title: 'Финансы' },
    habits: { icon: '⚡', title: 'Привычки' }
  };

  let html = '';

  Object.entries(categories).forEach(([catKey, catData]) => {
    const catTrophies = TROPHY_DATA.filter(t => t.category === catKey);
    const unlockedCount = catTrophies.filter(t => unlocked.includes(t.id)).length;

    html += `
      <div class="trophy-category">
        <div class="trophy-category-header">
          <span class="trophy-category-icon">${catData.icon}</span>
          <span class="trophy-category-title">${catData.title}</span>
          <span class="trophy-category-count">${unlockedCount}/${catTrophies.length}</span>
        </div>
        <div class="trophy-grid">
          ${catTrophies.map(trophy => renderTrophyItem(trophy, unlocked.includes(trophy.id))).join('')}
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

function renderTrophyItem(trophy, isUnlocked) {
  const statusClass = isUnlocked ? 'earned' : 'locked';
  const displayName = isUnlocked ? trophy.name : '???';
  const displayIcon = isUnlocked ? trophy.icon : '🔒';

  let streakBadge = '';
  if (trophy.streak && isUnlocked) {
    streakBadge = `
      <div class="streak-badge-v2">
        <span class="flame">🔥</span>
        <span>${trophy.streak}</span>
      </div>
    `;
  }

  return `
    <div class="trophy-item-v2 ${trophy.rarity} ${statusClass}" 
         ${isUnlocked ? `onclick="showTrophyDetail('${trophy.id}')"` : ''}
         title="${isUnlocked ? trophy.desc : 'Заблокировано'}">
      ${streakBadge}
      <div class="trophy-icon-v2">${displayIcon}</div>
      <div class="trophy-name-v2">${displayName}</div>
      ${isUnlocked ? `<div class="trophy-xp-v2">+${trophy.xp} XP</div>` : ''}
    </div>
  `;
}

function checkStreakAchievements() {
  const s = getAcademyState();
  const newlyUnlocked = [];

  TROPHY_DATA.forEach(trophy => {
    if (trophy.condition(s)) {
      if (!DB.unlockedAchievements) DB.unlockedAchievements = [];
      if (!DB.unlockedAchievements.includes(trophy.id)) {
        DB.unlockedAchievements.push(trophy.id);
        newlyUnlocked.push(trophy);

        // Award XP
        s.totalXP += trophy.xp;

        // Check for legendary unlock
        if (trophy.rarity === 'legendary') {
          setTimeout(() => showLegendaryUnlock(trophy), 500);
        }

        // Check for hidden course
        if (trophy.unlocks) {
          showHiddenCourseUnlock(trophy);
        }
      }
    }
  });

  if (newlyUnlocked.length > 0) {
    saveDB();
    renderAcademy();
  }

  return newlyUnlocked;
}

function showLegendaryUnlock(trophy) {
  const modal = document.getElementById('legendary-unlock-modal');
  const shardsContainer = document.getElementById('glass-shards-container');

  // Update content
  document.getElementById('legendary-icon').textContent = trophy.icon;
  document.getElementById('legendary-name').textContent = trophy.name;
  document.getElementById('legendary-desc').textContent = trophy.desc;
  document.getElementById('legendary-xp').textContent = `+${trophy.xp} XP`;

  // Create glass shards
  shardsContainer.innerHTML = '';
  for (let i = 0; i < 20; i++) {
    const shard = document.createElement('div');
    shard.className = 'glass-shard';
    const angle = (i / 20) * 360;
    const distance = 150 + Math.random() * 200;
    const tx = Math.cos(angle * Math.PI / 180) * distance;
    const ty = Math.sin(angle * Math.PI / 180) * distance;
    const rot = Math.random() * 360;

    shard.style.setProperty('--tx', `${tx}px`);
    shard.style.setProperty('--ty', `${ty}px`);
    shard.style.setProperty('--rot', `${rot}deg`);
    shard.style.left = '50%';
    shard.style.top = '50%';
    shard.style.animationDelay = `${Math.random() * 0.3}s`;

    shardsContainer.appendChild(shard);
  }

  modal.classList.add('show');

  // Play sound effect (if available)
  // playSound('legendary_unlock');
}

function closeLegendaryUnlock() {
  const modal = document.getElementById('legendary-unlock-modal');
  modal.classList.remove('show');
}

function showTrophyDetail(trophyId) {
  const trophy = TROPHY_DATA.find(t => t.id === trophyId);
  if (!trophy) return;

  showToast(`${trophy.name}: ${trophy.desc}`);
}

function renderDynamicTasks() {
  const container = document.getElementById('problems-list');
  if (!container) return;

  // Check if we already have dynamic tasks for today
  const today = todayISO();
  if (!DB.dynamicTasks || DB.dynamicTasks.date !== today) {
    DB.dynamicTasks = {
      date: today,
      tasks: generateDynamicTasks(),
      completed: []
    };
    saveDB();
  }

  const tasks = DB.dynamicTasks.tasks;
  const completed = DB.dynamicTasks.completed || [];

  // Filter out completed tasks
  const activeTasks = tasks.filter((t, i) => !completed.includes(i));

  if (activeTasks.length === 0) {
    container.innerHTML = '<div class="empty"><div class="empty-ico">🎉</div><div class="empty-t">Все задачи выполнены!</div><div class="empty-s">Заходи завтра за новыми</div></div>';
    return;
  }

  container.innerHTML = activeTasks.map((task, idx) => `
    <div class="dynamic-task-card" id="dt-card-${idx}">
      <div class="dynamic-task-header">
        <div class="dynamic-task-icon">${task.icon}</div>
        <div>
          <div class="dynamic-task-type">Задача дня</div>
          <div class="dynamic-task-title">${task.title}</div>
        </div>
      </div>
      <div class="dynamic-task-data">${task.text}</div>
      <div class="dynamic-task-input-row">
        <input type="number" class="dynamic-task-input" id="dt-input-${idx}" placeholder="Твой ответ..." />
        <button class="dynamic-task-btn" onclick="submitDynamicTask(${idx}, ${task.answer}, ${task.tolerance}, ${task.xp})">Проверить</button>
      </div>
      <div class="dynamic-task-reward">🏆 +${task.xp} XP за правильный ответ</div>
      <div id="dt-feedback-${idx}" style="margin-top:10px;display:none"></div>
    </div>
  `).join('');
}

function submitDynamicTask(taskIdx, correctAnswer, tolerance, xp) {
  const input = document.getElementById(`dt-input-${taskIdx}`);
  const feedback = document.getElementById(`dt-feedback-${taskIdx}`);
  const userAnswer = parseInt(input.value) || 0;

  const isCorrect = Math.abs(userAnswer - correctAnswer) <= tolerance;

  if (isCorrect) {
    feedback.innerHTML = `<div style="background:rgba(45,232,176,.15);border:1px solid rgba(45,232,176,.3);border-radius:10px;padding:12px;color:var(--mint);font-weight:700">✓ Правильно! +${xp} XP</div>`;
    feedback.style.display = 'block';

    // Award XP
    const s = getAcademyState();
    s.totalXP += xp;
    saveDB();

    // Mark as completed
    if (!DB.dynamicTasks.completed) DB.dynamicTasks.completed = [];
    DB.dynamicTasks.completed.push(taskIdx);
    saveDB();

    // Re-render after delay
    setTimeout(renderDynamicTasks, 1500);
    setTimeout(renderAcademy, 1500);
  } else {
    feedback.innerHTML = `<div style="background:rgba(255,107,107,.15);border:1px solid rgba(255,107,107,.3);border-radius:10px;padding:12px;color:var(--coral);font-weight:700">✗ Неправильно. Попробуй ещё раз!</div>`;
    feedback.style.display = 'block';
  }
}

/* ═══════════════════════════════════════
   ACHIEVEMENTS 2.0 - Streaks & Hidden Rewards
═══════════════════════════════════════ */
// Extended achievements with rarity and streaks
const ACHIEVEMENTS_2 = [
  // Streak achievements
  {
    id: 'streak_7',
    name: 'Неделя дисциплины',
    desc: '7 дней подряд выполнял привычки',
    icon: '🔥',
    rarity: 'common',
    xp: 50,
    condition: (s) => (s.habitStreak || 0) >= 7
  },
  {
    id: 'streak_30',
    name: 'Месяц дисциплины',
    desc: '30 дней подряд выполнял привычки',
    icon: '🔥🔥',
    rarity: 'rare',
    xp: 150,
    condition: (s) => (s.habitStreak || 0) >= 30
  },
  {
    id: 'master_discipline',
    name: 'Мастер дисциплины',
    desc: '90 дней подряд выполнял привычки',
    icon: '👑',
    rarity: 'legendary',
    xp: 500,
    condition: (s) => (s.habitStreak || 0) >= 90,
    unlocks: 'c10' // Hidden FIRE course
  },

  // Learning streaks
  {
    id: 'learn_7',
    name: 'Ученик',
    desc: '7 дней подряд учился в Академии',
    icon: '📚',
    rarity: 'common',
    xp: 50,
    condition: (s) => (s.learningStreak || 0) >= 7
  },
  {
    id: 'learn_30',
    name: 'Знаток',
    desc: '30 дней подряд учился в Академии',
    icon: '🎓',
    rarity: 'rare',
    xp: 200,
    condition: (s) => (s.learningStreak || 0) >= 30
  },

  // Financial achievements
  {
    id: 'first_100k',
    name: 'Первая сотка',
    desc: 'Накопил 100 000 ₽',
    icon: '💯',
    rarity: 'common',
    xp: 100,
    condition: (s) => (s.totalSavings || 0) >= 100000
  },
  {
    id: 'first_million',
    name: 'Миллионер',
    desc: 'Накопил 1 000 000 ₽',
    icon: '💰',
    rarity: 'epic',
    xp: 500,
    condition: (s) => (s.totalSavings || 0) >= 1000000
  },

  // Problem solving
  {
    id: 'solver_10',
    name: 'Решала',
    desc: 'Решил 10 задач',
    icon: '🧮',
    rarity: 'common',
    xp: 50,
    condition: (s) => (s.solvedProblemsCount || 0) >= 10
  },
  {
    id: 'solver_50',
    name: 'Математик',
    desc: 'Решил 50 задач',
    icon: '📐',
    rarity: 'rare',
    xp: 200,
    condition: (s) => (s.solvedProblemsCount || 0) >= 50
  }
];



function showHiddenCourseUnlock(achievement) {
  const modal = document.getElementById('hidden-course-unlock');
  const courseName = document.getElementById('hidden-course-name');

  if (modal && courseName) {
    courseName.textContent = achievement.unlocks === 'c10' 
      ? 'FIRE: Финансовая независимость' 
      : 'Скрытый курс';
    modal.classList.add('show');
  }
}

function renderAchievements2() {
  const container = document.getElementById('achievements-list');
  if (!container) return;

  const s = getAcademyState();
  const unlocked = DB.unlockedAchievements || [];

  // Group by rarity
  const byRarity = { legendary: [], epic: [], rare: [], common: [] };

  ACHIEVEMENTS_2.forEach(ach => {
    const isUnlocked = unlocked.includes(ach.id);
    byRarity[ach.rarity].push({ ...ach, isUnlocked });
  });

  const rarityLabels = {
    legendary: '🔴 Легендарные',
    epic: '🟣 Эпические', 
    rare: '🔵 Редкие',
    common: '⚪ Обычные'
  };

  let html = '';
  Object.entries(byRarity).forEach(([rarity, achs]) => {
    if (achs.length === 0) return;
    const unlockedCount = achs.filter(a => a.isUnlocked).length;

    html += `<div style="margin-bottom:16px">`;
    html += `<div style="font-size:.65rem;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;display:flex;justify-content:space-between">`;
    html += `<span>${rarityLabels[rarity]}</span>`;
    html += `<span>${unlockedCount}/${achs.length}</span>`;
    html += `</div>`;
    html += `<div style="display:flex;gap:10px;flex-wrap:wrap">`;

    achs.forEach(ach => {
      html += `
        <div class="trophy-item ${ach.isUnlocked ? 'earned' : 'locked'} achievement-rarity-${rarity}" 
             ${ach.isUnlocked ? `onclick="showAchievementDetail('${ach.id}')"` : ''}
             title="${ach.isUnlocked ? ach.name + ': ' + ach.desc : '???'}">
          <div class="trophy-icon-wrap" style="font-size:1.4rem">
            ${ach.isUnlocked ? ach.icon : '🔒'}
          </div>
          <div class="trophy-name">${ach.isUnlocked ? ach.name : '???'}</div>
          ${ach.isUnlocked ? `<div style="font-size:.55rem;color:var(--gold);font-weight:800">+${ach.xp} XP</div>` : ''}
        </div>
      `;
    });

    html += `</div></div>`;
  });

  container.innerHTML = html;
}

/* ═══════════════════════════════════════
   SHAREABLE INSIGHTS - Social Cards
═══════════════════════════════════════ */


function openShareModal(insightIdx) {
  const insight = DB.insights[insightIdx];
  if (!insight) return;

  const modal = document.getElementById('share-modal-overlay');
  const textEl = document.getElementById('share-card-text');
  const authorEl = document.getElementById('share-card-author');
  const daysEl = document.getElementById('share-card-days');
  const xpEl = document.getElementById('share-card-xp');

  if (textEl) textEl.textContent = '"' + insight.text + '"';
  if (authorEl) authorEl.textContent = '— ' + (insight.author || 'Мой инсайт');

  // Add user stats
  const s = getAcademyState();
  const daysSince = Math.floor((Date.now() - new Date(DB.user.createdAt || Date.now())) / (1000 * 60 * 60 * 24));
  if (daysEl) daysEl.textContent = daysSince;
  if (xpEl) xpEl.textContent = (s.totalXP >= 1000 ? (s.totalXP/1000).toFixed(1) + 'k' : s.totalXP);

  modal.classList.add('show');

  // Store current insight for download
  modal.dataset.currentInsight = insightIdx;
}

function closeShareModal(e) {
  if (e && e.target !== e.currentTarget) return;
  const modal = document.getElementById('share-modal-overlay');
  modal.classList.remove('show');
}

function downloadShareCard() {
  const modal = document.getElementById('share-modal-overlay');
  const preview = document.getElementById('share-card-preview');

  // Use html2canvas or similar in production
  // For now, we'll create a simple download using canvas
  showToast('Карточка сохранена! 📥');

  // In a real implementation, you would:
  // html2canvas(preview).then(canvas => {
  //   const link = document.createElement('a');
  //   link.download = 'nobile-insight.png';
  //   link.href = canvas.toDataURL();
  //   link.click();
  // });

  closeShareModal();
}

function addInsight() {
  const text = document.getElementById('insight-input')?.value.trim();
  if (!text) return;

  if (!DB.insights) DB.insights = [];

  DB.insights.unshift({
    text: text,
    date: todayISO(),
    author: DB.user.name || 'Я',
    tags: extractTags(text)
  });

  saveDB();
  renderInsights();
  closeSheet('insight');
}

function extractTags(text) {
  const tags = [];
  const matches = text.match(/#(\w+)/g);
  if (matches) {
    matches.forEach(m => tags.push(m.replace('#', '')));
  }
  return tags;
}





function renderCoursesList(level) {
  const s = getAcademyState();
  const filtered = level === 'all' ? COURSES : COURSES.filter(c=>c.level===parseInt(level));
  const el = document.getElementById('courses-list');
  if (!el) return;
  const userLevel = DB.user.socialLevel || '';
  const LEVEL_REC = { starter:['c1','c3'], stable:['c1','c2'], cushion:['c2','c4'], capital:['c4'] };
  const recCourses = LEVEL_REC[userLevel] || [];
  const LV_NAMES = {1:'🟢 Основы',2:'🟡 Средний',3:'🔴 Продвинутый'};
  el.innerHTML = filtered.map(c => {
    const done = s.completedCourses.includes(c.id);
    const lvDone = l => COURSES.filter(x=>x.level===l&&s.completedCourses.includes(x.id)).length;
    const isLocked = (c.level===2 && lvDone(1)<2) || (c.level===3 && lvDone(2)<2);
    return `<div class="course-card ${done?'completed':isLocked?'locked':''}" onclick="${isLocked?'showToast(\'Сначала пройди уроки предыдущего уровня\')':'openLesson(\''+c.id+'\')'}">
      <div class="course-card-top">
        <div class="course-icon" style="background:${c.color}">${c.icon}</div>
        <div class="course-info">
          <div class="course-title">${done?'✓ ':''} ${c.title}${(recCourses.includes(c.id)&&!done)?'<span style="font-size:.58rem;background:rgba(45,232,176,.15);color:var(--mint);border-radius:6px;padding:1px 5px;font-weight:700;margin-left:5px">★ Рекомендуется</span>':''}</div>
          <div class="course-meta">${c.time} · ${c.steps.filter(s=>s.type!=='practice'&&s.type!=='challenge').length} шагов · +${c.xp} XP</div>
        </div>
        <div style="font-size:.75rem;color:${done?'var(--mint)':isLocked?'var(--dim)':'var(--gold)'}">
          ${done?'✓':isLocked?'🔒':'▶'}
        </div>
      </div>
      <div class="course-badges">
        <span class="level-badge lv${c.level}">${LV_NAMES[c.level]}</span>
      </div>
      <div style="font-size:.72rem;color:var(--muted);margin-top:8px;line-height:1.4">${c.desc}</div>
    </div>`;
  }).join('');
}


// ══════════════════════════════════════════
//   ЗАДАЧИ — РЕНДЕР И ЛОГИКА
// ══════════════════════════════════════════
let _probFilter = 'all';

function filterProblems(el, cat) {
  _probFilter = cat;
  document.querySelectorAll('#prob-filter-row .stab').forEach(b=>b.classList.remove('on'));
  el.classList.add('on');
  renderProblems();
}

function renderProblems() {
  const el = document.getElementById('problems-list');
  if (!el) return;
  const solved = (DB.academy && DB.academy.solvedProblems) ? DB.academy.solvedProblems : {};
  const list = _probFilter === 'all' ? PROBLEMS : PROBLEMS.filter(p=>p.cat===_probFilter);

  // Stats bar
  const total = PROBLEMS.length;
  const solvedCount = Object.keys(solved).length;
  const totalXP = PROBLEMS.reduce((s,p)=>solved[p.id]?s+p.xp:s, 0);
  const statsHtml = `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 13px;background:var(--s2);border:1px solid var(--line);border-radius:14px;margin-bottom:12px">
    <div style="font-size:.72rem;color:var(--muted)">Решено: <b style="color:var(--text)">${solvedCount}/${total}</b></div>
    <div style="font-size:.72rem;color:var(--muted)">Заработано: <b style="color:var(--gold)">${totalXP} XP</b></div>
    <div style="font-size:.72rem;color:var(--muted)"><div style="display:inline-block;width:60px;height:5px;background:var(--s1);border-radius:3px;vertical-align:middle"><div style="width:${Math.round(solvedCount/total*100)}%;height:100%;background:var(--mint);border-radius:3px"></div></div></div>
  </div>`;

  const DIFF_LABEL = {easy:'Лёгкая',medium:'Средняя',hard:'Сложная'};
  const CAT_LABEL  = {budget:'💰 Бюджет',invest:'📈 Инвестиции',debt:'💳 Долги',scenario:'🎭 Сценарий'};

  el.innerHTML = statsHtml + list.map(p => {
    const isSolved = !!solved[p.id];
    return `<div class="prob-card ${isSolved?'solved':''}" id="prob-${p.id}">
      <div class="prob-card-head">
        <div class="prob-icon" style="background:${p.color}">${p.icon}</div>
        <div class="prob-meta">
          <div class="prob-title">${isSolved?'✓ ':''}${p.title}</div>
          <div class="prob-chips">
            <span class="prob-chip prob-diff-${p.diff}">${DIFF_LABEL[p.diff]}</span>
            <span class="prob-chip" style="background:var(--s3);color:var(--muted)">${CAT_LABEL[p.cat]}</span>
            <span class="prob-xp">+${p.xp} XP</span>
          </div>
        </div>
        ${isSolved ? '<div style="font-size:.8rem;color:var(--mint)">✓</div>' : ''}
      </div>
      <div class="prob-story">${p.story}</div>
      <div class="prob-question">${p.question}</div>
      ${buildProblemInput(p)}
      ${isSolved ? `<div class="prob-feedback correct" id="fb-${p.id}">
        <b>✅ Решено!</b><br><span style="opacity:.8">${p.solution.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>')}</span>
      </div>` : `<div class="prob-feedback" id="fb-${p.id}" style="display:none"></div>`}
    </div>`;
  }).join('');
}

function buildProblemInput(p) {
  if (p.type === 'number') {
    return `<div class="prob-input-row">
      <input class="prob-input" id="pi-${p.id}" type="number" placeholder="Введи ответ" onkeydown="if(event.key==='Enter')checkProblem('${p.id}')">
      <span style="font-size:.72rem;color:var(--dim);align-self:center;white-space:nowrap">${p.unit||''}</span>
      <button class="prob-submit" onclick="checkProblem('${p.id}')">Проверить</button>
    </div>
    <div style="font-size:.65rem;color:var(--dim);margin-bottom:6px;cursor:pointer" onclick="showProbHint('${p.id}')">💡 Подсказка</div>
    <div id="hint-${p.id}" style="display:none;font-size:.72rem;color:var(--muted);padding:7px 11px;background:rgba(245,200,66,.06);border-radius:10px;margin-bottom:8px;border-left:2px solid rgba(245,200,66,.3)">${p.hint||''}</div>`;
  }
  if (p.type === 'choice') {
    return `<div class="prob-options">${p.options.map((o,i)=>
      `<div class="prob-opt" id="po-${p.id}-${i}" onclick="checkChoice('${p.id}',${i})">${o}</div>`
    ).join('')}</div>`;
  }
  if (p.type === 'distribute') {
    const distr = p.fields.map(f=>`
      <div class="prob-dist-row">
        <div class="prob-dist-lbl">${f.label}</div>
        <input class="prob-dist-inp" id="pd-${p.id}-${f.id}" type="number" placeholder="0" oninput="updateDistTotal('${p.id}')">
        <div class="prob-dist-pct" id="pct-${p.id}-${f.id}">0%</div>
      </div>`).join('');
    return `<div class="prob-distribute">${distr}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-size:.7rem;color:var(--muted)">Итого: <span id="dist-total-${p.id}" style="font-weight:700;color:var(--text)">0</span> / ${p.total.toLocaleString('ru')} ₽</div>
        <button class="prob-submit" onclick="checkDistribute('${p.id}')">Проверить</button>
      </div>`;
  }
  return '';
}

function updateDistTotal(pid) {
  const p = PROBLEMS.find(x=>x.id===pid);
  let total = 0;
  p.fields.forEach(f=>{
    const v = parseFloat(document.getElementById(`pd-${pid}-${f.id}`)?.value)||0;
    total += v;
    const pct = document.getElementById(`pct-${pid}-${f.id}`);
    if (pct) pct.textContent = p.total > 0 ? Math.round(v/p.total*100)+'%' : '0%';
  });
  const el = document.getElementById(`dist-total-${pid}`);
  if (el) {
    el.textContent = Math.round(total).toLocaleString('ru');
    el.style.color = Math.abs(total - p.total) < 1 ? 'var(--mint)' : 'var(--coral)';
  }
}

function showProbHint(pid) {
  const el = document.getElementById(`hint-${pid}`);
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function checkProblem(pid) {
  const p = PROBLEMS.find(x=>x.id===pid);
  if (!p) return;
  const solved = (DB.academy && DB.academy.solvedProblems) ? DB.academy.solvedProblems : {};
  if (solved[pid]) return;
  const val = parseFloat(document.getElementById(`pi-${pid}`)?.value);
  if (isNaN(val)) { showToast('Введи число'); return; }
  const tol = p.tolerance !== undefined ? p.tolerance : Math.abs(p.answer)*0.02;
  if (Math.abs(val - p.answer) <= tol) {
    awardProblemXP(pid, p.xp, true);
  } else {
    const fb = document.getElementById(`fb-${pid}`);
    fb.style.display = 'block';
    fb.className = 'prob-feedback wrong';
    fb.innerHTML = `❌ Не совсем. Попробуй ещё раз или посмотри подсказку.`;
  }
}

function checkChoice(pid, idx) {
  const p = PROBLEMS.find(x=>x.id===pid);
  if (!p) return;
  const solved = (DB.academy && DB.academy.solvedProblems) ? DB.academy.solvedProblems : {};
  if (solved[pid]) return;
  document.querySelectorAll(`[id^="po-${pid}-"]`).forEach(el=>el.style.pointerEvents='none');
  const el = document.getElementById(`po-${pid}-${idx}`);
  if (el) el.classList.add(idx === p.correct ? 'correct' : 'wrong');
  const correctEl = document.getElementById(`po-${pid}-${p.correct}`);
  if (correctEl) correctEl.classList.add('correct');
  if (idx === p.correct) {
    awardProblemXP(pid, p.xp, true);
  } else {
    const fb = document.getElementById(`fb-${pid}`);
    fb.style.display = 'block';
    fb.className = 'prob-feedback wrong';
    fb.innerHTML = `❌ Неверно. <br><span style="opacity:.85">${p.solution.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>')}</span>`;
  }
}

function checkDistribute(pid) {
  const p = PROBLEMS.find(x=>x.id===pid);
  if (!p) return;
  const solved = (DB.academy && DB.academy.solvedProblems) ? DB.academy.solvedProblems : {};
  if (solved[pid]) return;
  let total = 0;
  let wrong = false;
  p.fields.forEach(f=>{
    const v = parseFloat(document.getElementById(`pd-${pid}-${f.id}`)?.value)||0;
    total += v;
    const tol = f.tolerance !== undefined ? f.tolerance : f.correct * 0.05;
    if (Math.abs(v - f.correct) > tol) wrong = true;
  });
  if (Math.abs(total - p.total) > 1) {
    showToast(`Итого должно быть ${p.total.toLocaleString('ru')} ₽`); return;
  }
  if (!wrong) {
    awardProblemXP(pid, p.xp, true);
  } else {
    const fb = document.getElementById(`fb-${pid}`);
    fb.style.display = 'block';
    fb.className = 'prob-feedback wrong';
    fb.innerHTML = `❌ Распределение неверное. Попробуй пересчитать проценты.<br><small style="opacity:.7">Подсказка: правильные пропорции в самом вопросе</small>`;
  }
}

function awardProblemXP(pid, xp, correct) {
  const p = PROBLEMS.find(x=>x.id===pid);
  const s = getAcademyState();
  if (!s.solvedProblems) s.solvedProblems = {};
  s.solvedProblems[pid] = true;
  s.totalXP += xp;
  saveDB();

  const fb = document.getElementById(`fb-${pid}`);
  if (fb) {
    fb.style.display = 'block';
    fb.className = 'prob-feedback correct';
    fb.innerHTML = `✅ <b>Верно! +${xp} XP</b><br><span style="opacity:.85">${p.solution.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>')}</span>`;
  }
  const card = document.getElementById(`prob-${pid}`);
  if (card) card.classList.add('solved');
  showToast(`✅ +${xp} XP — задача решена!`);
  renderAcademy();
}


// ── Открыть урок ──
let _currentLesson = null;
let _currentStep = 0;
let _quizAnswered = false;

function openLesson(courseId) {
  const course = COURSES.find(c=>c.id===courseId);
  if (!course) return;
  _currentLesson = course;
  _currentStep = 0;
  _quizAnswered = false;
  document.getElementById('sheet-lesson').classList.add('open');
  renderLessonStep();
}

function closeLesson() {
  document.getElementById('sheet-lesson').classList.remove('open');
  _currentLesson = null;
}

function md(t){ return t.replace(/\*\*(.*?)\*\*/g,'<b>$1</b>').replace(/\n/g,'<br>'); }

function renderLessonStep(dir) {
  const course = _currentLesson;
  const step   = course.steps[_currentStep];
  const total  = course.steps.length;
  const isLast = _currentStep === total - 1;
  const nextBtn = `<button class="btn-primary mt12" onclick="nextLessonStep()">${isLast?'Завершить урок ✓':'Далее →'}</button>`;

  const dots = Array.from({length:total},(_,i) =>
    `<div class="lesson-dot ${i<_currentStep?'done':i===_currentStep?'active':''}"></div>`
  ).join('');

  let content = '';

  // ── READ ──
  if (step.type === 'read') {
    content = `
      <div class="sheet-title">${course.icon} ${step.title}</div>
      <div style="font-size:.83rem;color:var(--muted);line-height:1.65;margin-bottom:20px">${md(step.body)}</div>
      ${nextBtn}`;
  }

  // ── EXAMPLE (кейс с таблицей) ──
  if (step.type === 'example') {
    const rows = step.calc.map(r=>`
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;border-bottom:1px solid var(--line);gap:10px">
        <div style="font-size:.75rem;color:var(--muted);flex:1">${r.label}</div>
        <div style="font-size:.78rem;font-weight:700;color:var(--text);white-space:nowrap">${r.val}</div>
      </div>`).join('');
    content = `
      <div class="sheet-title">📊 ${step.title}</div>
      <div style="font-size:.78rem;color:var(--muted);line-height:1.5;margin-bottom:14px;padding:10px 12px;background:rgba(77,166,255,.05);border-radius:12px;border-left:3px solid rgba(77,166,255,.3)">${step.story}</div>
      <div style="margin-bottom:14px">${rows}</div>
      <div style="font-size:.76rem;padding:10px 12px;background:rgba(45,232,176,.06);border-radius:12px;border-left:3px solid rgba(45,232,176,.35);color:var(--text);line-height:1.55;margin-bottom:16px">💡 ${step.conclusion}</div>
      ${nextBtn}`;
  }

  // ── QUIZ (старый формат, обратная совместимость) ──
  if (step.type === 'quiz') {
    const _qsh = shuffleQuiz(step.options, step.correct);
    content = `
      <div class="sheet-title">🧠 ${step.title}</div>
      <div style="font-size:.88rem;font-weight:600;margin-bottom:14px;line-height:1.45">${step.question}</div>
      <div id="quiz-options">
        ${_qsh.options.map((o,i)=>`<div class="quiz-option" onclick="answerQuiz(${i},${_qsh.correct},${step.explain?JSON.stringify(step.explain):'null'})">${o}</div>`).join('')}
      </div>
      <div id="quiz-feedback" style="display:none;font-size:.78rem;font-weight:600;padding:8px 0"></div>
      <button class="btn-primary mt12" id="quiz-next-btn" style="display:none" onclick="nextLessonStep()">${isLast?'Завершить урок ✓':'Далее →'}</button>`;
  }

  // ── QUIZ_MULTI (несколько вопросов с объяснениями) ──
  if (step.type === 'quiz_multi') {
    window._qmState = { current: 0, score: 0, total: step.questions.length };
    content = buildQuizMulti(step, isLast);
  }

  // ── PRACTICE (калькулятор с формулой) ──
  if (step.type === 'practice') {
    const fieldsHtml = step.fields.map(f=>`
      <div class="practice-field-group">
        <label>${f.label}</label>
        <input class="form-input" id="pf_${f.id}" placeholder="${f.placeholder}" type="${f.type||'number'}"
          inputmode="decimal" style="padding:11px 14px;font-size:.92rem"
          oninput="runPracticeCalc()">
      </div>`).join('');
    content = `
      <div class="sheet-title">🔢 ${step.title}</div>
      <div style="font-size:.78rem;color:var(--muted);margin-bottom:16px;line-height:1.55;padding:10px 12px;background:rgba(77,166,255,.05);border-left:3px solid rgba(77,166,255,.3);border-radius:0 10px 10px 0">${step.desc}</div>
      ${fieldsHtml}
      <button class="practice-calc-btn" onclick="runPracticeCalc(true)">⚡ Рассчитать</button>
      <div class="practice-result-card" id="practice-result">
        <div class="practice-result-title">📊 Результат расчёта</div>
        <div class="practice-result-body" id="practice-result-body"></div>
      </div>
      ${nextBtn}`;
    window._practiceFormula = step.formula;
  }

  // ── CHALLENGE (многодневный вызов) ──
  if (step.type === 'challenge') {
    const dayRows = step.days.map(d=>`
      <div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)">
        <div style="width:28px;height:28px;border-radius:8px;background:rgba(245,200,66,.12);border:1px solid rgba(245,200,66,.25);display:flex;align-items:center;justify-content:center;font-size:.68rem;font-weight:800;color:var(--gold);flex-shrink:0">Д${d.day}</div>
        <div style="font-size:.78rem;color:var(--muted);line-height:1.45;flex:1">${d.task}</div>
      </div>`).join('');
    content = `
      <div class="sheet-title">🏆 ${step.title}</div>
      <div style="font-size:.78rem;color:var(--muted);margin-bottom:14px;line-height:1.5">${step.desc}</div>
      <div style="margin-bottom:16px">${dayRows}</div>
      <div style="padding:10px 12px;background:rgba(45,232,176,.06);border-radius:12px;font-size:.74rem;color:var(--mint);margin-bottom:16px">✓ Сохрани этот список и выполняй по одному пункту в день</div>
      ${nextBtn}`;
  }

  // ── TASK ──
  if (step.type === 'task') {
    content = `
      <div class="sheet-title">🎯 ${step.title}</div>
      <div style="font-size:.84rem;color:var(--muted);line-height:1.55;margin-bottom:18px">${step.body}</div>
      <button class="btn-primary mb8" onclick="goToTarget('${step.target}')">${step.action}</button>
      <button class="btn-secondary" onclick="nextLessonStep()">${isLast?'Завершить урок ✓':'Пропустить →'}</button>`;
  }

  const _lsc = document.getElementById('lesson-sheet-content');
  _lsc.innerHTML = `
    <div style="padding:0 2px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:.68rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em">${course.title}</div>
        <div style="font-size:.7rem;color:var(--gold);font-weight:700">${_currentStep+1}/${total} · +${course.xp} XP</div>
      </div>
      <div class="lesson-progress-dots">${dots}</div>
      ${content}
    </div>`;
  // Animate
  const _lscDiv = _lsc.querySelector('div');
  if (_lscDiv && dir) {
    _lscDiv.classList.add(dir === 'back' ? 'lesson-slide-back' : 'lesson-slide-in');
  }
  // Init practice calculator if present
  if (step.type === 'practice') runPracticeCalc();
}

function buildQuizMulti(step, isLast) {
  const qRaw = step.questions[window._qmState.current];
  const qNum = window._qmState.current + 1;
  const qTotal = step.questions.length;
  // Shuffle options, store shuffled correct index on state
  const _sh = shuffleQuiz(qRaw.opts, qRaw.correct);
  window._qmState.shuffledCorrect = _sh.correct;
  window._qmState.shuffledOpts = _sh.options;
  return `
    <div class="sheet-title">🧠 ${step.title}</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <div style="font-size:.65rem;font-weight:700;color:var(--muted)">Вопрос ${qNum} из ${qTotal}</div>
      <div style="flex:1;height:3px;background:var(--s2);border-radius:2px;overflow:hidden">
        <div style="width:${(qNum-1)/qTotal*100}%;height:100%;background:var(--gold);transition:width .3s"></div>
      </div>
    </div>
    <div style="font-size:.88rem;font-weight:600;margin-bottom:14px;line-height:1.45">${qRaw.q}</div>
    <div id="qm-options">
      ${_sh.options.map((o,i)=>`<div class="quiz-option" onclick="answerQM(${i})">${o}</div>`).join('')}
    </div>
    <div id="qm-explain" style="display:none;font-size:.76rem;line-height:1.5;padding:10px 12px;border-radius:11px;margin-top:10px"></div>
    <button class="btn-primary mt12" id="qm-next-btn" style="display:none"
      onclick="${qNum < qTotal ? 'nextQM()' : `showQMResult(${step.questions.length},${isLast})`}">
      ${qNum < qTotal ? 'Следующий вопрос →' : 'Посмотреть результат →'}
    </button>`;
}

function answerQM(idx) {
  if (document.getElementById('qm-next-btn').style.display === 'block') return;
  const step = _currentLesson.steps[_currentStep];
  const q = step.questions[window._qmState.current];
  // Use shuffled correct index stored in state
  const correct = (window._qmState.shuffledCorrect !== undefined) ? window._qmState.shuffledCorrect : q.correct;
  const opts = document.querySelectorAll('#qm-options .quiz-option');
  opts[idx].classList.add(idx === correct ? 'correct' : 'wrong');
  opts[correct].classList.add('correct');
  if (idx === correct) window._qmState.score++;
  const ex = document.getElementById('qm-explain');
  ex.style.display = 'block';
  ex.style.background = idx === correct ? 'rgba(45,232,176,.08)' : 'rgba(255,107,107,.08)';
  ex.style.border = `1px solid ${idx === correct ? 'rgba(45,232,176,.25)' : 'rgba(255,107,107,.25)'}`;
  ex.innerHTML = `${idx === correct ? '✅' : '❌'} <b>${idx === correct ? 'Верно!' : 'Неверно.'}</b> ${q.explain}`;
  document.getElementById('qm-next-btn').style.display = 'block';
}

function nextQM() {
  window._qmState.current++;
  const step = _currentLesson.steps[_currentStep];
  const isLast = _currentStep === _currentLesson.steps.length - 1;
  document.getElementById('lesson-sheet-content').querySelector('div').innerHTML =
    document.getElementById('lesson-sheet-content').querySelector('div').innerHTML;
  // Re-render quiz multi
  const el = document.getElementById('lesson-sheet-content');
  const dots = Array.from({length:_currentLesson.steps.length},(_,i) =>
    `<div class="lesson-dot ${i<_currentStep?'done':i===_currentStep?'active':''}"></div>`
  ).join('');
  el.innerHTML = `<div style="padding:0 2px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-size:.68rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em">${_currentLesson.title}</div>
      <div style="font-size:.7rem;color:var(--gold);font-weight:700">${_currentStep+1}/${_currentLesson.steps.length} · +${_currentLesson.xp} XP</div>
    </div>
    <div class="lesson-progress-dots">${dots}</div>
    ${buildQuizMulti(step, isLast)}
  </div>`;
}

function showQMResult(total, isLast) {
  const score = window._qmState.score;
  const pct = Math.round(score/total*100);
  const msg = pct===100 ? '🏆 Идеально!' : pct>=70 ? '✅ Отлично!' : pct>=50 ? '👍 Неплохо' : '📚 Повтори материал';
  const el = document.getElementById('lesson-sheet-content').querySelector('div');
  el.innerHTML += `
    <div id="qm-result" style="text-align:center;padding:16px 0">
      <div style="font-size:2rem;margin-bottom:8px">${msg.split(' ')[0]}</div>
      <div style="font-family:var(--font-head);font-size:1rem;font-weight:800;margin-bottom:6px">${msg.slice(2)}</div>
      <div style="font-size:.82rem;color:var(--muted);margin-bottom:16px">${score} из ${total} правильно (${pct}%)</div>
      <button class="btn-primary" onclick="nextLessonStep()">${isLast?'Завершить урок ✓':'Далее →'}</button>
    </div>`;
  document.getElementById('qm-next-btn').style.display='none';
}

function runPracticeCalc(scroll) {
  const card = document.getElementById('practice-result');
  const body = document.getElementById('practice-result-body');
  if (!card || !body || !window._practiceFormula) return;
  try {
    const f = {};
    document.querySelectorAll('[id^="pf_"]').forEach(el => {
      const key = el.id.replace('pf_', '');
      f[key] = el.value;
    });
    const calcFn = new Function('f', window._practiceFormula);
    const result = calcFn(f);
    if (result) {
      // Reset animation by removing and re-adding class
      card.style.display = 'none';
      body.innerHTML = result;
      card.style.display = 'block';
      // Re-trigger animation
      card.classList.remove('practice-result-card');
      void card.offsetWidth; // reflow
      card.classList.add('practice-result-card');
      // Scroll to result
      if (scroll) {
        setTimeout(() => card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
      }
    }
  } catch(e) {
    if (body) body.innerHTML = '<span style="color:var(--coral)">Ошибка расчёта: ' + e.message + '</span>';
    if (card) card.style.display = 'block';
  }
}

function shuffleQuiz(options, correctIdx) {
  // Fisher-Yates shuffle keeping track of correct answer position
  const indexed = options.map((opt, i) => ({ opt, isCorrect: i === correctIdx }));
  for (let i = indexed.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indexed[i], indexed[j]] = [indexed[j], indexed[i]];
  }
  return {
    options: indexed.map(x => x.opt),
    correct: indexed.findIndex(x => x.isCorrect)
  };
}

function answerQuiz(idx, correct, explain) {
  if (_quizAnswered) return;
  _quizAnswered = true;
  const opts = document.querySelectorAll('.quiz-option');
  opts[idx].classList.add(idx===correct?'correct':'wrong');
  opts[correct].classList.add('correct');
  const fb = document.getElementById('quiz-feedback');
  fb.style.display = 'block';
  if (idx===correct) {
    fb.innerHTML = '✅ Верно! Отличная работа.';
    fb.style.color = 'var(--mint)';
  } else {
    fb.innerHTML = '❌ Не совсем. Правильный ответ выделен.';
    fb.style.color = 'var(--coral)';
  }
  if (explain) { fb.innerHTML += `<br><span style="color:var(--muted)">${explain}</span>`; }
  document.getElementById('quiz-next-btn').style.display = 'block';
}

function nextLessonStep() {
  _quizAnswered = false;
  if (_currentStep < _currentLesson.steps.length - 1) {
    _currentStep++;
    renderLessonStep('forward');
  } else {
    completeLessonCourse();
  }
}

function completeLessonCourse() {
  const course = _currentLesson;
  const s = getAcademyState();
  const alreadyDone = s.completedCourses.includes(course.id);
  const reviewXP = Math.round(course.xp * 0.2);

  if (!alreadyDone) {
    s.completedCourses.push(course.id);
    s.lessonsCompleted++;
    s.totalXP += course.xp;
    const today = todayISO();
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
    const yest = localDateISO(yesterday);
    s.learningStreak = s.lastLearnDate === yest ? s.learningStreak + 1 : (s.lastLearnDate === today ? s.learningStreak : 1);
    s.lastLearnDate = today;
    saveDB();
  } else {
    s.totalXP += reviewXP;
    saveDB();
  }

  if (alreadyDone) {
    document.getElementById('lesson-sheet-content').innerHTML = `
      <div class="lesson-reward">
        <div style="font-size:3rem;margin-bottom:12px">🔄</div>
        <div style="font-family:var(--font-head);font-size:1.1rem;font-weight:800;margin-bottom:6px">Знания закреплены!</div>
        <div class="reward-xp" style="background:rgba(167,139,250,.15);color:#a78bfa;border-color:rgba(167,139,250,.3)">+${reviewXP} XP за повтор</div>
        <div style="font-size:.78rem;color:var(--muted);margin:10px 0 6px">Повторение — мать учения.</div>
        <div style="background:rgba(77,166,255,.07);border:1px solid rgba(77,166,255,.15);border-radius:12px;padding:12px;font-size:.75rem;color:var(--muted);line-height:1.5;margin-bottom:20px;text-align:left">
          💡 <b>Факт:</b> Повторное изучение через 1–7 дней увеличивает долгосрочное запоминание на 80%. Ты делаешь всё правильно.
        </div>
        <button class="btn-primary" onclick="closeLesson();renderAcademy()">Отлично! ✓</button>
      </div>`;
  } else {
    const xpBefore = s.totalXP - course.xp;
    const levelBefore = getCurrentLevel(xpBefore);
    const levelAfter  = getCurrentLevel(s.totalXP);
    const levelUp = levelAfter.level > levelBefore.level;
    document.getElementById('lesson-sheet-content').innerHTML = `
      <div class="lesson-reward">
        <div style="font-size:3rem;margin-bottom:12px">${levelUp ? '🏆' : '🎉'}</div>
        <div style="font-family:var(--font-head);font-size:1.1rem;font-weight:800;margin-bottom:6px">${levelUp ? 'Новый уровень!' : 'Урок пройден!'}</div>
        ${levelUp ? `<div style="font-size:.9rem;color:var(--gold);font-weight:700;margin-bottom:8px">${levelAfter.badge} ${levelAfter.name}</div>` : ''}
        <div class="reward-xp">+${course.xp} XP</div>
        <div style="font-size:.78rem;color:var(--muted);margin-top:8px;margin-bottom:24px">${course.title}</div>
        <button class="btn-primary" onclick="closeLesson();renderAcademy()">Отлично! ✓</button>
      </div>`;
  }
}


function completeDailyChallenge(challenge, idx) {
  const s = getAcademyState();
  s.dailyChallengeDate = todayISO();
  s.dailyChallengeDone = true;
  s.totalXP += challenge.xp;
  saveDB();
  showToast('⭐ Задание выполнено! +' + challenge.xp + ' XP');
  const targets = { 'system': ()=>navTo('system'), 'capital': ()=>navTo('capital'), 'growth': ()=>navTo('growth'), 'academy': ()=>{navTo('academy');} };
  if (challenge.target === 'tx-expense') openSheet('tx','expense');
  else if (targets[challenge.target]) targets[challenge.target]();
  renderAcademy();
}

function goToTarget(target) {
  const course = _currentLesson;
  if (course) {
    const s = getAcademyState();
    const alreadyDone = s.completedCourses.includes(course.id);
    if (!alreadyDone) {
      s.completedCourses.push(course.id);
      s.lessonsCompleted++;
      s.totalXP += course.xp;
      const today = todayISO();
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
      const yest = localDateISO(yesterday);
      s.learningStreak = s.lastLearnDate === yest ? s.learningStreak + 1 : (s.lastLearnDate === today ? s.learningStreak : 1);
      s.lastLearnDate = today;
      saveDB();
      showToast('🎉 Урок завершён! +' + course.xp + ' XP');
    }
  }
  closeLesson();
  renderAcademy();
  if (target === 'capital-budget') {
    navTo('capital');
    setTimeout(() => { const btn = document.querySelector('[data-cap="budget"]'); if (btn) btn.click(); }, 150);
  } else if (target === 'capital-assets') {
    navTo('capital');
    setTimeout(() => {
      const btn = document.querySelector('[data-cap="assets"]');
      if (btn) btn.click();
      setTimeout(() => openNewAssetSheet(), 200);
    }, 150);
  } else if (target === 'capital') {
    navTo('capital');
  } else if (target === 'system') {
    navTo('system');
  } else if (target === 'growth') {
    navTo('growth');
  } else if (target === 'academy') {
    navTo('academy');
  }
}

/* ═══════════════════════════════════════
   SETTINGS
═══════════════════════════════════════ */
let _alertThreshold = 85;

function openSettings() {
  if (!DB.settings) DB.settings = {};
  // Load AI key into field
  loadAIKeyField();
  // Security
  setSegActive('lock-timeout-seg', DB.settings.lockTimeout ?? 0);
  // Display
  setSegActive('currency-seg', DB.settings.currency || 'RUB');
  setSegActive('numfmt-seg', DB.settings.numFmt || 'space');
  setSegActive('budget-day-seg', DB.settings.budgetDay || 1);
  // Finance
  setSegActive('alert-threshold-seg', DB.user.alertThreshold || 85);
  setSegActive('savings-rate-seg', DB.settings.savingsRate || 20);
  const rateEl = document.getElementById('set-rate-display');
  if (rateEl) rateEl.textContent = (DB.settings.selectedRate || 10) + '%';
  // Notifications
  const email = document.getElementById('set-email');
  if (email) email.value = DB.user.email || '';
  const notifTime = document.getElementById('set-notif-time');
  if (notifTime) notifTime.value = DB.settings.notifTime || '20:00';
  const togPush = document.getElementById('tog-push');
  if (togPush) togPush.checked = !!DB.settings.pushEnabled;
  const pushLabel = document.getElementById('push-status-label');
  if (pushLabel) pushLabel.textContent = DB.settings.pushEnabled ? 'Включены' : 'Нажмите чтобы включить';
  ['payments','budget','habits','weekly','ai'].forEach(k => {
    const el = document.getElementById('nt-' + k);
    if (el) el.checked = DB.settings['nt_' + k] !== false;
  });
  openSheet('settings');
}

function openProfileSheet() {
  if (!DB.settings) DB.settings = {};
  // Fill fields
  const nm = document.getElementById('prof-name');
  if (nm) nm.value = DB.user.name || '';
  const em = document.getElementById('prof-email');
  if (em) em.value = DB.user.email || '';
  const dob = document.getElementById('prof-dob');
  if (dob) dob.value = DB.user.dob || '';
  const gl = document.getElementById('prof-goal');
  if (gl) gl.value = DB.user.goal || 7900000;
  // Goal type
  setSegActive('goal-type-seg', DB.user.goalType || 'save');
  // Avatar
  const grad = DB.user.avatarColor || '#7c3aed,#4f46e5';
  const initials = (DB.user.name || 'НБ').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2) || 'НБ';
  const bigAv = document.getElementById('prof-avatar-big');
  if (bigAv) { bigAv.textContent = initials; bigAv.style.background = 'linear-gradient(135deg,' + grad + ')'; }
  document.querySelectorAll('#sheet-profile .avatar-swatch').forEach(sw => {
    sw.classList.toggle('active', sw.dataset.grad === grad);
  });
  // Stats
  const since = document.getElementById('prof-since');
  if (since) since.textContent = DB.user.createdAt ? new Date(DB.user.createdAt).toLocaleDateString('ru') : 'Недавно';
  const txCount = document.getElementById('prof-tx-count');
  if (txCount) txCount.textContent = (DB.transactions || []).length + ' операций';
  const habCount = document.getElementById('prof-habits-count');
  if (habCount) habCount.textContent = (DB.habits || []).length + ' привычек';
  const xpEl = document.getElementById('prof-xp');
  try { if (xpEl) xpEl.textContent = (getAcademyState().totalXP || 0) + ' XP'; } catch(e) {}

  // Update goal progress and FIRE number
  setTimeout(() => {
    updateGoalProgressDisplay();
    updateFIRENumber();
  }, 100);

  openSheet('profile');
}

function saveProfile() {
  const nm = document.getElementById('prof-name')?.value.trim();
  if (nm) DB.user.name = nm;
  const em = document.getElementById('prof-email')?.value.trim();
  if (em !== undefined) DB.user.email = em;
  const dob = document.getElementById('prof-dob')?.value;
  if (dob) DB.user.dob = dob;
  const gl = parseFloat(document.getElementById('prof-goal')?.value);
  if (gl) DB.user.goal = gl;
  if (!DB.user.createdAt) DB.user.createdAt = Date.now();
  saveDB(); updateAvatar(); renderAll();
  closeSheet('profile');
  showToast('✅ Профиль сохранён');
}

function setSegActive(containerId, value) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.sp-seg-btn').forEach(btn => {
    const bval = btn.dataset.val;
    btn.classList.toggle('active', String(bval) === String(value));
  });
}

function selectLockTimeout(el, val) {
  if (!DB.settings) DB.settings = {};
  DB.settings.lockTimeout = val;
  setSegActive('lock-timeout-seg', val);
  saveDB();
}

function selectCurrency(el, val) {
  if (!DB.settings) DB.settings = {};
  DB.settings.currency = val;
  setSegActive('currency-seg', val);
  saveDB();
  showToast('💱 Валюта изменена на ' + val);
}

function selectNumFmt(el, val) {
  if (!DB.settings) DB.settings = {};
  DB.settings.numFmt = val;
  setSegActive('numfmt-seg', val);
  saveDB();
}

function selectBudgetDay(el, val) {
  if (!DB.settings) DB.settings = {};
  DB.settings.budgetDay = val;
  setSegActive('budget-day-seg', val);
  saveDB();
}

function selectAlertThresholdNew(el, val) {
  DB.user.alertThreshold = val;
  setSegActive('alert-threshold-seg', val);
  saveDB();
}

function selectSavingsRate(el, val) {
  if (!DB.settings) DB.settings = {};
  DB.settings.savingsRate = val;
  setSegActive('savings-rate-seg', val);
  saveDB();
}

function selectGoalType(el, val) {
  DB.user.goalType = val;
  setSegActive('goal-type-seg', val);
}

function setAvatarColor(el, c1, c2) {
  DB.user.avatarColor = c1 + ',' + c2;
  document.querySelectorAll('.avatar-swatch').forEach(sw => sw.classList.remove('active'));
  el.classList.add('active');
  const bigAv = document.getElementById('prof-avatar-big');
  if (bigAv) bigAv.style.background = 'linear-gradient(135deg,' + c1 + ',' + c2 + ')';
  updateAvatar();
}

function saveSetting(key, val) {
  if (!DB.settings) DB.settings = {};
  DB.settings[key] = val;
  saveDB();
}


function selectAvatarColor(el, gradient) {
  document.querySelectorAll('[data-color]').forEach(e => e.style.borderColor = 'transparent');
  el.style.borderColor = 'var(--text)';
  DB.user.avatarColor = gradient;
}

function adjustRate(delta) {
  if (!DB.settings) DB.settings = { monthOffset: 0, selectedRate: 10 };
  DB.settings.selectedRate = Math.max(1, Math.min(30, (DB.settings.selectedRate || 10) + delta));
  const el = document.getElementById('set-rate-display');
  if (el) el.textContent = DB.settings.selectedRate + '%';
}

function closeModal(id){var el=document.getElementById(id);if(el)el.remove();}
function exportData(){try{var obj={_info:{app:"Nobile",date:new Date().toISOString()},data:DB};var json=JSON.stringify(obj,null,2);var fname="nobile-backup-"+todayISO()+".json";_openExpM(json,fname);}catch(e){showToast("Ошибка: "+e.message);}}
function _openExpM(json,fname){var id="_em_";var ex=document.getElementById(id);if(ex)ex.remove();var ov=document.createElement("div");ov.id=id;ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:29999;display:flex;align-items:flex-end;padding:16px;box-sizing:border-box";var box=document.createElement("div");box.style.cssText="background:var(--s1);border:1px solid var(--line);border-radius:20px;padding:20px;width:100%;max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:12px;box-sizing:border-box";var kb=Math.round(json.length/1024);var txn=(DB.transactions||[]).length;var hdr=document.createElement("div");hdr.textContent="Резервная копия "+fname+" "+kb+" KB";hdr.style.cssText="font-family:Syne,sans-serif;font-size:.9rem;font-weight:800;margin-bottom:4px";box.appendChild(hdr);var ta=document.createElement("textarea");ta.value=json;ta.readOnly=true;ta.style.cssText="height:80px;background:#0d1117;border:1px solid var(--line);border-radius:10px;color:#8b949e;font-size:.44rem;padding:8px;font-family:monospace;resize:none;width:100%;box-sizing:border-box";ta.addEventListener("focus",function(){ta.select();ta.setSelectionRange(0,99999);});box.appendChild(ta);var st=document.createElement("div");st.style.cssText="font-size:.72rem;color:var(--muted);text-align:center";st.textContent="Скопируйте и вставьте в Telegram Избранное";box.appendChild(st);var bc=document.createElement("button");bc.style.cssText="background:var(--blue);border:none;color:white;padding:14px;border-radius:14px;font-family:Syne,sans-serif;font-size:.9rem;font-weight:700;cursor:pointer;width:100%";bc.textContent="Скопировать в буфер обмена";bc.addEventListener("click",function(){ta.select();ta.setSelectionRange(0,99999);var ok=function(){bc.textContent="Скопировано!";bc.style.background="rgba(45,232,176,.2)";bc.style.color="var(--mint)";};if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(json).then(ok).catch(function(){try{document.execCommand("copy");ok();}catch(ex){}});}else{try{document.execCommand("copy");ok();}catch(ex){}}});box.appendChild(bc);if(typeof navigator.share==="function"){var bs=document.createElement("button");bs.style.cssText="background:var(--s2);border:1px solid var(--line);color:var(--text);padding:13px;border-radius:14px;font-family:Syne,sans-serif;font-size:.86rem;font-weight:700;cursor:pointer;width:100%";bs.textContent="Поделиться (Telegram, Drive...)";bs.addEventListener("click",function(){var sd={title:"Nobile Backup",text:json};try{var f=new File([json],fname,{type:"application/json"});if(navigator.canShare&&navigator.canShare({files:[f]}))sd.files=[f];}catch(ex){}navigator.share(sd).then(function(){st.textContent="Отправлено!";st.style.color="var(--mint)";}).catch(function(ex){if(ex.name!="AbortError"){st.textContent="Не удалось";st.style.color="var(--coral)";}});});box.appendChild(bs);}var bx=document.createElement("button");bx.style.cssText="background:none;border:none;color:var(--muted);padding:8px;cursor:pointer;width:100%;font-size:.8rem";bx.textContent="Закрыть";bx.addEventListener("click",function(){ov.remove();});box.appendChild(bx);ov.appendChild(box);document.body.appendChild(ov);ov.addEventListener("click",function(ev){if(ev.target===ov)ov.remove();});}
function importData(){var id="_im_";var ex=document.getElementById(id);if(ex)ex.remove();var ov=document.createElement("div");ov.id=id;ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:29999;display:flex;align-items:flex-end;padding:16px;box-sizing:border-box";var box=document.createElement("div");box.style.cssText="background:var(--s1);border:1px solid var(--line);border-radius:20px;padding:20px;width:100%;max-width:420px;margin:0 auto;display:flex;flex-direction:column;gap:12px;box-sizing:border-box;max-height:90vh;overflow-y:auto";var hdr=document.createElement("div");hdr.textContent="Импорт данных";hdr.style.cssText="font-family:Syne,sans-serif;font-size:.9rem;font-weight:800;margin-bottom:6px";var sub2=document.createElement("div");sub2.style.cssText="font-size:.74rem;color:var(--muted)";sub2.textContent="Вставьте JSON резервной копии ниже. Текущие данные будут заменены.";box.appendChild(sub2);box.appendChild(hdr);var ta=document.createElement("textarea");ta.placeholder="Вставьте сюда JSON из буфера обмена...";ta.style.cssText="height:140px;background:#0d1117;border:1px solid var(--line);border-radius:10px;color:var(--text);font-size:.7rem;padding:10px;font-family:monospace;resize:none;width:100%;box-sizing:border-box";box.appendChild(ta);var lbl=document.createElement("div");lbl.style.cssText="display:flex;align-items:center;gap:10px;background:var(--s2);border:1px solid var(--line);border-radius:14px;padding:13px;cursor:pointer";lbl.innerHTML="<span>\uD83D\uDCCE</span><div><div style='font-size:.84rem;font-weight:600'>Или выбрать .json файл</div><div style='font-size:.68rem;color:var(--muted)'>nobile-backup-YYYY-MM-DD.json</div></div>";var fi=document.createElement("input");fi.type="file";fi.accept=".json,application/json";fi.style.display="none";fi.addEventListener("change",function(){if(!fi.files[0])return;var r=new FileReader();r.onload=function(ev){ta.value=ev.target.result;st.textContent="Файл загружен";st.style.color="var(--mint)";};r.readAsText(fi.files[0]);});lbl.appendChild(fi);lbl.addEventListener("click",function(){fi.click();});box.appendChild(lbl);var st=document.createElement("div");st.style.cssText="font-size:.72rem;color:var(--muted);text-align:center;min-height:14px";box.appendChild(st);var br=document.createElement("button");br.style.cssText="background:var(--blue);border:none;color:white;padding:14px;border-radius:14px;font-family:Syne,sans-serif;font-size:.9rem;font-weight:700;cursor:pointer;width:100%";br.textContent="Восстановить данные";br.addEventListener("click",function(){var raw=ta.value.trim();if(!raw){st.textContent="Вставьте данные";st.style.color="var(--coral)";return;}try{var parsed=JSON.parse(raw);var imp=parsed.data||parsed;if(!imp.user&&!imp.transactions)throw new Error("Неверный формат");DB=Object.assign({},DB,imp);if(_cryptoKey){saveDB().then(function(){renderAll();ov.remove();showToast("Данные восстановлены!");});}else{localStorage.setItem("nobile_db",JSON.stringify(DB));renderAll();ov.remove();showToast("Данные восстановлены!");}}catch(ex){st.textContent="Ошибка: "+ex.message;st.style.color="var(--coral)";}});box.appendChild(br);var bx2=document.createElement("button");bx2.style.cssText="background:none;border:none;color:var(--muted);padding:8px;cursor:pointer;width:100%;font-size:.8rem";bx2.textContent="Отмена";bx2.addEventListener("click",function(){ov.remove();});box.appendChild(bx2);ov.appendChild(box);document.body.appendChild(ov);ov.addEventListener("click",function(ev){if(ev.target===ov)ov.remove();});}
function selectAlertThreshold(el, val) {
  _alertThreshold = val;
  document.querySelectorAll('[onclick*="selectAlertThreshold"]').forEach(b => {
    b.classList.remove('on-income');
    b.classList.add('seg');
  });
  el.classList.add('on-income');
}


function openBudgetDetail(key) {
  const stats = calcStats();
  const budget = calcBudget5020(stats.income, stats.expense);
  if (!budget) {
    showToast('📊 Добавьте доходы для анализа бюджета');
    return;
  }

  const DEFS = {
    needs: {
      emoji: '🏠', title: 'Необходимые расходы', pct: 50,
      gradient: 'linear-gradient(135deg,rgba(77,166,255,.15),rgba(77,166,255,.05))',
      accentColor: 'var(--blue)',
      what: 'Аренда, ЖКХ, продукты, транспорт, медицина — всё что нужно для жизни.',
      story: 'По правилу 50/30/20 ровно половина дохода должна покрывать базовые потребности. Если вы тратите меньше — отличный сигнал финансового здоровья.',
      tips: [
        { ico: '🛒', title: 'Оптимизируйте продукты', body: 'Составьте список на неделю — исследования показывают экономию 20-30% на еде без потери качества.' },
        { ico: '🚇', title: 'Транспорт', body: 'Годовой проездной часто выгоднее в 1.5-2 раза. Подсчитайте реальную стоимость автомобиля — она обычно удивляет.' },
        { ico: '📱', title: 'Подписки и тарифы', body: 'Раз в 6 месяцев пересматривайте телефон, интернет, страховки. Операторы часто дают скидку при запросе.' }
      ],
      courseId: 'c6', courseName: 'Бюджет на месяц',
      taskFilter: 'Бюджет'
    },
    wants: {
      emoji: '✨', title: 'Желания и удовольствия', pct: 30,
      gradient: 'linear-gradient(135deg,rgba(245,200,66,.15),rgba(245,200,66,.05))',
      accentColor: 'var(--gold)',
      what: 'Кафе, развлечения, одежда, хобби, путешествия — всё что улучшает жизнь.',
      story: '30% на желания — это не слабость, а необходимость. Слишком жёсткие ограничения ведут к срывам. Осознанное потребление внутри лимита = баланс.',
      tips: [
        { ico: '☕', title: 'Осознанные траты', body: '"Правило 24 часов": перед покупкой на 1000+ ₽ подождите сутки. Половина желаний исчезает сама.' },
        { ico: '🎯', title: 'Envelope method', body: 'Выделите наличные на удовольствия в начале месяца. Когда конверт пуст — стоп. Физические деньги создают реальное ощущение трат.' },
        { ico: '🏷️', title: 'Wishlist вместо импульсов', body: 'Держите список желаний. Покупайте только из него — со временем приоритеты меняются и многое отпадает.' }
      ],
      courseId: 'c1', courseName: 'Правило 50/30/20',
      taskFilter: 'Бюджет'
    },
    savings: {
      emoji: '🏦', title: 'Накопления', pct: 20,
      gradient: 'linear-gradient(135deg,rgba(45,232,176,.15),rgba(45,232,176,.05))',
      accentColor: 'var(--mint)',
      what: 'Подушка безопасности, инвестиции, крупные цели — деньги которые работают на вас.',
      story: 'Уоррен Баффет начинал откладывать в 11 лет. Главное правило богатства: "Сначала плати себе". Даже 5% от дохода — лучше нуля.',
      tips: [
        { ico: '⚡', title: 'Автоматизация', body: 'Настройте автоперевод в день зарплаты. Деньги которые вы не видите — не тратятся. Самая работающая стратегия.' },
        { ico: '📈', title: 'Подушка → Инвестиции', body: 'Сначала накопите 3-6 месяцев расходов. Потом инвестируйте: даже банковский депозит под 15% лучше нуля.' },
        { ico: '🎯', title: 'Дробите цели', body: 'Большая цель пугает. Разбейте на этапы: 10 000 → 50 000 → 100 000. Каждый шаг — победа и мотивация.' }
      ],
      courseId: 'c2', courseName: 'Сложный процент',
      taskFilter: 'Инвестиции'
    }
  };

  const def = DEFS[key];
  const data = budget[key];
  const factPct = data.limit > 0 ? Math.round(data.fact / data.limit * 100) : 0;
  const remaining = data.limit - data.fact;
  const isGood = key === 'savings' ? factPct >= 100 : factPct <= 85;
  const statusColor = isGood ? 'var(--mint)' : factPct > 100 ? 'var(--coral)' : 'var(--gold)';
  const statusMsg = key === 'savings'
    ? (factPct >= 100 ? '✅ Цель выполнена!' : factPct > 0 ? `📈 ${factPct}% от цели` : '⚠️ Не откладывалось')
    : (factPct <= 85 ? '✅ В норме' : factPct <= 100 ? '⚠️ Почти лимит' : `🔴 Перерасход ${factPct - 100}%`);

  // Get category breakdown for this bucket
  const monthTx = getMonthTx();
  const needCats = ['food','transport','housing','health','education'];
  const wantCats = ['entertainment','clothes','cafe','other'];
  const saveCats = ['savings'];
  const bucketCats = { needs: needCats, wants: wantCats, savings: saveCats }[key];
  const txInBucket = monthTx.filter(t => t.type === 'expense' && bucketCats.includes(t.category));
  const catBreakdown = {};
  txInBucket.forEach(t => { catBreakdown[t.category] = (catBreakdown[t.category]||0) + t.amount; });
  const CAT_LABELS = { food:'🛒 Питание', transport:'🚗 Транспорт', housing:'🏠 Жильё',
    health:'💊 Здоровье', entertainment:'🎮 Развлечения', clothes:'👗 Одежда',
    education:'📚 Образование', cafe:'☕ Кафе', other:'📦 Прочее', savings:'🏦 Накопления' };
  const catHtml = Object.entries(catBreakdown).sort((a,b)=>b[1]-a[1]).map(([cat,amt]) => {
    const p = data.fact > 0 ? Math.round(amt/data.fact*100) : 0;
    return `<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--line)">
      <div style="flex:1;font-size:.78rem;font-weight:600">${CAT_LABELS[cat]||cat}</div>
      <div style="font-size:.72rem;color:var(--muted)">${p}%</div>
      <div style="font-size:.8rem;font-weight:700;color:${def.accentColor}">${fmtRub(amt)}</div>
    </div>`;
  }).join('') || `<div style="padding:10px 0;font-size:.78rem;color:var(--muted)">Нет операций в этой категории</div>`;

  const tipsHtml = def.tips.map(t => `
    <div class="bdet-insight" style="margin-bottom:8px">
      <div style="font-size:.9rem;margin-bottom:4px">${t.ico} <strong>${t.title}</strong></div>
      ${t.body}
    </div>`).join('');

  const html = `
    <!-- Hero -->
    <div class="bdet-hero" style="background:${def.gradient};border-bottom:1px solid var(--line)">
      <div class="bdet-emoji">${def.emoji}</div>
      <div class="bdet-title">${def.title}</div>
      <div class="bdet-sub">Формула 50/30/20 · ваша доля: <b style="color:${def.accentColor}">${def.pct}%</b></div>
      <div style="margin-top:16px;display:inline-block;padding:6px 18px;border-radius:20px;background:${isGood ? 'rgba(45,232,176,.12)' : 'rgba(255,107,107,.1)'};border:1px solid ${isGood ? 'rgba(45,232,176,.25)' : 'rgba(255,107,107,.2)'};font-size:.78rem;font-weight:700;color:${statusColor}">${statusMsg}</div>
    </div>

    <!-- Stats -->
    <div class="bdet-section" style="padding-top:16px">
      <div class="bdet-stat-row">
        <div class="bdet-stat">
          <div class="bdet-stat-lbl">Потрачено</div>
          <div class="bdet-stat-val" style="color:${def.accentColor}">${fmtRub(data.fact)}</div>
        </div>
        <div class="bdet-stat">
          <div class="bdet-stat-lbl">${key === 'savings' ? 'Цель' : 'Лимит'}</div>
          <div class="bdet-stat-val">${fmtRub(Math.round(data.limit))}</div>
        </div>
        <div class="bdet-stat">
          <div class="bdet-stat-lbl">${remaining >= 0 ? (key==='savings'?'До цели':'Остаток') : 'Перерасход'}</div>
          <div class="bdet-stat-val" style="color:${remaining>=0?'var(--mint)':'var(--coral)'}">${fmtRub(Math.abs(Math.round(remaining)))}</div>
        </div>
        <div class="bdet-stat">
          <div class="bdet-stat-lbl">Выполнено</div>
          <div class="bdet-stat-val" style="color:${statusColor}">${factPct}%</div>
        </div>
      </div>

      <!-- Progress bar big -->
      <div style="height:8px;background:var(--s2);border-radius:99px;overflow:hidden;margin-bottom:16px">
        <div style="height:100%;width:${Math.min(100,factPct)}%;background:${statusColor};border-radius:99px;transition:width .5s ease"></div>
      </div>
    </div>

    <!-- What is this -->
    <div class="bdet-section">
      <div class="bdet-section-title">Что это?</div>
      <div class="bdet-insight">${def.what}<br><br><strong>История:</strong> ${def.story}</div>
    </div>

    ${Object.keys(catBreakdown).length > 0 ? `
    <!-- Category breakdown -->
    <div class="bdet-section">
      <div class="bdet-section-title">По категориям</div>
      <div style="background:var(--s1);border:1px solid var(--line);border-radius:14px;padding:4px 14px">
        ${catHtml}
      </div>
    </div>` : ''}

    <!-- Tips -->
    <div class="bdet-section">
      <div class="bdet-section-title">💡 Как улучшить</div>
      ${tipsHtml}
    </div>

    <!-- Academy CTA -->
    <div class="bdet-section">
      <div class="bdet-section-title">📚 Академия</div>
      <div class="bdet-tip-card" onclick="closeSheet('budget-detail');openCourse('${def.courseId}')">
        <div class="bdet-tip-head">
          <div class="bdet-tip-ico">🎓</div>
          <div>
            <div class="bdet-tip-title">Курс: ${def.courseName}</div>
            <div class="bdet-tip-sub">5 мин · Практические знания с заданиями</div>
          </div>
        </div>
        <div class="bdet-tip-action">Пройти урок →</div>
      </div>
    </div>
  `;

  document.getElementById('budget-detail-content').innerHTML = html;
  openSheet('budget-detail');
}


function checkNewAchievements() {
  if (typeof ACHIEVEMENTS === 'undefined' || typeof getAcademyState === 'undefined') return;
  try {
    const s = getAcademyState();
    if (!DB.seenAchievements) DB.seenAchievements = [];
    const earned = ACHIEVEMENTS.filter(a => { try { return a.condition(s); } catch(e) { return false; } });
    const newOnes = earned.filter(a => !DB.seenAchievements.includes(a.id));
    if (newOnes.length === 0) return;
    if (!window._achQueue) window._achQueue = [];
    newOnes.forEach(a => {
      if (!window._achQueue.find(q => q.id === a.id)) window._achQueue.push(a);
      if (!DB.seenAchievements.includes(a.id)) DB.seenAchievements.push(a.id);
    });
    saveDB();
    if (!window._achPopupOpen) showNextAchievementPopup();
  } catch(e) { console.warn('checkNewAchievements:', e); }
}

/* ─── Achievement popup ─── */
function showNextAchievementPopup() {
  if (!window._achQueue || window._achQueue.length === 0) {
    window._achPopupOpen = false;
    return;
  }
  window._achPopupOpen = true;
  const ach = window._achQueue.shift();
  showAchievementPopup(ach);
}

function showAchievementPopup(ach) {
  const popup = document.getElementById('achievement-popup');
  const bg    = document.getElementById('ach-popup-bg');
  const card  = document.getElementById('ach-popup-card');
  const iconEl = document.getElementById('ach-popup-icon');
  const nameEl = document.getElementById('ach-popup-name');
  const descEl = document.getElementById('ach-popup-desc');
  const glowEl = document.getElementById('ach-popup-glow');
  const raysEl = document.getElementById('ach-rays');

  window._currentAch = ach;

  // Rays SVG — 16 lines rotating
  const rays = Array.from({length:16}, (_,i) => {
    const a = (i/16)*360, len = 60 + (i%3)*30;
    const x = 50 + Math.cos(a*Math.PI/180)*len, y = 50 + Math.sin(a*Math.PI/180)*len;
    return `<line x1="50%" y1="50%" x2="${x}%" y2="${y}%" stroke="rgba(245,200,66,${.05+i%3*.06})" stroke-width="${1+i%2}"/>`;
  }).join('');
  raysEl.innerHTML = `<svg width="100%" height="100%" style="position:absolute;inset:0;overflow:visible">${rays}</svg>`;
  raysEl.style.animation = 'achRaysSpin 12s linear infinite';

  // Inject XP badge into card (after desc)
  let xpBadge = descEl.nextElementSibling;
  if (!xpBadge || !xpBadge.classList.contains('ach-xp-badge')) {
    xpBadge = document.createElement('div');
    xpBadge.className = 'ach-xp-badge';
    xpBadge.style.cssText = 'display:inline-block;margin:10px auto 0;padding:5px 14px;background:rgba(245,200,66,.12);border:1px solid rgba(245,200,66,.3);border-radius:20px;font-size:.75rem;font-weight:800;color:var(--gold)';
    descEl.after(xpBadge);
  }
  xpBadge.textContent = ach.xp ? '+' + ach.xp + ' XP' : '🏆 Достигнуто';
  xpBadge.style.transform = 'translateY(-4px)';

  iconEl.textContent = ach.icon;
  nameEl.textContent = ach.name;
  descEl.textContent = ach.desc || '';
  iconEl.className = '';
  void iconEl.offsetWidth;

  popup.style.display = 'block';
  requestAnimationFrame(() => {
    bg.style.opacity = '1';
    card.style.transform = 'translateX(-50%) translateY(0)';
    setTimeout(() => {
      glowEl.style.opacity = '1';
      iconEl.className = 'ach-popup-icon-anim';
      _launchConfetti(card);
    }, 120);
  });

  if (navigator.vibrate) navigator.vibrate([40, 20, 80, 20, 120]);
}

function _launchConfetti(container) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;border-radius:28px;z-index:10';
  canvas.width = container.offsetWidth || 360;
  canvas.height = container.offsetHeight || 520;
  container.querySelector('[style*="position:absolute;inset:0;border-radius:28px"]')?.remove();
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const colors = ['#F5C842','#FFE87A','#2DE8B0','#4DA6FF','#FF6B6B','#a78bfa','#fff'];
  const particles = Array.from({length:60}, () => ({
    x: Math.random()*canvas.width, y: -10,
    vx: (Math.random()-.5)*3, vy: Math.random()*4+2,
    size: Math.random()*5+3,
    color: colors[Math.floor(Math.random()*colors.length)],
    rot: Math.random()*360, rotV: (Math.random()-.5)*8,
    opacity: 1, shape: Math.random()>.5?'rect':'circle'
  }));
  let frame = 0;
  function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle = p.color;
      if (p.shape==='rect') ctx.fillRect(-p.size/2,-p.size/2,p.size,p.size*0.6);
      else { ctx.beginPath(); ctx.arc(0,0,p.size/2,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
      p.x += p.vx; p.y += p.vy; p.vy += .08; p.rot += p.rotV;
      p.opacity -= .012;
    });
    frame++;
    if (frame < 120) requestAnimationFrame(draw);
    else canvas.remove();
  }
  draw();
}

function closeAchievementPopup() {
  const popup = document.getElementById('achievement-popup');
  const bg = document.getElementById('ach-popup-bg');
  const card = document.getElementById('ach-popup-card');
  const glow = document.getElementById('ach-popup-glow');
  bg.style.opacity = '0';
  card.style.transform = 'translateX(-50%) translateY(110%)';
  glow.style.opacity = '0';
  setTimeout(() => {
    popup.style.display = 'none';
    card.style.transition = 'none';
    card.style.transform = 'translateX(-50%) translateY(100%)';
    setTimeout(() => { card.style.transition = 'transform .45s cubic-bezier(.22,.68,0,1.15)'; }, 50);
    showNextAchievementPopup();
  }, 400);
}

function showAchievementDetail(id) {
  const ach = ACHIEVEMENTS.find(a => a.id === id);
  if (ach) showAchievementPopup(ach);
}

function shareAchievement(platform) {
  const ach = window._currentAch;
  if (!ach) return;
  const text = `🏆 Я получил достижение "${ach.name}" в приложении Nobile! ${ach.icon}\n${ach.desc || ''}\nФинансовый трекер: попробуй сам 💪`;
  const encoded = encodeURIComponent(text);
  if (platform === 'telegram') {
    window.open(`https://t.me/share/url?url=https://nobile.app&text=${encoded}`, '_blank');
  } else if (platform === 'vk') {
    window.open(`https://vk.com/share.php?title=${encoded}`, '_blank');
  } else if (platform === 'copy') {
    navigator.clipboard?.writeText(text).then(() => {
      const btn = document.getElementById('ach-share-copy');
      const orig = btn.innerHTML;
      btn.innerHTML = '✅ Скопировано';
      btn.style.color = 'var(--mint)';
      setTimeout(() => { btn.innerHTML = orig; btn.style.color = ''; }, 2000);
    });
  }
}

function saveSettings() {
  const name = document.getElementById('set-name').value.trim();
  const goal = parseFloat(document.getElementById('set-goal').value) || 7900000;
  if (name) DB.user.name = name;
  DB.user.goal = goal;
  DB.user.alertThreshold = _alertThreshold;
  if (!DB.settings) DB.settings = { monthOffset: 0, selectedRate: 10 };
  saveDB();
  updateAvatar();
  renderAll();
  closeSheet('settings');
  showToast('✅ Настройки сохранены');
}

/* ═══════════════════════════════════════
   PROFILE
═══════════════════════════════════════ */
function openProfile() {
  const s = calcStats();
  const acSt = getAcademyState();
  const lv = getCurrentLevel(acSt.totalXP);
  const totalAssets = DB.assets.reduce((sum,a) => sum+a.amount, 0);
  const totalSaved  = DB.savings.reduce((sum,e) => sum+e.amount, 0);
  const habitsCount = DB.habits.length;
  const txCount     = DB.transactions.length;
  const goalPct     = Math.min(100, Math.round((totalAssets+totalSaved)/(DB.user.goal||7900000)*100*10)/10);
  const GOAL_LABELS = { save:'Копить деньги', invest:'Инвестировать', control:'Контроль расходов', '100k':'Накопить $100k', habits:'Дисциплина' };
  const auth = getAuth();
  const providerLabel = !auth ? 'Гость' : auth.provider === 'local' ? 'Email' : ({yandex:'Яндекс',vk:'VK',gosuslugi:'Госуслуги',max:'MAX'}[auth.provider] || auth.provider);
  const providerIcon  = !auth ? '👤' : auth.provider === 'local' ? '✉️' : ({yandex:'🟠',vk:'💙',gosuslugi:'🏛️',max:'💬'}[auth.provider] || '🔗');
  const memberSince   = auth?.createdAt ? new Date(auth.createdAt).toLocaleDateString('ru',{day:'numeric',month:'long',year:'numeric'}) : 'Сегодня';
  const initials = (DB.user.name||'НБ').split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  const grad = (DB.user.avatarColor||'#667eea,#764ba2').split(',').join(',');

  document.getElementById('profile-content').innerHTML = `
    <!-- Avatar + name -->
    <div style="text-align:center;padding:10px 0 20px">
      <div style="width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,${grad});display:flex;align-items:center;justify-content:center;font-family:var(--font-head);font-size:1.5rem;font-weight:800;margin:0 auto 12px;border:3px solid rgba(255,255,255,.1)">${initials}</div>
      <div style="font-family:var(--font-head);font-size:1.2rem;font-weight:800">${DB.user.name||'Пользователь'}</div>
      ${(auth && auth.email ? '<div style="font-size:.72rem;color:var(--muted);margin-top:2px">' + auth.email + '</div>' : '')}
      <div style="font-size:.72rem;color:var(--gold);margin-top:4px">${lv.badge} ${lv.name} · ${acSt.totalXP} XP</div>
    </div>

    <!-- Stats -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
      <div class="hero-stat"><div class="hs-lbl">💰 Капитал</div><div class="hs-val mint" style="font-size:.9rem">${(totalAssets+totalSaved).toLocaleString('ru')} ₽</div></div>
      <div class="hero-stat"><div class="hs-lbl">🎯 Цель</div><div class="hs-val" style="color:var(--gold);font-size:.9rem">${goalPct}%</div></div>
      <div class="hero-stat"><div class="hs-lbl">⚡ Привычек</div><div class="hs-val" style="color:var(--blue);font-size:.9rem">${habitsCount}</div></div>
      <div class="hero-stat"><div class="hs-lbl">📋 Операций</div><div class="hs-val" style="font-size:.9rem">${txCount}</div></div>
    </div>

    <!-- Goal progress -->
    <div class="card mb16">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <div style="font-size:.62rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.07em">Финансовая цель</div>
        <button onclick="closeSheet('profile');setTimeout(openSettings,200)" style="font-size:.62rem;color:var(--blue);font-weight:700;background:rgba(77,166,255,.1);border:1px solid rgba(77,166,255,.2);border-radius:20px;padding:3px 9px;cursor:pointer">Изменить</button>
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div style="font-size:1.4rem">${{save:'🏦',invest:'📈',control:'💡','100k':'🎯',habits:'⚡'}[DB.user.goalType]||'🎯'}</div>
        <div>
          <div style="font-size:.88rem;font-weight:700">${GOAL_LABELS[DB.user.goalType]||'Финансовый рост'}</div>
          <div style="font-size:.68rem;color:var(--muted);margin-top:2px">Цель: <b style="color:var(--gold)">${(DB.user.goal||7900000).toLocaleString('ru')} ₽</b></div>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:.68rem;color:var(--muted);margin-bottom:5px">
        <span>Накоплено: <b style="color:var(--mint)">${(totalAssets+totalSaved).toLocaleString('ru')} ₽</b></span>
        <span style="color:var(--gold);font-weight:700">${goalPct}%</span>
      </div>
      <div class="pbar-track"><div class="pbar-fill" style="width:${goalPct}%;background:linear-gradient(90deg,var(--gold),var(--mint))"></div></div>
    </div>

    <!-- Account info -->
    <div class="card mb16">
      <div style="font-size:.68rem;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Аккаунт</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:.82rem">
          <span style="color:var(--muted)">Способ входа</span>
          <span style="font-weight:600">${providerIcon} ${providerLabel}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:.82rem">
          <span style="color:var(--muted)">PIN-защита</span>
          <span style="font-weight:600;color:${localStorage.getItem('nobile_phash') ? 'var(--mint)' : 'var(--muted)'}">${localStorage.getItem('nobile_phash') ? '✓ Включена' : '✗ Отключена'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;font-size:.82rem">
          <span style="color:var(--muted)">В Nobile с</span>
          <span style="font-weight:600">${memberSince}</span>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px">
      <button onclick="closeSheet('profile');openSettings()" style="width:100%;background:var(--s2);border:1px solid var(--line);color:var(--text);padding:13px 16px;border-radius:14px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:.84rem;font-weight:600;font-family:var(--font-body)">
        ⚙️ <span>Настройки приложения</span>
      </button>
      <button onclick="closeSheet('profile');exportData()" style="width:100%;background:var(--s2);border:1px solid var(--line);color:var(--text);padding:13px 16px;border-radius:14px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:.84rem;font-weight:600;font-family:var(--font-body)">
        📤 <span>Экспорт данных</span>
      </button>
      ${localStorage.getItem('nobile_phash') ? `
      <button onclick="closeSheet('profile');changePin()" style="width:100%;background:var(--s2);border:1px solid var(--line);color:var(--text);padding:13px 16px;border-radius:14px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:.84rem;font-weight:600;font-family:var(--font-body)">
        🔑 <span>Изменить PIN-код</span>
      </button>` : `
      <button onclick="closeSheet('profile');authShowView('pin');document.getElementById('auth-screen')&&(document.getElementById('auth-screen').style.display='block');resetPinSetupState('first')" style="width:100%;background:var(--s2);border:1px solid var(--line);color:var(--text);padding:13px 16px;border-radius:14px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:.84rem;font-weight:600;font-family:var(--font-body)">
        🔐 <span>Установить PIN-код</span>
      </button>`}
    </div>

    <!-- Logout / Delete -->
    <div style="margin-top:8px;padding-top:12px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:6px">
      ${!auth ? `
      <button onclick="closeSheet('profile');switchAccount()" style="width:100%;background:var(--s2);border:1px solid var(--line);color:var(--text);padding:13px 16px;border-radius:14px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:.84rem;font-weight:600;font-family:var(--font-body)">
        🔑 <span>Зарегистрироваться / Войти</span>
      </button>` : `
      <button onclick="closeSheet('profile');logoutAccount()" style="width:100%;background:none;border:1px solid var(--line);color:var(--text);padding:13px 16px;border-radius:14px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:.84rem;font-weight:600;font-family:var(--font-body)">
        🚪 <span>Выйти из аккаунта</span>
      </button>`}
      <button onclick="closeSheet('profile');deleteAccountConfirm()" style="width:100%;background:rgba(255,107,107,.07);border:1px solid rgba(255,107,107,.2);color:var(--coral);padding:13px 16px;border-radius:14px;text-align:left;cursor:pointer;display:flex;align-items:center;gap:10px;font-size:.84rem;font-weight:600;font-family:var(--font-body)">
        🗑 <span>Удалить аккаунт и данные</span>
      </button>
    </div>
  `;
  openSheet('profile');
}

function switchAccount() {
  // Guest wants to register/login — show auth screen without clearing data
  const authScreen = document.getElementById('auth-screen');
  if (authScreen) {
    authScreen.style.display = 'block';
    authShowView('welcome');
  } else {
    location.reload();
  }
}

function logoutAccount(){
  var id="_lo_m_",ex=document.getElementById(id);if(ex)ex.remove();
  var ov=document.createElement("div");ov.id=id;
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:19999;display:flex;align-items:flex-end;padding:16px;box-sizing:border-box";
  var box=document.createElement("div");
  box.style.cssText="background:var(--s1);border:1px solid var(--line);border-radius:20px;padding:24px;width:100%;max-width:420px;margin:0 auto";
  var em=document.createElement("div");em.textContent="🚪";em.style.cssText="font-size:2rem;text-align:center;margin-bottom:12px";box.appendChild(em);
  var ttl=document.createElement("div");ttl.textContent="Выйти из аккаунта?";ttl.style.cssText="font-family:Syne,sans-serif;font-size:1rem;font-weight:800;margin-bottom:8px";box.appendChild(ttl);
  var sub=document.createElement("div");sub.style.cssText="font-size:.8rem;color:var(--muted);margin-bottom:20px;line-height:1.6";
  sub.textContent="Данные останутся на устройстве. При следующем входе потребуется ввести пароль"+(localStorage.getItem("nobile_phash")?" или PIN":"")+".";
  box.appendChild(sub);
  var row=document.createElement("div");row.style.cssText="display:flex;gap:10px";
  var bc=document.createElement("button");bc.style.cssText="flex:1;background:var(--s2);border:1px solid var(--line);color:var(--text);padding:14px;border-radius:14px;font-family:Syne,sans-serif;font-size:.88rem;font-weight:700;cursor:pointer";bc.textContent="Отмена";bc.onclick=function(){ov.remove();};
  var bo=document.createElement("button");bo.style.cssText="flex:1;background:var(--blue);border:none;color:white;padding:14px;border-radius:14px;font-family:Syne,sans-serif;font-size:.88rem;font-weight:700;cursor:pointer";bo.textContent="Выйти";bo.onclick=doLogout;
  row.append(bc,bo);box.appendChild(row);
  ov.appendChild(box);document.body.appendChild(ov);
  ov.addEventListener("click",function(e){if(e.target===ov)ov.remove();});
}

function doLogout(){
  _cryptoKey=null;
  document.body.innerHTML="<div style='position:fixed;inset:0;background:#0d0f14;display:flex;align-items:center;justify-content:center;font-family:Syne,sans-serif;color:white;font-size:1rem;font-weight:700'>Выход...</div>";
  setTimeout(function(){location.reload();},500);
}

function deleteAccountConfirm(){
  var id="_del_m_",ex=document.getElementById(id);if(ex)ex.remove();
  var ov=document.createElement("div");ov.id=id;
  ov.style.cssText="position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:19999;display:flex;align-items:flex-end;padding:16px;box-sizing:border-box";
  var box=document.createElement("div");
  box.style.cssText="background:var(--s1);border:1px solid rgba(255,107,107,.3);border-radius:20px;padding:24px;width:100%;max-width:420px;margin:0 auto";
  var em=document.createElement("div");em.textContent="⚠️";em.style.cssText="font-size:2rem;text-align:center;margin-bottom:12px";box.appendChild(em);
  var ttl=document.createElement("div");ttl.textContent="Удалить аккаунт?";ttl.style.cssText="font-family:Syne,sans-serif;font-size:1rem;font-weight:800;margin-bottom:6px;color:var(--coral)";box.appendChild(ttl);
  var sub=document.createElement("div");sub.style.cssText="font-size:.8rem;color:var(--muted);margin-bottom:12px;line-height:1.6";sub.textContent="Это безвозвратно удалит все данные:";box.appendChild(sub);
  var lst=document.createElement("div");lst.style.cssText="background:rgba(255,107,107,.07);border:1px solid rgba(255,107,107,.15);border-radius:14px;padding:12px 14px;margin-bottom:14px;font-size:.76rem;display:flex;flex-direction:column;gap:5px;line-height:1.4";
  ["💰 Транзакции, активы, сбережения","⚡ Привычки и вся история","📚 Прогресс Академии и XP","🔐 Аккаунт, PIN и ключи"].forEach(function(t){var d=document.createElement("div");d.textContent=t;lst.appendChild(d);});
  box.appendChild(lst);
  var hint=document.createElement("div");hint.style.cssText="font-size:.72rem;color:var(--muted);margin-bottom:20px";hint.textContent="Сначала сделайте Экспорт данных, если хотите сохранить копию.";box.appendChild(hint);
  var row=document.createElement("div");row.style.cssText="display:flex;gap:10px";
  var bc=document.createElement("button");bc.style.cssText="flex:1;background:var(--s2);border:1px solid var(--line);color:var(--text);padding:14px;border-radius:14px;font-family:Syne,sans-serif;font-size:.88rem;font-weight:700;cursor:pointer";bc.textContent="Отмена";bc.onclick=function(){ov.remove();};
  var bd=document.createElement("button");bd.style.cssText="flex:1;background:var(--coral);border:none;color:white;padding:14px;border-radius:14px;font-family:Syne,sans-serif;font-size:.88rem;font-weight:700;cursor:pointer";bd.textContent="Удалить всё";bd.onclick=doResetAllData;
  row.append(bc,bd);box.appendChild(row);
  ov.appendChild(box);document.body.appendChild(ov);
  ov.addEventListener("click",function(e){if(e.target===ov)ov.remove();});
}

function confirmResetData(){deleteAccountConfirm();}

function doResetAllData(){
  localStorage.clear();
  _cryptoKey=null;
  document.body.innerHTML="<div style='position:fixed;inset:0;background:#0d0f14;display:flex;align-items:center;justify-content:center;font-family:Syne,sans-serif;color:white;font-size:1rem;font-weight:700'>Данные удалены...</div>";
  setTimeout(function(){location.reload();},800);
}

/* ═══════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════ */
const pageMap = { today:'p-today', growth:'p-growth', capital:'p-capital', system:'p-system', academy:'p-academy', simulator:'p-simulator' };

function openCourse(courseId) {
  // Navigate to Academy tab then open the course
  navTo('academy');
  setTimeout(function() { openLesson(courseId); }, 300);
}

function navTo(key) {
  if (window._showLoadingOverlay) window._showLoadingOverlay();
  requestAnimationFrame(() => {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById(pageMap[key]).classList.add('active');
    document.querySelectorAll('.nb').forEach(b=>{
      b.classList.toggle('on', b.dataset.page===key);
    });
    window.scrollTo(0, 0);
    if (window._hideLoadingOverlay) window._hideLoadingOverlay();
  });
}

document.querySelectorAll('.nb').forEach(btn=>{
  btn.addEventListener('click', ()=>navTo(btn.dataset.page));
});

// Capital subtabs
document.querySelectorAll('[data-cap]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-cap]').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    document.querySelectorAll('.cap-pane').forEach(p=>p.style.display='none');
    const capPane = btn.dataset.cap;
    document.getElementById('cap-'+capPane).style.display='block';

  });
});

// System tabs
document.querySelectorAll('[data-sys]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-sys]').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    document.querySelectorAll('#p-system .tab-pane').forEach(p=>p.classList.remove('on'));
    document.getElementById('sys-'+btn.dataset.sys).classList.add('on');
  });
});

// Academy tabs
document.querySelectorAll('[data-aca]').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('[data-aca]').forEach(b=>b.classList.remove('on'));
    btn.classList.add('on');
    document.querySelectorAll('#p-academy .tab-pane').forEach(p=>p.classList.remove('on'));
    const pane = btn.dataset.aca;
    document.getElementById('aca-'+pane).classList.add('on');
    if (pane === 'problems') renderProblems();
    if (pane === 'courses')  renderCoursesList(_courseFilter||'all');
  });
});

/* ═══════════════════════════════════════
   SHEETS (Bottom Drawers)
═══════════════════════════════════════ */
function openSheet(name, type='') {
  if (name==='tx') {
    setTxType(type||'income');
    // Only set date to today when NOT in edit mode (edit mode pre-fills date separately)
    if (!_editTxId) {
      const _txDt = document.getElementById('tx-date'); if (_txDt) _txDt.value = todayISO();
    }
  }
  document.getElementById('sheet-'+name).classList.add('open');
  document.getElementById('fab').classList.remove('open');
}

function closeSheet(name) {
  document.getElementById('sheet-'+name).classList.remove('open');
}

function toggleFab() {
  const fab = document.getElementById('fab');
  const isOpen = fab.classList.toggle('open');
  if (isOpen) openSheet('fab');
  else closeSheet('fab');
}

// FAB smart visibility
(function() {
  let lastY = 0, idleTimer = null, fabHidden = false;
  const FAB_IDLE_MS = 3000;

  function getFab() { return document.getElementById('fab'); }

  function showFab() {
    const fab = getFab(); if (!fab) return;
    fabHidden = false;
    fab.classList.remove('fab-hidden','fab-idle');
    resetIdle();
  }
  function hideFab() {
    const fab = getFab(); if (!fab) return;
    fabHidden = true;
    fab.classList.add('fab-hidden');
    fab.classList.remove('fab-idle');
    clearTimeout(idleTimer);
  }
  function idleFab() {
    const fab = getFab(); if (!fab || fabHidden) return;
    fab.classList.add('fab-idle');
  }
  function resetIdle() {
    clearTimeout(idleTimer);
    const fab = getFab(); if (fab) fab.classList.remove('fab-idle');
    idleTimer = setTimeout(idleFab, FAB_IDLE_MS);
  }

  // Scroll handler for each .scroll container
  function onScroll(e) {
    const el = e.target;
    const y = el.scrollTop;
    const delta = y - lastY;
    lastY = y;
    if (y < 40) { showFab(); return; }
    if (delta > 6) hideFab();
    else if (delta < -6) showFab();
  }

  // Touch handler for native feel
  let touchY = 0;
  document.addEventListener('touchstart', e => { touchY = e.touches[0].clientY; }, {passive:true});
  document.addEventListener('touchmove', e => {
    const dy = touchY - e.touches[0].clientY;
    if (Math.abs(dy) > 10) { dy > 0 ? hideFab() : showFab(); }
  }, {passive:true});

  // Attach to all .scroll containers
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.scroll').forEach(el => {
      el.addEventListener('scroll', onScroll, {passive:true});
    });
    // Also show FAB on any tap outside scroll
    document.addEventListener('click', () => { if(fabHidden) showFab(); });
    resetIdle();
  });
  // Also run after page is loaded (for late-rendered elements)
  setTimeout(() => {
    document.querySelectorAll('.scroll').forEach(el => {
      el.addEventListener('scroll', onScroll, {passive:true});
    });
    resetIdle();
  }, 500);
})();

/* ═══════════════════════════════════════
   TOAST
═══════════════════════════════════════ */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), 2200);
}

/* ═══════════════════════════════════════
   SAVINGS
═══════════════════════════════════════ */
function setSavingsQuick(pct) {
  const stats = calcStats();
  const recTotal = DB.recurringPayments.reduce((s,r)=>s+r.amount,0);
  const available = Math.max(0, stats.balance - recTotal);
  document.getElementById('savings-amount').value = Math.floor(available * pct);
}

function saveSavings() {
  const amount = parseFloat(document.getElementById('savings-amount').value);
  const note   = document.getElementById('savings-note').value.trim() || 'Перевод в накопления';
  if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
  const stats = calcStats();
  if (amount > stats.balance) { showToast('Сумма превышает баланс'); return; }
  DB.savings.push({ id: Date.now(), amount, note, date: todayISO() });
  // Also add as expense/savings transaction so balance reflects it
  DB.transactions.push({ id: Date.now()+1, type:'expense', amount, desc: note, category:'savings', date: todayISO() });
  saveDB(); closeSheet('savings'); showToast('✅ ' + amount.toLocaleString('ru') + ' ₽ отложено'); renderAll();
  document.getElementById('savings-amount').value = '';
  document.getElementById('savings-note').value = '';
}

/* ═══════════════════════════════════════
   ЦЕЛИ — GOALS
═══════════════════════════════════════ */
let _editGoalId = null;
let _goalEmoji  = '🏖️';

// ── Цвета прогресс-бара по % ─────────

// ── Сколько дней до дедлайна ─────────

// ── Рендер списка целей ──────────────
function goalBarColor(pct) {
  if (pct >= 100) return 'var(--mint)';
  if (pct >= 60)  return 'var(--gold)';
  if (pct >= 30)  return '#4DA6FF';
  return '#a78bfa';
}

function fmtRub(v) {
  return Math.round(v||0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + ' ₽';
}

function daysLeft(deadline) {
  if (!deadline) return null;
  const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
  return diff;
}

function renderGoals() {
  const el = document.getElementById('goals-list');
  if (!el) return;
  if (!DB.goals || !Array.isArray(DB.goals)) DB.goals = [];

  if (DB.goals.length === 0) {
    el.innerHTML = `
      <div style="text-align:center;padding:24px 0 16px">
        <div style="font-size:2.5rem;margin-bottom:10px">🎯</div>
        <div style="font-family:var(--font-head);font-size:.9rem;font-weight:800;margin-bottom:6px">Нет целей</div>
        <div style="font-size:.74rem;color:var(--muted);line-height:1.5;margin-bottom:16px">Подушка безопасности, поездка в Гагры,<br>новый ноутбук — всё начинается с цели</div>
        <button onclick="openGoalSheet()" style="padding:12px 28px;background:linear-gradient(135deg,var(--gold),var(--gold2));border:none;border-radius:13px;color:#0d0f14;font-family:var(--font-head);font-size:.85rem;font-weight:800;cursor:pointer">
          🎯 + Добавить первую цель
        </button>
      </div>`;
    const addRow = document.getElementById('goals-add-row');
    if (addRow) addRow.style.display = 'none';
    return;
  }

  const MONTHS = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

  const addRow = document.getElementById('goals-add-row');
  if (addRow) addRow.style.display = 'block';

  el.innerHTML = DB.goals.map(g => {
    const saved  = g.saved  || 0;
    const target = g.target || 0;
    const pct    = Math.min(100, target > 0 ? Math.round(saved / target * 100) : 0);
    const left   = Math.max(0, target - saved);
    const dl     = daysLeft(g.deadline);
    const done   = pct >= 100;
    const color  = g.color || 'rgba(77,166,255,.12)';
    const barClr = goalBarColor(pct);

    // Monthly hint
    let monthlyHint = '';
    if (!done && g.deadline && dl !== null && dl > 0) {
      const months = Math.max(1, Math.ceil(dl / 30));
      const perMonth = Math.ceil(left / months);
      monthlyHint = `<div style="font-size:.65rem;color:var(--muted);margin-top:5px">
        📅 Нужно откладывать: <b style="color:var(--gold)">${fmtRub(perMonth)}/мес</b>
        · до цели ${months} мес.
      </div>`;
    }

    let deadlineHtml = '';
    if (g.deadline) {
      const d = new Date(g.deadline);
      const dlStr = d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear();
      const urgent  = dl !== null && dl <= 30 && !done;
      const overdue = dl !== null && dl < 0  && !done;
      deadlineHtml = `<span style="font-size:.68rem;font-weight:600;color:${overdue?'var(--coral)':urgent?'var(--gold)':'var(--muted)'}">
        ${overdue ? '⚠️ Просрочено' : dl === 0 ? '🔴 Сегодня!' : dl !== null ? '⏱ '+dl+' дн.' : ''} ${dlStr}
      </span>`;
    }

    return `
    <div class="goal-card ${done?'goal-done':''}" style="position:relative" id="gcap-${g.id}">
      <div class="goal-card-top">
        <div class="goal-ico" style="background:${color}">${g.emoji || '🎯'}</div>
        <div class="goal-info">
          <div class="goal-name">${done ? '✓ ' : ''}${g.name}</div>
          <div class="goal-amounts">
            <b style="color:var(--text)">${fmtRub(saved)}</b>
            <span style="opacity:.5"> / ${fmtRub(target)}</span>
            ${!done ? '<span style="color:var(--dim)"> · ост. '+fmtRub(left)+'</span>' : ''}
          </div>
        </div>
        <div class="goal-pct-badge" style="color:${barClr}">${pct}%</div>
      </div>
      <div class="goal-pbar-track" style="margin-bottom:10px">
        <div class="goal-pbar-fill" style="width:${pct}%;background:${barClr};transition:width .6s"></div>
      </div>
      ${monthlyHint}
      <div class="goal-footer" style="margin-top:8px">
        <div>${deadlineHtml}</div>
        <div style="display:flex;gap:6px">
          ${!done ? `<button class="goal-deposit-btn" onclick="event.stopPropagation();openDepositSheet(${g.id})">+ Пополнить</button>` : '<span style="font-size:.68rem;color:var(--mint);font-weight:700">🎉 Готово!</span>'}
          <button onclick="event.stopPropagation();openGoalSheet(${g.id})" style="padding:7px 10px;background:var(--s1);border:1px solid var(--line);border-radius:10px;color:var(--muted);font-size:.75rem;cursor:pointer">✏️</button>
          <button onclick="event.stopPropagation();deleteGoalInline(${g.id},'cap')" style="padding:7px 10px;background:rgba(255,107,107,.07);border:1px solid rgba(255,107,107,.18);border-radius:10px;color:var(--coral);font-size:.75rem;cursor:pointer">🗑</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function deleteGoalInline(goalId, prefix) {
  const g = DB.goals.find(x => x.id === goalId);
  if (!g) return;
  const card = document.getElementById((prefix||'gcap')+'-'+goalId);
  if (!card) return;
  const existing = card.querySelector('.del-confirm-strip');
  if (existing) {
    DB.goals = DB.goals.filter(x => x.id !== goalId);
    saveDB(); renderGoals(); renderTodayGoals();
    showToast('🗑 Цель «'+g.name+'» удалена');
    return;
  }
  const strip = document.createElement('div');
  strip.className = 'del-confirm-strip';
  strip.style.cssText = 'margin-top:8px;padding:9px 12px;background:rgba(255,107,107,.09);border:1px solid rgba(255,107,107,.22);border-radius:11px;display:flex;align-items:center;justify-content:space-between;gap:8px';
  const cancelFn = "this.closest('.del-confirm-strip').remove()";
  const confirmFn = "deleteGoalInline(" + goalId + ",'" + (prefix||'gcap') + "')";
  strip.innerHTML = '<span style="font-size:.76rem;color:var(--coral);font-weight:600">Удалить «'+g.name+'»?</span>'
    + '<div style="display:flex;gap:5px">'
    + '<button onclick="'+cancelFn+'" style="padding:4px 11px;background:var(--s2);border:1px solid var(--line);border-radius:8px;color:var(--muted);font-size:.72rem;cursor:pointer">Нет</button>'
    + '<button onclick="'+confirmFn+'" style="padding:4px 11px;background:rgba(255,107,107,.18);border:1px solid rgba(255,107,107,.3);border-radius:8px;color:var(--coral);font-size:.72rem;font-weight:700;cursor:pointer">Удалить</button>'
    + '</div>';
  card.appendChild(strip);
  setTimeout(()=>{ if(strip.parentNode) strip.remove(); }, 4000);
}


function renderTodayGoals() {
  const el = document.getElementById('today-goals-block');
  if (!el) return;
  if (!DB.goals) DB.goals = [];

  if (DB.goals.length === 0) {
    el.innerHTML = `
      <div class="card" style="padding:14px 16px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:.85rem">🎯</span>
            <span style="font-family:var(--font-head);font-size:.82rem;font-weight:800;color:var(--muted)">Мои цели</span>
          </div>
          <button onclick="openGoalSheet()"
            style="padding:5px 12px;background:rgba(245,200,66,.12);border:1px solid rgba(245,200,66,.22);color:var(--gold);border-radius:20px;font-size:.68rem;font-weight:700;cursor:pointer">
            + Добавить
          </button>
        </div>
        <div style="font-size:.74rem;color:var(--dim);margin-top:8px">Подушка безопасности, поездка в Гагры, ноутбук...</div>
      </div>`;
    return;
  }

  const cards = DB.goals.map(g => {
    const saved  = g.saved || 0;
    const target = g.target || 0;
    const pct    = Math.min(100, target > 0 ? Math.round(saved / target * 100) : 0);
    const left   = Math.max(0, target - saved);
    const done   = pct >= 100;
    const color  = g.color || 'rgba(77,166,255,.12)';
    const barClr = goalBarColor(pct);

    return `
    <div style="background:var(--s1);border:1px solid var(--line);border-radius:14px;padding:11px 12px;position:relative" id="gcard-${g.id}">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:7px">
        <div style="width:32px;height:32px;border-radius:10px;background:${color};display:flex;align-items:center;justify-content:center;font-size:1rem;flex-shrink:0">${g.emoji}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:.8rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${done?'✓ ':''}${g.name}</div>
          <div style="font-size:.65rem;color:var(--muted)">${fmtRub(saved)} / ${fmtRub(target)}</div>
        </div>
        <div style="font-size:.78rem;font-weight:800;color:${barClr};flex-shrink:0">${pct}%</div>
      </div>
      <div style="height:4px;background:var(--s3);border-radius:2px;overflow:hidden;margin-bottom:7px">
        <div style="width:${pct}%;height:100%;background:${barClr};border-radius:2px;transition:width .6s"></div>
      </div>
      ${!done && g.deadline && (() => { const dl2=daysLeft(g.deadline); return dl2!==null&&dl2>0; })() ? `<div style="font-size:.62rem;color:var(--muted);margin-bottom:5px">📅 <b style="color:var(--gold)">${fmtRub(Math.ceil(left/Math.max(1,Math.ceil(daysLeft(g.deadline)/30))))}/мес</b></div>` : ''}
      <div style="display:flex;gap:5px;justify-content:flex-end">
        ${!done ? `<button onclick="openDepositSheet(${g.id})"
          style="padding:4px 10px;background:rgba(45,232,176,.09);border:1px solid rgba(45,232,176,.2);color:var(--mint);border-radius:8px;font-size:.66rem;font-weight:700;cursor:pointer">+ Пополнить</button>` : '<span style="font-size:.65rem;color:var(--mint);font-weight:700">🎉 Готово</span>'}
        <button onclick="openGoalSheet(${g.id})"
          style="padding:4px 8px;background:var(--s2);border:1px solid var(--line);color:var(--muted);border-radius:8px;font-size:.7rem;cursor:pointer">✏️</button>
        <button onclick="deleteGoalInline(${g.id},'gcard')"
          style="padding:4px 8px;background:rgba(255,107,107,.07);border:1px solid rgba(255,107,107,.15);color:var(--coral);border-radius:8px;font-size:.7rem;cursor:pointer">🗑</button>
      </div>
    </div>`;
  }).join('');

  el.innerHTML = `
    <div class="card" style="padding:14px 16px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div class="card-title">🎯 Мои цели</div>
        <button onclick="openGoalSheet()"
          style="padding:4px 10px;background:rgba(245,200,66,.1);border:1px solid rgba(245,200,66,.2);color:var(--gold);border-radius:20px;font-size:.65rem;font-weight:700;cursor:pointer">
          + Добавить
        </button>
      </div>
      <div style="display:flex;flex-direction:column;gap:7px">${cards}</div>
    </div>`;
}


function deleteGoalDirect(goalId) {
  const g = DB.goals.find(x => x.id === goalId);
  if (!g) return;
  const card = document.getElementById('gcard-' + goalId);
  if (!card) return;

  // Show inline confirm inside the card
  const existingConfirm = card.querySelector('.del-confirm');
  if (existingConfirm) {
    // Second tap — actually delete
    DB.goals = DB.goals.filter(x => x.id !== goalId);
    saveDB();
    renderTodayGoals();
    renderGoals();
    showToast('🗑 Цель «' + g.name + '» удалена');
    return;
  }

  // First tap — show confirm strip
  const strip = document.createElement('div');
  strip.className = 'del-confirm';
  strip.style.cssText = 'margin-top:10px;padding:10px 12px;background:rgba(255,107,107,.1);border:1px solid rgba(255,107,107,.25);border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:10px';
  strip.innerHTML = `
    <span style="font-size:.76rem;color:var(--coral);font-weight:600">Удалить «${g.name}»?</span>
    <div style="display:flex;gap:6px">
      <button onclick="this.closest('.del-confirm').remove()" style="padding:5px 12px;background:var(--s2);border:1px solid var(--line);border-radius:8px;color:var(--muted);font-size:.72rem;cursor:pointer">Отмена</button>
      <button onclick="deleteGoalDirect(${goalId})" style="padding:5px 12px;background:rgba(255,107,107,.2);border:1px solid rgba(255,107,107,.3);border-radius:8px;color:var(--coral);font-size:.72rem;font-weight:700;cursor:pointer">Удалить</button>
    </div>`;
  card.appendChild(strip);
  setTimeout(() => { if (strip.parentNode) strip.remove(); }, 5000);
}


function navigateToGoals() {
  // Switch to Capital page → Goals tab
  document.querySelectorAll('.nb').forEach(b => b.classList.remove('on'));
  document.querySelector('.nb[data-page="capital"]')?.classList.add('on');
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('p-capital')?.classList.add('active');
  // Switch to goals tab
  setTimeout(() => {
    document.querySelectorAll('#cap-stabs .stab').forEach(b => b.classList.remove('on'));
    document.querySelectorAll('.cap-pane').forEach(p => p.style.display = 'none');
    const goalsStab = document.querySelector('#cap-stabs .stab[data-cap="goals"]');
    if (goalsStab) goalsStab.classList.add('on');
    document.getElementById('cap-goals').style.display = 'block';
    renderGoals();
  }, 50);
}

// ── Открыть шит добавления/редактирования ──
function openGoalSheet(editId = null) {
  _editGoalId = editId || null;
  const titleEl  = document.getElementById('goal-sheet-title');
  const saveBtn  = document.getElementById('goal-save-btn');
  const delBtn   = document.getElementById('goal-delete-btn');

  if (editId) {
    const g = DB.goals.find(x => x.id === editId);
    if (!g) return;
    document.getElementById('goal-name').value     = g.name;
    document.getElementById('goal-target').value   = g.target;
    document.getElementById('goal-saved').value    = g.saved;
    document.getElementById('goal-deadline').value = g.deadline || '';
    _goalEmoji = g.emoji;
    if (titleEl) titleEl.textContent = 'Редактировать цель';
    if (delBtn)  { delBtn.style.display = 'block'; delBtn.dataset.confirm=''; delBtn.textContent='🗑 Удалить'; delBtn.style.background=''; }
  } else {
    document.getElementById('goal-name').value     = '';
    document.getElementById('goal-target').value   = '';
    document.getElementById('goal-saved').value    = '0';
    document.getElementById('goal-deadline').value = '';
    _goalEmoji = '🛡️';
    if (titleEl) titleEl.textContent = 'Новая цель';
    if (delBtn)  delBtn.style.display = 'none';
  }
  updateGoalMonthly();

  // Sync emoji picker
  document.querySelectorAll('.goal-em-opt').forEach(el => {
    el.classList.toggle('on', el.textContent.trim() === _goalEmoji);
  });

  openSheet('goal');
}

function selectGoalEmoji(el, em) {
  _goalEmoji = em;
  document.querySelectorAll('.goal-em-opt').forEach(e => e.classList.remove('on'));
  el.classList.add('on');
}

function applyGoalPreset(emoji, name, amount) {
  document.getElementById('goal-name').value = name;
  if (amount) document.getElementById('goal-target').value = amount;
  _goalEmoji = emoji;
  document.querySelectorAll('.goal-em-opt').forEach(el => {
    el.classList.toggle('on', el.textContent.trim() === emoji);
  });
  // Focus on amount if empty
  const tgt = document.getElementById('goal-target');
  if (!tgt.value) tgt.focus();
  updateGoalMonthly();
}

function updateGoalMonthly() {
  const hint = document.getElementById('goal-monthly-hint');
  if (!hint) return;
  const target   = parseFloat(document.getElementById('goal-target')?.value) || 0;
  const saved    = parseFloat(document.getElementById('goal-saved')?.value)  || 0;
  const deadline = document.getElementById('goal-deadline')?.value;
  const left = Math.max(0, target - saved);
  if (!deadline || left <= 0 || target <= 0) { hint.style.display = 'none'; return; }
  const days = Math.ceil((new Date(deadline) - new Date()) / 86400000);
  if (days <= 0) { hint.style.display = 'none'; return; }
  const months = Math.max(1, Math.ceil(days / 30));
  const perMonth = Math.ceil(left / months);
  const pct = target > 0 ? Math.round(saved / target * 100) : 0;
  hint.style.display = 'block';
  hint.innerHTML = `
    📅 До дедлайна <b>${days} дн.</b> (${months} мес.) &nbsp;·&nbsp;
    Осталось накопить: <b>${left.toLocaleString('ru')} ₽</b><br>
    💡 Нужно откладывать: <b style="color:var(--gold)">${perMonth.toLocaleString('ru')} ₽/мес</b>
    &nbsp;·&nbsp; Прогресс сейчас: <b>${pct}%</b>`;
}

// ── Сохранить цель ───────────────────
function saveGoal() {
  const name   = document.getElementById('goal-name').value.trim();
  const target = parseFloat(document.getElementById('goal-target').value) || 0;
  const saved  = parseFloat(document.getElementById('goal-saved').value)  || 0;
  const deadline = document.getElementById('goal-deadline').value || '';

  if (!name)   { showToast('Введи название цели'); return; }
  if (target <= 0) { showToast('Введи сумму цели'); return; }

  // Assign a color based on emoji or random from palette
  const COLORS = [
    'rgba(77,166,255,.15)','rgba(45,232,176,.15)','rgba(245,200,66,.15)',
    'rgba(167,139,250,.15)','rgba(255,107,107,.15)','rgba(45,232,176,.1)',
  ];

  if (!DB.goals) DB.goals = [];

  if (_editGoalId) {
    const g = DB.goals.find(x => x.id === _editGoalId);
    if (g) {
      g.name     = name;
      g.target   = target;
      g.saved    = saved;
      g.emoji    = _goalEmoji;
      g.deadline = deadline;
    }
  } else {
    DB.goals.push({
      id:       Date.now(),
      emoji:    _goalEmoji,
      name,
      target,
      saved,
      color:    COLORS[DB.goals.length % COLORS.length],
      deadline,
    });
  }

  saveDB();
  closeSheet('goal');
  renderGoals();
  renderTodayGoals();
  showToast(_editGoalId ? '✅ Цель обновлена' : '🎯 Цель добавлена');
}

// ── Удалить цель ─────────────────────
function deleteGoalConfirm() {
  if (!_editGoalId) return;
  const g = DB.goals.find(x => x.id === _editGoalId);
  if (!g) return;

  // Inline confirm inside sheet
  const btn = document.getElementById('goal-delete-btn');
  if (btn.dataset.confirm === '1') {
    DB.goals = DB.goals.filter(x => x.id !== _editGoalId);
    saveDB();
    closeSheet('goal');
    renderGoals();
    renderTodayGoals();
    showToast('🗑 Цель удалена');
  } else {
    btn.dataset.confirm = '1';
    btn.textContent = 'Удалить?';
    btn.style.background = 'rgba(255,107,107,.15)';
    setTimeout(() => {
      btn.dataset.confirm = '';
      btn.textContent = '🗑';
      btn.style.background = '';
    }, 3000);
  }
}

// ── Пополнить цель ───────────────────
let _depositGoalId = null;

function openDepositSheet(goalId) {
  _depositGoalId = goalId;
  const g = DB.goals.find(x => x.id === goalId);
  if (!g) return;

  // Reuse savings sheet UI — show inline modal instead
  const left = Math.max(0, g.target - g.saved);
  const html = `
    <div class="overlay" id="sheet-deposit-goal" style="align-items:flex-end;z-index:1100">
      <div class="overlay-bg" onclick="closeDepositGoal()"></div>
      <div class="sheet">
        <div style="font-family:var(--font-head);font-size:1rem;font-weight:800;margin-bottom:4px">${g.emoji} ${g.name}</div>
        <div style="font-size:.72rem;color:var(--muted);margin-bottom:16px">
          Накоплено: <b>${g.saved.toLocaleString('ru')} ₽</b> из <b>${g.target.toLocaleString('ru')} ₽</b> · Осталось: <b style="color:var(--gold)">${left.toLocaleString('ru')} ₽</b>
        </div>
        <div class="form-group">
          <label class="form-label">Сколько пополнить (₽)</label>
          <input class="form-input" id="deposit-amount" type="number" placeholder="0" inputmode="decimal" autofocus>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
          ${[1000,3000,5000,10000,left].filter((v,i,a)=>v>0&&a.indexOf(v)===i).map(v=>
            `<button onclick="document.getElementById('deposit-amount').value=${v}"
              style="padding:7px 13px;background:var(--s2);border:1px solid var(--line);border-radius:10px;color:var(--text);font-size:.75rem;font-weight:700;cursor:pointer">${v.toLocaleString('ru')} ₽</button>`
          ).join('')}
        </div>
        <button class="btn-primary" onclick="confirmDeposit()">Пополнить →</button>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}

function closeDepositGoal() {
  const el = document.getElementById('sheet-deposit-goal');
  if (el) el.remove();
}

function confirmDeposit() {
  const amt = parseFloat(document.getElementById('deposit-amount')?.value) || 0;
  if (amt <= 0) { showToast('Введи сумму'); return; }
  const g = DB.goals.find(x => x.id === _depositGoalId);
  if (!g) return;
  g.saved = (g.saved || 0) + amt;
  saveDB();
  closeDepositGoal();
  renderGoals();
  renderTodayGoals();
  if (g.saved >= g.target) {
    showToast('🎉 Цель «' + g.name + '» достигнута!');
  } else {
    const pct = Math.round(g.saved / g.target * 100);
    showToast(`✅ +${amt.toLocaleString('ru')} ₽ → ${pct}%`);
  }
}

function renderSavings() {
  const monthSavings = DB.savings.filter(s => {
    const { year, month } = currentPeriod();
    const d = new Date(s.date);
    return d.getFullYear()===year && d.getMonth()===month;
  });
  const total = monthSavings.reduce((s,e)=>s+e.amount, 0);
  document.getElementById('savings-total').textContent = total.toLocaleString('ru') + ' ₽';
  const listEl = document.getElementById('savings-list');
  if (monthSavings.length === 0) {
    listEl.innerHTML = `<div style="font-size:.75rem;color:var(--muted);text-align:center;padding:8px 0">Нет накоплений — нажмите кнопку ниже</div>`;
  } else {
    listEl.innerHTML = [...monthSavings].reverse().map(s=>`
      <div class="se-row">
        <div class="se-date">${fmtDate(s.date)}</div>
        <div class="se-note">${s.note}</div>
        <div class="se-amt">+${s.amount.toLocaleString('ru')} ₽</div>
      </div>`).join('');
  }
  // Показываем кнопку только если есть свободный баланс
  const btnEl = document.getElementById('savings-transfer-btn');
  const stats  = calcStats();
  const recTotal = DB.recurringPayments.reduce((s,r)=>s+r.amount, 0);
  if (btnEl) {
    if (stats.balance > 0) {
      btnEl.innerHTML = `<button onclick="openSheet('savings')" style="width:100%;background:rgba(45,232,176,.12);border:1px solid rgba(45,232,176,.22);color:var(--mint);font-family:var(--font-head);font-size:.82rem;font-weight:800;padding:11px;border-radius:12px;cursor:pointer;transition:all .2s">+ Перевести в накопления</button>`;
    } else {
      btnEl.innerHTML = '';
    }
  }
  const available = Math.max(0, stats.balance - recTotal);
  const availEl = document.getElementById('savings-available');
  const hintEl  = document.getElementById('savings-hint');
  if (availEl) {
    availEl.textContent = available.toLocaleString('ru') + ' ₽';
    hintEl.textContent  = recTotal > 0 ? 'Баланс − плановые платежи (' + recTotal.toLocaleString('ru') + ' ₽)' : 'Доходы минус расходы';
  }
}

/* ═══════════════════════════════════════
   RECURRING PAYMENTS
═══════════════════════════════════════ */
let _editRecurringId = null;

function openRecurringSheet(editId = null) {
  _editRecurringId = editId;
  const titleEl = document.getElementById('rec-sheet-title');
  const btnEl   = document.getElementById('rec-save-btn');
  if (editId) {
    const r = DB.recurringPayments.find(x => x.id === editId);
    if (!r) return;
    document.getElementById('rec-name').value   = r.name;
    document.getElementById('rec-amount').value = r.amount;
    document.getElementById('rec-day').value    = r.dayOfMonth;
    document.getElementById('rec-category').value = r.category;
    if (titleEl) titleEl.textContent = 'Редактировать платёж';
    if (btnEl)   btnEl.textContent   = 'Сохранить изменения';
  } else {
    document.getElementById('rec-name').value   = '';
    document.getElementById('rec-amount').value = '';
    document.getElementById('rec-day').value    = '';
    document.getElementById('rec-category').value = 'housing';
    if (titleEl) titleEl.textContent = 'Плановый платёж';
    if (btnEl)   btnEl.textContent   = 'Добавить платёж';
  }
  openSheet('recurring');
}

function saveRecurring() {
  const name   = document.getElementById('rec-name').value.trim();
  const amount = parseFloat(document.getElementById('rec-amount').value);
  const day    = parseInt(document.getElementById('rec-day').value);
  const cat    = document.getElementById('rec-category').value;
  if (!name) { showToast('Введите название'); return; }
  if (!amount || amount <= 0) { showToast('Введите сумму'); return; }
  if (!day || day < 1 || day > 31) { showToast('День: от 1 до 31'); return; }
  if (_editRecurringId) {
    const r = DB.recurringPayments.find(x => x.id === _editRecurringId);
    if (r) { r.name = name; r.amount = amount; r.dayOfMonth = day; r.category = cat; }
    saveDB(); closeSheet('recurring'); showToast('✅ Платёж обновлён'); renderAll();
  } else {
    DB.recurringPayments.push({ id: Date.now(), name, amount, dayOfMonth: day, category: cat });
    saveDB(); closeSheet('recurring'); showToast('✅ Платёж добавлен'); renderAll();
  }
  _editRecurringId = null;
}

function deleteRecurring(id) {
  // Close any open swipe first
  document.querySelectorAll('.rec-card-wrap.swiped').forEach(el => el.classList.remove('swiped'));
  const r = DB.recurringPayments.find(x => x.id === id);
  const name = r ? `«${r.name}»` : 'этот платёж';
  const amt  = r ? ` — ${r.amount.toLocaleString('ru')} ₽/мес` : '';
  if (!confirm(`Удалить платёж ${name}${amt}?`)) return;
  DB.recurringPayments = DB.recurringPayments.filter(x => x.id !== id);
  DB.paidPayments = DB.paidPayments.filter(p => p.recurringId !== id);
  saveDB(); renderAll(); showToast('🗑 Платёж удалён');
}

function swipeRec(id) {
  // Toggle swipe state on card
  const card = document.querySelector(`[data-rec-id="${id}"]`);
  if (!card) return;
  const isOpen = card.classList.contains('swiped');
  // Close all others
  document.querySelectorAll('.rec-card-wrap.swiped').forEach(c => c.classList.remove('swiped'));
  if (!isOpen) card.classList.add('swiped');
}

function getMonthKey() {
  const { year, month } = currentPeriod();
  return year + '-' + String(month+1).padStart(2,'0');
}

function isPaymentPaid(recurringId) {
  const mk = getMonthKey();
  return DB.paidPayments.some(p => p.recurringId===recurringId && p.monthKey===mk);
}

function togglePaymentPaid(recurringId) {
  const mk  = getMonthKey();
  const idx = DB.paidPayments.findIndex(p => p.recurringId === recurringId && p.monthKey === mk);
  const rec = DB.recurringPayments.find(r => r.id === recurringId);
  if (!rec) return;

  if (idx >= 0) {
    const paidEntry = DB.paidPayments[idx];
    DB.paidPayments.splice(idx, 1);
    if (paidEntry.txId) DB.transactions = DB.transactions.filter(t => t.id !== paidEntry.txId);
    applyPaidPaymentToAsset(paidEntry, rec, -1);
    showToast('Отметка снята, платёж возвращён в список');
  } else {
    const txId = Date.now();
    const paidEntry = { recurringId, paidDate: todayISO(), monthKey: mk, txId };
    DB.transactions.push({
      id: txId,
      type: 'expense',
      amount: rec.amount,
      desc: rec.name + ' (плановый платёж)',
      category: rec.category || 'other',
      date: todayISO()
    });
    applyPaidPaymentToAsset(paidEntry, rec, 1);
    DB.paidPayments.push(paidEntry);
    showToast('✅ Оплачено · −' + rec.amount.toLocaleString('ru') + ' ₽ учтено');
  }

  saveDB();
  renderAll();
}

function renderRecurring() {
  const listEl = document.getElementById('recurring-list');

  // Тематические фоны по категории и ключевым словам
  const THEME_BG = {
    housing: '🏠', transport: '🚗', subscription: '📱',
    health: '💊', education: '📚', food: '🛒', other: '📦'
  };
  function getThemeBg(r) {
    const n = r.name.toLowerCase();
    if (/аренда|квартир|ипотека|жильё|дом|rent|комнат/.test(n)) return '🏠';
    if (/комунал|электр|газ|вода|отопл|свет/.test(n)) return '💡';
    if (/машин|авто|бензин|парковк|кредит.*авт|каско|осаго/.test(n)) return '🚗';
    if (/телефон|связь|интернет|wi.fi|роутер/.test(n)) return '📶';
    if (/netflix|spotify|яндекс|apple|google|подписк|стрим/.test(n)) return '📱';
    if (/врач|здоровь|аптек|стоматолог/.test(n)) return '🏥';
    if (/спортзал|фитнес|gym|бассейн|тренер/.test(n)) return '💪';
    if (/учёб|курс|школ|универ|репетитор|образован/.test(n)) return '🎓';
    if (/продукт|магазин|еда|food|доставк/.test(n)) return '🛒';
    if (/работ|офис|бизнес/.test(n)) return '💼';
    if (/страховк/.test(n)) return '🛡';
    if (/кредит|займ|долг/.test(n)) return '💳';
    if (/путешеств|отпуск|отель|авиа|билет/.test(n)) return '✈️';
    if (/ребён|детск|садик|школ/.test(n)) return '👶';
    const catMap = { housing:'🏠', transport:'🚗', subscription:'📱', health:'❤️', education:'🎓', food:'🛒', other:'📦' };
    return catMap[r.category] || '📋';
  }

  if (DB.recurringPayments.length === 0) {
    listEl.innerHTML = `<div class="empty"><div class="empty-ico">📅</div><div class="empty-t">Нет плановых платежей</div><div class="empty-s">Добавьте аренду, подписки, кредиты</div></div>`;
    document.getElementById('recurring-summary').style.display = 'none';
    return;
  }
  const sorted = [...DB.recurringPayments].sort((a,b)=>a.dayOfMonth-b.dayOfMonth);
  const today  = new Date();
  const todayDate = today.getDate();

  listEl.innerHTML = sorted.map(r => {
    const paid     = isPaymentPaid(r.id);
    const rawDiff  = r.dayOfMonth >= todayDate ? r.dayOfMonth - todayDate
                   : Math.ceil((new Date(today.getFullYear(), today.getMonth()+1, r.dayOfMonth) - today) / 86400000);
    const daysLeft = Math.max(0, rawDiff);
    const isUrgent = !paid && daysLeft <= 2;
    const isSoon   = !paid && daysLeft <= 7 && daysLeft > 2;
    const metaText = paid ? '✓ Оплачено в этом месяце'
                   : daysLeft === 0 ? '❗ Сегодня!'
                   : `Через ${daysLeft} дн. — ${r.dayOfMonth} числа`;
    const themeBg  = getThemeBg(r);

    const dayStyle = !paid && isUrgent
      ? 'background:rgba(255,107,107,.18);border-color:rgba(255,107,107,.35);color:var(--coral)'
      : !paid && isSoon
      ? 'background:rgba(245,200,66,.15);border-color:rgba(245,200,66,.3);color:var(--gold)'
      : paid ? 'background:rgba(45,232,176,.15);border-color:rgba(45,232,176,.3);color:var(--mint)'
      : '';

    return `<div class="rec-card-wrap ${paid?'paid':''}" data-rec-id="${r.id}">
      <div class="rec-theme-bg">${themeBg}</div>
      <div class="rec-card-inner" onclick="swipeRec(${r.id})">
        <div class="rec-day" style="${dayStyle}">${r.dayOfMonth}</div>
        <div class="rec-info" style="flex:1">
          <div class="rec-name">${themeBg} ${r.name}</div>
          <div class="rec-meta">${metaText}</div>
        </div>
        <div class="rec-amount">${paid?'✓ ':''} ${r.amount.toLocaleString('ru')} ₽</div>
        <button class="pay-btn ${paid?'unmark':'mark'}" onclick="event.stopPropagation();togglePaymentPaid(${r.id})"
          title="${paid?'Снять отметку':'Оплачено'}" style="flex-shrink:0">
          ${paid?'↩':'✓'}
        </button>
      </div>
      <div class="rec-swipe-actions">
        <button class="rec-action-edit" onclick="swipeRec(${r.id});openRecurringSheet(${r.id})">
          <span>✏️</span><span>Ред.</span>
        </button>
        <button class="rec-action-del" onclick="deleteRecurring(${r.id})">
          <span>🗑</span><span>Удал.</span>
        </button>
      </div>
    </div>`;
  }).join('');

  // Close swipe on outside tap
  setTimeout(() => {
    document.addEventListener('click', function closeSwipes(e) {
      if (!e.target.closest('.rec-card-wrap')) {
        document.querySelectorAll('.rec-card-wrap.swiped').forEach(c => c.classList.remove('swiped'));
        document.removeEventListener('click', closeSwipes);
      }
    });
  }, 0);

  const total     = DB.recurringPayments.reduce((s,r)=>s+r.amount, 0);
  const paidSum   = DB.recurringPayments.filter(r=>isPaymentPaid(r.id)).reduce((s,r)=>s+r.amount, 0);
  const unpaidSum = total - paidSum;
  const stats     = calcStats();
  const remains   = stats.balance - unpaidSum;

  const summaryEl = document.getElementById('recurring-summary');
  summaryEl.style.display = 'block';
  summaryEl.innerHTML = `
    <div class="row-between"><span style="font-size:.78rem;color:var(--muted)">Итого в месяц:</span><span class="chip chip-coral">${total.toLocaleString('ru')} ₽</span></div>
    ${paidSum > 0 ? `<div class="row-between mt8"><span style="font-size:.78rem;color:var(--muted)">Оплачено:</span><span class="chip chip-mint">${paidSum.toLocaleString('ru')} ₽</span></div>` : ''}
    <div class="row-between mt8"><span style="font-size:.78rem;color:var(--muted)">Осталось оплатить:</span><span class="chip ${unpaidSum===0?'chip-mint':'chip-gold'}">${unpaidSum.toLocaleString('ru')} ₽</span></div>
    <div class="row-between mt8"><span style="font-size:.78rem;color:var(--muted)">Хватит на платежи:</span><span class="chip ${remains<0?'chip-coral':remains<unpaidSum*0.5?'chip-gold':'chip-mint'}">${remains.toLocaleString('ru')} ₽</span></div>`;
}


/* ── Upcoming payments widget for TODAY page ── */
function renderUpcomingPayments() {
  const block = document.getElementById('upcoming-payments-block');
  if (!block) return;
  if (DB.recurringPayments.length === 0) { block.innerHTML = ''; return; }

  const today = new Date();
  const todayDate = today.getDate();
  const CAT_ICO = {housing:'🏠',transport:'🚗',subscription:'📱',health:'💊',education:'📚',other:'📦'};

  // Find payments due in next 7 days
  const upcoming = DB.recurringPayments
    .map(r => {
      let payDate = new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth);
      if (payDate < today) payDate = new Date(today.getFullYear(), today.getMonth()+1, r.dayOfMonth);
      const daysLeft = Math.ceil((payDate - today) / 86400000);
      return { ...r, daysLeft, payDate };
    })
    .filter(r => r.daysLeft <= 7 && r.daysLeft >= 0)
    .sort((a,b) => a.daysLeft - b.daysLeft);

  if (upcoming.length === 0) { block.innerHTML = ''; return; }

  const unpaidUpcoming = upcoming.filter(r => !isPaymentPaid(r.id));
  if (unpaidUpcoming.length === 0) { block.innerHTML = ''; return; }

  const totalSum = unpaidUpcoming.reduce((s,r)=>s+r.amount, 0);
  const urgentCount = unpaidUpcoming.filter(r=>r.daysLeft<=2).length;

  block.innerHTML = `<div class="upcoming-card">
    <div class="upcoming-hdr">
      <div class="upcoming-title">
        <span>📅</span> Предстоящие платежи
      </div>
      <span class="upcoming-badge">${unpaidUpcoming.length} · ${totalSum.toLocaleString('ru')} ₽</span>
    </div>
    ${unpaidUpcoming.map(r => {
      const cls = r.daysLeft <= 2 ? 'urgent' : r.daysLeft <= 4 ? 'soon' : 'ok';
      const dayLabel = r.daysLeft === 0 ? 'сегодня' : r.daysLeft === 1 ? 'завтра' : `${r.daysLeft} дн.`;
      const dateStr = r.payDate.getDate() + ' ' + MONTHS_RU[r.payDate.getMonth()].slice(0,3)+'.';
      return `<div class="upcoming-item">
        <div class="upcoming-days ${cls}">
          <div class="ud-n">${r.daysLeft===0?'!':r.daysLeft}</div>
          <div class="ud-l">${r.daysLeft===0?'сег.':'дн.'}</div>
        </div>
        <div class="upcoming-item-info">
          <div class="upcoming-name">${CAT_ICO[r.category]||'📦'} ${r.name}</div>
          <div class="upcoming-date">${dateStr} — ${dayLabel}</div>
        </div>
        <div class="upcoming-amt">${r.amount.toLocaleString('ru')} ₽</div>
      </div>`;
    }).join('')}
    <div style="padding:12px 16px;border-top:1px solid rgba(255,255,255,.05)">
      <button onclick="navTo('capital');setTimeout(()=>{document.querySelector('[data-cap=recurring]').click()},100)" style="width:100%;background:rgba(77,166,255,.12);border:1px solid rgba(77,166,255,.22);color:var(--blue);font-family:var(--font-head);font-size:.78rem;font-weight:800;padding:10px;border-radius:12px;cursor:pointer">
        Отметить оплаченными →
      </button>
    </div>
  </div>`;
}

/* ═══════════════════════════════════════
   SMART ALERTS ENGINE
═══════════════════════════════════════ */
function checkAlerts() {
  const alerts = [];
  const stats  = calcStats();
  const budget = calcBudget5020(stats.income, stats.expense);
  const recTotal = DB.recurringPayments.reduce((s,r)=>s+r.amount, 0);
  const today = new Date();
  const level = DB.user.socialLevel || 'starter';
  const isNewbie = (level === 'starter');

  // 1. Budget alerts — адаптируем под уровень
  if (budget) {
    const wantsPct = budget.wants.limit > 0 ? budget.wants.fact / budget.wants.limit : 0;
    const canSave  = stats.balance > 0;

    if (wantsPct >= 0.85 && wantsPct < 1) {
      const pct = Math.round(wantsPct*100);
      const left = Math.round(budget.wants.limit - budget.wants.fact).toLocaleString('ru');
      alerts.push({
        type: 'warn', ico: '⚠️',
        title: isNewbie ? 'Осторожно — почти всё потрачено на "хотелки"' : 'Почти исчерпан лимит «Желания»',
        text: isNewbie
          ? `Ты уже потратил ${pct}% от суммы, которую стоит тратить на необязательное. Осталось ${left} ₽ — подумай дважды перед следующей покупкой.`
          : `Использовано ${pct}% из 30% бюджета. Осталось ${left} ₽.`,
        action: canSave ? { label: 'Отложить остаток', fn: "openSheet('savings')" } : null,
        academy: isNewbie ? 'c1' : null,
        academyLabel: 'Что такое бюджет?',
        dismiss: true
      });
    } else if (wantsPct >= 1) {
      const over = Math.round(budget.wants.fact - budget.wants.limit).toLocaleString('ru');
      alerts.push({
        type: 'warn', ico: '🚨',
        title: isNewbie ? 'Потрачено больше чем нужно' : 'Перерасход на желания',
        text: isNewbie
          ? `Ты вышел за рамки разумного на ${over} ₽. Это нормально в начале — важно заметить и не повторять. Попробуй записывать каждую трату.`
          : canSave
            ? `Лимит превышен на ${over} ₽. Перенесите свободный остаток в накопления.`
            : `Лимит превышен на ${over} ₽. Свободных средств нет.`,
        action: canSave && !isNewbie ? { label: 'В накопления', fn: "openSheet('savings')" } : null,
        academy: isNewbie ? 'c1' : null,
        academyLabel: 'Как планировать расходы?',
        dismiss: true
      });
    }

    // Напоминание о накоплениях
    const monthlySavingsTotal = DB.savings.filter(s => {
      const d = new Date(s.date);
      return d.getFullYear()===today.getFullYear() && d.getMonth()===today.getMonth();
    }).reduce((s,e)=>s+e.amount, 0);
    const savingsTarget = Math.round(budget.savings.limit);
    if (canSave && savingsTarget > 0 && monthlySavingsTotal < savingsTarget * 0.5 && stats.income > 0) {
      if (isNewbie) {
        alerts.push({
          type: 'gold', ico: '🏦',
          title: 'Отложи часть дохода',
          text: `Хорошая привычка — откладывать хотя бы 10–20% от каждого дохода, пока не потратил. Рекомендуем: ${savingsTarget.toLocaleString('ru')} ₽.`,
          action: { label: '+ Отложить сейчас', fn: "openSheet('savings')" },
          academy: 'c1',
          academyLabel: 'Правило 50/30/20 — 3 мин',
          dismiss: true
        });
      } else {
        alerts.push({
          type: 'gold', ico: '🏦',
          title: 'Не забудьте отложить в накопления',
          text: `По правилу 50/30/20 цель — ${savingsTarget.toLocaleString('ru')} ₽. Отложено: ${monthlySavingsTotal.toLocaleString('ru')} ₽.`,
          action: { label: '+ В накопления', fn: "openSheet('savings')" },
          dismiss: true
        });
      }
    }
  }

  // 2. Recurring payments
  if (recTotal > 0) {
    const upcoming = DB.recurringPayments.filter(r => {
      if (isPaymentPaid(r.id)) return false;
      const payDate = new Date(today.getFullYear(), today.getMonth(), r.dayOfMonth);
      const diff = Math.ceil((payDate - today) / 86400000);
      return diff >= 0 && diff <= 7;
    });
    if (upcoming.length > 0 && stats.balance < recTotal) {
      const upcomingSum = upcoming.reduce((s,r)=>s+r.amount, 0);
      alerts.push({
        type: 'warn', ico: '🔴',
        title: 'Не хватает на плановые платежи',
        text: `Предстоит: ${upcoming.map(r=>r.name).join(', ')} — итого ${upcomingSum.toLocaleString('ru')} ₽. На балансе: ${stats.balance.toLocaleString('ru')} ₽.`,
        action: null, dismiss: true
      });
    } else if (upcoming.length > 0 && stats.balance < recTotal * 1.2) {
      const upcomingSum = upcoming.reduce((s,r)=>s+r.amount, 0);
      const minDays = Math.min(...upcoming.map(r=>Math.abs(r.dayOfMonth - today.getDate())));
      alerts.push({
        type: 'gold', ico: '⏰',
        title: `Платёж через ${minDays} дн.`,
        text: `${upcoming.map(r=>r.name+' — '+r.amount.toLocaleString('ru')+' ₽').join('; ')}. Не трать лишнего.`,
        action: null, dismiss: true
      });
    }
  }

  // Render
  const alertsEl = document.getElementById('smart-alerts');
  if (!alertsEl) return;
  if (alerts.length === 0) { alertsEl.innerHTML = ''; return; }
  alertsEl.innerHTML = alerts.map((a,i) => `
    <div class="alert-card ${a.type}" id="alert-${i}">
      <div class="alert-ico">${a.ico}</div>
      <div class="alert-body">
        <div class="alert-title">${a.title}</div>
        <div class="alert-text">${a.text}</div>
        <div class="alert-actions">
          ${a.action ? `<button class="alert-btn gold-btn" onclick="${a.action.fn}">${a.action.label}</button>` : ''}
          ${a.academy ? `<button class="alert-btn" style="background:rgba(77,166,255,.12);border:1px solid rgba(77,166,255,.2);color:var(--blue)" onclick="openCourse('${a.academy}')">📚 ${a.academyLabel||'Изучить'}</button>` : ''}
          ${a.dismiss ? `<button class="alert-btn dim-btn" onclick="dismissAlert(${i})">Закрыть</button>` : ''}
        </div>
      </div>
    </div>`).join('');
}

function dismissAlert(i) {
  const el = document.getElementById('alert-'+i);
  if (el) { el.style.opacity='0'; el.style.transform='scale(.95)'; el.style.transition='all .25s'; setTimeout(()=>el.remove(),250); }
}

/* ═══════════════════════════════════════
   LOTTIE ANIMATION ENGINE
═══════════════════════════════════════ */
(function() {
  // Parse embedded JSON once
  const _lottieData = window.LOTTIE_DATA;

  // Store all lottie instances
  const _lottieInstances = {};

  function createLottie(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;
    if (_lottieInstances[containerId]) {
      _lottieInstances[containerId].destroy();
    }
    const inst = lottie.loadAnimation({
      container,
      renderer: 'canvas',
      loop: options.loop !== undefined ? options.loop : true,
      autoplay: options.autoplay !== undefined ? options.autoplay : true,
      animationData: _lottieData,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet', clearCanvas: true }
    });
    _lottieInstances[containerId] = inst;
    return inst;
  }

  // ── Header logo — loop with 5s pause ──
  function initHeaderLottie() {
    const inst = createLottie('header-lottie-container', { loop: false, autoplay: true });
    if (!inst) return;
    inst.addEventListener('complete', () => {
      setTimeout(() => {
        if (_lottieInstances['header-lottie-container']) {
          _lottieInstances['header-lottie-container'].goToAndPlay(0, true);
        }
      }, 5000);
    });
  }

  // ── Splash screen ──
  let _splashDone = false;

  function hideSplash() {
    if (_splashDone) return;
    _splashDone = true;
    const el = document.getElementById('splash-screen');
    if (!el) return;
    el.classList.add('hiding');
    setTimeout(() => el.classList.add('hidden'), 450);
  }

  function initSplash() {
    const inst = createLottie('splash-lottie-container', { loop: true, autoplay: true });

    // Minimum splash time: 2s, then hide
    const minTime = 2500;
    const start = Date.now();
    function tryHide() {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, minTime - elapsed);
      setTimeout(hideSplash, wait);
    }

    // Hide when DOM ready + min time passed
    if (document.readyState === 'complete') {
      tryHide();
    } else {
      window.addEventListener('load', tryHide);
    }
  }

  // ── Loading spinner overlay (for slow page transitions > 0.3s) ──
  let _loadingTimer = null;
  let _loadingShown = false;

  window._showLoadingOverlay = function() {
    _loadingTimer = setTimeout(() => {
      const el = document.getElementById('splash-screen');
      if (!el) return;
      el.classList.remove('hidden', 'hiding');
      _loadingShown = true;
    }, 300);
  };

  window._hideLoadingOverlay = function() {
    if (_loadingTimer) { clearTimeout(_loadingTimer); _loadingTimer = null; }
    if (_loadingShown) {
      _splashDone = false; // allow hide again
      hideSplash();
      _loadingShown = false;
    }
  };

  // ── AI avatars (lazy init — created when container is visible) ──
  function initAiAvatars() {
    createLottie('ai-avatar-lottie-container', { loop: true, autoplay: true });
    createLottie('ap-avatar-lottie-container', { loop: true, autoplay: true });
  }

  // ── Auth/onboarding logos (also replace with lottie) ──
  function initAuthLogos() {
    document.querySelectorAll('.auth-logo-wrap').forEach((wrap, i) => {
      const id = 'auth-lottie-' + i;
      let holder = wrap.querySelector('.auth-logo-lottie');
      if (!holder) {
        holder = document.createElement('div');
        holder.className = 'auth-logo-lottie';
        wrap.appendChild(holder);
      }
      holder.id = id;
      const size = parseFloat(wrap.dataset.logoSize || '100');
      const scale = parseFloat(wrap.dataset.logoScale || '1');
      holder.style.width = size + '%';
      holder.style.height = size + '%';
      holder.style.transform = 'scale(' + scale + ')';
      wrap.classList.add('auth-logo-ready');
      createLottie(id, { loop: true, autoplay: true });
    });
  }

  // ── Boot sequence ──
  document.addEventListener('DOMContentLoaded', () => {
    initSplash();
    setTimeout(initHeaderLottie, 100);
    setTimeout(initAiAvatars, 200);
    setTimeout(initAuthLogos, 300);
  });

  // ── Patch page navigation to show loading on slow transitions ──
  const _origNav = window.showPage || null;

})();
