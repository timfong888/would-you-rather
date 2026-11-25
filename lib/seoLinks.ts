// Where a question in a list (category page, SEO landing page) links to on the web (#206 / S3).
// A question with a read-only page (`lib/seoBatch.js`) links to its `/q/<id>`; any other question
// returns null and the list keeps today's target, so no list links to a page that does not exist.
// The URL is absolute on purpose: `/q/<id>` is a static page, not an app route, and expo-router
// treats an absolute URL as an ordinary link (a full page load) instead of a client-side route.
import { SITE_URL } from '@/constants/config';
import { isSeoBatchId } from '@/lib/seoBatch';

export function questionPageUrl(id: string): string | null {
  return isSeoBatchId(id) ? `${SITE_URL}/q/${id}` : null;
}
