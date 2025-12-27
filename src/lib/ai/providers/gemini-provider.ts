/**
 * Google Gemini Provider
 * Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 1.0 Pro
 */

import type { ModelProvider } from '@/lib/ai/model-provider';
import type {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ModelName,
} from '@/types/ai-models';
import { MODEL_CAPABILITIES } from '@/types/ai-models';
import { GoogleGenerativeAI } from '@google/generative-ai'
import { logger } from '@/lib/logger/logger';;

export class GeminiProvider implements ModelProvider {
  provider = 'google' as const;
  private client: GoogleGenerativeAI;
  private apiKey: string;
  
  constructor() {
    this.apiKey = process.env.GOOGLE_API_KEY || '';
    if (!this.apiKey) {
      logger.warn('[Gemini] API key not configured', { file: 'gemini-provider.ts' });
    }
    this.client = new GoogleGenerativeAI(this.apiKey);
  }
  
  /**
   * Send chat request to Gemini
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }
    
    try {
      const model = this.client.getGenerativeModel({ 
        model: request.model,
      });
      
      // Extract system instruction and convert messages
      const systemMessage = request.messages.find(m => m.role === 'system');
      const messages = request.messages.filter(m => m.role !== 'system');
      
      // Build chat history
      const history = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));
      
      const lastMessage = messages[messages.length - 1];
      
      // Start chat
      const chat = model.startChat({
        history,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens,
          topP: request.topP,
        },
        systemInstruction: systemMessage?.content,
      });
      
      // Send message
      const result = await chat.sendMessage(lastMessage.content);
      const response = result.response;
      
      // Extract content
      const content = response.text();
      
      // Calculate tokens and cost (approximation for Gemini)
      const promptTokens = this.estimateTokens(
        messages.map(m => m.content).join(' ')
      );
      const completionTokens = this.estimateTokens(content);
      const totalTokens = promptTokens + completionTokens;
      
      const capabilities = MODEL_CAPABILITIES[request.model];
      const cost =
        (promptTokens * capabilities.costPerInputToken) +
        (completionTokens * capabilities.costPerOutputToken);
      
      return {
        id: `gemini_${Date.now()}`,
        model: request.model,
        provider: 'google',
        content,
        finishReason: 'stop',
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          cost,
        },
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('[Gemini] Chat error:', error, { file: 'gemini-provider.ts' });
      throw error;
    }
  }
  
  /**
   * Send chat request with streaming
   */
  async* chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }
    
    try {
      const model = this.client.getGenerativeModel({ 
        model: request.model,
      });
      
      const systemMessage = request.messages.find(m => m.role === 'system');
      const messages = request.messages.filter(m => m.role !== 'system');
      
      const history = messages.slice(0, -1).map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));
      
      const lastMessage = messages[messages.length - 1];
      
      const chat = model.startChat({
        history,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens,
        },
        systemInstruction: systemMessage?.content,
      });
      
      const result = await chat.sendMessageStream(lastMessage.content);
      
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
    } catch (error: any) {
      logger.error('[Gemini] Stream error:', error, { file: 'gemini-provider.ts' });
      throw error;
    }
  }
  
  /**
   * Check if model is available
   */
  async isAvailable(model: ModelName): Promise<boolean> {
    return this.apiKey !== '' && model.startsWith('gemini-');
  }
  
  /**
   * Get model capabilities
   */
  async getCapabilities(model: ModelName): Promise<any> {
    return MODEL_CAPABILITIES[model];
  }
  
  /**
   * Estimate cost
   */
  estimateCost(promptTokens: number, completionTokens: number, model: ModelName): number {
    const capabilities = MODEL_CAPABILITIES[model];
    return (
      (promptTokens * capabilities.costPerInputToken) +
      (completionTokens * capabilities.costPerOutputToken)
    );
  }
  
  /**
   * Estimate tokens (rough approximation)
   * Gemini API doesn't provide token counts in responses yet
   */
  private estimateTokens(text: string): number {
    // Rough estimate: ~1.3 tokens per word
    const words = text.split(/\s+/).length;
    return Math.ceil(words * 1.3);
  }
}

