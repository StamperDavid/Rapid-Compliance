/**
 * LinkedIn Messaging Service
 * Send messages via LinkedIn (for sequence steps)
 */

export interface LinkedInMessageResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send LinkedIn message
 * Note: LinkedIn's API is restricted. This uses RapidAPI or similar service.
 */
export async function sendLinkedInMessage(
  accessToken: string,
  recipientIdentifier: string, // LinkedIn URL or email
  message: string,
  organizationId: string
): Promise<LinkedInMessageResult> {
  try {
    // LinkedIn's official API doesn't allow automated messaging
    // Most users would need to use:
    // 1. LinkedIn Sales Navigator API (premium)
    // 2. RapidAPI LinkedIn endpoints
    // 3. Phantombuster or similar automation tools
    
    console.log('[LinkedIn] Attempting to send message:', {
      recipient: recipientIdentifier,
      message: message.substring(0, 50) + '...',
    });
    
    // Check if using RapidAPI
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    
    if (rapidApiKey) {
      return await sendViaRapidAPI(rapidApiKey, recipientIdentifier, message);
    }
    
    // Fallback: Log message for manual sending
    await logMessageForManualSend(organizationId, recipientIdentifier, message);
    
    return {
      success: true,
      messageId: `linkedin-manual-${Date.now()}`,
    };
  } catch (error) {
    console.error('[LinkedIn] Error sending message:', error);
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
        message: message,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`RapidAPI error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      messageId: data.messageId || data.id,
    };
  } catch (error) {
    console.error('[LinkedIn] RapidAPI error:', error);
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
  
  console.log('[LinkedIn] Created manual task for message');
}

/**
 * Send connection request on LinkedIn
 */
export async function sendConnectionRequest(
  accessToken: string,
  profileUrl: string,
  note?: string
): Promise<LinkedInMessageResult> {
  try {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    
    if (!rapidApiKey) {
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
        note: note || "I'd like to connect with you on LinkedIn.",
      }),
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      success: true,
      messageId: data.invitationId || data.id,
    };
  } catch (error) {
    console.error('[LinkedIn] Error sending connection request:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get LinkedIn conversation thread
 */
export async function getConversationThread(
  accessToken: string,
  conversationId: string
): Promise<any[]> {
  try {
    const rapidApiKey = process.env.RAPIDAPI_KEY;
    
    if (!rapidApiKey) {
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
      return [];
    }
    
    const data = await response.json();
    return data.messages || [];
  } catch (error) {
    console.error('[LinkedIn] Error fetching conversation:', error);
    return [];
  }
}

