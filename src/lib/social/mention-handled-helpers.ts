/**
 * Mention-handled helpers
 *
 * Shared utility used by every mention-inbox API route to derive a stable,
 * URL-safe Firestore document id from a (platform, mentionId) pair.
 *
 * Why a helper module:
 *   - Twitter mention ids are pure numerics ("18103937…").
 *   - Bluesky mention ids are AT-protocol URIs ("at://did:plc:.../app.bsky.feed.post/3kxyz")
 *     which contain `:` and `/` — both ILLEGAL in Firestore document ids.
 *   - Mastodon notification ids are short numerics, but they collide across
 *     instances. Prefixing with the platform key (always 'mastodon' here,
 *     since one tenant connects to one Mastodon instance) prevents future
 *     collisions if multi-instance support ever lands.
 *
 * The base64url encoding strips `/`, `+`, `=` and is reversible — we never
 * need to decode it (the doc id is opaque, only `exists`-checked) but
 * keeping the encoding reversible avoids surprises if a future migration
 * needs to walk the collection.
 */

import type { SocialPlatform } from '@/types/social';

/** Encode an arbitrary string to base64url (RFC 4648 §5). */
function base64url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

/**
 * Returns the Firestore document id for a (platform, mentionId) pair under
 * the `handledMentions` collection. Format: `{platform}__{base64url(id)}`.
 *
 * The double-underscore separator is intentional: it can never appear inside
 * a base64url-encoded string, so `split('__', 1)` will always recover the
 * platform safely if a future migration needs to.
 */
export function mentionDocId(platform: SocialPlatform, mentionId: string): string {
  return `${platform}__${base64url(mentionId)}`;
}
