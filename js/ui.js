/* Katzir FC — screens, navigation and HUD wiring. */
window.KFC = window.KFC || {};

KFC.UI = (function () {
  'use strict';
  const D = KFC.DATA, ST = KFC.Store, AU = KFC.Audio, C = KFC.Cards;
  const asset = KFC.asset;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const ACTION = { liam: 1, ido: 1, erez: 1, sipko: 1 };
  const ICON = {
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
    mute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  let current = 'title';
  let match = null;
  let matchCtx = null; // { mode: 'quick'|'cup', opp }
  let quickOpp = 'barkei';

  // ---------------------------------------------------------------- helpers
  function show(id) {
    $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
    current = id;
    const menu = id !== 'match' && id !== 'title';
    $('#backdrop').style.display = id === 'match' ? 'none' : '';
    if (menu) { AU.stopLoop('crowd_loop', 0.8); AU.loop('chant_loop', 0.32, 1.2); }
    if (id === 'match') AU.stopLoop('chant_loop', 0.6);
    const fns = { home: renderHome, prep: renderPrep, squad: renderSquad, store: renderStore, cup: renderCup };
    if (fns[id]) fns[id]();
  }

  let toastT = 0;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function tap() { AU.play('tap', { vol: 0.5 }); }

  function crestSVG(team, cls) {
    if (!team || team.id === 'katzir') return '<img class="' + (cls || '') + '" src="' + asset('assets/brand/crest.png') + '" alt="קציר FC">';
    const P = team.primary, S2 = team.secondary;
    const icons = {
      bolt: '<path d="M35 13L21 37h10l-4 17 17-26H33z" fill="' + S2 + '"/>',
      fin: '<path d="M16 46c11-3 18-15 19-31 7 11 11 22 15 31z" fill="' + S2 + '"/>',
      crown: '<path d="M17 42l3-19 8 8 4-12 4 12 8-8 3 19z" fill="' + S2 + '"/><rect x="17" y="43" width="30" height="4" rx="1" fill="' + S2 + '"/>',
      wing: '<path d="M12 36c13-4 19-13 20-23 1 10 7 19 20 23-11 2-16 8-20 17-4-9-9-15-20-17z" fill="' + S2 + '"/>',
      storm: '<path d="M19 30a9 9 0 0 1 17-5 7 7 0 0 1 9 7 6 6 0 0 1-6 6H21a6 6 0 0 1-2-8z" fill="' + S2 + '"/><path d="M31 39l-5 9h5l-3 7 9-11h-5l3-5z" fill="#ffe27a"/>',
      star: '<path d="M32 13l5.3 11.4 12.4 1.4-9.3 8.4 2.7 12.3L32 40.2l-11.1 6.3 2.7-12.3-9.3-8.4 12.4-1.4z" fill="' + S2 + '"/>'
    };
    return '<svg class="' + (cls || '') + '" viewBox="0 0 64 64" aria-label="' + esc(team.he) + '">' +
      '<path d="M32 3l25 8v18c0 17-11 28-25 32C18 57 7 46 7 29V11z" fill="' + P + '" stroke="' + S2 + '" stroke-width="2.6"/>' +
      '<path d="M32 8l20 6.5V29c0 14-9 23.5-20 27z" fill="rgba(0,0,0,0.12)"/>' +
      (icons[team.icon] || icons.star) + '</svg>';
  }

  function trophySVG() {
    return '<svg viewBox="0 0 120 140"><defs><linearGradient id="tg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4c2"/><stop offset=".45" stop-color="#e8c26a"/><stop offset="1" stop-color="#8f6421"/></linearGradient></defs>' +
      '<path d="M30 10h60v24c0 22-12 38-30 42C42 72 30 56 30 34z" fill="url(#tg)"/>' +
      '<path d="M30 18H14c0 18 8 28 20 30M90 18h16c0 18-8 28-20 30" fill="none" stroke="url(#tg)" stroke-width="6"/>' +
      '<rect x="52" y="76" width="16" height="22" fill="url(#tg)"/><path d="M34 98h52l6 18H28z" fill="url(#tg)"/><rect x="24" y="116" width="72" height="14" rx="3" fill="#5a3d0e"/>' +
      '<path d="M60 22l4.5 9.6 10.5 1.2-7.8 7.1 2.2 10.4L60 45l-9.4 5.3 2.2-10.4L45 32.8l10.5-1.2z" fill="#fff6d6" opacity=".9"/></svg>';
  }

  function teamName(t) { return t.id === 'katzir' ? 'קציר FC' : t.he; }
  const KATZIR = { id: 'katzir', he: 'קציר FC', en: 'KATZIR FC', code: 'KAT' };

  function lineupCards() { return ST.get().lineup.map(id => ST.cardFor(id)); }
  function teamOvr() {
    const cs = lineupCards();
    return Math.round(cs.reduce((s, c) => s + c.ovr, 0) / cs.length);
  }

  function topbar(opts) {
    const p = ST.get();
    return '<div class="topbar">' +
      (opts.back ? '<button class="back-btn" data-back="' + opts.back + '">' + ICON.back + '<span>חזרה</span></button>' : '') +
      (opts.brand ? '<div class="brand"><img src="' + asset('assets/brand/crest-sm.png') + '" alt=""><div class="wordmark">KATZIR FC<small>קציר אף סי</small></div></div>' : '') +
      (opts.title ? '<div class="screen-title">' + opts.title + '</div>' : '') +
      '<div class="spacer"></div>' +
      '<div class="coins" title="מטבעות"><i></i><span class="coin-n num">' + fmt(p.coins) + '</span></div>' +
      '<button class="icon-btn sound-btn" aria-label="צליל">' + (p.sound ? ICON.sound : ICON.mute) + '</button>' +
      '</div>';
  }

  function bindTopbar(root) {
    $$('[data-back]', root).forEach(b => b.addEventListener('click', () => { tap(); show(b.dataset.back); }));
    $$('.sound-btn', root).forEach(b => b.addEventListener('click', () => {
      const p = ST.get(); p.sound = !p.sound; ST.save(); AU.setEnabled(p.sound);
      b.innerHTML = p.sound ? ICON.sound : ICON.mute;
      if (p.sound) tap();
    }));
  }

  ST.onChange(p => { $$('.coin-n').forEach(n => { n.textContent = fmt(p.coins); }); });

  // ---------------------------------------------------------------- title
  function renderTitle(progress) {
    const s = $('#screen-title');
    if (!s.dataset.ready) {
      s.dataset.ready = '1';
      s.innerHTML = '<div class="content">' +
        '<img class="title-crest" src="' + asset('assets/brand/crest.png') + '" alt="סמל קציר FC">' +
        '<div class="title-word">KATZIR FC</div>' +
        '<div class="title-sub">שבע אגדות. גואט אחד.</div>' +
        '<div class="loadbar"><i></i></div>' +
        '<div class="title-tap">טוען את האצטדיון…</div></div>';
    }
    $('.loadbar i', s).style.width = Math.round(progress * 100) + '%';
    if (progress >= 1) $('.title-tap', s).textContent = 'לחצו כדי להיכנס לאצטדיון';
  }

  // ---------------------------------------------------------------- home
  function renderHome() {
    const s = $('#screen-home');
    const p = ST.get();
    const goat = ST.owns('liam_goat') ? ST.specialCard('liam_goat') : ST.baseCard('liam');
    const rec = p.record;
    const top = Object.keys(p.scorers).sort((a, b) => p.scorers[b] - p.scorers[a])[0];
    const cupBadge = p.cup && p.cup.status === 'active' ? 'שלב ' + (p.cup.round + 1) + '/3' : (p.cups ? p.cups + ' גביעים' : 'חדש');
    s.innerHTML = '<div class="content">' + topbar({ brand: true }) +
      '<div class="home-grid">' +
        '<div class="hero">' +
          '<div class="hero-photo" style="background-image:url(' + asset('assets/action/liam.jpg') + ')"></div>' +
          '<div class="hero-card">' + C.html(goat) + '</div>' +
          '<div class="hero-text">' +
            '<span class="eyebrow">THE GOAT · 99 · VAMOS</span>' +
            '<h2>ליאם שבת. <em>הגואט.</em></h2>' +
            '<p>הטוב בכל הזמנים. 99 בכל תכונה, והקלף היחיד במשחק עם דירוג 100.</p>' +
            '<button class="btn" data-go="prep">שחקו עכשיו</button>' +
          '</div>' +
        '</div>' +
        '<div class="tiles">' +
          tile('prep', 'משחק מהיר', 'קציר נגד יריבה לבחירתכם', asset('assets/action/ido.jpg'), '8 נגד 8') +
          tile('cup', 'גביע קציר', 'שלושה משחקים עד הגביע', asset('assets/action/erez.jpg'), cupBadge) +
          tile('store', 'חבילות', 'קלפי אגדה וקלף הגואט', null, fmt(p.coins), '<div class="tile-packs">' + PACKS.map(packHTML).join('') + '</div>') +
          tile('squad', 'הסגל', '16 שחקנים, 8 בהרכב', asset('assets/action/sipko.jpg'), 'דירוג ' + teamOvr()) +
          '<button class="tile wide" data-go="pens"><div class="tile-art" style="background-image:url(' + asset('assets/action/liam.jpg') + ');background-position:center 30%"></div><span class="tile-badge">5 בעיטות</span><h3>דו-קרב פנדלים</h3><p>בוחרים פינה, השוער מנחש</p></button>' +
        '</div>' +
      '</div>' +
      '<div class="home-foot"><div class="record"><span>ניצחונות <b>' + rec.w + '</b></span><span>תיקו <b>' + rec.d + '</b></span><span>הפסדים <b>' + rec.l + '</b></span><span>שערים <b>' + rec.gf + '</b></span></div>' +
      '<div>' + (top ? 'מלך השערים: <b>' + esc(D.byId[top].he.replace(/"[^"]*"\s*/, '')) + '</b> (' + p.scorers[top] + ')' : 'עוד לא נכבשו שערים. זה הזמן.') + '</div></div>' +
      '</div>';
    bindTopbar(s);
    $$('[data-go]', s).forEach(b => b.addEventListener('click', () => {
      tap();
      const go = b.dataset.go;
      if (go === 'prep') { matchCtx = { mode: 'quick' }; show('prep'); }
      else if (go === 'pens') startPens({ mode: 'free', opp: quickOpp });
      else show(go);
    }));
    const hc = $('.hero-card .card', s);
    if (hc) { C.tilt(hc); hc.addEventListener('click', () => openPlayer('liam')); hc.style.cursor = 'pointer'; }
  }

  function tile(go, title, sub, art, badge, extra) {
    const artHtml = art ? '<div class="tile-art" style="background-image:url(' + art + ')"></div>'
      : '<div class="tile-art" style="opacity:.9;background:radial-gradient(60% 80% at 75% 40%,rgba(232,41,63,.45),transparent 70%),radial-gradient(60% 80% at 25% 40%,rgba(70,217,255,.35),transparent 70%)"></div>';
    return '<button class="tile" data-go="' + go + '">' + artHtml + (extra || '') + (badge ? '<span class="tile-badge num">' + esc(badge) + '</span>' : '') +
      '<h3>' + title + '</h3><p>' + sub + '</p></button>';
  }

  // ---------------------------------------------------------------- prep
  function renderPrep() {
    const s = $('#screen-prep');
    const p = ST.get();
    const cup = matchCtx && matchCtx.mode === 'cup';
    const oppId = cup ? matchCtx.opp : quickOpp;
    const opp = D.teamById[oppId];
    const roundNames = ['רבע גמר', 'חצי גמר', 'גמר'];
    const title = cup ? 'גביע קציר · ' + roundNames[p.cup.round] : 'משחק מהיר';
    const unlockedAll = p.cups > 0;
    s.innerHTML = '<div class="content">' + topbar({ back: cup ? 'cup' : 'home', title }) +
      '<div class="prep scroll"><div class="prep-top">' +
        '<div class="panel">' +
          '<h4>המשחק</h4>' +
          '<div class="vs">' +
            '<div class="team">' + crestSVG(KATZIR, 'crest-badge') + '<b>קציר FC</b><span>OVR ' + teamOvr() + '</span></div>' +
            '<div class="x">VS</div>' +
            '<div class="team">' + crestSVG(opp, 'crest-badge') + '<b>' + esc(opp.he) + '</b><span>OVR ' + opp.ovr + '</span></div>' +
          '</div>' +
          (cup ? '<p class="hint" style="margin-top:14px">בגביע אין תיקו: אם המשחק נגמר בשוויון, הולכים לפנדלים.</p>' :
          '<div class="rivals">' + D.TEAMS.map(t => {
            const locked = t.id === 'allstars' && !unlockedAll;
            return '<button class="rival' + (t.id === oppId ? ' on' : '') + (locked ? ' locked' : '') + '" data-opp="' + t.id + '">' + crestSVG(t) +
              '<b>' + esc(t.he) + '</b><small>' + (locked ? 'נפתח אחרי גביע' : 'OVR ' + t.ovr) + '</small></button>';
          }).join('') + '</div>') +
        '</div>' +
        '<div class="panel opts">' +
          '<h4>הגדרות</h4>' +
          '<div class="opt"><label>רמת קושי</label><div class="seg" data-opt="difficulty">' +
            Object.keys(D.DIFFICULTY).map(k => '<button data-v="' + k + '" class="' + (p.difficulty === k ? 'on' : '') + '">' + D.DIFFICULTY[k].he + '</button>').join('') + '</div></div>' +
          '<div class="opt"><label>אורך מחצית</label><div class="seg" data-opt="minutes">' +
            [2, 3, 5].map(m => '<button data-v="' + m + '" class="' + (p.minutes === m ? 'on' : '') + '">' + m + ' דק׳</button>').join('') + '</div></div>' +
          '<div class="opt"><label>תלבושת</label><div class="seg" data-opt="kit">' +
            [['auto', 'אוטומטי'], ['home', 'בית'], ['away', 'חוץ'], ['vamos', 'וואמוס']].map(k => '<button data-v="' + k[0] + '" class="' + (p.kit === k[0] ? 'on' : '') + '">' + k[1] + '</button>').join('') + '</div></div>' +
          '<p class="hint" style="margin:0">' + (document.body.classList.contains('touch') ? 'שליטה: ג׳ויסטיק משמאל, מסירה, בעיטה וספרינט מימין. החזיקו בעיטה לעוצמה ומסירה ללוב.' : 'שליטה: WASD או חיצים לתנועה, J מסירה, K או רווח לבעיטה (החזיקו לעוצמה), Shift ספרינט, Q החלפת שחקן.') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="panel"><div class="section-h" style="margin-bottom:10px"><h4 style="margin:0">ההרכב · 2-3-2</h4><button class="hint" data-edit style="text-decoration:underline">ערכו הרכב</button></div>' +
        '<div class="lineup-strip">' + lineupCards().map(c => C.html(c)).join('') + '</div></div>' +
      '</div>' +
      '<div class="prep-cta"><button class="btn" data-kick>שריקת פתיחה</button></div>' +
      '</div>';
    bindTopbar(s);
    $$('[data-opp]', s).forEach(b => b.addEventListener('click', () => { tap(); quickOpp = b.dataset.opp; renderPrep(); }));
    $$('.seg[data-opt]', s).forEach(seg => seg.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      tap();
      const key = seg.dataset.opt; let v = b.dataset.v;
      if (key === 'minutes') v = +v;
      ST.get()[key] = v; ST.save();
      $$('button', seg).forEach(x => x.classList.toggle('on', x === b));
    }));
    $('[data-edit]', s).addEventListener('click', () => { tap(); show('squad'); });
    $('[data-kick]', s).addEventListener('click', () => { tap(); startMatch(oppId); });
  }

  // ---------------------------------------------------------------- squad
  let pick = null; // { where: 'slot'|'bench', id, idx }
  function renderSquad() {
    const s = $('#screen-squad');
    const p = ST.get();
    const form = D.FORMATIONS.katzir;
    const bench = D.PLAYERS.filter(pl => p.lineup.indexOf(pl.id) < 0);
    s.innerHTML = '<div class="content">' + topbar({ back: 'home', title: 'הסגל' }) +
      '<div class="squad">' +
        '<div class="pitch-board">' + form.map((f, i) => {
          const id = p.lineup[i];
          const top = (1 - f.x) * 86 + 6, left = (1 - f.y) * 84 + 8;
          return '<div class="slot' + (pick && pick.where === 'slot' && pick.idx === i ? ' pick' : '') + '" data-slot="' + i + '" style="top:' + top + '%;left:' + left + '%">' +
            C.html(ST.cardFor(id)) + '<span class="slot-pos">' + f.slot + '</span></div>';
        }).join('') + '</div>' +
        '<div class="bench">' +
          '<div class="section-h"><h3>ספסל</h3><span class="hint">דירוג קבוצה <b class="num" style="color:var(--gold-hi);font-size:18px">' + teamOvr() + '</b></span></div>' +
          '<p class="hint" style="margin:0">לחצו על שחקן ואז על שחקן אחר כדי להחליף ביניהם. לחיצה שנייה על אותו שחקן פותחת את הכרטיס שלו.</p>' +
          '<div class="bench-grid scroll">' + bench.map(pl => {
            const on = pick && pick.where === 'bench' && pick.id === pl.id;
            return '<div data-bench="' + pl.id + '">' + C.html(ST.cardFor(pl.id), { cls: on ? 'pick' : '' }) + '</div>';
          }).join('') + '</div>' +
        '</div>' +
      '</div></div>';
    bindTopbar(s);
    $$('[data-slot]', s).forEach(el => el.addEventListener('click', () => onPick({ where: 'slot', idx: +el.dataset.slot, id: p.lineup[+el.dataset.slot] })));
    $$('[data-bench]', s).forEach(el => el.addEventListener('click', () => onPick({ where: 'bench', id: el.dataset.bench })));
  }

  function onPick(sel) {
    tap();
    const p = ST.get();
    if (!pick) { pick = sel; renderSquad(); return; }
    if (pick.id === sel.id) { pick = null; renderSquad(); openPlayer(sel.id); return; }
    const a = pick, b = sel;
    pick = null;
    const isGK = id => !!D.byId[id].gk;
    if (a.where === 'bench' && b.where === 'bench') { pick = b; renderSquad(); return; }
    const slotSel = a.where === 'slot' ? a : b, other = a.where === 'slot' ? b : a;
    if (other.where === 'bench') {
      const slotGK = D.FORMATIONS.katzir[slotSel.idx].role === 'GK';
      if (slotGK !== isGK(other.id)) { toast(slotGK ? 'בשער יכול לעמוד רק שוער' : 'שוער לא יכול לשחק בתפקיד שחקן שדה'); renderSquad(); return; }
      p.lineup[slotSel.idx] = other.id;
    } else {
      const ga = D.FORMATIONS.katzir[a.idx].role === 'GK', gb = D.FORMATIONS.katzir[b.idx].role === 'GK';
      if (ga !== gb) { toast('אי אפשר להזיז שוער לתפקיד שחקן שדה'); renderSquad(); return; }
      const t = p.lineup[a.idx]; p.lineup[a.idx] = p.lineup[b.idx]; p.lineup[b.idx] = t;
    }
    ST.save();
    renderSquad();
  }

  // ---------------------------------------------------------------- player modal
  function openPlayer(id) {
    const pl = D.byId[id];
    const p = ST.get();
    const card = ST.cardFor(id);
    const keys = pl.gk ? D.GK_KEYS : D.OUTFIELD;
    const versions = [ST.baseCard(id)].concat(D.SPECIALS.filter(sp => sp.player === id && ST.owns(sp.id)).map(sp => ST.specialCard(sp.id)));
    const m = $('#modal');
    m.innerHTML = '<div class="modal-box" role="dialog" aria-label="' + esc(pl.he) + '">' +
      '<button class="icon-btn modal-close" aria-label="סגירה">' + ICON.close + '</button>' +
      '<div class="pd-card">' + C.html(card) +
        (versions.length > 1 ? '<div class="seg" style="margin-top:12px;flex-wrap:wrap">' + versions.map(v => '<button data-ver="' + v.cardId + '" class="' + (v.cardId === card.cardId ? 'on' : '') + '">' + D.EDITIONS[v.edition].he + ' ' + v.ovr + '</button>').join('') + '</div>' : '') +
      '</div>' +
      '<div class="pd">' +
        '<span class="eyebrow">' + pl.pos + ' · #' + pl.num + (pl.real ? ' · קציר המקורית' : ' · סגל קציר') + '</span>' +
        '<h2>' + esc(pl.he) + '</h2><div class="en">' + esc(pl.en) + (pl.nick ? ' · ' + esc(pl.nick) : '') + '</div>' +
        '<p class="bio">' + esc(pl.bio) + '</p>' +
        '<div class="tags">' + (pl.tags || []).map(t => '<span>' + esc(t) + '</span>').join('') + '</div>' +
        '<div class="bars">' + keys.map(k => '<div class="bar"><span>' + D.STAT_HE[k] + '</span><i><b style="width:' + Math.min(100, card.stats[k]) + '%"></b></i><span class="num">' + card.stats[k] + '</span></div>').join('') + '</div>' +
        (ACTION[id] ? '<div class="pd-photo" style="background-image:url(' + asset('assets/action/' + id + '.jpg') + ')"></div>' : '') +
        '<div class="pd-goals">שערים בקריירה במשחק: <b class="num">' + (p.scorers[id] || 0) + '</b></div>' +
      '</div></div>';
    m.classList.add('show');
    const cardEl = $('.pd-card .card', m); if (cardEl) C.tilt(cardEl);
    $('.modal-close', m).addEventListener('click', closeModal);
    m.onclick = e => { if (e.target === m) closeModal(); };
    $$('[data-ver]', m).forEach(b => b.addEventListener('click', () => {
      tap();
      const v = b.dataset.ver;
      if (v.endsWith('_base')) delete p.use[id]; else p.use[id] = v;
      ST.save(); openPlayer(id);
      if (current === 'squad') renderSquad();
    }));
  }
  function closeModal() { $('#modal').classList.remove('show'); }

  // ---------------------------------------------------------------- store & packs
  const PACKS = [
    { id: 'gold', he: 'חבילת זהב', en: 'GOLD', cls: 'pk-gold', price: 1500, n: 3, guaranteed: 0, chance: 0.14, desc: '3 קלפים, סיכוי לקלף אגדה.' },
    { id: 'star', he: 'חבילת כוכבים', en: 'STARS', cls: 'pk-star', price: 4000, n: 3, guaranteed: 1, chance: 0.22, desc: '3 קלפים, קלף אגדה אחד מובטח.' },
    { id: 'vamos', he: 'חבילת וואמוס', en: 'VAMOS', cls: 'pk-vamos', price: 9000, n: 5, guaranteed: 2, chance: 0.3, goat: 0.12, desc: '5 קלפים, 2 אגדות מובטחות וסיכוי לגואט.' }
  ];

  function packHTML(pk) {
    return '<div class="pack ' + pk.cls + '"><small>KATZIR FC</small><img src="' + asset('assets/brand/crest.png') + '" alt=""><b>' + pk.en + '</b><small>PACK</small></div>';
  }

  function renderStore() {
    const s = $('#screen-store');
    const p = ST.get();
    const owned = D.SPECIALS.filter(sp => ST.owns(sp.id)).length;
    s.innerHTML = '<div class="content">' + topbar({ back: 'home', title: 'חבילות' }) +
      '<div class="store scroll">' +
        '<div class="packs">' + PACKS.map(pk => '<div class="pack-tile">' + packHTML(pk) +
          '<div><h3>' + pk.he + '</h3><p>' + pk.desc + '</p></div>' +
          '<button class="btn small" data-buy="' + pk.id + '"' + (p.coins < pk.price ? ' disabled' : '') + '><span class="num">' + fmt(pk.price) + '</span> מטבעות</button></div>').join('') + '</div>' +
        '<div class="section-h"><h3>האוסף</h3><span class="hint">קלפים מיוחדים <b class="num" style="color:var(--gold-hi)">' + owned + '/' + D.SPECIALS.length + '</b> · כפולים נמכרים אוטומטית ב-1,000</span></div>' +
        '<div class="collection">' + D.SPECIALS.map(sp => {
          const c = ST.specialCard(sp.id);
          return '<div data-coll="' + sp.player + '">' + C.html(c, { cls: ST.owns(sp.id) ? '' : 'locked' }) + '</div>';
        }).join('') + '</div>' +
        '<p class="hint">איך מרוויחים מטבעות: ניצחון 600, תיקו 300, הפסד 150, ועוד 100 על כל שער. ברמת אגדה הכל כפול 1.6. זכייה בגביע שווה 5,000.</p>' +
      '</div></div>';
    bindTopbar(s);
    $$('[data-buy]', s).forEach(b => b.addEventListener('click', () => {
      const pk = PACKS.find(x => x.id === b.dataset.buy);
      if (!ST.spend(pk.price)) { toast('אין מספיק מטבעות. שחקו עוד משחק!'); return; }
      tap();
      openPack(pk, rollPack(pk), () => renderStore());
    }));
    $$('[data-coll]', s).forEach(el => el.addEventListener('click', () => { tap(); openPlayer(el.dataset.coll); }));
  }

  function rollPack(pk) {
    const cards = [];
    const legends = D.SPECIALS.filter(s => s.edition === 'legend');
    const pickLegend = () => {
      // real Katzir players a little more likely
      const pool = legends.flatMap(l => D.byId[l.player].real ? [l, l] : [l]);
      return pool[Math.floor(Math.random() * pool.length)];
    };
    const pickBase = () => D.PLAYERS[Math.floor(Math.random() * D.PLAYERS.length)];
    for (let i = 0; i < pk.n; i++) {
      if (pk.goat && i === 0 && !ST.owns('liam_goat') && Math.random() < pk.goat) { cards.push({ special: D.specialById.liam_goat }); continue; }
      if (i < pk.guaranteed || Math.random() < pk.chance) cards.push({ special: pickLegend() });
      else cards.push({ base: pickBase() });
    }
    return cards;
  }

  function welcomePack() {
    const legends = D.SPECIALS.filter(s => s.edition === 'legend' && D.byId[s.player].real);
    return [
      { special: D.specialById.liam_goat },
      { special: legends[Math.floor(Math.random() * legends.length)] },
      { base: D.PLAYERS[1 + Math.floor(Math.random() * 6)] }
    ];
  }

  function openPack(pk, contents, done) {
    const ov = $('#pack-overlay');
    ov.innerHTML = '<div class="eyebrow">' + esc(pk.he) + '</div><div class="opening-pack">' + packHTML(pk) + '</div><div class="title-tap" style="animation:none;opacity:.8">לחצו על החבילה כדי לפתוח</div>';
    ov.classList.add('show');
    const packEl = $('.opening-pack', ov);
    let opened = false;
    packEl.addEventListener('click', () => {
      if (opened) return; opened = true;
      AU.play('pack', { vol: 0.9 });
      packEl.classList.add('shake');
      setTimeout(() => {
        const burst = $('#burst');
        const best = bestOf(contents);
        burst.style.setProperty('--burst', best && best.special ? (best.special.edition === 'goat' ? '#ffd27a' : '#dfe9ff') : '#f6dc96');
        burst.classList.remove('go'); void burst.offsetWidth; burst.classList.add('go');
        // resolve ownership now (duplicates become coins)
        const results = contents.map(c => {
          if (c.special) { const dup = ST.own(c.special.id); if (dup) ST.addCoins(1000); return { card: ST.specialCard(c.special.id), dup, special: true }; }
          ST.addCoins(150);
          return { card: ST.baseCard(c.base.id), dup: true, special: false };
        });
        const top = results.slice().sort((a, b) => (b.card.ovr + (b.special ? 50 : 0)) - (a.card.ovr + (a.special ? 50 : 0)))[0];
        const after = () => revealRow(results, top, done);
        if (top && top.special) walkout(top.card, after); else after();
      }, 900);
    });
  }

  function bestOf(contents) {
    let best = null, bs = -1;
    contents.forEach(c => { const v = c.special ? 100 + c.special.ovr : c.base.ovr; if (v > bs) { bs = v; best = c; } });
    return best;
  }

  function revealRow(results, top, done) {
    const ov = $('#pack-overlay');
    ov.innerHTML = '<div class="eyebrow">הקלפים שלכם</div><div class="reveal-row"></div><div class="btns" style="display:flex;gap:12px"><button class="btn" data-done>המשך</button></div>';
    const row = $('.reveal-row', ov);
    results.forEach((r, i) => {
      const wrap = document.createElement('div');
      wrap.style.display = 'flex'; wrap.style.flexDirection = 'column'; wrap.style.alignItems = 'center';
      const el = C.el(r.card, { cls: 'flip-in' + (r === top ? ' big' : '') });
      el.style.animationDelay = (i * 0.18) + 's';
      wrap.appendChild(el);
      const note = document.createElement('div');
      note.className = 'dup';
      note.textContent = r.special ? (r.dup ? 'כפול · +1,000' : 'חדש באוסף!') : 'כפול · +150';
      wrap.appendChild(note);
      row.appendChild(wrap);
      setTimeout(() => AU.play('whoosh', { vol: 0.5 }), i * 180);
    });
    $('[data-done]', ov).addEventListener('click', () => { tap(); ov.classList.remove('show'); ov.innerHTML = ''; if (done) done(); });
  }

  // Walkout: flag → position → club → player.
  function walkout(card, done) {
    const w = $('#walk');
    const goat = card.edition === 'goat';
    const pl = card.player;
    w.style.setProperty('--wc', goat ? 'rgba(255,200,90,0.28)' : 'rgba(150,220,255,0.25)');
    w.style.setProperty('--wc2', goat ? '#ffcf6a' : '#9fe6ff');
    w.innerHTML = '<div class="w-light"></div>' +
      '<div class="w-step w-flag">' + C.FLAG_IL + '</div>' +
      '<div class="w-step w-pos">' + pl.pos + '</div>' +
      '<div class="w-step w-club"><img src="' + asset('assets/brand/crest.png') + '" alt=""></div>' +
      '<div class="w-player"><img src="' + asset('assets/players/' + pl.id + '.webp') + '" alt=""></div>' +
      '<div class="w-title"><b>' + (goat ? 'THE GOAT' : esc(pl.en)) + '</b><span>' + esc(pl.he.replace(/"[^"]*"\s*/, '')) + (goat ? ' · 100' : ' · ' + card.ovr) + '</span></div>' +
      '<div class="w-card"></div>' +
      '<canvas class="fx-canvas"></canvas>' +
      '<button class="w-skip">דלגו</button>';
    $('.w-card', w).appendChild(C.el(card));
    w.classList.add('show');
    AU.play('boom', { vol: 0.9 });
    const steps = $$('.w-step', w);
    const timers = [];
    const at = (t, fn) => timers.push(setTimeout(fn, t));
    let finished = false;
    const fx = fireworks($('.fx-canvas', w), goat);
    at(150, () => steps[0].classList.add('on'));
    at(1300, () => { steps[0].classList.remove('on'); steps[1].classList.add('on'); AU.play('whoosh', { vol: 0.6 }); });
    at(2400, () => { steps[1].classList.remove('on'); steps[2].classList.add('on'); AU.play('whoosh', { vol: 0.6 }); });
    at(3500, () => {
      steps[2].classList.remove('on');
      $('.w-player', w).classList.add('on'); $('.w-title', w).classList.add('on');
      AU.play('boom', { vol: 0.8 }); AU.play('roar', { vol: 0.6 });
      fx.burst(goat ? 9 : 5);
      if (goat) AU.line('goat_walkout', { force: true });
    });
    at(5600, () => { $('.w-card', w).classList.add('on'); AU.play('whoosh', { vol: 0.7 }); fx.burst(4); });
    const finish = () => {
      if (finished) return; finished = true;
      timers.forEach(clearTimeout); fx.stop();
      w.classList.remove('show'); w.innerHTML = '';
      done();
    };
    at(goat ? 9000 : 7800, finish);
    $('.w-skip', w).addEventListener('click', finish);
  }

  function fireworks(canvas, gold) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = () => { canvas.width = canvas.clientWidth * dpr; canvas.height = canvas.clientHeight * dpr; };
    fit();
    const parts = [];
    let run = true;
    const cols = gold ? ['#ffe7a3', '#e8c26a', '#ffffff', '#ff4a5e'] : ['#ffffff', '#9fe6ff', '#e8c26a'];
    function burst(n) {
      for (let k = 0; k < n; k++) {
        const x = (0.15 + Math.random() * 0.7) * canvas.width, y = (0.12 + Math.random() * 0.4) * canvas.height;
        const c = cols[k % cols.length];
        for (let i = 0; i < 70; i++) {
          const a = Math.random() * Math.PI * 2, sp = (1 + Math.random() * 4) * dpr;
          parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1 + Math.random() * 0.8, c });
        }
      }
    }
    function tick() {
      if (!run) return;
      requestAnimationFrame(tick);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = parts.length - 1; i >= 0; i--) {
        const q = parts[i];
        q.life -= 0.016; if (q.life <= 0) { parts.splice(i, 1); continue; }
        q.vy += 0.05 * dpr; q.vx *= 0.985; q.vy *= 0.985; q.x += q.vx; q.y += q.vy;
        ctx.globalAlpha = Math.min(1, q.life); ctx.fillStyle = q.c;
        ctx.fillRect(q.x, q.y, 2.4 * dpr, 2.4 * dpr);
      }
      ctx.globalAlpha = 1;
    }
    tick();
    return { burst, stop() { run = false; } };
  }

  // ---------------------------------------------------------------- cup
  function newCup() {
    const pickOne = arr => arr[Math.floor(Math.random() * arr.length)];
    return { round: 0, opps: [pickOne(['barkei', 'krishim']), pickOne(['arayot', 'nesharim']), 'raam'], results: [], status: 'active' };
  }

  function renderCup() {
    const s = $('#screen-cup');
    const p = ST.get();
    if (!p.cup) { p.cup = newCup(); ST.save(); }
    const cup = p.cup;
    const names = ['רבע גמר', 'חצי גמר', 'גמר'];
    const rounds = cup.opps.map((id, i) => {
      const t = D.teamById[id];
      const res = cup.results[i];
      const cls = i === cup.round && cup.status === 'active' ? 'now' : (res ? 'done' : '');
      return '<div class="round ' + cls + '"><span class="r-name">' + names[i] + '</span><span class="r-opp">' + crestSVG(t) + esc(t.he) + '</span>' +
        '<span class="r-res num">' + (res ? res[0] + ' - ' + res[1] + (res[2] ? ' (פנ׳)' : '') : (i === cup.round && cup.status === 'active' ? 'הבא' : '')) + '</span></div>';
    }).join('');
    let msg, btn;
    if (cup.status === 'won') { msg = 'קציר FC אלופת הגביע! הגביע שלכם.'; btn = '<button class="btn" data-newcup>גביע חדש</button>'; }
    else if (cup.status === 'out') { msg = 'הודחנו הפעם. קציר תחזור חזקה יותר.'; btn = '<button class="btn" data-newcup>נסו שוב</button>'; }
    else { msg = 'עוד ' + (3 - cup.round) + ' ניצחונות עד הגביע.'; btn = '<button class="btn" data-play>שחקו את ה' + names[cup.round] + '</button>'; }
    s.innerHTML = '<div class="content">' + topbar({ back: 'home', title: 'גביע קציר' }) +
      '<div class="cup scroll"><div class="bracket">' + rounds + '</div>' +
      '<div class="panel trophy">' + trophySVG() + '<h3 class="screen-title">' + msg + '</h3>' +
      '<p class="hint">זכייה בגביע: 5,000 מטבעות ונבחרת העולם נפתחת במשחק מהיר. גביעים עד היום: <b class="num">' + p.cups + '</b></p>' + btn + '</div></div></div>';
    bindTopbar(s);
    const pl = $('[data-play]', s);
    if (pl) pl.addEventListener('click', () => { tap(); matchCtx = { mode: 'cup', opp: cup.opps[cup.round] }; show('prep'); });
    const nc = $('[data-newcup]', s);
    if (nc) nc.addEventListener('click', () => { tap(); p.cup = newCup(); ST.save(); renderCup(); });
  }

  function cupResult(gf, ga, pens) {
    const p = ST.get();
    const cup = p.cup;
    if (!cup || cup.status !== 'active') return;
    cup.results[cup.round] = [gf, ga, pens ? 1 : 0];
    const won = pens ? pens === 'win' : gf > ga;
    if (!won) cup.status = 'out';
    else if (cup.round >= 2) {
      cup.status = 'won'; p.cups++; ST.addCoins(5000);
      setTimeout(() => { AU.line('cup', { force: true }); AU.play('roar', { vol: 0.9 }); }, 600);
    } else cup.round++;
    ST.save();
  }

  // ---------------------------------------------------------------- match
  function startMatch(oppId) {
    const opp = D.teamById[oppId];
    const p = ST.get();
    if (match) { match.destroy(); match = null; }
    show('match');
    const s = $('#screen-match');
    s.innerHTML = '<canvas id="pitch"></canvas>' +
      '<div class="hud">' +
        '<div class="scoreboard"><div class="sb-team">' + crestSVG(KATZIR) + '<span>KAT</span><i style="background:' + (D.KITS[p.kit] || D.KITS.home).shirt + '"></i></div>' +
        '<div class="sb-score"><span id="sb-h">0</span><span>-</span><span id="sb-a">0</span></div>' +
        '<div class="sb-team"><i style="background:' + opp.primary + '"></i><span>' + opp.code + '</span>' + crestSVG(opp) + '</div>' +
        '<div class="sb-clock" id="sb-clock">00:00</div></div>' +
        '<button class="hud-btn" id="btn-pause" aria-label="השהיה">' + ICON.pause + '</button>' +
        '<div class="player-chip hide" id="chip"><img alt=""><b></b><span class="num"></span></div>' +
        '<div class="subtitle" id="subtitle"></div>' +
        '<div class="rotate-gate" id="rotate-gate"><svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round"><rect x="20" y="6" width="24" height="52" rx="5"/><path d="M29 50h6"/></svg>' +
          '<h2>סובבו את הטלפון לרוחב</h2><p>המצלמה של המשחק היא מצלמת שידור מהצד, והמגרש כולו נכנס רק כשהמסך לרוחב.</p>' +
          '<button class="btn ghost small" id="gate-go">המשיכו לאורך בכל זאת</button></div>' +
        '<div class="controls"><div class="stick-zone" id="stick-zone"><div class="stick" id="stick"><div class="knob"></div></div></div>' +
          '<div class="actions">' +
            '<button class="act act-sprint" id="act-sprint">ספרינט</button>' +
            '<button class="act act-pass" id="act-pass">מסירה</button>' +
            '<button class="act act-shoot" id="act-shoot">בעיטה</button>' +
          '</div></div>' +
        '<div class="keys-help" id="keys-help">' +
          '<span><kbd>WASD</kbd> / <kbd>&larr;&uarr;&rarr;&darr;</kbd></span><span>תנועה</span>' +
          '<span><kbd>J</kbd></span><span>מסירה · החזיקו ללוב</span>' +
          '<span><kbd>K</kbd> / <kbd>Space</kbd></span><span>בעיטה (החזיקו לעוצמה) · תיקול בהגנה</span>' +
          '<span><kbd>Shift</kbd></span><span>ספרינט</span>' +
          '<span><kbd>Q</kbd></span><span>החלפת שחקן</span>' +
          '<span><kbd>Esc</kbd></span><span>השהיה</span></div>' +
      '</div>' +
      '<div class="m-over intro-over" id="ov-intro"></div>' +
      '<div class="m-over goal-over" id="ov-goal"></div>' +
      '<div class="m-over" id="ov-pause"></div>' +
      '<div class="m-over" id="ov-half"></div>';

    const ui = {
      score(sc) { $('#sb-h').textContent = sc[0]; $('#sb-a').textContent = sc[1]; },
      clock: (() => { let lastTxt = ''; return (sec, half) => {
        const m = Math.floor(sec / 60), ss = Math.floor(sec % 60);
        const txt = String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
        if (txt !== lastTxt) { lastTxt = txt; $('#sb-clock').textContent = txt; }
      }; })(),
      chip: (() => { let t = 0; return pl => {
        const c = $('#chip');
        $('img', c).src = asset('assets/heads/' + pl.data.id + '.png');
        $('b', c).textContent = pl.data.he.replace(/"[^"]*"\s*/, '');
        $('span', c).textContent = pl.ovr;
        c.classList.remove('hide'); clearTimeout(t); t = setTimeout(() => c.classList.add('hide'), 1800);
      }; })(),
      intro() {
        const o = $('#ov-intro');
        o.innerHTML = '<div class="eyebrow">' + (matchCtx && matchCtx.mode === 'cup' ? 'גביע קציר' : 'משחק מהיר') + ' · ' + D.DIFFICULTY[p.difficulty].he + '</div>' +
          '<div class="i-vs"><div class="i-team">' + crestSVG(KATZIR) + '<b>קציר FC</b></div><div class="i-x">VS</div><div class="i-team">' + crestSVG(opp) + '<b>' + esc(opp.he) + '</b></div></div>';
        o.classList.add('show');
        setTimeout(() => o.classList.remove('show'), 2500);
      },
      goal(info) {
        const o = $('#ov-goal');
        const us = info.team === 0;
        const sc = info.scorer.data;
        const photo = us ? (ACTION[sc.id] ? asset('assets/action/' + sc.id + '.jpg') : null) : null;
        o.innerHTML = (photo ? '<div class="g-photo" style="background-image:url(' + photo + ')"></div>' :
          (us ? '<div class="g-photo" style="background:radial-gradient(60% 70% at 50% 40%, rgba(70,217,255,.35), transparent 70%), url(' + asset('assets/players/' + sc.id + '.webp') + ') center 18% / auto 92% no-repeat, linear-gradient(160deg,#152d74,#060d2a)"></div>'
            : '<div class="g-photo" style="background:linear-gradient(160deg,' + opp.primary + ',#05060c 75%)"></div>')) +
          '<div class="g-word' + (us ? '' : ' opp') + '">' + (us ? 'גול!' : 'גול ליריבה') + '</div>' +
          '<div class="g-who">' + (us ? '<img src="' + asset('assets/heads/' + sc.id + '.png') + '" alt="">' : crestSVG(opp)) +
          '<div><b>' + esc(us ? sc.he.replace(/"[^"]*"\s*/, '') : sc.he) + '</b><span class="num" dir="ltr">' + info.minute + "' · " + info.score[0] + ' - ' + info.score[1] + '</span></div></div>' +
          (info.goat ? '<div class="g-goat">THE GOAT · VAMOS</div>' : '');
        o.classList.add('show');
        requestAnimationFrame(() => { const ph = $('.g-photo', o); if (ph) ph.classList.add('on'); });
      },
      goalEnd() { $('#ov-goal').classList.remove('show'); },
      pause(on) {
        const o = $('#ov-pause');
        if (!on) { o.classList.remove('show'); return; }
        o.innerHTML = '<h2>הפסקה</h2><div class="btns">' +
          '<button class="btn" data-a="resume">המשך</button><button class="btn ghost" data-a="restart">משחק חדש</button><button class="btn ghost" data-a="quit">יציאה לתפריט</button></div>' +
          '<div class="seg" style="margin-top:10px"><button data-a="sound" class="' + (ST.get().sound ? 'on' : '') + '">צלילים</button><button data-a="voice" class="' + (ST.get().voice ? 'on' : '') + '">קריינות</button></div>';
        o.classList.add('show');
        $$('[data-a]', o).forEach(b => b.addEventListener('click', () => {
          tap();
          const a = b.dataset.a;
          if (a === 'resume') match.resume();
          else if (a === 'restart') startMatch(oppId);
          else if (a === 'quit') { endMatch(); show(matchCtx && matchCtx.mode === 'cup' ? 'cup' : 'home'); }
          else if (a === 'sound') { const pp = ST.get(); pp.sound = !pp.sound; ST.save(); AU.setEnabled(pp.sound); b.classList.toggle('on', pp.sound); }
          else if (a === 'voice') { const pp = ST.get(); pp.voice = !pp.voice; ST.save(); AU.setVoice(pp.voice); b.classList.toggle('on', pp.voice); }
        }));
      },
      halftime(sum, cont) {
        const o = $('#ov-half');
        o.innerHTML = '<div class="eyebrow">מחצית</div>' + scoreLine(sum, opp) + statsTable(sum, opp) +
          '<div class="btns"><button class="btn" data-a="go">למחצית השנייה</button></div>';
        o.classList.add('show');
        $('[data-a="go"]', o).addEventListener('click', () => { tap(); o.classList.remove('show'); cont(); });
      },
      fulltime(sum) { finishMatch(sum, opp); }
    };

    const cards = lineupCards();
    match = KFC.Match.create({ canvas: $('#pitch'), ui, home: { cards }, away: opp, minutes: p.minutes, difficulty: p.difficulty, kit: p.kit === 'auto' ? null : p.kit });
    const thisMatch = match;
    const begin = () => {
      if (match !== thisMatch || thisMatch.started) return;
      thisMatch.started = true;
      $('#rotate-gate').classList.remove('show');
      thisMatch.start();
      AU.loop('crowd_loop', 0.65, 1.5);
      setTimeout(() => { const kh = $('#keys-help'); if (kh) kh.classList.add('fade'); }, 12000);
    };
    const portrait = window.matchMedia('(orientation: portrait)');
    if (document.body.classList.contains('touch') && portrait.matches) {
      $('#rotate-gate').classList.add('show');
      $('#gate-go').addEventListener('click', () => { tap(); begin(); });
      const onRot = () => { if (!portrait.matches) { begin(); setTimeout(() => match && match.resize(), 250); } };
      if (portrait.addEventListener) portrait.addEventListener('change', onRot); else portrait.addListener(onRot);
    } else begin();
    wireControls();
    $('#btn-pause').addEventListener('click', () => { tap(); match.togglePause(); });
  }

  function scoreLine(sum, opp) {
    return '<div class="final-score">' + crestSVG(KATZIR) + '<span>' + sum.score[0] + ' - ' + sum.score[1] + '</span>' + crestSVG(opp) + '</div>';
  }

  function statsTable(sum, opp) {
    const fmtG = g => esc(g.name) + ' <span dir="ltr">' + g.minute + "'</span>";
    const goalsH = sum.goals.filter(g => g.team === 0).map(fmtG).join(', ') || '—';
    const goalsA = sum.goals.filter(g => g.team === 1).map(fmtG).join(', ') || '—';
    return '<div class="summary">' +
      '<div class="row"><span>' + sum.possession[0] + '%</span><span>החזקת כדור</span><span>' + sum.possession[1] + '%</span></div>' +
      '<div class="row"><span>' + sum.shots[0] + '</span><span>בעיטות</span><span>' + sum.shots[1] + '</span></div>' +
      '<div class="row"><span>' + sum.onTarget[0] + '</span><span>למסגרת</span><span>' + sum.onTarget[1] + '</span></div>' +
      '<div class="row" style="font-family:var(--font-body);font-size:13.5px"><span>' + goalsH + '</span><span>כובשים</span><span>' + goalsA + '</span></div>' +
      '</div>';
  }

  function finishMatch(sum, opp) {
    const p = ST.get();
    const [gf, ga] = sum.score;
    const res = gf > ga ? 'w' : gf < ga ? 'l' : 'd';
    const mult = { easy: 0.7, normal: 1, legend: 1.6 }[p.difficulty] || 1;
    const coins = Math.round(({ w: 600, d: 300, l: 150 }[res] + gf * 100) * mult);
    p.record[res]++; p.record.gf += gf; p.record.ga += ga;
    sum.scorers.forEach(sc => { p.scorers[sc.id] = (p.scorers[sc.id] || 0) + sc.goals; });
    ST.save();
    ST.addCoins(coins);
    setTimeout(() => AU.play('coin', { vol: 0.8 }), 900);
    const cup = matchCtx && matchCtx.mode === 'cup';
    const needPens = cup && res === 'd';
    if (cup && !needPens) cupResult(gf, ga);
    const o = $('#ov-half');
    const title = res === 'w' ? 'ניצחון!' : res === 'l' ? 'הפסד' : 'תיקו';
    o.innerHTML = '<div class="eyebrow">סיום המשחק</div><h2>' + title + '</h2>' + scoreLine(sum, opp) + statsTable(sum, opp) +
      '<div class="result-row">' +
      (sum.motm ? '<div class="motm"><div>' + C.html(sum.motm) + '</div><div><div class="motm-label">שחקן המשחק</div><b class="he" style="font-size:30px">' + esc(sum.motm.player.he.replace(/"[^"]*"\s*/, '')) + '</b></div></div>' : '') +
      '<div class="reward"><span>+' + fmt(coins) + '</span><span>מטבעות</span></div></div>' +
      '<div class="btns">' +
        (needPens ? '<button class="btn red" data-a="pens">לפנדלים!</button>' :
          (cup ? '<button class="btn" data-a="cup">חזרה לגביע</button>' : '<button class="btn" data-a="again">משחק חוזר</button>')) +
        '<button class="btn ghost" data-a="home">לתפריט</button></div>';
    o.classList.add('show');
    $$('[data-a]', o).forEach(b => b.addEventListener('click', () => {
      tap();
      const a = b.dataset.a;
      if (a === 'again') { startMatch(opp.id); return; }
      endMatch();
      if (a === 'pens') startPens({ mode: 'cup', opp: opp.id, score: [gf, ga] });
      else if (a === 'cup') show('cup');
      else show('home');
    }));
  }

  function endMatch() {
    if (match) { match.destroy(); match = null; }
    AU.stopLoop('crowd_loop', 0.8);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  function wireControls() {
    const zone = $('#stick-zone'), stick = $('#stick'), knob = $('.knob', stick);
    let sid = null, cx = 0, cy = 0;
    const R = 56;
    zone.addEventListener('pointerdown', e => {
      if (sid !== null) return;
      sid = e.pointerId; zone.setPointerCapture(sid);
      const r = zone.getBoundingClientRect();
      cx = e.clientX; cy = e.clientY;
      stick.style.left = (e.clientX - r.left) + 'px'; stick.style.top = (e.clientY - r.top) + 'px';
      knob.style.transform = '';
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== sid) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = dx / d * R; dy = dy / d * R; }
      knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
      match && match.touch.stick(dx / R, -dy / R);
    });
    const end = e => {
      if (e.pointerId !== sid) return;
      sid = null; knob.style.transform = '';
      match && match.touch.stick(0, 0);
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    const btn = (id, fn) => {
      const b = $(id);
      b.addEventListener('pointerdown', e => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('down'); fn(true); });
      const up = e => { if (!b.classList.contains('down')) return; b.classList.remove('down'); fn(false); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up);
      b.addEventListener('contextmenu', e => e.preventDefault());
    };
    btn('#act-pass', v => match && match.touch.pass(v));
    btn('#act-shoot', v => match && match.touch.shoot(v));
    btn('#act-sprint', v => match && match.touch.sprint(v));
    // contextual labels
    let lastCtx = '';
    const tick = () => {
      if (!match) return;
      const c = match.context();
      if (c !== lastCtx) {
        lastCtx = c;
        $('#act-pass').textContent = c === 'attack' ? 'מסירה' : 'החלפה';
        $('#act-shoot').textContent = c === 'attack' ? 'בעיטה' : 'תיקול';
      }
      setTimeout(tick, 150);
    };
    tick();
  }

  // ---------------------------------------------------------------- penalties
  let pens = null;
  function startPens(opts) {
    const opp = D.teamById[opts.opp] || D.teamById.barkei;
    const lineup = ST.get().lineup;
    const order = ['liam', 'yiftach', 'shratzer', 'erez', 'ido', 'gefen', 'sipko'].filter(id => lineup.indexOf(id) >= 0)
      .concat(lineup.filter(id => !D.byId[id].gk && ['liam', 'yiftach', 'shratzer', 'erez', 'ido', 'gefen', 'sipko'].indexOf(id) < 0));
    const gkId = lineup.find(id => D.byId[id].gk) || 'noam';
    pens = { opts, opp, order, gkId, kick: 0, us: [], them: [], turn: 'us', busy: false, done: false };
    show('pens');
    renderPens('בחרו פינה ובעטו!');
  }

  function renderPens(msg) {
    const s = $('#screen-pens');
    const P = pens;
    const shooterId = P.order[Math.floor(P.us.length) % P.order.length];
    const dots = arr => { const n = Math.max(5, arr.length + (arr.length >= 5 ? 1 : 0)); let h = ''; for (let i = 0; i < n; i++) h += '<i class="' + (arr[i] === true ? 'in' : arr[i] === false ? 'out' : '') + '"></i>'; return h; };
    const usTurn = P.turn === 'us';
    s.innerHTML = '<div class="content">' + topbar({ back: P.opts.mode === 'cup' ? 'cup' : 'home', title: 'דו-קרב פנדלים' }) +
      '<div class="pens">' +
        '<div class="pens-score"><div class="side">' + crestSVG(KATZIR, 'crest-badge') + '<b>קציר FC</b><div class="dots">' + dots(P.us) + '</div></div>' +
        '<div class="side">' + crestSVG(P.opp, 'crest-badge') + '<b>' + esc(P.opp.he) + '</b><div class="dots">' + dots(P.them) + '</div></div></div>' +
        '<div class="pens-msg">' + esc(msg || '') + '</div>' +
        '<div class="pens-stage">' +
          '<div class="pens-goal"><div class="pens-zones">' + [0, 1, 2, 3, 4, 5].map(z => '<button data-z="' + z + '" aria-label="פינה ' + (z + 1) + '"></button>').join('') + '</div>' +
          '<svg class="pens-keeper" id="keeper" viewBox="0 0 60 100">' + keeperSVG(usTurn ? P.opp.primary : '#141414', usTurn ? null : P.gkId) + '</svg></div>' +
          (usTurn ? '<div class="pens-shooter" style="background-image:url(' + asset('assets/players/' + shooterId + '.webp') + ')"></div>' : '') +
          '<div class="pens-ball" id="pball"></div>' +
        '</div>' +
        '<div class="pens-help">' + (P.done ? '' : usTurn ? 'בועט: <b>' + esc(D.byId[shooterId].he) + '</b> · לחצו על הפינה שאליה תבעטו' : 'השוער: <b>' + esc(D.byId[P.gkId].he) + '</b> · לחצו על הפינה שאליה השוער יזנק') + '</div>' +
        (P.done ? '<div class="btns" style="display:flex;gap:12px;flex-wrap:wrap;justify-content:center">' + (P.opts.mode === 'cup' ? '<button class="btn" data-a="cup">חזרה לגביע</button>' : '<button class="btn" data-a="again">שוב</button>') + '<button class="btn ghost" data-a="home">לתפריט</button></div>' : '') +
      '</div></div>';
    bindTopbar(s);
    $$('[data-z]', s).forEach(b => b.addEventListener('click', () => pensKick(+b.dataset.z)));
    $$('[data-a]', s).forEach(b => b.addEventListener('click', () => {
      tap();
      if (b.dataset.a === 'again') startPens(P.opts);
      else show(b.dataset.a);
    }));
  }

  function keeperSVG(color, headId) {
    return '<g><rect x="16" y="34" width="28" height="34" rx="8" fill="' + color + '"/>' +
      '<rect x="4" y="36" width="14" height="8" rx="4" fill="' + color + '"/><rect x="42" y="36" width="14" height="8" rx="4" fill="' + color + '"/>' +
      '<circle cx="5" cy="40" r="5" fill="#f2f2f2"/><circle cx="55" cy="40" r="5" fill="#f2f2f2"/>' +
      '<rect x="18" y="66" width="10" height="30" rx="4" fill="#1b1b1b"/><rect x="32" y="66" width="10" height="30" rx="4" fill="#1b1b1b"/>' +
      (headId ? '<image href="' + asset('assets/heads/' + headId + '.png') + '" x="12" y="0" width="36" height="38" preserveAspectRatio="xMidYMax meet"/>' : '<circle cx="30" cy="22" r="11" fill="#c99a7a"/><path d="M19 20a11 11 0 0 1 22 0z" fill="#1b1410"/>') + '</g>';
  }

  // zones: 0 1 2 = top row (left→right on screen), 3 4 5 = bottom row
  function zonePos(z) { return { x: [22, 50, 78][z % 3], y: z < 3 ? 26 : 50 }; }

  function pensKick(z) {
    const P = pens;
    if (!P || P.busy || P.done) return;
    P.busy = true; tap();
    const diff = D.DIFFICULTY[ST.get().difficulty] || D.DIFFICULTY.normal;
    const ball = $('#pball'), keeper = $('#keeper');
    let shotZ, diveZ, scored;
    if (P.turn === 'us') {
      const shooter = D.byId[P.order[P.us.length % P.order.length]];
      const card = ST.cardFor(shooter.id);
      shotZ = z;
      // keeper guesses: smarter on higher difficulty
      diveZ = Math.random() < 0.18 + 0.12 * diff.ai ? shotZ : Math.floor(Math.random() * 6);
      const missP = shooter.goat ? 0 : (z < 3 ? 0.16 : 0.05) * (1.4 - card.stats.sho / 100);
      const miss = Math.random() < missP;
      const saved = !miss && (diveZ === shotZ ? Math.random() < 0.8 : (Math.abs(diveZ % 3 - shotZ % 3) === 0 ? Math.random() < 0.3 : false));
      scored = !miss && !saved;
      if (shooter.goat && saved && Math.random() < 0.6) scored = true; // the GOAT finds a way
      animatePen(ball, keeper, shotZ, diveZ, miss);
      setTimeout(() => {
        P.us.push(scored);
        resolvePen(scored ? (shooter.goat ? 'גול של הגואט! וואמוס!' : 'גול! ' + shooter.he.replace(/"[^"]*"\s*/, '')) : (miss ? 'החמצה! מעל המשקוף' : 'השוער הציל!'), scored);
      }, 900);
    } else {
      diveZ = z;
      shotZ = Math.floor(Math.random() * 6);
      const gk = ST.cardFor(P.gkId);
      const miss = Math.random() < 0.08 + (1 - diff.ai) * 0.1;
      const saved = !miss && (diveZ === shotZ ? Math.random() < 0.55 + gk.stats.div / 400 : (diveZ % 3 === shotZ % 3 ? Math.random() < 0.25 : false));
      scored = !miss && !saved;
      animatePen(ball, keeper, shotZ, diveZ, miss);
      setTimeout(() => {
        P.them.push(scored);
        resolvePen(scored ? 'גול ליריבה' : (miss ? 'הם החמיצו!' : 'איזו הצלה של ' + D.byId[P.gkId].he.replace(/"[^"]*"\s*/, '') + '!'), !scored);
      }, 900);
    }
  }

  function animatePen(ball, keeper, shotZ, diveZ, miss) {
    const sp = zonePos(shotZ), kp = zonePos(diveZ);
    AU.play('kick', { vol: 0.8 });
    const stage = ball.parentElement.getBoundingClientRect();
    const goal = $('.pens-goal').getBoundingClientRect();
    const tx = goal.left - stage.left + goal.width * sp.x / 100, ty = goal.top - stage.top + goal.height * (miss && shotZ < 3 ? -0.15 : sp.y / 100 * 1.4);
    ball.style.left = tx + 'px'; ball.style.bottom = (stage.height - ty) + 'px';
    ball.style.width = ball.style.height = '22px'; ball.style.marginLeft = '-11px';
    const dx = (kp.x - 50) * 1.6, rot = (kp.x - 50) * 1.4, lift = kp.y < 40 ? -18 : 0;
    keeper.style.transform = 'translateX(calc(-50% + ' + dx + '%)) translateY(' + lift + '%) rotate(' + rot + 'deg)';
  }

  function resolvePen(msg, good) {
    const P = pens;
    AU.play(good ? 'roar' : 'ooh', { vol: good ? 0.6 : 0.7 });
    const u = P.us.filter(Boolean).length, t = P.them.filter(Boolean).length;
    const nu = P.us.length, nt = P.them.length;
    let winner = null;
    if (nu <= 5 && nt <= 5) {
      const remU = 5 - nu, remT = 5 - nt;
      if (u > t + remT) winner = 'us'; else if (t > u + remU) winner = 'them';
    }
    if (!winner && nu >= 5 && nt >= 5 && nu === nt && u !== t) winner = u > t ? 'us' : 'them';
    P.turn = P.turn === 'us' ? 'them' : 'us';
    if (winner) {
      P.done = true;
      const won = winner === 'us';
      const coins = won ? 400 : 100;
      ST.addCoins(coins);
      if (P.opts.mode === 'cup') {
        const sc = P.opts.score || [0, 0];
        cupResult(sc[0], sc[1], won ? 'win' : 'lose');
      }
      setTimeout(() => { if (won) AU.play('roar', { vol: 0.9 }); renderPens((won ? 'קציר FC מנצחת בפנדלים ' : 'הפסד בפנדלים ') + u + '-' + t + ' · +' + coins + ' מטבעות'); }, 700);
      return;
    }
    setTimeout(() => { P.busy = false; renderPens(msg); }, 1100);
  }

  return {
    show, toast, renderTitle, openPack, walkout, welcomePack, openPlayer, crestSVG,
    PACKS, current: () => current,
    startMatch, get match() { return match; }
  };
})();
