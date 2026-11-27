// 녹음(MediaRecorder)과 실시간 한국어 전사(Web Speech API)

// 녹음은 "구간(segment)" 단위로 저장합니다.
// - 5분마다 새 구간으로 넘어가며 앞 구간을 완성된 파일로 저장 (앱이 꺼져도 최대 5분만 손실)
// - 일시정지 = 구간 끝내기, 계속 = 새 구간 시작 (Safari의 pause 버그 회피)
// - 다음 구간을 먼저 시작한 뒤 이전 구간을 끝내서 이음새에 빈틈이 없게
const ROTATE_MS = 5 * 60 * 1000;

export class Recorder {
  constructor({ onSegment, onLevel, onBroken } = {}) {
    this.state = 'idle';
    this.acc = 0;
    this.since = 0;
    this.onSegment = onSegment; // async ({start, duration, blob}) — start는 이번 녹음 세션 기준 초
    this.onLevel = onLevel;     // (0~1 소리 크기, 파형 데이터)
    this.onBroken = onBroken;   // () 녹음이 끊겼을 때 (화면 잠금, 다른 앱, 전화 등)
  }

  async start() {
    // 아이패드 Safari: 녹음용 오디오 모드로 전환 (자막 인식과 녹음이 같이 마이크를 쓰도록)
    try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch { /* 무시 */ }
    // 아이패드는 버튼을 누른 그 순간에 만들어야 오디오 측정이 켜짐
    try { const AC = window.AudioContext || window.webkitAudioContext; this.ac = new AC(); } catch { this.ac = null; }
    // 아이패드에서 세부 옵션을 주면 무음으로 녹음되는 경우가 있어 기본 설정 사용
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.#watch();
    const types = ['audio/mp4', 'audio/webm;codecs=opus', 'audio/webm'];
    this.mime = types.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) || '';
    this.acc = 0;
    this.since = performance.now();
    this.state = 'rec';
    this.#newSeg();
    this.#armRotate();
    this.#startMeter();
    await this.#lockScreen();
  }

  elapsed() {
    return this.acc + (this.state === 'rec' ? (performance.now() - this.since) / 1000 : 0);
  }

  #armRotate() {
    clearInterval(this.rotateTimer);
    this.rotateTimer = setInterval(() => this.#rotate(), window.__ROTATE_MS || ROTATE_MS);
  }

  // 마이크가 끊기는 신호를 감시
  #watch() {
    for (const tr of this.stream.getAudioTracks()) {
      tr.addEventListener('ended', () => this.#broke());
    }
  }

  #broke() {
    if (this.state === 'rec' && !this.recovering) this.onBroken?.();
  }

  // 지금 녹음이 정상인지 (마이크 연결, 녹음기 동작)
  healthy() {
    if (this.state !== 'rec') return true;
    const tr = this.stream?.getAudioTracks()[0];
    return !!tr && tr.readyState === 'live' && this.cur?.mr.state === 'recording';
  }

  // 끊긴 녹음 살리기: 지금까지 녹음된 부분을 저장하고, 마이크를 다시 열어 같은 타임라인에 이어서 녹음
  async recover() {
    if (this.state !== 'rec' || this.recovering) return false;
    this.recovering = true;
    try {
      const t = this.elapsed();
      const old = this.cur;
      this.cur = null;
      if (old) await this.onSegment?.(await this.#finish(old, t));
      this.stream?.getTracks().forEach((tr) => tr.stop());
      this.#stopMeter();
      try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch { /* 무시 */ }
      try { const AC = window.AudioContext || window.webkitAudioContext; this.ac = new AC(); } catch { this.ac = null; }
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.#watch();
      this.#newSeg();
      this.#armRotate();
      this.#startMeter();
      await this.#lockScreen();
      return true;
    } catch (err) {
      console.error(err);
      // 다시 못 열면 일시정지 상태로 두고 사용자가 '계속'을 누르게 함
      this.acc = this.elapsed();
      this.state = 'paused';
      clearInterval(this.rotateTimer);
      return false;
    } finally {
      this.recovering = false;
    }
  }

  #newSeg() {
    const mr = new MediaRecorder(this.stream, this.mime ? { mimeType: this.mime } : undefined);
    const seg = { mr, start: this.elapsed(), chunks: [] };
    mr.ondataavailable = (e) => { if (e.data && e.data.size) seg.chunks.push(e.data); };
    mr.onerror = () => this.#broke();
    mr.start();
    this.cur = seg;
  }

  #finish(seg, endT) {
    return new Promise((resolve) => {
      const done = () => resolve({
        start: seg.start,
        duration: Math.max(0, endT - seg.start),
        blob: new Blob(seg.chunks, { type: seg.mr.mimeType || this.mime || 'audio/mp4' }),
      });
      // 아이패드 Safari는 두 번째 녹음부터 데이터가 늦게 오는 경우가 있어 잠깐 더 기다림
      seg.mr.onstop = () => { if (seg.chunks.length) done(); else setTimeout(done, 600); };
      if (seg.mr.state === 'inactive') { setTimeout(done, 300); return; } // 이미 멈춘 녹음기: 모인 데이터만 저장
      try { seg.mr.requestData(); } catch { /* 무시 */ }
      try { seg.mr.stop(); } catch { setTimeout(done, 300); }
    });
  }

  async #rotate() {
    if (this.state !== 'rec') return;
    const old = this.cur;
    const t = this.elapsed();
    this.#newSeg();
    this.cur.start = t;
    await this.onSegment?.(await this.#finish(old, t));
  }

  async pause() {
    if (this.state !== 'rec') return;
    this.acc = this.elapsed();
    this.state = 'paused';
    clearInterval(this.rotateTimer);
    const seg = this.cur;
    this.cur = null;
    await this.onSegment?.(await this.#finish(seg, this.acc));
  }

  async resume() {
    if (this.state !== 'paused') return;
    const tr = this.stream?.getAudioTracks()[0];
    if (!tr || tr.readyState !== 'live') {
      // 마이크가 닫혀 있으면 다시 열기
      this.#stopMeter();
      try { const AC = window.AudioContext || window.webkitAudioContext; this.ac = new AC(); } catch { this.ac = null; }
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.#watch();
      this.#startMeter();
    }
    this.since = performance.now();
    this.state = 'rec';
    this.#newSeg();
    this.#armRotate();
  }

  async stop() {
    const t = this.elapsed();
    const wasRec = this.state === 'rec';
    this.acc = t;
    this.state = 'stopping';
    clearInterval(this.rotateTimer);
    if (wasRec && this.cur) { const seg = this.cur; this.cur = null; await this.onSegment?.(await this.#finish(seg, t)); }
    this.stream?.getTracks().forEach((tr) => tr.stop());
    this.#stopMeter();
    this.wakeLock?.release?.().catch(() => {});
    this.state = 'idle';
    // 녹음이 끝나면 재생용 오디오 모드로 되돌림 (안 그러면 재생 소리가 안 나는 경우가 있음)
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch { /* 무시 */ }
    return t;
  }

  // 마이크 소리 크기 측정 (녹음이 실제로 되고 있는지 화면에 보여주기 위함)
  #startMeter() {
    try {
      if (!this.ac) return;
      const src = this.ac.createMediaStreamSource(this.stream);
      const an = this.ac.createAnalyser();
      an.fftSize = 1024;
      src.connect(an);
      const buf = new Float32Array(an.fftSize);
      this.meterTimer = setInterval(() => {
        if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
        an.getFloatTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += v * v;
        const rms = Math.sqrt(sum / buf.length);
        this.onLevel?.(Math.min(1, rms * 8), buf);
      }, 60);
    } catch { /* 측정 못 해도 녹음은 계속 */ }
  }
  #stopMeter() { clearInterval(this.meterTimer); this.ac?.close?.().catch(() => {}); this.ac = null; }

  // 녹음 중 화면이 꺼지지 않게 (꺼지면 Safari가 녹음을 멈출 수 있음)
  async #lockScreen() {
    try { this.wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* 지원 안 하면 무시 */ }
  }
  async relock() { if (this.state === 'rec' || this.state === 'paused') await this.#lockScreen(); }
}

export class Transcriber {
  static supported() { return !!(window.SpeechRecognition || window.webkitSpeechRecognition); }

  constructor({ now, onFinal, onInterim, onError }) {
    Object.assign(this, { now, onFinal, onInterim, onError });
    this.on = false;
  }

  start() {
    if (!Transcriber.supported()) return;
    this.on = true;
    this.quickEnds = 0;
    this.#spawn();
  }

  stop() { this.on = false; try { this.r?.stop(); } catch { /* 무시 */ } this.onInterim(''); }

  #spawn() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR();
    r.lang = 'ko-KR';
    r.continuous = true;
    r.interimResults = true;
    let segT = null;
    const startedAt = performance.now();
    let gotResult = false;
    r.onresult = (e) => {
      gotResult = true;
      this.quickEnds = 0;
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
    // 시작하자마자 계속 끊기면(아이패드에서 녹음과 동시에 못 쓰는 경우) 간격을 늘리다가 자막만 끔
    r.onend = () => {
      this.onInterim('');
      if (!this.on) return;
      const quick = !gotResult && performance.now() - startedAt < 2000;
      this.quickEnds = quick ? this.quickEnds + 1 : 0;
      if (this.quickEnds >= 4) { this.on = false; this.onError?.('unstable'); return; }
      const delay = [300, 1000, 2500, 5000][this.quickEnds] ?? 5000;
      setTimeout(() => this.on && this.#spawn(), delay);
    };
    try { r.start(); } catch { /* 이미 시작됨 */ }
    this.r = r;
  }
}
