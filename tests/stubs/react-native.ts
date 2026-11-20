// Minimal stand-in so lib/analytics.ts can run under node:test.
export const Platform = { OS: 'web' as const, select: (o: any) => o.web ?? o.default };
