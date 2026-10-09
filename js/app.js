import { state, update, save, reset } from './store.js';
import { CATEGORIES, CUISINES, DIETS, ALLERGENS, INGREDIENTS, RECIPES as ALL_RECIPES } from './data.js';
import {
  suggest, toPantryItem, mergePantry, freshness, daysLeft, recipeIngredientState, estimateSaving, ingredientById,
} from './engine.js';
import { detectIngredients, generateRecipes, imageFileToDataUrl, videoFileToFrames } from './ai.js';

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

let scanSession = null; // { images: [], detected: [], status }
let aiRecipesStatus = 'idle';

// ---------------- ניווט ----------------

const routes = { onboarding, home, scan, pantry, recipes, profile };

// ניתוב בזיכרון (עובד גם בתוך iframe מוגבל); ה-hash רק לנוחות
let route = (location.hash.match(/^#\/?(\w+)$/) || [])[1] || 'home';

function go(next, { replace = false } = {}) {
  route = next;
  try {
    const hash = `#${next}`;
    if (replace) history.replaceState({ route: next }, '', hash); else history.pushState({ route: next }, '', hash);
  } catch { /* sandbox */ }
  render();
}

function currentRoute() {
  if (!state.onboarded) return 'onboarding';
  return routes[route] ? route : 'home';
}

function render() {
  const route = currentRoute();
  $tabbar.hidden = route === 'onboarding';
  $tabbar.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.route === route));
  $view.className = `view view-${route}`;
  $view.innerHTML = routes[route]();
  $view.scrollTop = 0;
  window.scrollTo(0, 0);
  bind[route]?.();
}

window.addEventListener('popstate', (e) => { if (e.state?.route) { route = e.state.route; render(); } });
$tabbar.addEventListener('click', (e) => {
  const t = e.target.closest('.tab');
  if (t) go(t.dataset.route);
});

function toast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  $toast.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { $toast.classList.remove('show'); setTimeout(() => ($toast.hidden = true), 250); }, 2400);
}

const bind = {};

/** אישור בלחיצה שנייה במקום confirm() */
function confirmTap(btn, label, action) {
  if (btn.dataset.armed) { action(); return; }
  btn.dataset.armed = '1';
  const prev = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = prev; } }, 3000);
}

// ---------------- רכיבים משותפים ----------------

function hostBubble(html, extra = '') {
  return `
    <div class="host-bubble ${extra}">
      <img class="avatar" src="${HOST.avatar}" alt="" width="44" height="44" />
      <div class="bubble">${html}</div>
    </div>`;
}

function chip({ label, active, attrs = '' }) {
  return `<button type="button" class="chip ${active ? 'active' : ''}" ${attrs}>${label}</button>`;
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

function recipeCard(item, { compact = false } = {}) {
  const r = item.recipe || item;
  const missing = item.missing || [];
  return `
    <button type="button" class="recipe-card ${compact ? 'compact' : ''}" data-recipe="${esc(r.id)}">
      <div class="rc-art cuisine-${esc(r.cuisine)}"><span>${esc(r.emoji)}</span>${r.ai ? '<i class="badge-ai">AI</i>' : ''}</div>
      <div class="rc-body">
        <h3>${esc(r.title)}</h3>
        <div class="rc-meta">
          <span>⏱ ${r.time} דק׳</span>
          <span>🧽 ${r.pans === 0 ? 'בלי כלים' : r.pans === 1 ? 'כלי אחד' : `${r.pans} כלים`}</span>
          <span>💪 ${r.protein} ג׳</span>
        </div>
        ${missing.length
          ? `<div class="rc-tag warn">חסר רק: ${esc(missing.join(', '))}</div>`
          : item.usesUrgent
            ? '<div class="rc-tag urgent">♻️ מציל מצרכים שעומדים להתקלקל</div>'
            : r.why ? `<div class="rc-tag">${esc(r.why)}</div>` : '<div class="rc-tag ok">✓ יש הכל בבית</div>'}
      </div>
    </button>`;
}

function modeControls() {
  const m = state.mode;
  const energy = [
    { id: 'full', label: '🔋 מלא אנרגיה' },
    { id: 'ok', label: '🙂 בסדר' },
    { id: 'dead', label: '🪫 גמור/ה' },
  ];
  return `
    <div class="mode">
      <div class="mode-row" role="group" aria-label="רמת אנרגיה">
        ${energy.map((e) => chip({ label: e.label, active: m.energy === e.id, attrs: `data-energy="${e.id}"` })).join('')}
      </div>
      <div class="mode-row scroll" role="group" aria-label="סינון">
        ${chip({ label: '⚡ 5 דקות', active: m.maxTime === 5, attrs: 'data-time="5"' })}
        ${chip({ label: '⏱ 15 דקות', active: m.maxTime === 15, attrs: 'data-time="15"' })}
        ${chip({ label: '🧽 בלי לשטוף מחבתות', active: m.noDishes, attrs: 'data-nodishes' })}
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

// ---------------- Onboarding ----------------

let obStep = 0;

function onboarding() {
  if (obStep === 0) {
    return `
      <section class="ob-hero">
        <img class="ob-photo" src="${HOST.photo}" alt="${HOST.title}" />
        <div class="ob-overlay">
          <div class="brand"><span class="logo">🥗</span> SmartPantry</div>
          <h1>מה אוכלים<br/>בבית?</h1>
          <p class="lead">צילום אחד של המקרר → 3 מתכונים של 15 דקות.<br/>בלי להקליד, בלי לקפוץ לסופר, בלי וולט ב-80 ש״ח.</p>
          <div class="ob-quote">
            <img src="${HOST.avatar}" alt="" />
            <p>״כל הזמנה שלא עשיתם היא כסף שנשאר אצלכם בכיס.״<small>${HOST.title}</small></p>
          </div>
          <button class="btn primary xl" id="ob-next">בואו נתחיל</button>
        </div>
      </section>`;
  }
  if (obStep === 1) {
    return `
      <section class="ob-steps">
        <div class="ob-progress"><i style="width:50%"></i></div>
        <h2>ככה זה עובד</h2>
        <ol class="how">
          <li><span>📸</span><div><b>סריקה בשנייה</b><p>פותחים את המקרר ומצלמים תמונה – או סרטון של 3 שניות על המדפים.</p></div></li>
          <li><span>🧠</span><div><b>ה-AI מזהה הכל</b><p>גם קופסאות פתוחות, ירקות עייפים ושאריות – ובונה תמונת מצב.</p></div></li>
          <li><span>🍳</span><div><b>מתכוני 15 דקות</b><p>3-4 מתכונים רק ממה שיש עכשיו בבית. אפס קניות.</p></div></li>
          <li><span>🪫</span><div><b>מצב ״אפס מאמץ״</b><p>״יש לי 5 דקות״, ״בא לי איטלקי״, ״אין לי כוח לשטוף מחבתות״.</p></div></li>
        </ol>
        ${hostBubble('בממוצע זורקים בבית כ-<b>30%</b> מהאוכל. בואו נשנה את זה ביחד 💪')}
        <button class="btn primary xl" id="ob-next">ממשיכים</button>
      </section>`;
  }
  return `
    <section class="ob-steps">
      <div class="ob-progress"><i style="width:100%"></i></div>
      <h2>רגע של התאמה אישית</h2>
      <label class="field"><span>איך לקרוא לך?</span><input id="ob-name" type="text" placeholder="השם שלך" value="${esc(state.name)}" autocomplete="given-name" /></label>
      <h3 class="sub">תזונה</h3>
      <div class="chips wrap">${DIETS.map((d) => chip({ label: `${d.emoji} ${d.label}`, active: state.diets.includes(d.id), attrs: `data-diet="${d.id}"` })).join('')}</div>
      <h3 class="sub">רגישויות / אלרגיות</h3>
      <div class="chips wrap">${ALLERGENS.map((a) => chip({ label: a.label, active: state.allergens.includes(a.id), attrs: `data-allergen="${a.id}"` })).join('')}</div>
      <p class="muted small">אפשר לשנות בכל רגע בפרופיל. האפליקציה גם לומדת לבד מה את/ה אוהב/ת.</p>
      <button class="btn primary xl" id="ob-done">יאללה, לסרוק את המקרר 📸</button>
    </section>`;
}

bind.onboarding = () => {
  $view.querySelector('#ob-next')?.addEventListener('click', () => { obStep++; render(); });
  bindToggles($view);
  $view.querySelector('#ob-done')?.addEventListener('click', () => {
    update({ onboarded: true, name: $view.querySelector('#ob-name').value.trim() });
    go('scan', { replace: true });
  });
};

function bindToggles(root) {
  root.querySelectorAll('[data-diet]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.diet;
    state.diets = state.diets.includes(id) ? state.diets.filter((d) => d !== id) : [...state.diets, id];
    save(); b.classList.toggle('active');
  }));
  root.querySelectorAll('[data-allergen]').forEach((b) => b.addEventListener('click', () => {
    const id = b.dataset.allergen;
    state.allergens = state.allergens.includes(id) ? state.allergens.filter((d) => d !== id) : [...state.allergens, id];
    save(); b.classList.toggle('active');
  }));
}

// ---------------- Home ----------------

function greeting() {
  const h = new Date().getHours();
  const part = h < 11 ? 'בוקר טוב' : h < 16 ? 'צהריים טובים' : h < 21 ? 'ערב טוב' : 'לילה טוב';
  return state.name ? `${part}, ${esc(state.name)}` : part;
}

function home() {
  const s = stats();
  const urgent = state.pantry.filter((p) => daysLeft(p) <= 2);
  const { ready, almost } = suggest(state);
  const empty = state.pantry.length === 0;

  return `
    <header class="topbar">
      <div>
        <p class="muted">${greeting()} 👋</p>
        <h1 class="title">מה אוכלים היום?</h1>
      </div>
      <button class="avatar-btn" data-go="profile" aria-label="פרופיל"><img src="${HOST.avatar}" alt="" /></button>
    </header>

    <section class="savings-card">
      <div class="sc-text">
        <p class="sc-label">חסכת החודש</p>
        <p class="sc-amount">${shekel(s.monthSaved)}</p>
        <p class="sc-sub">${s.monthMeals ? `${s.monthMeals} ארוחות בבית במקום משלוח` : 'כל ארוחה בבית = בערך ₪60 שנשארים בכיס'}</p>
        <div class="sc-bar"><i style="width:${Math.min(100, (s.monthSaved / 1000) * 100)}%"></i></div>
        <p class="sc-goal">יעד חודשי: ₪1,000</p>
      </div>
      <img class="sc-host" src="${HOST.photo}" alt="${HOST.title}" />
    </section>

    <button class="scan-cta" data-go="scan">
      <span class="pulse">📸</span>
      <span><b>${empty ? 'סרקו את המקרר' : 'סריקה חדשה'}</b><small>${state.lastScanAt ? `סריקה אחרונה: ${timeAgo(state.lastScanAt)}` : 'לוקח 2 שניות'}</small></span>
      <svg viewBox="0 0 24 24" class="chev"><path d="M15 6l-6 6 6 6"/></svg>
    </button>

    ${urgent.length ? `
      <section class="card alert">
        <h2>⏰ להשתמש בהקדם</h2>
        <div class="chips wrap">${urgent.map((p) => `<span class="pill urgent">${p.emoji} ${esc(p.name)}</span>`).join('')}</div>
      </section>` : ''}

    <section class="section">
      <div class="section-head"><h2>איך האנרגיה?</h2></div>
      <div id="home-mode">${modeControls()}</div>
    </section>

    <section class="section">
      <div class="section-head">
        <h2>מתכונים עכשיו</h2>
        ${ready.length ? '<button class="link" data-go="recipes">הכל ←</button>' : ''}
      </div>
      ${empty
        ? hostBubble('המקרר שלך עוד ריק אצלי. צלמו אותו ואני אמצא לכם ארוחה תוך שניות 😉')
        : ready.length
          ? `<div class="recipe-list">${ready.slice(0, 3).map((x) => recipeCard(x)).join('')}</div>`
          : hostBubble(`לא מצאתי מתכון מדויק עם הסינון הזה${almost.length ? ' – אבל יש כמה שחסר בהם רק דבר אחד ↓' : '. נסו להוריד סינון.'}`)}
      ${!empty && !ready.length && almost.length ? `<div class="recipe-list">${almost.map((x) => recipeCard(x)).join('')}</div>` : ''}
    </section>

    <section class="section">
      ${hostBubble(tipOfDay())}
    </section>`;
}

function tipOfDay() {
  const tips = [
    '<b>טיפ:</b> אורז מאתמול הוא הבסיס הכי טוב לאורז מוקפץ – הוא יבש יותר ולא נדבק.',
    '<b>טיפ:</b> עגבניות עייפות? הן מושלמות לשקשוקה או לרוטב – דווקא שם הן הכי טעימות.',
    '<b>טיפ:</b> ביצים הן החבר הכי טוב של ארוחה ב-5 דקות. תמיד שיהיו בבית.',
    '<b>טיפ:</b> שמרו עשבי תיבול בכוס מים במקרר – הם יחזיקו פי 3 יותר.',
    '<b>טיפ:</b> משלוח אחד פחות בשבוע = יותר מ-₪3,000 בשנה.',
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

bind.home = () => {
  bindGo($view);
  bindRecipeCards($view);
  bindModeControls($view.querySelector('#home-mode'), render);
};

function bindGo(root) {
  root.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => go(b.dataset.go)));
}

// ---------------- Scan ----------------

function scan() {
  const s = scanSession;
  if (s?.status === 'scanning') {
    return `
      <section class="scan-stage">
        <div class="scan-preview">
          ${s.images.slice(0, 1).map((src) => `<img src="${src}" alt="" />`).join('') || '<div class="fridge-illu">🧊</div>'}
          <div class="scan-line"></div>
          <div class="scan-grid"></div>
        </div>
        <h2>מזהה מצרכים…</h2>
        <p class="muted">${state.apiKey ? 'ה-AI עובר על המדפים' : 'מצב הדגמה – מדמה סריקה של מקרר'}</p>
        <div class="dots"><i></i><i></i><i></i></div>
      </section>`;
  }

  if (s?.status === 'review') {
    const items = s.detected;
    return `
      <header class="topbar"><div><p class="muted">שלב 2 מתוך 2</p><h1 class="title">זה מה שמצאתי</h1></div></header>
      ${hostBubble(`זיהיתי <b>${items.length}</b> מצרכים${s.demo ? ' <span class="pill">מצב הדגמה</span>' : ''}. הסירו מה שלא נכון או הוסיפו מה שפספסתי.`)}
      ${s.images.length ? `<div class="thumbs">${s.images.map((src) => `<img src="${src}" alt="" />`).join('')}</div>` : ''}
      <ul class="detected">
        ${items.map((it, i) => `
          <li class="${it.confidence < 0.75 ? 'unsure' : ''}">
            <span class="emoji">${it.emoji}</span>
            <div class="d-text"><b>${esc(it.name)}</b>${it.note ? `<small>${esc(it.note)}</small>` : it.confidence < 0.75 ? '<small>לא בטוח – תאשרו?</small>' : ''}</div>
            <span class="conf" title="רמת ביטחון">${Math.round(it.confidence * 100)}%</span>
            <button class="icon-btn" data-remove="${i}" aria-label="הסר">✕</button>
          </li>`).join('')}
      </ul>
      <form class="add-row" id="add-form">
        <input id="add-input" list="ing-list" placeholder="+ הוספה ידנית (למשל: חומוס)" autocomplete="off" />
        <button class="btn" type="submit">הוסף</button>
        <datalist id="ing-list">${INGREDIENTS.map((i) => `<option value="${esc(i.name)}"></option>`).join('')}</datalist>
      </form>
      <label class="switch-row"><input type="checkbox" id="replace-pantry" ${state.pantry.length ? '' : 'checked'} /> <span>להחליף את רשימת המקרר הקיימת (במקום להוסיף)</span></label>
      <div class="sticky-actions">
        <button class="btn ghost" id="rescan">סריקה מחדש</button>
        <button class="btn primary" id="confirm">אישור והצגת מתכונים 🍳</button>
      </div>`;
  }

  return `
    <header class="topbar"><div><p class="muted">שלב 1 מתוך 2</p><h1 class="title">סריקת מקרר</h1></div></header>
    <section class="capture">
      <div class="viewfinder">
        <div class="corner tl"></div><div class="corner tr"></div><div class="corner bl"></div><div class="corner br"></div>
        <div class="vf-illu">
          <div class="shelf"><span>🥚</span><span>🧀</span><span>🍅</span></div>
          <div class="shelf"><span>🥒</span><span>🫙</span><span>🍋</span></div>
          <div class="shelf"><span>🥛</span><span>🥬</span><span>🍚</span></div>
        </div>
        <p>פתחו את המקרר ומלאו את המסגרת</p>
      </div>
      <div class="capture-actions">
        <label class="btn primary xl file">
          📸 צילום תמונה
          <input type="file" accept="image/*" capture="environment" id="photo-input" hidden />
        </label>
        <div class="row-2">
          <label class="btn file">🎥 וידאו 3 שניות<input type="file" accept="video/*" capture="environment" id="video-input" hidden /></label>
          <label class="btn file">🖼 מהגלריה<input type="file" accept="image/*" multiple id="gallery-input" hidden /></label>
        </div>
        <button class="btn ghost" id="demo-scan">✨ נסו עם מקרר לדוגמה</button>
      </div>
      ${state.apiKey ? '' : hostBubble('כרגע האפליקציה במצב הדגמה. כדי שה-AI יזהה את המקרר <b>האמיתי</b> שלכם, הוסיפו מפתח Claude API בפרופיל.', 'subtle')}
    </section>`;
}

async function runScan(images) {
  scanSession = { images, status: 'scanning', detected: [] };
  render();
  try {
    const raw = await detectIngredients({ apiKey: state.apiKey, images });
    scanSession.demo = raw.some((r) => r.demo);
    scanSession.detected = raw.map((r) => {
      const item = toPantryItem(r.name, { cat: r.category, note: r.note, confidence: r.confidence, shelfDays: r.shelf_days });
      return { ...item, confidence: r.confidence ?? 0.9 };
    });
    scanSession.status = 'review';
  } catch (err) {
    console.error(err);
    scanSession = null;
    toast(`הסריקה נכשלה: ${err.message || err}`);
  }
  render();
}

bind.scan = () => {
  const handleFiles = async (files, isVideo) => {
    if (!files?.length) return;
    try {
      const images = isVideo
        ? await videoFileToFrames(files[0])
        : await Promise.all([...files].slice(0, 4).map(imageFileToDataUrl));
      runScan(images);
    } catch {
      toast('לא הצלחתי לקרוא את הקובץ');
    }
  };
  $view.querySelector('#photo-input')?.addEventListener('change', (e) => handleFiles(e.target.files, false));
  $view.querySelector('#gallery-input')?.addEventListener('change', (e) => handleFiles(e.target.files, false));
  $view.querySelector('#video-input')?.addEventListener('change', (e) => handleFiles(e.target.files, true));
  $view.querySelector('#demo-scan')?.addEventListener('click', () => {
    const apiKey = state.apiKey;
    state.apiKey = ''; // תמיד הדגמה בכפתור הזה
    runScan([]).finally(() => { state.apiKey = apiKey; });
  });

  $view.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
    scanSession.detected.splice(Number(b.dataset.remove), 1); render();
  }));
  $view.querySelector('#add-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $view.querySelector('#add-input');
    const v = input.value.trim();
    if (!v) return;
    scanSession.detected.push({ ...toPantryItem(v), confidence: 1 });
    render();
  });
  $view.querySelector('#rescan')?.addEventListener('click', () => { scanSession = null; render(); });
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
    go('recipes');
  });
};

// ---------------- Pantry ----------------

function pantry() {
  const groups = {};
  for (const p of [...state.pantry].sort((a, b) => a.expiresAt - b.expiresAt)) (groups[p.cat] ||= []).push(p);
  return `
    <header class="topbar">
      <div><p class="muted">${state.pantry.length} מצרכים</p><h1 class="title">המקרר שלי</h1></div>
      <button class="btn small" data-go="scan">📸 סריקה</button>
    </header>
    <form class="add-row" id="pantry-add">
      <input id="pantry-input" list="ing-list2" placeholder="+ הוספת מצרך" autocomplete="off" />
      <button class="btn" type="submit">הוסף</button>
      <datalist id="ing-list2">${INGREDIENTS.map((i) => `<option value="${esc(i.name)}"></option>`).join('')}</datalist>
    </form>
    ${state.pantry.length === 0
      ? hostBubble('עדיין אין כאן כלום. צלמו את המקרר ואני אמלא את הרשימה בשבילכם.')
      : Object.entries(groups).map(([cat, items]) => `
        <section class="pantry-group">
          <h2>${CATEGORIES[cat]?.emoji ?? ''} ${CATEGORIES[cat]?.label ?? cat}</h2>
          <ul class="pantry-list">
            ${items.map((p) => {
              const f = freshness(p);
              return `<li>
                <span class="emoji">${p.emoji}</span>
                <div class="d-text"><b>${esc(p.name)}</b>${p.note ? `<small>${esc(p.note)}</small>` : ''}</div>
                <span class="pill ${f.level}">${f.label}</span>
                <button class="icon-btn" data-del="${esc(p.key)}" aria-label="סיימתי / הסר">✕</button>
              </li>`;
            }).join('')}
          </ul>
        </section>`).join('')}
    ${state.pantry.length ? '<button class="btn ghost danger block" id="clear-pantry">ניקוי כל הרשימה</button>' : ''}`;
}

bind.pantry = () => {
  bindGo($view);
  $view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
    update({ pantry: state.pantry.filter((p) => p.key !== b.dataset.del) }); render();
  }));
  $view.querySelector('#pantry-add').addEventListener('submit', (e) => {
    e.preventDefault();
    const v = $view.querySelector('#pantry-input').value.trim();
    if (!v) return;
    update({ pantry: mergePantry(state.pantry, [toPantryItem(v)]) });
    render();
    toast('נוסף למקרר ✓');
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

    ${state.pantry.length === 0 ? hostBubble('קודם צריך לדעת מה יש במקרר 🙂 <button class="link" data-go="scan">לסריקה ←</button>') : ''}

    ${state.apiKey && state.pantry.length ? `
      <section class="section">
        <div class="section-head"><h2>✨ נוצר במיוחד בשבילך</h2>
          <button class="link" id="gen-ai" ${aiRecipesStatus === 'loading' ? 'disabled' : ''}>${aiList.length ? 'רענון' : 'צור'}</button>
        </div>
        ${aiRecipesStatus === 'loading'
          ? '<div class="skeletons"><div></div><div></div><div></div></div>'
          : aiList.length
            ? `<div class="recipe-list">${aiList.map((r) => recipeCard(r)).join('')}</div>`
            : hostBubble('אני יכול להמציא לכם מתכונים חדשים בדיוק לפי מה שיש במקרר. לחצו "צור".')}
      </section>` : ''}

    ${ready.length ? `
      <section class="section">
        <div class="section-head"><h2>✓ יש הכל בבית</h2><span class="muted small">${ready.length} מתכונים</span></div>
        <div class="recipe-list">${ready.map((x) => recipeCard(x)).join('')}</div>
      </section>` : state.pantry.length ? hostBubble('אין מתכון מדויק עם הסינון הנוכחי. נסו "15 דקות" או בטלו סינון מטבח.') : ''}

    ${almost.length ? `
      <section class="section">
        <div class="section-head"><h2>כמעט – חסר דבר אחד</h2></div>
        <div class="recipe-list">${almost.map((x) => recipeCard(x, { compact: true })).join('')}</div>
      </section>` : ''}`;
}

bind.recipes = () => {
  bindGo($view);
  bindRecipeCards($view);
  bindModeControls($view.querySelector('#rec-mode'), () => { update({ lastAiRecipes: [] }); render(); });
  $view.querySelector('#gen-ai')?.addEventListener('click', loadAiRecipes);
  if (state.apiKey && state.aiRecipes && state.pantry.length && !state.lastAiRecipes.length && aiRecipesStatus === 'idle') loadAiRecipes();
};

async function loadAiRecipes() {
  aiRecipesStatus = 'loading';
  render();
  try {
    const list = await generateRecipes({ apiKey: state.apiKey, state });
    update({ lastAiRecipes: list });
    aiRecipesStatus = 'done';
  } catch (err) {
    console.error(err);
    aiRecipesStatus = 'error';
    toast(`לא הצלחתי ליצור מתכונים: ${err.message || err}`);
  }
  if (currentRoute() === 'recipes') render();
}

function findRecipe(id) {
  return suggestAll().find((r) => r.id === id);
}

function suggestAll() {
  return [...(state.lastAiRecipes || []), ...ALL_RECIPES];
}


// ---------------- Recipe sheet ----------------

let timer = null;

function openRecipe(id) {
  const r = findRecipe(id);
  if (!r) return;
  const ings = recipeIngredientState(r, state.pantry);
  const saving = estimateSaving(r, state.deliveryCost);
  const fav = state.favorites.includes(r.id);

  $sheetRoot.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <article class="sheet" role="dialog" aria-modal="true" aria-label="${esc(r.title)}">
      <div class="sheet-handle" data-close></div>
      <div class="sheet-hero cuisine-${esc(r.cuisine)}">
        <span class="big-emoji">${esc(r.emoji)}</span>
        <button class="icon-btn fav ${fav ? 'on' : ''}" id="fav" aria-label="מועדף">${fav ? '♥' : '♡'}</button>
        <button class="icon-btn close" data-close aria-label="סגור">✕</button>
      </div>
      <div class="sheet-body">
        <p class="eyebrow">${CUISINES[r.cuisine] ?? ''}${r.ai ? ' · נוצר ע״י AI' : ''}</p>
        <h2>${esc(r.title)}</h2>
        <div class="facts">
          <div><b>${r.time}</b><span>דקות</span></div>
          <div><b>${r.pans}</b><span>כלים</span></div>
          <div><b>${r.calories}</b><span>קלוריות</span></div>
          <div><b>${r.protein}ג׳</b><span>חלבון</span></div>
        </div>
        <div class="save-banner">
          <img src="${HOST.avatar}" alt="" />
          <p>במקום משלוח, חוסכים כ-<b>${shekel(saving)}</b> על הארוחה הזו</p>
        </div>

        <h3>מצרכים</h3>
        <ul class="ing-list">
          ${ings.map((i) => `
            <li class="${i.ok ? 'ok' : i.optional ? 'opt' : 'miss'}">
              <span class="check">${i.ok ? '✓' : i.optional ? '○' : '!'}</span>
              <span>${i.emoji} ${esc(i.altName ? `${i.altName} (במקום ${i.name})` : i.name)}</span>
              <small>${esc(i.qty)}${i.optional && !i.ok ? ' · לא חובה' : ''}</small>
            </li>`).join('')}
          <li class="ok staples"><span class="check">✓</span><span>🧂 שמן, מלח, פלפל ותבלינים בסיסיים</span></li>
        </ul>

        <div class="timer" id="timer">
          <span>⏱</span><b id="timer-val">${String(r.time).padStart(2, '0')}:00</b>
          <button class="btn small" id="timer-btn">הפעל טיימר</button>
        </div>

        <h3>הכנה</h3>
        <ol class="steps">
          ${r.steps.map((s, i) => `<li><label><input type="checkbox" /><span class="n">${i + 1}</span><span>${esc(s)}</span></label></li>`).join('')}
        </ol>

        <button class="btn primary xl block" id="cooked">בישלתי! 🎉 (חסכתי ${shekel(saving)})</button>
      </div>
    </article>`;
  document.body.classList.add('no-scroll');
  requestAnimationFrame(() => $sheetRoot.classList.add('open'));

  $sheetRoot.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', closeSheet));
  $sheetRoot.querySelector('#fav').addEventListener('click', (e) => {
    const on = !state.favorites.includes(r.id);
    update({ favorites: on ? [...state.favorites, r.id] : state.favorites.filter((f) => f !== r.id) });
    e.currentTarget.classList.toggle('on', on);
    e.currentTarget.textContent = on ? '♥' : '♡';
  });
  $sheetRoot.querySelector('#timer-btn').addEventListener('click', (e) => toggleTimer(r.time, e.currentTarget));
  $sheetRoot.querySelector('#cooked').addEventListener('click', () => {
    const likes = { ...state.likes, [r.cuisine]: (state.likes[r.cuisine] || 0) + 1 };
    // מורידים מהמקרר מצרכים מתכלים שנוצלו
    const perishable = new Set(ings.filter((i) => i.ok && !i.optional).map((i) => (i.altName ? i.alt : i.id)).filter((id) => (ingredientById(id)?.shelf ?? 99) <= 7));
    update({
      likes,
      cooked: [...state.cooked, { recipeId: r.id, title: r.title, at: Date.now(), saved: saving }],
      pantry: state.pantry.filter((p) => !perishable.has(p.id)),
    });
    closeSheet();
    celebrate(saving);
  });
}

function toggleTimer(minutes, btn) {
  const $val = document.getElementById('timer-val');
  if (timer) { clearInterval(timer.id); timer = null; btn.textContent = 'הפעל טיימר'; return; }
  const end = Date.now() + minutes * 60000;
  btn.textContent = 'עצור';
  timer = {
    id: setInterval(() => {
      const left = Math.max(0, end - Date.now());
      const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      if ($val) $val.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
      if (left <= 0) { clearInterval(timer.id); timer = null; navigator.vibrate?.([200, 100, 200]); toast('⏰ הזמן עבר – בתיאבון!'); }
    }, 250),
  };
}

function closeSheet() {
  if (timer) { clearInterval(timer.id); timer = null; }
  $sheetRoot.classList.remove('open');
  document.body.classList.remove('no-scroll');
  setTimeout(() => { if (!$sheetRoot.classList.contains('open')) $sheetRoot.innerHTML = ''; }, 300);
}

function celebrate(saving) {
  const s = stats();
  $sheetRoot.innerHTML = `
    <div class="sheet-backdrop" data-close></div>
    <div class="celebrate" role="dialog" aria-modal="true">
      <div class="confetti">${Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
      <img class="cel-host" src="${HOST.photo}" alt="${HOST.title}" />
      <h2>כל הכבוד! 👏</h2>
      <p>חסכת עכשיו <b>${shekel(saving)}</b>.<br/>סה״כ החודש: <b>${shekel(s.monthSaved)}</b></p>
      <button class="btn primary xl block" data-close>תודה!</button>
    </div>`;
  requestAnimationFrame(() => $sheetRoot.classList.add('open'));
  $sheetRoot.querySelectorAll('[data-close]').forEach((el) => el.addEventListener('click', () => { closeSheet(); render(); }));
}

document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $sheetRoot.innerHTML) closeSheet(); });

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

    <div class="stat-grid">
      <div class="stat"><b>${shekel(s.totalSaved)}</b><span>חיסכון מצטבר</span></div>
      <div class="stat"><b>${s.totalMeals}</b><span>משלוחים שנחסכו</span></div>
      <div class="stat"><b>${state.favorites.length}</b><span>מועדפים</span></div>
    </div>

    ${topCuisines.length ? `
      <section class="card">
        <h2>🧠 מה למדתי עליך</h2>
        <p class="muted">${topCuisines.map(([c, n]) => `${CUISINES[c]} (${n})`).join(' · ')}</p>
        <p class="small muted">אני מקדם מתכונים מהסגנונות האלה בהמלצות.</p>
      </section>` : ''}

    <section class="card">
      <h2>שם</h2>
      <input class="input" id="p-name" value="${esc(state.name)}" placeholder="השם שלך" />
      <h2>תזונה</h2>
      <div class="chips wrap">${DIETS.map((d) => chip({ label: `${d.emoji} ${d.label}`, active: state.diets.includes(d.id), attrs: `data-diet="${d.id}"` })).join('')}</div>
      <h2>רגישויות</h2>
      <div class="chips wrap">${ALLERGENS.map((a) => chip({ label: a.label, active: state.allergens.includes(a.id), attrs: `data-allergen="${a.id}"` })).join('')}</div>
      <h2>כמה עולה לך משלוח ממוצע?</h2>
      <div class="range-row"><input type="range" min="40" max="200" step="5" id="p-delivery" value="${state.deliveryCost}" /><b id="p-delivery-val">${shekel(state.deliveryCost)}</b></div>
    </section>

    <section class="card">
      <h2>🤖 זיהוי AI אמיתי</h2>
      <p class="small muted">כדי לזהות את המקרר שלכם בפועל, הדביקו מפתח Claude API. המפתח נשמר <b>רק במכשיר הזה</b> ונשלח ישירות ל-Anthropic.</p>
      <input class="input" id="p-key" type="password" placeholder="sk-ant-..." value="${esc(state.apiKey)}" autocomplete="off" />
      <label class="switch-row"><input type="checkbox" id="p-ai-recipes" ${state.aiRecipes ? 'checked' : ''} /> <span>ליצור גם מתכונים חדשים עם AI</span></label>
      <p class="small">${state.apiKey ? '<span class="pill ok">מחובר</span>' : '<span class="pill">מצב הדגמה</span>'}</p>
      <p class="small muted">בתצוגה המקדימה ב-claude.ai החיבור ל-AI חסום מטעמי אבטחה. הוא עובד כשהאפליקציה מועלית לאתר שלכם (למשל GitHub Pages).</p>
    </section>

    ${state.cooked.length ? `
      <section class="card">
        <h2>היסטוריה</h2>
        <ul class="history">${state.cooked.slice(-8).reverse().map((c) => `<li><span>${esc(c.title)}</span><small>${timeAgo(c.at)}</small><b>+${shekel(c.saved)}</b></li>`).join('')}</ul>
      </section>` : ''}

    <button class="btn ghost danger block" id="p-reset">איפוס האפליקציה</button>
    <p class="footer-note">SmartPantry · מה אוכלים בבית? · v1.0</p>`;
}

bind.profile = () => {
  bindToggles($view);
  $view.querySelector('#p-name').addEventListener('change', (e) => update({ name: e.target.value.trim() }));
  $view.querySelector('#p-delivery').addEventListener('input', (e) => {
    state.deliveryCost = Number(e.target.value);
    $view.querySelector('#p-delivery-val').textContent = shekel(state.deliveryCost);
    save();
  });
  $view.querySelector('#p-key').addEventListener('change', (e) => {
    update({ apiKey: e.target.value.trim(), lastAiRecipes: [] });
    aiRecipesStatus = 'idle';
    render();
    toast(state.apiKey ? 'זיהוי AI הופעל ✓' : 'חזרה למצב הדגמה');
  });
  $view.querySelector('#p-ai-recipes').addEventListener('change', (e) => update({ aiRecipes: e.target.checked }));
  $view.querySelector('#p-reset').addEventListener('click', (e) => {
    confirmTap(e.currentTarget, 'לחצו שוב כדי למחוק הכל', () => { reset(); obStep = 0; go('home', { replace: true }); });
  });
};

// ---------------- הפעלה ----------------

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
