// Náhrada prohlížečového prostředí pro převod mapy do Godotu.
// Původní třída World potřebuje jen pár globálních objektů a jednoduché plátno
// pro hrubou masku povrchů (vyplnění mnohoúhelníků, sčítání barev, čtení pixelů).

function parseColor(text) {
  const hex = text.replace('#', '');
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const value = parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

class Context2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.fillStyle = '#000';
    this.globalCompositeOperation = 'source-over';
    this.data = null;
    this.path = [];
    this.current = null;
  }

  _ensure() {
    const size = this.canvas.width * this.canvas.height * 4;
    if (!this.data || this.data.length !== size) this.data = new Uint8ClampedArray(size);
  }

  _put(index, [r, g, b]) {
    const d = this.data;
    if (this.globalCompositeOperation === 'lighter') {
      d[index] = Math.min(255, d[index] + r);
      d[index + 1] = Math.min(255, d[index + 1] + g);
      d[index + 2] = Math.min(255, d[index + 2] + b);
    } else {
      d[index] = r; d[index + 1] = g; d[index + 2] = b;
    }
    d[index + 3] = 255;
  }

  fillRect(x, y, w, h) {
    this._ensure();
    const color = parseColor(this.fillStyle);
    const W = this.canvas.width, H = this.canvas.height;
    for (let j = Math.max(0, y); j < Math.min(H, y + h); j++) {
      for (let i = Math.max(0, x); i < Math.min(W, x + w); i++) this._put((j * W + i) * 4, color);
    }
  }

  beginPath() { this.path = []; this.current = null; }
  moveTo(x, y) { this.current = [x, y]; this.path.push(this.current); }
  lineTo(x, y) { if (!this.current) this.moveTo(x, y); else this.current.push(x, y); }
  closePath() { this.current = null; }

  // Vyplnění pravidlem sudé–liché přes střed pixelu, bez vyhlazování.
  fill() {
    this._ensure();
    const color = parseColor(this.fillStyle);
    const W = this.canvas.width, H = this.canvas.height;
    let minY = Infinity, maxY = -Infinity;
    for (const ring of this.path) {
      for (let k = 1; k < ring.length; k += 2) { minY = Math.min(minY, ring[k]); maxY = Math.max(maxY, ring[k]); }
    }
    const y0 = Math.max(0, Math.floor(minY)), y1 = Math.min(H - 1, Math.ceil(maxY));
    const xs = [];
    for (let j = y0; j <= y1; j++) {
      const yc = j + 0.5;
      xs.length = 0;
      for (const ring of this.path) {
        const n = ring.length / 2;
        for (let a = 0, b = n - 1; a < n; b = a++) {
          const ya = ring[a * 2 + 1], yb = ring[b * 2 + 1];
          if ((ya > yc) === (yb > yc)) continue;
          const xa = ring[a * 2], xb = ring[b * 2];
          xs.push(xa + (yc - ya) * (xb - xa) / (yb - ya));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const i0 = Math.max(0, Math.ceil(xs[k] - 0.5)), i1 = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
        for (let i = i0; i <= i1; i++) this._put((j * W + i) * 4, color);
      }
    }
  }

  getImageData(x, y, w, h) {
    this._ensure();
    const out = new Uint8ClampedArray(w * h * 4);
    const W = this.canvas.width;
    for (let j = 0; j < h; j++) out.set(this.data.subarray(((y + j) * W + x) * 4, ((y + j) * W + x + w) * 4), j * w * 4);
    return { data: out, width: w, height: h };
  }
}

class Canvas {
  constructor() { this.width = 300; this.height = 150; this._ctx = null; }
  getContext() { return (this._ctx ??= new Context2D(this)); }
}

export function installShim() {
  globalThis.matchMedia ??= () => ({ matches: false });
  globalThis.window ??= globalThis;
  globalThis.location ??= { search: '' };
  globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
  globalThis.screen ??= { width: 1920, height: 1080 };
  globalThis.devicePixelRatio ??= 1;
  globalThis.document ??= { createElement: (tag) => (tag === 'canvas' ? new Canvas() : {}) };
}
