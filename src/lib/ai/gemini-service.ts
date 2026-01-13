/**
 * Gemini AI Service
 * Handles all interactions with Google's Gemini API
 * Dynamically fetches API keys from Firestore (organization-specific or platform admin settings)
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger } from '@/lib/logger/logger';

let cachedGenAI: GoogleGenerativeAI | null = null;
let cachedOrgId: string | null = null;
let lastKeyFetch = 0;
const KEY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get API key from organization settings or fallback to platform admin settings
 */
async function getApiKey(organizationId?: string): Promise<string> {
  try {
    // Check cache first (invalidate if different org)
    if (cachedGenAI && cachedOrgId === (organizationId ?? null) && Date.now() - lastKeyFetch < KEY_CACHE_TTL) {
      return 'cached';
    }

    let apiKey: string | null = null;

    // Try organization-specific keys first if organizationId provided
    if (organizationId) {
      try {
        const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
        apiKey = await apiKeyService.getServiceKey(organizationId, 'gemini');

        if (apiKey) {
          logger.info('[Gemini] Using organization-specific API key', {
            organizationId,
            file: 'gemini-service.ts'
          });
        }
      } catch (error) {
        logger.warn('[Gemini] Could not fetch org-specific key, falling back to platform key', {
          organizationId,
          error,
          file: 'gemini-service.ts'
        });
      }
    }

    // Fallback to platform admin keys if no org key found
    if (!apiKey) {
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      const adminKeys = await FirestoreService.get('admin', 'platform-api-keys');

      // Extract API key - prefer Gemini, fallback to Google key (Explicit Ternary for STRING)
      const geminiKey = adminKeys?.gemini?.apiKey;
      const googleKey = adminKeys?.google?.apiKey;
      apiKey = (geminiKey !== '' && geminiKey != null) ? geminiKey : googleKey;

      if (apiKey) {
        logger.info('[Gemini] Using platform admin API key', { file: 'gemini-service.ts' });
      }
    }

    if (!apiKey) {
      throw new Error('Gemini API key not configured. Please add it in organization settings or admin settings.');
    }

    // Update cache
    cachedGenAI = new GoogleGenerativeAI(apiKey);
    cachedOrgId = organizationId ?? null;
    lastKeyFetch = Date.now();

    return apiKey;
  } catch (error: any) {
    logger.error('Error fetching Gemini API key:', error, { file: 'gemini-service.ts' });
    throw new Error('Failed to fetch Gemini API key from settings');
  }
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  parts: Array<{ text: string }>;
  timestamp?: Date;
}

export interface ChatResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Initialize a chat model
 */
async function getModel(organizationId?: string, modelName: string = 'gemini-2.0-flash-exp') {
  await getApiKey(organizationId); // Ensure key is loaded with org context
  if (!cachedGenAI) {
    throw new Error('Gemini API key not configured');
  }
  return cachedGenAI.getGenerativeModel({ model: modelName });
}

/**
 * Send a chat message to Gemini
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  systemInstruction?: string,
  organizationId?: string
): Promise<ChatResponse> {
  try {
    const model = await getModel(organizationId);
    
    // Convert messages to Gemini format
    const history = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: m.parts,
      }));

    const chat = model.startChat({
      history: history.slice(0, -1), // All but last message
      systemInstruction: systemInstruction,
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessage(lastMessage.parts[0].text);
    const response = await result.response;
    const text = response.text();

    return {
      text,
      usage: {
        // Token counts are NUMBERS - 0 is valid (use ?? for numbers)
        promptTokens: (result as any).usageMetadata?.promptTokenCount ?? 0,
        completionTokens: (result as any).usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: (result as any).usageMetadata?.totalTokenCount ?? 0,
      },
    };
  } catch (error: any) {
    logger.error('Error calling Gemini API:', error, { file: 'gemini-service.ts' });
    // Extract error message to avoid empty error message (Explicit Ternary for STRING)
    const errorMsg = (error.message !== '' && error.message != null) ? error.message : 'Failed to get response from AI';
    throw new Error(errorMsg);
  }
}

/**
 * Generate text completion
 */
export async function generateText(
  prompt: string,
  systemInstruction?: string,
  organizationId?: string
): Promise<ChatResponse> {
  try {
    const model = await getModel(organizationId);
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      systemInstruction: systemInstruction,
    });

    const response = await result.response;
    const text = response.text();

    // Get usage metadata if available
    const usageMetadata = (result as any).usageMetadata;
    
    return {
      text,
      usage: {
        // Token counts are NUMBERS - 0 is valid (use ?? for numbers)
        promptTokens: usageMetadata?.promptTokenCount ?? 0,
        completionTokens: usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: usageMetadata?.totalTokenCount ?? 0,
      },
    };
  } catch (error: any) {
    logger.error('Error generating text with Gemini:', error, { file: 'gemini-service.ts' });
    // Extract error message (Explicit Ternary for STRING)
    const errorMsg = (error.message !== '' && error.message != null) ? error.message : 'Failed to generate text';
    throw new Error(errorMsg);
  }
}

/**
 * Stream chat response
 */
export async function* streamChatMessage(
  messages: ChatMessage[],
  systemInstruction?: string,
  organizationId?: string
): AsyncGenerator<string, void, unknown> {
  try {
    const model = await getModel(organizationId);
    
    const history = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: m.parts,
      }));

    const chat = model.startChat({
      history: history.slice(0, -1),
      systemInstruction: systemInstruction,
    });

    const lastMessage = messages[messages.length - 1];
    const result = await chat.sendMessageStream(lastMessage.parts[0].text);

    for await (const chunk of result.stream) {
      const chunkText = chunk.text();
      yield chunkText;
    }
  } catch (error: any) {
    logger.error('Error streaming from Gemini:', error, { file: 'gemini-service.ts' });
    // Extract error message (Explicit Ternary for STRING)
    const errorMsg = (error.message !== '' && error.message != null) ? error.message : 'Failed to stream response';
    throw new Error(errorMsg);
  }
}


