// 앱 시작점: 강의 목록 화면과 화면 전환
import { $, h, fmtDate, fmtTime, uid, toast } from './util.js';
import { listLectures, putLecture, deleteLecture, requestPersist } from './db.js';
import { openLecture } from './lecture.js';

const app = $('#app');
let cleanup = null;

function newLecture(title) {
  return {
    id: uid(),
    title: title || '새 강의',
    createdAt: Date.now(),
    hasPdf: false,
    pdfName: null,
    blankPages: 1,
    lastPage: 1,
    ink: {},        // { 페이지번호: [획...] }
    notes: [],      // 타이핑 노트 [{id, t, page, text}]
    transcript: [], // 전사 [{t, text}]
    events: [],     // 슬라이드 넘김 [{t, page}]
    hasAudio: false,
    duration: 0,
  };
}

async function renderList() {
  const lectures = (await listLectures()).sort((a, b) => b.createdAt - a.createdAt);
  const input = h('input', { class: 'title-input', placeholder: '강의 제목 (예: 경영학원론 3주차)', enterkeyhint: 'done' });
  const create = async () => {
    const lec = newLecture(input.value.trim());
    await putLecture(lec);
    location.hash = `#/l/${lec.id}`;
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); });

  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

  app.replaceChildren(
    h('div', { class: 'list-page' },
      h('header', { class: 'list-header' }, h('h1', {}, '강의노트')),
      h('div', { class: 'new-row' }, input, h('button', { class: 'btn primary', onClick: create }, '+ 새 강의')),
      !standalone && h('p', { class: 'hint' },
        '팁: Safari 공유 버튼 → "홈 화면에 추가"로 설치하면 앱처럼 열리고, 저장한 노트가 지워질 위험도 줄어요.'),
      lectures.length === 0
        ? h('p', { class: 'empty' }, '아직 강의가 없어요. 위에서 새 강의를 만들어 보세요.')
        : h('ul', { class: 'lecture-list' }, lectures.map((l) =>
          h('li', { class: 'lecture-card', onClick: () => { location.hash = `#/l/${l.id}`; } },
            h('div', { class: 'card-main' },
              h('div', { class: 'card-title' }, l.title),
              h('div', { class: 'card-meta' },
                fmtDate(l.createdAt),
                l.hasPdf && h('span', { class: 'badge' }, 'PDF'),
                l.hasAudio && h('span', { class: 'badge' }, `녹음 ${fmtTime(l.duration)}`),
                l.notes.length > 0 && h('span', { class: 'badge' }, `노트 ${l.notes.length}`)),
            ),
            h('button', {
              class: 'btn ghost danger',
              onClick: async (e) => {
                e.stopPropagation();
                if (!confirm(`"${l.title}" 강의를 삭제할까요? 녹음과 필기도 함께 지워져요.`)) return;
                await deleteLecture(l.id);
                renderList();
              },
            }, '삭제'),
          ))),
    ),
  );
}

async function route() {
  if (cleanup) { await cleanup(); cleanup = null; }
  const m = location.hash.match(/^#\/l\/(.+)$/);
  try {
    if (m) cleanup = await openLecture(app, m[1]);
    else await renderList();
  } catch (err) {
    console.error(err);
    toast('문제가 생겼어요: ' + (err?.message || err));
    if (m) location.hash = '#/';
  }
}

window.addEventListener('hashchange', route);
requestPersist();
route();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
