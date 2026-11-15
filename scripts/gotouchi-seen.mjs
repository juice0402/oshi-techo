// ご当地の見つけた記録（data/gotouchi-seen.json。非公開の oshi-techo-data に戻る）を、いま載っている商品（data/latest.json）から積み上げる。
// 作品ごと（ご当地キティは sanrio/kitty）・都道府県ごとに、初めて見つけた日 f と最後に見た日 l。ご当地の一覧には、いま商品のある県しか出ないため。
// update.yml の「入荷ビンゴの記録を足す」のあと・「作る」の前に動かす。失敗しても公開は止めない（scripts/bingo.mjs と同じ）。
// 残すのは作品・県の id・日付だけ（商品の番号・名前・値段・URL は残さない）。ログには数だけ。
// 見本で試すときは DATA_LATEST・DATA_META・DATA_GOTOUCHI_SEEN で読む場所と書く場所を変える。
import { readJson, writeJson, jstDate } from './lib/util.mjs';
import { loadWorks } from './lib/load-works.mjs';
import { oshiMatcher } from './lib/classify.mjs';
import { mergeGotouchiSeen } from './lib/gotouchi-seen.mjs';

const note = (level, msg) => console.log(process.env.GITHUB_ACTIONS ? `::${level} title=ご当地の記録::${msg}` : msg);
const OUT = process.env.DATA_GOTOUCHI_SEEN ?? 'data/gotouchi-seen.json';

try {
  const { works } = loadWorks();
  const latest = readJson(process.env.DATA_LATEST ?? 'data/latest.json', []);
  const meta = readJson(process.env.DATA_META ?? 'data/meta.json', { fetchedAt: new Date().toISOString() });
  const subs = works.flatMap((c) => (c.gotouchiSub ?? []).filter((s) => s.slug).map((s) => ({ key: `${c.slug}/${s.slug}`, c: c.slug, hit: oshiMatcher(s) })));
  let record = null;
  try {
    record = readJson(OUT, null);
  } catch (e) {
    note('warning', `記録が読めないので、いま載っている商品から作り直します：${String(e).slice(0, 120)}`);
  }
  const next = mergeGotouchiSeen(record, latest, jstDate(new Date(meta.fetchedAt)), subs);
  writeJson(OUT, next);
  const prefs = Object.values(next.works).reduce((s, w) => s + Object.keys(w).length, 0);
  note('notice', `ご当地の記録：作品 ${Object.keys(next.works).length}・県 ${prefs}`);
} catch (e) {
  note('warning', `記録できませんでした：${String(e).slice(0, 160)}`);
}
process.exit(0);
