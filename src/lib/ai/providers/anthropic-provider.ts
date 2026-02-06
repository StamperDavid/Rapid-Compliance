/**
 * Anthropic Provider
 * Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku
 */

import type { ModelProvider } from '@/lib/ai/model-provider';
import {
  MODEL_CAPABILITIES,
  type ChatRequest,
  type ChatResponse,
  type ChatMessage,
  type ModelName,
  type ModelCapabilities,
  type AIFunction,
} from '@/types/ai-models';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { logger } from '@/lib/logger/logger';

/** Anthropic API response types */
interface AnthropicContentBlock {
  type: 'text' | 'tool_use';
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface AnthropicAPIResponse {
  id: string;
  type: string;
  role: string;
  content: AnthropicContentBlock[];
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/** Anthropic tool format */
interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export class AnthropicProvider implements ModelProvider {
  provider = 'anthropic' as const;
  private apiKey: string;
  private baseURL = 'https://api.anthropic.com/v1';
  private apiVersion = '2023-06-01';

  constructor() {
    // Extract API key - empty string means key not configured (Explicit Ternary for STRING)
    const envApiKey = process.env.ANTHROPIC_API_KEY;
    this.apiKey = (envApiKey !== '' && envApiKey != null) ? envApiKey : ''; // Fallback to env
    if (!this.apiKey) {
      logger.warn('[Anthropic] API key not configured in env, will attempt to load from database', { file: 'anthropic-provider.ts' });
    }
  }

  /**
   * Load API key from database or use cached value
   */
  private async getApiKey(): Promise<string> {
    if (this.apiKey) { return this.apiKey; }

    try {
      const keys = await apiKeyService.getKeys();
      // Extract API key - empty string means unconfigured (Explicit Ternary for STRING)
      const dbApiKey = keys?.ai?.anthropicApiKey;
      this.apiKey = (dbApiKey !== '' && dbApiKey != null) ? dbApiKey : '';

      if (!this.apiKey) {
        throw new Error('Anthropic API key not configured');
      }

      return this.apiKey;
    } catch (error: unknown) {
      logger.error('[Anthropic] Failed to load API key:', error instanceof Error ? error : new Error(String(error)), { file: 'anthropic-provider.ts' });
      throw new Error('Anthropic API key not configured');
    }
  }

  /**
   * Send chat request to Anthropic
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    const apiKey = await this.getApiKey();

    try {
      // Extract system message
      const systemMessage = request.messages.find(m => m.role === 'system');
      const messages = request.messages.filter(m => m.role !== 'system');

      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': this.apiVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: this.convertMessages(messages),
          system: systemMessage?.content,
          // max_tokens is a NUMBER - 0 is invalid but possible (use ?? for numbers)
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          top_p: request.topP,
          stop_sequences: request.stop,
          // Claude's function calling (tool use)
          tools: request.functions ? this.convertFunctionsToTools(request.functions) : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as Record<string, unknown>;
        throw new Error(`Anthropic API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json() as AnthropicAPIResponse;

      // Extract content and function calls
      let content = '';
      let functionCall: { name: string; arguments: Record<string, unknown> } | undefined;

      for (const block of data.content) {
        if (block.type === 'text' && block.text) {
          content += block.text;
        } else if (block.type === 'tool_use' && block.name && block.input) {
          functionCall = {
            name: block.name,
            arguments: block.input,
          };
        }
      }

      // Calculate cost
      const capabilities = MODEL_CAPABILITIES[request.model];
      const cost =
        (data.usage.input_tokens * capabilities.costPerInputToken) +
        (data.usage.output_tokens * capabilities.costPerOutputToken);

      return {
        id: data.id,
        model: request.model,
        provider: 'anthropic',
        content,
        finishReason: this.mapStopReason(data.stop_reason),
        functionCall,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
          cost,
        },
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error: unknown) {
      logger.error('[Anthropic] Chat error:', error instanceof Error ? error : new Error(String(error)), { file: 'anthropic-provider.ts' });
      throw error;
    }
  }

  /**
   * Send chat request with streaming
   */
  async* chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const apiKey = await this.getApiKey();

    try {
      const systemMessage = request.messages.find(m => m.role === 'system');
      const messages = request.messages.filter(m => m.role !== 'system');

      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': this.apiVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: this.convertMessages(messages),
          system: systemMessage?.content,
          // max_tokens is a NUMBER - use ?? for numbers
          max_tokens: request.maxTokens ?? 4096,
          temperature: request.temperature ?? 0.7,
          stream: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json() as Record<string, unknown>;
        throw new Error(`Anthropic API error: ${JSON.stringify(error)}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) { break; }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Extract remaining buffer - empty string is valid (use ?? since we want '' not null/undefined)
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);

            try {
              const parsed = JSON.parse(data) as { type: string; delta?: { type: string; text?: string } };

              if (parsed.type === 'content_block_delta') {
                if (parsed.delta?.type === 'text_delta' && parsed.delta.text) {
                  yield parsed.delta.text;
                }
              }
            } catch (_parseError: unknown) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error: unknown) {
      logger.error('[Anthropic] Stream error:', error instanceof Error ? error : new Error(String(error)), { file: 'anthropic-provider.ts' });
      throw error;
    }
  }

  /**
   * Check if model is available
   */
  isAvailable(model: ModelName): Promise<boolean> {
    return Promise.resolve(this.apiKey !== '' && model.startsWith('claude-'));
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
   * Convert messages to Anthropic format
   */
  private convertMessages(messages: ChatMessage[]): Array<{ role: string; content: string }> {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));
  }

  /**
   * Convert functions to Anthropic tools format
   */
  private convertFunctionsToTools(functions: AIFunction[]): AnthropicTool[] {
    return functions.map(fn => ({
      name: fn.name,
      description: fn.description,
      input_schema: fn.parameters as Record<string, unknown>,
    }));
  }

  /**
   * Map stop reason to standard format
   */
  private mapStopReason(reason: string): ChatResponse['finishReason'] {
    switch (reason) {
      case 'end_turn': return 'stop';
      case 'max_tokens': return 'length';
      case 'tool_use': return 'function_call';
      case 'stop_sequence': return 'stop';
      default: return 'stop';
    }
  }
}
