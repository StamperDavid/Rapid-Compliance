/**
 * Re-exports for the platform PostPreview components.
 *
 * Each component renders a platform-themed preview of a SocialMediaPost.
 * See `_utils.ts` for shared helpers.
 *
 * NOTE: This file is built by three parallel batches. Each batch owns its
 * own re-export lines and must not delete the others. Add a new export when
 * a new platform component lands.
 */

// Batch A — Twitter, LinkedIn, Facebook, Instagram
// (owned by Batch A; do not edit from another batch)
export { TwitterPostPreview } from './TwitterPostPreview';
export { LinkedInPostPreview } from './LinkedInPostPreview';
export { FacebookPostPreview } from './FacebookPostPreview';
export { InstagramPostPreview } from './InstagramPostPreview';

// Shared utilities (Batch A owns this re-export; safe to import from any batch)
export { formatCount, formatRelativeTime, getInitial } from './_utils';

// Batch B — YouTube, TikTok, Pinterest, Bluesky, Mastodon
export { YouTubePostPreview } from './YouTubePostPreview';
export { TikTokPostPreview } from './TikTokPostPreview';
export { PinterestPostPreview } from './PinterestPostPreview';
export { BlueskyPostPreview } from './BlueskyPostPreview';
export { MastodonPostPreview } from './MastodonPostPreview';

// Batch C — Threads, Telegram, Reddit, WhatsApp Business, Google Business, Truth Social
// (owned by Batch C; do not edit from another batch)
export { ThreadsPostPreview } from './ThreadsPostPreview';
export { TelegramPostPreview } from './TelegramPostPreview';
export { RedditPostPreview } from './RedditPostPreview';
export { WhatsAppBusinessPostPreview } from './WhatsAppBusinessPostPreview';
export { GoogleBusinessPostPreview } from './GoogleBusinessPostPreview';
export { TruthSocialPostPreview } from './TruthSocialPostPreview';

// Creator-track (Apr 28 2026) — Discord, Twitch
export { DiscordPostPreview } from './DiscordPostPreview';
export { TwitchPostPreview } from './TwitchPostPreview';
