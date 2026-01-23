/**
 * Slack Function Executor
 * Allows AI agent to call Slack functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import {
  sendMessage,
  listChannels,
  createChannel,
  type SlackAttachment,
  type SlackBlock,
} from '../slack-service';

/**
 * Execute a Slack function
 */
export async function executeSlackFunction(
  functionName: string,
  parameters: Record<string, unknown>,
  integration: ConnectedIntegration
): Promise<unknown> {
  const accessToken = (integration.accessToken !== '' && integration.accessToken != null) ? integration.accessToken : '';

  if (!accessToken) {
    throw new Error('Slack access token not configured');
  }

  switch (functionName) {
    case 'sendMessage':
      // Validate required parameters
      if (!parameters.channel || typeof parameters.channel !== 'string') {
        throw new Error('channel (string) is required for sendMessage');
      }
      if (!parameters.text || typeof parameters.text !== 'string') {
        throw new Error('text (string) is required for sendMessage');
      }

      return sendMessage(accessToken, {
        channel: parameters.channel,
        text: parameters.text,
        attachments: Array.isArray(parameters.attachments)
          ? parameters.attachments as SlackAttachment[]
          : undefined,
        blocks: Array.isArray(parameters.blocks)
          ? parameters.blocks as SlackBlock[]
          : undefined,
      });

    case 'createChannel':
      // Validate required parameters
      if (!parameters.name || typeof parameters.name !== 'string') {
        throw new Error('name (string) is required for createChannel');
      }

      return createChannel(
        accessToken,
        parameters.name,
        (parameters.isPrivate as boolean | undefined) ?? false
      );

    case 'listChannels':
      // No parameters required
      return listChannels(accessToken);

    default:
      throw new Error(`Unknown Slack function: ${functionName}`);
  }
}
