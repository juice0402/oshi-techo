// スマホのカレンダーに入れるファイル（iCalendar、RFC 5545）。このサイトが決めた日（推しキャラの誕生日・季節のイベント）だけを入れる。
// 楽天のデータ（商品名・発売日など）は入れない（楽天の規約 第10条9号：ファイルとして公開しない）。

const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

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

// events：[{ uid, mmdd: 'MM-DD', summary, url }]（毎年くり返す1日の予定）。2月29日は「2月の最後の日」にする
export function buildIcs({ name, events, stamp }) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//nyuka-techo.com//oshi-calendar//JA', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(name)}`, 'X-WR-TIMEZONE:Asia/Tokyo'];
  for (const e of events) {
    const [m, d] = e.mmdd.split('-');
    const leap = e.mmdd === '02-29';
    const start = `2024${m}${leap ? '29' : d}`; // 2024年（うるう年）からくり返す
    const next = new Date(Date.UTC(2024, Number(m) - 1, Number(leap ? 29 : d) + 1)).toISOString().slice(0, 10).replace(/-/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.uid}@nyuka-techo.com`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${start}`,
      `DTEND;VALUE=DATE:${next}`,
      leap ? 'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1' : 'RRULE:FREQ=YEARLY',
      `SUMMARY:${esc(e.summary)}`,
      `URL:${e.url}`,
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
