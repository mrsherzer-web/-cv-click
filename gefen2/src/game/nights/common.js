// ============================================================================
//  Building blocks shared by the night scripts
// ============================================================================
import { PLAYER, POINTS, SPOTS } from '../../world/layout.js';
import { UI } from '../../story.js';
import { audio } from '../../engine/audio2.js';
import { h } from '../../ui/dom.js';

export async function fadeIn(S, sec = 1.2) {
  const fx = S.G.gfx.fx;
  fx.fade = 1;
  const t0 = S.time;
  S.until(() => {
    fx.fade = Math.max(0, 1 - (S.time - t0) / sec);
    return fx.fade <= 0;
  }).catch(() => {});
}

export async function fadeOut(S, sec = 1.0) {
  const fx = S.G.gfx.fx;
  const t0 = S.time;
  await S.until(() => {
    fx.fade = Math.min(1, (S.time - t0) / sec);
    return fx.fade >= 1;
  });
}

/** Run something in the background of a stage; cancellation is swallowed. */
export function bg(p) {
  p.catch(() => {});
  return p;
}

/** Sit down in the office with the chosen enemies active. */
export function seat(S, ai, { clock = null, rate = 1 } = {}) {
  S.player.seat();
  if (clock != null) S.clock = clock;
  S.clockRate = rate;
  S.showClock = true;
  S.powerOn = true;
  S.officeAI({ gefen: false, ido: false, dolev: false, ...ai });
}

/** Leave the chair: first person from the office front. */
export function standUp(S, { x = PLAYER.office_stand.x, z = PLAYER.office_stand.z, yaw = 0 } = {}) {
  S.office.toggleTablet(false);
  S.officeAI({ gefen: false, ido: false, dolev: false });
  S.clockRun = false;
  S.player.stand(x, z, yaw);
  const touch = S.G.input.touch;
  if (!S.G.save.data.movedOnce) {
    S.hud.toast(touch ? 'ג׳ויסטיק בצד שמאל כדי ללכת, גרירה בצד ימין כדי להסתכל.' : 'WASD כדי ללכת, עכבר כדי להסתכל, Shift לריצה, E לפעולה.', 7);
    S.G.save.data.movedOnce = true;
    S.G.save.write();
  }
}

/** Wait until the walking player is back at the desk, then sit. */
export async function backToSeat(S, { label = 'שב ליד המסכים' } = {}) {
  S.setMarker(PLAYER.office_stand.x, PLAYER.office_stand.z, 1.0);
  await S.until(() => S.player.mode === 'walk' && S.player.z > -2.3 && Math.abs(S.player.x) < 3.2);
  S.playerSafe = true;
  S.setMarker(null);
  void label;
}

/** Enemy keeps a few metres behind a moving player (fair chase for story scenes). */
export function rubberBand(S, enemy, { min = 0.5, max = 1, near = 1.6, far = 6 } = {}) {
  return S.until(() => {
    const d = enemy.playerDist();
    enemy.speedMul = Math.max(min, Math.min(max, min + ((d - near) / (far - near)) * (max - min)));
    return false;
  }).catch(() => {});
}

/** Place a scripted actor (ally or enemy mover) on a named spot. */
export function put(mover, spot, pose = null) {
  mover.script(spot, pose);
  return mover;
}

/** Mash to break free. Resolves true on success, false on timeout. */
export async function mash(S, { need = 14, time = 7, decay = 2.2 } = {}) {
  const inp = S.G.input;
  let p = 0;
  let presses = 0;
  const on = (e) => {
    if (e.type === 'keydown' && e.repeat) return;
    presses++;
  };
  addEventListener('keydown', on);
  addEventListener('pointerdown', on);
  const t0 = S.time;
  let ok = false;
  try {
    await S.until(() => {
      const dt = 1 / 60;
      if (S.G.dev.bot || S.G.dev.god) presses += 0.4;
      p = Math.max(0, p + presses - decay * dt);
      presses = 0;
      S.hud.mash(Math.min(1, p / need));
      S.player.shake = 0.03 + 0.03 * Math.sin(S.time * 40);
      if (p >= need) {
        ok = true;
        return true;
      }
      return S.time - t0 > time;
    });
  } finally {
    removeEventListener('keydown', on);
    removeEventListener('pointerdown', on);
    S.hud.mash(null);
    S.player.shake = 0;
    void inp;
  }
  return ok;
}

/** Three breakers: flip them in the order the lamps showed. */
export function breakerGame(S, { title = 'לוח חשמל ראשי' } = {}) {
  return new Promise((res, rej) => {
    const order = [0, 1, 2].sort(() => Math.random() - 0.5);
    let step = 0;
    let showing = true;
    const el = h(`
      <div class="g2mini">
        <div class="panel">
          <h3>${title}</h3>
          <p class="hint">זכור את סדר הנורות</p>
          <div class="sw">
            ${[0, 1, 2].map((i) => `<button data-i="${i}"><i class="led"></i><span class="lever"></span></button>`).join('')}
          </div>
        </div>
      </div>`);
    document.getElementById('ui').appendChild(el);
    S.busy = true;
    S.player.freeze(true);
    const btns = [...el.querySelectorAll('button')];
    const hint = el.querySelector('.hint');
    const timers = [];
    const show = () => {
      showing = true;
      hint.textContent = 'זכור את סדר הנורות';
      btns.forEach((b) => b.classList.remove('lit', 'on', 'bad'));
      order.forEach((i, k) => {
        timers.push(setTimeout(() => {
          btns[i].classList.add('lit');
          audio.blip(1 + k * 0.25, 0.08);
        }, 500 + k * 650));
        timers.push(setTimeout(() => btns[i].classList.remove('lit'), 500 + k * 650 + 480));
      });
      timers.push(setTimeout(() => {
        showing = false;
        hint.textContent = 'הרם את המפסקים באותו סדר';
      }, 500 + 3 * 650));
    };
    const finish = (ok) => {
      timers.forEach(clearTimeout);
      el.remove();
      S.waiters.delete(w);
      S.busy = false;
      S.player.freeze(false);
      if (ok) res();
    };
    const w = { fn: () => false, res, rej, off: () => finish(false) };
    S.waiters.add(w);
    btns.forEach((b, i) =>
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        if (showing) return;
        if (order[step] === i) {
          b.classList.add('on');
          audio.switchClack?.(0.5);
          step++;
          if (step === 3) timers.push(setTimeout(() => finish(true), 450));
        } else {
          audio.errorBeep?.(0.2);
          audio.zap?.(0, 0.3);
          b.classList.add('bad');
          step = 0;
          timers.push(setTimeout(show, 600));
        }
      }),
    );
    show();
    if (S.G.dev.bot) {
      timers.push(setTimeout(() => {
        showing = false;
        order.forEach((i, k) => timers.push(setTimeout(() => btns[i].dispatchEvent(new Event('pointerdown')), k * 120)));
      }, 300));
    }
  });
}

/** Four digit keypad. Resolves when the right code is entered. */
export function keypadGame(S, code = '1947') {
  return new Promise((res, rej) => {
    let cur = '';
    const el = h(`
      <div class="g2mini">
        <div class="panel pad">
          <div class="disp">----</div>
          <div class="keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '✕', 0, '⌫'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
        </div>
      </div>`);
    document.getElementById('ui').appendChild(el);
    S.busy = true;
    S.player.freeze(true);
    const disp = el.querySelector('.disp');
    const finish = (ok) => {
      el.remove();
      S.waiters.delete(w);
      S.busy = false;
      S.player.freeze(false);
      removeEventListener('keydown', key);
      if (ok) res(true);
      else if (ok === null) res(false);
    };
    const w = { fn: () => false, res, rej, off: () => finish(false) };
    S.waiters.add(w);
    const press = (k) => {
      if (k === '✕') return finish(null);
      if (k === '⌫') cur = cur.slice(0, -1);
      else if (cur.length < 4) cur += k;
      audio.blip(1.4, 0.06);
      disp.textContent = cur.padEnd(4, '-');
      if (cur.length === 4) {
        if (cur === code) {
          audio.okBeep?.(0.2);
          setTimeout(() => finish(true), 350);
        } else {
          audio.errorBeep?.(0.2);
          disp.classList.add('bad');
          setTimeout(() => {
            cur = '';
            disp.textContent = '----';
            disp.classList.remove('bad');
          }, 500);
        }
      }
    };
    const key = (e) => {
      if (/^Digit\d$|^Numpad\d$/.test(e.code)) press(e.code.slice(-1));
      if (e.code === 'Backspace') press('⌫');
    };
    addEventListener('keydown', key);
    el.querySelectorAll('button').forEach((b) =>
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        press(b.dataset.k);
      }),
    );
    if (S.G.dev.bot) setTimeout(() => [...code].forEach((c, i) => setTimeout(() => press(c), i * 100)), 200);
  });
}

/** Scripted in-engine close up when a video clip is missing. */
export async function closeUp(S, mover, { dist = 1.7, dur = 3, fn = null } = {}) {
  const P = S.player;
  const x = P.x - Math.sin(P.yaw) * dist;
  const z = P.z - Math.cos(P.yaw) * dist;
  const [nx, nz] = S.world.nav.nearest(x, z);
  mover.script([nx, nz]);
  P.face(nx, nz);
  P.pitch = 0.02;
  if (fn) fn();
  await S.wait(dur);
}

export const spotXZ = (key) => [SPOTS[key][0], SPOTS[key][1]];
export { UI, POINTS, SPOTS, PLAYER, audio };
