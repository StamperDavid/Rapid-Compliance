/**
 * Social Media Types
 * Type definitions for Twitter/X, LinkedIn, and social media posting
 */

// =============================================================================
// Twitter/X Types (API v2)
// =============================================================================

export interface TwitterConfig {
  clientId: string;
  clientSecret: string;
  accessToken?: string;
  refreshToken?: string;
  bearerToken?: string;
}

export interface TwitterUser {
  id: string;
  name: string;
  username: string;
  description?: string;
  profileImageUrl?: string;
  verified?: boolean;
  publicMetrics?: {
    followersCount: number;
    followingCount: number;
    tweetCount: number;
    listedCount: number;
  };
}

export interface TwitterTweet {
  id: string;
  text: string;
  authorId: string;
  createdAt: string;
  conversationId?: string;
  inReplyToUserId?: string;
  publicMetrics?: {
    retweetCount: number;
    replyCount: number;
    likeCount: number;
    quoteCount: number;
    impressionCount?: number;
  };
  entities?: TwitterEntities;
  attachments?: TwitterAttachments;
}

export interface TwitterEntities {
  urls?: Array<{
    start: number;
    end: number;
    url: string;
    expandedUrl: string;
    displayUrl: string;
  }>;
  mentions?: Array<{
    start: number;
    end: number;
    username: string;
    id: string;
  }>;
  hashtags?: Array<{
    start: number;
    end: number;
    tag: string;
  }>;
  cashtags?: Array<{
    start: number;
    end: number;
    tag: string;
  }>;
}

export interface TwitterAttachments {
  mediaKeys?: string[];
  pollIds?: string[];
}

export interface TwitterMedia {
  mediaId: string;
  type: 'photo' | 'video' | 'animated_gif';
  url?: string;
  previewImageUrl?: string;
  altText?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export interface TwitterPoll {
  id: string;
  options: Array<{
    position: number;
    label: string;
    votes: number;
  }>;
  durationMinutes: number;
  endDatetime: string;
  votingStatus: 'open' | 'closed';
}

export interface TwitterPostRequest {
  text: string;
  mediaIds?: string[];
  pollOptions?: string[];
  pollDurationMinutes?: number;
  replyToTweetId?: string;
  quoteTweetId?: string;
  forSuperFollowersOnly?: boolean;
}

export interface TwitterPostResponse {
  success: boolean;
  tweetId?: string;
  text?: string;
  error?: string;
  errorCode?: string;
  rateLimitRemaining?: number;
  rateLimitReset?: Date;
}

export interface TwitterScheduleRequest extends TwitterPostRequest {
  scheduledTime: Date;
}

export interface TwitterTimelineResponse {
  tweets: TwitterTweet[];
  meta?: {
    resultCount: number;
    newestId?: string;
    oldestId?: string;
    nextToken?: string;
    previousToken?: string;
  };
}

export interface TwitterRateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  endpoint: string;
}

// =============================================================================
// LinkedIn Types
// =============================================================================

export interface LinkedInConfig {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  personId?: string;
}

export interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  headline?: string;
  profilePictureUrl?: string;
  vanityName?: string;
}

export interface LinkedInPost {
  id: string;
  author: string;
  text: string;
  visibility: 'PUBLIC' | 'CONNECTIONS' | 'LOGGED_IN';
  createdAt: string;
  media?: LinkedInMedia[];
  metrics?: {
    impressions: number;
    clicks: number;
    likes: number;
    comments: number;
    shares: number;
  };
}

export interface LinkedInMedia {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'ARTICLE' | 'DOCUMENT';
  url?: string;
  title?: string;
  description?: string;
}

export interface LinkedInPostRequest {
  text: string;
  visibility?: 'PUBLIC' | 'CONNECTIONS' | 'LOGGED_IN';
  mediaUrls?: string[];
  articleUrl?: string;
  articleTitle?: string;
  articleDescription?: string;
}

export interface LinkedInPostResponse {
  success: boolean;
  postId?: string;
  error?: string;
}

// =============================================================================
// Common Social Media Types
// =============================================================================

export type SocialPlatform = 'twitter' | 'linkedin';

export type PostStatus =
  | 'draft'
  | 'scheduled'
  | 'queued'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

export interface SocialMediaPost {
  id: string;
  platform: SocialPlatform;
  content: string;
  mediaUrls?: string[];
  status: PostStatus;
  scheduledAt?: Date;
  publishedAt?: Date;
  platformPostId?: string;
  metrics?: PostMetrics;
  error?: string;
  retryCount?: number;
  maxRetries?: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PostMetrics {
  impressions?: number;
  engagements?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  reach?: number;
}

export interface ScheduledPost extends SocialMediaPost {
  status: 'scheduled';
  scheduledAt: Date;
}

export interface QueuedPost extends SocialMediaPost {
  status: 'queued';
  queuePosition: number;
  preferredTimeSlot?: string; // e.g., 'morning', 'afternoon', 'evening'
}

export interface PostQueue {
  id: string;
  platform: SocialPlatform;
  posts: QueuedPost[];
  settings: QueueSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueueSettings {
  enabled: boolean;
  postsPerDay: number;
  preferredTimes: string[]; // ISO time strings like "09:00", "14:00", "18:00"
  timezone: string;
  pauseOnWeekends: boolean;
  randomizeOrder: boolean;
}

// =============================================================================
// Autonomous Posting Agent Types
// =============================================================================

export interface PostingAgentConfig {
  platforms: SocialPlatform[];
  contentSources: ContentSource[];
  schedule: PostingSchedule;
  approvalRequired: boolean;
  autoHashtags: boolean;
  maxDailyPosts: number;
}

export interface ContentSource {
  type: 'blog' | 'product' | 'news' | 'custom' | 'ai_generated';
  sourceId?: string;
  enabled: boolean;
  priority: number;
}

export interface PostingSchedule {
  timezone: string;
  slots: TimeSlot[];
  blackoutDates?: string[]; // ISO date strings
  enableWeekends: boolean;
}

export interface TimeSlot {
  dayOfWeek: number; // 0-6, where 0 is Sunday
  hour: number; // 0-23
  minute: number; // 0-59
  platforms: SocialPlatform[];
}

export interface GeneratedContent {
  id: string;
  sourceType: ContentSource['type'];
  sourceId?: string;
  title?: string;
  content: string;
  hashtags?: string[];
  suggestedPlatforms: SocialPlatform[];
  generatedAt: Date;
  metadata?: Record<string, unknown>;
}

export interface PostingResult {
  success: boolean;
  platform: SocialPlatform;
  postId?: string;
  platformPostId?: string;
  publishedAt?: Date;
  error?: string;
  rateLimited?: boolean;
  nextRetryAt?: Date;
}

export interface BatchPostingResult {
  results: PostingResult[];
  successCount: number;
  failureCount: number;
  timestamp: Date;
}

// =============================================================================
// Social Media Integration Status
// =============================================================================

export interface SocialIntegrationStatus {
  platform: SocialPlatform;
  connected: boolean;
  accountName?: string;
  accountId?: string;
  lastSyncAt?: Date;
  tokenExpiresAt?: Date;
  error?: string;
  capabilities: SocialCapability[];
}

export type SocialCapability =
  | 'post'
  | 'schedule'
  | 'analytics'
  | 'reply'
  | 'dm'
  | 'media_upload';

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface CreatePostRequest {
  platform: SocialPlatform;
  content: string;
  mediaUrls?: string[];
  scheduledAt?: string; // ISO date string
  immediate?: boolean;
}

export interface CreatePostResponse {
  success: boolean;
  post?: SocialMediaPost;
  error?: string;
}

export interface GetQueueRequest {
  platform?: SocialPlatform;
  status?: PostStatus;
  limit?: number;
  offset?: number;
}

export interface GetQueueResponse {
  posts: SocialMediaPost[];
  total: number;
  hasMore: boolean;
}

export interface SchedulePostRequest {
  postId: string;
  scheduledAt: string; // ISO date string
}

export interface SchedulePostResponse {
  success: boolean;
  post?: SocialMediaPost;
  error?: string;
}

export interface CancelPostRequest {
  postId: string;
}

export interface CancelPostResponse {
  success: boolean;
  error?: string;
}
