/**
 * Live verify: post a real status to the brand's Mastodon account
 * (@SalesVelocity_Ai@mastodon.social or whichever instance the brand
 * is connected to) using the saved access token. The status appears
 * publicly on the brand's profile.
 *
 * Exercises:
 *   1. apiKeyService.getServiceKey('mastodon') reads the saved config
 *   2. createMastodonService() builds a configured service instance
 *   3. MastodonService.postStatus() POSTs to /api/v1/statuses
 *   4. Mastodon returns the new status id + URL
 *
 * Usage:
 *   $env:MASTODON_POST_TEXT="Custom text"  # optional
 *   $env:MASTODON_POST_VISIBILITY="public" # optional: public | unlisted | private
 *   npx tsx scripts/verify-mastodon-post-live.ts
 *
 * Defaults to a clearly-test status visible publicly. Override via env.
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
