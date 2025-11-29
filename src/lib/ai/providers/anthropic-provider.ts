/**
 * Anthropic Provider
 * Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Sonnet, Claude 3 Haiku
 */

import type {
  ModelProvider,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ModelName,
} from '@/types/ai-models';
import { MODEL_CAPABILITIES } from '@/types/ai-models';

export class AnthropicProvider implements ModelProvider {
  provider = 'anthropic' as const;
  private apiKey: string;
  private baseURL = 'https://api.anthropic.com/v1';
  private apiVersion = '2023-06-01';
  
  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!this.apiKey) {
      console.warn('[Anthropic] API key not configured');
    }
  }
  
  /**
   * Send chat request to Anthropic
   */
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const startTime = Date.now();
    
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }
    
    try {
      // Extract system message
      const systemMessage = request.messages.find(m => m.role === 'system');
      const messages = request.messages.filter(m => m.role !== 'system');
      
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: this.convertMessages(messages),
          system: systemMessage?.content,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature ?? 0.7,
          top_p: request.topP,
          stop_sequences: request.stop,
          // Claude's function calling (tool use)
          tools: request.functions ? this.convertFunctionsToTools(request.functions) : undefined,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(`Anthropic API error: ${JSON.stringify(error)}`);
      }
      
      const data = await response.json();
      
      // Extract content and function calls
      let content = '';
      let functionCall;
      
      for (const block of data.content) {
        if (block.type === 'text') {
          content += block.text;
        } else if (block.type === 'tool_use') {
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
    } catch (error: any) {
      console.error('[Anthropic] Chat error:', error);
      throw error;
    }
  }
  
  /**
   * Send chat request with streaming
   */
  async* chatStream(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    if (!this.apiKey) {
      throw new Error('Anthropic API key not configured');
    }
    
    try {
      const systemMessage = request.messages.find(m => m.role === 'system');
      const messages = request.messages.filter(m => m.role !== 'system');
      
      const response = await fetch(`${this.baseURL}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': this.apiVersion,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model,
          messages: this.convertMessages(messages),
          system: systemMessage?.content,
          max_tokens: request.maxTokens || 4096,
          temperature: request.temperature ?? 0.7,
          stream: true,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
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
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'content_block_delta') {
                if (parsed.delta?.type === 'text_delta') {
                  yield parsed.delta.text;
                }
              }
            } catch (e) {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (error: any) {
      console.error('[Anthropic] Stream error:', error);
      throw error;
    }
  }
  
  /**
   * Check if model is available
   */
  async isAvailable(model: ModelName): Promise<boolean> {
    return this.apiKey !== '' && model.startsWith('claude-');
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
   * Convert messages to Anthropic format
   */
  private convertMessages(messages: ChatMessage[]): any[] {
    return messages.map(msg => ({
      role: msg.role === 'assistant' ? 'assistant' : 'user',
      content: msg.content,
    }));
  }
  
  /**
   * Convert functions to Anthropic tools format
   */
  private convertFunctionsToTools(functions: any[]): any[] {
    return functions.map(fn => ({
      name: fn.name,
      description: fn.description,
      input_schema: fn.parameters,
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

