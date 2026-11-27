# iOS Launch GTM Skill

**Applies to:** any iOS app on App Store Connect.  
**Key credential:** `apple-ops` GitHub environment (admin-scope ASC key). All agent actions run as `workflow_dispatch` GitHub workflows; the key never leaves that environment.  
**Security:** Narrow the ASC key to the minimum required roles before real revenue; return trigger set by Tim (D130, 2026-11-27).

---

## 1. Ordered Launch Checklist

Steps are ordered by dependency. Agent steps run as dispatch workflows; Tim steps are manual ASC or device actions.

| # | Step | Who | Workflow / link | Risk |
|---|---|---|---|---|
| 1 | Decide icon concept, name variant, support email | **Tim** | — | — |
| 2 | Build icon, derive favicon / splash | Agent | PR + Tim approval | Reversible |
| 3 | Add `/support` page; update privacy policy | Agent (page) + **Tim** (mailbox) | PR | Reversible |
| 4 | Paid Apps agreement, banking, tax | **Tim** (Account Holder) | ASC → Business | One-way (financial) |
| 5 | New preview build; upload; confirm VALID | Agent | `apple-upload.yml` | Reversible |
| 6 | TestFlight: internal group, beta description | Agent | `apple-testflight-group.yml` | Reversible |
| 7 | Capture and compose screenshots (web draft) | Agent | `ios-simulator-screenshots.yml` (PR #268) | Reversible |
| 8 | Native paywall screenshot | **Tim** (device) | — | — |
| 9 | Listing text, keywords, URLs, copyright, age rating | Agent (dry run first) | `apple-metadata.yml` | Reversible |
| 10 | Upload approved screenshots to Asset Library | Agent (dry run first) | `apple-asset-library.yml` (PR #275) | Reversible |
| 11 | IAP localizations + review screenshots | Agent (dry run first) | `apple-metadata.yml` submit action | Reversible |
| 12 | App Privacy (nutrition label) | **Tim** | ASC → App Privacy | **One-way until resubmit** |
| 13 | App Compliance (age rating questionnaire) | Agent (dry run first) | `apple-metadata.yml` | Reversible pre-submit |
| 14 | Sandbox tester and device purchase checks | **Tim** | ASC → Sandbox Testers | — |
| 15 | Submit for review | **Tim explicit go-ahead**, then Agent | `apple-metadata.yml` submit | **One-way** |

---

## 2. App Store Connect API Coverage Matrix

**Source:** App Store Connect API v4.6.1 OpenAPI specification  
(download: https://developer.apple.com/sample-code/app-store-connect/app-store-connect-openapi-specification.zip)

| Sidebar Feature | Has API | Key OpenAPI paths | Create | Delete | Reversible | Min role [unverified] |
|---|---|---|---|---|---|---|
| **App Information** | ✅ | `PATCH /v1/appInfos/{id}` · `POST /v1/appInfoLocalizations` · `PATCH /v1/appInfoLocalizations/{id}` | ✅ (localizations) | ✅ (localizations) | Yes | App Manager |
| **App Compliance** | ✅ | `PATCH /v1/ageRatingDeclarations/{id}` · `POST /v1/appEncryptionDeclarations` | ✅ | ✅ | Yes pre-submit | App Manager |
| **App Review** | ✅ | `POST /v1/appStoreReviewDetails` · `PATCH /v1/appStoreReviewDetails/{id}` · `POST /v1/appStoreReviewAttachments` · `DELETE /v1/appStoreReviewAttachments/{id}` · `POST /v1/reviewSubmissions` | ✅ | ✅ (attachments) | Reversible until submit | App Manager |
| **App Privacy** | ❌ | No endpoint in spec | — | — | N/A — Tim enters manually in ASC | Account Holder / Admin |
| **App Accessibility** | ✅ | `POST /v1/accessibilityDeclarations` · `PATCH /v1/accessibilityDeclarations/{id}` (v4.0+) | ✅ | — | Yes | App Manager |
| **Ratings and Reviews** | ✅ (read + respond) | `GET /v1/customerReviews` · `POST /v1/customerReviewResponses` · `PATCH /v1/customerReviewResponses/{id}` · `DELETE /v1/customerReviewResponses/{id}` · `GET /v1/apps/{id}/customerReviewSummarizations` (v4.0+) | Responses only | ✅ (responses) | Yes | Customer Support / App Manager |
| **In-App Events** | ✅ | `POST /v1/appEvents` · `PATCH /v1/appEvents/{id}` · `DELETE /v1/appEvents/{id}` · `POST /v1/appEventLocalizations` · `POST /v1/appEventScreenshots` · `POST /v1/appEventVideoClips` | ✅ | ✅ | Yes pre-publish | App Manager |
| **Custom Product Pages** | ✅ | `POST /v1/appCustomProductPages` · `PATCH /v1/appCustomProductPages/{id}` · `DELETE /v1/appCustomProductPages/{id}` · `POST /v1/appCustomProductPageVersions` · `POST /v1/appCustomProductPageLocalizations` | ✅ | ✅ | Yes (delete removes page) | App Manager |
| **Asset Library** | ✅ | `GET /v1/apps/{id}/assetLibrary` · `POST /v1/appAssetLibraryImages` · `PATCH /v1/appAssetLibraryImages/{id}` · `DELETE /v1/appAssetLibraryImages/{id}` · `GET /v1/appAssetLibraryRefData` | ✅ | ✅ | Yes (delete placements first) | App Manager [unverified] |
| **Product Page Optimization** | ✅ | `POST /v1/appStoreVersionExperiments` · `PATCH /v1/appStoreVersionExperiments/{id}` · `DELETE /v1/appStoreVersionExperiments/{id}` · `POST /v1/appStoreVersionExperimentTreatments` · `POST /v1/appStoreVersionPromotions` | ✅ | ✅ | Yes pre-start | App Manager |
| **Promo Codes (IAP)** | ✅ | `POST /v1/inAppPurchaseOfferCodes` · `POST /v1/inAppPurchaseOfferCodeCustomCodes` · `POST /v1/inAppPurchaseOfferCodeOneTimeUseCodes` (v4.2+) | ✅ | — | One-way once issued | App Manager |
| **Promo Codes (Subscriptions)** | ✅ | `POST /v1/subscriptionOfferCodes` | ✅ | — | One-way once issued | App Manager |
| **Game Center** | ✅ | Full CRUD for details, achievements, leaderboards, challenges, activities, matchmaking rules, groups | ✅ | ✅ | Yes pre-release | App Manager |
| **Monetization / IAP** | ✅ | `POST/PATCH/DELETE /v2/inAppPurchases` · subscriptions · prices · promotional offers | ✅ | ✅ | Yes pre-approval | App Manager |
| **TestFlight** | ✅ | Beta groups, testers, build localizations, beta app localizations, feedback | ✅ | ✅ | Yes | App Manager / Developer |
| **Analytics (ASC)** | ✅ (read only) | `POST /v1/analyticsReportRequests` · `GET /v1/analyticsReportRequests/{id}/reports` · `DELETE /v1/analyticsReportRequests/{id}` | Request only | ✅ | Yes | Admin / Finance / Sales+Reports |
| **Sales & Finance Reports** | ✅ (read only) | `GET /v1/salesReports` | — | — | Read-only | Finance / Sales+Reports |

### Separate-credential services

| Service | API base | Credentials | What agents can do |
|---|---|---|---|
| **Apple Search Ads** | `api.searchads.apple.com` | Search Ads Campaign Management API key (separate from ASC; OAuth2 client credentials) | Create/pause/budget campaigns, ad groups, creative sets; pull impression/tap/conversion reports |
| **Apple Analytics (Xcode / App Analytics)** | Covered by ASC Analytics Reports API above | Same ASC key (admin/finance/sales role) | Download CSV report segments via `analyticsReportSegments` |

---

## 3. The Repeatable Autonomous GTM Loop

The loop runs on a cadence (weekly or after a significant release) and is designed so Level 1 steps can run autonomously after dry-run verification; Level 2 steps always require Tim's go-ahead.

### Loop phases

| Phase | Step | Workflow / action | Who runs | Risk |
|---|---|---|---|---|
| **Read** | 1. Pull analytics report (impressions, conversion, retention) | `apple-ops.yml` → `apple-analytics.yml` [to build] via `GET /v1/analyticsReportRequests` | Agent | Read-only |
| **Read** | 2. Fetch customer reviews (all 1–3-star last 30 days) | `apple-ops.yml` action `reviews` via `GET /v1/customerReviews` | Agent | Read-only |
| **Read** | 3. Summarize review themes and conversion gaps | In-session LLM analysis of step 1–2 output | Agent | Read-only |
| **Propose** | 4. Draft copy changes (keywords, subtitle, promo text) as a PR against `store/ios/listing-final.json` | PR on feature branch; dry-run print of char counts | Agent | Reversible (PR) |
| **Propose** | 5. Draft screenshot/asset change brief as a PR | PR with updated `store/ios/storyboard.json` or asset brief in `docs/` | Agent | Reversible (PR) |
| **Propose** | 6. Draft review response batch as a PR | PR with `store/ios/review-responses.json` (new file) | Agent | Reversible (PR) |
| **Level 1** | 7. Dry-run listing text push | `apple-metadata.yml` `dry_run=true` | Agent | Read-only |
| **Level 1** | 8. After dry run passes: push approved listing text | `apple-metadata.yml` `apply=true` (requires `approved:true` in `listing-final.json`) | Agent (Tim approves file) | Reversible pre-submit |
| **Level 1** | 9. Dry-run asset library upload | `apple-asset-library.yml` `dry_run=true` | Agent | Read-only |
| **Level 1** | 10. After dry run passes: upload approved image | `apple-asset-library.yml` `dry_run=false` | Agent (Tim approves image) | Reversible (delete available) |
| **Level 1** | 11. Post approved review responses | `apple-review-responses.yml` [to build] via `POST /v1/customerReviewResponses` | Agent (Tim approves batch) | Reversible (delete endpoint exists) |
| **Level 2** | 12. Create/update custom product page (keyword + localized text) | `apple-custom-pages.yml` [to build] | **Tim triggers** | Reversible (delete before publish) |
| **Level 2** | 13. Launch in-app event | `apple-events.yml` [to build] | **Tim triggers** | One-way once live |
| **Level 2** | 14. Start product page optimization test | `apple-ppo.yml` [to build] | **Tim triggers** | Reversible pre-start |
| **Level 2** | 15. Submit updated listing for review | `apple-metadata.yml` submit action | **Tim explicit go-ahead** | **One-way** |

### Level definitions

- **Level 1 (agent-autonomous):** reads, drafts as PRs, runs dry-run workflows, pushes live only after Tim has committed `approved:true` to the relevant file. Agent runs the workflow; Tim's approval is embedded in the file.
- **Level 2 (Tim-triggered):** agent drafts the payload PR; Tim triggers the dispatch workflow. No live change without Tim's trigger.

### Cadence

| Trigger | Action |
|---|---|
| Weekly (or post-release) | Phases Read + Propose: open PRs, do not apply |
| Tim merges a Propose PR | Level 1 dry run auto-suggested in the PR comment; Tim triggers apply |
| Conversion dips > 10% week-on-week | Escalate: open a Linear issue flagged Urgent, skip to Propose immediately |

---

## 4. Dispatch Workflow Reference

Existing workflows (all in `.github/workflows/`):

| Workflow | What it does | Dry run default | Environment |
|---|---|---|---|
| `apple-ops.yml` | Read-only ASC queries (builds, versions, IAP, etc.) | Always read-only | `apple-ops` |
| `apple-metadata.yml` | Push listing text, screenshots, submit | `apply=false` | `apple-ops` |
| `apple-asset-library.yml` | Upload one image to Asset Library (PR #275) | `dry_run=true` | `apple-ops` |
| `apple-testflight-group.yml` | Create beta group, set testers | — | `apple-ops` |
| `apple-upload.yml` | Upload build | — | `apple-ops` |
| `ios-simulator-screenshots.yml` | Capture + compose screenshots (PR #268) | — | `macos-15` |

Workflows to build next (Level 1 / Level 2):

| Workflow | Action | Priority |
|---|---|---|
| `apple-review-responses.yml` | Batch POST review responses from JSON file | Level 1 — high |
| `apple-analytics.yml` | Request + download analytics report segment CSV | Level 1 — high |
| `apple-custom-pages.yml` | Create / update custom product page (dry run default) | Level 2 |
| `apple-events.yml` | Create / schedule in-app event | Level 2 |
| `apple-ppo.yml` | Create product page optimization experiment | Level 2 |

---

## 5. App Privacy

App Privacy (the "nutrition label") has **no API endpoint** in ASC v4.6.1. Tim enters the data types manually in ASC → App Privacy. See `docs/specs/app-store-listing.md` §5.3 for the values to enter.

---

*Spec version: ASC v4.6.1. Last updated: 2026-11-27.*
