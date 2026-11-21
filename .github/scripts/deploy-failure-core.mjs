// Pure logic for the deploy-failure backstop (issue #165, #164, #166). No I/O here, so it is unit tested.
import { createHash } from 'node:crypto';

export const RETRY_CAP_PER_COMMIT = 1;
export const RECURRENCE_COUNT = 3;
export const RECURRENCE_DAYS = 7;
export const NEON_WARN_FRACTION = 0.8;

export const LABEL_FAILURE = 'deploy-failure';
export const LABEL_RCA = 'needs-rca';
export const LABEL_HUMAN = 'needs-human';

// Error text with ids, URLs and SHAs removed, so the same cause on different deployments maps to one signature.
export function normalizeError(code, message) {
  const text = [code, message].filter(Boolean).join(': ').trim() || 'unknown error';
  return text
    .replace(/https?:\/\/\S+/g, '<url>')
    .replace(/\bdpl_\w+/g, 'dpl_*')
    .replace(/\b[0-9a-f]{7,40}\b/gi, '<sha>')
    .replace(/\s+/g, ' ');
}

export function signatureId(signature) {
  return createHash('sha1').update(signature).digest('hex').slice(0, 10);
}

// The error text only NOMINATES a known cause. A cause with a `confirm` check must pass it before any fix runs.
export function matchKnownCause(signature, causes) {
  const s = signature.toLowerCase();
  return causes.find((c) => s.includes(String(c.match).toLowerCase())) ?? null;
}

// Anything that is not clearly a preview is treated as production (fail safe: no auto-fix).
export function isPreview(environment) {
  return /^preview\b/i.test(String(environment ?? '').trim());
}

// markers live in HTML comments so they survive edits to the visible text
export const marker = {
  signature: (id) => `<!-- deploy-signature: ${id} -->`,
  event: ({ sig, sha, dpl, at }) => `<!-- deploy-event sig=${sig} sha=${sha} dpl=${dpl} at=${at} -->`,
  autofix: ({ sig, sha }) => `<!-- deploy-autofix sig=${sig} sha=${sha} -->`,
  confirm: ({ sig, dpl }) => `<!-- deploy-confirm sig=${sig} dpl=${dpl} -->`,
  warnDay: (day) => `<!-- neon-warning day=${day} -->`,
};

export function parseEvents(commentBodies, sig) {
  const out = [];
  const re = /<!-- deploy-event sig=(\S+) sha=(\S+) dpl=(\S+) at=(\S+) -->/g;
  for (const body of commentBodies) {
    for (const m of body.matchAll(re)) if (m[1] === sig) out.push({ sha: m[2], dpl: m[3], at: m[4] });
  }
  return out;
}

export function countAutofixAttempts(commentBodies, sig, sha) {
  const needle = marker.autofix({ sig, sha });
  return commentBodies.reduce((n, b) => n + (b.split(needle).length - 1), 0);
}

// Failures of one signature, counting each deployment once, inside the window.
export function recurrenceReached(events, now) {
  const since = now.getTime() - RECURRENCE_DAYS * 86400000;
  const dpls = new Set(events.filter((e) => Date.parse(e.at) >= since).map((e) => e.dpl));
  return dpls.size >= RECURRENCE_COUNT;
}

// Neon branch limit, from facts read from the Neon API (Vercel logs have nothing for a provisioning failure).
// The plan's limit is not exposed by the Neon project API (quota is null), so it is configured (NEON_BRANCH_LIMIT).
// facts: { count, limit, failedCreates: [{ at, error }] }
export function confirmNeonBranchLimit({ count, limit, failedCreates = [] }) {
  const evidence = [];
  const ruledOut = [];
  const looksLikeLimit = (e) => /limit|exceed|quota|too many/i.test(String(e ?? ''));
  const otherFailure = failedCreates.find((f) => !looksLikeLimit(f.error));
  const limitFailure = failedCreates.find((f) => looksLikeLimit(f.error));
  if (count >= limit) evidence.push(`Neon branch count ${count} of ${limit}`);
  else ruledOut.push(`Neon branch count is ${count} of ${limit}, below the limit now (it may have been cleaned up since the failure)`);
  if (limitFailure) evidence.push(`failed create_branch operation at ${limitFailure.at}: ${limitFailure.error}`);
  if (otherFailure) ruledOut.push(`a failed create_branch operation at ${otherFailure.at} has a different error: ${otherFailure.error}`);
  if (!failedCreates.length) evidence.push('no failed create_branch operation (a limit rejection is returned by the API before an operation exists)');
  return { confirmed: count >= limit && !otherFailure, evidence, ruledOut };
}

// The only place that decides whether we may redeploy.
// Production never; known cause only if confirmed; one retry per commit; paused while an RCA is open.
export function decideAutofix({ cause, environment, attempts, rcaOpen, confirmation }) {
  if (!isPreview(environment)) return { autofix: false, reason: 'production or unknown environment: never automatic' };
  if (!cause) return { autofix: false, reason: 'no known cause for this error' };
  if (!cause.preview_fix) return { autofix: false, reason: 'known cause has no automatic fix' };
  if (cause.confirm && !confirmation?.confirmed) return { autofix: false, reason: `cause ${cause.id} not confirmed: ${(confirmation?.ruledOut ?? ['not checked']).join('; ')}` };
  if (rcaOpen) return { autofix: false, reason: 'auto-fix paused: open needs-rca issue for this signature' };
  if (attempts >= RETRY_CAP_PER_COMMIT) return { autofix: false, reason: `retry cap reached for this commit (${attempts}/${RETRY_CAP_PER_COMMIT})` };
  return { autofix: true, reason: `known cause ${cause.id} confirmed` };
}

export function neonWarnThreshold(limit, override) {
  const n = Number(override);
  if (Number.isFinite(n) && n > 0) return n;
  return Math.ceil(limit * NEON_WARN_FRACTION);
}

export function deploymentIdFromTargetUrl(url) {
  const last = String(url ?? '').split('?')[0].replace(/\/+$/, '').split('/').pop();
  return last ? (last.startsWith('dpl_') ? last : `dpl_${last}`) : null;
}

const TEMPLATE_TAIL = `
## Why chain
1.
2.
3.

## Fix

## Prevention

## Known-causes entry

## Ruled out
`;

export function failureIssueBody({ sig, sigText, event, errorText, logTail, preview }) {
  return `${marker.signature(sig)}
Opened by the deploy-failure Action. Close only with a confirmed root cause (docs/deploy-failures.md).

## Symptom
- Error: \`${sigText}\`
- Environment: ${event.environment}${preview ? '' : ' (production: needs Tim; never auto-redeployed)'}
- Deployment: ${event.targetUrl}
- Commit: ${event.sha}
- First seen: ${event.at}

## Evidence
${errorText ? `Vercel API: \`${errorText}\`` : 'Vercel error could not be read (no VERCEL_TOKEN or the API call failed), so this is only the status text above.'}
${logTail ? `\n\`\`\`\n${logTail}\n\`\`\`\n` : '\nNo build log lines were returned (a build that never started has none).\n'}${TEMPLATE_TAIL}`;
}

export function rcaIssueBody({ sig, sigText, issueNumber, ruledOut = [], evidence = [], reason }) {
  return `${marker.signature(`rca-${sig}`)}
\`${sigText}\` ${reason ?? `failed ${RECURRENCE_COUNT} times in ${RECURRENCE_DAYS} days`} (see #${issueNumber}). Auto-fix is paused for this signature until this issue is closed.

Do the root cause, not another retry (docs/deploy-failures.md).

## Symptom
\`${sigText}\`

## Evidence
${evidence.length ? evidence.map((e) => `- ${e}`).join('\n') : '-'}

## Ruled out
${ruledOut.length ? ruledOut.map((e) => `- ${e}`).join('\n') : '-'}

## Why chain
1.
2.
3.

## Fix

## Prevention

## Known-causes entry
`;
}
