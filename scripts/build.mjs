// data/ の記録から静的なページ（dist/）を作る。
// SITE_MODE=production のときだけ検索エンジンに載る設定にする（それ以外は noindex）。

import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { readJson, writeJson } from './lib/util.mjs';
import { loadWorks } from './lib/load-works.mjs';
import { esc, yen, mdOf, jstDate, jstMonthDay, jstMonthDayTime, normalize, rakutenTime } from './lib/text.mjs';
import { CATEGORIES, categoryOf, productKey, reservationInfo, median, oshiMatcher, isAdult, isKids } from './lib/classify.mjs';
import { cardHtml, marksFor, searchFormHtml, oshiChipsHtml, searchHref } from './lib/view.mjs';
import { activeSeasons, seasonMatcher, nextBirthday, mdLabel } from './lib/season.mjs';
import { AREAS, regionOf, isGotouchi, prefId } from './lib/region.mjs';
import { buildIcs } from './lib/ics.mjs';
import { decoCss, DECO_STYLES } from '../src/deco/deco.mjs';

const OUT = process.env.OUT_DIR || 'dist'; // 見本データのテストで、別の日付のページを作るときだけ OUT_DIR を使う
const production = process.env.SITE_MODE === 'production';

const { works: allWorks, corners } = loadWorks();
const settings = readJson('config/settings.json');
// 見本データのときは、コーナーごとの見本（test/fixture-corner-<コーナー>.json）も足す
const latest = [
  ...readJson(process.env.DATA_LATEST ?? 'data/latest.json', []),
  ...(process.env.DATA_LATEST
    ? readdirSync('test')
        .filter((f) => /^fixture-corner-[a-z]+\.json$/.test(f))
        .sort()
        .flatMap((f) => readJson(`test/${f}`, []))
    : []),
];
const meta = readJson(process.env.DATA_META ?? 'data/meta.json', { fetchedAt: new Date().toISOString() });
const books = readJson(process.env.DATA_BOOKS ?? 'data/books.json', { fetchedAt: '', items: [] });
const rankingRaw = readJson(process.env.DATA_RANKING ?? 'data/ranking.json', { fetchedAt: '', items: [] });
// ランキングが2日より古いとき（集められない日が続いたとき）は、もう入っていないかもしれないので「ランキング入り」を出さない
const ranking =
  rankingRaw.fetchedAt && Date.parse(meta.fetchedAt) - Date.parse(rankingRaw.fetchedAt) <= 2 * 86400000 ? rankingRaw : { fetchedAt: '', items: [] };
// 買える商品が1件もない作品（楽天から取れなかった日など）は、ページを作らず、どこからもリンクしない（リンク切れにしない）。
// 作品名の新着が0件でも、推しキャラの名前などで見つけた買える商品があれば、作品のページを作る
const hasBuyable = new Set(latest.filter((i) => i.avail !== 0).map((i) => i.c));
const chars = allWorks.filter((c) => hasBuyable.has(c.slug));
const noItemWorks = allWorks.filter((c) => !hasBuyable.has(c.slug));
if (noItemWorks.length) console.warn(`買える商品がないので作らなかった作品：${noItemWorks.map((c) => c.name).join('・')}`);
// 外した作品（config/ にない作品）の記録は使わない。外した直後は、前に集めた楽天ブックス・ランキングに残っていることがある
const workSlugs = new Set(chars.map((c) => c.slug));
for (const list of [latest, books.items, ranking.items]) {
  for (let i = list.length - 1; i >= 0; i--) if (list[i].c && !workSlugs.has(list[i].c)) list.splice(i, 1);
}
const seasons = readJson('config/seasons.json', []);
const topics = readJson('config/topics.json', []);
// 季節のデコの形（stickers・garland・kisekae の組み合わせ）。見比べるときは DECO=stickers,kisekae のように変える
const decoStyle = (process.env.DECO ? process.env.DECO.split(',') : settings.decoStyle ?? ['stickers']).filter((x) => DECO_STYLES.includes(x));
const SITE = settings.siteUrl.replace(/\/$/, '');
// ---- コーナー（キャラ・アニメ・ゲームなど。config/corners/） ----
const cornerBySlug = new Map(corners.map((k) => [k.slug, k]));
const worksIn = (slug) => chars.filter((c) => c.corner === slug);
const charaWorks = worksIn('chara');
const otherCorners = corners.filter((k) => k.slug !== 'chara' && worksIn(k.slug).length);
const cornerHref = (slug) => (slug === 'chara' ? '/' : `/${slug}/`);
// タブの値（作品の slug かコーナーの slug）から、そのページのコーナー
const cornerOfTab = (tab) => (cornerBySlug.has(tab) ? tab : chars.find((c) => c.slug === tab)?.corner ?? '');
const namesOf = (list, n = 3) => (list.length > n ? `${list.slice(0, n).map((c) => c.name).join('・')}など` : list.map((c) => c.name).join('・'));
// サイト全体の名前はキャラのコーナーの作品から（作品が多いので、ほかのコーナーはコーナーの名前で書く）
const allNames = charaWorks.map((c) => c.name).join('・');
const shortNames = namesOf(charaWorks);
const cornerList = otherCorners.map((k) => k.name).join('・');

const credit = readFileSync('src/credit.html', 'utf8');
const banners = readdirSync('src/banners')
  .filter((f) => f.endsWith('.html'))
  .sort()
  .map((f) => readFileSync(join('src/banners', f), 'utf8'));
const theme = process.env.THEME || settings.theme;
// ファビコンの目印：src/icons/ の絵の中身から作る。絵を変えると目印も変わり、ブラウザが古いファビコンを使い続けずに読み直す
const ICON_V = createHash('sha1')
  .update(['favicon.svg', 'favicon.ico', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].map((f) => readFileSync(join('src/icons', f)).toString('base64')).join('|'))
  .digest('hex')
  .slice(0, 8);
// SNSで共有したときの画像の目印：画像の中身から作る。画像を変えると URL も変わり、SNS が古い画像を使い続けずに読み直す
const OG_V = createHash('sha1').update(readFileSync('src/og.png')).digest('hex').slice(0, 8);
const css = [readFileSync('src/base.css', 'utf8'), readFileSync(`src/themes/${theme}.css`, 'utf8')]
  .join('\n')
  .replace(/\s*\n\s*/g, '')
  .replaceAll('url(/favicon.svg)', `url(/favicon.svg?v=${ICON_V})`);


const DAY = 86400000;
const nowMs = Date.parse(meta.fetchedAt);
const today = jstDate(new Date(nowMs));
const RECENT = 7 * DAY; // 値下がり・再入荷を出す期間
const MIN_PAGE = 3; // これより少ない区分は、専用のページを作らない
const MIN_CAT = 4; // カテゴリのページを作る最低件数
const MIN_OSHI = 6; // 推しキャラのページを作る最低件数
const MIN_SEASON = 6; // 季節の特集のページを作る最低件数（作品ごと）
const BIRTHDAY_TOP = 14; // 誕生日がこの日数以内なら、トップに出す
const BIRTHDAY_SOON = 30; // 誕生日カレンダーで、グッズも出す日数
const BIRTHDAY_DECO = 7; // 推しキャラのページを誕生日のデコにする日数
const MIN_INDEX = 12; // 検索に出すページの最低件数（少ないページは noindex,follow にしてサイトマップから外す）
const INDEX_GRACE = 7; // 検索に出していたページが少なくなっても、この日数続くまでは切りかえない

// 検索に出すかどうか（少ない日がつづいたときだけ外す）。記録は data/index-state.json（見本データで作るときは書かない）
const INDEX_STATE = 'data/index-state.json';
const indexState = process.env.DATA_LATEST ? {} : readJson(INDEX_STATE, {});
const nextIndexState = {};
function indexable(path, count) {
  const prev = indexState[path];
  if (count >= MIN_INDEX) {
    nextIndexState[path] = { idx: true };
    return true;
  }
  if (prev?.idx) {
    const below = prev.below ?? today;
    if ((Date.parse(today) - Date.parse(below)) / DAY < INDEX_GRACE) {
      nextIndexState[path] = { idx: true, below };
      return true;
    }
  }
  nextIndexState[path] = { idx: false };
  return false;
}

// ---- 商品に印をつける ----
const items = latest.map((it) => ({
  ...it,
  cat: categoryOf(it.name),
  key: productKey(it.name),
  resv: reservationInfo(it, meta.fetchedAt),
}));

// 相場より高め：同じ商品を3店以上が出していて、その真ん中の価格の1.5倍以上（かつ500円以上高い）
const groups = new Map();
for (const it of items) {
  if (!it.key || it.avail === 0) continue;
  const g = `${it.c}|${it.key}`;
  if (!groups.has(g)) groups.set(g, []);
  groups.get(g).push(it);
}
for (const list of groups.values()) {
  if (list.length < 3) continue;
  const mid = median(list.map((i) => i.price));
  for (const it of list) if (it.price >= mid * 1.5 && it.price - mid >= 500) it.high = true;
}

const isDrop = (it) => it.drop && nowMs - Date.parse(it.drop.at) <= RECENT && it.price < it.drop.from;
const isRestock = (it) => it.restock && nowMs - Date.parse(it.restock) <= RECENT;
const buyable = items.filter((i) => i.avail !== 0);

const byNew = (a, b) => b.first.localeCompare(a.first) || a.rank - b.rank;
// 楽天の販売期間の終わり（92日以内のもの。予約の商品では「販売期間◯/◯まで」として出す）
const saleEndOf = (it) => {
  const t = rakutenTime(it.end);
  return t > nowMs && t - nowMs < 92 * DAY ? jstDate(new Date(t)) : '';
};
// 予約は、締切（商品名に書いてあるもの）か販売期間の終わりが近い順 → 発売・発送が近い順
const resvKey = (it) => it.resv.deadline || saleEndOf(it) || '9999';
const byResv = (a, b) =>
  resvKey(a).localeCompare(resvKey(b)) ||
  (a.resv.release || '9999').localeCompare(b.resv.release || '9999') ||
  byNew(a, b);
const byDrop = (a, b) => b.drop.at.localeCompare(a.drop.at) || byNew(a, b);
const byRestock = (a, b) => b.restock.localeCompare(a.restock) || byNew(a, b);

// コーナーの新着：そのコーナーの作品の新着をまぜて新しい順（推しキャラや季節の言葉で見つけたものは除く）
const cornerNews = (slug) => {
  const set = new Set(worksIn(slug).map((c) => c.slug));
  return buyable.filter((i) => set.has(i.c) && !i.via).sort(byNew);
};

// 切りかえに出すのは、商品があってトップのページができるコーナーだけ（リンク切れにしない）
const liveCorners = otherCorners.filter((k) => cornerNews(k.slug).length);

function listsFor(slug) {
  const mine = buyable.filter((i) => i.c === slug);
  return {
    all: mine,
    // 新着は、作品の名前で新しい順に探したものだけ（推しキャラの名前で探したものは、前からある定番も多いため）
    news: mine.filter((i) => !i.via).sort(byNew),
    yoyaku: mine.filter((i) => i.resv).sort(byResv),
    nesage: mine.filter(isDrop).sort(byDrop),
    sainyuka: mine.filter(isRestock).sort(byRestock),
    cats: CATEGORIES.map((c) => ({ ...c, items: mine.filter((i) => i.cat === c.slug).sort(byNew) })).filter(
      (c) => c.items.length >= MIN_CAT,
    ),
  };
}

// ---- 楽天のランキング ----
const RANK_LABEL = { f20: '20代女性ランキング入り', f30: '30代女性ランキング入り', genre: '楽天ランキング入り' };
const rankOf = new Map(ranking.items.map((r) => [r.code, r]));
const rankLabel = (code) => {
  const r = rankOf.get(code);
  return r ? RANK_LABEL[r.kind] ?? '' : '';
};
// ランキングに入っているグッズ（買えるもの・女性のランキング → ジャンル別、順位の高い順）
const rankOrder = { f20: 0, f30: 1, genre: 2 };
const rankedFor = (slug) =>
  ranking.items
    .filter((r) => (!slug || r.c === slug) && r.avail !== 0 && r.url && r.img)
    .sort((a, b) => rankOrder[a.kind] - rankOrder[b.kind] || a.rank - b.rank);
// ランキングAPIはラッピング対応（giftFlag）を返さないので、同じ商品を集めていればその印を使う
const byCode = new Map(items.map((i) => [i.code, i]));
function rankCell(r, eager) {
  const resv = reservationInfo(r, meta.fetchedAt);
  const m = marksFor({ ...r, gift: r.gift ?? byCode.get(r.code)?.gift ?? null, resv }, meta.fetchedAt);
  const note = resv?.deadline ? `締切 ${mdOf(resv.deadline)}` : resv?.label ?? '';
  return cardHtml(r, { tag: resv ? '予約' : '', rank: RANK_LABEL[r.kind] ?? '', note, dl: resv?.deadline ?? '', eager, review: m.review, extra: m.extra, until: m.until, perks: m.perks });
}
function rankSection(title, list, limit) {
  if (!list.length) return '';
  return `<section><h2>${esc(title)}</h2><ul class="grid">${list.slice(0, limit).map((r) => rankCell(r, false)).join('')}</ul></section>`;
}
// レビューが多いもの（楽天のレビューが5件以上）
const byReviews = (a, b) => b.reviews - a.reviews || byNew(a, b);

// ---- 部品 ----
// しぼりこみの目印：送料込み s・ラッピング対応 g・大人向け a・子ども向け k
const filtOf = (it) => [it.postage === 0 && 's', it.gift === 1 && 'g', isAdult(it.name) && 'a', isKids(it.name) && 'k'].filter(Boolean).join(' ') || '-';
// filt：しぼりこみの目印をつける。hidden：はじめは隠す（しぼりこんだときに、隠れていたものから補う）
function cell(it, eager, { filt = false, hidden = false, cat = false, sort = false } = {}) {
  let tag = '';
  if (isRestock(it)) tag = '再入荷';
  else if (isDrop(it)) tag = '値下がり';
  else if (it.resv) tag = '予約';
  let note = '';
  if (isDrop(it)) note = `${jstMonthDay(it.drop.at)}より${yen(it.drop.from - it.price)}安い`;
  else if (it.resv?.deadline) note = `締切 ${mdOf(it.resv.deadline)}`;
  else if (it.resv?.label) note = it.resv.label;

  const m = marksFor(it, meta.fetchedAt);
  let { extra, until } = m;
  // このサイトが確かめた「売り切れていたことがある」（いま買えて、再入荷の印がないもの）
  if (!extra && it.soldOut && !isRestock(it)) {
    extra = '前に売り切れたことあり';
    until = '';
  }
  const dl = !isDrop(it) && it.resv?.deadline ? it.resv.deadline : '';
  return cardHtml(it, { tag, note, high: it.high, eager, seen: it.first, rank: rankLabel(it.code), review: m.review, extra, until, dl, perks: m.perks, filt: filt ? filtOf(it) : '', hidden, cat: cat ? it.cat || '-' : '', sortv: sort });
}

// しぼりこめる一覧：pool 件まで入れておき、show 件だけ見せる（しぼりこむと、条件に合うものを show 件まで出す）
function filterGrid(list, { show, pool = show, eager = false, sort = false }) {
  return `<ul class="grid" data-n="${show}"${sort ? ' data-sort' : ''}>${list
    .slice(0, pool)
    .map((it, j) => cell(it, eager && j < 4, { filt: true, hidden: j >= show, sort }))
    .join('')}</ul>`;
}
// しぼりこみのボタン（keys：s・g・a・k・max）。4件以上あるものだけ
const FILTERS = [
  ['s', '送料込み'],
  ['g', 'ラッピング対応'],
  ['a', '大人向け'],
  ['k', '子ども向け'],
];
function filterBar(list, keys) {
  const has = (k) => list.filter((it) => filtOf(it).split(' ').includes(k)).length >= MIN_CAT;
  const btns = FILTERS.filter(([k]) => keys.includes(k) && has(k));
  const max = keys.includes('max');
  if (!btns.length && !max) return '';
  return (
    `<div class="flt"><p class="oc">しぼりこむ</p><ul class="chips">${btns
      .map(([k, t]) => `<li><button type="button" data-k="${k}" aria-pressed="false">${esc(t)}</button></li>`)
      .join('')}${max ? '<li class="fmax"><label>予算<input type="number" inputmode="numeric" min="0" step="100" placeholder="2000">円まで</label></li>' : ''}</ul></div>`
  );
}
// しぼりこみの動き（ブラウザの中だけ。どこにも保存しない）
const FILTER_END =
  '<p class="asof fl-none" hidden>条件に合うグッズがありません</p>' +
  `<script>(function(){var r=document.querySelector('.flt');if(!r)return;var b=[].slice.call(r.querySelectorAll('button')),x=r.querySelector('input');` +
  `function f(){var on=b.filter(function(e){return e.getAttribute('aria-pressed')==='true'}).map(function(e){return e.getAttribute('data-k')}),mx=parseInt(x&&x.value,10)||0,any=0;` +
  `document.querySelectorAll('ul[data-n]').forEach(function(u){var n=+u.getAttribute('data-n'),c=0;u.querySelectorAll('li').forEach(function(l){var fs=(l.getAttribute('data-f')||'').split(' '),ok=on.every(function(k){return fs.indexOf(k)>=0})&&(!mx||+l.getAttribute('data-p')<=mx)&&c<n;l.hidden=!ok;if(ok)c++;});var s=u.closest('section');if(s)s.hidden=!c;any+=c;});` +
  `var e=document.querySelector('.fl-none');if(e)e.hidden=!!any;}` +
  `b.forEach(function(e){e.addEventListener('click',function(){var p=e.getAttribute('aria-pressed')!=='true',k=e.getAttribute('data-k');if(p&&(k==='a'||k==='k'))b.forEach(function(o){var q=o.getAttribute('data-k');if(o!==e&&(q==='a'||q==='k'))o.setAttribute('aria-pressed','false')});e.setAttribute('aria-pressed',String(p));f();});});` +
  `if(x)x.addEventListener('input',f);document.addEventListener('ot-sort',f);})();</script>`;

// ---- 並べかえ（一覧のページ。ブラウザの中だけで並べかえて、URL は増やさず、どこにも保存しない） ----
// はじめの並び（見つけた新しい順）・安い順・レビューが多い順。レビューがある商品が4件より少ない一覧では、レビューの順は出さない
function sortBar(list) {
  const opts = [['', '新しい順'], ['low', '安い順'], ...(list.filter((i) => i.reviews > 0).length >= MIN_CAT ? [['review', 'レビューが多い順']] : [])];
  return `<div class="srt" hidden><span class="oc">並べかえ</span><ul>${opts
    .map(([k, t], i) => `<li><a href="#" data-s="${k}"${i === 0 ? ' aria-current="true"' : ''}>${esc(t)}</a></li>`)
    .join('')}</ul></div>`;
}
const SORT_END =
  `<script>(function(){var r=document.querySelector('.srt');if(!r)return;var us=[].slice.call(document.querySelectorAll('ul[data-sort]')),as=[].slice.call(r.querySelectorAll('a'));` +
  `us.forEach(function(u){[].forEach.call(u.children,function(l,i){l.setAttribute('data-i',i)})});` +
  `function go(k){us.forEach(function(u){var ls=[].slice.call(u.children);ls.sort(function(a,b){var d=0;if(k==='low')d=a.getAttribute('data-p')-b.getAttribute('data-p');else if(k==='review')d=b.getAttribute('data-r')-a.getAttribute('data-r');return d||a.getAttribute('data-i')-b.getAttribute('data-i')});ls.forEach(function(l){u.appendChild(l)})});document.dispatchEvent(new Event('ot-sort'))}` +
  `as.forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();as.forEach(function(o){o.setAttribute('aria-current',String(o===a))});go(a.getAttribute('data-s'))})});r.hidden=false;})();</script>`;
// 並べかえられる一覧（並べかえのボタン＋一覧＋動き）
const sortGrid = (list) => sortBar(list) + `<ul class="grid" data-sort>${list.map((it, i) => cell(it, i < 4, { sort: true })).join('')}</ul>` + SORT_END;

function grid(list, eagerFirst = false, cat = false) {
  return `<ul class="grid">${list.map((it, i) => cell(it, eagerFirst && i < 4, { cat })).join('')}</ul>`;
}

// 見た目の案がまとまりごとに形を変えるための目印（<section data-s="new"> など）。html が <section で始まるときだけ
const tagS = (html, key) => (html.startsWith('<section') ? html.replace(/^<section([^>]*)>/, `<section$1 data-s="${key}">`) : html);
// 作品のトップの h1 のすぐ下：推しキャラのページへの行（ページがある作品だけ）
function oshiRow(c) {
  const list = (c.oshi ?? []).filter((o) => o.slug && oshiPageSet.has(`${c.slug}/${o.slug}`));
  return list.length ? `<nav class="cats orow" aria-label="推しキャラ"><ul>${list.map((o) => `<li><a href="/${c.slug}/${o.slug}/">${esc(o.name)}</a></li>`).join('')}</ul></nav>` : '';
}
// ページの終わりの「次に見るもの」：同じコーナーのほかの作品
function tsugiWorks(c) {
  const list = worksIn(c.corner).filter((x) => x.slug !== c.slug);
  return list.length ? `<nav class="cats tsugi" aria-label="次に見るもの"><h2>ほかの作品</h2><ul>${list.map((x) => `<li><a href="/${x.slug}/">${esc(x.name)}</a></li>`).join('')}</ul></nav>` : '';
}
// cat：カードに種類の目印をつける（推しキャラのページのしおり用）
function section(title, list, { limit, more, moreLabel, eager = false, cat = false } = {}) {
  if (!list.length) return '';
  const shown = limit ? list.slice(0, limit) : list;
  const link = more && list.length > shown.length ? `<p class="more"><a href="${more}">${esc(moreLabel)}</a></p>` : '';
  return `<section>${title ? `<h2>${esc(title)}</h2>` : ''}${grid(shown, eager, cat)}${link}</section>`;
}

// 価格を確かめた時刻。ページのいちばん下にまとめて小さく出す（page() が目印を見て1行にする）
const priceAt = () => '<!--asof-->';
const booksAt = () => '<!--asof-books-->';

const newest = (list) => (list.length ? jstDate(new Date(list.map((i) => i.first).sort().at(-1))) : '');

// ---- 説明文（meta description）：そのページのデータから作る ----
// そのページにしかない数（新着・予約・件数・日付）を入れて、全角80〜120字くらい。値段はピッタリではなく「◯円台から」の幅にする（検索結果に古い値段が残るため）
const mdOfYmd = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;
const TODAY_MD = mdOfYmd(today);
const priceBand = (y) => (y < 100 ? '100円未満' : y < 1000 ? `${Math.floor(y / 100) * 100}円台` : y < 10000 ? `${(Math.floor(y / 1000) * 1000).toLocaleString('ja-JP')}円台` : `${Math.floor(y / 10000)}万円台`);
// 値段の中心（安いほうから4分の1〜4分の3の幅）。1つだけ安い・高いものに引っぱられないように
const priceMid = (list) => {
  const p = list.map((i) => Number(i.price)).filter((x) => x > 0).sort((a, b) => a - b);
  if (!p.length) return '';
  const lo = priceBand(p[Math.floor((p.length - 1) * 0.25)]);
  const hi = priceBand(p[Math.ceil((p.length - 1) * 0.75)]);
  return lo === hi ? `${lo}が中心` : `${lo}〜${hi}が中心`;
};
const weekNew = (list) => list.filter((i) => i.first && nowMs - Date.parse(i.first) <= 7 * DAY).length;
const CAT_SHORT = { nuigurumi: 'ぬいぐるみ', keyholder: 'キーホルダー', bunbougu: '文房具', shokki: '食器', bag: 'バッグ', smartphone: 'スマホグッズ', fashion: '服', nichiyouhin: '日用品', okashi: 'お菓子', omocha: 'おもちゃ', hon: '本' };
const topCats = (list, n = 2) => {
  const count = {};
  for (const i of list) if (CAT_SHORT[i.cat]) count[i.cat] = (count[i.cat] ?? 0) + 1;
  return Object.entries(count)
    .filter(([, k]) => k >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([k]) => CAT_SHORT[k]);
};
const joinTo = (a) => (a.length > 1 ? `${a.slice(0, -1).join('、')}と${a.at(-1)}` : a[0] ?? '');
// 「10/26までの7日で見つけた新着は48件」。ないときは、いちばん新しく見つけた日
const newsLine = (list, label = '新着') => {
  const n = weekNew(list);
  if (n) return `${TODAY_MD}までの7日で見つけた${label}は${n}件`;
  return list.length ? `いちばん新しく見つけたのは${jstMonthDay(list.map((i) => i.first).sort().at(-1))}` : '';
};
const mixLine = (list) => {
  const cats = topCats(list);
  const band = priceMid(list);
  return [cats.length ? `多いのは${joinTo(cats)}` : '', band ? `値段は${band}` : ''].filter(Boolean).join('で、');
};
const sentence = (...parts) => parts.filter(Boolean).map((x) => (/[。]$/.test(x) ? x : `${x}。`)).join('');

// ---- 推し×種類のしおり ----
// 推しキャラのページの見出しのすぐ下に、商品が3件以上ある種類を並べる。えらぶと、その種類のグッズを全部出す（ブラウザの中だけ。URL は #種類）。
// わたしの推しにしている推しキャラなら、えらんだ種類を覚えて、トップの「わたしの推し」にもその種類だけを並べる
function shioriNav(list) {
  const cats = CATEGORIES.filter((k) => list.filter((i) => i.cat === k.slug).length >= 3);
  if (cats.length < 2) return '';
  return `<nav class="cats shiori" aria-label="種類"><ul><li><a href="#" data-c="" aria-current="true">すべて</a></li>${cats
    .map((k) => `<li><a href="#${k.slug}" data-c="${k.slug}">${esc(k.name)}</a></li>`)
    .join('')}</ul></nav>`;
}

// ---- わたしの推し・前に見てから ----
// 推しキャラのページの「わたしの推し」ボタン。押すと、その推しキャラの新着がトップの「わたしの推し」に並ぶ（3人まで）。
// 保存するのは、見ている端末のブラウザの中（localStorage）に、推しキャラのページの場所・名前と、前に見た時刻だけ。サイトや楽天には送らない
const myButton = (path, name) => `<p class="myp"><button type="button" class="myb" data-p="${esc(path)}" data-n="${esc(name)}" aria-pressed="false" hidden>わたしの推し</button></p>`;
// 動きは src/my.js（前に見た時刻・推し×種類のしおり・わたしの推しのボタン・トップの棚）
const MY_JS = `<script>${readFileSync('src/my.js', 'utf8')
  .split('\n')
  .filter((l) => !/^\s*\/\//.test(l))
  .map((l) => l.trim())
  .filter(Boolean)
  .join('\n')}</script>`;

// ---- 発売日（楽天ブックス） ----
const MIN_CAL = 3; // 発売日カレンダーを作る最低件数
function calendarFor(slug) {
  const mine = books.items.filter((b) => b.c === slug && b.url && b.img);
  return {
    upcoming: mine.filter((b) => b.date.ymd >= today).sort((a, b) => a.date.ymd.localeCompare(b.date.ymd) || a.name.localeCompare(b.name)),
    recent: mine.filter((b) => b.date.ymd < today).sort((a, b) => b.date.ymd.localeCompare(a.date.ymd) || a.name.localeCompare(b.name)),
  };
}
const releaseNote = (b) => {
  const otherYear = !b.date.year && b.date.ymd.slice(0, 4) !== today.slice(0, 4) ? `${Number(b.date.ymd.slice(0, 4))}年` : '';
  const when = b.date.year ? b.date.label : `${otherYear}${b.date.label}${b.date.exact && b.date.approx ? '頃' : ''}`;
  return `${when}発売${b.kind ? `・${b.kind}` : ''}`;
};
function bookCell(b, eager) {
  return cardHtml(b, { tag: b.avail === 5 ? '予約' : '', note: releaseNote(b), eager, shop: b.maker, go: '楽天ブックスで見る', size: 120 });
}
const bookGrid = (list, eagerFirst = false) => `<ul class="grid">${list.map((b, i) => bookCell(b, eagerFirst && i < 4)).join('')}</ul>`;
// 楽天ブックスで予約受付中のグッズ（おもちゃと、カレンダー・手帳）。これから発売のものだけ、発売日の順
const isGoodsBook = (b) => b.kind === 'おもちゃ' || /カレンダー|手帳|ダイアリー/.test(b.name);
const booksYoyaku = (slug) =>
  books.items
    .filter((b) => (!slug || b.c === slug) && b.avail === 5 && b.url && b.img && isGoodsBook(b) && (b.date.exact ? b.date.ymd >= today : b.date.month >= today.slice(0, 7)))
    .sort((a, b) => a.date.ymd.localeCompare(b.date.ymd) || a.name.localeCompare(b.name));
// 作品ごとの予約受付中：楽天市場（締切・販売期間が近い順）と楽天ブックス（発売日の順）
const yoyakuFor = (slug) => {
  const market = listsFor(slug).yoyaku;
  const bk = booksYoyaku(slug);
  return { market, books: bk, total: market.length + bk.length };
};
// カレンダーの見出し：月がわかるものは「2026年11月」、季節・年だけのものは「2027年春」
const groupOf = (b) => (b.date.year ? b.date.label : `${Number(b.date.month.slice(0, 4))}年${Number(b.date.month.slice(5, 7))}月`);

// ---- 推しキャラのページ（/作品/推しキャラ/）。商品名に推しキャラの名前が入っているもの ----
const oshiPages = chars.flatMap((c) =>
  (c.oshi ?? [])
    .filter((o) => o.slug)
    .map((o) => {
      const hit = oshiMatcher(o);
      return { c, o, label: o.full ?? o.name, items: buyable.filter((i) => i.c === c.slug && hit(i.name)).sort(byNew), ranked: rankedFor(c.slug).filter((r) => hit(r.name)) };
    })
    .filter((p) => p.items.length >= MIN_OSHI),
);
const oshiPageSet = new Set(oshiPages.map((p) => `${p.c.slug}/${p.o.slug}`));
const oshiHref = (c, o) => (o.slug && oshiPageSet.has(`${c.slug}/${o.slug}`) ? `/${c.slug}/${o.slug}/` : searchHref({ c: c.slug, q: o.name }));

// ---- 季節の特集（期間中だけ。商品名に季節の言葉が入っているもの） ----
const seasonActive = activeSeasons(seasons, today);
const seasonPages = seasonActive
  .map((s) => {
    const hit = seasonMatcher(s);
    const works = chars
      .map((c) => ({ c, items: buyable.filter((i) => i.c === c.slug && hit(i.name)).sort(byNew) }))
      .filter((w) => w.items.length >= MIN_SEASON);
    return { s, works };
  })
  .filter((x) => x.works.length);

// 一度できた季節の特集のページ（作品ごと・まとめ）は、期間が過ぎても消さずに、次の期間を知らせるページで残す。
// 毎年同じ URL を使うので、ブックマークや検索から来た人が「見つかりません」にならない。期間外は検索に出さない（noindex,follow）。
// 記録は data/season-seen.json（見本データのときは test/fixture-season-seen.json を読み、書かない）
const SEASON_SEEN = 'data/season-seen.json';
const seasonSeen = readJson(process.env.DATA_LATEST ? 'test/fixture-season-seen.json' : SEASON_SEEN, {});
const nextSeasonSeen = {};
const seasonLater = seasons
  .map((s) => {
    const sp = seasonPages.find((x) => x.s.slug === s.slug);
    const cur = new Set((sp?.works ?? []).map((w) => w.c.slug));
    const seen = chars.filter((c) => cur.has(c.slug) || (seasonSeen[s.slug] ?? []).includes(c.slug));
    // 買える商品がない日の作品（chars から外した作品）も、前の記録は残す（1回取れなかっただけで消さない）
    const keep = (seasonSeen[s.slug] ?? []).filter((x) => noItemWorks.some((c) => c.slug === x));
    if (seen.length || keep.length) nextSeasonSeen[s.slug] = [...seen.map((c) => c.slug), ...keep];
    const act = seasonActive.find((x) => x.slug === s.slug);
    const hit = act ? seasonMatcher(act) : null;
    return {
      s: act ?? s,
      active: !!act,
      // 期間中でも6件にとどかない作品（few）と、期間外の作品（rest）
      works: seen
        .filter((c) => !cur.has(c.slug))
        .map((c) => ({ c, items: hit ? buyable.filter((i) => i.c === c.slug && hit(i.name)).sort(byNew) : [] })),
      hub: !sp && seen.length > 0,
      seen,
    };
  })
  .filter((x) => x.works.length || x.hub);

// ---- ご当地グッズ（商品名に「ご当地」か「（地名）限定」があるもの。地方ごと） ----
const MIN_GOTOUCHI = 6;
const gotouchiWorks = chars
  .map((c) => {
    const items = buyable.filter((i) => i.c === c.slug && isGotouchi(i.name)).map((i) => ({ ...i, region: regionOf(i.name) }));
    return { c, items: [...items].sort((a, b) => (a.region?.order ?? 99) - (b.region?.order ?? 99) || byNew(a, b)), newest: [...items].sort(byNew) };
  })
  .filter((w) => w.items.length >= MIN_GOTOUCHI);
const hasGotouchi = (slug) => gotouchiWorks.some((w) => w.c.slug === slug);
// キャラだけのご当地の一覧（characters.json の gotouchiSub。サンリオのご当地キティ）：作品のご当地の中で、商品名にキャラの名前があるもの
const gotouchiSubs = gotouchiWorks
  .flatMap((w) =>
    (w.c.gotouchiSub ?? []).map((sub) => {
      const hit = oshiMatcher(sub);
      return { w, sub, items: w.items.filter((i) => hit(i.name)), newest: w.newest.filter((i) => hit(i.name)) };
    }),
  )
  .filter((x) => x.items.length >= MIN_GOTOUCHI);
const subPath = (x) => `/${x.w.c.slug}/gotouchi/${x.sub.slug}/`;
// 多い地名（ページの名前に使う）
const topPlaces = (items, n = 3) => {
  const count = {};
  for (const i of items) if (i.region) count[i.region.pref] = (count[i.region.pref] ?? 0) + 1;
  return Object.entries(count)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([k]) => k);
};

// ---- 推しキャラの誕生日（公式の誕生日があるキャラだけ） ----
const birthdays = chars
  .flatMap((c) =>
    (c.oshi ?? [])
      .filter((o) => o.birthday)
      .map((o) => {
        const hit = oshiMatcher(o);
        return { c, o, ...nextBirthday(o.birthday, today), items: buyable.filter((i) => i.c === c.slug && hit(i.name)).sort(byNew) };
      }),
  )
  .sort((a, b) => a.days - b.days || a.o.name.localeCompare(b.o.name));
const birthdayTitle = (b) => (b.days === 0 ? `今日は${b.o.name}の誕生日` : `もうすぐ${b.o.name}の誕生日（${mdLabel(b.o.birthday)}）`);

// 予算で選ぶ（作品ごと）
const BANDS = [
  { name: '1,000円以下', min: 0, max: 1000 },
  { name: '3,000円まで', min: 1001, max: 3000 },
  { name: '5,000円まで', min: 3001, max: 5000 },
];
const bandsFor = (slug) =>
  BANDS.map((b) => ({ ...b, items: buyable.filter((i) => i.c === slug && i.price >= b.min && i.price <= b.max).sort(byReviews) })).filter(
    (b) => b.items.length >= MIN_CAT,
  );
const hasYosan = (slug) => bandsFor(slug).length >= 2;

// ---- 作品ならではの話題（映画など。config/topics.json。until を過ぎたらなくなる） ----
const topicPages = topics
  .filter((t) => !t.until || today <= t.until)
  .map((t) => {
    const c = chars.find((x) => x.slug === t.work);
    const words = t.words.map(normalize);
    return { t, c, items: c ? buyable.filter((i) => i.c === c.slug && words.some((w) => normalize(i.name).includes(w))).sort(byNew) : [] };
  })
  .filter((x) => x.c && x.items.length >= MIN_SEASON);

// ---- 人気ランキング・大人向け・子ども向け（作品ごと） ----
const MIN_PICK = 8;
const reviewed = (slug) => buyable.filter((i) => i.c === slug && i.reviews >= 5).sort(byReviews);
const hasRanking = (slug) => rankedFor(slug).length + reviewed(slug).length >= MIN_SEASON;
const adultFor = (slug) => buyable.filter((i) => i.c === slug && isAdult(i.name)).sort(byReviews);
const kidsFor = (slug) => buyable.filter((i) => i.c === slug && isKids(i.name)).sort(byReviews);
// カテゴリごとに分ける（見出しつき）
const byCategory = (list, limit) =>
  [...CATEGORIES.map((k) => ({ name: k.name, items: list.filter((i) => i.cat === k.slug) })), { name: 'そのほか', items: list.filter((i) => !i.cat) }]
    .filter((g) => g.items.length)
    .map((g, i) => section(g.name, g.items.slice(0, limit), { eager: i === 0 }))
    .join('');
// 商品名によく出てくる種類（ページの名前に使う）
const SHOW = { tシャツ: 'Tシャツ', iphoneケース: 'iPhoneケース', iphone: 'iPhone', switch: 'Switch' };
function topWords(list, words, exclude = '', n = 3) {
  const count = words
    .filter((w) => !normalize(exclude).includes(normalize(w)))
    .map((w) => [w, list.filter((i) => normalize(i.name).includes(normalize(w))).length])
    .filter(([, k]) => k >= 2)
    .sort((a, b) => b[1] - a[1]);
  const out = [];
  for (const [w] of count) if (!out.some((x) => normalize(x).includes(normalize(w)) || normalize(w).includes(normalize(x)))) out.push(w);
  return out.slice(0, n).map((w) => SHOW[w] ?? w);
}
const ADULT_SHOW = ['財布', 'キーケース', 'パスケース', 'カードケース', '腕時計', 'ネックレス', 'ピアス', 'イヤリング', 'タンブラー', 'マグカップ', 'グラス', '食器', 'プレート', 'ルームウェア', 'インテリア', 'エコバッグ', 'トートバッグ', 'ハンカチ', 'ブランケット'];

// 発売日カレンダーがある作品（いちばん下のリンクにも使う）
// 買い方メモ（src/kaikata/<作品>.json があるとき）
const hasKaikata = (slug) => existsSync(`src/kaikata/${slug}.json`);
const hasCalendar = (c) => {
  const cal = calendarFor(c.slug);
  return cal.upcoming.length + cal.recent.length >= MIN_CAL;
};
const calChars = chars.filter(hasCalendar);
// カレンダーの名前に入れる年月（今月と来月）
const [ty, tm] = today.split('-').map(Number);
const calMonths = tm === 12 ? `${ty}年12月・${ty + 1}年1月` : `${ty}年${tm}月・${tm + 1}月`;

// ---- ページの枠 ----
const pages = []; // { path, html, lastmod }

// deco：ページ全体を季節（や誕生日）のデコにする。decoParts：一部分だけデコを使う季節
// ads：楽天の広告（バナー・広告の表示・クレジット）を出すか。YouTube のデータがあるページは出さない（YouTube API サービスの決まり III.G.1.d）
// noindex：true は検索に出さずリンクもたどらせない（探す）、'follow' は検索に出さないがリンクはたどってもらう（商品が少ないページ）
// count：そのページの商品の数。12件より少ない日が7日続いたら noindex,follow（indexable）
// サイトの目次（ヘッダーの「目次」とフッターに同じものを出す）。コーナーごとの作品と、全体のページ
function tocGroups() {
  return [cornerBySlug.get('chara'), ...liveCorners]
    .filter(Boolean)
    .map((k) => {
      // ページのある作品だけ（買える商品がない作品は chars から外してある）
      const ws = worksIn(k.slug);
      if (!ws.length) return '';
      return `<div class="tg"><p class="tgh"><a href="${cornerHref(k.slug)}">${esc(k.title || k.name)}</a></p><p>${ws.map((c) => `<a href="/${c.slug}/">${esc(c.name)}</a>`).join('／')}</p></div>`;
    })
    .join('');
}
// ページの種類（見た目の案が形を変えるための目印。<html data-pg="…">）
function pageKind(path) {
  if (path === '/') return 'top';
  const seg = path.split('/').filter(Boolean);
  if (seg[0] === 'yomimono') return 'yomi';
  if (cornerBySlug.has(seg[0]) && seg.length === 1) return 'corner';
  if (['search', 'koushiki'].includes(seg[0])) return seg[0];
  if (workSlugs.has(seg[0])) {
    if (seg.length === 1) return 'work';
    if (seg[1] === 'kaikata') return 'kaikata';
    if (oshiPageSet.has(`${seg[0]}/${seg[1]}`)) return 'oshi';
    return 'list';
  }
  return 'page';
}
function page({ path, title, description, h1, lead = '', body, tab = '', corner = '', crumbs = [], lastmod = '', extraLd = [], noindex = false, deco = '', decoParts = [], mainClass = '', ads = true, count = null, ogImage = '' }) {
  if (count !== null && !noindex && !indexable(path, count)) noindex = 'follow';
  const url = `${SITE}${path}`;
  const link = (t) => `<a href="${t.href}"${t.key === tab ? ' aria-current="page"' : ''}>${esc(t.label)}</a>`;
  // しくみ（トップ・探す）は右上の札、作品（キャラ）は手帳のインデックスのタブ
  const fn = [
    { href: '/', label: 'トップ', key: 'top' },
    { href: '/search/', label: '探す', key: 'search' },
    { href: '/koushiki/', label: '公式', key: 'koushiki' },
  ]
    .map(link)
    .join('');
  // コーナー：作品のページはその作品のコーナー、コーナーのトップはそのコーナー。全体のページ（探す・特集など）はキャラのタブを出す
  const cn = corner || cornerOfTab(tab);
  const tabs = worksIn(cn || 'chara').map((c) => link({ href: `/${c.slug}/`, label: c.name, key: c.slug })).join('');
  const cornerNav = liveCorners.length
    ? `<nav class="corners" aria-label="コーナー">${[cornerBySlug.get('chara'), ...liveCorners]
        .map((k) => `<a href="${cornerHref(k.slug)}"${k.slug === cn ? ` aria-current="${path === cornerHref(k.slug) ? 'page' : 'true'}"` : ''}>${esc(k.name)}</a>`)
        .join('')}</nav>`
    : '';
  const bodyClass = [deco && `dk s-${deco}`, cn && cn !== 'chara' && `cn-${cn}`].filter(Boolean).join(' ');
  const bannerTemplates = ads ? banners.map((b) => `<template class="bnt">${b}</template>`).join('') : '';

  const ld = [...extraLd];
  // パンくずは、タブだけでは場所がわからない深いページだけに出す
  if (crumbs.length > 2) {
    ld.push({
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE}${c.path}` })),
    });
  }
  const crumbHtml =
    crumbs.length > 2
      ? `<nav class="crumbs" aria-label="現在地">${crumbs
          .map((c, i) => (i === crumbs.length - 1 ? `<span>${esc(c.name)}</span>` : `<a href="${c.path}">${esc(c.name)}</a>`))
          .join('／')}</nav>`
      : '';

  const verify = [
    production && settings.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(settings.googleSiteVerification)}">` : '',
    production && settings.bingSiteVerification ? `<meta name="msvalidate.01" content="${esc(settings.bingSiteVerification)}">` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const tocHtml = `${tocGroups()}
${calChars.some((c) => c.corner === (cn || 'chara')) ? `<p class="fl">発売日カレンダー　${calChars.filter((c) => c.corner === (cn || 'chara')).map((c) => `<a href="/${c.slug}/hatsubai/">${esc(c.name)}</a>`).join('／')}</p>` : ''}
${gotouchiWorks.length || seasonPages.length ? `<p class="fl">特集　${[...(gotouchiWorks.length ? ['<a href="/gotouchi/">ご当地グッズ</a>'] : []), ...seasonPages.map(({ s }) => `<a href="/${s.slug}/">${esc(s.name)}</a>`)].join('／')}</p>` : ''}
<p>${yomiArticles.length ? '<a href="/yomimono/">推し活の読みもの</a>／' : ''}<a href="/koushiki/">公式の最新情報</a>／<a href="/calendar/">推し活カレンダー</a>／${birthdays.length ? '<a href="/tanjoubi/">推しキャラの誕生日</a>／' : ''}<a href="/about/">このサイトについて</a>／<a href="/terms/">利用規約</a>／<a href="/privacy/">プライバシーポリシー</a></p>`;
  const html = `<!doctype html>
<html lang="ja" data-pg="${pageKind(path)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="format-detection" content="telephone=no">
<link rel="preconnect" href="https://thumbnail.image.rakuten.co.jp">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
${production && !noindex ? `<link rel="canonical" href="${esc(url)}">\n<meta name="robots" content="max-image-preview:large">` : `<meta name="robots" content="${production && noindex === 'follow' ? 'noindex,follow' : 'noindex,nofollow'}">`}
${verify}
<meta property="og:site_name" content="${esc(settings.siteName)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="${path === '/' ? 'website' : 'article'}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:locale" content="ja_JP">
<meta property="og:image" content="${ogImage ? `${SITE}${ogImage}` : `${SITE}/og.png?v=${OG_V}`}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(ogImage ? h1 : settings.siteName)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#FBD3E2">
<link rel="icon" href="/favicon.ico?v=${ICON_V}" sizes="48x48">
<link rel="icon" href="/favicon.svg?v=${ICON_V}" type="image/svg+xml">
<link rel="icon" href="/icon-192.png?v=${ICON_V}" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${ICON_V}">
<link rel="manifest" href="/manifest.webmanifest">
${ld.length ? `<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, '\\u003c')}</script>` : ''}
<style>${css}${decoCss([...new Set([deco, ...decoParts].filter(Boolean))], decoStyle)}</style>
</head>
<body${bodyClass ? ` class="${bodyClass}"` : ''}>
<header class="hd wrap">
<div class="hdr"><a class="logo" href="/"><img src="/logo.svg" width="176" height="34" alt="${esc(settings.siteName)}"></a><nav class="fn" aria-label="しくみ">${fn}</nav><details class="menu"><summary>目次</summary><div class="menu-in">${tocHtml}</div></details></div>
${cornerNav}
<nav class="tabs" aria-label="作品">${tabs}</nav>
</header>
<main class="sheet wrap${mainClass ? ` ${mainClass}` : ''}">
${crumbHtml}
${deco ? `<div class="h1w"><h1 class="tape">${esc(h1)}</h1><span class="stk stk-2" aria-hidden="true"></span></div><span class="stk stk-1" aria-hidden="true"></span><span class="stk stk-3" aria-hidden="true"></span>` : `<h1 class="tape">${esc(h1)}</h1>`}
${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
${body.replaceAll('<!--asof-->', '').replaceAll('<!--asof-books-->', '')}${body.includes('<!--asof-->') ? `<p class="asof end">${jstMonthDayTime(meta.fetchedAt)} 時点の価格</p>` : ''}${body.includes('<!--asof-books-->') ? `<p class="asof end">${jstMonthDayTime(books.fetchedAt)} 時点の情報</p>` : ''}
</main>
<footer class="ft wrap">
<nav class="stoc" aria-label="サイトの目次">${tocHtml}</nav>
<p>個人が運営する非公式のまとめサイトで、権利者・楽天とは関係ありません。</p>
${ads ? `<p class="ad"><b>広告</b>楽天アフィリエイトを利用しています</p>
<div class="bn" id="bn"></div>
${bannerTemplates}
<div class="credit">${credit}</div>` : ''}
</footer>
<script>(function(){var n=Date.now(),t=new Date(n+324e5).toISOString().slice(0,10);document.querySelectorAll('[data-dl]').forEach(function(e){var d=Math.round((Date.parse(e.getAttribute('data-dl'))-Date.parse(t))/864e5);if(d<0)e.remove();else if(d<=7)e.textContent+=d===0?'（今日まで）':'（あと'+d+'日）';});document.querySelectorAll('[data-until]').forEach(function(e){if(Date.parse(e.getAttribute('data-until'))<n)e.remove();});})();</script>
<script>(function(){var a=document.querySelector('.tabs [aria-current]');if(a&&a.scrollIntoView)a.scrollIntoView({block:'nearest',inline:'center'});})();</script>
${MY_JS}
${ads ? `<script>(function(){var t=document.querySelectorAll('template.bnt');if(!t.length)return;var n=t[Math.floor(Math.random()*t.length)];document.getElementById('bn').appendChild(n.content.cloneNode(true));})();</script>` : ''}
</body>
</html>
`;
  pages.push({ path, html, lastmod, noindex });
}

const fileOf = (path) => (path.endsWith('/') ? `${path.slice(1)}index.html` : path.slice(1));

// もうすぐ発売（楽天ブックスの発売日）
function soonBooks(c) {
  const cal = calendarFor(c.slug);
  if (!cal.upcoming.length) return '';
  const more = hasCalendar(c) ? `<p class="more"><a href="/${c.slug}/hatsubai/">発売日カレンダーを見る</a></p>` : '';
  return `<section><h2>もうすぐ発売</h2>${bookGrid(cal.upcoming.slice(0, settings.topItems))}${more}</section>`;
}

function topSoonBooks(n = 4) {
  const list = chars
    .flatMap((c) => calendarFor(c.slug).upcoming.filter((b) => b.date.exact && !topShown.has(b.code)))
    .sort((a, b) => a.date.ymd.localeCompare(b.date.ymd));
  if (!list.length) return '';
  const links = calChars
    .map((c) => `<a href="/${c.slug}/hatsubai/">${esc(c.name)}の発売日カレンダー</a>`)
    .join('／');
  return `<section><h2>もうすぐ発売</h2>${bookGrid(list.slice(0, n))}${links ? `<p class="more">${links}</p>` : ''}</section>`;
}

// ---- 入荷メモ（作品のトップ）：このサイトの記録から、その作品だけの事実を短い文で。件数は出さない ----
// 記録（data/state.json）は商品名を持たず、作品・種類（k）・見つけた時・売り切れを見た時・値段の動きだけ
const stateItems = readJson(process.env.DATA_STATE ?? (process.env.DATA_LATEST ? 'test/fixture-state.json' : 'data/state.json'), { items: {} }).items;
const MEMO_MAX = 5; // メモの行の上限
const MEMO_TREND_DAYS = 28; // 記録がこの日数たまってから「その前の3週間より多い」を出す
const MEMO_SOLD_DAYS = 21; // 記録がこの日数たまってから「見つけてから売り切れるまで」を出す
const MEMO_SOLD_MIN = 10; // 種類ごとに、これだけ売り切れを見たものがあるときだけ
const MEMO_PRICE_MIN = 12; // 値段の幅は、これだけある種類だけ
const recByWork = new Map();
for (const r of Object.values(stateItems)) {
  if (!recByWork.has(r.c)) recByWork.set(r.c, []);
  recByWork.get(r.c).push(r);
}
// 多い種類（2件以上の種類だけ。多い順）
const catSlugs = (list, n, key = (i) => i.cat) => {
  const count = {};
  for (const i of list) if (CAT_SHORT[key(i)]) count[key(i)] = (count[key(i)] ?? 0) + 1;
  return Object.entries(count)
    .filter(([, k]) => k >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([k]) => k);
};
const median0 = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[s.length >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
function memoLines(c, L, Y) {
  const base = `/${c.slug}/`;
  const catPage = new Set(L.cats.map((k) => k.slug));
  const catLink = (k) => (catPage.has(k) ? `<a href="${base}${k}/">${esc(CAT_SHORT[k])}</a>` : esc(CAT_SHORT[k]));
  const recs = recByWork.get(c.slug) ?? [];
  const start = recs.length ? Math.min(...recs.map((r) => Date.parse(r.first))) : nowMs;
  const span = (nowMs - start) / DAY;
  const lines = [];

  // ここ1週間に多い種類（記録が4週間たまってから。その前の3週間の1週間あたりとくらべて1.5倍以上）
  if (span >= MEMO_TREND_DAYS) {
    const wk = {}, before = {};
    for (const r of recs) {
      if (!CAT_SHORT[r.k]) continue;
      const age = (nowMs - Date.parse(r.first)) / DAY;
      if (age <= 7) wk[r.k] = (wk[r.k] ?? 0) + 1;
      else if (age <= MEMO_TREND_DAYS) before[r.k] = (before[r.k] ?? 0) + 1;
    }
    const up = Object.keys(wk)
      .filter((k) => wk[k] >= 6 && before[k] && wk[k] >= ((before[k] * 7) / (MEMO_TREND_DAYS - 7)) * 1.5)
      .sort((a, b) => wk[b] - wk[a])
      .slice(0, 2);
    if (up.length) lines.push(`${joinTo(up.map(catLink))}の入荷が、その前の3週間より多い`);
  }
  // 見つけてから初めて売り切れを見るまでの日数（記録が3週間たまってから。記録を始めて2日より後に見つけたものだけ）
  if (span >= MEMO_SOLD_DAYS) {
    const days = {};
    for (const r of recs) {
      if (!CAT_SHORT[r.k] || !r.out1) continue;
      const f = Date.parse(r.first);
      const d = (Date.parse(r.out1) - f) / DAY;
      if (f - start < 2 * DAY || d < 1 / 24) continue;
      (days[r.k] ??= []).push(d);
    }
    const fast = Object.entries(days)
      .filter(([, a]) => a.length >= MEMO_SOLD_MIN)
      .map(([k, a]) => [k, median0(a)])
      .filter(([, m]) => m <= 14)
      .sort((a, b) => a[1] - b[1])[0];
    if (fast) lines.push(`${catLink(fast[0])}は、見つけてから売り切れるまでが短め（まんなかで${Math.max(1, Math.round(fast[1]))}日ほど）`);
  }
  // この7日の新着に多い種類
  const wkNew = catSlugs(L.news.filter((i) => nowMs - Date.parse(i.first) <= RECENT), 2);
  if (wkNew.length) lines.push(`この7日の新着は、${joinTo(wkNew.map(catLink))}が多め`);
  // 値段の幅（多い種類2つ）
  const big = L.cats.filter((k) => CAT_SHORT[k.slug] && k.items.length >= MEMO_PRICE_MIN).sort((a, b) => b.items.length - a.items.length).slice(0, 2);
  if (big.length) {
    const parts = big.map((k) => `${catLink(k.slug)}は${priceMid(k.items)}`);
    lines.push(parts.length > 1 ? `${parts[0].replace(/が中心$/, '')}、${parts[1]}` : parts[0]);
  }
  // 値下がり・再入荷（この7日に、このサイトが確かめたもの）
  const dropLabel = L.nesage.length >= MIN_PAGE ? `<a href="${base}nesage/">値下がり</a>` : '値下がり';
  const dropCats = catSlugs(L.nesage, 2);
  if (dropCats.length) lines.push(`この7日の${dropLabel}は、${joinTo(dropCats.map(catLink))}に多い`);
  else if (L.nesage.length) lines.push(`この7日に、前より安くなったものを見つけた`);
  const restockLabel = L.sainyuka.length >= MIN_PAGE ? `<a href="${base}sainyuka/">再入荷</a>` : '再入荷';
  const restockCats = catSlugs(L.sainyuka, 1);
  if (restockCats.length) lines.push(`売り切れからの${restockLabel}は、${catLink(restockCats[0])}に多い`);
  // 予約の締切（商品名に書いてあるもの）
  const dl = Y.market.filter((i) => i.resv.deadline && i.resv.deadline >= today).sort((a, b) => a.resv.deadline.localeCompare(b.resv.deadline))[0];
  if (dl) {
    const label = Y.total >= MIN_PAGE ? `<a href="${base}yoyaku/">予約</a>` : '予約';
    lines.push(`${label}の締切がいちばん近いのは${mdOfYmd(dl.resv.deadline)}${CAT_SHORT[dl.cat] ? `（${esc(CAT_SHORT[dl.cat])}）` : ''}`);
  }
  // 発売日（楽天ブックス。日にちが決まっているもの）
  const next = calendarFor(c.slug).upcoming.find((b) => b.date.exact);
  if (next) lines.push(`楽天ブックスで次に発売日が来るのは${mdOfYmd(next.date.ymd)}${hasCalendar(c) ? `（<a href="${base}hatsubai/">発売日カレンダー</a>）` : ''}`);
  return lines.slice(0, MEMO_MAX);
}
function memoSection(c, L, Y) {
  const lines = memoLines(c, L, Y);
  if (lines.length < 2) return '';
  return `<section class="memo"><h2>入荷メモ</h2><ul>${lines.map((t) => `<li>${t}。</li>`).join('')}</ul><p class="asof">${TODAY_MD}までに、このサイトが楽天市場で見つけた商品の記録から</p></section>`;
}

// 推しキャラのボタン（推しキャラのページへ。ページがないキャラは、その場で楽天市場から探す）
function oshiSection(list, current = '') {
  const chips = list.map((c) => oshiChipsHtml(c, { heading: list.length > 1, pages: oshiPageSet, current })).join('');
  return chips ? `<section class="oshi"><h2>推しキャラ</h2>${chips}</section>` : '';
}

// 季節の特集の入口（トップ）：作品ごとに順に1件ずつ、4件
function seasonTeaser({ s, works }, eager, n = 4) {
  const picks = [];
  for (let i = 0; picks.length < n && i < settings.topItems; i++) for (const w of works) if (w.items[i] && picks.length < n) picks.push(w.items[i]);
  return `<section class="dks s-${s.slug}"><div class="hw"><h2>${esc(s.label)}</h2><span class="stk stk-2" aria-hidden="true"></span></div>${grid(picks, eager)}<p class="more"><a href="/${s.slug}/">${esc(s.label)}をもっと見る</a></p></section>`;
}
// ご当地グッズの入口（トップ）：作品ごとに順に1件ずつ、4件
function gotouchiTeaser(n = 4) {
  if (!gotouchiWorks.length) return '';
  const picks = [];
  for (let i = 0; picks.length < n && i < settings.topItems; i++) for (const w of gotouchiWorks) if (w.newest[i] && picks.length < n) picks.push(w.newest[i]);
  return `<section class="dks s-gotouchi"><div class="hw"><h2>ご当地グッズ</h2><span class="stk stk-2" aria-hidden="true"></span></div>${grid(picks)}<p class="more"><a href="/gotouchi/">ご当地グッズを地域で選ぶ</a></p></section>`;
}
// 誕生日が近い推しキャラのグッズ
// filt：送料込み・ラッピング対応でしぼりこめるようにする（誕生日カレンダーのページ）
function birthdaySection(b, limit, eager = false, filt = false) {
  return `<section class="dks s-birthday"><div class="hw"><h2>${esc(birthdayTitle(b))}</h2><span class="stk stk-2" aria-hidden="true"></span></div>${filt ? filterGrid(b.items, { show: limit, pool: 24, eager }) : grid(b.items.slice(0, limit), eager)}<p class="more"><a href="${esc(oshiHref(b.c, b.o))}">${esc(b.o.name)}のグッズをもっと見る</a></p></section>`;
}

// 予約受付中（全作品。トップ用）：締切・販売期間が14日以内のもの → 発売・発送が近い順（楽天市場と楽天ブックス）。
// 発売の月が過ぎたものはトップには出さない
const topShown = new Set(); // トップの「予約受付中」に出した楽天ブックスの商品（「もうすぐ発売」には出さない）
function topYoyaku(n) {
  const market = buyable.filter((i) => i.resv).sort(byResv);
  const urgent = market.filter((i) => resvKey(i) !== '9999' && Date.parse(resvKey(i)) - nowMs <= 14 * DAY);
  const month = `${today.slice(0, 7)}-01`;
  const rest = [
    ...market.filter((i) => !urgent.includes(i) && i.resv.release >= month).map((i) => ({ d: i.resv.release, html: () => cell(i) })),
    ...booksYoyaku('').map((b) => ({ d: b.date.ymd, book: b.code, html: () => bookCell(b) })),
  ].sort((a, b) => a.d.localeCompare(b.d));
  const picked = [...urgent.map((i) => ({ html: () => cell(i) })), ...rest].slice(0, n);
  for (const x of picked) if (x.book) topShown.add(x.book);
  if (!picked.length) return '';
  const cards = picked.map((x) => x.html());
  const links = chars
    .filter((c) => yoyakuFor(c.slug).total >= MIN_PAGE)
    .map((c) => `<a href="/${c.slug}/yoyaku/">${esc(c.name)}の予約受付中</a>`)
    .join('／');
  return `<section><h2>予約受付中のグッズ</h2><ul class="grid">${cards.join('')}</ul>${links ? `<p class="more">${links}</p>` : ''}</section>`;
}

// 推しキャラのボタンを、作品ごとにたたんで出す（トップ用）
function oshiFolded(list) {
  return `<section class="oshi" id="oshi"><h2>推しキャラ</h2>${list
    .map((c) => `<details><summary>${esc(c.name)}</summary>${oshiChipsHtml(c, { heading: false, pages: oshiPageSet })}</details>`)
    .join('')}</section>`;
}

// ---- 読みもの（/yomimono/）：調べて書いた記事。図と、記事に合う楽天市場の棚（config/yomimono.json・src/yomimono/） ----
// 本文は src/yomimono/<記事>.html。<!--fig:名前--> は src/yomimono/fig/、<!--tool:名前--> は src/yomimono/tools/、<!--shelf:棚--> は楽天市場の棚に置きかえる
const yomiArticles = readJson('config/yomimono.json', []);
// 作品のページから読みものへの1行（記事の linkFrom：work の作品の gotouchi（ご当地の一覧の目次の上）・kaikata（買い方メモ）・top（作品のトップの入荷メモの下））
const yomiLinksFor = (slug, where) =>
  yomiArticles
    .filter((a) => a.linkFrom?.work === slug && a.linkFrom.pages?.includes(where))
    .map((a) => `<p class="more"><a href="/yomimono/${a.slug}/">${esc(a.linkFrom.text)}</a></p>`)
    .join('');
const yomiData = readJson(process.env.DATA_LATEST ? 'test/fixture-yomimono.json' : 'data/yomimono.json', { fetchedAt: '', items: [] });
const YOMI_SHELF_MAX = 8;
const yomiDate = (ymd) => `${Number(ymd.slice(0, 4))}年${Number(ymd.slice(5, 7))}月${Number(ymd.slice(8, 10))}日`;
function yomiBody(a) {
  let html = readFileSync(`src/yomimono/${a.slug}.html`, 'utf8');
  html = html.replace(/<!--fig:([a-z0-9-]+)-->/g, (_, n) => readFileSync(`src/yomimono/fig/${n}.html`, 'utf8').trim());
  html = html.replace(/<!--tool:([a-z0-9-]+)-->/g, (_, n) => readFileSync(`src/yomimono/tools/${n}.html`, 'utf8').trim());
  let shelves = 0;
  html = html.replace(/<!--shelf:([a-z0-9-]+)-->/g, (_, id) => {
    const sh = (a.shelves ?? []).find((x) => x.id === id);
    const list = yomiData.items.filter((i) => i.shelf === `${a.slug}/${id}` && i.avail !== 0).slice(0, YOMI_SHELF_MAX);
    if (!sh || !list.length) return '';
    shelves++;
    return `<section class="shelf"><h3>${esc(sh.label)}</h3><ul class="grid">${list
      .map((it, i) => {
        const m = marksFor(it, yomiData.fetchedAt || meta.fetchedAt);
        return cardHtml(it, { review: m.review, perks: m.perks, eager: false });
      })
      .join('')}</ul><p class="asof">楽天市場でレビューが多い順</p></section>`;
  });
  // もくじ：本文の h2（id のあるもの）から
  const heads = [...html.matchAll(/<h2 id="([a-z0-9-]+)">([^<]+)<\/h2>/g)];
  const toc = heads.length >= 3 ? `<nav class="toc" aria-label="もくじ"><h2>もくじ</h2><ol>${heads.map((m) => `<li><a href="#${m[1]}">${esc(m[2])}</a></li>`).join('')}</ol></nav>` : '';
  return { html, toc, shelves };
}
function yomiList(list) {
  return `<ul class="yomi-list">${list
    .map((a) => `<li><a href="/yomimono/${a.slug}/"><img src="/yomimono/img/${a.hero}.webp" width="1200" height="600" loading="lazy" decoding="async" alt=""><b>${esc(a.title)}</b><span>${esc(a.summary)}</span></a></li>`)
    .join('')}</ul>`;
}

// ---- トップ ----
{
  const names = shortNames;
  // トップの並べ方：now（いま）・shelf（横にすべらせる棚）・compact（数をしぼる）
  const layout = process.env.TOP_LAYOUT || settings.topLayout || 'now';
  const N = layout === 'shelf' ? { teaser: 8, work: 8, bday: 8, rank: 8, soon: 8, books: 8 } : layout === 'compact' ? { teaser: 2, work: 4, bday: 2, rank: 4, soon: 2, books: 2 } : { teaser: 4, work: settings.topPerWork ?? settings.topItems, bday: 4, rank: settings.topItems, soon: 4, books: 4 };
  const teasers = seasonPages.map((sp, i) => seasonTeaser(sp, i === 0, N.teaser)).join('');
  const bdays = birthdays.filter((b) => b.days <= BIRTHDAY_TOP && b.items.length >= 4).slice(0, 2);
  // 特集の目次（見出しのすぐ下のふせん）
  const idx = [
    ...seasonPages.map(({ s }) => [`/${s.slug}/`, s.name]),
    ...(gotouchiWorks.length ? [['/gotouchi/', 'ご当地']] : []),
    ...(birthdays.length ? [['/tanjoubi/', '誕生日']] : []),
    ['/calendar/', '推し活カレンダー'],
    ['#oshi', '推しキャラから探す'],
  ];
  const idxNav = layout === 'now' ? '' : `<nav class="cats idx" aria-label="特集"><ul>${idx.map(([h, t]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('')}</ul></nav>`;
  let first = !teasers;
  const sections = charaWorks
    .map((c) => {
      let s = section(`${c.name}グッズ新着`, listsFor(c.slug).news, { limit: N.work, more: `/${c.slug}/`, moreLabel: `${c.name}をもっと見る`, eager: first });
      if (s && first) s += priceAt();
      if (s) first = false;
      return s;
    })
    .join('');
  // ほかのコーナー（アニメ・ゲームなど）は、コーナーごとに新着の棚を1つずつ
  const cornerShelves = liveCorners
    .map((k) => section(`${k.title}の新着`, cornerNews(k.slug), { limit: N.work, more: cornerHref(k.slug), moreLabel: `${k.name}のコーナーへ` }))
    .join('');
  page({
    path: '/',
    tab: 'top',
    corner: 'chara',
    title: `${settings.siteName}｜${names}グッズの通販・新着まとめ`,
    // 作品が多くて長くなるときは、季節の特集の文を外す（説明文は120字くらいまで）
    description: (() => {
      const base = [`${allNames}${cornerList ? `と、${cornerList}の作品` : ''}のグッズを、楽天市場から1日2回集めています`, `${newsLine(buyable.filter((i) => !i.via))}、予約受付中は${chars.reduce((n, c) => n + yoyakuFor(c.slug).total, 0)}件です`];
      const sp = seasonPages.length > 1 ? `季節の特集は${seasonPages[0].s.name}や${seasonPages[1].s.name}など${seasonPages.length}つです` : seasonPages.length ? `季節の特集は${seasonPages[0].s.name}です` : '';
      const full = sentence(...base, sp);
      return [...full].length <= 120 ? full : sentence(...base);
    })(),
    h1: chars.length > 3 ? '推しキャラグッズの新着' : `${names}グッズの新着`,
    mainClass: layout === 'now' ? '' : `top ${layout}`,
    body:
      idxNav +
      '<section class="my" id="my" hidden><h2>わたしの推し</h2></section>' +
      (teasers ? teasers + priceAt() : '') +
      sections +
      cornerShelves +
      bdays.map((b) => birthdaySection(b, N.bday)).join('') +
      gotouchiTeaser(N.teaser) +
      rankSection('楽天のランキングに入っているグッズ', rankedFor(''), N.rank) +
      topYoyaku(N.soon) +
      topSoonBooks(N.books) +
      (yomiArticles.length ? `<section class="yomi"><h2>推し活の読みもの</h2>${yomiList(yomiArticles.slice(0, 2))}<p class="more"><a href="/yomimono/">読みものをすべて見る</a></p></section>` : '') +
      (layout === 'now' ? oshiSection(charaWorks) : oshiFolded(charaWorks)),
    decoParts: [...seasonPages.map(({ s }) => s.slug), ...(bdays.length ? ['birthday'] : []), ...(gotouchiWorks.length ? ['gotouchi'] : [])],
    lastmod: newest(buyable),
    extraLd: [{ '@context': 'https://schema.org', '@type': 'WebSite', name: settings.siteName, alternateName: settings.siteShortName, url: `${SITE}/`, inLanguage: 'ja' }],
  });
}

// ---- コーナーのトップ（/anime/ など。キャラのコーナーはサイトのトップ）。作品ごとに新着の棚 ----
// コーナーの読みもの（config/yomimono.json の記事に corner: "game" などを書いたもの）。サイトのトップの「推し活の読みもの」と同じ部品。ないときは出さない
const cornerYomi = (k) => {
  const list = yomiArticles.filter((a) => a.corner === k.slug);
  return list.length ? `<section class="yomi"><h2>${esc(k.name)}の読みもの</h2>${yomiList(list)}<p class="more"><a href="/yomimono/">読みものをすべて見る</a></p></section>` : '';
};
for (const k of liveCorners) {
  const ws = worksIn(k.slug);
  const news = cornerNews(k.slug);
  if (!news.length) continue;
  const set = new Set(ws.map((c) => c.slug));
  const yoyakuN = ws.reduce((n, c) => n + yoyakuFor(c.slug).total, 0);
  let first = true;
  const shelves = ws
    .map((c) => {
      let sec = section(`${c.name}グッズ新着`, listsFor(c.slug).news, { limit: 8, more: `/${c.slug}/`, moreLabel: `${c.name}をもっと見る`, eager: first });
      if (sec && first) sec += priceAt();
      if (sec) first = false;
      return sec;
    })
    .join('');
  // 説明文は120字くらいまで。長いときは種類と値段の文を外し、それでも長ければ作品名を3つ＋「など」に
  const desc = (() => {
    const head = (names) => `${names}のグッズを、楽天市場から1日2回集めています`;
    const nl = `${newsLine(news)}${yoyakuN ? `、予約受付中は${yoyakuN}件です` : ''}`;
    for (const d of [sentence(head(ws.map((c) => c.name).join('・')), nl, mixLine(news)), sentence(head(ws.map((c) => c.name).join('・')), nl), sentence(head(namesOf(ws)), nl, mixLine(news)), sentence(head(namesOf(ws)), nl)]) {
      if ([...d].length <= 120) return d;
    }
    return sentence(head(namesOf(ws)), nl);
  })();
  page({
    path: cornerHref(k.slug),
    tab: k.slug,
    corner: k.slug,
    title: `${k.title}の通販・新着まとめ（${namesOf(ws)}）｜${settings.siteName}`,
    description: desc,
    h1: `${k.title}の新着`,
    mainClass: 'top shelf',
    body: shelves + rankSection(`楽天のランキングに入っている${k.title}`, rankedFor('').filter((r) => set.has(r.c)), 8) + cornerYomi(k) + oshiFolded(ws),
    lastmod: newest(news),
    count: news.length,
  });
}

// 作品のページの「選び方」（人気ランキング・大人向け・子ども向け・予算・ご当地・話題・発売日カレンダー）
function chooseNav(c) {
  const base = `/${c.slug}/`;
  const links = [
    hasRanking(c.slug) && [`${base}ranking/`, '人気ランキング'],
    adultFor(c.slug).length >= MIN_PICK && [`${base}otona/`, '大人向け'],
    kidsFor(c.slug).length >= MIN_PICK && [`${base}kids/`, '子ども向け'],
    hasYosan(c.slug) && [`${base}yosan/`, '予算で選ぶ'],
    hasGotouchi(c.slug) && [`${base}gotouchi/`, `ご当地${c.name}一覧`],
    ...topicPages.filter((x) => x.c === c).map((x) => [`${base}${x.t.slug}/`, x.t.name]),
    hasCalendar(c) && [`${base}hatsubai/`, '発売日カレンダー'],
    hasKaikata(c.slug) && [`${base}kaikata/`, '買い方メモ'],
  ].filter(Boolean);
  return links.length ? `<nav class="cats" aria-label="選び方"><h2>選び方</h2><ul>${links.map(([h, t]) => `<li><a href="${h}">${esc(t)}</a></li>`).join('')}</ul></nav>` : '';
}

// ---- キャラごと ----
for (const c of chars) {
  const L = listsFor(c.slug);
  if (!L.all.length) continue;
  const base = `/${c.slug}/`;
  const crumbs = [{ name: 'トップ', path: '/' }, { name: c.name, path: base }];
  const sub = (key) => L[key].length >= MIN_PAGE;
  const Y = yoyakuFor(c.slug);
  // 予約受付中（楽天市場 → 楽天ブックス）
  const yoyakuHtml = Y.total
    ? `<section><h2>予約受付中</h2><ul class="grid">${[...Y.market.map((i) => cell(i)), ...Y.books.map((b) => bookCell(b))].slice(0, settings.topItems).join('')}</ul>${
        Y.total >= MIN_PAGE ? `<p class="more"><a href="${base}yoyaku/">予約受付中をすべて見る</a></p>` : ''
      }</section>`
    : '';

  const catNav = L.cats.length
    ? `<nav class="cats" aria-label="カテゴリ"><h2>カテゴリ</h2><ul>${L.cats
        .map((k) => `<li><a href="${base}${k.slug}/">${esc(k.name)}</a></li>`)
        .join('')}</ul></nav>`
    : '';

  const mySeasons = seasonPages.flatMap(({ s, works }) => works.filter((w) => w.c === c).map((w) => ({ s, items: w.items })));
  const seasonHtml = mySeasons
    .map(
      ({ s, items }) =>
        `<section class="dks s-${s.slug}"><div class="hw"><h2>${esc(s.label)}</h2><span class="stk stk-2" aria-hidden="true"></span></div>${grid(items.slice(0, 4))}<p class="more"><a href="${base}${s.slug}/">${esc(c.name)}の${esc(s.label)}をもっと見る</a></p></section>`,
    )
    .join('');
  page({
    path: base,
    tab: c.slug,
    decoParts: mySeasons.map(({ s }) => s.slug),
    crumbs,
    title: `${c.name}グッズの通販・新着まとめ（予約・再入荷・人気ランキング）｜${settings.siteName}`,
    description: sentence(`楽天市場の${c.name}グッズを1日2回集めています`, L.news.length ? `${newsLine(L.news)}、予約受付中は${Y.total}件です` : `作品名で見つけた新着は、この7日はありません。予約受付中は${Y.total}件です`, mixLine(L.all)),
    h1: `${c.name}グッズ新着`,
    body:
      oshiRow(c) +
      tagS(section('', L.news, { limit: settings.topItems, more: `${base}new/`, moreLabel: '新着をすべて見る', eager: true }), 'new') +
      priceAt() +
      catNav +
      chooseNav(c) +
      tagS(yoyakuHtml, 'yoyaku') +
      seasonHtml +
      tagS(rankSection('楽天のランキングに入っているもの', rankedFor(c.slug), settings.topItems), 'rank') +
      tagS(section('レビューが多いもの', L.all.filter((i) => i.reviews >= 5).sort(byReviews), { limit: settings.topItems }), 'review') +
      oshiSection([c]) +
      tagS(section('値下がり', L.nesage, { limit: settings.topItems, more: sub('nesage') ? `${base}nesage/` : '', moreLabel: '値下がりをすべて見る' }), 'nesage') +
      tagS(section('再入荷', L.sainyuka, { limit: settings.topItems, more: sub('sainyuka') ? `${base}sainyuka/` : '', moreLabel: '再入荷をすべて見る' }), 'sainyuka') +
      tagS(soonBooks(c), 'soon') +
      memoSection(c, L, Y) +
      yomiLinksFor(c.slug, 'top') +
      `<p class="more"><a href="/koushiki/#${esc(c.slug)}">${esc(c.name)}の公式の動画とお知らせ</a></p>` +
      tsugiWorks(c),
    lastmod: newest(L.news.length ? L.news : L.all),
  });

  const subPages = [
    { key: 'news', slug: 'new', name: '新着', h1: `${c.name}の新着グッズ`, title: `${c.name}の新着グッズ一覧`, lead: '', desc: (list) => sentence(`${c.name}のグッズを、楽天市場で見つけた新しい順に並べています`, `${newsLine(list, 'もの')}です`, mixLine(list)) },
    { key: 'nesage', slug: 'nesage', name: '値下がり', h1: `値下がりした${c.name}グッズ`, title: `値下がりした${c.name}グッズ`, lead: '前に確認した価格より安くなったものです', desc: (list) => {
      const max = Math.max(...list.map((i) => i.drop.from - i.price));
      const by = max >= 1000 ? `${(Math.floor(max / 1000) * 1000).toLocaleString('ja-JP')}円以上` : max >= 100 ? `${Math.floor(max / 100) * 100}円以上` : '';
      // 下がった幅が100円より小さいときは、ピッタリの金額を書かない（説明文の値段は幅で書く決まり）
      const drop = by ? `いちばん大きく下がったものは${by}安くなりました` : '下がった幅はどれも100円未満です';
      return sentence(`前に確認した価格より安くなった${c.name}グッズを並べています`, `この7日で値下がりを見つけたのは${list.length}件で、${drop}`, priceMid(list) ? `いまの値段は${priceMid(list)}です` : '');
    } },
    { key: 'sainyuka', slug: 'sainyuka', name: '再入荷', h1: `再入荷した${c.name}グッズ`, title: `再入荷した${c.name}グッズ`, lead: '売り切れから買えるようになったものです', desc: (list) =>
      sentence(`売り切れから買えるようになった${c.name}グッズを並べています`, `この7日で再入荷を見つけたのは${list.length}件で、いちばん新しいのは${jstMonthDay(list[0].restock)}です`, mixLine(list)) },
  ];
  for (const s of subPages) {
    const list = L[s.key];
    if (s.key !== 'news' && list.length < MIN_PAGE) continue;
    // 作品名で見つけた新着が0件の日：棚の場所に1行と、推しキャラ・種類のページへの道。検索には出さない（推しキャラの名前で見つけた物で埋めない）
    const empty = s.key === 'news' && !list.length;
    page({
      path: `${base}${s.slug}/`,
      tab: c.slug,
      count: list.length,
      noindex: empty ? 'follow' : false,
      crumbs: [...crumbs, { name: s.name, path: `${base}${s.slug}/` }],
      title: `${s.title}｜${settings.siteName}`,
      description: empty
        ? sentence(`${c.name}のグッズを、楽天市場で作品名から新しい順に探して並べるページです`, 'この7日に作品名で見つけた新着は、いまはありません', '推しキャラや種類のページから探せます')
        : s.desc(list),
      h1: s.h1,
      lead: s.lead,
      body: empty
        ? `<section data-s="new"><p class="next">この7日に作品名で見つけた新着は、いまはありません。</p></section>${oshiRow(c) + catNav || `<p class="more"><a href="${base}">${esc(c.name)}グッズのトップへ</a></p>`}`
        : (s.key === 'news' ? sortGrid(list.slice(0, settings.listItems)) : grid(list.slice(0, settings.listItems), true)) + priceAt(),
      lastmod: newest(list),
    });
  }

  // 予約受付中：楽天市場（締切・販売期間が近い順）と楽天ブックス（発売日の順）。12件より少ない日が続くと検索に出さない
  if (Y.total >= MIN_PAGE) {
    const path = `${base}yoyaku/`;
    const both = Y.market.length && Y.books.length;
    page({
      path,
      tab: c.slug,
      crumbs: [...crumbs, { name: '予約受付中', path }],
      title: `${c.name}グッズの予約受付中まとめ（締切・発売日が近い順）｜${settings.siteName}`,
      description: (() => {
        const near = Y.books.filter((b) => b.date.exact && b.date.ymd >= today).map((b) => b.date.ymd).sort()[0];
        const parts = [Y.market.length && `楽天市場の${Y.market.length}件は締切や販売期間が近い順`, Y.books.length && `楽天ブックスの${Y.books.length}件は発売日の順`].filter(Boolean);
        const head = [`予約受付中の${c.name}グッズを並べています`, `${parts.join('、')}です`, near ? `日にちが決まっている発売日で、いちばん近いのは${mdOfYmd(near)}です` : ''];
        const withMix = sentence(...head, mixLine(Y.market));
        const d = [...withMix].length <= 120 ? withMix : sentence(...head);
        // 少ないときは短くなるので、締切と発売の時期の読み取り方を足す（説明文は70字くらいから）
        return [...d].length >= 70 ? d : d + sentence('締切と発売の時期は、商品名に書いてあるものから読み取っています');
      })(),
      h1: `${c.name}グッズの予約受付中`,
      count: Y.total,
      body:
        (Y.market.length ? section(both ? '楽天市場の予約' : '', Y.market.slice(0, settings.listItems), { eager: true }) : '') +
        (Y.books.length ? `<section>${both ? '<h2>楽天ブックスの予約（発売日の順）</h2>' : ''}${bookGrid(Y.books.slice(0, settings.listItems), !Y.market.length)}</section>` : '') +
        '<p class="asof">締切は商品名に書いてあるもの、販売期間と発売日は楽天の情報です</p>' +
        // 時刻はいちばん下に1行（楽天市場があればその時刻。楽天ブックスはそのすぐあとに集めている）
        (Y.market.length ? priceAt() : booksAt()),
      lastmod: Y.market.length ? newest(Y.market) : books.fetchedAt ? jstDate(new Date(books.fetchedAt)) : '',
    });
  }

  for (const k of L.cats) {
    page({
      path: `${base}${k.slug}/`,
      tab: c.slug,
      count: k.items.length,
      crumbs: [...crumbs, { name: k.name, path: `${base}${k.slug}/` }],
      title: `${c.name}の${k.name}${(() => {
        const w = topWords(k.items, CATEGORIES.find((x) => x.slug === k.slug).words, k.name);
        return w.length ? `（${w.join('・')}）` : '';
      })()}通販・新着一覧｜${settings.siteName}`,
      description: (() => {
        const w = topWords(k.items, CATEGORIES.find((x) => x.slug === k.slug).words, k.name, 2);
        return sentence(`楽天市場の${c.name}の${k.name}を、見つけた新しい順に並べています`, w.length ? `${w.join('や')}が多く、${newsLine(k.items, 'もの')}です` : `${newsLine(k.items, 'もの')}です`, priceMid(k.items) ? `値段は${priceMid(k.items)}です` : '');
      })(),
      h1: `${c.name}の${k.name}`,
        body: sortGrid(k.items.slice(0, settings.listItems)) + priceAt(),
      lastmod: newest(k.items),
    });
  }
}

// ---- 推しキャラごと ----
for (const { c, o, label, items: list, ranked } of oshiPages) {
  const path = `/${c.slug}/${o.slug}/`;
  const bd = birthdays.find((b) => b.o === o);
  const inList = new Set(list.slice(0, settings.listItems).map((i) => i.code));
  const adult = list.filter((i) => isAdult(i.name));
  const popular = list.filter((i) => i.reviews >= 5).sort(byReviews);
  page({
    path,
    tab: c.slug,
    count: list.length,
    crumbs: [{ name: 'トップ', path: '/' }, { name: c.name, path: `/${c.slug}/` }, { name: o.name, path }],
    title: `${label}グッズの通販まとめ（人気${adult.length >= 4 ? '・大人向け' : ''}・新着）｜${settings.siteName}`,
    description: sentence(
      `${c.name === o.name ? '' : `${c.name}の`}${o.name}のグッズを、楽天市場から1日2回集めています`,
      `このサイトが見つけたのは${list.length}件${popular.length ? `で、レビューが5件以上あるものは${popular.length}件です` : 'です'}`,
      mixLine(list),
      bd ? `誕生日は${mdLabel(o.birthday)}です` : '',
    ),
    h1: `${o.name}のグッズ`,
    body:
      myButton(path, o.name) +
      shioriNav(list.slice(0, settings.listItems)) +
      `<ul class="grid" data-pool>${list
        .slice(0, settings.topItems)
        .map((it, j) => cell(it, j < 4, { cat: true }))
        .join('')}</ul>` +
      priceAt() +
      // 一覧にないランキングのグッズだけ（一覧のカードには、ランキングの印がつく）
      rankSection('楽天のランキングに入っているもの', ranked.filter((r) => !inList.has(r.code)), settings.topItems) +
      section('レビューが多いもの', popular, { limit: settings.topItems }) +
      (adult.length >= 4 ? section(`大人向けの${o.name}グッズ`, adult, { limit: settings.topItems }) : '') +
      section(`${o.name}のグッズ一覧`, list.slice(settings.topItems, settings.listItems), { cat: true }).replace('<section>', '<section class="rest">') +
      oshiSection([c], o.slug) +
      gotouchiSubs
        .filter((x) => x.w.c === c && x.sub.oshi === o.slug)
        .map((x) => `<p class="more"><a href="${subPath(x)}">ご当地${esc(x.sub.name)}一覧</a></p>`)
        .join('') +
      (bd ? `<p class="more"><a href="/tanjoubi/">${esc(o.name)}の誕生日は${mdLabel(o.birthday)}</a></p>` : '') +
      `<p class="more"><a href="/${c.slug}/">${esc(c.name)}のグッズの新着へ</a></p>`,
    deco: bd && bd.days <= BIRTHDAY_DECO ? 'birthday' : '',
    lastmod: newest(list),
  });
}

// 一覧のページの構造化データ（ご当地・季節の特集。商品の Product・Offer は入れない）
const collectionLd = ({ name, description, url, parts = [], image = null }) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name,
  description,
  url,
  inLanguage: 'ja',
  ...(image ? { primaryImageOfPage: image.ld } : {}),
  ...(parts.length ? { hasPart: parts.map((x) => ({ '@type': 'WebPageElement', name: x.name, url: x.url })) } : {}),
});
// ---- 季節の特集（/作品/季節/ と /季節/） ----
// 作品ごとの特集のページ（期間中）。others：ほかの作品の特集（いちばん下のリンク）
// seasons.json の seo があれば、名前・説明文・見出しをそれで作る（福袋：「{作品}の福袋{年}一覧」。検索の「福袋 2027」「ハッピーバッグ」に合わせた）
const seoFill = (t, v) => t.replace(/\{(work|year|works)\}/g, (_, k) => v[k] ?? '');
// その作品の買い方メモに、まだ終わっていないこの季節の予定（events の tag）があるか
const kaikataHas = (slug, tag) => hasKaikata(slug) && (readJson(`src/kaikata/${slug}.json`).events ?? []).some((e) => e.tag === tag && e.until >= today);
function seasonWorkPage(s, w, others) {
  const label = s.label;
  {
    const path = `/${w.c.slug}/${s.slug}/`;
    const seo = s.seo;
    const v = { work: w.c.name, year: s.win.year };
    const hasResv = w.items.some((i) => i.resv);
    const seoTitle = seo && seoFill(hasResv ? seo.workTitle : seo.workTitleNoResv, v);
    const seoDesc =
      seo &&
      sentence(
        seoFill(seo.workDesc, v),
        hasResv ? '予約受付中のものもあります' : '',
        priceMid(w.items) ? `値段は${priceMid(w.items)}です` : '',
        `特集は${mdOfYmd(s.win.end)}まで、楽天市場から1日2回集めています`,
      );
    const seoH1 = seo && seoFill(seo.workH1, v);
    page({
      path,
      tab: w.c.slug,
      count: w.items.length,
      deco: s.slug,
      crumbs: [{ name: 'トップ', path: '/' }, { name: w.c.name, path: `/${w.c.slug}/` }, { name: s.name, path }],
      title: seo ? `${seoTitle}｜${settings.siteName}` : `${w.c.name}の${label}${s.win.year}｜${settings.siteName}`,
      ...(seo ? { extraLd: [collectionLd({ name: seoH1, description: seoDesc, url: `${SITE}${path}` })] } : {}),
      description: seo ? seoDesc : sentence(
        `${w.c.name}の${label}を、楽天市場から1日2回集めています`,
        `見つけたのは${w.items.length}件です`,
        mixLine(w.items),
        s.gift && w.items.some((i) => i.gift === 1) ? `ラッピング対応は${w.items.filter((i) => i.gift === 1).length}件、特集は${mdOfYmd(s.win.end)}までです` : `特集は${mdOfYmd(s.win.end)}までです`,
      ),
      h1: seo ? seoH1 : `${w.c.name}の${label}`,
      // プレゼントの季節（gift）は、送料込み・ラッピング対応でしぼりこめる
      body:
        (s.gift
          ? filterBar(w.items.slice(0, settings.listItems), ['s', 'g']) + sortBar(w.items.slice(0, settings.listItems)) + filterGrid(w.items, { show: settings.listItems, eager: true, sort: true }) + FILTER_END + SORT_END
          : sortGrid(w.items.slice(0, settings.listItems))) +
        (seo?.kaikataLink && kaikataHas(w.c.slug, s.slug) ? `<p class="more"><a href="/${w.c.slug}/kaikata/#yotei">${esc(seoFill(seo.kaikataLink, v))}</a></p>` : '') +
        priceAt() +
        (others.length ? `<p class="more">${others.map((x) => `<a href="/${x.c.slug}/${s.slug}/">${esc(x.c.name)}の${esc(label)}</a>`).join('／')}</p>` : ''),
      lastmod: newest(w.items),
    });
  }
}
for (const { s, works } of seasonPages) {
  const label = s.label;
  for (const w of works) seasonWorkPage(s, w, works.filter((x) => x !== w));
  const names = works.length > 3 ? `${works.slice(0, 3).map((w) => w.c.name).join('・')}など` : works.map((w) => w.c.name).join('・');
  const hubDesc = (() => {
    const big = [...works].sort((a, b) => b.items.length - a.items.length);
    const all = works.flatMap((w) => w.items);
    return sentence(
      `${big.slice(0, 2).map((w) => `${w.c.name}${w.items.length}件`).join('、')}${works.length > 2 ? 'など' : ''}、${works.length}作品の${label}を作品ごとに並べています`,
      priceMid(all) ? `値段は${priceMid(all)}です` : '',
      s.gift && all.some((i) => i.gift === 1) ? `ラッピング対応は${all.filter((i) => i.gift === 1).length}件、特集は${mdOfYmd(s.win.end)}までです` : `特集は${mdOfYmd(s.win.end)}まで、1日2回集めています`,
    );
  })();
  page({
    path: `/${s.slug}/`,
    count: works.reduce((n, w) => n + w.items.length, 0),
    deco: s.slug,
    crumbs: [{ name: 'トップ', path: '/' }, { name: label, path: `/${s.slug}/` }],
    title: s.seo ? `${seoFill(s.seo.hubTitle, { year: s.win.year, works: works.slice(0, 3).map((w) => w.c.name).join('・') })}｜${settings.siteName}` : `${label}${s.win.year}（${names}）｜${settings.siteName}`,
    description: hubDesc,
    h1: s.seo ? seoFill(s.seo.hubH1, { year: s.win.year }) : label,
    ...(s.seo ? { extraLd: [collectionLd({ name: seoFill(s.seo.hubH1, { year: s.win.year }), description: hubDesc, url: `${SITE}/${s.slug}/` })] } : {}),
    body:
      (s.gift ? filterBar(works.flatMap((w) => w.items.slice(0, 24)), ['s', 'g']) : '') +
      works
        .map(
          (w, i) =>
            `<section><h2>${esc(w.c.name)}</h2>${s.gift ? filterGrid(w.items, { show: settings.topItems, pool: 24, eager: i === 0 }) : grid(w.items.slice(0, settings.topItems), i === 0)}<p class="more"><a href="/${w.c.slug}/${s.slug}/">${esc(w.c.name)}の${esc(label)}をもっと見る</a></p></section>`,
        )
        .join('') +
      (s.gift ? FILTER_END : '') +
      priceAt(),
    lastmod: newest(works.flatMap((w) => w.items)),
  });
}

// ---- 季節の特集：期間外のページ（次のはじまりを知らせて、いまの特集か新着を並べる。検索には出さない） ----
// 期間中でも6件にとどかない作品は、見つかった分だけの特集のページ（商品が少ないページの決まりで検索に出さない）
const ymdLabel = (ymd) => `${Number(ymd.slice(0, 4))}年${Number(ymd.slice(5, 7))}月${Number(ymd.slice(8, 10))}日`;
const seasonSpan = (s) => `毎年${mdLabel(s.from)}から${mdLabel(s.to)}まで`;
// いまの特集の入口。c があればその作品の特集だけ
function nowSeasonsHtml(c) {
  if (c) {
    return seasonPages
      .flatMap(({ s, works }) => works.filter((w) => w.c === c).map((w) => ({ s, w })))
      .map(
        ({ s, w }, i) =>
          `<section class="dks s-${s.slug}"><div class="hw"><h2>${esc(s.label)}</h2><span class="stk stk-2" aria-hidden="true"></span></div>${grid(w.items.slice(0, 4), i === 0)}<p class="more"><a href="/${c.slug}/${s.slug}/">${esc(c.name)}の${esc(s.label)}をもっと見る</a></p></section>`,
      );
  }
  return seasonPages.map((sp, i) => seasonTeaser(sp, i === 0, 4));
}
for (const x of seasonLater) {
  const { s, active } = x;
  const label = s.label;
  const next = active ? '' : nextBirthday(s.from, today).date;
  const note = active ? `<p class="next">いまは見つかったグッズがありません</p>` : `<p class="next">次は${ymdLabel(next)}から</p>`;
  for (const w of x.works) {
    if (active && w.items.length) {
      const sp = seasonPages.find((y) => y.s.slug === s.slug);
      seasonWorkPage(s, w, sp?.works ?? []);
      continue;
    }
    const { c } = w;
    const path = `/${c.slug}/${s.slug}/`;
    const nowParts = nowSeasonsHtml(c);
    const nowLabels = seasonPages.filter(({ works }) => works.some((y) => y.c === c)).map(({ s: y }) => y.label);
    const news = listsFor(c.slug).news;
    page({
      path,
      tab: c.slug,
      noindex: 'follow',
      deco: s.slug,
      decoParts: seasonPages.map(({ s: y }) => y.slug),
      crumbs: [{ name: 'トップ', path: '/' }, { name: c.name, path: `/${c.slug}/` }, { name: s.name, path }],
      title: active ? `${c.name}の${label}${s.win.year}｜${settings.siteName}` : `${c.name}の${label}（次は${mdLabel(s.from)}から）｜${settings.siteName}`,
      description: sentence(
        `${c.name}の${label}の特集は、${seasonSpan(s)}です`,
        active ? `${c.name}の${label}が見つかったら、ここに並べます` : `次は${ymdLabel(next)}からはじまります`,
        nowLabels.length ? `いまは${joinTo(nowLabels)}の特集を並べています` : news.length ? `いまは${c.name}の新着を並べています` : `${c.name}のグッズは、作品のトップから探せます`,
      ),
      h1: `${c.name}の${label}`,
      body:
        note +
        (nowParts.length
          ? nowParts.join('') + `<p class="more"><a href="/${c.slug}/">${esc(c.name)}のグッズの新着へ</a></p>`
          : news.length
            ? section(`${c.name}グッズ新着`, news, { limit: settings.topItems, more: `/${c.slug}/new/`, moreLabel: '新着をすべて見る', eager: true })
            : `<p class="more"><a href="/${c.slug}/">${esc(c.name)}グッズのトップへ</a></p>`) +
        (nowParts.length || news.length ? priceAt() : ''),
    });
  }
  if (x.hub) {
    const nowParts = nowSeasonsHtml(null);
    const names = x.seen.length > 3 ? `${x.seen.slice(0, 3).map((c) => c.name).join('・')}など` : x.seen.map((c) => c.name).join('・');
    const news = buyable.filter((i) => !i.via).sort(byNew);
    page({
      path: `/${s.slug}/`,
      noindex: 'follow',
      deco: s.slug,
      decoParts: seasonPages.map(({ s: y }) => y.slug),
      crumbs: [{ name: 'トップ', path: '/' }, { name: label, path: `/${s.slug}/` }],
      title: active ? `${label}${s.win.year}（${names}）｜${settings.siteName}` : `${label}（次は${mdLabel(s.from)}から）｜${settings.siteName}`,
      description: sentence(
        `${label}の特集は、${seasonSpan(s)}です`,
        active ? '見つかったグッズが6件以上になった作品から並べます' : `次は${ymdLabel(next)}からで、これまでに${names}の${x.seen.length}作品を並べました`,
        nowParts.length ? `いまは${joinTo(seasonPages.map(({ s: y }) => y.label))}の特集を並べています` : 'いまは推しキャラグッズの新着を並べています',
      ),
      h1: label,
      body:
        note +
        (nowParts.length ? nowParts.join('') : section('推しキャラグッズの新着', news, { limit: settings.topItems, more: '/', moreLabel: 'トップの新着へ', eager: true })) +
        (nowParts.length || news.length ? priceAt() : ''),
    });
  }
}

// ページの顔の絵（検索のサムネイルの候補。Google は og:image と構造化データの primaryImageOfPage を見て選ぶ。サイト共通の表紙の絵は選ばれにくい）
// src/art/a2-<名前>-<hash8>.webp（ページに出す 1200×600）と a2-<名前>-og-<hash8>.jpg（og:image と構造化データ 1200×630）の組。どちらかがなければ出さない
const ART_FILES = existsSync('src/art') ? readdirSync('src/art') : [];
function pageArt(name, alt) {
  const hero = ART_FILES.find((f) => new RegExp(`^a2-${name}-[0-9a-f]{8}\\.webp$`).test(f));
  const og = ART_FILES.find((f) => new RegExp(`^a2-${name}-og-[0-9a-f]{8}\\.jpg$`).test(f));
  if (!hero || !og) return null;
  return {
    html: `<p class="yomi-hero"><img src="/art/${hero}" width="1200" height="600" alt="${esc(alt)}" decoding="async" fetchpriority="high"></p>`,
    og: `/art/${og}`,
    ld: { '@type': 'ImageObject', url: `${SITE}/art/${og}`, width: 1200, height: 630 },
  };
}
const GOTOUCHI_ART = pageArt('gotouchi', settings.gotouchiArtAlt ?? '');

// ---- ご当地グッズ（/作品/gotouchi/ と /gotouchi/） ----
// 作品ごとのページは「ご当地{作品}一覧」：地方の見出し（h2）の中に都道府県の見出し（h3）。北から南の順、都道府県の中は新しい順で30件まで
const MAX_PER_PREF = 30;
const MAX_TOC_OPEN = 15; // 都道府県がこれより多いと、目次を地方ごとにたたむ（最初は開いた形）
// 都道府県ごとの一覧のページ。作品（/作品/gotouchi/）とキャラだけ（/作品/gotouchi/キャラ/）で同じ形
// who：説明文と節の名前に使う名前（サンリオ・ハローキティ）。part：都道府県の節の名前（「北海道のご当地{part}」）。top：目次の上に置くもの
function gotouchiListPage({ c, items, newestItems, path, h1, who, part, title, crumbs, top = '', more = [] }) {
  const w = { items, newest: newestItems };
  const areas = AREAS.map((a) => {
    const prefs = a.prefs
      .map((pref) => ({ pref, id: prefId(pref), items: w.items.filter((i) => i.region?.pref === pref).sort(byNew) }))
      .filter((p) => p.items.length);
    return { slug: a.slug, name: a.name, prefs };
  }).filter((a) => a.prefs.length);
  const rest = w.items.filter((i) => !i.region).sort(byNew);
  const prefList = areas.flatMap((a) => a.prefs);
  const places = topPlaces(w.items);
  const description = sentence(
    `${who}のご当地グッズを、都道府県ごとに北から南へ並べた一覧です`,
    places.length ? `商品名に多い地名は${places.join('・')}で、${areas.length}つの地方から見つけました` : '地名が商品名にないものもまとめています',
    priceMid(w.items) ? `値段は${priceMid(w.items)}です` : '',
  );
  const SONOHOKA = '地名が商品名にないもの';
  // 目次：都道府県が3つ以上なら地方ごとに都道府県を並べる。少ない作品は地方のチップのまま
  let toc = '';
  if (prefList.length >= 3) {
    const fold = prefList.length > MAX_TOC_OPEN;
    const prefLinks = (a) => `<ul class="chips">${a.prefs.map((p) => `<li><a href="#${p.id}">${esc(p.pref)}</a></li>`).join('')}</ul>`;
    const restLink = rest.length ? `<div class="gtr"><p class="oc">そのほか</p><ul class="chips"><li><a href="#sonohoka">${SONOHOKA}</a></li></ul></div>` : '';
    toc = `<nav class="gtoc" aria-label="都道府県">${areas
      .map((a) => (fold ? `<details open><summary>${esc(a.name)}</summary>${prefLinks(a)}</details>` : `<div class="gtr"><p class="oc">${esc(a.name)}</p>${prefLinks(a)}</div>`))
      .join('')}${restLink}</nav>`;
  } else {
    const chips = [...areas.map((a) => [a.slug, a.name]), ...(rest.length ? [['sonohoka', SONOHOKA]] : [])];
    if (chips.length > 1) toc = `<ul class="chips">${chips.map(([id, name]) => `<li><a href="#${id}">${esc(name)}</a></li>`).join('')}</ul>`;
  }
  let first = true;
  const gridOnce = (items) => {
    const html = grid(items, first);
    first = false;
    return html;
  };
  page({
    path,
    tab: c.slug,
    count: w.items.length,
    deco: 'gotouchi',
    crumbs,
    title: title(places),
    description,
    h1,
    extraLd: [collectionLd({ name: h1, description, url: `${SITE}${path}`, image: GOTOUCHI_ART, parts: prefList.map((p) => ({ name: `${p.pref}のご当地${part}`, url: `${SITE}${path}#${p.id}` })) })],
    ...(GOTOUCHI_ART ? { ogImage: GOTOUCHI_ART.og } : {}),
    body:
      (GOTOUCHI_ART?.html ?? '') +
      top +
      toc +
      areas
        .map(
          (a) =>
            `<section id="${a.slug}"><h2>${esc(a.name)}</h2>${a.prefs
              .map((p) => `<section class="gp" id="${p.id}"><h3>${esc(p.pref)}</h3>${gridOnce(p.items.slice(0, MAX_PER_PREF))}</section>`)
              .join('')}</section>`,
        )
        .join('') +
      (rest.length ? `<section id="sonohoka"><h2>${SONOHOKA}</h2>${gridOnce(rest.slice(0, MAX_PER_PREF))}</section>` : '') +
      priceAt() +
      (more.length ? `<p class="more">${more.map(([href, name]) => `<a href="${href}">${esc(name)}</a>`).join('／')}</p>` : ''),
    lastmod: newest(w.items),
  });
}
const placesNote = (places) => (places.length ? `（${places.join('・')}など）` : '');
for (const w of gotouchiWorks) {
  const { c } = w;
  const path = `/${c.slug}/gotouchi/`;
  const h1 = `ご当地${c.name}一覧`;
  const subs = gotouchiSubs.filter((x) => x.w === w);
  gotouchiListPage({
    c,
    items: w.items,
    newestItems: w.newest,
    path,
    h1,
    who: c.name,
    part: c.name,
    // キャラだけの一覧があれば、名前にも入れる（「ご当地サンリオ・ご当地キティ一覧」）
    title: (places) => `${subs.length ? `ご当地${c.name}・${subs.map((x) => `ご当地${x.sub.name}`).join('・')}一覧` : h1}｜都道府県ごとのグッズ${placesNote(places)}｜${settings.siteName}`,
    crumbs: [{ name: 'トップ', path: '/' }, { name: c.name, path: `/${c.slug}/` }, { name: h1, path }],
    top: yomiLinksFor(c.slug, 'gotouchi') + subs.map((x) => `<p class="more"><a href="${subPath(x)}">ご当地${esc(x.sub.name)}だけを見る</a></p>`).join(''),
    more: gotouchiWorks.filter((x) => x !== w).map((x) => [`/${x.c.slug}/gotouchi/`, `ご当地${x.c.name}一覧`]),
  });
}
for (const x of gotouchiSubs) {
  const { c } = x.w;
  const path = subPath(x);
  const h1 = `ご当地${x.sub.name}一覧`;
  const who = x.sub.full ?? x.sub.name;
  gotouchiListPage({
    c,
    items: x.items,
    newestItems: x.newest,
    path,
    h1,
    who,
    part: x.sub.name,
    title: (places) => `${h1}｜都道府県ごとの${who}のご当地グッズ${placesNote(places)}｜${settings.siteName}`,
    crumbs: [
      { name: 'トップ', path: '/' },
      { name: c.name, path: `/${c.slug}/` },
      { name: 'ご当地', path: `/${c.slug}/gotouchi/` },
      { name: x.sub.name, path },
    ],
    more: [[`/${c.slug}/gotouchi/`, `ご当地${c.name}一覧`], ...gotouchiWorks.filter((y) => y !== x.w).map((y) => [`/${y.c.slug}/gotouchi/`, `ご当地${y.c.name}一覧`])],
  });
}
if (gotouchiWorks.length) {
  const names = gotouchiWorks.length > 3 ? `${gotouchiWorks.slice(0, 3).map((w) => w.c.name).join('・')}など` : `${gotouchiWorks.map((w) => w.c.name).join('・')}の`;
  const all = gotouchiWorks.flatMap((w) => w.items);
  const pl = topPlaces(all, 2);
  const description = sentence(
    `${gotouchiWorks.slice(0, 2).map((w) => w.c.name).join('・')}${gotouchiWorks.length > 2 ? 'など' : ''}${gotouchiWorks.length}作品のご当地グッズを、作品ごとに集めた一覧です`,
    pl.length ? `商品名に多い地名は${pl.join('と')}で、作品ごとに都道府県で分けた一覧もあります` : '',
    priceMid(all) ? `値段は${priceMid(all)}です` : '',
  );
  page({
    path: '/gotouchi/',
    count: all.length,
    deco: 'gotouchi',
    crumbs: [{ name: 'トップ', path: '/' }, { name: 'ご当地グッズ一覧', path: '/gotouchi/' }],
    title: `ご当地グッズ一覧｜${names}都道府県ごとのキャラグッズ｜${settings.siteName}`,
    description,
    h1: 'ご当地グッズ一覧',
    extraLd: [
      collectionLd({ name: 'ご当地グッズ一覧', description, url: `${SITE}/gotouchi/`, image: GOTOUCHI_ART }),
    ],
    ...(GOTOUCHI_ART ? { ogImage: GOTOUCHI_ART.og } : {}),
    body:
      (GOTOUCHI_ART?.html ?? '') +
      gotouchiWorks
        .map(
          (w, i) =>
            `<section><h2>ご当地${esc(w.c.name)}</h2>${grid(w.newest.slice(0, settings.topItems), i === 0)}<p class="more"><a href="/${w.c.slug}/gotouchi/">ご当地${esc(w.c.name)}一覧</a></p></section>`,
        )
        .join('') + priceAt(),
    lastmod: newest(all),
  });
}

// ---- 人気ランキング・大人向け・子ども向け（作品ごと） ----
for (const c of chars) {
  const base = `/${c.slug}/`;
  const crumb = (name, path) => [{ name: 'トップ', path: '/' }, { name: c.name, path: base }, { name, path }];
  if (hasRanking(c.slug)) {
    const path = `${base}ranking/`;
    const ranked = rankedFor(c.slug);
    const rv = reviewed(c.slug);
    page({
      path,
      tab: c.slug,
      count: new Set([...ranked.map((r) => r.code), ...rv.map((i) => i.code)]).size,
      crumbs: crumb('人気ランキング', path),
      title: `${c.name}グッズの人気ランキング（楽天市場のランキング・レビューの数）｜${settings.siteName}`,
      description: sentence(
        ranked.length ? `楽天市場のランキングに入っている${c.name}グッズ${ranked.length}件と、レビューが多いもの${rv.length}件を並べています` : `楽天市場でレビューが多い${c.name}グッズ${rv.length}件を並べています`,
        rv.length ? `いちばん多いもののレビューは${rv[0].reviews.toLocaleString('ja-JP')}件です` : '',
        mixLine(rv),
      ),
      h1: `${c.name}グッズの人気ランキング`,
      body:
        (ranked.length ? `<section><h2>楽天のランキングに入っているもの</h2><ul class="grid">${ranked.slice(0, 30).map((r, i) => rankCell(r, i < 4)).join('')}</ul></section>` : '') +
        section('レビューが多いもの', rv, { limit: 30, eager: !ranked.length }) +
        priceAt(),
      lastmod: ranking.fetchedAt ? jstDate(new Date(ranking.fetchedAt)) : newest(rv),
    });
  }
  const adult = adultFor(c.slug);
  if (adult.length >= MIN_PICK) {
    const path = `${base}otona/`;
    const w = topWords(adult, ADULT_SHOW);
    page({
      path,
      tab: c.slug,
      count: adult.length,
      crumbs: crumb('大人向け', path),
      title: `大人向け${c.name}グッズ${w.length ? `（${w.join('・')}など）` : ''}｜${settings.siteName}`,
      description: sentence(
        `${c.name}のグッズから、大人が使いやすいもの${adult.length}件を集めています`,
        w.length ? `${w.slice(0, 2).join('や')}が多く、値段は${priceMid(adult)}です` : `値段は${priceMid(adult)}です`,
        '子ども用やベビー用は入れていません',
      ),
      h1: `大人向けの${c.name}グッズ`,
      body: byCategory(adult, 12) + priceAt(),
      lastmod: newest(adult),
    });
  }
  const kids = kidsFor(c.slug);
  if (kids.length >= MIN_PICK) {
    const path = `${base}kids/`;
    page({
      path,
      tab: c.slug,
      count: kids.length,
      crumbs: crumb('子ども向け', path),
      title: `子ども向け${c.name}グッズ（キッズ・小学生・ベビー）｜${settings.siteName}`,
      description: sentence(`商品名にキッズや子ども、ベビーなどが入っている${c.name}グッズ${kids.length}件を並べています`, mixLine(kids), kids.some((i) => i.postage === 0) ? `送料込みのものは${kids.filter((i) => i.postage === 0).length}件です` : `値段は${priceMid(kids)}です`),
      h1: `子ども向けの${c.name}グッズ`,
      body: byCategory(kids, 12) + priceAt(),
      lastmod: newest(kids),
    });
  }
}

// ---- 作品ならではの話題（映画など） ----
for (const { t, c, items: list } of topicPages) {
  const path = `/${c.slug}/${t.slug}/`;
  page({
    path,
    tab: c.slug,
    count: list.length,
    crumbs: [{ name: 'トップ', path: '/' }, { name: c.name, path: `/${c.slug}/` }, { name: t.name, path }],
    title: `${t.title}｜${settings.siteName}`,
    description: sentence(`${t.name}のグッズを、楽天市場から1日2回集めています`, `このサイトが見つけたのは${list.length}件です`, mixLine(list)),
    h1: t.h1,
    body: sortGrid(list.slice(0, settings.listItems)) + priceAt(),
    lastmod: newest(list),
  });
}

// ---- 予算で選ぶ（作品ごと） ----
for (const c of chars) {
  if (!hasYosan(c.slug)) continue;
  const path = `/${c.slug}/yosan/`;
  const bands = bandsFor(c.slug);
  // 送料込み・ラッピング対応・大人向け・子ども向けと金額でしぼりこめる（それぞれ48件まで入れておき、20件ずつ見せる）
  const bar = filterBar(
    bands.flatMap((b) => b.items.slice(0, 48)),
    ['s', 'g', 'a', 'k', 'max'],
  );
  const perkWords = FILTERS.filter(([k]) => ['s', 'g'].includes(k) && bar.includes(`data-k="${k}"`)).map(([, t]) => t);
  page({
    path,
    tab: c.slug,
    count: bands.reduce((n, b) => n + b.items.length, 0),
    crumbs: [{ name: 'トップ', path: '/' }, { name: c.name, path: `/${c.slug}/` }, { name: '予算で選ぶ', path }],
    title: `安い${c.name}グッズ・プレゼントを予算で選ぶ（1,000円以下・3,000円まで・5,000円まで）｜${settings.siteName}`,
    description: (() => {
      const d = sentence(
        `${c.name}のグッズを値段で分けて、レビューが多い順に並べています`,
        bands.map((b) => `${b.name}は${b.items.length}件`).join('、'),
        perkWords.length ? `${perkWords.join('や')}でもしぼりこめます` : '',
      );
      // 区切りが少なくて短いときは、多い種類と値段の中心を足す（説明文は70字くらいから）
      return [...d].length >= 70 ? d : d + sentence(mixLine(bands.flatMap((b) => b.items)));
    })(),
    h1: `予算で選ぶ${c.name}グッズ`,
    body:
      bar +
      bands.map((b, i) => `<section><h2>${esc(b.name)}</h2>${filterGrid(b.items, { show: 20, pool: 48, eager: i === 0 })}</section>`).join('') +
      FILTER_END +
      priceAt() +
      '<p class="asof">「送料込み」の印がない商品は、送料が別のことがあります</p>',
    lastmod: newest(bands.flatMap((b) => b.items)),
  });
}

// ---- 推しキャラの誕生日カレンダー ----
if (birthdays.length) {
  const soon = birthdays.filter((b) => b.days <= BIRTHDAY_SOON && b.items.length);
  const works = [...new Set(birthdays.map((b) => b.c.name))];
  page({
    path: '/tanjoubi/',
    crumbs: [{ name: 'トップ', path: '/' }, { name: '推しキャラの誕生日', path: '/tanjoubi/' }],
    title: `推しキャラの誕生日カレンダー（${works.join('・')}）｜${settings.siteName}`,
    description: sentence(
      `推しキャラ${birthdays.length}人の誕生日を、近い順に並べています`,
      birthdays.length > 1 ? `次は${birthdays[0].o.name}の${mdLabel(birthdays[0].o.birthday)}、その次は${birthdays[1].o.name}の${mdLabel(birthdays[1].o.birthday)}です` : `次は${birthdays[0].o.name}の${mdLabel(birthdays[0].o.birthday)}です`,
      soon.length ? '誕生日が近い推しキャラのグッズも並べています' : '',
    ),
    h1: '推しキャラの誕生日カレンダー',
    body:
      (soon.length ? filterBar(soon.flatMap((b) => b.items.slice(0, 24)), ['s', 'g']) : '') +
      soon.map((b, i) => birthdaySection(b, settings.topItems, i === 0, true)).join('') +
      (soon.length ? FILTER_END + priceAt() : '') +
      `<section><h2>誕生日が近い順</h2><ul class="bd">${birthdays
        .map(
          (b) =>
            `<li><time>${mdLabel(b.o.birthday)}</time><a href="${esc(oshiHref(b.c, b.o))}">${esc(b.o.name)}</a><span>${esc([b.c.name !== b.o.name ? b.c.name : '', b.o.birthdayNote ?? ''].filter(Boolean).join('・'))}</span></li>`,
        )
        .join('')}</ul><p class="more"><a href="/calendar/oshi.ics">誕生日を、スマホのカレンダーに入れる</a>／<a href="/calendar/">推し活カレンダー</a></p><p class="asof">誕生日は公式で使われている日です</p></section>`,
    decoParts: soon.length ? ['birthday'] : [],
  });
}

// ---- 推し活カレンダー（/calendar/。今日から来月の終わりまで、日にちが決まったものだけ） ----
// 推しキャラの誕生日・季節のイベント・特集のはじまり（このサイトの設定）、楽天ブックスの発売日、商品名に書いてある予約の締切。
// スマホのカレンダーに入れるファイル（/calendar/oshi.ics）は、このサイトが決めた日（推しキャラの誕生日）だけ。楽天のデータは入れない
const WD = '日月火水木金土';
const dayLabel = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}（${WD[new Date(`${ymd}T00:00:00Z`).getUTCDay()]}）`;
const calEnd = new Date(Date.UTC(ty, tm + 1, 0)).toISOString().slice(0, 10); // 来月の終わり
const nextOn = (mmdd) => nextBirthday(mmdd, today).date; // 今日から見て次のその日
const inCal = (d) => d >= today && d <= calEnd;
const workOrder = (slug) => chars.findIndex((c) => c.slug === slug);
const countBy = (list, keyOf) => {
  const m = new Map();
  for (const x of list) {
    const k = keyOf(x);
    m.set(k, [...(m.get(k) ?? []), x]);
  }
  return [...m.entries()];
};
const calEntries = [
  // 推しキャラの誕生日
  ...birthdays
    .filter((b) => inCal(b.date))
    .map((b) => ({ d: b.date, o: 0, w: workOrder(b.c.slug), html: `<a href="${esc(oshiHref(b.c, b.o))}">${esc(b.o.name)}の誕生日</a><span>${esc([b.c.name !== b.o.name ? b.c.name : '', b.o.birthdayNote ?? ''].filter(Boolean).join('・'))}</span>` })),
  // 季節のイベント（特集のページがあればそこへ）
  ...seasons
    .filter((s) => s.event && inCal(nextOn(s.event)))
    .map((s) => {
      const sp = seasonPages.find((x) => x.s.slug === s.slug);
      return { d: nextOn(s.event), o: 1, w: -1, html: sp ? `<a href="/${s.slug}/">${esc(s.name)}</a><span>${esc(s.label)}の特集</span>` : `<b>${esc(s.name)}</b>` };
    }),
  // 特集のはじまり（今日より後）
  ...seasons
    .filter((s) => nextOn(s.from) > today && inCal(nextOn(s.from)))
    .map((s) => ({ d: nextOn(s.from), o: 2, w: -1, html: `<b>${esc(s.label)}の特集がはじまる</b>` })),
  // 楽天ブックスの発売日（日にちが決まったもの）。作品ごとに、その日の数と種類
  ...countBy(
    books.items.filter((b) => b.url && b.img && b.date.exact && inCal(b.date.ymd)),
    (b) => `${b.date.ymd}|${b.c}`,
  ).map(([k, list]) => {
    const [d, slug] = k.split('|');
    const c = chars.find((x) => x.slug === slug);
    const kinds = [...new Set(list.map((b) => b.kind).filter(Boolean))].join('・');
    const label = `${c.name}の新作が発売`;
    return { d, o: 3, w: workOrder(slug), html: `${hasCalendar(c) ? `<a href="/${slug}/hatsubai/">${esc(label)}</a>` : `<b>${esc(label)}</b>`}<span>${esc(`${kinds ? `${kinds} ` : ''}${list.length}件`)}</span>` };
  }),
  // 予約の締切（商品名に書いてあるものだけ）
  ...countBy(
    buyable.filter((i) => i.resv?.deadline && inCal(i.resv.deadline)),
    (i) => `${i.resv.deadline}|${i.c}`,
  ).map(([k, list]) => {
    const [d, slug] = k.split('|');
    const c = chars.find((x) => x.slug === slug);
    const label = `${c.name}の予約の締切`;
    return { d, o: 4, w: workOrder(slug), html: `${yoyakuFor(slug).total >= MIN_PAGE ? `<a href="/${slug}/yoyaku/">${esc(label)}</a>` : `<b>${esc(label)}</b>`}<span>${list.length}件</span>` };
  }),
].sort((a, b) => a.d.localeCompare(b.d) || a.o - b.o || a.w - b.w);

if (calEntries.length) {
  const months = [...new Set(calEntries.map((e) => e.d.slice(0, 7)))];
  // いちばん下の1行（どこから来た日付か）
  const srcNote = [calEntries.some((e) => e.o === 3) && '発売日は楽天ブックス', calEntries.some((e) => e.o === 4) && '締切は商品名に書いてあるもの'].filter(Boolean).join('、');
  page({
    path: '/calendar/',
    crumbs: [{ name: 'トップ', path: '/' }, { name: '推し活カレンダー', path: '/calendar/' }],
    title: `推し活カレンダー（${calMonths}）グッズの発売日・予約の締切・推しキャラの誕生日｜${settings.siteName}`,
    description: (() => {
      const relDays = new Set(calEntries.filter((e) => e.o === 3).map((e) => e.d)).size;
      const bdays = birthdays.filter((b) => b.date <= calEnd);
      return sentence(
        `${calMonths}の推し活カレンダーです`,
        relDays ? `グッズの発売日は${relDays}日ぶん${bdays.length ? `、推しキャラの誕生日は${bdays.slice(0, 2).map((b) => `${b.o.name}${mdOfYmd(b.date)}`).join('と')}${bdays.length > 2 ? 'など' : ''}` : ''}` : bdays.length ? `推しキャラの誕生日は${bdays.slice(0, 2).map((b) => `${b.o.name}${mdOfYmd(b.date)}`).join('と')}` : '',
        '季節のイベントや予約の締切も、日付の順に並べています',
      );
    })(),
    h1: '推し活カレンダー',
    body:
      months
        .map(
          (m) =>
            `<section><h2>${Number(m.slice(0, 4))}年${Number(m.slice(5, 7))}月</h2><ul class="bd cal">${calEntries
              .filter((e) => e.d.startsWith(m))
              .map((e) => `<li><time datetime="${e.d}">${dayLabel(e.d)}</time>${e.html}</li>`)
              .join('')}</ul></section>`,
        )
        .join('') +
      (birthdays.length ? '<p class="more"><a href="/calendar/oshi.ics">推しキャラの誕生日を、スマホのカレンダーに入れる</a></p>' : '') +
      (srcNote ? `<p class="asof">${srcNote}です</p>` : '') +
      (calEntries.some((e) => e.o === 3) ? booksAt() : ''),
    lastmod: today,
  });
}

// ---- 発売日カレンダー（キャラごと） ----
for (const c of calChars) {
  const cal = calendarFor(c.slug);
  const path = `/${c.slug}/hatsubai/`;
  const months = [...new Set(cal.upcoming.map(groupOf))];
  const body =
    booksAt() +
    months
      .map((m, i) => `<section><h2>${esc(m)}</h2>${bookGrid(cal.upcoming.filter((b) => groupOf(b) === m), i === 0)}</section>`)
      .join('') +
    (cal.recent.length ? `<section><h2>最近発売したもの</h2>${bookGrid(cal.recent.slice(0, settings.listItems), !months.length)}</section>` : '');
  page({
    path,
    tab: c.slug,
    count: cal.upcoming.length + cal.recent.length,
    crumbs: [{ name: 'トップ', path: '/' }, { name: c.name, path: `/${c.slug}/` }, { name: '発売日カレンダー', path }],
    title: `${c.name}の新作グッズ発売予定・発売日カレンダー（${calMonths}）｜${settings.siteName}`,
    description: (() => {
      const near = cal.upcoming.find((b) => b.date.exact);
      const kinds = (() => {
        const n = {};
        for (const b of cal.upcoming) if (b.kind) n[b.kind] = (n[b.kind] ?? 0) + 1;
        return Object.entries(n).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k]) => k);
      })();
      const d = sentence(
        `${c.name}の新作の発売日を、楽天ブックスから集めています`,
        cal.upcoming.length ? `これから発売するのは${cal.upcoming.length}件${kinds.length ? `で、多いのは${joinTo(kinds)}` : ''}` : '',
        near ? `いちばん近い発売日は${mdOfYmd(near.date.ymd)}です` : cal.upcoming.length ? `いちばん近いものは${groupOf(cal.upcoming[0])}の発売です` : '',
        cal.recent.length ? '最近発売したものも並べています' : '',
      );
      // 件数が少ない作品は短くなるので、並べ方を1文足す（説明文は70字以上）
      return [...d].length >= 70 ? d : sentence(d, '発売日が月だけのものは、その月のところにまとめています');
    })(),
    h1: `${c.name}の新作・発売日カレンダー`,
    lead: '楽天ブックスの発売日をもとに並べています',
    body,
    lastmod: books.fetchedAt ? jstDate(new Date(books.fetchedAt)) : '',
  });
}

// ---- 探す（言葉は Cloudflare の関数がその場で楽天市場に聞く。functions/search/） ----
page({
  path: '/search/',
  tab: 'search',
  noindex: true,
  crumbs: [{ name: 'トップ', path: '/' }, { name: '探す', path: '/search/' }],
  title: `推しキャラのグッズを探す｜${settings.siteName}`,
  description: `${allNames}${cornerList ? `や${cornerList}の作品` : ''}のグッズを、キャラと言葉で楽天市場から探せます。中古やトレーディングカード、未使用品の出品などは外して並べます。`,
  h1: '推しキャラで探す',
  body: `<!--sf-->${searchFormHtml(chars)}<!--/sf--><!--sr--><!--/sr-->${otherCorners.length ? oshiFolded(chars) : oshiSection(chars)}`,
});

// ---- 公式の最新情報（楽天の商品を出さないページ。楽天以外へのリンクはここだけ） ----
// 公式のYouTubeの新しい動画は、ページを開いたときに Cloudflare の関数（functions/koushiki/）が
// YouTube Data API から取って <!--yt:作品--> の目印に入れる。ここ（静的なページ）には動画の情報を入れない。
// YouTube のデータがあるページなので、楽天の広告（バナー・広告の表示）は出さない（YouTube API サービスの決まり III.G.1.d）
// 公式のリンクは楽天の商品と関係がないので、買える商品がない日の作品も出す（作品のページへのリンクは置かない）。題と説明文の作品名も本文と同じ並びから
const koushikiWorks = allWorks.filter((c) => c.official?.length || c.youtube?.length);
const koushikiChara = koushikiWorks.filter((c) => c.corner === 'chara');
const koushikiCorners = corners.filter((k) => k.slug !== 'chara' && koushikiWorks.some((c) => c.corner === k.slug)).map((k) => k.name).join('・');
page({
  path: '/koushiki/',
  tab: 'koushiki',
  ads: false,
  crumbs: [{ name: 'トップ', path: '/' }, { name: '公式の最新情報', path: '/koushiki/' }],
  title: `${namesOf(koushikiChara)}の公式の最新情報（動画・お知らせ）｜${settings.siteName}`,
  // 作品が多いので、YouTube のある作品は3つ＋「など」まで（説明文は125字まで）
  description: `${koushikiChara.map((c) => c.name).join('・')}${koushikiCorners ? `と、${koushikiCorners}の作品` : ''}の公式サイト・公式Xへのリンクをまとめています。${namesOf(koushikiWorks.filter((c) => c.youtube?.length))}は、公式YouTubeチャンネルの新しい動画も出します。`,
  h1: '公式の最新情報',
  body:
    koushikiWorks
      .map(
        (c) =>
          `<section id="${esc(c.slug)}"><h2>${esc(c.name)}</h2>${c.youtube?.length ? `<!--yt:${esc(c.slug)}-->` : ''}<p class="oc">公式サイト・公式X</p><ul class="links">${(c.official ?? [])
            .map((o) => `<li><a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.name)}</a>${o.note ? `<span>${esc(o.note)}</span>` : ''}</li>`)
            .join('')}</ul></section>`,
      )
      .join('') +
    '<p class="asof end">動画は YouTube API サービスで、ページを開いたときに YouTube から取っています。このページを使うと<a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">YouTube 利用規約</a>に同意したことになります。</p>',
});

// ---- 読みもののページ ----
for (const a of yomiArticles) {
  const path = `/yomimono/${a.slug}/`;
  const { html, toc, shelves } = yomiBody(a);
  const hero = `<p class="yomi-hero"><img src="/yomimono/img/${a.hero}.webp" width="1200" height="600" alt="${esc(a.heroAlt)}" decoding="async" fetchpriority="high"></p>`;
  const dates = a.updated && a.updated !== a.published ? `${yomiDate(a.published)}に書いて、${yomiDate(a.updated)}に見なおしました` : `${yomiDate(a.published)}に書きました`;
  page({
    path,
    title: `${a.seoTitle}｜${settings.siteName}`,
    description: a.description,
    h1: a.title,
    crumbs: [{ name: 'トップ', path: '/' }, { name: '推し活の読みもの', path: '/yomimono/' }, { name: a.title, path }],
    body: `<article class="yomi-body">${hero}${toc}${html}${a.sources ? `<p class="more"><a href="${path}shiryou/">この記事を書くときに調べた資料</a></p>` : ''}<p class="yomi-date">${dates}。商品の棚は楽天市場から1日2回集めています</p></article>${shelves ? '<!--asof-->' : ''}`,
    ads: true,
    lastmod: a.updated || a.published,
    ogImage: `/yomimono/img/${a.hero}-og.jpg?v=${createHash('sha256').update(readFileSync(`src/yomimono/img/${a.hero}-og.jpg`)).digest('hex').slice(0, 8)}`,
    extraLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: a.title,
        image: [`${SITE}/yomimono/img/${a.hero}-og.jpg`],
        datePublished: a.published,
        dateModified: a.updated || a.published,
        author: { '@type': 'Organization', name: settings.siteName, url: `${SITE}/` },
        publisher: { '@type': 'Organization', name: settings.siteName, url: `${SITE}/` },
        inLanguage: 'ja',
      },
    ],
  });
}
// 調べた資料（楽天の商品を出さないページ。資料へのリンクはここだけ。検索には出さない）
for (const a of yomiArticles.filter((x) => x.sources)) {
  const src = readJson(`src/yomimono/sources/${a.sources}.json`, { checked: '', items: [] });
  const path = `/yomimono/${a.slug}/shiryou/`;
  page({
    path,
    title: `「${a.title}」で調べた資料｜${settings.siteName}`,
    description: `「${a.title}」を書くときに調べた${src.items.length}の資料と、それぞれを記事のどこに使ったかの一覧です。${src.checked ? `資料は${yomiDate(src.checked)}に開いて確かめました。` : ''}`,
    h1: `「${a.title}」で調べた資料`,
    crumbs: [{ name: 'トップ', path: '/' }, { name: '推し活の読みもの', path: '/yomimono/' }, { name: a.title, path: `/yomimono/${a.slug}/` }, { name: '調べた資料', path }],
    body: `<ul class="srcs">${src.items.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a><span>${esc(x.used)}</span></li>`).join('')}</ul><p class="asof">${src.checked ? `${yomiDate(src.checked)}に開いて確かめました。` : ''}リンク先は変わることがあります</p><p class="more"><a href="/yomimono/${a.slug}/">「${esc(a.title)}」にもどる</a></p>`,
    ads: false,
    noindex: 'follow',
  });
}
if (yomiArticles.length) {
  page({
    path: '/yomimono/',
    title: `推し活の読みもの（${yomiArticles.map((a) => a.title).slice(0, 3).join('・')}）｜${settings.siteName}`,
    description: sentence(`推し活の道具の選び方や作り方を、図でまとめた読みものです`, `いまあるのは${joinTo(yomiArticles.slice(0, 3).map((a) => `「${a.title}」`))}${yomiArticles.length > 3 ? 'など' : ''}です`, '記事に合う商品は楽天市場から1日2回集めています'),
    h1: '推し活の読みもの',
    crumbs: [{ name: 'トップ', path: '/' }, { name: '推し活の読みもの', path: '/yomimono/' }],
    body: yomiList(yomiArticles),
    lastmod: yomiArticles.map((a) => a.updated || a.published).sort().at(-1),
  });
}

// ---- 買い方メモ（/<作品>/kaikata/）：公式のお店・新作の出かた・予約・くじ・再販・見分け方・これからの予定 ----
// もとは src/kaikata/<作品>.json。楽天の商品を出さないページなので、公式のお店へのリンクを置ける（楽天の広告も出さない）
// 本文の [[文字|ページ]] は、その作品のページ（yoyaku・sainyuka・hatsubai など。koushiki は公式の最新情報）があるときだけリンクにする
// これからの予定（events）は until の日が過ぎたら出さない（1日2回の更新で消える）
{
  const built = new Set(pages.map((p) => p.path));
  const kkDate = (d, withYear) => (d.length === 7 ? `${Number(d.slice(0, 4))}年${Number(d.slice(5, 7))}月` : `${withYear ? `${Number(d.slice(0, 4))}年` : ''}${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`);
  for (const c of chars.filter((x) => hasKaikata(x.slug))) {
    const k = readJson(`src/kaikata/${c.slug}.json`);
    const base = `/${c.slug}/`;
    const path = `${base}kaikata/`;
    const link = (t) =>
      esc(t).replace(/\[\[([^|\]]+)\|([a-z]+)\]\]/g, (_, label, key) => {
        const href = key === 'koushiki' ? `/koushiki/#${c.slug}` : key === 'top' ? base : `${base}${key}/`;
        return key === 'koushiki' || built.has(href) ? `<a href="${href}">${label}</a>` : label;
      });
    const thisYear = today.slice(0, 4);
    const events = (k.events ?? []).filter((e) => e.until >= today).sort((a, b) => a.from.localeCompare(b.from));
    // from から（to があれば to まで）。until は出すのをやめる日の目安で、表には出さない
    const when = (e) => {
      const y = e.from.slice(0, 4) !== thisYear;
      return e.to ? `${kkDate(e.from, y)}〜${kkDate(e.to, e.to.slice(0, 4) !== e.from.slice(0, 4))}` : `${kkDate(e.from, y)}${e.from.length === 7 ? '' : 'から'}`;
    };
    const srcHtml = k.sources?.length
      ? `<details class="kk-src"><summary>このページで調べた資料</summary><ul class="srcs">${k.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.name)}</a><span>${esc(x.used)}</span></li>`).join('')}</ul></details>`
      : '';
    const end = `${srcHtml}<p class="yomi-date">${yomiDate(k.checked)}に、公式の発表とニュースで確かめました。グッズの出かたは変わることがあります</p>`;
    // お店は住所録、新作が出てから買うまでは点線でつないだ道のり（2026-10-27 しょーくんが3案から C）
    const flowIds = ['shinsaku', 'yoyaku', 'kuji', 'saihan'];
    const para = (s) => s.lines.map((t) => `<p>${link(t)}。</p>`).join('');
    const body =
      `<div class="kk"><section><h2>公式で買えるところ</h2><table class="kk-book"><tbody>${k.shops
        .map((s) => `<tr><th>${esc(s.kind)}</th><td><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a><span>${esc(s.note)}</span></td></tr>`)
        .join('')}<tr><th>楽天市場</th><td><a href="${base}">${esc(c.name)}グッズの新着</a><span>楽天市場のお店にあるものを、このサイトで1日2回集めています</span></td></tr></tbody></table></section>` +
      `<section><h2>新作が出てから買うまで</h2><ol class="kk-flow">${k.sections
        .filter((s) => flowIds.includes(s.id))
        .map((s, i) => `<li id="${s.id}"><span class="kn">${i + 1}</span><h3>${esc(s.h)}</h3>${para(s)}</li>`)
        .join('')}</ol></section>` +
      k.sections
        .filter((s) => !flowIds.includes(s.id))
        .map((s) => `<section id="${s.id}"><h2>${esc(s.h)}</h2>${para(s)}</section>`)
        .join('') +
      (events.length ? `<section id="yotei"><h2>これからの予定</h2><ul class="kk-days">${events.map((e) => `<li><time>${when(e)}</time><span>${esc(e.text)}。</span></li>`).join('')}</ul></section>` : '') +
      `</div>` +
      yomiLinksFor(c.slug, 'kaikata');
    // 説明文に入れるお店の名前。short があればそれを使い、空にしたお店は説明文に出さない（長い名前で説明文が長くなりすぎないように）
    const shopNames = k.shops
      .filter((s) => s.kind === 'お店' || s.kind === '通販')
      .map((s) => s.short ?? s.name)
      .filter(Boolean);
    const KK_SHORT = { shinsaku: '新作の出かた', yoyaku: '予約や受注生産', kuji: 'くじ', saihan: '再販', miwake: '公式の見分け方' };
    // 節の short があればそれを使う（受注生産が見つからなかった作品は「予約」だけにする、など）
    const topics = k.sections.map((s) => s.short ?? KK_SHORT[s.id]).filter(Boolean);
    page({
      path,
      tab: c.slug,
      crumbs: [{ name: 'トップ', path: '/' }, { name: c.name, path: base }, { name: '買い方メモ', path }],
      title: `${c.name}グッズはどこで買える？公式ショップ・通販と新作・再販の出かた｜${settings.siteName}`,
      description: sentence(`${c.name}グッズを公式で買えるところ（${shopNames.join('・')}）と、${topics.join('・')}を調べてまとめました`, `${yomiDate(k.checked)}に確かめた情報です`),
      h1: `${c.name}グッズの買い方メモ`,
      body: body + end,
      ads: false,
      lastmod: k.checked,
      extraLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Article',
          headline: `${c.name}グッズの買い方メモ`,
          datePublished: k.published || k.checked,
          dateModified: k.checked,
          author: { '@type': 'Organization', name: settings.siteName, url: `${SITE}/` },
          publisher: { '@type': 'Organization', name: settings.siteName, url: `${SITE}/` },
          inLanguage: 'ja',
        },
      ],
    });
  }
}

// ---- このサイトについて ----
page({
  path: '/about/',
  crumbs: [{ name: 'トップ', path: '/' }, { name: 'このサイトについて', path: '/about/' }],
  title: `このサイトについて｜${settings.siteName}`,
  description: `${settings.siteName}の運営者と広告について。中古や転売の出品を外す決まりと、「相場より高め」「値下がり」の印のつけ方も書いています。`,
  h1: 'このサイトについて',
  body: `<div class="text">
<p>${esc(settings.siteName)}は、楽天市場のキャラクターグッズの新着を1日2回集めて並べる、個人の非公式サイトです。権利者・楽天とは関係ありません。</p>
<h2>商品の選び方</h2>
<p>商品名にキャラ名が入っているものだけを載せています。中古、未使用品・未開封品の出品、映画の入場者特典などの非売品、トレーディングカード、「〜風」のような似せた商品、互換品、ノーブランド品は外しています。</p>
<p>「相場より高め」は、同じ商品を3つ以上のお店が出していて、真ん中の価格より1.5倍以上、500円以上高いものにつけています。</p>
<p>「値下がり」は、このサイトが前に確認した価格より安くなったものです。「再入荷」は、売り切れから買えるようになったものです。どちらも7日間表示します。</p>
<p>「予約受付中」の締切と発売の時期は、商品名に書いてあるものです。「販売期間◯/◯まで」は楽天市場の販売期間の終わりで、予約の締切とは限りません。楽天ブックスの予約は、楽天ブックスに載っている発売日の順です。買う前に楽天市場・楽天ブックスのページで確かめてください。</p>
<p>「新着」は、このサイトが初めて見つけた日の新しい順です。新作とは限りません。</p>
<p>推しキャラのページは、商品名にそのキャラの名前が入っているものを、見つけた新しい順に並べています。「わたしの推し」にすると、トップにその推しキャラの新着が並びます（3人まで）。「前に見てから◯件」は、前にこのサイトを見たあとに、このサイトが初めて見つけたグッズの数です。</p>
<p>クリスマスや福袋などの季節の特集は、その時期だけ、商品名に季節の言葉が入っているものを並べています。時期が過ぎたページは、次にはじまる日を知らせるページになります。</p>
<p>「予算で選ぶ」は、楽天市場の価格で分けています。送料が別の商品もあります。</p>
<p>「送料込み」「ラッピング対応」は、楽天市場の商品の情報です。お店によって、ラッピングが有料のことがあります。</p>
<p>「人気ランキング」は、楽天市場のランキングに入っているものと、楽天のレビューが多いものです。</p>
<p>「大人向け」は、商品名に「大人」「レディース」「メンズ」が入っているものと、財布・食器・アクセサリー・インテリアなどです。キッズやベビー用は外しています。「子ども向け」は、商品名にキッズ・子ども・小学生・ベビーなどが入っているものです。</p>
<p>ご当地グッズは、商品名に「ご当地」か「北海道限定」のような地名と限定が入っているものです。地方は商品名の地名から分けています。</p>
<p>「探す」は、そのときに楽天市場で探した結果です。ここでも中古やカードなどは外しています。</p>
<p>「発売日カレンダー」は、楽天ブックスに載っている発売日の順です。発売日は変わることがあります。</p>
<p>「推し活カレンダー」は、今日から来月の終わりまでの、日にちが決まった発売日・予約の締切・推しキャラの誕生日・季節のイベントです。スマホのカレンダーに入れるファイルには、推しキャラの誕生日だけを入れています。</p>
<p>「楽天ランキング入り」は、楽天市場のジャンル別のデイリーランキングに入っている商品です。「20代女性ランキング入り」「30代女性ランキング入り」は、楽天市場の年代・性別のランキングに入っている商品です。</p>
<p>レビューの件数、「ポイント10倍」のような倍率、タイムセールの終わる日時は、楽天市場の情報です。「前に売り切れたことあり」は、このサイトが売り切れを確かめたことのある商品です。</p>
<h2>広告について</h2>
<p>商品とバナーのリンクは楽天アフィリエイトの広告です。リンク先で買い物があると、運営者に紹介料が入ります。</p>
<h2>表示している情報</h2>
<p>商品の情報は、楽天ウェブサービスから取っています。価格や在庫は変わることがあるので、買う前に楽天市場のページで確かめてください。</p>
<h2>運営者</h2>
<p>しょーくん</p>
</div>`,
});

page({
  path: '/privacy/',
  crumbs: [{ name: 'トップ', path: '/' }, { name: 'プライバシーポリシー', path: '/privacy/' }],
  title: `プライバシーポリシー｜${settings.siteName}`,
  description: `${settings.siteName}のプライバシーポリシーです。会員登録はなく、名前やメールアドレスは集めていません。「わたしの推し」は見ている端末のブラウザの中だけに保存します。`,
  h1: 'プライバシーポリシー',
  body: `<div class="text">
<p>このサイトを使うと、このプライバシーポリシーと<a href="/terms/">利用規約</a>に同意したことになります。</p>
<p>このサイトは、会員登録やお問い合わせフォームがなく、名前やメールアドレスなどを集めていません。</p>
<h2>端末に保存するもの</h2>
<p>「わたしの推し」に選んだ推しキャラと、前にこのサイトを見た時刻を、見ている端末のブラウザの中だけに保存します。サイトや楽天には送りません。ブラウザのデータを消すと消えます。</p>
<p>読みもの「ご当地スヌーピーの買える場所と集め方」の、集めた都道府県のチェックも、見ている端末のブラウザの中だけに保存します。</p>
<h2>アクセス解析</h2>
<p>このサイトは、ページの見られ方を知るために、Cloudflare, Inc. の Cloudflare Web Analytics を使っています。Cookieは使わず、見たページ・参照元・ブラウザと端末の種類・国などを、個人がわからない形で集計します。</p>
<h2>広告</h2>
<p>このサイトは楽天アフィリエイトを利用しています。リンク先の楽天市場では、楽天グループのプライバシーポリシーにもとづいてCookieが使われます。</p>
<h2>YouTube</h2>
<p>公式の最新情報のページでは、YouTube API サービスを使って公式チャンネルの動画の情報を出しています。動画の情報はページを開いたときに YouTube から取るもので、このサイトでは保存しません。同じ情報を Cloudflare に1時間まで一時的にためることがあります。</p>
<p>動画の小さな画像は YouTube のサーバーから読みこむため、そのときに IP アドレスなどの端末の情報が Google に送られます。YouTube API サービスの利用には、<a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">YouTube の利用規約</a>と<a href="https://policies.google.com/privacy" target="_blank" rel="noopener">Google のプライバシーポリシー</a>が適用されます。</p>
</div>`,
});

// ---- 利用規約（YouTube API サービスの決まり III.A.1：このサイトを使うと YouTube 利用規約に同意したことになる） ----
page({
  path: '/terms/',
  crumbs: [{ name: 'トップ', path: '/' }, { name: '利用規約', path: '/terms/' }],
  title: `利用規約｜${settings.siteName}`,
  description: `${settings.siteName}の利用規約です。商品の情報は楽天市場のもので、公式の最新情報のページでは YouTube API サービスを使っています。`,
  h1: '利用規約',
  body: `<div class="text">
<p>このサイト（${esc(settings.siteName)}）を使うと、この利用規約と<a href="/privacy/">プライバシーポリシー</a>に同意したことになります。</p>
<h2>このサイトについて</h2>
<p>楽天市場のキャラクターグッズの情報を集めて並べる、個人の非公式サイトです。権利者・楽天とは関係ありません。</p>
<h2>商品の情報</h2>
<p>価格・在庫・発売日などは変わることがあります。買う前に、楽天市場のページで確かめてください。このサイトの情報によって生じたことについて、運営者は責任を負いません。</p>
<h2>広告</h2>
<p>商品とバナーのリンクは、楽天アフィリエイトの広告です。</p>
<h2>YouTube</h2>
<p>公式の最新情報のページでは、YouTube API サービスを使って公式チャンネルの動画の情報を出しています。このサイトを使うと、<a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">YouTube 利用規約</a>に同意したことになります。</p>
<h2>変更</h2>
<p>この利用規約は、予告なく変えることがあります。</p>
<p>2026年10月22日 制定</p>
</div>`,
});

page({
  path: '/404.html',
  title: `ページが見つかりません｜${settings.siteName}`,
  description: 'ページが見つかりません。',
  h1: 'ページが見つかりません',
  body: '<p class="text"><a href="/">トップへ</a></p>',
});

// ---- 書き出し ----
const files = new Map(pages.map((p) => [fileOf(p.path), p.html]));

const sitemapPages = pages.filter((p) => p.path !== '/404.html' && !p.noindex);
files.set(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapPages
    .map((p) => `<url><loc>${esc(`${SITE}${p.path}`)}</loc>${p.lastmod ? `<lastmod>${p.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')}\n</urlset>\n`,
);
// 検索の結果のページは、検索エンジンに回ってもらわない（楽天を何度も呼ばないため）
files.set('robots.txt', production ? `User-agent: *\nAllow: /\nDisallow: /search/\n\nSitemap: ${SITE}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n');
files.set(
  '_headers',
  production
    ? '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n/art/*\n  Cache-Control: public, max-age=31536000, immutable\n'
    : '/*\n  X-Robots-Tag: noindex, nofollow\n',
);
if (settings.indexNowKey) files.set(`${settings.indexNowKey}.txt`, settings.indexNowKey);
// ファビコン（ベリー色の四角に白い「推」）。src/icons/favicon.svg から作った画像
for (const f of readdirSync('src/icons')) files.set(f, readFileSync(join('src/icons', f)));
// ホーム画面に追加したときの名前とアイコン。display は browser（ふだんのブラウザで開くので、わたしの推しの保存がそのまま使える。
// standalone にすると iPhone ではブラウザと保存が分かれ、わたしの推しが空になる）
files.set(
  'manifest.webmanifest',
  JSON.stringify({
    name: settings.siteName,
    short_name: settings.siteShortName,
    lang: 'ja',
    start_url: '/',
    scope: '/',
    display: 'browser',
    background_color: '#ffffff',
    theme_color: '#FBD3E2',
    icons: [
      { src: `/icon-192.png?v=${ICON_V}`, sizes: '192x192', type: 'image/png' },
      { src: `/icon-512.png?v=${ICON_V}`, sizes: '512x512', type: 'image/png' },
    ],
  }),
);
// YouTube の公式ロゴ（src/brand/。1バイトも変えない）
files.set('youtube-logo.svg', readFileSync('src/brand/youtube-logo.svg'));
// 推しキャラの誕生日（スマホのカレンダーに入れるファイル）。このサイトが決めた日だけで、楽天のデータは入れない
if (birthdays.length)
  files.set(
    'calendar/oshi.ics',
    buildIcs({
      name: `推しキャラの誕生日（${settings.siteName}）`,
      stamp: '20261023T000000Z',
      events: [...birthdays].sort((a, b) => a.o.birthday.localeCompare(b.o.birthday)).map((b) => ({
        uid: `birthday-${b.c.slug}-${b.o.slug ?? b.c.slug}`,
        mmdd: b.o.birthday,
        summary: `${b.o.name}の誕生日`,
        url: `${SITE}${oshiPageSet.has(`${b.c.slug}/${b.o.slug}`) ? `/${b.c.slug}/${b.o.slug}/` : '/tanjoubi/'}`,
      })),
    }),
  );
// SNSで共有したときの画像（1200×630）
files.set('og.png', readFileSync('src/og.png'));
// サイトの絵（Canva で作った絵を WebP にしたもの。見た目の案の CSS が background で使う）
if (existsSync('src/art')) for (const f of readdirSync('src/art')) if (/\.(webp|svg|jpg)$/.test(f)) files.set(`art/${f}`, readFileSync(join('src/art', f)));
// 読みものの絵（Canva で作った絵を WebP にしたもの。記事の上と一覧・共有の画像）
for (const f of readdirSync('src/yomimono/img')) files.set(`yomimono/img/${f}`, readFileSync(join('src/yomimono/img', f)));

rmSync(OUT, { recursive: true, force: true });
for (const [path, content] of files) {
  const full = join(OUT, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}
console.log(`${files.size}ファイルを作りました（${production ? '本番' : 'プレビュー'}・見た目 ${theme}）。商品 ${latest.length}件（買える ${buyable.length}件）`);
// 検索に出すかどうかの記録（本当のデータで作ったときだけ。data/ は非公開）
// 買える商品がない日の作品のページの記録も残す（次に商品が戻ったとき、検索に出すかどうかを前の続きで決める）
for (const [path, v] of Object.entries(indexState)) if (!(path in nextIndexState) && noItemWorks.some((c) => path.startsWith(`/${c.slug}/`))) nextIndexState[path] = v;
if (!process.env.DATA_LATEST) writeJson(INDEX_STATE, Object.fromEntries(Object.entries(nextIndexState).sort(([a], [b]) => a.localeCompare(b))));
// 一度できた季節の特集のページの記録（期間が過ぎてもページを残すため）
if (!process.env.DATA_LATEST) writeJson(SEASON_SEEN, nextSeasonSeen);
const thinText = Object.entries(nextIndexState)
  .filter(([, s]) => !s.idx || s.below)
  .map(([p, s]) => `${p}${s.idx ? (s.below ? `（少ない日が${s.below}から）` : '') : '（検索に出さない）'}`)
  .join('・');
console.log(`商品が少なくて検索に出さない（出さなくなりそうな）ページ：${thinText || 'なし'}`);
// 送料込み・ラッピング対応の印がどれくらいつくか（楽天の項目が取れているかの確かめ）
const perkText = `送料込み ${buyable.filter((i) => i.postage === 0).length}件・送料別 ${buyable.filter((i) => i.postage === 1).length}件・ラッピング対応 ${buyable.filter((i) => i.gift === 1).length}件（買えるもの ${buyable.length}件）／予約受付中 ${chars.map((c) => `${c.name}${yoyakuFor(c.slug).total}`).join('・')}`;
console.log(perkText);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=送料込み・ラッピング対応・予約::${perkText}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=商品が少ないページ::${thinText || 'なし'}`);
// 推しキャラのページができたか（GitHub の実行ページの注釈に出す）
const noOshi = chars.flatMap((c) => (c.oshi ?? []).filter((o) => o.slug && !oshiPageSet.has(`${c.slug}/${o.slug}`)).map((o) => o.name));
const oshiText = `${oshiPages.length}ページ（${oshiPages.map((p) => `${p.o.name}${p.items.length}`).join('・')}）${noOshi.length ? `／グッズが少なくて作らなかった：${noOshi.join('・')}` : ''}／サイトマップ ${sitemapPages.length}件`;
console.log(`推しキャラのページ：${oshiText}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=推しキャラのページ::${oshiText}`);
const pickText = chars.map((c) => `${c.name}：ランキング${rankedFor(c.slug).length}・レビュー${reviewed(c.slug).length}・大人${adultFor(c.slug).length}・子ども${kidsFor(c.slug).length}`).join('／') + `／話題：${topicPages.map((x) => `${x.t.name}${x.items.length}`).join('・') || 'なし'}`;
console.log(`選び方のページ：${pickText}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=選び方のページ::${pickText}`);
const gotouchiText =
  [...gotouchiWorks.map((w) => `${w.c.name}${w.items.length}（${topPlaces(w.items).join('・')}）`), ...gotouchiSubs.map((x) => `${x.sub.name}${x.items.length}（${topPlaces(x.items).join('・')}）`)].join('・') || 'なし';
console.log(`ご当地のページ：${gotouchiText}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=ご当地のページ::${gotouchiText}`);
const seasonText = seasonPages.length
  ? seasonPages.map(({ s, works }) => `${s.name}：${works.map((w) => `${w.c.name}${w.items.length}`).join('・')}`).join('／')
  : '期間中の季節なし（または6件にとどかない）';
const nextBd = birthdays.slice(0, 3).map((b) => `${b.o.name}あと${b.days}日（${b.items.length}件）`).join('・');
console.log(`季節の特集のページ：${seasonText}／誕生日：${nextBd}`);
if (process.env.GITHUB_ACTIONS) console.log(`::notice title=季節の特集のページ::${seasonText}／誕生日：${nextBd}`);
