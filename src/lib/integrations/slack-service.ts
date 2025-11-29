/**
 * Slack Integration Service
 * Handles Slack API operations
 */

import { getValidAccessToken } from './oauth-service';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

export interface SlackMessage {
  channel: string;
  text?: string;
  blocks?: any[];
  thread_ts?: string;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}

/**
 * Send Slack message
 */
export async function sendSlackMessage(
  organizationId: string,
  integrationId: string,
  message: SlackMessage
): Promise<{ success: boolean; ts?: string; error?: string }> {
  try {
    const accessToken = await getValidAccessToken(organizationId, integrationId);
    
    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
    
    const data = await response.json();
    
    if (data.ok) {
      return { success: true, ts: data.ts };
    } else {
      return { success: false, error: data.error || 'Failed to send message' };
    }
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Get Slack channels
 */
export async function getSlackChannels(
  organizationId: string,
  integrationId: string
): Promise<Array<{ id: string; name: string; is_private: boolean }>> {
  try {
    const accessToken = await getValidAccessToken(organizationId, integrationId);
    
    const response = await fetch('https://slack.com/api/conversations.list', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    const data = await response.json();
    
    if (data.ok) {
      return data.channels.map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        is_private: ch.is_private,
      }));
    } else {
      throw new Error(data.error || 'Failed to get channels');
    }
  } catch (error: any) {
    throw new Error(`Failed to get Slack channels: ${error.message}`);
  }
}

/**
 * Send workflow notification to Slack
 */
export async function sendWorkflowNotification(
  organizationId: string,
  workspaceId: string,
  workflowId: string,
  execution: any
): Promise<void> {
  // Get Slack integration
  const integrations = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrations`,
    []
  );
  
  const slackIntegration = integrations.find((i: any) => i.id === 'slack' && i.status === 'connected');
  
  if (!slackIntegration) {
    return; // No Slack integration
  }
  
  const settings = (slackIntegration as any).settings;
  if (!settings?.notifications?.newDeal) {
    return; // Notifications disabled
  }
  
  const channel = settings.channels?.deals || settings.channels?.general;
  if (!channel) {
    return; // No channel configured
  }
  
  // Build message
  const message: SlackMessage = {
    channel,
    text: `Workflow executed: ${execution.workflowId}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: 'Workflow Execution',
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Status:* ${execution.status}`,
          },
          {
            type: 'mrkdwn',
            text: `*Actions:* ${execution.actionResults?.length || 0}`,
          },
        ],
      },
    ],
  };
  
  await sendSlackMessage(organizationId, slackIntegration.id, message);
}

