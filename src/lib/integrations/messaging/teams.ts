/**
 * Microsoft Teams Function Executor
 * Allows AI agent to call Teams functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import { sendTeamsMessage, listTeams, listChannels } from '../teams-service';

/**
 * Execute a Teams function
 */
export async function executeTeamsFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const accessToken = (integration.accessToken !== '' && integration.accessToken != null) ? integration.accessToken : '';

  if (!accessToken) {
    throw new Error('Teams access token not configured');
  }
  
  switch (functionName) {
    case 'sendMessage':
      // Validate required parameters
      if (!parameters.teamId || typeof parameters.teamId !== 'string') {
        throw new Error('teamId (string) is required for sendMessage');
      }
      if (!parameters.channelId || typeof parameters.channelId !== 'string') {
        throw new Error('channelId (string) is required for sendMessage');
      }
      if (!parameters.message || typeof parameters.message !== 'string') {
        throw new Error('message (string) is required for sendMessage');
      }
      
      return sendTeamsMessage(accessToken, {
        teamId: parameters.teamId,
        channelId: parameters.channelId,
        message: parameters.message,
      });
      
    case 'listTeams':
      // No parameters required
      return listTeams(accessToken);
      
    case 'listChannels':
      // Validate required parameters
      if (!parameters.teamId || typeof parameters.teamId !== 'string') {
        throw new Error('teamId (string) is required for listChannels');
      }
      
      return listChannels(accessToken, parameters.teamId);
      
    default:
      throw new Error(`Unknown Teams function: ${functionName}`);
  }
}
