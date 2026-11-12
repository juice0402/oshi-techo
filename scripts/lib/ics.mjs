// スマホのカレンダーに入れるファイル（iCalendar、RFC 5545）。このサイトが決めた日（推しキャラの誕生日・季節のイベント・買い方メモの予定）だけを入れる。
// 楽天のデータ（商品名・発売日など）は入れない（楽天の規約 第10条9号：ファイルとして公開しない）。

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

// 75オクテットごとに折り返す（文字の途中では切らない）
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = '';
  let size = 0;
  for (const ch of line) {
    const n = enc.encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      size = 0;
    }
    cur += ch;
    size += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const ymd = (s) => s.replace(/-/g, '');
// その日の翌日（YYYYMMDD）
const dayAfter = (y, m, d) => new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10).replace(/-/g, '');

// events：毎年くり返す1日の予定 { uid, mmdd: 'MM-DD', summary, url }（2月29日は「2月の最後の日」にする）か、
// 1回だけの予定 { uid, from: 'YYYY-MM-DD', to?: 'YYYY-MM-DD', summary, url, description? }（DTEND は to か from の翌日）
export function buildIcs({ name, events, stamp }) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//nyuka-techo.com//oshi-calendar//JA', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:Asia/Tokyo'];
  for (const e of events) {
    let when;
    if (e.mmdd) {
      const [m, d] = e.mmdd.split('-');
      const leap = e.mmdd === '02-29';
      // 2024年（うるう年）からくり返す
      when = [`DTSTART;VALUE=DATE:2024${m}${leap ? '29' : d}`, `DTEND;VALUE=DATE:${dayAfter(2024, Number(m), Number(leap ? 29 : d))}`, leap ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY'];
    } else {
      const last = e.to && e.to > e.from ? e.to : e.from;
      const [y, m, d] = last.split('-').map(Number);
      when = [`DTSTART;VALUE=DATE:${ymd(e.from)}`, `DTEND;VALUE=DATE:${dayAfter(y, m, d)}`];
    }
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@nyuka-techo.com`,
      `DTSTAMP:${stamp}`,
      ...when,
      `SUMMARY:${esc(e.summary)}`,
      ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
      `URL:${e.url}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
