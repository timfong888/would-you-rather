/**
 * Usage: npx tsx scripts/report.ts daily|seo     (see docs/reports.md for credentials)
 * Prints a short plain-text summary to stdout. Exit code 0 even when a section is not
 * configured, so a scheduled task still gets the report.
 */
import { dailyReport, seoReport, SITE } from './report/core';
import { SEO_PAGES } from '../constants/seoPages';

async function main() {
  const mode = process.argv[2];
  const keyUrls = [SITE, `${SITE}/categories`, ...SEO_PAGES.map((p) => `${SITE}/${p.slug}`)];
  if (mode === 'daily') console.log(await dailyReport(fetch, process.env));
  else if (mode === 'seo') console.log(await seoReport(fetch, process.env, keyUrls));
  else {
    console.error('usage: report.ts daily|seo');
    process.exit(2);
  }
}
main();
