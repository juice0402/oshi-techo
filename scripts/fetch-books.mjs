// 楽天ブックスから、キャラの本・CD・DVD・ゲームなどの発売日を集めて、非公開の記録（data/books.json）にする。
// 発売日カレンダー用。うまくいかなくても、ほかの公開は止めない（前の記録を使う）。

import { booksUrl, parseBooks, parseSalesDate, HEADERS } from './lib/books.mjs';
import { cleanKeys } from './lib/rakuten-core.mjs';
import { judge } from './lib/filter.mjs';
import { readJson, writeJson, jstDate } from './lib/util.mjs';
import { loadWorks } from './lib/load-works.mjs';
import { fetchOpts } from './lib/works.mjs';

const { works: chars, corners } = loadWorks();
const settings = readJson('config/settings.json');
const keys = cleanKeys(process.env);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const note = (level, msg) => {
  console.log(msg);
  if (process.env.GITHUB_ACTIONS) console.log(`::${level} title=発売日（楽天ブックス）::${msg}`);
};

const now = new Date();
const from = jstDate(new Date(now.getTime() - 31 * 86400000)); // 最近1か月に発売したものまで
const MAX_PAGES = 8;

const items = [];
const seen = new Set();
const counts = {};
let calls = 0;
try {
  for (const char of chars) {
    counts[char.slug] = 0;
    // コーナーごとに見るページの数を変えられる（本やDVDが多い作品で、呼ぶ回数をふやさないため）
    const o = fetchOpts(corners.find((x) => x.slug === char.corner), settings, char);
    const maxPages = o.books ? o.booksPages ?? MAX_PAGES : 0;
    for (let page = 1; page <= maxPages; page++) {
      await sleep(1100);
      let res;
      for (let attempt = 1; attempt <= 3; attempt++) {
        res = await fetch(booksUrl({ keys, keyword: char.keywords[0], page }), { headers: HEADERS });
        calls++;
        if (res.status !== 429 && res.status < 500) break;
        await sleep(5000 * attempt);
      }
      if (res.status === 404) break;
      const text = await res.text();
      if (!res.ok) {
        const hint = /SCOPES_NOT_ALLOWED/.test(text) ? '（楽天のアプリで楽天ブックスAPIが許可されていません）' : '';
        note('warning', `HTTP ${res.status}${hint} ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
        process.exit(0);
      }
      const json = JSON.parse(text);
      const list = parseBooks(json);
      let oldest = '9999';
      for (const it of list) {
        const date = parseSalesDate(it.sales);
        if (date && date.ymd < oldest) oldest = date.ymd;
        if (!date || date.ymd < from || seen.has(it.code)) continue;
        if (!judge(it, char, settings).keep) continue;
        seen.add(it.code);
        items.push({ ...it, c: char.slug, date });
        counts[char.slug]++;
      }
      // 発売日の新しい順なので、1か月より前まで来たら終わり
      if (list.length < 30 || oldest < from || page >= Number(json.pageCount ?? MAX_PAGES)) break;
    }
  }
} catch (e) {
  note('warning', `集められませんでした：${String(e).slice(0, 160)}`);
  process.exit(0);
}

items.sort((a, b) => a.date.ymd.localeCompare(b.date.ymd) || a.code.localeCompare(b.code));
writeJson('data/books.json', { fetchedAt: now.toISOString(), items });
note('notice', `呼び出し ${calls}回 / 載せる ${items.length}件（${JSON.stringify(counts)}）`);
// 中身の確かめ用：種類ごとの件数と、これから発売の最初のいくつか
const today = jstDate(now);
for (const char of chars) {
  const mine = items.filter((i) => i.c === char.slug);
  const kinds = {};
  mine.forEach((i) => (kinds[i.kind || 'その他'] = (kinds[i.kind || 'その他'] ?? 0) + 1));
  const next = mine
    .filter((i) => i.date.ymd >= today)
    .slice(0, 8)
    .map((i) => `${i.date.label} ${i.name.slice(0, 24)}`)
    .join(' ／ ');
  const hw = {};
  mine.forEach((i) => (hw[i.hardware || '-'] = (hw[i.hardware || '-'] ?? 0) + 1));
  note('notice', `${char.name}：${JSON.stringify(kinds)}・機種 ${JSON.stringify(hw).slice(0, 200)}・これから ${mine.filter((i) => i.date.ymd >= today).length}件：${next}`);
}
