// The rescue team (chapter seven): the friends as a unit around the leader. They keep a wedge behind
// and beside him as he moves, hold and shoot (paint) when a guard is on them, go where they are sent
// (Ido to a door, Yonati to a valve), and talk — call-outs when a guard is spotted or marked, a line
// when the leader takes a hit, and banter when nothing happens for a while. A strip on the screen
// shows who is up. Written for the game; the lines describe nobody real.
const SLOTS = [[-1.7, -1.6], [1.7, -1.6], [-3.0, -3.4], [3.0, -3.4], [0, -3.8], [-1.6, -5.6], [1.6, -5.6], [0, -7.0]];
const NAMES = { ido: 'עידו', yonati: 'יונתי', avraham: 'אברהם', muller: 'מולר', dolev: 'דולב', hadar: 'הדר', liam: 'ליאם', kai: 'קאי', yahli: 'יהלי', erez: 'ארז', nehorai: 'נהוראי' };
const LINES = {
  spotted: { ido: 'מגע! מחסה!', yonati: 'רואים אותנו! זה הולך לסרטון!', avraham: 'אני רוצה להגיד משהו לפני שיורים עליי.', muller: 'מגע.', dolev: 'למה תמיד עליי?!', hadar: 'Bro, contact!', liam: 'אחים, מחסה!' },
  marked: { ido: 'אחד בחוץ. ממשיכים.', yonati: 'יפה, אבל אני הייתי עושה את זה יפה יותר.', avraham: 'סימנתי! רשמו את זה!', muller: 'בחוץ.', dolev: 'זה היה אני? זה היה אני.', hadar: 'Marked, bro.', liam: 'עוד אחד, אחים!' },
  clear: { ido: 'נקי. לנשום. ממשיכים.', yonati: 'נקי. מישהו צילם?', avraham: 'נקי. ועכשיו, כמה מילים.', muller: 'נקי.', dolev: 'נקי. אני צריך לשבת רגע.', hadar: 'Clear!', liam: 'נקי, אחים יקרים.' },
  hit: { ido: 'ארז! מחסה, עכשיו!', yonati: 'ארז, אתה מסומן! תזוז!', avraham: 'ארז! אני אדבר איתם!', muller: 'מחסה.', dolev: 'ארז! אל תמות לי, מי ינהג?', hadar: 'Erez, down!', liam: 'ארז, אחי, תתכופף!' },
  banter: [
    ['דולב', 'שאלה: מי מביא פיצה אחרי שמצילים את נהוראי?'], ['אברהם', 'אני. אבל אני גם מדבר בדרך.'],
    ['יונתי', 'אם מישהו מצלם אותי עכשיו, שיצלם מהצד הטוב.'], ['מולר', 'אין לך צד טוב.'],
    ['הדר', 'Bro, בניו יורק קוראים לזה "רגע שקט".'], ['עידו', 'בקציר קוראים לזה "לפני הבלגן".'],
    ['ליאם', 'אחים יקרים, מי לקח לי את הבקבוק מים?'], ['דולב', 'אני. חטפו אותי פעם, אני יודע מה זה צמא.'],
    ['אברהם', 'נהוראי בטח כבר מספר לשומרים סיפורים.'], ['עידו', 'השומרים כבר מתגעגעים לשקט.'],
  ],
};

export class Squad {
  constructor(game) {
    this.game = game;
    this.ids = [];
    this.active = false;
    this.leaderId = 'erez';
    this.tasks = new Map();       // id -> { x, z, onArrive, label }
    this.cool = { spotted: -99, marked: -99, clear: -99, hit: -99, banter: 0 };
    this.t = 0;
    this.lastHits = 0;
    this.lastMarked = 0;
    this.lastAlerted = 0;
    this.mode = 'follow';         // 'follow' | 'hold' | 'cover' | 'advance': the order given (chapter eight)
    this.trail = [];              // where the leader has walked (every metre or so): a safe place to put a friend who is stuck
    this.stuckT = new Map();      // id -> { t, d }: how long a friend has made no progress
    this.anchor = null;           // where 'hold' was called
    this.advanceT = 0;
  }

  static MODES = ['follow', 'hold', 'cover', 'advance'];
  static ORDERS = { follow: 'אחריי!', hold: 'תישארו כאן!', cover: 'תחפו עליי!', advance: 'תתקדמו!' };
  static ANSWERS = { follow: [['dolev', 'דולב', 'אחריך.'], ['hadar', 'הדר', 'Bro, אנחנו איתך.'], ['ido', 'עידו', 'אחריך, המפקד.']], hold: [['ido', 'עידו', 'נשארים. תזהר.'], ['avraham', 'אברהם', 'עומדים. סוף סוף.'], ['erez', 'ארז', 'פה. תחזור בשלום.']], cover: [['erez', 'ארז', 'מחפים. רוץ, אחי.'], ['muller', 'מולר', 'יש לי אותם בכוונת.'], ['ido', 'עידו', 'לך. אני רואה הכול.']], advance: [['liam', 'ליאם', 'אחים, קדימה!'], ['yonati', 'יונתי', 'ראשון! תסתכלו עליי.'], ['dolev', 'דולב', 'זהו, אני בפנים.']] };

  // an order to the whole team; the leader's voice is the player's, the answer comes from one of them
  command(mode, { quiet = false } = {}) {
    if (!this.active || !Squad.MODES.includes(mode)) return;
    const g = this.game, lead = g.player.pos;
    this.mode = mode;
    this.anchor = { x: lead.x, z: lead.z, yaw: g.player.yaw };
    this.advanceT = 0;
    if (mode === 'hold' || mode === 'cover') for (const id of this.ids) { if (this.tasks.has(id)) continue; const n = g.npc(id); n.target = null; }
    if (!quiet) {
      g.hud.toast(`${this.leaderName()}: "${Squad.ORDERS[mode]}"`, 1500);
      const here = Squad.ANSWERS[mode].filter(([id]) => this.ids.includes(id) && !(g.paint.allies.find((a) => a.npc === g.npc(id))?.marked));
      const line = here[Math.floor(Math.random() * here.length)];
      if (line && !g.dialogue.busy) g.dialogue.play([[line[1], line[2]]]);
    }
    this.refresh(true);
  }
  cycle() { const i = Squad.MODES.indexOf(this.mode); this.command(Squad.MODES[(i + 1) % Squad.MODES.length]); }
  leaderName() { return this.game.playingAs === 'erez' ? 'ארז' : 'נהוראי'; }

  // the team forms up around the leader (or a given spot)
  form(ids, { near = null, yaw = null, leader = null } = {}) {
    if (leader) this.leaderId = leader;
    this.mode = 'follow';
    const g = this.game;
    this.ids = ids.slice();
    this.active = true;
    const p = near || g.player.pos, py = yaw ?? g.player.yaw;
    ids.forEach((id, i) => {
      const n = g.npc(id), s = this.slot(i, p, py);
      if (n.inCar) n.stepOut(i % 2 ? 1 : -1);
      n.floorY = null; n.idle = null; n.target = null; n.model.setPose(null);
      n.place(s.x, s.z, py, p.y ?? g.player.pos.y); n.show(true);
    });
    this.refresh(true);
  }
  dismiss() { for (const id of this.ids) { const n = this.game.npc(id); n.target = null; n.body.enabled = n.visible && !n.inCar; } this.trail = []; this.stuckT.clear(); this.ids = []; this.tasks.clear(); this.active = false; this.mode = 'follow'; this.game.hud.setSquad(null); }
  hide() { for (const id of this.ids) this.game.npc(id).show(false); }
  slot(i, p, yaw) {
    const [sx, sz] = SLOTS[i % SLOTS.length];
    return { x: p.x + Math.cos(yaw) * sx + Math.sin(yaw) * sz, z: p.z - Math.sin(yaw) * sx + Math.cos(yaw) * sz };
  }
  // send one of them somewhere (he stops following until done)
  send(id, spot, { run = true, onArrive = null, label = '' } = {}) {
    const n = this.game.npc(id);
    this.tasks.set(id, { ...spot, label });
    n.walkTo(spot.x, spot.z, { run, near: 0.9, onArrive: () => { if (spot.yaw != null) n.lookAt(n.pos.x + Math.sin(spot.yaw) * 3, n.pos.z + Math.cos(spot.yaw) * 3); onArrive?.(n); } });
    this.refresh(true);
  }
  release(id) { this.tasks.delete(id); this.refresh(true); }
  say(key, who = null) {
    const g = this.game, line = LINES[key];
    if (!line) return;
    const id = who || this.ids[Math.floor(Math.random() * this.ids.length)];
    const text = line[id]; if (!text) return;
    g.dialogue.play([[NAMES[id], text]]);
  }

  update(dt) {
    if (!this.active) return;
    const g = this.game, P = g.paint;
    this.t += dt;
    const lead = g.player.pos, yaw = g.player.yaw;
    const alerted = P.guards.filter((q) => !q.marked && q.alerted).length;
    const marked = P.marked;
    // call-outs
    if (alerted && !this.lastAlerted && this.t - this.cool.spotted > 10) { this.cool.spotted = this.t; this.say('spotted'); }
    if (marked > this.lastMarked && this.t - this.cool.marked > 6) { this.cool.marked = this.t; this.say('marked'); }
    if (P.guards.length && P.standing.length === 0 && this.lastMarked < marked && this.t - this.cool.clear > 20) { this.cool.clear = this.t; this.say('clear', 'ido'); }
    if (P.hits > this.lastHits && this.t - this.cool.hit > 8) { this.cool.hit = this.t; this.say('hit', 'ido'); }
    this.lastAlerted = alerted; this.lastMarked = marked; this.lastHits = P.hits;
    // banter, when it is quiet for a while on foot
    if (g.mode === 'foot' && !alerted && !g.dialogue.busy && !g.cutscene) {
      this.cool.banter += dt;
      if (this.cool.banter > 28) { this.cool.banter = Math.random() * -14; const k = Math.floor(Math.random() * (LINES.banter.length / 2)) * 2; g.dialogue.play([LINES.banter[k], LINES.banter[k + 1]]); }
    }
    // the trail: the leader's own footsteps, on the floor he walks on
    if (g.mode === 'foot') { const last = this.trail[this.trail.length - 1]; if (!last || Math.hypot(lead.x - last.x, lead.z - last.z) > 1.0 || Math.abs(lead.y - last.y) > 0.8) { this.trail.push({ x: lead.x, z: lead.z, y: lead.y }); if (this.trail.length > 60) this.trail.shift(); } }
    // in the car: they ride along (teleported in, the convoy is the story), out of it: formation
    this.ids.forEach((id, i) => {
      const n = g.npc(id);
      if (this.tasks.has(id)) return;                    // on an errand
      if (g.mode === 'car') { if (n.visible && !n.inCar) n.show(false); return; }
      if (n.inCar) n.stepOut(-1);
      if (!n.visible) { const s = this.slot(i, lead, yaw); n.place(s.x, s.z, yaw, lead.y); n.show(true); }
      n.body.enabled = false; // a friend never blocks a doorway or a corridor
      // on another floor than the leader, or making no progress toward him for a while: back on his trail, a few steps behind
      if (this.mode === 'follow' || this.mode === 'advance') {
        const st = this.stuckT.get(id) || { t: 0, d: Infinity }, dl = Math.hypot(n.pos.x - lead.x, n.pos.z - lead.z), dy = Math.abs(n.pos.y - lead.y);
        if (dl < st.d - 0.4 || dl < 3.2) { st.d = dl; st.t = 0; } else st.t += dt;
        if (dy > 2.2) st.t += dt * 2;
        this.stuckT.set(id, st);
        if (st.t > 3.5 && this.trail.length > 4) { const p = this.trail[Math.max(0, this.trail.length - 3 - (i % 4))]; n.target = null; n.place(p.x, p.z, yaw, p.y); st.t = 0; st.d = Infinity; }
      }
      const s = this.slot(i, lead, yaw), gap = Math.hypot(n.pos.x - s.x, n.pos.z - s.z), far = Math.hypot(n.pos.x - lead.x, n.pos.z - lead.z);
      // orders (chapter eight): stay where they are and shoot, or go ahead of the leader
      if (this.mode === 'hold' || this.mode === 'cover') { if (far > 70) { n.place(s.x, s.z, yaw, lead.y); return; } if (!n.target) { n.target = null; if (this.mode === 'cover') n.lookAt(lead.x + Math.sin(yaw) * 8, lead.z + Math.cos(yaw) * 8); } return; }
      if (this.mode === 'advance') {
        const ax = lead.x + Math.sin(yaw) * (9 + (i % 3) * 2) + Math.cos(yaw) * ((i % 2 ? 1 : -1) * (1.2 + Math.floor(i / 2) * 1.1)), az = lead.z + Math.cos(yaw) * (9 + (i % 3) * 2) - Math.sin(yaw) * ((i % 2 ? 1 : -1) * (1.2 + Math.floor(i / 2) * 1.1));
        if (far > 45) { n.place(s.x, s.z, yaw, lead.y); return; }
        if (Math.hypot(n.pos.x - ax, n.pos.z - az) > 2.2) n.walkTo(ax, az, { near: 1.4, run: true }); else { n.target = null; n.lookAt(ax + Math.sin(yaw) * 6, az + Math.cos(yaw) * 6); }
        return;
      }
      if (far > 45) { n.place(s.x, s.z, yaw, lead.y); return; }   // left behind: catch up out of sight
      const hold = alerted > 0 && far < 14;               // a fight on: hold where you are and shoot
      if (hold) { n.target = null; return; }
      if (gap > 1.6) n.walkTo(s.x, s.z, { near: 0.8, run: gap > 6 });
      else { n.target = null; n.lookAt(lead.x + Math.sin(yaw) * 5, lead.z + Math.cos(yaw) * 5); }
    });
    this.refresh();
  }

  refresh(force = false) {
    const g = this.game, P = g.paint;
    const rows = this.ids.map((id) => { const n = g.npc(id); const a = P.allies.find((x) => x.npc === n); return { id, name: NAMES[id] || id, state: a?.marked ? 'out' : this.tasks.has(id) ? 'busy' : 'ok' }; });
    const key = rows.map((r) => r.id + r.state).join(',') + this.mode;
    if (!force && key === this.key) return;
    this.key = key;
    g.hud.setSquad([{ id: this.leaderId, name: NAMES[this.leaderId], state: 'lead' }, ...rows], Squad.ORDERS[this.mode]);
  }
}
