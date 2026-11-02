// 見張り（.github/workflows/mihari.yml。2026-11-02 司令塔「見張りをサイトのプログラムにする」）。Node 22 だけで動く（npm の部品なし）。
// 止まると困る実行（更新・資料の点検）が終わるたびに（workflow_run）動く。Claude の使用量は使わない。
//   - 失敗（failure・timed_out・startup_failure）→ issue（ラベル mihari＝しょーくんに知らせるだけ）を作る。
//     同じ題の開いた issue があれば作らず、その日（日本時間）にまだなら「まだ続いている（実行の URL）」のコメントを1つだけ。
//   - 成功 → 同じ題の開いた issue に「直った（実行の URL）」とコメントして閉じる。
//     更新（update.yml）は、毎月の終わりの休みの回（gate で update が動かない回）では閉じない。
//   - cancelled などは何もしない。注記だけ（warning）で成功した回も何もしない。
// issue には楽天のデータを書かない（このリポジトリは公開）。失敗の注記（failure）だけを写す。更新の注記は「失敗」だけで、
// くわしい出力は非公開の oshi-techo-data の notes/update.log にある。
// 使い方（mihari.yml から。GH_TOKEN が要る）：node scripts/mihari.mjs
//   workflow_run のときは、その実行を見る。手で動かしたとき（workflow_dispatch）は、見張る workflow ごとに main のいちばん新しい実行。
//   MIHARI_RUN_ID があれば、その実行だけ。MIHARI_DRY_RUN=true なら issue を作らず、作るはずの題と本文を出す。
// テストは scripts/mihari-test.mjs（scripts/test.mjs から動かす）

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const REPO = process.env.GITHUB_REPOSITORY || 'juice0402/oshi-techo';
export const BOT = 'github-actions[bot]';
export const LABEL = { name: 'mihari', color: 'd93f0b', description: '見張りが見つけた。しょーくんに知らせるだけ' };
export const SIGN = '見張り（.github/workflows/mihari.yml）が作った';
const CHAT = '推し手帳のチャット';
const FAIL = ['failure', 'timed_out', 'startup_failure'];
const NOTES_MAX = 3; // 失敗の注記は、はじめのこの数だけ
const TEXT_MAX = 200; // 1つこの字数まで

// 見張る workflow（ファイルの名前 → issue の題など）。mihari.yml の workflows: にも name: で同じものを並べる（scripts/mihari-test.mjs が突き合わせる）
export const WATCH = {
  'update.yml': {
    title: '【見張り】更新が失敗した',
    what: '1日2回の更新（楽天から集める・ページを作る・テスト・本番に公開）が失敗して、サイトが新しくなっていません。',
    more: 'くわしい出力は、非公開の juice0402/oshi-techo-data の notes/update.log（公開のログには「済」「失敗」だけ）',
    ask: '更新が止まってる',
    job: 'update', // 成功でも、このジョブが動いていない回（毎月の終わりの休み）では閉じない
  },
  'check-sources.yml': {
    title: '【見張り】読みものの資料の点検が動かなかった',
    what: '毎週の読みものの資料の点検（check-sources.yml）が途中で止まって、資料と買い方メモのリンクを確かめられていません（サイトの公開は止まっていません）。',
    ask: '資料の点検が止まってる',
  },
};

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
      'user-agent': 'mihari',
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new ApiError(res.status, (await res.text()).slice(0, 200));
  return res.status === 204 ? null : res.json();
}

// ---- 判定（GitHub に聞かない。テストする所） ----

const jstDate = (iso) => {
  const t = Date.parse(iso ?? '');
  return Number.isNaN(t) ? null : new Date(t + 9 * 3600e3); // getUTC* で日本時間を読む
};

export const when = (iso) => {
  const d = jstDate(iso);
  return d ? `${d.getUTCMonth() + 1}月${d.getUTCDate()}日 ${d.getUTCHours()}:${String(d.getUTCMinutes()).padStart(2, '0')}（日本時間）` : '（時刻がわからない）';
};

export const jstDay = (iso) => jstDate(iso)?.toISOString().slice(0, 10) ?? '';

// その日（日本時間）の0時を、GitHub の時刻（UTC）で
export const midnightUtc = (now) => new Date(Date.parse(`${jstDay(now.toISOString())}T00:00:00+09:00`)).toISOString().replace(/\.\d+Z$/, 'Z');

export const workflowFile = (run) => String(run?.path ?? '').split('@')[0].split('/').pop();

// 'fail'（issue を作る）・'ok'（閉じる）・null（何もしない）
export const kind = (conclusion) => (FAIL.includes(conclusion) ? 'fail' : conclusion === 'success' ? 'ok' : null);

const short = (text) => {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  return t.length <= TEXT_MAX ? t : `${t.slice(0, TEXT_MAX - 1)}…`;
};

// check-runs の annotations から、失敗の注記（はじめの3つ）。「Process completed with exit code 1.」は理由にならないので後ろへ
export function pickNotes(notes) {
  const fails = notes.filter((a) => a.annotation_level === 'failure').map((a) => short(a.message));
  const generic = (m) => m.startsWith('Process completed');
  return [...fails.filter((m) => !generic(m)), ...fails.filter(generic)].slice(0, NOTES_MAX);
}

// 失敗したジョブとステップ（「ジョブ / ステップ」）
export function failedParts(jobs) {
  const ok = ['success', 'skipped', 'neutral', null, undefined];
  return jobs
    .filter((j) => !ok.includes(j.conclusion))
    .map((j) => {
      const steps = (j.steps ?? []).filter((s) => !ok.includes(s.conclusion)).map((s) => s.name);
      return steps.length ? `${j.name} / ${steps.join('・')}` : `${j.name}（${j.conclusion}）`;
    });
}

// runs（新しい順。同じ workflow の main の実行）から、この実行までで { lastOk: 最後の成功の時刻, fails: そのあとの失敗の回数 }
export function history(runs, runId) {
  let lastOk = null;
  let fails = 0;
  for (const r of runs.filter((x) => x.status === 'completed' && Number(x.id) <= Number(runId))) {
    const k = kind(r.conclusion);
    if (k === 'ok') {
      lastOk = r.updated_at;
      break;
    }
    if (k === 'fail') fails++;
  }
  return { lastOk, fails: Math.max(fails, 1) };
}

export function buildBody(cfg, run, parts, notes, hist) {
  const lines = [cfg.what, '', `- いつ: ${when(run.updated_at)}`, `- 失敗した実行: ${run.html_url}（${run.conclusion}）`];
  lines.push(hist.lastOk ? `- 最後にうまくいったのは ${when(hist.lastOk)}。そのあとの失敗は ${hist.fails} 回（この回をふくむ）` : `- 最近の実行に成功が見つからない（失敗 ${hist.fails} 回）`);
  if (parts.length) lines.push(`- 失敗したところ: ${parts.join('、')}`);
  if (cfg.more) lines.push(`- ${cfg.more}`);
  if (notes.length) lines.push('', '失敗の注記（はじめの3つ）:', ...notes.map((m) => `- ${m}`));
  lines.push('', `直すときは、${CHAT}で「${cfg.ask}」と伝える（この issue の番号も）。`, SIGN);
  return lines.join('\n');
}

// その日（日本時間）に、もう知らせたか（issue を作った・見張りがコメントした）
export function notedToday(issue, comments, now) {
  const today = jstDay(now.toISOString());
  if (jstDay(issue.created_at) === today) return true;
  return comments.some((c) => c.user?.login === BOT && jstDay(c.created_at) === today);
}

// ---- GitHub に聞く・書く ----

export async function handle(run, { dry = false, now = new Date(), runs = null, api = github, log = console.log } = {}) {
  const name = workflowFile(run);
  const cfg = WATCH[name];
  if (!cfg) return log(`${name || '（不明）'} は見張っていない。何もしない`);
  if (run.head_branch !== 'main') return log(`${name}: main ではない（${run.head_branch}）。何もしない`);
  const k = kind(run.conclusion);
  if (!k) return log(`${name}: ${run.conclusion}。何もしない`);
  const issues = (await api(`repos/${REPO}/issues?state=open&labels=${LABEL.name}&per_page=100`)) ?? [];
  const issue = issues.find((i) => i.title === cfg.title && !i.pull_request);
  const url = run.html_url;
  if (k === 'ok') {
    if (!issue) return log(`${name}: 成功。開いた issue なし`);
    if (cfg.job) {
      const jobs = (await api(`repos/${REPO}/actions/runs/${run.id}/jobs?filter=latest`))?.jobs ?? [];
      if (!jobs.some((j) => j.name === cfg.job && j.conclusion === 'success')) return log(`${name}: ${cfg.job} が動いていない回（休み）。閉じない`);
    }
    if (dry) return log(`（ためし）#${issue.number} に「直った（${url}）」とコメントして閉じるはず`);
    await api(`repos/${REPO}/issues/${issue.number}/comments`, { method: 'POST', body: { body: `直った（${url}）` } });
    await api(`repos/${REPO}/issues/${issue.number}`, { method: 'PATCH', body: { state: 'closed', state_reason: 'completed' } });
    return log(`${name}: 成功。#${issue.number} を閉じた`);
  }
  if (issue) {
    const comments = (await api(`repos/${REPO}/issues/${issue.number}/comments?since=${midnightUtc(now)}&per_page=100`)) ?? [];
    if (notedToday(issue, comments, now)) return log(`${name}: 失敗。#${issue.number} で今日はもう知らせた`);
    if (dry) return log(`（ためし）#${issue.number} に「まだ続いている（${url}）」とコメントするはず`);
    await api(`repos/${REPO}/issues/${issue.number}/comments`, { method: 'POST', body: { body: `まだ続いている（${url}）` } });
    return log(`${name}: 失敗。#${issue.number} に「まだ続いている」とコメントした`);
  }
  const jobs = (await api(`repos/${REPO}/actions/runs/${run.id}/jobs?filter=latest`))?.jobs ?? [];
  const notes = [];
  for (const j of jobs) {
    if (['success', 'skipped', null, undefined].includes(j.conclusion)) continue;
    const id = String(j.check_run_url ?? '').split('/').pop();
    if (/^\d+$/.test(id)) notes.push(...((await api(`repos/${REPO}/check-runs/${id}/annotations`)) ?? []));
  }
  runs ??= (await api(`repos/${REPO}/actions/workflows/${name}/runs?branch=main&status=completed&per_page=50`))?.workflow_runs ?? [];
  const body = buildBody(cfg, run, failedParts(jobs), pickNotes(notes), history(runs, run.id));
  if (dry) return log(`（ためし）作るはずの issue: ${cfg.title}\n${body}`);
  await ensureLabel(api);
  const made = await api(`repos/${REPO}/issues`, { method: 'POST', body: { title: cfg.title, body, labels: [LABEL.name] } });
  return log(`${name}: 失敗。issue #${made?.number} を作った`);
}

async function ensureLabel(api) {
  try {
    await api(`repos/${REPO}/labels/${LABEL.name}`);
  } catch (e) {
    if (e.status !== 404) throw e;
    try {
      await api(`repos/${REPO}/labels`, { method: 'POST', body: LABEL });
    } catch (e2) {
      if (e2.status !== 422) throw e2; // すでにある
    }
  }
}

async function main() {
  const dry = (process.env.MIHARI_DRY_RUN ?? '').toLowerCase() === 'true';
  if (process.env.GITHUB_EVENT_NAME === 'workflow_run') {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    return handle(event.workflow_run ?? {}, { dry });
  }
  const runId = (process.env.MIHARI_RUN_ID ?? '').trim();
  if (runId) {
    if (!/^\d+$/.test(runId)) throw new Error('MIHARI_RUN_ID は数字だけ');
    return handle(await github(`repos/${REPO}/actions/runs/${runId}`), { dry });
  }
  for (const name of Object.keys(WATCH)) {
    // 手で動かしたとき：いちばん新しい実行を見る
    const runs = (await github(`repos/${REPO}/actions/workflows/${name}/runs?branch=main&status=completed&per_page=50`))?.workflow_runs ?? [];
    const latest = runs.find((r) => kind(r.conclusion));
    if (latest) await handle(latest, { dry, runs });
    else console.log(`${name}: 見る実行なし`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e) => {
    console.log(`見張り: うまく動きませんでした（${String(e.message).slice(0, 200)}）`);
    process.exit(1);
  });
}
