/* Chapter 3 "THE CREW" (הצוות): the mission script. Yoav, Hadar and Ido drive to IRONSIDE ARMORY, gear up, hit the
   OCEAN TRUST BANK vault, blow Yoav's gas-cylinder trap on the cops and watch the sunset from the Key Island lookout,
   switching between the three like in GTA V. Then free roam with the crew. Built on the chapter-3 modules:
   HCrew (crew.js: cast + switching), HShop (shop.js), HCrewVault (crewvault.js), HBoom (boom.js), the HWorld story
   points (world.js) and the engine seams in heist.js (mods, camOverride, interior, timeScale, desat).

   Contract (HMission dispatches to it while HMission.story === 'crew'):
     begin(H, free)  update(dt) (street 'play' only)  blips()  safeZone(x, z)  onEnterCar(v)  onExitCar(v)  fail(kind)  stop()

   The mission, step by step (this.step):
     intro      cut 'drive'; the crew in the black lux at HWorld.crewStart, Ido driving (golden hour)
     toStore    drive to IRONSIDE ARMORY (switching locked: the crew is in the car together)
     storeStage the car settles in the bay, the three get out and walk to the door -> cut 'store'
     shop       HShop (budget 62,000) -> cut 'purchase' (the stamp + THE BIG SCORE) -> back in the car   [checkpoint 'store']
     toBank     drive to the waiting spot around the corner from OCEAN TRUST BANK                      [checkpoint 'bank']
     suitUp     Hadar + Yoav get out and mask up (staged shot)
     switchTut  the switching tutorial: the crew wheel opens on Hadar; the switch happens (forced if need be)
     walkIn     Hadar (player) walks into the bank through the front door, Yoav follows
     vault      HCrewVault: plant, blast -> cut 'vault' -> money burst -> loot (switch Hadar <-> Yoav)
     alarmOut   the alarm: outside shot of the bank, then the sky cam over to Ido in the car
     pickup     3 stars (locked): drive to the back door                                           [checkpoint 'pickup']
     boarding   Hadar + Yoav come out with the bags and jump in
     escape     lead the cops through Yoav's trap: G -> boom + slow-mo -> cut 'boom' + 'drift'
     lose       wanted 2, lose the cops (bombs, nitro, Focus; the jammer helps)                    [checkpoint 'trap']
     toLookout  across the causeway to Key Island as the sun sets                                  [checkpoint 'evaded']
     finale     the three at the lookout, MISSION PASSED · RESPECT +100 -> cut 'finale' -> results -> free roam / quit
   Every deferred callback runs on this module's own job clock (real seconds, frozen while paused or in a cut) and carries
   the run token: a fail, a restore, a quit or a restart drops everything that was pending. */
(function () {
  if (typeof I18N === 'undefined') return;
  const L = s => '⁦' + s + '⁩'; // keeps Latin / numbers in one piece inside Hebrew text
  Object.assign(I18N.he, {
    cs_title: 'הצוות', cs_titleSub: 'יואב · הדר · עידו',
    cs_o_store: 'סעו לנשקייה', cs_o_shop: 'קנו ציוד לשוד', cs_o_bank: 'סעו לבנק וחנו מעבר לפינה',
    cs_o_switch: 'עברו להדר', cs_o_walk: 'היכנסו לבנק בדלת הראשית', cs_o_vault: 'פרצו את הכספת ואספו כסף',
    cs_o_pickup: 'אספו את הצוות בדלת האחורית', cs_o_trap: 'משכו את הניידות למלכודת', cs_o_lose: 'תאבדו את המשטרה',
    cs_o_lookout: 'סעו לתצפית באי', cs_o_car: 'חזרו לאוטו, הצוות מחכה', cs_o_foot: 'צאו מהרכב והיכנסו לבנק',
    cs_lock_car: 'כל הצוות באוטו ביחד', cs_lock_shop: 'קודם מסיימים לקנות', cs_lock_walk: 'הדר בדרך פנימה', cs_lock_job: 'אין זמן להחלפות עכשיו',
    cs_helpKeys: 'WASD נהיגה · רווח בלם יד · X פוקוס (עידו) · Tab גלגל הצוות · Esc הפסקה',
    cs_helpTouch: 'ג׳ויסטיק: נהיגה · ⛔ בלם יד · הכפתור הכתום: פוקוס · רצועת הצוות למעלה',
    cs_helpWalk: 'Shift ריצה. הדר הכי מהיר בצוות',
    cs_helpNitro: 'קניתם ניטרו: Shift באוטו', cs_helpNitroT: 'קניתם ניטרו: הכפתור הכחול',
    cs_helpVault: 'Tab או ' + L('1 / 2') + ' מחליפים בין הדר ליואב. שניהם אוספים!',
    cs_helpVaultT: 'געו ברצועת הצוות כדי לעבור בין הדר ליואב. שניהם אוספים!',
    cs_helpEsc: 'G פצצה מאחורי האוטו · Shift ניטרו · X פוקוס',
    cs_tip: 'טיפ: החזיקו Tab לגלגל הצוות, או ' + L('1 / 2 / 3') + ' להחלפה מהירה. X מאט את הזמן כשעידו נוהג.',
    cs_tipT: 'טיפ: געו ברצועת הצוות כדי להחליף דמות. הכפתור הכתום מאט את הזמן כשעידו נוהג.',
    cs_burn: 'האוטו הזה גמור', cs_resTitle: 'סיכום העבודה',
    cs_helpEscT: 'כפתור הפצצה · כפתור הניטרו · הכפתור הכתום: פוקוס',
    cs_slow: 'האטו כדי לעצור בסימון', cs_suit: 'מסכות על הפנים', cs_trapMissed: 'פספסתם את המלכודת',
    cs_tutT: 'החלפת דמויות!', cs_tutK: 'החזיקו Tab ובחרו דמות, או לחצו ' + L('1 / 2 / 3'),
    cs_tutTouch: 'געו ברצועת הצוות למעלה ובחרו דמות', cs_tutGo: 'עכשיו: עברו להדר',
    cs_passed: 'המשימה הושלמה', cs_respect: 'כבוד',
    cs_resText: 'הכסף בתיקים, הניידות בעשן, והשקיעה כולה שלכם.',
    cs_r_vault: 'שלל מהכספת', cs_r_change: 'עודף מהחנות', cs_r_total: 'סה״כ שלל', cs_r_gear: 'ציוד', cs_r_cops: 'ניידות שהושבתו', cs_r_none: 'רק הבסיס',
    cs_free: 'שוטטו חופשי עם הצוות', cs_freeTitle: 'הצוות · חופשי', cs_freeSub: 'מחליפים דמויות, אוספים כסף, עושים בלגן',
    cs_o_freeSw: 'Tab או ' + L('1 / 2 / 3') + ': החלפת דמות', cs_o_freeSwT: 'רצועת הצוות: החלפת דמות',
    // in-engine dialogue (named subtitles)
    cs_l_d1: 'סרט אקשן. אני מת לפוצץ משהו.', cs_l_st1: 'ריח של אבק שריפה. אני בבית.', cs_l_f1: 'שלוש… שתיים…', cs_l_grab: 'אל תעמוד ותסתכל. תאסוף!',
    cs_l_fin1: 'אז… מה עושים מחר?', cs_l_fin2: 'מחר מתכננים את הבא.', cs_l_fin3: 'אני בפנים!',
    cs_l_s1: 'קודם קניות. עידו, לנשקייה, ובלי הקיצורים שלך.', cs_l_s2: 'הקיצורים שלי זה הסיבה שאנחנו עוד בחיים.',
    cs_l_s3: 'אפשר מוזיקה? אני נרדם פה.', cs_l_s4: 'מוזיקה אחרי השוד. עכשיו מתרכזים.',
    cs_l_b1: 'הבנק בהמשך. חונים מעבר לפינה, לא מול המצלמות.', cs_l_b2: 'אפוד, מסכה, מטען. אני מרגיש נינג׳ה.', cs_l_b3: 'נינג׳ות לא מדברות כל הדרך.',
    cs_l_u1: 'עידו, אתה נשאר עם האוטו. אנחנו נכנסים.', cs_l_u2: 'ארבעים וחמש שניות. אחרי זה אני מתחיל לדאוג.', cs_l_u3: 'יאללה, בואו נעשה היסטוריה.',
    cs_l_w1: 'דלת ראשית. תתנהג טבעי.', cs_l_w2: 'יואב, אני עם מסכה.',
    cs_l_a1: 'עידו! אזעקה! לדלת האחורית!', cs_l_a2: 'בדרך. תחזיקו חזק את התיקים.',
    cs_l_g1: 'סע! סע! סע!',
    cs_l_e1: 'השארתי להם הפתעה בצומת הגדול הבא. בלוני גז.', cs_l_e2: 'תביא אותם קרוב, ואז G.', cs_l_e2t: 'תביא אותם קרוב, ואז הכפתור האדום.',
    cs_l_e3: 'ויש לנו גם פצצות דביקות. רק אומר.', cs_l_t1: 'עכשיו!!', cs_l_t2: 'אמרתי לכם שהתוכנית תעבוד.', cs_l_t3: 'עוד לא סיימנו. צריך לאבד אותם.',
    cs_l_m1: 'פספסת! טוב, תאבד אותם בדרך הקשה.', cs_l_l1: 'תתרחק מהניידות ותישאר מחוץ לטווח הראייה.',
    cs_l_v1: 'נקי. אף אחד מאחורינו.', cs_l_v2: 'לתצפית באי. השמש שוקעת ואנחנו עשירים.', cs_l_v3: 'עכשיו אפשר מוזיקה?', cs_l_v4: 'עכשיו כן.',
    cs_l_c1: 'אחי, לאן אתה הולך?!',
  });
  Object.assign(I18N.en, {
    cs_title: 'THE CREW', cs_titleSub: 'YOAV · HADAR · IDO',
    cs_o_store: 'Drive to IRONSIDE ARMORY', cs_o_shop: 'Gear up for the job', cs_o_bank: 'Drive to OCEAN TRUST BANK, park around the corner',
    cs_o_switch: 'Switch to Hadar', cs_o_walk: 'Walk into the bank through the front door', cs_o_vault: 'Crack the vault, grab the cash',
    cs_o_pickup: 'Pick up the crew at the back door', cs_o_trap: 'Lure the cops into the trap', cs_o_lose: 'Lose the cops',
    cs_o_lookout: 'Meet at the lookout on Key Island', cs_o_car: 'Get back in the car, the crew is waiting', cs_o_foot: 'Get out and walk into the bank',
    cs_lock_car: 'The whole crew is in the car together', cs_lock_shop: 'Finish shopping first', cs_lock_walk: 'Hadar is on his way in', cs_lock_job: 'No time to switch right now',
    cs_helpKeys: 'WASD drive · Space handbrake · X Focus (Ido) · Tab crew wheel · Esc pause',
    cs_helpTouch: 'Stick: drive · ⛔ handbrake · orange button: Focus · crew strip at the top',
    cs_helpWalk: 'Shift to run. Hadar is the fastest of the three',
    cs_helpNitro: 'You bought nitro: Shift in the car', cs_helpNitroT: 'You bought nitro: the blue button',
    cs_helpVault: 'Tab or 1 / 2 switches between Hadar and Yoav. Both grab cash!',
    cs_helpVaultT: 'Tap the crew strip to switch between Hadar and Yoav. Both grab cash!',
    cs_helpEsc: 'G drop a bomb · Shift nitro · X Focus',
    cs_helpEscT: 'Bomb · nitro · orange: Focus',
    cs_tip: 'Tip: hold Tab for the crew wheel, or press 1 / 2 / 3 to switch fast. X slows time while Ido drives.',
    cs_tipT: 'Tip: tap the crew strip to switch characters. The orange button slows time while Ido drives.',
    cs_burn: 'This car is done for', cs_resTitle: 'THE DEBRIEF',
    cs_slow: 'Slow down to stop in the marker', cs_suit: 'MASKS ON', cs_trapMissed: 'Missed the trap',
    cs_tutT: 'SWITCH CHARACTERS!', cs_tutK: 'Hold Tab and pick someone, or press 1 / 2 / 3',
    cs_tutTouch: 'Tap the crew strip at the top and pick someone', cs_tutGo: 'Now: switch to Hadar',
    cs_passed: 'MISSION PASSED', cs_respect: 'RESPECT',
    cs_resText: 'The cash is in the bags, the cruisers are in the smoke, and the sunset is all yours.',
    cs_r_vault: 'Vault take', cs_r_change: 'Change from the store', cs_r_total: 'Total take', cs_r_gear: 'Gear', cs_r_cops: 'Cruisers taken out', cs_r_none: 'Just the basics',
    cs_free: 'Free roam with the crew', cs_freeTitle: 'THE CREW · FREE ROAM', cs_freeSub: 'Switch characters, grab cash, cause chaos',
    cs_o_freeSw: 'Tab or 1 / 2 / 3: switch character', cs_o_freeSwT: 'Crew strip: switch character',
    cs_l_d1: "An action movie. I'm dying to blow something up.", cs_l_st1: "Smells like gunpowder. I'm home.", cs_l_f1: 'Three… two…', cs_l_grab: "Don't stare. Grab it!",
    cs_l_fin1: 'So… what are we doing tomorrow?', cs_l_fin2: 'Tomorrow we plan the next one.', cs_l_fin3: "I'm in!",
    cs_l_s1: 'Shopping first. Ido, to the armory, and skip your shortcuts.', cs_l_s2: "My shortcuts are why we're still alive.",
    cs_l_s3: "Can we get some music? I'm falling asleep here.", cs_l_s4: 'Music after the heist. Focus now.',
    cs_l_b1: "The bank's up ahead. We park around the corner, not in front of the cameras.", cs_l_b2: 'Vest, mask, charge. I feel like a ninja.', cs_l_b3: "Ninjas don't talk the whole way.",
    cs_l_u1: 'Ido, you stay with the car. We go in.', cs_l_u2: 'Forty-five seconds. After that I start to worry.', cs_l_u3: "Let's go make history.",
    cs_l_w1: 'Front door. Act natural.', cs_l_w2: "Yoav, I'm wearing a mask.",
    cs_l_a1: 'Ido! Alarm! To the back door!', cs_l_a2: 'On my way. Hold on to those bags.',
    cs_l_g1: 'Go! Go! Go!',
    cs_l_e1: 'I left them a surprise at the next big junction. Gas cylinders.', cs_l_e2: 'Bring them in close, then hit G.', cs_l_e2t: 'Bring them in close, then hit the red button.',
    cs_l_e3: 'We also have sticky bombs. Just saying.', cs_l_t1: 'NOW!!', cs_l_t2: 'Told you the plan would work.', cs_l_t3: "We're not done. We still have to lose them.",
    cs_l_m1: 'You missed it! Fine, lose them the hard way.', cs_l_l1: 'Get away from the cruisers and stay out of sight.',
    cs_l_v1: 'Clean. Nobody behind us.', cs_l_v2: "To the lookout on the island. The sun's going down and we're rich.", cs_l_v3: 'NOW can we have music?', cs_l_v4: 'Now, yes.',
    cs_l_c1: 'Bro, where are you going?!',
  });
})();

const HCrewStory = {
  H: null, active: false, run: 0, mode: 'story', step: null, cp: null, snap: null, gear: null, take: 0, copsDown: 0, flags: {},
  jobs: [], subs: [], sub: null, car: null, path: null, goal: null, hold: null, freeze: 0, puppet: null, shotS: null, safe: false, fin: null,
  cash: [], cashTaken: null, todClock: 1, $: null, failing: false, routeT: 0, _objSig: '', _mk: '', _st: null, _stm: null, _subGap: 0,
  POLICE0: (typeof HAI !== 'undefined' && HAI.POLICE_BY_STARS) ? HAI.POLICE_BY_STARS.slice() : [0, 2, 3, 4, 6, 8],
  SRC: 'assets/crew.mp4',
  CUTS: { drive: [0, 3.0], store: [3.04, 4.7], purchase: [7.3, 9.87], vault: [9.88, 14.0], boom: [14.0, 17.33], finale: [17.33, 20.05] },
  // one or two short lines per cut (each stays up long enough to read), scheduled ~0.3 s early because the caption
  // shows up to ~0.35 s after its time; the rest of each exchange is spoken in-engine around the cut (say())
  CAPS: {
    he: {
      drive: [[0, 'עידו: מרגיש כמו בסרט.']],
      store: [[2.9, 'יואב: לא נוגעים בכלום.']],
      purchase: [[7.1, 'עידו: שילמנו. אין דרך חזרה.'], [8.55, '']], // the title card plays clean
      vault: [[9.6, 'יואב: הדלת פתוחה. זה שלנו.'], [11.4, 'הדר: וואו! תראו את זה!']],
      boom: [[13.7, 'הדר: בוווום! ראיתם?!'], [15.6, 'עידו: תחזיקו חזק!']],
      finale: [[17.1, 'עידו: יום טוב במשרד.']],
    },
    en: {
      drive: [[0, 'Ido: Feels like a movie.']],
      store: [[2.9, 'Yoav: Touch nothing.']],
      purchase: [[7.1, 'Ido: Paid. No turning back.'], [8.55, '']],
      vault: [[9.6, "Yoav: The door's open. It's ours."], [11.4, 'Hadar: Whoa! Look at that!']],
      boom: [[13.7, 'Hadar: BOOOM! Did you see?!'], [15.6, 'Ido: Hold on tight!']],
      finale: [[17.1, 'Ido: Good day at the office.']],
    },
  },
  OBJ: ['store', 'shop', 'bank', 'vault', 'pickup', 'trap', 'lose', 'lookout'],
  IDS: ['yoav', 'hadar', 'ido'],
  ACC: { yoav: '#ffd23f', hadar: '#5cf2a8', ido: '#4da3ff' },
  FACE: { yoav: 0, hadar: 1, ido: 2 },
  // input that a staged shot swallows (held keys come back after the frame; edges are dropped)
  KEYS: ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'Enter', 'NumpadEnter',
    'KeyG', 'KeyX', 'KeyH', 'Tab', 'Digit1', 'Digit2', 'Digit3', 'special', 'touchSpecial'],
  KEYS_TUT: ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyE', 'KeyF', 'Enter', 'NumpadEnter',
    'KeyG', 'KeyX', 'KeyH', 'special', 'touchSpecial'],
  CASH_N: 25, CASH_V: 25000,

  /* ======================================================================= lifecycle */
  begin(H, free) {
    this.stop();
    this.H = H; this.active = true; this.run++;
    this.flags = {}; this.jobs = []; this.subs = []; this.sub = null; this.hold = null; this.freeze = 0; this.puppet = null; this.shotS = null; this.safe = false; this.fin = null;
    this.cp = null; this.snap = null; this.take = 0; this.copsDown = 0; this.failing = false; this.car = null; this.path = null; this.goal = null;
    this.gear = { bought: [], left: 0, spent: 0, bombs: 0, nitro: false, jammer: false };
    this._objSig = ''; this._mk = ''; this._camFn = this._camFn || ((dt, c) => this._camApply(dt, c));
    HAI.POLICE_BY_STARS = this.POLICE0.slice();
    this.mod = { preUpdate: dt => this.pre(dt), update: dt => this.tick(dt) };
    (H.mods || (H.mods = [])).unshift(this.mod); // first: a staged shot swallows the input before HCrew / HBoom read it
    if (window.HBoom) { HBoom.init(H); HBoom.reset(); HBoom.keys = true; HBoom.cinematic = true; } // init now: it adds a light (no shader hitch later)
    this.ui(); this._bindAway();
    HMission.allowCrime = false; HMission.mode = 'story'; this.mode = 'story';
    if (free) { this.startFree(true); return; }
    HAI.maxTraffic = 12; HAI.patrols = 0;
    this.setupDrive(HWorld.crewStart.car);
    H.tod = 1.35; H.todTarget = null; H.applyTod(); // golden hour
    this.step = 'intro'; H.state = 'cut';
    if (window.HAudio) { HAudio.music('free'); HAudio.musicIntensity(1); }
    this.cut('drive', () => {
      H.state = 'play';
      HHud.banner(t('cs_title'), t('cs_titleSub'), '', 3.2);
      this.sfx('whoosh');
      this.setStep('toStore');
      this.helpFor(t(Input.touchMode ? 'cs_helpTouch' : 'cs_helpKeys'), 9);
      // the rest of the cut's exchange, then the drive's banter
      this.say('hadar', 'cs_l_d1', 0.4); this.say('yoav', 'cs_l_s1'); this.say('ido', 'cs_l_s2'); this.say('hadar', 'cs_l_s3', 2.5); this.say('yoav', 'cs_l_s4');
    });
  },
  stop() {
    const H = this.H;
    this.run++; this.jobs = []; this.subs = []; this.sub = null; this.hold = null; this.freeze = 0; this.puppet = null; this.safe = false; this.failing = false; this.fin = null;
    this._unstash();
    if (H) {
      if (H.camOverride === this._camFn) H.camOverride = null;
      if (H.mods) H.mods = H.mods.filter(m => m !== this.mod);
    }
    this._unbindAway(); this._reflOff = false;
    this.shotS = null; this.cash = []; this.mod = null;
    if (typeof HAI !== 'undefined') HAI.POLICE_BY_STARS = this.POLICE0.slice(); // chapter 2 keeps its police numbers
    if (HHud.el) HHud.el.classList.remove('cs-cine', 'cs-ch3');
    if (HHud.$ && HHud.$.cut) HHud.$.cut.classList.remove('cs-capl');
    if (this.$ && this.$.root) this.$.root.remove();
    this.$ = null; this._objSig = ''; this._mk = '';
    const r = document.getElementById('hresults'); if (r && r.classList.contains('cs-res')) r.remove();
    if (typeof HMission !== 'undefined') { HMission.route = null; HMission.goal = null; }
    this.active = false; this.H = null; this.car = null;
  },

  /* ======================================================================= helpers */
  at(sec, fn) { this.jobs.push({ t: sec, fn, run: this.run }); },
  // a help line that clears itself after `sec` s, unless something else replaced it meanwhile (delay: show it later;
  // step: only if the story is still there by then)
  helpFor(text, sec, delay, step) {
    const show = () => {
      if (step && this.step !== step) return;
      HHud.help(text);
      if (sec) this.at(sec, () => { const el = HHud.$ && HHud.$.help; if (el && el.textContent === text) HHud.help(''); });
    };
    if (delay) this.at(delay, show); else show();
  },
  ltr(s) { return LANG === 'he' ? '\u2066' + s + '\u2069' : s; }, // Latin / numbers in one piece inside Hebrew text
  // a staged moment starts: the wheel closes and Ido's Focus ends (its slow motion would drag the walks and poses
  // while the shot and its cut run on real time)
  stageIn() { if (window.HCrew && HCrew.active) { HCrew.closeWheel(false); if (HCrew.focus.on) HCrew.setFocus(false); } },
  // pause requests the engine can't take (window blur / a hidden tab / Esc / the pause button during a crew switch or
  // a video cut) are kept and honoured as soon as the game can pause
  _canPause() { const H = this.H; return !!H && (H.state === 'play' || H.state === 'vault' || H.state === 'fail' || H.state === 'interior') && !HHud.cutActive() && !document.getElementById('hresults'); },
  _bindAway() {
    this._unbindAway();
    const want = () => { if (this.active && this.H && this.H.active && !this.H.paused && !this._canPause()) this._pauseWanted = true; };
    const a = this._aw = {
      blur: want,
      vis: () => { if (document.hidden) want(); },
      key: e => { if ((e.code === 'Escape' || e.code === 'KeyP') && this.H && this.H.state === 'switch' && !(window.HCrew && HCrew.wheel.open)) want(); },
      btn: e => { if (e.target && e.target.closest && e.target.closest('.hh-pause')) want(); },
    };
    window.addEventListener('blur', a.blur); document.addEventListener('visibilitychange', a.vis);
    window.addEventListener('keydown', a.key, true); if (HHud.el) { HHud.el.addEventListener('click', a.btn, true); this._awEl = HHud.el; }
  },
  _unbindAway() {
    const a = this._aw; this._pauseWanted = false; if (!a) return;
    window.removeEventListener('blur', a.blur); document.removeEventListener('visibilitychange', a.vis);
    window.removeEventListener('keydown', a.key, true); if (this._awEl) this._awEl.removeEventListener('click', a.btn, true);
    this._aw = null; this._awEl = null;
  },
  sfx(name, o) { if (window.HAudio) HAudio.sfx(name, o); },
  member(id) { return window.HCrew && HCrew.active ? HCrew.member(id) : null; },
  crewIn(car) { if (!car) return false; for (const id of ['hadar', 'yoav']) { const m = this.member(id); if (m && m.seatCar === car) return true; } return false; },
  inCrewCar() { const p = this.H.player; return !!(p && p.inCar && p.inCar === this.car); },
  spd(v) { return v ? Math.hypot(v.vx, v.vz) : 0; },
  cop(x, z, h) { try { return HAI.spawnPolice(HMission.ctx(), { at: { x, z, h } }); } catch (e) { console.error(e); return null; } },
  marker(x, z, col) {
    const k = x === null || x === undefined ? 'off' : x.toFixed(1) + ',' + z.toFixed(1) + ',' + (col || 0);
    if (k === this._mk) return; this._mk = k;
    if (k === 'off') this.H.setMarker(null); else this.H.setMarker(x, z, col);
  },
  // the crew in a car: Ido at the wheel (the player), Hadar in front, Yoav in the back
  setupDrive(spot, o) {
    const H = this.H; o = o || {};
    HCrew.setup(H, {
      members: {
        ido: { car: { x: spot.x, z: spot.z, h: spot.h, kind: 'lux' }, seat: 'driver' },
        hadar: { car: 'ido', seat: 'passenger', masked: !!o.masked },
        yoav: { car: 'ido', seat: 'rearL', masked: !!o.masked },
      }, active: 'ido',
    });
    HCrew.onSwitch = (f, to) => this.onSwitch(f, to); HCrew.canSwitch = null; HCrew.allow(null);
    HCrew.lock(o.lock === undefined ? 'cs_lock_car' : o.lock);
    this.car = H.car;
    if (this.car) { this.car.inp.handbrake = false; if (this.car.rig.setLights) this.car.rig.setLights(H.tod < 1.45); }
    for (const id of ['hadar', 'yoav']) { const m = this.member(id); if (m && m.p.rig.bag) m.p.rig.bag.visible = false; }
    return this.car;
  },
  seatAll(car) { HCrew.seat('ido', car, 'driver'); HCrew.seat('hadar', car, 'passenger'); HCrew.seat('yoav', car, 'rearL'); this.car = car; },
  checkpoint(name, quiet) {
    this.cp = name;
    const bombs = this.flags.bombsLive ? (window.HBoom ? HBoom.bombs : 0) : this.gear.bombs;
    this.snap = { money: HMission.money, take: this.take, bombs, copsDown: this.copsDown };
    if (!quiet) { HHud.toast(t('h_checkpoint'), '#ffd23f'); this.sfx('checkpoint'); }
  },
  setGear(r) {
    const b = (r && r.bought) || [], has = id => b.indexOf(id) >= 0;
    this.gear = { bought: b.slice(), left: Math.max(0, (r && r.left) || 0), spent: (r && r.spent) || 0, bombs: has('bombs') ? 4 : 0, nitro: has('nitro'), jammer: has('jammer') };
    if (window.HBoom) { HBoom.nitro.owned = this.gear.nitro; HBoom.nitro.charge = 1; HBoom.bombs = 0; } // the bombs come out in the chase
    this.applyJammer();
    try { localStorage.setItem('kotc_crew_gear', JSON.stringify(this.gear.bought)); } catch (e) {}
  },
  applyJammer() { HAI.POLICE_BY_STARS = this.gear && this.gear.jammer ? [0, 1, 2, 3, 4, 6] : this.POLICE0.slice(); },

  /* ---------- the GPS route (HMission.route is what the radar draws) ---------- */
  setPath(path, goal) { this.path = path || null; this.goal = goal || (path ? path[path.length - 1] : null); this.routeT = 0; if (!path && !goal) HMission.route = null; },
  updateRoute(pos) {
    const P = this.path, G = this.goal, me = { x: pos.x, z: pos.z };
    if (!P || P.length < 2) { HMission.route = G ? (HMission.computeRoute(pos.x, pos.z, G.x, G.z) || [me, G]) : null; return; }
    // the suggested line ends at the goal (a path may run on past it: the escape continues beyond the trap)
    const gi = this.goalIdx(P);
    let bi = -1, bd = 1e9;
    for (let i = 0; i < gi; i++) {
      const a = P[i], b = P[i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1;
      const u = HX.clamp(((pos.x - a.x) * dx + (pos.z - a.z) * dz) / L2, 0, 1), d = Math.hypot(a.x + dx * u - pos.x, a.z + dz * u - pos.z);
      if (d < bd) { bd = d; bi = i; }
    }
    if (bi >= 0 && bd < 28) { HMission.route = [me].concat(P.slice(bi + 1, gi + 1)); return; }
    // off the line: by road to the join point that makes the whole trip shortest (often straight to the goal), never
    // back to the nearest point of the line and round again
    const Gr = this._graph(pos.x, pos.z); if (!Gr) { HMission.route = [me, P[gi]]; return; }
    let rem = 0, best = null, bc = 1e12;
    for (let k = gi; k >= 0; k--) {
      if (k < gi) rem += Math.hypot(P[k + 1].x - P[k].x, P[k + 1].z - P[k].z);
      const r = this._graphTo(Gr, P[k].x, P[k].z); if (r && r.d + rem < bc - 1) { bc = r.d + rem; best = { k, pts: r.pts }; }
    }
    if (!best) { HMission.route = [me, P[gi]]; return; }
    HMission.route = [me].concat(best.pts, [{ x: P[best.k].x, z: P[best.k].z }], P.slice(best.k + 1, gi + 1));
  },
  goalIdx(P) { const G = this.goal; if (G) for (let i = 0; i < P.length; i++) if (Math.hypot(P[i].x - G.x, P[i].z - G.z) < 3) return i; return P.length - 1; },
  trapIdx(P) { const tr = HWorld.trap; for (let i = 0; i < P.length; i++) if (Math.hypot(P[i].x - tr.x, P[i].z - tr.z) < 3) return i; return P.length - 1; },
  // Dijkstra over the road graph from the node nearest (x, z) (the same graph HMission.computeRoute walks)
  _graph(x, z) {
    const a = HX.nearestNode(x, z); if (!a) return null;
    const dist = new Map([[a, Math.hypot(a.x - x, a.z - z)]]), prev = new Map(), open = [a], done = new Set();
    while (open.length) {
      let bi = 0; for (let k = 1; k < open.length; k++) if (dist.get(open[k]) < dist.get(open[bi])) bi = k;
      const n = open.splice(bi, 1)[0]; if (done.has(n)) continue; done.add(n);
      for (const m of n.nbr) { const d = dist.get(n) + Math.hypot(m.x - n.x, m.z - n.z); if (!dist.has(m) || d < dist.get(m)) { dist.set(m, d); prev.set(m, n); open.push(m); } }
    }
    return { dist, prev };
  },
  _graphTo(G, x, z) { // { d, pts } by road from the graph's start to (x, z)
    const b = HX.nearestNode(x, z); if (!b || !G.dist.has(b)) return null;
    const pts = []; for (let n = b; n; n = G.prev.get(n)) pts.unshift({ x: n.x, z: n.z });
    return { d: G.dist.get(b) + Math.hypot(b.x - x, b.z - z), pts };
  },
  // a point `back` metres behind `pos` along a path (for cruisers on the player's tail)
  behind(P, pos, back) {
    let bi = 0, bd = 1e9, bu = 0;
    for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1; const u = HX.clamp(((pos.x - a.x) * dx + (pos.z - a.z) * dz) / L2, 0, 1), d = Math.hypot(a.x + dx * u - pos.x, a.z + dz * u - pos.z); if (d < bd) { bd = d; bi = i; bu = u; } }
    if (bd > 30) return null;
    let i = bi, rem = back, a = P[i], b = P[i + 1], segL = Math.hypot(b.x - a.x, b.z - a.z), along = bu * segL;
    while (rem > along && i > 0) { rem -= along; i--; a = P[i]; b = P[i + 1]; segL = Math.hypot(b.x - a.x, b.z - a.z); along = segL; }
    const s = Math.max(0, along - rem) / (segL || 1);
    return { x: a.x + (b.x - a.x) * s, z: a.z + (b.z - a.z) * s, h: Math.atan2(b.x - a.x, b.z - a.z), seg: bi }; // seg: the leg the car is on
  },

  /* ---------- objectives: a window of the list (the one done before, the current one, the next two) ---------- */
  setObj(key, cur) {
    const sig = key + '|' + (cur || '') + '|' + LANG;
    if (sig === this._objSig) return; this._objSig = sig;
    const i = this.OBJ.indexOf(key), lines = [];
    for (let k = Math.max(0, i - 1); k < Math.min(this.OBJ.length, i + 3); k++) lines.push({ t: k === i && cur ? t(cur) : t('cs_o_' + this.OBJ[k]), done: k < i, cur: k === i });
    HHud.setObjective(t('cs_title'), lines);
  },

  /* ---------- cutscenes (segments of assets/crew.mp4) ---------- */
  cut(name, done) {
    const H = this.H, r = this.run, [a, b] = this.CUTS[name];
    const caps = (this.CAPS[LANG] || this.CAPS.he)[name] || [];
    if (window.HBoom && HBoom.calm) HBoom.calm();
    if (window.HAudio) HAudio.duck(true);
    if (H.state === 'loading') H.state = 'cut';
    HHud.prompt(); this.subClear();
    if (HHud.$ && HHud.$.cut) HHud.$.cut.classList.toggle('cs-capl', name === 'finale');
    HHud.playCut(a, b, caps, () => { if (this.run !== r || !this.active || !H.active) return; if (window.HAudio) HAudio.duck(false); if (done) done(); }, this.SRC);
  },

  /* ---------- staged shots (Heist.camOverride, function form: a slow dolly between two poses) ---------- */
  shot(o) { this.stageIn(); this.shotS = Object.assign({ t: 0, dur: 4, fov: 50 }, o); this.H.camOverride = this._camFn; this.cine(true); },
  cine(on) { if (HHud.el) HHud.el.classList.toggle('cs-cine', !!on); if (this.$ && !on) this.$.strobe.classList.remove('on'); }, // letterbox + the HUD steps aside
  endShot(snap) {
    const H = this.H; this.shotS = null; this.cine(false);
    if (this._reflOff && H && H.active) { this._reflOff = false; H.applyTod(); } // the wet-road reflections come back
    if (H && H.camOverride === this._camFn) H.camOverride = null;
    if (snap && window.HCrew && HCrew.active && HCrew.cur()) HCrew._snapCam(HCrew.cur());
  },
  _camApply(dt, c) {
    const s = this.shotS, H = this.H; if (!s) return;
    s.t += H.realDt || dt;
    const u = HX.clamp(s.t / s.dur, 0, 1), e = u * u * (3 - 2 * u);
    const f = s.from, g = s.to || s.from, A = s.look, B = s.look2 || s.look;
    const sh = s.shake ? s.shake * Math.max(0, 1 - s.t * 1.5) : 0, r = () => (Math.random() - 0.5) * sh;
    c.position.set(f.x + (g.x - f.x) * e + r(), f.y + (g.y - f.y) * e + r(), f.z + (g.z - f.z) * e + r());
    c.fov = s.fov + ((s.fov2 || s.fov) - s.fov) * e; c.updateProjectionMatrix();
    c.lookAt(A.x + (B.x - A.x) * e, A.y + (B.y - A.y) * e, A.z + (B.z - A.z) * e);
    H.cam.x = c.position.x; H.cam.y = c.position.y; H.cam.z = c.position.z;
  },
  // the car stays put (and settles onto a spot) while a staged moment plays
  holdCar(v, x, z, h) { this.hold = v ? { v, x: x === undefined ? v.x : x, z: z === undefined ? v.z : z, h: h === undefined ? v.h : h } : null; },

  /* ---------- named subtitles (in-engine dialogue) ---------- */
  say(id, key, delay, fn) { this.subs.push({ id, key, delay: delay || 0, fn }); }, // fn: runs when the line comes up
  subClear() { this.subs = []; this.sub = null; if (this.$) this.$.sub.classList.remove('on'); },
  subTick(rdt) {
    if (!this.$) return;
    if (this.sub) {
      this.sub.t += rdt;
      if (this.sub.t >= this.sub.dur) { this.sub = null; this.$.sub.classList.remove('on'); this._subGap = 0.3; }
      return;
    }
    if (this._subGap > 0) { this._subGap -= rdt; return; }
    const q = this.subs[0]; if (!q) return;
    if (q.delay > 0) { q.delay -= rdt; return; }
    this.subs.shift();
    const txt = t(q.key) || '', $ = this.$;
    $.sub.style.setProperty('--ac', this.ACC[q.id] || '#fff');
    $.subN.textContent = t('cr_s_' + q.id) || q.id; $.subT.textContent = txt;
    $.sub.classList.add('on');
    this.sub = { t: 0, dur: 1.7 + txt.length * 0.055 };
    if (q.fn) { try { q.fn(); } catch (e) { console.error(e); } }
  },

  /* ======================================================================= the frame */
  // mods.preUpdate (before the street logic): a staged shot swallows the player's input
  pre(dt) {
    if (!this.active) return;
    let keys = null;
    if (this.freeze === 1) keys = this.KEYS;
    else if (this.freeze === 2 && !(window.HCrew && HCrew.wheel.open)) keys = this.KEYS_TUT; // the tutorial: only the switch keys work
    if (!keys) return;
    const st = this._st = [];
    for (const k of keys) { if (Input.keys.has(k)) { st.push(k); Input.keys.delete(k); } Input.pressed.delete(k); }
    if (Input.sticks && Input.sticks.move) { this._stm = Input.sticks.move; Input.sticks.move = null; }
    if (window.HBoom) { HBoom._tapBomb = false; HBoom._holdNos = false; }
  },
  _unstash() {
    if (this._st) { for (const k of this._st) Input.keys.add(k); this._st = null; }
    if (this._stm) { if (Input.sticks && !Input.sticks.move) Input.sticks.move = this._stm; this._stm = null; }
  },
  // mods.update (every simulated frame, any state): the job clock, holds, puppets, subtitles, small perks
  tick(dt) {
    if (!this.active) return;
    const H = this.H, rdt = H.realDt || dt;
    this._unstash();
    if (this.jobs.length) {
      const due = [];
      for (let i = this.jobs.length - 1; i >= 0; i--) { const j = this.jobs[i]; j.t -= rdt; if (j.t <= 0) { this.jobs.splice(i, 1); due.push(j); } }
      for (let i = due.length - 1; i >= 0; i--) { const j = due[i]; if (j.run === this.run && this.active) { try { j.fn(); } catch (e) { console.error(e); } } }
    }
    const hd = this.hold;
    if (hd && hd.v && H.state === 'play') {
      const v = hd.v, k = 1 - Math.exp(-7 * dt);
      v.x += (hd.x - v.x) * k; v.z += (hd.z - v.z) * k; v.h += HX.wrapAngle(hd.h - v.h) * k;
      v.vx = v.vz = 0; v.vF = v.vR = 0; v.w = 0; v.inp.throttle = 0; v.inp.handbrake = true;
      HVehicle.sync(v, 0);
    }
    const pp = this.puppet, p = H.player;
    if (pp && H.state === 'play' && p && !p.inCar) { // the active member walks on his own in a staged shot
      const dx = pp.x - p.x, dz = pp.z - p.z, d = Math.hypot(dx, dz);
      if (d > 0.25) { const s = Math.min(d, pp.speed * dt); p.x += dx / d * s; p.z += dz / d * s; p.h += HX.wrapAngle(Math.atan2(dx, dz) - p.h) * Math.min(1, dt * 10); p.vx = p.vz = 0; p.at = (p.at || 0) + dt * pp.speed / 4.2; p.rig.setPose('walk', p.at, 0.75); H.syncPlayer(); }
      else p.rig.setPose('idle', H.time, 1);
    }
    if (this.freeze && H.state === 'play') HHud.prompt();
    if (this._pauseWanted && !H.paused && this._canPause()) { this._pauseWanted = false; H.pause(); return; }
    // low staged shots at golden hour: the wet-road reflection shows jagged neon streaks under the car, so it's off while one runs
    if (this.shotS && H.reflK) { H.reflK.value = 0; this._reflOff = true; }
    if (this.step === 'finale' && this.fin) this.finaleTick(rdt);
    if (this.step === 'vault' && !this.flags.fuseLine && window.HCrewVault && HCrewVault.phase === 'fuse') { this.flags.fuseLine = true; this.say('yoav', 'cs_l_f1', 1.3); } // the countdown, before the blast
    const wheel = !!(window.HCrew && HCrew.wheel.open);
    if (this.step === 'switchTut') this.showTut(!wheel && !HCrew.busy()); // the card makes way for the wheel (and comes back if it's cancelled)
    if (this.$ && wheel !== this._dim) { this._dim = wheel; this.$.root.classList.toggle('cs-dim', wheel); }
    this.perks(dt);
    this.subTick(rdt);
  },
  perks(dt) {
    const H = this.H, p = H.player; if (!p || H.state !== 'play' || !(window.HCrew && HCrew.active)) return;
    // the masks' plate carriers: a masked member on foot takes 40% less damage
    const m = HCrew.cur();
    if (m && m.masked && !p.inCar && this._hp !== undefined && this._hpP === p && p.hp < this._hp) p.hp = this._hp - (this._hp - p.hp) * 0.6;
    this._hp = p.hp; this._hpP = p;
    // the radio jammer (and the masks: the cameras can't name you) make the cops lose you faster
    if (HAI.wanted > 0 && !HAI.seen && HAI.lockWanted === 0) HAI.lastSeen -= dt * ((this.gear.jammer ? 0.6 : 0) + (this.crewMasked() ? 0.2 : 0));
  },
  crewMasked() { const a = this.member('hadar'), b = this.member('yoav'); return !!(a && a.masked) || !!(b && b.masked); },

  // HMission.update -> here (street 'play' only)
  update(dt) {
    if (!this.active) return;
    const H = this.H, p = H.player; if (!p) return;
    if (this.mode === 'free') { this.freeUpdate(dt); return; }
    const v = p.inCar, pos = v || p;
    this.routeT -= dt; if (this.routeT <= 0) { this.routeT = 0.6; if (this.path || this.goal) this.updateRoute(pos); }
    // the crew's car is gone (wrecked, burnt out) while the player is out of it: that's the end of this try
    const riding = ['toStore', 'toBank', 'escape', 'lose', 'toLookout'].indexOf(this.step) >= 0;
    if (riding && this.car && !this.failing && (this.car.wrecked || !this.car.rig.group.parent) && p.inCar !== this.car) { this.fail('wasted'); return; }
    switch (this.step) {
      case 'toStore': this.driveTo('store', HWorld.gunStore.park, 7.5, () => this.arriveStore()); break;
      case 'toBank': this.driveTo('bank', HWorld.bank.park, 8, () => { this.checkpoint('bank'); this.suitUp(); }); break;
      case 'walkIn': this.walkInUpdate(dt); break;
      case 'pickup': this.pickupUpdate(dt); break;
      case 'escape': this.escapeUpdate(dt); break;
      case 'lose':
        if (!this.inCrewCar()) this.backToCar('lose'); else { this.setObj('lose'); this.marker(null); }
        if (HAI.wanted === 0) this.evaded();
        break;
      case 'toLookout':
        if (pos.x > 200) { H.todTarget = 1.35 - 0.35 * HX.clamp((pos.x - 250) / 600, 0, 1); H.todRate = 0.45; } // the sun goes down as you head east
        this.driveTo('lookout', HWorld.lookout.carSpot, 11, () => this.finale());
        break;
    }
  },
  backToCar(key) {
    this.setObj(key, 'cs_o_car');
    if (this.car && this.car.rig.group.parent) this.marker(this.car.x, this.car.z, 0x4da3ff);
  },
  // drive the crew's car into a marker (slowly): arrive()
  driveTo(key, spot, r, arrive) {
    const H = this.H, p = H.player;
    if (!this.inCrewCar()) { this.backToCar(key); return; }
    this.setObj(key); this.marker(spot.x, spot.z);
    const v = p.inCar, d = Math.hypot(v.x - spot.x, v.z - spot.z);
    if (d < r) {
      if (v.wrecked) { if (!this.flags.burnMsg) { this.flags.burnMsg = true; HHud.toast(t('cs_burn'), '#ff9a8a'); } return; } // it's about to blow: no staged arrival in it
      if (this.spd(v) < 7.5) arrive();
      else if (!this.flags['slow' + key]) { this.flags['slow' + key] = true; HHud.toast(t('cs_slow'), '#ffd23f'); }
    }
  },
  setStep(s) {
    const W = HWorld, P = W.crewPaths || {};
    this.step = s;
    if (s === 'toStore') { this.setObj('store'); this.setPath(P.toStore || null, W.gunStore.park); HCrew.lock('cs_lock_car'); }
    else if (s === 'toBank') { this.setObj('bank'); this.setPath(P.toBank || null, W.bank.park); HCrew.lock('cs_lock_car'); if (window.HAudio) { HAudio.music('free'); HAudio.musicIntensity(1); } }
    else if (s === 'lose') { this.setObj('lose'); this.setPath(null); this.marker(null); HCrew.lock('cs_lock_job'); }
    else if (s === 'toLookout') { this.setObj('lookout'); this.setPath(P.toLookout || null, W.lookout.carSpot); HCrew.lock('cs_lock_car'); }
  },

  /* ======================================================================= 1-2: the armory */
  arriveStore() {
    const gs = HWorld.gunStore, car = this.car, door = gs.door;
    this.step = 'storeStage'; this.marker(null); this.setPath(null); HHud.help(''); this.subClear();
    this.stageIn(); this.freeze = 1; this.holdCar(car, gs.park.x, gs.park.z, gs.park.h);
    // across the street, looking at the bay and the green glass doors
    const ax = door.x - gs.park.x, az = door.z - gs.park.z, L = Math.hypot(ax, az) || 1, ux = ax / L, uz = az / L;
    const cx = gs.park.x - ux * 13, cz = gs.park.z - uz * 13;
    this.shot({ from: { x: cx - uz * 6, y: 1.5, z: cz + ux * 6 }, to: { x: cx - uz * 3.5, y: 1.9, z: cz + ux * 3.5 }, look: { x: (door.x + gs.park.x) / 2, y: 1.4, z: (door.z + gs.park.z) / 2 }, dur: 3.2, fov: 46 });
    this.at(0.6, () => {
      HCrew.unseat('hadar'); HCrew.unseat('yoav'); this.sfx('door');
      HCrew.walkTo('hadar', door.x - uz * 0.7 - ux * 0.3, door.z + ux * 0.7 - uz * 0.3, {});
      HCrew.walkTo('yoav', door.x + uz * 0.7 - ux * 0.5, door.z - ux * 0.7 - uz * 0.5, {});
    });
    this.at(0.95, () => { HCrew.unseat('ido'); this.sfx('door', { vol: 0.8 }); this.puppet = { x: door.x - ux * 1.2, z: door.z - uz * 1.2, speed: 3 }; });
    this.say('hadar', 'cs_l_st1', 0.3);
    this.at(2.5, () => HHud.fade(1, 0.45));
    this.at(3.0, () => { this.endShot(false); this.hold = null; this.puppet = null; this.freeze = 0; this.cut('store', () => this.openShop()); });
  },
  openShop() {
    const H = this.H; this.step = 'shop'; this.setObj('shop');
    HCrew.lock('cs_lock_shop'); HHud.fade(1, 0);
    if (window.HShop) HShop.open(H, { budget: 62000, onDone: r => this.afterShop(r) });
    else this.afterShop({ bought: ['masks', 'thermal'], spent: 35500, left: 26500 });
  },
  afterShop(r) {
    if (!this.active || this.step !== 'shop') return;
    const gs = HWorld.gunStore;
    HHud.fade(1, 0);
    this.setGear(r);
    const car = this.car;
    if (!car || car.wrecked || !car.rig.group.parent) this.setupDrive(gs.park); // the car didn't make it: a fresh one, the crew in it
    else this.seatAll(car);
    HCrew.teleport('ido', gs.park.x, gs.park.z, gs.park.h); // nose out of the bay, toward the bank
    HCrew.lock('cs_lock_car');
    this.step = 'postShop';
    this.cut('purchase', () => {
      HHud.fade(0, 0.7);
      this.checkpoint('store');
      this.setStep('toBank');
      this.say('yoav', 'cs_l_b1', 2); this.say('hadar', 'cs_l_b2', 3); this.say('ido', 'cs_l_b3');
      if (this.gear.nitro) this.helpFor(t(Input.touchMode ? 'cs_helpNitroT' : 'cs_helpNitro'), 7, 5, 'toBank');
    });
  },

  /* ======================================================================= 3: the bank, the masks and the first switch */
  suitUp() {
    const bk = HWorld.bank, car = this.car;
    this.step = 'suitUp'; this.setObj('bank'); this.marker(null); this.setPath(null); HHud.help(''); this.subClear();
    this.stageIn(); HCrew.lock('cs_lock_car'); this.freeze = 1; this.holdCar(car, bk.park.x, bk.park.z, bk.park.h);
    // a low three-quarter shot from the far kerb: the car side-on, the bank behind it
    const fx = Math.sin(bk.park.h), fz = Math.cos(bk.park.h), ox = -fz, oz = fx; // car forward / car side
    const away = Math.hypot(bk.park.x + ox * 7 - bk.door.x, bk.park.z + oz * 7 - bk.door.z) > Math.hypot(bk.park.x - ox * 7 - bk.door.x, bk.park.z - oz * 7 - bk.door.z) ? 1 : -1; // the kerb away from the bank
    const cx = bk.park.x + ox * away * 8.5 + fx * 5, cz = bk.park.z + oz * away * 8.5 + fz * 5;
    this.shot({ from: { x: cx, y: 1.25, z: cz }, to: { x: cx - fx * 2.5, y: 1.6, z: cz - fz * 2.5 }, look: { x: bk.park.x + fx * 0.5, y: 1.0, z: bk.park.z + fz * 0.5 }, look2: { x: bk.park.x - fx * 1.2, y: 1.25, z: bk.park.z - fz * 1.2 }, dur: 4.2, fov: 48 });
    this.say('yoav', 'cs_l_u1', 0.3);
    this.at(0.6, () => { HCrew.unseat('hadar'); HCrew.unseat('yoav'); this.sfx('door'); });
    const mask = (id) => {
      HCrew.setMasked(id, true); const m = this.member(id); if (!m) return;
      const q = m.p; HFX3.glowBurst(q.x, 1.3, q.z, 0.6, 0.7, 0.8, 14, 2.5); for (let k = 0; k < 4; k++) HFX3.puff(q.x + (Math.random() - 0.5) * 0.6, 0.9 + k * 0.2, q.z + (Math.random() - 0.5) * 0.6, 0, 0, 0.6);
      this.sfx('whoosh', { intensity: 0.5, vol: 0.8 });
    };
    this.at(1.15, () => { mask('hadar'); HCrew.setPose('hadar', 'cheer'); HHud.banner(t('cs_suit'), '', '', 1.8); });
    this.at(1.45, () => { mask('yoav'); HCrew.setPose('yoav', 'point'); });
    this.say('ido', 'cs_l_u2', 0.4); this.say('hadar', 'cs_l_u3');
    this.at(3.0, () => { HCrew.setPose('hadar', 'idle'); HCrew.setPose('yoav', 'idle'); });
    this.at(3.9, () => {
      // Hadar and Yoav turn toward the bank's corner: the first switch lands on Hadar looking the right way
      const c = { x: bk.front.x, z: bk.park.z + Math.sign(bk.front.z - bk.park.z) * 3.5 };
      for (const id of ['hadar', 'yoav']) { const m = this.member(id); if (m && !m.seat) HCrew.teleport(id, m.p.x, m.p.z, Math.atan2(c.x - m.p.x, c.z - m.p.z)); }
      this.endShot(true); this.tutorial();
    });
  },
  tutorial() {
    this.step = 'switchTut'; this.freeze = 2; // the car waits; only the switch keys work
    this.setObj('bank', 'cs_o_switch');
    HCrew.lock(null); HCrew.allow(['hadar']);
    this.showTut(true); this.sfx('whoosh', { intensity: 0.4 }); this.sfx('ui');
    // the wheel opens on its own after a beat (the player can also hold Tab / press 2 / tap the strip right away)
    this.at(2.6, () => {
      if (this.step !== 'switchTut' || HCrew.curId !== 'ido' || HCrew.busy()) return;
      if (!HCrew.wheel.open && HCrew.openWheel('sticky')) HCrew._wheelSel('hadar');
      this.showTut(false);
      this.at(HCrew.wheel.open ? 6.5 : 0.6, () => this.forceHadar());
    });
    this.at(16, () => this.forceHadar());
  },
  forceHadar() {
    if (this.step !== 'switchTut' || HCrew.curId === 'hadar' || HCrew.busy()) return;
    if (HCrew.wheel.open) { HCrew._wheelSel('hadar'); HCrew.closeWheel(true); }
    if (HCrew.curId !== 'hadar' && !HCrew.busy()) HCrew.switchTo('hadar', { force: true, quick: true });
  },
  onSwitch(from, to) {
    if (this.mode !== 'story') return;
    if (this.step === 'switchTut' && to === 'hadar') this.afterFirstSwitch();
    else if ((this.step === 'vault' || this.step === 'alarm') && window.HCrewVault && HCrewVault.active) HCrewVault.setActive(to);
  },
  afterFirstSwitch() {
    const bk = HWorld.bank;
    this.step = 'walkIn'; this.freeze = 0; this.hold = null; this.showTut(false);
    HCrew.allow(null); HCrew.lock('cs_lock_walk');
    this.setObj('bank', 'cs_o_walk'); this.marker(bk.door.x, bk.door.z);
    // around the corner on the sidewalk, along the portico, up the steps
    const f = bk.front, corner = { x: f.x, z: bk.park.z + Math.sign(f.z - bk.park.z) * 3.5 };
    this.setPath([{ x: bk.park.x, z: bk.park.z }, corner, { x: f.x, z: f.z }, { x: bk.door.x, z: bk.door.z }], bk.door);
    this.trail = []; this.followT = 0; this.stuckT = 0; this._yl = null;
    if (window.HAudio) { HAudio.music('stealth'); HAudio.musicIntensity(1); }
    this.say('yoav', 'cs_l_w1', 1.2); this.say('hadar', 'cs_l_w2');
    this.helpFor(t('cs_helpWalk'), 7, 1, 'walkIn');
  },
  walkInUpdate(dt) {
    const H = this.H, p = H.player, bk = HWorld.bank, A = HCrew.cur();
    if (!A || A.id !== 'hadar') return;
    this.setObj('bank', p.inCar ? 'cs_o_foot' : 'cs_o_walk'); this.marker(bk.door.x, bk.door.z);
    // Yoav follows Hadar's footsteps (a breadcrumb trail keeps him off the building corners)
    const tr = this.trail, last = tr[tr.length - 1], hp = p.inCar || p;
    if (!last || Math.hypot(last.x - hp.x, last.z - hp.z) > 1) { tr.push({ x: hp.x, z: hp.z }); if (tr.length > 60) tr.shift(); }
    const Y = this.member('yoav');
    this.followT -= dt;
    if (Y && !Y.hidden && !Y.seat && this.followT <= 0) {
      this.followT = 0.35;
      const yp = Y.p, d = Math.hypot(yp.x - hp.x, yp.z - hp.z);
      let tgt = null; for (let i = tr.length - 1; i >= 0; i--) if (Math.hypot(tr[i].x - hp.x, tr[i].z - hp.z) > 2.6) { tgt = tr[i]; break; }
      if (d > 2.8 && tgt) {
        HCrew.walkTo('yoav', tgt.x, tgt.z, { run: d > 6 });
        if (this._yl && Math.hypot(this._yl.x - yp.x, this._yl.z - yp.z) < 0.3) this.stuckT += 0.35; else this.stuckT = 0;
        if (this.stuckT > 3 && d > 8) { HCrew.teleport('yoav', tgt.x, tgt.z, Math.atan2(hp.x - tgt.x, hp.z - tgt.z)); this.stuckT = 0; }
      } else if (Y.walk && d < 2.2) Y.walk = null;
      this._yl = { x: yp.x, z: yp.z };
    }
    if (!p.inCar && Math.hypot(p.x - bk.door.x, p.z - bk.door.z) < 2.6) this.enterBank();
  },

  /* ======================================================================= 4-5: the vault */
  enterBank() {
    const H = this.H, bk = HWorld.bank;
    this.step = 'vaultIn'; this.freeze = 1; this.marker(null); this.setPath(null); HHud.help(''); this.subClear();
    HHud.fade(1, 0.4); this.sfx('door');
    this.at(0.45, () => {
      const ha = this.member('hadar'), yo = this.member('yoav');
      if (yo) { yo.walk = null; HCrew.teleport('yoav', bk.door.x + 0.9, bk.door.z + 0.6, Math.PI / 2); }
      HCrew.lock(null); HCrew.allow(['hadar', 'yoav']);
      this.freeze = 0; this.step = 'vault'; this._objSig = '';
      const act = HCrew.curId === 'yoav' ? 'yoav' : 'hadar';
      HCrewVault.open(H, {
        members: [{ id: 'hadar', rig: ha.p.rig }, { id: 'yoav', rig: yo.p.rig }], active: act, timer: 45,
        onBlown: () => this.cut('vault', () => { if (HCrewVault.active) HCrewVault.resume(); this.say('yoav', 'cs_l_grab', 1.2); }),
        onAlarm: () => { if (this.step === 'vault') { this.step = 'alarm'; this.at(1.9, () => this.leaveVault()); } },
        onExit: () => this.leaveVault(),
      });
      HHud.fade(0, 0.5);
      this.helpFor(t(Input.touchMode ? 'cs_helpVaultT' : 'cs_helpVault'), 12);
    });
  },
  leaveVault() {
    if (this.step !== 'vault' && this.step !== 'alarm') return;
    const H = this.H, bk = HWorld.bank;
    this.step = 'alarmOut'; HHud.fade(1, 0.3); HHud.help('');
    this.at(0.35, () => {
      const r = HCrewVault.active ? HCrewVault.close() : (HCrewVault.result ? HCrewVault.result() : null);
      HCrew.allow(null); HCrew.lock('cs_lock_job');
      this.take = (r && r.cash) || 0; this.vaultRes = r;
      if (this.take > 0) HMission.addMoney(this.take);
      for (const id of ['hadar', 'yoav']) { const m = this.member(id); if (m && m.p.rig.bag) m.p.rig.bag.visible = true; HCrew.show(id, false); } // still inside
      this.freeze = 1; this._objSig = ''; this.setObj('pickup');
      // outside: the bank's portico, the alarm ringing
      const d = bk.door, f = bk.front, ux = f.x - d.x, uz = f.z - d.z, L = Math.hypot(ux, uz) || 1, nx = ux / L, nz = uz / L;
      this.shot({ from: { x: f.x + nx * 17 - nz * 9, y: 1.1, z: f.z + nz * 17 + nx * 9 }, to: { x: f.x + nx * 15 - nz * 7, y: 1.9, z: f.z + nz * 15 + nx * 7 }, look: { x: d.x, y: 5.5, z: d.z }, dur: 3.0, fov: 52, shake: 0.08 });
      HHud.fade(0, 0.35); H.doFlash(0.9, 0.12, 0.1, 0.35); if (this.$) this.$.strobe.classList.add('on');
      if (window.HAudio) { HAudio.sfx('alarm'); HAudio.music('drive'); HAudio.musicIntensity(2); }
      this.say('yoav', 'cs_l_a1');
      this.at(2.9, () => {
        this.endShot(false);
        const ok = HCrew.switchTo('ido', { force: true, sky: true, onDone: () => this.startPickup() });
        if (!ok) { HCrew.switchTo('ido', { force: true, instant: true }); this.startPickup(); }
      });
    });
  },

  /* ======================================================================= 5-6: the pickup and the trap */
  startPickup() {
    if (this.step !== 'alarmOut' || !this.active) return;
    const H = this.H, bk = HWorld.bank, P = HWorld.crewPaths || {};
    this.freeze = 0; this.step = 'pickup';
    this.car = H.car;
    this.checkpoint('pickup', true);
    HAI.maxTraffic = 14; HAI.lockWanted = 3; HAI.setWanted(3, 'heist');
    this.cop(bk.park.x + 100, bk.park.z - 3.5, -Math.PI / 2); this.cop(HX.L(4) - 3.5, bk.back.z + 45, Math.PI);
    HHud.banner(t('h_wanted'), '', 'busted', 2.2);
    if (window.HAudio) { HAudio.music('drive'); HAudio.musicIntensity(3); }
    this.setObj('pickup'); this.setPath(P.pickup || null, bk.back);
    this.say('ido', 'cs_l_a2', 0.5);
    this.grace(4, 'pickup'); // a moment to read the banner and get going
  },
  pickupUpdate() {
    const H = this.H, p = H.player, bk = HWorld.bank, v = p.inCar;
    if (!v) { this.setObj('pickup', 'cs_o_car'); if (H.car && H.car.rig.group.parent) this.marker(H.car.x, H.car.z, 0x4da3ff); return; } // any car will do
    this.setObj('pickup'); this.marker(bk.back.x, bk.back.z);
    if (Math.hypot(v.x - bk.back.x, v.z - bk.back.z) < 8.5) { if (v.wrecked) { if (!this.flags.burnMsg) { this.flags.burnMsg = true; HHud.toast(t('cs_burn'), '#ff9a8a'); } } else if (this.spd(v) < 8) this.boarding(); else if (!this.flags.slowBack) { this.flags.slowBack = true; HHud.toast(t('cs_slow'), '#ffd23f'); } }
  },
  boarding() {
    const H = this.H, bk = HWorld.bank, v = H.player.inCar;
    this.step = 'boarding'; this.car = v; this.freeze = 1; this.safe = true; this.marker(null); this.setPath(null);
    this.stageIn(); this.holdCar(v, bk.back.x, bk.back.z, v.h);
    const bd = bk.backDoor || { x: bk.back.x, z: bk.back.z - 11 };
    // from across the street: the car in front, the back door behind it
    const dx = bk.back.x - bd.x, dz = bk.back.z - bd.z, L = Math.hypot(dx, dz) || 1, nx = dx / L, nz = dz / L;
    this.shot({ from: { x: bk.back.x + nx * 11 - nz * 7, y: 1.6, z: bk.back.z + nz * 11 + nx * 7 }, to: { x: bk.back.x + nx * 10 - nz * 5, y: 2.2, z: bk.back.z + nz * 10 + nx * 5 }, look: { x: (bk.back.x + bd.x) / 2, y: 1.3, z: (bk.back.z + bd.z) / 2 }, dur: 3.6, fov: 54 });
    this.sfx('door', { vol: 1.2 });
    const left = { hadar: true, yoav: true };
    const seat = (id, s) => {
      if (!left[id] || this.step !== 'boarding') return; left[id] = false;
      const m = this.member(id); if (m && m.p.rig.bag) m.p.rig.bag.visible = false;
      HCrew.seat(id, v, s); this.sfx('door', { vol: 0.9 });
      if (!left.hadar && !left.yoav) this.at(0.45, () => this.startEscape());
    };
    this.at(0.3, () => {
      [['hadar', 'passenger', -0.8], ['yoav', 'rearL', 0.8]].forEach(([id, s, o]) => {
        const m = this.member(id); if (!m) { left[id] = false; return; }
        HCrew.show(id, true); HCrew.teleport(id, bd.x + nz * o, bd.z - nx * o, Math.atan2(dx, dz));
        if (m.p.rig.bag) m.p.rig.bag.visible = true; // out they come with the bags (the carry walk)
        HCrew.setPose(id, 'idle');
        const ds = HCrew._doorSpot(v, s);
        const go = () => HCrew.walkTo(id, ds.x, ds.z, { onArrive: () => seat(id, s) });
        // the far side (that door faces the street): round the back of the car first
        const near = Math.hypot(ds.x - bd.x, ds.z - bd.z) < Math.hypot(v.x - bd.x, v.z - bd.z);
        if (near) go(); else HCrew.walkTo(id, v.x - Math.sin(v.h) * (v.half + 1.4), v.z - Math.cos(v.h) * (v.half + 1.4), { onArrive: go });
      });
      this.say('hadar', 'cs_l_g1', 0.6);
    });
    this.at(4.4, () => { if (this.step === 'boarding') { seat('hadar', 'passenger'); seat('yoav', 'rearL'); } });
  },
  startEscape(restored) {
    if (!this.active) return;
    const H = this.H, P = HWorld.crewPaths || {}, tr = HWorld.trap;
    this.step = 'escape'; this.freeze = 0; this.hold = null; this.safe = false;
    Object.assign(this.flags, { trapDone: false, nearTrap: false, trapHint: false, assistN: 0, missed: false }); this.assistT = 0;
    this.car = H.player.inCar || this.car;
    if (!restored) this.endShot(true);
    if (window.HAudio) HAudio.sfx('alarmStop');
    if (window.HBoom) {
      HBoom.bombs = this.snap && this.cp === 'pickup' ? this.snap.bombs : this.gear.bombs; this.flags.bombsLive = true;
      HBoom.nitro.owned = this.gear.nitro;
      HBoom.placeTrap(tr.x, tr.z, { range: 135, onDetonate: n => this.afterTrap(n) });
    }
    this.setObj('trap'); this.setPath(P.escape || null, { x: tr.x, z: tr.z }); this.marker(tr.x, tr.z, 0xff5a3d);
    HCrew.lock('cs_lock_job');
    this.helpFor(t(Input.touchMode ? 'cs_helpEscT' : 'cs_helpEsc'), 10);
    this.say('yoav', 'cs_l_e1', restored ? 1 : 0.2); this.say('yoav', Input.touchMode ? 'cs_l_e2t' : 'cs_l_e2');
    if (this.gear.bombs > 0) this.say('hadar', 'cs_l_e3', 1);
  },
  escapeUpdate(dt) {
    const H = this.H, p = H.player, tr = HWorld.trap, T = window.HBoom && HBoom.trap;
    if (!this.inCrewCar()) { this.backToCar('trap'); return; }
    this.setObj('trap'); if (T && T.armed) this.marker(tr.x, tr.z, 0xff5a3d); else this.marker(null);
    const v = p.inCar, d = Math.hypot(v.x - tr.x, v.z - tr.z);
    // make the moment happen: on the way in, keep two cruisers right on the tail (at the player's speed), so some are in
    // the kill zone just after the car passes the cylinders. Only while the car drives along a leg before the trap, and
    // only clearly behind it (never from the far side of the trap: they would come head-on)
    this.assistT = (this.assistT || 0) - dt;
    if (!this.flags.nearTrap && d < 160 && d > 50 && (this.flags.assistN || 0) < 2 && this.assistT <= 0) {
      this.assistT = 1.2;
      let tail = 0; for (const c of HAI.police) if (!c.wrecked && !c.ai.retire && Math.hypot(c.x - v.x, c.z - v.z) < 46) tail++;
      const P = HWorld.crewPaths && HWorld.crewPaths.escape, q0 = tail < 2 && P ? this.behind(P, v, 0) : null;
      const sg = q0 ? q0.seg : -1, A = sg >= 0 ? P[sg] : null, B = sg >= 0 ? P[sg + 1] : null;
      if (A && sg < this.trapIdx(P) && v.vx * (B.x - A.x) + v.vz * (B.z - A.z) > 0) {
        this.flags.assistN = (this.flags.assistN || 0) + 1;
        const sp = Math.max(14, Math.hypot(v.vx, v.vz) * 0.92), fx = Math.sin(v.h), fz = Math.cos(v.h);
        for (const back of [22, 34].slice(0, 2 - tail)) {
          const q = this.behind(P, v, back); if (!q) continue;
          if ((q.x - v.x) * fx + (q.z - v.z) * fz > -10) continue; // not clearly behind the car
          let clear = true; for (const o of HAI.traffic.concat(HAI.police)) if (Math.hypot(o.x - q.x, o.z - q.z) < 6) clear = false;
          if (!clear) continue;
          const c = this.cop(q.x, q.z, q.h); if (c) { c.vx = Math.sin(q.h) * sp; c.vz = Math.cos(q.h) * sp; c.vF = sp; HVehicle.sync(c, 0); }
        }
      }
    }
    if (d < 45) this.flags.nearTrap = true;
    if (window.HBoom && HBoom.trapReady() && !this.flags.trapHint) { // the beat: slow motion + Yoav's shout
      this.flags.trapHint = true; HBoom.slowmo(1.7, 0.42); if (HBoom.lookBack) HBoom.lookBack(2.6);
      this.subClear(); HHud.help(''); this.say('yoav', 'cs_l_t1'); this.sfx('beep', { pitch: 1.5, vol: 1.2 });
    }
    // missed it (drove past, or went another way): that's fine, lose them the hard way
    if (T && T.armed && ((this.flags.nearTrap && d > 175) || d > 380)) this.missTrap();
  },
  missTrap() {
    if (this.step !== 'escape') return;
    this.flags.missed = true; HAI.lockWanted = 0;
    this.checkpoint('trap', true);
    this.setStep('lose');
    HHud.toast(t('cs_trapMissed'), '#ff9a8a'); this.say('yoav', 'cs_l_m1');
  },
  afterTrap(n) {
    if (!this.active || this.failing || this.flags.trapDone || (this.step !== 'escape' && this.step !== 'lose') || this.H.state !== 'play') return;
    this.flags.trapDone = true;
    // cinematic licence: the fireball took the whole pack (every cruiser still around the junction burns)
    const tr = HWorld.trap; let more = 0;
    if (window.HBoom) for (const c of HAI.police.slice()) if (!c.wrecked && c.rig.group.parent && Math.hypot(c.x - tr.x, c.z - tr.z) < 40) more += HBoom.explode(c.x, 0.9, c.z, { power: 1.1, radius: 6, quiet: true, quietToast: true, noScorch: true });
    const down = (n || 0) + more; this.copsDown += down;
    this.step = 'trapCut'; this.marker(null); this.setPath(null); HHud.help('');
    this.cut('boom', () => {
      this.afterBoomPlace();
      HAI.lockWanted = 0; if (HAI.wanted > 2) HAI.setWanted(2, 'trap');
      this.checkpoint('trap');
      this.setStep('lose');
      if (down > 0) HHud.toast(down === 1 ? t('bm_copDown') : t('bm_copsDown', { n: down }), '#ffd23f'); // (the module's own toast went off under the cut)
      if (window.HAudio) { HAudio.music('drive'); HAudio.musicIntensity(2); }
      this.say('yoav', 'cs_l_t2', 0.5); this.say('ido', 'cs_l_t3'); this.say('yoav', 'cs_l_l1', 3);
    });
  },
  // after the boom cut, carry on from the video's drift: the lux sliding round the corner at the end of the trap's street
  // (not flat out toward the beach), the pack burning behind it, any surviving cruiser close by dropping back
  afterBoomPlace() {
    const H = this.H, v = this.inCrewCar() ? H.player.inCar : null; if (!v) return;
    const P = HWorld.crewPaths && HWorld.crewPaths.escape, ti = P ? this.trapIdx(P) : -1, A = P && P[ti], B = P && P[ti + 1], C = P && P[ti + 2];
    let placed = false;
    if (A && B && C) {
      const L1 = Math.hypot(B.x - A.x, B.z - A.z) || 1, u1 = { x: (B.x - A.x) / L1, z: (B.z - A.z) / L1 };
      const L2 = Math.hypot(C.x - B.x, C.z - B.z) || 1, u2 = { x: (C.x - B.x) / L2, z: (C.z - B.z) / L2 };
      const along = (v.x - A.x) * u1.x + (v.z - A.z) * u1.z, off = Math.abs((v.x - A.x) * u1.z - (v.z - A.z) * u1.x);
      if (along > -8 && along < L1 + 30 && off < 16) { // through the trap on its street (the usual way): into the corner
        const r2 = { x: -u2.z, z: u2.x }; // the right-hand side of the new street
        const x = B.x - u1.x * 2 + u2.x * 4 + r2.x * 4.2, z = B.z - u1.z * 2 + u2.z * 4 + r2.z * 4.2;
        const h = Math.atan2(u1.x * 0.12 + u2.x * 0.88, u1.z * 0.12 + u2.z * 0.88), mv = Math.atan2(u1.x * 0.5 + u2.x * 0.5, u1.z * 0.5 + u2.z * 0.5), sp = 15; // nose almost down the new street, still sliding out of the turn
        const r = HX.resolveCircle(x, z, 1.2);
        v.x = r.x; v.z = r.z; v.h = h; v.vx = Math.sin(mv) * sp; v.vz = Math.cos(mv) * sp;
        const fx = Math.sin(h), fz = Math.cos(h); v.vF = v.vx * fx + v.vz * fz; v.vR = v.vx * -Math.cos(h) + v.vz * Math.sin(h);
        v.w = HX.wrapAngle(h - Math.atan2(u2.x, u2.z)) * 2.2; // still turning in (h - w*dt)
        placed = true;
      }
    }
    if (!placed) { const s = this.spd(v); if (s > 16) { v.vx *= 16 / s; v.vz *= 16 / s; v.vF *= 16 / s; v.vR *= 16 / s; } }
    HVehicle.sync(v, 0);
    if (window.HCrew && HCrew.cur()) HCrew._snapCam(HCrew.cur());
    for (const c of HAI.police) if (!c.wrecked && Math.hypot(c.x - v.x, c.z - v.z) < 70) c.ai.retire = true; // fresh ones come in from further out
  },

  /* ======================================================================= 7: the lookout */
  evaded() {
    if (this.step !== 'lose') return;
    this.checkpoint('evaded', true);
    this.setStep('toLookout');
    HAI.patrols = 0;
    this.say('ido', 'cs_l_v1', 1.2); this.say('yoav', 'cs_l_v2'); this.say('hadar', 'cs_l_v3', 4); this.say('ido', 'cs_l_v4');
    this.at(16, () => { if (this.step === 'toLookout' && window.HAudio) { HAudio.music('free'); HAudio.musicIntensity(1); } });
  },
  finale() {
    const H = this.H;
    this.step = 'finale'; this.freeze = 1; this.holdCar(this.car); this.marker(null); this.setPath(null); this.subClear(); HHud.help('');
    this.stageIn(); if (window.HBoom) HBoom.calm();
    HMission.stats.time = H.time - HMission.stats.t0;
    HHud.fade(1, 0.5);
    this.at(0.55, () => {
      const lk = HWorld.lookout, cs = lk.carSpot, st = this.finaleStaging();
      H.state = 'done'; this.hold = null; this.freeze = 0;
      HAI.lockWanted = 0; HAI.setWanted(0); for (const c of HAI.police) c.ai.retire = true;
      if (window.HBoom) HBoom.reset(true);
      HCrew.teleport('ido', cs.x, cs.z, cs.h);
      const v = this.car; if (v) { v.x = cs.x; v.z = cs.z; v.h = cs.h; v.vx = v.vz = 0; v.vF = v.vR = 0; v.w = 0; v.inp.throttle = 0; v.inp.handbrake = true; HVehicle.sync(v, 0); }
      for (const id of this.IDS) { const q = st.crew[id]; HCrew.unseat(id, q.x, q.z, q.h); HCrew.setPose(id, 'idle'); }
      HCrew.setMasked('hadar', false); HCrew.setMasked('yoav', false);
      for (const id of this.IDS) { const m = this.member(id); if (m && m.p.rig.bag) m.p.rig.bag.visible = false; }
      H.tod = 1.0; H.todTarget = null; H.applyTod();
      this.shot(st.shot);
      HHud.setObjective('', []); HHud.prompt(); this._objSig = '';
      if (window.HAudio) HAudio.music(null);
      HHud.fade(0, 0.9);
      this.fin = { t: 0, st };
      // the last exchange, then the three-way high five on Hadar's line
      this.say('ido', 'cs_l_fin1', 0.6); this.say('yoav', 'cs_l_fin2'); this.say('hadar', 'cs_l_fin3', 0, () => { if (this.fin && this.fin.hf === undefined) this.fin.hf = this.fin.t; });
    });
  },
  // the lookout, as tight as the video's last shot: the trio shoulder to shoulder in front of the car, the sun and the
  // skyline behind them; the camera starts on HWorld.lookout.cam and pushes in to waist-up
  finaleStaging() {
    const lk = HWorld.lookout, c = lk.cam, O = { x: lk.x, z: lk.z };
    let dx = c.lx - c.x, dz = c.lz - c.z; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L;
    const rx = -dz, rz = dx, at = (k, back, y) => ({ x: O.x + rx * k + dx * back, y: y || 0, z: O.z + rz * k + dz * back });
    const face = s => Math.atan2(-dx + rx * s, -dz + rz * s); // facing the camera, turned toward screen-right by s
    const crew = { hadar: { ...at(-0.6, 0.55), h: face(0.3), s0: 0.3, s1: 2.4 }, ido: { ...at(0, 0.72), h: face(0.08), s0: 0.08, s1: -0.35 }, yoav: { ...at(0.62, 0.5), h: face(-0.35), s0: -0.35, s1: -2.2 } };
    return {
      crew, face, meet: at(-0.06, 0.4, 1.9), // where the three right hands meet: just over Ido's head, a touch toward Hadar
      shot: { from: { x: c.x, y: c.y, z: c.z }, to: at(0, -2.55, 1.3), look: { x: c.lx, y: c.ly, z: c.lz }, look2: at(0, 0.6, 1.42), dur: 7.5, fov: c.fov || 40, fov2: 31 },
    };
  },
  _ease(u) { u = HX.clamp(u, 0, 1); return u * u * (3 - 2 * u); },
  finaleTick(rdt) {
    const f = this.fin, st = f.st; f.t += rdt;
    if (f.hf === undefined && f.t > 10) f.hf = f.t; // (the lines didn't play: go anyway)
    const u = f.hf === undefined ? -1 : f.t - f.hf;
    // the high five: the three right hands up together (0.32 s), the slap, a beat, back down
    const k = u < 0 ? 0 : u < 0.32 ? this._ease(u / 0.32) : u < 0.7 ? 1 : u < 1.25 ? 1 - this._ease((u - 0.7) / 0.55) : 0;
    const turn = u < 0 ? 0 : u < 0.3 ? this._ease(u / 0.3) : u < 1.3 ? 1 : 1 - this._ease((u - 1.3) / 0.6);
    for (const id of this.IDS) {
      const m = this.member(id), q = st.crew[id]; if (!m) continue;
      m.p.h = st.face(q.s0 + (q.s1 - q.s0) * turn); // turning toward each other
      const rig = m.p.rig, o = rig.outfit || {}, sx = (o.build || 1) * (o.height || 1), sy = o.height || 1, h = m.p.h, wx = st.meet.x - m.p.x, wz = st.meet.z - m.p.z;
      rig.reach = { x: (wx * Math.cos(h) - wz * Math.sin(h)) / sx, y: st.meet.y / sy, z: (wx * Math.sin(h) + wz * Math.cos(h)) / sx }; // the meeting point in the rig's own frame
      const cheer = id === 'hadar' && u > 1.25 && u < 2.4;
      HCrew.setPose(id, k > 0.01 ? 'highfive' : cheer ? 'cheer' : 'idle', k > 0.01 ? k : 1);
    }
    if (u >= 0.3 && !f.slap) { f.slap = true; this.sfx('land', { intensity: 0.55, vol: 1 }); this.sfx('heistComplete'); this.passedBanner(true); }
    if (u >= 2.6 && !f.cut) { f.cut = true; this.passedBanner(false); this.cut('finale', () => this.results()); }
  },
  // the in-engine beat is only the respect chips (the video right after carries the big MISSION PASSED card)
  passedBanner(on) {
    if (!this.$) return; const el = this.$.pass;
    if (on) {
      el.querySelector('.cs-rl').textContent = t('cs_respect');
      el.hidden = false; void el.offsetWidth; el.classList.add('on');
      this.sfx('star', { vol: 0.8 });
    } else { el.classList.remove('on'); setTimeout(() => { if (this.$ && this.$.pass === el && !el.classList.contains('on')) el.hidden = true; }, 500); }
  },
  results() {
    const H = this.H, s = HMission.stats, el = document.createElement('section');
    this.step = 'results'; this.fin = null; this._pauseWanted = false;
    for (const m of HCrew.members || []) if (m.p && m.p.rig) m.p.rig.reach = null;
    if (document.pointerLockElement) { try { document.exitPointerLock(); } catch (e) {} } // the buttons need the cursor
    const change = this.gear.left || 0;
    if (change > 0 && !this.flags.changeAdded) { this.flags.changeAdded = true; HMission.money += change; HHud.setMoney(HMission.money); }
    const total = HMission.money;
    el.className = 'screen dim cs-res'; el.id = 'hresults'; el.style.zIndex = 9;
    const tm = Math.max(0, s.time || 0), mm = Math.floor(tm / 60), ss = String(Math.floor(tm % 60)).padStart(2, '0');
    const money = n => '$' + Math.round(n).toLocaleString('en-US');
    const gear = this.gear.bought.length ? this.gear.bought.map(id => window.HShop ? HShop.itemName(id) : id).join(' · ') : t('cs_r_none');
    const cops = Math.max(this.copsDown, (window.HBoom && HBoom.stats) ? HBoom.stats.cops : 0);
    const cards = ['hadar', 'ido', 'yoav'].map(id => `<div class="cs-card" style="--ac:${this.ACC[id]}"><i style="--fx:${this.FACE[id] * 50}%"></i><div><b>${t('cr_n_' + id)}</b><small>${t('cr_r_' + id)}</small><em>${t('cs_respect')} <bdi>+100</bdi></em></div></div>`).join('');
    el.innerHTML = `<div class="panel"><h2 class="cs-rt">${t('cs_resTitle')}</h2><p>${t('cs_resText')}</p>
      <div class="cs-crew">${cards}</div>
      <div class="statlist"><div><span>${t('cs_r_vault')}</span><b dir="ltr">${money(this.take)}</b></div><div><span>${t('cs_r_change')}</span><b dir="ltr">${money(change)}</b></div>
      <div><span>${t('cs_r_total')}</span><b dir="ltr">${money(total)}</b></div><div><span>${t('s_time')}</span><b dir="ltr">${mm}:${ss}</b></div>
      <div><span>${t('h_s_stars')}</span><b>${'★'.repeat(Math.max(1, s.maxWanted || 0))}</b></div><div><span>${t('cs_r_cops')}</span><b dir="ltr">${cops}</b></div>
      <div class="cs-wide"><span>${t('cs_r_gear')}</span><b class="cs-gear"></b></div><div class="cs-wide"><span>${t('h_s_busted')}</span><b dir="ltr">${s.busted || 0}</b></div></div>
      <button class="btn big" type="button" data-a="free">${t('cs_free')}</button><button class="btn" type="button" data-a="menu">${t('quit')}</button></div>`;
    el.querySelector('.cs-gear').textContent = gear;
    H.stage.appendChild(el);
    this.sfx('missionComplete');
    try {
      localStorage.setItem('kotc_crew_done', '1');
      const b = +(localStorage.getItem('kotc_crew_best') || 0); if (total > b) localStorage.setItem('kotc_crew_best', String(total));
    } catch (e) {}
    el.querySelector('[data-a=free]').addEventListener('click', () => { el.remove(); if (this.active) this.startFree(false); });
    el.querySelector('[data-a=menu]').addEventListener('click', () => { el.remove(); H.quit(); });
    setTimeout(() => { const b = el.querySelector('[data-a=free]'); if (b && el.isConnected) b.focus(); }, 60);
  },

  /* ======================================================================= fail / restore */
  fail(kind) {
    const H = this.H; if (!this.active || !H || this.failing || H.state !== 'play') return;
    if (this.step === 'finale' || this.step === 'results') return;
    this.failing = true; H.state = 'fail'; if (HMission.stats) HMission.stats.busted++;
    this.run++; this.jobs = []; this.subClear(); this.endShot(false); this.freeze = 0; this.hold = null; this.puppet = null; this.safe = false; this.showTut(false);
    HCrew.closeWheel(false); if (window.HBoom) HBoom.calm();
    HHud.banner(kind === 'busted' ? t('h_busted') : t('h_wasted'), '', kind, 2.8); HHud.prompt(); HHud.help('');
    if (window.HAudio) { HAudio.sfx(kind); HAudio.music(null); }
    H.doFlash(kind === 'busted' ? 0.1 : 0.6, 0.1, 0.12, 0.5);
    this.at(2.2, () => HHud.fade(1, 0.6));
    this.at(3.0, () => { this.failing = false; if (this.mode === 'free') this.restoreFree(); else this.restore(); HHud.fade(0, 0.6); });
  },
  restore() {
    const H = this.H, W = HWorld, s = this.snap || {}, cp = this.cp;
    this.run++; this.jobs = []; this.subClear(); this.endShot(false); this.freeze = 0; this.hold = null; this.puppet = null; this.safe = false; this.failing = false; this.showTut(false); this.passedBanner(false);
    this.normalTime();
    if (window.HCrewVault && HCrewVault.active) HCrewVault.close();
    if (window.HShop && HShop.active) HShop.close(true);
    HHud.prompt(); HHud.help(''); this._objSig = ''; this._mk = '';
    this.flags = { trapDone: !!this.flags.trapDone, missed: !!this.flags.missed };
    HAI.reset(); HAI.maxTraffic = 12; HAI.patrols = 0;
    if (window.HBoom) HBoom.reset(true);
    HMission.money = s.money || 0; HHud.resetMoney(HMission.money); this.take = s.take || 0; this.copsDown = s.copsDown || 0;
    if (window.HAudio) HAudio.sfx('alarmStop');
    H.todTarget = null;
    if (!cp) { // before the store: from the top, no gear
      this.gear = { bought: [], left: 0, spent: 0, bombs: 0, nitro: false, jammer: false }; this.applyJammer();
      if (window.HBoom) { HBoom.bombs = 0; HBoom.nitro.owned = false; }
      this.setupDrive(W.crewStart.car); H.tod = 1.35; H.applyTod(); H.state = 'play';
      this.setStep('toStore');
      if (window.HAudio) { HAudio.music('free'); HAudio.musicIntensity(1); }
      return;
    }
    if (window.HBoom) { HBoom.nitro.owned = this.gear.nitro; HBoom.nitro.charge = 1; HBoom.bombs = 0; }
    this.flags.bombsLive = false;
    if (cp === 'store') {
      this.setupDrive(W.gunStore.park); H.tod = 1.35; H.applyTod(); H.state = 'play'; this.setStep('toBank');
    } else if (cp === 'bank') {
      this.setupDrive(W.bank.park); H.tod = 1.35; H.applyTod(); H.state = 'play'; this.suitUp();
    } else if (cp === 'pickup') { // at the back door with the crew aboard and 3 stars
      const b = W.bank.back; this.setupDrive({ x: b.x, z: b.z, h: b.h }, { masked: true, lock: 'cs_lock_job' }); H.tod = 1.35; H.applyTod(); H.state = 'play';
      HAI.maxTraffic = 14; HAI.lockWanted = 3; HAI.setWanted(3, 'retry');
      const bh = b.h, fx = Math.sin(bh), fz = Math.cos(bh);
      this.cop(b.x - fx * 55, b.z - fz * 55, bh); this.cop(b.x - fx * 75 + fz * 3.5, b.z - fz * 75 - fx * 3.5, bh);
      if (window.HAudio) { HAudio.music('drive'); HAudio.musicIntensity(3); }
      this.startEscape(true);
      this.grace(3.5, 'escape');
    } else if (cp === 'trap') { // just past the trap, 2 stars
      const tr = W.trap, h = Math.PI / 2, x = tr.x + 26, z = tr.z - 3.5;
      this.setupDrive({ x, z, h }, { masked: true, lock: 'cs_lock_job' }); H.tod = 1.35; H.applyTod(); H.state = 'play';
      if (window.HBoom) HBoom.bombs = s.bombs || 0; this.flags.bombsLive = true; this.flags.trapDone = true;
      HAI.maxTraffic = 14; HAI.setWanted(2, 'retry');
      this.cop(x - 60, tr.z + 3.5, h); this.cop(x - 80, tr.z - 3.5, h);
      if (window.HAudio) { HAudio.music('drive'); HAudio.musicIntensity(2); }
      this.setStep('lose');
    } else if (cp === 'evaded') { // on the causeway, heading for the island
      const x = HX.BRIDGE_X0 + 14;
      this.setupDrive({ x, z: 2.5, h: Math.PI / 2 }, { masked: true }); H.tod = 1.3; H.applyTod(); H.state = 'play';
      if (window.HBoom) HBoom.bombs = s.bombs || 0; this.flags.bombsLive = true; this.flags.trapDone = true;
      this.setStep('toLookout');
      if (window.HAudio) { HAudio.music('free'); HAudio.musicIntensity(1); }
    }
  },

  // no slow motion, no grade carried over from before (a checkpoint retry / free roam always starts at normal speed)
  normalTime() { const H = this.H; if (!H) return; if (window.HBoom && HBoom.calm) HBoom.calm(); H.timeScale = 1; H.desat = 0; H.desatTint = [1, 1, 1]; if (H.canvas) H.canvas.style.filter = ''; },
  // a few seconds in which the cops can't bust you (after a scripted spawn or a retry: time to read and get going)
  grace(sec, step) { this.safe = true; this.at(sec, () => { if (this.step === step) this.safe = false; }); },

  /* ======================================================================= 8: free roam */
  startFree(fresh) {
    const H = this.H;
    this.run++; this.jobs = []; this.subClear(); this.endShot(false); this.freeze = 0; this.hold = null; this.puppet = null; this.safe = false; this.failing = false; this.showTut(false); this.passedBanner(false);
    this.normalTime(); this._pauseWanted = false;
    if (window.HCrewVault && HCrewVault.active) HCrewVault.close();
    if (window.HShop && HShop.active) HShop.close(true);
    this.mode = 'free'; this.step = 'free'; this.fin = null; this._objSig = ''; this._mk = '';
    HMission.mode = 'free'; HMission.allowCrime = true; this.setPath(null); HMission.route = null; this.marker(null);
    HAI.reset(); HAI.lockWanted = 0; HAI.patrols = 2; HAI.maxTraffic = 16;
    let gear = this.gear && this.gear.bought.length ? this.gear.bought : null;
    if (!gear) { try { gear = JSON.parse(localStorage.getItem('kotc_crew_gear') || '[]'); } catch (e) { gear = []; } }
    if (!Array.isArray(gear)) gear = [];
    this.gear = Object.assign({ left: 0, spent: 0 }, this.gear || {}, { bought: gear, bombs: 0, nitro: true, jammer: gear.indexOf('jammer') >= 0 });
    this.applyJammer();
    if (fresh && !HMission.money) { try { HMission.money = +(localStorage.getItem('kotc_crew_best') || 0); } catch (e) {} }
    this.setupFree(fresh ? 'ido' : (HCrew.curId || 'ido'));
    H.state = 'play'; H.todTarget = null; H.tod = 1; this.todClock = 1; H.applyTod();
    if (window.HBoom) { HBoom.reset(); HBoom.bombs = 3 + (gear.indexOf('bombs') >= 0 ? 2 : 0); HBoom.nitro.owned = true; HBoom.nitro.charge = 1; this.flags.bombsLive = true; }
    HHud.resetMoney(HMission.money);
    try { this.cashTaken = new Set(JSON.parse(localStorage.getItem('kotc_crew_cash') || '[]')); } catch (e) { this.cashTaken = new Set(); }
    this.spawnCash();
    this.freeObjective();
    HHud.banner(t('cs_freeTitle'), t('cs_freeSub'), '', 3.5);
    this.helpFor(t(Input.touchMode ? 'cs_o_freeSwT' : 'cs_o_freeSw'), 8);
    if (window.HAudio) { HAudio.sfx('alarmStop'); HAudio.music('free'); HAudio.musicIntensity(0); }
  },
  setupFree(active) {
    // each one at home, turned toward his own car (the first frame shows the member and his ride, not a wall)
    const H = this.H, hm = HWorld.crewHomes, mk = (id, kind, color) => { const h = hm[id]; return { x: h.x, z: h.z, h: Math.atan2(h.car.x - h.x, h.car.z - h.z), car: { x: h.car.x, z: h.car.z, h: h.car.h, kind, color } }; };
    HCrew.setup(H, { members: { yoav: mk('yoav', 'coupe', 0xf1ede2), hadar: mk('hadar', 'sports', 0x2f5a44), ido: mk('ido', 'lux') }, active: active || 'ido' });
    HCrew.onSwitch = (f, to) => this.onSwitch(f, to); HCrew.canSwitch = null; HCrew.allow(null); HCrew.lock(null);
    this.car = H.car;
  },
  cashSpots() {
    const R = HX.rng(3033), spots = [];
    for (const l of HWorld.lots) if (spots.length < 60) { if (l.park) spots.push([(l.x0 + l.x1) / 2, (l.z0 + l.z1) / 2]); else if (R() < 0.2) spots.push([l.x0 - 2.2, (l.z0 + l.z1) / 2]); }
    for (let k = 0; k < 5; k++) spots.push([300 + R() * 22, -230 + k * 105 + R() * 30]);
    const hm = HWorld.crewHomes; for (const id of this.IDS) { const h = hm[id]; spots.push([h.x + 9 * Math.sin(h.h + 1.2), h.z + 9 * Math.cos(h.h + 1.2)]); }
    spots.push([560, 6], [890, -20], [925, 25], [-160, -50], [130, 150]);
    for (let k = spots.length - 1; k > 0; k--) { const j = Math.floor(R() * (k + 1)); [spots[k], spots[j]] = [spots[j], spots[k]]; }
    return spots;
  },
  spawnCash() {
    const H = this.H, T = H.T;
    for (const c of this.cash) if (c.obj && c.obj.parent) c.obj.parent.remove(c.obj);
    this.cash = [];
    let beamM = null, beamG = null; // only for stand-in bags (HModels bags bring their own beam)
    this.cashSpots().slice(0, this.CASH_N).forEach(([x, z], k) => {
      const r = HX.resolveCircle(x, z, 0.5); x = r.x; z = r.z;
      const id = 'k' + k, taken = this.cashTaken.has(id), g = new T.Group(); g.position.set(x, 0, z);
      let bag = null; if (window.HModels && HModels.cashBag) { try { bag = HModels.cashBag(); } catch (e) { bag = null; } }
      if (!bag) { bag = new T.Mesh(new T.BoxGeometry(0.7, 0.45, 0.4), new T.MeshStandardMaterial({ color: 0x2e7d4f, emissive: 0x1a5a35, roughness: 0.5 })); bag.position.y = 0.5; H.linearize(bag); }
      g.add(bag);
      if (!bag.update) {
        if (!beamM) { beamM = new T.MeshBasicMaterial({ color: 0x5cf2a8, transparent: true, opacity: 0.25, blending: T.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false, side: T.DoubleSide }); beamG = new T.CylinderGeometry(0.35, 0.35, 40, 10, 1, true); beamG.translate(0, 20, 0); }
        const beam = new T.Mesh(beamG, beamM); g.add(beam); beam.layers.enable(1);
      }
      g.visible = !taken; H.scene.add(g);
      this.cash.push({ id, x, z, obj: g, bag, taken });
    });
  },
  freeObjective() {
    const got = this.cash.filter(c => c.taken).length;
    HHud.setObjective(t('cs_freeTitle'), [{ t: t('h_o_cash', { n: got, m: this.cash.length }), cur: got < this.cash.length, done: got >= this.cash.length }, { t: t(Input.touchMode ? 'cs_o_freeSwT' : 'cs_o_freeSw'), cur: false }]);
  },
  freeUpdate(dt) {
    const H = this.H, p = H.player, pos = p.inCar || p;
    this.todClock = (this.todClock + dt / 60) % 4; // day / night: 4 minutes for the whole cycle
    const c = this.todClock; H.tod = c < 2 ? c : 4 - c; H.applyTod();
    for (const k of this.cash) {
      if (k.taken) continue;
      if (k.bag.update) k.bag.update(H.time + k.x * 0.1); else { k.bag.rotation.y += dt * 1.6; k.bag.position.y = 0.55 + Math.sin(H.time * 2 + k.x) * 0.12; }
      if (Math.abs(k.x - pos.x) < 4 && Math.abs(k.z - pos.z) < 4 && Math.hypot(k.x - pos.x, k.z - pos.z) < (p.inCar ? 3.4 : 1.8)) {
        k.taken = true; k.obj.visible = false; this.cashTaken.add(k.id);
        try { localStorage.setItem('kotc_crew_cash', JSON.stringify([...this.cashTaken])); } catch (e) {}
        const n = Math.round(this.CASH_V * HCrew.cashBonus()); // Yoav's eye for cash: +25%
        HMission.addMoney(n); this.sfx(n > this.CASH_V ? 'bigCash' : 'cash');
        HFX3.glowBurst(k.x, 1, k.z, 0.36, 0.95, 0.66, 30, 6);
        this.freeObjective();
        if (this.cash.every(q => q.taken)) { HHud.banner(t('h_allBags'), this.ltr('+$1,000,000'), 'green', 3.5); HMission.addMoney(1000000); this.sfx('heistComplete'); }
        try { const b = +(localStorage.getItem('kotc_crew_best') || 0); if (HMission.money > b) localStorage.setItem('kotc_crew_best', String(HMission.money)); } catch (e) {}
      }
    }
    if (window.HAudio) { HAudio.music(HAI.wanted > 0 ? 'drive' : 'free'); HAudio.musicIntensity(Math.min(3, HAI.wanted)); }
  },
  restoreFree() {
    const H = this.H, id = HCrew.curId || 'ido';
    this.run++; this.jobs = []; this.normalTime();
    HMission.money = Math.floor(HMission.money * 0.9); HHud.resetMoney(HMission.money);
    HAI.reset(); HAI.lockWanted = 0; HAI.patrols = 2; HAI.maxTraffic = 16;
    if (window.HBoom) { const b = HBoom.bombs; HBoom.reset(true); HBoom.bombs = Math.max(b, 2); }
    this.setupFree(id);
    H.state = 'play'; this._mk = ''; this.marker(null);
    this.freeObjective();
    if (window.HAudio) HAudio.music('free');
  },

  /* ======================================================================= engine hooks */
  blips() {
    const out = [], H = this.H; if (!this.active || !H) return out;
    const p = H.player, mine = p && p.inCar;
    if (this.goal && this.mode === 'story' && ['lose', 'finale', 'results', 'trapCut'].indexOf(this.step) < 0) out.push({ x: this.goal.x, z: this.goal.z, kind: 'goal', edge: true, label: '★' });
    if (window.HCrew && HCrew.active) for (const m of HCrew.members) { if (m.id === HCrew.curId || m.hidden || (mine && m.seatCar === mine)) continue; const v = m.p.inCar || m.seatCar, q = v || m.p; out.push({ x: q.x, z: q.z, col: m.accent, edge: true }); }
    if (this.mode === 'free' && p) {
      const pos = p.inCar || p, R = HCrew.radarRange ? HCrew.radarRange() : 320; // Yoav sees cash from farther away
      for (const c of this.cash) if (!c.taken && Math.abs(c.x - pos.x) < R && Math.abs(c.z - pos.z) < R && Math.hypot(c.x - pos.x, c.z - pos.z) < R) out.push({ x: c.x, z: c.z, kind: 'cash' });
    }
    return out;
  },
  safeZone(x, z) {
    if (this.safe || this.freeze === 1) return true;
    if (this.mode === 'free' && HWorld.crewHomes) for (const id of this.IDS) { const h = HWorld.crewHomes[id]; if (h && Math.abs(x - h.x) < 6 && Math.abs(z - h.z) < 6) return true; }
    return false;
  },
  onEnterCar(v) {},
  onExitCar(v) {
    if (this.mode === 'story' && v === this.car && this.crewIn(v) && !this.freeze && !this.flags.exitLine) { this.flags.exitLine = true; this.say('hadar', 'cs_l_c1'); }
  },

  /* ======================================================================= UI: subtitles, the switch tutorial, MISSION PASSED */
  CSS: `
  #cs-ui { position:absolute; inset:0; pointer-events:none; z-index:3; }
  #cs-ui .cs-lb { position:absolute; left:0; right:0; height:52px; background:#000; transform:scaleY(0); transition:transform .45s cubic-bezier(.3,.7,.2,1); }
  #cs-ui .cs-lb.t { top:0; transform-origin:top; } #cs-ui .cs-lb.b { bottom:0; transform-origin:bottom; }
  #hhud.cs-cine #cs-ui .cs-lb { transform:scaleY(1); }
  #hhud.cs-cine > .hh-obj, #hhud.cs-cine > .hh-tr, #hhud.cs-cine > .hh-speed, #hhud.cs-cine > .hh-help, #hhud.cs-cine > .hh-prompt, #hhud.cs-cine > .bm-gad, #hhud.cs-cine > .bm-prompt, #hhud.cs-cine #cr-ui .cr-strip { opacity:0 !important; transition:opacity .3s; }
  #cs-ui .cs-strobe { position:absolute; inset:0; opacity:0; background:radial-gradient(ellipse 80% 80% at 50% 50%, rgba(255,0,30,0) 45%, rgba(255,20,40,.42) 100%); }
  #cs-ui .cs-strobe.on { animation:csstrobe .5s steps(2, jump-none) infinite; }
  @keyframes csstrobe { 0% { opacity:.95; background:radial-gradient(ellipse 80% 80% at 50% 50%, rgba(255,0,30,0) 45%, rgba(255,20,40,.42) 100%); } 100% { opacity:.8; background:radial-gradient(ellipse 80% 80% at 50% 50%, rgba(0,40,255,0) 45%, rgba(40,70,255,.36) 100%); } }
  #cs-ui .cs-sub { position:absolute; left:50%; bottom:60px; max-width:820px; width:max-content; padding:8px 18px 9px; border-radius:10px; background:rgba(6,5,14,.66); box-shadow:0 6px 18px rgba(0,0,0,.35);
    font:600 21px/1.3 var(--body); color:#fff; text-align:center; text-shadow:0 2px 3px #000; opacity:0; transform:translate(-50%, 8px) scale(var(--u)); transform-origin:bottom center; transition:opacity .25s, transform .25s; }
  #cs-ui .cs-sub.on { opacity:1; transform:translate(-50%, 0) scale(var(--u)); }
  #cs-ui .cs-sub b { color:var(--ac, #fff); font-weight:900; margin-inline-end:8px; }
  #hhud.touch #cs-ui .cs-sub { bottom:100px; max-width:600px; font-size:19px; }
  #cs-ui.cs-dim .cs-sub, #hhud.cr-sky #cs-ui .cs-sub { opacity:0; } /* the wheel / the sky cam's name card */
  /* chapter 3 only: a toast with no letters ("+$5,000") reads left to right in Hebrew too */
  [dir="rtl"] #hhud.cs-ch3 .hh-toast { unicode-bidi:plaintext; }
  /* phones: the help line stays clear of the right-thumb buttons; the objectives wrap before the centred crew strip */
  #hhud.cs-ch3.touch .hh-help { max-width:calc(600px / var(--u)); }
  #hhud.cs-ch3.touch:has(.cr-strip.cr-mid) .hh-obj { min-width:0; max-width:330px; } /* (the strip is centred in the vault) */
  /* the finale cut: the caption stays left of the video's own MISSION PASSED panel */
  #hcut.cs-capl .caption { left:4%; right:46%; }
  #cs-ui .cs-tut { position:absolute; left:50%; top:calc(30px + 182px * min(var(--u), 1.3)); width:max-content; max-width:1100px; display:flex; align-items:center; gap:18px; padding:14px 26px 14px 16px; border-radius:18px; text-align:start;
    background:linear-gradient(180deg, rgba(18,16,34,.94), rgba(8,7,18,.9)); border:1px solid rgba(255,255,255,.16); box-shadow:0 16px 44px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.1);
    opacity:0; transform:translate(-50%, -14px) scale(.94); transform-origin:top center; transition:opacity .3s, transform .4s cubic-bezier(.2,1.35,.4,1); }
  [dir="rtl"] #cs-ui .cs-tut { padding:14px 16px 14px 26px; }
  #cs-ui .cs-tut.on { opacity:1; transform:translate(-50%, 0) scale(min(var(--u), 1.3)); }
  #cs-ui .cs-tut .cs-tf { display:flex; padding-inline-start:12px; }
  #cs-ui .cs-tut .cs-tf i { position:relative; width:52px; height:52px; border-radius:50%; margin-inline-start:-12px; border:3px solid var(--ac); background:#111 url(assets/crew_faces.jpg) var(--fx) 0% / 300% 100% no-repeat; box-shadow:0 0 0 2px rgba(0,0,0,.6), 0 0 16px var(--ac); }
  #cs-ui .cs-tut .cs-tf i.cs-go { transform:scale(1.18); z-index:1; animation:cspulse .7s ease-in-out infinite alternate; }
  @keyframes cspulse { to { box-shadow:0 0 0 2px rgba(0,0,0,.6), 0 0 30px var(--ac); } }
  #cs-ui .cs-tut h3 { margin:0; font:400 38px/1 'Bebas Neue','Secular One',sans-serif; letter-spacing:1.5px; color:#fff; text-shadow:0 3px 0 #000; }
  #cs-ui .cs-tut p { margin:5px 0 0; font:700 16px/1.3 var(--body); color:rgba(255,255,255,.86); white-space:nowrap; }
  #cs-ui .cs-tut p.cs-tg { color:#5cf2a8; margin-top:3px; }
  #cs-ui .cs-tut .cs-up { display:none; position:absolute; top:-26px; font-size:22px; color:#5cf2a8; animation:csbob .6s ease-in-out infinite alternate; }
  #hhud.touch #cs-ui .cs-tut .cs-up { display:block; inset-inline-end:40px; }
  #hhud.touch #cs-ui .cs-tut { top:300px; } /* phones: below the scaled objectives, the radar and the crew strip */
  @keyframes csbob { to { transform:translateY(-6px); } }
  #cs-ui .cs-pass { position:absolute; left:0; right:0; top:71%; display:flex; justify-content:center; opacity:0; transition:opacity .3s; }
  #cs-ui .cs-pass.on { opacity:1; }
  #cs-ui .cs-band { position:relative; overflow:hidden; padding:12px 110px 14px; text-align:center; transform:scaleX(.05); transition:transform .55s cubic-bezier(.2,1,.25,1);
    background:linear-gradient(90deg, rgba(10,7,3,0), rgba(10,7,3,.86) 16%, rgba(10,7,3,.86) 84%, rgba(10,7,3,0)); }
  #cs-ui .cs-band::before, #cs-ui .cs-band::after { content:''; position:absolute; left:12%; right:12%; height:2px; background:linear-gradient(90deg, rgba(255,210,63,0), #ffd23f, rgba(255,210,63,0)); }
  #cs-ui .cs-band::before { top:0; } #cs-ui .cs-band::after { bottom:0; }
  #cs-ui .cs-pass.on .cs-band { transform:scaleX(1); }
  #cs-ui .cs-rep { display:flex; justify-content:center; align-items:center; gap:22px; }
  #cs-ui .cs-rl { font:400 34px/1 'Bebas Neue','Secular One',sans-serif; letter-spacing:6px; color:#ffd23f; opacity:0; transition:opacity .25s .15s; }
  #cs-ui .cs-pass.on .cs-rl { opacity:1; }
  #cs-ui .cs-m { display:flex; align-items:center; gap:8px; opacity:0; transform:scale(.5); transition:opacity .25s, transform .45s cubic-bezier(.2,1.7,.4,1); }
  #cs-ui .cs-pass.on .cs-m { opacity:1; transform:none; }
  #cs-ui .cs-ms { display:flex; gap:22px; } /* the chips in the crew's on-screen order (Hadar, Ido, Yoav), whatever the language */
  #cs-ui .cs-pass.on .cs-m:nth-of-type(1) { transition-delay:.3s; } #cs-ui .cs-pass.on .cs-m:nth-of-type(2) { transition-delay:.42s; } #cs-ui .cs-pass.on .cs-m:nth-of-type(3) { transition-delay:.54s; }
  #cs-ui .cs-m i { width:42px; height:42px; border-radius:50%; border:2px solid var(--ac); background:#111 url(assets/crew_faces.jpg) var(--fx) 0% / 300% 100% no-repeat; box-shadow:0 0 14px var(--ac); }
  #cs-ui .cs-m b { font:400 32px/1 'Bebas Neue','Secular One',sans-serif; color:var(--ac); text-shadow:0 2px 0 #000; direction:ltr; }
  #hhud.touch #cs-ui .cs-pass { top:58%; }
  [dir="rtl"] #cs-ui .cs-rl { letter-spacing:1px; font-family:'Secular One','Bebas Neue',sans-serif; font-size:28px; }
  /* results (no backdrop blur: it can sample a stale frame of the hidden cutscene video; the sunset stays visible instead) */
  #hresults.cs-res { -webkit-backdrop-filter:none; backdrop-filter:none; background:radial-gradient(ellipse 70% 80% at 50% 50%, rgba(10,4,16,.55), rgba(6,2,10,.82)); }
  #hresults.cs-res .panel { width:860px; max-width:94%; padding:24px 34px 26px; border-color:rgba(255,210,63,.5); box-shadow:0 0 60px rgba(255,170,40,.22), inset 0 0 40px rgba(255,210,63,.06);
    background:linear-gradient(180deg, rgba(34,18,8,.92), rgba(16,8,22,.94)); }
  #hresults.cs-res h2.cs-rt { font-family:'Bebas Neue','Secular One',sans-serif; letter-spacing:3px; font-size:64px; font-weight:400; margin:0 0 4px; color:#ffd23f; text-shadow:0 4px 0 rgba(0,0,0,.6); }
  #hresults.cs-res p { margin:0 0 12px; }
  #hresults.cs-res .cs-crew { display:flex; gap:12px; margin:4px 0 12px; }
  #hresults.cs-res .cs-card { flex:1; display:flex; align-items:center; gap:12px; padding:10px 12px; border-radius:14px; text-align:start; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.12); border-top:3px solid var(--ac); }
  #hresults.cs-res .cs-card i { flex:none; width:60px; height:60px; border-radius:50%; border:3px solid var(--ac); background:#111 url(assets/crew_faces.jpg) var(--fx) 0% / 300% 100% no-repeat; box-shadow:0 0 14px var(--ac); }
  #hresults.cs-res .cs-card b { display:block; font-weight:800; font-size:17px; color:#fff; }
  #hresults.cs-res .cs-card small { display:block; color:var(--muted); font-size:13px; margin-top:1px; }
  #hresults.cs-res .cs-card em { display:block; font-style:normal; margin-top:4px; font:400 24px/1 'Bebas Neue','Secular One',sans-serif; letter-spacing:1px; color:var(--ac); }
  #hresults.cs-res .statlist { margin:6px 0 16px; font-size:17px; }
  #hresults.cs-res .statlist .cs-wide { grid-column:1 / -1; }
  #hresults.cs-res .statlist .cs-gear { font-size:15px; text-align:end; }
  #hresults.cs-res .btn { margin:0 6px; }
  `,
  ui() {
    if (!HHud.el) return;
    if (!document.getElementById('cs-style')) { const st = document.createElement('style'); st.id = 'cs-style'; st.textContent = this.CSS; document.head.appendChild(st); }
    if (this.$ && this.$.root) this.$.root.remove();
    const root = document.createElement('div'); root.id = 'cs-ui';
    const face = (id, cls) => `<i class="${cls || ''}" style="--ac:${this.ACC[id]};--fx:${this.FACE[id] * 50}%"></i>`;
    root.innerHTML = `<div class="cs-strobe"></div><div class="cs-lb t"></div><div class="cs-lb b"></div><div class="cs-sub"><b></b><span></span></div>
      <div class="cs-tut"><span class="cs-up">▲</span><div class="cs-tf">${face('yoav')}${face('hadar', 'cs-go')}${face('ido')}</div><div><h3></h3><p class="cs-tk"></p><p class="cs-tg"></p></div></div>
      <div class="cs-pass" hidden><div class="cs-band"><div class="cs-rep"><span class="cs-rl"></span><span class="cs-ms" dir="ltr">${['hadar', 'ido', 'yoav'].map(id => `<span class="cs-m" style="--ac:${this.ACC[id]}">${face(id)}<b>+100</b></span>`).join('')}</span></div></div></div>`;
    HHud.el.appendChild(root); HHud.el.classList.add('cs-ch3');
    const q = s => root.querySelector(s);
    this._tutOn = false; this._dim = false;
    this.$ = { root, strobe: q('.cs-strobe'), sub: q('.cs-sub'), subN: q('.cs-sub b'), subT: q('.cs-sub span'), tut: q('.cs-tut'), tutH: q('.cs-tut h3'), tutK: q('.cs-tk'), tutG: q('.cs-tg'), pass: q('.cs-pass') };
  },
  showTut(on) {
    if (!this.$) return; const $ = this.$; on = !!on;
    if (on === this._tutOn) return; this._tutOn = on;
    if (on) { $.tutH.textContent = t('cs_tutT'); $.tutK.textContent = t(Input.touchMode ? 'cs_tutTouch' : 'cs_tutK'); $.tutG.textContent = t('cs_tutGo'); }
    $.tut.classList.toggle('on', on);
  },
};
window.HCrewStory = HCrewStory;

// The chapter-3 loading screen: the crew's own poster and a chapter-3 tip (hhud.js draws chapter 2's hotel art and tip;
// this wraps HHud.loading from here, so chapter 2 is untouched)
(function () {
  if (typeof HHud === 'undefined' || HHud._csLoad) return;
  const base = HHud.loading; HHud._csLoad = true;
  HHud.loading = function (on, title, text, tip, p) {
    const crew = !!(on && window.Heist && Heist.opts && Heist.opts.story === 'crew' && title !== ':(');
    if (crew && tip !== undefined && typeof t === 'function') tip = t(Input.touchMode ? 'cs_tipT' : 'cs_tip');
    base.call(this, on, title, text, tip, p);
    const l = this.$ && this.$.load; if (!l || !on) return;
    if (crew) l.style.backgroundImage = 'url(assets/crew_card.jpg)';
    const h = l.querySelector('h1'); if (h) h.style.textShadow = crew ? '0 0 30px rgba(255,170,60,.65), 0 6px 0 #000' : '';
  };
})();
