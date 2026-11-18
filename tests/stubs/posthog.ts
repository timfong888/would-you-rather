// Records what lib/analytics.ts asks PostHog to do.
export const calls: { op: string; args: any[] }[] = [];
export default class PostHog {
  constructor(public key: string, public options: unknown) { calls.push({ op: 'init', args: [key] }); }
  capture(event: string, props: unknown) { calls.push({ op: 'capture', args: [event, props] }); }
  identify(id: string) { calls.push({ op: 'identify', args: [id] }); }
  reset() { calls.push({ op: 'reset', args: [] }); }
  optOut() { calls.push({ op: 'optOut', args: [] }); }
  optIn() { calls.push({ op: 'optIn', args: [] }); }
}
