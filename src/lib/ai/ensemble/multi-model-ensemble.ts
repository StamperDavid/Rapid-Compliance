/**
 * Multi-Model Ensemble
 * Query multiple AI models and pick the best response
 */

import type { ModelName, ChatRequest, IntelligentResponse } from '@/types/ai-models';
import { sendChatRequest } from '../model-provider';
import { calculateConfidenceScore } from '../confidence/confidence-scorer';
import { selfCorrect } from '../verification/self-corrector';

export interface EnsembleConfig {
  models: ModelName[];
  votingStrategy: 'majority' | 'weighted' | 'confidence' | 'fastest';
  minAgreement?: number; // 0-100
  enableSelfCorrection?: boolean;
  maxParallelRequests?: number;
}

export interface EnsembleResult {
  selectedResponse: string;
  selectedModel: ModelName;
  confidence: number;
  
  // All responses
  responses: Array<{
    model: ModelName;
    response: string;
    confidence: number;
    responseTime: number;
    cost: number;
  }>;
  
  // Metadata
  agreement: number; // 0-100
  votingStrategy: string;
  totalCost: number;
  totalTime: number;
}

/**
 * Query multiple models and select best response
 */
export async function queryEnsemble(
  request: ChatRequest,
  config: EnsembleConfig,
  context: {
    retrievedKnowledge: any[];
    knowledgeBase: string;
  }
): Promise<EnsembleResult> {
  const startTime = Date.now();
  
  console.log(`[Ensemble] Querying ${config.models.length} models:`, config.models);
  
  // Query all models in parallel
  const responses = await Promise.all(
    config.models.map(async (model) => {
      try {
        const modelRequest: ChatRequest = {
          ...request,
          model,
        };
        
        const modelStartTime = Date.now();
        const response = await sendChatRequest(modelRequest);
        
        // Calculate confidence for this response
        const confidence = await calculateConfidenceScore({
          response: response.content,
          query: request.messages[request.messages.length - 1].content,
          retrievedContext: context.retrievedKnowledge,
          knowledgeBase: context.knowledgeBase,
        });
        
        return {
          model,
          response: response.content,
          confidence: confidence.overall,
          responseTime: Date.now() - modelStartTime,
          cost: response.usage.cost,
        };
      } catch (error: any) {
        console.error(`[Ensemble] Model ${model} failed:`, error.message);
        
        // Return failed response with zero confidence
        return {
          model,
          response: '',
          confidence: 0,
          responseTime: 0,
          cost: 0,
        };
      }
    })
  );
  
  // Filter out failed responses
  const validResponses = responses.filter(r => r.confidence > 0);
  
  if (validResponses.length === 0) {
    throw new Error('All models failed to respond');
  }
  
  // Select best response based on strategy
  const selected = selectBestResponse(validResponses, config.votingStrategy);
  
  // Calculate agreement
  const agreement = calculateAgreement(validResponses);
  
  // Self-correct if enabled and confidence is low
  let finalResponse = selected.response;
  if (config.enableSelfCorrection && selected.confidence < 80) {
    const corrected = await selfCorrect({
      response: selected.response,
      query: request.messages[request.messages.length - 1].content,
      knowledgeBase: context.knowledgeBase,
      model: selected.model,
    });
    
    if (corrected.confidence > selected.confidence) {
      finalResponse = corrected.final;
      selected.confidence = corrected.confidence;
    }
  }
  
  // Calculate totals
  const totalCost = responses.reduce((sum, r) => sum + r.cost, 0);
  const totalTime = Date.now() - startTime;
  
  return {
    selectedResponse: finalResponse,
    selectedModel: selected.model,
    confidence: selected.confidence,
    responses: validResponses,
    agreement,
    votingStrategy: config.votingStrategy,
    totalCost,
    totalTime,
  };
}

/**
 * Select best response based on voting strategy
 */
function selectBestResponse(
  responses: Array<{
    model: ModelName;
    response: string;
    confidence: number;
    responseTime: number;
    cost: number;
  }>,
  strategy: EnsembleConfig['votingStrategy']
): typeof responses[0] {
  switch (strategy) {
    case 'confidence':
      // Pick highest confidence
      return responses.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
    
    case 'fastest':
      // Pick fastest response with decent confidence (>60)
      const decentResponses = responses.filter(r => r.confidence >= 60);
      if (decentResponses.length === 0) {
        return responses[0];
      }
      return decentResponses.reduce((fastest, current) =>
        current.responseTime < fastest.responseTime ? current : fastest
      );
    
    case 'weighted':
      // Weight by confidence and inverse cost
      const weighted = responses.map(r => ({
        ...r,
        score: r.confidence * (1 / (r.cost + 0.001)), // Avoid division by zero
      }));
      return weighted.reduce((best, current) =>
        current.score > best.score ? current : best
      );
    
    case 'majority':
      // Find most common response (by similarity)
      const clusters = clusterSimilarResponses(responses);
      const largestCluster = clusters.reduce((largest, current) =>
        current.responses.length > largest.responses.length ? current : largest
      );
      
      // From largest cluster, pick highest confidence
      return largestCluster.responses.reduce((best, current) =>
        current.confidence > best.confidence ? current : best
      );
    
    default:
      return responses[0];
  }
}

/**
 * Cluster similar responses
 */
function clusterSimilarResponses(
  responses: Array<{
    model: ModelName;
    response: string;
    confidence: number;
    responseTime: number;
    cost: number;
  }>
): Array<{ responses: typeof responses; representative: string }> {
  const clusters: Array<{ responses: typeof responses; representative: string }> = [];
  
  for (const response of responses) {
    // Find if this response belongs to an existing cluster
    let foundCluster = false;
    
    for (const cluster of clusters) {
      const similarity = calculateResponseSimilarity(
        response.response,
        cluster.representative
      );
      
      if (similarity > 0.7) {
        // Similar enough, add to this cluster
        cluster.responses.push(response);
        foundCluster = true;
        break;
      }
    }
    
    // Create new cluster if not found
    if (!foundCluster) {
      clusters.push({
        responses: [response],
        representative: response.response,
      });
    }
  }
  
  return clusters;
}

/**
 * Calculate similarity between two responses
 */
function calculateResponseSimilarity(response1: string, response2: string): number {
  // Simple word-based similarity
  const words1 = new Set(response1.toLowerCase().split(/\s+/));
  const words2 = new Set(response2.toLowerCase().split(/\s+/));
  
  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) intersection++;
  }
  
  const union = words1.size + words2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Calculate agreement between responses
 */
function calculateAgreement(
  responses: Array<{ response: string }>
): number {
  if (responses.length < 2) return 100;
  
  // Calculate pairwise similarity
  let totalSimilarity = 0;
  let comparisons = 0;
  
  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      const similarity = calculateResponseSimilarity(
        responses[i].response,
        responses[j].response
      );
      totalSimilarity += similarity;
      comparisons++;
    }
  }
  
  const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 1.0;
  return avgSimilarity * 100;
}

/**
 * Quick ensemble (2 models for speed)
 */
export async function quickEnsemble(
  request: ChatRequest,
  context: {
    retrievedKnowledge: any[];
    knowledgeBase: string;
  }
): Promise<EnsembleResult> {
  // Use fastest models: Gemini Flash and Claude Haiku
  const config: EnsembleConfig = {
    models: ['gemini-1.5-flash', 'claude-3-haiku'],
    votingStrategy: 'confidence',
    enableSelfCorrection: false,
  };
  
  return await queryEnsemble(request, config, context);
}

/**
 * Premium ensemble (all top models)
 */
export async function premiumEnsemble(
  request: ChatRequest,
  context: {
    retrievedKnowledge: any[];
    knowledgeBase: string;
  }
): Promise<EnsembleResult> {
  // Use best models: GPT-4, Claude Opus, Gemini Pro
  const config: EnsembleConfig = {
    models: ['gpt-4-turbo', 'claude-3-5-sonnet', 'gemini-1.5-pro'],
    votingStrategy: 'confidence',
    enableSelfCorrection: true,
  };
  
  return await queryEnsemble(request, config, context);
}










