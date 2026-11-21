---
name: Deploy failure (root cause)
about: A failed Vercel deployment. Closed only with a confirmed root cause (see docs/deploy-failures.md).
title: "Deploy failure: "
labels: deploy-failure
---

## Symptom
<!-- Exact error text, deployment link, commit, preview or production. -->

## Evidence
<!-- Log lines or API output. "No logs" is evidence too (build never started). Not guesses. -->

## Why chain
<!-- Ask "why" until you reach a cause we control. One line per step. -->
1.
2.
3.

## Fix
<!-- The code/config change (link the PR). -->

## Prevention
<!-- The guard that stops it recurring: test, alert, workflow (link). -->

## Known-causes entry
<!-- Signature + fix added to docs/deploy-failures.md and .github/deploy-known-causes.json, or why it cannot be recognised from the error text. -->

## Ruled out
<!-- Required if the cause is not confirmed. The issue stays open until it is. -->
