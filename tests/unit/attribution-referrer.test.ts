// Vercel Security Review on #85: a kids-page referrer must never reach attribution, and same-site
// referrers keep only the origin.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyAttribution } from '../../lib/attribution';

const SITE = 'www.wouldyourather.fyi';
const page = `https://${SITE}/categories`;

test('a same-site kids-page referrer is dropped entirely', () => {
  for (const path of ['/game/kf-2', '/results/kf-1', '/p/kf-3', '/categories/kids-family', '/complete/kids-family', '/unlock/kids-family', '/would-you-rather-questions-for-kids']) {
    const a = classifyAttribution({ referrer: `https://${SITE}${path}?x=1`, url: page, siteHost: SITE });
    assert.ok(!('referrer' in a), `${path}: no referrer`);
    assert.ok(!JSON.stringify(a).includes('kf-') && !JSON.stringify(a).includes('kids'), `${path}: nothing about the kids page`);
    assert.equal(a.channel, 'direct');
  }
});

test('a kids-path referrer is dropped whatever host it is on (apex, preview, other)', () => {
  for (const host of ['wouldyourather.fyi', 'wyr-git-main-timfong888.vercel.app', 'example.com']) {
    const a = classifyAttribution({ referrer: `https://${host}/game/kf-2`, url: page, siteHost: SITE });
    assert.ok(!('referrer' in a) && !('referring_domain' in a), host);
  }
});

test('a same-site adult referrer keeps only the origin, and stays "internal"', () => {
  const a = classifyAttribution({ referrer: `https://${SITE}/game/sb-1?link_id=abc`, url: page, siteHost: SITE });
  assert.equal(a.referrer, `https://${SITE}`);
  assert.equal(a.channel, 'internal');
  const apex = classifyAttribution({ referrer: 'https://wouldyourather.fyi/feed', url: page, siteHost: SITE });
  assert.equal(apex.referrer, 'https://wouldyourather.fyi');
});

test('outside referrers are unchanged (origin and path)', () => {
  const a = classifyAttribution({ referrer: 'https://www.google.com/search', url: page, siteHost: SITE });
  assert.equal(a.referrer, 'https://www.google.com/search');
  assert.equal(a.channel, 'organic_search');
});
