import { Redirect } from 'expo-router';

/**
 * The single Kids & Family category was replaced by topic categories (#124). App Review's notes
 * (store/ios/listing.md, docs/payments.md row 15) open /unlock/kids-family to see the parental gate, so the old
 * link goes to a live kids unlock screen, which shows the gate first. A static route wins over `[id]`; the web
 * build redirects earlier (vercel.json). The path stays a kids route (lib/kidsPaths.ts).
 */
export default function RetiredUnlockKidsFamily() {
  return <Redirect href="/unlock/tiny-choices" />;
}
