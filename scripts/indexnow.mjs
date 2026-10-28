// 公開したあと、IndexNow（Bing など）に「中身が変わったページ」だけを知らせる。
// 失敗しても公開は止めない（お知らせなので）。前回の中身の指紋は data/page-hashes.json に残す。

import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readJson, writeJson } from './lib/util.mjs';

const settings = readJson('config/settings.json');
const key = settings.indexNowKey;
if (!key) {
  console.log('IndexNow のキーがないので送りません');
  process.exit(0);
}

const site = new URL(settings.siteUrl);
const urls = [...readFileSync('dist/sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const before = readJson('data/page-hashes.json', {});
const after = {};
const changed = [];
for (const u of urls) {
  const p = new URL(u).pathname;
  const file = join('dist', p.endsWith('/') ? `${p}index.html` : p);
  if (!existsSync(file)) continue;
  const body = readFileSync(file, 'utf8').replace(/<p class="asof">[^<]*<\/p>/g, '');
  after[u] = createHash('sha256').update(body).digest('hex').slice(0, 16);
  if (before[u] !== after[u]) changed.push(u);
}
writeJson('data/page-hashes.json', after);

const note = (level, msg) => {
  console.log(msg);
  if (process.env.GITHUB_ACTIONS) console.log(`::${level} title=IndexNow::${msg}`);
};

if (changed.length === 0) {
  note('notice', '変わったページがないので送りません');
  process.exit(0);
}

try {
  const res = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: site.host, key, keyLocation: `${site.origin}/${key}.txt`, urlList: changed }),
  });
  note(res.ok ? 'notice' : 'warning', `${changed.length}ページを知らせました（HTTP ${res.status}）`);
} catch (e) {
  note('warning', `送れませんでした（${e.message}）`);
}
