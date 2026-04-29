/**
 * Live verify: end-to-end orchestrated Twitter/X post via the FULL product
 * path (Jasper plan → Marketing Manager → social_post → TwitterService).
 *
 * Replaces the old verify-twitter-post-live.ts as the canonical "X is LIVE"
 * test. The old script hand-built OAuth 1.0a HMAC headers and POSTed
 * directly to api.twitter.com/2/tweets — never touched TwitterService, the
 * social_post tool, the Marketing Manager, or Jasper. That bypass is the
 * trap that hid the X OAuth-flow bug for weeks despite "tests passing."
 *
 * Usage:
 *   npx tsx scripts/verify-twitter-orchestrated-post-live.ts
 *   npx tsx scripts/verify-twitter-orchestrated-post-live.ts --base-url=http://localhost:3000
 *   npx tsx scripts/verify-twitter-orchestrated-post-live.ts --text="custom test text"
 *
 * Real $ cost: 1 LLM call (TWITTER_X_EXPERT.generate_content) + 1 X tweet
 * (free under brand auto-reload, ~$0.05 if charged). Posts a real tweet to
 * @salesvelocityai — operator should expect to see it in the timeline.
 */

import { runVerify, arg } from './lib/orchestrated-social-verify';

const TEST_TEXT = arg(
  'text',
  'SalesVelocity.ai end-to-end Twitter verification — if you can see this, the orchestrated path is wired.',
);

runVerify({
  platformLabel: 'X/Twitter',
  acceptablePlatformArgs: ['x', 'twitter'],
  testText: TEST_TEXT,
  // Twitter API v2 returns { data: { id, text } }; social_post may unwrap.
  // Try several known shapes before failing.
  extractPublicUrl: (parsed) => {
    const id =
      (parsed.id as string | undefined) ??
      (parsed.tweetId as string | undefined) ??
      ((parsed.data as Record<string, unknown> | undefined)?.id as string | undefined) ??
      ((parsed.result as Record<string, unknown> | undefined)?.id as string | undefined);
    return id ? `https://x.com/salesvelocityai/status/${id}` : null;
  },
});
