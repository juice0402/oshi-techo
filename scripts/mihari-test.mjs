// 見張り（scripts/mihari.mjs）のテスト。ネットには出ない（GitHub の答えは作ったもの）。
// 使い方：node scripts/mihari-test.mjs （scripts/test.mjs からも動かす）

import { readFileSync } from 'node:fs';
import * as M from './mihari.mjs';

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`OK  ${msg}`);
  else {
    failed++;
    console.log(`NG  ${msg}`);
  }
};

const NOW = new Date('2026-11-02T04:00:00Z'); // 日本時間 11/2 13:00
const REPO = process.env.GITHUB_REPOSITORY || 'juice0402/oshi-techo';
const R = `repos/${REPO}`;

// 結果の見分け
ok(M.kind('failure') === 'fail' && M.kind('timed_out') === 'fail', '見張り：failure・timed_out は issue');
ok(M.kind('success') === 'ok' && M.kind('cancelled') === null && M.kind('skipped') === null, '見張り：success は閉じる・cancelled は何もしない');
ok(M.workflowFile({ path: '.github/workflows/update.yml' }) === 'update.yml', '見張り：path からファイルの名前');
ok(M.when('2026-11-01T15:36:41Z') === '11月2日 0:36（日本時間）', '見張り：時刻は日本時間');
ok(M.midnightUtc(NOW) === '2026-11-01T15:00:00Z', '見張り：日本時間の0時を UTC で');

// 注記・失敗したところ
const notes = [
  { annotation_level: 'warning', message: 'Node.js 20 is deprecated.' },
  { annotation_level: 'failure', message: 'Process completed with exit code 1.' },
  { annotation_level: 'failure', message: 'くわしくは非公開の oshi-techo-data の\nnotes/update.log' },
  { annotation_level: 'failure', message: 'あ'.repeat(300) },
  { annotation_level: 'failure', message: '4つめ' },
];
const picked = M.pickNotes(notes);
ok(picked.length === 3 && picked[0] === 'くわしくは非公開の oshi-techo-data の notes/update.log' && !picked.some((m) => m.startsWith('Process')), '見張り：失敗の注記は3つまで・exit code は後ろ・warning は拾わない');
ok(picked[1].length === 200 && picked[1].endsWith('…'), '見張り：注記は200字まで');
const jobs = [
  { name: 'gate', conclusion: 'success', steps: [] },
  { name: 'update', conclusion: 'failure', check_run_url: 'https://api.github.com/x/check-runs/55', steps: [{ name: '記録を持ってくる', conclusion: 'success' }, { name: '楽天から集める', conclusion: 'failure' }, { name: 'ページを作る', conclusion: 'skipped' }] },
];
ok(JSON.stringify(M.failedParts(jobs)) === JSON.stringify(['update / 楽天から集める']), '見張り：失敗したジョブとステップ');

// 最後の成功と、そのあとの失敗
const runs = [
  { id: 9, status: 'completed', conclusion: 'failure', updated_at: '2026-11-02T03:00:00Z' },
  { id: 8, status: 'completed', conclusion: 'cancelled', updated_at: '2026-11-02T02:00:00Z' },
  { id: 7, status: 'completed', conclusion: 'failure', updated_at: '2026-11-01T03:00:00Z' },
  { id: 6, status: 'completed', conclusion: 'success', updated_at: '2026-10-31T06:15:00Z' },
  { id: 5, status: 'completed', conclusion: 'failure', updated_at: '2026-10-30T10:00:00Z' },
];
ok(JSON.stringify(M.history(runs, 9)) === JSON.stringify({ lastOk: '2026-10-31T06:15:00Z', fails: 2 }), '見張り：cancelled は数えない');
ok(JSON.stringify(M.history(runs, 5)) === JSON.stringify({ lastOk: null, fails: 1 }), '見張り：前の実行を見るときは、それより新しいものを数えない');

// 本文
const cfg = M.WATCH['update.yml'];
const run = { id: 9, path: '.github/workflows/update.yml', head_branch: 'main', html_url: 'https://github.com/x/actions/runs/9', conclusion: 'failure', updated_at: '2026-11-02T03:00:00Z' };
const body = M.buildBody(cfg, run, ['update / 楽天から集める'], ['失敗'], { lastOk: '2026-10-31T06:15:00Z', fails: 2 });
ok(['サイトが新しくなっていません', '11月2日 12:00（日本時間）', 'https://github.com/x/actions/runs/9', '最後にうまくいったのは 10月31日 15:15（日本時間）', '失敗は 2 回', 'update / 楽天から集める', 'oshi-techo-data の notes/update.log', '「更新が止まってる」'].every((s) => body.includes(s)) && body.endsWith(M.SIGN), '見張り：本文に何が止まったか・いつ・URL・最後の成功・ステップ・記録の場所・署名');

// 今日もう知らせたか
ok(M.notedToday({ created_at: '2026-11-01T16:00:00Z' }, [], NOW), '見張り：今日作った issue は、もう知らせた');
ok(!M.notedToday({ created_at: '2026-11-01T14:00:00Z' }, [], NOW), '見張り：きのう作って今日のコメントなしなら、まだ');
ok(M.notedToday({ created_at: '2026-10-30T00:00:00Z' }, [{ user: { login: M.BOT }, created_at: '2026-11-02T01:00:00Z' }], NOW), '見張り：今日見張りがコメントしていれば、もう知らせた');
ok(!M.notedToday({ created_at: '2026-10-30T00:00:00Z' }, [{ user: { login: 'juice0402' }, created_at: '2026-11-02T01:00:00Z' }], NOW), '見張り：人のコメントは数えない');

// 動き（GitHub の答えは作ったもの）
const fake = (answers) => {
  const calls = [];
  const api = async (path, { method = 'GET', body } = {}) => {
    calls.push({ method, path, body });
    for (const [key, val] of answers) {
      if (method === key[0] && path.startsWith(key[1])) {
        if (val instanceof Error) throw val;
        return val;
      }
    }
    return null;
  };
  return { api, calls };
};
const go = async (r, answers, opts = {}) => {
  const { api, calls } = fake(answers);
  const lines = [];
  await M.handle(r, { now: NOW, api, log: (s) => lines.push(s), ...opts });
  return { calls, out: lines.join('\n'), writes: calls.filter((c) => c.method !== 'GET') };
};
const openIssue = { number: 12, title: cfg.title, created_at: '2026-11-01T10:00:00Z' };
const failAnswers = [
  [['GET', `${R}/issues?`], []],
  [['GET', `${R}/actions/runs/9/jobs`], { jobs }],
  [['GET', `${R}/check-runs/55/annotations`], notes],
  [['GET', `${R}/actions/workflows/update.yml/runs`], { workflow_runs: runs }],
  [['GET', `${R}/labels/mihari`], new M.ApiError(404, 'Not Found')],
];

let r = await go({ ...run, conclusion: 'cancelled' }, []);
ok(r.calls.length === 0, '見張り：cancelled は GitHub に何も聞かない');
r = await go({ ...run, head_branch: 'claude/x' }, []);
ok(r.calls.length === 0, '見張り：main 以外は何もしない');
r = await go({ ...run, path: '.github/workflows/og.yml' }, []);
ok(r.calls.length === 0, '見張り：見張っていない workflow（SNSの画像）は何もしない');

r = await go(run, failAnswers);
ok(r.writes.map((c) => c.path).join(',') === `${R}/labels,${R}/issues` && r.writes[0].body.color === 'd93f0b', '見張り：失敗 → ラベルを作って issue を作る');
const made = r.writes[1]?.body ?? {};
ok(made.title === '【見張り】更新が失敗した' && made.labels?.[0] === 'mihari' && made.body.includes('update / 楽天から集める'), '見張り：issue の題・ラベル・本文');

r = await go(run, failAnswers, { dry: true });
ok(r.writes.length === 0 && r.out.includes('【見張り】更新が失敗した') && r.out.includes(M.SIGN), '見張り：ためし（dry_run）は書かずに題と本文を出す');

r = await go(run, [[['GET', `${R}/issues?`], [openIssue]], [['GET', `${R}/issues/12/comments`], []]]);
ok(r.writes.length === 1 && r.writes[0].path === `${R}/issues/12/comments` && r.writes[0].body.body === 'まだ続いている（https://github.com/x/actions/runs/9）', '見張り：開いた issue がある → 「まだ続いている」を1つ');
ok(r.calls.some((c) => c.path.includes('since=2026-11-01T15:00:00Z')), '見張り：今日のコメントだけ聞く');
r = await go(run, [[['GET', `${R}/issues?`], [openIssue]], [['GET', `${R}/issues/12/comments`], [{ user: { login: M.BOT }, created_at: '2026-11-02T00:00:00Z' }]]]);
ok(r.writes.length === 0, '見張り：今日もうコメントした → 何も書かない');

const okJobs = { jobs: [{ name: 'gate', conclusion: 'success' }, { name: 'update', conclusion: 'success' }] };
r = await go({ ...run, conclusion: 'success' }, [[['GET', `${R}/issues?`], [openIssue]], [['GET', `${R}/actions/runs/9/jobs`], okJobs]]);
ok(r.writes.map((c) => `${c.method} ${c.path}`).join(',') === `POST ${R}/issues/12/comments,PATCH ${R}/issues/12` && r.writes[0].body.body === '直った（https://github.com/x/actions/runs/9）' && r.writes[1].body.state === 'closed', '見張り：成功 → 「直った」とコメントして閉じる');
r = await go({ ...run, conclusion: 'success' }, [[['GET', `${R}/issues?`], [openIssue]], [['GET', `${R}/actions/runs/9/jobs`], { jobs: [{ name: 'gate', conclusion: 'success' }, { name: 'update', conclusion: 'skipped' }] }]]);
ok(r.writes.length === 0, '見張り：月の終わりの休みの回（update が動いていない）では閉じない');
r = await go({ ...run, conclusion: 'success' }, [[['GET', `${R}/issues?`], [{ ...openIssue, title: M.WATCH['check-sources.yml'].title }]]]);
ok(r.writes.length === 0, '見張り：ほかの題の issue は閉じない');

// mihari.yml と見張る workflow がそろっている
const listed = (readFileSync('.github/workflows/mihari.yml', 'utf8').match(/^\s*workflows:\s*\[(.*)\]/m)?.[1] ?? '').split(',').map((s) => s.trim());
for (const file of Object.keys(M.WATCH)) {
  const name = readFileSync(`.github/workflows/${file}`, 'utf8').match(/^name:\s*(.+)$/m)?.[1].trim();
  ok(listed.includes(name), `見張り：${file}（${name}）が mihari.yml の workflows: にある`);
}

console.log(failed ? `\n見張り：${failed}件のNG` : '\n見張り：すべてOK');
process.exit(failed ? 1 : 0);
