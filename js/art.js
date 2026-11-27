// 앱 캐릭터: 파란 눈 검은 고양이 "까망이"와 파란 귀 강아지 "콩이", 발바닥 아이콘
// (직접 그린 간단한 SVG)

const ART = {
  cat: `<svg viewBox="0 0 120 110" aria-hidden="true">
    <path d="M18 50 L26 6 L54 30 Z" fill="#1a1f2b" stroke="#6aa1ff" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M102 50 L94 6 L66 30 Z" fill="#1a1f2b" stroke="#6aa1ff" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M27 36 L30 18 L43 29 Z" fill="#3d7bff" opacity=".55"/>
    <path d="M93 36 L90 18 L77 29 Z" fill="#3d7bff" opacity=".55"/>
    <ellipse cx="60" cy="64" rx="46" ry="40" fill="#1a1f2b" stroke="#6aa1ff" stroke-width="3.5"/>
    <ellipse cx="42" cy="60" rx="8" ry="10" fill="#6aa1ff"/>
    <ellipse cx="78" cy="60" rx="8" ry="10" fill="#6aa1ff"/>
    <ellipse cx="42" cy="61" rx="3" ry="7" fill="#0b0d12"/>
    <ellipse cx="78" cy="61" rx="3" ry="7" fill="#0b0d12"/>
    <circle cx="45" cy="56" r="2.2" fill="#fff"/><circle cx="81" cy="56" r="2.2" fill="#fff"/>
    <path d="M55 74 h10 l-5 5 z" fill="#ff8fb1" stroke="#ff8fb1" stroke-width="2" stroke-linejoin="round"/>
    <path d="M60 79 q-5 7 -11 2 M60 79 q5 7 11 2" fill="none" stroke="#6aa1ff" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M22 70 l-14 -3 M22 76 l-14 3 M98 70 l14 -3 M98 76 l14 3" stroke="#6aa1ff" stroke-width="2" stroke-linecap="round" opacity=".7"/>
    <ellipse cx="32" cy="76" rx="6" ry="3.5" fill="#ff8fb1" opacity=".35"/><ellipse cx="88" cy="76" rx="6" ry="3.5" fill="#ff8fb1" opacity=".35"/>
  </svg>`,
  dog: `<svg viewBox="0 0 120 110" aria-hidden="true">
    <ellipse cx="22" cy="52" rx="15" ry="28" transform="rotate(18 22 52)" fill="#3d7bff"/>
    <ellipse cx="98" cy="52" rx="15" ry="28" transform="rotate(-18 98 52)" fill="#3d7bff"/>
    <circle cx="60" cy="60" r="42" fill="#eef2ff"/>
    <ellipse cx="78" cy="46" rx="12" ry="10" fill="#c9d8ff" opacity=".8"/>
    <circle cx="44" cy="56" r="6" fill="#0b0d12"/><circle cx="76" cy="56" r="6" fill="#0b0d12"/>
    <circle cx="46" cy="54" r="2" fill="#fff"/><circle cx="78" cy="54" r="2" fill="#fff"/>
    <ellipse cx="60" cy="72" rx="10" ry="7" fill="#0b0d12"/>
    <ellipse cx="57" cy="70" rx="3" ry="2" fill="#fff" opacity=".7"/>
    <path d="M60 79 v5 M60 84 q-7 7 -13 1 M60 84 q7 7 13 1" fill="none" stroke="#0b0d12" stroke-width="2.5" stroke-linecap="round"/>
    <path d="M55 88 q5 10 10 0 z" fill="#ff8fb1"/>
    <ellipse cx="34" cy="74" rx="6" ry="3.5" fill="#ff8fb1" opacity=".45"/><ellipse cx="86" cy="74" rx="6" ry="3.5" fill="#ff8fb1" opacity=".45"/>
  </svg>`,
  paw: `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
    <ellipse cx="12" cy="16.2" rx="5.2" ry="4.4"/>
    <ellipse cx="5.2" cy="10.6" rx="2.2" ry="2.7"/><ellipse cx="9.4" cy="6.6" rx="2.2" ry="2.8"/>
    <ellipse cx="14.6" cy="6.6" rx="2.2" ry="2.8"/><ellipse cx="18.8" cy="10.6" rx="2.2" ry="2.7"/>
  </svg>`,
};

export function art(name, cls = '') {
  const el = document.createElement('span');
  el.className = `art art-${name} ${cls}`;
  el.innerHTML = ART[name];
  return el;
}
