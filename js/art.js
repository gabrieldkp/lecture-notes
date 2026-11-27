// 앱 캐릭터: 파란 눈 검은 고양이 "까망이"와 하얀 복슬 테리어 "알렉스", 발바닥 아이콘
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
    <!-- 알렉스: 하얀 복슬 테리어, 갈색 접힌 귀와 눈썹, 귀 옆 회색 점 -->
    <path d="M60 18 q8 -6 14 0 q8 -4 12 4 q9 0 10 9 q8 4 5 13 q6 7 1 14 q4 9 -4 15 q1 10 -9 12 q-3 9 -13 7 q-6 7 -16 4 q-10 3 -16 -4 q-10 2 -13 -7 q-10 -2 -9 -12 q-8 -6 -4 -15 q-5 -7 1 -14 q-3 -9 5 -13 q1 -9 10 -9 q4 -8 12 -4 q6 -6 14 0 z" fill="#f6f3ee" stroke="#6aa1ff" stroke-width="3" stroke-linejoin="round"/>
    <path d="M44 22 q4 6 0 10 M54 18 q3 7 -1 11 M66 18 q-3 7 1 11 M76 22 q-4 6 0 10" fill="none" stroke="#d8d2c8" stroke-width="2" stroke-linecap="round"/>
    <g transform="translate(-8 -6) scale(.8) translate(4 4)">
    <path d="M26 22 q14 -10 30 2 q-8 4 -12 14 q-4 10 -12 14 q-10 -6 -12 -16 q-1 -9 6 -14 z" fill="#d9a066" stroke="#b97f45" stroke-width="2.5" stroke-linejoin="round"/>
    </g>
    <g transform="translate(32 -6) scale(.8) translate(-4 4)">
    <path d="M94 22 q-14 -10 -30 2 q8 4 12 14 q4 10 12 14 q10 -6 12 -16 q1 -9 -6 -14 z" fill="#d9a066" stroke="#b97f45" stroke-width="2.5" stroke-linejoin="round"/>
    </g>
    <ellipse cx="33" cy="40" rx="5" ry="4" fill="#9aa0a8" opacity=".8"/>
    <path d="M34 46 q8 -6 16 -2 q-6 4 -16 2 z" fill="#d9a066"/>
    <path d="M86 46 q-8 -6 -16 -2 q6 4 16 2 z" fill="#d9a066"/>
    <ellipse cx="44" cy="56" rx="5.5" ry="6" fill="#1a1410"/><ellipse cx="76" cy="56" rx="5.5" ry="6" fill="#1a1410"/>
    <circle cx="46" cy="54" r="1.8" fill="#fff"/><circle cx="78" cy="54" r="1.8" fill="#fff"/>
    <path d="M42 70 q18 -8 36 0 q2 14 -8 20 q-10 6 -20 0 q-10 -6 -8 -20 z" fill="#fbf9f5" stroke="#e2ddd4" stroke-width="1.5"/>
    <ellipse cx="60" cy="70" rx="8" ry="6" fill="#111"/>
    <ellipse cx="57.5" cy="68" rx="2.6" ry="1.6" fill="#fff" opacity=".7"/>
    <path d="M60 76 v4 M60 80 q-6 5 -10 0 M60 80 q6 5 10 0" fill="none" stroke="#3a3430" stroke-width="2.2" stroke-linecap="round"/>
    <path d="M56 83 q4 8 8 0 z" fill="#ff8fb1"/>
    <ellipse cx="34" cy="70" rx="5" ry="3" fill="#ff8fb1" opacity=".35"/><ellipse cx="86" cy="70" rx="5" ry="3" fill="#ff8fb1" opacity=".35"/>
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
