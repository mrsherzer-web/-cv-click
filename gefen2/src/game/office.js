// ============================================================================
//  Security room systems: power, tablet (cameras / lure / maintenance),
//  vent lights, kill switch.  Pure logic; the HUD draws it.
// ============================================================================
import { POWER } from '../config.js';
import { CAMS } from '../world/layout.js';
import { UI } from '../story.js';
import { audio } from '../engine/audio.js';

export class Office {
  constructor(S) {
    this.S = S;
    this.reset();
  }

  reset() {
    this.power = 100;
    this.sys = { cams: 'ok', audio: 'ok', power: 'ok' };
    this.rebooting = null; // { keys: [...], t }
    this.maayan = { wait: 0, key: null, t: 0 };
    this.killT = 0;
    this.killCd = 0;
    this.interference = 0;
    this.ventLight = { L: false, R: false };
    this.lureCd = 0;
    this.lureHeat = 0;
    this.tablet = { open: false, tab: 'cams', cam: 1, switchT: 0 };
    this.sabT = 0;
    this.blackoutT = 0;
    this.out = false;
    this.enabled = { tablet: true, lure: false, fix: false, kill: false, vents: false };
    this.camOffline = new Set([12]);
    this.camGlitch = {};
    this.usage = 0;
  }

  anyBroken() {
    return this.sys.cams !== 'ok' || this.sys.audio !== 'ok' || this.sys.power !== 'ok';
  }

  get dark() {
    return this.out || this.killT > 0 || this.blackoutT > 0;
  }

  get camsUp() {
    return !this.dark && this.sys.cams === 'ok';
  }

  sabotage(key) {
    if (this.sys[key] !== 'ok') return;
    this.sys[key] = 'broken';
    this.sabT = 0;
    audio.zap?.(0, 0.35);
    audio.errorBeep?.(0.16);
    this.S.emit('broken', { key });
  }

  fix(key) {
    if (this.sys[key] === 'ok') return;
    this.sys[key] = 'ok';
    audio.okBeep?.(0.14);
    this.S.emit('fixed', { key });
  }

  // ------------------------------------------------------------ tablet
  canTablet() {
    const P = this.S.player;
    return this.enabled.tablet && P.mode === 'seat' && !P.mask.on && !this.dark && !this.S.busy;
  }

  toggleTablet(force = null) {
    const t = this.tablet;
    const open = force ?? !t.open;
    if (open === t.open) return;
    if (open && !this.canTablet()) {
      audio.errorBeep?.(0.1);
      return;
    }
    t.open = open;
    if (open) {
      audio.camOpen();
      t.switchT = 0.25;
    } else {
      audio.camClose();
      if (this.rebooting) this.rebooting = null;
    }
    this.S.emit('tablet', { open });
  }

  selectCam(n) {
    const t = this.tablet;
    if (t.cam === n && t.tab === 'cams') return;
    t.cam = n;
    t.tab = 'cams';
    t.switchT = 0.22;
    audio.camSwitch();
    this.S.emit('cam', { n });
  }

  setTab(tab) {
    if (tab === 'fix' && !this.enabled.fix) return;
    if (this.tablet.tab === tab) return;
    this.tablet.tab = tab;
    if (tab !== 'fix') this.rebooting = null;
    audio.click(0.2);
  }

  camRoom(n = this.tablet.cam) {
    return CAMS.find((c) => c.n === n)?.room;
  }

  // ------------------------------------------------------------ lure
  lureReady() {
    return this.enabled.lure && this.sys.audio === 'ok' && this.lureCd <= 0 && this.camsUp;
  }

  playLure() {
    const S = this.S;
    if (!this.lureReady()) {
      audio.errorBeep?.(0.1);
      return false;
    }
    const room = this.camRoom();
    this.lureCd = 9;
    this.power = Math.max(0, this.power - POWER.lure);
    audio.ballBounce?.(0, 0.22);
    audio.staticBurst(0.15, 0.12);
    this.lureHeat += 1;
    S.emit('lure', { room });
    const D = S.enemies.dolev;
    if (D.mode === 'office') D.lure();
    const G = S.enemies.gefen;
    if (G.mode === 'office' && G.idx === 3 && room === 'hall') {
      G.idx = 2;
      G.placeSpot('g_hall_c');
    }
    if (Math.random() < Math.min(0.5, 0.06 + 0.11 * (this.lureHeat - 1))) this.sabotage('audio');
    return true;
  }

  // ------------------------------------------------------------ maintenance
  startReboot(key) {
    if (!this.enabled.fix || this.dark) return;
    const keys = key === 'all' ? Object.keys(this.sys).filter((k) => this.sys[k] !== 'ok') : [key];
    if (!keys.length || (key !== 'all' && this.sys[key] === 'ok')) return;
    this.rebooting = { keys, t: 0, total: POWER.rebootTime * (keys.length > 1 ? 0.8 * keys.length : 1) };
    this.maayan.key = null;
    this.maayan.t = 0;
    audio.click(0.25);
  }

  // ------------------------------------------------------------ kill switch
  pullKill() {
    const S = this.S;
    if (!this.enabled.kill || this.killCd > 0 || this.out || S.player.mode !== 'seat') return false;
    this.killT = POWER.killTime;
    this.killCd = POWER.killTime + 7;
    this.power = Math.max(0, this.power - POWER.killCost);
    this.toggleTablet(false);
    audio.switchClack?.(0.6);
    audio.powerDown();
    const lv = S.world.items.kill?.lever;
    if (lv) lv.rotation.x = 0.7;
    S.emit('kill', {});
    return true;
  }

  // ------------------------------------------------------------ update
  update(dt) {
    const S = this.S;
    const P = S.player;
    const inp = S.G.input;
    const n = S.night;
    const t = this.tablet;
    this.lureCd = Math.max(0, this.lureCd - dt);
    this.lureHeat = Math.max(0, this.lureHeat - dt / 26);
    this.killCd = Math.max(0, this.killCd - dt);
    t.switchT = Math.max(0, t.switchT - dt);
    for (const k in this.camGlitch) this.camGlitch[k] = Math.max(0, this.camGlitch[k] - dt);

    // input (seat only)
    if (P.mode === 'seat' && !S.busy) {
      if (inp.took('tablet')) this.toggleTablet();
      if (inp.took('kill')) this.pullKill();
      if (t.open) {
        if (inp.took('tab1')) this.setTab('cams');
        if (inp.took('tab2')) this.setTab('fix');
      }
    } else if (t.open) this.toggleTablet(false);
    if (t.open && !this.canTablet()) this.toggleTablet(false);

    // vent lights: hold "light" while facing a vent
    const fv = P.mode === 'seat' && this.enabled.vents && !this.dark && !P.mask.on && !t.open && inp.held('light') ? P.facingVent() : 0;
    const L = fv === -1;
    const R = fv === 1;
    if (L !== this.ventLight.L || R !== this.ventLight.R) audio.click(0.18);
    this.ventLight.L = L;
    this.ventLight.R = R;
    S.world.ventLLight.state = L ? 'on' : 'off';
    S.world.ventRLight.state = R ? 'on' : 'off';
    const it = S.world.items;
    it.ventBtnL.material.color.setHex(L ? 0xffc040 : 0x331a00);
    it.ventBtnR.material.color.setHex(R ? 0xffc040 : 0x331a00);

    // kill switch / forced blackout
    if (this.killT > 0) {
      this.killT -= dt;
      if (this.killT <= 0) {
        audio.switchClack?.(0.4);
        const lv = it.kill?.lever;
        if (lv) lv.rotation.x = -0.7;
        S.emit('killEnd', {});
      }
    }
    if (this.blackoutT > 0) {
      this.blackoutT -= dt;
      if (this.blackoutT <= 0) this.fix('power');
    }

    // sabotaged grid: fix it or lose the lights for a while
    if (this.sys.power !== 'ok' && this.blackoutT <= 0) {
      this.sabT += dt;
      if (this.sabT > 24) {
        this.sabT = 0;
        this.blackoutT = 9;
        this.power = Math.max(0, this.power - 6);
        this.toggleTablet(false);
        audio.powerDown();
        S.emit('blackout', {});
      }
    }

    // reboot progress only while the maintenance panel is open
    if (this.rebooting) {
      if (t.open && t.tab === 'fix') {
        this.rebooting.t += dt;
        if (this.rebooting.t >= this.rebooting.total) {
          for (const k of this.rebooting.keys) this.fix(k);
          this.rebooting = null;
        }
      } else this.rebooting = null;
    }

    // Maayan repairs on her own (slower than you)
    const m = this.maayan;
    if (S.allies.maayan?.inOffice && this.anyBroken() && !this.rebooting && !this.dark) {
      if (!m.key) {
        m.wait += dt;
        if (m.wait >= POWER.maayanDelay) {
          m.key = Object.keys(this.sys).find((k) => this.sys[k] !== 'ok');
          m.t = 0;
          S.emit('maayanFix', { key: m.key, start: true });
        }
      } else if (this.sys[m.key] === 'ok') {
        m.key = null;
        m.wait = 0;
      } else {
        m.t += dt;
        if (m.t >= POWER.maayanTime) {
          this.fix(m.key);
          S.emit('maayanFix', { key: m.key, start: false });
          m.key = null;
          m.wait = 0;
        }
      }
    } else if (!this.anyBroken()) {
      m.key = null;
      m.wait = 0;
    }

    // power
    if (!this.out && S.powerOn) {
      let use = POWER.passive[n] || 0.04;
      let bars = 1;
      if (t.open) {
        use += POWER.tablet;
        bars++;
      }
      if (L || R) {
        use += POWER.ventLight;
        bars++;
      }
      if (this.rebooting) {
        use += POWER.reboot;
        bars++;
      }
      if (this.sys.power !== 'ok') {
        use *= POWER.sabotage;
        bars += 2;
      }
      this.usage = bars;
      this.power = Math.max(0, this.power - use * dt * (S.G.dev.god ? 0.25 : 1));
      if (this.power <= 0) {
        this.out = true;
        this.toggleTablet(false);
        audio.powerDown();
        S.emit('powerOut', {});
      }
    }

    // lights of the complex follow the state of the grid
    if (!S.powerOverride) {
      S.world.setPower(this.dark ? 'blackout' : this.sys.power !== 'ok' ? 'dim' : 'normal');
      S.world.flickerBoost = this.sys.power !== 'ok' ? 0.7 : this.interference * 0.6;
    }
    this.interference = Math.max(0, this.interference - dt * 2);
  }

  statusText(key) {
    return this.sys[key] === 'ok' ? UI.ok : UI.error;
  }
}
