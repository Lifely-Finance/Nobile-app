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
  renderRiskDialogContent(_lastRisks, _lastRiskText
