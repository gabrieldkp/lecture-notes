// 녹음(MediaRecorder)과 실시간 한국어 전사(Web Speech API)

export class Recorder {
  constructor() { this.state = 'idle'; this.acc = 0; this.since = 0; this.chunks = []; }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: true, autoGainControl: true },
    });
    const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
    this.mime = types.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
    this.mr = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined);
    this.chunks = [];
    this.mr.ondataavailable = (e) => { if (e.data && e.data.size) this.chunks.push(e.data); };
    this.mr.start(1000); // 1초마다 조각 저장 (중간 저장용)
    this.acc = 0;
    this.since = performance.now();
    this.state = 'rec';
    await this.#lockScreen();
  }

  elapsed() {
    return this.acc + (this.state === 'rec' ? (performance.now() - this.since) / 1000 : 0);
  }

  pause() {
    if (this.state !== 'rec') return;
    this.acc = this.elapsed();
    this.state = 'paused';
    this.mr.pause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.since = performance.now();
    this.state = 'rec';
    this.mr.resume();
  }

  // 지금까지 녹음된 부분 (앱이 갑자기 꺼져도 남도록 주기적으로 저장)
  snapshot() { return new Blob(this.chunks, { type: this.mr?.mimeType || this.mime || 'audio/mp4' }); }

  stop() {
    return new Promise((resolve) => {
      this.duration = this.elapsed();
      this.state = 'idle';
      this.mr.onstop = () => {
        this.stream.getTracks().forEach((t) => t.stop());
        this.wakeLock?.release?.().catch(() => {});
        resolve(this.snapshot());
      };
      this.mr.stop();
    });
  }

  // 녹음 중 화면이 꺼지지 않게 (꺼지면 Safari가 녹음을 멈출 수 있음)
  async #lockScreen() {
    try { this.wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* 지원 안 하면 무시 */ }
  }
  async relock() { if (this.state !== 'idle') await this.#lockScreen(); }
}

export class Transcriber {
  static supported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

  constructor({ now, onFinal, onInterim, onError }) {
    Object.assign(this, { now, onFinal, onInterim, onError });
    this.on = false;
  }

  start() { if (!Transcriber.supported()) return; this.on = true; this.#spawn(); }

  stop() { this.on = false; try { this.r?.stop(); } catch { /* 무시 */ } this.onInterim(''); }

  #spawn() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'ko-KR';
    r.continuous = true;
    r.interimResults = true;
    let segT = null;
    r.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (segT == null) segT = this.now();
        if (res.isFinal) {
          const text = res[0].transcript.trim();
          if (text) this.onFinal({ t: segT, text });
          segT = null;
        } else {
          interim += res[0].transcript;
        }
      }
      this.onInterim(interim);
    };
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { this.on = false; this.onError?.(e.error); }
    };
    // 브라우저가 일정 시간 뒤 인식을 끊으면 자동으로 다시 시작
    r.onend = () => {
      this.onInterim('');
      if (this.on) setTimeout(() => this.on && this.#spawn(), 300);
    };
    try { r.start(); } catch { /* 이미 시작됨 */ }
    this.r = r;
  }
}
