/**
 * Slack Integration Types
 * 
 * Production-ready Slack integration for real-time sales notifications.
 * Integrates with the Notification System to deliver alerts via Slack.
 * 
 * Key Features:
 * - OAuth 2.0 authentication with workspace installation
 * - Channel and user management
 * - Rich message formatting with blocks and attachments
 * - Interactive buttons and actions
 * - Thread support for conversations
 * - File uploads and sharing
 * - User presence and status
 * - Rate limiting and retry logic
 * - Webhook support for incoming messages
 * 
 * Security:
 * - Token encryption at rest
 * - Request signing verification
 * - Scope-based permissions
 * - Multi-workspace isolation
 */

import { Timestamp } from 'firebase-admin/firestore';
import { NotificationCategory, NotificationPriority } from '@/lib/notifications/types';

/**
 * Slack Message Priority
 * Maps to Slack's visual urgency indicators
 */
export type SlackMessagePriority = 
  | 'critical'  // Red indicator, @channel mention
  | 'high'      // Orange indicator, direct mention
  | 'medium'    // Default styling
  | 'low';      // Muted styling

/**
 * Slack Message Type
 * Different message formats supported
 */
export type SlackMessageType =
  | 'text'           // Simple text message
  | 'blocks'         // Rich block formatting
  | 'interactive'    // Message with buttons/actions
  | 'attachment'     // Legacy attachment format
  | 'thread_reply';  // Reply to existing thread

/**
 * Slack Channel Type
 */
export type SlackChannelType =
  | 'public_channel'   // Public channel anyone can join
  | 'private_channel'  // Private channel (invite only)
  | 'im'              // Direct message to user
  | 'mpim'            // Multi-person direct message
  | 'group';          // Private group (deprecated but still exists)

/**
 * Slack Connection Status
 */
export type SlackConnectionStatus =
  | 'connected'       // Active connection
  | 'disconnected'    // No connection
  | 'expired'         // Token expired
  | 'revoked'         // Access revoked
  | 'error';          // Connection error

/**
 * Slack Block Element Types
 * For building rich interactive messages
 */
export type SlackBlockType =
  | 'section'
  | 'divider'
  | 'header'
  | 'context'
  | 'actions'
  | 'image';

/**
 * Slack Action Types
 * Interactive elements users can interact with
 */
export type SlackActionType =
  | 'button'
  | 'select'
  | 'multi_select'
  | 'datepicker'
  | 'overflow';

/**
 * Slack Button Style
 */
export type SlackButtonStyle = 
  | 'primary'   // Green button
  | 'danger';   // Red button
  // Default has no style (gray)

/**
 * Slack Workspace Configuration
 * 
 * Stores OAuth tokens and workspace settings.
 * Tokens are encrypted at rest using Firestore field encryption.
 */
export interface SlackWorkspace {
  /** Unique workspace identifier */
  id: string;
  
  /** Organization this workspace belongs to */
  organizationId: string;
  
  /** Slack team/workspace ID */
  teamId: string;
  
  /** Slack team/workspace name */
  teamName: string;
  
  /** Slack team domain (e.g., company.slack.com) */
  teamDomain?: string;
  
  /** Bot access token (encrypted) */
  botToken: string;
  
  /** Bot user ID */
  botUserId: string;
  
  /** Scopes granted to the bot */
  scopes: string[];
  
  /** User who authorized the app */
  installedBy: {
    userId: string;
    userName?: string;
    userEmail?: string;
  };
  
  /** Webhook URL for incoming messages (optional) */
  incomingWebhookUrl?: string;
  
  /** Default channel for notifications */
  defaultChannelId?: string;
  defaultChannelName?: string;
  
  /** Connection status */
  status: SlackConnectionStatus;
  
  /** When the workspace was connected */
  connectedAt: Timestamp;
  
  /** Last time token was verified */
  lastVerifiedAt?: Timestamp;
  
  /** When token expires (if applicable) */
  expiresAt?: Timestamp;
  
  /** Last error message (if any) */
  lastError?: string;
  
  /** When the workspace was disconnected (if applicable) */
  disconnectedAt?: Timestamp;
  
  /** Configuration settings */
  settings: SlackWorkspaceSettings;
  
  /** Metadata */
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Slack Workspace Settings
 */
export interface SlackWorkspaceSettings {
  /** Enable/disable all Slack notifications */
  enabled: boolean;
  
  /** Quiet hours (no notifications during this time) */
  quietHours?: {
    enabled: boolean;
    start: string; // HH:MM format (24h)
    end: string;   // HH:MM format (24h)
    timezone: string; // IANA timezone
  };
  
  /** Rate limiting settings */
  rateLimit?: {
    /** Max messages per minute */
    maxMessagesPerMinute: number;
    /** Max messages per hour */
    maxMessagesPerHour: number;
  };
  
  /** Batching settings */
  batching?: {
    /** Enable message batching */
    enabled: boolean;
    /** Batch interval in minutes */
    intervalMinutes: number;
    /** Maximum messages per batch */
    maxBatchSize: number;
  };
  
  /** Thread settings */
  threading?: {
    /** Use threads for related notifications */
    enabled: boolean;
    /** Thread timeout (start new thread after X hours) */
    timeoutHours: number;
  };
  
  /** Mention settings */
  mentions?: {
    /** Use @channel for critical alerts */
    allowChannelMentions: boolean;
    /** Use @here for high priority */
    allowHereMentions: boolean;
    /** User IDs to mention for specific categories */
    categoryMentions?: Record<NotificationCategory, string[]>;
  };
}

/**
 * Slack Channel
 * 
 * Represents a Slack channel where notifications can be sent
 */
export interface SlackChannel {
  /** Channel ID */
  id: string;
  
  /** Workspace this channel belongs to */
  workspaceId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Channel name (without #) */
  name: string;
  
  /** Channel type */
  type: SlackChannelType;
  
  /** Is channel archived */
  isArchived: boolean;
  
  /** Is bot a member of this channel */
  isMember: boolean;
  
  /** Channel topic */
  topic?: string;
  
  /** Channel purpose */
  purpose?: string;
  
  /** Number of members */
  memberCount?: number;
  
  /** When channel was created in Slack */
  createdInSlack?: number; // Unix timestamp
  
  /** Metadata */
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Slack Channel Mapping
 * 
 * Maps notification categories to specific Slack channels
 */
export interface SlackChannelMapping {
  /** Unique mapping identifier */
  id: string;
  
  /** Workspace ID */
  workspaceId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Notification category */
  category: NotificationCategory;
  
  /** Channel ID to send to */
  channelId: string;
  
  /** Channel name (for display) */
  channelName: string;
  
  /** Minimum priority to send (filter out lower priority) */
  minPriority: NotificationPriority;
  
  /** Is this mapping active */
  enabled: boolean;
  
  /** Created by user ID */
  createdBy: string;
  
  /** Metadata */
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Slack User Mapping
 * 
 * Maps platform users to Slack users
 */
export interface SlackUserMapping {
  /** Unique mapping identifier */
  id: string;
  
  /** Workspace ID */
  workspaceId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Platform user ID */
  platformUserId: string;
  
  /** Slack user ID */
  slackUserId: string;
  
  /** Slack username */
  slackUsername?: string;
  
  /** Slack display name */
  slackDisplayName?: string;
  
  /** Slack email (if available) */
  slackEmail?: string;
  
  /** User preferences for Slack notifications */
  preferences: {
    /** Enable DMs for certain categories */
    dmCategories: NotificationCategory[];
    /** Mute specific categories */
    mutedCategories: NotificationCategory[];
  };
  
  /** Is mapping active */
  enabled: boolean;
  
  /** Metadata */
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Slack Message
 * 
 * Represents a message to be sent via Slack
 */
export interface SlackMessage {
  /** Unique message identifier */
  id: string;
  
  /** Workspace ID */
  workspaceId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Channel to send to */
  channelId: string;
  
  /** Message type */
  type: SlackMessageType;
  
  /** Message priority */
  priority: SlackMessagePriority;
  
  /** Notification category (for analytics) */
  category: NotificationCategory;
  
  /** Plain text content */
  text: string;
  
  /** Rich blocks (if type is 'blocks' or 'interactive') */
  blocks?: SlackBlock[];
  
  /** Legacy attachments (if type is 'attachment') */
  attachments?: SlackAttachment[];
  
  /** Thread timestamp (if replying to thread) */
  threadTs?: string;
  
  /** User to send DM to (if channelId is user ID) */
  userId?: string;
  
  /** Users to mention */
  mentions?: {
    users?: string[];
    channel?: boolean;
    here?: boolean;
  };
  
  /** Message metadata */
  metadata?: {
    /** Source notification ID */
    notificationId?: string;
    /** Source signal ID */
    signalId?: string;
    /** Custom metadata */
    [key: string]: unknown;
  };
  
  /** Delivery status */
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  
  /** Slack message timestamp (after sending) */
  slackTs?: string;
  
  /** Slack permalink (after sending) */
  permalink?: string;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Retry count */
  retryCount: number;
  
  /** Max retries allowed */
  maxRetries: number;
  
  /** Next retry time (if retrying) */
  nextRetryAt?: Timestamp;
  
  /** Scheduled send time (optional) */
  scheduledAt?: Timestamp;
  
  /** When message was sent */
  sentAt?: Timestamp;
  
  /** Metadata */
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Slack Block
 * 
 * Rich message block for Slack's Block Kit
 */
export interface SlackBlock {
  /** Block type */
  type: SlackBlockType;
  
  /** Block ID (optional) */
  block_id?: string;
  
  /** Section block */
  text?: {
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  };
  
  /** Section accessory (image, button, etc.) */
  accessory?: SlackBlockElement;
  
  /** Fields for section block */
  fields?: Array<{
    type: 'plain_text' | 'mrkdwn';
    text: string;
    emoji?: boolean;
  }>;
  
  /** Elements for context or actions block */
  elements?: SlackBlockElement[];
  
  /** Image URL (for image block) */
  image_url?: string;
  alt_text?: string;
  title?: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
}

/**
 * Slack Block Element
 * 
 * Interactive element within a block
 */
export interface SlackBlockElement {
  /** Element type */
  type: SlackActionType | 'image' | 'plain_text' | 'mrkdwn';
  
  /** Action ID (for interactive elements) */
  action_id?: string;
  
  /** Button specific */
  text?: {
    type: 'plain_text';
    text: string;
    emoji?: boolean;
  };
  style?: SlackButtonStyle;
  value?: string;
  url?: string;
  
  /** Image specific */
  image_url?: string;
  alt_text?: string;
  
  /** Select specific */
  placeholder?: {
    type: 'plain_text';
    text: string;
  };
  options?: Array<{
    text: {
      type: 'plain_text';
      text: string;
    };
    value: string;
  }>;
}

/**
 * Slack Attachment (Legacy)
 * 
 * Legacy message attachment format
 */
export interface SlackAttachment {
  /** Attachment color bar */
  color?: string; // hex color or 'good', 'warning', 'danger'
  
  /** Author info */
  author_name?: string;
  author_link?: string;
  author_icon?: string;
  
  /** Title */
  title?: string;
  title_link?: string;
  
  /** Main text */
  text?: string;
  pretext?: string;
  
  /** Image */
  image_url?: string;
  thumb_url?: string;
  
  /** Fields */
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  
  /** Footer */
  footer?: string;
  footer_icon?: string;
  
  /** Timestamp */
  ts?: number;
}

/**
 * Slack Message Template
 * 
 * Reusable message template for consistent formatting
 */
export interface SlackMessageTemplate {
  /** Template identifier */
  id: string;
  
  /** Template name */
  name: string;
  
  /** Template description */
  description?: string;
  
  /** Category this template is for */
  category: NotificationCategory;
  
  /** Organization ID (or 'system' for built-in templates) */
  organizationId: string;
  
  /** Template content */
  template: {
    /** Text template with {{variables}} */
    text: string;
    
    /** Blocks template (JSON with {{variables}}) */
    blocks?: SlackBlock[];
    
    /** Attachments template */
    attachments?: SlackAttachment[];
  };
  
  /** Required variables */
  requiredVariables: string[];
  
  /** Optional variables */
  optionalVariables?: string[];
  
  /** Default priority */
  defaultPriority: SlackMessagePriority;
  
  /** Use threading by default */
  useThreading: boolean;
  
  /** Is template active */
  enabled: boolean;
  
  /** Created by user ID */
  createdBy: string;
  
  /** Metadata */
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Slack Analytics Event
 * 
 * Track Slack message delivery and engagement
 */
export interface SlackAnalyticsEvent {
  /** Event ID */
  id: string;
  
  /** Workspace ID */
  workspaceId: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** Event type */
  eventType: 
    | 'message_sent'
    | 'message_failed'
    | 'message_clicked'
    | 'button_clicked'
    | 'link_clicked'
    | 'thread_replied';
  
  /** Message ID */
  messageId: string;
  
  /** Channel ID */
  channelId: string;
  
  /** Category */
  category: NotificationCategory;
  
  /** Priority */
  priority: SlackMessagePriority;
  
  /** User who interacted (if applicable) */
  userId?: string;
  
  /** Action ID (for button clicks) */
  actionId?: string;
  
  /** Action value */
  actionValue?: string;
  
  /** Event metadata */
  metadata?: Record<string, unknown>;
  
  /** Event timestamp */
  timestamp: Timestamp;
}

/**
 * Slack API Error
 * 
 * Standardized error response from Slack API
 */
export interface SlackAPIError {
  /** Error code */
  error: string;
  
  /** Human-readable error message */
  message?: string;
  
  /** HTTP status code */
  statusCode: number;
  
  /** Is error retryable */
  retryable: boolean;
  
  /** Retry after seconds (for rate limits) */
  retryAfter?: number;
  
  /** Full API response */
  response?: unknown;
}

/**
 * Slack Rate Limit Info
 * 
 * Current rate limit status
 */
export interface SlackRateLimitInfo {
  /** Workspace ID */
  workspaceId: string;
  
  /** Messages sent this minute */
  messagesThisMinute: number;
  
  /** Messages sent this hour */
  messagesThisHour: number;
  
  /** Max messages per minute */
  maxPerMinute: number;
  
  /** Max messages per hour */
  maxPerHour: number;
  
  /** When minute window resets */
  minuteResetAt: Timestamp;
  
  /** When hour window resets */
  hourResetAt: Timestamp;
  
  /** Is currently rate limited */
  isLimited: boolean;
  
  /** When rate limit lifts */
  limitLiftAt?: Timestamp;
}

/**
 * Slack OAuth State
 * 
 * Temporary state for OAuth flow
 */
export interface SlackOAuthState {
  /** State token */
  state: string;
  
  /** Organization ID */
  organizationId: string;
  
  /** User ID initiating OAuth */
  userId: string;
  
  /** Redirect URL after OAuth */
  redirectUrl?: string;
  
  /** State created at */
  createdAt: Timestamp;
  
  /** State expires at */
  expiresAt: Timestamp;
}

/**
 * Slack Service Configuration
 */
export interface SlackServiceConfig {
  /** Slack app credentials */
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  
  /** OAuth scopes to request */
  scopes: string[];
  
  /** Rate limiting */
  rateLimit: {
    maxPerMinute: number;
    maxPerHour: number;
  };
  
  /** Retry configuration */
  retry: {
    maxRetries: number;
    initialDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
  };
  
  /** Webhook verification */
  verifyWebhooks: boolean;
}
