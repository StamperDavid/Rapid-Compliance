/**
 * Notification System
 *
 * Production-ready notification delivery system for all AI features.
 *
 * @module lib/notifications
 *
 * Features:
 * - Multi-channel delivery (Slack, email, webhook, in-app, SMS)
 * - Template-based notifications with variable interpolation
 * - Signal Bus integration for all 11 AI features
 * - User preference management (channels, quiet hours, batching)
 * - Smart batching to reduce notification fatigue
 * - Retry logic with exponential backoff
 * - Delivery tracking and analytics
 * - Rate limiting per channel
 *
 * @example Basic Usage
 * ```typescript
 * import { NotificationService, DEFAULT_ORG_ID } from '@/lib/notifications';
 *
 * // Send a notification
 * const service = new NotificationService(DEFAULT_ORG_ID);
 * const notification = await service.sendNotification(
 *   'user_456',
 *   'deal_risk_critical',
 *   {
 *     orgId: DEFAULT_ORG_ID,
 *     dealId: 'deal_789',
 *     dealName: 'Acme Corp',
 *     riskLevel: 'critical',
 *     riskProbability: 85,
 *   }
 * );
 * ```
 *
 * @example Initialize Signal Handlers
 * ```typescript
 * import { initializeNotificationHandlers } from '@/lib/notifications';
 *
 * // Start listening for signals
 * initializeNotificationHandlers();
 * ```
 *
 * @example Seed Templates
 * ```typescript
 * import { seedNotificationTemplates } from '@/lib/notifications';
 *
 * // Create all notification templates
 * await seedNotificationTemplates();
 * ```
 */

import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// Core Service
export { NotificationService } from './notification-service';

// Signal Handlers
export {
  initializeNotificationHandlers,
  signalHandlers,
  handleDealRiskCritical,
  handleDealRiskHigh,
  handleConversationLowScore,
  handleConversationRedFlag,
  handleCompetitorMentioned,
  handlePositiveSignal,
  handleCoachingInsightsGenerated,
  handleTopPerformerIdentified,
  handleImprovementOpportunity,
  handlePlaybookGenerated,
  handlePatternIdentified,
  handleSequenceUnderperforming,
  handleOptimizationNeeded,
  handleLeadRouted,
  handleEmailGenerated,
  handleWorkflowExecuted,
  handleQuotaAtRisk,
  handleQuotaAchieved,
} from './signal-handlers';

// Templates
export { getAllTemplates } from './templates';

// Types
export type {
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  NotificationCategory,
  NotificationVariables,
  SlackBlock,
  SlackAttachment,
  NotificationTemplate,
  NotificationPreferences,
  Notification,
  NotificationBatch,
  NotificationStats,
  NotificationQueueItem,
} from './types';

// Validation
export {
  notificationChannelSchema,
  notificationPrioritySchema,
  notificationStatusSchema,
  notificationCategorySchema,
  notificationVariablesSchema,
  slackBlockSchema,
  slackAttachmentSchema,
  notificationTemplateSchema,
  quietHoursSchema,
  notificationPreferencesSchema,
  notificationContentSchema,
  notificationSchema,
  notificationBatchSchema,
  sendNotificationRequestSchema,
  updatePreferencesRequestSchema,
  markAsReadRequestSchema,
  getNotificationsRequestSchema,
  getStatisticsRequestSchema,
  testNotificationRequestSchema,
} from './validation';

export type {
  SendNotificationRequest,
  UpdatePreferencesRequest,
  MarkAsReadRequest,
  GetNotificationsRequest,
  GetStatisticsRequest,
  TestNotificationRequest,
} from './validation';

/**
 * Seed notification templates to Firestore
 *
 * Call this once during organization setup to create all templates.
 *
 * @returns Number of templates created
 *
 * @example
 * ```typescript
 * const count = await seedNotificationTemplates();
 * console.log(`Created ${count} notification templates`);
 * ```
 */
export async function seedNotificationTemplates(): Promise<number> {
  const orgId = DEFAULT_ORG_ID;
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  const { getAllTemplates } = await import('./templates');
  
  const templates = getAllTemplates();
  
  const createPromises = templates.map((template) =>
    FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/notification_templates`,
      template.id,
      template
    )
  );
  
  await Promise.all(createPromises);
  
  return templates.length;
}
