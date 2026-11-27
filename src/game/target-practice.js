// Všechny polohy v kole jsou relativní k hrací ploše. Zásah se porovnává v pixelech.
export class TargetRound {
  constructor() {
    this.time = this.rest = this.hits = this.attempts = 0;
  }

  step(dt) {
    const wait = Math.min(this.rest, dt);
    this.rest -= wait;
    this.time += dt - wait;
  }

  position() {
    const phase = this.time * .85 + this.hits * 2.4;
    return { x: .5 + .36 * Math.sin(phase), y: .5 - .22 * Math.cos(phase * 1.4) };
  }

  attempt(dx, dy, radius) {
    if (this.rest > 0) return null;
    this.attempts++;
    if (Math.hypot(dx, dy) > radius) return false;
    this.hits++;
    this.time = 0;
    this.rest = .65;
    return true;
  }
}

export class TargetPractice {
  constructor(leave) {
    const el = id => document.getElementById(id);
    this.dialog = el('targets');
    this.field = el('target-field');
    this.disc = el('target-disc');
    this.cursor = el('target-cursor');
    this.hits = el('target-hits');
    this.attempts = el('target-attempts');
    this.feedback = el('target-feedback');
    el('target-confirm').addEventListener('click', () => this.attempt());
    el('target-exit').addEventListener('click', leave);
    this.dialog.addEventListener('cancel', e => { e.preventDefault(); leave(); });
    this.dialog.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.code === 'Escape') { e.preventDefault(); leave(); return; }
      if (e.target !== this.field) return;
      const arrows = { ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1] };
      if (arrows[e.code]) {
        e.preventDefault();
        const [dx, dy] = arrows[e.code];
        this.aim(this.x + dx * .025, this.y + dy * .025);
      } else if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        if (!e.repeat) this.attempt();
      }
    });
    const point = e => {
      const rect = this.field.getBoundingClientRect();
      this.aim((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height);
    };
    this.field.addEventListener('pointerdown', e => {
      if (!e.isPrimary || e.button !== 0) return;
      this.field.focus({ preventScroll: true });
      point(e);
      if (e.pointerType === 'mouse') this.attempt();
      else this.field.setPointerCapture(e.pointerId);
    });
    this.field.addEventListener('pointermove', e => {
      if (e.isPrimary && (e.pointerType === 'mouse' || this.field.hasPointerCapture(e.pointerId))) point(e);
    });
  }

  start() {
    this.round = new TargetRound();
    this.hits.textContent = this.attempts.textContent = '0';
    this.feedback.textContent = '';
    this.show();
    this.aim(.5, .5);
    this.update(0);
  }

  show() {
    if (!this.dialog.open) this.dialog.showModal();
    this.field.focus({ preventScroll: true });
  }

  hide() {
    if (this.dialog.open) this.dialog.close();
  }

  end() {
    this.hide();
    this.round = null;
  }

  aim(x, y) {
    this.x = Math.max(0, Math.min(1, x));
    this.y = Math.max(0, Math.min(1, y));
    this.cursor.style.left = this.x * 100 + '%';
    this.cursor.style.top = this.y * 100 + '%';
  }

  attempt() {
    if (!this.dialog.open || !this.round) return;
    const { x, y } = this.round.position();
    const hit = this.round.attempt((this.x - x) * this.field.clientWidth,
      (this.y - y) * this.field.clientHeight, this.disc.offsetWidth / 2);
    if (hit === null) return;
    this.hits.textContent = String(this.round.hits);
    this.attempts.textContent = String(this.round.attempts);
    this.feedback.textContent = hit ? 'Zásah!' : 'Vedle';
    this.disc.hidden = hit;
  }

  update(dt) {
    this.round.step(dt);
    const { x, y } = this.round.position();
    this.disc.hidden = this.round.rest > 0;
    this.disc.style.left = x * 100 + '%';
    this.disc.style.top = y * 100 + '%';
  }
}
