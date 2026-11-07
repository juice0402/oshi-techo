// 入荷ビンゴ（推しキャラのページのカード）の部品。node: の部品を使わない（ページの作りとテストの両方で使う）
// 記録の形：{ v: 1, months: { "2026-11": { "chiikawa/hachiware": { nui: "2026-11-03", ... } } } }。商品名・値段・URL は残さない
import { normalize, jstDate } from './text.mjs';

// 3×3 のマス（左上から）。まん中（4番目のあと）は「来た」。shiori は推し×種類のしおりの近い種類
export const KINDS = [
  { k: 'nui', name: 'ぬいぐるみ', words: ['ぬいぐるみ', 'マスコット'], shiori: 'nuigurumi' },
  { k: 'acsta', name: 'アクスタ', words: ['アクリルスタンド', 'アクスタ'], shiori: 'keyholder' },
  { k: 'badge', name: '缶バッジ', words: ['缶バッジ', '缶バッチ'], shiori: 'keyholder' },
  { k: 'key', name: 'キーホルダー', words: ['キーホルダー', 'キーチェーン', 'チャーム'], shiori: 'keyholder' },
  { k: 'pouch', name: 'ポーチ', words: ['ポーチ', '巾着'], shiori: 'bag' },
  { k: 'mug', name: 'マグ', words: ['マグカップ', 'タンブラー', 'コップ', 'グラス', 'マグ'], shiori: 'shokki', not: ['マグネット', 'サングラス'] },
  { k: 'towel', name: 'タオル', words: ['タオル', 'ハンカチ'], shiori: 'nichiyouhin' },
  { k: 'sticker', name: 'シール', words: ['シール', 'ステッカー'], shiori: 'bunbougu' },
].map((x) => ({ ...x, words: x.words.map(normalize), not: (x.not ?? []).map(normalize) }));

// 縦・横・ななめの8本（マスの番号 0〜8。4 がまん中）
export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
// マスの番号 → 種類（まん中は null）
export const CELLS = [...KINDS.slice(0, 4).map((x) => x.k), null, ...KINDS.slice(4).map((x) => x.k)];

// 商品名に当たる種類（1つの商品が2つの種類に当たってもよい）
export function kindsOf(name) {
  const n = normalize(name);
  return KINDS.filter((x) => {
    const m = x.not.reduce((s, w) => s.replaceAll(w, ''), n);
    return x.words.some((w) => m.includes(w));
  }).map((x) => x.k);
}

// 日本時間の「2026-11」
export const jstMonth = (iso) => jstDate(new Date(iso)).slice(0, 7);

// 前の月（"2026-11" → "2026-10"）
const addMonths = (ym, d) => {
  const [y, m] = ym.split('-').map(Number);
  const t = y * 12 + (m - 1) + d;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`;
};
export const KEEP_MONTHS = 13;

// いま載っている商品から記録に足す。すでにある日より早いときだけ書きかえ、消さない。13か月より古い月は消す
// oshis：[{ key: '作品/推し', c: 作品の slug, hit: (name) => bool }]
export function mergeBingo(record, items, oshis, nowIso) {
  const out = { v: 1, months: structuredClone(record?.months ?? {}) };
  for (const it of items) {
    if (!it.first || !it.name) continue;
    const ks = kindsOf(it.name);
    if (!ks.length) continue;
    const day = jstDate(new Date(it.first));
    const month = day.slice(0, 7);
    for (const o of oshis) {
      if (o.c !== it.c || !o.hit(it.name)) continue;
      const card = ((out.months[month] ??= {})[o.key] ??= {});
      for (const k of ks) if (!card[k] || day < card[k]) card[k] = day;
    }
  }
  const oldest = addMonths(jstMonth(nowIso), -(KEEP_MONTHS - 1));
  const months = {};
  for (const m of Object.keys(out.months).sort()) {
    if (m < oldest) continue;
    months[m] = Object.fromEntries(
      Object.entries(out.months[m])
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, card]) => [key, Object.fromEntries(CELLS.filter((k) => k && card[k]).map((k) => [k, card[k]]))]),
    );
  }
  out.months = months;
  return out;
}

// ---- 先月のまとめ（/bingo/<年>-<月>/。docs/shikumi.md の「入荷ビンゴ」） ----
// 1枚のカードのそろった列の数と、いちばん早く列がそろった日（列の3マスのうち、いちばんおそい印の日。まん中はいつも埋まり）
export function cardLines(card) {
  let n = 0;
  let first = '';
  for (const l of LINES) {
    const ks = l.map((i) => CELLS[i]).filter(Boolean);
    if (!ks.every((k) => card[k])) continue;
    n++;
    const d = ks.map((k) => card[k]).sort().at(-1);
    if (!first || d < first) first = d;
  }
  return { n, first };
}

// 終わった月の記録を、まとめに使う数だけにする：推しごとに 印のマスの数 n・そろった列 l・ビンゴの日 b（そろったときだけ）、種類ごとの推しの人数
export function summarizeMonth(cards) {
  const oshi = {};
  const kinds = {};
  for (const key of Object.keys(cards ?? {}).sort()) {
    const card = cards[key];
    const ks = CELLS.filter((k) => k && card[k]);
    if (!ks.length) continue;
    const { n, first } = cardLines(card);
    oshi[key] = first ? { n: ks.length, l: n, b: first } : { n: ks.length, l: n };
    for (const k of ks) kinds[k] = (kinds[k] ?? 0) + 1;
  }
  return { oshi, kinds: Object.fromEntries(CELLS.filter((k) => k && kinds[k]).map((k) => [k, kinds[k]])) };
}

// まとめの記録（data/bingo-summary.json）：{ v: 1, months: { "2026-10": { oshi: { "作品/推し": { n, l, b } }, kinds: { nui: 3 } } } }
// 記録にある終わった月は作り直し、記録から消えた古い月（13か月より前）はそのまま残す。今の月は入れない
export function mergeSummary(summary, record, nowIso) {
  const now = jstMonth(nowIso);
  const okMonth = (m, s) => /^\d{4}-\d{2}$/.test(m) && m < now && s && typeof s.oshi === 'object' && typeof s.kinds === 'object';
  const out = Object.fromEntries(Object.entries(summary?.months ?? {}).filter(([m, s]) => okMonth(m, s)));
  for (const [m, cards] of Object.entries(record?.months ?? {})) if (m < now) out[m] = summarizeMonth(cards);
  return { v: 1, months: Object.fromEntries(Object.keys(out).sort().map((m) => [m, out[m]])) };
}

// 次の月の1日（"2026-10" → "2026-11-01"）。まとめのページの最終更新日
export const nextMonthDay = (ym) => `${addMonths(ym, 1)}-01`;
