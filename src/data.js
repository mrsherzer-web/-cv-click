/* Data tables: enemies, waves, weapons, passives. Weapon/passive logic lives here; G (game.js) supplies the helpers. */
const ENEMIES = {
  chip:     { hp: 12,  speed: 150, dmg: 8,  r: 16, xp: 1, score: 10, color: '#ffd978', mass: 1 },
  cookie:   { hp: 48,  speed: 85,  dmg: 14, r: 22, xp: 2, score: 25, color: '#b9743a', mass: 2.5 },
  cap:      { hp: 30,  speed: 75,  dmg: 10, r: 17, xp: 2, score: 30, color: '#c8102e', mass: 1 },
  lighter:  { hp: 16,  speed: 215, dmg: 0,  r: 12, xp: 2, score: 30, color: '#3ddc3d', mass: 0.7 },
  wraith:   { hp: 36,  speed: 115, dmg: 12, r: 18, xp: 3, score: 40, color: '#e8dcff', mass: 0.5 },
  blob:     { hp: 70,  speed: 80,  dmg: 14, r: 22, xp: 3, score: 40, color: '#ff6a3d', mass: 2 },
  bottle:   { hp: 120, speed: 55,  dmg: 20, r: 18, xp: 5, score: 60, color: '#8a4a1a', mass: 4 },
  hydra:    { boss: true, hp: 1500, speed: 65, dmg: 22, r: 62, xp: 60,  score: 2500,  color: '#d61f2c', mass: 50 },
  lavalord: { boss: true, hp: 3800, speed: 52, dmg: 25, r: 64, xp: 120, score: 6000,  color: '#ff2d95', mass: 60 },
  king:     { boss: true, hp: 8000, speed: 72, dmg: 30, r: 84, xp: 250, score: 15000, color: '#f0d9a8', mass: 80 },
};

const ALL = ['chip', 'cookie', 'cap', 'lighter', 'wraith', 'blob', 'bottle'];
function waveDef(n) {
  let pool, boss = null;
  switch (n) {
    case 1: pool = [['chip', 1]]; break;
    case 2: pool = [['chip', 3], ['cookie', 1]]; break;
    case 3: pool = [['chip', 3], ['cookie', 1.5], ['cap', 1]]; break;
    case 4: pool = [['chip', 3], ['cookie', 1.5], ['cap', 1], ['lighter', 1]]; break;
    case 5: pool = [['chip', 2], ['cookie', 1]]; boss = 'hydra'; break;
    case 6: pool = [['chip', 2], ['cookie', 2], ['cap', 1.2], ['lighter', 1], ['wraith', 1.5]]; break;
    case 7: pool = [['chip', 2], ['cookie', 2], ['cap', 1.2], ['lighter', 1], ['wraith', 1.5], ['blob', 1.5]]; break;
    case 8: pool = [['chip', 2], ['cookie', 2], ['cap', 1.2], ['lighter', 1.2], ['wraith', 1.5], ['blob', 1.5], ['bottle', 1]]; break;
    case 9: pool = ALL.map(t => [t, 1]); break;
    case 10: pool = [['blob', 2], ['chip', 1], ['wraith', 1]]; boss = 'lavalord'; break;
    case 15: pool = [['cookie', 1], ['bottle', 1], ['lighter', 1]]; boss = 'king'; break;
    default: pool = ALL.map(t => [t, t === 'chip' ? 1.5 : 1]);
  }
  const endless = n > 15;
  return {
    pool, boss,
    duration: boss ? Infinity : (n === 1 ? 28 : 34),
    interval: Math.max(0.2, (boss ? 1.6 : 1.15) - n * 0.055),
    batch: 1 + Math.floor(n / 4),
    hpMul: 1 + (n - 1) * 0.13 + (endless ? (n - 15) * 0.22 : 0),
    speedMul: 1 + Math.min(0.35, (n - 1) * 0.02),
    elite: n >= 3 ? Math.min(0.14, 0.03 + n * 0.006) : 0,
    cap: Math.min(170, 40 + n * 10),
  };
}

/* ---------- weapons ---------- */
const WEAPONS = {
  ring: {
    icon: '💨', max: 8,
    cd: l => 0.5 * Math.pow(0.93, l),
    fire(p, l) {
      const n = 1 + Math.floor(l / 2), spread = 0.16, dmg = 10 + l * 3, pierce = 1 + Math.floor(l / 3);
      const base = Math.atan2(p.aim.y, p.aim.x);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * spread;
        G.addBullet({ kind: 'ring', x: p.x + Math.cos(a) * 20, y: p.y - 60 * p.scale + Math.sin(a) * 20, vx: Math.cos(a) * 540, vy: Math.sin(a) * 540, r: 11 + l, dmg, pierce, life: 1.1 });
      }
      FX.smoke(p.x + p.aim.x * 24, p.y - 60 * p.scale, 2, 'rgba(230,210,255,1)', 20, { life: 0.4, alpha: 0.25 });
      AudioSys.sfx('shoot');
    },
  },
  orbit: {
    icon: '🌋', max: 6,
    passive: true,
    count: l => 1 + Math.floor((l + 1) / 2),
    radius: l => 70 + l * 6,
    speed: l => 2.3 + l * 0.25,
    dmg: l => 8 + l * 3,
    orbR: l => 11 + l,
  },
  boomer: {
    icon: '🥔', max: 6,
    cd: l => 1.5 * Math.pow(0.92, l),
    fire(p, l) {
      const n = l < 3 ? 1 : l < 5 ? 2 : 3, dmg = 16 + l * 5, range = 300 + l * 25;
      const base = Math.atan2(p.aim.y, p.aim.x);
      for (let i = 0; i < n; i++) {
        const a = base + (i - (n - 1) / 2) * 0.35;
        G.addBullet({ kind: 'chip', x: p.x, y: p.y - 50 * p.scale, vx: Math.cos(a) * 480, vy: Math.sin(a) * 480, r: 15, dmg, pierce: 99, life: 6, range, travelled: 0, returning: false, spin: 0 });
      }
      AudioSys.sfx('boomer');
    },
  },
  aura: {
    icon: '🌫️', max: 6, passive: true,
    radius: l => 62 + l * 13,
    dps: l => 10 + l * 5,
  },
  laugh: {
    icon: '😂', max: 6,
    cd: l => 4.6 * Math.pow(0.9, l),
    fire(p, l) {
      const dmg = 20 + l * 8, radius = 150 + l * 22;
      G.shockwave(p.x, p.y - 30, radius, dmg, 420, '#ffd23f');
      FX.text(p.x + (Math.random() - 0.5) * 60, p.y - 110, t('hahaha'), '#ffd23f', 26, { font: 'Secular One' });
      AudioSys.tone(300, 180, 0.25, 'sawtooth', 0.18);
    },
  },
  fire: {
    icon: '🔥', max: 6,
    cd: l => 1.3 * Math.pow(0.92, l),
    fire(p, l) {
      const n = 1 + Math.floor(l / 3), dmg = 14 + l * 4, blast = 62 + l * 9;
      const targets = G.nearestEnemies(p.x, p.y, n, 520);
      if (!targets.length) return;
      targets.forEach((e, i) => {
        const a = Math.atan2(e.y - (p.y - 40), e.x - p.x);
        G.addBullet({ kind: 'fire', x: p.x, y: p.y - 50 * p.scale, vx: Math.cos(a) * 430, vy: Math.sin(a) * 430, r: 9, dmg, pierce: 1, life: 1.6, blast });
      });
      AudioSys.sfx('fire');
    },
  },
};

const PASSIVES = {
  hp:     { icon: '❤️', max: 5, apply: p => { p.maxhp += 25; p.hp = Math.min(p.maxhp, p.hp + 25); } },
  speed:  { icon: '🩴', max: 5, apply: p => { p.speed *= 1.12; } },
  dmg:    { icon: '💪', max: 5, apply: p => { p.dmgMul *= 1.15; } },
  rate:   { icon: '⏩', max: 5, apply: p => { p.rateMul *= 1.12; } },
  magnet: { icon: '🧲', max: 4, apply: p => { p.magnet += 50; } },
  regen:  { icon: '😴', max: 4, apply: p => { p.regen += 0.8; } },
  crit:   { icon: '🎯', max: 4, apply: p => { p.crit += 0.1; } },
  dash:   { icon: '💨', max: 3, apply: p => { p.dashCdMax *= 0.82; } },
  xp:     { icon: '🧠', max: 4, apply: p => { p.xpMul *= 1.15; } },
  armor:  { icon: '🛌', max: 3, apply: p => { p.armor += 2; } },
};
