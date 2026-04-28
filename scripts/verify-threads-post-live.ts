/**
 * Live verify: post a real text Thread to the brand's Threads account
 * using the saved Meta access token.
 *
 * Exercises:
 *   1. apiKeyService.getServiceKey('threads') reads the saved config
 *   2. createThreadsService() builds a configured service instance
 *   3. ThreadsService.publishPost() — two-step container + publish flow
 *   4. Threads returns the new post id
 *
 * WARNING: This script creates a REAL post on the live brand account.
 * The post will be visible publicly. After running, MANUALLY DELETE the
 * post from the platform — pinned/timeline pollution looks unprofessional.
 * Run from D:\Future Rapid Compliance: npx tsx scripts/verify-threads-post-live.ts
 *
 * Usage:
 *   npx tsx scripts/verify-threads-post-live.ts
 *   npx tsx scripts/verify-threads-post-live.ts --text "Custom text"
 */

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { createThreadsService } from '@/lib/integrations/threads-service';

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i > 0 && process.argv[i + 1]) { return process.argv[i + 1]; }
  return undefined;
}

async function main(): Promise<void> {
  const text = getArg('--text')
    ?? `[SalesVelocity.ai pipeline test ${new Date().toISOString()}] If you can read this, the Threads posting path is wired end-to-end.`;

  console.log('[verify-threads-post] loading service config from Firestore...');
  const service = await createThreadsService();
  if (!service) {
    console.error('FAIL — Threads service not configured. Save credentials via the integrations UI first.');
    process.exit(1);
  }

  // Sanity-check the token is valid before posting.
  const profile = await service.getProfile();
  if (!profile) {
    console.error('FAIL — Threads profile fetch failed. Token may be invalid or expired.');
    process.exit(2);
  }
  console.log(`Authenticated as @${profile.username ?? profile.id} (${profile.name ?? 'no display name'})`);

  console.log(`\nPublishing text Thread (${text.length} chars):`);
  console.log(`  "${text}"`);
  console.log('');

  const result = await service.publishPost({ text, mediaType: 'TEXT' });

  if (!result.success) {
    console.error(`FAIL — publish rejected: ${result.error}`);
    process.exit(3);
  }

  console.log('PASS — Thread published');
  console.log(`  post id:    ${result.postId ?? '(none)'}`);
  if (profile.username && result.postId) {
    // Threads URL convention: https://www.threads.net/@<username>/post/<shortcode>
    // The Graph API returns a numeric ID, not a shortcode, so we can only
    // surface the profile URL — the operator can find the latest post there.
    console.log(`  profile:    https://www.threads.net/@${profile.username}`);
  }
  console.log('\nRemember to manually delete this post from Threads when done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
