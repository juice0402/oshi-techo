// ご当地の見つけた記録（data/gotouchi-seen.json。非公開の oshi-techo-data に戻る）の部品。node: の部品を使わない（ページの作りとテストの両方で使う）
// 記録の形：{ v: 1, works: { "snoopy": { "kanagawa": { f: "2026-10-20", l: "2026-11-11" } }, "sanrio/kitty": { ... } } }
// f：その県の商品の first のいちばん早い日、l：その県の商品が載っていた最後の日（どちらも日本時間）。商品の番号・名前・値段・URL は残さない
import { jstDate } from './text.mjs';
import { AREAS, isGotouchi, regionOf, prefId } from './region.mjs';

// 都道府県の id（prefId の「p-」を取ったローマ字）
export const PREF_IDS = AREAS.flatMap((a) => a.prefs.map((p) => prefId(p).slice(2)));
const PREF_SET = new Set(PREF_IDS);
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const WORK = /^[a-z0-9-]+(\/[a-z0-9-]+)?$/;

// 前の記録から、作品・県の id・日付のほかを落とす（こわれた記録が来ても、正しいところだけ残す）
function clean(record) {
  const works = {};
  for (const [w, prefs] of Object.entries(record?.works ?? {})) {
    if (!WORK.test(w) || !prefs || typeof prefs !== 'object') continue;
    for (const [p, d] of Object.entries(prefs)) {
      if (!PREF_SET.has(p) || !d || !DAY.test(d.f)) continue;
      (works[w] ??= {})[p] = { f: d.f, l: DAY.test(d.l) && d.l >= d.f ? d.l : d.f };
    }
  }
  return works;
}

// いま載っている商品から記録に足す。f は早い日だけ書きかえ、l は新しい日だけ書きかえ、消さない
// subs：キャラだけのご当地（characters.json の gotouchiSub）[{ key: '作品/キャラ', c: 作品の slug, hit: (name) => bool }]
// 地名が商品名にないもの（regionOf が null）は記録しない。売り切れ（avail が 0）は数えない（build.mjs のご当地の一覧と同じ）
export function mergeGotouchiSeen(record, items, today, subs = []) {
  const works = clean(record);
  const add = (w, p, f) => {
    const d = ((works[w] ??= {})[p] ??= { f, l: today });
    if (f < d.f) d.f = f;
    if (today > d.l) d.l = today;
  };
  for (const it of items) {
    if (!it?.c || !it.name || it.avail === 0 || !isGotouchi(it.name)) continue;
    const r = regionOf(it.name);
    if (!r) continue;
    const p = prefId(r.pref).slice(2);
    const f = it.first ? jstDate(new Date(it.first)) : today;
    add(it.c, p, f);
    for (const s of subs) if (s.c === it.c && s.hit(it.name)) add(s.key, p, f);
  }
  const order = (o, keys) => Object.fromEntries(keys.filter((k) => o[k]).map((k) => [k, o[k]]));
  return { v: 1, works: Object.fromEntries(Object.keys(works).sort().map((w) => [w, order(works[w], PREF_IDS)])) };
}
