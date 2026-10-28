// 楽天APIとCloudflareに、Secretsの値でつながるかを確かめる。
// Cloudflare Pages のプロジェクト oshi-techo がまだなければ作り、実際のURLを表示する。
// キーの値はログに出さない（GitHubも自動で伏せ字にする）。

import { appendFileSync } from 'node:fs';

const SITE_ORIGIN = 'https://nyuka-techo.com';
const SITE_URL = `${SITE_ORIGIN}/`;
const PROJECT_NAME = 'oshi-techo';
const RAKUTEN_ENDPOINT = 'https://openapi.rakuten.co.jp/ichibams/api/IchibaItem/Search/20260701';
const CF_API = 'https://api.cloudflare.com/client/v4';

const env = process.env;
const results = []; // { name, ok, detail }

function record(name, ok, detail, warn = false) {
  results.push({ name, ok, detail, warn });
  console.log(`${ok ? (warn ? '注意' : 'OK') : 'NG'}  ${name}: ${detail}`);
  // 実行ページの「注釈」にも出す（スマホやAPIからも結果が見られるように）
  if (env.GITHUB_ACTIONS) {
    const clean = (s) => String(s).replace(/[\r\n]+/g, ' ').replace(/::/g, ':');
    const level = ok ? (warn ? 'warning' : 'notice') : 'error';
    console.log(`::${level} title=${clean(name)}::${clean(detail)}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function checkSecretsPresent() {
  const names = [
    'RAKUTEN_APPLICATION_ID',
    'RAKUTEN_ACCESS_KEY',
    'RAKUTEN_AFFILIATE_ID',
    'CLOUDFLARE_API_TOKEN',
    'CLOUDFLARE_ACCOUNT_ID',
  ];
  for (const n of names) {
    const v = env[n] ?? '';
    if (!v) record(`Secret ${n}`, false, '空です。名前のつづりか、登録されているかを確認');
    else if (v !== v.trim()) record(`Secret ${n}`, true, '前後にスペースか改行が入っています（プログラム側で取り除くので動きます）', true);
    else record(`Secret ${n}`, true, `入っています（${v.length}文字）`);
  }
}

async function checkRakuten() {
  const appId = (env.RAKUTEN_APPLICATION_ID ?? '').trim();
  const accessKey = (env.RAKUTEN_ACCESS_KEY ?? '').trim();
  const affiliateId = (env.RAKUTEN_AFFILIATE_ID ?? '').trim();
  if (!appId || !accessKey) {
    record('楽天API', false, 'アプリIDかアクセスキーがないので試せません');
    return;
  }

  const params = new URLSearchParams({
    applicationId: appId,
    accessKey,
    keyword: 'ちいかわ',
    hits: '3',
    imageFlag: '1',
    sort: '-updateTimestamp',
    formatVersion: '2',
  });
  if (affiliateId) params.set('affiliateId', affiliateId);

  const url = `${RAKUTEN_ENDPOINT}?${params}`;
  const headers = { Referer: SITE_URL, Origin: SITE_ORIGIN };

  let res;
  let body;
  for (let attempt = 1; attempt <= 2; attempt++) {
    res = await fetch(url, { headers });
    body = await res.text();
    if (res.status !== 429) break;
    console.log('楽天APIが混んでいるので5秒待ってやり直します');
    await sleep(5000);
  }

  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    // JSONでない応答はそのまま扱う
  }

  if (!res.ok) {
    const desc = json ? `${json.error ?? ''} ${json.error_description ?? ''}`.trim() : body.slice(0, 200);
    let hint = '楽天の応答を見て原因を調べます';
    if (/applicationId/i.test(desc)) hint = 'アプリIDがまちがっている可能性';
    else if (/access ?key/i.test(desc)) hint = 'アクセスキーがまちがっている可能性';
    else if (/refer|origin/i.test(desc)) hint = '許可されたWebサイトとRefererが合っていない可能性';
    else if (res.status === 401 || res.status === 403) hint = 'アクセスキーか、許可されたWebサイトの設定の可能性';
    record('楽天API', false, `HTTP ${res.status}（${desc}）→ ${hint}`);
    return;
  }

  const items = json?.Items ?? json?.items ?? [];
  const count = json?.count ?? 0;
  record('楽天API', true, `つながりました。「ちいかわ」で${count}件ヒット`);

  if (items.length === 0) {
    record('商品データ', false, '商品が0件でした');
    return;
  }
  const first = items[0].Item ?? items[0].item ?? items[0];
  const img = Array.isArray(first.mediumImageUrls) ? first.mediumImageUrls[0] : undefined;
  const imgUrl = typeof img === 'string' ? img : img?.imageUrl;
  record('商品データ', true, `例：${String(first.itemName ?? '').slice(0, 40)}／${first.itemPrice}円／画像${imgUrl ? 'あり' : 'なし'}`);

  if (!affiliateId) {
    record('アフィリエイトID', false, 'Secretが空なので確かめられません');
  } else if (typeof first.affiliateUrl !== 'string' || first.affiliateUrl === '') {
    record('アフィリエイトID', false, 'アフィリエイト用URLが返ってきません。IDがまちがっている可能性');
  } else {
    // 楽天はIDを変換した形（hgc/g00…）でリンクに入れるので、リンクの形で確かめる
    let u = null;
    try {
      u = new URL(first.affiliateUrl);
    } catch {
      // 読めないURL
    }
    const looksRight = /^[0-9a-f]{8}(\.[0-9a-f]{8}){3}$/i.test(affiliateId);
    if (u && u.host === 'hb.afl.rakuten.co.jp' && u.pathname.startsWith('/hgc/') && looksRight) {
      record('アフィリエイトID', true, 'IDの形は正しく、楽天のアフィリエイトリンクが作られています（最後の確認はレポートのクリック数）');
    } else if (!looksRight) {
      record('アフィリエイトID', false, 'IDの形が「英数字8文字.8文字.8文字.8文字」ではありません。入れ直してください');
    } else {
      record('アフィリエイトID', false, '楽天のアフィリエイトリンクの形になっていません');
    }
  }
}

async function cf(path, init = {}) {
  const res = await fetch(`${CF_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${(env.CLOUDFLARE_API_TOKEN ?? '').trim()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // 空の応答
  }
  return { status: res.status, json };
}

function cfErrors(json) {
  return (json?.errors ?? []).map((e) => `${e.code} ${e.message}`).join(' / ');
}

async function checkCloudflare() {
  const token = (env.CLOUDFLARE_API_TOKEN ?? '').trim();
  const account = (env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
  if (!token || !account) {
    record('Cloudflare', false, 'トークンかアカウントIDがないので試せません');
    return;
  }

  const verify = await cf('/user/tokens/verify');
  if (verify.json?.success && verify.json?.result?.status === 'active') {
    record('Cloudflareトークン', true, '有効です');
  } else {
    record('Cloudflareトークン', false, `使えません（HTTP ${verify.status} ${cfErrors(verify.json)}）。トークンを作り直して入れ直してください`);
    return;
  }

  const got = await cf(`/accounts/${account}/pages/projects/${PROJECT_NAME}`);
  if (got.status === 200 && got.json?.success) {
    record('Cloudflare Pages', true, `プロジェクトはもうあります。URL：https://${got.json.result.subdomain}/`);
    return;
  }

  const notFound = (got.json?.errors ?? []).some((e) => e.code === 8000007) || got.status === 404;
  if (!notFound) {
    let hint = '権限かアカウントIDを確認';
    if (got.status === 403 || (got.json?.errors ?? []).some((e) => e.code === 10000)) {
      hint = 'トークンの権限が Cloudflare Pages／Edit になっているか、アカウントIDが合っているか確認';
    } else if ((got.json?.errors ?? []).some((e) => e.code === 7003)) {
      hint = 'アカウントIDがまちがっている可能性';
    }
    record('Cloudflare Pages', false, `HTTP ${got.status}（${cfErrors(got.json)}）→ ${hint}`);
    return;
  }

  const created = await cf(`/accounts/${account}/pages/projects`, {
    method: 'POST',
    body: JSON.stringify({ name: PROJECT_NAME, production_branch: 'main' }),
  });
  if (created.json?.success) {
    const sub = created.json.result.subdomain;
    const same = sub === `${PROJECT_NAME}.pages.dev`;
    record(
      'Cloudflare Pages',
      true,
      `プロジェクトを作りました。URL：https://${sub}/${same ? '' : '（予定と違うので、楽天の登録を直す必要あり）'}`,
    );
  } else {
    record('Cloudflare Pages', false, `プロジェクトを作れませんでした（HTTP ${created.status} ${cfErrors(created.json)}）`);
  }
}

checkSecretsPresent();
await checkRakuten();
await checkCloudflare();

const allOk = results.every((r) => r.ok);
const lines = [
  `## 接続テストの結果：${allOk ? 'すべてOK' : 'NGあり'}`,
  '',
  '| 項目 | 結果 | くわしく |',
  '| --- | --- | --- |',
  ...results.map((r) => `| ${r.name} | ${r.ok ? (r.warn ? '注意' : 'OK') : 'NG'} | ${r.detail.replaceAll('|', '／')} |`),
];
if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
console.log(`\n${allOk ? 'すべてOK' : 'NGあり'}`);
process.exit(allOk ? 0 : 1);
