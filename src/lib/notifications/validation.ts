/**
 * Notification Validation Schemas
 * 
 * Comprehensive Zod schemas for type-safe notification operations.
 * All inputs are validated before processing to ensure data integrity.
 */

import { z } from 'zod';

/**
 * Notification Channel Schema
 */
export const notificationChannelSchema = z.enum([
  'slack',
  'email',
  'webhook',
  'in_app',
  'sms',
]);

/**
 * Notification Priority Schema
 */
export const notificationPrioritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);

/**
 * Notification Status Schema
 */
export const notificationStatusSchema = z.enum([
  'pending',
  'sent',
  'delivered',
  'failed',
  'retrying',
  'cancelled',
]);

/**
 * Notification Category Schema
 */
export const notificationCategorySchema = z.enum([
  'deal_risk',
  'conversation',
  'coaching',
  'team_performance',
  'playbook',
  'sequence',
  'lead_routing',
  'email_writer',
  'workflow',
  'analytics',
  'forecasting',
  'deal_scoring',
  'battlecard',
  'discovery',
  'system',
]);

/**
 * Notification Variables Schema
 */
export const notificationVariablesSchema = z.object({
  // Organization context
  orgName: z.string().optional(),
  workspaceId: z.string().optional(),
  
  // User context
  userId: z.string().optional(),
  userName: z.string().optional(),
  userEmail: z.string().email().optional(),
  
  // Deal context
  dealId: z.string().optional(),
  dealName: z.string().optional(),
  dealValue: z.number().optional(),
  dealStage: z.string().optional(),
  
  // Lead context
  leadId: z.string().optional(),
  leadName: z.string().optional(),
  leadEmail: z.string().email().optional(),
  leadCompany: z.string().optional(),
}).catchall(z.any()); // Allow additional custom variables

/**
 * Slack Block Schema
 */
export const slackBlockSchema = z.object({
  type: z.string(),
}).catchall(z.any()); // Flexible to support all Slack block types

/**
 * Slack Attachment Schema
 */
export const slackAttachmentSchema = z.object({
  color: z.string().optional(),
  pretext: z.string().optional(),
  text: z.string().optional(),
  fields: z.array(z.object({
    title: z.string(),
    value: z.string(),
    short: z.boolean().optional(),
  })).optional(),
  footer: z.string().optional(),
  footer_icon: z.string().url().optional(),
  ts: z.number().optional(),
});

/**
 * Notification Template Schema
 */
export const notificationTemplateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  category: notificationCategorySchema,
  signalTypes: z.array(z.string()).min(1),
  priority: notificationPrioritySchema,
  channels: z.array(notificationChannelSchema).min(1),
  
  slack: z.object({
    text: z.string().min(1).max(3000),
    blocks: z.array(slackBlockSchema).optional(),
    attachments: z.array(slackAttachmentSchema).optional(),
    threadKey: z.string().optional(),
    unfurlLinks: z.boolean().optional(),
    unfurlMedia: z.boolean().optional(),
  }).optional(),
  
  email: z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(1),
    htmlBody: z.string().optional(),
    fromName: z.string().optional(),
    replyTo: z.string().email().optional(),
  }).optional(),
  
  webhook: z.object({
    method: z.enum(['POST', 'PUT', 'PATCH']),
    body: z.record(z.any()),
    headers: z.record(z.string()).optional(),
  }).optional(),
  
  inApp: z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(1000),
    icon: z.string().optional(),
    actionUrl: z.string().url().optional(),
    actions: z.array(z.object({
      label: z.string().min(1).max(50),
      url: z.string().url(),
      style: z.enum(['primary', 'default', 'danger']).optional(),
    })).optional(),
  }).optional(),
  
  metadata: z.object({
    description: z.string().min(1).max(500),
    requiredVariables: z.array(z.string()),
    optionalVariables: z.array(z.string()).optional(),
    version: z.string(),
    createdAt: z.any(), // Firestore Timestamp
    updatedAt: z.any(), // Firestore Timestamp
  }),
});

/**
 * Quiet Hours Schema
 */
export const quietHoursSchema = z.object({
  enabled: z.boolean(),
  start: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  end: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format (HH:MM)'),
  timezone: z.string().min(1), // IANA timezone
});

/**
 * Notification Preferences Schema
 */
export const notificationPreferencesSchema = z.object({
  userId: z.string().min(1),
  enabled: z.boolean(),
  
  channels: z.object({
    slack: z.object({
      enabled: z.boolean(),
      channelId: z.string().optional(),
      threadMessages: z.boolean().optional(),
      quietHours: quietHoursSchema.optional(),
    }).optional(),
    
    email: z.object({
      enabled: z.boolean(),
      address: z.string().email().optional(),
      digest: z.boolean().optional(),
      digestTime: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    }).optional(),
    
    webhook: z.object({
      enabled: z.boolean(),
      url: z.string().url().optional(),
      secret: z.string().optional(),
    }).optional(),
    
    inApp: z.object({
      enabled: z.boolean(),
      sound: z.boolean().optional(),
      desktop: z.boolean().optional(),
    }).optional(),
  }),
  
  categories: z.record(
    notificationCategorySchema,
    z.object({
      enabled: z.boolean(),
      channels: z.array(notificationChannelSchema).optional(),
      minPriority: notificationPrioritySchema.optional(),
    })
  ),
  
  batching: z.object({
    enabled: z.boolean(),
    windowMinutes: z.number().int().min(1).max(1440),
    maxPerBatch: z.number().int().min(1).max(100),
    bypassPriorities: z.array(notificationPrioritySchema),
  }),
  
  metadata: z.object({
    createdAt: z.any(), // Firestore Timestamp
    updatedAt: z.any(), // Firestore Timestamp
  }),
});

/**
 * Notification Content Schema
 */
export const notificationContentSchema = z.object({
  slack: z.object({
    text: z.string().min(1).max(3000),
    blocks: z.array(slackBlockSchema).optional(),
    attachments: z.array(slackAttachmentSchema).optional(),
    channel: z.string().optional(),
    threadTs: z.string().optional(),
  }).optional(),
  
  email: z.object({
    subject: z.string().min(1).max(200),
    body: z.string().min(1),
    htmlBody: z.string().optional(),
    to: z.string().email(),
  }).optional(),
  
  webhook: z.object({
    url: z.string().url(),
    method: z.string(),
    body: z.record(z.any()),
    headers: z.record(z.string()).optional(),
  }).optional(),
  
  inApp: z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(1000),
    icon: z.string().optional(),
    actionUrl: z.string().url().optional(),
  }).optional(),
});

/**
 * Notification Schema
 */
export const notificationSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1),
  templateId: z.string().min(1),
  category: notificationCategorySchema,
  priority: notificationPrioritySchema,
  channels: z.array(notificationChannelSchema).min(1),
  status: notificationStatusSchema,
  variables: notificationVariablesSchema,
  content: notificationContentSchema,
  
  delivery: z.object({
    attempts: z.record(notificationChannelSchema, z.number().int().min(0)),
    lastAttempt: z.record(notificationChannelSchema, z.any().nullable()),
    deliveredAt: z.record(notificationChannelSchema, z.any().nullable()),
    errors: z.record(notificationChannelSchema, z.string().nullable()),
    responses: z.record(notificationChannelSchema, z.any()),
  }),
  
  retry: z.object({
    maxAttempts: z.number().int().min(1).max(10),
    backoffMultiplier: z.number().min(1).max(10),
    nextRetryAt: z.any().nullable(), // Firestore Timestamp
  }),
  
  signalId: z.string().optional(),
  signalType: z.string().optional(),
  
  metadata: z.object({
    createdAt: z.any(), // Firestore Timestamp
    updatedAt: z.any(), // Firestore Timestamp
    scheduledFor: z.any().optional(), // Firestore Timestamp
    batchId: z.string().optional(),
    read: z.boolean().optional(),
    readAt: z.any().nullable().optional(), // Firestore Timestamp
  }),
});

/**
 * Notification Batch Schema
 */
export const notificationBatchSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1),
  channel: notificationChannelSchema,
  notificationIds: z.array(z.string()).min(1),
  status: z.enum(['pending', 'processing', 'sent', 'failed']),
  scheduledFor: z.any(), // Firestore Timestamp
  deliveredAt: z.any().nullable(), // Firestore Timestamp
  error: z.string().optional(),
  
  metadata: z.object({
    createdAt: z.any(), // Firestore Timestamp
    updatedAt: z.any(), // Firestore Timestamp
  }),
});

/**
 * API Request Schemas
 */

/**
 * Send Notification Request
 */
export const sendNotificationRequestSchema = z.object({
  userId: z.string().min(1),
  templateId: z.string().min(1),
  variables: notificationVariablesSchema,
  channels: z.array(notificationChannelSchema).optional(),
  priority: notificationPrioritySchema.optional(),
  scheduledFor: z.string().datetime().optional(), // ISO 8601
});

/**
 * Update Preferences Request
 * Using deepPartial() to allow partial updates of nested objects
 */
export const updatePreferencesRequestSchema = notificationPreferencesSchema.deepPartial().extend({
  userId: z.string().min(1),
});

/**
 * Mark as Read Request
 */
export const markAsReadRequestSchema = z.object({
  notificationIds: z.array(z.string()).min(1).max(100),
});

/**
 * Get Notifications Request
 */
export const getNotificationsRequestSchema = z.object({
  userId: z.string().optional(),
  categories: z.array(notificationCategorySchema).optional(),
  statuses: z.array(notificationStatusSchema).optional(),
  channels: z.array(notificationChannelSchema).optional(),
  unreadOnly: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).optional().default(50),
  startAfter: z.string().optional(), // Cursor for pagination
});

/**
 * Get Statistics Request
 */
export const getStatisticsRequestSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month']).optional(),
});

/**
 * Test Notification Request
 */
export const testNotificationRequestSchema = z.object({
  channel: notificationChannelSchema,
  templateId: z.string().min(1),
  variables: notificationVariablesSchema.optional(),
});

/**
 * Export validated types
 */
export type SendNotificationRequest = z.infer<typeof sendNotificationRequestSchema>;
export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesRequestSchema>;
export type MarkAsReadRequest = z.infer<typeof markAsReadRequestSchema>;
export type GetNotificationsRequest = z.infer<typeof getNotificationsRequestSchema>;
export type GetStatisticsRequest = z.infer<typeof getStatisticsRequestSchema>;
export type TestNotificationRequest = z.infer<typeof testNotificationRequestSchema>;
