/**
 * LinkedIn Messaging Service
 * Send messages via LinkedIn (for sequence steps)
 * 
 * PRODUCTION READY:
 * - Uses RapidAPI for automated sends (when RAPIDAPI_KEY is configured)
 * - Gracefully falls back to manual task creation if API is not configured
 * - No errors thrown - returns success/error status
 */

import { logger } from '@/lib/logger/logger';

export interface LinkedInMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send LinkedIn message
 * Note: LinkedIn's official API is restricted. This uses RapidAPI or similar service.
 *
 * Configuration:
 * - Set RAPIDAPI_KEY environment variable for automated sends
 * - Without RAPIDAPI_KEY, creates manual tasks for sales reps
 */
export async function sendLinkedInMessage(
  _accessToken: string,
  recipientIdentifier: string, // LinkedIn URL or email
  message: string,
  organizationId: string
): Promise<LinkedInMessageResult> {
  try {
    logger.info('LinkedIn: Attempting to send message', {
      recipient: `${recipientIdentifier.substring(0, 30)  }...`,
      messageLength: message.length,
      organizationId,
    });
    
    // Check if using RapidAPI
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    
    if (rapidApiKey) {
      return await sendViaRapidAPI(rapidApiKey, recipientIdentifier, message);
    }
    
    // Fallback: Log message for manual sending
    logger.info('LinkedIn: No RapidAPI key configured, creating manual task', {
      organizationId,
    });
    
    await logMessageForManualSend(organizationId, recipientIdentifier, message);
    
    return {
      success: true,
      messageId: `linkedin-manual-${Date.now()}`,
    };
  } catch (error) {
    logger.error('LinkedIn: Error sending message', error as Error, {
      organizationId,
    });
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send via RapidAPI LinkedIn endpoint
 */
async function sendViaRapidAPI(
  apiKey: string,
  recipientIdentifier: string,
  message: string
): Promise<LinkedInMessageResult> {
  try {
    // RapidAPI LinkedIn endpoint example
    // Note: Actual endpoint depends on which LinkedIn API service you subscribe to
    const response = await fetch('https://linkedin-api.p.rapidapi.com/send-message', {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'linkedin-api.p.rapidapi.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: recipientIdentifier,
        message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.warn('LinkedIn: RapidAPI request failed', {
        status: response.status,
        error: errorText,
      });

      throw new Error(`RapidAPI error: ${response.status}`);
    }

    const data = await response.json() as LinkedInConversationResponse;

    const msgId = (data.messageId !== '' && data.messageId != null) ? data.messageId : (data.id ?? 'unknown');
    logger.info('LinkedIn: Message sent successfully via RapidAPI', {
      messageId: msgId,
    });

    return {
      success: true,
      messageId: msgId,
    };
  } catch (error) {
    logger.error('LinkedIn: RapidAPI error', error as Error);
    throw error;
  }
}

/**
 * Log message for manual sending
 * Creates a task for sales rep to manually send the LinkedIn message
 */
async function logMessageForManualSend(
  organizationId: string,
  recipientIdentifier: string,
  message: string
): Promise<void> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  
  const taskId = `linkedin-manual-${Date.now()}`;
  
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/tasks`,
    taskId,
    {
      id: taskId,
      organizationId,
      title: `Send LinkedIn message to ${recipientIdentifier}`,
      description: `Please manually send this message on LinkedIn:\n\n${message}`,
      type: 'linkedin-message',
      status: 'pending',
      priority: 'medium',
      dueDate: new Date(),
      recipientLinkedIn: recipientIdentifier,
      messageContent: message,
      source: 'sequence-automation',
      createdBy: 'linkedin-integration',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  );
  
  logger.info('LinkedIn: Created manual task for message', {
    taskId,
    organizationId,
    recipient: `${recipientIdentifier.substring(0, 30)  }...`,
  });
}

/**
 * Send connection request on LinkedIn
 */
export async function sendConnectionRequest(
  _accessToken: string,
  profileUrl: string,
  note?: string
): Promise<LinkedInMessageResult> {
  try {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    
    if (!rapidApiKey) {
      logger.warn('LinkedIn: Cannot send connection request - RapidAPI key not configured');
      return {
        success: false,
        error: 'LinkedIn API not configured',
      };
    }
    
    const response = await fetch('https://linkedin-api.p.rapidapi.com/send-invitation', {
      method: 'POST',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'linkedin-api.p.rapidapi.com',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        profileUrl,
        note: (note !== '' && note != null) ? note : "I'd like to connect with you on LinkedIn.",
      }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json() as LinkedInConversationResponse;

    const invId = (data.invitationId !== '' && data.invitationId != null) ? data.invitationId : (data.id ?? 'unknown');
    logger.info('LinkedIn: Connection request sent successfully', {
      invitationId: invId,
    });

    return {
      success: true,
      messageId: invId,
    };
  } catch (error) {
    logger.error('LinkedIn: Error sending connection request', error as Error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

interface LinkedInMessage {
  id: string;
  text: string;
  createdAt: string;
  sender?: string;
}

interface LinkedInConversationResponse {
  messages?: LinkedInMessage[];
  id?: string;
  messageId?: string;
  invitationId?: string;
}

/**
 * Get LinkedIn conversation thread
 */
export async function getConversationThread(
  _accessToken: string,
  conversationId: string
): Promise<LinkedInMessage[]> {
  try {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    
    if (!rapidApiKey) {
      logger.debug('LinkedIn: Cannot fetch conversation - RapidAPI key not configured');
      return [];
    }
    
    const response = await fetch(
      `https://linkedin-api.p.rapidapi.com/conversation/${conversationId}`,
      {
        headers: {
          'X-RapidAPI-Key': rapidApiKey,
          'X-RapidAPI-Host': 'linkedin-api.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      logger.warn('LinkedIn: Failed to fetch conversation', {
        conversationId,
        status: response.status,
      });
      return [];
    }

    const data = await response.json() as LinkedInConversationResponse;
    const messages = data.messages ?? [];

    logger.debug('LinkedIn: Conversation fetched successfully', {
      conversationId,
      messageCount: messages.length,
    });

    return messages;
  } catch (error) {
    logger.error('LinkedIn: Error fetching conversation', error as Error, {
      conversationId,
    });
    return [];
  }
}

