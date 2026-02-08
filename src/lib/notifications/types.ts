/**
 * Notification System Types
 * 
 * Production-ready notification management for all AI features.
 * Supports Slack, email, webhooks, and in-app notifications.
 * 
 * Key Features:
 * - Multi-channel delivery (Slack, email, webhook, in-app)
 * - Priority-based routing (critical, high, medium, low)
 * - Smart batching to reduce notification fatigue
 * - Template-based formatting with variable interpolation
 * - User preference management
 * - Delivery status tracking
 * - Retry logic with exponential backoff
 */

import type { Timestamp } from 'firebase/firestore';
import type { SignalType } from '@/lib/orchestration/types';

/**
 * Notification Channel
 * Where the notification is delivered
 */
export type NotificationChannel = 
  | 'slack'
  | 'email'
  | 'webhook'
  | 'in_app'
  | 'sms';

/**
 * Notification Priority
 * Determines urgency and delivery behavior
 */
export type NotificationPriority = 
  | 'critical'  // Immediate delivery, bypass batching
  | 'high'      // Deliver within 5 minutes
  | 'medium'    // Deliver within 30 minutes
  | 'low';      // Deliver in next scheduled batch

/**
 * Notification Status
 */
export type NotificationStatus =
  | 'pending'     // Queued for delivery
  | 'sent'        // Successfully sent
  | 'delivered'   // Confirmed delivery
  | 'failed'      // Delivery failed
  | 'retrying'    // Attempting retry
  | 'cancelled';  // User cancelled

/**
 * Notification Category
 * Groups notifications by AI feature
 */
export type NotificationCategory =
  | 'deal_risk'              // Deal Risk Predictor
  | 'conversation'           // Conversation Intelligence
  | 'coaching'               // Sales Coaching
  | 'team_performance'       // Team Performance Analytics
  | 'playbook'               // Playbook Builder
  | 'sequence'               // Email Sequence Intelligence
  | 'lead_routing'           // Lead Routing
  | 'email_writer'           // AI Email Writer
  | 'workflow'               // Workflow Automation
  | 'analytics'              // Advanced Analytics
  | 'forecasting'            // Revenue Forecasting
  | 'deal_scoring'           // Deal Scoring
  | 'battlecard'             // Battlecard Engine
  | 'discovery'              // Discovery Engine
  | 'system';                // System notifications

/**
 * Notification Template Variables
 * Common variables available in all templates
 */
export interface NotificationVariables {
  // Organization context
  orgName?: string;
  workspaceId?: string;
  
  // User context
  userId?: string;
  userName?: string;
  userEmail?: string;
  
  // Deal context (if applicable)
  dealId?: string;
  dealName?: string;
  dealValue?: number;
  dealStage?: string;
  
  // Lead context (if applicable)
  leadId?: string;
  leadName?: string;
  leadEmail?: string;
  leadCompany?: string;
  
  // Custom data from the event
  [key: string]: unknown;
}

/**
 * Slack Block Kit Types
 * For rich Slack message formatting
 */
export interface SlackBlock {
  type: string;
  [key: string]: unknown;
}

export interface SlackAttachment {
  color?: string;
  pretext?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
  footer?: string;
  footer_icon?: string;
  ts?: number;
}

/**
 * Notification Template
 * Defines how a notification is formatted for each channel
 */
export interface NotificationTemplate {
  /**
   * Template ID (e.g., 'deal_risk_critical')
   */
  id: string;
  
  /**
   * Template name
   */
  name: string;
  
  /**
   * Category this template belongs to
   */
  category: NotificationCategory;
  
  /**
   * Signal types that trigger this template
   */
  signalTypes: SignalType[];
  
  /**
   * Priority level
   */
  priority: NotificationPriority;
  
  /**
   * Enabled channels for this template
   */
  channels: NotificationChannel[];
  
  /**
   * Slack-specific formatting
   */
  slack?: {
    /**
     * Plain text fallback message
     */
    text: string;
    
    /**
     * Rich blocks (Slack Block Kit)
     */
    blocks?: SlackBlock[];
    
    /**
     * Legacy attachments
     */
    attachments?: SlackAttachment[];
    
    /**
     * Thread key (for grouping related notifications)
     */
    threadKey?: string;
    
    /**
     * Unfurl links
     */
    unfurlLinks?: boolean;
    
    /**
     * Unfurl media
     */
    unfurlMedia?: boolean;
  };
  
  /**
   * Email-specific formatting
   */
  email?: {
    /**
     * Email subject (supports {{variables}})
     */
    subject: string;
    
    /**
     * Email body (plain text, supports {{variables}})
     */
    body: string;
    
    /**
     * HTML body (optional)
     */
    htmlBody?: string;
    
    /**
     * From name
     */
    fromName?: string;
    
    /**
     * Reply-to email
     */
    replyTo?: string;
  };
  
  /**
   * Webhook-specific formatting
   */
  webhook?: {
    /**
     * HTTP method
     */
    method: 'POST' | 'PUT' | 'PATCH';
    
    /**
     * Request body
     */
    body: Record<string, unknown>;
    
    /**
     * Additional headers
     */
    headers?: Record<string, string>;
  };
  
  /**
   * In-app notification formatting
   */
  inApp?: {
    /**
     * Title
     */
    title: string;
    
    /**
     * Body text
     */
    body: string;
    
    /**
     * Icon or emoji
     */
    icon?: string;
    
    /**
     * Action URL (where to navigate when clicked)
     */
    actionUrl?: string;
    
    /**
     * Action buttons
     */
    actions?: Array<{
      label: string;
      url: string;
      style?: 'primary' | 'default' | 'danger';
    }>;
  };

  /**
   * SMS-specific formatting
   */
  sms?: {
    /**
     * SMS text message (supports {{variables}})
     * Must be 160 characters or less for single SMS
     */
    text: string;
  };

  /**
   * Template metadata
   */
  metadata: {
    /**
     * Description
     */
    description: string;
    
    /**
     * Required variables
     */
    requiredVariables: string[];
    
    /**
     * Optional variables
     */
    optionalVariables?: string[];
    
    /**
     * Template version
     */
    version: string;
    
    /**
     * Created at
     */
    createdAt: Timestamp;
    
    /**
     * Updated at
     */
    updatedAt: Timestamp;
  };
}

/**
 * User Notification Preferences
 * Controls which notifications a user receives and how
 */
export interface NotificationPreferences {
  /**
   * User ID
   */
  userId: string;

  /**
   * Global notification toggle
   */
  enabled: boolean;
  
  /**
   * Channel preferences
   */
  channels: {
    slack?: {
      enabled: boolean;
      channelId?: string;      // Default channel for notifications
      threadMessages?: boolean; // Group related notifications in threads
      quietHours?: {
        enabled: boolean;
        start: string;          // HH:MM format (e.g., '22:00')
        end: string;            // HH:MM format (e.g., '08:00')
        timezone: string;       // IANA timezone (e.g., 'America/New_York')
      };
    };
    email?: {
      enabled: boolean;
      address?: string;         // Override default email
      digest?: boolean;         // Batch emails into daily digest
      digestTime?: string;      // HH:MM format for digest delivery
    };
    webhook?: {
      enabled: boolean;
      url?: string;             // Webhook endpoint
      secret?: string;          // HMAC signature secret
    };
    inApp?: {
      enabled: boolean;
      sound?: boolean;          // Play sound for notifications
      desktop?: boolean;        // Show desktop notifications
    };
    sms?: {
      enabled: boolean;
      phoneNumber?: string;     // Phone number for SMS notifications
    };
  };
  
  /**
   * Category preferences (override channel settings)
   */
  categories: Record<NotificationCategory, {
    enabled: boolean;
    channels?: NotificationChannel[]; // Override global channel settings
    minPriority?: NotificationPriority; // Only receive notifications at or above this priority
  }>;
  
  /**
   * Batching preferences
   */
  batching: {
    /**
     * Enable smart batching (reduces notification fatigue)
     */
    enabled: boolean;
    
    /**
     * Batch window in minutes
     */
    windowMinutes: number;
    
    /**
     * Max notifications per batch
     */
    maxPerBatch: number;
    
    /**
     * Priorities that bypass batching
     */
    bypassPriorities: NotificationPriority[];
  };
  
  /**
   * Metadata
   */
  metadata: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
  };
}

/**
 * Notification
 * A notification instance ready for delivery
 */
export interface Notification {
  /**
   * Unique notification ID
   */
  id?: string;

  /**
   * User ID (recipient)
   */
  userId: string;
  
  /**
   * Template ID used to generate this notification
   */
  templateId: string;
  
  /**
   * Category
   */
  category: NotificationCategory;
  
  /**
   * Priority
   */
  priority: NotificationPriority;
  
  /**
   * Channels to deliver on
   */
  channels: NotificationChannel[];
  
  /**
   * Status
   */
  status: NotificationStatus;
  
  /**
   * Variables used for template interpolation
   */
  variables: NotificationVariables;
  
  /**
   * Rendered content per channel
   */
  content: {
    slack?: {
      text: string;
      blocks?: SlackBlock[];
      attachments?: SlackAttachment[];
      channel?: string;
      threadTs?: string;
    };
    email?: {
      subject: string;
      body: string;
      htmlBody?: string;
      to: string;
    };
    webhook?: {
      url: string;
      method: string;
      body: Record<string, unknown>;
      headers?: Record<string, string>;
    };
    inApp?: {
      title: string;
      body: string;
      icon?: string;
      actionUrl?: string;
    };
    sms?: {
      text: string;
      phoneNumber?: string;
    };
  };
  
  /**
   * Delivery tracking
   */
  delivery: {
    /**
     * Attempts per channel
     */
    attempts: Record<NotificationChannel, number>;
    
    /**
     * Last attempt timestamp per channel
     */
    lastAttempt: Record<NotificationChannel, Timestamp | null>;
    
    /**
     * Delivery timestamp per channel
     */
    deliveredAt: Record<NotificationChannel, Timestamp | null>;
    
    /**
     * Error messages per channel
     */
    errors: Record<NotificationChannel, string | null>;
    
    /**
     * Response data per channel (for debugging)
     */
    responses: Record<NotificationChannel, unknown>;
  };
  
  /**
   * Retry configuration
   */
  retry: {
    /**
     * Max retry attempts
     */
    maxAttempts: number;
    
    /**
     * Backoff multiplier (exponential backoff)
     */
    backoffMultiplier: number;
    
    /**
     * Next retry timestamp
     */
    nextRetryAt: Timestamp | null;
  };
  
  /**
   * Signal that triggered this notification
   */
  signalId?: string;
  
  /**
   * Signal type
   */
  signalType?: SignalType;
  
  /**
   * Metadata
   */
  metadata: {
    /**
     * Created at
     */
    createdAt: Timestamp;
    
    /**
     * Updated at
     */
    updatedAt: Timestamp;
    
    /**
     * Scheduled delivery time (for batched notifications)
     */
    scheduledFor?: Timestamp;
    
    /**
     * Batch ID (if part of a batch)
     */
    batchId?: string;
    
    /**
     * Read status (for in-app notifications)
     */
    read?: boolean;
    
    /**
     * Read timestamp
     */
    readAt?: Timestamp | null;
  };
}

/**
 * Notification Batch
 * Groups multiple notifications for efficient delivery
 */
export interface NotificationBatch {
  /**
   * Batch ID
   */
  id?: string;

  /**
   * User ID
   */
  userId: string;
  
  /**
   * Channel this batch is for
   */
  channel: NotificationChannel;
  
  /**
   * Notification IDs in this batch
   */
  notificationIds: string[];
  
  /**
   * Status
   */
  status: 'pending' | 'processing' | 'sent' | 'failed';
  
  /**
   * Scheduled delivery time
   */
  scheduledFor: Timestamp;
  
  /**
   * Actual delivery time
   */
  deliveredAt: Timestamp | null;
  
  /**
   * Error message (if failed)
   */
  error?: string;
  
  /**
   * Metadata
   */
  metadata: {
    createdAt: Timestamp;
    updatedAt: Timestamp;
  };
}

/**
 * Notification Statistics
 * Analytics for notification delivery
 */
export interface NotificationStats {
  /**
   * Time period
   */
  period: {
    start: Timestamp;
    end: Timestamp;
  };
  
  /**
   * Total notifications sent
   */
  totalSent: number;
  
  /**
   * Successful deliveries
   */
  totalDelivered: number;
  
  /**
   * Failed deliveries
   */
  totalFailed: number;
  
  /**
   * By channel
   */
  byChannel: Record<NotificationChannel, {
    sent: number;
    delivered: number;
    failed: number;
    avgDeliveryTimeMs: number;
  }>;
  
  /**
   * By category
   */
  byCategory: Record<NotificationCategory, {
    sent: number;
    delivered: number;
    failed: number;
  }>;
  
  /**
   * By priority
   */
  byPriority: Record<NotificationPriority, {
    sent: number;
    delivered: number;
    failed: number;
  }>;
  
  /**
   * Delivery rate (0-1)
   */
  deliveryRate: number;
  
  /**
   * Average delivery time (milliseconds)
   */
  avgDeliveryTimeMs: number;
  
  /**
   * Metadata
   */
  metadata: {
    generatedAt: Timestamp;
  };
}

/**
 * Notification Queue Item
 * Represents a notification in the processing queue
 */
export interface NotificationQueueItem {
  /**
   * Queue item ID
   */
  id?: string;
  
  /**
   * Notification ID
   */
  notificationId: string;
  
  /**
   * Priority (for queue ordering)
   */
  priority: NotificationPriority;
  
  /**
   * Scheduled for
   */
  scheduledFor: Timestamp;
  
  /**
   * Processing started at
   */
  processingStartedAt: Timestamp | null;
  
  /**
   * Lock (to prevent duplicate processing)
   */
  locked: boolean;
  
  /**
   * Lock acquired at
   */
  lockedAt: Timestamp | null;
  
  /**
   * Lock expires at
   */
  lockExpiresAt: Timestamp | null;
  
  /**
   * Metadata
   */
  metadata: {
    createdAt: Timestamp;
  };
}
