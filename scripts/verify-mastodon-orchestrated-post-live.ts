/**
 * Live verify: end-to-end orchestrated Mastodon post via the FULL product
 * path (Jasper plan → Marketing Manager → social_post → MastodonService).
 *
 * Replaces the old script at this filename, which only tested the manager
 * fast-path and explicitly did NOT publish to mastodon.social — that
 * dishonestly-named "orchestrated post" verify masked the same kind of gap
 * that hid today's X OAuth bug. The old script lives on at
 * `verify-mastodon-marketing-manager-fastpath.ts` for the manager-chain
 * coverage it does provide.
 *
 * This new script drives the actual full path through Jasper, including
 * the publish step. Pass = real status lands on mastodon.social/@SalesVelocity_Ai.
 *
 * Usage:
 *   npx tsx scripts/verify-mastodon-orchestrated-post-live.ts
 *   npx tsx scripts/verify-mastodon-orchestrated-post-live.ts --base-url=http://localhost:3000
 *   npx tsx scripts/verify-mastodon-orchestrated-post-live.ts --text="custom test text"
 *
 * Real $ cost: 1 LLM call (MASTODON_EXPERT.generate_content) + 1 free
 * Mastodon status. Posts a real status to @SalesVelocity_Ai on mastodon.social.
 */

import { runVerify, arg } from './lib/orchestrated-social-verify';

const TEST_TEXT = arg(
  'text',
  'SalesVelocity.ai end-to-end Mastodon verification — if you can see this, the orchestrated path is wired.',
);

runVerify({
  platformLabel: 'Mastodon',
  acceptablePlatformArgs: ['mastodon'],
  testText: TEST_TEXT,
  // MastodonService.postStatus returns the full Mastodon Status object,
  // which has both .id (numeric/string) and .url (canonical public URL).
  // Prefer .url since it's already absolute and platform-correct (handles
  // mastodon.social vs other instances). Fall back to constructing from .id.
  extractPublicUrl: (parsed) => {
    // social_post tool returns { platformActionId } = Mastodon status ID.
    // Status URL = https://{instance}/@{handle}/{statusId}
    const directUrl =
      (parsed.url as string | undefined) ??
      ((parsed.data as Record<string, unknown> | undefined)?.url as string | undefined);
    if (typeof directUrl === 'string' && directUrl.startsWith('https://')) {
      return directUrl;
    }
    const id =
      (parsed.platformActionId as string | undefined) ??
      (parsed.id as string | undefined) ??
      ((parsed.data as Record<string, unknown> | undefined)?.id as string | undefined);
    return id ? `https://mastodon.social/@SalesVelocity_Ai/${id}` : null;
  },
});
