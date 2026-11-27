// 슬라이드를 위아래로 이어서 보여주는 화면
// - 화면 근처 페이지만 그려서 아이패드 메모리를 아낌
// - 애플펜슬은 필기, 손가락은 스크롤 ("손가락 필기"를 켜면 손가락도 필기)
import { h } from './util.js';
import { createInk } from './ink.js';

const BLANK = { w: 794, h: 1123 }; // 빈 페이지는 A4 세로 비율
const GAP = 16;

export class PageView {
  constructor(opts) {
    // opts: lec, getPdf(), getTool(), now(), onInkChange(), onPick(stroke), onPageChange(n), onUserScroll()
    this.o = opts;
    this.el = h('div', { class: 'stage' });
    this.sheets = [];
    this.inks = new Map();
    this.active = new Set();
    this.tasks = new Map();
    this.current = 0;
    this.replayT = null;
    this.lastInkPage = null;
    this.programmatic = 0;

    this.io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        const n = +e.target.dataset.page;
        if (e.isIntersecting) this.#activate(n); else this.#deactivate(n);
      }
    }, { root: this.el, rootMargin: '120% 0px' });

    let raf = 0;
    this.el.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; this.#onScroll(); });
    }, { passive: true });
    // 손가락으로 직접 스크롤했는지 (재생 따라가기 자동 해제용)
    const user = () => { if (!this.programmatic) this.userTouched = performance.now(); };
    this.el.addEventListener('touchstart', user, { passive: true });
    this.el.addEventListener('wheel', user, { passive: true });

    this.ro = new ResizeObserver(() => { clearTimeout(this.roT); this.roT = setTimeout(() => this.layout(), 120); });
    this.ro.observe(this.el);
  }

  get count() { return this.sheets.length; }

  async build() {
    const pdf = this.o.getPdf();
    const sizes = [];
    if (pdf) {
      for (let i = 1; i <= pdf.numPages; i++) {
        const v = (await pdf.getPage(i)).getViewport({ scale: 1 });
        sizes.push({ w: v.width, h: v.height });
      }
    } else {
      for (let i = 0; i < (this.o.lec.blankPages || 1); i++) sizes.push(BLANK);
    }
    this.io.disconnect();
    for (const n of [...this.active]) this.#deactivate(n);
    this.inks.clear();
    this.sizes = sizes;
    this.sheets = sizes.map((_, i) => {
      const n = i + 1;
      const pdfC = h('canvas', { class: 'pdf-canvas' });
      const inkC = h('canvas', { class: 'ink-canvas' });
      return h('div', { class: 'sheet', 'data-page': n }, pdfC, inkC, h('span', { class: 'page-no' }, n));
    });
    this.el.replaceChildren(...this.sheets);
    this.current = 0;
    this.layout();
    this.sheets.forEach((s) => this.io.observe(s));
  }

  layout() {
    if (!this.sheets.length) return;
    const W = Math.max(200, Math.min(this.el.clientWidth - 2 * GAP, 1400));
    this.cssW = W;
    this.sheets.forEach((s, i) => {
      const sz = this.sizes[i];
      s.style.width = `${W}px`;
      s.style.height = `${Math.round((W * sz.h) / sz.w)}px`;
    });
    // 크기가 바뀌면 보이는 페이지 다시 그리기
    for (const n of [...this.active]) { this.#deactivate(n); this.#activate(n); }
    this.#onScroll();
  }

  #activate(n) {
    if (this.active.has(n)) return;
    this.active.add(n);
    const sheet = this.sheets[n - 1];
    if (!sheet) return;
    const [pdfC, inkC] = sheet.querySelectorAll('canvas');
    const cssW = this.cssW, cssH = Math.round((cssW * this.sizes[n - 1].h) / this.sizes[n - 1].w);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [pdfC, inkC]) {
      c.style.width = `${cssW}px`; c.style.height = `${cssH}px`;
      c.width = Math.floor(cssW * dpr); c.height = Math.floor(cssH * dpr);
    }
    const ctx = pdfC.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, pdfC.width, pdfC.height);

    let ink = this.inks.get(n);
    if (!ink) {
      ink = createInk(inkC, {
        getTool: this.o.getTool,
        now: this.o.now,
        onChange: () => { this.lastInkPage = n; this.o.onInkChange(); },
        onPick: this.o.onPick,
      });
      this.inks.set(n, ink);
    }
    this.o.lec.ink[n] ||= [];
    ink.setStrokes(this.o.lec.ink[n]);
    ink.setReplayTime(this.replayT);

    const pdf = this.o.getPdf();
    if (pdf) {
      pdf.getPage(n).then((page) => {
        if (!this.active.has(n)) return;
        const vp = page.getViewport({ scale: (cssW / page.getViewport({ scale: 1 }).width) * dpr });
        const task = page.render({ canvasContext: ctx, viewport: vp });
        this.tasks.set(n, task);
        task.promise.catch((e) => { if (e?.name !== 'RenderingCancelledException') console.error(e); })
          .finally(() => { if (this.tasks.get(n) === task) this.tasks.delete(n); });
      });
    }
  }

  #deactivate(n) {
    if (!this.active.has(n)) return;
    this.active.delete(n);
    try { this.tasks.get(n)?.cancel(); } catch { /* 무시 */ }
    this.tasks.delete(n);
    const sheet = this.sheets[n - 1];
    if (!sheet) return;
    // 화면에서 멀어진 페이지는 그림을 지워 메모리 확보 (크기는 그대로 유지)
    for (const c of sheet.querySelectorAll('canvas')) { c.width = 0; c.height = 0; }
  }

  #onScroll() {
    if (!this.sheets.length) return;
    const line = this.el.scrollTop + this.el.clientHeight * 0.4;
    let n = 1;
    for (const s of this.sheets) { if (s.offsetTop <= line) n = +s.dataset.page; else break; }
    if (n !== this.current) {
      this.current = n;
      this.o.onPageChange(n);
    }
    if (!this.programmatic && this.userTouched && performance.now() - this.userTouched < 1500) this.o.onUserScroll?.();
  }

  scrollToPage(n, smooth = true) {
    const s = this.sheets[n - 1];
    if (!s) return;
    this.programmatic++;
    this.el.scrollTo({ top: s.offsetTop - GAP, behavior: smooth ? 'smooth' : 'auto' });
    setTimeout(() => { this.programmatic--; }, smooth ? 800 : 100);
  }

  setReplayTime(t) {
    this.replayT = t;
    for (const [n, ink] of this.inks) if (this.active.has(n)) ink.setReplayTime(t);
  }

  undo() { this.inks.get(this.lastInkPage ?? this.current)?.undo(); }

  setFinger(on) { this.el.classList.toggle('finger-draw', on); }

  destroy() {
    this.io.disconnect();
    this.ro.disconnect();
    for (const n of [...this.active]) this.#deactivate(n);
  }
}
