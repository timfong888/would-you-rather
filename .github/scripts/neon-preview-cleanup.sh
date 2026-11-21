#!/usr/bin/env bash
# Delete stale Neon preview branches (named "preview/<git head ref>").
#
#   neon-preview-cleanup.sh branch <head-ref>   delete that one preview branch
#   neon-preview-cleanup.sh sweep               delete all stale preview/* branches
#
# Env: NEON_API_KEY, NEON_PROJECT_ID, GH_TOKEN, GITHUB_REPOSITORY, DRY_RUN (true|false)
# Optional: NEON_API_BASE (default https://console.neon.tech/api/v2)
#
# Hard guards: only names starting with "preview/"; never the default, primary or
# protected Neon branch; never a branch whose git branch has an open PR; any
# lookup that fails means "keep".
set -uo pipefail

: "${NEON_API_KEY:?NEON_API_KEY is not set}"
: "${NEON_PROJECT_ID:?NEON_PROJECT_ID is not set}"
: "${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is not set}"
DRY_RUN="${DRY_RUN:-true}"
API="${NEON_API_BASE:-https://console.neon.tech/api/v2}/projects/${NEON_PROJECT_ID}"
PREFIX="preview/"
failures=0
removed=0   # branches deleted, or that would be deleted in a dry run (for the branch-count report)

neon() { # neon METHOD PATH
  curl -fsS -X "$1" -H "Authorization: Bearer ${NEON_API_KEY}" -H "Accept: application/json" "${API}$2"
}

list_branches() { # prints one JSON object per line
  local cursor="" page next
  while :; do
    page=$(neon GET "/branches?limit=100${cursor:+&cursor=$cursor}") || return 1
    jq -c '.branches[]' <<<"$page"
    next=$(jq -r '.pagination.next // empty' <<<"$page")
    [ -z "$next" ] && break
    cursor="$next"
  done
}

delete_branch() { # delete_branch <neon-branch-json> <reason>
  local json="$1" reason="$2" id name
  id=$(jq -r .id <<<"$json"); name=$(jq -r .name <<<"$json")
  if [[ "$name" != "$PREFIX"* ]]; then echo "SKIP   $name (not a preview/ branch)"; return; fi
  if [ "$(jq -r '.default or .primary or .protected' <<<"$json")" = "true" ]; then
    echo "SKIP   $name (default/primary/protected)"; return
  fi
  if [ "$DRY_RUN" = "true" ]; then
    echo "DRY-RUN would delete $name ($id): $reason"; removed=$((removed + 1)); return
  fi
  # 404 means a concurrent run already deleted it: that is the outcome we wanted, not a failure
  code=$(curl -sS -o /dev/null -w '%{http_code}' -X DELETE -H "Authorization: Bearer ${NEON_API_KEY}" "${API}/branches/${id}") || code=000
  case "$code" in
    2??) echo "DELETED $name ($id): $reason"; removed=$((removed + 1)) ;;
    404) echo "GONE   $name ($id): already deleted"; removed=$((removed + 1)) ;;
    *)   echo "ERROR  failed to delete $name ($id): HTTP $code"; failures=$((failures + 1)) ;;
  esac
}

# Prints "delete:<reason>" or "keep:<reason>" for a git head ref.
decide() {
  local ref="$1" open all status
  open=$(gh pr list --repo "$GITHUB_REPOSITORY" --head "$ref" --state open --json number --jq 'length') \
    || { echo "keep:could not read open PRs"; return; }
  if [ "$open" != "0" ]; then echo "keep:open PR on $ref"; return; fi

  status=$(gh api -i "repos/${GITHUB_REPOSITORY}/git/ref/heads/${ref}" 2>/dev/null | sed -n '1s/^HTTP[^ ]* \([0-9]*\).*/\1/p')
  case "$status" in
    404) echo "delete:git branch $ref is gone"; return ;;
    200) ;;
    *)   echo "keep:could not check git branch (HTTP ${status:-?})"; return ;;
  esac

  all=$(gh pr list --repo "$GITHUB_REPOSITORY" --head "$ref" --state all --json state --jq 'map(.state) | unique | join(",")') \
    || { echo "keep:could not read PRs"; return; }
  if [ -n "$all" ]; then echo "delete:PR for $ref is ${all} (no open PR)"; else echo "keep:branch $ref exists, no PR"; fi
}

case "${1:-}" in
  branch)
    ref="${2:?head ref required}"
    name="${PREFIX}${ref}"
    echo "Neon cleanup for closed PR branch: $name (dry-run=$DRY_RUN)"
    json=$(list_branches | jq -c --arg n "$name" 'select(.name == $n)') || { echo "ERROR listing Neon branches"; exit 1; }
    if [ -z "$json" ]; then echo "KEEP   $name (no such Neon branch)"; exit 0; fi
    open=$(gh pr list --repo "$GITHUB_REPOSITORY" --head "$ref" --state open --json number --jq 'length') \
      || { echo "KEEP   $name (could not read open PRs)"; exit 0; }
    if [ "$open" != "0" ]; then echo "KEEP   $name (another open PR on $ref)"; exit 0; fi
    delete_branch "$json" "PR closed"
    ;;
  sweep)
    echo "Neon preview sweep on ${GITHUB_REPOSITORY} (dry-run=$DRY_RUN)"
    all=$(list_branches) || { echo "ERROR listing Neon branches"; exit 1; }
    while IFS= read -r json; do
      [ -z "$json" ] && continue
      name=$(jq -r .name <<<"$json")
      if [[ "$name" != "$PREFIX"* ]]; then echo "KEEP   $name (not a preview/ branch)"; continue; fi
      if [ "$(jq -r '.default or .primary or .protected' <<<"$json")" = "true" ]; then
        echo "KEEP   $name (default/primary/protected)"; continue
      fi
      verdict=$(decide "${name#"$PREFIX"}")
      case "$verdict" in
        delete:*) delete_branch "$json" "${verdict#delete:}" ;;
        *)        echo "KEEP   $name (${verdict#keep:})" ;;
      esac
    done <<<"$all"
    # Report the branch count after cleanup; warn (issue) at 80% of the limit. Never fails the sweep.
    total=$(grep -c . <<<"$all" || true)
    remaining=$((total - removed))
    echo "Neon branches: $total before cleanup, $remaining after (limit ${NEON_BRANCH_LIMIT:-unset})"
    if [ -n "${NEON_BRANCH_LIMIT:-}" ] && [ -n "${GH_TOKEN:-}" ]; then
      node .github/scripts/deploy-failure.mjs neon-count "$remaining" "$NEON_BRANCH_LIMIT" || echo "WARN  branch-count warning step failed (ignored)"
    fi
    ;;
  *) echo "usage: $0 branch <head-ref> | sweep" >&2; exit 2 ;;
esac

[ "$failures" -eq 0 ] || { echo "$failures delete(s) failed"; exit 1; }
