/**
 * OpenAI Provider
 * GPT-4, GPT-4 Turbo, GPT-3.5 Turbo
 */

import type { ModelProvider } from '@/lib/ai/model-provider';
import type {
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ModelName,
  AIFunction,
} from '@/types/ai-models';
import { MODEL_CAPABILITIES } from '@/types/ai-models';
import { apiKeyService } from '@/lib/api-keys/api-key-service'
import { logger } from '@/lib/logger/logger';

export class OpenAIProvider implements ModelProvider {
  provider = 'openai' as const;
  private apiKey: string;
  private baseURL = 'https://api.openai.com/v1';
  private organizationId: string;
  
  constructor(organizationId: string = 'demo') {
    this.organizationId = organizationId;
    // Extract API key - empty string means unconfigured (Explicit Ternary for STRING)
    const envApiKey = process.env.OPENAI_API_KEY;
    this.apiKey = (envApiKey !== '' && envApiKey != null) ? envApiKey : ''; // Fallback to env
    if (!this.apiKey) {
      logger.warn('[OpenAI] API key not configured in env, will attempt to load from database', { file: 'openai-provider.ts' });
    }
  }
  
  /**
   * Load API key from database or use cached value
   */
  private async getApiKey(): Promise<string> {
    if (this.apiKey) {return this.apiKey;}
    
    try {
      const keys = await apiKeyService.getKeys(this.organizationId);
      // Extract API key - empty string means unconfigured (Explicit Ternary for STRING)
      const dbApiKey = keys?.ai?.openaiApiKey;
      this.apiKey = (dbApiKey !== '' && dbApiKey != null) ? dbApiKey : '';
      
      if (!this.apiKey) {
        throw new Error('OpenAI API key not configured');
      }
      
      return this.apiKey;
    } catch (error) {
      logger.error('[OpenAI] Failed to load API key:', error, { file: 'openai-provider.ts' });
      throw new Error('OpenAI API key not configured');
    }
  }
  
  /**
   * Send chat request to OpenAI
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    const apiKey = await this.getApiKey();
    
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: this.convertMessages(request.messages),
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          top_p: request.topP,
          frequency_penalty: request.frequencyPenalty,
          presence_penalty: request.presencePenalty,
          stop: request.stop,
          functions: request.functions ? this.convertFunctions(request.functions) : undefined,
          function_call: request.functionCall,
          user: request.user,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
      }
      
      const data = await response.json();
      const choice = data.choices[0];
      
      // Calculate cost
      const capabilities = MODEL_CAPABILITIES[request.model];
      const cost =
        (data.usage.prompt_tokens * capabilities.costPerInputToken) +
        (data.usage.completion_tokens * capabilities.costPerOutputToken);
      
      return {
        id: data.id,
        model: request.model,
        provider: 'openai',
        // AI response content - empty string is valid response (use ?? for content)
        content: choice.message.content ?? '',
        finishReason: this.mapFinishReason(choice.finish_reason),
        functionCall: choice.message.function_call ? {
          name: choice.message.function_call.name,
          arguments: JSON.parse(choice.message.function_call.arguments),
        } : undefined,
        usage: {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
          cost,
        },
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      logger.error('[OpenAI] Chat error:', error, { file: 'openai-provider.ts' });
      throw error;
    }
  }
  
  /**
   * Send chat request with streaming
   */
  async* chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const apiKey = await this.getApiKey();
    
    try {
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: this.convertMessages(request.messages),
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens,
          stream: true,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
      }
      
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }
      
      const decoder = new TextDecoder();
      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) {break;}
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // Extract remaining buffer - empty string is valid (use ??)
        buffer = lines.pop() ?? '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {continue;}
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content;
              if (content) {
                yield content;
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error: any) {
      logger.error('[OpenAI] Stream error:', error, { file: 'openai-provider.ts' });
      throw error;
    }
  }
  
  /**
   * Check if model is available
   */
  async isAvailable(model: ModelName): Promise<boolean> {
    try {
      const apiKey = await this.getApiKey();
      const response = await fetch(`${this.baseURL}/models/${model}`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      
      return response.ok;
    } catch (error) {
      return false;
    }
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
   * Convert messages to OpenAI format
   */
  private convertMessages(messages: ChatMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role,
      content: msg.content,
      name: msg.name,
      function_call: msg.functionCall,
    }));
  }
  
  /**
   * Convert functions to OpenAI format
   */
  private convertFunctions(functions: AIFunction[]): any[] {
    return functions.map(fn => ({
      name: fn.name,
      description: fn.description,
      parameters: fn.parameters,
    }));
  }
  
  /**
   * Map finish reason to standard format
   */
  private mapFinishReason(reason: string): ChatResponse['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'function_call': return 'function_call';
      case 'content_filter': return 'content_filter';
      default: return 'stop';
    }
  }
}

