// 読みもの（config/yomimono.json）の記事に出す、楽天市場の棚を集めて data/yomimono.json にする（非公開の記録）。
// 棚ごとに1ページ（30件。pages を書くとそのページ数まで）を、レビューが多い順・買えるものだけで探し、商品名に棚の言葉があるものだけ残す。
// うまくいかなくても、ほかの公開は止めない（前の記録を使う）。

import { searchPage } from './lib/rakuten.mjs';
import { judge } from './lib/filter.mjs';
import { readJson, writeJson } from './lib/util.mjs';

const settings = readJson('config/settings.json');
const articles = readJson('config/yomimono.json', []);
const OUT = 'data/yomimono.json';
const KEEP = 12; // 棚ごとに残す数（ページに出すのは8つまで。売り切れなどで減っても棚が空かないように）
const note = (level, msg) => {
  console.log(msg);
  if (process.env.GITHUB_ACTIONS) console.log(`::${level} title=読みものの棚::${msg}`);
};

const cleanHead = (name, n) => name.replace(/【[^】]*】|＼[^／]*／|\[[^\]]*\]|★[^★]*★/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const items = [];
const counts = {};
let calls = 0;
try {
  for (const a of articles) {
    for (const s of a.shelves ?? []) {
      const id = `${a.slug}/${s.id}`;
      // 棚の言葉を「作品の名前」とみなして、除外のしくみ（filter.mjs の judge）をそのまま使う
      const rule = { match: s.match, exclude: s.exclude ?? [], excludeRe: [] };
      const seen = new Set();
      // お店ちがいの同じ商品は1回だけ（商品名のはじめ32文字が同じものは、レビューが多いほうを残す）
      const twins = new Set();
      for (let page = 1; page <= (s.pages ?? 1) && seen.size < KEEP; page++) {
      calls++;
      const { items: found } = await searchPage({ keyword: s.keyword, page, sort: '-reviewCount', availability: '1', ngKeyword: '中古' });
      for (const it of found) {
        if (seen.size >= KEEP) break;
        if (!judge(it, rule, settings).keep || seen.has(it.code)) continue;
        // head：棚の言葉が、商品名のはじめ（宣伝の【】＼／を除いて head 文字まで）にあるものだけ。言葉をたくさん並べた別の商品をよけるため
        if (s.head && !s.match.some((w) => cleanHead(it.name, s.head).includes(w))) continue;
        const twin = cleanHead(it.name, 999).replace(/\s/g, '').slice(0, 32);
        if (twins.has(twin)) continue;
        twins.add(twin);
        seen.add(it.code);
        items.push({ shelf: id, code: it.code, name: it.name, price: it.price, url: it.url, img: it.img, shop: it.shop, avail: it.avail, reviews: it.reviews, rating: it.rating, postage: it.postage, gift: it.gift });
      }
      if (found.length < 30) break;
      }
      counts[id] = seen.size;
    }
  }
} catch (e) {
  note('warning', `集められませんでした（前の記録を使います）：${String(e.message ?? e).slice(0, 160)}`);
  process.exit(0);
}

writeJson(OUT, { fetchedAt: new Date().toISOString(), items });
note('notice', `呼び出し ${calls}回 / 棚 ${JSON.stringify(counts)}`);
// 棚に並ぶ商品名（まざりものがないかを PR の注記で見るため。8件まで・短く）
// GitHub の注記は1つのステップで10個までなので、記事ごとに1つにまとめる（棚は改行 %0A で区切る）
for (const a of articles) {
  const lines = [];
  for (const id of Object.keys(counts).filter((k) => k.startsWith(`${a.slug}/`))) {
    const names = items.filter((i) => i.shelf === id).slice(0, 8).map((i) => cleanHead(i.name, 26));
    if (names.length) lines.push(`${id}：${names.join(' ／ ')}`);
  }
  if (lines.length) note('notice', lines.join('%0A'));
}
