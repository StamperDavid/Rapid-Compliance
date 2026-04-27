/**
 * Google Gemini Provider
 * Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 1.0 Pro
 */

import type { ModelProvider } from '@/lib/ai/model-provider';
import {
  MODEL_CAPABILITIES,
  type ChatMessage,
  type ChatRequest,
  type ChatResponse,
  type ModelName,
  type ModelCapabilities,
} from '@/types/ai-models';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { logger } from '@/lib/logger/logger';

/**
 * Flatten a ChatMessage's content (which can be a string OR an array
 * of multipart text/image_url blocks since the vision-input change)
 * back to a plain string for Gemini's `sendMessage`. Gemini's SDK
 * uses a different image-input shape (`inlineData` with base64 +
 * mimeType) than OpenAI/Anthropic's `image_url` blocks; converting on
 * the fly here would require fetching every image and base64-encoding,
 * which adds I/O and complexity for a code path that today is only
 * exercised by text-only callers.
 *
 * Behavior: text blocks are concatenated; image_url blocks are
 * replaced with a "[image: <url>]" placeholder so the model sees the
 * URL but no actual vision input. Vision-aware DM replies should be
 * routed through the OpenRouter provider (Claude/GPT-4o), which
 * handles the multipart shape natively.
 */
function flattenContentForGemini(content: ChatMessage['content']): string {
  if (typeof content === 'string') { return content; }
  return content
    .map((part) => {
      if (part.type === 'text') { return part.text; }
      if (part.type === 'image_url') { return `[image: ${part.image_url.url}]`; }
      return '';
    })
    .join('\n');
}

export class GeminiProvider implements ModelProvider {
  provider = 'google' as const;
  private client: GoogleGenerativeAI;
  private apiKey: string;

  constructor() {
    // Extract API key - empty string means unconfigured (Explicit Ternary for STRING)
    const envApiKey = process.env.GOOGLE_API_KEY;
    this.apiKey = (envApiKey !== '' && envApiKey != null) ? envApiKey : '';
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
        parts: [{ text: flattenContentForGemini(msg.content) }],
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
        systemInstruction: systemMessage ? flattenContentForGemini(systemMessage.content) : undefined,
      });

      // Send message
      const result = await chat.sendMessage(flattenContentForGemini(lastMessage.content));
      const response = result.response;

      // Extract content
      const content = response.text();

      // Calculate tokens and cost (approximation for Gemini)
      const promptTokens = this.estimateTokens(
        messages.map(m => flattenContentForGemini(m.content)).join(' ')
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
    } catch (error: unknown) {
      logger.error('[Gemini] Chat error:', error instanceof Error ? error : new Error(String(error)), { file: 'gemini-provider.ts' });
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
        parts: [{ text: flattenContentForGemini(msg.content) }],
      }));

      const lastMessage = messages[messages.length - 1];

      const chat = model.startChat({
        history,
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens,
        },
        systemInstruction: systemMessage ? flattenContentForGemini(systemMessage.content) : undefined,
      });

      const result = await chat.sendMessageStream(flattenContentForGemini(lastMessage.content));

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield text;
        }
      }
    } catch (error: unknown) {
      logger.error('[Gemini] Stream error:', error instanceof Error ? error : new Error(String(error)), { file: 'gemini-provider.ts' });
      throw error;
    }
  }

  /**
   * Check if model is available
   */
  isAvailable(model: ModelName): Promise<boolean> {
    return Promise.resolve(this.apiKey !== '' && model.startsWith('gemini-'));
  }

  /**
   * Get model capabilities
   */
  getCapabilities(model: ModelName): Promise<ModelCapabilities> {
    return Promise.resolve(MODEL_CAPABILITIES[model]);
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
