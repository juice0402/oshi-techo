// 季節の特集・誕生日・ご当地のデコ（手帳にはるシールのような絵と、テープの色）。
// 絵はすべてこのサイトで描いた形（キャラクターは描かない）。ページ作り（build.mjs）だけで使う。

// a：見出しのリボン・背景のしましま・タブ、b：背景の地、b2：タブ（濃いめ）、ink：開いているタブの帯。はるシール3枚
export const PALETTES = {
  halloween: { a: '#ffd2a6', b: '#dccdff', b2: '#b9a3ea', ink: '#e8893a', stickers: ['pumpkin', 'ghost', 'bat'] },
  christmas: { a: '#ffb8c2', b: '#c6ead3', b2: '#8fd3a8', ink: '#e0607a', stickers: ['tree', 'gift', 'star'] },
  fukubukuro: { a: '#ffb8b8', b: '#fff1c2', b2: '#ffd76a', ink: '#e05a5a', stickers: ['bag', 'ume', 'koban'] },
  oshougatsu: { a: '#ffc9c9', b: '#fff1c2', b2: '#ffd76a', ink: '#e05a5a', stickers: ['kagami', 'ume', 'fan'] },
  valentine: { a: '#ffc4d9', b: '#ffe9f1', b2: '#ff9fc0', ink: '#e0607a', stickers: ['heart', 'choco', 'bow'] },
  whiteday: { a: '#cfe6ff', b: '#eef6ff', b2: '#9cc9f0', ink: '#5b9bd8', stickers: ['candy2', 'heart2', 'bow2'] },
  birthday: { a: '#fff1a8', b: '#ffc4d9', b2: '#ffd76a', ink: '#e0607a', stickers: ['cake', 'balloon', 'star'] },
  techo: { a: '#ddd1fb', b: '#fff3c7', b2: '#b9a3ea', ink: '#7d62c4', stickers: ['planner', 'calpage', 'pen'] },
  gotouchi: { a: '#c4e8cf', b: '#d9ecff', b2: '#9cc9f0', ink: '#4f9a6a', stickers: ['fuji', 'pin', 'suitcase'] },
};

// きせかえの背景：b を白に半分まぜた地に、a を少しすかしたしましま
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const mixWhite = (hex, t) => `#${rgb(hex).map((v) => Math.round(v + (255 - v) * t).toString(16).padStart(2, '0')).join('')}`;
const alpha = (hex, a) => `rgba(${rgb(hex).join(',')},${a})`;

// 64×64 の絵。白いふちは、同じ形を白く太くなぞって作る
const S = {
  star: '<path d="M32 6l7.6 16.5 18 2-13.4 12.3 3.8 17.8L32 45.6l-16 9 3.8-17.8L6.4 24.5l18-2z" fill="#ffd76a" stroke="#efb63c" stroke-width="1.5" stroke-linejoin="round"/><path d="M24 25l5-1" stroke="#fff6cf" stroke-width="3" stroke-linecap="round"/>',
  tree: '<path d="M32 5L47 24H40L53 43H11L24 24H17z" fill="#86cf9e" stroke="#5fb07c" stroke-width="1.5" stroke-linejoin="round"/><rect x="28" y="43" width="8" height="11" rx="2" fill="#c9976b"/><circle cx="27" cy="30" r="2.6" fill="#ff8fab"/><circle cx="38" cy="35" r="2.6" fill="#ffd76a"/><circle cx="23" cy="39" r="2.6" fill="#9cc9f0"/><circle cx="34" cy="20" r="2.4" fill="#ff8fab"/><circle cx="43" cy="40" r="2.4" fill="#ff8fab"/><path d="M32 1.5l1.6 3.4 3.7.4-2.8 2.5.8 3.7-3.3-1.9-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z" fill="#ffd76a"/>',
  gift: '<rect x="12" y="27" width="40" height="27" rx="3" fill="#ffb3c6"/><rect x="9" y="19" width="46" height="10" rx="3" fill="#ff9cb6"/><rect x="28" y="19" width="8" height="35" fill="#b23f78"/><ellipse cx="24" cy="15" rx="8" ry="5" transform="rotate(-20 24 15)" fill="none" stroke="#b23f78" stroke-width="4"/><ellipse cx="40" cy="15" rx="8" ry="5" transform="rotate(20 40 15)" fill="none" stroke="#b23f78" stroke-width="4"/><circle cx="32" cy="18" r="3.5" fill="#b23f78"/>',
  pumpkin: '<rect x="29" y="11" width="6" height="10" rx="2" fill="#8fbf6a"/><ellipse cx="22" cy="38" rx="13" ry="16" fill="#ffad62"/><ellipse cx="42" cy="38" rx="13" ry="16" fill="#ffad62"/><ellipse cx="32" cy="38" rx="13" ry="17.5" fill="#ffbb78" stroke="#f0974a" stroke-width="1.5"/><path d="M22 33l5-5 2 6zM42 33l-5-5-2 6z" fill="#58405e"/><path d="M23 43q9 8 18 0" fill="none" stroke="#58405e" stroke-width="3" stroke-linecap="round"/>',
  ghost: '<path d="M14 55V29a18 18 0 0 1 36 0v26l-6-5-6 5-6-5-6 5-6-5z" fill="#ffffff" stroke="#cbb8f5" stroke-width="2" stroke-linejoin="round"/><ellipse cx="26" cy="30" rx="3" ry="4" fill="#58405e"/><ellipse cx="38" cy="30" rx="3" ry="4" fill="#58405e"/><ellipse cx="22" cy="38" rx="3.5" ry="2" fill="#ffc4d9"/><ellipse cx="42" cy="38" rx="3.5" ry="2" fill="#ffc4d9"/>',
  bat: '<path d="M32 26c-3-6-9-8-13-5-4-6-11-6-15 0 5 1 7 5 6 10 4-3 9-2 11 2 3-4 8-5 11-2 3-3 8-2 11 2 2-4 7-5 11-2-1-5 1-9 6-10-4-6-11-6-15 0-4-3-10-1-13 5z" fill="#a690d6" stroke="#8a72c0" stroke-width="1.5" stroke-linejoin="round"/><circle cx="29" cy="30" r="1.8" fill="#fff"/><circle cx="35" cy="30" r="1.8" fill="#fff"/>',
  bag: '<path d="M14 33q0 22 18 22t18-22q0-9-11-12H25q-11 3-11 12z" fill="#ff8f8f" stroke="#e86f6f" stroke-width="1.5"/><path d="M22 13q4 5 10 5t10-5l-3 8H25z" fill="#ffb3b3"/><rect x="22" y="18" width="20" height="5" rx="2.5" fill="#ffd76a"/><path d="M32 30l9 9-9 9-9-9z" fill="#fff" stroke="#efb63c" stroke-width="2"/>',
  ume: '<g fill="#ffb8c9" stroke="#f59ab2" stroke-width="1.2"><circle cx="32" cy="15" r="10"/><circle cx="48.2" cy="26.8" r="10"/><circle cx="42" cy="45.8" r="10"/><circle cx="22" cy="45.8" r="10"/><circle cx="15.8" cy="26.8" r="10"/></g><circle cx="32" cy="32" r="7" fill="#ffd76a"/>',
  koban: '<ellipse cx="32" cy="32" rx="16" ry="23" fill="#ffd76a" stroke="#e5b23a" stroke-width="2"/><path d="M22 22h20M22 42h20" stroke="#e5b23a" stroke-width="2.5" stroke-linecap="round"/><rect x="27" y="27" width="10" height="10" rx="2" fill="none" stroke="#e5b23a" stroke-width="2"/>',
  kagami: '<path d="M12 50h40l-4 8H16z" fill="#ffcf8a"/><ellipse cx="32" cy="43" rx="20" ry="9" fill="#fff" stroke="#e7d8c6" stroke-width="2"/><ellipse cx="32" cy="32" rx="14" ry="8" fill="#fff" stroke="#e7d8c6" stroke-width="2"/><circle cx="32" cy="20" r="7" fill="#ffa94d"/><path d="M33 13q5-4 9-1-4 3-9 1z" fill="#7fbf6a"/>',
  fan: '<path d="M32 54L8 24a34 34 0 0 1 48 0z" fill="#ff8f8f" stroke="#efb63c" stroke-width="2.5" stroke-linejoin="round"/><path d="M32 54L20 15M32 54V11M32 54L44 15" stroke="#ffd76a" stroke-width="2"/><circle cx="32" cy="27" r="6" fill="#fff"/>',
  heart: '<path d="M32 54C14 42 8 32 8 23a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 9-6 19-24 31z" fill="#ff8fab" stroke="#ee6f90" stroke-width="1.5"/><path d="M17 22q2-5 7-5" stroke="#ffd0dc" stroke-width="3" stroke-linecap="round" fill="none"/>',
  heart2: '<path d="M32 54C14 42 8 32 8 23a12 12 0 0 1 24-4 12 12 0 0 1 24 4c0 9-6 19-24 31z" fill="#9cc9f0" stroke="#78aee0" stroke-width="1.5"/><path d="M17 22q2-5 7-5" stroke="#e3f1fd" stroke-width="3" stroke-linecap="round" fill="none"/>',
  choco: '<rect x="12" y="14" width="40" height="38" rx="5" fill="#a9745b"/><path d="M12 27h40M12 40h40M25 14v38M38 14v38" stroke="#8a5a45" stroke-width="2"/><path d="M44 50c-6-4-8-7-8-10a4 4 0 0 1 8-1 4 4 0 0 1 8 1c0 3-2 6-8 10z" fill="#ff8fab"/>',
  bow: '<path d="M32 30L12 18v26zM32 30l20-12v26z" fill="#ff9fc0" stroke="#ef7fa6" stroke-width="1.5" stroke-linejoin="round"/><path d="M29 33l-7 20 5-2 3 4 2-22zM35 33l7 20-5-2-3 4-2-22z" fill="#ff9fc0"/><circle cx="32" cy="31" r="5" fill="#ef7fa6"/>',
  bow2: '<path d="M32 30L12 18v26zM32 30l20-12v26z" fill="#a8d1f5" stroke="#7fb3e3" stroke-width="1.5" stroke-linejoin="round"/><path d="M29 33l-7 20 5-2 3 4 2-22zM35 33l7 20-5-2-3 4-2-22z" fill="#a8d1f5"/><circle cx="32" cy="31" r="5" fill="#7fb3e3"/>',
  candy2: '<path d="M18 32L6 22v20zM46 32l12-10v20z" fill="#ffd76a"/><circle cx="32" cy="32" r="14" fill="#9cc9f0" stroke="#78aee0" stroke-width="1.5"/><path d="M24 26q8-6 16 2M23 35q9-5 18 3" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/>',
  cake: '<rect x="12" y="34" width="40" height="20" rx="4" fill="#fff" stroke="#f2c7d6" stroke-width="2"/><path d="M12 38q5 5 10 0t10 0 10 0 10 0v-4H12z" fill="#ff9fc0"/><rect x="29" y="18" width="6" height="16" rx="2" fill="#9cc9f0"/><path d="M32 8q5 6 0 9-5-3 0-9z" fill="#ffb347"/><circle cx="20" cy="46" r="2.2" fill="#ff8fab"/><circle cx="32" cy="47" r="2.2" fill="#ffd76a"/><circle cx="44" cy="46" r="2.2" fill="#ff8fab"/>',
  planner: '<rect x="14" y="8" width="38" height="48" rx="5" fill="#b9a3ea" stroke="#9a82d6" stroke-width="1.5"/><rect x="20" y="14" width="26" height="36" rx="3" fill="#fff"/><path d="M24 22h18M24 29h18M24 36h12" stroke="#ddd1fb" stroke-width="3" stroke-linecap="round"/><g fill="#fff" stroke="#9a82d6" stroke-width="1.5"><circle cx="14" cy="18" r="3"/><circle cx="14" cy="32" r="3"/><circle cx="14" cy="46" r="3"/></g><path d="M44 8v14l3-3 3 3V8z" fill="#ff8fab"/>',
  calpage: '<rect x="10" y="12" width="44" height="44" rx="5" fill="#fff" stroke="#e3d8f7" stroke-width="2"/><path d="M10 17a5 5 0 0 1 5-5h34a5 5 0 0 1 5 5v9H10z" fill="#ff9fc0"/><rect x="20" y="6" width="5" height="12" rx="2.5" fill="#9a82d6"/><rect x="39" y="6" width="5" height="12" rx="2.5" fill="#9a82d6"/><g fill="#ddd1fb"><rect x="16" y="32" width="7" height="6" rx="1.5"/><rect x="28.5" y="32" width="7" height="6" rx="1.5"/><rect x="41" y="32" width="7" height="6" rx="1.5"/><rect x="16" y="43" width="7" height="6" rx="1.5"/><rect x="41" y="43" width="7" height="6" rx="1.5"/></g><rect x="28.5" y="43" width="7" height="6" rx="1.5" fill="#ffd76a"/>',
  pen: '<path d="M44 8l12 12-28 28-15 4 4-15z" fill="#ffd2a6" stroke="#f0ae74" stroke-width="1.5" stroke-linejoin="round"/><path d="M44 8l12 12-5 5-12-12z" fill="#ff8fab"/><path d="M17 37l10 10-14 5z" fill="#fff3e0"/><path d="M13 52l2-6 4 4z" fill="#58405e"/>',
  fuji: '<path d="M4 54L24 18q8-6 16 0l20 36z" fill="#9cc9f0" stroke="#78aee0" stroke-width="1.5" stroke-linejoin="round"/><path d="M24 18q8-6 16 0l6 11-5-3-4 4-5-4-5 4-4-4-5 3z" fill="#fff" stroke="#d6e8f8" stroke-width="1"/><circle cx="51" cy="13" r="6" fill="#ffd76a"/>',
  pin: '<path d="M32 58S14 37 14 25a18 18 0 0 1 36 0c0 12-18 33-18 33z" fill="#ff8fab" stroke="#ee6f90" stroke-width="1.5"/><circle cx="32" cy="25" r="7" fill="#fff"/>',
  suitcase: '<rect x="10" y="20" width="44" height="32" rx="6" fill="#ffd2a6" stroke="#f0ae74" stroke-width="1.5"/><path d="M24 20v-6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v6" fill="none" stroke="#c9976b" stroke-width="3.5"/><path d="M22 20v32M42 20v32" stroke="#c9976b" stroke-width="3"/><circle cx="17" cy="30" r="3" fill="#9cc9f0"/><path d="M44 36l5 2-5 2z" fill="#ff8fab"/>',
  balloon: '<path d="M32 44q2 6-3 11" stroke="#b48ab8" stroke-width="2" fill="none"/><ellipse cx="32" cy="24" rx="15" ry="18" fill="#ffa3bd" stroke="#ef7fa6" stroke-width="1.5"/><path d="M29 42h6l-3 4z" fill="#ef7fa6"/><path d="M24 16q3-5 8-5" stroke="#ffd6e2" stroke-width="3" stroke-linecap="round" fill="none"/>',
};

export const STICKER_NAMES = Object.keys(S);

export function stickerSvg(name) {
  const body = S[name];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-6 -6 76 76"><style>.o *{fill:#fff!important;stroke:#fff!important;stroke-width:9px!important;stroke-linejoin:round}</style><g class="o">${body}</g>${body}</svg>`;
}

const url = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

// ガーランド（旗が並んだ飾り）。色は季節のテープの色
function garlandSvg(p) {
  const colors = [p.a, p.b, p.ink];
  const flags = Array.from({ length: 6 }, (_, i) => {
    const x = i * 40;
    const y = 6 + Math.round(6 * Math.sin((i + 0.5) * (Math.PI / 6)));
    return `<path d="M${x + 4} ${y}h32l-16 22z" fill="${colors[i % 3]}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="36" viewBox="0 0 240 36"><path d="M0 6Q120 18 240 6" fill="none" stroke="#c9b6e8" stroke-width="2"/>${flags}</svg>`;
}

// デコの形：stickers（シールをはる）・garland（ガーランドを下げる）・kisekae（季節の色にきせかえ）。組み合わせてよい
export const DECO_STYLES = ['stickers', 'garland', 'kisekae'];

// 使う季節（slug）のぶんだけ CSS を作る。.dk はページ全体のデコ、.dks は一部分（トップの特集の入口など）
export function decoCss(slugs, styles = ['stickers']) {
  if (!slugs.length) return '';
  const on = new Set(styles);
  const common = [
    '.stk{display:inline-block;width:52px;height:52px;background:center/contain no-repeat;filter:drop-shadow(0 2px 2px rgba(88,64,94,.25));pointer-events:none;flex:none}',
    // 見出しのリボンは無地に白いステッチ（反対の色どうしのしましまはチカチカするため。しょーくんが案2を選んだ）
    '.dk h1.tape,.dk h2,.dks h2{background:linear-gradient(90deg,#fff 55%,transparent 0) 0 4px/9px 1.5px repeat-x,linear-gradient(90deg,#fff 55%,transparent 0) 0 calc(100% - 4px)/9px 1.5px repeat-x,var(--da)}',
    '.h1w{display:flex;align-items:center;gap:6px}.h1w .stk{transform:rotate(-8deg)}',
    '.dks .hw{display:flex;align-items:center;gap:4px}.dks .hw .stk{width:40px;height:40px;transform:rotate(10deg)}',
  ];
  common.push('.dk .sheet{position:relative}');
  // 季節の色の上でも、いちばん下の文字が読めるように
  common.push('.dk .ft{background:rgba(255,255,255,.82);border-radius:18px;margin-bottom:12px}');
  if (on.has('stickers')) {
    common.push(
      '.dk .sheet{padding-bottom:48px}',
      '.dk .stk-1{position:absolute;top:-20px;right:8px;width:64px;height:64px;transform:rotate(12deg)}',
      '.dk .stk-3{position:absolute;bottom:-16px;left:6px;width:56px;height:56px;transform:rotate(-10deg)}',
    );
  } else {
    common.push('.dk .stk-1,.dk .stk-3{display:none}');
  }
  if (on.has('garland')) {
    common.push('.dk .sheet{padding-top:44px}', '.dk .sheet::before{content:"";position:absolute;left:0;right:0;top:0;height:36px;background:var(--dg) repeat-x 0 0/240px 36px}');
  }
  if (on.has('kisekae')) {
    common.push(
      'body.dk{background-color:var(--dbg);background-image:radial-gradient(circle,#fff 0 2.5px,transparent 3px),radial-gradient(circle,#fff 0 1.5px,transparent 2px),repeating-linear-gradient(90deg,var(--dst) 0 14px,transparent 14px 28px);background-size:56px 56px,34px 34px,auto;background-position:0 0,17px 23px,0 0}',
      // タブは背景より濃いめの季節の色。開いているタブだけ白（背景のしましまと見分けやすく。しょーくんが案2を選んだ）
      '.dk .tabs a{background:var(--da);box-shadow:inset 0 -2px 0 rgba(88,64,94,.12)}.dk .tabs a:nth-child(2n){background:var(--db2)}.dk .tabs a[aria-current=page]{background:#fff;box-shadow:inset 0 4px 0 var(--dc)}',
    );
  }
  const per = slugs.map((slug) => {
    const p = PALETTES[slug];
    if (!p) return '';
    const [s1, s2, s3] = p.stickers.map((n) => url(stickerSvg(n)));
    return (
      `.s-${slug}{--da:${p.a};--db:${p.b};--db2:${p.b2};--dc:${p.ink};--dbg:${mixWhite(p.b, 0.55)};--dst:${alpha(p.a, 0.55)}${on.has('garland') ? `;--dg:${url(garlandSvg(p))}` : ''}}` +
      `.s-${slug} .stk-1{background-image:${s1}}.s-${slug} .stk-2{background-image:${s2}}.s-${slug} .stk-3{background-image:${s3}}`
    );
  });
  return [...common, ...per].join('');
}
