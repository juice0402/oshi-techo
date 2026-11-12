// 商品名から、カテゴリ・予約の情報・同じ商品かどうかの目印を決める。
// 楽天の商品情報そのものは変えず、並べ方と印のためだけに使う。

import { normalize } from './text.mjs';

// 上から順に当てはめる（最初に当たったカテゴリ）
export const CATEGORIES = [
  { slug: 'nuigurumi', name: 'ぬいぐるみ', words: ['ぬいぐるみ', 'ぬいぐるみキーチェーン', 'マスコット', 'もちもち'] },
  { slug: 'keyholder', name: 'キーホルダー・チャーム', words: ['キーホルダー', 'キーチェーン', 'チャーム', 'ストラップ', 'アクリルスタンド', 'アクスタ', '缶バッジ', 'バッジ'] },
  { slug: 'bunbougu', name: '文房具', words: ['ボールペン', 'シャープペン', 'ノート', 'メモ帳', 'メモ', 'ふせん', '付箋', 'シール', 'ステッカー', 'クリアファイル', 'ペンケース', '筆箱', '下敷き', 'レターセット', 'スタンプ', 'マスキングテープ', 'マステ', '消しゴム', '鉛筆', 'えんぴつ', '手帳', 'スケジュール帳', 'ファイル'] },
  { slug: 'shokki', name: '食器・キッチン', words: ['マグカップ', 'タンブラー', 'グラス', 'コップ', 'お皿', 'プレート', 'ボウル', '箸', 'お弁当', '弁当箱', 'ランチ', '水筒', 'ボトル', 'カトラリー', 'スプーン', 'エプロン'] },
  { slug: 'bag', name: 'バッグ・ポーチ', words: ['リュック', 'トートバッグ', 'トート', 'ショルダー', 'サコッシュ', 'バッグ', 'ポーチ', '巾着', '財布', 'がま口', 'パスケース', 'カードケース'] },
  { slug: 'smartphone', name: 'スマホグッズ', words: ['スマホケース', 'iphoneケース', 'iphone', 'スマホ', 'モバイルバッテリー', 'イヤホン', 'グリップ'] },
  { slug: 'fashion', name: 'ファッション', words: ['tシャツ', 'パーカー', 'パジャマ', 'ルームウェア', 'スウェット', 'トレーナー', '靴下', 'ソックス', '帽子', 'キャップ', 'ヘアクリップ', 'ヘアゴム', 'ヘアピン', 'シュシュ', 'ネックレス', 'リング', 'ピアス', 'イヤリング', 'サンダル', 'スリッパ', '腕時計'] },
  { slug: 'nichiyouhin', name: '日用品・インテリア', words: ['タオル', 'ハンカチ', 'ブランケット', 'ひざかけ', 'クッション', 'マット', 'ティッシュ', '時計', 'ライト', 'ランプ', '傘', '歯ブラシ', 'ミラー', '鏡', 'コースター', 'ポスター', '加湿器', 'ゴミ箱', 'カーテン', 'シーツ', '枕'] },
  { slug: 'okashi', name: 'お菓子・食品', words: ['お菓子', 'グミ', 'チョコ', 'クッキー', 'キャンディ', 'ラムネ', 'せんべい', 'ふりかけ', 'カレー', 'ラーメン', 'ドリンク', 'ジュース'] },
  { slug: 'omocha', name: 'おもちゃ・ゲーム', words: ['フィギュア', 'トミカ', 'プラモデル', 'ゲーム', 'switch', 'パズル', 'ブロック', 'おもちゃ', 'ガチャ', 'カプセル', 'ソフビ', 'プラレール'] },
  { slug: 'hon', name: '本・カレンダー', words: ['コミック', '絵本', 'カレンダー', '雑誌', 'ムック', '画集', '単行本', 'ブック'] },
];

// 推しキャラの名前が商品名に入っているかを見る関数を返す。
// strict のキャラは、前後がカタカナ・英字でないときだけ（「ベル」を「ラベル」「ベルト」と分ける）
const KANA_OR_LATIN = '\\p{Script=Katakana}\\u30fca-z';
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export function oshiMatcher(o) {
  const words = [o.name, ...(o.match ?? [])].map(normalize);
  if (!o.strict) return (name) => words.some((w) => normalize(name).includes(w));
  const res = words.map((w) => new RegExp(`(?<![${KANA_OR_LATIN}])${escRe(w)}(?![${KANA_OR_LATIN}])`, 'u'));
  return (name) => res.some((r) => r.test(normalize(name)));
}

// 子ども向け：商品名にキッズ・子ども・小学生・ベビーなどがあるもの
const KIDS = /キッズ|子供|子ども|こども|ベビー|baby|幼児|小学生|女の子|男の子|ランドセル|通園|通学|入園|入学|赤ちゃん|知育|ジュニア|児童|幼稚園|保育園|園児|\d+歳/;
// 大人向け：子ども向けではなく、商品名に「大人」「レディース」「メンズ」があるか、大人が使う種類（財布・食器・アクセサリー・インテリアなど）
// 「大人気」「大人買い」は大人向けの意味ではないので数えない
const ADULT_WORDS = /大人(?!気|買い)|レディース|メンズ|婦人|紳士|ladies|mens/;
const ADULT_TYPES = /財布|キーケース|名刺入れ|カードケース|パスケース|定期入れ|腕時計|ネックレス|ピアス|イヤリング|ブレスレット|タンブラー|マグカップ|グラス|食器|プレート|茶碗|湯呑|カトラリー|ルームウェア|インテリア|エコバッグ|トートバッグ|ショルダーバッグ|ハンカチ|ブランケット|コースター|ステンレスボトル/;
export const isKids = (name) => KIDS.test(normalize(name));
export const isAdult = (name) => {
  const n = normalize(name);
  if (KIDS.test(n)) return false;
  if (ADULT_WORDS.test(n)) return true;
  // ぬいぐるみ・おもちゃ・文房具（マグカップの形の付箋など）は、「大人」などの言葉がはっきりあるときだけ
  const cat = categoryOf(n);
  return !['nuigurumi', 'omocha', 'bunbougu'].includes(cat) && ADULT_TYPES.test(n);
};

// コラボグッズ：商品名に「コラボ」があるか、「×」「✕」の両側が言葉のもの（docs/shikumi.md の「コラボグッズ」）。
// 「26×38cm」「H×W×D」「W60×D40」「×10枚」「約20×55cm」のようなサイズやセット数は外す。
// コラボではない「×」も外す（#85）：色の組（オフホワイト×ブラック・BL×RD）、セールの言葉（スーパーSALE×ポイントアップ）、
// 商品の組（ジグソーパズル×アクスタ）、同じ作品のキャラ同士（ちいかわ×うさぎ。names に作品の名前の一覧を渡したときだけ）。
// 「限定」は数量限定・店舗限定まで入って広すぎるので見分けに使わない
const COLLAB_WORD = /[\p{L}\p{N}ー]/u;
// 「×」のとなりの言葉（字・数字・ーが続くところ）
const LEFT_WORD = /[\p{L}\p{N}ー]+$/u;
const RIGHT_WORD = /^[\p{L}\p{N}ー]+/u;
const COLORS = ['オフホワイト', 'ホワイト', 'ブラック', 'アイボリー', 'ブラウン', 'グリーン', 'ラメ', 'レッド', 'ブルー', 'ピンク', 'ネイビー', 'グレー', 'グレイ', 'ベージュ', 'イエロー', 'パープル', 'オレンジ', 'シルバー', 'ゴールド', 'カーキ', 'ミント', 'ラベンダー', 'クリア', 'ライト', 'ダーク', 'black', 'white', 'red', 'blue', 'pink', 'navy', 'gray', 'grey', 'green', 'brown', 'beige', 'yellow', 'purple', 'orange', 'silver', 'gold', '黒', '白', '赤', '青', '緑', '黄', '茶', '紺', '灰'];
const ONLY_COLORS = new RegExp(`^(?:${COLORS.join('|')})+(?:色|系)?$`, 'u');
const SALE = /スーパーsale|スーパーセール|お買い物マラソン|お買物マラソン|ポイントアップ|ポイント|クーポン/;
const TYPE_WORDS = [...new Set(CATEGORIES.flatMap((c) => c.words).map(normalize))].sort((a, b) => b.length - a.length);
// 言葉がグッズの種類で終わる（ジグソーパズル・アクスタ）。種類の前に作品の名前があるものは数えない
const isTypeWord = (w, names) => {
  const t = TYPE_WORDS.find((x) => w.endsWith(x));
  return !!t && !names.some((x) => w.slice(0, -t.length).includes(x));
};
export function isCollab(name, names = []) {
  const n = normalize(name);
  if (n.includes('コラボ')) return true;
  const own = names.map(normalize).filter((x) => x.length >= 2);
  for (let i = 0; i < n.length; i++) {
    if (n[i] !== '×' && n[i] !== '✕') continue;
    const left = n.slice(0, i).trimEnd();
    const right = n.slice(i + 1).trimStart();
    if (!left || !right || !COLLAB_WORD.test(left.at(-1)) || !COLLAB_WORD.test(right[0])) continue;
    // 左が数字・cm・mm で終わる、左が H・W・D だけ
    if (/(?:\p{N}|cm|mm)$/u.test(left) || /(?:^|[^a-z])[hwd]$/.test(left)) continue;
    // 右が数字・「約」・H・W・D で始まる
    if (/^(?:\p{N}|約|[hwd](?![a-z]))/u.test(right)) continue;
    const lw = left.match(LEFT_WORD)[0];
    const rw = right.match(RIGHT_WORD)[0];
    // 色の組：右がまるごと色の言葉か、左右が英字2文字（左はキャラ名のこともあるので、左だけでは外さない）
    if (ONLY_COLORS.test(rw) || (/^[a-z]{2}$/.test(lw) && /^[a-z]{2}$/.test(rw))) continue;
    // セールの言葉
    if (SALE.test(lw) || SALE.test(rw)) continue;
    // 商品の組
    if (isTypeWord(lw, own) && isTypeWord(rw, own)) continue;
    // 同じ作品のキャラ同士
    if (own.length && own.some((x) => lw.includes(x)) && own.some((x) => rw.includes(x))) continue;
    return true;
  }
  return false;
}

// isCollab にわたす作品の名前の一覧（作品名・match・推しキャラの名前と match）
export const collabNames = (w) => [w.name, ...(w.match ?? []), ...(w.oshi ?? []).flatMap((o) => [o.name, ...(o.match ?? [])])];

export function categoryOf(name) {
  const n = normalize(name);
  for (const c of CATEGORIES) {
    if (c.words.some((w) => n.includes(normalize(w)))) return c.slug;
  }
  return '';
}

// 同じ商品を別のお店が出しているかどうかを見るための目印
const NOISE = /送料無料|送料込み?|あす楽|ポイント\d+倍|在庫あり|即納|当日発送|メール便|ネコポス|ゆうパケット|予約|再販|再入荷|正規品|公式|新品|プレゼント|ギフト|ラッピング|かわいい|可愛い|人気|おすすめ/g;
export function productKey(name) {
  return normalize(name)
    .replace(/【[^】]*】|\[[^\]]*\]|［[^］]*］|〔[^〕]*〕|《[^》]*》|＜[^＞]*＞|<[^>]*>/g, ' ')
    .replace(NOISE, ' ')
    .replace(/[\s・,，、。.／/|｜!！?？~〜★☆◆◇■□●○※♪＊*+＋=＝:：;；'"`]+/g, '')
    .slice(0, 40);
}

// 予約の情報。締切がわかるときは deadline（YYYY-MM-DD）、発売・発送の時期は release（並べ替え用）と label。
// 締切は商品名（とキャッチコピー）に書いてあるときだけ。楽天の販売期間の終わり（endTime）は締切とは限らないので使わない
// （「販売期間◯/◯まで」として view.mjs の marksFor が別に出す）
export function reservationInfo(item, nowIso) {
  const text = normalize(`${item.name} ${item.catchcopy ?? ''}`);
  if (!text.includes('予約')) return null;
  if (/予約(終了|締切済|受付終了|不可)/.test(text)) return null;

  const now = new Date(nowIso);
  const jst = new Date(now.getTime() + 9 * 3600000);
  const nowY = jst.getUTCFullYear();
  const nowM = jst.getUTCMonth() + 1;
  const today = jst.toISOString().slice(0, 10);
  const yearFor = (m) => (m < nowM - 1 ? nowY + 1 : nowY);
  const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  let deadline = '';
  // 「受付期間 10/1〜10/31」は、〜のあとの日が締切
  const dl =
    text.match(/(?:締切|締め切り|〆切|予約期限|受付終了|受付期間)[^\d]{0,8}(?:\d{1,2}[/月]\d{1,2}日?(?:\([^)]*\))?\s*[〜~～-]\s*)?(\d{1,2})[/月](\d{1,2})/) ??
    text.match(/(\d{1,2})[/月](\d{1,2})日?(?:\([^)]*\))?\s*(?:\d{1,2}:\d{2})?\s*まで/);
  if (dl) {
    const m = Number(dl[1]);
    const d = Number(dl[2]);
    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) deadline = ymd(yearFor(m), m, d);
  }
  if (deadline && deadline < today) return null; // 締切が過ぎたもの

  let release = '';
  let label = '';
  // 「11月下旬発売」「2026年11月7日発売予定」「2月中旬頃の発送」「11/30発売」
  const rl =
    text.match(/(?:(\d{4})年)?(\d{1,2})月(?:(\d{1,2})日|(上旬|中旬|下旬|末))?頃?(?:の|に)?(発売|入荷|発送|出荷|お届け|順次発送)/) ??
    text.match(/(?:(\d{4})\/)?(\d{1,2})\/(\d{1,2})()(?:\([^)]*\))?頃?(?:の|に)?(発売|入荷|発送|出荷|お届け|順次発送)/);
  // 「《11月予約》」「2026年11月予約」（ホビーのお店の書き方。その月の発売の予約）
  const rm = rl ? null : text.match(/(?:(\d{4})年)?(\d{1,2})月予約/);
  if (rl || rm) {
    const r = rl ?? [rm[0], rm[1], rm[2], undefined, undefined, '予約'];
    const m = Number(r[2]);
    const day = r[3] ? Number(r[3]) : 0;
    if (m >= 1 && m <= 12 && day <= 31) {
      const y = r[1] ? Number(r[1]) : yearFor(m);
      const part = r[4] ?? '';
      const order = day ? String(day).padStart(2, '0') : { 上旬: '05', 中旬: '15', 下旬: '25', 末: '28' }[part] ?? '15';
      release = `${y}-${String(m).padStart(2, '0')}-${order}`;
      const word = r[5] === '順次発送' ? '発送' : r[5];
      label = `${y !== nowY ? `${y}年` : ''}${m}月${day ? `${day}日` : part}${word}`;
      // 発売・発送の月が2か月以上前か、日にちまで書いてあってその日が過ぎたものは、もう予約の時期ではない
      if (!deadline && y * 12 + m < nowY * 12 + nowM - 1) return null;
      if (!deadline && day && release < today) return null;
    }
  }
  return { deadline, release, label };
}

export function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}
