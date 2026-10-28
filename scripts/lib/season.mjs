// 季節の特集と誕生日の日付の計算。日付はすべて日本時間の「YYYY-MM-DD」。
import { normalize } from './text.mjs';

// 今日が季節の期間に入っていれば、その期間（年をまたぐ「11-01〜01-31」もよい）。入っていなければ null
export function seasonWindow(season, today) {
  const md = today.slice(5);
  const y = Number(today.slice(0, 4));
  const wraps = season.from > season.to;
  const inside = wraps ? md >= season.from || md <= season.to : md >= season.from && md <= season.to;
  if (!inside) return null;
  const startYear = wraps && md <= season.to ? y - 1 : y;
  const endYear = wraps && md >= season.from ? y + 1 : y;
  // 名前に入れる年は、期間が終わる年（福袋は11月・12月なら来年）
  return { start: `${startYear}-${season.from}`, end: `${endYear}-${season.to}`, year: endYear };
}

export const activeSeasons = (seasons, today) =>
  seasons.map((s) => ({ ...s, win: seasonWindow(s, today) })).filter((s) => s.win);

// 言葉の中の {year} を、名前に入れる年にする（来年の手帳なら 2027）
const fillYear = (w, season) => w.replace('{year}', String(season.win?.year ?? ''));

// 商品名に季節の言葉が入っているか。require があれば、それも全部入っているもの（「手帳」＋「2027」）
export function seasonMatcher(season) {
  const words = season.words.map((w) => normalize(fillYear(w, season)));
  const req = (season.require ?? []).map((w) => normalize(fillYear(w, season)));
  return (name) => {
    const n = normalize(name);
    return words.some((w) => n.includes(w)) && req.every((r) => n.includes(r));
  };
}

// 楽天で探す言葉（作品名のあとにつける）
export const seasonKeywords = (season) => (season.keywords ?? [season.keyword]).map((k) => fillYear(k, season));

const isLeap = (y) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// 次の誕生日（今日をふくむ）。2月29日生まれは、うるう年でない年は2月28日に数える
export function nextBirthday(mmdd, today) {
  const y = Number(today.slice(0, 4));
  const on = (yy) => (mmdd === '02-29' && !isLeap(yy) ? `${yy}-02-28` : `${yy}-${mmdd}`);
  const date = on(y) >= today ? on(y) : on(y + 1);
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
  return { date, days };
}

// 「11-01」→「11月1日」
export const mdLabel = (mmdd) => `${Number(mmdd.slice(0, 2))}月${Number(mmdd.slice(3, 5))}日`;
