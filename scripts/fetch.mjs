// 楽天から商品を集め、非公開の記録（data/）を更新する。
// data/ はサイトには出さない（楽天の規約 第10条9号）。

import { searchPage } from './lib/rakuten.mjs';
import { ngWords } from './lib/rakuten-core.mjs';
import { judge } from './lib/filter.mjs';
import { categoryOf } from './lib/classify.mjs';
import { readJson, writeJson, jstDate } from './lib/util.mjs';
import { loadWorks } from './lib/load-works.mjs';
import { fetchOpts } from './lib/works.mjs';
import { activeSeasons, seasonKeywords } from './lib/season.mjs';

const { works: chars, corners } = loadWorks();
// コーナーごとの集め方（キャラのコーナーは settings のまま。ほかのコーナーはページを少なめにして、更新の時間をおさえる）
const cornerBySlug = new Map(corners.map((c) => [c.slug, c]));
const optsOf = (char) => fetchOpts(cornerBySlug.get(char.corner), settings, char);
const settings = readJson('config/settings.json');
const seasons = readJson('config/seasons.json', []);
const topics = readJson('config/topics.json', []);
const state = readJson('data/state.json', { items: {} });

const now = new Date();
const nowIso = now.toISOString();
const today = jstDate(now);

const seen = new Map(); // itemCode -> 商品（このとき見つかったもの）
const dropped = {}; // 理由 -> 件数
let calls = 0;
const pageSizes = {}; // キーワード -> 各ページの件数（取れ方の確認用）

// 見つかった商品を、載せるかどうか確かめて覚える。via：推しキャラ（oshi）・季節（season）・ご当地（gotouchi）・話題（topic）の言葉で探して見つかったもの
function add(items, char, via) {
  let added = 0;
  for (const item of items) {
    if (seen.has(item.code)) continue;
    const { keep, reason } = judge(item, char, settings);
    if (!keep) {
      dropped[reason] = (dropped[reason] ?? 0) + 1;
      continue;
    }
    seen.set(item.code, { ...item, c: char.slug, rank: seen.size, ...(via ? { via } : {}) });
    added++;
  }
  return added;
}

for (const char of chars) {
  // 楽天側でも除外語を外してもらう（中古が多いと新品が埋もれるため、中古を先頭に）
  const ng = ngWords(char);
  const pages = char.pages ?? optsOf(char).pages;
  for (const keyword of char.keywords) {
    for (let page = 1; page <= pages; page++) {
      const { items, pageCount } = await searchPage({ keyword, page, ngKeyword: ng });
      calls++;
      (pageSizes[keyword] ??= []).push(items.length);
      add(items, char);
      // elements を指定すると pageCount が返らないことがあるので、30件未満なら最後のページとみなす
      if (items.length < 30 || (pageCount && page >= pageCount)) break;
    }
  }
}

// 季節の特集（クリスマス・福袋など）の期間中は、「作品名＋季節の言葉」でも探す。うまくいかなくても、公開は止めない
const seasonStats = { words: [], calls: 0, added: 0, failed: [] };
for (const season of activeSeasons(seasons, today)) {
  seasonStats.words.push(season.name);
  for (const char of chars.filter((c) => optsOf(c).seasons)) for (const word of seasonKeywords(season)) {
    const keyword = `${char.keywords[0]} ${word}`;
    try {
      for (let page = 1; page <= (settings.oshiPages ?? 2); page++) {
        const { items } = await searchPage({ keyword, page, ngKeyword: ngWords(char), sort: 'standard', availability: '1' });
        calls++;
        seasonStats.calls++;
        seasonStats.added += add(items, char, 'season');
        if (items.length < 30) break;
      }
    } catch (e) {
      seasonStats.failed.push(keyword);
      console.log(`季節「${keyword}」は取れませんでした：${String(e.message).slice(0, 120)}`);
    }
  }
}

// 作品ならではの話題（映画など。config/topics.json）。until を過ぎたら探さない
const topicStats = { calls: 0, added: 0, failed: [] };
for (const t of topics.filter((x) => !x.until || today <= x.until)) {
  const char = chars.find((c) => c.slug === t.work);
  if (!char) continue;
  const keyword = `${char.keywords[0]} ${t.keyword}`;
  try {
    for (let page = 1; page <= (settings.oshiPages ?? 2); page++) {
      const { items } = await searchPage({ keyword, page, ngKeyword: ngWords(char), sort: 'standard', availability: '1' });
      calls++;
      topicStats.calls++;
      topicStats.added += add(items, char, 'topic');
      if (items.length < 30) break;
    }
  } catch (e) {
    topicStats.failed.push(keyword);
    console.log(`話題「${keyword}」は取れませんでした：${String(e.message).slice(0, 120)}`);
  }
}

// ご当地グッズの特集用に、「作品名 ご当地」でも探す（いつも）。うまくいかなくても、公開は止めない
const gotouchiStats = { calls: 0, added: 0, failed: [] };
for (const char of chars.filter((c) => optsOf(c).gotouchi)) {
  const keyword = `${char.keywords[0]} ご当地`;
  try {
    for (let page = 1; page <= (settings.gotouchiPages ?? 3); page++) {
      const { items } = await searchPage({ keyword, page, ngKeyword: ngWords(char), sort: 'standard', availability: '1' });
      calls++;
      gotouchiStats.calls++;
      gotouchiStats.added += add(items, char, 'gotouchi');
      if (items.length < 30) break;
    }
  } catch (e) {
    gotouchiStats.failed.push(keyword);
    console.log(`ご当地「${keyword}」は取れませんでした：${String(e.message).slice(0, 120)}`);
  }
}

// 推しキャラのページ用に、推しキャラの名前でも探す（楽天市場の標準の並び・買えるものだけ）。
// うまくいかなくても、公開は止めない
const oshiStats = { words: 0, calls: 0, added: 0, failed: [] };
for (const char of chars) {
  const ng = ngWords(char);
  for (const o of char.oshi ?? []) {
    if (!o.slug) continue;
    const keyword = `${char.keywords[0]} ${o.name}`;
    oshiStats.words++;
    try {
      for (let page = 1; page <= optsOf(char).oshiPages; page++) {
        const { items } = await searchPage({ keyword, page, ngKeyword: ng, sort: 'standard', availability: '1' });
        calls++;
        oshiStats.calls++;
        oshiStats.added += add(items, char, 'oshi');
        if (items.length < 30) break;
      }
    } catch (e) {
      oshiStats.failed.push(o.name);
      console.log(`推しキャラ「${keyword}」は取れませんでした：${String(e.message).slice(0, 120)}`);
    }
  }
}

if (seen.size === 0) {
  console.error('商品が1件も取れませんでした。公開を止めます。');
  process.exit(1);
}

// 記録の更新
for (const item of seen.values()) {
  const prev = state.items[item.code];
  if (!prev) {
    state.items[item.code] = {
      c: item.c,
      k: categoryOf(item.name), // 種類（入荷メモで「売り切れまでの日数」を種類ごとに見るため。商品名は残さない）
      first: nowIso,
      last: nowIso,
      price: item.price,
      avail: item.avail,
      hist: [[today, item.price]],
      r: item.rank, // 初めて見たときの並び（新しく更新された順）
      ...(item.avail === 0 ? { soldOut: nowIso, out1: nowIso } : {}),
    };
    continue;
  }
  prev.last = nowIso;
  if (prev.k === undefined) prev.k = categoryOf(item.name);
  // 売り切れを見た最後の時（「前に売り切れたことあり」の印に使う）
  if (item.avail === 0) prev.soldOut = nowIso;
  // 初めて売り切れを見た時（入荷メモの「見つけてから売り切れるまで」に使う。soldOut は最後に見た時なので別に残す）
  if (item.avail === 0 && !prev.out1) prev.out1 = nowIso;
  // 売り切れ → 買える に戻ったら再入荷
  if (prev.avail === 0 && item.avail === 1) prev.restock = nowIso;
  prev.avail = item.avail;
  if (prev.price !== item.price) {
    // 値下がりは「前に確認した価格」と比べた事実だけを残す
    if (item.price < prev.price) prev.drop = { at: nowIso, from: prev.price };
    else delete prev.drop;
    prev.price = item.price;
    const lastHist = prev.hist.at(-1);
    if (lastHist && lastHist[0] === today) lastHist[1] = item.price;
    else prev.hist.push([today, item.price]);
  }
}

// 古い記録を消して軽くする
const limit = Date.now() - settings.keepDays * 86400000;
for (const [code, rec] of Object.entries(state.items)) {
  if (Date.parse(rec.last) < limit) delete state.items[code];
  else if (rec.hist.length > 1) {
    const cut = jstDate(new Date(limit));
    const kept = rec.hist.filter(([d]) => d >= cut);
    rec.hist = kept.length ? kept : [rec.hist.at(-1)];
  }
}

// ページ作りに使う一覧（今回見つかったもの）
const latest = [...seen.values()]
  .map((it) => ({
    code: it.code,
    c: it.c,
    name: it.name,
    price: it.price,
    shop: it.shop,
    img: it.img,
    url: it.url,
    first: state.items[it.code].first,
    rank: state.items[it.code].r ?? 0,
    avail: it.avail,
    restock: state.items[it.code].restock ?? '',
    drop: state.items[it.code].drop ?? null,
    genre: it.genre,
    catchcopy: it.catchcopy,
    start: it.start,
    end: it.end,
    reviews: it.reviews,
    rating: it.rating,
    pointRate: it.pointRate,
    pointStart: it.pointStart,
    pointEnd: it.pointEnd,
    soldOut: state.items[it.code].soldOut ?? '',
    postage: it.postage,
    gift: it.gift,
    ...(it.via ? { via: it.via } : {}),
  }))
  .sort((a, b) => a.code.localeCompare(b.code));

writeJson('data/state.json', state);
writeJson('data/latest.json', latest);
writeJson('data/meta.json', { fetchedAt: nowIso });

const byChar = Object.fromEntries(chars.map((c) => [c.slug, latest.filter((i) => i.c === c.slug).length]));
const newCount = latest.filter((i) => i.first === nowIso).length;
const summary = `ページごとの件数 ${JSON.stringify(pageSizes)} / 呼び出し ${calls}回 / 載せる ${latest.length}件（${JSON.stringify(byChar)}）/ 初めて見た ${newCount}件`;
const droppedText = `載せなかった理由：${JSON.stringify(dropped)}`;
const seasonText = seasonStats.words.length
  ? `季節（${seasonStats.words.join('・')}）を${seasonStats.calls}回で探して ${seasonStats.added}件ふえた${seasonStats.failed.length ? `（取れなかった：${seasonStats.failed.join('・')}）` : ''}`
  : '季節の特集の期間ではない';
const topicText = `話題を${topicStats.calls}回で探して ${topicStats.added}件ふえた${topicStats.failed.length ? `（取れなかった：${topicStats.failed.join('・')}）` : ''}`;
const gotouchiText = `ご当地を${gotouchiStats.calls}回で探して ${gotouchiStats.added}件ふえた${gotouchiStats.failed.length ? `（取れなかった：${gotouchiStats.failed.join('・')}）` : ''}`;
const oshiText = `推しキャラ ${oshiStats.words}人を${oshiStats.calls}回で探して ${oshiStats.added}件ふえた${oshiStats.failed.length ? `（取れなかった：${oshiStats.failed.join('・')}）` : ''}`;
console.log(summary);
console.log(oshiText);
console.log(seasonText);
console.log(gotouchiText);
console.log(topicText);
console.log(droppedText);
if (process.env.GITHUB_ACTIONS) {
  console.log(`::notice title=集めた結果::${summary}`);
  console.log(`::notice title=推しキャラ::${oshiText}`);
  console.log(`::notice title=季節の特集::${seasonText}`);
  console.log(`::notice title=ご当地::${gotouchiText}`);
  console.log(`::notice title=話題::${topicText}`);
  console.log(`::notice title=除外::${droppedText}`);
}
