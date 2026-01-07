/**
 * Chain-of-Thought Reasoning
 * Multi-step thinking before responding
 */

import type { ReasoningStep, ChatRequest, ChatResponse } from '@/types/ai-models';
import { sendChatRequest } from '../model-provider'
import { logger } from '@/lib/logger/logger';

/**
 * Execute chain-of-thought reasoning
 */
export async function executeChainOfThought(params: {
  query: string;
  context: string;
  model: string;
  systemPrompt: string;
}): Promise<{
  finalAnswer: string;
  reasoning: ReasoningStep[];
  confidence: number;
}> {
  const { query, context, model, systemPrompt } = params;
  const reasoning: ReasoningStep[] = [];
  let stepNumber = 1;
  
  // Step 1: Understanding
  const understanding = await executeReasoningStep({
    step: stepNumber++,
    type: 'understanding',
    description: 'Understand the user\'s question and intent',
    input: `Question: ${query}\n\nContext: ${context}`,
    model,
    systemPrompt: 'You are analyzing a user question. Extract the key intent, entities, and what the user is actually asking for. Be concise.',
    prompt: `Analyze this question and explain:
1. What is the user asking?
2. What information do they need?
3. What entities/topics are relevant?

Question: ${query}`,
  });
  reasoning.push(understanding);
  
  // Step 2: Analysis
  const analysis = await executeReasoningStep({
    step: stepNumber++,
    type: 'analysis',
    description: 'Analyze available information and determine approach',
    input: `Understanding: ${understanding.output}\n\nAvailable context: ${context}`,
    model,
    systemPrompt: 'You are analyzing available information. Determine if we have enough information to answer, what\'s missing, and the best approach.',
    prompt: `Based on this understanding and context:

Understanding: ${understanding.output}

Context: ${context}

Analyze:
1. Do we have sufficient information?
2. What are the key facts to use?
3. What approach should we take to answer?`,
  });
  reasoning.push(analysis);
  
  // Step 3: Synthesis
  const synthesis = await executeReasoningStep({
    step: stepNumber++,
    type: 'synthesis',
    description: 'Synthesize information into a coherent answer',
    input: `Analysis: ${analysis.output}\n\nContext: ${context}`,
    model,
    systemPrompt: systemPrompt,
    prompt: `Based on this analysis, provide a clear, accurate answer to the user's question:

Question: ${query}

Analysis: ${analysis.output}

Context: ${context}

Provide a helpful, accurate response.`,
  });
  reasoning.push(synthesis);
  
  // Calculate overall confidence
  const avgConfidence =
    reasoning.reduce((sum, step) => sum + step.confidence, 0) / reasoning.length;
  
  return {
    finalAnswer: synthesis.output,
    reasoning,
    confidence: avgConfidence,
  };
}

/**
 * Execute a single reasoning step
 */
async function executeReasoningStep(params: {
  step: number;
  type: ReasoningStep['type'];
  description: string;
  input: string;
  model: string;
  systemPrompt: string;
  prompt: string;
}): Promise<ReasoningStep> {
  const startTime = Date.now();
  
  try {
    const request: ChatRequest = {
      model: params.model as any,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.prompt },
      ],
      temperature: 0.3, // Lower temperature for reasoning
      maxTokens: 500,
    };
    
    const response = await sendChatRequest(request);
    
    // Estimate confidence based on response characteristics
    const confidence = estimateStepConfidence(response.content);
    
    return {
      step: params.step,
      type: params.type,
      description: params.description,
      input: params.input,
      output: response.content,
      confidence,
      duration: Date.now() - startTime,
    };
  } catch (error: any) {
    logger.error('[Chain-of-Thought] Step ${params.step} error:', error, { file: 'chain-of-thought.ts' });
    
    // Return error step with low confidence
    return {
      step: params.step,
      type: params.type,
      description: params.description,
      input: params.input,
      output: `Error: ${error.message}`,
      confidence: 0,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Estimate confidence of a reasoning step
 */
function estimateStepConfidence(output: string): number {
  let confidence = 70; // Base confidence
  
  // Increase for structured output
  if (output.includes('1.') && output.includes('2.')) {
    confidence += 10;
  }
  
  // Decrease for uncertainty markers
  const uncertaintyMarkers = ['unclear', 'not sure', 'maybe', 'possibly', 'might'];
  for (const marker of uncertaintyMarkers) {
    if (output.toLowerCase().includes(marker)) {
      confidence -= 10;
      break;
    }
  }
  
  // Increase for factual statements
  if (output.length > 50 && !output.includes('?')) {
    confidence += 5;
  }
  
  return Math.max(0, Math.min(100, confidence));
}

/**
 * Simplified chain-of-thought for faster responses
 */
export async function executeSimplifiedReasoning(params: {
  query: string;
  context: string;
  model: string;
  systemPrompt: string;
}): Promise<{
  finalAnswer: string;
  reasoning: ReasoningStep[];
  confidence: number;
}> {
  const { query, context, model, systemPrompt } = params;
  const startTime = Date.now();
  
  // Single-step reasoning with explicit chain-of-thought prompting
  const request: ChatRequest = {
    model: model as any,
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `Answer this question, but first think through it step by step:

Question: ${query}

Context: ${context}

Think through:
1. What is being asked?
2. What information from the context is relevant?
3. How should I structure the answer?

Then provide your answer.`,
      },
    ],
    temperature: 0.5,
  };
  
  const response = await sendChatRequest(request);
  
  // Create a single reasoning step
  const reasoning: ReasoningStep[] = [
    {
      step: 1,
      type: 'synthesis',
      description: 'Think through and answer',
      input: query,
      output: response.content,
      confidence: 75,
      duration: Date.now() - startTime,
    },
  ];
  
  return {
    finalAnswer: response.content,
    reasoning,
    confidence: 75,
  };
}






















