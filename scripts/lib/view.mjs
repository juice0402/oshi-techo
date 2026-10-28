// ページの部品。ページ作り（Node）と検索（Cloudflare）の両方で同じ形を使う。

import { esc, yen, jstMonthDay, jstMonthDayTime, rakutenTime } from './text.mjs';

const HOUR = 3600000;
const DAY = 24 * HOUR;

// 楽天の情報から出す、本当のことだけの印（レビューの件数・ポイント倍率・タイムセールや販売期間の終わり・送料込み・ラッピング対応）
// 予約の商品の endTime は「販売期間の終わり」として出す（予約の締切とは限らないため、締切とは書かない）
export function marksFor(it, nowIso) {
  const now = Date.parse(nowIso);
  const out = { review: '', extra: '', until: '', perks: perksOf(it) };
  if (it.reviews > 0) {
    out.review = `レビュー${Number(it.reviews).toLocaleString('ja-JP')}件`;
  }
  const ps = rakutenTime(it.pointStart);
  const pe = rakutenTime(it.pointEnd);
  const se = rakutenTime(it.end);
  if (it.pointRate >= 2 && pe - now > HOUR && !(ps > now)) {
    out.extra = `ポイント${it.pointRate}倍 ${jstMonthDayTime(new Date(pe).toISOString())}まで`;
    out.until = new Date(pe).toISOString();
  } else if (se - now > HOUR && se - now < (it.resv ? 92 : 14) * DAY) {
    out.extra = `${it.resv ? '販売期間' : 'タイムセール'} ${jstMonthDayTime(new Date(se).toISOString())}まで`;
    out.until = new Date(se).toISOString();
  }
  return out;
}

// 送料込み（楽天の postageFlag が 0）・ラッピング対応（giftFlag が 1）。わからないもの（項目がない）は出さない
const PERK_CLASS = { 送料込み: 's', ラッピング対応: 'g' };
export const perksOf = (it) => [it.postage === 0 && '送料込み', it.gift === 1 && 'ラッピング対応'].filter(Boolean);

// 画像の説明（商品名）。【送料無料】のような飾りを外して、長すぎないようにする
export const altOf = (name) =>
  String(name)
    .replace(/【[^】]*】|［[^］]*］|\[[^\]]*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);

// 商品1つ分のカード。リンク先は楽天市場（アフィリエイトのURL）
// size：楽天市場の画像は128px角、楽天ブックスは120px角。どちらも元の大きさより大きくしない
// rank：ランキングの印。review・extra・perks：marksFor の印。until：過ぎたら消す時刻。dl：締切の日（あと何日かは見た人の日付で出す）
// filt：しぼりこみ用の目印（値段と、送料込み s・ラッピング g・大人向け a・子ども向け k）。cat：種類（しおり用）。hidden：はじめは隠しておく（しぼりこんだときに出す）
// sortv：並べかえ用の目印（値段 data-p・レビューの件数 data-r）
export function cardHtml(it, { tag = '', note = '', high = false, eager = false, seen = '', shop = it.shop, go = '楽天市場で見る', size = 128, rank = '', review = '', extra = '', until = '', dl = '', perks = [], filt = '', hidden = false, cat = '', sortv = false } = {}) {
  return (
    `<li${filt || sortv ? ` data-p="${Number(it.price) || 0}"` : ''}${sortv ? ` data-r="${Number(it.reviews) || 0}"` : ''}${filt ? ` data-f="${esc(filt)}"` : ''}${cat ? ` data-c="${esc(cat)}"` : ''}${hidden ? ' hidden' : ''}><a href="${esc(it.url)}" target="_blank" rel="sponsored nofollow noopener">` +
    `<span class="ph"><img src="${esc(it.img)}" width="${size}" height="${size}"${size === 128 ? '' : ` class="s${size}"`} loading="${eager ? 'eager' : 'lazy'}" decoding="async" alt="${esc(altOf(it.name))}" onerror="this.parentNode.classList.add('none');this.remove()"></span>` +
    (tag ? `<span class="tg">${esc(tag)}</span>` : '') +
    (rank ? `<span class="rk">${esc(rank)}</span>` : '') +
    `<span class="nm">${esc(it.name)}</span>` +
    `<span class="pd"><b>${yen(it.price)}</b>${seen ? `<time datetime="${esc(seen)}">${jstMonthDay(seen)}</time>` : ''}</span>` +
    (perks.length ? `<span class="pk">${perks.map((p) => `<span class="${PERK_CLASS[p] ?? ''}">${esc(p)}</span>`).join('')}</span>` : '') +
    (review ? `<span class="rv">${esc(review)}</span>` : '') +
    (note ? `<span class="nt"${dl ? ` data-dl="${esc(dl)}"` : ''}>${esc(note)}</span>` : '') +
    (extra ? `<span class="nx"${until ? ` data-until="${esc(until)}"` : ''}>${esc(extra)}</span>` : '') +
    (high ? '<span class="hi">相場より高め</span>' : '') +
    (shop ? `<span class="sh">${esc(shop)}</span>` : '') +
    `<span class="go">${esc(go)}</span></a></li>`
  );
}

// 検索の並び順（楽天の sort の値）
export const SORTS = [
  { key: '', label: '標準', sort: 'standard' },
  { key: 'new', label: '新しい順', sort: '-updateTimestamp' },
  { key: 'low', label: '安い順', sort: '+itemPrice' },
  { key: 'review', label: 'レビューが多い順', sort: '-reviewCount' },
];

// しぼりこみの言葉
export const REFINE = ['ぬいぐるみ', 'キーホルダー', 'アクスタ', '缶バッジ', 'ポーチ', 'タオル'];

export const searchHref = ({ c = '', q = '', s = '', p = 1 }) => {
  const params = new URLSearchParams(c ? { c, q } : { q });
  if (s) params.set('s', s);
  if (p > 1) params.set('p', String(p));
  return `/search/?${params}`;
};

// キャラは手帳のインデックスのようなタブで選ぶ。並び順は結果の上の文字リンク
// 探す：言葉を入れる欄だけ。作品は言葉から見分ける（scripts/lib/search.mjs の detectWork）。
// c：いま探している作品（言葉に作品名がないときに続けて使う）。作品を選ぶボタンは置かない（2026-10-28 しょーくん「作品を選ぶ→テキストを打つがわかりにくい」）
export function searchFormHtml(chars, { c = '', q = '' } = {}) {
  return (
    `<form class="sf" action="/search/" method="get" role="search">` +
    (c ? `<input type="hidden" name="c" value="${esc(c)}">` : '') +
    `<div class="sfr"><input type="search" name="q" value="${esc(q)}" placeholder="ハチワレ ぬいぐるみ" maxlength="40" aria-label="探す言葉" enterkeyhint="search"><button type="submit">探す</button></div>` +
    `</form>`
  );
}

// 推しキャラのボタン（キャラごと）。pages：推しキャラのページがあるもの（「作品/推しキャラ」）。ないときは「探す」へ
export function oshiChipsHtml(char, { heading = true, pages = new Set(), current = '' } = {}) {
  if (!char.oshi?.length) return '';
  const chips = char.oshi
    .map((o) => {
      if (o.slug && o.slug === current) return `<li><span aria-current="page">${esc(o.name)}</span></li>`;
      const href = o.slug && pages.has(`${char.slug}/${o.slug}`) ? `/${char.slug}/${o.slug}/` : searchHref({ c: char.slug, q: o.name });
      return `<li><a href="${esc(href)}">${esc(o.name)}</a></li>`;
    })
    .join('');
  return `${heading ? `<p class="oc">${esc(char.name)}</p>` : ''}<ul class="chips">${chips}</ul>`;
}
