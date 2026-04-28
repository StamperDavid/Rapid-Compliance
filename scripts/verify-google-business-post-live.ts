/**
 * Live verify: create a real Local Post on the brand's Google Business
 * Profile listing using the saved OAuth access token.
 *
 * Exercises:
 *   1. apiKeyService.getServiceKey('google_business') reads the saved config
 *   2. createGoogleBusinessService() builds a configured service instance
 *   3. GoogleBusinessService.createLocalPost() POSTs to /localPosts
 *   4. Google returns the new post resource name
 *
 * WARNING: This script creates a REAL post on the live brand listing.
 * The post will be visible to anyone who finds the business on Google Maps
 * or Search. After running, MANUALLY DELETE the post from the Google
 * Business Profile dashboard — stale promotional posts hurt SEO trust.
 * Run from D:\Future Rapid Compliance: npx tsx scripts/verify-google-business-post-live.ts
 *
 * Usage:
 *   npx tsx scripts/verify-google-business-post-live.ts
 *   npx tsx scripts/verify-google-business-post-live.ts --summary "Custom summary"
 *   npx tsx scripts/verify-google-business-post-live.ts --cta-url https://salesvelocity.ai/demo
 *
 * Defaults:
 *   summary    = timestamped pipeline-test summary
 *   actionType = LEARN_MORE
 *   url        = https://salesvelocity.ai
 *
 * Account ID and Location ID are read from the saved config (must be set).
 */

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { createGoogleBusinessService } from '@/lib/integrations/google-business-service';

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i > 0 && process.argv[i + 1]) { return process.argv[i + 1]; }
  return undefined;
}

async function main(): Promise<void> {
  const summary = getArg('--summary')
    ?? `[SalesVelocity.ai pipeline test ${new Date().toISOString()}] If you can read this, the Google Business Profile posting path is wired end-to-end.`;
  const ctaUrl = getArg('--cta-url') ?? 'https://salesvelocity.ai';

  console.log('[verify-google-business-post] loading service config from Firestore...');
  const service = await createGoogleBusinessService();
  if (!service) {
    console.error('FAIL — Google Business service not configured. Save credentials via the integrations UI first.');
    console.error('       Required fields: accessToken, accountId, locationId.');
    process.exit(1);
  }

  // Sanity-check the access token + location IDs before posting.
  const location = await service.getLocation();
  if (!location) {
    console.error('FAIL — Google Business location fetch failed. Access token may be expired or accountId/locationId may be wrong.');
    process.exit(2);
  }
  console.log(`Authenticated against location: ${location.title} (${location.name})`);

  console.log(`\nCreating Local Post:`);
  console.log(`  summary: ${summary}`);
  console.log(`  cta:     LEARN_MORE → ${ctaUrl}`);
  console.log('');

  const result = await service.createLocalPost({
    summary,
    callToAction: { actionType: 'LEARN_MORE', url: ctaUrl },
  });

  if (!result.success) {
    console.error(`FAIL — create rejected: ${result.error}`);
    process.exit(3);
  }

  console.log('PASS — Local Post created');
  console.log(`  post name: ${result.postName ?? '(none)'}`);
  console.log('  (Google Business Profile posts are visible on the listing in Search/Maps.)');
  console.log('  Manage posts at: https://business.google.com/posts');
  console.log('\nRemember to manually delete this post from the Business Profile dashboard when done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
