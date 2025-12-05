/**
 * Gemini AI Service
 * Handles all interactions with Google's Gemini API
 * Dynamically fetches API keys from Firestore admin settings
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

let cachedGenAI: GoogleGenerativeAI | null = null;
let lastKeyFetch = 0;
const KEY_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get API key from Firestore admin settings
 */
async function getApiKey(): Promise<string> {
  try {
    // Check cache first
    if (cachedGenAI && Date.now() - lastKeyFetch < KEY_CACHE_TTL) {
      return 'cached';
    }

    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const adminKeys = await FirestoreService.get('admin', 'platform-api-keys');
    
    const apiKey = adminKeys?.ai?.geminiApiKey || adminKeys?.ai?.googleApiKey;
    
    if (!apiKey) {
      throw new Error('Gemini API key not configured in admin settings. Please add it at /admin/system/api-keys');
    }
    
    // Update cache
    cachedGenAI = new GoogleGenerativeAI(apiKey);
    lastKeyFetch = Date.now();
    
    return apiKey;
  } catch (error: any) {
    console.error('Error fetching Gemini API key:', error);
    throw new Error('Failed to fetch Gemini API key from admin settings');
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
async function getModel(modelName: string = 'gemini-2.0-flash-exp') {
  await getApiKey(); // Ensure key is loaded
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
  systemInstruction?: string
): Promise<ChatResponse> {
  try {
    const model = await getModel();
    
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
        promptTokens: (result as any).usageMetadata?.promptTokenCount || 0,
        completionTokens: (result as any).usageMetadata?.candidatesTokenCount || 0,
        totalTokens: (result as any).usageMetadata?.totalTokenCount || 0,
      },
    };
  } catch (error: any) {
    console.error('Error calling Gemini API:', error);
    throw new Error(error.message || 'Failed to get response from AI');
  }
}

/**
 * Generate text completion
 */
export async function generateText(
  prompt: string,
  systemInstruction?: string
): Promise<ChatResponse> {
  try {
    const model = await getModel();
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
        promptTokens: usageMetadata?.promptTokenCount || 0,
        completionTokens: usageMetadata?.candidatesTokenCount || 0,
        totalTokens: usageMetadata?.totalTokenCount || 0,
      },
    };
  } catch (error: any) {
    console.error('Error generating text with Gemini:', error);
    throw new Error(error.message || 'Failed to generate text');
  }
}

/**
 * Stream chat response
 */
export async function* streamChatMessage(
  messages: ChatMessage[],
  systemInstruction?: string
): AsyncGenerator<string, void, unknown> {
  try {
    const model = await getModel();
    
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
    console.error('Error streaming from Gemini:', error);
    throw new Error(error.message || 'Failed to stream response');
  }
}


