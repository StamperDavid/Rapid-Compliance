/**
 * CREDENTIAL SMOKE TEST — direct service call, NOT product-path verification.
 *
 * What this DOES test:
 *   - Mastodon's /api/v1/statuses endpoint accepts our saved access token
 *     from apiKeyService.getServiceKey('mastodon')
 *   - MastodonService.postStatus() constructs a valid request and returns
 *     the new status id + URL
 *
 * What this does NOT test:
 *   - The product path through Jasper → SocialMediaManager → MastodonExpert
 *     → social_post tool → Mission Control
 *   - Whether MastodonExpert.execute() (the function the orchestrator actually
 *     calls) handles the response correctly. This script bypasses it entirely.
 *
 * Renamed Apr 29 2026 from `verify-mastodon-post-live.ts` because the old name
 * implied end-to-end coverage. The actual end-to-end product-path verify
 * lives at `scripts/verify-mastodon-orchestrated-post-live.ts`.
 *
 * Real product path: see `scripts/verify-mastodon-orchestrated-post-live.ts`
 */

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { createMastodonService } from '@/lib/integrations/mastodon-service';

async function main(): Promise<void> {
  const text = process.env.MASTODON_POST_TEXT
    ?? `Testing SalesVelocity.ai → Mastodon posting integration. ${new Date().toISOString()}`;
  const rawVisibility = (process.env.MASTODON_POST_VISIBILITY ?? 'public').toLowerCase();
  const allowedVis = ['public', 'unlisted', 'private', 'direct'] as const;
  type Vis = typeof allowedVis[number];
  const visibility = (allowedVis as readonly string[]).includes(rawVisibility)
    ? (rawVisibility as Vis)
    : 'public';

  console.log('[verify-mastodon-post] loading service config from Firestore...');
  const service = await createMastodonService();
  if (!service) {
    console.error('✗ Mastodon service not configured. Run scripts/connect-mastodon.ts first.');
    process.exit(1);
  }

  // Sanity-check the token is valid before posting (avoids posting empty/junk
  // if the token expired or was revoked).
  const profile = await service.getProfile();
  if (!profile) {
    console.error('✗ Mastodon profile fetch failed — token may be invalid or revoked.');
    process.exit(2);
  }
  console.log(`✓ Authenticated as @${profile.acct ?? profile.username} (${profile.followers_count ?? 0} followers)`);

  console.log(`\nPosting (${visibility}, ${text.length} chars):`);
  console.log(`  "${text}"`);
  console.log('');

  const result = await service.postStatus({ status: text, visibility });
  if (!result.success) {
    console.error(`✗ Post failed: ${result.error}`);
    process.exit(3);
  }

  console.log(`✓ Posted`);
  console.log(`  status id: ${result.postId}`);
  if (result.url) {
    console.log(`  view at:   ${result.url}`);
  }
  console.log(`\nThe post should be visible on the brand's profile within a few seconds.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
