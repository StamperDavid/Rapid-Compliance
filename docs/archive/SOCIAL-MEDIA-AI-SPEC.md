# Social Media AI Module - Technical Specification

**Version:** 1.0
**Date:** 2026-01-12
**Author:** SOCIAL-IMPLEMENTER
**Status:** Design Phase

---

## Executive Summary

This document defines the technical architecture for the Social Media AI module, a new component that will integrate LinkedIn and X (Twitter) posting capabilities into the AI Sales Platform. The module will leverage the existing AI content generation system, workflow automation, and scheduling infrastructure to enable automated, intelligent social media publishing.

**Current State:** No social media implementation exists. Only type definitions for platform icons in website builder.

**Deliverable:** Production-ready module architecture with OAuth 2.0 authentication, content generation, scheduling, and analytics.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [API Research & Authentication](#2-api-research--authentication)
3. [Module Structure](#3-module-structure)
4. [TypeScript Interface Definitions](#4-typescript-interface-definitions)
5. [Integration Points](#5-integration-points)
6. [Workflow Action Types](#6-workflow-action-types)
7. [Database Schema](#7-database-schema)
8. [Security Considerations](#8-security-considerations)
9. [Implementation Phases](#9-implementation-phases)

---

## 1. Architecture Overview

### 1.1 System Context

The Social Media AI module integrates into the existing platform architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                    AI SALES PLATFORM                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐      ┌──────────────┐                   │
│  │  Email Writer│◄────►│  AI Service  │                   │
│  │   Engine     │      │  (Unified)   │                   │
│  └──────────────┘      └──────────────┘                   │
│         ▲                      ▲                            │
│         │                      │                            │
│         ▼                      ▼                            │
│  ┌──────────────────────────────────────┐                  │
│  │   SOCIAL MEDIA AI MODULE (NEW)       │                  │
│  ├──────────────────────────────────────┤                  │
│  │  - Content Generator                 │                  │
│  │  - LinkedIn Publisher                │                  │
│  │  - Twitter Publisher                 │                  │
│  │  - Scheduler                         │                  │
│  │  - Analytics                         │                  │
│  └──────────────────────────────────────┘                  │
│         ▲                      ▲                            │
│         │                      │                            │
│  ┌──────┴──────┐      ┌───────┴──────┐                    │
│  │  Workflow   │      │  Scheduled   │                     │
│  │  Engine     │      │  Publisher   │                     │
│  └─────────────┘      └──────────────┘                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
         │                      │
         ▼                      ▼
┌─────────────────────────────────────────┐
│       EXTERNAL APIS                     │
├─────────────────────────────────────────┤
│  LinkedIn Posts API      X API v2       │
│  (OAuth 2.0)             (OAuth 2.0)    │
└─────────────────────────────────────────┘
```

### 1.2 Core Principles

1. **Leverage Existing Infrastructure:** Reuse `scheduled-publisher.ts`, `email-writer-engine.ts`, and `unified-ai-service.ts`
2. **Multi-Tenant Safe:** All operations scoped by `organizationId` and `workspaceId`
3. **Type-Safe:** Full TypeScript interfaces with zero `any` types
4. **Workflow Native:** Deep integration with existing workflow automation system
5. **Signal Bus Integration:** Emit signals for all social media events
6. **OAuth 2.0 Compliant:** Follow platform OAuth standards for LinkedIn and X

---

## 2. API Research & Authentication

### 2.1 LinkedIn Posts API

#### 2.1.1 OAuth 2.0 Flow

**Reference:** [LinkedIn Authentication Documentation](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication)

**Authorization Flow:** 3-legged OAuth (Member Authorization)

**Required Scopes:**
- `w_member_social` - Post, comment, and like posts on behalf of member (personal profiles)
- `w_organization_social` - Post on behalf of organization (company pages)

**Endpoints:**

1. **Authorization URL:**
   ```
   https://www.linkedin.com/oauth/v2/authorization
   ```

   Parameters:
   - `response_type=code`
   - `client_id={YOUR_CLIENT_ID}`
   - `redirect_uri={YOUR_REDIRECT_URI}`
   - `state={RANDOM_STRING}`
   - `scope=w_member_social w_organization_social`

2. **Token Exchange URL:**
   ```
   https://www.linkedin.com/oauth/v2/accessToken
   ```

   Parameters:
   - `grant_type=authorization_code`
   - `code={AUTH_CODE}`
   - `client_id={YOUR_CLIENT_ID}`
   - `client_secret={YOUR_CLIENT_SECRET}`
   - `redirect_uri={YOUR_REDIRECT_URI}`

3. **Refresh Token URL:**
   ```
   https://www.linkedin.com/oauth/v2/accessToken
   ```

   Parameters:
   - `grant_type=refresh_token`
   - `refresh_token={REFRESH_TOKEN}`
   - `client_id={YOUR_CLIENT_ID}`
   - `client_secret={YOUR_CLIENT_SECRET}`

**Token Lifetime:**
- Access Token: 60 days
- Refresh Token: 1 year

#### 2.1.2 Posts API

**Reference:** [LinkedIn Posts API Documentation](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2025-11)

**Endpoint:**
```
POST https://api.linkedin.com/rest/posts
```

**Required Headers:**
- `Authorization: Bearer {ACCESS_TOKEN}`
- `X-Restli-Protocol-Version: 2.0.0`
- `LinkedIn-Version: 202511` (YYYYMM format)
- `Content-Type: application/json`

**Request Body Structure:**
```json
{
  "author": "urn:li:person:{PERSON_ID}",
  "commentary": "Post text content here",
  "visibility": "PUBLIC",
  "distribution": {
    "feedDistribution": "MAIN_FEED",
    "targetEntities": [],
    "thirdPartyDistributionChannels": []
  },
  "lifecycleState": "PUBLISHED",
  "isReshareDisabledByAuthor": false
}
```

**Important Limitations:**
- **No native scheduling** - Posts are published immediately when `lifecycleState: "PUBLISHED"`
- Scheduling must be implemented application-side
- Maximum post length: 3000 characters
- Supports text, images, videos, articles, polls

#### 2.1.3 Company Page Posting

**Author URN Format:** `urn:li:organization:{ORGANIZATION_ID}`

**Additional Requirements:**
- Must have admin access to company page
- Separate scope: `w_organization_social`
- Get organization ID via `/v2/organizationalEntityAcls` endpoint

### 2.2 X (Twitter) API v2

#### 2.2.1 OAuth 2.0 Flow

**Reference:** [X API Documentation](https://developer.twitter.com/en/docs/twitter-api)

**Authorization Flow:** OAuth 2.0 Authorization Code Flow with PKCE

**Required Scopes:**
- `tweet.read` - Read tweets
- `tweet.write` - Create and delete tweets
- `users.read` - Read user profile information
- `offline.access` - Get refresh token

**Endpoints:**

1. **Authorization URL:**
   ```
   https://twitter.com/i/oauth2/authorize
   ```

   Parameters:
   - `response_type=code`
   - `client_id={YOUR_CLIENT_ID}`
   - `redirect_uri={YOUR_REDIRECT_URI}`
   - `scope=tweet.read tweet.write users.read offline.access`
   - `state={RANDOM_STRING}`
   - `code_challenge={CODE_CHALLENGE}`
   - `code_challenge_method=S256`

2. **Token Exchange URL:**
   ```
   https://api.twitter.com/2/oauth2/token
   ```

   Parameters:
   - `grant_type=authorization_code`
   - `code={AUTH_CODE}`
   - `redirect_uri={YOUR_REDIRECT_URI}`
   - `code_verifier={CODE_VERIFIER}`
   - `client_id={YOUR_CLIENT_ID}`

3. **Refresh Token URL:**
   ```
   https://api.twitter.com/2/oauth2/token
   ```

   Parameters:
   - `grant_type=refresh_token`
   - `refresh_token={REFRESH_TOKEN}`
   - `client_id={YOUR_CLIENT_ID}`

**Token Lifetime:**
- Access Token: 2 hours
- Refresh Token: Indefinite (until revoked)

**Note:** OAuth 1.0a is also supported but OAuth 2.0 is recommended for new implementations.

#### 2.2.2 Create Tweet API

**Reference:** [X Create Post Documentation](https://docs.x.com/x-api/posts/create-post)

**Endpoint:**
```
POST https://api.x.com/2/tweets
```

**Required Headers:**
- `Authorization: Bearer {ACCESS_TOKEN}`
- `Content-Type: application/json`

**Request Body Structure:**
```json
{
  "text": "Tweet content here",
  "reply_settings": "everyone",
  "for_super_followers_only": false
}
```

**Important Limitations:**
- **No native scheduling** - Must implement application-side scheduling
- Maximum tweet length: 280 characters (standard), 25,000 characters (Premium)
- Media attachments require separate upload endpoint
- Rate limits apply (varies by subscription tier)

**Extended Features:**
- Media uploads: `/2/media/upload`
- Thread support: `reply` parameter
- Quote tweets: `quote_tweet_id` parameter
- Polls: `poll` parameter

#### 2.2.3 Rate Limits

**Free Tier:**
- 1,500 tweets per month
- 50 tweets per 24 hours

**Basic Tier ($100/month):**
- 3,000 tweets per month
- 100 tweets per 24 hours

**Pro Tier ($5,000/month):**
- 300,000 tweets per month
- 10,000 tweets per 24 hours

### 2.3 Authentication Architecture

Both platforms require:

1. **OAuth 2.0 Authorization Code Flow**
2. **Token Storage** (access token + refresh token)
3. **Token Refresh Logic** (before expiration)
4. **Multi-Tenant Isolation** (tokens per organization)

**Reuse Existing Infrastructure:**
- Leverage `src/lib/integrations/oauth-service.ts` pattern
- Store tokens in `ORGANIZATIONS/{orgId}/integrations` collection
- Use `api-key-service.ts` for secure credential management

---

## 3. Module Structure

### 3.1 Directory Layout

```
src/lib/social/
├── index.ts                      # Public exports
├── types.ts                      # TypeScript interfaces
├── linkedin-publisher.ts         # LinkedIn Posts API client
├── twitter-publisher.ts          # X API v2 client
├── content-scheduler.ts          # Scheduling logic
├── social-analytics.ts           # Engagement metrics tracking
├── ai-content-generator.ts       # AI-powered content creation
├── oauth-handlers.ts             # OAuth 2.0 flows for LinkedIn/X
└── token-manager.ts              # Token refresh and storage
```

### 3.2 File Responsibilities

#### 3.2.1 `index.ts`
- Public API exports
- Module initialization
- Error handling types

#### 3.2.2 `types.ts`
- TypeScript interfaces for all social media entities
- Platform-agnostic types
- Integration with existing workflow types

#### 3.2.3 `linkedin-publisher.ts`
- LinkedIn Posts API client implementation
- Personal profile and company page posting
- Media upload handling
- Error handling and retry logic

#### 3.2.4 `twitter-publisher.ts`
- X API v2 client implementation
- Tweet creation and deletion
- Thread support
- Media upload handling
- Rate limit management

#### 3.2.5 `content-scheduler.ts`
- Queue management for scheduled posts
- Integration with existing `scheduled-publisher.ts`
- Retry logic for failed posts
- Timezone handling

#### 3.2.6 `social-analytics.ts`
- Engagement metrics collection
- Post performance tracking
- Signal Bus integration
- Dashboard data aggregation

#### 3.2.7 `ai-content-generator.ts`
- AI-powered social media content generation
- Integration with `unified-ai-service.ts`
- Platform-specific optimization (LinkedIn long-form, Twitter brevity)
- Hashtag generation
- Tone and style customization

#### 3.2.8 `oauth-handlers.ts`
- OAuth 2.0 authorization flow implementation
- State management for OAuth callbacks
- PKCE implementation for X API
- Integration with existing `oauth-service.ts`

#### 3.2.9 `token-manager.ts`
- Token storage and retrieval
- Automatic token refresh before expiration
- Multi-tenant token isolation
- Token revocation handling

---

## 4. TypeScript Interface Definitions

### 4.1 Core Types

```typescript
/**
 * Social Media Platform Enum
 */
export type SocialPlatform = 'linkedin' | 'twitter';

/**
 * Post Visibility Settings
 */
export type PostVisibility = 'public' | 'connections' | 'private';

/**
 * Post Status
 */
export type PostStatus =
  | 'draft'           // Not yet scheduled
  | 'scheduled'       // Queued for future publishing
  | 'publishing'      // Currently being published
  | 'published'       // Successfully published
  | 'failed'          // Publishing failed
  | 'cancelled';      // Scheduled post cancelled

/**
 * Platform-Agnostic Social Post
 *
 * Core interface that abstracts platform differences
 */
export interface SocialPost {
  id: string;
  organizationId: string;
  workspaceId: string;

  // Platform info
  platform: SocialPlatform;

  // Content
  content: string;
  mediaUrls?: string[];           // Image/video URLs
  linkUrl?: string;               // External link to share

  // Metadata
  visibility: PostVisibility;
  hashtags?: string[];
  mentions?: string[];            // @mentions

  // Scheduling
  status: PostStatus;
  scheduledFor?: string;          // ISO timestamp
  publishedAt?: string;           // ISO timestamp

  // Author info
  authorType: 'user' | 'organization';
  authorId: string;               // LinkedIn person/org URN or Twitter user ID
  createdBy: string;              // User ID who created the post

  // AI generation context
  generatedByAI: boolean;
  aiPrompt?: string;
  aiModel?: string;

  // Metadata
  createdAt: string;              // ISO timestamp
  updatedAt: string;              // ISO timestamp

  // Platform-specific data
  platformData?: LinkedInPostData | TwitterPostData;
}

/**
 * LinkedIn-Specific Post Data
 */
export interface LinkedInPostData {
  urn?: string;                   // LinkedIn post URN (after publishing)
  distribution: {
    feedDistribution: 'MAIN_FEED' | 'NONE';
    targetEntities?: string[];    // URNs of specific audiences
  };
  isReshareDisabledByAuthor: boolean;
  articleUrl?: string;            // LinkedIn article link
  pollOptions?: string[];         // Poll options (if poll)
}

/**
 * Twitter-Specific Post Data
 */
export interface TwitterPostData {
  tweetId?: string;               // Tweet ID (after publishing)
  inReplyToTweetId?: string;      // For threads
  quoteTweetId?: string;          // For quote tweets
  replySettings: 'everyone' | 'mentionedUsers' | 'following';
  forSuperFollowersOnly: boolean;
  pollOptions?: {
    options: string[];
    durationMinutes: number;
  };
}

/**
 * Scheduled Post
 *
 * Extends SocialPost with scheduling-specific fields
 */
export interface ScheduledPost extends SocialPost {
  status: 'scheduled';
  scheduledFor: string;           // Required for scheduled posts

  // Scheduling settings
  timezone: string;               // IANA timezone
  retryAttempts: number;          // Number of retry attempts if failed
  maxRetries: number;             // Maximum retry attempts
  retryDelayMinutes: number;      // Delay between retries

  // Workflow context (if triggered by workflow)
  workflowId?: string;
  workflowExecutionId?: string;
}

/**
 * Publish Result
 *
 * Result of publishing a post to a platform
 */
export interface PublishResult {
  success: boolean;
  postId: string;                 // Internal post ID

  // Platform-specific IDs
  platformPostId?: string;        // LinkedIn URN or Twitter tweet ID
  platformUrl?: string;           // Public URL to the post

  // Error info (if failed)
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
    retryable: boolean;           // Can this error be retried?
  };

  // Metadata
  publishedAt?: string;           // ISO timestamp
  platform: SocialPlatform;

  // Analytics (initial values)
  analytics?: {
    impressions: number;
    engagements: number;
    clicks: number;
  };
}

/**
 * Engagement Metrics
 *
 * Analytics data for a published post
 */
export interface EngagementMetrics {
  postId: string;
  platform: SocialPlatform;
  platformPostId: string;

  // Core metrics
  impressions: number;            // Number of times seen
  engagements: number;            // Total interactions (likes, shares, comments, clicks)
  clicks: number;                 // Link clicks

  // Platform-specific metrics
  linkedInMetrics?: {
    likes: number;
    comments: number;
    shares: number;
    clickRate: number;            // CTR percentage
    engagement: number;           // LinkedIn engagement score
  };

  twitterMetrics?: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
    profileVisits: number;
  };

  // Metadata
  lastFetchedAt: string;          // ISO timestamp

  // Historical data
  metricsHistory?: Array<{
    timestamp: string;
    impressions: number;
    engagements: number;
    clicks: number;
  }>;
}

/**
 * AI Content Generation Options
 */
export interface AIContentGenerationOptions {
  organizationId: string;
  workspaceId: string;
  userId: string;

  // Platform target
  platform: SocialPlatform;

  // Content context
  topic?: string;
  keywords?: string[];
  tone?: 'professional' | 'casual' | 'thought-leadership' | 'promotional' | 'educational';
  length?: 'short' | 'medium' | 'long';

  // Deal/CRM context (optional)
  dealId?: string;
  companyName?: string;
  industryTemplate?: string;

  // Customization
  includeHashtags?: boolean;
  maxHashtags?: number;
  includeEmojis?: boolean;
  includeCallToAction?: boolean;
  customInstructions?: string;

  // Content references
  linkUrl?: string;               // External link to include
  imagePrompt?: string;           // AI image generation prompt
}

/**
 * Generated Social Content
 */
export interface GeneratedSocialContent {
  id: string;
  organizationId: string;
  workspaceId: string;
  userId: string;

  // Generated content
  content: string;
  hashtags: string[];

  // AI metadata
  platform: SocialPlatform;
  aiModel: string;
  prompt: string;
  generatedAt: string;            // ISO timestamp

  // Variants (for A/B testing)
  variants?: Array<{
    content: string;
    hashtags: string[];
    score: number;                // AI confidence score
  }>;
}

/**
 * Social Media Integration
 *
 * Stored in ORGANIZATIONS/{orgId}/integrations collection
 */
export interface SocialMediaIntegration {
  id: string;
  organizationId: string;
  workspaceId?: string;

  // Integration type
  type: 'social-media';
  platform: SocialPlatform;

  // Status
  status: 'active' | 'inactive' | 'error' | 'token_expired';

  // OAuth tokens
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt: string;         // ISO timestamp

  // Platform-specific data
  linkedInData?: {
    personUrn: string;            // urn:li:person:{ID}
    organizationUrns?: string[];  // Company pages user can post to
    scopes: string[];             // Granted OAuth scopes
  };

  twitterData?: {
    userId: string;               // Twitter user ID
    username: string;             // @username
    scopes: string[];
  };

  // Settings
  settings: {
    autoPublish: boolean;         // Auto-publish scheduled posts
    defaultVisibility: PostVisibility;
    enableAnalytics: boolean;
    analyticsRefreshMinutes: number;
  };

  // Metadata
  connectedAt: string;            // ISO timestamp
  lastSyncAt?: string;            // ISO timestamp
  lastError?: string;
}
```

### 4.2 Service Response Types

```typescript
/**
 * Social Media Service Responses
 */

export interface CreatePostResponse {
  success: boolean;
  post?: SocialPost;
  error?: string;
}

export interface SchedulePostResponse {
  success: boolean;
  scheduledPost?: ScheduledPost;
  error?: string;
}

export interface PublishPostResponse {
  success: boolean;
  result?: PublishResult;
  error?: string;
}

export interface FetchAnalyticsResponse {
  success: boolean;
  metrics?: EngagementMetrics;
  error?: string;
}

export interface GenerateContentResponse {
  success: boolean;
  content?: GeneratedSocialContent;
  error?: string;
}

/**
 * OAuth Response Types
 */

export interface OAuthAuthorizationUrlResponse {
  success: boolean;
  authorizationUrl?: string;
  state?: string;
  error?: string;
}

export interface OAuthTokenExchangeResponse {
  success: boolean;
  integration?: SocialMediaIntegration;
  error?: string;
}
```

---

## 5. Integration Points

### 5.1 AI Content Generation

**Integration with:** `src/lib/ai/unified-ai-service.ts`

**Pattern:**

```typescript
// ai-content-generator.ts

import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';

export async function generateSocialContent(
  options: AIContentGenerationOptions
): Promise<GeneratedSocialContent> {
  // Build platform-specific prompt
  const prompt = buildContentPrompt(options);

  // Call unified AI service
  const response = await sendUnifiedChatMessage({
    organizationId: options.organizationId,
    workspaceId: options.workspaceId,
    systemPrompt: getSystemPrompt(options.platform),
    messages: [{ role: 'user', content: prompt }],
    stream: false,
  });

  // Parse and structure response
  return parseAIResponse(response, options);
}
```

**System Prompt Examples:**

**LinkedIn:**
```
You are a professional LinkedIn content creator. Generate engaging LinkedIn posts that:
- Are 150-300 words for optimal engagement
- Use professional tone with thought leadership angle
- Include 3-5 relevant hashtags
- Have a clear call-to-action
- Follow LinkedIn best practices for visibility
```

**Twitter/X:**
```
You are a concise Twitter content creator. Generate engaging tweets that:
- Are under 280 characters (be concise and impactful)
- Use conversational tone
- Include 1-2 relevant hashtags
- Hook readers in the first 10 words
- Can work as standalone or part of a thread
```

### 5.2 Workflow Integration

**Integration with:** `src/lib/workflow/types.ts` and `src/lib/workflows/workflow-engine.ts`

**New Workflow Action Types:**

Add to `WorkflowActionType` enum in `src/lib/workflow/types.ts`:

```typescript
export type WorkflowActionType =
  // ... existing actions

  // Social Media Actions
  | 'social.post.linkedin'        // Post to LinkedIn
  | 'social.post.twitter'         // Post to Twitter/X
  | 'social.schedule.linkedin'    // Schedule LinkedIn post
  | 'social.schedule.twitter'     // Schedule Twitter post
  | 'social.generate.content'     // Generate AI content for social media
```

**New Action Config Types:**

```typescript
/**
 * Social Media Action Configuration
 */
export interface SocialMediaActionConfig {
  platform: SocialPlatform;

  // Content source
  contentSource: 'static' | 'ai_generated' | 'field_reference';
  staticContent?: string;
  aiOptions?: AIContentGenerationOptions;
  contentField?: string;          // Field reference from trigger data

  // Publishing options
  publishImmediately: boolean;
  scheduledFor?: string;          // ISO timestamp or relative (e.g., '+1 day')
  visibility: PostVisibility;

  // Media
  mediaUrls?: string[];
  linkUrl?: string;

  // AI enhancement
  enhanceWithAI?: boolean;        // Optimize existing content with AI
  includeHashtags?: boolean;

  // Target account
  authorType: 'user' | 'organization';
  linkedInOrganizationUrn?: string; // For company page posts
}

// Add to ActionConfig union type
export type ActionConfig =
  // ... existing configs
  | SocialMediaActionConfig;
```

**Workflow Action Implementation:**

Create `src/lib/workflows/actions/social-media-action.ts`:

```typescript
import type { WorkflowAction } from '@/types/workflow';
import type { SocialMediaActionConfig } from '@/lib/workflow/types';
import { generateSocialContent } from '@/lib/social/ai-content-generator';
import { publishPost, schedulePost } from '@/lib/social';

export async function executeSocialMediaAction(
  action: WorkflowAction,
  context: WorkflowExecutionContext
): Promise<ActionExecutionResult> {
  const config = action.config as SocialMediaActionConfig;

  // Get content
  let content: string;
  if (config.contentSource === 'ai_generated') {
    const generated = await generateSocialContent(config.aiOptions);
    content = generated.content;
  } else if (config.contentSource === 'field_reference') {
    content = context.triggerData[config.contentField];
  } else {
    content = config.staticContent;
  }

  // Build post
  const post: SocialPost = {
    // ... construct post object
  };

  // Publish or schedule
  const result = config.publishImmediately
    ? await publishPost(post)
    : await schedulePost(post);

  return {
    actionId: action.id,
    actionType: action.type,
    status: result.success ? 'success' : 'failed',
    result: result,
  };
}
```

### 5.3 Scheduling Integration

**Integration with:** `src/lib/scheduled-publisher.ts`

**Pattern:**

Extend existing `processScheduledPages()` to include social media posts:

```typescript
// Add to scheduled-publisher.ts

export async function processScheduledSocialPosts(): Promise<{
  processed: number;
  errors: number;
}> {
  // Similar pattern to processScheduledPages()
  // Query ORGANIZATIONS/{orgId}/social-posts where status='scheduled' and scheduledFor <= now
  // Call publishPost() for each
  // Update status to 'published' or 'failed'
  // Emit signal to Signal Bus
}
```

### 5.4 Signal Bus Integration

**Integration with:** `src/lib/orchestration/types.ts`

**New Signal Types:**

Add to `SignalType` enum:

```typescript
export type SignalType =
  // ... existing signals

  // Social Media Signals
  | 'social.post.created'         // Draft post created
  | 'social.post.scheduled'       // Post scheduled for future
  | 'social.post.published'       // Post successfully published
  | 'social.post.failed'          // Post publishing failed
  | 'social.content.generated'    // AI content generated
  | 'social.analytics.updated'    // Engagement metrics refreshed
  | 'social.integration.connected'   // Platform connected
  | 'social.integration.disconnected' // Platform disconnected
  | 'social.integration.error';   // OAuth or API error
```

**Signal Emission Examples:**

```typescript
// After successful post publish
await coordinator.emitSignal({
  orgId: organizationId,
  type: 'social.post.published',
  priority: 'Medium',
  data: {
    postId: post.id,
    platform: post.platform,
    platformUrl: result.platformUrl,
    content: post.content,
  },
  ttlDays: 30,
});

// After analytics refresh
await coordinator.emitSignal({
  orgId: organizationId,
  type: 'social.analytics.updated',
  priority: 'Low',
  data: {
    postId: metrics.postId,
    platform: metrics.platform,
    impressions: metrics.impressions,
    engagements: metrics.engagements,
  },
  ttlDays: 90,
});
```

### 5.5 API Key Management

**Integration with:** `src/lib/api-keys/api-key-service.ts`

**Pattern:**

Store OAuth credentials securely:

```typescript
// Store LinkedIn credentials
await apiKeyService.setApiKey(
  organizationId,
  'social-linkedin-client-id',
  clientId,
  { workspaceId, description: 'LinkedIn OAuth Client ID' }
);

await apiKeyService.setApiKey(
  organizationId,
  'social-linkedin-client-secret',
  clientSecret,
  { workspaceId, description: 'LinkedIn OAuth Client Secret' }
);

// Store access/refresh tokens in integration document
```

---

## 6. Workflow Action Types

### 6.1 Action Type: `social.post.linkedin`

**Purpose:** Post content to LinkedIn (personal profile or company page)

**Configuration:**

```typescript
{
  id: 'action-1',
  type: 'social.post.linkedin',
  name: 'Post to LinkedIn',
  config: {
    platform: 'linkedin',
    contentSource: 'ai_generated',
    aiOptions: {
      topic: 'New product launch',
      tone: 'professional',
      includeHashtags: true,
      maxHashtags: 5,
    },
    publishImmediately: true,
    visibility: 'public',
    authorType: 'organization',
    linkedInOrganizationUrn: 'urn:li:organization:12345',
  },
  continueOnError: false,
  retry: {
    enabled: true,
    maxAttempts: 3,
    backoffMultiplier: 2,
  },
}
```

**Use Cases:**
- Announce deal closures
- Share company news
- Promote content
- Employee advocacy

### 6.2 Action Type: `social.post.twitter`

**Purpose:** Post tweet to X (Twitter)

**Configuration:**

```typescript
{
  id: 'action-2',
  type: 'social.post.twitter',
  name: 'Tweet Announcement',
  config: {
    platform: 'twitter',
    contentSource: 'static',
    staticContent: 'Excited to announce our new product! Check it out:',
    linkUrl: 'https://example.com/product',
    publishImmediately: true,
    visibility: 'public',
    includeHashtags: true,
  },
  continueOnError: true,
}
```

**Use Cases:**
- Quick announcements
- Event reminders
- Customer engagement
- Trending topic participation

### 6.3 Action Type: `social.schedule.linkedin`

**Purpose:** Schedule LinkedIn post for future publication

**Configuration:**

```typescript
{
  id: 'action-3',
  type: 'social.schedule.linkedin',
  name: 'Schedule LinkedIn Post',
  config: {
    platform: 'linkedin',
    contentSource: 'field_reference',
    contentField: 'deal.custom_linkedin_post',
    publishImmediately: false,
    scheduledFor: '+7 days',  // Relative scheduling
    visibility: 'public',
    authorType: 'user',
  },
}
```

**Use Cases:**
- Content calendar automation
- Time-zone optimized posting
- Campaign coordination

### 6.4 Action Type: `social.schedule.twitter`

**Purpose:** Schedule tweet for future publication

**Configuration:**

```typescript
{
  id: 'action-4',
  type: 'social.schedule.twitter',
  name: 'Schedule Tweet',
  config: {
    platform: 'twitter',
    contentSource: 'ai_generated',
    aiOptions: {
      topic: 'Weekly tips',
      tone: 'casual',
      length: 'short',
    },
    publishImmediately: false,
    scheduledFor: '2026-01-20T09:00:00Z',  // Absolute scheduling
    visibility: 'public',
  },
}
```

### 6.5 Action Type: `social.generate.content`

**Purpose:** Generate AI content without publishing (for review/approval workflows)

**Configuration:**

```typescript
{
  id: 'action-5',
  type: 'social.generate.content',
  name: 'Generate Social Content',
  config: {
    platform: 'linkedin',
    aiOptions: {
      topic: 'Industry trends',
      tone: 'thought-leadership',
      length: 'medium',
      includeHashtags: true,
      dealId: '{{trigger.dealId}}',  // Template variable
    },
  },
  continueOnError: false,
}
```

**Output:** Stores generated content in workflow execution context for downstream actions or manual review.

---

## 7. Database Schema

### 7.1 Firestore Collections

**Collection Path:** `ORGANIZATIONS/{orgId}/social-posts`

**Document Structure:**

```typescript
{
  id: string;
  organizationId: string;
  workspaceId: string;
  platform: 'linkedin' | 'twitter';
  content: string;
  mediaUrls: string[];
  linkUrl: string;
  visibility: 'public' | 'connections' | 'private';
  hashtags: string[];
  mentions: string[];
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';
  scheduledFor: string | null;  // ISO timestamp
  publishedAt: string | null;   // ISO timestamp
  authorType: 'user' | 'organization';
  authorId: string;
  createdBy: string;
  generatedByAI: boolean;
  aiPrompt: string | null;
  aiModel: string | null;
  createdAt: string;  // ISO timestamp
  updatedAt: string;  // ISO timestamp
  platformData: {
    // LinkedIn-specific or Twitter-specific data
  };

  // Publishing metadata
  platformPostId: string | null;  // LinkedIn URN or Twitter tweet ID
  platformUrl: string | null;
  publishError: {
    code: string;
    message: string;
    retryable: boolean;
  } | null;
  retryAttempts: number;

  // Workflow context
  workflowId: string | null;
  workflowExecutionId: string | null;
}
```

**Indexes:**
- `organizationId`
- `status`
- `scheduledFor` (for scheduled posts query)
- `platform`
- `createdBy`
- `publishedAt` (for analytics queries)

---

**Collection Path:** `ORGANIZATIONS/{orgId}/social-analytics`

**Document Structure:**

```typescript
{
  id: string;  // Same as postId for easy lookup
  postId: string;
  organizationId: string;
  platform: 'linkedin' | 'twitter';
  platformPostId: string;
  impressions: number;
  engagements: number;
  clicks: number;
  linkedInMetrics: {
    likes: number;
    comments: number;
    shares: number;
    clickRate: number;
    engagement: number;
  } | null;
  twitterMetrics: {
    likes: number;
    retweets: number;
    replies: number;
    quotes: number;
    bookmarks: number;
    profileVisits: number;
  } | null;
  lastFetchedAt: string;  // ISO timestamp
  metricsHistory: Array<{
    timestamp: string;
    impressions: number;
    engagements: number;
    clicks: number;
  }>;
}
```

**Indexes:**
- `postId`
- `organizationId`
- `platform`
- `lastFetchedAt`

---

**Collection Path:** `ORGANIZATIONS/{orgId}/integrations`

**Document ID:** `social-{platform}` (e.g., `social-linkedin`, `social-twitter`)

**Document Structure:**

```typescript
{
  id: string;
  organizationId: string;
  workspaceId: string | null;
  type: 'social-media';
  platform: 'linkedin' | 'twitter';
  status: 'active' | 'inactive' | 'error' | 'token_expired';
  accessToken: string;  // Encrypted
  refreshToken: string | null;  // Encrypted
  tokenExpiresAt: string;  // ISO timestamp
  linkedInData: {
    personUrn: string;
    organizationUrns: string[];
    scopes: string[];
  } | null;
  twitterData: {
    userId: string;
    username: string;
    scopes: string[];
  } | null;
  settings: {
    autoPublish: boolean;
    defaultVisibility: 'public' | 'connections' | 'private';
    enableAnalytics: boolean;
    analyticsRefreshMinutes: number;
  };
  connectedAt: string;  // ISO timestamp
  lastSyncAt: string | null;
  lastError: string | null;
}
```

**Indexes:**
- `organizationId`
- `platform`
- `status`

---

### 7.2 Security Rules

```javascript
match /ORGANIZATIONS/{orgId}/social-posts/{postId} {
  allow read: if request.auth.token.orgId == orgId;
  allow write: if request.auth.token.orgId == orgId
                && hasRole(['admin', 'sales_manager', 'sales_rep']);
}

match /ORGANIZATIONS/{orgId}/social-analytics/{analyticsId} {
  allow read: if request.auth.token.orgId == orgId;
  allow write: if false; // Only server-side writes
}

match /ORGANIZATIONS/{orgId}/integrations/social-{platform} {
  allow read: if request.auth.token.orgId == orgId
                && hasRole(['admin', 'sales_manager']);
  allow write: if request.auth.token.orgId == orgId
                && hasRole(['admin']);
}
```

---

## 8. Security Considerations

### 8.1 OAuth Token Storage

**Encryption:**
- Store access tokens and refresh tokens encrypted at rest
- Use Firebase Admin SDK's built-in encryption or external KMS
- Never expose tokens in client-side code

**Token Refresh:**
- Implement automatic token refresh 24 hours before expiration
- Store token expiration timestamps
- Gracefully handle token revocation

### 8.2 Multi-Tenant Isolation

**Firestore Rules:**
- All queries scoped by `organizationId`
- Role-based access control for social media features
- Audit logs for all publishing actions

**API Access:**
- Validate organization ownership before publishing
- Validate user permissions before creating posts
- Rate limiting per organization

### 8.3 Content Safety

**AI Content Filtering:**
- Integrate with existing `src/lib/ai/safety/content-filter.ts`
- Block profanity, hate speech, PII leaks
- Optional human approval workflow for AI-generated content

**Link Validation:**
- Validate external URLs before posting
- Check for phishing/malicious links
- Warn on suspicious domains

### 8.4 Rate Limiting

**Platform Rate Limits:**
- LinkedIn: No official documented rate limits (monitor for 429 errors)
- Twitter: Strict rate limits by tier (track usage per organization)

**Application Rate Limits:**
- Limit posts per organization per day
- Prevent spam/abuse
- Queue posts if rate limit approached

### 8.5 Error Handling

**Retry Strategy:**
- Exponential backoff for transient errors
- Do not retry for permanent errors (invalid credentials, policy violations)
- Max 3 retry attempts with configurable delay

**Error Logging:**
- Log all API errors to Signal Bus
- Alert admins on repeated failures
- Surface user-friendly error messages

---

## 9. Implementation Phases

### Phase 1: Foundation (Week 1-2)

**Deliverables:**
1. TypeScript interface definitions (`types.ts`)
2. OAuth handlers for LinkedIn and X (`oauth-handlers.ts`)
3. Token management system (`token-manager.ts`)
4. Database schema setup (Firestore collections)
5. Security rules implementation

**Testing:**
- OAuth flows work end-to-end
- Tokens stored securely
- Multi-tenant isolation verified

---

### Phase 2: Publishing Core (Week 3-4)

**Deliverables:**
1. LinkedIn publisher implementation (`linkedin-publisher.ts`)
2. Twitter publisher implementation (`twitter-publisher.ts`)
3. Basic post creation and publishing APIs
4. Error handling and retry logic
5. Signal Bus integration

**Testing:**
- Publish to LinkedIn personal profile
- Publish to LinkedIn company page
- Publish to Twitter
- Verify error handling
- Verify signals emitted

---

### Phase 3: Scheduling & AI (Week 5-6)

**Deliverables:**
1. Content scheduler (`content-scheduler.ts`)
2. Integration with `scheduled-publisher.ts`
3. AI content generator (`ai-content-generator.ts`)
4. Platform-specific prompt optimization
5. Hashtag generation logic

**Testing:**
- Schedule posts for future publication
- Verify cron job processes scheduled posts
- Generate AI content for LinkedIn
- Generate AI content for Twitter
- Verify content quality and platform compliance

---

### Phase 4: Workflow Integration (Week 7-8)

**Deliverables:**
1. Workflow action types implementation
2. Action config types
3. Social media action executor
4. Workflow UI updates (if needed)
5. Documentation for workflow actions

**Testing:**
- Create workflow with social media action
- Trigger workflow and verify post published
- Test scheduled workflow posts
- Test AI-generated workflow posts
- Test error handling in workflows

---

### Phase 5: Analytics & Monitoring (Week 9-10)

**Deliverables:**
1. Social analytics service (`social-analytics.ts`)
2. Engagement metrics collection
3. Analytics dashboard components
4. Signal Bus integration for analytics
5. Scheduled analytics refresh cron job

**Testing:**
- Fetch LinkedIn post metrics
- Fetch Twitter post metrics
- Verify metrics stored correctly
- Verify metrics refresh on schedule
- Verify analytics dashboard displays correctly

---

### Phase 6: UI & Polish (Week 11-12)

**Deliverables:**
1. Social media management UI
2. Post composer with AI assistance
3. Content calendar view
4. Analytics dashboard
5. Integration settings page
6. User documentation

**Testing:**
- End-to-end user testing
- UI/UX validation
- Performance testing
- Mobile responsiveness
- Accessibility compliance

---

## Appendix A: API Endpoints

### Frontend API Routes (Next.js)

**Authentication:**
```
POST /api/social/oauth/linkedin/authorize
POST /api/social/oauth/linkedin/callback
POST /api/social/oauth/twitter/authorize
POST /api/social/oauth/twitter/callback
```

**Posts:**
```
GET    /api/social/posts
POST   /api/social/posts
GET    /api/social/posts/{postId}
PUT    /api/social/posts/{postId}
DELETE /api/social/posts/{postId}
POST   /api/social/posts/{postId}/publish
POST   /api/social/posts/{postId}/schedule
POST   /api/social/posts/{postId}/cancel
```

**Content Generation:**
```
POST /api/social/generate-content
```

**Analytics:**
```
GET /api/social/analytics/{postId}
GET /api/social/analytics/summary
POST /api/social/analytics/refresh
```

**Integrations:**
```
GET    /api/social/integrations
GET    /api/social/integrations/{platform}
PUT    /api/social/integrations/{platform}
DELETE /api/social/integrations/{platform}
```

---

## Appendix B: References

### Official Documentation

**LinkedIn:**
- [LinkedIn Authentication](https://learn.microsoft.com/en-us/linkedin/shared/authentication/authentication)
- [LinkedIn Posts API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-api?view=li-lms-2025-11)
- [LinkedIn API Guide](https://getlate.dev/blog/linkedin-posting-api)

**X (Twitter):**
- [X API Documentation](https://developer.twitter.com/en/docs/twitter-api)
- [X Create Post](https://docs.x.com/x-api/posts/create-post)
- [X API Guide 2026](https://getlate.dev/blog/x-api)

### Platform Resources

- [Schedule LinkedIn Posts via API](https://getlate.dev/blog/schedule-linkedin-posts-via-api)
- [LinkedIn Company Page Posting API](https://getlate.dev/blog/linked-in-company-page-posting-api)
- [How to Post to LinkedIn via API](https://getlate.dev/blog/post-to-linkedin-via-api)

---

## Appendix C: Error Codes

### LinkedIn Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| 401 | Invalid/expired access token | No (refresh token) |
| 403 | Insufficient permissions | No |
| 429 | Rate limit exceeded | Yes (with backoff) |
| 500 | LinkedIn server error | Yes |

### Twitter Error Codes

| Code | Description | Retryable |
|------|-------------|-----------|
| 401 | Invalid/expired access token | No (refresh token) |
| 403 | Forbidden (suspended account, etc.) | No |
| 429 | Rate limit exceeded | Yes (respect rate limit headers) |
| 500 | Twitter server error | Yes |

---

## Document Control

**Version History:**

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-12 | SOCIAL-IMPLEMENTER | Initial specification |

**Approval:**

- [ ] Technical Lead Review
- [ ] Security Review
- [ ] Product Owner Approval

**Next Steps:**

1. Review and approve this specification
2. Begin Phase 1 implementation
3. Set up project tracking in GitHub Issues
4. Schedule weekly sync meetings

---

**END OF SPECIFICATION**
