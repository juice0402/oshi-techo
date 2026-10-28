// 文字と日付の小さな道具。ページ作り（Node）と検索（Cloudflare）の両方で使うので、
// node: の部品は読みこまない。

// 商品名を、除外・キャラ判定のために比べやすくする（表示には使わない）
export function normalize(s) {
  return String(s).normalize('NFKC').toLowerCase();
}

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const yen = (n) => `${Math.round(Number(n)).toLocaleString('ja-JP')}円`;

// 日本時間の「2026-10-18」
export function jstDate(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(d);
}

// 日本時間の「10/18」
export function jstMonthDay(iso) {
  const [, m, d] = jstDate(new Date(iso)).split('-');
  return `${Number(m)}/${Number(d)}`;
}

// 日本時間の「10/18 16:20」
export function jstMonthDayTime(iso) {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  return `${jstMonthDay(iso)} ${time}`;
}

// 楽天の「2026-10-20 01:59」（日本時間）を時刻の数字に。読めないときは NaN
export function rakutenTime(s) {
  const m = String(s ?? '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  return m ? Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:00+09:00`) : NaN;
}

// 「2026-10-18」→「10/18」
export const mdOf = (ymd) => `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`;
