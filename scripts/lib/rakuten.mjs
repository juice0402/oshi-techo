// 集めるときに楽天市場 商品検索API（2026-07-01版）を呼ぶ。
// 新方式：applicationId + accessKey + Referer。1.1秒以上あけて呼ぶ。

import { searchUrl, parseItems, cleanKeys, HEADERS } from './rakuten-core.mjs';

const WAIT_MS = 1100;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;

function keys() {
  const k = cleanKeys(process.env);
  if (!k.appId || !k.accessKey || !k.affiliateId) {
    throw new Error('楽天のキー（RAKUTEN_APPLICATION_ID / RAKUTEN_ACCESS_KEY / RAKUTEN_AFFILIATE_ID）がありません');
  }
  return k;
}

// 1ページ分を検索して、使う項目だけの形にして返す
// sort・availability を省くと、新しく更新された順・売り切れも取る
export async function searchPage({ keyword, page, ngKeyword, sort, availability }) {
  const url = searchUrl({ keys: keys(), keyword, page, ngKeyword, ...(sort ? { sort } : {}), ...(availability ? { availability } : {}) });

  // 混んでいるとき（429・500番台）は、5・10・20・40秒あけて5回まで（プレビューと本番の更新が重なることがあるため）
  for (let attempt = 1; attempt <= 5; attempt++) {
    const wait = lastCall + WAIT_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCall = Date.now();

    const res = await fetch(url, { headers: HEADERS });
    const text = await res.text();

    if (res.status === 429 || res.status >= 500) {
      if (attempt < 5) {
        await sleep(5000 * 2 ** (attempt - 1));
        continue;
      }
    }
    if (res.status === 404) return { items: [], pageCount: 0 }; // 該当なし
    if (!res.ok) {
      throw new Error(`楽天APIエラー HTTP ${res.status}：${text.slice(0, 200)}`);
    }

    const json = JSON.parse(text);
    return { items: parseItems(json), pageCount: Number(json.pageCount ?? 0) };
  }
  throw new Error('楽天APIが混んでいて取得できませんでした');
}
