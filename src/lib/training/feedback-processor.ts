/**
 * Feedback Processing Engine
 * Analyzes training sessions and generates improvement suggestions
 */

import { generateText } from '@/lib/ai/gemini-service'
import { logger } from '@/lib/logger/logger';;
import type {
  TrainingSession,
  TrainingAnalysis,
  ImprovementSuggestion,
  PromptUpdate,
} from '@/types/training';

/**
 * Analyze a training session and generate improvement suggestions
 */
export async function analyzeTrainingSession(
  session: TrainingSession
): Promise<TrainingAnalysis> {
  logger.info('Feedback Processor Analyzing session session.id}', { file: 'feedback-processor.ts' });
  
  // Build analysis prompt
  const prompt = buildAnalysisPrompt(session);
  
  // Get AI analysis
  const response = await generateText(prompt);
  
  // Parse the response
  const analysis = parseAnalysisResponse(response.text, session);
  
  logger.info('Feedback Processor Analysis complete. Found analysis.suggestions.length} improvement suggestions', { file: 'feedback-processor.ts' });
  
  return analysis;
}

/**
 * Build the analysis prompt for the AI
 */
function buildAnalysisPrompt(session: TrainingSession): string {
  const conversationText = session.messages
    .map(msg => `${msg.role.toUpperCase()}: ${msg.message}`)
    .join('\n\n');
  
  return `You are an expert AI trainer analyzing a training session for a sales/support AI agent.

# Training Session Details
Topic: ${session.topic}
${session.scenario ? `Scenario: ${session.scenario}` : ''}
${session.customerPersona ? `Customer Persona: ${session.customerPersona}` : ''}
Score: ${session.score}/100

# Conversation
${conversationText}

# Trainer's Feedback
${session.trainerFeedback}

# Your Task
Analyze this training session and provide:

1. **Strengths** (2-3 things the agent did well)
2. **Weaknesses** (2-3 specific areas for improvement)
3. **Improvement Suggestions** (3-5 actionable suggestions)

For each improvement suggestion, provide:
- Type: prompt_update, behavior_change, knowledge_gap, tone_adjustment, or process_improvement
- Area: specific area to improve (e.g., "greeting", "objection_handling", "product_knowledge")
- Current behavior: what the agent is doing now
- Suggested behavior: what the agent should do instead
- Priority: 1-10 (10 being most important)
- Estimated impact: 1-10 (10 being highest impact)
- Implementation: HOW to implement this (what to add/change in the system prompt)

# Output Format (JSON)
{
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "suggestions": [
    {
      "type": "prompt_update",
      "area": "greeting",
      "currentBehavior": "Generic greeting",
      "suggestedBehavior": "Personalized greeting with customer name",
      "implementation": {
        "section": "greeting",
        "additions": ["Always greet returning customers by name"],
        "removals": [],
        "modifications": []
      },
      "priority": 8,
      "estimatedImpact": 7
    }
  ],
  "overallAssessment": "Brief overall assessment",
  "confidence": 0.85
}

Provide ONLY the JSON, no other text.`;
}

/**
 * Parse the AI's analysis response
 */
function parseAnalysisResponse(
  responseText: string,
  session: TrainingSession
): TrainingAnalysis {
  try {
    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Add IDs to suggestions
    const suggestions: ImprovementSuggestion[] = parsed.suggestions.map((s: any, index: number) => ({
      id: `${session.id}_suggestion_${index}`,
      type: s.type,
      area: s.area,
      currentBehavior: s.currentBehavior,
      suggestedBehavior: s.suggestedBehavior,
      implementation: s.implementation,
      priority: s.priority,
      estimatedImpact: s.estimatedImpact,
      confidence: parsed.confidence || 0.8,
    }));
    
    return {
      strengths: parsed.strengths || [],
      weaknesses: parsed.weaknesses || [],
      suggestions,
      overallAssessment: parsed.overallAssessment || '',
      confidence: parsed.confidence || 0.8,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Feedback Processor] Failed to parse analysis:', error, { file: 'feedback-processor.ts' });
    
    // Return fallback analysis based on score
    return generateFallbackAnalysis(session);
  }
}

/**
 * Generate a fallback analysis if AI parsing fails
 */
function generateFallbackAnalysis(session: TrainingSession): TrainingAnalysis {
  const suggestions: ImprovementSuggestion[] = [];
  
  // If score is low, suggest general improvements
  if (session.score < 70) {
    suggestions.push({
      id: `${session.id}_fallback_1`,
      type: 'behavior_change',
      area: session.topic.toLowerCase().replace(/\s+/g, '_'),
      currentBehavior: 'Agent performance below expectations',
      suggestedBehavior: session.trainerFeedback || 'Improve based on trainer feedback',
      priority: 8,
      estimatedImpact: 7,
      confidence: 0.6,
    });
  }
  
  return {
    strengths: session.score >= 70 ? ['Acceptable performance'] : [],
    weaknesses: session.score < 70 ? ['Performance below target'] : [],
    suggestions,
    overallAssessment: `Training session scored ${session.score}/100. ${session.trainerFeedback}`,
    confidence: 0.6,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Aggregate suggestions from multiple training sessions
 */
export function aggregateSuggestions(
  sessions: TrainingSession[]
): ImprovementSuggestion[] {
  const allSuggestions: ImprovementSuggestion[] = [];
  
  // Collect all suggestions
  for (const session of sessions) {
    if (session.analysis?.suggestions) {
      allSuggestions.push(...session.analysis.suggestions);
    }
  }
  
  // Group by area
  const suggestionsByArea = new Map<string, ImprovementSuggestion[]>();
  for (const suggestion of allSuggestions) {
    const area = suggestion.area;
    if (!suggestionsByArea.has(area)) {
      suggestionsByArea.set(area, []);
    }
    suggestionsByArea.get(area)!.push(suggestion);
  }
  
  // Aggregate suggestions for each area
  const aggregated: ImprovementSuggestion[] = [];
  
  for (const [area, suggestions] of suggestionsByArea.entries()) {
    // Calculate average priority and impact
    const avgPriority = suggestions.reduce((sum, s) => sum + s.priority, 0) / suggestions.length;
    const avgImpact = suggestions.reduce((sum, s) => sum + s.estimatedImpact, 0) / suggestions.length;
    const avgConfidence = suggestions.reduce((sum, s) => sum + s.confidence, 0) / suggestions.length;
    
    // Get the most common suggestion
    const mostCommon = suggestions[0];
    
    aggregated.push({
      ...mostCommon,
      id: `aggregated_${area}_${Date.now()}`,
      priority: Math.round(avgPriority),
      estimatedImpact: Math.round(avgImpact),
      confidence: avgConfidence,
    });
  }
  
  // Sort by priority * impact
  aggregated.sort((a, b) => {
    const scoreA = a.priority * a.estimatedImpact;
    const scoreB = b.priority * b.estimatedImpact;
    return scoreB - scoreA;
  });
  
  return aggregated;
}

/**
 * Filter suggestions by confidence threshold
 */
export function filterByConfidence(
  suggestions: ImprovementSuggestion[],
  minConfidence: number = 0.7
): ImprovementSuggestion[] {
  return suggestions.filter(s => s.confidence >= minConfidence);
}

/**
 * Get top N suggestions by priority and impact
 */
export function getTopSuggestions(
  suggestions: ImprovementSuggestion[],
  count: number = 5
): ImprovementSuggestion[] {
  return suggestions
    .sort((a, b) => {
      const scoreA = a.priority * a.estimatedImpact * a.confidence;
      const scoreB = b.priority * b.estimatedImpact * b.confidence;
      return scoreB - scoreA;
    })
    .slice(0, count);
}



















