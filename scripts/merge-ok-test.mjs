// マージの印（scripts/merge-ok.mjs）のテスト。ネットには出ない（GitHub の答えは作ったもの）。
// 使い方：node scripts/merge-ok-test.mjs （scripts/test.mjs からも動かす）

import { readFileSync } from 'node:fs';
import * as M from './merge-ok.mjs';

let failed = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`OK  ${msg}`);
  else {
    failed++;
    console.log(`NG  ${msg}`);
  }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const NOW = new Date('2026-11-02T04:00:00Z');
const REPO = process.env.GITHUB_REPOSITORY || 'juice0402/oshi-techo';
const R = `repos/${REPO}`;

// 順番の指定の読み取り
const cases = [
  ['#44 の PR #51 のあとにマージ', [44, 51]],
  ['⚠️ #44 の PR #51 のあとにマージ（作業中に #51 がマージされたので main を取りこみ済み）', [44, 51]],
  ['PR #51 のあとにマージ', [51]],
  ['#136 のあとにマージ（衝突したら main を取りこむ）', [136]],
  ['#184 のあとにマージ(衝突したら main を取りこむ)。この PR は guide.js をさわらない', [184]],
  ['**#12のあとにマージ**', [12]],
  ['#33 と #34 のあとにマージ', [33, 34]],
  ['#33、#34 の後にマージ', [33, 34]],
  ['＃１２ の後でマージ', [12]], // 全角
  ['Closes #12\n\n#11 のあとにマージ', [11]], // 行はまたがない
  ['#12 のあとの本番の更新で、棚が12件にふえた', []],
  ['**Google の有効化(11/1 19:00)のあとにマージ**', []],
  ['マージは 11/1 9:00 のあとにして', []],
  ['Closes #198', []],
  ['', []],
  [null, []],
];
for (const [body, want] of cases) {
  const got = M.orderRefs(body);
  ok(same(got, want), `マージの印：「${String(body).slice(0, 30).replace(/\n/g, '⏎')}」→ [${want}]${same(got, want) ? '' : `（${got}）`}`);
}
ok(same(M.orderRefs('#20 と #21 のあとにマージ', 21), [20]), 'マージの印：自分の番号は数えない');

// 順番の指定で待つか
const pr = (n, { body = '', ref = 'claude/x', labels = ['merge-ok'], base = 'main', draft = false } = {}) => ({
  number: n, title: `題${n}`, body, head: { ref, sha: `sha${n}` }, base: { ref: base }, draft, labels: labels.map((name) => ({ name })), state: 'open',
});
const map = (...prs) => new Map(prs.map((p) => [p.number, p]));
let me = pr(52, { body: '⚠️ #44 の PR #51 のあとにマージ' });
ok(same(M.blockers(me, map(pr(51), me)), ['PR #51 がまだ開いている']), 'マージの印：指定の PR が開いている → 待つ');
ok(same(M.blockers(me, map(me)), []), 'マージの印：指定の PR が閉じた → 待たない');
me = pr(60, { body: '#44 のあとにマージ' });
ok(same(M.blockers(me, map(pr(59, { body: 'Closes #44' }), me)), ['#44 の PR #59 がまだ開いている']), 'マージの印：issue の番号 → その issue を閉じる PR が開いていれば待つ');
ok(M.closes(pr(1, { body: 'fixes: #44' }), 44) && M.closes(pr(1, { body: '（resolved #44）' }), 44), 'マージの印：閉じる書き方のゆれ（fixes: ・小文字）');
ok(!M.closes(pr(1, { body: 'Closes #440' }), 44), 'マージの印：#440 は #44 ではない');
ok(same(M.blockers(me, map(pr(59, { ref: 'claude/night-44' }), me)), ['#44 の PR #59 がまだ開いている']), 'マージの印：夜のブランチ night-44 も、その issue の PR');
ok(same(M.blockers(me, map(pr(61, { body: '#44 のあとにマージ' }), me)), []), 'マージの印：ただ #44 と書いてある PR は待たない（おたがい待ちにならない）');
ok(same(M.blockers(pr(62, { body: 'Closes #44\n#44 のあとにマージ' }), map(pr(62, { body: 'Closes #44' }))), []), 'マージの印：自分が閉じる issue なら待たない');

// 点検の判定
const cr = (name, status = 'completed', conclusion = 'success') => ({ name, status, conclusion: status === 'completed' ? conclusion : null });
const OLD = '2026-11-02T03:00:00Z'; // 60分前
const NEW = '2026-11-02T03:57:00Z'; // 3分前
ok(M.judge([cr('check')], [], OLD, NOW).verdict === 'merge', 'マージの印：success だけ → マージ');
ok(M.judge([cr('a'), cr('b', 'completed', 'skipped'), cr('c', 'completed', 'neutral')], [], OLD, NOW).verdict === 'merge', 'マージの印：skipped・neutral もマージ');
let v = M.judge([cr('check', 'in_progress'), cr('x')], [], OLD, NOW);
ok(v.verdict === 'wait' && v.text.includes('check') && v.left === null, 'マージの印：終わっていない → 待つ（10分の待ちではない）');
ok(M.judge([cr('check', 'queued')], [], OLD, NOW).verdict === 'wait', 'マージの印：queued も待つ');
for (const c of ['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure']) {
  v = M.judge([cr('check', 'completed', c), cr('other')], [], OLD, NOW);
  ok(v.verdict === 'fail' && v.text === 'check', `マージの印：${c} → 失敗（点検の名前）`);
}
ok(M.judge([cr('check', 'in_progress'), cr('lint', 'completed', 'failure')], [], OLD, NOW).verdict === 'wait', 'マージの印：終わっていないものがあれば、失敗があっても待つ（次の workflow_run で見直す）');
ok(M.judge([cr('check', 'completed', 'stale')], [], OLD, NOW).verdict === 'wait', 'マージの印：stale など知らない結果は待つ（マージしない）');
ok(M.judge([cr('merge-ok', 'in_progress'), cr('check')], [], OLD, NOW).verdict === 'merge', 'マージの印：この workflow 自身の check-run は数えない');
ok(M.judge([cr('merge-ok', 'completed', 'failure'), cr('check')], [], OLD, NOW).verdict === 'merge', 'マージの印：自身の前の回の失敗も数えない');
ok(M.judge([cr('check')], [{ context: 'cf', state: 'pending' }], OLD, NOW).verdict === 'wait', 'マージの印：commit status の pending → 待つ');
v = M.judge([cr('check')], [{ context: 'cf', state: 'error' }, { context: 'ok', state: 'success' }], OLD, NOW);
ok(v.verdict === 'fail' && v.text === 'cf', 'マージの印：commit status の failure・error → 失敗');
ok(M.judge([cr('a', 'completed', 'failure'), cr('a', 'completed', 'failure')], [], OLD, NOW).text === 'a', 'マージの印：同じ名前は1回だけ');

// check-runs が1つもないとき（10分の待ち）
v = M.judge([], [], NEW, NOW);
ok(v.verdict === 'wait' && v.left >= 415 && v.left <= 425, 'マージの印：check-runs が無い・ラベルから3分 → 待つ（あと約7分）');
v = M.judge([cr('merge-ok', 'in_progress')], [], NEW, NOW);
ok(v.verdict === 'wait' && v.left > 0, 'マージの印：自身の check-run だけのときも「1つもない」');
ok(M.judge([], [], '2026-11-02T03:49:00Z', NOW).verdict === 'merge', 'マージの印：ラベルから11分 → マージ');
ok(M.judge([], [], '2026-11-02T03:50:00Z', NOW).verdict === 'merge', 'マージの印：ちょうど10分 → マージ');
ok(M.judge([], [], '2026-11-02T03:50:01Z', NOW).verdict === 'wait', 'マージの印：9分59秒 → 待つ');
ok(M.judge([], [{ context: 'cf', state: 'failure' }], OLD, NOW).verdict === 'fail', 'マージの印：check-runs が無くても commit status の失敗は失敗');
v = M.judge([], [], null, NOW);
ok(v.verdict === 'wait' && v.left === null, 'マージの印：ラベルの時刻がわからない → 待つ（すぐはマージしない）');
const events = [
  { event: 'labeled', label: { name: 'merge-ok' }, created_at: '2026-11-02T01:00:00Z' },
  { event: 'unlabeled', label: { name: 'merge-ok' }, created_at: '2026-11-02T02:00:00Z' },
  { event: 'labeled', label: { name: 'night' }, created_at: '2026-11-02T03:30:00Z' },
  { event: 'labeled', label: { name: 'merge-ok' }, created_at: '2026-11-02T03:00:00Z' },
];
ok(M.labeledAt(events) === '2026-11-02T03:00:00Z', 'マージの印：ラベルの時刻は、いちばん新しい merge-ok の付いた時');
ok(M.commitTitle({ title: '棚 [CI Skip]', number: 9 }) === '棚 [CI Skip] (#9)', 'マージの印：マージの題は「<PR の題> (#番号)」');

// 動き（GitHub の答えは作ったもの）
class Seq {
  // 聞くたびに順に答える（最後の答えはくり返す）
  constructor(...answers) {
    this.answers = answers;
  }
  next() {
    return this.answers.length > 1 ? this.answers.shift() : this.answers[0];
  }
}
const fake = (answers) => {
  const calls = [];
  const api = async (path, { method = 'GET', body } = {}) => {
    calls.push({ method, path, body });
    for (const [key, val] of answers) {
      if (method === key[0] && path.startsWith(key[1])) {
        const got = val instanceof Seq ? val.next() : val;
        if (got instanceof Error) throw got;
        return structuredClone(got);
      }
    }
    return null;
  };
  return { api, calls };
};
const green = { check_runs: [cr('check')] };
const ans = (prs, extra = []) => {
  const a = [...extra, [['GET', `${R}/pulls?state=open`], prs], [['GET', `${R}/labels`], [{ name: 'merge-ok' }, { name: 'merge-blocked' }]]];
  for (const p of prs) {
    a.push([['GET', `${R}/commits/${p.head.sha}/check-runs`], green]);
    a.push([['GET', `${R}/commits/${p.head.sha}/status`], { statuses: [] }]);
    a.push([['GET', `${R}/pulls/${p.number}`], { ...p, mergeable: true }]);
    a.push([['PUT', `${R}/pulls/${p.number}/merge`], { merged: true }]);
  }
  return a; // extra を先に置くので、extra の答えが勝つ
};
const go = async (answers, { dry = false, fn = 'once', only = null } = {}) => {
  const { api, calls } = fake(answers);
  const lines = [];
  const slept = [];
  const opts = { api, dry, log: (s) => lines.push(s), sleep: async (s) => slept.push(s) };
  const res = fn === 'main' ? await M.main({ ...opts, pr: only ?? '', now: () => NOW }) : await M.runOnce({ ...opts, only, now: NOW });
  return { res, calls, slept, out: lines.join('\n'), writes: calls.filter((c) => c.method !== 'GET') };
};

let r = await go(ans([pr(5, { labels: [] })]));
ok(same(r.res.merged, []) && r.writes.length === 0 && r.calls.length === 1, 'マージの印：merge-ok の無い PR は何もしない（点検も聞かない）');
r = await go(ans([pr(5, { labels: ['night'] }), pr(6, { labels: ['merge-blocked'] })]));
ok(r.writes.length === 0, 'マージの印：ほかのラベルの PR もマージしない');

r = await go(ans([pr(7)]));
const put = r.calls.filter((c) => c.method === 'PUT');
ok(same(r.res.merged, [7]) && put.length === 1 && put[0].path === `${R}/pulls/7/merge`
  && same(put[0].body, { merge_method: 'squash', sha: 'sha7', commit_title: '題7 (#7)', commit_message: 'マージの印（merge-ok）で #7 をマージ' }), 'マージの印：点検が通った → squash でマージ（sha・題・本文は空にしない）');
ok(r.calls.some((c) => c.path.startsWith(`${R}/commits/sha7/check-runs?filter=latest&per_page=100`)), 'マージの印：check-runs は filter=latest で全部（100件ずつ）');

ok(put.every((c) => c.body.commit_message.trim()), 'マージの印：本文は空にしない');

r = await go(ans([pr(3), pr(7)]), { only: 7 });
ok(same(r.res.merged, [7]) && !r.calls.some((c) => c.path.includes('sha3')), 'マージの印：番号を指定 → その PR だけ見る');
r = await go(ans([pr(3, { labels: [] }), pr(7)]), { only: 3 });
ok(same(r.res.merged, []) && r.writes.length === 0, 'マージの印：番号を指定しても、merge-ok が無ければマージしない');
r = await go(ans([pr(9, { body: '#3 のあとにマージ' }), pr(3, { labels: [] })]), { only: 9 });
ok(same(r.res.merged, []) && r.out.includes('PR #3 がまだ開いている'), 'マージの印：番号を指定しても、順番の指定はほかの開いている PR で見る');
r = await go(ans([pr(3), pr(4)]), { fn: 'main', only: '4' });
ok(same(r.calls.filter((c) => c.method === 'PUT').map((c) => c.path), [`${R}/pulls/4/merge`]) && r.calls.filter((c) => c.path.endsWith('/dispatches')).length === 1, 'マージの印：番号を指定（main）→ その PR だけマージして更新1回');
r = await go(ans([pr(3)]), { fn: 'main', only: 'x' });
ok(r.res === 2 && r.calls.length === 0, 'マージの印：番号が数字でない → 何もしない');

r = await go(ans([pr(7)]), { dry: true });
ok(same(r.res.merged, [7]) && r.writes.length === 0 && r.out.includes('squash でマージするはず'), 'マージの印：ためし（dry_run）は書かずに、するはずのことを出す');

r = await go(ans([pr(7, { base: 'develop' }), pr(8, { draft: true })]));
ok(same(r.res.merged, []) && r.writes.length === 0, 'マージの印：base が main でない・draft → マージしない');

r = await go(ans([pr(9, { body: '#3 のあとにマージ' }), pr(3, { labels: [] })]));
ok(same(r.res.merged, []) && r.writes.length === 0 && !r.calls.some((c) => c.path.includes('sha9')) && r.out.includes('PR #3 がまだ開いている'), 'マージの印：順番の指定の PR が開いている → 待つ（点検も聞かない）');
r = await go(ans([pr(9, { body: '#3 のあとにマージ' }), pr(3)]));
ok(same(r.res.merged, [3, 9]), 'マージの印：前の PR をこの回でマージしたら、続けてマージ（番号の小さい順）');

const failAns = ans([pr(7)], [[['GET', `${R}/commits/sha7/check-runs`], { check_runs: [cr('check', 'completed', 'failure'), cr('merge-ok', 'in_progress')] }]]);
r = await go(failAns);
ok(same(r.writes.map((c) => `${c.method} ${c.path}`), [`POST ${R}/issues/7/comments`, `DELETE ${R}/issues/7/labels/merge-ok`, `POST ${R}/issues/7/labels`])
  && r.writes[0].body.body === '点検が通らなかったのでマージしなかった（check）' && same(r.writes[2].body, { labels: ['merge-blocked'] }), 'マージの印：点検の失敗 → コメント・merge-ok を外す・merge-blocked を付ける（マージしない）');
r = await go(failAns, { dry: true });
ok(r.writes.length === 0 && r.out.includes('merge-blocked を付けるはず'), 'マージの印：ためしの失敗は書かない');

r = await go(ans([pr(7)], [[['GET', `${R}/commits/sha7/check-runs`], { check_runs: [cr('check', 'in_progress')] }]]));
ok(r.writes.length === 0 && r.res.grace === null, 'マージの印：点検の途中 → 何もしない');

r = await go(ans([pr(7)], [[['GET', `${R}/pulls/7`], new Seq({ ...pr(7), mergeable: null }, { ...pr(7), mergeable: null }, { ...pr(7), mergeable: false })]]));
ok(same(r.slept, [5, 5]), 'マージの印：mergeable が null → 5秒待って2回まで見直す');
ok(r.writes.length === 3 && r.writes[0].body.body === 'main とぶつかったのでマージしなかった。司令塔で main を取りこむ'
  && same(r.writes[2].body, { labels: ['merge-blocked'] }) && !r.calls.some((c) => c.method === 'PUT'), 'マージの印：ぶつかり → コメントして merge-blocked');
r = await go(ans([pr(7)], [[['GET', `${R}/pulls/7`], { ...pr(7), mergeable: null }]]));
ok(r.writes.length === 0 && r.calls.filter((c) => c.path === `${R}/pulls/7`).length === 3, 'マージの印：3回とも null → 次に見直す（書かない）');
r = await go(ans([pr(7)], [[['GET', `${R}/pulls/7`], { ...pr(7, { labels: [] }), mergeable: true }]]));
ok(r.writes.length === 0, 'マージの印：見直したときに印が外れていたら、マージしない');
r = await go(ans([pr(7)], [[['PUT', `${R}/pulls/7/merge`], new M.ApiError(409, 'Head branch was modified')]]));
ok(same(r.res.merged, []) && same(r.writes.map((c) => c.method), ['PUT']), 'マージの印：head が変わった（409）→ 待つ（merge-blocked にしない）');

const noChecks = (labelTime) => [
  [['GET', `${R}/commits/sha7/check-runs`], { check_runs: [] }],
  [['GET', `${R}/issues/7/events`], [{ event: 'labeled', label: { name: 'merge-ok' }, created_at: labelTime }]],
];
r = await go(ans([pr(7)], noChecks(NEW)));
ok(same(r.res.merged, []) && r.res.grace >= 415 && r.res.grace <= 425 && r.writes.length === 0, 'マージの印：check-runs が無い・ラベルから3分 → 待つ（あと何秒かを返す）');
r = await go(ans([pr(7)], noChecks(OLD)));
ok(same(r.res.merged, [7]), 'マージの印：check-runs が無い・ラベルから10分たった → マージ');
r = await go(ans([pr(7)]));
ok(!r.calls.some((c) => c.path.includes('/events')), 'マージの印：check-runs があるときは、ラベルの時刻を聞かない');

// 更新（update.yml）を動かす
r = await go(ans([pr(3), pr(4)]), { fn: 'main' });
const disp = r.calls.filter((c) => c.path.endsWith('/dispatches'));
const lastPut = r.calls.map((c) => c.method).lastIndexOf('PUT');
ok(disp.length === 1 && disp[0].path === `${R}/actions/workflows/update.yml/dispatches` && same(disp[0].body, { ref: 'main' }) && r.calls.indexOf(disp[0]) > lastPut,
  'マージの印：2本マージしても、更新は最後に1回だけ（ref=main）');
r = await go(ans([pr(3, { labels: [] })]), { fn: 'main' });
ok(!r.calls.some((c) => c.path.endsWith('/dispatches')), 'マージの印：マージしなかったら、更新は動かさない');
r = await go(ans([pr(3)]), { fn: 'main', dry: true });
ok(r.writes.length === 0 && r.out.includes('更新（update.yml）を main で1回動かすはず'), 'マージの印：ためしは更新も動かさない・ラベルも作らない');
r = await go([[['GET', `${R}/labels`], [{ name: 'night' }]], ...ans([])], { fn: 'main' });
ok(same(r.writes.map((c) => c.body), [M.OK, M.BLOCKED]) && M.OK.color === '0e8a16' && M.BLOCKED.color === 'b60205', 'マージの印：ラベルがなければ作る（色・説明）');
r = await go(ans([pr(7)], noChecks(NEW)), { fn: 'main' });
ok(r.slept.length === 1 && r.slept[0] >= 415 && r.slept[0] <= 435 && r.calls.filter((c) => c.path.startsWith(`${R}/pulls?state=open`)).length === 2,
  'マージの印：check-runs の無い PR は、10分たつまで待ってから見直す（1回だけ）');

// merge-ok.yml
const wf = readFileSync('.github/workflows/merge-ok.yml', 'utf8');
const listed = (wf.match(/^\s*workflows:\s*\[(.*)\]/m)?.[1] ?? '').split(',').map((s) => s.trim());
const nameOf = (file) => readFileSync(`.github/workflows/${file}`, 'utf8').match(/^name:\s*(.+)$/m)?.[1].trim();
const prChecks = ['pr.yml', 'check-sources.yml'].map(nameOf);
ok(same(listed, prChecks), `マージの印：workflow_run は PR の点検（${prChecks.join('・')}）を見る`);
for (const file of ['pr.yml', 'check-sources.yml']) ok(/^\s*pull_request:/m.test(readFileSync(`.github/workflows/${file}`, 'utf8')), `マージの印：${file} は PR で動く点検`);
ok(wf.includes('types: [labeled]') && wf.includes('types: [completed]') && wf.includes('dry_run:') && !wf.includes('schedule'), 'マージの印：動くとき（ラベル・点検の終わり・手で）。schedule は使わない');
ok(/concurrency:\s*\n\s*group: merge-ok\s*\n\s*cancel-in-progress: false/.test(wf), 'マージの印：同時に2つ動かさない');
ok(/\n {6}pr:\n(?: {8}.*\n)*? {8}type: number\n {8}required: false/.test(wf) && wf.includes('MERGE_OK_PR: ${{ inputs.pr }}'), 'マージの印：手で動かすとき、PR の番号（pr）を入れられる');
ok(['contents: write', 'pull-requests: write', 'issues: write', 'actions: write', 'checks: read', 'statuses: read'].every((p) => wf.includes(p)), 'マージの印：権限');
ok(wf.includes(`name: ${M.SELF_CHECK}`), 'マージの印：ジョブの名前が SELF_CHECK と同じ');
ok(!wf.includes('secrets.') && wf.includes('GH_TOKEN: ${{ github.token }}'), 'マージの印：鍵は GITHUB_TOKEN だけ');
ok(/^\s*workflow_dispatch:/m.test(readFileSync(`.github/workflows/${M.PUBLISH}`, 'utf8')), 'マージの印：更新（update.yml）は手で動かせる（workflow_dispatch）');

console.log(failed ? `\nマージの印：${failed}件のNG` : '\nマージの印：すべてOK');
process.exit(failed ? 1 : 0);
