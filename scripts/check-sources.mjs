// 読みものの「調べた資料」（src/yomimono/sources/*.json）と、買い方メモの資料・公式のお店（src/kaikata/*.json）のリンクを、GitHub から開けるか確かめる
// 問題があれば Markdown を出して終了コード1（ワークフローが Issue にする）。Claude の使用量は使わない
// 資料を確かめた日（checked）が180日をこえたら、中身を確かめ直すよう知らせる
import { readdirSync, readFileSync } from 'node:fs';

const dir = 'src/yomimono/sources';
const list = new Map();
const checked = [];
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
  const src = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  checked.push([f.replace(/\.json$/, ''), src.checked]);
  for (const s of src.items ?? []) if (!list.has(s.url)) list.set(s.url, { ...s, where: f.replace(/\.json$/, '') });
}
// 買い方メモ：お店や日が変わりやすいので、確かめた日が90日をこえたら知らせる
const kkDir = 'src/kaikata';
const kkChecked = [];
for (const f of readdirSync(kkDir).filter((x) => x.endsWith('.json'))) {
  const k = JSON.parse(readFileSync(`${kkDir}/${f}`, 'utf8'));
  const where = `買い方メモ ${f.replace(/\.json$/, '')}`;
  kkChecked.push([where, k.checked]);
  for (const s of [...(k.shops ?? []), ...(k.sources ?? [])]) if (!list.has(s.url)) list.set(s.url, { ...s, where });
}

const UA = 'Mozilla/5.0 (compatible; nyuka-techo-linkcheck; +https://nyuka-techo.com/about/)';
const open = async (u) => {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(u, { redirect: 'follow', headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
      await r.body?.cancel();
      if (r.status < 400) return '';
      if (i) return `返事 ${r.status}`;
    } catch (e) {
      if (i) return `つながらない（${e.cause?.code || e.name}）`;
    }
    await new Promise((ok) => setTimeout(ok, 5000));
  }
  return '';
};

const bad = [];
const blocked = [];
// 1件ずつだと資料がふえて10分をこえるので、6件ずつ同時に開く（結果の並びは資料の順のまま）
const items = [...list.values()];
const whys = new Array(items.length);
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < items.length) {
    const i = next++;
    whys[i] = await open(items[i].url);
  }
}));
for (const [i, s] of items.entries()) {
  const why = whys[i];
  // gh: false は、GitHub からだと断られる資料（WebFetch で中身を確かめた）。知らせるだけで止めない
  if (why && s.gh === false) {
    blocked.push(`- [${s.name}](${s.url})：${why}`);
    continue;
  }
  // 403・429 は、断られただけで消えたとは限らない（site-principles.md の「出典とリンク」）
  if (why) bad.push(`- [${s.name}](${s.url})（${s.where}）：${why}${/40[3]|429/.test(why) ? '（断られただけかもしれない）' : ''}`);
}
const days = (iso) => Math.floor((Date.now() - Date.parse(`${iso}T00:00:00+09:00`)) / 86400000);
const old = [...checked.filter(([, d]) => d && days(d) >= 180), ...kkChecked.filter(([, d]) => d && days(d) >= 90)].map(([n, d]) => `- ${n}：確かめた日 ${d} から ${days(d)} 日`);

console.log(`読みものと買い方メモの資料 ${list.size} 件を点検しました。`);
if (blocked.length) console.log(`\n### GitHub からは開けない資料（前に確かめたもの・止めない）\n${blocked.join('\n')}`);
if (!bad.length && !old.length) process.exit(0);
if (bad.length) console.log(`\n### 開けない資料（${bad.length}件）\n${bad.join('\n')}\n\n同じ発行元の新しいページに移っていないか確かめて、src/yomimono/sources/ か src/kaikata/ を直してください。`);
if (old.length) console.log(`\n### 確かめた日が古い\n${old.join('\n')}\n\n資料を開いて記事の中身が今も正しいか確かめ、checked を直してください。`);
process.exit(1);
