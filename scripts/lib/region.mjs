// ご当地グッズ：商品名の地名から、都道府県と地方を読み取る。
import { normalize } from './text.mjs';

export const AREAS = [
  { slug: 'hokkaido-tohoku', name: '北海道・東北', prefs: ['北海道', '青森', '岩手', '宮城', '秋田', '山形', '福島'] },
  { slug: 'kanto', name: '関東', prefs: ['茨城', '栃木', '群馬', '埼玉', '千葉', '東京', '神奈川'] },
  { slug: 'chubu', name: '中部', prefs: ['新潟', '富山', '石川', '福井', '山梨', '長野', '岐阜', '静岡', '愛知'] },
  { slug: 'kinki', name: '近畿', prefs: ['三重', '滋賀', '京都', '大阪', '兵庫', '奈良', '和歌山'] },
  { slug: 'chugoku-shikoku', name: '中国・四国', prefs: ['鳥取', '島根', '岡山', '広島', '山口', '徳島', '香川', '愛媛', '高知'] },
  { slug: 'kyushu-okinawa', name: '九州・沖縄', prefs: ['福岡', '佐賀', '長崎', '熊本', '大分', '宮崎', '鹿児島', '沖縄'] },
];

// 地名（市や観光地）→ 都道府県
const PLACES = {
  札幌: '北海道', 函館: '北海道', 小樽: '北海道', 富良野: '北海道', 旭川: '北海道', 仙台: '宮城', 松島: '宮城', 会津: '福島',
  浅草: '東京', 日光: '栃木', 草津: '群馬', 横浜: '神奈川', 鎌倉: '神奈川', 箱根: '神奈川', 湘南: '神奈川', 江の島: '神奈川',
  軽井沢: '長野', 飛騨: '岐阜', 高山: '岐阜', 富士山: '静岡', 熱海: '静岡', 伊豆: '静岡', 名古屋: '愛知', 金沢: '石川',
  伊勢: '三重', 神戸: '兵庫', 姫路: '兵庫', 倉敷: '岡山', 出雲: '島根', 宮島: '広島', 道後: '愛媛', 松山: '愛媛', 小豆島: '香川',
  博多: '福岡', 別府: '大分', 由布院: '大分', 湯布院: '大分', 那覇: '沖縄', 石垣: '沖縄', 宮古島: '沖縄',
  // 観光地・名所（都道府県が1つに決まるものだけ。2つの県にまたがる名所は入れない）
  富士急ハイランド: '山梨', 富士吉田: '山梨', 河口湖: '山梨', 山中湖: '山梨',
  お台場: '東京', スカイツリー: '東京', 秋葉原: '東京', 原宿: '東京', 渋谷: '東京', 新宿: '東京',
  知床: '北海道', 登別: '北海道', 白川郷: '岐阜', 道頓堀: '大阪', 通天閣: '大阪', 美ら海: '沖縄',
  大涌谷: '神奈川', ハワイアンズ: '福島',
};

// 都道府県のローマ字（ページの中の見出しの id。#p-<ローマ字>）
const ROMA = {
  北海道: 'hokkaido', 青森: 'aomori', 岩手: 'iwate', 宮城: 'miyagi', 秋田: 'akita', 山形: 'yamagata', 福島: 'fukushima',
  茨城: 'ibaraki', 栃木: 'tochigi', 群馬: 'gunma', 埼玉: 'saitama', 千葉: 'chiba', 東京: 'tokyo', 神奈川: 'kanagawa',
  新潟: 'niigata', 富山: 'toyama', 石川: 'ishikawa', 福井: 'fukui', 山梨: 'yamanashi', 長野: 'nagano', 岐阜: 'gifu', 静岡: 'shizuoka', 愛知: 'aichi',
  三重: 'mie', 滋賀: 'shiga', 京都: 'kyoto', 大阪: 'osaka', 兵庫: 'hyogo', 奈良: 'nara', 和歌山: 'wakayama',
  鳥取: 'tottori', 島根: 'shimane', 岡山: 'okayama', 広島: 'hiroshima', 山口: 'yamaguchi', 徳島: 'tokushima', 香川: 'kagawa', 愛媛: 'ehime', 高知: 'kochi',
  福岡: 'fukuoka', 佐賀: 'saga', 長崎: 'nagasaki', 熊本: 'kumamoto', 大分: 'oita', 宮崎: 'miyazaki', 鹿児島: 'kagoshima', 沖縄: 'okinawa',
};
export const prefId = (pref) => `p-${ROMA[pref]}`;

const PREF_ORDER = AREAS.flatMap((a) => a.prefs);
const AREA_OF = Object.fromEntries(AREAS.flatMap((a) => a.prefs.map((p) => [p, a])));
const WORDS = [...PREF_ORDER, ...Object.keys(PLACES)];

// 商品名の中でいちばん前に出てくる地名の都道府県。「東京都」の「京都」は数えない
export function regionOf(name) {
  const n = normalize(name).replace(/東京都/g, '東京');
  let best = null;
  for (const w of WORDS) {
    const i = n.indexOf(w);
    if (i < 0) continue;
    if (w === '高山' && n.includes('飛騨')) continue;
    if (!best || i < best.i) best = { i, pref: PLACES[w] ?? w };
  }
  if (!best) return null;
  return { pref: best.pref, area: AREA_OF[best.pref], order: PREF_ORDER.indexOf(best.pref) };
}

// ご当地グッズかどうか：「（地名）限定」「（地名）ご当地」があるもの。「ご当地」だけのときは、地名もあるか、「ご当地」が商品名のはじめ
// （宣伝の【】などと「送料無料」を除いて HEAD 文字まで）にあるもの。ガチャのお店の名前「ご当地本舗」と、商品名のうしろに言葉を並べただけの
// 「ご当地」は数えない（2026-10-29、本当のデータで、ガチャの単品・学習机のマットなどがご当地のページにまざっていた）
const LIMITED = new RegExp(`(${WORDS.join('|')})(県|府|都)?(限定|ご当地)`);
const HEAD = 40;
export function isGotouchi(name) {
  const n = normalize(name).replace(/東京都/g, '東京').replace(/御当地/g, 'ご当地').replace(/ご当地本舗/g, '');
  if (LIMITED.test(n)) return true;
  if (!n.includes('ご当地')) return false;
  if (WORDS.some((w) => n.includes(w))) return true;
  const head = n
    .replace(/【[^】]*】|\\[^/]*\/|\[[^\]]*\]|★[^★]*★/g, ' ')
    .replace(/^\s*送料無料\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
  const i = head.indexOf('ご当地');
  return i >= 0 && i <= HEAD;
}
