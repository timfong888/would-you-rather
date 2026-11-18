/**
 * Where the owner-code bypass may exist. Pure, so it is unit-tested.
 *
 * EXPO_PUBLIC_* values are inlined into the JS bundle, so the SHA-256 digest of
 * the owner code ships inside every build and can be pulled out of an .ipa and
 * brute-forced offline. Native release builds (TestFlight and the App Store,
 * where `__DEV__` is false) therefore never offer the code field, whatever the
 * environment says; the owner is granted access with a RevenueCat promotional
 * entitlement instead (Apple guideline 3.1.1 also restricts unlock mechanisms
 * other than in-app purchase). Web keeps the existing behavior, and native dev
 * builds keep it for testing.
 */
export function ownerCodeAllowed(platformOS: string, isDev: boolean): boolean {
  return platformOS === 'web' || isDev;
}
