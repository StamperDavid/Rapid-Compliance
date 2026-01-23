/**
 * Slack Integration Validation
 * 
 * Production-ready Zod schemas for Slack integration.
 * Comprehensive input validation for all Slack operations.
 */

import { z } from 'zod';
import { notificationCategorySchema, notificationPrioritySchema } from '@/lib/notifications/validation';

/**
 * Slack Message Priority Schema
 */
export const slackMessagePrioritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);

/**
 * Slack Message Type Schema
 */
export const slackMessageTypeSchema = z.enum([
  'text',
  'blocks',
  'interactive',
  'attachment',
  'thread_reply',
]);

/**
 * Slack Channel Type Schema
 */
export const slackChannelTypeSchema = z.enum([
  'public_channel',
  'private_channel',
  'im',
  'mpim',
  'group',
]);

/**
 * Slack Connection Status Schema
 */
export const slackConnectionStatusSchema = z.enum([
  'connected',
  'disconnected',
  'expired',
  'revoked',
  'error',
]);

/**
 * Slack Block Type Schema
 */
export const slackBlockTypeSchema = z.enum([
  'section',
  'divider',
  'header',
  'context',
  'actions',
  'image',
]);

/**
 * Slack Action Type Schema
 */
export const slackActionTypeSchema = z.enum([
  'button',
  'select',
  'multi_select',
  'datepicker',
  'overflow',
]);

/**
 * Slack Button Style Schema
 */
export const slackButtonStyleSchema = z.enum(['primary', 'danger']);

/**
 * Time in HH:MM format (24h)
 */
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format (24h)');

/**
 * IANA timezone
 */
const timezoneSchema = z.string().min(1, 'Timezone is required');

/**
 * Slack Quiet Hours Schema
 */
export const slackQuietHoursSchema = z.object({
  enabled: z.boolean(),
  start: timeSchema,
  end: timeSchema,
  timezone: timezoneSchema,
});

/**
 * Slack Rate Limit Schema
 */
export const slackRateLimitSchema = z.object({
  maxMessagesPerMinute: z.number().int().min(1).max(1000),
  maxMessagesPerHour: z.number().int().min(1).max(10000),
});

/**
 * Slack Batching Settings Schema
 */
export const slackBatchingSchema = z.object({
  enabled: z.boolean(),
  intervalMinutes: z.number().int().min(1).max(1440), // Max 24 hours
  maxBatchSize: z.number().int().min(1).max(100),
});

/**
 * Slack Threading Settings Schema
 */
export const slackThreadingSchema = z.object({
  enabled: z.boolean(),
  timeoutHours: z.number().int().min(1).max(168), // Max 1 week
});

/**
 * Slack Mentions Settings Schema
 */
export const slackMentionsSchema = z.object({
  allowChannelMentions: z.boolean(),
  allowHereMentions: z.boolean(),
  categoryMentions: z.record(
    notificationCategorySchema,
    z.array(z.string())
  ).optional(),
});

/**
 * Slack Workspace Settings Schema
 */
export const slackWorkspaceSettingsSchema = z.object({
  enabled: z.boolean(),
  quietHours: slackQuietHoursSchema.optional(),
  rateLimit: slackRateLimitSchema.optional(),
  batching: slackBatchingSchema.optional(),
  threading: slackThreadingSchema.optional(),
  mentions: slackMentionsSchema.optional(),
});

/**
 * Slack Text Object Schema
 */
export const slackTextObjectSchema = z.object({
  type: z.enum(['plain_text', 'mrkdwn']),
  text: z.string().min(1).max(3000),
  emoji: z.boolean().optional(),
});

/**
 * Slack Block Element Type
 */
interface SlackBlockElement {
  type: z.infer<typeof slackActionTypeSchema> | 'image' | 'plain_text' | 'mrkdwn';
  action_id?: string;
  text?: z.infer<typeof slackTextObjectSchema>;
  style?: z.infer<typeof slackButtonStyleSchema>;
  value?: string;
  url?: string;
  image_url?: string;
  alt_text?: string;
  placeholder?: z.infer<typeof slackTextObjectSchema>;
  options?: Array<{
    text: z.infer<typeof slackTextObjectSchema>;
    value: string;
  }>;
}

/**
 * Slack Block Element Schema
 */
export const slackBlockElementSchema: z.ZodType<SlackBlockElement> = z.lazy(() =>
  z.object({
    type: z.union([
      slackActionTypeSchema,
      z.literal('image'),
      z.literal('plain_text'),
      z.literal('mrkdwn'),
    ]),
    action_id: z.string().optional(),
    text: slackTextObjectSchema.optional(),
    style: slackButtonStyleSchema.optional(),
    value: z.string().optional(),
    url: z.string().url().optional(),
    image_url: z.string().url().optional(),
    alt_text: z.string().optional(),
    placeholder: slackTextObjectSchema.optional(),
    options: z.array(
      z.object({
        text: slackTextObjectSchema,
        value: z.string(),
      })
    ).optional(),
  })
);

/**
 * Slack Block Type
 */
interface SlackBlock {
  type: z.infer<typeof slackBlockTypeSchema>;
  block_id?: string;
  text?: z.infer<typeof slackTextObjectSchema>;
  accessory?: SlackBlockElement;
  fields?: Array<z.infer<typeof slackTextObjectSchema>>;
  elements?: SlackBlockElement[];
  image_url?: string;
  alt_text?: string;
  title?: z.infer<typeof slackTextObjectSchema>;
}

/**
 * Slack Block Schema
 */
export const slackBlockSchema: z.ZodType<SlackBlock> = z.lazy(() =>
  z.object({
    type: slackBlockTypeSchema,
    block_id: z.string().optional(),
    text: slackTextObjectSchema.optional(),
    accessory: slackBlockElementSchema.optional(),
    fields: z.array(slackTextObjectSchema).optional(),
    elements: z.array(slackBlockElementSchema).optional(),
    image_url: z.string().url().optional(),
    alt_text: z.string().optional(),
    title: slackTextObjectSchema.optional(),
  })
);

/**
 * Slack Attachment Field Schema
 */
export const slackAttachmentFieldSchema = z.object({
  title: z.string().min(1),
  value: z.string().min(1),
  short: z.boolean().optional(),
});

/**
 * Slack Attachment Schema
 */
export const slackAttachmentSchema = z.object({
  color: z.string().optional(),
  author_name: z.string().optional(),
  author_link: z.string().url().optional(),
  author_icon: z.string().url().optional(),
  title: z.string().optional(),
  title_link: z.string().url().optional(),
  text: z.string().optional(),
  pretext: z.string().optional(),
  image_url: z.string().url().optional(),
  thumb_url: z.string().url().optional(),
  fields: z.array(slackAttachmentFieldSchema).optional(),
  footer: z.string().optional(),
  footer_icon: z.string().url().optional(),
  ts: z.number().optional(),
});

/**
 * Slack Message Mentions Schema
 */
export const slackMessageMentionsSchema = z.object({
  users: z.array(z.string()).optional(),
  channel: z.boolean().optional(),
  here: z.boolean().optional(),
});

/**
 * Send Slack Message Request Schema
 */
export const sendSlackMessageSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  channelId: z.string().min(1, 'Channel ID is required'),
  text: z.string().min(1, 'Message text is required').max(40000),
  type: slackMessageTypeSchema.default('text'),
  priority: slackMessagePrioritySchema.default('medium'),
  category: notificationCategorySchema,
  blocks: z.array(slackBlockSchema).max(50).optional(),
  attachments: z.array(slackAttachmentSchema).max(20).optional(),
  threadTs: z.string().optional(),
  userId: z.string().optional(),
  mentions: slackMessageMentionsSchema.optional(),
  metadata: z.record(z.unknown()).optional(),
  scheduledAt: z.string().datetime().optional(),
});

export type SendSlackMessageInput = z.infer<typeof sendSlackMessageSchema>;

/**
 * Create Channel Mapping Request Schema
 */
export const createChannelMappingSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  category: notificationCategorySchema,
  channelId: z.string().min(1, 'Channel ID is required'),
  channelName: z.string().min(1, 'Channel name is required'),
  minPriority: notificationPrioritySchema.default('low'),
  enabled: z.boolean().default(true),
});

export type CreateChannelMappingInput = z.infer<typeof createChannelMappingSchema>;

/**
 * Update Channel Mapping Request Schema
 */
export const updateChannelMappingSchema = z.object({
  channelId: z.string().optional(),
  channelName: z.string().optional(),
  minPriority: notificationPrioritySchema.optional(),
  enabled: z.boolean().optional(),
});

export type UpdateChannelMappingInput = z.infer<typeof updateChannelMappingSchema>;

/**
 * Create User Mapping Request Schema
 */
export const createUserMappingSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  platformUserId: z.string().min(1, 'Platform user ID is required'),
  slackUserId: z.string().min(1, 'Slack user ID is required'),
  preferences: z.object({
    dmCategories: z.array(notificationCategorySchema).default([]),
    mutedCategories: z.array(notificationCategorySchema).default([]),
  }).default({
    dmCategories: [],
    mutedCategories: [],
  }),
  enabled: z.boolean().default(true),
});

export type CreateUserMappingInput = z.infer<typeof createUserMappingSchema>;

/**
 * Update User Mapping Request Schema
 */
export const updateUserMappingSchema = z.object({
  slackUserId: z.string().optional(),
  preferences: z.object({
    dmCategories: z.array(notificationCategorySchema).optional(),
    mutedCategories: z.array(notificationCategorySchema).optional(),
  }).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateUserMappingInput = z.infer<typeof updateUserMappingSchema>;

/**
 * Update Workspace Settings Request Schema
 */
export const updateWorkspaceSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  quietHours: slackQuietHoursSchema.optional(),
  rateLimit: slackRateLimitSchema.optional(),
  batching: slackBatchingSchema.optional(),
  threading: slackThreadingSchema.optional(),
  mentions: slackMentionsSchema.optional(),
});

export type UpdateWorkspaceSettingsInput = z.infer<typeof updateWorkspaceSettingsSchema>;

/**
 * List Channels Request Schema
 */
export const listChannelsSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  types: z.array(slackChannelTypeSchema).optional(),
  excludeArchived: z.boolean().default(true),
  limit: z.number().int().min(1).max(1000).default(100),
  cursor: z.string().optional(),
});

export type ListChannelsInput = z.infer<typeof listChannelsSchema>;

/**
 * Get Channel Request Schema
 */
export const getChannelSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  channelId: z.string().min(1, 'Channel ID is required'),
});

export type GetChannelInput = z.infer<typeof getChannelSchema>;

/**
 * List Users Request Schema
 */
export const listUsersSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  limit: z.number().int().min(1).max(1000).default(100),
  cursor: z.string().optional(),
});

export type ListUsersInput = z.infer<typeof listUsersSchema>;

/**
 * Create Message Template Request Schema
 */
export const createMessageTemplateSchema = z.object({
  name: z.string().min(1).max(100, 'Template name must be 100 characters or less'),
  description: z.string().max(500).optional(),
  category: notificationCategorySchema,
  template: z.object({
    text: z.string().min(1, 'Template text is required'),
    blocks: z.array(slackBlockSchema).optional(),
    attachments: z.array(slackAttachmentSchema).optional(),
  }),
  requiredVariables: z.array(z.string()),
  optionalVariables: z.array(z.string()).optional(),
  defaultPriority: slackMessagePrioritySchema.default('medium'),
  useThreading: z.boolean().default(false),
  enabled: z.boolean().default(true),
});

export type CreateMessageTemplateInput = z.infer<typeof createMessageTemplateSchema>;

/**
 * OAuth Callback Request Schema
 */
export const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'OAuth code is required'),
  state: z.string().min(1, 'OAuth state is required'),
});

export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;

/**
 * Slack Event Request Schema
 * For webhook events from Slack
 */
export const slackEventRequestSchema = z.object({
  token: z.string(),
  team_id: z.string(),
  api_app_id: z.string(),
  event: z.object({
    type: z.string(),
    user: z.string().optional(),
    channel: z.string().optional(),
    ts: z.string().optional(),
    thread_ts: z.string().optional(),
    text: z.string().optional(),
  }).passthrough(),
  type: z.enum(['url_verification', 'event_callback']),
  challenge: z.string().optional(),
  event_id: z.string().optional(),
  event_time: z.number().optional(),
});

export type SlackEventRequest = z.infer<typeof slackEventRequestSchema>;

/**
 * Slack Interactive Request Schema
 * For interactive component callbacks
 */
export const slackInteractiveRequestSchema = z.object({
  type: z.enum(['block_actions', 'view_submission', 'view_closed', 'shortcut', 'message_action']),
  team: z.object({
    id: z.string(),
    domain: z.string(),
  }).passthrough(),
  user: z.object({
    id: z.string(),
    username: z.string().optional(),
    name: z.string().optional(),
  }).passthrough(),
  channel: z.object({
    id: z.string(),
    name: z.string().optional(),
  }).passthrough().optional(),
  message: z.object({
    ts: z.string(),
    thread_ts: z.string().optional(),
  }).passthrough().optional(),
  actions: z.array(
    z.object({
      action_id: z.string(),
      block_id: z.string().optional(),
      type: z.string(),
      value: z.string().optional(),
      selected_option: z.object({
        value: z.string(),
      }).optional(),
    }).passthrough()
  ).optional(),
  response_url: z.string().url().optional(),
  trigger_id: z.string().optional(),
});

export type SlackInteractiveRequest = z.infer<typeof slackInteractiveRequestSchema>;

/**
 * Verify Webhook Signature Request
 */
export const verifyWebhookSignatureSchema = z.object({
  timestamp: z.string().min(1),
  signature: z.string().min(1),
  body: z.string().min(1),
});

export type VerifyWebhookSignatureInput = z.infer<typeof verifyWebhookSignatureSchema>;

/**
 * Pagination Schema
 */
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(1000).default(100),
  cursor: z.string().optional(),
});

/**
 * Analytics Query Schema
 */
export const slackAnalyticsQuerySchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  category: notificationCategorySchema.optional(),
  eventType: z.enum([
    'message_sent',
    'message_failed',
    'message_clicked',
    'button_clicked',
    'link_clicked',
    'thread_replied',
  ]).optional(),
  ...paginationSchema.shape,
});

export type SlackAnalyticsQuery = z.infer<typeof slackAnalyticsQuerySchema>;

/**
 * Disconnect Workspace Request Schema
 */
export const disconnectWorkspaceSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  reason: z.string().max(500).optional(),
});

export type DisconnectWorkspaceInput = z.infer<typeof disconnectWorkspaceSchema>;

/**
 * Test Connection Request Schema
 */
export const testConnectionSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
});

export type TestConnectionInput = z.infer<typeof testConnectionSchema>;

/**
 * Helper function to validate and parse input
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}
