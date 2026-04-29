/**
 * CREDENTIAL SMOKE TEST — direct service call, NOT product-path verification.
 *
 * What this DOES test:
 *   - Reddit's /api/submit endpoint accepts our saved OAuth credentials
 *     from apiKeyService.getServiceKey('reddit')
 *   - RedditService.submitPost() constructs a valid request and returns
 *     the new post id + URL
 *
 * What this does NOT test:
 *   - The product path through Jasper → SocialMediaManager → RedditExpert
 *     → social_post tool → Mission Control
 *   - Whether RedditExpert.execute() (the function the orchestrator actually
 *     calls) handles the response correctly. This script bypasses it entirely.
 *
 * Renamed Apr 29 2026 from `verify-reddit-post-live.ts` because the old name
 * implied end-to-end coverage. NOTE: Reddit is marked for deletion
 * (commercial API blocked per project decision). No orchestrated product-path
 * verify exists or will be built.
 *
 * Real product path: KNOWN GAP — Reddit marked for deletion, no orchestrated verify.
 */

/* eslint-disable no-console */

import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
loadEnv();
import { createRedditService } from '@/lib/integrations/reddit-service';

function getArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i > 0 && process.argv[i + 1]) { return process.argv[i + 1]; }
  return undefined;
}

async function main(): Promise<void> {
  const timestamp = new Date().toISOString();
  const subreddit = getArg('--subreddit') ?? 'test';
  const title = getArg('--title')
    ?? `[SalesVelocity.ai pipeline test ${timestamp}]`;
  const text = getArg('--text')
    ?? `[SalesVelocity.ai pipeline test ${timestamp}] If you can read this, the Reddit posting path is wired end-to-end.`;

  console.log('[verify-reddit-post] loading service config from Firestore...');
  const service = await createRedditService();
  if (!service) {
    console.error('FAIL — Reddit service not configured. Save credentials via the integrations UI first.');
    process.exit(1);
  }

  // Sanity-check the token is valid before posting.
  const identity = await service.getIdentity();
  if (!identity) {
    console.error('FAIL — Reddit identity fetch failed. Token may be invalid or revoked.');
    process.exit(2);
  }
  console.log(`Authenticated as u/${identity.name} (link karma ${identity.link_karma}, comment karma ${identity.comment_karma})`);

  console.log(`\nSubmitting self-post to r/${subreddit}:`);
  console.log(`  title: ${title}`);
  console.log(`  text:  ${text}`);
  console.log('');

  const result = await service.submitPost({ subreddit, title, text, kind: 'self' });

  if (!result.success) {
    console.error(`FAIL — submit rejected: ${result.error}`);
    process.exit(3);
  }

  console.log('PASS — post created');
  console.log(`  post id:    ${result.postId ?? '(none)'}`);
  if (result.postUrl) {
    console.log(`  public url: ${result.postUrl}`);
  } else {
    console.log(`  public url: (Reddit did not return a URL — check r/${subreddit} for the post)`);
  }
  console.log('\nRemember to manually delete this post from Reddit when done.');
}

main().catch((err) => { console.error(err); process.exit(1); });
