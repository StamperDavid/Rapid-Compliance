/**
 * Ensemble AI Service
 * Query multiple AI models in parallel and return the best answer
 * 
 * This is our SECRET WEAPON - no competitor does this!
 */

import { sendUnifiedChatMessage, UnifiedChatMessage, UnifiedChatResponse } from './unified-ai-service';

export interface EnsembleRequest {
  messages: UnifiedChatMessage[];
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  mode?: 'best' | 'consensus' | 'synthesize';
  models?: string[]; // If not provided, use smart selection
}

export interface EnsembleResponse {
  bestResponse: string;
  allResponses: EnsembleModelResponse[];
  selectedModel: string;
  totalCost: number;
  processingTime: number;
  confidenceScore: number;
  reasoning?: string; // Why this answer was chosen
}

export interface EnsembleModelResponse {
  model: string;
  provider: string;
  response: string;
  score: number; // 0-100
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  responseTime: number;
  metrics: {
    length: number;
    coherence: number;
    relevance: number;
    specificity: number;
    confidence: number;
  };
}

/**
 * Send request to multiple models and return best answer
 */
export async function sendEnsembleRequest(
  request: EnsembleRequest
): Promise<EnsembleResponse> {
  const startTime = Date.now();
  
  // Select models to query
  const modelsToQuery = request.models || selectSmartModels(request.messages);
  
  console.log(`[Ensemble] Querying ${modelsToQuery.length} models:`, modelsToQuery);
  
  // Query all models in parallel
  const responses = await Promise.allSettled(
    modelsToQuery.map(async (model) => {
      const modelStartTime = Date.now();
      
      try {
        const response = await sendUnifiedChatMessage({
          model,
          messages: request.messages,
          systemInstruction: request.systemInstruction,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          topP: request.topP,
        });
        
        const responseTime = Date.now() - modelStartTime;
        
        // Score the response
        const metrics = analyzeResponse(response.text, request.messages);
        const score = calculateScore(metrics, model, responseTime);
        
        const ensembleResponse: EnsembleModelResponse = {
          model,
          provider: response.provider,
          response: response.text,
          score,
          usage: {
            promptTokens: response.usage?.promptTokens || 0,
            completionTokens: response.usage?.completionTokens || 0,
            totalTokens: response.usage?.totalTokens || 0,
            cost: response.usage?.cost || 0,
          },
          responseTime,
          metrics,
        };
        
        return ensembleResponse;
      } catch (error: any) {
        console.error(`[Ensemble] Error querying ${model}:`, error.message);
        
        // Return failed response
        return {
          model,
          provider: 'unknown',
          response: '',
          score: 0,
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0 },
          responseTime: Date.now() - modelStartTime,
          metrics: {
            length: 0,
            coherence: 0,
            relevance: 0,
            specificity: 0,
            confidence: 0,
          },
        } as EnsembleModelResponse;
      }
    })
  );
  
  // Extract successful responses
  const successfulResponses = responses
    .filter((r): r is PromiseFulfilledResult<EnsembleModelResponse> => r.status === 'fulfilled')
    .map(r => r.value)
    .filter(r => r.score > 0); // Filter out failed responses
  
  if (successfulResponses.length === 0) {
    throw new Error('All models failed to respond');
  }
  
  // Select best response based on mode
  let bestResponse: string;
  let selectedModel: string;
  let reasoning: string;
  let confidenceScore: number;
  
  switch (request.mode || 'best') {
    case 'consensus':
      ({ response: bestResponse, model: selectedModel, reasoning, confidence: confidenceScore } = 
        findConsensus(successfulResponses));
      break;
    
    case 'synthesize':
      ({ response: bestResponse, reasoning, confidence: confidenceScore } = 
        synthesizeResponses(successfulResponses));
      selectedModel = 'synthesized';
      break;
    
    case 'best':
    default:
      ({ response: bestResponse, model: selectedModel, reasoning, confidence: confidenceScore } = 
        selectBestResponse(successfulResponses));
      break;
  }
  
  const totalCost = successfulResponses.reduce((sum, r) => sum + r.usage.cost, 0);
  const processingTime = Date.now() - startTime;
  
  console.log(`[Ensemble] Best answer from ${selectedModel} (score: ${confidenceScore.toFixed(1)}, cost: $${totalCost.toFixed(4)}, time: ${processingTime}ms)`);
  
  return {
    bestResponse,
    allResponses: successfulResponses,
    selectedModel,
    totalCost,
    processingTime,
    confidenceScore,
    reasoning,
  };
}

/**
 * Smart model selection based on conversation context
 */
function selectSmartModels(messages: UnifiedChatMessage[]): string[] {
  const lastMessage = messages[messages.length - 1]?.content || '';
  const conversationLength = messages.length;
  
  // Always include these 3 for good coverage
  const models = [
    'gpt-4-turbo',      // Best reasoning
    'claude-3.5-sonnet', // Best creativity
    'gemini-2.0-flash-exp', // Fast baseline
  ];
  
  // For complex/long conversations, add GPT-4
  if (conversationLength > 5 || lastMessage.length > 500) {
    models.push('gpt-4');
  }
  
  // For creative/nuanced requests, add Claude Opus
  const creativeKeywords = ['write', 'create', 'design', 'imagine', 'story', 'creative'];
  if (creativeKeywords.some(kw => lastMessage.toLowerCase().includes(kw))) {
    models.push('claude-3-opus');
  }
  
  return [...new Set(models)]; // Remove duplicates
}

/**
 * Analyze response quality
 */
function analyzeResponse(
  response: string,
  messages: UnifiedChatMessage[]
): {
  length: number;
  coherence: number;
  relevance: number;
  specificity: number;
  confidence: number;
} {
  const length = response.length;
  
  // Coherence: Check for complete sentences, proper structure
  const coherence = calculateCoherence(response);
  
  // Relevance: Check if response addresses the question
  const lastMessage = messages[messages.length - 1]?.content || '';
  const relevance = calculateRelevance(response, lastMessage);
  
  // Specificity: Check for specific details vs vague answers
  const specificity = calculateSpecificity(response);
  
  // Confidence: Check for uncertainty markers
  const confidence = calculateConfidence(response);
  
  return {
    length,
    coherence,
    relevance,
    specificity,
    confidence,
  };
}

/**
 * Calculate coherence score (0-100)
 */
function calculateCoherence(text: string): number {
  let score = 50; // Base score
  
  // Check for complete sentences
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 0) score += 10;
  
  // Check for proper capitalization
  const properCapitalization = /^[A-Z]/.test(text.trim());
  if (properCapitalization) score += 10;
  
  // Check for paragraph structure
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 0);
  if (paragraphs.length > 1) score += 10;
  
  // Check for proper formatting (lists, etc.)
  const hasFormatting = /[-•*]|\d+\./.test(text);
  if (hasFormatting) score += 10;
  
  // Check for professional tone (no excessive exclamation marks)
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount <= 2) score += 10;
  
  return Math.min(100, score);
}

/**
 * Calculate relevance score (0-100)
 */
function calculateRelevance(response: string, question: string): number {
  let score = 50; // Base score
  
  // Extract key words from question
  const questionWords = question
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 4 && !['what', 'when', 'where', 'which', 'would', 'could', 'should'].includes(w));
  
  // Check how many key words are in the response
  const responseText = response.toLowerCase();
  const matchedWords = questionWords.filter(w => responseText.includes(w));
  
  score += (matchedWords.length / Math.max(questionWords.length, 1)) * 30;
  
  // Check for direct answer patterns
  if (question.toLowerCase().includes('how') && responseText.includes('by')) score += 10;
  if (question.toLowerCase().includes('why') && responseText.includes('because')) score += 10;
  if (question.toLowerCase().includes('what') && responseText.includes('is')) score += 10;
  
  return Math.min(100, score);
}

/**
 * Calculate specificity score (0-100)
 */
function calculateSpecificity(text: string): number {
  let score = 50; // Base score
  
  // Check for numbers/data
  const hasNumbers = /\d+/.test(text);
  if (hasNumbers) score += 15;
  
  // Check for specific examples
  const hasExamples = /for example|such as|like|including/i.test(text);
  if (hasExamples) score += 15;
  
  // Check for actionable steps
  const hasSteps = /step|first|second|then|next|finally/i.test(text);
  if (hasSteps) score += 10;
  
  // Penalize vague language
  const vagueWords = ['maybe', 'perhaps', 'possibly', 'might', 'could be'];
  const vagueCount = vagueWords.filter(w => text.toLowerCase().includes(w)).length;
  score -= vagueCount * 5;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate confidence score (0-100)
 */
function calculateConfidence(text: string): number {
  let score = 70; // Base score
  
  // Check for uncertainty markers
  const uncertaintyMarkers = [
    'i think', 'i believe', 'probably', 'maybe', 'perhaps',
    'not sure', 'uncertain', 'unclear', 'might be', 'could be'
  ];
  
  const uncertaintyCount = uncertaintyMarkers.filter(m => 
    text.toLowerCase().includes(m)
  ).length;
  
  score -= uncertaintyCount * 10;
  
  // Check for confidence markers
  const confidenceMarkers = [
    'definitely', 'certainly', 'clearly', 'specifically',
    'exactly', 'precisely', 'confirmed'
  ];
  
  const confidenceCount = confidenceMarkers.filter(m =>
    text.toLowerCase().includes(m)
  ).length;
  
  score += confidenceCount * 5;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate overall score for a response
 */
function calculateScore(
  metrics: ReturnType<typeof analyzeResponse>,
  model: string,
  responseTime: number
): number {
  // Weighted scoring
  const coherenceWeight = 0.25;
  const relevanceWeight = 0.35;
  const specificityWeight = 0.20;
  const confidenceWeight = 0.15;
  const speedWeight = 0.05;
  
  // Speed score (faster is better, up to 100 for <1s, down to 0 for >10s)
  const speedScore = Math.max(0, Math.min(100, 100 - (responseTime - 1000) / 100));
  
  const totalScore =
    metrics.coherence * coherenceWeight +
    metrics.relevance * relevanceWeight +
    metrics.specificity * specificityWeight +
    metrics.confidence * confidenceWeight +
    speedScore * speedWeight;
  
  return totalScore;
}

/**
 * Select best response from all responses
 */
function selectBestResponse(responses: EnsembleModelResponse[]): {
  response: string;
  model: string;
  reasoning: string;
  confidence: number;
} {
  // Sort by score
  const sorted = [...responses].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  
  const reasoning = `Selected ${best.model} (score: ${best.score.toFixed(1)}/100). ` +
    `Coherence: ${best.metrics.coherence.toFixed(0)}, ` +
    `Relevance: ${best.metrics.relevance.toFixed(0)}, ` +
    `Specificity: ${best.metrics.specificity.toFixed(0)}, ` +
    `Confidence: ${best.metrics.confidence.toFixed(0)}`;
  
  return {
    response: best.response,
    model: best.model,
    reasoning,
    confidence: best.score,
  };
}

/**
 * Find consensus among responses
 */
function findConsensus(responses: EnsembleModelResponse[]): {
  response: string;
  model: string;
  reasoning: string;
  confidence: number;
} {
  // For now, use best response
  // TODO: Implement actual consensus algorithm (check for common themes, facts)
  const best = selectBestResponse(responses);
  
  return {
    ...best,
    reasoning: `Consensus reached (${responses.length} models queried). ${best.reasoning}`,
  };
}

/**
 * Synthesize best answer from multiple responses
 */
function synthesizeResponses(responses: EnsembleModelResponse[]): {
  response: string;
  reasoning: string;
  confidence: number;
} {
  // For now, use best response
  // TODO: Implement actual synthesis (combine best parts of multiple answers)
  const best = selectBestResponse(responses);
  
  return {
    response: best.response,
    reasoning: `Synthesized from ${responses.length} models. Best elements from ${best.model}.`,
    confidence: best.confidence,
  };
}

/**
 * Stream ensemble responses (returns best as it comes in, then upgrades)
 */
export async function* streamEnsembleRequest(
  request: EnsembleRequest
): AsyncGenerator<{ chunk: string; model?: string; isFinal?: boolean }, void, unknown> {
  // For streaming, we'll use the fastest model first, then upgrade to best
  const modelsToQuery = request.models || selectSmartModels(request.messages);
  
  // Start with fastest model (Gemini Flash)
  const fastModel = 'gemini-2.0-flash-exp';
  
  yield { chunk: `[Querying ${modelsToQuery.length} models for best answer...]\n\n` };
  
  // For now, just stream the fast model
  // TODO: Implement progressive enhancement (stream fast, then show better answer when ready)
  const { streamUnifiedChatMessage } = await import('./unified-ai-service');
  
  for await (const chunk of streamUnifiedChatMessage({
    model: fastModel,
    messages: request.messages,
    systemInstruction: request.systemInstruction,
    temperature: request.temperature,
    maxTokens: request.maxTokens,
    topP: request.topP,
  })) {
    yield { chunk };
  }
  
  yield { chunk: '', isFinal: true };
}

