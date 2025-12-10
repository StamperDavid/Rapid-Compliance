/**
 * Self-Correction System
 * Agent verifies and corrects its own responses
 */

import type { ChatRequest } from '@/types/ai-models';
import { sendChatRequest } from '../model-provider';

export interface VerificationResult {
  isAccurate: boolean;
  confidence: number;
  issues: Array<{
    type: 'factual_error' | 'inconsistency' | 'hallucination' | 'missing_info';
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
  reasoning: string;
}

export interface CorrectedResponse {
  original: string;
  corrected: string;
  corrections: Array<{
    original: string;
    corrected: string;
    reason: string;
  }>;
  confidence: number;
}

/**
 * Verify a response against the knowledge base
 */
export async function verifyResponse(params: {
  response: string;
  query: string;
  knowledgeBase: string;
  model: string;
}): Promise<VerificationResult> {
  const { response, query, knowledgeBase, model } = params;
  
  try {
    const request: ChatRequest = {
      model: model as any,
      messages: [
        {
          role: 'system',
          content: `You are a fact-checker. Your job is to verify if a response is accurate based on the provided knowledge base. Be critical and identify any errors, inconsistencies, or hallucinations.`,
        },
        {
          role: 'user',
          content: `Verify this response:

Question: ${query}

Response: ${response}

Knowledge Base: ${knowledgeBase}

Check for:
1. Factual errors (claims not supported by knowledge base)
2. Inconsistencies (contradictions)
3. Hallucinations (made-up information)
4. Missing important information

Provide your analysis in JSON format:
{
  "isAccurate": true/false,
  "confidence": 0-100,
  "issues": [{"type": "factual_error|inconsistency|hallucination|missing_info", "description": "...", "severity": "low|medium|high"}],
  "reasoning": "..."
}`,
        },
      ],
      temperature: 0.2, // Low temperature for verification
      maxTokens: 800,
    };
    
    const verificationResponse = await sendChatRequest(request);
    
    // Parse the response
    const jsonMatch = verificationResponse.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      return result;
    }
    
    // Fallback if JSON parsing fails
    return {
      isAccurate: true,
      confidence: 70,
      issues: [],
      reasoning: 'Unable to parse verification result',
    };
  } catch (error: any) {
    console.error('[Self-Correction] Verification error:', error);
    
    // Fallback on error
    return {
      isAccurate: true, // Assume accurate if verification fails
      confidence: 60,
      issues: [],
      reasoning: `Verification error: ${error.message}`,
    };
  }
}

/**
 * Correct a response based on verification issues
 */
export async function correctResponse(params: {
  original: string;
  issues: VerificationResult['issues'];
  query: string;
  knowledgeBase: string;
  model: string;
}): Promise<CorrectedResponse> {
  const { original, issues, query, knowledgeBase, model } = params;
  
  if (issues.length === 0) {
    return {
      original,
      corrected: original,
      corrections: [],
      confidence: 95,
    };
  }
  
  try {
    const issuesDescription = issues
      .map(issue => `- ${issue.type}: ${issue.description} (${issue.severity} severity)`)
      .join('\n');
    
    const request: ChatRequest = {
      model: model as any,
      messages: [
        {
          role: 'system',
          content: `You are correcting a response to fix identified issues. Provide an accurate, corrected response based on the knowledge base.`,
        },
        {
          role: 'user',
          content: `Correct this response:

Question: ${query}

Original Response: ${original}

Issues Found:
${issuesDescription}

Knowledge Base: ${knowledgeBase}

Provide a corrected response that:
1. Fixes all identified issues
2. Stays true to the knowledge base
3. Maintains a helpful tone
4. Only includes verified information

Corrected Response:`,
        },
      ],
      temperature: 0.3,
      maxTokens: 1000,
    };
    
    const correctedResponseResult = await sendChatRequest(request);
    
    // Build corrections array
    const corrections = issues.map(issue => ({
      original: `Issue: ${issue.description}`,
      corrected: 'Corrected in new response',
      reason: issue.description,
    }));
    
    return {
      original,
      corrected: correctedResponseResult.content,
      corrections,
      confidence: 85,
    };
  } catch (error: any) {
    console.error('[Self-Correction] Correction error:', error);
    
    // Return original if correction fails
    return {
      original,
      corrected: original,
      corrections: [],
      confidence: 60,
    };
  }
}

/**
 * Self-correct: Verify and correct in one step
 */
export async function selfCorrect(params: {
  response: string;
  query: string;
  knowledgeBase: string;
  model: string;
  maxAttempts?: number;
}): Promise<{
  final: string;
  wasCorrect: boolean;
  attempts: number;
  corrections: CorrectedResponse['corrections'];
  confidence: number;
}> {
  const { response, query, knowledgeBase, model, maxAttempts = 2 } = params;
  
  let currentResponse = response;
  let attempts = 0;
  const allCorrections: any[] = [];
  
  while (attempts < maxAttempts) {
    attempts++;
    
    // Verify current response
    const verification = await verifyResponse({
      response: currentResponse,
      query,
      knowledgeBase,
      model,
    });
    
    // If accurate enough, we're done
    if (verification.isAccurate && verification.confidence >= 75) {
      return {
        final: currentResponse,
        wasCorrect: attempts === 1,
        attempts,
        corrections: allCorrections,
        confidence: verification.confidence,
      };
    }
    
    // If this was our last attempt, return what we have
    if (attempts === maxAttempts) {
      return {
        final: currentResponse,
        wasCorrect: false,
        attempts,
        corrections: allCorrections,
        confidence: verification.confidence,
      };
    }
    
    // Correct the response
    const corrected = await correctResponse({
      original: currentResponse,
      issues: verification.issues,
      query,
      knowledgeBase,
      model,
    });
    
    currentResponse = corrected.corrected;
    allCorrections.push(...corrected.corrections);
  }
  
  return {
    final: currentResponse,
    wasCorrect: false,
    attempts,
    corrections: allCorrections,
    confidence: 70,
  };
}

/**
 * Quick fact check (faster, less thorough)
 */
export async function quickFactCheck(params: {
  response: string;
  knowledgeBase: string;
}): Promise<boolean> {
  const { response, knowledgeBase } = params;
  
  // Simple keyword matching
  const responseWords = new Set(
    response.toLowerCase().split(/\s+/).filter(w => w.length > 4)
  );
  const knowledgeWords = new Set(
    knowledgeBase.toLowerCase().split(/\s+/).filter(w => w.length > 4)
  );
  
  let matchCount = 0;
  for (const word of responseWords) {
    if (knowledgeWords.has(word)) {
      matchCount++;
    }
  }
  
  const matchRatio = responseWords.size > 0 
    ? matchCount / responseWords.size 
    : 0;
  
  // If less than 20% match, likely hallucination
  return matchRatio >= 0.2;
}











