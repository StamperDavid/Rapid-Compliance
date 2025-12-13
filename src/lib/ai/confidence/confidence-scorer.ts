/**
 * Confidence Scoring System
 * Determines how confident the AI is in its responses
 */

import type { ConfidenceScore } from '@/types/ai-models';

/**
 * Calculate confidence score for a response
 */
export async function calculateConfidenceScore(params: {
  response: string;
  query: string;
  retrievedContext: any[];
  modelResponses?: Array<{ model: string; response: string }>;
  knowledgeBase?: any;
  historicalData?: any;
}): Promise<ConfidenceScore> {
  const {
    response,
    query,
    retrievedContext,
    modelResponses,
    knowledgeBase,
    historicalData,
  } = params;
  
  // Score 1: Knowledge Coverage (0-100)
  const knowledgeCoverage = await calculateKnowledgeCoverage(
    query,
    retrievedContext
  );
  
  // Score 2: Model Agreement (0-100)
  const modelAgreement = modelResponses
    ? await calculateModelAgreement(modelResponses)
    : 100; // Default to 100 if only one model
  
  // Score 3: Semantic Consistency (0-100)
  const semanticConsistency = await calculateSemanticConsistency(
    response,
    retrievedContext
  );
  
  // Score 4: Historical Accuracy (0-100)
  const historicalAccuracy = historicalData
    ? await calculateHistoricalAccuracy(query, historicalData)
    : 75; // Default to 75 if no historical data
  
  // Weighted average
  const overall = (
    knowledgeCoverage * 0.35 +
    modelAgreement * 0.25 +
    semanticConsistency * 0.30 +
    historicalAccuracy * 0.10
  );
  
  // Determine if should escalate
  const shouldEscalate = overall < 60; // Threshold: 60%
  
  // Build reasoning
  const reasoning = buildReasoningExplanation({
    overall,
    knowledgeCoverage,
    modelAgreement,
    semanticConsistency,
    historicalAccuracy,
  });
  
  return {
    overall: Math.round(overall),
    knowledgeCoverage: Math.round(knowledgeCoverage),
    modelAgreement: Math.round(modelAgreement),
    semanticConsistency: Math.round(semanticConsistency),
    historicalAccuracy: Math.round(historicalAccuracy),
    reasoning,
    shouldEscalate,
  };
}

/**
 * Calculate knowledge coverage
 * How much relevant context was found?
 */
async function calculateKnowledgeCoverage(
  query: string,
  retrievedContext: any[]
): Promise<number> {
  if (retrievedContext.length === 0) {
    return 20; // Very low confidence if no context found
  }
  
  // Check relevance scores (assuming they're provided)
  const avgRelevance = retrievedContext.reduce((sum, ctx) => {
    return sum + (ctx.score || 0.5);
  }, 0) / retrievedContext.length;
  
  // Convert to 0-100 scale
  let score = avgRelevance * 100;
  
  // Bonus for quantity (up to a point)
  if (retrievedContext.length >= 3) score += 10;
  if (retrievedContext.length >= 5) score += 5;
  
  return Math.min(100, score);
}

/**
 * Calculate model agreement
 * Do multiple models agree on the answer?
 */
async function calculateModelAgreement(
  modelResponses: Array<{ model: string; response: string }>
): Promise<number> {
  if (modelResponses.length < 2) {
    return 100; // Can't disagree with yourself
  }
  
  // Simple similarity check (in production, use semantic similarity)
  const responses = modelResponses.map(r => r.response);
  
  // Calculate pairwise similarity
  let totalSimilarity = 0;
  let comparisons = 0;
  
  for (let i = 0; i < responses.length; i++) {
    for (let j = i + 1; j < responses.length; j++) {
      const similarity = calculateTextSimilarity(responses[i], responses[j]);
      totalSimilarity += similarity;
      comparisons++;
    }
  }
  
  const avgSimilarity = comparisons > 0 ? totalSimilarity / comparisons : 1.0;
  
  return avgSimilarity * 100;
}

/**
 * Calculate semantic consistency
 * Does the response match the knowledge base?
 */
async function calculateSemanticConsistency(
  response: string,
  retrievedContext: any[]
): Promise<number> {
  if (retrievedContext.length === 0) {
    return 50; // Neutral if no context
  }
  
  // Check if response contains factual claims from context
  const contextText = retrievedContext
    .map(ctx => ctx.content || ctx.text || '')
    .join(' ');
  
  // Simple keyword overlap (in production, use embeddings)
  const responseWords = new Set(
    response.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  );
  const contextWords = new Set(
    contextText.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  );
  
  let overlap = 0;
  for (const word of responseWords) {
    if (contextWords.has(word)) overlap++;
  }
  
  const overlapRatio = responseWords.size > 0 
    ? overlap / responseWords.size 
    : 0;
  
  // Check for hallucination indicators
  const hallucinationPenalty = checkForHallucinationIndicators(response);
  
  let score = overlapRatio * 100;
  score -= hallucinationPenalty;
  
  return Math.max(0, Math.min(100, score));
}

/**
 * Calculate historical accuracy
 * Has the model been accurate on similar questions?
 */
async function calculateHistoricalAccuracy(
  query: string,
  historicalData: any
): Promise<number> {
  // In production, look up similar past queries and their outcomes
  // For now, return a default
  return 75;
}

/**
 * Calculate text similarity (simple version)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) intersection++;
  }
  
  const union = words1.size + words2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Check for hallucination indicators
 */
function checkForHallucinationIndicators(response: string): number {
  let penalty = 0;
  
  // Vague phrases that might indicate uncertainty
  const vagueIndicators = [
    'i think',
    'maybe',
    'possibly',
    'might be',
    'could be',
    'probably',
    'not sure',
    'i believe',
  ];
  
  const lowerResponse = response.toLowerCase();
  for (const indicator of vagueIndicators) {
    if (lowerResponse.includes(indicator)) {
      penalty += 5;
    }
  }
  
  // Overly specific numbers/dates without context
  const specificPatternWithoutContext = /\b\d{4,}\b/g;
  const matches = response.match(specificPatternWithoutContext);
  if (matches && matches.length > 2) {
    penalty += 10; // Suspicious specificity
  }
  
  return Math.min(30, penalty); // Cap at 30 points
}

/**
 * Build reasoning explanation
 */
function buildReasoningExplanation(scores: {
  overall: number;
  knowledgeCoverage: number;
  modelAgreement: number;
  semanticConsistency: number;
  historicalAccuracy: number;
}): string {
  const parts: string[] = [];
  
  // Overall assessment
  if (scores.overall >= 80) {
    parts.push('High confidence response.');
  } else if (scores.overall >= 60) {
    parts.push('Moderate confidence response.');
  } else if (scores.overall >= 40) {
    parts.push('Low confidence response.');
  } else {
    parts.push('Very low confidence response.');
  }
  
  // Knowledge coverage
  if (scores.knowledgeCoverage < 50) {
    parts.push('Limited relevant information found in knowledge base.');
  } else if (scores.knowledgeCoverage >= 80) {
    parts.push('Strong knowledge base coverage.');
  }
  
  // Model agreement
  if (scores.modelAgreement < 70) {
    parts.push('Models disagree on the answer.');
  } else if (scores.modelAgreement >= 90) {
    parts.push('High model agreement.');
  }
  
  // Semantic consistency
  if (scores.semanticConsistency < 50) {
    parts.push('Response may not align with known facts.');
  } else if (scores.semanticConsistency >= 80) {
    parts.push('Response is consistent with knowledge base.');
  }
  
  return parts.join(' ');
}

/**
 * Get confidence threshold action
 */
export function getConfidenceAction(confidence: number): {
  action: 'respond' | 'respond_with_disclaimer' | 'ask_clarification' | 'escalate_to_human';
  message?: string;
} {
  if (confidence >= 80) {
    return { action: 'respond' };
  } else if (confidence >= 60) {
    return {
      action: 'respond_with_disclaimer',
      message: 'Based on available information:',
    };
  } else if (confidence >= 40) {
    return {
      action: 'ask_clarification',
      message: "I'm not entirely sure about this. Could you provide more details?",
    };
  } else {
    return {
      action: 'escalate_to_human',
      message: "I should get a human colleague to help with this question to ensure accuracy.",
    };
  }
}













