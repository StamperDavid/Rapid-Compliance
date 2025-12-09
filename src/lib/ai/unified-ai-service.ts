/**
 * Unified AI Service
 * Routes requests to the appropriate AI provider based on model selection
 */

import { OpenAIProvider } from './providers/openai-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { sendChatMessage, streamChatMessage, ChatMessage as GeminiChatMessage, ChatResponse as GeminiChatResponse } from './gemini-service';

export interface UnifiedChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface UnifiedChatResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost?: number;
  };
  model: string;
  provider: 'openai' | 'anthropic' | 'gemini';
}

export interface UnifiedChatRequest {
  model: string;
  messages: UnifiedChatMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

/**
 * Send chat message using the appropriate provider
 */
export async function sendUnifiedChatMessage(
  request: UnifiedChatRequest,
  organizationId?: string
): Promise<UnifiedChatResponse> {
  const { model, messages, systemInstruction, temperature, maxTokens, topP } = request;
  
  // Determine provider from model name
  if (model.startsWith('gpt-') || model.startsWith('ft:gpt-')) {
    // Fine-tuned models start with ft:gpt-
    return await sendOpenAIMessage(model, messages, systemInstruction, { temperature, maxTokens, topP }, organizationId);
  } else if (model.startsWith('claude-')) {
    return await sendAnthropicMessage(model, messages, systemInstruction, { temperature, maxTokens, topP }, organizationId);
  } else {
    // Default to Gemini
    return await sendGeminiMessage(model, messages, systemInstruction, { temperature, maxTokens, topP });
  }
}

/**
 * Send chat message with A/B testing support
 * Automatically routes to the correct model based on active A/B tests
 */
export async function sendChatWithABTesting(
  request: UnifiedChatRequest,
  organizationId: string,
  conversationId: string
): Promise<UnifiedChatResponse & {
  isTestGroup: boolean;
  testId?: string;
  actualModel: string;
}> {
  // Get model for this conversation (may be different due to A/B test)
  const { getModelForConversation, recordConversationResult } = await import('./learning/ab-testing-service');
  
  const modelAssignment = await getModelForConversation(organizationId, conversationId);
  
  // Use the assigned model instead of requested model
  const actualModel = modelAssignment.model;
  const modifiedRequest = { ...request, model: actualModel };
  
  // Send the message
  const response = await sendUnifiedChatMessage(modifiedRequest, organizationId);
  
  // If this conversation is part of an A/B test, we'll record the result later
  // when we get feedback (rating, conversion, etc.)
  
  return {
    ...response,
    isTestGroup: modelAssignment.isTestGroup,
    testId: modelAssignment.testId,
    actualModel,
  };
}

/**
 * Record A/B test result for a conversation
 * Call this when you get feedback (rating, conversion, etc.)
 */
export async function recordABTestResult(params: {
  organizationId: string;
  testId: string;
  isTestGroup: boolean;
  converted?: boolean;
  rating?: number;
  confidence: number;
  tokensUsed: number;
}): Promise<void> {
  const { recordConversationResult } = await import('./learning/ab-testing-service');
  
  await recordConversationResult({
    organizationId: params.organizationId,
    testId: params.testId,
    isTestGroup: params.isTestGroup,
    converted: params.converted || false,
    rating: params.rating,
    confidence: params.confidence,
    tokensUsed: params.tokensUsed,
  });
}

/**
 * Stream chat message using the appropriate provider
 */
export async function* streamUnifiedChatMessage(
  request: UnifiedChatRequest,
  organizationId?: string
): AsyncGenerator<string, void, unknown> {
  const { model, messages, systemInstruction, temperature, maxTokens, topP } = request;
  
  if (model.startsWith('gpt-')) {
    const provider = new OpenAIProvider(organizationId);
    const chatMessages = convertToProviderFormat(messages, systemInstruction);
    
    yield* provider.chatStream({
      model: model as any,
      messages: chatMessages,
      temperature,
      maxTokens,
      topP,
    });
  } else if (model.startsWith('claude-')) {
    const provider = new AnthropicProvider(organizationId);
    const chatMessages = convertToProviderFormat(messages, systemInstruction);
    
    yield* provider.chatStream({
      model: model as any,
      messages: chatMessages,
      temperature,
      maxTokens,
      topP,
    });
  } else {
    // Gemini
    const geminiMessages = convertToGeminiFormat(messages);
    yield* streamChatMessage(geminiMessages, systemInstruction);
  }
}

/**
 * Send message via OpenAI
 */
async function sendOpenAIMessage(
  model: string,
  messages: UnifiedChatMessage[],
  systemInstruction?: string,
  config?: { temperature?: number; maxTokens?: number; topP?: number },
  organizationId?: string
): Promise<UnifiedChatResponse> {
  const provider = new OpenAIProvider(organizationId);
  
  const chatMessages = convertToProviderFormat(messages, systemInstruction);
  
  const response = await provider.chat({
    model: model as any,
    messages: chatMessages,
    temperature: config?.temperature,
    maxTokens: config?.maxTokens,
    topP: config?.topP,
  });
  
  return {
    text: response.content,
    usage: response.usage,
    model,
    provider: 'openai',
  };
}

/**
 * Send message via Anthropic
 */
async function sendAnthropicMessage(
  model: string,
  messages: UnifiedChatMessage[],
  systemInstruction?: string,
  config?: { temperature?: number; maxTokens?: number; topP?: number },
  organizationId?: string
): Promise<UnifiedChatResponse> {
  const provider = new AnthropicProvider(organizationId);
  
  const chatMessages = convertToProviderFormat(messages, systemInstruction);
  
  const response = await provider.chat({
    model: model as any,
    messages: chatMessages,
    temperature: config?.temperature,
    maxTokens: config?.maxTokens,
    topP: config?.topP,
  });
  
  return {
    text: response.content,
    usage: response.usage,
    model,
    provider: 'anthropic',
  };
}

/**
 * Send message via Gemini
 */
async function sendGeminiMessage(
  model: string,
  messages: UnifiedChatMessage[],
  systemInstruction?: string,
  config?: { temperature?: number; maxTokens?: number; topP?: number }
): Promise<UnifiedChatResponse> {
  const geminiMessages = convertToGeminiFormat(messages);
  
  const response = await sendChatMessage(geminiMessages, systemInstruction);
  
  return {
    text: response.text,
    usage: response.usage,
    model,
    provider: 'gemini',
  };
}

/**
 * Convert unified messages to provider-specific format
 */
function convertToProviderFormat(
  messages: UnifiedChatMessage[],
  systemInstruction?: string
): any[] {
  const providerMessages: any[] = [];
  
  // Add system message if provided
  if (systemInstruction) {
    providerMessages.push({
      role: 'system',
      content: systemInstruction,
    });
  }
  
  // Add user/assistant messages
  for (const msg of messages) {
    if (msg.role !== 'system') {
      providerMessages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      });
    }
  }
  
  return providerMessages;
}

/**
 * Convert unified messages to Gemini format
 */
function convertToGeminiFormat(messages: UnifiedChatMessage[]): GeminiChatMessage[] {
  return messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }));
}

/**
 * Get cost estimate for a model
 */
export function estimateCost(model: string, promptTokens: number, completionTokens: number): number {
  // Cost per 1K tokens (as of Nov 2025)
  const costs: Record<string, { input: number; output: number }> = {
    'gemini-2.0-flash-exp': { input: 0.0001, output: 0.0001 },
    'gemini-pro': { input: 0.0005, output: 0.0015 },
    'gpt-4': { input: 0.03, output: 0.06 },
    'gpt-4-turbo': { input: 0.01, output: 0.03 },
    'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
    'claude-3.5-sonnet': { input: 0.003, output: 0.015 },
    'claude-3-opus': { input: 0.015, output: 0.075 },
  };
  
  const modelCost = costs[model] || costs['gemini-2.0-flash-exp'];
  
  const inputCost = (promptTokens / 1000) * modelCost.input;
  const outputCost = (completionTokens / 1000) * modelCost.output;
  
  return inputCost + outputCost;
}

/**
 * Get model information
 */
export function getModelInfo(model: string): {
  name: string;
  provider: 'openai' | 'anthropic' | 'gemini';
  speed: number; // 1-5
  quality: number; // 1-5
  cost: string;
  description: string;
} {
  const modelInfo: Record<string, any> = {
    'gemini-2.0-flash-exp': {
      name: 'Gemini 2.0 Flash',
      provider: 'gemini',
      speed: 5,
      quality: 4,
      cost: '$0.0001/1K tokens',
      description: 'Fastest and most affordable. Best for high-volume conversations.',
    },
    'gemini-pro': {
      name: 'Gemini Pro',
      provider: 'gemini',
      speed: 4,
      quality: 4,
      cost: '$0.0005/1K tokens',
      description: 'Balanced speed and quality for most use cases.',
    },
    'gpt-4': {
      name: 'GPT-4',
      provider: 'openai',
      speed: 3,
      quality: 5,
      cost: '$0.03/1K tokens',
      description: 'Best quality and reasoning. Ideal for complex conversations.',
    },
    'gpt-4-turbo': {
      name: 'GPT-4 Turbo',
      provider: 'openai',
      speed: 4,
      quality: 5,
      cost: '$0.01/1K tokens',
      description: 'Faster than GPT-4 with same quality at lower cost.',
    },
    'gpt-3.5-turbo': {
      name: 'GPT-3.5 Turbo',
      provider: 'openai',
      speed: 5,
      quality: 3,
      cost: '$0.0005/1K tokens',
      description: 'Fast and affordable for simple conversations.',
    },
    'claude-3.5-sonnet': {
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      speed: 4,
      quality: 5,
      cost: '$0.003/1K tokens',
      description: 'Latest from Anthropic. Excellent for creative and nuanced responses.',
    },
    'claude-3-opus': {
      name: 'Claude 3 Opus',
      provider: 'anthropic',
      speed: 3,
      quality: 5,
      cost: '$0.015/1K tokens',
      description: 'Best reasoning and analysis. Ideal for complex problem-solving.',
    },
  };
  
  return modelInfo[model] || modelInfo['gemini-2.0-flash-exp'];
}

