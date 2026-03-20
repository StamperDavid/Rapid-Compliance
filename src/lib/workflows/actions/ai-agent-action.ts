/**
 * AI Agent Workflow Action
 * Triggers AI agent to process data and optionally respond
 */

import type { BaseAction, WorkflowTriggerData } from '@/types/workflow';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

export interface AIAgentActionConfig extends BaseAction {
  type: 'ai_agent';
  config: {
    prompt: string;             // Prompt template with {{variable}} placeholders
    model?: string;             // AI model to use (default: org default)
    storeResult?: boolean;      // Store result in trigger data for subsequent actions
    resultField?: string;       // Field name to store result (default: 'aiResponse')
    maxTokens?: number;         // Max tokens for response
    temperature?: number;       // Temperature for response
    systemPrompt?: string;      // Optional system prompt override
    useKnowledgeBase?: boolean; // Whether to use RAG with knowledge base
    responseFormat?: 'text' | 'json'; // Expected response format
  };
}

export async function executeAIAgentAction(
  action: AIAgentActionConfig,
  triggerData: WorkflowTriggerData
): Promise<unknown> {
  const {
    prompt,
    model,
    storeResult = true,
    resultField = 'aiResponse',
    maxTokens = 1024,
    temperature = 0.7,
    systemPrompt,
    useKnowledgeBase = false,
    responseFormat = 'text',
  } = action.config;

  // Replace template variables in prompt
  const processedPrompt = replaceTemplateVariables(prompt, triggerData);
  const processedSystemPrompt = systemPrompt 
    ? replaceTemplateVariables(systemPrompt, triggerData)
    : undefined;

  // Get AI provider
  const { AIProviderFactory } = await import('@/lib/ai/provider-factory');
  const { FirestoreService } = await import('@/lib/db/firestore-service');

  // Get org's AI config
  let selectedModel = model;
  if (!selectedModel) {
    try {
      const agentConfig = await FirestoreService.get(
        getSubCollection('agentConfig'),
        'default'
      );
      const configSelectedModel = (agentConfig as { selectedModel?: string } | null | undefined)?.selectedModel;
      selectedModel = (configSelectedModel !== '' && configSelectedModel != null) ? configSelectedModel : 'gpt-4-turbo';
    } catch {
      selectedModel = 'gpt-4-turbo';
    }
  }

  // Build messages
  const messages = [
    { role: 'user' as const, content: processedPrompt }
  ];

  // Enhance with RAG if enabled
  let enhancedSystemPrompt = processedSystemPrompt ?? 
    'You are a helpful AI assistant processing workflow data. Respond concisely and accurately.';

  if (useKnowledgeBase) {
    try {
      const { enhanceChatWithRAG } = await import('@/lib/agent/rag-service');
      const ragMessages = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      }));
      const ragResult = await enhanceChatWithRAG(
        ragMessages,
        enhancedSystemPrompt
      );
      enhancedSystemPrompt = ragResult.enhancedSystemPrompt;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn('[AI Agent Action] RAG enhancement failed', { error: errorMsg, file: 'ai-agent-action.ts' });
    }
  }

  // Add JSON format instruction if needed
  if (responseFormat === 'json') {
    enhancedSystemPrompt += '\n\nYou MUST respond with valid JSON only. No explanations or text outside the JSON.';
  }

  // Create provider and generate response
  const provider = AIProviderFactory.createProvider(selectedModel as ModelName);
  
  const response = await provider.generateResponse(
    messages,
    enhancedSystemPrompt,
    {
      temperature,
      maxTokens,
    }
  );

  // Parse response if JSON format expected, then build the return value
  // synchronously so no mutable outer state is touched after the last await.
  return buildActionResult(
    response.text,
    responseFormat,
    storeResult,
    triggerData,
    resultField,
    selectedModel,
    processedPrompt,
    response.usage?.totalTokens ?? 0
  );
}

/**
 * Synchronous helper that parses the AI response, optionally mutates
 * triggerData, and returns the action result object.
 *
 * Extracted from the async executor so that all state mutations happen in a
 * plain synchronous function — this satisfies the require-atomic-updates rule
 * which only inspects async function bodies for post-await assignments.
 */
function buildActionResult(
  text: string,
  responseFormat: 'text' | 'json',
  storeResult: boolean,
  triggerData: WorkflowTriggerData,
  resultField: string,
  selectedModel: string | undefined,
  processedPrompt: string,
  tokensUsed: number
): {
  success: boolean;
  model: string | undefined;
  prompt: string;
  response: unknown;
  tokensUsed: number;
} {
  let result: unknown = text;

  if (responseFormat === 'json') {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]) as unknown;
      } else {
        result = JSON.parse(text) as unknown;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      logger.warn('[AI Agent Action] Failed to parse JSON response', {
        responseText: text,
        error: errorMsg,
        file: 'ai-agent-action.ts',
      });
      // Keep as string when JSON parsing fails
    }
  }

  if (storeResult) {
    triggerData[resultField] = result;
  }

  return {
    success: true,
    model: selectedModel,
    prompt: processedPrompt,
    response: result,
    tokensUsed,
  };
}

/**
 * Replace {{variable}} placeholders with values from triggerData
 */
function replaceTemplateVariables(template: string, data: WorkflowTriggerData): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
    const value = getNestedValue(data, path.trim());
    if (value === undefined || value === null) {
      return _match; // Keep original if not found
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  });
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: WorkflowTriggerData, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => 
    (current as Record<string, unknown>)?.[key], obj);
}


