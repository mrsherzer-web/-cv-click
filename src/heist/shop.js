/* Chapter 3: IRONSIDE ARMORY — the gun-store interior and its purchase menu. Contract: CREW_SPEC.md section D.
 *
 * API
 *  HShop.open(H, { budget, items, onDone(result), owned, intro })
 *    Builds the store interior (its own THREE.Scene, registered in H.extraScenes) with the three crew members at the
 *    counter, switches the engine to H.state = 'interior' (street frozen, pause allowed) and shows the purchase menu.
 *    budget  default HShop.BUDGET (62,000)       items  default HShop.ITEMS
 *    owned   ids already bought (e.g. a retry); they count as spent      intro  false = skip the opening dolly
 *    result = { bought: [ids, in list order], spent, left }
 *    onDone(result) runs after checkout, at full black: by then H.state is 'play', H.interior is null, the scene and the
 *    menu are gone and HHud.fade(0, .5) is already running (start a cut, or call HHud.fade(1, 0), inside onDone).
 *  HShop.close(silent)  ends the shop at once and restores the engine; silent = no onDone (Heist.stop() uses it),
 *                       otherwise onDone(current result).
 *  HShop.skipIntro()    jumps the opening camera move.
 *  HShop.active         true while open.     HShop.result()  current { bought, spent, left }.
 *  HShop.ITEMS          the chapter-3 list: { id, name{he,en}, desc{he,en}, cat{he,en}, price, required, icon, qty, who, pose, quip{he,en} }
 *                       ids: 'masks' (required, qty 3), 'thermal' (required), 'bombs' (qty 4), 'nitro', 'jammer'.
 *  HShop.text(v)        resolves a {he,en} object / i18n key / plain string in the current language.
 *  HShop.itemName(id)   localized item name (for results screens).
 *
 * Input: W/S/arrows select (the checkout button is the last entry), E/F/Enter/Space buy, Backspace/Delete refund,
 * C checkout, mouse hover/click (clicking a bought row refunds it), touch taps; Esc/P pause (engine). A mouse drag or a
 * thumb on the 3D view orbits the camera a little. Custom items may use plain strings or i18n keys for name/desc/cat. */
const HShop = (function () {
  'use strict';

  /* ================= strings (he first) ================= */
  const STR = {
    he: {
      sh_sub: 'נשקייה · ציוד טקטי · תחמושת',
      sh_left: 'נשאר בקופה', sh_colItem: 'פריט', sh_colType: 'סוג', sh_colPrice: 'מחיר',
      sh_req: 'חובה', sh_stamp: 'נרכש!',
      sh_checkout: 'סיום קנייה', sh_missing: 'חסרים {n} פריטי חובה', sh_missing1: 'חסר פריט חובה אחד', sh_ready: 'יוצאים לדרך',
      sh_coDesc: 'יוצאים עם מה שקניתם. העודף מצטרף לשלל בסוף.',
      sh_noCash: 'אין מספיק כסף — החזירו משהו (Backspace).', sh_noCashT: 'אין מספיק כסף — הקישו על פריט שקניתם כדי להחזיר אותו.',
      sh_needReq: 'קודם קונים את כל פריטי החובה.', sh_ownedHint: 'כבר קניתם את זה. Backspace מחזיר.',
      sh_actBuy: 'קנייה', sh_actRefund: 'החזר', sh_actGo: 'יציאה',
      sh_keys: '<kbd>W</kbd><kbd>S</kbd> בחירה · <kbd>E</kbd> קנייה · <kbd>⌫</kbd> החזר · <kbd>C</kbd> סיום',
      sh_keysTouch: 'הקישו על פריט כדי לקנות · הקשה נוספת מחזירה',
      sh_yoav: 'יואב', sh_hadar: 'הדר', sh_ido: 'עידו',
      sh_q_hi: '{b} דולר. קונים חכם, לא הרבה.',
      sh_q_noCash: 'אין לנו מספיק. תחזיר משהו.',
      sh_q_refund: 'טוב, נסתדר בלי.',
      sh_q_needReq: 'קודם הציוד והמטען. בלי זה אין שוד.',
      sh_q_allReq: 'יש לנו את הבסיס. כל השאר בונוס.',
      sh_q_bye: 'יאללה, לאוטו!',
    },
    en: {
      sh_sub: 'Firearms · Tactical gear · Ammo',
      sh_left: 'Cash left', sh_colItem: 'Item', sh_colType: 'Type', sh_colPrice: 'Price',
      sh_req: 'Required', sh_stamp: 'PURCHASED',
      sh_checkout: 'Checkout', sh_missing: '{n} required items missing', sh_missing1: '1 required item missing', sh_ready: 'Ready to roll',
      sh_coDesc: 'Leave with what you bought. Leftover cash joins the take at the end.',
      sh_noCash: 'Not enough cash. Put something back (Backspace).', sh_noCashT: 'Not enough cash. Tap something you bought to put it back.',
      sh_needReq: 'Buy all the required items first.', sh_ownedHint: 'Already bought. Backspace refunds it.',
      sh_actBuy: 'Buy', sh_actRefund: 'Refund', sh_actGo: 'Leave',
      sh_keys: '<kbd>W</kbd><kbd>S</kbd> select · <kbd>E</kbd> buy · <kbd>⌫</kbd> refund · <kbd>C</kbd> checkout',
      sh_keysTouch: 'Tap an item to buy it · tap again to refund',
      sh_yoav: 'Yoav', sh_hadar: 'Hadar', sh_ido: 'Ido',
      sh_q_hi: '${b}. Buy smart, not big.',
      sh_q_noCash: 'We can\'t afford that. Put something back.',
      sh_q_refund: 'Fine, we\'ll manage without.',
      sh_q_needReq: 'Gear and the charge first. No heist without them.',
      sh_q_allReq: 'We\'ve got the basics. The rest is a bonus.',
      sh_q_bye: 'Let\'s roll!',
    },
  };
  if (typeof I18N !== 'undefined') { Object.assign(I18N.he, STR.he); Object.assign(I18N.en, STR.en); }
  const lang = () => (typeof LANG !== 'undefined' && LANG === 'en' ? 'en' : 'he');
  const tr = (k, v) => (typeof t === 'function' ? t(k, v) : (STR[lang()][k] || k));
  function text(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'object') return v[lang()] || v.he || v.en || '';
    const s = String(v);
    if (typeof I18N !== 'undefined' && I18N.he && I18N.he[s] !== undefined && typeof t === 'function') return t(s);
    return s;
  }
  const money = n => '$' + Math.round(n).toLocaleString('en-US');

  /* ================= the chapter-3 shopping list ================= */
  const ITEMS = [
    { id: 'masks', icon: 'mask', price: 21000, required: true, qty: 3, who: 'hadar', pose: 'cheer',
      name: { he: 'ציוד טקטי + מסכות ×3', en: 'Tactical gear + masks ×3' }, cat: { he: 'ציוד', en: 'Gear' },
      desc: { he: 'אפודים, כפפות ובלקלבות לשלושתכם. שום מצלמה לא תזהה אתכם.', en: 'Vests, gloves and balaclavas for all three. No camera will know your faces.' },
      quip: { he: 'שחור מרזה, אחי.', en: 'Black is slimming, bro.' } },
    { id: 'thermal', icon: 'thermal', price: 14500, required: true, who: 'yoav', pose: 'point',
      name: { he: 'מטען תרמי', en: 'Thermal charge' }, cat: { he: 'חומר נפץ', en: 'Explosive' },
      desc: { he: 'נצמד לדלת הכספת ושורף את הבריחים. בלי המטען אין שוד.', en: 'Sticks to the vault door and burns through the bolts. No charge, no heist.' },
      quip: { he: 'זה המפתח שלנו לכספת.', en: 'That\'s our key to the vault.' } },
    { id: 'bombs', icon: 'bomb', price: 12000, qty: 4, who: 'hadar', pose: 'cheer',
      name: { he: 'פצצות דביקות ×4', en: 'Sticky bombs ×4' }, cat: { he: 'חומר נפץ', en: 'Explosive' },
      desc: { he: 'מפילים מאחורי האוטו במרדף (G), והניידת שעל הזנב עפה.', en: 'Drop them behind the car in a chase (G) and the cruiser on your tail goes flying.' },
      quip: { he: 'ארבע? בואו נעשה קצת רעש.', en: 'Four of them? Let\'s make some noise.' } },
    { id: 'nitro', icon: 'nitro', price: 9500, who: 'ido', pose: 'cheer',
      name: { he: 'ערכת ניטרו', en: 'Nitro kit' }, cat: { he: 'רכב', en: 'Vehicle' },
      desc: { he: 'Shift באוטו = בוסט מטורף. השוטרים יראו רק פנסים אחוריים.', en: 'Shift in the car = a huge boost. The cops only ever see your tail lights.' },
      quip: { he: 'ניטרו! עכשיו אנחנו מדברים.', en: 'Nitro! Now we\'re talking.' } },
    { id: 'jammer', icon: 'jammer', price: 16000, who: 'yoav', pose: 'point',
      name: { he: 'משבש קשר משטרתי', en: 'Police-radio jammer' }, cat: { he: 'אלקטרוניקה', en: 'Electronics' },
      desc: { he: 'פחות ניידות מצטרפות למרדף, ומאבדים אותן מהר יותר.', en: 'Fewer cruisers join the chase, and you shake them off faster.' },
      quip: { he: 'שהשוטרים ידברו עם עצמם.', en: 'Let the cops talk to themselves.' } },
  ];
  const BUDGET = 62000;

  /* ================= icons (24x24 line art, our own) ================= */
  const SVG = (inner) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const ICONS = {
    mask: SVG('<path d="M12 2.6c-4.1 0-6.9 3.2-6.9 7.5v5.3c0 3.5 3 6 6.9 6s6.9-2.5 6.9-6v-5.3c0-4.3-2.8-7.5-6.9-7.5z"/><path d="M7.4 10.2h9.2v2.9H7.4z" fill="currentColor" stroke="none"/><path d="M10.4 17.2h3.2"/>'),
    thermal: SVG('<rect x="3.5" y="7" width="17" height="10.5" rx="1.6"/><path d="M8 7v10.5M16 7v10.5"/><rect x="10" y="9.3" width="4" height="3.2" rx=".5"/><circle cx="12" cy="15" r="1.1" fill="currentColor" stroke="none"/>'),
    bomb: SVG('<rect x="6" y="7" width="12" height="14" rx="3"/><path d="M6 11.5h12M6 16.5h12M9.5 7V4.5h5V7"/><path d="M17.4 3.6l1.4-1.4M19.4 6l1.8-.6M19.6 3.9l1.3-.1"/>'),
    nitro: SVG('<path d="M9.5 2.8h5M10.2 2.8v3.4A5.2 5.2 0 0 0 7 11v8.2c0 1 .8 1.8 1.8 1.8h6.4c1 0 1.8-.8 1.8-1.8V11a5.2 5.2 0 0 0-3.2-4.8V2.8"/><path d="M12.9 10.4l-2.5 4h3.2l-2.4 4"/>'),
    jammer: SVG('<rect x="5" y="9" width="14" height="11.5" rx="2"/><path d="M9 9V3.2M15 9V5.4"/><circle cx="12" cy="14.7" r="2.6"/><path d="M3.2 3.6l17.6 17.6"/>'),
    lock: SVG('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    check: SVG('<path d="M5 12.6l4.6 4.6L19.2 7.6"/>'),
    box: SVG('<path d="M3.5 7.5L12 3l8.5 4.5v9L12 21l-8.5-4.5z"/><path d="M3.5 7.5L12 12l8.5-4.5M12 12v9"/>'),
  };
  const LOGO = `<svg class="sh-shield" viewBox="-62 -66 124 136" aria-hidden="true"><path d="M-50 -56H50V2Q48 42 0 64Q-48 42 -50 2Z" fill="#16191d" stroke="#c9ced4" stroke-width="7"/><circle cx="0" cy="2" r="26" fill="none" stroke="#e8581c" stroke-width="6"/><path d="M0 -36V-10M0 14V40M-38 2H-12M12 2H38" stroke="#e8581c" stroke-width="5"/><circle cx="0" cy="2" r="4.5" fill="#e8581c"/></svg>`;

  /* ================= crew ================= */
  const CREW = [ // screen left to right, like the video: Hadar, Ido, Yoav
    { id: 'hadar', x: -0.9, z: 0.05, h: 0.2, seed: 1489, ph: 0.0, ac: '#5cf2a8', acd: '#0f8a57' },
    { id: 'ido', x: 0.0, z: -0.1, h: 0.0, seed: 128, ph: 1.9, ac: '#4da3ff', acd: '#1d62c2' },
    { id: 'yoav', x: 0.92, z: 0.03, h: -0.26, seed: 3514, ph: 3.3, ac: '#ffd23f', acd: '#a87500' },
  ];
  const BONE_IX = { root: 0, hips: 1, spine: 2, head: 3, uArmL: 4, fArmL: 5, uArmR: 6, fArmR: 7, thighL: 8, shinL: 9, thighR: 10, shinR: 11 };

  /* ================= CSS (1280x720 stage px) ================= */
  const CSS = `
  #shop { position:absolute; inset:0; z-index:4; pointer-events:none; color:#f1eee7; font-family:var(--body); -webkit-user-select:none; user-select:none; }
  #shop * { box-sizing:border-box; }
  #shop svg { display:block; width:100%; height:100%; }
  #shop .sh-panel { position:absolute; z-index:1; left:50%; bottom:20px; width:690px; margin-left:-345px; pointer-events:auto; background:rgba(10,11,14,.83);
    box-shadow:0 0 0 1px rgba(255,255,255,.08), 0 24px 60px rgba(0,0,0,.6); border-radius:5px; overflow:hidden;
    transition:transform .6s cubic-bezier(.2,1,.3,1), opacity .4s ease; }
  #shop .sh-panel.off { transform:translateY(70px); opacity:0; pointer-events:none; }
  #shop .sh-panel.bye { transform:translateY(90px); opacity:0; pointer-events:none; transition-duration:.45s; }
  #shop .sh-panel.shake { animation:shshake .4s; }
  @keyframes shshake { 20% { transform:translateX(-10px); } 40% { transform:translateX(9px); } 60% { transform:translateX(-6px); } 80% { transform:translateX(3px); } }
  #shop .sh-head { display:flex; align-items:center; justify-content:space-between; gap:14px; padding:8px 16px 7px 12px; background:linear-gradient(180deg,#262a30,#121417); border-bottom:3px solid #e8581c; }
  [dir="rtl"] #shop .sh-head { padding:8px 12px 7px 16px; }
  #shop .sh-logo { display:flex; align-items:center; gap:10px; min-width:0; }
  #shop .sh-shield { width:38px !important; height:42px !important; flex:none; filter:drop-shadow(0 2px 0 rgba(0,0,0,.6)); }
  #shop .sh-brand { font:400 35px/1 'Bebas Neue', Impact, 'Arial Narrow', sans-serif; letter-spacing:1.6px; color:#f4f1ea; direction:ltr; unicode-bidi:isolate; white-space:nowrap; text-shadow:0 2px 0 rgba(0,0,0,.6); }
  #shop .sh-brand i { font-style:normal; color:#ef6a26; }
  #shop .sh-sub { font:600 13px/1.1 var(--body); color:#a3a9b1; letter-spacing:.4px; margin-top:3px; white-space:nowrap; }
  #shop .sh-cash { position:relative; text-align:end; flex:none; }
  #shop .sh-cash small { display:block; font:700 12px/1 var(--body); color:#a3a9b1; letter-spacing:1px; text-transform:uppercase; margin-bottom:3px; }
  #shop .sh-cash b { display:inline-block; font:400 42px/.95 'Bebas Neue', Impact, sans-serif; color:#7dffb0; direction:ltr; unicode-bidi:isolate; font-variant-numeric:tabular-nums; letter-spacing:.5px; text-shadow:0 0 16px rgba(80,255,160,.35), 0 2px 0 #04210f; transition:color .3s; }
  #shop .sh-cash b.low { color:#ffcf5a; text-shadow:0 0 14px rgba(255,200,80,.3), 0 2px 0 #2a1a00; }
  #shop .sh-delta { position:absolute; inset-inline-end:100%; bottom:2px; margin-inline-end:12px; font:400 30px/1 'Bebas Neue', Impact, sans-serif; color:#ff8a4d; direction:ltr; unicode-bidi:isolate; font-style:normal; white-space:nowrap; text-shadow:0 2px 0 #000; animation:shdelta 1.25s ease-out forwards; pointer-events:none; }
  #shop .sh-delta.plus { color:#7dffb0; }
  @keyframes shdelta { 0% { opacity:0; transform:translateY(8px) scale(1.35); } 15% { opacity:1; transform:none; } 70% { opacity:1; } 100% { opacity:0; transform:translateY(-16px); } }
  #shop .sh-cols { display:grid; grid-template-columns:1fr 150px 112px; align-items:center; column-gap:10px; height:27px; padding:0 18px; background:#050506; font:800 12px/1 var(--body); letter-spacing:1.6px; color:#d5d7da; text-transform:uppercase; }
  #shop .sh-cols span:last-child { text-align:end; }
  #shop .sh-row { all:unset; display:grid; grid-template-columns:1fr 150px 112px; align-items:center; column-gap:10px; box-sizing:border-box; position:relative; width:100%; height:41px; padding:0 18px;
    border-top:1px solid rgba(255,255,255,.065); font:600 18px/1 var(--body); color:#ece9e2; cursor:pointer; transition:background-color .12s, color .12s; }
  #shop .sh-row:first-child { border-top:0; }
  #shop .sh-row::before { content:''; position:absolute; inset-inline-start:0; top:0; bottom:0; width:4px; background:#ffd23f; transform:scaleY(0); transition:transform .25s; }
  #shop .sh-row.own::before { transform:scaleY(1); }
  #shop .sh-name { display:flex; align-items:center; gap:10px; min-width:0; white-space:nowrap; }
  #shop .sh-nm { overflow:hidden; text-overflow:ellipsis; }
  #shop .sh-ic { width:26px; height:26px; flex:none; color:#ffb84d; }
  #shop .sh-tick { width:20px; height:20px; flex:none; color:#ffd23f; display:none; }
  #shop .sh-row.own .sh-tick { display:block; animation:shtick .35s cubic-bezier(.2,1.8,.4,1); }
  @keyframes shtick { from { transform:scale(0) rotate(-30deg); } to { transform:none; } }
  #shop .sh-req { flex:none; font:800 10px/1 var(--body); font-style:normal; letter-spacing:1px; padding:3px 6px 2px; border:1.5px solid #ef6a26; color:#ff7a33; border-radius:3px; text-transform:uppercase; }
  #shop .sh-cat { font:700 13px/1 var(--body); color:#959ca6; letter-spacing:1.3px; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  #shop .sh-price { text-align:end; font:400 27px/1 'Bebas Neue', Impact, sans-serif; color:#ffb84d; letter-spacing:.6px; white-space:nowrap; }
  #shop .sh-price span { direction:ltr; unicode-bidi:isolate; font-variant-numeric:tabular-nums; }
  #shop .sh-row.own .sh-price { color:#ffd23f; }
  #shop .sh-row.poor .sh-price { color:#83766a; }
  #shop .sh-row.sel { background:#f4f1ea; color:#111214; }
  #shop .sh-row.sel .sh-cat { color:#4c525b; }
  #shop .sh-row.sel .sh-ic, #shop .sh-row.sel .sh-price { color:#111214; }
  #shop .sh-row.sel .sh-tick { color:#b07a00; }
  #shop .sh-row.sel.own .sh-price { color:#a26f00; }
  #shop .sh-row.sel.poor .sh-price { color:#c2381f; }
  #shop .sh-row.sel .sh-req { color:#d8480d; border-color:#d8480d; }
  #shop .sh-row.flash { animation:shrowflash .8s ease-out; }
  @keyframes shrowflash { 0% { background:#ffe07a; color:#111214; } 100% { } }
  #shop .sh-desc { display:flex; align-items:center; gap:12px; min-height:48px; padding:8px 18px; border-top:1px solid rgba(255,255,255,.08); background:rgba(0,0,0,.28); font:500 16px/1.3 var(--body); color:#d9d6cf; }
  #shop .sh-desc p { margin:0; flex:1; }
  #shop .sh-desc.warn p { color:#ff9a7a; font-weight:700; }
  #shop .sh-act { flex:none; display:flex; align-items:center; gap:6px; font:700 13px/1 var(--body); color:#b4b9c0; white-space:nowrap; }
  #shop kbd { display:inline-block; min-width:21px; padding:3px 6px 2px; margin:0 1px; border-radius:4px; background:#f4f1ea; color:#121316; font:800 12px/1 var(--body); text-align:center; box-shadow:0 2px 0 #8b8d90; direction:ltr; }
  #shop .sh-foot { display:flex; align-items:center; gap:14px; padding:9px 12px 10px 18px; background:rgba(0,0,0,.42); }
  [dir="rtl"] #shop .sh-foot { padding:9px 18px 10px 12px; }
  #shop .sh-keys { flex:1; font:600 13px/1.5 var(--body); color:#8f959d; }
  #shop .sh-co { all:unset; box-sizing:border-box; flex:none; display:flex; align-items:center; gap:10px; min-width:212px; padding:8px 18px 7px; border-radius:6px; background:#2e3136; color:#8d939b; cursor:pointer;
    box-shadow:inset 0 0 0 1px rgba(255,255,255,.08); transition:background .2s, color .2s, box-shadow .2s; }
  #shop .sh-co i { width:24px; height:24px; flex:none; }
  #shop .sh-co span { display:flex; flex-direction:column; gap:3px; }
  #shop .sh-co b { font:400 27px/1 'Bebas Neue', 'Secular One', Impact, sans-serif; letter-spacing:1px; }
  #shop .sh-co small { font:700 11px/1 var(--body); letter-spacing:.3px; opacity:.85; }
  #shop .sh-co.ok { background:linear-gradient(180deg,#ffe07a,#f2a81d); color:#17120a; box-shadow:0 0 0 2px rgba(255,210,63,.3), 0 6px 20px rgba(242,168,29,.35); animation:shpulse 1.8s ease-in-out infinite; }
  #shop .sh-co.sel { box-shadow:0 0 0 3px #fff, 0 0 22px rgba(255,255,255,.35); }
  #shop .sh-co.ok.sel { box-shadow:0 0 0 3px #fff, 0 6px 24px rgba(242,168,29,.55); }
  @keyframes shpulse { 50% { filter:brightness(1.12); } }
  /* the gold stamp */
  #shop .sh-stamp, #shop .sh-ring, #shop .sh-burst { position:absolute; z-index:3; left:50%; top:244px; pointer-events:none; }
  #shop .sh-stamp { display:flex; flex-direction:column; align-items:center; padding:13px 46px 11px; border-radius:15px; opacity:0; overflow:hidden; white-space:nowrap;
    background:linear-gradient(180deg,#ffdb73 0%,#f2b63a 52%,#dc9414 100%); color:#fff; transform:translate(-50%,-50%) rotate(-4deg);
    box-shadow:inset 0 0 0 3px rgba(255,246,206,.8), inset 0 0 0 8px rgba(176,108,0,.32), 0 12px 34px rgba(0,0,0,.5); }
  #shop .sh-stamp b { font:400 78px/1 'Bebas Neue', 'Secular One', Impact, sans-serif; letter-spacing:4px; text-shadow:0 3px 0 rgba(128,74,0,.6), 0 0 18px rgba(255,255,255,.25); }
  #shop .sh-stamp small { font:800 15px/1 var(--body); letter-spacing:1.5px; color:#5a3800; margin-top:3px; }
  #shop .sh-stamp small:empty { display:none; }
  #shop .sh-stamp::after { content:''; position:absolute; top:-20%; bottom:-20%; width:70px; left:-120px; background:linear-gradient(90deg,rgba(255,255,255,0),rgba(255,255,255,.75),rgba(255,255,255,0)); transform:skewX(-20deg); }
  #shop .sh-stamp.go { animation:shstamp 1.5s cubic-bezier(.2,.9,.25,1) forwards; }
  #shop .sh-stamp.go::after { animation:shshine .7s .22s ease-out forwards; }
  @keyframes shstamp { 0% { opacity:0; transform:translate(-50%,-50%) rotate(-14deg) scale(2.4); } 11% { opacity:1; transform:translate(-50%,-50%) rotate(-3deg) scale(.93); }
    17% { transform:translate(-50%,-50%) rotate(-4.5deg) scale(1.04); } 24% { transform:translate(-50%,-50%) rotate(-4deg) scale(1); } 80% { opacity:1; transform:translate(-50%,-50%) rotate(-4deg) scale(1); }
    100% { opacity:0; transform:translate(-50%,-58%) rotate(-4deg) scale(1.03); } }
  @keyframes shshine { from { left:-120px; } to { left:110%; } }
  #shop .sh-ring { width:200px; height:200px; margin:-100px 0 0 -100px; border-radius:50%; border:6px solid #ffd76a; opacity:0; }
  #shop .sh-ring.go { animation:shring .6s .08s ease-out forwards; }
  @keyframes shring { 0% { opacity:.9; transform:scale(.3); } 100% { opacity:0; transform:scale(3.2); border-width:1px; } }
  #shop .sh-burst { width:0; height:0; }
  #shop .sh-burst i { position:absolute; left:-5px; top:-5px; width:10px; height:10px; border-radius:2px; background:#ffd76a; opacity:0; }
  #shop .sh-burst.go i { animation:shspark .8s .07s cubic-bezier(.15,.8,.3,1) forwards; }
  @keyframes shspark { 0% { opacity:1; transform:rotate(var(--a)) translateX(30px) scale(1); } 100% { opacity:0; transform:rotate(var(--a)) translateX(var(--d)) scale(.3) rotate(160deg); } }
  /* crew speech bubble */
  #shop .sh-bub { position:absolute; z-index:2; left:0; top:0; max-width:310px; width:max-content; padding:8px 14px 9px; border-radius:13px; background:#f6f3ec; color:#141518; font:600 17px/1.28 var(--body); text-align:start;
    box-shadow:0 10px 26px rgba(0,0,0,.45); border-bottom:4px solid var(--ac,#ffd23f); opacity:0; transition:opacity .25s; will-change:transform; }
  #shop .sh-bub b { display:block; font:800 12px/1 var(--body); color:var(--acd,#a87500); letter-spacing:1px; text-transform:uppercase; margin-bottom:4px; }
  #shop .sh-bub::after { content:''; position:absolute; left:calc(50% + var(--tail,0px)); bottom:-13px; margin-left:-9px; border:9px solid transparent; border-top-color:var(--ac,#ffd23f); border-bottom:0; }
  #shop .sh-bub.show { opacity:1; }
  #shop .sh-bub.pop span { display:inline-block; animation:shpop .32s cubic-bezier(.2,1.7,.4,1); }
  @keyframes shpop { from { transform:scale(.6); opacity:0; } to { transform:none; opacity:1; } }
  /* the street HUD bits that would clutter the store (money/objective/radar/help/touch sticks) */
  #hhud.sh-on .hh-obj, #hhud.sh-on .hh-tr, #hhud.sh-on .hh-help, #hhud.sh-on .hh-prompt, #hhud.sh-on .hh-bl, #hhud.sh-on .hh-speed, #hhud.sh-on canvas.hh-touch { visibility:hidden !important; }
  /* touch: bigger targets */
  #shop.sh-touch .sh-row { height:46px; }
  #shop.sh-touch .sh-act { display:none; }
  /* phones (#stage.compact): a side sheet on the reading-start side (right in Hebrew), the crew framed in the other half */
  #stage.compact #shop .sh-panel { left:auto; right:14px; margin-left:0; width:624px; bottom:14px; border-radius:8px; }
  #stage.compact #shop[dir="ltr"] .sh-panel { right:auto; left:14px; }
  #stage.compact #shop .sh-head { padding:9px 20px 8px 14px; }
  [dir="rtl"] #stage.compact #shop .sh-head { padding:9px 14px 8px 20px; }
  #stage.compact #shop .sh-shield { width:46px !important; height:50px !important; }
  #stage.compact #shop .sh-brand { font-size:42px; }
  #stage.compact #shop .sh-sub, #stage.compact #shop .sh-cols, #stage.compact #shop .sh-cat { display:none; }
  #stage.compact #shop .sh-cash small { font-size:16px; }
  #stage.compact #shop .sh-cash b { font-size:52px; }
  #stage.compact #shop .sh-row { height:64px; grid-template-columns:1fr 128px; padding:0 18px; font-size:23px; }
  #stage.compact #shop .sh-name { gap:8px; }
  #stage.compact #shop .sh-ic { width:34px; height:34px; }
  #stage.compact #shop .sh-tick { width:26px; height:26px; }
  #stage.compact #shop .sh-req { font-size:12px; letter-spacing:.5px; padding:4px 6px 3px; }
  #stage.compact #shop .sh-price { font-size:38px; }
  #stage.compact #shop .sh-desc { min-height:76px; padding:8px 20px; font-size:21px; line-height:1.25; }
  #stage.compact #shop .sh-foot { padding:10px 12px 12px 20px; }
  [dir="rtl"] #stage.compact #shop .sh-foot { padding:10px 20px 12px 12px; }
  #stage.compact #shop .sh-keys { font-size:17px; line-height:1.3; }
  #stage.compact #shop .sh-co { min-width:270px; padding:10px 20px 9px; border-radius:9px; }
  #stage.compact #shop .sh-co b { font-size:38px; }
  #stage.compact #shop .sh-co small { font-size:15px; }
  #stage.compact #shop .sh-co i { width:32px; height:32px; }
  #stage.compact #shop .sh-stamp, #stage.compact #shop .sh-ring, #stage.compact #shop .sh-burst { top:350px; left:324px; }
  #stage.compact #shop[dir="ltr"] .sh-stamp, #stage.compact #shop[dir="ltr"] .sh-ring, #stage.compact #shop[dir="ltr"] .sh-burst { left:956px; }
  #stage.compact #shop .sh-stamp b { font-size:92px; }
  #stage.compact #shop .sh-stamp small { font-size:19px; }
  #stage.compact #shop .sh-bub { max-width:400px; font-size:24px; padding:10px 18px 11px; }
  #stage.compact #shop .sh-bub b { font-size:16px; }
  #stage.compact #shop .sh-delta { font-size:40px; }
  `;

  /* ================= small helpers ================= */
  let T = null; // THREE of the running session
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = u => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
  const easeIO = u => (u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);
  const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
  function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let q = s; q = Math.imul(q ^ (q >>> 15), q | 1); q ^= q + Math.imul(q ^ (q >>> 7), q | 61); return ((q ^ (q >>> 14)) >>> 0) / 4294967296; }; }
  const isTouch = () => typeof Input !== 'undefined' && !!Input.touchMode; // Input is a top-level const (not on window)
  function sfx(name, o) { if (window.HAudio && HAudio.sfx) { try { HAudio.sfx(name, o); } catch (e) { /* audio is optional */ } } }
  function lin(hex) { return new T.Color(hex).convertSRGBToLinear(); }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  // non-indexed copy with a flat linear vertex colour
  function paint(g, hex) {
    if (g.index) { const n = g.toNonIndexed(); g.dispose(); g = n; }
    const n = g.attributes.position.count, c = lin(hex), a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new T.BufferAttribute(a, 3));
    return g;
  }
  function place(g, x, y, z, rx, ry, rz, s) {
    const m = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(rx || 0, ry || 0, rz || 0));
    m.compose(new T.Vector3(x || 0, y || 0, z || 0), q, s && typeof s === 'object' ? s : new T.Vector3(s || 1, s || 1, s || 1));
    g.applyMatrix4(m); return g;
  }
  function merge(list) {
    list = list.map(g => { if (!g.index) return g; const ng = g.toNonIndexed(); g.dispose(); return ng; });
    let n = 0; for (const g of list) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), col = new Float32Array(n * 3);
    let o = 0;
    for (const g of list) {
      const c = g.attributes.position.count;
      if (!g.attributes.normal) g.computeVertexNormals();
      pos.set(g.attributes.position.array.subarray(0, c * 3), o * 3);
      nor.set(g.attributes.normal.array.subarray(0, c * 3), o * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, c * 2), o * 2);
      if (g.attributes.color) col.set(g.attributes.color.array.subarray(0, c * 3), o * 3); else col.fill(1, o * 3, (o + c) * 3);
      o += c; g.dispose();
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    out.setAttribute('uv', new T.BufferAttribute(uv, 2)); out.setAttribute('color', new T.BufferAttribute(col, 3));
    out.computeBoundingSphere(); out.computeBoundingBox();
    return out;
  }
  // a plane whose uvs repeat every tw x th metres (one shared tiling material for every wall)
  function tiledPlane(w, h, tw, th) { const g = new T.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / tw, uv.getY(i) * h / th); return g; }
  // a plane mapped to a pixel rect of an atlas (W x H px)
  function atlasPlane(w, h, r, W, Hh) { const g = new T.PlaneGeometry(w, h); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, (r[0] + uv.getX(i) * (r[2] - r[0])) / W, 1 - (r[3] - uv.getY(i) * (r[3] - r[1])) / Hh); return g; }

  /* ================= procedural weapon silhouettes (original outlines, muzzle toward +x) ================= */
  const R4 = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const BLK = 0x17181b, DGR = 0x26282c, MAG = 0x1f2023, TAN = 0xa88a62, TAN2 = 0x8f7552, WOOD = 0x6e4426, STEEL = 0x55595f;
  const GUNS = {
    // carbine parts: 0 stock, 1 buffer tube, 2 receiver, 3 rail, 4 handguard, 5 barrel, 6 front sight, 7 magazine, 8 grip, 9 trigger guard
    carbine: { d: 0.045, parts: [
      [[[0, -0.075], [0.035, -0.078], [0.2, -0.022], [0.2, 0.03], [0, 0.045]], BLK], [R4(0.18, -0.006, 0.27, 0.03), DGR],
      [R4(0.25, -0.035, 0.52, 0.046), BLK], [R4(0.27, 0.046, 0.5, 0.063), DGR], [[[0.52, -0.025], [0.79, -0.02], [0.79, 0.04], [0.52, 0.046]], DGR],
      [R4(0.79, 0.004, 0.89, 0.02), BLK], [[[0.745, 0.04], [0.76, 0.04], [0.765, 0.088], [0.752, 0.088]], BLK],
      [[[0.405, -0.035], [0.455, -0.035], [0.495, -0.175], [0.448, -0.186]], MAG], [[[0.3, -0.035], [0.346, -0.035], [0.326, -0.132], [0.284, -0.126]], BLK],
      [R4(0.33, -0.052, 0.405, -0.044), BLK]] },
    carbineO: { base: 'carbine', extra: [[R4(0.33, 0.063, 0.44, 0.104), BLK], [R4(0.35, 0.071, 0.42, 0.097), 0x2d3e4a]] },
    carbineT: { base: 'carbine', recolor: { 0: TAN, 4: TAN2, 7: TAN, 8: TAN } },
    // shotgun parts: 0 stock, 1 receiver, 2 barrel, 3 magazine tube, 4 pump, 5 trigger guard, 6 bead
    shotgun: { d: 0.045, parts: [
      [[[0, -0.07], [0.04, -0.076], [0.27, -0.03], [0.3, -0.004], [0.3, 0.032], [0, 0.038]], BLK], [R4(0.28, -0.03, 0.47, 0.042), DGR],
      [R4(0.47, 0.012, 0.99, 0.034), BLK], [R4(0.47, -0.013, 0.89, 0.009), BLK], [[[0.57, -0.033], [0.77, -0.033], [0.78, 0.016], [0.56, 0.016]], DGR],
      [R4(0.32, -0.045, 0.39, -0.037), BLK], [R4(0.975, 0.034, 0.985, 0.046), STEEL]] },
    shotgunW: { base: 'shotgun', recolor: { 0: WOOD, 4: WOOD } },
    sniper: { d: 0.045, parts: [
      [[[0, -0.082], [0.03, -0.088], [0.17, -0.052], [0.25, -0.065], [0.32, -0.022], [0.32, 0.03], [0.12, 0.05], [0, 0.044]], DGR],
      [R4(0.3, -0.026, 0.6, 0.041), BLK], [[[0.6, 0.0], [1.13, 0.006], [1.13, 0.021], [0.6, 0.031]], BLK],
      [[[0.31, -0.026], [0.35, -0.026], [0.338, -0.112], [0.3, -0.106]], BLK], [R4(0.42, -0.08, 0.47, -0.026), MAG],
      [R4(0.4, 0.041, 0.415, 0.068), BLK], [R4(0.53, 0.041, 0.545, 0.068), BLK],
      [[[0.66, -0.004], [0.675, -0.004], [0.64, -0.14], [0.626, -0.14]], DGR], [[[0.675, -0.004], [0.69, -0.004], [0.72, -0.14], [0.706, -0.14]], DGR]],
      cyl: [[0.36, 0.6, 0.087, 0.021, BLK], [0.33, 0.37, 0.087, 0.03, BLK], [0.57, 0.62, 0.087, 0.033, BLK]] },
    smg: { d: 0.042, parts: [
      [R4(0.1, -0.022, 0.41, 0.056), BLK], [R4(0.41, 0.006, 0.5, 0.034), DGR], [R4(0, 0.03, 0.11, 0.044), DGR], [R4(0, -0.062, 0.013, 0.044), DGR], [R4(0, -0.062, 0.11, -0.049), DGR],
      [[[0.16, -0.022], [0.2, -0.022], [0.186, -0.112], [0.15, -0.106]], BLK], [[[0.28, -0.022], [0.316, -0.022], [0.33, -0.172], [0.294, -0.174]], MAG],
      [R4(0.14, 0.056, 0.37, 0.07), DGR]] },
    pistol: { d: 0.03, parts: [
      [R4(0, 0.02, 0.19, 0.056), BLK], [R4(0, -0.002, 0.172, 0.024), DGR], [[[0.004, 0.0], [0.054, 0.0], [0.04, -0.1], [-0.01, -0.094]], BLK], [R4(0.054, -0.024, 0.094, -0.016), BLK]] },
  };
  function gunTemplate(key, cache) {
    if (cache[key]) return cache[key];
    const def = GUNS[key], b = def.base ? GUNS[def.base] : def, d = b.d, cyl = b.cyl || [];
    const parts = b.parts.map(([pts, col], i) => [pts, def.recolor && def.recolor[i] !== undefined ? def.recolor[i] : col]).concat(def.extra || []);
    const list = []; let x0 = 1e9, x1 = -1e9;
    for (const [pts, col] of parts) {
      const s = new T.Shape(); s.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) s.lineTo(pts[i][0], pts[i][1]); s.closePath();
      const g = new T.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.003, bevelSegments: 1, curveSegments: 4, steps: 1 });
      g.translate(0, 0, -d / 2); list.push(paint(g, col));
      for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); }
    }
    for (const [a, c, y, r, col] of cyl) { const g = new T.CylinderGeometry(r, r, c - a, 12, 1); g.rotateZ(Math.PI / 2); g.translate((a + c) / 2, y, 0); list.push(paint(g, col)); }
    const geo = merge(list); geo.translate(-(x0 + x1) / 2, 0, 0);
    return (cache[key] = { geo, L: x1 - x0 });
  }

  /* ================= textures ================= */
  function drawShield(x, cx, cy, s, fill, ring, cross) { // the store emblem (same as the sign outside)
    x.save(); x.translate(cx, cy); x.scale(s, s);
    x.beginPath(); x.moveTo(-50, -56); x.lineTo(50, -56); x.lineTo(50, 2); x.quadraticCurveTo(48, 42, 0, 64); x.quadraticCurveTo(-48, 42, -50, 2); x.closePath();
    x.fillStyle = fill; x.fill(); x.lineWidth = 7; x.strokeStyle = ring; x.stroke();
    x.strokeStyle = cross; x.lineWidth = 6; x.beginPath(); x.arc(0, 2, 26, 0, Math.PI * 2); x.stroke();
    x.lineWidth = 5; x.beginPath(); x.moveTo(0, -36); x.lineTo(0, -10); x.moveTo(0, 14); x.lineTo(0, 40); x.moveTo(-38, 2); x.lineTo(-12, 2); x.moveTo(12, 2); x.lineTo(38, 2); x.stroke();
    x.fillStyle = cross; x.beginPath(); x.arc(0, 2, 4.5, 0, Math.PI * 2); x.fill();
    x.restore();
  }
  const SIGN_FONT = '"Bebas Neue", Impact, "Arial Narrow", sans-serif';
  function slatCanvas() { // light grey slat wall, 1 x 1 m per tile, 16 slats
    const [c, x] = canvas(512, 512), R = rng(9);
    x.fillStyle = '#c3c4c0'; x.fillRect(0, 0, 512, 512);
    for (let k = 0; k < 16; k++) {
      const y = k * 32, g = x.createLinearGradient(0, y, 0, y + 32);
      g.addColorStop(0, '#cbccc8'); g.addColorStop(0.5, '#bfc0bc'); g.addColorStop(1, '#b0b1ad');
      x.fillStyle = g; x.fillRect(0, y, 512, 32);
      x.fillStyle = '#5d605f'; x.fillRect(0, y, 512, 5); x.fillStyle = '#3f4241'; x.fillRect(0, y + 1, 512, 2);
      x.fillStyle = 'rgba(255,255,255,.55)'; x.fillRect(0, y + 5, 512, 1.5);
    }
    for (let k = 0; k < 2200; k++) { x.fillStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,255,255'},${R() * 0.05})`; x.fillRect(R() * 512, R() * 512, 1 + R() * 3, 1); }
    return c;
  }
  function floorCanvas() { // 2 x 2 big stone tiles (1.2 m)
    const [c, x] = canvas(512, 512), R = rng(21);
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
      const l = 196 + Math.floor(R() * 14); x.fillStyle = `rgb(${l},${l - 4},${l - 11})`; x.fillRect(i * 256, j * 256, 256, 256);
      for (let k = 0; k < 140; k++) { x.fillStyle = `rgba(${R() < 0.5 ? '90,80,70' : '255,250,240'},${R() * 0.07})`; const r = 4 + R() * 26; x.beginPath(); x.arc(i * 256 + R() * 256, j * 256 + R() * 256, r, 0, 7); x.fill(); }
    }
    x.fillStyle = '#7d786f'; for (const p of [0, 256]) { x.fillRect(p, 0, 3, 512); x.fillRect(0, p, 512, 3); }
    return c;
  }
  function bannerCanvas() { // lightbox header: emblem + IRONSIDE ARMORY + orange rule
    const W = 1024, H = 128, [c, x] = canvas(W, H);
    const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#22262b'); g.addColorStop(1, '#0d0f11');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = '#3c4249'; x.lineWidth = 2; x.strokeRect(3, 3, W - 6, H - 6);
    drawShield(x, 74, 62, 0.86, '#16191d', '#c9ced4', '#e8581c');
    let s = 78; x.font = `400 ${s}px ${SIGN_FONT}`;
    const t1 = 'IRONSIDE', t2 = 'ARMORY', gap = 22;
    while (x.measureText(t1).width + x.measureText(t2).width + gap > W - 230 && s > 30) { s -= 2; x.font = `400 ${s}px ${SIGN_FONT}`; }
    const w1 = x.measureText(t1).width, w2 = x.measureText(t2).width, x0 = 140 + (W - 160 - (w1 + w2 + gap)) / 2;
    x.textBaseline = 'middle'; x.textAlign = 'left';
    x.fillStyle = 'rgba(0,0,0,.6)'; x.fillText(t1, x0 + 3, 54); x.fillText(t2, x0 + w1 + gap + 3, 54);
    x.fillStyle = '#f4f1ea'; x.fillText(t1, x0, 51); x.fillStyle = '#ef6a26'; x.fillText(t2, x0 + w1 + gap, 51);
    x.fillStyle = '#e8581c'; x.fillRect(140, 100, W - 160, 5);
    x.font = '700 15px Rubik, Arial, sans-serif'; x.textAlign = 'center';
    const sub = 'FIREARMS  ·  AMMUNITION  ·  TACTICAL  ·  RANGE', sw = x.measureText(sub).width + 30, sx = 140 + (W - 160) / 2;
    x.fillStyle = '#121417'; x.fillRect(sx - sw / 2, 94, sw, 17); x.fillStyle = '#b5bac1'; x.fillText(sub, sx, 103);
    return c;
  }
  const PA = { sale: [0, 0, 256, 352], disc: [256, 0, 512, 256], ammo: [256, 256, 512, 384], range: [0, 352, 256, 512], card: [256, 384, 512, 512] };
  function posterCanvas() { // small signage atlas (all made-up text)
    const [c, x] = canvas(512, 512);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillStyle = '#f2efe6'; x.fillRect(0, 0, 256, 352); x.fillStyle = '#c8102e'; x.fillRect(0, 0, 256, 92);
    x.fillStyle = '#fff'; x.font = `400 88px ${SIGN_FONT}`; x.fillText('SALE', 128, 50);
    x.fillStyle = '#c8102e'; x.font = `400 132px ${SIGN_FONT}`; x.fillText('-25%', 128, 168);
    x.fillStyle = '#111'; x.font = '900 26px Rubik, Arial, sans-serif'; x.fillText('ALL OPTICS', 128, 252); x.fillText('THIS WEEK', 128, 284);
    x.fillStyle = '#777'; x.font = '700 15px Rubik, Arial, sans-serif'; x.fillText('IRONSIDE ARMORY', 128, 330);
    x.fillStyle = '#b3121f'; x.beginPath(); x.arc(384, 128, 118, 0, 7); x.fill(); x.lineWidth = 10; x.strokeStyle = '#f4f1ea'; x.stroke();
    drawShield(x, 384, 122, 1.25, '#b3121f', '#f4f1ea', '#f4f1ea');
    x.fillStyle = '#ffd23f'; x.fillRect(256, 256, 256, 128); x.fillStyle = '#111'; x.fillRect(264, 264, 240, 112); x.fillStyle = '#ffd23f'; x.font = `400 84px ${SIGN_FONT}`; x.fillText('AMMO', 384, 312);
    x.font = '800 14px Rubik, Arial, sans-serif'; x.fillText('ALL CALIBERS · AISLE 2', 384, 356);
    x.fillStyle = '#0f6b3a'; x.fillRect(0, 352, 256, 160); x.strokeStyle = '#f4f1ea'; x.lineWidth = 6; x.strokeRect(8, 360, 240, 144);
    x.fillStyle = '#f4f1ea'; x.font = `400 64px ${SIGN_FONT}`; x.fillText('RANGE', 128, 410); x.font = `400 44px ${SIGN_FONT}`; x.fillText('OPEN TODAY', 128, 462);
    x.fillStyle = '#fbfaf6'; x.fillRect(256, 384, 256, 128); x.fillStyle = '#c8102e'; x.fillRect(256, 384, 256, 26);
    x.fillStyle = '#111'; x.font = `400 70px ${SIGN_FONT}`; x.fillText('$ 1,299', 384, 462);
    return c;
  }
  function screenDraw(x, n) { // the register's display (faces the clerk = the camera)
    x.fillStyle = '#04140b'; x.fillRect(0, 0, 256, 96);
    x.fillStyle = 'rgba(80,255,150,.07)'; for (let y = 0; y < 96; y += 3) x.fillRect(0, y, 256, 1);
    x.fillStyle = '#56f59a'; x.font = '700 16px "JetBrains Mono", monospace'; x.textAlign = 'left'; x.textBaseline = 'top'; x.fillText('IRONSIDE  POS-1', 12, 10);
    x.font = '700 44px "JetBrains Mono", monospace'; x.textAlign = 'right'; x.textBaseline = 'alphabetic'; x.fillText(money(n), 246, 80);
  }

  /* ================= module ================= */
  const S = {
    active: false, H: null, ITEMS, BUDGET, ICONS,
    text, itemName(id) { const it = ITEMS.find(i => i.id === id) || (S.items || []).find(i => i.id === id); return it ? text(it.name) : String(id); },

    open(H, opts) {
      opts = opts || {};
      if (S.active) S.close(true);
      const items = (opts.items && opts.items.length ? opts.items : ITEMS).slice();
      const budget = opts.budget !== undefined ? opts.budget : BUDGET;
      const settle = () => { const req = items.filter(i => i.required), spent = req.reduce((s, i) => s + i.price, 0); if (opts.onDone) opts.onDone({ bought: req.map(i => i.id), spent, left: budget - spent }); };
      if (!H || !H.T || !H.renderer || !H.active) { settle(); return false; } // no engine: settle at once (required items only)
      T = H.T; S.H = H; S.items = items; S.budget = budget; S.onDone = opts.onDone || null;
      S.owned = new Set((opts.owned || []).filter(id => items.some(i => i.id === id)));
      S.res = []; S.sel = 0; S.time = 0; S.phase = 'intro'; S.phaseT = 0; S.introT = 0; S.msg = null; S.allReqSaid = false; S.greeted = false; S.faded = false; S.timers = [];
      S.lastToggle = { i: -1, t: -9 }; S.oy = 0; S.op = 0; S.orbitT = 0; S.par = { x: 0, y: 0, tx: 0, ty: 0 }; S.punch = 0; S.shake = 0; S.drawerT = -9;
      S.bub = { who: null, until: 0 }; S.shown = null; S.introLen = opts.intro === false ? 0 : 2.3;
      try { S.buildScene(); S.buildDom(); }
      catch (e) { console.error(e); S.teardown(); settle(); return false; }
      S.active = true;
      H.timeScale = 1; H.desat = 0;
      S.interior = { scene: S.scene, update: dt => S.update(dt), camera: (dt, cam, mouse) => S.camera(dt, cam, mouse), touchButtons: () => [], grade: 0.06, bloomTh: 2.6 };
      H.interior = S.interior; H.state = 'interior';
      if (HHud.ready) { HHud.prompt(); HHud.help(''); HHud.fade(0, 0.45); if (HHud.el) HHud.el.classList.add('sh-on'); }
      sfx('door', { open: true }); S.later(0.15, () => sfx('coin', { vol: 1.4 })); // the shop-door bell
      if (S.introLen === 0) S.skipIntro();
      return true;
    },

    left() { let s = 0; for (const it of S.items || []) if (S.owned && S.owned.has(it.id)) s += it.price; return (S.budget || 0) - s; },
    spent() { return (S.budget || 0) - S.left(); },
    result() { return { bought: (S.items || []).filter(i => S.owned && S.owned.has(i.id)).map(i => i.id), spent: S.spent(), left: S.left() }; },
    reqMissing() { return (S.items || []).filter(i => i.required && !S.owned.has(i.id)).length; },
    canCheckout() { const req = S.items.filter(i => i.required).reduce((s, i) => s + i.price, 0); return S.reqMissing() === 0 || req > S.budget; },

    skipIntro() { if (!S.active || S.phase !== 'intro') return; S.introT = Math.max(S.introT, S.introLen); S.showPanel(); },

    close(silent) {
      if (!S.active && !S.root && !S.scene) return;
      const cb = S.onDone, res = S.active ? S.result() : null;
      S.teardown();
      if (!silent && res) { if (window.HHud && HHud.ready) HHud.fade(0, 0.3); if (cb) { try { cb(res); } catch (e) { console.error(e); } } }
    },

    /* ---------- the store ---------- */
    buildScene() {
      const H = S.H, scene = new T.Scene(), own = o => { S.res.push(o); return o; };
      S.scene = scene; scene.name = 'ironside-armory';
      scene.background = new T.Color(0x0b0c0e);
      S.env = S.makeEnv(); // reflections: a tiny bright room with ceiling strips -> PMREM (glass, chrome, floor)
      const M = S.mats = {
        paint: own(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0.02, envMap: S.env, envMapIntensity: 0.25 })),
        gun: own(new T.MeshLambertMaterial({ vertexColors: true })), // flat silhouettes facing a camera-side key light: any specular lobe greys them out
        chrome: own(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.9, envMap: S.env, envMapIntensity: 1.2 })),
        wood: own(new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.0, envMap: S.env, envMapIntensity: 0.45 })),
        felt: own(new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x3a0c10 })),
      };
      const texOf = (cv, rep) => { const tx = own(new T.CanvasTexture(cv)); tx.encoding = T.sRGBEncoding; tx.anisotropy = Math.min(8, H.renderer.capabilities.getMaxAnisotropy()); if (rep) tx.wrapS = tx.wrapT = T.RepeatWrapping; return tx; };
      M.slat = own(new T.MeshStandardMaterial({ map: texOf(slatCanvas(), true), roughness: 0.58, metalness: 0.0, envMap: S.env, envMapIntensity: 0.2 }));
      M.floor = own(new T.MeshStandardMaterial({ map: texOf(floorCanvas(), true), roughness: 0.3, metalness: 0.0, envMap: S.env, envMapIntensity: 0.55 }));
      const ban = texOf(bannerCanvas());
      M.banner = own(new T.MeshStandardMaterial({ map: ban, emissiveMap: ban, emissive: 0xffffff, emissiveIntensity: 0.4, roughness: 0.5, metalness: 0.0 }));
      M.poster = own(new T.MeshStandardMaterial({ map: texOf(posterCanvas()), roughness: 0.62, metalness: 0.0 }));
      M.glass = own(new T.MeshStandardMaterial({ color: 0x101618, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.2, envMap: S.env, envMapIntensity: 1.2, depthWrite: false, side: T.DoubleSide }));
      M.lamp = own(new T.MeshBasicMaterial({ color: new T.Color(3.5, 3.55, 3.75) })); M.lamp.userData.lin = true;
      M.led = own(new T.MeshBasicMaterial({ color: new T.Color(4.2, 3.6, 2.8) })); M.led.userData.lin = true;
      const [sc, sx] = canvas(256, 96); S.screenX = sx; screenDraw(sx, S.left());
      S.screenTex = texOf(sc); M.screen = own(new T.MeshBasicMaterial({ map: S.screenTex, toneMapped: false }));
      const acc = {}; const add = (k, g) => { (acc[k] || (acc[k] = [])).push(g); return g; };
      const box = (k, w, h, d, x, y, z, col, ry, rx, rz) => add(k, place(paint(new T.BoxGeometry(w, h, d), col), x, y, z, rx, ry, rz));
      const cyl = (k, r0, r1, h, x, y, z, col, seg, rx, ry, rz) => add(k, place(paint(new T.CylinderGeometry(r0, r1, h, seg || 12), col), x, y, z, rx, ry, rz));
      const WZ = -2.2, CEIL = 3.12, XW = 5.6, ZF = 8.2, HW = 2.08, LEDGE = 0.98; // back wall plane, ceiling, half width, front, slat top, ledge
      const mk = (geo, mat, x, y, z, rx, ry) => { const m = new T.Mesh(own(geo), mat); m.position.set(x, y, z); m.rotation.set(rx || 0, ry || 0, 0); scene.add(m); return m; };
      // ---- shell: back + side slat walls, header fascia, ceiling, floor
      mk(tiledPlane(XW * 2, HW, 1, 1), M.slat, 0, HW / 2, WZ);
      mk(tiledPlane(ZF - WZ, HW, 1, 1), M.slat, -XW, HW / 2, (ZF + WZ) / 2, 0, Math.PI / 2);
      mk(tiledPlane(ZF - WZ, HW, 1, 1), M.slat, XW, HW / 2, (ZF + WZ) / 2, 0, -Math.PI / 2);
      mk(tiledPlane(XW * 2, ZF - WZ, 1.2, 1.2), M.floor, 0, 0, (ZF + WZ) / 2, -Math.PI / 2);
      box('paint', XW * 2, CEIL - HW, 0.06, 0, (CEIL + HW) / 2, WZ + 0.03, 0x24272b);                       // fascia behind the banners
      for (const sd of [-1, 1]) box('paint', 0.06, CEIL - HW, ZF - WZ, sd * (XW - 0.03), (CEIL + HW) / 2, (ZF + WZ) / 2, 0x24272b);
      box('paint', XW * 2, 0.04, ZF - WZ, 0, CEIL + 0.02, (ZF + WZ) / 2, 0x1d1f22);                         // ceiling
      box('paint', XW * 2, 0.03, 0.05, 0, HW, WZ + 0.03, 0x7d838a);                                          // trim between slats and fascia
      box('paint', XW * 2, 0.1, 0.03, 0, 0.05, WZ + 0.015, 0x17181b);                                        // skirting
      for (const sd of [-1, 1]) { box('paint', 0.05, 0.03, ZF - WZ, sd * (XW - 0.03), HW, (ZF + WZ) / 2, 0x7d838a); box('paint', 0.03, 0.1, ZF - WZ, sd * (XW - 0.015), 0.05, (ZF + WZ) / 2, 0x17181b); }
      for (const lx of [-3.6, -1.2, 1.2, 3.6]) for (const lz of [-1.3, 0.9, 3.1, 5.3]) { // ceiling lamp panels
        box('paint', 1.5, 0.03, 0.42, lx, CEIL - 0.005, lz, 0xc9ccd0);
        add('lamp', place(new T.BoxGeometry(1.4, 0.03, 0.32), lx, CEIL - 0.02, lz));
      }
      // ---- pillars split the back wall into three bays (like the video), each with a lit header banner
      const PIL = [-5.1, -1.7, 1.7, 5.1];
      for (const px of PIL) {
        box('paint', 0.36, CEIL, 0.22, px, CEIL / 2, WZ + 0.11, 0x2f3338);
        for (const s of [-1, 1]) box('chrome', 0.018, CEIL, 0.018, px + s * 0.171, CEIL / 2, WZ + 0.221, 0x5b6168);
      }
      for (const bx of [-3.4, 0, 3.4]) {
        box('paint', 2.98, 0.44, 0.07, bx, 2.31, WZ + 0.035, 0x0b0c0e);
        mk(new T.PlaneGeometry(2.9, 0.3625), M.banner, bx, 2.31, WZ + 0.072);
      }
      // ---- ledge + cabinets under the weapons
      box('wood', XW * 2 - 0.1, 0.045, 0.3, 0, LEDGE, WZ + 0.15, 0xc3a074);
      box('paint', XW * 2 - 0.1, LEDGE - 0.02, 0.32, 0, (LEDGE - 0.02) / 2, WZ + 0.16, 0x25282d);
      for (let cx = -5.4; cx <= 5.41; cx += 0.6) { box('paint', 0.012, LEDGE - 0.18, 0.006, cx, LEDGE / 2, WZ + 0.322, 0x111215); box('chrome', 0.02, 0.12, 0.02, cx + 0.08, LEDGE - 0.26, WZ + 0.335, 0x9aa0a6); }
      const R = rng(1234), BOXC = [0xb8352a, 0x3d6e3a, 0xd9a21a, 0x2f5a8a, 0xe9e5da, 0x1d1e21, 0xc96a1c];
      for (let x = -5.3; x < 5.3; x += 0.2 + R() * 0.12) { // ammo boxes on the ledge
        if (PIL.some(p => Math.abs(p - x) < 0.32) || (x > -4.8 && x < -3.6) || R() < 0.25) continue;
        const n = 1 + Math.floor(R() * 3), col = BOXC[Math.floor(R() * BOXC.length)], w = 0.12 + R() * 0.08, d = 0.1 + R() * 0.06, hh = 0.06 + R() * 0.05;
        for (let k = 0; k < n; k++) box('paint', w, hh, d, x, LEDGE + 0.0225 + hh / 2 + k * hh, WZ + 0.14, col, (R() - 0.5) * 0.2);
      }
      for (const hx of [-4.55, -4.2, -3.85]) { // mannequin heads wearing balaclavas: the job's dress code
        const y0 = LEDGE + 0.0225;
        cyl('chrome', 0.06, 0.07, 0.02, hx, y0 + 0.01, WZ + 0.15, 0x6d7278);
        cyl('paint', 0.012, 0.012, 0.12, hx, y0 + 0.08, WZ + 0.15, 0x3a3d42, 8);
        cyl('paint', 0.045, 0.05, 0.1, hx, y0 + 0.18, WZ + 0.15, 0x121214);
        add('paint', place(paint(new T.SphereGeometry(0.1, 14, 10), 0x141416), hx, y0 + 0.33, WZ + 0.15, 0, 0, 0, new T.Vector3(0.95, 1.2, 1.05)));
        box('paint', 0.11, 0.026, 0.02, hx, y0 + 0.355, WZ + 0.25, 0xc99a78);
        box('paint', 0.045, 0.018, 0.02, hx, y0 + 0.265, WZ + 0.248, 0x2a1a16);
      }
      // ---- the weapon wall
      const tmpl = {};
      const hang = (key, cx, cy) => {
        const tp = gunTemplate(key, tmpl), g = tp.geo.clone();
        add('gun', place(g, cx, cy, WZ + 0.055));
        for (const f of [-0.28, 0.26]) box('chrome', 0.016, 0.05, 0.07, cx + f * tp.L, cy - 0.05, WZ + 0.035, 0x6c7076);
        if (R() < 0.75) box('paint', 0.07, 0.034, 0.004, cx + (R() - 0.5) * tp.L * 0.4, cy - 0.125, WZ + 0.003, 0xf2f0ea);
      };
      const row = (bx, y, keys) => {
        const Ls = keys.map(k => (k === 'vest' ? 0.42 : gunTemplate(k, tmpl).L)), tot = Ls.reduce((a, b) => a + b, 0), gap = (2.86 - tot) / (keys.length + 1);
        let x = bx - 1.43 + gap;
        keys.forEach((k, i) => { const cx = x + Ls[i] / 2; if (k === 'vest') S.vest(box, cx, y - 0.06, WZ); else hang(k, cx, y); x += Ls[i] + gap; });
      };
      const Y3 = [1.88, 1.575, 1.27];
      row(0, Y3[0], ['sniper', 'carbineO']); row(0, Y3[1], ['shotgun', 'carbine', 'smg']); row(0, Y3[2], ['carbineT', 'shotgunW']);
      row(-3.4, Y3[0], ['carbine', 'shotgunW']); row(-3.4, Y3[1], ['carbineO', 'smg', 'pistol']); hang('carbineT', -2.45, Y3[2]);
      row(3.4, Y3[0], ['shotgun', 'carbineT']); row(3.4, 1.42, ['vest', 'vest', 'smg']);
      for (const sd of [-1, 1]) for (let k = 0; k < 9; k++) { // side walls: long guns standing in racks
        const z = -1.2 + k * 0.42, key = ['carbine', 'shotgun', 'carbineO', 'shotgunW', 'sniper', 'carbineT'][k % 6], g = gunTemplate(key, tmpl).geo.clone();
        add('gun', place(g, sd * (XW - 0.07), 1.3, z, 0, -sd * Math.PI / 2, Math.PI / 2));
      }
      for (const sd of [-1, 1]) { box('wood', 0.22, 0.04, 4.1, sd * (XW - 0.12), 0.7, 0.5, 0xc3a074); box('paint', 0.06, 0.05, 4.1, sd * (XW - 0.04), 1.95, 0.5, 0x2f3338); }
      // ---- the counter: dark base, glass display with lit red felt, chrome frame
      const CX = 2.8, CZ0 = 0.48, CZ1 = 1.06, TOP = 0.985;
      box('paint', CX * 2, 0.44, CZ1 - CZ0, 0, 0.22, (CZ0 + CZ1) / 2, 0x1b1d21);
      box('paint', CX * 2 - 0.02, 0.05, 0.02, 0, 0.03, CZ1 + 0.005, 0x0e0f11);
      box('paint', CX * 2, TOP - 0.44, 0.03, 0, (TOP + 0.44) / 2, CZ0 + 0.015, 0x22252a);
      box('felt', CX * 2 - 0.04, 0.02, CZ1 - CZ0 - 0.04, 0, 0.45, (CZ0 + CZ1) / 2, 0x7a1f27); // red felt, lit by the case's LED strip
      for (const zz of [CZ0, CZ1]) { box('chrome', CX * 2, 0.022, 0.022, 0, TOP, zz, 0xb9bec4); box('chrome', CX * 2, 0.02, 0.02, 0, 0.445, zz, 0x9aa0a6); }
      for (const xx of [-CX, -CX / 2, 0, CX / 2, CX]) for (const zz of [CZ0, CZ1]) box('chrome', 0.022, TOP - 0.44, 0.022, xx, (TOP + 0.44) / 2, zz, 0xb9bec4);
      for (const xx of [-CX, CX]) box('chrome', 0.022, 0.022, CZ1 - CZ0, xx, TOP, (CZ0 + CZ1) / 2, 0xb9bec4);
      add('led', place(new T.BoxGeometry(CX * 2 - 0.1, 0.012, 0.014), 0, TOP - 0.03, CZ1 - 0.03));
      mk(new T.PlaneGeometry(CX * 2, TOP - 0.45), M.glass, 0, (TOP + 0.45) / 2, CZ1);
      mk(new T.PlaneGeometry(CX * 2, CZ1 - CZ0), M.glass, 0, TOP + 0.002, (CZ0 + CZ1) / 2, -Math.PI / 2);
      for (let k = 0; k < 12; k++) { // inside the case: pistols, knives, scopes, price cards
        const x = -2.55 + k * 0.465 + (R() - 0.5) * 0.05, kind = k % 4;
        if (kind === 0 || kind === 2) add('gun', place(gunTemplate('pistol', tmpl).geo.clone(), x, 0.475, 0.74 + (R() - 0.5) * 0.08, -Math.PI / 2, (R() - 0.5) * 0.5, 0));
        else if (kind === 1) { box('chrome', 0.17, 0.006, 0.028, x, 0.464, 0.7, 0xc8ccd2, 0.35); box('paint', 0.1, 0.014, 0.03, x - 0.12, 0.466, 0.66, 0x121214, 0.35); }
        else { cyl('gun', 0.024, 0.024, 0.3, x, 0.485, 0.74, 0x16171a, 12, 0, 0.2, Math.PI / 2); cyl('gun', 0.032, 0.026, 0.05, x + 0.15, 0.488, 0.77, 0x16171a, 12, 0, 0.2, Math.PI / 2); }
        box('paint', 0.06, 0.004, 0.035, x + 0.02, 0.462, 0.95, 0xf4f1ea);
        box('paint', 0.06, 0.0045, 0.008, x + 0.02, 0.4625, 0.937, 0xc8102e);
      }
      // on the counter: the register (drawer + display animate), a card terminal, a mat
      const RX = 0.84, RZ = 0.8;
      box('paint', 0.46, 0.085, 0.4, RX, TOP + 0.13, RZ - 0.01, 0x2b2e33);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) box('paint', 0.05, 0.012, 0.04, RX - 0.1 + i * 0.065, TOP + 0.178, RZ + 0.02 + j * 0.055, i === 3 && j === 2 ? 0x3fbf6a : 0xcfd3d8);
      box('paint', 0.03, 0.17, 0.03, RX, TOP + 0.255, RZ - 0.15, 0x1d1f23);
      box('paint', 0.28, 0.13, 0.03, RX, TOP + 0.36, RZ - 0.14, 0x18191c, 0, -0.35);
      const scr = new T.Mesh(own(new T.PlaneGeometry(0.245, 0.092)), M.screen); scr.position.set(RX, TOP + 0.365, RZ - 0.122); scr.rotation.x = -0.35; scene.add(scr);
      const drawerG = own(merge([paint(new T.BoxGeometry(0.44, 0.085, 0.38), 0x34373d), place(paint(new T.BoxGeometry(0.16, 0.01, 0.2), 0x7fae7a), -0.1, 0.045, 0.02), place(paint(new T.BoxGeometry(0.16, 0.01, 0.2), 0x6f9e6c), 0.08, 0.045, 0.02), place(paint(new T.BoxGeometry(0.06, 0.02, 0.012), 0x9aa0a6), 0, 0, 0.196)]));
      const drawer = S.drawerMesh = new T.Mesh(drawerG, M.paint); drawer.position.set(RX, TOP + 0.045, RZ); S.drawerZ = RZ; scene.add(drawer);
      box('paint', 0.08, 0.03, 0.14, -0.92, TOP + 0.015, 0.82, 0x1b1c1f, 0.2); box('paint', 0.06, 0.004, 0.035, -0.92, TOP + 0.032, 0.8, 0x2a6f9a, 0.2);
      box('paint', 0.9, 0.006, 0.4, -0.2, TOP + 0.004, 0.78, 0x2a2c30);
      // ---- signage
      const poster = (key, w, h, x, y, z, ry) => mk(atlasPlane(w, h, PA[key], 512, 512), M.poster, x, y, z, 0, ry || 0);
      poster('sale', 0.29, 0.4, 1.7, 1.4, WZ + 0.224); poster('ammo', 0.32, 0.16, -1.7, 1.42, WZ + 0.224); poster('range', 0.3, 0.19, -5.1, 1.55, WZ + 0.224); poster('disc', 0.3, 0.3, 5.1, 1.6, WZ + 0.224);
      poster('card', 0.26, 0.13, -XW + 0.012, 1.8, 2.6, Math.PI / 2); poster('sale', 0.44, 0.6, XW - 0.012, 1.55, 3.2, -Math.PI / 2); poster('disc', 0.5, 0.5, -XW + 0.012, 1.55, 4.4, Math.PI / 2);
      // ---- merge the static batches (a dozen draw calls for the whole store)
      for (const k in acc) { const m = new T.Mesh(own(merge(acc[k])), M[k]); m.name = 'shop-' + k; scene.add(m); }
      for (const k in tmpl) own(tmpl[k].geo);
      // ---- lights: warm-white fluorescent store light, a soft key from the camera side
      scene.add(new T.HemisphereLight(0xfff4e8, 0x3a3631, 0.34));
      const key = new T.DirectionalLight(0xfff2e4, 1.0); key.position.set(3.4, 4.4, 3.6); key.target.position.set(0, 1.25, -0.4); scene.add(key); scene.add(key.target);
      const top = new T.PointLight(0xe9f0ff, 0.75, 9, 1.5); top.position.set(0, 2.5, 0.9); scene.add(top);
      const wash = new T.PointLight(0xfff0dc, 0.42, 7.5, 1.3); wash.position.set(0, 2.8, -1.25); scene.add(wash);
      const fill = new T.PointLight(0xffe2c4, 0.5, 12, 1.4); fill.position.set(-3.0, 1.8, 3.4); scene.add(fill);
      // ---- the crew at the counter
      S.crew = CREW.map(c => S.makeMember(c));
      H.linearize(scene);
      (H.extraScenes || (H.extraScenes = [])).push(scene);
    },
    vest(box, cx, cy, WZ) { // a plate carrier on a hanger
      const z = WZ + 0.07, C = 0x2a2d27;
      box('chrome', 0.3, 0.012, 0.012, cx, cy + 0.27, WZ + 0.05, 0x8d939a); box('chrome', 0.012, 0.06, 0.012, cx, cy + 0.3, WZ + 0.04, 0x8d939a);
      box('paint', 0.34, 0.4, 0.07, cx, cy, z, C); box('paint', 0.06, 0.16, 0.05, cx - 0.12, cy + 0.26, z, C); box('paint', 0.06, 0.16, 0.05, cx + 0.12, cy + 0.26, z, C);
      for (let i = 0; i < 3; i++) box('paint', 0.085, 0.12, 0.045, cx - 0.1 + i * 0.1, cy - 0.11, z + 0.05, 0x23261f);
      box('paint', 0.16, 0.06, 0.01, cx, cy + 0.08, z + 0.04, 0xd8d3c4);
    },
    makeEnv() {
      const es = new T.Scene(), tmp = [];
      const m = (geo, col, side) => { const mat = new T.MeshBasicMaterial({ color: col, side: side === undefined ? T.BackSide : side }); tmp.push(geo, mat); return new T.Mesh(geo, mat); };
      const room = m(new T.BoxGeometry(12, 3.6, 12), new T.Color(0.26, 0.255, 0.245)); room.position.y = 1.4; es.add(room);
      const fl = m(new T.PlaneGeometry(12, 12), new T.Color(0.09, 0.085, 0.08), T.DoubleSide); fl.rotation.x = -Math.PI / 2; fl.position.y = -0.38; es.add(fl);
      for (const x of [-3, 0, 3]) for (const z of [-3, 0, 3]) { const l = m(new T.BoxGeometry(1.4, 0.04, 0.4), new T.Color(6, 6, 6.3), T.FrontSide); l.position.set(x, 3.15, z); es.add(l); }
      const w = m(new T.PlaneGeometry(12, 1.2), new T.Color(0.03, 0.03, 0.035), T.DoubleSide); w.position.set(0, 2.8, -5.95); es.add(w);
      const pm = new T.PMREMGenerator(S.H.renderer), rt = pm.fromScene(es, 0.03); pm.dispose();
      for (const o of tmp) o.dispose();
      S.res.push(rt); return rt.texture;
    },
    makeMember(c) {
      const H = S.H; let rig = null, real = false;
      try {
        if (window.HModels && HModels.person) {
          if (HModels.CREW && HModels.CREW.indexOf(c.id) >= 0) { rig = HModels.person(c.id); real = !!rig && (rig.kind === c.id || rig.crew === c.id); }
          if (!real) rig = HModels.person('civ', { seed: c.seed }); // an older model build: a look-alike stand-in
        }
      } catch (e) { console.error(e); rig = null; }
      if (!rig) { // no model library: the engine's mannequin (it lands in the street scene: take it back, and own its materials)
        rig = H.makePerson('civ', { seed: c.seed }); if (rig.group.parent) rig.group.parent.remove(rig.group);
        rig.group.traverse(o => { if (o.geometry) S.res.push(o.geometry); if (o.material && o.material !== H.blobMat) S.res.push(o.material); });
      }
      if (rig.bag) rig.bag.visible = false;
      rig.group.position.set(c.x, 0, c.z); rig.group.rotation.y = c.h;
      H.markLinear(rig.group); S.scene.add(rig.group);
      const B = {}; if (rig.bones) for (const k in BONE_IX) B[k] = rig.bones.find(b => b && b.name === k) || rig.bones[BONE_IX[k]];
      const m = { id: c.id, c, rig, real, B, caps: {}, re: null, nod: null, shake: null, look: 0, lookT: 0, buf: rig.bones ? new Float32Array(rig.bones.length * 6) : null };
      if (rig.bones && B.uArmR && B.uArmL) { // which reaction poses this model really has (older builds ignore unknown names)
        const mag = b => Math.abs(b.rotation.x) + Math.abs(b.rotation.y) + Math.abs(b.rotation.z);
        rig.setPose('point', 0.4, 1); m.caps.point = mag(B.uArmR) > 0.6;
        rig.setPose('cheer', 0.4, 1); m.caps.cheer = Math.abs(B.uArmL.rotation.z) > 1;
        rig.setPose('highfive', 0.4, 1); m.caps.highfive = mag(B.uArmR) > 0.9;
      }
      rig.setPose('idle', c.ph, 1);
      return m;
    },

    /* ---------- menu DOM ---------- */
    buildDom() {
      if (!document.getElementById('sh-css')) { const st = document.createElement('style'); st.id = 'sh-css'; st.textContent = CSS; document.head.appendChild(st); }
      const stage = S.H.stage || document.getElementById('stage');
      const root = S.root = document.createElement('section'); root.id = 'shop';
      root.innerHTML = `
        <div class="sh-ring"></div><div class="sh-burst">${Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30 + (i % 2) * 11}deg;--d:${150 + (i % 3) * 55}px"></i>`).join('')}</div>
        <div class="sh-stamp"><b></b><small></small></div>
        <div class="sh-bub"><b></b><span></span></div>
        <div class="sh-panel off">
          <header class="sh-head"><div class="sh-logo">${LOGO}<div><div class="sh-brand">IRONSIDE <i>ARMORY</i></div><div class="sh-sub"></div></div></div>
            <div class="sh-cash"><small></small><b></b></div></header>
          <div class="sh-cols"><span></span><span></span><span></span></div>
          <div class="sh-rows"></div>
          <div class="sh-desc"><p></p><span class="sh-act"></span></div>
          <footer class="sh-foot"><span class="sh-keys"></span><button class="sh-co" type="button" tabindex="-1"><i></i><span><b></b><small></small></span></button></footer>
        </div>`;
      stage.appendChild(root);
      const q = s => root.querySelector(s);
      S.$ = { panel: q('.sh-panel'), sub: q('.sh-sub'), cashL: q('.sh-cash small'), cash: q('.sh-cash b'), cashBox: q('.sh-cash'), cols: q('.sh-cols'), rows: q('.sh-rows'),
        desc: q('.sh-desc'), descP: q('.sh-desc p'), act: q('.sh-act'), keys: q('.sh-keys'), co: q('.sh-co'), coI: q('.sh-co i'), coB: q('.sh-co b'), coS: q('.sh-co small'),
        stamp: q('.sh-stamp'), stampB: q('.sh-stamp b'), stampS: q('.sh-stamp small'), ring: q('.sh-ring'), burst: q('.sh-burst'), bub: q('.sh-bub'), bubB: q('.sh-bub b'), bubS: q('.sh-bub span') };
      S.$.panel.addEventListener('mousedown', e => e.preventDefault()); // menu buttons never take keyboard focus (Space/Enter stay ours)
      S.$.co.addEventListener('click', e => { e.currentTarget.blur(); if (S.inputOK()) { S.sel = S.items.length; S.checkout(); } });
      S._onMove = e => { if (e.pointerType !== 'mouse' || !S.active) return; const r = stage.getBoundingClientRect(); S.par.tx = clamp(((e.clientX - r.left) / r.width) * 2 - 1, -1, 1); S.par.ty = clamp(((e.clientY - r.top) / r.height) * 2 - 1, -1, 1); };
      window.addEventListener('pointermove', S._onMove);
      S.renderTexts();
    },
    renderTexts() {
      const $ = S.$; if (!$) return;
      S.lang = lang();
      S.root.setAttribute('dir', S.lang === 'he' ? 'rtl' : 'ltr'); S.root.setAttribute('lang', S.lang);
      $.sub.textContent = tr('sh_sub'); $.cashL.textContent = tr('sh_left');
      const cs = $.cols.children; cs[0].textContent = tr('sh_colItem'); cs[1].textContent = tr('sh_colType'); cs[2].textContent = tr('sh_colPrice');
      $.rows.innerHTML = '';
      S.rowEls = S.items.map((it, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'sh-row'; b.tabIndex = -1;
        b.innerHTML = `<span class="sh-name"><i class="sh-ic">${ICONS[it.icon] || ICONS.box}</i><span class="sh-nm"></span>${it.required ? '<em class="sh-req"></em>' : ''}<i class="sh-tick">${ICONS.check}</i></span><span class="sh-cat"></span><span class="sh-price"><span></span></span>`;
        b.querySelector('.sh-nm').textContent = text(it.name);
        if (it.required) b.querySelector('.sh-req').textContent = tr('sh_req');
        b.querySelector('.sh-cat').textContent = text(it.cat);
        b.querySelector('.sh-price span').textContent = money(it.price);
        b.addEventListener('click', e => { e.currentTarget.blur(); S.rowClick(i); });
        // hover selects only on a real mouse move: a resting cursor must not steal the keyboard selection when the panel appears under it
        b.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && (e.movementX || e.movementY) && S.inputOK() && S.sel !== i) { S.sel = i; sfx('ui', { vol: 0.5 }); S.refresh(); } });
        $.rows.appendChild(b); return b;
      });
      $.stampB.textContent = tr('sh_stamp');
      S.touch = null; S.refresh();
    },
    refresh() {
      const $ = S.$; if (!$) return;
      const left = S.left(), N = S.items.length;
      S.rowEls.forEach((b, i) => { const it = S.items[i], own = S.owned.has(it.id); b.classList.toggle('sel', S.sel === i); b.classList.toggle('own', own); b.classList.toggle('poor', !own && it.price > left); });
      const ok = S.canCheckout(), miss = S.reqMissing();
      $.co.classList.toggle('ok', ok); $.co.classList.toggle('sel', S.sel === N);
      const ic = ok ? 'check' : 'lock'; if ($.coI._v !== ic) { $.coI.innerHTML = ICONS[ic]; $.coI._v = ic; }
      $.coB.textContent = tr('sh_checkout');
      $.coS.textContent = ok ? tr('sh_ready') : miss === 1 ? tr('sh_missing1') : tr('sh_missing', { n: miss });
      const touch = isTouch();
      const msg = S.msg && S.time < S.msg.until ? S.msg : null;
      $.desc.classList.toggle('warn', !!(msg && msg.warn));
      let act = '';
      if (msg) $.descP.textContent = msg.text;
      else if (S.sel >= N) { $.descP.textContent = tr('sh_coDesc'); act = `<kbd>E</kbd> ${tr('sh_actGo')}`; }
      else { const it = S.items[S.sel]; $.descP.textContent = text(it.desc); act = S.owned.has(it.id) ? `<kbd>⌫</kbd> ${tr('sh_actRefund')}` : `<kbd>E</kbd> ${tr('sh_actBuy')}`; }
      if ($.act._v !== act) { $.act.innerHTML = act; $.act._v = act; }
      if (S.touch !== touch) { S.touch = touch; S.root.classList.toggle('sh-touch', touch); if (touch) $.keys.textContent = tr('sh_keysTouch'); else $.keys.innerHTML = tr('sh_keys'); }
      let cheapest = Infinity; for (const it of S.items) if (!S.owned.has(it.id)) cheapest = Math.min(cheapest, it.price);
      $.cash.classList.toggle('low', left < cheapest);
    },
    inputOK() { return S.active && S.phase === 'menu' && !S.H.paused && !(window.HHud && HHud.cutActive && HHud.cutActive()); },
    showPanel() { if (S.$ && S.$.panel.classList.contains('off')) S.$.panel.classList.remove('off'); if (S.phase === 'intro') { S.phase = 'menu'; S.phaseT = 0; } },

    /* ---------- actions ---------- */
    move(d) { const N = S.items.length; S.sel = (S.sel + d + N + 1) % (N + 1); sfx('ui'); S.refresh(); },
    activate() { if (S.sel >= S.items.length) S.checkout(); else S.buy(S.sel, true); },
    rowClick(i) {
      if (!S.inputOK()) return;
      if (S.lastToggle.i === i && S.time - S.lastToggle.t < 0.3) return; // a double click is not buy + refund
      S.lastToggle = { i, t: S.time }; S.sel = i;
      if (S.owned.has(S.items[i].id)) S.refund(i); else S.buy(i);
    },
    buy(i, fromKey) {
      const it = S.items[i]; if (!it) return;
      if (S.owned.has(it.id)) { if (fromKey) { S.flashMsg(tr('sh_ownedHint'), false); sfx('beep', { pitch: 0.7 }); } return; }
      if (it.price > S.left()) {
        S.flashMsg(isTouch() ? tr('sh_noCashT') : tr('sh_noCash'), true); S.shakePanel(); sfx('hackFail');
        S.react('yoav', 'shake'); S.say('yoav', tr('sh_q_noCash')); S.refresh(); return;
      }
      S.owned.add(it.id); S.sel = i; S.msg = null;
      sfx('purchase'); sfx('cash', { vol: 0.75 }); S.later(0.15, () => sfx('land', { intensity: 0.25, vol: 0.55 })); // ka-ching + the stamp's thump
      S.stamp(text(it.name)); S.delta(-it.price);
      const row = S.rowEls[i]; row.classList.remove('flash'); void row.offsetWidth; row.classList.add('flash');
      S.drawerT = S.time; S.updateScreen(); S.punch = 1; S.shake = 0.5;
      if (S.H.doFlash) S.H.doFlash(1, 0.86, 0.5, 0.16);
      const who = it.who && S.member(it.who) ? it.who : 'yoav';
      S.react(who, it.pose || 'point', 1.7);
      for (const m of S.crew) if (m.id !== who) S.react(m.id, 'nod', 0.75, 0.12 + Math.random() * 0.25);
      if (it.quip) S.say(who, text(it.quip));
      if (S.reqMissing() === 0 && !S.allReqSaid && it.required) { S.allReqSaid = true; const n = S.sayN; S.later(2.1, () => { if (S.sayN === n) S.say('yoav', tr('sh_q_allReq')); }); }
      S.refresh();
    },
    refund(i) {
      const it = S.items[i]; if (!it || !S.owned.has(it.id)) { sfx('beep', { pitch: 0.7 }); return; }
      S.owned.delete(it.id); S.sel = i; S.msg = null;
      sfx('coin', { vol: 1.2 }); sfx('ui'); S.delta(it.price); S.updateScreen();
      S.react('ido', 'shake', 0.9); S.say('ido', tr('sh_q_refund'));
      if (it.required) S.allReqSaid = false;
      S.refresh();
    },
    checkout() {
      if (!S.inputOK()) return;
      if (!S.canCheckout()) {
        S.flashMsg(tr('sh_needReq'), true); S.shakePanel(); sfx('hackFail');
        S.react('yoav', 'point', 1.4); S.say('yoav', tr('sh_q_needReq'));
        const first = S.items.findIndex(i => i.required && !S.owned.has(i.id)); if (first >= 0) S.sel = first;
        S.refresh(); return;
      }
      S.phase = 'outro'; S.phaseT = 0; S.$.panel.classList.add('bye');
      sfx('checkpoint'); sfx('bigCash', { vol: 0.6 });
      S.say(S.member('ido') ? 'ido' : 'yoav', tr('sh_q_bye'));
      const hi = id => (S.member(id) && S.member(id).caps.highfive ? 'highfive' : 'cheer');
      S.react('hadar', 'cheer', 1.6); S.react('ido', hi('ido'), 1.6, 0.1); S.react('yoav', hi('yoav'), 1.6, 0.15);
    },
    finish() {
      const cb = S.onDone, res = S.result();
      S.teardown();
      if (window.HHud && HHud.ready) HHud.fade(0, 0.5);
      if (cb) cb(res);
    },

    /* ---------- feedback ---------- */
    stamp(sub) {
      const $ = S.$; $.stampS.textContent = sub || '';
      for (const el of [$.stamp, $.ring, $.burst]) { el.classList.remove('go'); void el.offsetWidth; el.classList.add('go'); }
    },
    delta(n) {
      const e = document.createElement('em'); e.className = 'sh-delta' + (n > 0 ? ' plus' : ''); e.textContent = (n > 0 ? '+' : '−') + money(Math.abs(n));
      S.$.cashBox.appendChild(e); e.addEventListener('animationend', () => e.remove());
    },
    flashMsg(msg, warn) { S.msg = { text: msg, warn, until: S.time + 2.6 }; S.refresh(); },
    shakePanel() { const p = S.$.panel; p.classList.remove('shake'); void p.offsetWidth; p.classList.add('shake'); },
    later(sec, fn) { S.timers.push({ at: S.time + sec, fn }); },
    member(id) { return (S.crew || []).find(m => m.id === id) || null; },
    react(id, pose, dur, delay) {
      const m = S.member(id); if (!m) return;
      const t0 = S.time + (delay || 0);
      if (pose === 'nod') m.nod = { t0, dur: dur || 0.7 };
      else if (pose === 'shake') m.shake = { t0, dur: dur || 0.9 };
      else m.re = { pose, t0, dur: dur || 1.6 };
    },
    say(id, line) {
      const $ = S.$, m = id ? S.member(id) : null;
      S.sayN = (S.sayN || 0) + 1;
      if (!m || !line) { S.bub.who = null; $.bub.classList.remove('show'); return; }
      $.bubB.textContent = tr('sh_' + id); $.bubS.textContent = line;
      $.bub.style.setProperty('--ac', m.c.ac); $.bub.style.setProperty('--acd', m.c.acd);
      $.bub.classList.remove('pop'); void $.bub.offsetWidth; $.bub.classList.add('show', 'pop');
      S.bub.who = m; S.bub.until = S.time + 2.3 + line.length * 0.035; S.bub.w = $.bub.offsetWidth; S.bub.tail = undefined;
      for (const o of S.crew) o.lookT = o === m ? 0 : S.bub.until; // the others turn to the speaker
      S.placeBubble();
    },
    updateScreen() { screenDraw(S.screenX, S.left()); S.screenTex.needsUpdate = true; },

    /* ---------- per frame ---------- */
    update(dt) {
      if (!S.active) return;
      const H = S.H, rdt = S.rdt = Math.min(0.05, H.realDt || dt || 0.016);
      S.time += rdt; S.phaseT += rdt; S.introT += rdt;
      if (lang() !== S.lang) S.renderTexts();
      const ae = document.activeElement; if (ae && ae.tagName === 'BUTTON' && !H.paused) ae.blur(); // keep Space/Enter for the menu
      for (let k = S.timers.length - 1; k >= 0; k--) if (S.time >= S.timers[k].at) { const f = S.timers[k].fn; S.timers.splice(k, 1); f(); if (!S.active) return; }
      if (S.phase === 'intro') {
        if (S.introT > S.introLen * 0.5) S.showPanel();
        else if (S.introT > 0.25 && H.pressed('KeyE', 'Enter', 'Space')) S.skipIntro();
      } else if (S.phase === 'menu') {
        if (!S.greeted && S.introT > S.introLen * 0.8) { S.greeted = true; S.say('yoav', tr('sh_q_hi', { b: S.budget.toLocaleString('en-US') })); }
        if (S.inputOK()) {
          if (H.pressed('KeyW', 'ArrowUp')) S.move(-1);
          if (H.pressed('KeyS', 'ArrowDown')) S.move(1);
          if (H.pressed('KeyE', 'KeyF', 'Enter', 'NumpadEnter', 'Space')) S.activate();
          if (H.pressed('Backspace', 'Delete')) S.refund(S.sel);
          if (H.pressed('KeyC') && S.phase === 'menu') { S.sel = S.items.length; S.checkout(); }
        }
        if (S.msg && S.time >= S.msg.until) { S.msg = null; S.refresh(); }
        if (isTouch() !== S.touch) S.refresh();
      } else if (S.phase === 'outro') {
        if (!S.faded && S.phaseT > 1.35) { S.faded = true; if (HHud.ready) HHud.fade(1, 0.4); sfx('door'); }
        if (S.phaseT > 1.8) { S.finish(); return; }
      }
      // money counter
      const left = S.left();
      if (S.shown === null) { S.shown = left; S.$.cash.textContent = money(left); }
      else if (S.shown !== left) { S.shown = Math.abs(left - S.shown) < 30 ? left : damp(S.shown, left, 9, rdt); const s = money(S.shown); if (S.$.cash.textContent !== s) S.$.cash.textContent = s; }
      // the register drawer: out on a sale, back after a beat
      const d0 = S.time - S.drawerT, open = d0 < 0.95 ? ease(d0 / 0.16) : 1 - ease((d0 - 0.95) / 0.3);
      S.drawerMesh.position.z = S.drawerZ + 0.2 * clamp(open, 0, 1);
      S.poseCrew();
      S.placeBubble();
    },
    poseCrew() {
      const tm = S.time;
      for (const m of S.crew) {
        const rig = m.rig, t = tm + m.c.ph, B = m.B, re = m.re;
        if (re && tm >= re.t0 + re.dur) m.re = null;
        const active = m.re && tm >= re.t0;
        if (!rig.bones) { rig.setPose(active && re.pose === 'cheer' ? 'cheer' : 'idle', t, 1); continue; }
        rig.setPose('idle', t, 1);
        if (active) { // blend idle -> reaction pose and back
          const e = ease((tm - re.t0) / 0.22) * (1 - ease((tm - re.t0 - (re.dur - 0.38)) / 0.38));
          const bs = rig.bones, buf = m.buf;
          for (let i = 0; i < bs.length; i++) { const r = bs[i].rotation, p = bs[i].position, o = i * 6; buf[o] = r.x; buf[o + 1] = r.y; buf[o + 2] = r.z; buf[o + 3] = p.x; buf[o + 4] = p.y; buf[o + 5] = p.z; }
          if (m.caps[re.pose]) rig.setPose(re.pose, t, 1); else S.manualPose(m, re.pose, t);
          for (let i = 0; i < bs.length; i++) { const r = bs[i].rotation, p = bs[i].position, o = i * 6; r.set(buf[o] + (r.x - buf[o]) * e, buf[o + 1] + (r.y - buf[o + 1]) * e, buf[o + 2] + (r.z - buf[o + 2]) * e); p.set(buf[o + 3] + (p.x - buf[o + 3]) * e, buf[o + 4] + (p.y - buf[o + 4]) * e, buf[o + 5] + (p.z - buf[o + 5]) * e); }
        }
        if (!B.head) continue;
        if (m.nod && tm >= m.nod.t0) { const u = (tm - m.nod.t0) / m.nod.dur; if (u >= 1) m.nod = null; else B.head.rotation.x += 0.2 * Math.sin(u * Math.PI) + 0.06 * Math.sin(u * Math.PI * 3) * (1 - u); }
        if (m.shake && tm >= m.shake.t0) { const u = (tm - m.shake.t0) / m.shake.dur; if (u >= 1) m.shake = null; else B.head.rotation.y += 0.3 * Math.sin(u * Math.PI * 5) * (1 - u); }
        // look at whoever is talking, otherwise mostly at the camera, drifting a little
        const sp = S.bub.who && S.time < S.bub.until && m.lookT > S.time ? S.bub.who : null;
        const want = sp && sp !== m ? clamp(Math.atan2(sp.c.x - m.c.x, sp.c.z - m.c.z + 0.6) - m.c.h, -0.7, 0.7) : -m.c.h * 0.55 + 0.12 * Math.sin(tm * 0.21 + m.c.ph * 2);
        m.look = damp(m.look, want, 5, S.rdt);
        B.head.rotation.y += m.look * 0.75; if (B.spine) B.spine.rotation.y += m.look * 0.2;
      }
    },
    manualPose(m, pose, t) { // stand-ins for poses an older model build does not have
      const B = m.B; if (!B.uArmR) return;
      if (pose === 'point') { B.uArmR.rotation.set(-1.32 + 0.03 * Math.sin(t * 3), 0.1, -0.18); if (B.fArmR) B.fArmR.rotation.set(-0.12, 0, 0); if (B.spine) B.spine.rotation.y -= 0.12; }
      else if (pose === 'highfive' || pose === 'cheer') { B.uArmR.rotation.set(-0.2, 0, -2.55); if (B.fArmR) B.fArmR.rotation.set(-0.35, 0, 0); if (pose === 'cheer' && B.uArmL) { B.uArmL.rotation.set(-0.2, 0, 2.55); if (B.fArmL) B.fArmL.rotation.set(-0.35, 0, 0); } }
    },
    isCompact() { return !!(S.root && S.root.parentNode && S.root.parentNode.classList.contains('compact')); },
    placeBubble() {
      const $ = S.$, b = S.bub;
      if (!b.who || !$) return;
      if (S.time > b.until) { b.who = null; $.bub.classList.remove('show'); return; }
      const v = S._v || (S._v = new T.Vector3()), head = b.who.B.head;
      if (head) { head.getWorldPosition(v); v.y += 0.36; } else v.set(b.who.c.x, 2.0, b.who.c.z);
      v.project(S.H.camera);
      // keep the bubble on screen (on phones: out of the side sheet); its tail still points at the speaker
      const cp = S.isCompact(), rtl = S.lang === 'he', w = b.w || 260, hx = (v.x + 1) * 640;
      const x0 = (cp ? (rtl ? 112 : 652) : 12) + w / 2, x1 = (cp ? (rtl ? 628 : 1168) : 1268) - w / 2; // phones: clear of the side sheet and the pause button
      const x = x1 > x0 ? clamp(hx, x0, x1) : (x0 + x1) / 2, y = clamp((1 - v.y) * 360, cp ? 104 : 76, 520);
      const tail = clamp(hx - x, -w / 2 + 22, w / 2 - 22);
      if (b.tail === undefined || Math.abs(b.tail - tail) > 0.5) { b.tail = tail; $.bub.style.setProperty('--tail', tail.toFixed(0) + 'px'); }
      $.bub.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-100%)`;
    },
    camera(dt, cam) {
      const H = S.H, rdt = S.rdt || Math.min(0.05, dt), m = H.mouse;
      // the video's framing: the trio waist-up over the counter, through a long lens (phones: wider, trio higher)
      // (phones: pulled back and shifted sideways so the trio stands in the half the side sheet leaves free)
      const side = S.lang === 'he' ? 1.23 : -1.23; // the trio (~2.3 m) centred in the ~640 px the sheet leaves free
      const F = S.isCompact() ? { px: side, py: 1.42, pz: 5.0, tx: side, ty: 1.32, fov: 31 } : { px: 0, py: 1.3, pz: 3.4, tx: 0, ty: 1.22, fov: 26 };
      const k = S.introLen > 0 ? easeIO(clamp(S.introT / S.introLen, 0, 1)) : 1;
      let px = 0.55 + (F.px - 0.55) * k, py = 2.45 + (F.py - 2.45) * k, pz = 7.6 + (F.pz - 7.6) * k;
      let tx = F.tx * k, ty = 1.5 + (F.ty - 1.5) * k, tz = -0.9 + 0.9 * k, fov = 46 + (F.fov - 46) * k;
      if (S.phase === 'outro') { const o = easeIO(clamp(S.phaseT / 1.6, 0, 1)); pz -= 0.28 * o; py += 0.03 * o; fov -= 1.2 * o; }
      // slow handheld drift
      const tm = S.time;
      px += 0.1 * Math.sin(tm * 0.23) + 0.03 * Math.sin(tm * 0.61); py += 0.03 * Math.sin(tm * 0.17 + 1.3); pz += 0.06 * Math.sin(tm * 0.13 + 0.4); tx += 0.04 * Math.sin(tm * 0.19 + 2);
      // mouse parallax (desktop)
      const P = S.par; P.x = damp(P.x, P.tx, 2.5, rdt); P.y = damp(P.y, P.ty, 2.5, rdt);
      px += 0.2 * P.x; py -= 0.07 * P.y;
      // a mouse drag / a thumb on the view orbits a little and springs back
      let drag = false;
      if (S.phase !== 'outro') {
        if (m && (m.dx || m.dy)) { S.oy -= m.dx * 0.0024; S.op += m.dy * 0.0016; drag = true; }
        const st = typeof Input !== 'undefined' && Input.sticks ? (Input.stickVec('aim', 10) || Input.stickVec('move', 10)) : null;
        if (st && st.mag > 0) { S.oy -= st.x * 0.9 * rdt; S.op += st.y * 0.4 * rdt; drag = true; }
      }
      S.oy = clamp(S.oy, -0.34, 0.34); S.op = clamp(S.op, -0.07, 0.13);
      S.orbitT = drag ? 1.2 : Math.max(0, S.orbitT - rdt);
      if (S.orbitT <= 0) { S.oy = damp(S.oy, 0, 1.6, rdt); S.op = damp(S.op, 0, 1.6, rdt); }
      let dx = px - tx, dy = py - ty, dz = pz - tz;
      if (S.oy || S.op) {
        const cs = Math.cos(S.oy), sn = Math.sin(S.oy), rx = dx * cs + dz * sn, rz = -dx * sn + dz * cs, hz = Math.hypot(rx, rz) || 1e-4, L = Math.hypot(hz, dy), a = Math.atan2(dy, hz) + S.op;
        dx = rx / hz * L * Math.cos(a); dz = rz / hz * L * Math.cos(a); dy = L * Math.sin(a);
      }
      // purchase punch-in + micro shake
      S.punch = Math.max(0, S.punch - rdt * 3.2); S.shake = Math.max(0, S.shake - rdt * 2.4);
      const sh = S.shake * S.shake * 0.02;
      cam.position.set(tx + dx + (Math.random() - 0.5) * sh, ty + dy + (Math.random() - 0.5) * sh, tz + dz);
      cam.fov = fov - 1.6 * Math.sin(S.punch * Math.PI); cam.updateProjectionMatrix();
      cam.lookAt(tx, ty, tz);
    },

    /* ---------- teardown ---------- */
    teardown() {
      const H = S.H;
      S.active = false; S.phase = 'off'; S.timers = []; S.faded = false; S.greeted = false;
      if (S._onMove) { window.removeEventListener('pointermove', S._onMove); S._onMove = null; }
      if (S.root) { S.root.remove(); S.root = null; } S.$ = null; S.rowEls = null;
      if (window.HHud && HHud.el) HHud.el.classList.remove('sh-on');
      if (H) {
        if (H.interior && H.interior === S.interior) H.interior = null;
        if (H.active && H.state === 'interior') H.state = 'play';
        const xs = H.extraScenes; if (xs && S.scene) { const i = xs.indexOf(S.scene); if (i >= 0) xs.splice(i, 1); }
        H.timeScale = 1; H.desat = 0;
      }
      if (S.crew) for (const m of S.crew) { if (m.rig.group.parent) m.rig.group.parent.remove(m.rig.group); if (m.rig.mesh && m.rig.mesh.skeleton) m.rig.mesh.skeleton.dispose(); }
      if (S.scene) { S.scene.traverse(o => { if (o.isLight && o.dispose) o.dispose(); }); while (S.scene.children.length) S.scene.remove(S.scene.children[0]); }
      for (const r of S.res || []) { try { r.dispose(); } catch (e) { /* already gone with the renderer */ } }
      S.res = []; S.crew = null; S.scene = null; S.interior = null; S.mats = null; S.env = null; S.drawerMesh = null; S.screenTex = null; S.screenX = null;
      S.onDone = null; S.bub = { who: null, until: 0 };
    },
  };
  return S;
})();
window.HShop = HShop;
