// 公開したサイトの「探す」が本当に楽天から商品を出せているか、公式の最新情報に YouTube の動画が出ているかを確かめる。
// 使い方：node scripts/check-search.mjs https://pr-5.oshi-techo.pages.dev（本番は https://nyuka-techo.com）

const base = (process.argv[2] ?? 'https://nyuka-techo.com').replace(/\/$/, '');
const strict = process.argv.includes('--strict');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const note = (ok, msg) => {
  console.log(`${ok ? 'OK' : 'NG'}  ${msg}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::${ok ? 'notice' : strict ? 'error' : 'warning'} title=探すの確認::${msg}`);
};

let bad = 0;
for (const [c, q] of [['chiikawa', 'ハチワレ'], ['pokemon', 'ピカチュウ']]) {
  const url = `${base}/search/?c=${c}&q=${encodeURIComponent(q)}&t=${Date.now()}`;
  let html = '';
  let status = 0;
  // 公開の直後は行きわたるまで少しかかるので、何回か試す
  for (let i = 0; i < 6; i++) {
    const res = await fetch(url).catch(() => null);
    status = res?.status ?? 0;
    html = res ? await res.text() : '';
    if (status === 200 && html.includes('<!--sr--><section')) break;
    await sleep(10000);
  }
  const cards = (html.match(/rel="sponsored nofollow noopener"/g) ?? []).length;
  const count = html.match(/楽天市場で([\d,]+)件/)?.[1] ?? '?';
  const ok = status === 200 && cards > 0;
  if (!ok) bad++;
  const names = [...html.matchAll(/<span class="nm">([^<]*)<\/span>/g)].slice(0, 5).map((m) => m[1].slice(0, 28)).join(' ／ ');
  note(ok, `${q}：HTTP ${status}・${cards}件表示（楽天で${count}件）${ok ? `・${names}` : html.includes('混みあって') ? '・楽天に聞けなかった' : ''}`);
}
// 公式の最新情報：ページを開いたときに YouTube から動画を取ってこられているか（題名はログに残さない）
{
  let html = '';
  let status = 0;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`${base}/koushiki/?t=${Date.now()}`).catch(() => null);
    status = res?.status ?? 0;
    html = res ? await res.text() : '';
    if (status === 200 && html.includes('<ul class="vids">')) break;
    await sleep(10000);
  }
  const vids = (html.match(/href="https:\/\/www\.youtube\.com\/watch\?v=/g) ?? []).length;
  const logos = (html.match(/<img src="\/youtube-logo\.svg"/g) ?? []).length;
  const ads = html.includes('hb.afl.rakuten.co.jp') || html.includes('<template class="bnt">');
  const ok = status === 200 && vids > 0 && logos > 0 && !ads;
  if (!ok) bad++;
  const msg = `公式の最新情報：HTTP ${status}・動画${vids}本・YouTubeのロゴ${logos}個・楽天の広告${ads ? 'あり' : 'なし'}`;
  console.log(`${ok ? 'OK' : 'NG'}  ${msg}`);
  if (process.env.GITHUB_ACTIONS) console.log(`::${ok ? 'notice' : strict ? 'error' : 'warning'} title=公式の最新情報の確認::${msg}`);
}
process.exit(bad && strict ? 1 : 0);
