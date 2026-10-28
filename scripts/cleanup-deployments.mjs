// Cloudflare Pages に残っている古い公開（デプロイ）を消す。
// 古いデプロイにも、そのときのページがそのまま残る（YouTube の動画の情報が入っていた時期のものもある）ので、
// いまの本番以外で、KEEP_DAYS 日より古いものは消す（YouTube API サービスの決まり III.E.4 の30日より短く）。
// 使い方：node scripts/cleanup-deployments.mjs（GitHub Actions から。キーは Secrets）

const env = process.env;
const account = (env.CLOUDFLARE_ACCOUNT_ID ?? '').trim();
const token = (env.CLOUDFLARE_API_TOKEN ?? '').trim();
const KEEP_DAYS = Number(env.KEEP_DAYS ?? 3);
const base = `https://api.cloudflare.com/client/v4/accounts/${account}/pages/projects/oshi-techo`;
const headers = { Authorization: `Bearer ${token}` };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const note = (level, msg) => {
  console.log(msg);
  if (env.GITHUB_ACTIONS) console.log(`::${level} title=古い公開を消す::${msg}`);
};

const project = await fetch(base, { headers }).then((r) => r.json()).catch(() => null);
const keep = project?.result?.canonical_deployment?.id;
if (!project?.success || !keep) {
  note('warning', `プロジェクトの情報が取れませんでした（${(project?.errors ?? []).map((e) => e.message).join(' / ')}）`);
  process.exit(0);
}

// 古いものから順に見たいので、全部のページを集める
const all = [];
for (let page = 1; page <= 40; page++) {
  const j = await fetch(`${base}/deployments?page=${page}&per_page=25`, { headers }).then((r) => r.json()).catch(() => null);
  const list = j?.result ?? [];
  all.push(...list);
  if (list.length < 25) break;
}

const limit = Date.now() - KEEP_DAYS * 86400000;
const old = all.filter((d) => d.id !== keep && Date.parse(d.created_on) < limit);
let done = 0;
let failed = 0;
for (const d of old) {
  const r = await fetch(`${base}/deployments/${d.id}?force=true`, { method: 'DELETE', headers }).then((x) => x.json()).catch(() => null);
  if (r?.success) done++;
  else failed++;
  await sleep(250);
}
note(failed ? 'warning' : 'notice', `デプロイ ${all.length}件のうち、${KEEP_DAYS}日より古い ${old.length}件 → 消した ${done}件${failed ? `・消せなかった ${failed}件` : ''}（いまの本番は残す）`);
