// 楽天ブックス総合検索API（2017-04-04版）。本・CD・DVD・ゲームなどの発売日（salesDate）が取れる。
// 発売日カレンダーに使う。node: の部品は使わない。

import { HEADERS } from './rakuten-core.mjs';

export const BOOKS_ENDPOINT = 'https://openapi.rakuten.co.jp/services/api/BooksTotal/Search/20170404';

export function booksUrl({ keys, keyword, page = 1 }) {
  const params = new URLSearchParams({
    applicationId: keys.appId,
    accessKey: keys.accessKey,
    affiliateId: keys.affiliateId,
    keyword,
    hits: '30',
    page: String(page),
    sort: '-releaseDate', // 発売日が新しい順（これから発売のものが先）
    outOfStockFlag: '1', // 品切れも取る（発売日の情報として）
    formatVersion: '2',
  });
  return `${BOOKS_ENDPOINT}?${params}`;
}

export { HEADERS };

// 楽天ブックスのジャンル（上の3けた）
const KINDS = { '001': '本', '002': 'CD', '003': 'DVD・Blu-ray', '004': 'ソフト', '005': '洋書', '006': 'ゲーム', '007': '雑誌' };
// ゲームのジャンルにはおもちゃ・フィギュアも入っているので、ゲーム機の名前がないものは「おもちゃ」にする
const CONSOLE = /switch|playstation|ps[345]|xbox|nintendo|3ds|windows|mac|steam/i;
export const kindOf = (genreId, hardware = '') => {
  const top = String(genreId ?? '').split('/')[0].slice(0, 3);
  if (top === '006' && !CONSOLE.test(String(hardware))) return 'おもちゃ';
  return KINDS[top] ?? '';
};

// 「2026年11月20日」「2026年11月下旬」「2026年11月」「2027年春」「2026年頃」を、並べ替え用の日付と表示用の言葉にする
export function parseSalesDate(s) {
  const t = String(s ?? '').normalize('NFKC').replace(/\s/g, '');
  let m = t.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  const pad = (n) => String(n).padStart(2, '0');
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    return { ymd: `${y}-${pad(mo)}-${pad(d)}`, month: `${y}-${pad(mo)}`, label: `${mo}/${d}`, exact: true, approx: /頃|予定/.test(t) };
  }
  m = t.match(/(\d{4})年(\d{1,2})月(上旬|中旬|下旬|末)?/);
  if (m) {
    const [y, mo] = [Number(m[1]), Number(m[2])];
    const part = m[3] ?? '';
    const day = { 上旬: '05', 中旬: '15', 下旬: '25', 末: '28' }[part] ?? '31';
    return { ymd: `${y}-${pad(mo)}-${day}`, month: `${y}-${pad(mo)}`, label: `${mo}月${part}`, exact: false, approx: true };
  }
  m = t.match(/(\d{4})年(春|夏|秋|冬)?/);
  if (m) {
    const y = Number(m[1]);
    const season = m[2] ?? '';
    const mo = { 春: '04', 夏: '07', 秋: '10', 冬: '12' }[season] ?? '12';
    return { ymd: `${y}-${mo}-31`, month: `${y}-${mo}`, label: `${y}年${season}`, exact: false, approx: true, year: true };
  }
  return null;
}

// 返事から、使う項目だけの形にする
export function parseBooks(json) {
  const raw = json?.Items ?? json?.items ?? [];
  return raw.map((r) => {
    const it = r.Item ?? r.item ?? r;
    return {
      code: String(it.isbn || it.jan || it.itemUrl || ''),
      name: String(it.title ?? ''),
      price: Number(it.itemPrice ?? 0),
      url: String(it.affiliateUrl ?? ''),
      img: String(it.mediumImageUrl ?? ''),
      maker: String(it.label || it.publisherName || it.artistName || it.author || ''),
      hardware: String(it.hardware ?? ''),
      sales: String(it.salesDate ?? ''),
      avail: Number(it.availability ?? 0), // 5 = 予約受付中
      kind: kindOf(it.booksGenreId, it.hardware),
    };
  });
}
