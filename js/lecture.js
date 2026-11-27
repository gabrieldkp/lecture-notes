// 강의 화면: 왼쪽 슬라이드(PDF) + 필기, 오른쪽 타이핑 노트 / 실시간 전사, 위쪽 녹음
import { h, fmtTime, uid, debounce, toast } from './util.js';
import { getLecture, putLecture, getFile, putFile } from './db.js';
import { createInk } from './ink.js';
import { Recorder, Transcriber } from './recorder.js';

// PDF 뷰어(pdf.js 4.10.38)는 vendor 폴더에 함께 넣어 둬서 인터넷 없이도 동작
const PDFJS = new URL('../vendor/pdfjs/pdf.min.mjs', import.meta.url).href;
const PDFJS_WORKER = new URL('../vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
let pdfjsLib = null;
async function loadPdfjs() {
  if (!pdfjsLib) {
    pdfjsLib = await import(PDFJS);
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  }
  return pdfjsLib;
}

const COLORS = ['#111111', '#1f5eff', '#e5322d', '#13a05f'];
const HIGHLIGHT = '#ffd400';
const TOOLS = [['pen', '펜'], ['hl', '형광펜'], ['eraser', '지우개'], ['play', '▶ 필기 눌러 듣기']];

export async function openLecture(root, id) {
  const lec = await getLecture(id);
  if (!lec) throw new Error('강의를 찾을 수 없어요');

  const state = { page: lec.lastPage || 1, pdf: null, tool: 'pen', color: COLORS[0], finger: false, follow: true, tab: 'notes', liveTx: Transcriber.supported() };
  const save = debounce(() => putLecture(lec), 400);
  const rec = new Recorder();
  const tx = new Transcriber({
    now: () => rec.elapsed(),
    onFinal: (line) => { lec.transcript.push(line); save(); appendTranscriptLine(line); },
    onInterim: (text) => { interimLi.textContent = text; interimLi.hidden = !text; autoScroll(); },
    onError: (code) => {
      state.liveTx = false;
      liveToggle.querySelector('input').checked = false;
      toast(code === 'unstable'
        ? '실시간 자막이 계속 끊겨서 껐어요. 녹음은 그대로 계속돼요.'
        : '음성 인식 권한이 없어요. 녹음은 계속되고, 자막만 꺼졌어요.', 4000);
    },
  });
  let audio = null, audioUrl = null, tick = null, partialTimer = null;
  let renderToken = 0, renderTask = null, activeTxIdx = -1;

  const now = () => {
    if (rec.state !== 'idle') return rec.elapsed();
    if (audio && audio.currentTime > 0) return audio.currentTime;
    return null;
  };
  const pageCount = () => (state.pdf ? state.pdf.numPages : lec.blankPages || 1);

  // ---------- 화면 요소 ----------
  const titleInput = h('input', { class: 'lec-title', value: lec.title, enterkeyhint: 'done' });
  titleInput.addEventListener('input', () => { lec.title = titleInput.value; save(); });

  const recArea = h('div', { class: 'rec-area' });
  const timerEl = h('span', { class: 'timer' }, '00:00');

  const pdfC = h('canvas', { class: 'pdf-canvas' });
  const inkC = h('canvas', { class: 'ink-canvas' });
  const sheet = h('div', { class: 'sheet' }, pdfC, inkC);
  const stage = h('div', { class: 'stage' }, sheet);

  const toolbar = h('div', { class: 'toolbar' });
  const pageLabel = h('span', { class: 'page-label' });
  const nav = h('div', { class: 'nav' },
    h('button', { class: 'btn', onClick: () => goPage(state.page - 1) }, '‹ 이전'),
    pageLabel,
    h('button', { class: 'btn', onClick: () => goPage(state.page + 1) }, '다음 ›'),
  );
  const addPageBtn = h('button', { class: 'btn ghost', onClick: () => { lec.blankPages = (lec.blankPages || 1) + 1; save(); goPage(lec.blankPages); } }, '+ 빈 페이지');
  nav.append(addPageBtn);

  // 타이핑 노트
  const notesList = h('ul', { class: 'notes' });
  const composer = h('textarea', { class: 'composer', rows: 2, placeholder: '여기에 타이핑해서 메모 (Enter: 추가, Shift+Enter: 줄바꿈)' });
  composer.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); addNote(); }
  });
  const notesView = h('div', { class: 'panel-view' }, notesList,
    h('div', { class: 'composer-row' }, composer, h('button', { class: 'btn primary', onClick: addNote }, '추가')));

  // 전사
  const txList = h('ul', { class: 'transcript' });
  const interimLi = h('li', { class: 'interim', hidden: true });
  const liveToggle = h('label', { class: 'toggle' },
    h('input', { type: 'checkbox', checked: state.liveTx, disabled: !Transcriber.supported(), onChange: (e) => { state.liveTx = e.target.checked; if (rec.state === 'rec') state.liveTx ? tx.start() : tx.stop(); } }),
    ' 실시간 자막');
  const txView = h('div', { class: 'panel-view' },
    h('div', { class: 'tx-head' }, liveToggle, h('button', { class: 'btn ghost', onClick: copyForSummary }, '요약용 전체 복사')),
    !Transcriber.supported() && h('p', { class: 'hint' }, '이 브라우저는 실시간 자막을 지원하지 않아요. 녹음은 그대로 돼요.'),
    txList);

  const tabBtns = { notes: h('button', { class: 'tab', onClick: () => setTab('notes') }, '노트'), tx: h('button', { class: 'tab', onClick: () => setTab('tx') }, '전사') };
  const panel = h('aside', { class: 'panel' }, h('div', { class: 'tabs' }, tabBtns.notes, tabBtns.tx), notesView, txView);

  const fileInput = h('input', { type: 'file', accept: 'application/pdf,.pdf', hidden: true, onChange: (e) => importPdf(e.target.files[0]) });

  root.replaceChildren(
    h('div', { class: 'lec-page' },
      h('header', { class: 'lec-header' },
        h('button', { class: 'btn ghost', onClick: goBack }, '‹ 목록'),
        titleInput, recArea),
      h('div', { class: 'lec-main' },
        h('section', { class: 'slides' }, toolbar, stage, nav),
        panel),
      fileInput,
    ),
  );

  const ink = createInk(inkC, {
    getTool: () => ({ tool: state.tool, color: state.tool === 'hl' ? HIGHLIGHT : state.color, w: state.tool === 'hl' ? 20 : 2.5, finger: state.finger }),
    now,
    onChange: save,
    onSwipe: (d) => goPage(state.page + d),
    onPick: (st) => { if (audio) seek(st.t); else toast('녹음을 끝낸 뒤에 필기를 눌러 그때 소리를 들을 수 있어요'); },
  });

  // ---------- 툴바 ----------
  function renderToolbar() {
    toolbar.replaceChildren(
      ...TOOLS.map(([k, label]) => h('button', { class: `btn tool ${state.tool === k ? 'active' : ''}`, onClick: () => { state.tool = k; renderToolbar(); } }, label)),
      h('span', { class: 'sep' }),
      ...COLORS.map((c) => h('button', {
        class: `swatch ${state.color === c && state.tool === 'pen' ? 'active' : ''}`,
        style: `background:${c}`, 'aria-label': '색상',
        onClick: () => { state.color = c; state.tool = 'pen'; renderToolbar(); },
      })),
      h('span', { class: 'sep' }),
      h('button', { class: 'btn', onClick: () => ink.undo() }, '되돌리기'),
      h('label', { class: 'toggle' },
        h('input', { type: 'checkbox', checked: state.finger, onChange: (e) => { state.finger = e.target.checked; } }), ' 손가락 필기'),
      h('span', { class: 'grow' }),
      h('button', { class: 'btn', onClick: () => fileInput.click() }, lec.hasPdf ? 'PDF 바꾸기' : '슬라이드 PDF 불러오기'),
    );
  }

  // ---------- 페이지 ----------
  function updateNav() {
    pageLabel.textContent = `${state.page} / ${pageCount()}`;
    addPageBtn.hidden = !!state.pdf;
  }

  function goPage(n, { fromPlayback = false } = {}) {
    n = Math.min(Math.max(1, n), pageCount());
    if (n === state.page) return;
    state.page = n;
    lec.lastPage = n;
    if (rec.state !== 'idle') lec.events.push({ t: rec.elapsed(), page: n });
    // 재생 중에 직접 넘기면 "슬라이드 따라가기"를 끔
    if (!fromPlayback && audio && !audio.paused && state.follow) { state.follow = false; renderRecArea(); }
    save();
    renderPage();
    updateNav();
  }

  async function renderPage() {
    const token = ++renderToken;
    const maxW = stage.clientWidth - 16, maxH = stage.clientHeight - 16;
    if (maxW <= 0 || maxH <= 0) return;
    let page = null, vw = 1024, vh = 768;
    if (state.pdf) {
      page = await state.pdf.getPage(state.page);
      if (token !== renderToken) return;
      const v = page.getViewport({ scale: 1 });
      vw = v.width; vh = v.height;
    }
    const scale = Math.min(maxW / vw, maxH / vh);
    const cssW = Math.floor(vw * scale), cssH = Math.floor(vh * scale);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    for (const c of [pdfC, inkC]) {
      c.style.width = `${cssW}px`; c.style.height = `${cssH}px`;
      c.width = Math.floor(cssW * dpr); c.height = Math.floor(cssH * dpr);
    }
    const ctx = pdfC.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, pdfC.width, pdfC.height);
    lec.ink[state.page] ||= [];
    ink.setStrokes(lec.ink[state.page]);
    if (page) {
      try { renderTask?.cancel(); } catch { /* 무시 */ }
      renderTask = page.render({ canvasContext: ctx, viewport: page.getViewport({ scale: scale * dpr }) });
      try { await renderTask.promise; } catch (e) { if (e?.name !== 'RenderingCancelledException') console.error(e); }
    }
  }

  async function loadPdf() {
    const blob = await getFile(`${lec.id}:pdf`);
    if (!blob) { state.pdf = null; return; }
    try {
      const lib = await loadPdfjs();
      state.pdf = await lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise;
      state.page = Math.min(state.page, state.pdf.numPages);
    } catch (err) {
      console.error(err);
      toast('PDF를 열지 못했어요. 파일이 손상됐는지 확인해 주세요.');
    }
  }

  async function importPdf(file) {
    fileInput.value = '';
    if (!file) return;
    if (!/pdf$/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      toast('PDF만 열 수 있어요. PPT는 PowerPoint나 Keynote에서 PDF로 내보낸 뒤 불러와 주세요.', 4000);
      return;
    }
    await putFile(`${lec.id}:pdf`, file);
    lec.hasPdf = true;
    lec.pdfName = file.name;
    if (!lec.title || lec.title === '새 강의') { lec.title = file.name.replace(/\.pdf$/i, ''); titleInput.value = lec.title; }
    await putLecture(lec);
    state.page = 1;
    await loadPdf();
    renderToolbar(); updateNav(); renderPage();
  }

  // ---------- 녹음 ----------
  function renderRecArea() {
    if (rec.state === 'rec' || rec.state === 'paused') {
      recArea.replaceChildren(
        h('span', { class: `rec-dot ${rec.state === 'rec' ? 'on' : ''}` }), timerEl,
        rec.state === 'rec'
          ? h('button', { class: 'btn', onClick: () => { rec.pause(); tx.stop(); renderRecArea(); } }, '일시정지')
          : h('button', { class: 'btn', onClick: () => { rec.resume(); if (state.liveTx) tx.start(); renderRecArea(); } }, '계속'),
        h('button', { class: 'btn danger', onClick: stopRec }, '녹음 끝내기'),
      );
    } else if (audio) {
      recArea.replaceChildren(audio,
        h('button', { class: 'btn', onClick: exportAudio }, '녹음 파일 내보내기'),
        h('label', { class: 'toggle' },
          h('input', { type: 'checkbox', checked: state.follow, onChange: (e) => { state.follow = e.target.checked; } }), ' 슬라이드 따라가기'));
    } else {
      recArea.replaceChildren(h('button', { class: 'btn rec', onClick: startRec }, '● 녹음 시작'));
    }
  }

  async function startRec() {
    if (!window.MediaRecorder) { toast('이 브라우저는 녹음을 지원하지 않아요. Safari 최신 버전을 써 주세요.'); return; }
    try { await rec.start(); } catch (err) {
      console.error(err);
      toast('마이크를 쓸 수 없어요. 설정 → Safari → 마이크에서 허용해 주세요.', 4000);
      return;
    }
    lec.events = [{ t: 0, page: state.page }];
    lec.transcript = [];
    txList.replaceChildren(interimLi);
    if (state.liveTx) setTimeout(() => { if (rec.state === 'rec' && state.liveTx) tx.start(); }, 800);
    tick = setInterval(() => { timerEl.textContent = fmtTime(rec.elapsed()); }, 500);
    // 30초마다 녹음을 중간 저장 (앱이 꺼져도 대부분 남도록)
    partialTimer = setInterval(async () => {
      await putFile(`${lec.id}:audio`, rec.snapshot());
      lec.partialAudio = true;
      lec.duration = rec.elapsed();
      save();
    }, 30000);
    renderRecArea();
  }

  async function finishRecording() {
    clearInterval(tick); clearInterval(partialTimer);
    tx.stop();
    const blob = await rec.stop();
    await putFile(`${lec.id}:audio`, blob);
    lec.hasAudio = true;
    lec.partialAudio = false;
    lec.duration = rec.duration;
    await save.flush();
  }

  async function stopRec() {
    await finishRecording();
    await loadAudio();
    renderRecArea();
    toast('녹음을 저장했어요');
  }

  async function loadAudio() {
    const blob = await getFile(`${lec.id}:audio`);
    if (!blob) return;
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
    audio = h('audio', { controls: true, preload: 'metadata', src: audioUrl });
    audio.addEventListener('timeupdate', onPlayback);
  }

  // 원본 녹음을 다른 앱(클로바노트 등)으로 보내 더 정확하게 다시 전사할 수 있게
  async function exportAudio() {
    const blob = await getFile(`${lec.id}:audio`);
    if (!blob) return;
    const ext = /mp4|m4a|aac/.test(blob.type) ? 'm4a' : 'webm';
    const name = `${(lec.title || '강의').replace(/[\\/:*?"<>|]/g, '_')}.${ext}`;
    const file = new File([blob], name, { type: blob.type || 'audio/mp4' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); } catch { /* 취소 */ }
      return;
    }
    const a = h('a', { href: URL.createObjectURL(file), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  }

  function onPlayback() {
    const t = audio.currentTime;
    if (state.follow && lec.events.length) {
      let p = null;
      for (const ev of lec.events) { if (ev.t <= t) p = ev.page; else break; }
      if (p && p !== state.page) goPage(p, { fromPlayback: true });
    }
    let idx = -1;
    for (let i = 0; i < lec.transcript.length; i++) { if (lec.transcript[i].t <= t) idx = i; else break; }
    if (idx !== activeTxIdx) {
      txList.children[activeTxIdx]?.classList.remove('active');
      activeTxIdx = idx;
      const li = txList.children[idx];
      if (li) { li.classList.add('active'); if (state.tab === 'tx') li.scrollIntoView({ block: 'nearest' }); }
    }
  }

  function seek(t, page) {
    if (audio && t != null) { audio.currentTime = t; audio.play().catch(() => {}); }
    if (page) goPage(page, { fromPlayback: true });
  }

  // ---------- 노트 ----------
  function addNote() {
    const text = composer.value.trim();
    if (!text) return;
    lec.notes.push({ id: uid(), t: now(), page: state.page, text });
    composer.value = '';
    save();
    renderNotes();
    notesList.scrollTop = notesList.scrollHeight;
  }

  function renderNotes() {
    notesList.replaceChildren(...lec.notes.map((n) => {
      const body = h('div', { class: 'note-body', contenteditable: 'true' }, n.text);
      body.addEventListener('blur', () => {
        const text = body.innerText.trim();
        if (!text) { lec.notes = lec.notes.filter((x) => x.id !== n.id); renderNotes(); } else n.text = text;
        save();
      });
      return h('li', { class: 'note' },
        h('div', { class: 'chips' },
          n.t != null && h('button', { class: 'chip', onClick: () => seek(n.t, n.page) }, `▶ ${fmtTime(n.t)}`),
          h('button', { class: 'chip', onClick: () => goPage(n.page) }, `p.${n.page}`),
          h('span', { class: 'grow' }),
          h('button', { class: 'chip ghost', 'aria-label': '삭제', onClick: () => { lec.notes = lec.notes.filter((x) => x.id !== n.id); save(); renderNotes(); } }, '×')),
        body);
    }));
    if (!lec.notes.length) notesList.append(h('li', { class: 'empty' }, '슬라이드를 보면서 떠오르는 걸 타이핑하세요. 녹음 중이면 그 시각이 같이 저장돼요.'));
  }

  // ---------- 전사 ----------
  function txLine(line) {
    return h('li', { onClick: () => seek(line.t) }, h('span', { class: 'chip' }, fmtTime(line.t)), ' ', line.text);
  }
  function appendTranscriptLine(line) { txList.insertBefore(txLine(line), interimLi); autoScroll(); }
  function autoScroll() {
    if (rec.state === 'idle') return;
    const nearBottom = txList.scrollHeight - txList.scrollTop - txList.clientHeight < 120;
    if (nearBottom) txList.scrollTop = txList.scrollHeight;
  }
  function renderTranscript() {
    txList.replaceChildren(...lec.transcript.map(txLine), interimLi);
    if (!lec.transcript.length && rec.state === 'idle') {
      txList.prepend(h('li', { class: 'empty' }, '녹음을 시작하면 교수님 말씀이 여기에 자막으로 쌓여요.'));
    }
  }

  // 요약 API를 붙이기 전까지: 전사 + 노트를 복사해서 Claude 등에 붙여넣기
  async function copyForSummary() {
    const lines = [`아래는 "${lec.title}" 강의의 녹음 전사문과 내 노트야. 슬라이드별로 핵심 내용을 요약하고, 교수님이 강조한 부분과 시험에 나올 만한 내용을 따로 정리해 줘.`, ''];
    lines.push('## 전사문');
    let ei = 0, lastPage = null;
    for (const l of lec.transcript) {
      while (ei < lec.events.length && lec.events[ei].t <= l.t) { const p = lec.events[ei++].page; if (p !== lastPage) { lines.push(`--- 슬라이드 ${p} ---`); lastPage = p; } }
      lines.push(`[${fmtTime(l.t)}] ${l.text}`);
    }
    lines.push('', '## 내 노트');
    for (const n of lec.notes) lines.push(`[${n.t != null ? fmtTime(n.t) + ' · ' : ''}슬라이드 ${n.page}] ${n.text}`);
    const text = lines.join('\n');
    try { await navigator.clipboard.writeText(text); toast('복사했어요. Claude 앱에 붙여넣어 요약을 받아보세요.'); } catch {
      const ta = h('textarea', { class: 'copy-fallback' }, text);
      document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
      toast('복사했어요');
    }
  }

  function setTab(t) {
    state.tab = t;
    tabBtns.notes.classList.toggle('active', t === 'notes');
    tabBtns.tx.classList.toggle('active', t === 'tx');
    notesView.hidden = t !== 'notes';
    txView.hidden = t !== 'tx';
  }

  // ---------- 나가기 ----------
  function goBack() {
    if (rec.state !== 'idle' && !confirm('녹음을 끝내고 목록으로 갈까요? 지금까지 녹음은 저장돼요.')) return;
    location.hash = '#/';
  }

  const onVis = () => {
    if (document.visibilityState === 'hidden') save.flush();
    else rec.relock();
  };
  document.addEventListener('visibilitychange', onVis);

  const ro = new ResizeObserver(debounce(() => renderPage(), 120));
  ro.observe(stage);

  // ---------- 시작 ----------
  lec.ink ||= {}; lec.notes ||= []; lec.transcript ||= []; lec.events ||= [];
  if (lec.partialAudio) {
    // 지난번 녹음 도중 앱이 꺼졌던 경우: 중간 저장본을 살림
    lec.hasAudio = true; lec.partialAudio = false; save();
    toast('지난번에 끊긴 녹음을 중간 저장본으로 복구했어요', 4000);
  }
  if (lec.hasPdf) await loadPdf();
  if (lec.hasAudio) await loadAudio();
  renderToolbar(); renderRecArea(); renderNotes(); renderTranscript(); setTab('notes'); updateNav();
  requestAnimationFrame(() => renderPage());

  return async () => {
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    if (rec.state !== 'idle') await finishRecording();
    await save.flush();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    state.pdf?.destroy?.();
  };
}
