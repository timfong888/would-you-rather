#!/usr/bin/env node
// Thin go-check: verifies the submit go comment before the main step acquires ASC secrets.
// Env: GITHUB_TOKEN, GO_ISSUE_COMMENT_ID. No ASC secrets needed or accepted here.
import { verifyGoComment } from './lib/ascFull.mjs';

const { GITHUB_TOKEN, GO_ISSUE_COMMENT_ID } = process.env;
if (!GITHUB_TOKEN) { console.error('GITHUB_TOKEN is required'); process.exit(2); }

try {
  const result = await verifyGoComment({ commentId: GO_ISSUE_COMMENT_ID, fetch, githubToken: GITHUB_TOKEN });
  console.log(`Go check passed: comment ${result.commentId} posted at ${result.createdAt}`);
} catch (e) {
  console.error(String(e.message ?? e));
  process.exit(1);
}
