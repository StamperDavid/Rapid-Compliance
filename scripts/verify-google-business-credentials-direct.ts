/**
 * CREDENTIAL SMOKE TEST — direct service call, NOT product-path verification.
 *
 * What this DOES test:
 *   - Google Business Profile /localPosts endpoint accepts our saved OAuth
 *     access token from apiKeyService.getServiceKey('google_business')
 *   - GoogleBusinessService.createLocalPost() constructs a valid request
 *     and returns the new post resource name
 *
 * What this does NOT test:
 *   - The product path through Jasper → SocialMediaManager → GoogleBusinessExpert
 *     → social_post tool → Mission Control
 *   - Whether GoogleBusinessExpert.execute() (the function the orchestrator
 *     actually calls) handles the response correctly. This script bypasses it.
 *
 * Renamed Apr 29 2026 from `verify-google-business-post-live.ts` because the
 * old name implied end-to-end coverage. No orchestrated Google Business
 * product-path verify exists yet — that is a KNOWN GAP.
 *
 * Real product path: KNOWN GAP — no `verify-google-business-orchestrated-post-live.ts` yet.
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
