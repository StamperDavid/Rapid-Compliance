/**
 * Slack Integration Module
 * 
 * Production-ready Slack integration for real-time sales notifications.
 * 
 * Features:
 * - OAuth 2.0 authentication
 * - Message sending with rich formatting
 * - Channel and user management
 * - Signal Bus integration
 * - Rate limiting and retry logic
 * 
 * Usage:
 * ```typescript
 * import { createSlackService, SlackSignalHandler } from '@/lib/slack';
 * 
 * // Create service
 * const slackService = createSlackService();
 * 
 * // Send message
 * await slackService.sendMessage(workspace, message);
 * 
 * // Initialize signal handlers
 * const handler = initializeSlackHandlers(dal, slackService);
 * ```
 */

// Types
export type {
  SlackMessage,
  SlackWorkspace,
  SlackChannel,
  SlackChannelMapping,
  SlackUserMapping,
  SlackMessageTemplate,
  SlackBlock,
  SlackAttachment,
  SlackBlockElement,
  SlackAPIError,
  SlackRateLimitInfo,
  SlackServiceConfig,
  SlackMessagePriority,
  SlackMessageType,
  SlackChannelType,
  SlackConnectionStatus,
  SlackBlockType,
  SlackActionType,
  SlackButtonStyle,
  SlackWorkspaceSettings,
  SlackAnalyticsEvent,
  SlackOAuthState,
} from './types';

// Validation schemas
export {
  slackMessagePrioritySchema,
  slackMessageTypeSchema,
  slackChannelTypeSchema,
  slackConnectionStatusSchema,
  slackBlockTypeSchema,
  slackActionTypeSchema,
  slackButtonStyleSchema,
  slackQuietHoursSchema,
  slackRateLimitSchema,
  slackBatchingSchema,
  slackThreadingSchema,
  slackMentionsSchema,
  slackWorkspaceSettingsSchema,
  slackTextObjectSchema,
  slackBlockElementSchema,
  slackBlockSchema,
  slackAttachmentFieldSchema,
  slackAttachmentSchema,
  slackMessageMentionsSchema,
  sendSlackMessageSchema,
  createChannelMappingSchema,
  updateChannelMappingSchema,
  createUserMappingSchema,
  updateUserMappingSchema,
  updateWorkspaceSettingsSchema,
  listChannelsSchema,
  getChannelSchema,
  listUsersSchema,
  createMessageTemplateSchema,
  oauthCallbackSchema,
  slackEventRequestSchema,
  slackInteractiveRequestSchema,
  verifyWebhookSignatureSchema,
  slackAnalyticsQuerySchema,
  disconnectWorkspaceSchema,
  testConnectionSchema,
  validateInput,
} from './validation';

export type {
  SendSlackMessageInput,
  CreateChannelMappingInput,
  UpdateChannelMappingInput,
  CreateUserMappingInput,
  UpdateUserMappingInput,
  UpdateWorkspaceSettingsInput,
  ListChannelsInput,
  GetChannelInput,
  ListUsersInput,
  CreateMessageTemplateInput,
  OAuthCallbackInput,
  SlackEventRequest,
  SlackInteractiveRequest,
  VerifyWebhookSignatureInput,
  SlackAnalyticsQuery,
  DisconnectWorkspaceInput,
  TestConnectionInput,
} from './validation';

// Services
export { SlackService, createSlackService } from './slack-service';
export { SlackMessageBuilder } from './message-builder';
export { SlackSignalHandler, initializeSlackHandlers } from './signal-handlers';
