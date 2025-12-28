/**
 * Slack Function Executor
 * Allows AI agent to call Slack functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import { sendMessage, listChannels, createChannel } from '../slack-service';

/**
 * Execute a Slack function
 */
export async function executeSlackFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const accessToken = integration.accessToken || '';
  
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
      
      return await sendMessage(accessToken, {
        channel: parameters.channel,
        text: parameters.text,
        attachments: parameters.attachments,
        blocks: parameters.blocks,
      });
      
    case 'createChannel':
      // Validate required parameters
      if (!parameters.name || typeof parameters.name !== 'string') {
        throw new Error('name (string) is required for createChannel');
      }
      
      return await createChannel(
        accessToken,
        parameters.name,
        parameters.isPrivate || false
      );
      
    case 'listChannels':
      // No parameters required
      return await listChannels(accessToken);
      
    default:
      throw new Error(`Unknown Slack function: ${functionName}`);
  }
}
