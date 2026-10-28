import { normalize } from './text.mjs';

const reCache = new Map();
const reOf = (src) => {
  if (!reCache.has(src)) reCache.set(src, new RegExp(src));
  return reCache.get(src);
};

// 商品を載せるかどうかを決める。載せないときは理由を返す。
export function judge(item, char, settings) {
  const name = normalize(item.name);

  if (!item.code || !item.url || !item.img) return { keep: false, reason: 'リンクか画像がない' };
  if (!(item.price > 0)) return { keep: false, reason: '価格がない' };

  const matched = char.match.some((w) => name.includes(normalize(w)));
  if (!matched) return { keep: false, reason: '商品名にキャラ名がない' };

  for (const w of settings.excludeAll) {
    if (name.includes(normalize(w))) return { keep: false, reason: `除外語「${w}」` };
  }
  for (const w of char.exclude) {
    if (name.includes(normalize(w))) return { keep: false, reason: `除外語「${w}」` };
  }
  // 言葉だけでは分けにくいもの（ゲームソフトの「- Switch」、楽天ブックスの「[ 著者 ]」、くじの「A賞」など）は形で外す
  for (const src of char.excludeRe ?? []) {
    if (reOf(src).test(name)) return { keep: false, reason: `除外の形「${src}」` };
  }
  // 「ちいかわ風」「ポケモン風」のような、似せた商品
  for (const w of char.match) {
    if (name.includes(`${normalize(w)}風`)) return { keep: false, reason: `「${w}風」` };
  }
  return { keep: true, reason: '' };
}
