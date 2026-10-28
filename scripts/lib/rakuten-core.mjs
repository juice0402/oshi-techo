// 楽天市場 商品検索API（2026-07-01版）の呼び方と、返事の読み方。
// 集める（Node）と検索（Cloudflare）の両方で使うので、node: の部品や process.env は使わない。

export const ENDPOINT = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701';
// 楽天の「許可されたWebサイト」に入れたドメイン（nyuka-techo.com。引っ越しのあいだは oshi-techo.pages.dev も残してある）
export const SITE_ORIGIN = 'https://nyuka-techo.com';
// 楽天は「許可されたWebサイト」からの呼び出しだけを受け付けるので、いつもこのRefererを付ける
export const HEADERS = { Referer: `${SITE_ORIGIN}/`, Origin: SITE_ORIGIN };

const ELEMENTS = [
  'itemName',
  'itemCode',
  'itemPrice',
  'affiliateUrl',
  'mediumImageUrls',
  'shopName',
  'availability',
  'genreId',
  'catchcopy',
  'startTime',
  'endTime',
  'reviewCount',
  'reviewAverage',
  'pointRate',
  'pointRateStartTime',
  'pointRateEndTime',
  'postageFlag', // 0：送料込み 1：送料別
  'giftFlag', // 0：ギフト包装なし 1：ギフト包装あり（ランキングAPIにはない）
];
export { ELEMENTS };

// 楽天側でも外してもらう言葉（中古が多いと新品が埋もれるため、中古を先頭に。6語まで）
export const ngWords = (char) => ['中古', ...char.exclude].slice(0, 6).join(' ');

export function searchUrl({ keys, keyword, page = 1, ngKeyword = '', sort = '-updateTimestamp', availability = '0', withCount = false }) {
  const params = new URLSearchParams({
    applicationId: keys.appId,
    accessKey: keys.accessKey,
    affiliateId: keys.affiliateId,
    keyword,
    hits: '30',
    page: String(page),
    sort,
    imageFlag: '1',
    availability, // '0' は売り切れも取る（再入荷を見つけるため）、'1' は買えるものだけ
    formatVersion: '2',
    elements: [...ELEMENTS, ...(withCount ? ['count', 'pageCount'] : [])].join(','),
  });
  if (ngKeyword) params.set('NGKeyword', ngKeyword);
  return `${ENDPOINT}?${params}`;
}

function firstImage(item) {
  const list = item.mediumImageUrls;
  if (!Array.isArray(list) || list.length === 0) return '';
  const v = list[0];
  return typeof v === 'string' ? v : v?.imageUrl ?? '';
}

// 返事から、使う項目だけの形にする
export function parseItems(json) {
  const raw = json?.Items ?? json?.items ?? [];
  return raw.map((r) => {
    const it = r.Item ?? r.item ?? r;
    return {
      code: String(it.itemCode ?? ''),
      name: String(it.itemName ?? ''),
      price: Number(it.itemPrice ?? 0),
      url: String(it.affiliateUrl ?? ''),
      img: firstImage(it),
      shop: String(it.shopName ?? ''),
      avail: Number(it.availability ?? 1),
      genre: String(it.genreId ?? ''),
      catchcopy: String(it.catchcopy ?? ''),
      start: String(it.startTime ?? ''),
      end: String(it.endTime ?? ''),
      reviews: Number(it.reviewCount ?? 0),
      rating: Number(it.reviewAverage ?? 0),
      pointRate: Number(it.pointRate ?? 1),
      pointStart: String(it.pointRateStartTime ?? ''),
      pointEnd: String(it.pointRateEndTime ?? ''),
      rank: Number(it.rank ?? 0),
      // 返事に項目がないときは null（わからない）。送料込み・ラッピング対応の印は、わかるときだけ出す
      postage: it.postageFlag === undefined || it.postageFlag === null ? null : Number(it.postageFlag),
      gift: it.giftFlag === undefined || it.giftFlag === null ? null : Number(it.giftFlag),
    };
  });
}

export function cleanKeys(env) {
  return {
    appId: String(env.RAKUTEN_APPLICATION_ID ?? '').trim(),
    accessKey: String(env.RAKUTEN_ACCESS_KEY ?? '').trim(),
    affiliateId: String(env.RAKUTEN_AFFILIATE_ID ?? '').trim(),
  };
}
