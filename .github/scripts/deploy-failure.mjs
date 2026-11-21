#!/usr/bin/env node
// Backstop for failed Vercel deploys (#165) and the Neon branch-count warning (#166).
//   deploy-failure.mjs deployment      handle the deployment_status event in $GITHUB_EVENT_PATH
//   deploy-failure.mjs neon-count N L  warn when N branches of limit L is at/over the threshold
//   deploy-failure.mjs ensure-labels   create the labels this uses
// Env: GH_TOKEN, GITHUB_REPOSITORY. Deployment mode also: VERCEL_TOKEN (optional), VERCEL_TEAM_ID, NEON_API_KEY.
// Set DRY_RUN=true to log what would be done without creating or changing anything.
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  LABEL_FAILURE, LABEL_HUMAN, LABEL_RCA, marker, normalizeError, signatureId, matchKnownCause, isPreview,
  parseEvents, countAutofixAttempts, recurrenceReached, decideAutofix, failureIssueBody, rcaIssueBody,
  neonWarnThreshold, deploymentRefFromEvent, confirmNeonBranchLimit, neutralizeMentions, inlineCode,
} from './deploy-failure-core.mjs';

const LABELS = [
  [LABEL_FAILURE, 'B60205', 'A failed deployment or infrastructure limit; see docs/deploy-failures.md'],
  [LABEL_RCA, 'D93F0B', 'Recurring deploy failure: root cause required, auto-fix paused'],
  [LABEL_HUMAN, '5319E7', 'Needs the owner'],
];

// Finds issues by signature marker, across open and closed issues.
async function issuesFor(api, sigKey) {
  const all = [...(await api.listIssues({ label: LABEL_FAILURE, state: 'open' })), ...(await api.listIssues({ label: LABEL_FAILURE, state: 'closed' }))];
  return all.filter((i) => (i.body ?? '').includes(marker.signature(sigKey)));
}

export async function handleDeploymentFailure({ event, api, vercel, neon, fixes, causes, now, log = console.log, dryRun = false }) {
  if (!['failure', 'error'].includes(event.state)) { log(`ignore: state ${event.state}`); return { handled: false }; }
  const preview = isPreview(event.environment);
  const ref = deploymentRefFromEvent(event) ?? `unknown-${event.sha.slice(0, 7)}`;
  const err = await vercel.getDeployment(ref).catch(() => null);
  const dpl = err?.id ?? ref; // the canonical dpl_ id when Vercel returned one (needed for the redeploy)

  const errorText = err && (err.errorCode || err.errorMessage) ? [err.errorCode, err.errorMessage].filter(Boolean).join(': ') : '';
  const sigText = normalizeError(err?.errorCode, err?.errorMessage || (errorText ? '' : `unreadable (${event.description ?? 'no description'})`));
  const sig = signatureId(sigText);
  const cause = errorText ? matchKnownCause(sigText, causes) : null;
  log(`failure ${dpl} (${event.environment}) signature ${sig}: ${sigText}`);
  if (dryRun) { log(`DRY-RUN: would upsert issue for ${sig}; candidate cause: ${cause ? cause.id : 'none'} (not confirmed in dry-run)`); return { handled: true, sig, dryRun: true }; }

  await api.ensureLabels(LABELS);
  const at = now.toISOString();
  const logTail = errorText ? await vercel.getEventsTail(dpl).catch(() => '') : '';

  // one open issue per signature
  const existing = await issuesFor(api, sig);
  let issue = existing.find((i) => i.state === 'open');
  if (!issue) {
    const labels = [LABEL_FAILURE, ...(preview ? [] : [LABEL_HUMAN])];
    const number = await api.createIssue({
      title: `Deploy failure: ${sigText}`.slice(0, 120),
      body: failureIssueBody({ sig, sigText, event: { ...event, at }, errorText, logTail, preview }),
      labels,
    });
    issue = { number, state: 'open', body: marker.signature(sig) };
    log(`opened issue #${number}`);
    // runs for different commits can race and both open one: the lowest-numbered open issue wins, the other closes itself
    const open = (await issuesFor(api, sig)).filter((i) => i.state === 'open').map((i) => i.number).sort((a, b) => a - b);
    if (open.length > 1 && open[0] !== number) {
      await api.closeIssue(number, `Duplicate of #${open[0]} (same error signature, opened by a concurrent run).`);
      issue = { number: open[0], state: 'open', body: marker.signature(sig) };
      log(`closed #${number} as a duplicate of #${open[0]}`);
    }
    existing.splice(0, existing.length, ...(await issuesFor(api, sig)));
  } else if (!preview && !(issue.labels ?? []).includes(LABEL_HUMAN)) {
    await api.addLabels(issue.number, [LABEL_HUMAN]);
  }

  // record this failure once per deployment (event redelivery must not double count)
  const commentsByIssue = new Map();
  for (const i of existing) commentsByIssue.set(i.number, await api.listComments(i.number));
  const allBodies = [...commentsByIssue.values()].flat();
  const events = parseEvents(allBodies, sig);
  if (!events.some((e) => e.dpl === dpl)) {
    await api.comment(issue.number, `${marker.event({ sig, sha: event.sha, dpl, at })}\nFailed again: ${event.environment}, ${event.targetUrl}, commit ${event.sha}.`);
    events.push({ sha: event.sha, dpl, at });
    // deployment.ref is the commit SHA for Vercel deployments, not a branch: look PRs up by commit
    const prs = await api.prsForCommit(event.sha).catch(() => []);
    const own = prs.filter((p) => p.state === 'OPEN' && !p.isCrossRepository);
    for (const p of own) await api.comment(p.number, `Deploy failed: ${inlineCode(sigText)}. Tracked in #${issue.number}.`);
  }

  // recurrence: 3 failures of one signature in 7 days => root-cause issue, auto-fix paused
  const rcaIssues = await issuesFor(api, `rca-${sig}`);
  let rcaOpen = rcaIssues.some((i) => i.state === 'open');
  // closing an RCA resets the count: only failures after the newest RCA issue was opened count toward the next one
  const lastRca = Math.max(0, ...rcaIssues.map((i) => Date.parse(i.createdAt ?? 0) || 0));
  if (!rcaOpen && recurrenceReached(events.filter((e) => Date.parse(e.at) > lastRca), now)) {
    const n = await api.createIssue({ title: `Root cause needed: ${sigText}`.slice(0, 120), body: rcaIssueBody({ sig, sigText, issueNumber: issue.number }), labels: [LABEL_FAILURE, LABEL_RCA] });
    await api.comment(issue.number, `Recurred ${3}+ times in 7 days. Root-cause issue: #${n}. Auto-fix is paused until it is closed.`);
    rcaOpen = true;
    log(`opened needs-rca issue #${n}`);
  }

  // a known cause is only a candidate until its check passes against the real system
  let confirmation = null;
  if (cause?.confirm === 'neon-branch-limit') {
    confirmation = await neon.facts(at).then((f) => confirmNeonBranchLimit(f)).catch((e) => ({ confirmed: false, evidence: [], ruledOut: [`could not read the Neon API: ${e.message}`] }));
    log(`confirm ${cause.id}: ${confirmation.confirmed ? 'confirmed' : 'NOT confirmed'} | ${[...confirmation.evidence, ...confirmation.ruledOut].join(' | ')}`);
    if (!allBodies.some((b) => b.includes(marker.confirm({ sig, dpl })))) {
      await api.comment(issue.number, `${marker.confirm({ sig, dpl })}\n${neutralizeMentions(`Cause check for ${cause.id}: ${confirmation.confirmed ? 'CONFIRMED' : 'NOT confirmed'}.\nEvidence: ${confirmation.evidence.join('; ') || 'none'}.\nRuled out: ${confirmation.ruledOut.join('; ') || 'nothing'}.`)}`);
    }
    if (!confirmation.confirmed && !rcaOpen) {
      const n = await api.createIssue({ title: `Root cause needed: ${sigText}`.slice(0, 120), body: rcaIssueBody({ sig, sigText, issueNumber: issue.number, evidence: confirmation.evidence, ruledOut: confirmation.ruledOut, reason: 'looked like a known cause but it was not confirmed' }), labels: [LABEL_FAILURE, LABEL_RCA] });
      await api.comment(issue.number, `Known cause not confirmed. Root-cause issue: #${n}. No auto-fix.`);
      rcaOpen = true;
      log(`opened needs-rca issue #${n} (cause not confirmed)`);
    }
  }

  // auto-fix (previews only, confirmed known causes only, one retry per commit)
  const attempts = countAutofixAttempts(allBodies, sig, event.sha);
  const decision = decideAutofix({ cause, environment: event.environment, attempts, rcaOpen, confirmation });
  log(`autofix: ${decision.autofix ? 'yes' : 'no'} (${decision.reason})`);
  if (!decision.autofix) return { handled: true, sig, issue: issue.number, decision };

  // record the attempt BEFORE acting so the cap holds even if the fix fails half way
  await api.comment(issue.number, `${marker.autofix({ sig, sha: event.sha })}\nAuto-fix attempt for commit ${event.sha} (${cause.id}), preview only.`);
  const cleanup = await fixes.neonCleanup();
  if (cleanup.deleted === 0) {
    await api.comment(issue.number, cleanup.failed
      ? `The cleanup run failed and freed 0 branches (see the workflow log), so a redeploy would fail the same way. Not redeploying. Needs a human.`
      : `Cleanup freed 0 branches, so a redeploy would fail the same way. Not redeploying. Every remaining preview branch has an open PR or is protected: needs a decision.`);
    return { handled: true, sig, issue: issue.number, decision, redeployed: false };
  }
  let next;
  try {
    next = await vercel.redeploy(dpl);
  } catch (e) {
    // the retry is already spent, so say what happened where people look
    await api.comment(issue.number, `Cleanup freed ${cleanup.deleted} Neon branch(es), but the redeploy FAILED: ${neutralizeMentions(e.message)}. The one automatic retry for commit ${event.sha} is used. Needs a human.`);
    await api.addLabels(issue.number, [LABEL_HUMAN]);
    return { handled: true, sig, issue: issue.number, decision, redeployed: false, redeployError: e.message };
  }
  await api.comment(issue.number, `Cleanup deleted ${cleanup.deleted} Neon branch(es); redeployed as ${next}. No further automatic retry for commit ${event.sha}.`);
  return { handled: true, sig, issue: issue.number, decision, redeployed: true };
}

export async function neonWarning({ api, count, limit, threshold, now, dryRun = false, log = console.log }) {
  const warnAt = neonWarnThreshold(limit, threshold);
  log(`Neon branches: ${count} of ${limit} (warn at ${warnAt})`);
  const sigText = 'Neon branch count near limit';
  const sig = signatureId(sigText);
  if (count < warnAt) return { warned: false, count };
  if (dryRun) { log(`DRY-RUN: would open or update the "${sigText}" issue`); return { warned: true, count, dryRun: true }; }
  await api.ensureLabels(LABELS);
  const open = (await issuesFor(api, sig)).find((i) => i.state === 'open');
  const day = now.toISOString().slice(0, 10);
  const line = `Neon has ${count} of ${limit} branches after today's cleanup (warning at ${warnAt}). At ${limit}, Vercel previews fail with "Resource provisioning failed".`;
  if (!open) {
    const number = await api.createIssue({ title: `${sigText}: ${count} of ${limit}`, body: `${marker.signature(sig)}\n${line}\n\nThe daily cleanup deletes branches of merged/closed PRs. What remains belongs to open PRs, the default branch, or is protected: merge or close PRs, or raise the plan limit.`, labels: [LABEL_FAILURE] });
    return { warned: true, count, issue: number };
  }
  const bodies = await api.listComments(open.number);
  if (!bodies.some((b) => b.includes(marker.warnDay(day)))) await api.comment(open.number, `${marker.warnDay(day)}\n${line}`);
  return { warned: true, count, issue: open.number };
}

// ---- real adapters ----
function gh(args) { return execFileSync('gh', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }); }

export function ghApi(repo) {
  const lines = (out) => out.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return {
    async ensureLabels(labels) { for (const [n, c, d] of labels) gh(['label', 'create', n, '--color', c, '--description', d, '--force', '--repo', repo]); },
    async listIssues({ label, state }) {
      const rows = JSON.parse(gh(['issue', 'list', '--repo', repo, '--label', label, '--state', state, '--limit', '100', '--json', 'number,body,state,labels,createdAt']));
      return rows.map((r) => ({ number: r.number, body: r.body, createdAt: r.createdAt, state: r.state.toLowerCase(), labels: r.labels.map((l) => l.name) }));
    },
    async createIssue({ title, body, labels }) {
      const url = gh(['issue', 'create', '--repo', repo, '--title', title, '--body', body, ...labels.flatMap((l) => ['--label', l])]).trim();
      return Number(url.split('/').pop());
    },
    async closeIssue(n, comment) { gh(['issue', 'close', String(n), '--repo', repo, '--reason', 'not planned', '--comment', comment]); },
    async addLabels(n, labels) { gh(['issue', 'edit', String(n), '--repo', repo, ...labels.flatMap((l) => ['--add-label', l])]); },
    async comment(n, body) { gh(['issue', 'comment', String(n), '--repo', repo, '--body', body]); },
    async listComments(n) { return lines(gh(['api', `repos/${repo}/issues/${n}/comments`, '--paginate', '--jq', '.[] | {body}'])).map((c) => c.body); },
    async prsForCommit(sha) {
      const jq = `[.[] | {number: .number, state: (.state | ascii_upcase), isCrossRepository: ((.head.repo.full_name // "") != "${repo}")}]`;
      return JSON.parse(gh(['api', `repos/${repo}/commits/${sha}/pulls`, '--jq', jq]));
    },
  };
}

export function neonApi({ apiKey, projectId, limit, fetchImpl = fetch }) {
  const call = async (path) => {
    if (!apiKey) throw new Error('no NEON_API_KEY');
    const res = await fetchImpl(`https://console.neon.tech/api/v2/projects/${projectId}${path}`, { headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Neon ${res.status}`);
    return res.json();
  };
  return {
    // branch count now, and create_branch operations that FAILED in the last 15 minutes
    async facts(atIso) {
      const branches = [];
      for (let cursor = '', i = 0; i < 10; i++) {
        const page = await call(`/branches?limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`);
        branches.push(...page.branches);
        cursor = page.pagination?.next ?? '';
        if (!cursor) break;
      }
      const ops = await call('/operations?limit=100');
      const since = Date.parse(atIso) - 15 * 60000; // this runs seconds after the failure; ignore older and in-flight operations
      const failedCreates = (ops.operations ?? []).filter((o) => o.action === 'create_branch' && o.status === 'failed' && Date.parse(o.created_at) >= since).map((o) => ({ at: o.created_at, error: o.error ?? 'failed (no error text)' }));
      return { count: branches.length, limit, failedCreates };
    },
  };
}

export function vercelApi({ token, teamId, name = 'wyr', fetchImpl = fetch }) {
  const q = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';
  const call = async (path, init) => {
    if (!token) throw new Error('no VERCEL_TOKEN');
    const res = await fetchImpl(`https://api.vercel.com${path}${path.includes('?') ? q.replace('?', '&') : q}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    if (!res.ok) throw new Error(`Vercel ${res.status}`);
    return res.json();
  };
  return {
    getDeployment: (id) => call(`/v13/deployments/${id}`),
    async getEventsTail(id) {
      const ev = await call(`/v3/deployments/${id}/events?limit=-1`);
      return (Array.isArray(ev) ? ev : []).map((e) => e.text ?? e.payload?.text).filter(Boolean).slice(-30).join('\n').slice(-3000);
    },
    // unverified live: POST /v13/deployments with deploymentId redeploys an existing deployment
    async redeploy(id) {
      const out = await call('/v13/deployments?forceNew=1', { method: 'POST', body: JSON.stringify({ name, deploymentId: id }) });
      return out.id ?? 'a new deployment';
    },
  };
}

async function main() {
  const [mode, a, b] = process.argv.slice(2);
  const repo = process.env.GITHUB_REPOSITORY;
  const dryRun = process.env.DRY_RUN === 'true';
  const now = new Date();
  if (mode === 'ensure-labels') { await ghApi(repo).ensureLabels(LABELS); return; }
  if (mode === 'neon-count') { await neonWarning({ api: ghApi(repo), count: Number(a), limit: Number(b), threshold: process.env.NEON_WARN_THRESHOLD, now, dryRun }); return; }
  if (mode === 'deployment') {
    const p = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    const event = {
      state: p.deployment_status?.state, environment: p.deployment_status?.environment ?? p.deployment?.environment,
      targetUrl: p.deployment_status?.target_url, description: p.deployment_status?.description, sha: p.deployment?.sha, ref: p.deployment?.ref,
    };
    const causes = JSON.parse(readFileSync(new URL('../deploy-known-causes.json', import.meta.url), 'utf8'));
    const fixes = {
      // never throws: a partly failed sweep still reports what it freed (branches another run deleted count as freed)
      neonCleanup: async () => {
        const r = spawnSync('bash', ['.github/scripts/neon-preview-cleanup.sh', 'sweep'], { encoding: 'utf8', env: { ...process.env, DRY_RUN: 'false' } });
        const out = `${r.stdout ?? ''}${r.stderr ?? ''}`;
        console.log(out);
        return { deleted: (out.match(/^(DELETED|GONE) /gm) ?? []).length, failed: r.status !== 0 };
      },
    };
    await handleDeploymentFailure({ event, api: ghApi(repo), neon: neonApi({ apiKey: process.env.NEON_API_KEY, projectId: process.env.NEON_PROJECT_ID, limit: Number(process.env.NEON_BRANCH_LIMIT ?? 10) }), vercel: vercelApi({ token: process.env.VERCEL_TOKEN, teamId: process.env.VERCEL_TEAM_ID }), fixes, causes, now, dryRun });
    return;
  }
  console.error('usage: deploy-failure.mjs deployment | neon-count <count> <limit> | ensure-labels');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
