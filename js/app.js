import { state, update, save, reset } from './store.js';
import { CATEGORIES, CUISINES, DIETS, ALLERGENS, INGREDIENTS, RECIPES as ALL_RECIPES } from './data.js';
import {
  suggest, toPantryItem, mergePantry, freshness, daysLeft, recipeIngredientState, estimateSaving, ingredientById,
} from './engine.js';
import {
  aiStatus, imageLimit, serverConfig, fetchPlan, redeemCode, detectIngredients, demoIngredients, generateRecipes,
  imageFileToShot, videoFileToShots, openPermissions,
} from './ai.js';
import { icon, catIcon } from './icons.js';

// הדמות של האפליקציה – התמונה שבתיקיית assets
const HOST = {
  photo: 'assets/host.jpg',
  avatar: 'assets/host-avatar.jpg',
  title: 'המייסד של SmartPantry',
};

const $view = document.getElementById('view');
const $tabbar = document.getElementById('tabbar');
const $sheetRoot = document.getElementById('sheet-root');
const $toast = document.getElementById('toast');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shekel = (n) => `₪${Math.round(n).toLocaleString('he-IL')}`;
const reduceMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

let scanSession = null;
let aiRecipesStatus = 'idle';
let autoAiRecipes = false; // יצירת מתכוני AI פעם אחת אחרי סריקה

// ---------------- ניווט ----------------

const routes = { onboarding, home, scan, pantry, recipes, profile };

// ניתוב בזיכרון (עובד גם בתוך iframe מוגבל); ה-hash רק לנוחות
let route = (location.hash.match(/^#\/?(\w+)$/) || [])[1] || 'home';

function go(next, { replace = false } = {}) {
  const changed = next !== route;
  route = next;
  try {
    const hash = `#${next}`;
    if (replace) history.replaceState({ route: next }, '', hash); else history.pushState({ route: next }, '', hash);
  } catch { /* sandbox */ }
  render({ enter: changed });
}

function currentRoute() {
  if (!state.onboarded) return 'onboarding';
  return routes[route] ? route : 'home';
}

/** enter=true רק במעבר מסך – רענון באותו מסך לא מנגן אנימציה שוב */
function render({ enter = false } = {}) {
  const r = currentRoute();
  $tabbar.hidden = r === 'onboarding';
  $tabbar.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.route === r));
  $view.className = `view view-${r}${enter ? ' entering' : ''}`;
  $view.innerHTML = routes[r]();
  if (enter) window.scrollTo(0, 0);
  bind[r]?.();
}

window.addEventListener('popstate', (e) => { if (e.state?.route) { route = e.state.route; render({ enter: true }); } });
$tabbar.addEventListener('click', (e) => {
  const t = e.target.closest('.tab');
  if (t) go(t.dataset.route);
});

function toast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  requestAnimationFrame(() => $toast.classList.add('show'));
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { $toast.classList.remove('show'); setTimeout(() => ($toast.hidden = true), 200); }, 2400);
}

const bind = {};

/** אישור בלחיצה שנייה במקום confirm() */
function confirmTap(btn, label, action) {
  if (btn.dataset.armed) { action(); return; }
  btn.dataset.armed = '1';
  const prev = btn.innerHTML;
  btn.textContent = label;
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.innerHTML = prev; } }, 3000);
}

// ---------------- רכיבים משותפים ----------------

function hostBubble(html, extra = '') {
  return `
    <div class="host-bubble ${extra}">
      <img class="avatar" src="${HOST.avatar}" alt="" width="40" height="40" />
      <div class="bubble">${html}</div>
    </div>`;
}

function chip({ label, active, attrs = '', ic = '' }) {
  return `<button type="button" class="chip ${active ? 'active' : ''}" aria-pressed="${active ? 'true' : 'false'}" ${attrs}>${ic ? icon(ic, 16) : ''}<span>${label}</span></button>`;
}

function stats() {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const month = state.cooked.filter((c) => c.at >= monthStart.getTime());
  return {
    monthSaved: month.reduce((a, c) => a + c.saved, 0),
    monthMeals: month.length,
    totalSaved: state.cooked.reduce((a, c) => a + c.saved, 0),
    totalMeals: state.cooked.length,
  };
}

/** המצרך המרכזי של מתכון (הראשון שחובה) – לאייקון באמנות */
function heroIngredient(r) {
  const main = r.ingredients.find((i) => !i.optional) || r.ingredients[0];
  const ing = main?.id ? ingredientById(main.id) : null;
  return { cat: ing?.cat || 'other', id: main?.id, name: ing?.name || main?.name || '' };
}

/** אמנות טיפוגרפית למתכון: הדקות בגדול + אייקון המצרך המרכזי */
function recipeArt(r, size = 'md') {
  const main = heroIngredient(r);
  return `
    <div class="rc-art art-${size}" data-cuisine="${esc(r.cuisine)}">
      <span class="art-min"><b>${r.time}</b><small>דק׳</small></span>
      <span class="art-ic">${catIcon(main.cat, main.id, size === 'lg' ? 30 : 18)}</span>
      ${size === 'lg' ? `<span class="art-ings">${r.ingredients.filter((i) => !i.optional).map((i) => esc(ingredientById(i.id)?.name || i.name)).join(' · ')}</span>` : ''}
      ${r.ai ? '<i class="badge-ai">AI</i>' : ''}
    </div>`;
}

function recipeCard(item, i = 0, { compact = false } = {}) {
  const r = item.recipe || item;
  const missing = item.missing || [];
  const tag = missing.length
    ? `<span class="rc-tag warn">${icon('alert', 14)}חסר רק: ${esc(missing.join(', '))}</span>`
    : item.usesUrgent
      ? `<span class="rc-tag save">${icon('recycle', 14)}מציל מצרכים שעומדים להתקלקל</span>`
      : r.why ? `<span class="rc-tag">${esc(r.why)}</span>` : `<span class="rc-tag ok">${icon('check', 14)}יש הכל בבית</span>`;
  return `
    <button type="button" class="recipe-card ${compact ? 'compact' : ''}" style="--i:${i}" data-recipe="${esc(r.id)}">
      ${recipeArt(r)}
      <div class="rc-body">
        <h3>${esc(r.title)}</h3>
        <div class="rc-meta">
          <span>${CUISINES[r.cuisine] ?? ''}</span>
          <span>${r.pans === 0 ? 'בלי כלים' : r.pans === 1 ? 'כלי אחד' : `${r.pans} כלים`}</span>
          <span>${r.protein} ג׳ חלבון</span>
        </div>
        ${tag}
      </div>
    </button>`;
}

function modeControls() {
  const m = state.mode;
  const energy = [
    { id: 'full', label: 'מלא אנרגיה', ic: 'battFull' },
    { id: 'ok', label: 'בסדר', ic: 'battMid' },
    { id: 'dead', label: 'גמור/ה', ic: 'battLow' },
  ];
  return `
    <div class="mode">
      <div class="segmented" role="group" aria-label="רמת אנרגיה" style="--n:${energy.findIndex((e) => e.id === m.energy)}">
        <i class="seg-thumb" aria-hidden="true"></i>
        ${energy.map((e) => `<button type="button" class="seg ${m.energy === e.id ? 'active' : ''}" aria-pressed="${m.energy === e.id}" data-energy="${e.id}">${icon(e.ic, 18)}<span>${e.label}</span></button>`).join('')}
      </div>
      <div class="mode-row scroll" role="group" aria-label="סינון">
        ${chip({ label: '5 דקות', active: m.maxTime === 5, attrs: 'data-time="5"', ic: 'clock' })}
        ${chip({ label: '15 דקות', active: m.maxTime === 15, attrs: 'data-time="15"', ic: 'clock' })}
        ${chip({ label: 'בלי לשטוף מחבתות', active: m.noDishes, attrs: 'data-nodishes', ic: 'pan' })}
        ${Object.entries(CUISINES).map(([id, label]) => chip({ label, active: m.cuisine === id, attrs: `data-cuisine="${id}"` })).join('')}
      </div>
    </div>`;
}

function bindModeControls(root, after) {
  root.querySelectorAll('[data-energy]').forEach((b) => b.addEventListener('click', () => {
    state.mode.energy = b.dataset.energy;
    if (b.dataset.energy === 'dead') { state.mode.maxTime = 5; state.mode.noDishes = true; }
    if (b.dataset.energy === 'full') { state.mode.maxTime = 15; state.mode.noDishes = false; }
    save(); after();
  }));
  root.querySelectorAll('[data-time]').forEach((b) => b.addEventListener('click', () => {
    state.mode.maxTime = Number(b.dataset.time);
    if (state.mode.maxTime > 6 && state.mode.energy === 'dead') state.mode.energy = 'ok';
    save(); after();
  }));
  root.querySelectorAll('[data-nodishes]').forEach((b) => b.addEventListener('click', () => {
    state.mode.noDishes = !state.mode.noDishes; save(); after();
  }));
  root.querySelectorAll('[data-cuisine]').forEach((b) => b.addEventListener('click', () => {
    state.mode.cuisine = state.mode.cuisine === b.dataset.cuisine ? null : b.dataset.cuisine; save(); after();
  }));
}

function bindRecipeCards(root) {
  root.querySelectorAll('[data-recipe]').forEach((el) => el.addEventListener('click', () => openRecipe(el.dataset.recipe)));
}

function bindGo(root) {
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
}

// ---------------- Onboarding ----------------

let obStep = 0;

function onboarding() {
  if (obStep === 0) {
    return `
      <section class="ob-hero">
        <img class="ob-photo" src="${HOST.photo}" alt="${HOST.title}" />
        <div class="ob-overlay">
          <div class="brand">${icon('leaf', 16)} SmartPantry</div>
          <h1>מה אוכלים<br/>בבית?</h1>
          <p class="lead">צילום אחד של המקרר, ושלושה מתכונים של רבע שעה. בלי להקליד, בלי לקפוץ לסופר, בלי וולט ב-80 ש״ח.</p>
          <figure class="ob-quote">
            <img src="${HOST.avatar}" alt="" />
            <blockquote>״כל הזמנה שלא עשיתם היא כסף שנשאר אצלכם בכיס.״<figcaption>${HOST.title}</figcaption></blockquote>
          </figure>
          <button class="btn primary xl" id="ob-next">בואו נתחיל ${icon('arrow', 18)}</button>
        </div>
      </section>`;
  }
  if (obStep === 1) {
    const how = [
      ['camera', 'סריקה בשנייה', 'פותחים את המקרר ומצלמים תמונה, או סרטון של 3 שניות על המדפים.'],
      ['sparkle', 'ה-AI מזהה הכל', 'גם קופסאות פתוחות, ירקות עייפים ושאריות.'],
      ['clock', 'מתכונים של רבע שעה', '3-4 מתכונים רק ממה שיש עכשיו בבית. אפס קניות.'],
      ['battLow', 'מצב אפס מאמץ', 'יש לי 5 דקות. בא לי איטלקי. אין לי כוח לשטוף מחבתות.'],
    ];
    return `
      <section class="ob-steps">
        <div class="ob-progress" aria-hidden="true"><i style="--p:.5"></i></div>
        <p class="eyebrow">שלב 1 מתוך 2</p>
        <h2>ככה זה עובד</h2>
        <ol class="how">
          ${how.map(([ic, t, d], i) => `<li style="--i:${i}"><span class="how-ic">${icon(ic, 22)}</span><div><b>${t}</b><p>${d}</p></div></li>`).join('')}
        </ol>
        ${hostBubble('בבית ממוצע זורקים כמעט שליש מהאוכל שקונים. בואו נוריד את זה.')}
        <button class="btn primary xl" id="ob-next">ממשיכים ${icon('arrow', 18)}</button>
      </section>`;
  }
  return `
    <section class="ob-steps">
      <div class="ob-progress" aria-hidden="true"><i style="--p:1"></i></div>
      <p class="eyebrow">שלב 2 מתוך 2</p>
      <h2>רגע של התאמה אישית</h2>
      <div class="field"><label for="ob-name">איך לקרוא לך?</label><input id="ob-name" type="text" placeholder="השם שלך" value="${esc(state.name)}" autocomplete="given-name" /></div>
      <h3 class="sub">תזונה</h3>
      <div class="chips wrap">${DIETS.map((d) => chip({ label: d.label, active: state.diets.includes(d.id), attrs: `data-diet="${d.id}"` })).join('')}</div>
      <h3 class="sub">רגישויות ואלרגיות</h3>
      <div class="chips wrap">${ALLERGENS.map((a) => chip({ label: a.label, active: state.allergens.includes(a.id), attrs: `data-allergen="${a.id}"` })).join('')}</div>
      <p class="muted small hint">אפשר לשנות בכל רגע בפרופיל. האפליקציה גם לומדת לבד מה אתם מבשלים.</p>
      <button class="btn primary xl" id="ob-done">${icon('camera', 20)} לסרוק את המקרר</button>
    </section>`;
}

bind.onboarding = () => {
  $view.querySelector('#ob-next')?.addEventListener('click', () => { obStep++; render({ enter: true }); });
  bindToggles($view);
  $view.querySelector('#ob-done')?.addEventListener('click', () => {
    update({ onboarded: true, name: $view.querySelector('#ob-name').value.trim() });
    go('scan', { replace: true });
  });
};

function bindToggles(root) {
  const toggle = (btn, key, id) => {
    state[key] = state[key].includes(id) ? state[key].filter((d) => d !== id) : [...state[key], id];
    save();
    const on = state[key].includes(id);
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on);
  };
  root.querySelectorAll('[data-diet]').forEach((b) => b.addEventListener('click', () => toggle(b, 'diets', b.dataset.diet)));
  root.querySelectorAll('[data-allergen]').forEach((b) => b.addEventListener('click', () => toggle(b, 'allergens', b.dataset.allergen)));
}

// ---------------- Home ----------------

function greeting() {
  const h = new Date().getHours();
  const part = h < 11 ? 'בוקר טוב' : h < 16 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
  return state.name ? `${part}, ${esc(state.name)}` : part;
}

const MONTH_GOAL = 1000;

function home() {
  const s = stats();
  const urgent = state.pantry.filter((p) => daysLeft(p) <= 2);
  const { ready, almost } = suggest(state);
  const empty = state.pantry.length === 0;

  return `
    <header class="topbar">
      <div>
        <p class="muted">${greeting()}</p>
        <h1 class="title">מה אוכלים היום?</h1>
      </div>
      <button class="avatar-btn" data-go="profile" aria-label="פרופיל"><img src="${HOST.avatar}" alt="" /></button>
    </header>

    <section class="savings-card" aria-label="חיסכון החודש">
      <div class="sc-text">
        <p class="sc-label">חסכת החודש</p>
        <p class="sc-amount" data-count="${Math.round(s.monthSaved)}">${shekel(s.monthSaved)}</p>
        <p class="sc-sub">${s.monthMeals ? `${s.monthMeals} ארוחות בבית במקום משלוח` : 'כל ארוחה בבית משאירה בערך ₪60 בכיס'}</p>
        <div class="sc-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${MONTH_GOAL}" aria-valuenow="${Math.round(s.monthSaved)}"><i style="--p:${Math.min(1, s.monthSaved / MONTH_GOAL)}"></i></div>
        <p class="sc-goal">יעד חודשי ${shekel(MONTH_GOAL)}</p>
      </div>
      <img class="sc-host" src="${HOST.photo}" alt="${HOST.title}" />
    </section>

    <button class="scan-cta" data-go="scan">
      <span class="scan-cta-ic">${icon('camera', 24)}<i class="live-dot" aria-hidden="true"></i></span>
      <span class="scan-cta-text"><b>${empty ? 'סרקו את המקרר' : 'סריקה חדשה'}</b><small>${ai.status === 'server' && ai.plan?.plan === 'free' ? `נשארו ${ai.plan.scansLeft} סריקות החודש` : state.lastScanAt ? `סריקה אחרונה ${timeAgo(state.lastScanAt)}` : 'צלמו, והמצרכים מזוהים לבד'}</small></span>
      ${icon('arrow', 20, 'chev')}
    </button>

    ${urgent.length ? `
      <section class="urgent-strip" aria-label="להשתמש בהקדם">
        <h2>${icon('timer', 18)} להשתמש בהקדם</h2>
        <div class="chips wrap">${urgent.map((p) => `<span class="pill urgent">${esc(p.name)}</span>`).join('')}</div>
      </section>` : ''}

    <section class="section">
      <div class="section-head"><h2>איך האנרגיה?</h2></div>
      <div id="home-mode">${modeControls()}</div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>מתכונים עכשיו</h2>
        ${ready.length ? '<button class="link" data-go="recipes">לכל המתכונים</button>' : ''}
      </div>
      ${empty
        ? hostBubble('המקרר שלכם עוד ריק אצלי. צלמו אותו ואמצא לכם ארוחה תוך שניות.')
        : ready.length
          ? `<div class="recipe-list">${ready.slice(0, 3).map((x, i) => recipeCard(x, i)).join('')}</div>`
          : hostBubble(`לא מצאתי מתכון מדויק עם הסינון הזה${almost.length ? '. יש כמה שחסר בהם רק דבר אחד:' : '. נסו להוריד סינון.'}`)}
      ${!empty && !ready.length && almost.length ? `<div class="recipe-list">${almost.map((x, i) => recipeCard(x, i)).join('')}</div>` : ''}
    </section>

    <section class="section">
      ${hostBubble(tipOfDay())}
    </section>`;
}

function tipOfDay() {
  const tips = [
    '<b>טיפ:</b> אורז מאתמול הוא הבסיס הכי טוב לאורז מוקפץ. הוא יבש יותר ולא נדבק.',
    '<b>טיפ:</b> עגבניות עייפות מושלמות לשקשוקה או לרוטב. שם הן הכי טעימות.',
    '<b>טיפ:</b> ביצים הן הבסיס לארוחה של 5 דקות. שתמיד יהיו בבית.',
    '<b>טיפ:</b> שמרו עשבי תיבול בכוס מים במקרר והם יחזיקו פי שלושה.',
    '<b>טיפ:</b> משלוח אחד פחות בשבוע שווה יותר מ-₪3,000 בשנה.',
  ];
  return tips[new Date().getDate() % tips.length];
}

function timeAgo(t) {
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return 'עכשיו';
  if (m < 60) return `לפני ${m} דק׳`;
  const h = Math.round(m / 60);
  if (h < 24) return `לפני ${h} שע׳`;
  return `לפני ${Math.round(h / 24)} ימים`;
}

/** ספירה של סכום החיסכון – פעם אחת כשנכנסים למסך */
function countUp(el) {
  const target = Number(el.dataset.count);
  if (!target || reduceMotion()) return;
  const start = performance.now();
  const dur = 700;
  const tick = (now) => {
    const t = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - t, 4);
    el.textContent = shekel(target * eased);
    if (t < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

bind.home = () => {
  bindGo($view);
  bindRecipeCards($view);
  bindModeControls($view.querySelector('#home-mode'), () => render());
  if ($view.classList.contains('entering')) {
    const amount = $view.querySelector('.sc-amount');
    if (amount) countUp(amount);
  }
};

// ---------------- Scan ----------------
// scanSession: { status: 'capture'|'scanning'|'review'|'error', shots, detected, demo, error, ctl }

/** מצב החיבור ל-AI והתוכנית של המשתמש – מתעדכן ברקע */
const ai = { status: 'checking', limit: 0, cfg: null, plan: null };

async function refreshAi() {
  ai.status = await aiStatus();
  ai.limit = await imageLimit();
  ai.cfg = await serverConfig();
  if (ai.status === 'server') ai.plan = await fetchPlan(state.deviceId).catch(() => ai.plan);
  const r = currentRoute();
  if (['home', 'scan', 'profile', 'recipes'].includes(r) && scanSession?.status !== 'scanning' && !$sheetRoot.innerHTML) render();
}

function setPlan(plan) {
  if (plan) ai.plan = plan;
}

const canScan = () => ai.status === 'server' || ai.status === 'claude';
const isPremium = () => ai.plan?.plan === 'premium';
const outOfScans = () => ai.status === 'server' && ai.plan?.plan === 'free' && ai.plan.scansLeft <= 0;
const dateHe = (t) => new Date(t).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });

function aiPill() {
  if (ai.status === 'server' && ai.plan) {
    if (isPremium()) return '<span class="pill ai-pill ok"><i class="dot"></i>Premium</span>';
    const left = ai.plan.scansLeft;
    return `<span class="pill ai-pill ${left > 0 ? 'ok' : 'urgent'}">${left > 0 ? `${left} סריקות נשארו` : 'נגמרו הסריקות'}</span>`;
  }
  const [level, label] = {
    checking: ['', 'בודק חיבור'],
    server: ['ok', 'סריקה זמינה'],
    unconfigured: ['urgent', 'השירות לא הוגדר'],
    claude: ['ok', 'Claude מחובר'],
    text: ['soon', 'אין שליחת תמונות כאן'],
    none: ['urgent', 'אין חיבור לזיהוי'],
  }[ai.status] || ['', ''];
  return `<span class="pill ai-pill ${level}">${level === 'ok' ? '<i class="dot"></i>' : ''}${label}</span>`;
}

function noAiHelp() {
  const msg = {
    none: 'כדי לזהות את המקרר <b>האמיתי</b> שלכם צריך חיבור לשרת הזיהוי. בלי חיבור לא אציג רשימה שלא באמת זוהתה.',
    unconfigured: 'השרת עדיין לא הוגדר: חסר בו מפתח Claude API. בעל האפליקציה צריך להוסיף את ANTHROPIC_API_KEY בהגדרות השרת.',
    text: 'התצוגה הזו לא מאפשרת לשלוח תמונות ל-Claude. פתחו את הקישור ב-claude.ai בדפדפן ונסו שוב.',
  }[ai.status];
  return msg ? hostBubble(msg, 'subtle') : '';
}

/** טקסט ידידותי לכל קוד שגיאה */
function errorCopy(code, detail = '') {
  const C = {
    no_ai: ['אין חיבור לשרת הזיהוי', 'בלי חיבור אי אפשר לזהות את התמונה. נסו שוב מאוחר יותר.'],
    not_configured: ['השירות עדיין לא הוגדר', 'חסר מפתח Claude API בשרת. אם זו האפליקציה שלכם, הוסיפו ANTHROPIC_API_KEY בהגדרות של Vercel.'],
    billing: ['השירות לא זמין כרגע', 'נסו שוב מאוחר יותר.'],
    upstream_busy: ['השירות עמוס כרגע', 'נסו שוב בעוד דקה.'],
    server_busy: ['השירות עמוס היום', 'הגענו למגבלה היומית של השירות. נסו שוב מחר.'],
    quota_exceeded: ['נגמרו הסריקות החינמיות לחודש', `בתוכנית החינמית יש ${ai.cfg?.freeScans ?? 5} סריקות בחודש. עם Premium סורקים בלי לספור.`],
    daily_limit: ['הגעתם למגבלה היומית', 'נסו שוב מחר.'],
    network: ['אין חיבור לאינטרנט', 'בדקו את החיבור ונסו שוב.'],
    payload_too_large: ['התמונות גדולות מדי', 'הסירו תמונה או שתיים ונסו שוב.'],
    bad_request: ['משהו בתמונות לא תקין', 'נסו לצלם שוב.'],
    images_unavailable: ['אי אפשר לשלוח תמונות מכאן', 'פתחו את הקישור ב-claude.ai בדפדפן ונסו שוב.'],
    not_granted: ['הסריקה לא אושרה', 'הסריקה משתמשת בחשבון Claude שלכם, ולכן צריך לאשר אותה. אפשר להפעיל אותה מחדש בהרשאות של העמוד.'],
    sampling_disabled: ['Claude לא זמין בחשבון הזה', 'החשבון או הארגון לא מאפשרים לעמוד להשתמש ב-Claude.'],
    rate_limited: ['יותר מדי סריקות ברצף', 'חכו דקה ונסו שוב.'],
    session_expired: ['צריך להתחבר מחדש', 'התחברו ל-claude.ai ונסו שוב.'],
    image_rejected: ['התמונה לא נתמכת', 'נסו תמונה אחרת, בפורמט JPG או PNG.'],
    refused: ['לא הצלחנו לעבד את התמונה', 'נסו תמונה אחרת של המקרר.'],
    prompt_too_large: ['יותר מדי תמונות', 'הסירו תמונה או שתיים ונסו שוב.'],
    nothing_found: ['לא זוהו מצרכים', detail || 'ודאו שהמקרר פתוח ומואר וצלמו מקרוב יותר. הכי מדויק לצלם כל מדף בנפרד.'],
    empty_completion: ['לא התקבלה רשימה', 'נסו שוב, או צלמו מקרוב יותר.'],
    invalid_json: ['לא התקבלה רשימה', 'נסו שוב, או צלמו מקרוב יותר.'],
    upstream_error: ['תקלה זמנית בחיבור', 'נסו שוב בעוד רגע.'],
  };
  if (['capability_disabled', 'not_declared', 'capability_removed'].includes(code)) return C.sampling_disabled;
  return C[code] || C.upstream_error;
}

function scanCapture() {
  const s = scanSession;
  const shots = s?.shots || [];
  const max = ai.limit || 4;
  const header = `
    <header class="topbar">
      <div><p class="eyebrow">שלב 1 מתוך 2</p><h1 class="title">סריקת מקרר</h1></div>
      ${aiPill()}
    </header>`;
  const inputs = {
    photo: `<input type="file" accept="image/*" capture="environment" id="photo-input" hidden />`,
    gallery: `<input type="file" accept="image/*" multiple id="gallery-input" hidden />`,
    video: `<input type="file" accept="video/*" capture="environment" id="video-input" hidden />`,
  };

  if (!shots.length) {
    return `${header}
      <section class="capture">
        <div class="viewfinder">
          <i class="corner tl"></i><i class="corner tr"></i><i class="corner bl"></i><i class="corner br"></i>
          <div class="vf-shelves" aria-hidden="true">
            <div class="shelf">${['egg', 'dairy', 'veg'].map((n) => icon(n, 30)).join('')}</div>
            <div class="shelf">${['fruit', 'sauces', 'carbs'].map((n) => icon(n, 30)).join('')}</div>
            <div class="shelf">${['dairy', 'veg', 'other'].map((n) => icon(n, 30)).join('')}</div>
          </div>
          <p>פתחו את המקרר ומלאו את המסגרת</p>
        </div>
        <div class="capture-actions">
          <label class="btn primary xl file">${icon('camera', 22)} צילום המקרר${inputs.photo}</label>
          <div class="row-2">
            <label class="btn file">${icon('video', 20)} וידאו קצר${inputs.video}</label>
            <label class="btn file">${icon('image', 20)} מהגלריה${inputs.gallery}</label>
          </div>
        </div>
        ${canScan() || ai.status === 'checking'
          ? hostBubble(`<b>לזיהוי הכי מדויק:</b> צלמו כל מדף בנפרד, את הדלת ואת המגירות. אפשר עד ${max} תמונות בסריקה אחת.`, 'subtle')
          : noAiHelp()}
        <button class="link demo-link" id="demo-scan">${icon('sparkle', 16)} לראות איך זה עובד עם מקרר לדוגמה</button>
      </section>`;
  }

  const full = shots.length >= max;
  return `${header}
    <section class="capture">
      <div class="shot-tray">
        ${shots.map((sh, i) => `
          <figure class="shot" style="--i:${i}">
            <img src="${sh.thumb}" alt="תמונה ${i + 1}" />
            <figcaption>${i + 1}</figcaption>
            <button class="icon-btn shot-x" data-shot="${i}" aria-label="הסרת תמונה ${i + 1}">${icon('x', 14)}</button>
          </figure>`).join('')}
        ${full ? '' : `<label class="shot add file" aria-label="צילום נוסף">${icon('plus', 26)}<span>מדף נוסף</span>${inputs.photo}</label>`}
      </div>
      <p class="muted small">${shots.length} מתוך ${max} תמונות. ${full ? 'הגעתם למקסימום לסריקה אחת.' : 'הוסיפו את הדלת, המגירות או מדף שלא נכנס לתמונה.'}</p>
      ${full ? '' : `<label class="btn file">${icon('image', 20)} עוד מהגלריה${inputs.gallery}</label>`}
      ${canScan() ? '' : noAiHelp()}
      <button class="btn primary xl" id="scan-go" ${canScan() ? '' : 'disabled'}>${icon('sparkle', 20)} סריקה עם Claude</button>
    </section>`;
}

function liveItem(it, i) {
  return `<li style="--i:${i}"><span class="ing-ic">${catIcon(it.cat, it.id)}</span><div class="d-text"><b>${esc(it.name)}</b>${it.qty ? `<small>${esc(it.qty)}</small>` : ''}</div></li>`;
}

function scan() {
  const s = scanSession;

  if (s?.status === 'scanning') {
    const found = s.detected.length;
    return `
      <section class="scan-stage">
        <div class="scan-preview">
          ${s.shots[0] ? `<img src="${s.shots[0].preview}" alt="" />` : `<div class="fridge-illu">${icon('other', 72)}</div>`}
          <div class="scan-line" aria-hidden="true"></div>
          <div class="scan-grid" aria-hidden="true"></div>
          ${s.shots.length > 1 ? `<span class="shot-count">${s.shots.length} תמונות</span>` : ''}
        </div>
        <h2 id="scan-title">${found ? `זוהו ${found} מצרכים עד עכשיו` : s.demo ? 'מקרר לדוגמה' : 'Claude סורק את המקרר'}</h2>
        <p class="muted" id="scan-sub">${s.demo ? 'זו הדגמה עם מקרר לדוגמה, לא המקרר שלכם.' : 'עובר מדף אחרי מדף וקורא תוויות. בדרך כלל פחות מדקה.'}</p>
        <ul class="detected live" id="live-list" aria-live="polite">${s.detected.map(liveItem).join('')}</ul>
        ${found ? '' : '<div class="skeleton-list" id="live-skel" aria-hidden="true"><i></i><i></i><i></i></div>'}
        ${s.demo ? '' : `<button class="btn ghost" id="scan-stop">${icon('x', 18)} עצירה</button>`}
      </section>`;
  }

  if (s?.status === 'error') {
    const [title, body] = errorCopy(s.error.code, s.error.detail);
    const partial = s.error.items?.length;
    return `
      <header class="topbar"><div><p class="eyebrow">סריקת מקרר</p><h1 class="title">הסריקה לא הושלמה</h1></div>${aiPill()}</header>
      <div class="empty-state error-state">
        ${icon('alert', 40)}
        <h2>${esc(title)}</h2>
        <p>${esc(body)}</p>
        <div class="error-actions">
          ${s.error.code === 'not_granted' ? `<button class="btn primary" id="err-perms">${icon('key', 18)} פתיחת ההרשאות</button>` : ''}
          ${s.error.code === 'quota_exceeded' ? `<button class="btn primary" id="err-upgrade">${icon('sparkle', 18)} שדרוג ל-Premium</button>` : ''}
          ${['upstream_error', 'upstream_busy', 'network', 'rate_limited', 'nothing_found', 'empty_completion', 'invalid_json', 'refused', 'not_granted'].includes(s.error.code) && s.shots.length
            ? `<button class="btn ${s.error.code === 'not_granted' ? '' : 'primary'}" id="err-retry">${icon('refresh', 18)} לנסות שוב</button>` : ''}
          ${partial ? `<button class="btn" id="err-partial">להמשיך עם ${partial} שזוהו</button>` : ''}
          <button class="btn ghost" id="err-back">${icon('camera', 18)} חזרה לצילום</button>
        </div>
      </div>`;
  }

  if (s?.status === 'review') {
    const items = s.detected;
    const replaceDefault = !state.pantry.length || !state.lastScanAt || Date.now() - state.lastScanAt > 3600000;
    return `
      <header class="topbar"><div><p class="eyebrow">שלב 2 מתוך 2</p><h1 class="title">זה מה שיש במקרר</h1></div></header>
      ${s.demo
        ? hostBubble(`<span class="pill soon">מקרר לדוגמה</span> זו הדגמה בלבד, לא המקרר שלכם. כדי לסרוק את המקרר שלכם, צלמו אותו.`)
        : hostBubble(`Claude זיהה <b>${items.length}</b> מצרכים ב-${s.shots.length === 1 ? 'תמונה אחת' : `${s.shots.length} תמונות`}${s.partial ? ' (הסריקה נעצרה באמצע)' : ''}. בדקו שהכל נכון: הסירו מה שלא שלכם והוסיפו מה שפוספס.`)}
      ${s.shots.length ? `<div class="thumbs">${s.shots.map((sh) => `<img src="${sh.thumb}" alt="" />`).join('')}</div>` : ''}
      <ul class="detected">
        ${items.map((it, i) => `
          <li class="${it.confidence != null && it.confidence < 0.6 ? 'unsure' : ''}" style="--i:${i}">
            <span class="ing-ic">${catIcon(it.cat, it.id)}</span>
            <div class="d-text"><b>${esc(it.name)}</b>${[it.qty, it.note || (it.confidence != null && it.confidence < 0.6 ? 'לא בטוח. לאשר?' : '')].filter(Boolean).length ? `<small>${esc([it.qty, it.note || (it.confidence < 0.6 ? 'לא בטוח. לאשר?' : '')].filter(Boolean).join(' · '))}</small>` : ''}</div>
            ${it.confidence != null ? `<span class="conf" title="רמת ביטחון">${Math.round(it.confidence * 100)}%</span>` : ''}
            <button class="icon-btn" data-remove="${i}" aria-label="הסרת ${esc(it.name)}">${icon('x', 16)}</button>
          </li>`).join('')}
      </ul>
      <form class="add-row" id="add-form">
        <label class="sr-only" for="add-input">הוספה ידנית</label>
        <input id="add-input" list="ing-list" placeholder="פוספס משהו? הוסיפו כאן" autocomplete="off" />
        <button class="btn" type="submit">${icon('plus', 18)} הוספה</button>
        <datalist id="ing-list">${INGREDIENTS.map((i) => `<option value="${esc(i.name)}"></option>`).join('')}</datalist>
      </form>
      <label class="switch-row" for="replace-pantry"><input type="checkbox" id="replace-pantry" ${replaceDefault ? 'checked' : ''} /> <span>זה כל מה שיש עכשיו: להחליף את רשימת המקרר (בטלו כדי להוסיף, למשל אחרי סריקת המזווה)</span></label>
      <div class="sticky-actions">
        <button class="btn ghost" id="rescan">${icon('camera', 18)} חזרה</button>
        <button class="btn primary" id="confirm" ${items.length ? '' : 'disabled'}>אישור והצגת מתכונים</button>
      </div>`;
  }

  return scanCapture();
}

/** מוסיף פריט שזוהה לרשימה (בלי כפילויות) ומעדכן את המסך בזמן אמת */
function addDetected(r) {
  const s = scanSession;
  if (!s) return;
  const item = { ...toPantryItem(r.name, { match: r.match, cat: r.category, note: r.note, qty: r.qty, confidence: r.confidence, shelfDays: r.shelf_days, keepName: true }), confidence: r.confidence ?? null };
  const dup = s.detected.findIndex((d) => d.key === item.key);
  if (dup >= 0) { if ((item.confidence ?? 0) > (s.detected[dup].confidence ?? 0)) s.detected[dup] = item; return; }
  s.detected.push(item);
  if (currentRoute() !== 'scan' || s.status !== 'scanning') return;
  const list = document.getElementById('live-list');
  if (!list) return;
  document.getElementById('live-skel')?.remove();
  list.insertAdjacentHTML('beforeend', liveItem(item, 0));
  const t = document.getElementById('scan-title');
  if (t) t.textContent = `זוהו ${s.detected.length} מצרכים עד עכשיו`;
}

async function runScan({ demo = false, fresh = false } = {}) {
  const s = scanSession;
  s.status = 'scanning';
  s.demo = demo;
  s.partial = false;
  s.detected = [];
  s.ctl = new AbortController();
  render({ enter: true });
  try {
    if (demo) await demoIngredients({ onItem: addDetected });
    else await detectIngredients({ deviceId: state.deviceId, shots: s.shots, onItem: addDetected, onPlan: setPlan, signal: s.ctl.signal, fresh });
    s.status = 'review';
  } catch (err) {
    if (scanSession !== s) return;
    if (err?.code === 'cancelled') {
      s.status = s.detected.length ? 'review' : 'capture';
      s.partial = s.detected.length > 0;
    } else {
      console.error(err);
      s.status = 'error';
      s.error = { code: err?.code || 'upstream_error', detail: err?.code === 'nothing_found' ? err.message : '', items: s.detected.slice() };
    }
  }
  if (scanSession !== s) return;
  if (currentRoute() === 'scan') render({ enter: true });
  else if (s.status === 'review') toast(`הסריקה הסתיימה: זוהו ${s.detected.length} מצרכים`);
}

async function addFiles(files, isVideo) {
  if (!files?.length) return;
  scanSession ||= { status: 'capture', shots: [], detected: [] };
  const s = scanSession;
  const max = ai.limit || 4;
  try {
    const shots = isVideo
      ? await videoFileToShots(files[0], Math.min(4, max))
      : await Promise.all([...files].slice(0, Math.max(0, max - s.shots.length)).map(imageFileToShot));
    s.shots = [...s.shots, ...shots].slice(0, max);
    s.status = 'capture';
    render();
  } catch {
    toast('לא הצלחתי לקרוא את הקובץ. נסו תמונה בפורמט JPG או PNG.');
  }
}

bind.scan = () => {
  ['#photo-input', '#gallery-input'].forEach((sel) => $view.querySelectorAll(sel).forEach((inp) => inp.addEventListener('change', (e) => addFiles(e.target.files, false))));
  $view.querySelector('#video-input')?.addEventListener('change', (e) => addFiles(e.target.files, true));
  $view.querySelectorAll('[data-shot]').forEach((b) => b.addEventListener('click', () => {
    scanSession.shots.splice(Number(b.dataset.shot), 1);
    if (!scanSession.shots.length) scanSession = null;
    render();
  }));
  $view.querySelector('#scan-go')?.addEventListener('click', () => (outOfScans() ? openUpgrade('quota') : runScan()));
  $view.querySelector('#err-upgrade')?.addEventListener('click', () => openUpgrade('quota'));
  $view.querySelector('#demo-scan')?.addEventListener('click', () => {
    scanSession = { status: 'capture', shots: [], detected: [] };
    runScan({ demo: true });
  });
  $view.querySelector('#scan-stop')?.addEventListener('click', () => scanSession?.ctl?.abort());

  // מסך שגיאה
  $view.querySelector('#err-retry')?.addEventListener('click', () => runScan({ fresh: true }));
  $view.querySelector('#err-back')?.addEventListener('click', () => { scanSession.status = 'capture'; render({ enter: true }); });
  $view.querySelector('#err-partial')?.addEventListener('click', () => {
    scanSession.detected = scanSession.error.items;
    scanSession.partial = true;
    scanSession.status = 'review';
    render({ enter: true });
  });
  $view.querySelector('#err-perms')?.addEventListener('click', async () => {
    try { await openPermissions(); } catch { toast('פתחו את תפריט ההרשאות של העמוד ואשרו את Claude.'); }
  });

  // מסך בדיקה
  $view.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
    const li = b.closest('li');
    const idx = Number(b.dataset.remove);
    const done = () => { scanSession.detected.splice(idx, 1); render(); };
    if (reduceMotion()) return done();
    li.classList.add('leaving');
    setTimeout(done, 160);
  }));
  $view.querySelector('#add-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $view.querySelector('#add-input').value.trim();
    if (!v) return;
    scanSession.detected.push({ ...toPantryItem(v), confidence: null });
    render();
  });
  $view.querySelector('#rescan')?.addEventListener('click', () => {
    if (scanSession.demo) scanSession = null; else scanSession.status = 'capture';
    render({ enter: true });
  });
  $view.querySelector('#confirm')?.addEventListener('click', () => {
    const replace = $view.querySelector('#replace-pantry').checked;
    const items = scanSession.detected.map(({ confidence, ...it }) => it);
    update({
      pantry: replace ? mergePantry([], items) : mergePantry(state.pantry, items),
      lastScanAt: Date.now(),
      lastAiRecipes: [],
    });
    scanSession = null;
    aiRecipesStatus = 'idle';
    autoAiRecipes = true;
    go('recipes');
  });
};

// ---------------- Pantry ----------------

function pantry() {
  const groups = {};
  for (const p of [...state.pantry].sort((a, b) => a.expiresAt - b.expiresAt)) (groups[p.cat] ||= []).push(p);
  let n = 0;
  return `
    <header class="topbar">
      <div><p class="muted">${state.pantry.length} מצרכים</p><h1 class="title">המקרר שלי</h1></div>
      <button class="btn small" data-go="scan">${icon('camera', 18)} סריקה</button>
    </header>
    <form class="add-row" id="pantry-add">
      <label class="sr-only" for="pantry-input">הוספת מצרך</label>
      <input id="pantry-input" list="ing-list2" placeholder="הוספת מצרך" autocomplete="off" />
      <button class="btn" type="submit">${icon('plus', 18)} הוספה</button>
      <datalist id="ing-list2">${INGREDIENTS.map((i) => `<option value="${esc(i.name)}"></option>`).join('')}</datalist>
    </form>
    ${state.pantry.length === 0
      ? `<div class="empty-state">${icon('other', 40)}<h2>המקרר ריק</h2><p>צלמו את המקרר ואמלא את הרשימה בשבילכם, או הוסיפו מצרך ידנית למעלה.</p><button class="btn primary" data-go="scan">${icon('camera', 18)} לסריקה</button></div>`
      : Object.entries(groups).map(([cat, items]) => `
        <section class="pantry-group">
          <h2>${CATEGORIES[cat]?.label ?? cat}<span>${items.length}</span></h2>
          <ul class="pantry-list">
            ${items.map((p) => {
              const f = freshness(p);
              return `<li style="--i:${n++}">
                <span class="ing-ic">${catIcon(p.cat, p.id)}</span>
                <div class="d-text"><b>${esc(p.name)}</b>${p.qty || p.note ? `<small>${esc([p.qty, p.note].filter(Boolean).join(' · '))}</small>` : ''}</div>
                <span class="pill ${f.level}">${f.label}</span>
                <button class="icon-btn" data-del="${esc(p.key)}" aria-label="הסרת ${esc(p.name)}">${icon('x', 16)}</button>
              </li>`;
            }).join('')}
          </ul>
        </section>`).join('')}
    ${state.pantry.length ? '<button class="btn ghost danger block" id="clear-pantry">ניקוי כל הרשימה</button>' : ''}`;
}

bind.pantry = () => {
  bindGo($view);
  $view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    const li = b.closest('li');
    const done = () => { update({ pantry: state.pantry.filter((p) => p.key !== b.dataset.del) }); render(); };
    if (reduceMotion()) return done();
    li.classList.add('leaving');
    setTimeout(done, 160);
  }));
  $view.querySelector('#pantry-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $view.querySelector('#pantry-input').value.trim();
    if (!v) return;
    update({ pantry: mergePantry(state.pantry, [toPantryItem(v)]) });
    render();
    toast(`${v} נוסף למקרר`);
  });
  $view.querySelector('#clear-pantry')?.addEventListener('click', (e) => {
    confirmTap(e.currentTarget, 'לחצו שוב לאישור הניקוי', () => { update({ pantry: [] }); render(); });
  });
};

// ---------------- Recipes ----------------

function recipes() {
  const { ready, almost } = suggest(state, { limit: 8 });
  const aiList = state.lastAiRecipes || [];
  return `
    <header class="topbar"><div><p class="muted">רק ממה שיש בבית</p><h1 class="title">מתכונים בשבילך</h1></div></header>
    <div id="rec-mode">${modeControls()}</div>

    ${state.pantry.length === 0 ? `<div class="empty-state">${icon('camera', 40)}<h2>קודם צריך לדעת מה יש במקרר</h2><p>סריקה אחת, ותקבלו מתכונים רק ממה שיש בבית.</p><button class="btn primary" data-go="scan">לסריקה</button></div>` : ''}

    ${['server', 'claude', 'text'].includes(ai.status) && state.pantry.length ? `
      <section class="section">
        <div class="section-head"><h2>${icon('sparkle', 18)} המלצות של Claude</h2>
          <button class="link" id="gen-ai" ${aiRecipesStatus === 'loading' ? 'disabled' : ''}>${aiList.length ? 'מתכונים אחרים' : 'יצירה'}</button>
        </div>
        ${aiRecipesStatus === 'loading'
          ? '<p class="muted small">Claude מרכיב מתכונים ממה שיש לכם. זה לוקח בערך חצי דקה.</p><div class="skeletons" aria-label="יוצר מתכונים"><div></div><div></div><div></div></div>'
          : aiList.length
            ? `<div class="recipe-list">${aiList.map((r, i) => recipeCard(r, i)).join('')}</div>`
            : hostBubble('Claude יכול להרכיב מתכונים חדשים בדיוק ממה שזוהה במקרר שלכם. לחצו "יצירה".')}
      </section>` : ''}

    ${ready.length ? `
      <section class="section">
        <div class="section-head"><h2>יש הכל בבית</h2><span class="muted small">${ready.length} מתכונים</span></div>
        <div class="recipe-list">${ready.map((x, i) => recipeCard(x, i)).join('')}</div>
      </section>` : state.pantry.length ? hostBubble('אין מתכון מדויק עם הסינון הנוכחי. נסו "15 דקות" או בטלו את סינון המטבח.') : ''}

    ${almost.length ? `
      <section class="section">
        <div class="section-head"><h2>כמעט: חסר דבר אחד</h2></div>
        <div class="recipe-list">${almost.map((x, i) => recipeCard(x, i, { compact: true })).join('')}</div>
      </section>` : ''}`;
}

bind.recipes = () => {
  bindGo($view);
  bindRecipeCards($view);
  bindModeControls($view.querySelector('#rec-mode'), () => { update({ lastAiRecipes: [] }); render(); });
  $view.querySelector('#gen-ai')?.addEventListener('click', () => loadAiRecipes({ fresh: state.lastAiRecipes.length > 0 }));
  // פעם אחת אחרי סריקה (המשתמש לחץ "אישור") – לא בכל כניסה למסך
  if (autoAiRecipes && state.aiRecipes && state.pantry.length && ['server', 'claude', 'text'].includes(ai.status)) {
    autoAiRecipes = false;
    loadAiRecipes();
  }
};

async function loadAiRecipes({ fresh = false } = {}) {
  if (aiRecipesStatus === 'loading') return;
  aiRecipesStatus = 'loading';
  render();
  try {
    const list = await generateRecipes({ state, deviceId: state.deviceId, onPlan: setPlan, fresh });
    update({ lastAiRecipes: list });
    aiRecipesStatus = 'done';
  } catch (err) {
    console.error(err);
    aiRecipesStatus = 'error';
    if (err?.code === 'quota_exceeded') openUpgrade('recipes');
    else if (err?.code !== 'cancelled') toast(`לא הצלחתי ליצור מתכונים: ${errorCopy(err?.code)[0]}`);
  }
  if (currentRoute() === 'recipes') render();
}

function findRecipe(id) {
  return [...(state.lastAiRecipes || []), ...ALL_RECIPES].find((r) => r.id === id);
}

// ---------------- Recipe sheet ----------------

let timer = null;

let lastFocus = null;

function openSheet(html) {
  if (!$sheetRoot.innerHTML) lastFocus = document.activeElement;
  $sheetRoot.innerHTML = html;
  document.body.classList.add('no-scroll');
  // פריים אחד במצב סגור ואז פתיחה – כך המעבר רץ
  requestAnimationFrame(() => requestAnimationFrame(() => $sheetRoot.classList.add('open')));
  $sheetRoot.querySelector('.sheet, .celebrate')?.focus({ preventScroll: true });
}

function openRecipe(id) {
  const r = findRecipe(id);
  if (!r) return;
  const ings = recipeIngredientState(r, state.pantry);
  const saving = estimateSaving(r, state.deliveryCost);
  const fav = state.favorites.includes(r.id);

  openSheet(`
    <div class="sheet-backdrop" data-close></div>
    <article class="sheet" role="dialog" aria-modal="true" aria-label="${esc(r.title)}" tabindex="-1">
      <div class="sheet-grab" data-grab><span></span></div>
      <header class="sheet-head">
        ${recipeArt(r, 'lg')}
        <div class="sheet-title">
          <p class="eyebrow">${CUISINES[r.cuisine] ?? ''}${r.ai ? ' · נוצר ע״י AI' : ''}</p>
          <h2>${esc(r.title)}</h2>
        </div>
        <div class="sheet-actions">
          <button class="icon-btn fav ${fav ? 'on' : ''}" id="fav" aria-pressed="${fav}" aria-label="מועדף">${icon('heart', 18)}</button>
          <button class="icon-btn" data-close aria-label="סגירה">${icon('x', 18)}</button>
        </div>
      </header>
      <div class="sheet-body">
        <dl class="facts">
          <div><dt>זמן</dt><dd>${r.time}<small> דק׳</small></dd></div>
          <div><dt>כלים</dt><dd>${r.pans}</dd></div>
          <div><dt>קלוריות</dt><dd>${r.calories}</dd></div>
          <div><dt>חלבון</dt><dd>${r.protein}<small> ג׳</small></dd></div>
        </dl>
        <div class="save-banner">
          <img src="${HOST.avatar}" alt="" />
          <p>במקום משלוח חוסכים כ-<b>${shekel(saving)}</b> על הארוחה הזו</p>
        </div>

        <h3>מצרכים</h3>
        <ul class="ing-list">
          ${ings.map((i) => `
            <li class="${i.ok ? 'ok' : i.optional ? 'opt' : 'miss'}">
              <span class="check">${icon(i.ok ? 'check' : i.optional ? 'plus' : 'alert', 14)}</span>
              <span>${esc(i.altName ? `${i.altName} (במקום ${i.name})` : i.name)}</span>
              <small>${esc(i.qty)}${i.optional && !i.ok ? ' · לא חובה' : ''}</small>
            </li>`).join('')}
          <li class="ok staples"><span class="check">${icon('check', 14)}</span><span>שמן, מלח, פלפל ותבלינים בסיסיים</span></li>
        </ul>

        <div class="timer">
          ${icon('timer', 22)}<b id="timer-val">${String(r.time).padStart(2, '0')}:00</b>
          <button class="btn small" id="timer-btn">הפעלת טיימר</button>
        </div>

        <h3>הכנה</h3>
        <ol class="steps">
          ${r.steps.map((s, i) => `<li><label><input type="checkbox" /><span class="n">${i + 1}</span><span class="step-text">${esc(s)}</span></label></li>`).join('')}
        </ol>

        <button class="btn primary xl block" id="cooked">${icon('check', 20)} בישלתי, חסכתי ${shekel(saving)}</button>
      </div>
    </article>`);

  const $sheet = $sheetRoot.querySelector('.sheet');
  $sheetRoot.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeSheet));
  bindSheetDrag($sheet);
  $sheetRoot.querySelector('#fav').addEventListener('click', (e) => {
    const on = !state.favorites.includes(r.id);
    update({ favorites: on ? [...state.favorites, r.id] : state.favorites.filter((f) => f !== r.id) });
    e.currentTarget.classList.toggle('on', on);
    e.currentTarget.setAttribute('aria-pressed', on);
  });
  $sheetRoot.querySelector('#timer-btn').addEventListener('click', (e) => toggleTimer(r.time, e.currentTarget));
  $sheetRoot.querySelector('#cooked').addEventListener('click', () => {
    const likes = { ...state.likes, [r.cuisine]: (state.likes[r.cuisine] || 0) + 1 };
    // מורידים מהמקרר מצרכים מתכלים שנוצלו
    const perishable = new Set(ings.filter((i) => i.ok && !i.optional).map((i) => (i.altName ? i.alt : i.id)).filter((x) => x && (ingredientById(x)?.shelf ?? 99) <= 7));
    update({
      likes,
      cooked: [...state.cooked, { recipeId: r.id, title: r.title, at: Date.now(), saved: saving }],
      pantry: state.pantry.filter((p) => !perishable.has(p.id)),
    });
    closeSheet(() => celebrate(saving));
  });
}

/** גרירה למטה לסגירה: מרחק או תנופה מהירה מספיקים */
function bindSheetDrag(sheet) {
  const grab = sheet.querySelector('[data-grab]');
  let startY = 0, startT = 0, dy = 0, dragging = false;
  const down = (e) => {
    if (dragging) return; // מתעלמים ממגע נוסף
    dragging = true; startY = e.clientY; startT = performance.now(); dy = 0;
    grab.setPointerCapture(e.pointerId);
    sheet.classList.add('dragging');
  };
  const move = (e) => {
    if (!dragging) return;
    const raw = e.clientY - startY;
    dy = raw < 0 ? raw / (1 + Math.abs(raw) / 40) : raw; // חיכוך כשמושכים למעלה
    sheet.style.transform = `translate(-50%, ${dy}px)`;
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    sheet.classList.remove('dragging');
    const velocity = Math.abs(dy) / (performance.now() - startT);
    sheet.style.transform = '';
    if (dy > 120 || (dy > 10 && velocity > 0.11)) closeSheet();
  };
  grab.addEventListener('pointerdown', down);
  grab.addEventListener('pointermove', move);
  grab.addEventListener('pointerup', up);
  grab.addEventListener('pointercancel', up);
}

function toggleTimer(minutes, btn) {
  const $val = document.getElementById('timer-val');
  if (timer) { clearInterval(timer.id); timer = null; btn.textContent = 'הפעלת טיימר'; return; }
  const end = Date.now() + minutes * 60000;
  btn.textContent = 'עצירה';
  timer = {
    id: setInterval(() => {
      const left = Math.max(0, end - Date.now());
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      if ($val) $val.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (left <= 0) { clearInterval(timer.id); timer = null; navigator.vibrate?.([200, 100, 200]); toast('הזמן עבר. בתיאבון!'); }
    }, 250),
  };
}

function closeSheet(after) {
  if (timer) { clearInterval(timer.id); timer = null; }
  $sheetRoot.classList.remove('open');
  document.body.classList.remove('no-scroll');
  setTimeout(() => {
    if (!$sheetRoot.classList.contains('open')) $sheetRoot.innerHTML = '';
    if (typeof after === 'function') after();
    else if (lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
  }, 220);
}

function celebrate(saving) {
  const s = stats();
  openSheet(`
    <div class="sheet-backdrop" data-close></div>
    <div class="celebrate" role="dialog" aria-modal="true" aria-label="כל הכבוד" tabindex="-1">
      <div class="confetti" aria-hidden="true">${Array.from({ length: 22 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
      <img class="cel-host" src="${HOST.photo}" alt="${HOST.title}" />
      <div class="cel-body">
        <h2>כל הכבוד</h2>
        <p>חסכת עכשיו <b>${shekel(saving)}</b>. סך הכל החודש: <b>${shekel(s.monthSaved)}</b>.</p>
        <button class="btn primary xl block" data-close>תודה</button>
      </div>
    </div>`);
  $sheetRoot.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => closeSheet(() => render())));
}

const CODE_ERRORS = {
  invalid_code: 'הקוד לא נמצא. בדקו שהוקלד נכון.',
  code_used: 'הקוד כבר הופעל על מספר המכשירים המרבי.',
  code_expired: 'תוקף הקוד הסתיים.',
  too_many_attempts: 'יותר מדי ניסיונות. נסו שוב מחר.',
  network: 'אין חיבור לאינטרנט. נסו שוב.',
};

/** מסך השדרוג: רכישה + הזנת קוד הפעלה */
function openUpgrade(reason = '') {
  const cfg = ai.cfg || {};
  const checkout = cfg.checkoutUrl ? cfg.checkoutUrl.replace('{device}', encodeURIComponent(state.deviceId)) : '';
  const title = { quota: 'נגמרו הסריקות החינמיות', recipes: 'נגמרו המתכונים החינמיים', code: 'הפעלת Premium' }[reason] || 'סורקים בלי לספור';
  openSheet(`
    <div class="sheet-backdrop" data-close></div>
    <article class="sheet upgrade" role="dialog" aria-modal="true" aria-label="SmartPantry Premium" tabindex="-1">
      <div class="sheet-grab" data-grab><span></span></div>
      <header class="upgrade-hero">
        <img src="${HOST.photo}" alt="${HOST.title}" />
        <div class="upgrade-title"><p class="eyebrow">SmartPantry Premium</p><h2>${title}</h2></div>
        <button class="icon-btn" data-close aria-label="סגירה">${icon('x', 18)}</button>
      </header>
      <div class="sheet-body">
        <ul class="perks">
          <li>${icon('camera', 18)}<span>סריקות בלי מגבלה חודשית</span></li>
          <li>${icon('sparkle', 18)}<span>מתכונים חדשים אחרי כל סריקה</span></li>
          <li>${icon('coin', 18)}<span>משלוח אחד שנחסך כבר מחזיר את המנוי</span></li>
        </ul>
        ${cfg.priceText ? `<p class="price">${esc(cfg.priceText)}</p>` : ''}
        ${checkout
          ? `<a class="btn primary xl block" href="${esc(checkout)}" target="_blank" rel="noopener">${icon('sparkle', 20)} לרכישת Premium</a>
             <p class="small muted center">אחרי התשלום תקבלו קוד הפעלה. הזינו אותו כאן למטה.</p>`
          : '<p class="small muted">קיבלתם קוד הפעלה? הזינו אותו כאן.</p>'}
        <form class="code-form" id="code-form" novalidate>
          <label for="code-input">קוד הפעלה</label>
          <div class="add-row">
            <input id="code-input" dir="ltr" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="SP-XXXX-XXXX-XXXX" />
            <button class="btn" type="submit">הפעלה</button>
          </div>
          <small id="code-msg" class="code-msg" role="status"></small>
        </form>
      </div>
    </article>`);
  const sheet = $sheetRoot.querySelector('.sheet');
  $sheetRoot.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeSheet));
  bindSheetDrag(sheet);
  const form = $sheetRoot.querySelector('#code-form');
  const input = form.querySelector('#code-input');
  const msg = form.querySelector('#code-msg');
  if (reason === 'code') setTimeout(() => input.focus(), 350);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = input.value.trim();
    if (!code) { msg.textContent = 'הזינו את הקוד שקיבלתם.'; return; }
    const btn = form.querySelector('button');
    btn.disabled = true;
    msg.textContent = 'בודק את הקוד';
    try {
      setPlan(await redeemCode(state.deviceId, code));
      closeSheet(() => { render(); toast(`Premium הופעל עד ${dateHe(ai.plan.premiumUntil)}`); });
    } catch (err) {
      msg.textContent = CODE_ERRORS[err?.code] || 'לא הצלחנו להפעיל את הקוד. נסו שוב.';
      btn.disabled = false;
    }
  });
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $sheetRoot.innerHTML) closeSheet(); });

/** סיכום התוכנית בפרופיל */
function planSummary() {
  if (ai.status === 'server' && ai.plan) {
    if (isPremium()) {
      return `<p><span class="pill ok">Premium</span> פעיל עד ${dateHe(ai.plan.premiumUntil)}</p>
        <button class="link" id="p-code">יש לכם קוד נוסף?</button>`;
    }
    return `<p>תוכנית חינמית: נשארו <b>${ai.plan.scansLeft}</b> מתוך ${ai.plan.scansLimit} סריקות החודש.</p>
      <div class="plan-actions">
        <button class="btn primary" id="p-upgrade">${icon('sparkle', 18)} שדרוג ל-Premium</button>
        <button class="link" id="p-code">יש לי קוד הפעלה</button>
      </div>`;
  }
  if (ai.status === 'claude') return '<p class="small muted">תצוגה מקדימה ב-claude.ai: הסריקה עובדת דרך חשבון Claude שלכם.</p>';
  if (ai.status === 'checking') return '<p class="small muted">בודק חיבור.</p>';
  return noAiHelp();
}

// ---------------- Profile ----------------

function profile() {
  const s = stats();
  const topCuisines = Object.entries(state.likes).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `
    <section class="profile-hero">
      <img src="${HOST.photo}" alt="${HOST.title}" />
      <div>
        <h1>${state.name ? esc(state.name) : 'הפרופיל שלי'}</h1>
        <p>${s.totalMeals} ארוחות בבית · ${shekel(s.totalSaved)} נחסכו</p>
      </div>
    </section>

    <dl class="stat-row">
      <div class="stat-main"><dt>חיסכון מצטבר</dt><dd>${shekel(s.totalSaved)}</dd></div>
      <div><dt>משלוחים שנחסכו</dt><dd>${s.totalMeals}</dd></div>
      <div><dt>מועדפים</dt><dd>${state.favorites.length}</dd></div>
    </dl>

    ${topCuisines.length ? `
      <section class="panel">
        <h2>מה למדתי עליך</h2>
        <div class="chips wrap">${topCuisines.map(([c, n]) => `<span class="pill ok">${CUISINES[c]} · ${n}</span>`).join('')}</div>
        <p class="small muted">מתכונים מהסגנונות האלה מקבלים עדיפות בהמלצות.</p>
      </section>` : ''}

    <section class="panel">
      <div class="field"><label for="p-name">שם</label><input class="input" id="p-name" value="${esc(state.name)}" placeholder="השם שלך" /></div>
      <h2>תזונה</h2>
      <div class="chips wrap">${DIETS.map((d) => chip({ label: d.label, active: state.diets.includes(d.id), attrs: `data-diet="${d.id}"` })).join('')}</div>
      <h2>רגישויות</h2>
      <div class="chips wrap">${ALLERGENS.map((a) => chip({ label: a.label, active: state.allergens.includes(a.id), attrs: `data-allergen="${a.id}"` })).join('')}</div>
      <div class="field"><label for="p-delivery">כמה עולה לכם משלוח ממוצע?</label>
        <div class="range-row"><input type="range" min="40" max="200" step="5" id="p-delivery" value="${state.deliveryCost}" /><b id="p-delivery-val">${shekel(state.deliveryCost)}</b></div>
      </div>
    </section>

    <section class="panel">
      <h2>${icon('sparkle', 18)} התוכנית שלי</h2>
      ${planSummary()}
      <label class="switch-row" for="p-ai-recipes"><input type="checkbox" id="p-ai-recipes" ${state.aiRecipes ? 'checked' : ''} /> <span>להרכיב גם מתכונים חדשים אחרי כל סריקה</span></label>
    </section>

    ${state.cooked.length ? `
      <section class="panel">
        <h2>היסטוריה</h2>
        <ul class="history">${state.cooked.slice(-8).reverse().map((c) => `<li><span>${esc(c.title)}</span><small>${timeAgo(c.at)}</small><b>+${shekel(c.saved)}</b></li>`).join('')}</ul>
      </section>` : ''}

    <button class="btn ghost danger block" id="p-reset">איפוס האפליקציה</button>
    <nav class="legal-links" aria-label="מידע משפטי">
      <a href="privacy.html">מדיניות פרטיות</a>
      <a href="terms.html">תנאי שימוש</a>
      ${ai.cfg?.supportEmail ? `<span dir="ltr">${esc(ai.cfg.supportEmail)}</span>` : ''}
    </nav>
    <p class="footer-note">SmartPantry · מה אוכלים בבית? · גרסה 1.2${ai.status === 'server' ? ` · מזהה לתמיכה ${esc(state.deviceId.slice(0, 8))}` : ''}</p>`;
}

bind.profile = () => {
  bindToggles($view);
  $view.querySelector('#p-name').addEventListener('change', (e) => update({ name: e.target.value.trim() }));
  $view.querySelector('#p-delivery').addEventListener('input', (e) => {
    state.deliveryCost = Number(e.target.value);
    $view.querySelector('#p-delivery-val').textContent = shekel(state.deliveryCost);
    save();
  });
  $view.querySelector('#p-upgrade')?.addEventListener('click', () => openUpgrade());
  $view.querySelector('#p-code')?.addEventListener('click', () => openUpgrade('code'));
  $view.querySelector('#p-ai-recipes').addEventListener('change', (e) => update({ aiRecipes: e.target.checked }));
  $view.querySelector('#p-reset').addEventListener('click', (e) => {
    confirmTap(e.currentTarget, 'לחצו שוב כדי למחוק הכל', () => { reset(); obStep = 0; go('home', { replace: true }); });
  });
};

// ---------------- הפעלה ----------------

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

if (!/^[a-f0-9]{32}$/.test(state.deviceId || '')) {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  update({ deviceId: [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('') });
}

render({ enter: true });
refreshAi();
