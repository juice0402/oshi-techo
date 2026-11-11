// 推しグッズ入荷手帳の「更新」（.github/workflows/update.yml）を、決まった時間に動かす Worker（oshi-cron）。
// GitHub の予定の実行（schedule）は、お昼の混む時間に何日も飛ばされた（11/2〜11/4・11/5〜11/11）ので、
// お昼の 12:07 と予備の 13:43 はここから workflow_dispatch で動かす。夕方と毎月1日は update.yml の schedule のまま。
// 秘密の設定 GITHUB_TOKEN：fine-grained の鍵（juice0402/oshi-techo だけ・Actions の読み書き）。くわしくは docs/shikumi.md。
const REPO = 'juice0402/oshi-techo';
const WORKFLOW = 'update.yml';
const YOBI_CRON = '43 4 * * *'; // 日本時間 13:43（予備の回。前の150分にほかの更新が動いていれば update.yml の gate が休む）

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatch(env, event.cron === YOBI_CRON));
  },
  async fetch() {
    return new Response('Not Found', { status: 404 });
  },
};

export async function dispatch(env, yobi, fetchFn = fetch) {
  if (!env.GITHUB_TOKEN) throw new Error('秘密の設定 GITHUB_TOKEN がない');
  const body = { ref: 'main' };
  if (yobi) body.inputs = { yobi: 'true' };
  const res = await fetchFn(`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'oshi-cron',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    throw new Error(`更新を動かせなかった（${res.status}）：${text}`);
  }
  console.log(yobi ? '予備の回（13:43）を動かした' : 'お昼の回（12:07）を動かした');
}
