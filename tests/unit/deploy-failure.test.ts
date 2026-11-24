// Deploy-failure backstop (#165), recurrence rule (#164), Neon warning (#166). Run: npm test
// All GitHub, Vercel and Neon calls are faked; nothing here touches a network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain JS
import * as runnerModule from '../../.github/scripts/deploy-failure.mjs';
// @ts-ignore plain JS
import * as coreModule from '../../.github/scripts/deploy-failure-core.mjs';

// The scripts are plain JS, so tsc (allowJs) would infer every parameter as required; these tests pass partial inputs
// on purpose. Treat the modules as loosely typed.
const { handleDeploymentFailure, neonWarning, neonApi, ghApi, describeError }: Record<string, any> = runnerModule;
const { normalizeError, decideAutofix, confirmNeonBranchLimit, failureIssueBody, fenced, inlineCode, neutralizeMentions, isPreview, recurrenceReached, neonWarnThreshold, deploymentRefFromEvent, signatureId }: Record<string, any> = coreModule;

const CAUSES = [{ id: 'neon-branch-limit', match: 'Resource provisioning failed', confirm: 'neon-branch-limit', preview_fix: 'neon-cleanup-then-redeploy' }];
const NOW = new Date('2026-11-21T12:00:00Z');

function fakeApi(prs: any[] = []) {
  const issues: any[] = [];
  const comments = new Map<number, string[]>();
  return {
    issues, comments, clock: NOW,
    async ensureLabels() {},
    async listIssues({ label, state }: any) { return issues.filter((i) => i.labels.includes(label) && i.state === state); },
    async createIssue({ title, body, labels }: any) { const number = 100 + issues.length; issues.push({ number, title, body, labels, state: 'open', createdAt: this.clock.toISOString() }); comments.set(number, []); return number; },
    async closeIssue(n: number, comment: string) { const i = issues.find((x) => x.number === n); i.state = 'closed'; (comments.get(n) ?? comments.set(n, []).get(n)!).push(comment); },
    async addLabels(n: number, labels: string[]) { issues.find((i) => i.number === n).labels.push(...labels); },
    async comment(n: number, body: string) { (comments.get(n) ?? comments.set(n, []).get(n)!).push(body); },
    async listComments(n: number) { return comments.get(n) ?? []; },
    prCalls: [] as string[],
    async prsForCommit(sha: string) { this.prCalls.push(sha); return prs; },
  };
}

function fakeVercel(error: any, id?: string) {
  const calls = { redeploy: 0, asked: [] as string[], redeployed: [] as string[] };
  return { calls, getDeployment: async (ref: string) => { calls.asked.push(ref); if (error instanceof Error) throw error; return id ? { ...error, id } : error; }, getEventsTail: async () => '', redeploy: async (dpl: string) => { calls.redeploy++; calls.redeployed.push(dpl); return 'dpl_new'; } };
}

function fakeNeon(facts: any) { return { facts: async () => { if (facts instanceof Error) throw facts; return { limit: 10, failedCreates: [], ...facts }; } }; }
const AT_LIMIT = fakeNeon({ count: 10 });

const NEON_ERR = { errorCode: 'BUILD_FAILED', errorMessage: 'Resource provisioning failed' };
const ev = (over: any = {}) => ({ state: 'failure', environment: 'Preview – wyr', targetUrl: 'https://vercel.com/team/wyr/AbC123', description: 'Deployment has failed', sha: 'a'.repeat(40), ref: 'feat/x', ...over });
const run = (api: any, vercel: any, fixes: any, event: any, now = NOW, neon: any = AT_LIMIT) => { api.clock = now; return handleDeploymentFailure({ event, api, vercel, neon, fixes, causes: CAUSES, now, log: () => {} }); };
const cleanup = (deleted: number) => { const f = { calls: 0, neonCleanup: async () => { f.calls++; return { deleted }; } }; return f; };

test('signature ignores ids, urls and shas', () => {
  const a = normalizeError('BUILD_FAILED', 'Failed at dpl_abc123 https://x.vercel.app/1 sha deadbeefcafe');
  const b = normalizeError('BUILD_FAILED', 'Failed at dpl_zzz999 https://y.vercel.app/2 sha 0123456789ab');
  assert.equal(a, b);
  assert.equal(signatureId(a), signatureId(b));
  assert.equal(deploymentRefFromEvent({ targetUrl: 'https://vercel.com/t/wyr/AbC123' }), 'dpl_AbC123');
});

test('decideAutofix: production never, unknown never, one retry per commit, paused by an open RCA', () => {
  const cause = CAUSES[0];
  const confirmation = { confirmed: true, evidence: [], ruledOut: [] };
  assert.equal(decideAutofix({ cause, environment: 'Production – wyr', attempts: 0, rcaOpen: false, confirmation }).autofix, false);
  assert.equal(decideAutofix({ cause, environment: undefined, attempts: 0, rcaOpen: false, confirmation }).autofix, false);
  assert.equal(decideAutofix({ cause: null, environment: 'Preview – wyr', attempts: 0, rcaOpen: false }).autofix, false);
  assert.equal(decideAutofix({ cause, environment: 'Preview – wyr', attempts: 0, rcaOpen: false, confirmation }).autofix, true);
  assert.equal(decideAutofix({ cause, environment: 'Preview – wyr', attempts: 1, rcaOpen: false, confirmation }).autofix, false);
  assert.equal(decideAutofix({ cause, environment: 'Preview – wyr', attempts: 0, rcaOpen: true, confirmation }).autofix, false);
  assert.equal(decideAutofix({ cause, environment: 'Preview – wyr', attempts: 0, rcaOpen: false }).autofix, false, 'a string match alone never fixes anything');
  assert.equal(decideAutofix({ cause, environment: 'Preview – wyr', attempts: 0, rcaOpen: false, confirmation: { confirmed: false, evidence: [], ruledOut: ['x'] } }).autofix, false);
  assert.equal(isPreview('Preview'), true);
  assert.equal(isPreview('Production'), false);
});

test('recurrence counts distinct deployments inside 7 days', () => {
  const at = (d: string) => `2026-11-${d}T00:00:00Z`;
  assert.equal(recurrenceReached([{ dpl: 'a', at: at('20') }, { dpl: 'b', at: at('19') }], NOW), false);
  assert.equal(recurrenceReached([{ dpl: 'a', at: at('20') }, { dpl: 'b', at: at('19') }, { dpl: 'c', at: at('18') }], NOW), true);
  assert.equal(recurrenceReached([{ dpl: 'a', at: at('20') }, { dpl: 'a', at: at('20') }, { dpl: 'b', at: at('19') }], NOW), false, 'same deployment twice is one failure');
  assert.equal(recurrenceReached([{ dpl: 'a', at: at('20') }, { dpl: 'b', at: at('19') }, { dpl: 'c', at: '2026-11-01T00:00:00Z' }], NOW), false, 'older than 7 days');
});

test('preview + known cause: one issue, cleanup, one redeploy', async () => {
  const api = fakeApi(), vercel = fakeVercel(NEON_ERR), fixes = cleanup(9);
  const r = await run(api, vercel, fixes, ev());
  assert.equal(api.issues.length, 1);
  assert.deepEqual(api.issues[0].labels, ['deploy-failure']);
  assert.equal(fixes.calls, 1);
  assert.equal(vercel.calls.redeploy, 1);
  assert.equal(r.redeployed, true);
});

test('retry cap: the redeploy of the same commit failing again is not retried, and the issue is reused', async () => {
  const api = fakeApi(), vercel = fakeVercel(NEON_ERR), fixes = cleanup(9);
  await run(api, vercel, fixes, ev({ targetUrl: 'https://vercel.com/t/wyr/First1' }));
  await run(api, vercel, fixes, ev({ targetUrl: 'https://vercel.com/t/wyr/Second2' }));
  assert.equal(vercel.calls.redeploy, 1, 'second failure on the same sha must not redeploy');
  assert.equal(fixes.calls, 1);
  assert.equal(api.issues.length, 1, 'dedupe: one issue per signature');
});

test('a new commit gets its own single retry', async () => {
  const api = fakeApi(), vercel = fakeVercel(NEON_ERR), fixes = cleanup(3);
  await run(api, vercel, fixes, ev({ sha: 'a'.repeat(40), targetUrl: 'https://vercel.com/t/wyr/D1' }));
  await run(api, vercel, fixes, ev({ sha: 'b'.repeat(40), targetUrl: 'https://vercel.com/t/wyr/D2' }));
  assert.equal(vercel.calls.redeploy, 2);
  assert.equal(api.issues.length, 1);
});

test('third failure in 7 days opens a needs-rca issue and pauses auto-fix; closing it resets the count', async () => {
  const api = fakeApi(), vercel = fakeVercel(NEON_ERR), fixes = cleanup(3);
  const hr = (h: number) => new Date(NOW.getTime() + h * 3600000);
  await run(api, vercel, fixes, ev({ sha: 'a'.repeat(40), targetUrl: 'https://vercel.com/t/wyr/D1' }), hr(0));
  await run(api, vercel, fixes, ev({ sha: 'a'.repeat(40), targetUrl: 'https://vercel.com/t/wyr/D2' }), hr(1));
  const r = await run(api, vercel, fixes, ev({ sha: 'c'.repeat(40), targetUrl: 'https://vercel.com/t/wyr/D3' }), hr(2));
  const rca = api.issues.find((i: any) => i.labels.includes('needs-rca'));
  assert.ok(rca, 'needs-rca issue opened');
  assert.equal(r.decision.autofix, false);
  assert.match(r.decision.reason, /needs-rca/);
  assert.equal(vercel.calls.redeploy, 1, 'no redeploy after the RCA opened, even for a fresh commit');
  // still paused on a 4th failure, and no duplicate RCA issue
  await run(api, vercel, fixes, ev({ sha: 'd'.repeat(40), targetUrl: 'https://vercel.com/t/wyr/D4' }), hr(3));
  assert.equal(api.issues.filter((i: any) => i.labels.includes('needs-rca')).length, 1);
  assert.equal(vercel.calls.redeploy, 1);
  // closing the RCA issue resumes auto-fix, and the earlier failures no longer count
  rca.state = 'closed';
  const later = await run(api, vercel, fixes, ev({ sha: 'e'.repeat(40), targetUrl: 'https://vercel.com/t/wyr/D5' }), hr(4));
  assert.equal(later.decision.autofix, true);
  assert.equal(vercel.calls.redeploy, 2);
  assert.equal(api.issues.filter((i: any) => i.labels.includes('needs-rca')).length, 1, 'no instant second RCA');
});

test('production failure: issue with needs-human, never cleanup or redeploy', async () => {
  const api = fakeApi(), vercel = fakeVercel(NEON_ERR), fixes = cleanup(9);
  await run(api, vercel, fixes, ev({ environment: 'Production – wyr' }));
  assert.deepEqual(api.issues[0].labels, ['deploy-failure', 'needs-human']);
  assert.equal(fixes.calls, 0);
  assert.equal(vercel.calls.redeploy, 0);
});

test('unreadable Vercel error (no token): still opens an issue, never auto-fixes', async () => {
  const api = fakeApi(), vercel = fakeVercel(new Error('no VERCEL_TOKEN')), fixes = cleanup(9);
  const r = await run(api, vercel, fixes, ev());
  assert.equal(api.issues.length, 1);
  assert.match(api.issues[0].body, /could not be read/);
  assert.equal(r.decision.autofix, false);
  assert.equal(fixes.calls, 0);
});

test('cleanup that deletes nothing does not redeploy', async () => {
  const api = fakeApi(), vercel = fakeVercel(NEON_ERR), fixes = cleanup(0);
  const r = await run(api, vercel, fixes, ev());
  assert.equal(r.redeployed, false);
  assert.equal(vercel.calls.redeploy, 0);
});

test('redelivery of the same deployment event is not double counted; PR gets one comment', async () => {
  const api = fakeApi([{ number: 7, state: 'OPEN', isCrossRepository: false }, { number: 8, state: 'OPEN', isCrossRepository: true }]);
  const vercel = fakeVercel(NEON_ERR), fixes = cleanup(2);
  await run(api, vercel, fixes, ev());
  await run(api, vercel, fixes, ev());
  assert.equal(api.comments.get(7)?.length, 1);
  assert.equal(api.comments.get(8), undefined, 'fork PRs are not commented on');
  const events = (api.comments.get(100) ?? []).filter((c: string) => c.includes('deploy-event'));
  assert.equal(events.length, 1);
});

test('non-failure deployment states are ignored', async () => {
  const api = fakeApi();
  const r = await run(api, fakeVercel(NEON_ERR), cleanup(1), ev({ state: 'success' }));
  assert.equal(r.handled, false);
  assert.equal(api.issues.length, 0);
});

test('neon warning: threshold is 80% of the limit, overridable for tests', () => {
  assert.equal(neonWarnThreshold(10), 8);
  assert.equal(neonWarnThreshold(10, '3'), 3);
  assert.equal(neonWarnThreshold(10, 'junk'), 8);
});

test('neon warning opens at the threshold, updates once per day, stays quiet below', async () => {
  const api = fakeApi();
  const q = (count: number, now = NOW, extra: any = {}) => neonWarning({ api, count, limit: 10, threshold: undefined, now, log: () => {}, ...extra });
  assert.equal((await q(7)).warned, false);
  assert.equal(api.issues.length, 0);
  assert.equal((await q(8)).warned, true);
  assert.equal(api.issues.length, 1);
  assert.deepEqual(api.issues[0].labels, ['deploy-failure']);
  await q(9);
  await q(9);
  assert.equal(api.issues.length, 1, 'one issue');
  assert.equal(api.comments.get(100)?.length, 1, 'one comment per day');
  await q(9, new Date('2026-11-22T12:00:00Z'));
  assert.equal(api.comments.get(100)?.length, 2);
});

test('neon warning with a lowered threshold, and dry-run creates nothing', async () => {
  const api = fakeApi();
  assert.equal((await neonWarning({ api, count: 2, limit: 10, threshold: '2', now: NOW, log: () => {} })).warned, true);
  assert.equal(api.issues.length, 1);
  const api2 = fakeApi();
  const r = await neonWarning({ api: api2, count: 9, limit: 10, now: NOW, dryRun: true, log: () => {} });
  assert.equal(r.warned, true);
  assert.equal(api2.issues.length, 0);
});

test('confirmNeonBranchLimit: at the limit with no failed create is confirmed; below it is ruled out', () => {
  const at = confirmNeonBranchLimit({ count: 10, limit: 10 });
  assert.equal(at.confirmed, true);
  assert.match(at.evidence.join(' '), /10 of 10/);
  const below = confirmNeonBranchLimit({ count: 4, limit: 10 });
  assert.equal(below.confirmed, false);
  assert.match(below.ruledOut.join(' '), /4 of 10/);
});

test('confirmNeonBranchLimit: a failed create_branch with a different error vetoes; a limit error confirms', () => {
  const other = confirmNeonBranchLimit({ count: 10, limit: 10, failedCreates: [{ at: 't', error: 'compute provisioning timed out' }] });
  assert.equal(other.confirmed, false);
  assert.match(other.ruledOut.join(' '), /different error/);
  const lim = confirmNeonBranchLimit({ count: 10, limit: 10, failedCreates: [{ at: 't', error: 'branches limit exceeded' }] });
  assert.equal(lim.confirmed, true);
});

test('known cause NOT confirmed: needs-rca issue listing what was ruled out, no cleanup, no redeploy', async () => {
  const api = fakeApi(), vercel = fakeVercel(NEON_ERR), fixes = cleanup(9);
  const r = await run(api, vercel, fixes, ev(), NOW, fakeNeon({ count: 4 }));
  assert.equal(r.decision.autofix, false);
  assert.equal(fixes.calls, 0);
  assert.equal(vercel.calls.redeploy, 0);
  const rca = api.issues.find((i: any) => i.labels.includes('needs-rca'));
  assert.ok(rca, 'needs-rca issue opened');
  assert.match(rca.body, /Ruled out[\s\S]*4 of 10/);
  assert.equal(api.issues.filter((i: any) => i.labels.includes('needs-rca')).length, 1);
  // a second failure does not open a second RCA issue
  await run(api, vercel, fixes, ev({ targetUrl: 'https://vercel.com/t/wyr/Again9' }), new Date(NOW.getTime() + 3600000), fakeNeon({ count: 4 }));
  assert.equal(api.issues.filter((i: any) => i.labels.includes('needs-rca')).length, 1);
  assert.equal(vercel.calls.redeploy, 0);
});

test('Neon API unreadable: cause stays unconfirmed, no auto-fix, RCA issue says why', async () => {
  const api = fakeApi(), vercel = fakeVercel(NEON_ERR), fixes = cleanup(9);
  const r = await run(api, vercel, fixes, ev(), NOW, fakeNeon(new Error('Neon 401')));
  assert.equal(r.decision.autofix, false);
  assert.equal(fixes.calls, 0);
  assert.match(api.issues.find((i: any) => i.labels.includes('needs-rca')).body, /could not read the Neon API: Neon 401/);
});

test('confirmed cause records its evidence on the issue once per deployment', async () => {
  const api = fakeApi(), vercel = fakeVercel(NEON_ERR), fixes = cleanup(9);
  await run(api, vercel, fixes, ev());
  await run(api, vercel, fixes, ev());
  const checks = (api.comments.get(100) ?? []).filter((c: string) => c.includes('Cause check'));
  assert.equal(checks.length, 1);
  assert.match(checks[0], /CONFIRMED[\s\S]*10 of 10/);
});

test('concurrent runs that both open an issue: the lowest number wins, the other closes itself as a duplicate', async () => {
  const api: any = fakeApi();
  const create = api.createIssue.bind(api);
  // a competing run opens its issue (lower number) just before ours is created
  api.createIssue = async (args: any) => { api.issues.push({ number: 50, title: args.title, body: args.body, labels: args.labels, state: 'open', createdAt: NOW.toISOString() }); api.comments.set(50, []); return create(args); };
  const vercel = fakeVercel(NEON_ERR), fixes = cleanup(3);
  await run(api, vercel, fixes, ev());
  const mine = api.issues.find((i: any) => i.number !== 50);
  assert.equal(mine.state, 'closed');
  assert.match((api.comments.get(mine.number) ?? []).join(' '), /Duplicate of #50/);
  assert.equal(api.issues.find((i: any) => i.number === 50).state, 'open');
  assert.ok((api.comments.get(50) ?? []).some((c: string) => c.includes('deploy-event')), 'the failure is recorded on the surviving issue');
});

test('cleanup that fails and frees nothing: says so, does not redeploy', async () => {
  const api = fakeApi(), vercel = fakeVercel(NEON_ERR);
  const fixes = { neonCleanup: async () => ({ deleted: 0, failed: true }) };
  const r = await run(api, vercel, fixes, ev());
  assert.equal(r.redeployed, false);
  assert.equal(vercel.calls.redeploy, 0);
  assert.match((api.comments.get(100) ?? []).join(' '), /cleanup run failed/);
});

test('Neon facts: only FAILED create_branch operations in the last 15 minutes count', async () => {
  const at = '2026-11-21T12:00:00Z';
  const minsAgo = (m: number) => new Date(Date.parse(at) - m * 60000).toISOString();
  const ops = [
    { action: 'create_branch', status: 'running', created_at: minsAgo(1) },
    { action: 'create_branch', status: 'scheduling', created_at: minsAgo(2) },
    { action: 'create_branch', status: 'skipped', created_at: minsAgo(3) },
    { action: 'create_branch', status: 'failed', created_at: minsAgo(5), error: 'branches limit exceeded' },
    { action: 'create_branch', status: 'failed', created_at: minsAgo(120), error: 'old unrelated failure' },
    { action: 'start_compute', status: 'failed', created_at: minsAgo(4), error: 'not a branch create' },
  ];
  const fetchImpl = async (url: string) => ({ ok: true, json: async () => (url.includes('/operations') ? { operations: ops } : { branches: new Array(10).fill({}), pagination: {} }) });
  const facts = await neonApi({ apiKey: 'k', projectId: 'p', limit: 10, fetchImpl }).facts(at);
  assert.equal(facts.count, 10);
  assert.deepEqual(facts.failedCreates, [{ at: minsAgo(5), error: 'branches limit exceeded' }]);
  assert.equal(confirmNeonBranchLimit(facts).confirmed, true, 'in-flight/other operations must not veto a real limit hit');
});

test('a failing redeploy is reported on the issue with needs-human, and does not throw', async () => {
  const api = fakeApi(), fixes = cleanup(4);
  const vercel: any = fakeVercel(NEON_ERR);
  vercel.redeploy = async () => { throw new Error('Vercel 403 @someone'); };
  const r = await run(api, vercel, fixes, ev());
  assert.equal(r.redeployed, false);
  const text = (api.comments.get(100) ?? []).join('\n');
  assert.match(text, /redeploy FAILED: Vercel 403 @\u200bsomeone/);
  assert.match(text, /freed 4 Neon branch/);
  assert.ok(api.issues[0].labels.includes('needs-human'));
});

test('build output cannot close the code block or mention people', () => {
  const log = 'line one\n```\n## injected heading @octocat and @org/team\n```` more';
  const f = fenced(log);
  const open = f.split('\n')[0];
  assert.ok(open.length >= 5, 'fence is longer than the longest backtick run in the log');
  assert.ok(/^`+$/.test(open) && f.endsWith(open));
  assert.ok(!f.includes('@octocat') && f.includes('@\u200boctocat'));
  assert.equal(neutralizeMentions('ping @user'), 'ping @\u200buser');
  const inline = inlineCode('bad ` tick @user');
  assert.ok(inline.startsWith('`` ') && inline.endsWith(' ``'));
  assert.ok(!inline.includes('@user'));
  const body = failureIssueBody({ sig: 'x', sigText: 'err @user `x`', event: { environment: 'Preview', targetUrl: 'u', sha: 's', at: 't' }, errorText: 'e @team', logTail: log, preview: true });
  assert.ok(!/@(octocat|org|user|team)/.test(body), 'no live mention anywhere in the body');
});

// Shapes seen on real deployment_status events (run 44941596043 and the #167 verification):
const REAL_SHA = 'fffe6748' + 'a'.repeat(32);
const realEvent = (over: any = {}) => ({
  state: 'failure',
  environment: 'Preview',
  targetUrl: 'https://wyr-27hb0cqmt-timfong888.vercel.app',
  description: 'Deployment has failed — run this Vercel CLI command: npx vercel inspect dpl_2FL6affbJ4zGLKdnbYJBRaQpXekS --logs',
  sha: REAL_SHA,
  ref: REAL_SHA, // for Vercel deployments the ref is the commit sha, not a branch
  ...over,
});
const SYNTAX_ERR = { errorCode: 'syntax_error', errorMessage: 'Command "npm run build:web && cp -r dist/. public/" exited with 1' };

test('deployment ref: the id in the description wins; else the inspector URL; else the deployment host', () => {
  const e = realEvent();
  assert.equal(deploymentRefFromEvent(e), 'dpl_2FL6affbJ4zGLKdnbYJBRaQpXekS');
  assert.equal(deploymentRefFromEvent({ ...e, description: 'Deployment has failed' }), 'wyr-27hb0cqmt-timfong888.vercel.app');
  assert.equal(deploymentRefFromEvent({ ...e, description: 'x', targetUrl: 'https://vercel.com/timfong888/wyr/2FL6affbJ4zGLKdnbYJBRaQpXekS' }), 'dpl_2FL6affbJ4zGLKdnbYJBRaQpXekS');
  assert.equal(deploymentRefFromEvent({ description: '', targetUrl: 'https://example.com/x' }), null);
  assert.equal(deploymentRefFromEvent({}), null);
});

test('real event shape: reads the Vercel error (not "unreadable") and looks PRs up by commit', async () => {
  const api = fakeApi([{ number: 172, state: 'OPEN', isCrossRepository: false }]);
  const vercel = fakeVercel(SYNTAX_ERR);
  const r = await run(api, vercel, cleanup(9), realEvent());
  assert.deepEqual(vercel.calls.asked, ['dpl_2FL6affbJ4zGLKdnbYJBRaQpXekS']);
  assert.match(api.issues[0].title, /syntax_error/);
  assert.doesNotMatch(api.issues[0].title + api.issues[0].body, /unreadable/);
  assert.match(api.issues[0].body, /Vercel API:/);
  assert.deepEqual(api.prCalls, [REAL_SHA], 'PR lookup uses the commit sha');
  assert.match((api.comments.get(172) ?? []).join(' '), /Deploy failed:[\s\S]*syntax_error/);
  assert.equal(r.decision.autofix, false, 'a code error is not a known cause');
});

test('real event shape: with only the deployment host, the id Vercel returns is used for markers and the redeploy', async () => {
  const api = fakeApi(), fixes = cleanup(5);
  const vercel = fakeVercel(NEON_ERR, 'dpl_REALID123');
  await run(api, vercel, fixes, realEvent({ description: 'Deployment has failed' }));
  assert.deepEqual(vercel.calls.asked, ['wyr-27hb0cqmt-timfong888.vercel.app']);
  assert.deepEqual(vercel.calls.redeployed, ['dpl_REALID123']);
  assert.match((api.comments.get(100) ?? []).join(' '), /dpl=dpl_REALID123/);
});

test('real event shape: the same real error on two commits is one issue with the real error as its signature', async () => {
  const api = fakeApi(), vercel = fakeVercel(SYNTAX_ERR), fixes = cleanup(0);
  await run(api, vercel, fixes, realEvent());
  await run(api, vercel, fixes, realEvent({ sha: 'b'.repeat(40), ref: 'b'.repeat(40), description: 'Deployment has failed — npx vercel inspect dpl_OTHER999 --logs', targetUrl: 'https://wyr-other-timfong888.vercel.app' }));
  assert.equal(api.issues.length, 1);
  assert.equal((api.comments.get(100) ?? []).filter((c: string) => c.includes('deploy-event')).length, 2);
});

// ---- #167 re-verify: a failing PR comment (GraphQL addComment needs pull-requests: write) crashed the run ----
const PR_NUMBER = 172;
// the real symptom: commenting on a PR throws "Resource not accessible by integration"; commenting on an issue works
function apiWithBrokenPrComment(prs: any[], extra: (n: number, body: string) => void = () => {}) {
  const api = fakeApi(prs);
  const ok = api.comment.bind(api);
  api.comment = async (n: number, body: string) => { if (n === PR_NUMBER) throw new Error('GraphQL: Resource not accessible by integration (addComment)'); extra(n, body); return ok(n, body); };
  return api;
}

test('a PR comment that throws does not stop the Neon check or the auto-fix (real payload shapes)', async () => {
  const api = apiWithBrokenPrComment([{ number: PR_NUMBER, state: 'OPEN', isCrossRepository: false }]);
  const vercel = fakeVercel(NEON_ERR, 'dpl_2FL6affbJ4zGLKdnbYJBRaQpXekS'), fixes = cleanup(7);
  const r = await run(api, vercel, fixes, realEvent());
  assert.equal(r.decision.autofix, true, 'the Neon cause was still checked and confirmed');
  assert.equal(fixes.calls, 1, 'cleanup ran');
  assert.deepEqual(vercel.calls.redeployed, ['dpl_2FL6affbJ4zGLKdnbYJBRaQpXekS'], 'redeploy ran');
  const text = (api.comments.get(100) ?? []).join('\n');
  assert.match(text, /Cause check for neon-branch-limit: CONFIRMED/);
  assert.match(text, /non-critical steps failed[\s\S]*comment on PR #172[\s\S]*Resource not accessible/, 'the failure is written on the issue');
});

test('a PR comment that throws does not stop the needs-rca path either', async () => {
  const api = apiWithBrokenPrComment([{ number: PR_NUMBER, state: 'OPEN', isCrossRepository: false }]);
  const vercel = fakeVercel(NEON_ERR), fixes = cleanup(7);
  const r = await run(api, vercel, fixes, realEvent(), NOW, fakeNeon({ count: 3 })); // below the limit: not the Neon limit
  assert.equal(r.decision.autofix, false);
  assert.ok(api.issues.some((i: any) => i.labels.includes('needs-rca')), 'unconfirmed cause still opens the root-cause issue');
  assert.equal(fixes.calls, 0);
  assert.equal(vercel.calls.redeploy, 0);
});

test('label and informational comment failures never block the auto-fix', async () => {
  const api = fakeApi();
  api.ensureLabels = async () => { throw new Error('labels forbidden'); };
  const ok = api.comment.bind(api);
  api.comment = async (n: number, body: string) => { if (body.includes('Cause check')) throw new Error('comment forbidden'); return ok(n, body); };
  const vercel = fakeVercel(NEON_ERR, 'dpl_REAL1'), fixes = cleanup(4);
  const r = await run(api, vercel, fixes, realEvent());
  assert.equal(r.decision.autofix, true);
  assert.deepEqual(vercel.calls.redeployed, ['dpl_REAL1']);
  assert.match((api.comments.get(100) ?? []).join('\n'), /ensure labels: labels forbidden[\s\S]*cause-check comment: comment forbidden/);
});

test('the retry-cap marker is NOT soft: if it cannot be recorded, nothing is cleaned up or redeployed', async () => {
  const api = fakeApi();
  const ok = api.comment.bind(api);
  api.comment = async (n: number, body: string) => { if (body.includes('deploy-autofix')) throw new Error('cannot write marker'); return ok(n, body); };
  const vercel = fakeVercel(NEON_ERR), fixes = cleanup(4);
  await assert.rejects(run(api, vercel, fixes, realEvent()), /cannot write marker/);
  assert.equal(fixes.calls, 0, 'no cleanup without the cap marker');
  assert.equal(vercel.calls.redeploy, 0, 'no redeploy without the cap marker');
});

test('the real GitHub adapter posts comments through the REST issues-comments endpoint (works for PRs with issues: write)', async () => {
  const { mkdtempSync, writeFileSync, chmodSync, readFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'fakegh-'));
  const log = join(dir, 'calls.json');
  writeFileSync(join(dir, 'gh'), `#!/bin/sh\nprintf '%s\\n' "$*" >> '${log}'\n`);
  chmodSync(join(dir, 'gh'), 0o755);
  const oldPath = process.env.PATH;
  process.env.PATH = `${dir}:${oldPath}`;
  try {
    await ghApi('timfong888/would-you-rather').comment(183, 'hello');
  } finally { process.env.PATH = oldPath; }
  const call = readFileSync(log, 'utf8');
  assert.match(call, /api -X POST repos\/timfong888\/would-you-rather\/issues\/183\/comments -f body=hello/);
  assert.doesNotMatch(call, /issue comment/, 'not `gh issue comment` (GraphQL addComment needs pull-requests: write)');
});

// Real execFileSync failures look like: message = `Command failed: <argv joined by spaces>\n<stderr>`, stderr = the gh output.
function execFileSyncError(body: string) {
  const e: any = new Error(`Command failed: gh api -X POST repos/timfong888/would-you-rather/issues/172/comments -f body=${body} --silent\ngh: Resource not accessible by integration (HTTP 403)`);
  e.stderr = 'gh: Resource not accessible by integration (HTTP 403)\n';
  return e;
}

test('describeError keeps the real cause of an execFileSync failure and never echoes the command or an HTML comment opener', () => {
  const body = `<!-- deploy-event sig=89c7665348 sha=${'f'.repeat(40)} dpl=dpl_2FL6 at=2026-11-21T22:43:00Z -->\nFailed again`;
  const withStderr = describeError(execFileSyncError(body));
  assert.equal(withStderr, 'gh: Resource not accessible by integration (HTTP 403)');
  const e: any = execFileSyncError(body); delete e.stderr; // no stderr property: fall back to the message minus the "Command failed:" line
  assert.equal(describeError(e), 'gh: Resource not accessible by integration (HTTP 403)');
  assert.equal(describeError(new Error('plain')), 'plain');
  const hostile = describeError(Object.assign(new Error('x'), { stderr: '<!-- open and never closed' }));
  assert.ok(!hostile.includes('<') && !hostile.includes('>'), 'no raw HTML comment markers');
});

test('a real-shaped adapter error on the PR comment is recorded with its true cause, and the fix still runs', async () => {
  const api = apiWithBrokenPrComment([{ number: PR_NUMBER, state: 'OPEN', isCrossRepository: false }]);
  const ok = api.comment.bind(api);
  api.comment = async (n: number, body: string) => { if (n === PR_NUMBER) throw execFileSyncError(body); return ok(n, body); };
  const vercel = fakeVercel(NEON_ERR, 'dpl_REAL2'), fixes = cleanup(3);
  const r = await run(api, vercel, fixes, realEvent());
  assert.equal(r.decision.autofix, true);
  assert.deepEqual(vercel.calls.redeployed, ['dpl_REAL2']);
  const text = (api.comments.get(100) ?? []).join('\n');
  assert.match(text, /comment on PR #172: gh: Resource not accessible by integration \(HTTP 403\)/);
  assert.doesNotMatch(text, /Command failed|deploy-event sig=[0-9a-f]+ sha=[0-9a-f]{40} dpl=\S+ at=\S+ -->\s*\n- /, 'no echoed command or marker in the failure note');
});

test('the deploy-event record is NOT soft: if it cannot be written, nothing is cleaned up or redeployed', async () => {
  const api = fakeApi();
  const ok = api.comment.bind(api);
  api.comment = async (n: number, body: string) => { if (body.includes('deploy-event')) throw new Error('cannot write event'); return ok(n, body); };
  const vercel = fakeVercel(NEON_ERR), fixes = cleanup(4);
  await assert.rejects(run(api, vercel, fixes, realEvent()), /cannot write event/);
  assert.equal(fixes.calls, 0);
  assert.equal(vercel.calls.redeploy, 0);
});
