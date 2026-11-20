/**
 * In-app version text (#119). Pure, so it is unit-tested. The values come from the native binary at
 * runtime (expo-application), never from a constant, so the text cannot drift from the shipped build.
 */
export function formatVersion(version: string | null | undefined, build: string | null | undefined): string {
  const v = version?.trim();
  const b = build?.trim();
  if (!v) return 'Version unknown';
  return b ? `Version ${v} (${b})` : `Version ${v}`;
}
