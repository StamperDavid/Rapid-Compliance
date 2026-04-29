/**
 * Live verify: end-to-end orchestrated Bluesky post via the FULL product
 * path (Jasper plan → Marketing Manager → social_post → BlueskyService).
 *
 * Replaces the old verify-bluesky-post-live.ts as the canonical "Bluesky is
 * LIVE" test. The old script hand-built a session and POSTed directly to
 * xrpc/com.atproto.repo.createRecord — same bypass shape that hid the X
 * OAuth bug. This one drives the actual product path.
 *
 * Usage:
 *   npx tsx scripts/verify-bluesky-orchestrated-post-live.ts
 *   npx tsx scripts/verify-bluesky-orchestrated-post-live.ts --base-url=http://localhost:3000
 *   npx tsx scripts/verify-bluesky-orchestrated-post-live.ts --text="custom test text"
 *
 * Real $ cost: 1 LLM call (BLUESKY_EXPERT.generate_content) + 1 free Bluesky
 * post. Posts a real post to @salesvelocity.bsky.social.
 */

import { runVerify, arg } from './lib/orchestrated-social-verify';

const TEST_TEXT = arg(
  'text',
  'SalesVelocity.ai end-to-end Bluesky verification — if you can see this, the orchestrated path is wired.',
);

runVerify({
  platformLabel: 'Bluesky',
  acceptablePlatformArgs: ['bluesky'],
  testText: TEST_TEXT,
  // BlueskyService.createPost returns { uri, cid } where uri looks like
  // "at://did:plc:.../app.bsky.feed.post/<rkey>". The public URL is built
  // by combining the brand handle with the rkey.
  extractPublicUrl: (parsed) => {
    const uri =
      (parsed.uri as string | undefined) ??
      ((parsed.data as Record<string, unknown> | undefined)?.uri as string | undefined) ??
      ((parsed.result as Record<string, unknown> | undefined)?.uri as string | undefined);
    if (!uri) { return null; }
    const rkey = uri.split('/').pop();
    if (!rkey) { return null; }
    return `https://bsky.app/profile/salesvelocity.bsky.social/post/${rkey}`;
  },
});
