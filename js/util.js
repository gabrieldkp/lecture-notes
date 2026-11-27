// 화면에 보이는 앱 버전 (아이패드가 최신 버전을 쓰는지 확인용)
export const APP_VERSION = '0.11';

// 작은 DOM/시간 도우미 함수 모음

export const $ = (sel, root = document) => root.querySelector(sel);

// h('div', {class: 'x', onClick: fn}, '텍스트', 자식요소...)
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function fmtTime(sec) {
  if (sec == null || Number.isNaN(sec)) return '--:--';
  const s = Math.max(0, Math.floor(sec));
  const hh = Math.floor(s / 3600), mm = Math.floor((s % 3600) / 60), ss = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return hh ? `${hh}:${p(mm)}:${p(ss)}` : `${p(mm)}:${p(ss)}`;
}

export function fmtDate(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export function debounce(fn, ms) {
  let t;
  const wrapped = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  wrapped.flush = (...a) => { clearTimeout(t); return fn(...a); };
  return wrapped;
}

const PAW = '<svg viewBox="0 0 24 24" fill="currentColor"><ellipse cx="12" cy="16.2" rx="5.2" ry="4.4"/><ellipse cx="5.2" cy="10.6" rx="2.2" ry="2.7"/><ellipse cx="9.4" cy="6.6" rx="2.2" ry="2.8"/><ellipse cx="14.6" cy="6.6" rx="2.2" ry="2.8"/><ellipse cx="18.8" cy="10.6" rx="2.2" ry="2.7"/></svg>';
export function toast(msg, ms = 2500) {
  const paw = h('span', { class: 'art art-paw' });
  paw.innerHTML = PAW;
  const el = h('div', { class: 'toast' }, paw, msg);
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
}
