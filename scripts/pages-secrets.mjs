// Cloudflare の関数（探す・公式の最新情報）が楽天と YouTube を呼べるように、GitHub の Secrets にあるキーを
// Cloudflare Pages の秘密の設定（本番とプレビューの両方）に入れる。値はログに出さない。

const env = process.env;
const account = (env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
const token = (env.CLOUDFLARE_API_TOKEN ?? '').trim();
const names = ['RAKUTEN_APPLICATION_ID', 'RAKUTEN_ACCESS_KEY', 'RAKUTEN_AFFILIATE_ID'];

const vars = {};
// YouTube のキーは、なければ動画を出さないだけ（公開は止めない）
const yt = (env.YOUTUBE_API_KEY ?? '').trim();
if (yt) vars.YOUTUBE_API_KEY = { type: 'secret_text', value: yt };
else console.log('::warning title=YouTubeの鍵::YOUTUBE_API_KEY が空なので、公式の最新情報に動画は出ません');
for (const n of names) {
  const v = (env[n] ?? '').trim();
  if (!v) {
    console.log(`::error title=検索用の鍵::${n} が空です`);
    process.exit(1);
  }
  vars[n] = { type: 'secret_text', value: v };
}

const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/oshi-techo`, {
  method: 'PATCH',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ deployment_configs: { production: { env_vars: vars }, preview: { env_vars: vars } } }),
});
const json = await res.json().catch(() => null);
if (!json?.success) {
  const why = (json?.errors ?? []).map((e) => `${e.code} ${e.message}`).join(' / ');
  console.log(`::error title=検索用の鍵::Cloudflare に入れられませんでした（HTTP ${res.status} ${why}）`);
  process.exit(1);
}
console.log('検索用の鍵を Cloudflare に入れました（本番・プレビュー）');
