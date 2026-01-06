/**
 * Gmail Function Executor
 * Allows AI agent to call Gmail functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import { sendGmailEmail, listEmails, getEmail } from '../gmail-service';

/**
 * Execute a Gmail function
 */
export async function executeGmailFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const tokens = {
    access_token: integration.accessToken || '',
    refresh_token: integration.refreshToken,
  };
  
  if (!tokens.access_token) {
    throw new Error('Gmail access token not configured');
  }
  
  switch (functionName) {
    case 'sendEmail':
      // Validate required parameters
      if (!parameters.to || typeof parameters.to !== 'string') {
        throw new Error('to (string) is required for sendEmail');
      }
      if (!parameters.subject || typeof parameters.subject !== 'string') {
        throw new Error('subject (string) is required for sendEmail');
      }
      if (!parameters.body || typeof parameters.body !== 'string') {
        throw new Error('body (string) is required for sendEmail');
      }
      
      return sendGmailEmail(tokens, {
        to: parameters.to,
        subject: parameters.subject,
        body: parameters.body,
        inReplyTo: parameters.inReplyTo,
        references: parameters.references,
      });
      
    case 'searchEmails':
      // Validate required parameters
      if (!parameters.query || typeof parameters.query !== 'string') {
        throw new Error('query (string) is required for searchEmails');
      }
      
      return listEmails(tokens, {
        query: parameters.query,
        maxResults: parameters.maxResults || 10,
      });
      
    case 'getEmail':
      // Validate required parameters
      if (!parameters.messageId || typeof parameters.messageId !== 'string') {
        throw new Error('messageId (string) is required for getEmail');
      }
      
      return getEmail(tokens, parameters.messageId);
      
    default:
      throw new Error(`Unknown Gmail function: ${functionName}`);
  }
}
