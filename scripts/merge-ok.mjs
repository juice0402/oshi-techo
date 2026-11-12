// マージの印（.github/workflows/merge-ok.yml。2026-11-02 司令塔「マージを GitHub に任せる」）。Node 22 だけで動く（npm の部品なし）。
// しょーくんが司令塔で「マージして」と言ったあとにだけ、司令塔が PR にラベル merge-ok を付ける。
// 開いている PR のうち merge-ok が付いたものを、番号の小さい順に1つずつ見て、点検が通ったらマージする。
// merge-ok の付いていない PR は絶対にマージしない。
//   1. base が main で、draft でないこと
//   2. 本文の「#数字 の PR #数字 のあとにマージ」「PR #数字 のあとにマージ」「#数字 のあとにマージ」の PR
//      （issue の番号なら、その issue を閉じる PR）がまだ開いていれば待つ
//   3. head の check-runs と commit statuses：まだ終わっていなければ待つ（次の workflow_run で見直す）。
//      失敗があれば、コメントして merge-ok を外し merge-blocked を付ける。check-runs が1つもないときは、ラベルから10分たったらマージしてよい
//   4. mergeable：null なら5秒待って2回まで見直す。false（main とぶつかった）ならコメントして merge-blocked
//   5. squash でマージ（題は「<PR の題> (#番号)」・本文は「マージの印（merge-ok）で #番号 をマージ」。
//      本文を空にすると、GitHub がブランチのコミットの一覧で埋めることがあるため）
//   6. 1本でもマージしたら、最後に1回だけ更新（update.yml）を ref=main で動かす（GITHUB_TOKEN のマージでは push で動く workflow が動かないため。
//      いままで手で動かしていたのと同じ）。結果は待たない（見張り mihari.yml が見る）
//   7. ラベル merge-ok・merge-blocked がなければ作る
// 使い方（merge-ok.yml から。GH_TOKEN が要る）：node scripts/merge-ok.mjs
//   MERGE_OK_DRY_RUN=true ならマージ・コメント・ラベル・更新をせず、するはずのことを出す
//   MERGE_OK_PR=番号 なら、その PR だけ見る（空なら merge-ok の付いた PR を全部）
// テストは scripts/merge-ok-test.mjs（scripts/test.mjs から動かす）

import { pathToFileURL } from 'node:url';

const REPO = process.env.GITHUB_REPOSITORY || 'juice0402/oshi-techo';
export const BASE = 'main';
export const PUBLISH = 'update.yml'; // 公開の workflow（マージしたら workflow_dispatch で ref=main に1回）
export const SELF_CHECK = 'merge-ok'; // この workflow 自身のジョブの名前（check-run の名前）。点検に数えない
export const OK = { name: 'merge-ok', color: '0e8a16', description: 'しょーくんの OK。点検が通ったら GitHub がマージ' };
export const BLOCKED = { name: 'merge-blocked', color: 'b60205', description: '印を付けたがマージできなかった。司令塔が見る' };
export const FAIL = ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'];
export const PASS = ['success', 'skipped', 'neutral'];
export const GRACE = 600; // check-runs が1つもない PR は、ラベルからこの秒数たったらマージしてよい（点検のない PR のため）
const MERGEABLE_RETRY = 2; // mergeable が null のとき、見直す回数
const MERGEABLE_WAIT = 5; // そのあいだに待つ秒数

export class ApiError extends Error {
  constructor(status, text) {
    super(`${status} ${text}`);
    this.status = status;
  }
}

async function github(path, { method = 'GET', body } = {}) {
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const res = await fetch(`${process.env.GITHUB_API_URL || 'https://api.github.com'}/${path}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'user-agent': 'merge-ok',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new ApiError(res.status, (await res.text()).slice(0, 300));
  return res.status === 204 ? null : res.json();
}

const sleepReal = (sec) => new Promise((r) => setTimeout(r, sec * 1000));

// ページをめくって全部（100件ずつ）。key があれば、その欄の配列を集める
async function all(api, path, key = null, pages = 10) {
  const items = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let page = 1; page <= pages; page++) {
    const got = await api(`${path}${sep}per_page=100&page=${page}`);
    const part = (key ? got?.[key] : got) ?? [];
    items.push(...part);
    if (part.length < 100) break;
  }
  return items;
}

// ---- 判定（GitHub に聞かない。テストする所） ----

const SP = '[ \\t]*'; // 行はまたがない
const JOIN = `${SP}(?:の${SP}(?:PR|プルリクエスト)|と|、|,|・|/|&)?${SP}(?:PR${SP})?`;
const ORDER_RE = new RegExp(`(#\\d+(?:${JOIN}#\\d+)*)${SP}の${SP}(?:あと|後)${SP}(?:に|で)?${SP}マージ`, 'gi');

// 本文の「#44 の PR #51 のあとにマージ」「PR #51 のあとにマージ」「#51 のあとにマージ」から番号（小さい順。自分は除く）
export function orderRefs(body, me = null) {
  const text = String(body ?? '').normalize('NFKC'); // ＃１２ → #12
  const nums = new Set();
  for (const m of text.matchAll(ORDER_RE)) for (const n of m[1].matchAll(/#(\d+)/g)) nums.add(Number(n[1]));
  nums.delete(me);
  return [...nums].sort((a, b) => a - b);
}

// その PR が issue #n に対応するか（本文の Closes #n などの閉じる書き方・夜のブランチ night-n）
export function closes(pr, n) {
  const body = String(pr?.body ?? '').normalize('NFKC');
  if (new RegExp(`(?<![A-Za-z])(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)${SP}:?${SP}#${n}(?!\\d)`, 'i').test(body)) return true;
  return new RegExp(`(?:^|/)night-${n}$`).test(String(pr?.head?.ref ?? ''));
}

// 本文の Closes #◯ の番号ぜんぶ（GITHUB_TOKEN の squash では GitHub が issue を閉じないので、マージの印が閉じる）
export function closesOf(body) {
  const s = String(body ?? '').normalize('NFKC');
  return [...new Set([...s.matchAll(new RegExp(`(?<![A-Za-z])(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)${SP}:?${SP}#(\\d+)(?!\\d)`, 'gi'))].map((m) => Number(m[1])))];
}
export const closedText = (n, sha = '') => `PR #${n} でマージ済み${sha ? `（${String(sha).slice(0, 7)}）` : ''}。閉じます（マージの印）`;

// 順番の指定で待つ理由（空ならマージしてよい）。openPrs は 番号 → 開いている PR の Map
export function blockers(pr, openPrs) {
  const me = pr.number;
  const why = [];
  for (const n of orderRefs(pr.body, me)) {
    if (openPrs.has(n)) {
      why.push(`PR #${n} がまだ開いている`);
      continue;
    }
    for (const o of [...openPrs.keys()].sort((a, b) => a - b)) {
      if (o !== me && closes(openPrs.get(o), n)) why.push(`#${n} の PR #${o} がまだ開いている`);
    }
  }
  return why;
}

// issue の events から、いちばん新しい「merge-ok が付いた」時刻
export function labeledAt(events) {
  const times = events.filter((e) => e.event === 'labeled' && e.label?.name === OK.name).map((e) => e.created_at).filter(Boolean);
  return times.length ? times.sort().at(-1) : null;
}

const uniq = (names) => [...new Set(names.map((n) => String(n ?? '（名前なし）')))];

// 点検の判定 → { verdict: 'merge' | 'wait' | 'fail', text, left }。
// left（待つ秒数）は、check-runs が1つもなくて10分たっていないときだけ（ほかは null）
export function judge(checkRuns, statuses, labelTime, now) {
  const runs = checkRuns.filter((c) => c.name !== SELF_CHECK);
  const waiting = [
    ...runs.filter((c) => c.status !== 'completed' || ![...FAIL, ...PASS].includes(c.conclusion)).map((c) => c.name),
    ...statuses.filter((s) => s.state === 'pending').map((s) => s.context),
  ];
  if (waiting.length) return { verdict: 'wait', text: `点検がまだ終わっていない（${uniq(waiting).join('、')}）`, left: null };
  const failed = [
    ...runs.filter((c) => FAIL.includes(c.conclusion)).map((c) => c.name),
    ...statuses.filter((s) => s.state === 'failure' || s.state === 'error').map((s) => s.context),
  ];
  if (failed.length) return { verdict: 'fail', text: uniq(failed).join('、'), left: null };
  if (!runs.length) {
    const t = Date.parse(labelTime ?? '');
    if (Number.isNaN(t)) return { verdict: 'wait', text: '点検（check-runs）が1つもなく、ラベルの時刻もわからない', left: null };
    const passed = (now.getTime() - t) / 1000;
    if (passed < GRACE) {
      const left = Math.floor(GRACE - passed) + 1;
      return { verdict: 'wait', text: `点検（check-runs）がまだ1つもない。ラベルから10分たつまで待つ（あと ${left} 秒）`, left };
    }
    return { verdict: 'merge', text: '点検（check-runs）が無いまま、ラベルから10分たった', left: null };
  }
  return { verdict: 'merge', text: '点検が通った', left: null };
}

export const commitTitle = (pr) => `${pr.title ?? ''} (#${pr.number})`;
// squash の本文（空にしない。空だと GitHub がブランチのコミットの一覧で埋めることがあるため）
export const commitMessage = (pr) => `マージの印（merge-ok）で #${pr.number} をマージ`;
export const hasLabel = (pr, name) => (pr?.labels ?? []).some((l) => l.name === name);

// ---- GitHub に聞く・書く ----

async function ensureLabels(api, log) {
  const have = new Set((await all(api, `repos/${REPO}/labels`)).map((l) => l.name));
  for (const label of [OK, BLOCKED]) {
    if (have.has(label.name)) continue;
    try {
      await api(`repos/${REPO}/labels`, { method: 'POST', body: label });
      log(`ラベル ${label.name} を作った`);
    } catch (e) {
      if (e.status !== 422) throw e; // すでにある
    }
  }
}

async function block(n, text, { api, dry, log }) {
  if (dry) return log(`（ためし）#${n} に「${text}」とコメントし、${OK.name} を外して ${BLOCKED.name} を付けるはず`);
  await api(`repos/${REPO}/issues/${n}/comments`, { method: 'POST', body: { body: text } });
  try {
    await api(`repos/${REPO}/issues/${n}/labels/${OK.name}`, { method: 'DELETE' });
  } catch (e) {
    if (e.status !== 404) throw e;
  }
  await api(`repos/${REPO}/issues/${n}/labels`, { method: 'POST', body: { labels: [BLOCKED.name] } });
  return log(`#${n}: マージしなかった（${text}）。${BLOCKED.name} を付けた`);
}

// PR 1つ → { state: 'merged' | 'wait' | 'grace' | 'blocked' | 'skip', left }
export async function processPr(pr, openPrs, { api = github, dry = false, now = new Date(), log = console.log, sleep = sleepReal } = {}) {
  const n = pr.number;
  const ctx = { api, dry, log };
  if (!hasLabel(pr, OK.name)) return { state: 'skip' }; // 念のため（印のない PR は絶対にマージしない）
  if (pr.base?.ref !== BASE || pr.draft) {
    log(`#${n}: base が ${pr.base?.ref}・draft=${Boolean(pr.draft)}。マージしない`);
    return { state: 'skip' };
  }
  const why = blockers(pr, openPrs);
  if (why.length) {
    log(`#${n}: 順番を待つ（${why.join('・')}）`);
    return { state: 'wait' };
  }
  const sha = pr.head.sha;
  const runs = await all(api, `repos/${REPO}/commits/${sha}/check-runs?filter=latest`, 'check_runs');
  const statuses = await all(api, `repos/${REPO}/commits/${sha}/status`, 'statuses');
  let labelTime = null;
  if (!runs.some((c) => c.name !== SELF_CHECK)) labelTime = labeledAt(await all(api, `repos/${REPO}/issues/${n}/events`)); // check-runs が無いときだけ聞く
  const { verdict, text, left } = judge(runs, statuses, labelTime, now);
  if (verdict === 'wait') {
    log(`#${n}: 待つ（${text}）`);
    return left ? { state: 'grace', left } : { state: 'wait' };
  }
  if (verdict === 'fail') {
    await block(n, `点検が通らなかったのでマージしなかった（${text}）`, ctx);
    return { state: 'blocked' };
  }
  let full = {};
  for (let i = 0; i <= MERGEABLE_RETRY; i++) {
    full = (await api(`repos/${REPO}/pulls/${n}`)) ?? {};
    if (full.mergeable !== null && full.mergeable !== undefined) break;
    if (i < MERGEABLE_RETRY) await sleep(MERGEABLE_WAIT);
  }
  if (full.state !== 'open' || !hasLabel(full, OK.name)) {
    log(`#${n}: もう開いていない・印が外れた。マージしない`);
    return { state: 'skip' };
  }
  if (full.mergeable === null || full.mergeable === undefined) {
    log(`#${n}: マージできるか GitHub がまだ調べている。次に見直す`);
    return { state: 'wait' };
  }
  if (full.mergeable === false) {
    await block(n, 'main とぶつかったのでマージしなかった。司令塔で main を取りこむ', ctx);
    return { state: 'blocked' };
  }
  const body = { merge_method: 'squash', sha, commit_title: commitTitle(pr), commit_message: commitMessage(pr) };
  if (dry) {
    log(`（ためし）#${n} を squash でマージするはず（${text}。題「${body.commit_title}」）`);
    return { state: 'merged' };
  }
  let res;
  try {
    res = (await api(`repos/${REPO}/pulls/${n}/merge`, { method: 'PUT', body })) ?? {};
  } catch (e) {
    if (e.status === 409) {
      log(`#${n}: head が変わった。新しい点検のあとに見直す`);
      return { state: 'wait' };
    }
    await block(n, `マージできなかった（GitHub の答え: ${String(e.message).slice(0, 150)}）`, ctx);
    return { state: 'blocked' };
  }
  if (!res.merged) {
    await block(n, `マージできなかった（GitHub の答え: ${String(res.message ?? '').slice(0, 150)}）`, ctx);
    return { state: 'blocked' };
  }
  log(`#${n}: マージした（${text}）`);
  await closeLinked(pr, res.sha ?? '', ctx);
  return { state: 'merged' };
}

// マージした PR の本文の Closes #◯ の issue を、コメントをつけて閉じる（開いている issue だけ。PR・閉じた issue はさわらない。失敗してもマージは止めない）
export async function closeLinked(pr, sha = '', { api = github, dry = false, log = console.log } = {}) {
  const done = [];
  for (const n of closesOf(pr?.body)) {
    try {
      const it = await api(`repos/${REPO}/issues/${n}`);
      if (!it || it.pull_request || it.state !== 'open') continue;
      if (dry) {
        log(`（ためし）#${n} を閉じるはず（PR #${pr.number} の Closes）`);
        continue;
      }
      await api(`repos/${REPO}/issues/${n}/comments`, { method: 'POST', body: { body: closedText(pr.number, sha) } });
      await api(`repos/${REPO}/issues/${n}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
      log(`#${n} を閉じた（PR #${pr.number} の Closes）`);
      done.push(n);
    } catch (e) {
      log(`#${n} を閉じられなかった（${String(e.message).slice(0, 150)}）`);
    }
  }
  return done;
}

// 1回ぶん見る → { merged: マージした番号, grace: いちばん早く10分たつまでの秒数 or null, error: 失敗があったか }。
// only（PR の番号）があれば、その PR だけ見る（それでも merge-ok が無ければマージしない）
export async function runOnce(opts = {}) {
  const { api = github, log = console.log, now = new Date(), only = null } = opts;
  const prs = await all(api, `repos/${REPO}/pulls?state=open`);
  const openPrs = new Map(prs.map((p) => [p.number, p])); // 順番の指定は、ほかの開いている PR も見る
  const marked = prs.filter((p) => hasLabel(p, OK.name) && (only === null || p.number === only)).sort((a, b) => a.number - b.number);
  if (!marked.length) log(`${OK.name} の付いた PR はない${only === null ? '' : `（#${only} だけ見た）`}`);
  const merged = [];
  const grace = [];
  let error = false;
  for (const pr of marked) {
    let r;
    try {
      r = await processPr(pr, openPrs, { ...opts, api, log, now });
    } catch (e) {
      if (!(e instanceof ApiError)) throw e;
      log(`#${pr.number}: GitHub に聞けなかった（${String(e.message).slice(0, 200)}）。次に見直す`);
      error = true;
      continue;
    }
    if (r.state === 'merged') {
      merged.push(pr.number);
      openPrs.delete(pr.number); // このあとの PR の順番の指定のため
    } else if (r.state === 'grace') grace.push(r.left);
  }
  return { merged, grace: grace.length ? Math.min(...grace) : null, error };
}

export async function main({
  api = github,
  log = console.log,
  sleep = sleepReal,
  now = () => new Date(),
  dry = (process.env.MERGE_OK_DRY_RUN ?? '').toLowerCase() === 'true',
  pr = process.env.MERGE_OK_PR ?? '',
  sweep = (process.env.MERGE_OK_SWEEP ?? '').toLowerCase() === 'true',
} = {}) {
  const want = String(pr).trim();
  if (want && !/^\d+$/.test(want)) {
    log('MERGE_OK_PR は数字だけ');
    return 2;
  }
  const only = want ? Number(want) : null;
  if (dry) log('ためし（dry_run）: マージ・コメント・ラベル・更新はしない');
  else await ensureLabels(api, log);
  if (sweep) {
    // 掃除：この21日に main へマージされた PR の Closes #◯ で、まだ開いている issue を閉じる
    const since = now().getTime() - 21 * 864e5;
    const done = await all(api, `repos/${REPO}/pulls?state=closed&sort=updated&direction=desc`, null, 3);
    for (const p of done) {
      if (!p.merged_at || Date.parse(p.merged_at) < since || p.base?.ref !== BASE) continue;
      await closeLinked(p, p.merge_commit_sha ?? '', { api, dry, log });
    }
    log('掃除が終わった');
    return 0;
  }
  const first = await runOnce({ api, log, sleep, dry, only, now: now() });
  const merged = [...first.merged];
  let { error } = first;
  if (first.grace && !dry) {
    // 点検のない PR：10分たつまでここで待って、もう1回だけ見る
    log(`点検（check-runs）のない PR があるので、${first.grace} 秒待って見直す`);
    await sleep(Math.min(first.grace, GRACE) + 5);
    const again = await runOnce({ api, log, sleep, dry, only, now: now() });
    merged.push(...again.merged);
    error ||= again.error;
  }
  if (merged.length) {
    if (dry) log(`（ためし）更新（${PUBLISH}）を ${BASE} で1回動かすはず`);
    else {
      await api(`repos/${REPO}/actions/workflows/${PUBLISH}/dispatches`, { method: 'POST', body: { ref: BASE } });
      log(`更新（${PUBLISH}）を ${BASE} で動かした（結果は見張りが見る）`);
    }
  }
  return error ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main()
    .then((code) => process.exit(code))
    .catch((e) => {
      console.log(`マージの印: うまく動きませんでした（${String(e.message).slice(0, 200)}）`);
      process.exit(1);
    });
}
