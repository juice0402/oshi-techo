// 自動テスト：除外ルールと、作ったページ（dist/）が決まりを守っているかを確かめる。
// 使い方：node scripts/test.mjs （先に node scripts/build.mjs を実行しておく）

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { judge } from './lib/filter.mjs';
import { readJson } from './lib/util.mjs';
import { loadWorks } from './lib/load-works.mjs';

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`OK  ${msg}`);
  else {
    failed++;
    console.log(`NG  ${msg}`);
    // GitHub の実行ページの注釈にも出す（スマホやAPIから、どれがNGか見られるように）
    if (process.env.GITHUB_ACTIONS) console.log(`::error title=テスト::${String(msg).replace(/[\r\n]+/g, ' ').slice(0, 300)}`);
  }
};

// 1. 除外ルール
const { works: chars, corners } = loadWorks();
const settings = readJson('config/settings.json');
const chiikawa = chars.find((c) => c.slug === 'chiikawa');
const pokemon = chars.find((c) => c.slug === 'pokemon');
const base = { code: 'shop:1', url: 'https://hb.afl.rakuten.co.jp/hgc/x/', img: 'https://thumbnail.image.rakuten.co.jp/x.jpg', price: 1000 };
ok(judge({ ...base, name: 'ちいかわ ぬいぐるみ S' }, chiikawa, settings).keep, 'ちいかわのぬいぐるみは載せる');
ok(!judge({ ...base, name: 'ちいかわ風 くま ぬいぐるみ' }, chiikawa, settings).keep, '「ちいかわ風」は載せない');
ok(!judge({ ...base, name: 'くま ぬいぐるみ' }, chiikawa, settings).keep, 'キャラ名がない商品は載せない');
ok(!judge({ ...base, name: 'ちいかわ 互換 ケース' }, chiikawa, settings).keep, '「互換」は載せない');
ok(['18禁', 'R-18', 'R18', '成人向け', 'アダルトグッズ', 'ヌード'].every((w) => !judge({ ...base, name: `ちいかわ タペストリー ${w}` }, chiikawa, settings).keep), '大人向け（18禁・R18・成人向け）の商品は載せない');
ok(judge({ ...base, name: 'ちいかわ パジャマ アダルトサイズ M' }, chiikawa, settings).keep, '大人の服のサイズ（アダルトサイズ）は載せる');
// コーナーの形で外すもの（ゲームソフト・楽天ブックスの本やCD・くじの賞品）。グッズは残す
{
  const dq = chars.find((c) => c.slug === 'dragonquest');
  const bsd = chars.find((c) => c.slug === 'bungo-stray-dogs');
  if (dq && bsd) {
    const t = (c, name) => judge({ ...base, name }, c, settings).keep;
    ok(!t(dq, 'ドラゴンクエストIII そして伝説へ…- Switch') && !t(dq, 'アルティメット ヒッツ ドラゴンクエストV 天空の花嫁') && !t(dq, '星のカービィ ドラゴンクエスト スターアライズ スイッチ'), 'ゲームソフト（- Switch・廉価版・名前の最後がスイッチ）は載せない');
    ok(t(dq, 'ドラゴンクエスト スライム 収納ケース Nintendo Switch') && t(dq, 'ドラゴンクエスト スライム ぬいぐるみ'), 'Switch のケースやぬいぐるみは載せる');
    ok(!t(bsd, '文豪ストレイドッグス 49 [ 朝霧 カフカ ]') && !t(bsd, '文豪ストレイドッグス 小説 （角川文庫）') && !t(bsd, '文豪ストレイドッグス キャラクターソング CD'), '楽天ブックスの本・文庫・CD は載せない');
    ok(!t(bsd, 'バンプレスト 一番くじ 文豪ストレイドッグス A賞 フィギュア') && !t(bsd, '文豪ストレイドッグス B賞 タオル'), 'くじの賞品は載せない');
    ok(t(bsd, '文豪ストレイドッグス アクリルスタンド 太宰治') && t(bsd, '文豪ストレイドッグス CDケース 収納'), 'アクスタや CD ケースは載せる');
  }
}
ok(!judge({ ...base, name: 'ポケモンカードゲーム 拡張パック BOX' }, pokemon, settings).keep, 'ポケカは載せない');
ok(!judge({ ...base, name: 'ポケモン シングルカード ピカチュウ' }, pokemon, settings).keep, 'シングルカードは載せない');
ok(judge({ ...base, name: 'ポケモンセンター ピカチュウ ぬいぐるみ' }, pokemon, settings).keep, 'ピカチュウのぬいぐるみは載せる');
ok(!judge({ ...base, name: 'ちいかわ マグ', price: 0 }, chiikawa, settings).keep, '価格がない商品は載せない');
ok(!judge({ ...base, name: 'ちいかわ ハチワレ ぬいぐるみ【未使用品】' }, chiikawa, settings).keep && !judge({ ...base, name: 'ちいかわ マスコット 新品未開封' }, chiikawa, settings).keep, '未使用品・未開封品の出品は載せない');
ok(!judge({ ...base, name: '映画 ちいかわ 人魚の島のひみつ 入場者特典 第4弾 チャームミニフィギュア' }, chiikawa, settings).keep && !judge({ ...base, name: 'ちいかわ ボンボンドロップシール【非売品】' }, chiikawa, settings).keep, '映画の入場者特典・非売品は載せない');
ok(!judge({ ...base, name: 'アソートポケモンカードパック くじ オリパ' }, pokemon, settings).keep && judge({ ...base, name: 'ポケモン カードケース ピカチュウ' }, pokemon, settings).keep, 'ポケモンのオリパ・カードパックは載せない（カードケースは載せる）');
ok(!judge({ ...base, name: 'ちいかわ マグ', img: '' }, chiikawa, settings).keep, '画像がない商品は載せない');

// 推しキャラ：ページの場所が、ほかのページとかぶらない。名前の見分け
{
  const { CATEGORIES, oshiMatcher } = await import('./lib/classify.mjs');
  const seasons = readJson('config/seasons.json');
  const topicsCfg = readJson('config/topics.json');
  const reserved = new Set(['new', 'yoyaku', 'nesage', 'sainyuka', 'hatsubai', 'yosan', 'gotouchi', 'ranking', 'otona', 'kids', 'kaikata', ...topicsCfg.map((t) => t.slug), ...CATEGORIES.map((k) => k.slug), ...seasons.map((x) => x.slug)]);
  const rootPages = new Set(['search', 'koushiki', 'about', 'privacy', 'terms', 'tanjoubi', 'gotouchi', 'calendar', ...chars.map((c) => c.slug)]);
  ok(seasons.every((x) => /^[a-z]+$/.test(x.slug) && !rootPages.has(x.slug) && /^\d\d-\d\d$/.test(x.from) && /^\d\d-\d\d$/.test(x.to) && x.words.length && x.label && (!x.event || /^\d\d-\d\d$/.test(x.event))), '季節の特集：場所・期間・言葉・イベントの日の設定がそろっている');
  for (const c of chars) {
    const slugs = (c.oshi ?? []).filter((o) => o.slug).map((o) => o.slug);
    ok(slugs.every((x) => /^[a-z0-9-]+$/.test(x) && !reserved.has(x)) && new Set(slugs).size === slugs.length, `推しキャラ：${c.name}のページの場所がかぶらない`);
    ok((c.oshi ?? []).every((o) => typeof o === 'object' && o.name), `推しキャラ：${c.name}の推しキャラに名前がある`);
  }
  const belle = oshiMatcher({ name: 'ベル', match: ['belle'], strict: true });
  ok(belle('スヌーピー ベル ぬいぐるみ') && belle('PEANUTS Belle マグ') && !belle('スヌーピー ラベル シール') && !belle('スヌーピー ベルト'), '推しキャラ：「ベル」と「ラベル」「ベルト」を分ける');
  const { activeSeasons, nextBirthday } = await import('./lib/season.mjs');
  const at = (d) => activeSeasons(seasons, d).map((x) => `${x.slug}${x.win.year}`).join(' ');
  ok(at('2026-10-21') === 'halloween2026 christmas2026 fukubukuro2027 techo2027' && at('2026-10-19') === 'halloween2026 christmas2026 techo2027' && at('2026-11-15') === 'christmas2026 fukubukuro2027 techo2027' && at('2027-01-05') === 'fukubukuro2027 oshougatsu2027 techo2027' && at('2027-07-01') === '', '季節の特集：期間と、名前に入れる年（福袋・手帳は11月なら来年）');
  const { seasonMatcher, seasonKeywords } = await import('./lib/season.mjs');
  const techo = activeSeasons(seasons, '2026-10-21').find((x) => x.slug === 'techo');
  const tm = seasonMatcher(techo);
  ok(tm('ちいかわ 手帳 2027 B6') && tm('スヌーピー 日めくりカレンダー 2027年') && !tm('ちいかわ 手帳 2026') && !tm('ちいかわ マグ 2027') && seasonKeywords(techo).join('・') === '手帳 2027・カレンダー 2027', '季節の特集：来年の手帳・カレンダーは「手帳」と「2027」の両方');
  ok(nextBirthday('10-31', '2026-10-21').days === 10 && nextBirthday('02-29', '2026-10-21').date === '2027-02-28' && nextBirthday('02-29', '2027-10-21').date === '2028-02-29' && nextBirthday('10-21', '2026-10-21').days === 0, '誕生日：次の誕生日（2月29日生まれは、うるう年でない年は2月28日）');
  const { regionOf, isGotouchi } = await import('./lib/region.mjs');
  ok(isGotouchi('【飛騨高山限定】ちいかわ ご当地 ぬいぐるみ') && isGotouchi('北海道限定　ちいかわ　メロン') && !isGotouchi('ちいかわ 当店限定 マグ') && !isGotouchi('ちいかわ ぬいぐるみ'), 'ご当地：「ご当地」か「地名＋限定」だけ');
  ok(regionOf('【飛騨高山限定】ちいかわ').pref === '岐阜' && regionOf('東京都限定 ちいかわ').pref === '東京' && regionOf('ちいかわ 京都限定').area.name === '近畿' && regionOf('ご当地キティ 草津温泉').pref === '群馬' && regionOf('ちいかわ マグ') === null, 'ご当地：地名から都道府県と地方（「東京都」は京都にしない）');
  const { isAdult, isKids } = await import('./lib/classify.mjs');
  ok(isAdult('ちいかわ 長財布 レディース') && isAdult('ポケモン マグカップ') && !isAdult('ちいかわ キッズ 財布') && !isAdult('ポケモン ぬいぐるみ') && !isAdult('大人気 ちいかわ BIGぬいぐるみ') && !isAdult('ちいかわ インテリア ぬいぐるみ') && isAdult('大人用 ちいかわ ぬいぐるみ') && !isAdult('ちいかわ マグカップ付箋') && !isAdult('ちいかわ ぷにジェル 6歳 7歳 大人') && isKids('ちいかわ ぷにジェル 6歳 7歳 大人') && isKids('サンリオ 女の子 Tシャツ') && !isKids('スヌーピー メンズ Tシャツ'), '大人向け・子ども向けの見分け');
  ok(topicsCfg.every((t) => chars.some((c) => c.slug === t.work) && t.title && t.h1 && t.words.length && /^\d{4}-\d\d-\d\d$/.test(t.until ?? '2099-12-31')), '話題：作品・名前・言葉・期限の設定がそろっている');
  const mew = oshiMatcher({ name: 'ミュウ', match: ['mew'], strict: true });
  ok(mew('ポケモン ミュウ ぬいぐるみ') && !mew('ポケモン ミュウツー フィギュア') && !mew('Pokemon Mewtwo'), '推しキャラ：「ミュウ」と「ミュウツー」を分ける');
  const kitty = oshiMatcher({ name: 'ハローキティ', match: ['キティ', 'hello kitty'] });
  ok(kitty('ＨＥＬＬＯ ＫＩＴＴＹ ポーチ') && kitty('サンリオ キティちゃん マグ'), '推しキャラ：ほかの書き方でも見つける');
}

// 予約の締切・発売の時期と、楽天の情報の印（送料込み・ラッピング対応・販売期間）
{
  const { reservationInfo } = await import('./lib/classify.mjs');
  const { marksFor } = await import('./lib/view.mjs');
  const { parseItems } = await import('./lib/rakuten-core.mjs');
  const at = '2026-10-22T03:00:00.000Z';
  const r = (name, extra = {}) => reservationInfo({ name, ...extra }, at);
  ok(r('ちいかわ マスコット 予約', { end: '2026-11-10 23:59' }).deadline === '', '予約：販売期間の終わり（endTime）は締切にしない');
  ok(r('ちいかわ 予約 受付期間10/1〜10/31').deadline === '2026-10-31' && r('ちいかわ 予約 11/5まで').deadline === '2026-11-05', '予約：商品名に書いてある締切（受付期間は終わりの日）');
  ok(r('ポケモン カレンダー《11月予約》').label === '11月予約' && r('ちいかわ シーサー《05月予約》').release === '2027-05-15', '予約：「《11月予約》」の書き方（来年の月も）');
  ok(r('ポケモン カレンダー 11月7日発売予定 ご予約').label === '11月7日発売' && r('【予約 2027年2月中旬頃の発送予定】クロミ').label === '2027年2月中旬発送' && r('ちいかわ 予約 11/30発売').release === '2026-11-30', '予約：日にち・「頃の」・11/30 の書き方');
  ok(r('ポケモン カレンダー 10月17日発売 予約') === null, '予約：日にちまで書いてある発売日が過ぎたものは、予約にしない');
  const resv = r('ちいかわ マスコット 予約');
  const m1 = marksFor({ name: 'x', resv, end: '2026-11-10 23:59', postage: 0, gift: 1 }, at);
  ok(m1.extra === '販売期間 11/10 23:59まで' && m1.perks.join('・') === '送料込み・ラッピング対応', '印：予約の商品は「販売期間◯/◯まで」、送料込み・ラッピング対応');
  const m2 = marksFor({ name: 'x', end: '2026-10-25 23:59', postage: 1, gift: 0 }, at);
  ok(m2.extra === 'タイムセール 10/25 23:59まで' && m2.perks.length === 0 && marksFor({ name: 'x', postage: null, gift: null }, at).perks.length === 0, '印：予約でない商品はタイムセール、送料別・わからないときは印なし');
  const [p] = parseItems({ Items: [{ itemCode: 'a:1', itemName: 'ちいかわ', postageFlag: 0, giftFlag: 1 }] });
  const [q] = parseItems({ Items: [{ itemCode: 'a:2', itemName: 'ちいかわ' }] });
  ok(p.postage === 0 && p.gift === 1 && q.postage === null && q.gift === null, '印：楽天の postageFlag・giftFlag を読む（ないときは「わからない」）');
}

// 2. 作ったページ
const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else files.push(p);
  }
};
walk('dist');
const html = files.filter((f) => f.endsWith('.html'));

// コーナー（config/corners/）：作品の置き場所・URL・見た目のファイル・関数の読みこみ
{
  const cornerFiles = readdirSync('config/corners').filter((f) => f.endsWith('.json'));
  const raw = cornerFiles.map((f) => [f, readJson(`config/corners/${f}`)]);
  ok(raw.every(([f, c]) => `${c.slug}.json` === f), 'コーナーのファイル名と slug がそろっている');
  const cornerSlugs = new Set(raw.map(([, c]) => c.slug));
  const declared = readJson('config/characters.json').map((c) => c.corner).filter(Boolean);
  ok(declared.every((x) => cornerSlugs.has(x)), `characters.json の corner はあるコーナーだけ（${[...new Set(declared)].join('・') || 'なし'}）`);
  const slugs = chars.map((c) => c.slug);
  const dup = slugs.filter((x, i) => slugs.indexOf(x) !== i);
  ok(dup.length === 0, `作品の slug が重なっていない${dup.length ? `（${dup.join('・')}）` : ''}`);
  const reserved = new Set(['search', 'koushiki', 'calendar', 'tanjoubi', 'gotouchi', 'about', 'terms', 'privacy', 'techo', ...cornerSlugs, ...readJson('config/seasons.json', []).map((x) => x.slug)]);
  const clash = slugs.filter((x) => reserved.has(x));
  ok(clash.length === 0, `作品の slug がコーナー・全体のページと重ならない${clash.length ? `（${clash.join('・')}）` : ''}`);
  ok(chars.every((c) => /^[a-z0-9-]+$/.test(c.slug) && (c.oshi ?? []).every((o) => !o.slug || /^[a-z0-9-]+$/.test(o.slug))), '作品と推しキャラの slug は英小文字・数字・ハイフンだけ');
  ok(chars.every((c) => c.keywords?.length && c.match?.length && c.name), '作品に name・keywords・match がある');
  for (const fn of ['functions/search/[[path]].js', 'functions/koushiki/[[path]].js']) {
    const src = readFileSync(fn, 'utf8');
    ok(cornerFiles.every((f) => src.includes(`config/corners/${f}`)), `${fn}：コーナーのファイルを全部読みこんでいる`);
  }
  // 作ったページ：作品があって商品があるコーナーには、コーナーのトップと、コーナーの切りかえ
  const live = corners.filter((k) => k.slug !== 'chara' && chars.some((c) => c.corner === k.slug));
  for (const k of live) {
    const p = `dist/${k.slug}/index.html`;
    if (!existsSync(p)) continue;
    const s2 = readFileSync(p, 'utf8');
    ok(s2.includes('<nav class="corners" aria-label="コーナー">') && s2.includes(`href="/${k.slug}/" aria-current="page"`), `${p}：コーナーの切りかえがあり、いまのコーナーにペンの丸`);
  }
}
// 入荷メモ（作品のトップ）：件数を出さない・5行まで・記録の出どころを書く。見本データでは、ちいかわに入荷の増え方と売り切れまでの日数が出る
{
  const memos = chars
    .map((c) => [c.slug, existsSync(`dist/${c.slug}/index.html`) ? readFileSync(`dist/${c.slug}/index.html`, 'utf8').match(/<section class="memo[^"]*">([\s\S]*?)<\/section>/) : null])
    .filter(([, m]) => m);
  ok(memos.length > 0, `入荷メモがある（${memos.length}作品）`);
  ok(memos.every(([, m]) => !/\d+\s*件/.test(m[1].replace(/<[^>]+>/g, ''))), '入荷メモに件数を出していない');
  ok(memos.every(([, m]) => (m[1].match(/<li>/g) ?? []).length <= 5 && m[1].includes('class="asof"')), '入荷メモは5行まで・記録の出どころがある');
  if (process.env.DATA_LATEST) {
    const ch = memos.find(([s]) => s === 'chiikawa')?.[1][1] ?? '';
    ok(ch.includes('その前の3週間より多い') && ch.includes('売り切れるまでが短め（まんなかで3日ほど）'), '入荷メモ：記録がたまると、入荷の増え方と売り切れまでの日数が出る（見本）');
  }
}
// 読みもの（/yomimono/）：図の中に字を入れない（字は HTML）・計算の道具はどこにも送らない・絵に大きさの指定・調べた資料へのリンク
{
  const arts = readJson('config/yomimono.json', []);
  for (const a of arts) {
    const p = `dist/yomimono/${a.slug}/index.html`;
    ok(existsSync(p), `${p} がある`);
    if (!existsSync(p)) continue;
    const s2 = readFileSync(p, 'utf8');
    const svgs = [...s2.matchAll(/<svg[\s\S]*?<\/svg>/g)].map((m) => m[0]);
    ok(svgs.length >= 5 && svgs.every((x) => !/<text[\s>]/.test(x)), `${p}：図が5つ以上あり、図の中に字を入れていない（${svgs.length}こ）`);
    ok(!/fetch\(|XMLHttpRequest|sendBeacon|localStorage/.test(s2.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/, '').match(/<div class="fit"[\s\S]*?<\/script>/)?.[0] ?? ''), `${p}：計算の道具はどこにも送らず、何も残さない`);
    ok(/<p class="yomi-hero"><img src="\/yomimono\/img\/[a-z0-9-]+\.webp" width="1200" height="600" alt="[^"]+"/.test(s2), `${p}：記事の絵に大きさと説明の指定がある`);
    if (a.sources) ok(s2.includes(`href="/yomimono/${a.slug}/shiryou/"`) && existsSync(`dist/yomimono/${a.slug}/shiryou/index.html`), `${p}：調べた資料のページがある`);
  }
}
// 買い方メモ（/<作品>/kaikata/。src/kaikata/<作品>.json）：楽天の商品と広告を出さない、作品のトップからつなぐ、終わった予定は出さない
{
  const dir = 'src/kaikata';
  const KK_IDS = new Set(['shinsaku', 'yoyaku', 'kuji', 'saihan', 'miwake']);
  const ymd = /^\d{4}-\d{2}-\d{2}$/;
  const today = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
  for (const f of existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith('.json')) : []) {
    const slug = f.replace(/\.json$/, '');
    const k = readJson(`${dir}/${f}`);
    const shape =
      chars.some((c) => c.slug === slug) &&
      ymd.test(k.checked) &&
      k.shops?.length >= 2 &&
      k.shops.every((x) => x.kind && x.name && x.note && /^https:\/\//.test(x.url)) &&
      k.sections?.length >= 3 &&
      k.sections.every((x) => KK_IDS.has(x.id) && x.h && x.lines?.length) &&
      (k.events ?? []).every((e) => /^\d{4}-\d{2}(-\d{2})?$/.test(e.from) && ymd.test(e.until) && (!e.to || ymd.test(e.to)) && e.text) &&
      k.sources?.length >= 3 &&
      k.sources.every((x) => x.name && x.used && /^https:\/\//.test(x.url));
    ok(shape, `買い方メモ ${slug}：作品・確かめた日・お店・節・予定・資料がそろっている`);
    const p = `dist/${slug}/kaikata/index.html`;
    ok(existsSync(p), `${p} がある`);
    if (!existsSync(p)) continue;
    const s2 = readFileSync(p, 'utf8');
    ok(!s2.includes('hb.afl.rakuten.co.jp') && !s2.includes('<p class="ad">'), `${p}：楽天の商品と広告を出さない`);
    ok(k.shops.every((x) => s2.includes(`href="${x.url}" target="_blank" rel="noopener"`)), `${p}：公式のお店へのリンクがある`);
    ok(!/\[\[|\]\]/.test(s2), `${p}：中のページへのリンクの印が残っていない`);
    const past = (k.events ?? []).filter((e) => e.until < today);
    ok(past.every((e) => !s2.includes(e.text)), `${p}：終わった予定を出さない`);
    ok(readFileSync(`dist/${slug}/index.html`, 'utf8').includes(`<a href="/${slug}/kaikata/">買い方メモ</a>`), `${p}：作品のトップからつながる`);
  }
}
ok(files.length < 1000, `ファイル数が少ない（${files.length}件、上限2万件）`);
for (const need of ['dist/index.html', 'dist/about/index.html', 'dist/privacy/index.html', 'dist/404.html', 'dist/sitemap.xml', 'dist/robots.txt', ...chars.flatMap((c) => [`dist/${c.slug}/index.html`, `dist/${c.slug}/new/index.html`])]) {
  ok(files.includes(need), `${need} がある`);
}
ok(!files.some((f) => f.endsWith('.json')), 'データファイルを公開していない');
// もっと見るのリンクに件数は出さない（「これだけしかない」と思われないように）
ok(!html.some((f) => /<p class="more"><a [^>]*>[^<]*（\d+件）/.test(readFileSync(f, 'utf8'))), 'もっと見るのリンクに件数を出していない');

// 検索結果での見え方（2026-10-26 サイト作りの原則）：説明文はページのデータから作る・値段は幅・同じ説明文を作らない・サイト名
{
  const metas = html.map((f) => [f, readFileSync(f, 'utf8').match(/<meta name="description" content="([^"]*)"/)?.[1] ?? '']);
  const short = metas.filter(([f, d]) => !f.endsWith('404.html') && (d.length < 50 || d.length > 125));
  ok(short.length === 0, `説明文は50〜125字${short.length ? `（${short.slice(0, 3).map(([f, d]) => `${f} ${d.length}字`).join('、')}）` : ''}`);
  const dataShort = metas.filter(([f, d]) => /\/(new|yoyaku|nesage|sainyuka|yosan|ranking|otona|kids|hatsubai)\/index\.html$/.test(f) && d.length < 70);
  // 見本データは商品が少ないので、本当のデータのときだけ確かめる
  if (!process.env.DATA_LATEST) ok(dataShort.length === 0, `商品を並べるページの説明文は70字以上${dataShort.length ? `（${dataShort.slice(0, 3).map(([f]) => f).join('、')}）` : ''}`);
  const seen = new Map();
  for (const [f, d] of metas) seen.set(d, [...(seen.get(d) ?? []), f]);
  const dup = [...seen.values()].filter((v) => v.length > 1);
  ok(dup.length === 0, `同じ説明文のページがない${dup.length ? `（${dup[0].join('、')}）` : ''}`);
  const exact = metas.filter(([, d]) => /\d円(?!台|未満|以下|以上|まで)/.test(d));
  ok(exact.length === 0, `説明文の値段はピッタリではなく「◯円台」の幅${exact.length ? `（${exact[0][0]}）` : ''}`);
  const banned = metas.filter(([, d]) => /おすすめ|オススメ|お得|便利|簡単|安心|ぜひ|しましょう/.test(d));
  ok(banned.length === 0, `説明文に使わない言葉がない${banned.length ? `（${banned[0][0]}）` : ''}`);
  ok(html.every((f) => readFileSync(f, 'utf8').includes(`<meta property="og:site_name" content="${settings.siteName}">`)), '全ページに og:site_name（サイト名）');
  const top = readFileSync('dist/index.html', 'utf8');
  const ld = JSON.parse(top.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const site = [].concat(ld).find((x) => x['@type'] === 'WebSite');
  ok(site && site.name === settings.siteName && site.alternateName === settings.siteShortName && site.url === settings.siteUrl, 'トップに WebSite の構造化データ（name・alternateName・url）');
  ok(top.includes(`<title>${settings.siteName}｜`), 'トップの title はサイト名から始まる');
  ok(!files.some((f) => /\.(html|xml|txt)$/.test(f) && readFileSync(f, 'utf8').includes('oshi-techo.pages.dev')), '古い pages.dev のURLがページに残っていない');
  if (process.env.DATA_LATEST) {
    const d = (p) => metas.find(([f]) => f === join('dist', p))?.[1] ?? '';
    ok(/^楽天市場のちいかわグッズを1日2回集めています。\d+\/\d+までの7日で見つけた新着は\d+件、予約受付中は\d+件です。/.test(d('chiikawa/index.html')), `作品のページの説明文に新着と予約の数（${d('chiikawa/index.html')}）`);
  }
}
for (const icon of ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png']) ok(files.includes(join('dist', icon)), `ファビコン ${icon} がある`);
// ファビコンの目印は、いまの絵の中身から作ったもの（絵を変えたら目印も変わる）
const iconV = (await import('node:crypto'))
  .createHash('sha1')
  .update(['favicon.svg', 'favicon.ico', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'].map((f) => readFileSync(join('src/icons', f)).toString('base64')).join('|'))
  .digest('hex')
  .slice(0, 8);
ok(files.includes(join('dist', 'og.png')), 'SNSで共有したときの画像（og.png）がある');
{
  // ホーム画面に追加：名前とアイコン。ふだんのブラウザで開く（standalone だと iPhone でわたしの推しの保存が分かれる）
  const mf = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
  ok(mf.name === settings.siteName && mf.short_name === settings.siteShortName && mf.start_url === '/' && mf.display === 'browser' && mf.icons.every((i) => files.includes(join('dist', i.src.replace(/^\/|\?.*$/g, '')))), 'ホーム画面に追加：manifest の名前・開く場所・アイコンがあり、ふだんのブラウザで開く');
}
const ogV = (await import('node:crypto')).createHash('sha1').update(readFileSync('src/og.png')).digest('hex').slice(0, 8);
ok(!files.some((f) => f.startsWith(join('dist', 'og') + '/')) && !readdirSync('src/og').some((f) => f.endsWith('.ttf')), 'SNSの画像の元（src/og/）と字のファイルは公開しない・リポジトリに入れない');

const credit = readFileSync('src/credit.html', 'utf8');
const banners = readdirSync('src/banners').map((f) => readFileSync(join('src/banners', f), 'utf8'));
// ©®™ は権利の表記の記号（買い方メモ）なので、絵文字に数えない
const emoji = /(?![©®™])\p{Extended_Pictographic}/u;
// 楽天の決まりで使わない言葉と、サイト作りの原則（AIっぽさゼロ）で使わない言葉
const banned = ['定価', '最安値', '%オフ', '％オフ', '割引率', '転売', 'クリックして応援', '楽天公認', 'ぜひ', 'おすすめ', 'しましょう', '便利', '簡単', '安心', 'コツ', '使い方', '——', '›', '→'];

for (const f of html) {
  const s = readFileSync(f, 'utf8');
  // 商品名・ショップ名（楽天）と動画の題名・チャンネル名（YouTube）は変えられない。こちらが書いた文だけを見る
  const text = s
    .replace(/<template[\s\S]*?<\/template>/g, '')
    .replace(/<span class="(nm|sh|vt|vd)">[\s\S]*?<\/span>/g, '')
    .replace(/<[^>]+>/g, ' ');
  ok(/<title>[^<]+<\/title>/.test(s), `${f}：タイトルがある`);
  ok(s.includes(`<img src="/logo.svg" width="176" height="34" alt="${settings.siteName}">`) && s.includes('<nav class="fn" aria-label="しくみ">') && s.includes('<nav class="tabs" aria-label="作品">'), `${f}：ロゴの画像と、しくみ・作品に分けたメニューがある`);
  ok(s.includes(`<link rel="icon" href="/favicon.ico?v=${iconV}" sizes="48x48">`) && s.includes(`<link rel="icon" href="/favicon.svg?v=${iconV}" type="image/svg+xml">`) && s.includes(`<link rel="apple-touch-icon" href="/apple-touch-icon.png?v=${iconV}">`) && !s.includes('url(/favicon.svg)'), `${f}：ファビコンの指定がある（絵の中身から作った目印つき）`);
  ok(s.includes('<link rel="manifest" href="/manifest.webmanifest">'), `${f}：ホーム画面に追加の manifest の指定がある`);
  // 読みものの記事は、その記事の絵（src/yomimono/img/<記事>-og.jpg。中身から作った目印つき）
  const ogArticle = s.match(/<meta property="og:image" content="[^"]*\/yomimono\/img\/([a-z0-9-]+-og\.jpg)\?v=([0-9a-f]{8})">/);
  const ogArticleOk = ogArticle && (await import('node:crypto')).createHash('sha256').update(readFileSync(join('src/yomimono/img', ogArticle[1]))).digest('hex').slice(0, 8) === ogArticle[2];
  ok((s.includes(`<meta property="og:image" content="${settings.siteUrl}og.png?v=${ogV}">`) || ogArticleOk) && s.includes('<meta name="twitter:card" content="summary_large_image">'), `${f}：SNSで共有したときの画像の指定がある（画像の中身から作った目印つき）`);
  ok(!/<span class="ph"><img [^>]*alt=""/.test(s), `${f}：商品の画像に商品名がついている`);
  if (f === join('dist', 'koushiki', 'index.html') || /^dist\/(yomimono\/[a-z0-9-]+\/shiryou|[a-z0-9-]+\/kaikata)\/index\.html$/.test(f.split('\\').join('/'))) {
    // 読みものの「調べた資料」と買い方メモのページも、楽天以外へのリンクがあるので広告を出さない
    // YouTube のデータがあるページには、楽天の広告を出さない（YouTube API サービスの決まり III.G.1.d）
    ok(!s.includes('<p class="ad">') && !s.includes('<template class="bnt">') && !s.includes('hb.afl.rakuten.co.jp'), `${f}：楽天の広告（バナー・商品リンク・広告の表示）がない`);
  } else {
    ok(s.includes('<p class="ad"><b>広告</b>楽天アフィリエイトを利用しています</p>'), `${f}：「広告」の表示がある`);
    ok(s.includes(credit), `${f}：楽天のクレジットがそのまま入っている`);
    ok(banners.every((b) => s.includes(`<template class="bnt">${b}</template>`)), `${f}：バナー3つがそのまま入っている`);
  }
  ok(s.includes('<a href="/terms/">利用規約</a>'), `${f}：いちばん下に利用規約へのリンク`);
  ok(!emoji.test(text), `${f}：絵文字がない`);
  // 「ポイント」は要点の意味では使わない（楽天ポイントの「ポイント10倍」は事実なので出してよい）
  const hit = [...banned.filter((w) => text.includes(w)), ...(/ポイント(?!\d+倍)/.test(text) ? ['ポイント'] : [])];
  ok(hit.length === 0, `${f}：使わない言葉がない${hit.length ? `（${hit.join('、')}）` : ''}`);
  // 画面の説明は1行（スマホで全角22文字くらい）まで
  const lead = s.match(/<p class="lead">([^<]*)<\/p>/)?.[1] ?? '';
  ok([...lead].length <= 22, `${f}：説明が1行におさまる${lead ? `（${[...lead].length}文字）` : ''}`);
  for (const m of s.matchAll(/<a href="(https:\/\/hb\.afl\.rakuten\.co\.jp\/hgc\/[^"]+)"([^>]*)>/g)) {
    if (!m[2].includes('sponsored')) {
      ok(false, `${f}：商品リンクに sponsored がない`);
      break;
    }
  }
}

// 楽天の商品を出すページには、楽天以外へのリンクを置かない（楽天の規約 第8条4項）
for (const f of html) {
  const s = readFileSync(f, 'utf8');
  if (!s.includes('https://hb.afl.rakuten.co.jp/hgc/')) continue;
  const other = [...s.replace(/<template[\s\S]*?<\/template>/g, '').matchAll(/<a [^>]*href="(https?:\/\/[^"]+)"/g)]
    .map((m) => m[1])
    .filter((u) => !/^https:\/\/(hb\.afl\.rakuten\.co\.jp|developers\.rakuten\.com|nyuka-techo\.com)\//.test(u));
  ok(other.length === 0, `${f}：商品のページに楽天以外へのリンクがない${other.length ? `（${other.slice(0, 2).join('、')}）` : ''}`);
}
if (process.env.DATA_RANKING) {
  const top = readFileSync('dist/index.html', 'utf8');
  const chi = readFileSync('dist/chiikawa/index.html', 'utf8');
  ok(top.includes('<h2>楽天のランキングに入っているグッズ</h2>') && top.includes('<span class="rk">20代女性ランキング入り</span>'), 'ランキング：トップにランキングに入っているグッズ');
  ok(chi.includes('<span class="rk">楽天ランキング入り</span>'), 'ランキング：新着のカードにも印');
  ok(chi.includes('<span class="rv">レビュー128件・平均4.6</span>'), 'レビューの件数と平均');
  ok(chi.includes('data-until="2026-10-19T16:59:00.000Z">ポイント10倍 10/20 01:59まで</span>'), 'ポイント倍率と終わる日時（過ぎたら消す）');
  ok(chi.includes('<h2>レビューが多いもの</h2>'), 'レビューが多いもの');
  ok(readFileSync('dist/pokemon/index.html', 'utf8').includes('<span class="nx">前に売り切れたことあり</span>'), '前に売り切れたことあり');
}
if (process.env.DATA_LATEST) {
  const oshi = readFileSync('dist/chiikawa/hachiware/index.html', 'utf8');
  const chi = readFileSync('dist/chiikawa/index.html', 'utf8');
  ok(oshi.includes('<title>ハチワレグッズの通販まとめ（人気') && oshi.includes('<h1 class="tape">ハチワレのグッズ</h1>'), '推しキャラ：ハチワレのページができる');
  ok((oshi.match(/item\.rakuten\.co\.jp%2Fshopo%2F/g) ?? []).length === 3, '推しキャラ：推しキャラの名前で探したグッズも並ぶ');
  ok(!readFileSync('dist/chiikawa/new/index.html', 'utf8').includes('shopo%2F'), '推しキャラ：推しキャラの名前で探したものは、作品の新着には出さない');
  ok(chi.includes('<a href="/chiikawa/hachiware/">ハチワレ</a>') && oshi.includes('<span aria-current="page">ハチワレ</span>'), '推しキャラ：ボタンから推しキャラのページへ行ける');
  ok(chi.includes('<a href="/search/?c=chiikawa&amp;q=%E3%83%A9%E3%83%83%E3%82%B3">ラッコ</a>'), '推しキャラ：ページがないキャラは「探す」へ');
  const topPage = readFileSync('dist/index.html', 'utf8');
  ok(topPage.includes('<section class="oshi" id="oshi"><h2>推しキャラ</h2><details><summary>ちいかわ</summary>') && topPage.includes('<a href="/chiikawa/hachiware/">ハチワレ</a>'), '推しキャラ：トップには作品ごとにたたんだボタン');
  ok(topPage.includes('<main class="sheet wrap top shelf">') && topPage.includes('<nav class="cats idx" aria-label="特集"><ul><li><a href="/christmas/">クリスマス</a></li>') && topPage.includes('<li><a href="#oshi">推しキャラから探す</a></li>'), 'トップ：横にすべらせる棚と、特集の目次');
  ok(!readFileSync('dist/sitemap.xml', 'utf8').includes('/chiikawa/hachiware/</loc>') && readFileSync('dist/sitemap.xml', 'utf8').includes('/chiikawa/</loc>'), '商品が少ないページ（見本のハチワレは7件）はサイトマップに入れない。作品のページは入れる');
  ok(oshi.includes('alt="ちいかわ ハチワレ ポーチ"') && chi.includes('alt="ちいかわ ぬいぐるみ S ハチワレ もちもち マスコット かわいい プレゼント"'), '商品の画像に商品名（【送料無料】などの飾りは外す）');
}
if (process.env.DATA_LATEST) {
  // 季節の特集（見本の日付 10/18 はハロウィンとクリスマスの期間）
  const xmas = readFileSync('dist/chiikawa/christmas/index.html', 'utf8');
  ok(xmas.includes('<title>ちいかわのクリスマスグッズ2026｜') && xmas.includes('<body class="dk s-christmas">') && xmas.includes('<h1 class="tape">ちいかわのクリスマスグッズ</h1><span class="stk stk-2" aria-hidden="true"></span>'), '季節の特集：作品ごとのページがデコつきでできる');
  ok((xmas.match(/item\.rakuten\.co\.jp%2Fxmas%2F/g) ?? []).length === 6, '季節の特集：季節の言葉が入ったグッズが並ぶ');
  ok(xmas.includes('.s-christmas{--da:') && xmas.includes('data:image/svg+xml'), '季節の特集：季節の色とシールのCSSが入る');
  ok(files.includes(join('dist', 'christmas', 'index.html')) && readFileSync('dist/christmas/index.html', 'utf8').includes('<a href="/chiikawa/christmas/">ちいかわのクリスマスグッズをもっと見る</a>'), '季節の特集：まとめのページから作品ごとのページへ');
  const topHtml = readFileSync('dist/index.html', 'utf8');
  ok(topHtml.includes('<section class="dks s-christmas"><div class="hw"><h2>クリスマスグッズ</h2>') && readFileSync('dist/chiikawa/index.html', 'utf8').includes('<section class="dks s-christmas">'), '季節の特集：トップと作品のページに入口');
  ok(topHtml.includes('<p class="fl">特集　') && topHtml.includes('<a href="/christmas/">クリスマス</a>'), '季節の特集：いちばん下にリンク');
  ok(!readFileSync('dist/chiikawa/new/index.html', 'utf8').includes('xmas%2F'), '季節の特集：季節の言葉で探したものは、作品の新着には出さない');
  ok(!files.includes(join('dist', 'fukubukuro', 'index.html')), '季節の特集：期間でなく、前にページがなかった季節のページは作らない');
  {
    // 見本の記録（test/fixture-season-seen.json）では、お正月の特集にちいかわ・サンリオのページがあった
    const later = readFileSync('dist/chiikawa/oshougatsu/index.html', 'utf8');
    const hub = readFileSync('dist/oshougatsu/index.html', 'utf8');
    ok(later.includes('<title>ちいかわのお正月グッズ（次は12月1日から）｜') && later.includes('<body class="dk s-oshougatsu">') && later.includes('<p class="next">次は2026年12月1日から</p>') && later.includes('<section class="dks s-christmas">'), '季節の特集：前にページがあった季節は、期間外も「次は◯月◯日から」のページで残し、いまの特集を並べる');
    ok(hub.includes('<p class="next">次は2026年12月1日から</p>') && readFileSync('dist/sanrio/oshougatsu/index.html', 'utf8').includes('<h2>サンリオグッズ新着</h2>') && !readFileSync('dist/sitemap.xml', 'utf8').includes('/oshougatsu/'), '季節の特集：期間外のまとめのページも残す・いまの特集がない作品は新着・サイトマップには入れない');
  }
  ok(!readFileSync('dist/about/index.html', 'utf8').includes('class="stk'), '季節の特集：ふつうのページにはシールをはらない');
  // 検索の言葉に合わせたページ
  const chiTop = readFileSync('dist/chiikawa/index.html', 'utf8');
  ok(chiTop.includes('<title>ちいかわグッズの通販・新着まとめ（予約・再入荷・人気ランキング）｜') && chiTop.includes('<nav class="cats" aria-label="選び方"><h2>選び方</h2>'), '作品のページ：名前に「通販」、選び方のボタン');
  ok(/<title>ちいかわのぬいぐるみ(（[^）]+）)?通販・新着一覧｜/.test(readFileSync('dist/chiikawa/nuigurumi/index.html', 'utf8')), 'カテゴリ：名前に種類と「通販」');
  const rk = readFileSync('dist/chiikawa/ranking/index.html', 'utf8');
  ok(rk.includes('<title>ちいかわグッズの人気ランキング（楽天市場のランキング・レビューの数）｜') && rk.includes('<h2>楽天のランキングに入っているもの</h2>') && rk.includes('<h2>レビューが多いもの</h2>') && chiTop.includes('<li><a href="/chiikawa/ranking/">人気ランキング</a></li>'), '人気ランキングのページ');
  const ot = readFileSync('dist/chiikawa/otona/index.html', 'utf8');
  ok(ot.includes('<title>大人向けちいかわグッズ') && ot.includes('<h1 class="tape">大人向けのちいかわグッズ</h1>') && ot.includes('長財布 レディース') && !ot.includes('キッズ'), '大人向けのページ（キッズ用は入れない）');
  const kd = readFileSync('dist/chiikawa/kids/index.html', 'utf8');
  ok(kd.includes('<title>子ども向けちいかわグッズ（キッズ・小学生・ベビー）｜') && kd.includes('キッズ Tシャツ'), '子ども向けのページ');
  const eg = readFileSync('dist/chiikawa/eiga/index.html', 'utf8');
  ok(eg.includes('<title>映画ちいかわ 人魚の島のひみつのグッズ（人魚・セイレーン）｜') && (eg.match(/item\.rakuten\.co\.jp%2Feiga%2F/g) ?? []).length === 6 && chiTop.includes('<li><a href="/chiikawa/eiga/">映画ちいかわ</a></li>'), '話題：映画ちいかわのページ');
  const tc = readFileSync('dist/chiikawa/techo/index.html', 'utf8');
  ok(tc.includes('<title>ちいかわの手帳・カレンダー2027｜') && tc.includes('<body class="dk s-techo">') && tc.includes('手帳 2027 B6') && !tc.includes('手帳 2026 去年'), '季節の特集：来年の手帳・カレンダーのページ（去年のものは入れない）');
  // ご当地
  const go = readFileSync('dist/chiikawa/gotouchi/index.html', 'utf8');
  ok(go.includes('<title>ご当地ちいかわグッズを地域で選ぶ（北海道・') && go.includes('<body class="dk s-gotouchi">') && go.includes('<section id="hokkaido-tohoku"><h2>北海道・東北</h2>') && go.includes('<section id="kyushu-okinawa"><h2>九州・沖縄</h2>') && go.includes('<a href="#kinki">近畿</a>'), 'ご当地：地方ごとに分けたページ');
  ok(go.indexOf('id="hokkaido-tohoku"') < go.indexOf('id="kinki"') && go.indexOf('id="kinki"') < go.indexOf('id="kyushu-okinawa"'), 'ご当地：北から南の順');
  ok(!readFileSync('dist/chiikawa/new/index.html', 'utf8').includes('gotouchi%2F'), 'ご当地：ご当地で探したものは、作品の新着には出さない');
  ok(topHtml.includes('<section class="dks s-gotouchi">') && topHtml.includes('<a href="/gotouchi/">ご当地グッズ</a>') && readFileSync('dist/chiikawa/index.html', 'utf8').includes('<li><a href="/chiikawa/gotouchi/">ご当地ちいかわ</a></li>'), 'ご当地：トップ・作品のページ・いちばん下に入口');
  // 誕生日
  ok(topHtml.includes('<h2>もうすぐクロミの誕生日（10月31日）</h2>') && topHtml.includes('<a href="/search/?c=sanrio&amp;q=%E3%82%AF%E3%83%AD%E3%83%9F">クロミのグッズをもっと見る</a>'), '誕生日：近い推しキャラのグッズをトップに');
  const bd = readFileSync('dist/tanjoubi/index.html', 'utf8');
  ok(bd.includes('<li><time>10月31日</time>') && bd.includes('<li><time>2月29日</time><a href="/search/?c=sanrio&amp;q=%E3%83%9D%E3%83%81%E3%83%A3%E3%83%83%E3%82%B3">ポチャッコ</a><span>サンリオ・うるう年生まれ</span></li>') && bd.includes('<span>絵本が生まれた日</span>'), '誕生日：カレンダーに近い順で並ぶ');
  ok(topHtml.includes('<a href="/tanjoubi/">推しキャラの誕生日</a>'), '誕生日：いちばん下にリンク');
  // 推し活カレンダー（今日から来月の終わりまで）と、スマホのカレンダーに入れるファイル（推しキャラの誕生日だけ。楽天のデータは入れない）
  {
    const cal = readFileSync('dist/calendar/index.html', 'utf8');
    const main = cal.slice(cal.indexOf('<main'), cal.indexOf('</main>'));
    ok(cal.includes('<title>推し活カレンダー（2026年10月・11月）グッズの発売日・予約の締切・推しキャラの誕生日｜') && main.includes('<h2>2026年10月</h2><ul class="bd cal">') && main.includes('<h2>2026年11月</h2>') && !main.includes('<h2>2026年12月</h2>'), '推し活カレンダー：今日から来月の終わりまで、月ごと');
    ok(main.includes('<li><time datetime="2026-10-31">10/31（土）</time><a href="/search/?c=sanrio&amp;q=%E3%82%AF%E3%83%AD%E3%83%9F">クロミの誕生日</a><span>サンリオ</span></li>') && main.includes('<b>ハロウィン</b>') && main.includes('<li><time datetime="2026-10-20">10/20（火）</time><b>福袋の特集がはじまる</b></li>'), '推し活カレンダー：誕生日・季節のイベント・特集のはじまり');
    ok(main.includes('<a href="/chiikawa/hatsubai/">ちいかわの新作が発売</a><span>本 1件</span>') && main.includes('<a href="/chiikawa/yoyaku/">ちいかわの予約の締切</a><span>1件</span>'), '推し活カレンダー：楽天ブックスの発売日と、商品名に書いてある予約の締切');
    const days = [...main.matchAll(/<time datetime="(\d{4}-\d\d-\d\d)">/g)].map((m) => m[1]);
    ok(days.length > 0 && days.every((d, i) => i === 0 || days[i - 1] <= d) && days[0] >= '2026-10-18' && days.at(-1) <= '2026-11-30', '推し活カレンダー：日付の順で、今日より前は出さない');
    ok(!main.includes('<img') && !/href="https?:/.test(main) && main.includes('<a href="/calendar/oshi.ics">'), '推し活カレンダー：画像・外へのリンクなし、スマホのカレンダーに入れるリンク');
    ok(topHtml.includes('<li><a href="/calendar/">推し活カレンダー</a></li>') && topHtml.includes('<a href="/calendar/">推し活カレンダー</a>／') && bd.includes('<a href="/calendar/oshi.ics">誕生日を、スマホのカレンダーに入れる</a>'), '推し活カレンダー：トップの目次・いちばん下・誕生日のページから行ける');
    const ics = readFileSync('dist/calendar/oshi.ics');
    const text = ics.toString('utf8');
    const lines = text.split('\r\n');
    ok(text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && text.endsWith('END:VCALENDAR\r\n') && !text.replaceAll('\r\n', '').includes('\n') && lines.every((l) => Buffer.byteLength(l) <= 75), 'スマホのカレンダー：iCalendar の形（改行は CRLF、1行75バイトまで）');
    const ev = text.split('BEGIN:VEVENT').length - 1;
    const nBirth = chars.reduce((n, c) => n + (c.oshi ?? []).filter((o) => o.birthday).length, 0);
    ok(ev === nBirth && text.includes('SUMMARY:クロミの誕生日\r\n') && text.includes('DTSTART;VALUE=DATE:20241031\r\nDTEND;VALUE=DATE:20241101\r\nRRULE:FREQ=YEARLY\r\n') && text.includes('DTSTART;VALUE=DATE:20240229\r\nDTEND;VALUE=DATE:20240301\r\nRRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=-1\r\n'), `スマホのカレンダー：推しキャラの誕生日だけ（${ev}件。2月29日生まれは2月の最後の日）`);
    const fxNames = [...readJson('test/fixture-latest.json'), ...readJson('test/fixture-books.json').items].map((x) => String(x.name).slice(0, 12));
    const urls = [...text.matchAll(/^URL:(.+)$/gm)].map((m) => m[1].trim());
    ok(!/rakuten|円|発売|締切|予約/.test(text) && !fxNames.some((n) => n && text.includes(n)) && urls.length === ev && urls.every((u) => u.startsWith(settings.siteUrl)), 'スマホのカレンダー：楽天のデータ（商品名・値段・発売日・リンク）を入れない');
    const { buildIcs } = await import('./lib/ics.mjs');
    const long = buildIcs({ name: 'テスト', stamp: '20261023T000000Z', events: [{ uid: 'x', mmdd: '12-31', summary: 'あ'.repeat(40) + ',;\\', url: `${settings.siteUrl}tanjoubi/` }] });
    const unf = long.replaceAll('\r\n ', '');
    ok(long.split('\r\n').every((l) => Buffer.byteLength(l) <= 75) && unf.includes(`SUMMARY:${'あ'.repeat(40)}\\,\;\\\\\r\n`) && unf.includes('DTEND;VALUE=DATE:20250101'), 'スマホのカレンダー：長い名前は字の途中で切らずに折り返す・記号を逃がす・年をまたぐ');
  }
  // 予算で選ぶ
  const yo = readFileSync('dist/chiikawa/yosan/index.html', 'utf8');
  ok(yo.includes('<title>安いちいかわグッズ・プレゼントを予算で選ぶ（1,000円以下・3,000円まで・5,000円まで）｜') && yo.includes('<h2>3,000円まで</h2>') && yo.includes('<h2>5,000円まで</h2>') && yo.includes('「送料込み」の印がない商品は、送料が別のことがあります'), '予算で選ぶ：値段で分けたページ');
  ok(readFileSync('dist/chiikawa/index.html', 'utf8').includes('<li><a href="/chiikawa/yosan/">予算で選ぶ</a></li>'), '予算で選ぶ：作品のページから行ける');
  // 送料込み・ラッピング対応の印と、しぼりこみ（ブラウザの中だけ。保存しない）
  ok(yo.includes('<button type="button" data-k="s" aria-pressed="false">送料込み</button>') && yo.includes('<button type="button" data-k="g" aria-pressed="false">ラッピング対応</button>') && yo.includes('<li class="fmax"><label>予算<input type="number"') && /<li data-p="\d+" data-f="[sgak -]+">/.test(yo) && yo.includes('<ul class="grid" data-n="20">'), '予算で選ぶ：送料込み・ラッピング対応・大人向け・子ども向け・金額でしぼりこめる');
  const fltJs = yo.match(/<script>\(function\(\)\{var r=document\.querySelector\('\.flt'\)[\s\S]*?<\/script>/)?.[0] ?? '';
  ok(yo.includes('<p class="asof fl-none" hidden>条件に合うグッズがありません</p>') && fltJs && !/localStorage|sessionStorage|document\.cookie|fetch/.test(fltJs), '予算で選ぶ：しぼりこみはどこにも保存しない');
  // わたしの推し・前に見てから（端末のブラウザの中だけ。サイトや楽天には送らない）
  const myJs = [...topHtml.matchAll(/<script>[\s\S]*?<\/script>/g)].map((m) => m[0]).find((x) => x.includes('ot-my')) ?? '';
  ok(readFileSync('dist/chiikawa/hachiware/index.html', 'utf8').includes('<p class="myp"><button type="button" class="myb" data-p="/chiikawa/hachiware/" data-n="ハチワレ" aria-pressed="false" hidden>わたしの推し</button></p>'), 'わたしの推し：推しキャラのページにボタン（ブラウザの保存が使えるときだけ出す）');
  ok(topHtml.includes('<section class="my" id="my" hidden><h2>わたしの推し</h2></section>') && topHtml.indexOf('id="my"') < topHtml.indexOf('<section class="dks'), 'わたしの推し：トップの特集の目次のすぐ下（はじめは隠す）');
  ok(myJs && !/document\.cookie|sessionStorage|https?:/.test(myJs) && (myJs.match(/fetch\(/g) ?? []).length === 1 && myJs.includes('fetch(o.p)') && myJs.includes('/^\\/[a-z0-9-]+\\/[a-z0-9-]+\\/$/') && !/setItem\('(?!ot-)/.test(myJs), 'わたしの推し：保存は ot- で始まるものだけ、読みにいくのはこのサイトの推しキャラのページだけ');
  {
    const hw = readFileSync('dist/chiikawa/hachiware/index.html', 'utf8');
    ok(hw.includes('<ul class="grid" data-pool>') && /<li data-c="[a-z-]+"><a /.test(hw), '推し×種類のしおり：推しキャラのページの最初の一覧に種類の目印');
    const navs = html.map((f) => readFileSync(f, 'utf8').match(/<nav class="cats shiori" aria-label="種類">[\s\S]*?<\/nav>/)?.[0]).filter(Boolean);
    ok(navs.every((n) => n.includes('<li><a href="#" data-c="" aria-current="true">すべて</a></li>') && !/href="(?!#)/.test(n)), `推し×種類のしおり：種類は #種類 のリンクだけ（URL は増やさない）（${navs.length}ページ）`);
  }
  ok(readFileSync('dist/privacy/index.html', 'utf8').includes('<h2>端末に保存するもの</h2>') && readFileSync('dist/privacy/index.html', 'utf8').includes('サイトや楽天には送りません'), 'わたしの推し：プライバシーポリシーに、端末に保存するものを書く');
  ok(chiTop.includes('<span class="pk"><span class="s">送料込み</span><span class="g">ラッピング対応</span></span>') && !chiTop.includes('送料無料</span></span>'), '印：カードに「送料込み」「ラッピング対応」（「送料無料」とは書かない）');
  ok(xmas.includes('<button type="button" data-k="g" aria-pressed="false">ラッピング対応</button>') && !tc.includes('<div class="flt">'), 'プレゼントの季節（クリスマス）だけ、送料込み・ラッピング対応でしぼりこめる');
  // 並べかえ（ブラウザの中だけ。URL は増やさず、どこにも保存しない）
  {
    const nw = readFileSync('dist/chiikawa/new/index.html', 'utf8');
    const sortJs = nw.match(/<script>\(function\(\)\{var r=document\.querySelector\('\.srt'\)[\s\S]*?<\/script>/)?.[0] ?? '';
    ok(nw.includes('<div class="srt" hidden><span class="oc">並べかえ</span><ul><li><a href="#" data-s="" aria-current="true">新しい順</a></li><li><a href="#" data-s="low">安い順</a></li>') && /<ul class="grid" data-sort><li data-p="\d+" data-r="\d+">/.test(nw), '並べかえ：新着の一覧に、新しい順・安い順（値段とレビューの数の目印）');
    ok(sortJs && !/localStorage|sessionStorage|document\.cookie|fetch|location|history/.test(sortJs), '並べかえ：ブラウザの中だけ（URL を変えず、どこにも保存しない）');
    ok(['chiikawa/nuigurumi', 'chiikawa/christmas', 'chiikawa/eiga'].every((p) => readFileSync(`dist/${p}/index.html`, 'utf8').includes('<div class="srt" hidden>')) && !readFileSync('dist/chiikawa/yoyaku/index.html', 'utf8').includes('class="srt"'), '並べかえ：カテゴリ・季節の特集・話題の一覧にも（予約受付中は締切の順のまま）');
    ok(xmas.includes("document.addEventListener('ot-sort',f)"), '並べかえ：しぼりこみと一緒に使える（並べかえたあとに、しぼりこみをやり直す）');
  }
  // 予約受付中：締切は商品名からだけ。販売期間は別に。楽天ブックスの予約も
  const yy = readFileSync('dist/chiikawa/yoyaku/index.html', 'utf8');
  ok(yy.includes('<h2>楽天市場の予約</h2>') && yy.includes('<h2>楽天ブックスの予約（発売日の順）</h2>') && yy.includes('12/5発売・おもちゃ') && yy.includes('11月下旬発売・本') && !yy.includes('なんか小さくてかわいいやつ（9）'), '予約受付中：楽天ブックスで予約受付中のおもちゃ・カレンダーも並ぶ（本は入れない）');
  ok(yy.includes('販売期間 11/10 23:59まで') && !yy.includes('締切 11/10') && yy.includes('締切 11/30') && yy.indexOf('販売期間 11/10') < yy.indexOf('締切 11/30'), '予約受付中：販売期間の終わりは締切と書かず、締切・販売期間が近い順');
  ok(!yy.includes('<p class="lead">') && yy.includes('<p class="asof">締切は商品名に書いてあるもの、販売期間と発売日は楽天の情報です</p>'), '予約受付中：説明は見出しの下ではなく下に');
  ok(topHtml.includes('<h2>予約受付中のグッズ</h2>') && topHtml.includes('<a href="/chiikawa/yoyaku/">ちいかわの予約受付中</a>') && !topHtml.includes('予約の締切が近いもの'), '予約受付中：トップに全作品の棚');
  ok((topHtml.match(/<span class="nm">ちいかわ ぬいぐるみ ハチワレ（予約）<\/span>/g) ?? []).length === 1, '予約受付中：トップの「もうすぐ発売」と同じものを2回出さない');
}
// YouTube API サービスの決まり：取った情報をファイルに残さない（III.E.4）・ロゴ（III.F.2）・利用規約（III.A.1）
{
  const k = readFileSync('dist/koushiki/index.html', 'utf8');
  ok(k.includes('<!--yt:chiikawa-->') && k.includes('<!--yt:sanrio-->'), 'YouTube：公式の最新情報には、動画を入れる目印だけがある');
  const ytData = html.filter((f) => /i\.ytimg\.com|youtube\.com\/watch|<ul class="vids">/.test(readFileSync(f, 'utf8')));
  ok(ytData.length === 0, `YouTube：作ったページのファイルに動画の情報が入っていない${ytData.length ? `（${ytData.slice(0, 2).join('、')}）` : ''}`);
  ok(!files.some((f) => /youtube\.json$/.test(f)) && !(existsSync('data') && readdirSync('data').includes('youtube.json')) && readFileSync('.gitignore', 'utf8').split('\n').includes('data/'), 'YouTube：動画の情報を data/ に残さない');
  ok(files.includes(join('dist', 'youtube-logo.svg')) && readFileSync('dist/youtube-logo.svg').equals(readFileSync('src/brand/youtube-logo.svg')) && readFileSync('src/brand/youtube-logo.svg', 'utf8').includes('fill="#FF0000"'), 'YouTube：公式のロゴを1バイトも変えずに置いている');
  const t = readFileSync('dist/terms/index.html', 'utf8');
  ok(t.includes('<a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener">YouTube 利用規約</a>に同意したことになります') && t.includes('この利用規約と<a href="/privacy/">プライバシーポリシー</a>に同意したことになります'), 'YouTube：利用規約に「YouTube 利用規約に同意したことになる」');
  const pv = readFileSync('dist/privacy/index.html', 'utf8');
  ok(pv.includes('YouTube API サービス') && pv.includes('https://policies.google.com/privacy') && pv.includes('保存しません'), 'YouTube：プライバシーポリシーに YouTube API サービスと Google のプライバシーポリシー');
}

// サイト作りの原則（2026-10-22）：左はしの色の帯・丸いバッジ・えらんだものだけ色をぬる切りかえを使わない
{
  const styles = html.map((f) => (readFileSync(f, 'utf8').match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? '')).join('');
  ok(!/border-left:\s*([3-9]|\d{2,})px/.test(styles), 'デザイン：枠やボタンの左はしに色の太い帯をつけない');
  ok(!/border-radius:\s*999px/.test(styles), 'デザイン：小さな丸いバッジを使わない');
  ok(!/aria-pressed=true\]\{[^}]*background:(?!none)/.test(styles), 'デザイン：しぼりこみは押したものだけ色をぬらない（チェック欄）');
  ok(!/(:checked\+span|aria-pressed=true\])\{[^}]*(font-weight|padding)/.test(styles), 'デザイン：えらび直しても、となりの文字の位置がずれない（えらんだものだけ太字や余白を変えない）');
}

// サイトの中のリンクが、すべて実在するページを指しているか
const broken = new Set();
for (const f of html) {
  const s = readFileSync(f, 'utf8');
  for (const m of s.matchAll(/href="(\/[^"#?]*)[^"]*"/g)) {
    const p = m[1];
    const target = p.endsWith('/') ? join('dist', p, 'index.html') : join('dist', p);
    if (!files.includes(target)) broken.add(`${f} → ${p}`);
  }
}
ok(broken.size === 0, `サイト内のリンク切れがない${broken.size ? `（${[...broken].slice(0, 5).join('、')}）` : ''}`);

// サイトマップのURLがすべて実在するか
const site = settings.siteUrl.replace(/\/$/, '');
const locs = [...readFileSync('dist/sitemap.xml', 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const missing = locs.filter((u) => {
  const p = u.replace(site, '');
  return !files.includes(p.endsWith('/') ? join('dist', p, 'index.html') : join('dist', p));
});
ok(locs.length > 0 && missing.length === 0, `サイトマップのURLがすべてある（${locs.length}件）`);
ok(!locs.some((u) => u.includes('/search/')), '検索のページはサイトマップに入れない');
ok(readFileSync('dist/search/index.html', 'utf8').includes('noindex'), '検索のページは検索エンジンに載せない');

// 価格の時刻は、ページのいちばん下に1行だけ
{
  const bad = html.filter((f) => {
    const s = readFileSync(f, 'utf8');
    const main = s.slice(s.indexOf('<main'), s.indexOf('</main>'));
    const n = (main.match(/時点の価格<\/p>/g) ?? []).length;
    return n > 1 || (n === 1 && !/<p class="asof end">[^<]*時点の価格<\/p>\s*$/.test(main));
  });
  ok(bad.length === 0, `価格の時刻はページのいちばん下に1行${bad.length ? `（${bad.slice(0, 3).join('、')}）` : ''}`);
}

// タイトルの重複がないか
const titles = html.map((f) => readFileSync(f, 'utf8').match(/<title>([^<]+)<\/title>/)?.[1]);
ok(new Set(titles).size === titles.length, 'ページのタイトルが重複していない');

const top = readFileSync('dist/index.html', 'utf8');
if (process.env.SITE_MODE === 'production') {
  ok(!top.includes('noindex'), '本番は検索に載る設定');
  ok(top.includes('<link rel="canonical" href="https://nyuka-techo.com/">'), '本番は正規URL（canonical）が nyuka-techo.com');
  ok(readFileSync('dist/robots.txt', 'utf8').includes('Sitemap: https://nyuka-techo.com/sitemap.xml'), 'robots.txt にサイトマップの場所がある');
  ok(readFileSync('dist/robots.txt', 'utf8').includes('Disallow: /search/'), 'robots.txt で検索の結果を回らないようにしている');
  if (settings.indexNowKey) ok(files.includes(join('dist', `${settings.indexNowKey}.txt`)), 'IndexNow のキーのファイルがある');
  // 商品が少ないページ（noindex,follow）はサイトマップに入れない
  const thin = html.filter((f) => readFileSync(f, 'utf8').includes('<meta name="robots" content="noindex,follow">'));
  ok(thin.every((f) => !locs.includes(`${site}/${f.replace(/^dist\//, '').replace(/index\.html$/, '')}`)), `本番：商品が少ないページはサイトマップに入れない（${thin.length}ページ）`);
  // 期間外の季節の特集（次は◯月◯日から）は検索に出さない
  const later = html.filter((f) => readFileSync(f, 'utf8').includes('<p class="next">次は'));
  ok(later.every((f) => thin.includes(f)), `本番：期間外の季節の特集は検索に出さない（${later.length}ページ）`);
} else {
  ok(top.includes('noindex'), 'プレビューは検索に載らない設定');
}

// 発売日カレンダー（見本データのときだけ中身まで見る）
if (process.env.DATA_BOOKS) {
  const cal = readFileSync('dist/chiikawa/hatsubai/index.html', 'utf8');
  ok(cal.includes('<h2>2026年10月</h2>') && cal.includes('<h2>2026年11月</h2>') && cal.includes('<h2>最近発売したもの</h2>'), '発売日カレンダー：月ごと・最近発売に分ける');
  ok(cal.includes('11/20発売・本') && cal.includes('楽天ブックスで見る'), '発売日カレンダー：発売日と楽天ブックスへのリンク');
  ok(cal.includes('<title>ちいかわの新作グッズ発売予定・発売日カレンダー（2026年10月・11月）｜'), '発売日カレンダー：名前に「新作」と年月');
  ok(readFileSync('dist/about/index.html', 'utf8').includes('<p class="fl">発売日カレンダー　<a href="/chiikawa/hatsubai/">ちいかわ</a>'), 'いちばん下に発売日カレンダーへのリンク');
  ok(readFileSync('dist/chiikawa/index.html', 'utf8').includes('<h2>もうすぐ発売</h2>'), 'キャラのページに「もうすぐ発売」');
  const { parseSalesDate, kindOf } = await import('./lib/books.mjs');
  ok(kindOf('006514', '') === 'おもちゃ' && kindOf('006502', 'Nintendo Switch 2') === 'ゲーム' && kindOf('001004/001017') === '本', '発売日カレンダー：種類の見分け');
  ok(parseSalesDate('2026年11月20日').ymd === '2026-11-20' && parseSalesDate('2026年12月下旬').label === '12月下旬' && parseSalesDate('2027年春').year && parseSalesDate('未定') === null, '発売日の読み取り');
}

// 3. 探す（Cloudflare の関数）を、楽天の返事の見本で確かめる
{
  const fn = await import(pathToFileURL(resolve('functions/search/[[path]].js')).href);
  const sample = readFileSync('test/fixture-search.json', 'utf8');
  const tpl = readFileSync('dist/search/index.html', 'utf8');
  const env = {
    RAKUTEN_APPLICATION_ID: 'test-app',
    RAKUTEN_ACCESS_KEY: 'pk_test',
    RAKUTEN_AFFILIATE_ID: 'test.aff',
    ASSETS: { fetch: async () => new Response(tpl, { headers: { 'Content-Type': 'text/html' } }) },
  };
  const realFetch = globalThis.fetch;
  const run = async (path, reply) => {
    const calls = [];
    globalThis.fetch = async (url, init) => {
      calls.push({ url: new URL(url), init });
      const r = typeof reply === 'function' ? reply(calls.length) : reply;
      return new Response(r.body ?? '', { status: r.status ?? 200 });
    };
    try {
      const res = await fn.onRequestGet({ request: new Request(`https://nyuka-techo.com${path}`), env, waitUntil: () => {} });
      return { res, html: await res.text(), calls };
    } finally {
      globalThis.fetch = realFetch;
    }
  };

  const a = await run('/search/?c=chiikawa&q=%E3%83%8F%E3%83%81%E3%83%AF%E3%83%AC', { body: sample });
  const sent = a.calls[0];
  ok(a.res.status === 200, '探す：ページが返る');
  ok(sent?.url.searchParams.get('keyword') === 'ちいかわ ハチワレ', '探す：キャラ名をつけて楽天に聞く');
  ok(sent?.url.searchParams.get('NGKeyword')?.startsWith('中古'), '探す：楽天側でも中古を外してもらう');
  ok(sent?.url.searchParams.get('availability') === '1', '探す：買えるものだけ聞く');
  ok(sent?.init?.headers?.Referer === 'https://nyuka-techo.com/', '探す：Referer をつける（楽天の「許可されたWebサイト」の nyuka-techo.com）');
  const links = [...a.html.matchAll(/<a href="https:\/\/hb\.afl\.rakuten\.co\.jp\/hgc\/[^"]+" target="_blank" rel="sponsored nofollow noopener">/g)].length;
  ok(links === 2, `探す：中古と「〜風」を外して2件出す（${links}件）`);
  ok(a.html.includes('<span class="tg">予約</span>') && a.html.includes('締切 11/30'), '探す：予約と締切の印が出る');
  ok(a.html.includes('<title>「ハチワレ」のちいかわグッズ｜'), '探す：タイトルに言葉が入る');
  ok(a.html.includes('value="ハチワレ"'), '探す：入れた言葉が欄に残る');
  ok(a.html.includes('<p class="asof">楽天市場で1,234件</p>') && /<p class="asof end">[^<]*時点の価格<\/p><\/section>/.test(a.html), '探す：件数は上、価格の時刻は結果のいちばん下');
  ok(a.html.includes('<p class="ad"><b>広告</b>楽天アフィリエイトを利用しています</p>') && a.html.includes(credit), '探す：広告の表示とクレジットがある');
  ok(a.html.includes('noindex') && a.res.headers.get('X-Robots-Tag')?.includes('noindex'), '探す：検索エンジンに載せない');
  ok(a.html.includes('次のページ') && a.html.includes('1／30'), '探す：ページ送りがある（30ページまで）');
  ok(a.html.includes('<p class="so"><b>標準</b>') && a.html.includes('安い順'), '探す：並び順は結果の上の文字リンク');
  const own = a.html.replace(/<template[\s\S]*?<\/template>/g, '').replace(/<span class="(nm|sh)">[\s\S]*?<\/span>/g, '').replace(/<[^>]+>/g, ' ');
  ok(!emoji.test(own) && !banned.some((w) => own.includes(w)), '探す：絵文字と使わない言葉がない');

  const e = await run('/search/?c=chiikawa&q=%E3%81%A1%E3%81%84%E3%81%8B%E3%82%8F', { body: sample });
  ok(e.calls[0]?.url.searchParams.get('keyword') === 'ちいかわ', '探す：キャラ名と同じ言葉は重ねない');

  const b = await run('/search/?c=chiikawa', { body: sample });
  ok(b.calls.length === 0 && b.html === tpl, '探す：言葉がないときは楽天に聞かず、ふつうのページを返す');

  const c = await run('/search/?c=pokemon&q=%E3%83%94%E3%82%AB', { status: 429, body: '{}' });
  ok(c.calls.length === 2 && c.html.includes('混みあっています') && c.res.headers.get('Cache-Control') === 'no-store', '探す：混んでいるときは1回やり直して、ためずに知らせる');

  const d = await run('/search/?c=pokemon&q=x&p=99', { status: 400, body: '{}' });
  ok(d.calls[0]?.url.searchParams.get('page') === '30' && d.html.includes('ほかの言葉で'), '探す：30ページより先は30ページにし、言葉の問題を知らせる');

  // 作品は言葉から見分ける（2026-10-28）。作品を選ぶボタンはない
  const enc = (t) => encodeURIComponent(t);
  ok(!readFileSync('dist/search/index.html', 'utf8').includes('role="radiogroup"'), '探す：作品を選ぶボタンを置かない（言葉だけ）');
  const f = await run(`/search/?q=${enc('クロミ ポーチ')}`, { body: sample });
  ok(f.calls[0]?.url.searchParams.get('keyword') === 'サンリオ クロミ ポーチ', '探す：言葉のキャラ名から作品を見分ける（クロミ → サンリオ）');
  const h = await run(`/search/?c=chiikawa&q=${enc('クロミ')}`, { body: sample });
  ok(h.calls[0]?.url.searchParams.get('keyword') === 'サンリオ クロミ', '探す：言葉に作品があれば、前の作品より言葉を優先');
  const g = await run(`/search/?q=${enc('マグカップ')}`, { body: sample });
  ok(g.calls.length === 0 && g.html.includes('どの作品で探しますか') && g.html.includes(`<a href="/search/?c=chiikawa&amp;q=${enc('マグカップ')}">ちいかわ</a>`), '探す：作品名もキャラ名もないときは楽天に聞かず、作品を選んでもらう');
  const u = await run(`/search/?q=${enc('うさぎ')}`, { body: sample });
  ok(u.calls.length === 0, '探す：名前だけでは別の物とまぎれる推しキャラ（うさぎ）では作品を決めない');
  const i2 = await run(`/search/?c=sanrio&q=${enc('マグカップ')}`, { body: sample });
  ok(i2.calls[0]?.url.searchParams.get('keyword') === 'サンリオ マグカップ' && i2.html.includes('<input type="hidden" name="c" value="sanrio">') && i2.html.includes('ほかの作品で「マグカップ」を探す'), '探す：選んだ作品で探し、続けて探すときも同じ作品・ほかの作品でも試せる');
  const k = await run('/search/?q=', { body: sample });
  ok(k.calls.length === 0 && k.html === tpl, '探す：言葉が空のときは、ふつうのページを返す');
}

// 4. 公式の最新情報（Cloudflare の関数）：開いたときに YouTube から取って入れる
{
  const fn = await import(pathToFileURL(resolve('functions/koushiki/[[path]].js')).href);
  const yt = JSON.parse(readFileSync('test/fixture-yt.json', 'utf8'));
  const tpl = readFileSync('dist/koushiki/index.html', 'utf8');
  const realFetch = globalThis.fetch;
  const run = async (env) => {
    const calls = [];
    globalThis.fetch = async (url) => {
      const u = new URL(url);
      calls.push(u);
      const body = u.pathname.endsWith('/channels') ? yt.channels : yt.playlist;
      return new Response(JSON.stringify(body), { status: 200 });
    };
    try {
      const res = await fn.onRequestGet({
        request: new Request('https://nyuka-techo.com/koushiki/'),
        env: { ...env, ASSETS: { fetch: async () => new Response(tpl, { headers: { 'Content-Type': 'text/html' } }) } },
        waitUntil: () => {},
      });
      return { res, html: await res.text(), calls };
    } finally {
      globalThis.fetch = realFetch;
    }
  };
  const a = await run({ YOUTUBE_API_KEY: 'test-key' });
  const kinds = a.calls.map((u) => u.pathname.split('/').pop());
  // 呼ぶ回数はチャンネルの数から：チャンネルごとに playlistItems.list 1回、古いユーザー名・ハンドルのチャンネルだけ channels.list も1回
  const chs = chars.flatMap((c) => c.youtube ?? []);
  const wantPl = chs.length;
  const wantCh = chs.filter((ch) => ch.forUsername || ch.forHandle).length;
  ok(kinds.filter((k) => k === 'playlistItems').length === wantPl && kinds.filter((k) => k === 'channels').length === wantCh && !kinds.includes('search'), `公式の最新情報：1回開くと playlistItems.list ${wantPl}回・channels.list ${wantCh}回（search.list は使わない）（${kinds.join('・')}）`);
  ok(a.html.includes('https://www.youtube.com/watch?v=aaaaaaaaaa1') && !a.html.includes('aaaaaaaaaa9') && a.html.includes('10/16・ちいかわマーケット公式'), '公式の最新情報：公開の動画だけ並ぶ');
  ok(a.html.includes('<a href="https://www.youtube.com/channel/UCTaQ1acgUkNynUbhh-Fhylw" target="_blank" rel="noopener"><img src="/youtube-logo.svg" width="90" height="20" alt="YouTube"></a>') && a.html.includes('<a href="https://www.youtube.com/user/sanriojapan"'), '公式の最新情報：動画の上に、押すと公式チャンネルへ行く YouTube のロゴ');
  ok(!a.html.includes('hb.afl.rakuten.co.jp') && !a.html.includes('<template class="bnt">') && !a.html.includes('<!--yt:'), '公式の最新情報：楽天の広告がなく、目印は残らない');
  ok(a.res.headers.get('Cache-Control') === 'public, max-age=3600', '公式の最新情報：ためるのは1時間まで');
  const b = await run({});
  ok(b.calls.length === 0 && !b.html.includes('<ul class="vids">') && !b.html.includes('<!--yt:') && b.res.headers.get('Cache-Control') === 'no-store', '公式の最新情報：キーがないときは YouTube に聞かず、動画なしで出す');
}

// 5. 引っ越し：古いアドレスと www を nyuka-techo.com へ 301（Cloudflare の関数 functions/_middleware.js）
{
  const mw = await import(pathToFileURL(resolve('functions/_middleware.js')).href);
  const go = async (u) => {
    let passed = false;
    const res = await mw.onRequest({ request: new Request(u), next: async () => ((passed = true), new Response('ok')) });
    return { res, passed };
  };
  const a = await go('https://oshi-techo.pages.dev/chiikawa/yosan/?x=1');
  const b = await go('https://www.nyuka-techo.com/');
  const c = await go('https://pr-18.oshi-techo.pages.dev/chiikawa/');
  const d = await go('https://nyuka-techo.com/chiikawa/');
  ok(a.res.status === 301 && a.res.headers.get('Location') === 'https://nyuka-techo.com/chiikawa/yosan/?x=1', '引っ越し：oshi-techo.pages.dev は同じページの nyuka-techo.com へ 301');
  ok(b.res.status === 301 && b.res.headers.get('Location') === 'https://nyuka-techo.com/', '引っ越し：www は nyuka-techo.com へ 301');
  ok(c.passed && d.passed, '引っ越し：プレビューと nyuka-techo.com はそのまま');
  const e = await go('https://nyuka-techo.com/finalfantasy/oshi/cloud/');
  const f = await go('https://nyuka-techo.com/josei/');
  const g = await go('https://oshi-techo.pages.dev/finalfantasy');
  ok(e.res.status === 301 && e.res.headers.get('Location') === 'https://nyuka-techo.com/game/' && f.res.status === 301 && f.res.headers.get('Location') === 'https://nyuka-techo.com/anime/', 'なくしたページ：外した作品とコーナーは近いページへ 301');
  ok(g.res.status === 301, 'なくしたページ：古いアドレスからも転送される');
  ok(mw.MOVED_PATHS.every(([from]) => !chars.some((x) => `/${x.slug}/` === from) && !corners.some((k) => `/${k.slug}/` === from)), 'なくしたページ：いまある作品・コーナーを転送していない');
  ok(`https://${mw.CANONICAL_HOST}/` === settings.siteUrl && (await import('./lib/rakuten-core.mjs')).SITE_ORIGIN === `https://${mw.CANONICAL_HOST}`, '引っ越し：転送先・サイトのURL・楽天の Referer がそろっている');
}

console.log(failed ? `\n${failed}件のNG` : '\nすべてOK');
process.exit(failed ? 1 : 0);
