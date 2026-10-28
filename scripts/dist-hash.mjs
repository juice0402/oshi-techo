// dist/ と検索の関数の中身の指紋を出す。「◯時点の価格」の時刻は除くので、
// 商品や見た目が変わったときだけ指紋が変わる（変わったときだけ公開するため）。

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir).sort()) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk('dist');
// 検索（Cloudflare の関数）とその部品が変わったときも公開し直す
walk('functions');
walk('scripts/lib');

const hash = createHash('sha256');
for (const f of files) {
  const body = readFileSync(f, 'utf8').replace(/<p class="asof">[^<]*<\/p>/g, '');
  hash.update(`${f}\n${body}\n`);
}
console.log(hash.digest('hex'));
