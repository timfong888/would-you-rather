/**
 * Universal Links (#134): a tapped https://www.wouldyourather.fyi/p/<id> link opens the iOS app
 * (public/.well-known/apple-app-site-association, `associatedDomains` in app.json). On the web
 * /p/<id> is a static share page that redirects to /game/<id>; in the app there is no /p route,
 * so app/+native-intent.tsx maps it to the game screen here. Pure, so it is unit tested.
 *
 * The query is kept as it is: `f` (the sender's pick, #92) and, for adult items, `link_id`/`gen`.
 * Kids links carry no link_id or gen in the first place (lib/shareQuestion.ts), and nothing here
 * stores or sends anything.
 */
const FORWARDED = ['f', 'link_id', 'gen'] as const;

export function nativePathFor(
  path: string,
  lookup: (id: string) => { category: string } | undefined,
): string {
  let url: URL;
  try {
    url = new URL(path, 'https://www.wouldyourather.fyi');
  } catch {
    return path;
  }
  const m = url.pathname.match(/^\/p\/([^/]+)\/?$/);
  if (!m) return path;
  const id = decodeURIComponent(m[1]);
  const q = lookup(id);
  // Not in this build's catalog (e.g. a category left out of iOS v1): open the home screen.
  if (!q) return '/';
  const params = new URLSearchParams();
  params.set('cat', q.category);
  for (const k of FORWARDED) {
    const v = url.searchParams.get(k);
    if (v) params.set(k, v);
  }
  return `/game/${encodeURIComponent(id)}?${params.toString()}`;
}
