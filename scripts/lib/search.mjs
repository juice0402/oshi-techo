// 検索ページ（/search/?c=キャラ&q=言葉）の中身。探したときに、その場で楽天市場に聞く。
// Cloudflare Pages Functions（functions/search/）から使う。テストでは Node から使う。
// 取った商品は表示するだけで、どこにも保存しない（楽天の規約 第10条9号）。

import { judge } from './filter.mjs';
import { reservationInfo, oshiMatcher } from './classify.mjs';
import { searchUrl, parseItems, ngWords, HEADERS } from './rakuten-core.mjs';
import { cardHtml, marksFor, SORTS, REFINE, searchHref } from './view.mjs';
import { esc, jstMonthDayTime, mdOf, normalize } from './text.mjs';

export const MAX_PAGE = 30;

// 言葉から作品を見分ける。作品名・探す言葉・商品名の見分けに使う言葉（match）と、推しキャラの名前で。
// 推しキャラのうち、名前だけでは別の物とまぎれるもの（full がある：うさぎ・ねこ・スライムなど）は使わない。strict の名前は言葉の切れ目で見る。
// 言葉の中でいちばん前に出てくる作品にする（同じ所なら長い言葉のほう、それも同じなら設定の順）
export function detectWork(q, chars) {
  const nq = normalize(q);
  if (!nq.trim()) return null;
  let best = null;
  const consider = (c, pos, len) => {
    if (pos < 0) return;
    if (!best || pos < best.pos || (pos === best.pos && len > best.len)) best = { c, pos, len };
  };
  for (const c of chars) {
    const words = [c.name, ...(c.keywords ?? []), ...(c.match ?? [])]
      .flatMap((w) => [w, ...String(w).split(/[\s:：・]+/)])
      .map((w) => normalize(w).trim())
      .filter((w) => [...w].length >= 2);
    for (const w of new Set(words)) consider(c, nq.indexOf(w), w.length);
    for (const o of c.oshi ?? []) {
      if (o.full) continue;
      if (oshiMatcher(o)(nq)) consider(c, nq.indexOf(normalize(o.name)), normalize(o.name).length);
    }
  }
  return best?.c ?? null;
}

// char：言葉から見分けた作品。言葉に作品がないときは c の作品。どちらもないときは null（どの作品で探すかを聞く）
export function readQuery(url, chars) {
  const sp = url.searchParams;
  const q = String(sp.get('q') ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 40);
  const char = detectWork(q, chars) ?? chars.find((x) => x.slug === sp.get('c')) ?? null;
  const s = SORTS.some((x) => x.key && x.key === sp.get('s')) ? sp.get('s') : '';
  const p = Math.min(MAX_PAGE, Math.max(1, parseInt(sp.get('p') ?? '1', 10) || 1));
  return { char, q, s, p };
}

export function pageTitle({ char, q, p }, settings) {
  const what = !char ? `「${q}」を探す` : q ? `「${q}」の${char.name}グッズ` : `${char.name}グッズを探す`;
  return `${what}${p > 1 ? `（${p}ページ目）` : ''}｜${settings.siteName}`;
}

// 作品の一覧（コーナーごと）。言葉はそのままで、作品だけつけて探すリンク
function workLinks(q, chars, corners, skip = '') {
  const groups = corners.map((k) => [k, chars.filter((x) => x.corner === k.slug && x.slug !== skip)]).filter(([, l]) => l.length);
  return groups
    .map(([k, l]) => `<p class="oc">${esc(k.name)}</p><ul class="chips">${l.map((x) => `<li><a href="${esc(searchHref({ c: x.slug, q }))}">${esc(x.name)}</a></li>`).join('')}</ul>`)
    .join('');
}

// 言葉に作品名もキャラ名もないとき：楽天には聞かず、どの作品で探すかを選んでもらう
export function renderPick({ q, chars, corners }) {
  return `<section class="sr spick"><h2>どの作品で探しますか</h2>${workLinks(q, chars, corners)}</section>`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 楽天に聞く。うまくいかないときは error に 'words'（言葉の問題）か 'busy'（混んでいる・設定の問題）
export async function fetchResults({ keys, char, q, s, p, fetchImpl = globalThis.fetch }) {
  if (!keys.appId || !keys.accessKey || !keys.affiliateId) return { ok: false, error: 'busy', detail: 'no keys' };
  const url = searchUrl({
    keys,
    keyword: [...new Set([char.keywords[0], ...q.split(' ').filter(Boolean)])].join(' '),
    page: p,
    ngKeyword: ngWords(char),
    sort: SORTS.find((x) => x.key === s)?.sort ?? 'standard',
    availability: '1',
    withCount: true,
  });
  for (let attempt = 1; attempt <= 2; attempt++) {
    let res;
    try {
      res = await fetchImpl(url, { headers: HEADERS });
    } catch (e) {
      if (attempt < 2) {
        await sleep(1200);
        continue;
      }
      return { ok: false, error: 'busy', detail: String(e) };
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await sleep(1200);
      continue;
    }
    if (res.status === 404) return { ok: true, items: [], count: 0, pageCount: 0 };
    const text = await res.text();
    if (res.status === 400) return { ok: false, error: 'words', detail: text.slice(0, 200) };
    if (!res.ok) return { ok: false, error: 'busy', detail: `HTTP ${res.status} ${text.slice(0, 200)}` };
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, error: 'busy', detail: 'not json' };
    }
    return {
      ok: true,
      items: parseItems(json),
      count: Number.isFinite(Number(json.count)) ? Number(json.count) : null,
      pageCount: Number(json.pageCount) || 0,
    };
  }
  return { ok: false, error: 'busy', detail: 'retry' };
}

const MESSAGES = {
  words: 'その言葉では探せませんでした。ほかの言葉で試してください。',
  busy: 'いま混みあっています。少し待ってから、もう一度試してください。',
};

export function renderResults({ char, q, s, p, result, settings, nowIso, chars = [], corners = [] }) {
  const head = `<h2>${q ? `「${esc(q)}」の${esc(char.name)}グッズ` : `${esc(char.name)}の検索結果`}${p > 1 ? `（${p}ページ目）` : ''}</h2>`;
  const sorts = `<p class="so">${SORTS.map((x) =>
    x.key === s ? `<b>${esc(x.label)}</b>` : `<a href="${esc(searchHref({ c: char.slug, q, s: x.key }))}">${esc(x.label)}</a>`,
  ).join('')}</p>`;
  if (!result.ok) return `<section class="sr">${head}<p class="text">${MESSAGES[result.error] ?? MESSAGES.busy}</p></section>`;

  const shown = result.items.filter((it) => it.avail !== 0 && judge(it, char, settings).keep);
  // 件数は結果の上、価格の時刻は結果のいちばん下
  const asof = result.count === null ? '' : `<p class="asof">楽天市場で${result.count.toLocaleString('ja-JP')}件</p>`;
  const asofEnd = `<p class="asof end">${jstMonthDayTime(nowIso)} 時点の価格</p>`;

  let body;
  if (result.count === 0 || (result.items.length === 0 && p === 1)) {
    body = '<p class="text">見つかりませんでした。言葉を短くすると見つかることがあります。</p>';
  } else if (shown.length === 0) {
    body = '<p class="text">このページには、載せられる商品がありませんでした。</p>';
  } else {
    body = `<ul class="grid">${shown
      .map((it, i) => {
        const r = reservationInfo(it, nowIso);
        const note = r?.deadline ? `締切 ${mdOf(r.deadline)}` : r?.label ?? '';
        const m = marksFor({ ...it, resv: r }, nowIso);
        return cardHtml(it, { tag: r ? '予約' : '', note, dl: r?.deadline ?? '', eager: i < 4, review: m.review, extra: m.extra, until: m.until, perks: m.perks });
      })
      .join('')}</ul>`;
  }

  // ページ送り（楽天は100ページまで。ここでは30ページまで）
  const last = Math.min(MAX_PAGE, result.pageCount || (result.items.length >= 30 ? p + 1 : p));
  const pager =
    last > 1
      ? `<nav class="pager" aria-label="ページ">${p > 1 ? `<a href="${esc(searchHref({ c: char.slug, q, s, p: p - 1 }))}">前のページ</a>` : '<span></span>'}<span>${p}／${last}</span>${p < last ? `<a href="${esc(searchHref({ c: char.slug, q, s, p: p + 1 }))}">次のページ</a>` : '<span></span>'}</nav>`
      : '';

  // しぼりこみ
  const nq = normalize(q);
  const words = REFINE.filter((w) => !nq.includes(normalize(w)));
  const refine = result.count && words.length
    ? `<div class="refine"><p class="oc">しぼりこむ</p><ul class="chips">${words
        .map((w) => `<li><a href="${esc(searchHref({ c: char.slug, q: `${q} ${w}`.trim(), s }))}">${esc(w)}</a></li>`)
        .join('')}</ul></div>`
    : '';

  // ほかの作品で同じ言葉を探す（言葉に作品名がないときに、別の作品でもすぐ試せるように）
  const others = chars.length && q && !detectWork(q, chars) ? `<details class="sfo"><summary>ほかの作品で「${esc(q)}」を探す</summary>${workLinks(q, chars, corners, char.slug)}</details>` : '';

  return `<section class="sr">${head}${asof}${result.count ? sorts : ''}${body}${pager}${refine}${others}${asofEnd}</section>`;
}

// 静的な /search/ のページに、検索の結果を入れる
export function fillTemplate(tpl, { title, form, results }) {
  return tpl
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/<!--sf-->[\s\S]*?<!--\/sf-->/, `<!--sf-->${form}<!--/sf-->`)
    .replace('<!--sr--><!--/sr-->', `<!--sr-->${results}<!--/sr-->`);
}
