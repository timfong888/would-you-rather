# Owner access (bypass the paywall for the owner and testers)

Owner access unlocks every paid pack on a device without going through the
payment flow. It exists so the owner can QA premium content and expansion
packs, and so tester activity does not pollute paywall metrics.

## One-time setup

1. Generate a code and its digest:

   ```bash
   node scripts/owner-code-hash.mjs
   ```

   Keep the printed **code** in a password manager. Only the **digest** goes
   into config.

2. Set `EXPO_PUBLIC_OWNER_ACCESS_SHA256=<digest>` in the Vercel project's
   environment variables (Production and Preview) and redeploy. For local dev,
   put the same line in `.env`.

If the variable is not set, the owner-access UI never appears and no code can
work. There is no default code.

## Using it

1. Open **Settings**.
2. Tap the `VERSION x.y.z` line at the bottom **7 times**.
3. An **Owner access** section appears. Enter the code and tap **Unlock
   everything**.

Every category, including expansion packs, is now playable on this device.
Settings shows an "Owner access active" banner with a **Revoke** button.
"Reset progress" clears answers and purchased unlocks but leaves owner access
in place; use Revoke to turn it off.

## What it does to analytics

While owner access is active, every analytics event carries
`owner_access: true`. Filter it out in PostHog so paywall views, CTA clicks
and completions from the owner or testers do not count toward the
painted-door conversion test.

## Security model, plainly

- The code never ships. The bundle only contains its SHA-256 digest, so
  reading the JavaScript does not reveal it. Use the generated random code
  (or any long passphrase) so guessing is infeasible.
- Unlock state is stored in `localStorage` on web, the same as a purchased
  unlock. Anyone with devtools can flip that flag today regardless of owner
  access. Real enforcement needs server-side entitlements, which is what
  SAT-926 (RevenueCat) introduces. When that lands, owner access should map to
  a RevenueCat granted entitlement and the same redemption UI can serve the
  creator-gifting program (SAT-628).
- Rotating the code is one env var change plus a redeploy. Devices that
  already redeemed keep access until they revoke or clear storage.
