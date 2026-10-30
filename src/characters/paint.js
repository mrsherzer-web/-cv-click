// Canvas textures for characters: the head (skin with hair, fade and facial hair painted on), hair strands
// and small original chest prints. No photos are used; the looks come from written specs.
import * as THREE from 'three';

const tex = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };

// how far down each hairstyle reaches, as fractions of the height from the crown (0.5 = ear level)
const HAIRLINES = {
  buzz: { sides: 0.3, front: 0.22, back: 0.34, fade: 0.16 },
  crop: { sides: 0.33, front: 0.24, back: 0.38, fade: 0.14 },
  fluffy: { sides: 0.42, front: 0.24, back: 0.5, fade: 0.06 },
  curly: { sides: 0.3, front: 0.24, back: 0.36, fade: 0.15 },
  textured: { sides: 0.31, front: 0.22, back: 0.37, fade: 0.15 },
};

// The head texture wraps a sphere: u = 0.25 is the middle of the face and v runs from the crown (0) down.
// `solid` is where the full-length hair ends at column u, `fade` how far the faded sides continue below it.
export function hairline(style, u) {
  const hl = HAIRLINES[style];
  const face = Math.max(0, Math.cos((u - 0.25) * Math.PI * 2));
  const back = Math.max(0, Math.cos((u - 0.75) * Math.PI * 2));
  return {
    solid: hl.sides + (hl.front - hl.sides) * face + (hl.back - hl.sides) * back,
    fade: face > 0.85 ? 0 : hl.fade * (1 - face) + back * 0.06,
    face,
  };
}

// how much of the point (u, v) facial hair covers, as [beard, mustache], each 0..1
export function facialHair(fh, u, v) {
  let du = u - 0.25;
  if (du > 0.5) du -= 1;
  const a = Math.abs(du);
  let beard = 0, mustache = 0;
  if (fh.beard && a < 0.25) {
    const top = 0.655 - smooth(0.06, 0.22, a) * 0.17;  // cheek line rising from the mouth to the sideburns
    const bottom = 0.9 - a * 0.6;                       // chin curving up toward the ears
    if (v > top && v < bottom && !(a < 0.05 && v < 0.67)) {
      beard = smooth(top, top + 0.045, v) * (1 - smooth(bottom - 0.03, bottom, v)) * (1 - smooth(0.2, 0.25, a));
    }
  }
  if (fh.mustache && a < 0.07 && v > 0.585 + a * 0.25 && v < 0.625) mustache = 1 - smooth(0.05, 0.07, a); // thins toward the corners
  return [beard, mustache];
}

export function headTexture(spec) {
  const W = 512, H = 256, c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = spec.skin;
  g.fillRect(0, 0, W, H);
  const [sr, sg, sb] = rgb(spec.skin);
  const soft = (u, v, rx, ry, color, alpha) => { // a soft oval of tone; rx and ry are fractions of width and height
    const R = rx * W;
    g.save();
    g.translate(u * W, v * H);
    g.scale(1, (ry * H) / R);
    const grd = g.createRadialGradient(0, 0, 0, 0, 0, R);
    grd.addColorStop(0, `rgba(${color},${alpha})`);
    grd.addColorStop(1, `rgba(${color},0)`);
    g.fillStyle = grd;
    g.fillRect(-R, -R, 2 * R, 2 * R);
    g.restore();
  };
  const deep = `${(sr * 0.62) | 0},${(sg * 0.5) | 0},${(sb * 0.45) | 0}`;
  for (const s of [-1, 1]) {
    soft(0.25 + s * 0.061, 0.445, 0.04, 0.035, deep, 0.35);            // shade around the eyes
    soft(0.25 + s * 0.075, 0.56, 0.05, 0.05, '196,104,92', 0.08);       // a little warmth on the cheeks
  }
  soft(0.25, 0.64, 0.035, 0.016, '150,72,62', 0.35);                     // around the lips
  soft(0.25, 0.9, 0.2, 0.1, deep, 0.25);                                  // under the jaw

  const [hr, hg, hb] = rgb(spec.hair.color);
  for (let x = 0; x < W; x++) {
    const { solid, fade } = hairline(spec.hair.style, x / W);
    g.fillStyle = spec.hair.color;
    g.fillRect(x, 0, 1, solid * H);
    if (fade > 0) {
      const grd = g.createLinearGradient(0, solid * H, 0, (solid + fade) * H);
      grd.addColorStop(0, `rgba(${hr},${hg},${hb},1)`);
      grd.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
      g.fillStyle = grd;
      g.fillRect(x, solid * H, 1, fade * H);
    }
  }
  // facial hair: stubble or a short beard along the jaw, and a mustache
  const fh = spec.facial || {};
  if (fh.beard || fh.mustache) {
    const [br, bg, bb] = rgb(fh.color || spec.hair.color);
    const img = g.getImageData(0, 0, W, H), d = img.data;
    const dens = fh.beard === 'short' ? 0.9 : fh.beard === 'stubble' ? 0.42 : 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const [beard, mustache] = facialHair(fh, x / W, y / H);
        const alpha = Math.max(beard * dens, mustache * 0.9);
        if (alpha > 0) {
          const k = (y * W + x) * 4, n = alpha * (0.8 + 0.2 * Math.random());
          d[k] = d[k] * (1 - n) + br * n; d[k + 1] = d[k + 1] * (1 - n) + bg * n; d[k + 2] = d[k + 2] * (1 - n) + bb * n;
        }
      }
    }
    g.putImageData(img, 0, 0);
  }
  for (let i = 0; i < 4800; i++) { // fine hair grain
    const x = Math.random() * W;
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},0.05)`;
    g.fillRect(x, Math.random() * H * hairline(spec.hair.style, x / W).solid, 1, 3);
  }
  return tex(c);
}

// strands running from the crown down, multiplied over the hair color
let strands = null;
export function hairTexture() {
  if (strands) return strands;
  const c = document.createElement('canvas');
  c.width = 128; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#e6e6e6';
  g.fillRect(0, 0, 128, 64);
  for (let i = 0; i < 700; i++) {
    const v = Math.random();
    g.fillStyle = v < 0.5 ? `rgba(255,255,255,${0.25 + v * 0.4})` : `rgba(0,0,0,${0.08 + (v - 0.5) * 0.3})`;
    g.fillRect(Math.random() * 128, Math.random() * 64 - 8, 1, 6 + Math.random() * 14);
  }
  strands = tex(c);
  strands.wrapS = strands.wrapT = THREE.RepeatWrapping;
  strands.repeat.set(5, 2);
  return strands;
}

// small chest prints, all invented for this game
export function printTexture(kind, color) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = g.fillStyle = color;
  g.lineWidth = 5;
  g.lineCap = 'round';
  switch (kind) {
    case 'sun': // a half sun over a horizon line
      g.beginPath(); g.arc(32, 36, 17, Math.PI, 0); g.stroke();
      g.beginPath(); g.moveTo(8, 38); g.lineTo(56, 38); g.stroke();
      break;
    case 'lines': // two short bars
      g.fillRect(12, 22, 40, 6); g.fillRect(12, 36, 26, 6);
      break;
    case 'dots': // three warm dots
      for (const [x, col] of [[16, '#f08a3c'], [32, '#2bb3a3'], [48, '#f2c94c']]) { g.fillStyle = col; g.beginPath(); g.arc(x, 32, 7, 0, Math.PI * 2); g.fill(); }
      break;
    case 'ring': // a ring crossed by a line
      g.beginPath(); g.arc(32, 32, 16, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(10, 32); g.lineTo(54, 32); g.stroke();
      break;
    case 'tag': // a plain fabric tag
      g.fillRect(14, 26, 36, 12);
      break;
    case 'fin': // a fin cutting a wave line: the other invented crew's mark
      g.beginPath(); g.moveTo(14, 44); g.lineTo(36, 14); g.lineTo(40, 44); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(6, 48); g.quadraticCurveTo(20, 40, 32, 48); g.quadraticCurveTo(44, 56, 58, 48); g.stroke();
      break;
    case 'oval': // a filled oval with a swoosh through it and two short lines under it, no lettering
      g.beginPath(); g.ellipse(32, 26, 25, 12, -0.08, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ffffff'; g.lineWidth = 3.5;
      g.beginPath(); g.moveTo(16, 28); g.quadraticCurveTo(32, 17, 48, 25); g.stroke();
      g.fillStyle = '#1e1f22'; g.fillRect(20, 44, 24, 3.5); g.fillRect(24, 51, 16, 3.5);
      break;
    case 'spikes': // a row of quills: the fictional crew's mark
      g.beginPath(); g.moveTo(6, 44);
      for (let i = 0; i < 6; i++) { g.lineTo(11 + i * 9, 18 + (i % 2) * 6); g.lineTo(15 + i * 9, 44); }
      g.stroke();
      break;
    default:
      return null;
  }
  return tex(c);
}
