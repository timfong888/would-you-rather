import { Redirect } from 'expo-router';

/**
 * The single Kids & Family category was replaced by topic categories (#124). A static route wins over `[id]`, so an
 * old /complete/kids-family link (native or web) lands on the category list instead of "Category not found".
 * The web build redirects earlier still (vercel.json). The path stays a kids route (lib/kidsPaths.ts), so nothing is
 * tracked before the redirect.
 */
export default function RetiredCompleteKidsFamily() {
  return <Redirect href="/categories" />;
}
