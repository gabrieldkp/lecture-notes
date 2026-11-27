// 여러 녹음 구간을 하나의 타임라인처럼 재생하는 플레이어
import { h, fmtTime } from './util.js';
import { getFile } from './db.js';

export class SegPlayer {
  static async create(segs, opts) {
    const urls = [];
    for (const s of segs) {
      const blob = await getFile(s.key);
      urls.push(URL.createObjectURL(blob || new Blob()));
    }
    return new SegPlayer(segs, urls, opts);
  }

  constructor(segs, urls, { onTime } = {}) {
    this.segs = segs;
    this.urls = urls;
    this.onTime = onTime;
    this.i = -1;
    this.pendingSeek = null;
    this.audio = new Audio();
    this.audio.preload = 'auto';
    this.audio.addEventListener('loadedmetadata', () => {
      if (this.pendingSeek != null) { try { this.audio.currentTime = this.pendingSeek; } catch { /* 무시 */ } this.pendingSeek = null; }
    });
    this.audio.addEventListener('timeupdate', () => this.#tick());
    this.audio.addEventListener('ended', () => this.#next());
    this.audio.addEventListener('play', () => this.#ui());
    this.audio.addEventListener('pause', () => this.#ui());

    this.playBtn = h('button', { class: 'btn play', onClick: () => this.toggle(), 'aria-label': '재생' }, '▶');
    this.range = h('input', { type: 'range', class: 'seek', min: 0, step: 0.1, value: 0 });
    this.range.addEventListener('input', () => { this.dragging = true; this.label.textContent = this.#labelText(+this.range.value); });
    this.range.addEventListener('change', () => { this.dragging = false; this.seek(+this.range.value, !this.audio.paused); });
    this.label = h('span', { class: 'time-label' });
    this.el = h('div', { class: 'player' }, this.playBtn, this.range, this.label);
    this.#load(0);
    this.refresh();
  }

  get total() { const l = this.segs.at(-1); return l ? l.start + l.duration : 0; }
  get paused() { return this.audio.paused; }
  time() { return this.i < 0 ? 0 : this.segs[this.i].start + (this.audio.currentTime || 0); }

  #load(i) {
    if (i === this.i || !this.segs[i]) return false;
    this.i = i;
    this.audio.src = this.urls[i];
    return true;
  }

  // 아이패드 Safari: 녹음/자막 뒤에 오디오가 '녹음 모드'에 남아 소리가 안 나는 것 방지
  #playMode() {
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch { /* 무시 */ }
  }

  #play() { this.#playMode(); this.audio.play().catch(() => {}); }

  seek(t, play = true) {
    if (!this.segs.length || t == null) return;
    let i = this.segs.findIndex((s) => t < s.start + s.duration);
    if (i < 0) i = this.segs.length - 1;
    const off = Math.max(0, t - this.segs[i].start);
    if (this.#load(i)) this.pendingSeek = off;
    else { try { this.audio.currentTime = off; } catch { this.pendingSeek = off; } }
    if (play) this.#play();
    this.#tick(t);
  }

  toggle() {
    if (this.audio.paused) this.#play();
    else this.audio.pause();
  }

  pause() { this.audio.pause(); }

  #next() {
    if (this.i + 1 < this.segs.length) {
      this.#load(this.i + 1);
      this.#play();
    } else this.#ui();
  }

  #labelText(t) { return `${fmtTime(t)} / ${fmtTime(this.total)}`; }

  #tick(force, silent = false) {
    const t = force ?? this.time();
    if (!this.dragging) this.range.value = t;
    this.label.textContent = this.#labelText(t);
    if (!silent) this.onTime?.(t);
  }

  #ui() { this.playBtn.textContent = this.audio.paused ? '▶' : '❚❚'; }

  refresh() { this.range.max = Math.max(1, this.total); this.#tick(0, true); this.#ui(); }

  destroy() {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load(); // Safari에서 확실히 멈추도록
    this.urls.forEach((u) => URL.revokeObjectURL(u));
  }
}
