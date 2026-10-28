// 楽天市場のランキングから、載せているキャラのグッズを集めて data/ranking.json にする（非公開の記録）。
// ・ジャンル別のデイリーランキング（いま集めた商品に多いジャンル。各60位まで）
// ・20代・30代女性のランキング（ジャンルなし。各90位まで。楽天の決まりでジャンルと年代はいっしょに使えない）
// うまくいかなくても、ほかの公開は止めない（前の記録を使う）。

import { parseItems, cleanKeys, HEADERS, ELEMENTS } from './lib/rakuten-core.mjs';
import { judge } from './lib/filter.mjs';
import { readJson, writeJson } from './lib/util.mjs';
import { loadWorks } from './lib/load-works.mjs';

const ENDPOINT = 'https://openapi.rakuten.co.jp/ichibaranking/api/IchibaItem/Ranking/20220601';
const { works: chars, corners } = loadWorks();
const settings = readJson('config/settings.json');
const latest = readJson('data/latest.json', []);
const keys = cleanKeys(process.env);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const note = (level, msg) => {
  console.log(msg);
  if (process.env.GITHUB_ACTIONS) console.log(`::${level} title=ランキング::${msg}`);
};

const GENRES = 10;
const GENRE_PAGES = 2;
const WOMEN_PAGES = 3;

// いま集めた商品に多いジャンル
const count = {};
for (const it of latest) if (it.genre) count[it.genre] = (count[it.genre] ?? 0) + 1;
const genres = Object.entries(count)
  .sort((a, b) => b[1] - a[1])
  .slice(0, GENRES)
  .map(([g]) => g);

const queries = [
  ...genres.flatMap((g) => Array.from({ length: GENRE_PAGES }, (_, i) => ({ kind: 'genre', params: { genreId: g, page: i + 1 } }))),
  ...[20, 30].flatMap((age) => Array.from({ length: WOMEN_PAGES }, (_, i) => ({ kind: `f${age}`, params: { sex: 1, age, page: i + 1 } }))),
];

const found = [];
let calls = 0;
let okCalls = 0;
const skipped = []; // 楽天が「この指定では出せない」（400）と返したもの。ほかは続ける
try {
  for (const q of queries) {
    await sleep(1100);
    const params = new URLSearchParams({
      applicationId: keys.appId,
      accessKey: keys.accessKey,
      affiliateId: keys.affiliateId,
      formatVersion: '2',
      // giftFlag はランキングAPIにないので外す
      elements: [...ELEMENTS.filter((e) => e !== 'giftFlag'), 'rank'].join(','),
      ...Object.fromEntries(Object.entries(q.params).map(([k, v]) => [k, String(v)])),
    });
    let res;
    for (let attempt = 1; attempt <= 3; attempt++) {
      res = await fetch(`${ENDPOINT}?${params}`, { headers: HEADERS });
      calls++;
      if (res.status !== 429 && res.status < 500) break;
      await sleep(5000 * attempt);
    }
    const text = await res.text();
    if (!res.ok) {
      if (res.status === 404) continue; // そのジャンルのランキングがない
      if (res.status === 400) {
        skipped.push(`${q.kind}${q.params.genreId ? `:${q.params.genreId}` : ''}:p${q.params.page} ${text.slice(0, 80).replace(/\s+/g, ' ')}`);
        continue;
      }
      const hint = /SCOPES_NOT_ALLOWED/.test(text) ? '（楽天のアプリでランキングAPIが許可されていません）' : '';
      note('warning', `HTTP ${res.status}${hint} ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
      process.exit(0);
    }
    okCalls++;
    for (const it of parseItems(JSON.parse(text))) {
      const char = chars.find((c) => judge(it, c, settings).keep);
      if (char) found.push({ ...it, c: char.slug, kind: q.kind, genreQuery: q.params.genreId ?? '' });
    }
  }
} catch (e) {
  note('warning', `集められませんでした：${String(e).slice(0, 160)}`);
  process.exit(0);
}

if (skipped.length) note('warning', `出せなかった指定 ${skipped.length}件：${skipped.slice(0, 4).join(' ／ ')}`);
if (okCalls === 0) {
  note('warning', 'ランキングが1つも取れませんでした（前の記録は2日たつと使わない）');
  process.exit(0);
}

// 同じ商品は1つに（女性ランキング → ジャンル別の順で、順位の高いものを残す）
const order = { f20: 0, f30: 1, genre: 2 };
found.sort((a, b) => order[a.kind] - order[b.kind] || a.rank - b.rank);
const seen = new Set();
const items = found.filter((it) => (seen.has(it.code) ? false : seen.add(it.code)));

writeJson('data/ranking.json', { fetchedAt: new Date().toISOString(), items });
const byChar = Object.fromEntries(chars.map((c) => [c.slug, items.filter((i) => i.c === c.slug).length]));
const byKind = Object.fromEntries(Object.keys(order).map((k) => [k, items.filter((i) => i.kind === k).length]));
note('notice', `呼び出し ${calls}回 / ランキングに入っている ${items.length}件（${JSON.stringify(byChar)} ${JSON.stringify(byKind)}）：${items.slice(0, 4).map((i) => `${i.rank}位 ${i.name.slice(0, 20)}`).join(' ／ ')}`);
