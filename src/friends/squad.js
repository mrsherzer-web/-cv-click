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
    this.stuckT.clear(); // a new order, a new place to go: progress is counted afresh
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
  // `walk`: whoever is in sight on the leader's floor walks over instead of being put in his place
  form(ids, { near = null, yaw = null, leader = null, walk = false } = {}) {
    if (leader) this.leaderId = leader;
    this.mode = 'follow';
    const g = this.game;
    this.ids = ids.slice();
    this.active = true;
    const p = near || g.player.pos, py = yaw ?? g.player.yaw;
    // a fresh trail from here: footsteps from before (a retry, another site) may be behind a locked gate or on another floor
    this.trail = [{ x: p.x, z: p.z, y: p.y ?? g.player.pos.y }];
    this.stuckT.clear();
    ids.forEach((id, i) => {
      const n = g.npc(id), s = this.slot(i, p, py), py0 = p.y ?? g.player.pos.y;
      if (n.inCar) n.stepOut(i % 2 ? 1 : -1);
      n.floorY = null; n.idle = null; n.target = null; n.model.setPose(null);
      const over = walk && n.visible && !n.inCar && Math.abs(n.pos.y - py0) < 2.2 && Math.hypot(n.pos.x - p.x, n.pos.z - p.z) < 45;
      if (!over) n.place(s.x, s.z, py, py0);
      n.show(true);
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
    if (g.dialogue.busy || g.cutscene) return; // a call-out never cuts into the story's lines
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
      n.body.enabled = false; // a friend never blocks a doorway or a corridor, on an errand (a door, a post) too
      if (this.tasks.has(id)) return;                    // on an errand
      if (g.mode === 'car') { if (n.visible && !n.inCar) n.show(false); return; }
      if (n.inCar) n.stepOut(-1);
      if (!n.visible) { const s = this.slot(i, lead, yaw); n.place(s.x, s.z, yaw, lead.y); n.show(true); }
      // on another floor than the leader, or making no progress for a while toward where he is going (his slot,
      // his advance point): back on the leader's trail, a few steps behind. Standing at his place, or holding in
      // a fight, he has nowhere to go and is not stuck, however far that place is from the leader.
      if (this.mode === 'follow' || this.mode === 'advance') {
        const st = this.stuckT.get(id) || { t: 0, d: Infinity, floor: 0, x: n.pos.x, z: n.pos.z }, to = n.target, dg = to ? Math.hypot(n.pos.x - to.x, n.pos.z - to.z) : Infinity;
        const went = to && dg > 0.01 ? ((n.pos.x - st.x) * (to.x - n.pos.x) + (n.pos.z - st.z) * (to.z - n.pos.z)) / dg : 0; // walked toward it since the last frame
        if (!to || dg < to.near + 0.5 || dg < st.d - 0.4 || went > dt * 0.8) { st.d = dg; st.t = 0; } else st.t += dt; // a goal that moves away (the leader walking) is no wall
        st.x = n.pos.x; st.z = n.pos.z;
        st.floor = Math.abs(n.pos.y - lead.y) > 2.2 ? st.floor + dt : 0; // its own clock: left on another floor, idle or not
        this.stuckT.set(id, st);
        if ((st.t > 3.5 || st.floor > 1.2) && this.trail.length > 4) { const p = this.trail[Math.max(0, this.trail.length - 3 - (i % 4))]; n.target = null; n.place(p.x, p.z, yaw, p.y); st.t = 0; st.floor = 0; st.d = Infinity; st.x = n.pos.x; st.z = n.pos.z; }
      }
      const s = this.slot(i, lead, yaw), gap = Math.hypot(n.pos.x - s.x, n.pos.z - s.z), far = Math.hypot(n.pos.x - lead.x, n.pos.z - lead.z);
      // orders (chapter eight): stay where they are and shoot ('hold' at whoever is on them, 'cover' at whoever
      // is on the leader, faster, markers up toward his way: Paintball.updateAlly), or go ahead of the leader
      if (this.mode === 'hold' || this.mode === 'cover') { if (far > 70) { n.place(s.x, s.z, yaw, lead.y); return; } if (!n.target) { n.target = null; if (this.mode === 'cover' && !P.allies.find((a) => a.npc === n)?.foe) n.lookAt(lead.x + Math.sin(yaw) * 8, lead.z + Math.cos(yaw) * 8); } return; }
      if (this.mode === 'advance') {
        let ax = lead.x + Math.sin(yaw) * (9 + (i % 3) * 2) + Math.cos(yaw) * ((i % 2 ? 1 : -1) * (1.2 + Math.floor(i / 2) * 1.1)), az = lead.z + Math.cos(yaw) * (9 + (i % 3) * 2) - Math.sin(yaw) * ((i % 2 ? 1 : -1) * (1.2 + Math.floor(i / 2) * 1.1));
        // only as far as a straight line from the leader goes: a post behind a wall would have him walk into it
        const wall = g.world.cols.raycast(lead.x, lead.y + 1, lead.z, ax, lead.y + 1, az);
        if (wall !== null) { const k = Math.max(0, wall - 0.8 / Math.max(1, Math.hypot(ax - lead.x, az - lead.z))); ax = lead.x + (ax - lead.x) * k; az = lead.z + (az - lead.z) * k; }
        if (far > 45) { n.place(s.x, s.z, yaw, lead.y); return; }
        if (Math.hypot(n.pos.x - ax, n.pos.z - az) > 2.2) n.walkTo(ax, az, { near: 1.4, run: true }); else { n.target = null; n.lookAt(ax + Math.sin(yaw) * 6, az + Math.cos(yaw) * 6); }
        return;
      }
      if (far > 45) { n.place(s.x, s.z, yaw, lead.y); return; }   // left behind: catch up out of sight
      const hold = alerted > 0 && far < 14;               // a fight on: hold where you are and shoot
      if (hold) { n.target = null; return; }
      // his place beside the leader only if it is on the leader's floor in plain line from him (a place past the
      // open side of a stair or behind a wall would have him step off or walk into it): else the leader's own steps
      const fine = Math.abs(g.world.groundHeight(s.x, s.z, lead.y) - lead.y) < 0.9 && g.world.cols.raycast(lead.x, lead.y + 1, lead.z, s.x, lead.y + 1, s.z) === null;
      const goal = fine || this.trail.length < 2 ? s : this.trail[Math.max(0, this.trail.length - 3 - (i % 4))], gg = Math.hypot(n.pos.x - goal.x, n.pos.z - goal.z);
      if (gg > 1.6) n.walkTo(goal.x, goal.z, { near: 0.8, run: gg > 6 });
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
