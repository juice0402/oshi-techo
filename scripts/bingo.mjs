// 入荷ビンゴの記録（data/bingo.json。非公開の oshi-techo-data に戻る）を、いま載っている商品（data/latest.json）から積み上げる。
// update.yml の「集める」のあと・「作る」の前に動かす。失敗しても公開は止めない（ほかの fetch-*.mjs と同じ）。
// 残すのは、月・推しキャラ・種類・見つけた日だけ（商品名・値段・URL は残さない）。ログには数だけ。
import { readJson, writeJson } from './lib/util.mjs';
import { loadWorks } from './lib/load-works.mjs';
import { oshiMatcher } from './lib/classify.mjs';
import { mergeBingo, jstMonth } from './lib/bingo.mjs';

const note = (level, msg) => console.log(process.env.GITHUB_ACTIONS ? `::${level} title=入荷ビンゴ::${msg}` : msg);

try {
  const { works } = loadWorks();
  const latest = readJson('data/latest.json', []);
  const meta = readJson('data/meta.json', { fetchedAt: new Date().toISOString() });
  const oshis = works.flatMap((c) => (c.oshi ?? []).filter((o) => o.slug).map((o) => ({ key: `${c.slug}/${o.slug}`, c: c.slug, hit: oshiMatcher(o) })));
  let record = null;
  try {
    record = readJson('data/bingo.json', null);
  } catch (e) {
    note('warning', `記録が読めないので、いま載っている商品から作り直します：${String(e).slice(0, 120)}`);
  }
  const next = mergeBingo(record, latest, oshis, meta.fetchedAt);
  writeJson('data/bingo.json', next);
  const month = next.months[jstMonth(meta.fetchedAt)] ?? {};
  const marks = Object.values(month).reduce((s, card) => s + Object.keys(card).length, 0);
  note('notice', `今月の印 ${marks}マス（推しキャラ ${Object.keys(month).length}人）・記録 ${Object.keys(next.months).length}か月`);
} catch (e) {
  note('warning', `記録できませんでした：${String(e).slice(0, 160)}`);
}
process.exit(0);
