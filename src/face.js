// Photo → face texture. Everything happens in this browser; nothing is uploaded.

const VIEW = 600; // crop canvas size
const RING = 240; // crop circle radius
const OUT = 512;

export async function fileToCanvas(file, max = 1400) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new Error('image'));
      i.src = url;
    });
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * s));
    c.height = Math.max(1, Math.round(img.naturalHeight * s));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function dataURLToCanvas(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = () => reject(new Error('image'));
    img.src = url;
  });
}

export function canvasToDataURL(src, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.getContext('2d').drawImage(src, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.86);
}

// Soft round edge so the photo blends into the 3D head.
export function featherFace(src) {
  const c = document.createElement('canvas');
  c.width = c.height = OUT;
  const g = c.getContext('2d');
  g.drawImage(src, 0, 0, OUT, OUT);
  g.globalCompositeOperation = 'destination-in';
  const grad = g.createRadialGradient(OUT / 2, OUT / 2, OUT * 0.33, OUT / 2, OUT / 2, OUT * 0.49);
  grad.addColorStop(0, 'rgba(0,0,0,1)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, OUT, OUT);
  return c;
}

// Average of the cheeks / nose area, used to colour the rest of the head.
export function skinTone(src) {
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const g = c.getContext('2d');
  const w = src.width;
  const h = src.height;
  g.drawImage(src, w * 0.32, h * 0.5, w * 0.36, h * 0.24, 0, 0, 24, 24);
  const d = g.getImageData(0, 0, 24, 24).data;
  let r = 0;
  let gr = 0;
  let b = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 200) continue;
    r += d[i];
    gr += d[i + 1];
    b += d[i + 2];
    n++;
  }
  if (!n) return { r: 0.78, g: 0.58, b: 0.47 };
  const k = 1.06 / (255 * n);
  return { r: Math.min(1, r * k), g: Math.min(1, gr * k), b: Math.min(1, b * k) };
}

// Placeholder face until a photo is chosen.
export function defaultFace() {
  const c = document.createElement('canvas');
  c.width = c.height = OUT;
  const g = c.getContext('2d');
  const sk = g.createRadialGradient(230, 220, 40, 256, 270, 260);
  sk.addColorStop(0, '#e2b192');
  sk.addColorStop(1, '#b98266');
  g.fillStyle = sk;
  g.fillRect(0, 0, OUT, OUT);
  g.fillStyle = '#1d1512';
  for (const x of [190, 322]) {
    g.save();
    g.translate(x, 235);
    g.rotate(x < 256 ? 0.08 : -0.08);
    g.fillRect(-38, -8, 76, 14);
    g.restore();
  }
  for (const x of [192, 320]) {
    g.fillStyle = '#fbf6f0';
    g.beginPath();
    g.ellipse(x, 270, 26, 17, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#2b1d16';
    g.beginPath();
    g.arc(x + 3, 271, 12, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(120,70,50,0.6)';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(256, 285);
  g.quadraticCurveTo(244, 330, 262, 338);
  g.stroke();
  g.strokeStyle = '#7a3b2e';
  g.lineWidth = 9;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(205, 375);
  g.quadraticCurveTo(256, 410, 310, 372);
  g.stroke();
  return c;
}

// Drag to move, pinch / wheel / slider to zoom; returns a 512² square of the circle.
export class Cropper {
  constructor({ modal, canvas, zoom, ok, cancel }) {
    this.modal = modal;
    this.canvas = canvas;
    this.zoom = zoom;
    this.ctx = canvas.getContext('2d');
    this.ptrs = new Map();
    this.src = null;
    this._resolve = null;
    canvas.addEventListener('pointerdown', (e) => {
      canvas.setPointerCapture(e.pointerId);
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    });
    canvas.addEventListener('pointermove', (e) => {
      const prev = this.ptrs.get(e.pointerId);
      if (!prev) return;
      const scale = VIEW / canvas.getBoundingClientRect().width;
      if (this.ptrs.size === 1) {
        this.ox += (e.clientX - prev.x) * scale;
        this.oy += (e.clientY - prev.y) * scale;
      } else if (this.ptrs.size === 2) {
        const [a, b] = [...this.ptrs.entries()];
        const other = a[0] === e.pointerId ? b[1] : a[1];
        const d0 = Math.hypot(prev.x - other.x, prev.y - other.y);
        const d1 = Math.hypot(e.clientX - other.x, e.clientY - other.y);
        if (d0 > 10) this._setZoom(this.z * (d1 / d0));
      }
      this.ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.draw();
    });
    const end = (e) => this.ptrs.delete(e.pointerId);
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this._setZoom(this.z * Math.exp(-e.deltaY * 0.0015));
        this.draw();
      },
      { passive: false }
    );
    zoom.addEventListener('input', () => {
      this._setZoom(parseFloat(zoom.value));
      this.draw();
    });
    ok.addEventListener('click', () => this._close(this._result()));
    cancel.addEventListener('click', () => this._close(null));
  }

  open(src) {
    this.src = src;
    this.z = 1.2;
    this.ox = 0;
    this.oy = 0;
    this.zoom.value = String(this.z);
    this.modal.hidden = false;
    this.draw();
    return new Promise((resolve) => (this._resolve = resolve));
  }

  _setZoom(z) {
    this.z = Math.min(5, Math.max(1, z));
    this.zoom.value = String(this.z);
  }

  _close(result) {
    this.modal.hidden = true;
    this.ptrs.clear();
    const r = this._resolve;
    this._resolve = null;
    if (r) r(result);
  }

  _paint(g) {
    const s = (VIEW / Math.min(this.src.width, this.src.height)) * this.z;
    g.save();
    g.translate(VIEW / 2 + this.ox, VIEW / 2 + this.oy);
    g.scale(s, s);
    g.drawImage(this.src, -this.src.width / 2, -this.src.height / 2);
    g.restore();
  }

  draw() {
    const g = this.ctx;
    g.fillStyle = '#0a0f1e';
    g.fillRect(0, 0, VIEW, VIEW);
    this._paint(g);
    g.save();
    g.fillStyle = 'rgba(10,15,30,0.66)';
    g.beginPath();
    g.rect(0, 0, VIEW, VIEW);
    g.arc(VIEW / 2, VIEW / 2, RING, 0, Math.PI * 2, true);
    g.fill('evenodd');
    g.restore();
    g.strokeStyle = '#ffb54a';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(VIEW / 2, VIEW / 2, RING, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([10, 10]);
    g.strokeStyle = 'rgba(255,241,220,0.5)';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(VIEW / 2, VIEW / 2 + 8, 150, 196, 0, 0, Math.PI * 2);
    g.stroke();
    g.setLineDash([]);
  }

  _result() {
    const out = document.createElement('canvas');
    out.width = out.height = OUT;
    const g = out.getContext('2d');
    const k = OUT / (RING * 2);
    const o = VIEW / 2 - RING;
    g.setTransform(k, 0, 0, k, -o * k, -o * k);
    this._paint(g);
    return out;
  }
}
