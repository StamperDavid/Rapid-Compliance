/**
 * Gemini AI Service
 * Handles all interactions with Google's Gemini API
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY not set - AI features will not work');
}

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null;

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
function getModel(modelName: string = 'gemini-2.0-flash-exp') {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }
  return genAI.getGenerativeModel({ model: modelName });
}

/**
 * Send a chat message to Gemini
 */
export async function sendChatMessage(
  messages: ChatMessage[],
  systemInstruction?: string
): Promise<ChatResponse> {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const model = getModel();
    
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
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const model = getModel();
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
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }

  try {
    const model = getModel();
    
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


