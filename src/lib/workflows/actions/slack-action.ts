/**
 * Slack Workflow Action
 * Sends messages to Slack channels or users
 */

import type { BaseAction } from '@/types/workflow';

export interface SlackActionConfig extends BaseAction {
  type: 'send_slack';
  config: {
    channelId?: string;         // Slack channel ID (e.g., C01234567)
    channelName?: string;       // Channel name (alternative to ID)
    userId?: string;            // User ID for DM
    userEmail?: string;         // User email for DM (alternative to ID)
    message: string;            // Message text with {{variable}} placeholders
    blocks?: Array<unknown>;             // Slack Block Kit blocks for rich formatting
    threadTs?: string;          // Thread timestamp for replies
    unfurlLinks?: boolean;      // Expand link previews
    unfurlMedia?: boolean;      // Expand media previews
    asBot?: boolean;            // Post as bot (default: true)
    botName?: string;           // Custom bot name
    botIcon?: string;           // Custom bot icon URL or emoji
  };
}

// Slack API Response Types
interface SlackIntegration {
  accessToken?: string;
  token?: string;
}

interface SlackChannel {
  id: string;
  name: string;
}

interface SlackUser {
  id: string;
}

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  ts?: string;
  channels?: SlackChannel[];
  user?: SlackUser;
}

export async function executeSlackAction(
  action: SlackActionConfig,
  triggerData: Record<string, unknown>,
  organizationId: string
): Promise<Record<string, unknown>> {
  const {
    channelId,
    channelName,
    userId,
    userEmail,
    message,
    blocks,
    threadTs,
    unfurlLinks = true,
    unfurlMedia = true,
    asBot = true,
    botName,
    botIcon,
  } = action.config;

  // Get Slack credentials
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');

  let slackToken: string | null = null;

  try {
    // Check for organization-level Slack integration
    const integration = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
      'slack'
    );
    const typedIntegration = integration as SlackIntegration | null;
    slackToken = typedIntegration?.accessToken ?? typedIntegration?.token ?? null;
  } catch {
    // No integration found
  }

  if (!slackToken) {
    throw new Error('Slack integration not configured. Please connect Slack in Settings → Integrations.');
  }

  // Determine target (channel or user)
  let target: string;
  
  if (channelId) {
    target = channelId;
  } else if (channelName) {
    // Look up channel ID by name
    target = await getChannelIdByName(slackToken, channelName);
  } else if (userId) {
    target = userId;
  } else if (userEmail) {
    // Look up user ID by email
    target = await getUserIdByEmail(slackToken, userEmail);
  } else {
    throw new Error('Slack action requires channelId, channelName, userId, or userEmail');
  }

  // Replace template variables in message
  const processedMessage = replaceTemplateVariables(message, triggerData);

  // Process blocks if provided
  const processedBlocks: unknown = blocks
    ? JSON.parse(replaceTemplateVariables(JSON.stringify(blocks), triggerData)) as unknown
    : undefined;

  // Send message via Slack API
  const response = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${slackToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      channel: target,
      text: processedMessage,
      blocks: processedBlocks,
      thread_ts: threadTs,
      unfurl_links: unfurlLinks,
      unfurl_media: unfurlMedia,
      ...(asBot && botName ? { username: botName } : {}),
      ...(asBot && botIcon ? {
        icon_emoji: botIcon.startsWith(':') ? botIcon : undefined,
        icon_url: !botIcon.startsWith(':') ? botIcon : undefined,
      } : {}),
    }),
  });

  const result = await response.json() as SlackApiResponse;

  if (!result.ok) {
    throw new Error(`Slack API error: ${(result.error !== '' && result.error != null) ? result.error : 'Unknown error'}`);
  }

  return {
    success: true,
    channel: target,
    messageTs: result.ts ?? '',
    message: processedMessage,
  };
}

/**
 * Look up Slack channel ID by name
 */
async function getChannelIdByName(token: string, channelName: string): Promise<string> {
  // Remove # prefix if present
  const name = channelName.replace(/^#/, '');

  const response = await fetch('https://slack.com/api/conversations.list', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const result = await response.json() as SlackApiResponse;

  if (!result.ok) {
    throw new Error(`Failed to list Slack channels: ${result.error ?? 'Unknown error'}`);
  }

  const channel = result.channels?.find((c: SlackChannel) => c.name === name);

  if (!channel) {
    throw new Error(`Slack channel not found: ${channelName}`);
  }

  return channel.id;
}

/**
 * Look up Slack user ID by email
 */
async function getUserIdByEmail(token: string, email: string): Promise<string> {
  const response = await fetch(`https://slack.com/api/users.lookupByEmail?email=${encodeURIComponent(email)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  const result = await response.json() as SlackApiResponse;

  if (!result.ok) {
    if (result.error === 'users_not_found') {
      throw new Error(`Slack user not found with email: ${email}`);
    }
    throw new Error(`Failed to look up Slack user: ${result.error ?? 'Unknown error'}`);
  }

  if (!result.user) {
    throw new Error(`Slack user not found with email: ${email}`);
  }

  return result.user.id;
}

/**
 * Replace {{variable}} placeholders with values from triggerData
 */
function replaceTemplateVariables(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path: string) => {
    const value = getNestedValue(data, path.trim());
    if (value === undefined || value === null) {
      return match;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current != null && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}


