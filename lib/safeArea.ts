/**
 * Safe-area padding for screens without a native header (#109). Pure, so it is unit-tested.
 * Adds the device insets to the content's own top/bottom padding. Returns null when both insets are 0
 * (web, Android without cutouts), so those platforms render exactly as before.
 */
type Insets = { top: number; bottom: number };
type PaddingStyle = { padding?: unknown; paddingVertical?: unknown; paddingTop?: unknown; paddingBottom?: unknown } | null | undefined;

const num = (...values: unknown[]): number => {
  for (const v of values) if (typeof v === 'number') return v;
  return 0;
};

export function insetPadding(style: PaddingStyle, insets: Insets): { paddingTop: number; paddingBottom: number } | null {
  if (!insets.top && !insets.bottom) return null;
  const s = style ?? {};
  return {
    paddingTop: num(s.paddingTop, s.paddingVertical, s.padding) + insets.top,
    paddingBottom: num(s.paddingBottom, s.paddingVertical, s.padding) + insets.bottom,
  };
}
