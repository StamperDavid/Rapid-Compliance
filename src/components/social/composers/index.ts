/**
 * Per-platform native composers + the shared <PlatformComposer> dispatcher.
 *
 * Each composer is a controlled component (value/onChange/disabled) that
 * renders the platform-native UX for its form fields. The wrapper owns
 * shared state (form state, media uploader, connection check, action row).
 */

export { PlatformComposer } from './PlatformComposer';
export type { ComposerFormState, PlatformComposerFormProps } from './PlatformComposer';

export { TwitterComposer } from './TwitterComposer';
export { LinkedInComposer } from './LinkedInComposer';
export { FacebookComposer } from './FacebookComposer';
export { InstagramComposer } from './InstagramComposer';
export { YouTubeComposer } from './YouTubeComposer';
export { TikTokComposer } from './TikTokComposer';
export { PinterestComposer } from './PinterestComposer';
export { BlueskyComposer } from './BlueskyComposer';
export { MastodonComposer } from './MastodonComposer';
export { ThreadsComposer } from './ThreadsComposer';
export { TelegramComposer } from './TelegramComposer';
export { RedditComposer } from './RedditComposer';
export { WhatsAppBusinessComposer } from './WhatsAppBusinessComposer';
export { GoogleBusinessComposer } from './GoogleBusinessComposer';
export { TruthSocialComposer } from './TruthSocialComposer';

export { useCharCountdownColor, countHashtags, splitThread } from './_utils';
