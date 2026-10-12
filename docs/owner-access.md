# Owner access (bypass the paywall for the owner and testers)

Owner access unlocks every paid pack on a device without paying. It exists so
the owner can QA premium content and expansion packs, and so tester activity
does not pollute paywall metrics. It is redeemed from the payment sheet
itself ("Have a code?"), so there is no hidden gesture to remember.

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

If the variable is not set, the "Have a code?" link never appears and no code
can work. There is no default code.

## Using it

1. Open any locked pack and tap the unlock button to open the payment sheet.
2. Tap **Have a code?** (shown under the legal text; it only appears when a
   digest is configured for the build).
3. Enter the code and tap **Apply code**.

The pack unlocks immediately and, because the code grants owner access,
every other category and expansion pack is now playable on this device too.
**Settings** shows an "Owner access active" banner with a **Revoke** button.
"Reset progress" clears answers and purchased unlocks but leaves owner access
in place; use Revoke to turn it off.

The same field is the intended home for creator gift codes (SAT-628) once
entitlements are server-side; today it only accepts the owner code.

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

## Related client-side gating limits

The same "no backend" caveat applies to the question gate itself:

- The game screen bounces direct URLs to locked questions, but a visitor
  arriving via a share link (`?link_id=<v4 uuid>`) may play that one shared
  question. That is the hook of the share loop and is intentional. Link ids
  are generated client-side, so a forged UUID also passes; the format check
  only removes the trivial `?link_id=x` route.
- Unlock state and owner access live in `localStorage`.

Both become real only once entitlements are checked server-side
(RevenueCat, SAT-926).
