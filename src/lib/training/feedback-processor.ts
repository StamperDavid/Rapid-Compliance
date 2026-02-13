/**
 * Feedback Processing Engine
 * Analyzes training sessions and generates improvement suggestions
 */

import { generateText } from '@/lib/ai/gemini-service'
import { logger } from '@/lib/logger/logger';
import type {
  TrainingSession,
  TrainingAnalysis,
  ImprovementSuggestion,
  AgentDomain,
} from '@/types/training';

interface ParsedSuggestion {
  type: string;
  area: string;
  currentBehavior: string;
  suggestedBehavior: string;
  implementation?: {
    section: string;
    additions: string[];
    removals: string[];
    modifications: Array<{ from: string; to: string }>;
  };
  priority: number;
  estimatedImpact: number;
}

interface ParsedAnalysisResponse {
  strengths?: string[];
  weaknesses?: string[];
  suggestions: ParsedSuggestion[];
  overallAssessment?: string;
  confidence?: number;
}

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
 * Get the domain-specific preamble for analysis prompts
 */
function getDomainPreamble(agentType: AgentDomain): string {
  switch (agentType) {
    case 'social': {
      return `You are an expert social media strategist analyzing a training session for an AI social media agent.
Focus on: brand voice consistency, platform-appropriate tone, content quality, engagement potential, hashtag usage, CTA effectiveness, and compliance with posting guidelines.
Areas to evaluate: hook quality, platform fit, tone/voice, content structure, audience targeting, timing intuition.`;
    }
    case 'email': {
      return `You are an expert email marketing analyst analyzing a training session for an AI email agent.
Focus on: subject line effectiveness, personalization, CTA clarity, compliance (CAN-SPAM), tone appropriateness, and conversion potential.
Areas to evaluate: subject lines, preview text, body structure, personalization, CTAs, unsubscribe compliance.`;
    }
    case 'voice': {
      return `You are an expert conversational AI analyst analyzing a training session for an AI voice agent.
Focus on: natural speech patterns, pacing, empathy, clarity, escalation handling, and customer satisfaction signals.
Areas to evaluate: greeting warmth, listening signals, response timing, escalation judgment, closing effectiveness.`;
    }
    case 'chat':
    default: {
      return `You are an expert AI trainer analyzing a training session for a sales/support AI agent.
Focus on: sales methodology, objection handling, product knowledge, closing technique, and customer rapport.
Areas to evaluate: greeting, discovery, objection handling, product knowledge, closing, escalation.`;
    }
  }
}

/**
 * Get domain-specific suggestion areas
 */
function getDomainAreas(agentType: AgentDomain): string {
  switch (agentType) {
    case 'social': {
      return 'e.g., "hook_quality", "platform_tone", "hashtag_strategy", "cta_style", "content_structure", "brand_voice"';
    }
    case 'email': {
      return 'e.g., "subject_line", "personalization", "body_structure", "cta_clarity", "compliance"';
    }
    case 'voice': {
      return 'e.g., "greeting", "active_listening", "pacing", "empathy", "escalation_judgment"';
    }
    case 'chat':
    default: {
      return 'e.g., "greeting", "objection_handling", "product_knowledge", "closing", "discovery"';
    }
  }
}

/**
 * Build the analysis prompt for the AI
 */
function buildAnalysisPrompt(session: TrainingSession): string {
  const agentType: AgentDomain = session.agentType ?? 'chat';
  const conversationText = session.messages
    .map(msg => `${msg.role.toUpperCase()}: ${msg.message}`)
    .join('\n\n');

  return `${getDomainPreamble(agentType)}

# Training Session Details
Topic: ${session.topic}
Agent Domain: ${agentType}
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
- Area: specific area to improve (${getDomainAreas(agentType)})
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

    const parsed = JSON.parse(jsonMatch[0]) as ParsedAnalysisResponse;

    // Add IDs to suggestions
    const suggestions: ImprovementSuggestion[] = parsed.suggestions.map((s: ParsedSuggestion, index: number): ImprovementSuggestion => ({
      id: `${session.id}_suggestion_${index}`,
      type: s.type as 'prompt_update' | 'behavior_change' | 'knowledge_gap' | 'tone_adjustment' | 'process_improvement',
      area: s.area,
      currentBehavior: s.currentBehavior,
      suggestedBehavior: s.suggestedBehavior,
      implementation: s.implementation ? {
        section: s.implementation.section as 'greeting' | 'objectives' | 'tone' | 'behavior' | 'knowledge' | 'escalation' | 'closing' | 'custom',
        additions: s.implementation.additions,
        removals: s.implementation.removals,
        modifications: s.implementation.modifications,
      } : undefined,
      priority: s.priority,
      estimatedImpact: s.estimatedImpact,
      confidence: parsed.confidence ?? 0.8,
    }));

    return {
      strengths: parsed.strengths ?? [],
      weaknesses: parsed.weaknesses ?? [],
      suggestions,
      overallAssessment: parsed.overallAssessment ?? '',
      confidence: parsed.confidence ?? 0.8,
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    logger.error('[Feedback Processor] Failed to parse analysis:', error instanceof Error ? error : new Error(String(error)), { file: 'feedback-processor.ts' });

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
 * Analyze social media corrections and generate improvement suggestions.
 * This is the feedback loop for the Golden Playbook system.
 */
export async function analyzeSocialCorrections(
  corrections: Array<{ original: string; corrected: string; platform: string; context?: string }>
): Promise<ImprovementSuggestion[]> {
  if (corrections.length === 0) {
    return [];
  }

  logger.info(`[Feedback Processor] Analyzing ${corrections.length} social corrections`, { file: 'feedback-processor.ts' });

  const correctionText = corrections
    .map((c, i) => `Correction ${i + 1} (${c.platform}):\n  ORIGINAL: ${c.original}\n  CORRECTED: ${c.corrected}${c.context ? `\n  CONTEXT: ${c.context}` : ''}`)
    .join('\n\n');

  const prompt = `You are an expert social media strategist analyzing user corrections to AI-generated social media content.
The user edited AI-generated drafts before approving them. Analyze the patterns in these corrections.

# Corrections
${correctionText}

# Your Task
Identify patterns in how the user corrects the AI's output. For each pattern, provide an improvement suggestion.

Look for:
- **Tone shifts** (more casual, more professional, more punchy)
- **Word replacements** (specific words the user consistently changes)
- **Structural changes** (shorter/longer, question hooks, CTA placement)
- **Platform-specific preferences** (different style per platform)
- **Content focus** (what topics/angles the user emphasizes)

# Output Format (JSON)
{
  "suggestions": [
    {
      "type": "tone_adjustment",
      "area": "brand_voice",
      "currentBehavior": "Uses formal corporate language",
      "suggestedBehavior": "Use conversational, punchy tone with short sentences",
      "priority": 8,
      "estimatedImpact": 9
    }
  ],
  "confidence": 0.85
}

Provide ONLY the JSON, no other text.`;

  try {
    const response = await generateText(prompt);
    const jsonMatch = response.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in correction analysis response');
    }

    const parsed = JSON.parse(jsonMatch[0]) as ParsedAnalysisResponse;
    const suggestions: ImprovementSuggestion[] = (parsed.suggestions ?? []).map(
      (s: ParsedSuggestion, index: number): ImprovementSuggestion => ({
        id: `correction_suggestion_${Date.now()}_${index}`,
        type: s.type as ImprovementSuggestion['type'],
        area: s.area,
        currentBehavior: s.currentBehavior,
        suggestedBehavior: s.suggestedBehavior,
        implementation: s.implementation ? {
          section: s.implementation.section as 'greeting' | 'objectives' | 'tone' | 'behavior' | 'knowledge' | 'escalation' | 'closing' | 'custom',
          additions: s.implementation.additions,
          removals: s.implementation.removals,
          modifications: s.implementation.modifications,
        } : undefined,
        priority: s.priority,
        estimatedImpact: s.estimatedImpact,
        confidence: parsed.confidence ?? 0.75,
      })
    );

    logger.info(`[Feedback Processor] Generated ${suggestions.length} suggestions from corrections`, { file: 'feedback-processor.ts' });
    return suggestions;
  } catch (error) {
    logger.error('[Feedback Processor] Failed to analyze corrections:', error instanceof Error ? error : new Error(String(error)), { file: 'feedback-processor.ts' });
    return [];
  }
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
    const areaList = suggestionsByArea.get(area);
    if (areaList) {
      areaList.push(suggestion);
    } else {
      suggestionsByArea.set(area, [suggestion]);
    }
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
