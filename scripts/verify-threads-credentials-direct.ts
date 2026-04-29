/**
 * CREDENTIAL SMOKE TEST — direct service call, NOT product-path verification.
 *
 * What this DOES test:
 *   - Threads' two-step container + publish API accepts our saved Meta access
 *     token from apiKeyService.getServiceKey('threads')
 *   - ThreadsService.publishPost() completes the container/publish flow and
 *     returns the new post id
 *
 * What this does NOT test:
 *   - The product path through Jasper → SocialMediaManager → ThreadsExpert
 *     → social_post tool → Mission Control
 *   - Whether ThreadsExpert.execute() (the function the orchestrator actually
 *     calls) handles the response correctly. This script bypasses it entirely.
 *
 * Renamed Apr 29 2026 from `verify-threads-post-live.ts` because the old name
 * implied end-to-end coverage. No orchestrated Threads product-path verify
 * exists yet — that is a KNOWN GAP.
 *
 * Real product path: KNOWN GAP — no `verify-threads-orchestrated-post-live.ts` yet.
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
