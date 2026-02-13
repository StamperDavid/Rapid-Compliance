/**
 * Golden Playbook Update Pipeline
 * Applies training improvements and correction insights to Golden Playbooks
 * for social media content generation agents
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import type { GoldenPlaybook, PlaybookCorrection } from '@/types/agent-memory';
import type { SocialCorrection } from '@/types/social';
import { logger } from '@/lib/logger/logger';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type {
  ImprovementSuggestion,
  ImpactAnalysis,
} from '@/types/training';
import { generateText } from '@/lib/ai/gemini-service';

// =============================================================================
// Types
// =============================================================================

export interface PlaybookUpdateRequest {
  id: string;
  playbookId: string;
  sourceType: 'corrections' | 'training' | 'performance' | 'manual';
  sourceCorrectionIds?: string[];
  sourceSessionIds?: string[];
  improvements: ImprovementSuggestion[];
  impactAnalysis: ImpactAnalysis;
  status: 'pending_review' | 'approved' | 'rejected' | 'applied';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  createdAt: string;
  appliedAt?: string;
}

interface CorrectionAnalysisResult {
  improvements: ImprovementSuggestion[];
  summary: string;
}

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Create an update request from social media corrections
 * Analyzes user edits to identify patterns and generate improvement suggestions
 */
export async function createUpdateFromCorrections(
  playbookId: string,
  corrections: SocialCorrection[]
): Promise<PlaybookUpdateRequest> {
  logger.info('[Playbook Updater] Creating update request from corrections', {
    playbookId,
    correctionCount: corrections.length,
    file: 'golden-playbook-updater.ts'
  });

  if (corrections.length === 0) {
    throw new Error('No corrections provided for analysis');
  }

  // Get current playbook
  const playbook = await getPlaybook(playbookId);
  if (!playbook) {
    throw new Error('Golden Playbook not found');
  }

  // Analyze corrections with AI
  const analysis = await analyzeCorrections(corrections, playbook);

  // Calculate impact
  const impactAnalysis = analyzeImpact(analysis.improvements);

  // Create update request
  const updateRequest: PlaybookUpdateRequest = {
    id: `playbook_update_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    playbookId,
    sourceType: 'corrections',
    sourceCorrectionIds: corrections.map(c => c.id),
    improvements: analysis.improvements,
    impactAnalysis,
    status: 'pending_review',
    createdAt: new Date().toISOString(),
  };

  // Save to Firestore
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/playbookUpdates`,
    updateRequest.id,
    updateRequest,
    false
  );

  logger.info('[Playbook Updater] Update request created', {
    updateRequestId: updateRequest.id,
    improvementCount: analysis.improvements.length,
    file: 'golden-playbook-updater.ts'
  });

  return updateRequest;
}

/**
 * Create an update request from training session suggestions
 */
export async function createUpdateFromTraining(
  playbookId: string,
  improvements: ImprovementSuggestion[],
  sourceSessionIds: string[]
): Promise<PlaybookUpdateRequest> {
  logger.info('[Playbook Updater] Creating update request from training', {
    playbookId,
    improvementCount: improvements.length,
    file: 'golden-playbook-updater.ts'
  });

  // Get current playbook
  const playbook = await getPlaybook(playbookId);
  if (!playbook) {
    throw new Error('Golden Playbook not found');
  }

  // Analyze impact
  const impactAnalysis = analyzeImpact(improvements);

  // Create update request
  const updateRequest: PlaybookUpdateRequest = {
    id: `playbook_update_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    playbookId,
    sourceType: 'training',
    sourceSessionIds,
    improvements,
    impactAnalysis,
    status: 'pending_review',
    createdAt: new Date().toISOString(),
  };

  // Save to Firestore
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/playbookUpdates`,
    updateRequest.id,
    updateRequest,
    false
  );

  logger.info('[Playbook Updater] Training update request created', {
    updateRequestId: updateRequest.id,
    file: 'golden-playbook-updater.ts'
  });

  return updateRequest;
}

/**
 * Apply an approved update to the playbook
 * Creates a new version with the improvements
 */
export async function applyUpdate(
  updateRequest: PlaybookUpdateRequest
): Promise<GoldenPlaybook> {
  logger.info('[Playbook Updater] Applying update request', {
    updateRequestId: updateRequest.id,
    file: 'golden-playbook-updater.ts'
  });

  const { playbookId, improvements } = updateRequest;

  // Get current playbook
  const currentPlaybook = await getPlaybook(playbookId);
  if (!currentPlaybook) {
    throw new Error('Golden Playbook not found');
  }

  // Create new version
  const currentVersion = parseInt(currentPlaybook.version.replace('v', ''));
  const newVersion = `v${currentVersion + 1}`;

  // Clone current playbook for updates
  const updatedPlaybook: GoldenPlaybook = {
    ...currentPlaybook,
    id: `${playbookId}_${newVersion}`,
    version: newVersion,
    isActive: false,
    updatedAt: new Date().toISOString(),
    previousVersion: currentPlaybook.version,
    changesSummary: `Applied ${improvements.length} improvements from ${updateRequest.sourceType}`,
  };

  // Apply improvements to playbook
  for (const improvement of improvements) {
    applyImprovementToPlaybook(updatedPlaybook, improvement, updateRequest);
  }

  // Recompile prompt
  updatedPlaybook.compiledPrompt = compilePlaybookPrompt(updatedPlaybook);

  // Save new version to Firestore
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.GOLDEN_PLAYBOOKS}`,
    updatedPlaybook.id,
    updatedPlaybook,
    false
  );

  // Update the update request status
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/playbookUpdates`,
    updateRequest.id,
    {
      ...updateRequest,
      status: 'applied',
      appliedAt: new Date().toISOString(),
    },
    false
  );

  logger.info('[Playbook Updater] New playbook version created', {
    newVersion,
    playbookId: updatedPlaybook.id,
    file: 'golden-playbook-updater.ts'
  });

  return updatedPlaybook;
}

/**
 * Get a Golden Playbook by ID
 */
export async function getPlaybook(
  playbookId: string
): Promise<GoldenPlaybook | null> {
  try {
    const playbook = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.GOLDEN_PLAYBOOKS}`,
      playbookId
    );
    return playbook as GoldenPlaybook;
  } catch (error) {
    logger.error('[Playbook Updater] Error fetching Golden Playbook:', error instanceof Error ? error : new Error(String(error)), {
      playbookId,
      file: 'golden-playbook-updater.ts'
    });
    return null;
  }
}

/**
 * Get unanalyzed corrections
 * Returns corrections if count meets minimum threshold
 */
export async function getUnanalyzedCorrections(
  minCount: number = 5
): Promise<SocialCorrection[]> {
  try {
    const { where, orderBy } = await import('firebase/firestore');

    const corrections = await FirestoreService.getAll<SocialCorrection>(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.SOCIAL_CORRECTIONS}`,
      [
        where('analyzed', '==', false),
        orderBy('capturedAt', 'desc'),
      ]
    );

    // Only return if we have enough for meaningful analysis
    if (corrections.length >= minCount) {
      return corrections;
    }

    return [];
  } catch (error) {
    logger.error('[Playbook Updater] Error fetching unanalyzed corrections:', error instanceof Error ? error : new Error(String(error)), {
      file: 'golden-playbook-updater.ts'
    });
    return [];
  }
}

/**
 * Mark corrections as analyzed after processing
 */
export async function markCorrectionsAnalyzed(
  correctionIds: string[]
): Promise<void> {
  try {
    const updatePromises = correctionIds.map(id =>
      FirestoreService.update(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.SOCIAL_CORRECTIONS}`,
        id,
        {
          analyzed: true,
          analyzedAt: new Date().toISOString(),
        }
      )
    );

    await Promise.all(updatePromises);

    logger.info('[Playbook Updater] Marked corrections as analyzed', {
      count: correctionIds.length,
      file: 'golden-playbook-updater.ts'
    });
  } catch (error) {
    logger.error('[Playbook Updater] Error marking corrections as analyzed:', error instanceof Error ? error : new Error(String(error)), {
      file: 'golden-playbook-updater.ts'
    });
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Analyze corrections using AI to identify patterns
 */
async function analyzeCorrections(
  corrections: SocialCorrection[],
  playbook: GoldenPlaybook
): Promise<CorrectionAnalysisResult> {
  // Build analysis prompt
  const prompt = buildCorrectionAnalysisPrompt(corrections, playbook);

  try {
    // Generate AI analysis
    const response = await generateText(
      prompt,
      'You are an expert social media content analyst. Analyze user corrections to identify patterns and generate improvement suggestions. Respond only with valid JSON.'
    );

    // Parse AI response
    const analysis = parseCorrectionAnalysis(response.text);

    return analysis;
  } catch (error) {
    logger.error('[Playbook Updater] Error analyzing corrections with AI:', error instanceof Error ? error : new Error(String(error)), {
      file: 'golden-playbook-updater.ts'
    });

    // Fallback to basic pattern analysis
    return {
      improvements: [],
      summary: 'Failed to analyze corrections with AI',
    };
  }
}

/**
 * Build prompt for AI correction analysis
 */
function buildCorrectionAnalysisPrompt(
  corrections: SocialCorrection[],
  playbook: GoldenPlaybook
): string {
  const correctionExamples = corrections.slice(0, 20).map((c, i) => `
Example ${i + 1}:
Platform: ${c.platform}
Original: "${c.original}"
Corrected: "${c.corrected}"
${c.context ? `Context: ${c.context}` : ''}
  `).join('\n');

  return `
Analyze these social media content corrections made by a user to AI-generated posts.

CURRENT PLAYBOOK VOICE:
Tone: ${playbook.brandVoiceDNA.tone}
Key Messages: ${playbook.brandVoiceDNA.keyMessages.join(', ')}
Common Phrases: ${playbook.brandVoiceDNA.commonPhrases.join(', ')}

CORRECTIONS (${corrections.length} total, showing first 20):
${correctionExamples}

TASK:
Identify patterns in what the user changed:
1. Tone adjustments (e.g., "user prefers shorter, punchier copy")
2. Word replacements (e.g., "user replaces 'utilize' with 'use'")
3. Structural patterns (e.g., "user always adds a question at the end")
4. Platform-specific preferences
5. Brand voice refinements

For each significant pattern, generate an improvement suggestion.

RESPOND WITH VALID JSON ONLY:
{
  "improvements": [
    {
      "id": "unique_id",
      "type": "tone_adjustment",
      "area": "writing_style",
      "currentBehavior": "Current tendency description",
      "suggestedBehavior": "Suggested improvement",
      "priority": 1-10,
      "estimatedImpact": 1-10,
      "confidence": 0.0-1.0
    }
  ],
  "summary": "Brief summary of correction patterns"
}
`.trim();
}

/**
 * Parse AI correction analysis response
 */
function parseCorrectionAnalysis(aiResponse: string): CorrectionAnalysisResult {
  try {
    // Extract JSON from response (handles markdown code blocks)
    let jsonText = aiResponse.trim();

    // Remove markdown code blocks if present
    if (jsonText.startsWith('```')) {
      const match = jsonText.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
      if (match?.[1]) {
        jsonText = match[1];
      }
    }

    const parsed = JSON.parse(jsonText) as {
      improvements?: Array<{
        id?: string;
        type?: string;
        area?: string;
        currentBehavior?: string;
        suggestedBehavior?: string;
        priority?: number;
        estimatedImpact?: number;
        confidence?: number;
      }>;
      summary?: string;
    };

    // Validate and map to ImprovementSuggestion
    const improvements: ImprovementSuggestion[] = (parsed.improvements ?? []).map(imp => ({
      id: imp.id ?? `imp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type: validateImprovementType(imp.type),
      area: imp.area ?? 'unknown',
      currentBehavior: imp.currentBehavior ?? '',
      suggestedBehavior: imp.suggestedBehavior ?? '',
      priority: Math.min(10, Math.max(1, imp.priority ?? 5)),
      estimatedImpact: Math.min(10, Math.max(1, imp.estimatedImpact ?? 5)),
      confidence: Math.min(1, Math.max(0, imp.confidence ?? 0.5)),
    }));

    return {
      improvements,
      summary: parsed.summary ?? 'Correction analysis completed',
    };
  } catch (error) {
    logger.error('[Playbook Updater] Error parsing AI analysis:', error instanceof Error ? error : new Error(String(error)), {
      file: 'golden-playbook-updater.ts'
    });

    return {
      improvements: [],
      summary: 'Failed to parse AI analysis',
    };
  }
}

/**
 * Validate improvement type
 */
function validateImprovementType(type: string | undefined): ImprovementSuggestion['type'] {
  if (type === 'tone_adjustment') {
    return 'tone_adjustment';
  }
  if (type === 'behavior_change') {
    return 'behavior_change';
  }
  if (type === 'knowledge_gap') {
    return 'knowledge_gap';
  }
  if (type === 'process_improvement') {
    return 'process_improvement';
  }

  // Default
  return 'prompt_update';
}

/**
 * Calculate impact analysis from improvements
 */
export function analyzeImpact(
  improvements: ImprovementSuggestion[]
): ImpactAnalysis {
  if (improvements.length === 0) {
    return {
      expectedScoreImprovement: 0,
      areasImproved: [],
      risks: [],
      recommendedTestDuration: 7,
      confidence: 0,
    };
  }

  // Calculate expected improvement
  const avgImpact = improvements.reduce((sum, i) => sum + i.estimatedImpact, 0) / improvements.length;
  const expectedScoreImprovement = Math.round(avgImpact * 1.5);

  // Identify areas that will improve
  const areasImproved = [...new Set(improvements.map(i => i.area))];

  // Identify potential risks
  const risks: string[] = [];

  if (improvements.some(i => i.type === 'tone_adjustment')) {
    risks.push('Tone changes may affect brand voice consistency');
  }

  if (improvements.some(i => i.confidence < 0.7)) {
    risks.push('Some changes have low confidence');
  }

  if (improvements.length > 5) {
    risks.push('Large number of changes may have unexpected interactions');
  }

  // Calculate overall confidence
  const avgConfidence = improvements.reduce((sum, i) => sum + i.confidence, 0) / improvements.length;

  return {
    expectedScoreImprovement,
    areasImproved,
    risks,
    recommendedTestDuration: expectedScoreImprovement > 10 ? 14 : 7,
    confidence: avgConfidence,
  };
}

/**
 * Apply a single improvement to the playbook
 */
function applyImprovementToPlaybook(
  playbook: GoldenPlaybook,
  improvement: ImprovementSuggestion,
  updateRequest: PlaybookUpdateRequest
): void {
  // Add to correction history if from corrections
  if (updateRequest.sourceType === 'corrections' && updateRequest.sourceCorrectionIds) {
    const newCorrections: PlaybookCorrection[] = updateRequest.sourceCorrectionIds.map(id => ({
      id,
      original: improvement.currentBehavior,
      corrected: improvement.suggestedBehavior,
      platform: 'multiple',
      capturedAt: updateRequest.createdAt,
      capturedBy: updateRequest.reviewedBy ?? 'system',
    }));

    playbook.correctionHistory = [
      ...playbook.correctionHistory,
      ...newCorrections,
    ];
  }

  // Apply to brand voice DNA
  if (improvement.type === 'tone_adjustment') {
    // Update tone
    playbook.brandVoiceDNA.tone = improvement.suggestedBehavior;
  }

  // Apply to explicit rules
  if (improvement.area === 'prohibited_topics') {
    if (!playbook.explicitRules.neverPostAbout.includes(improvement.suggestedBehavior)) {
      playbook.explicitRules.neverPostAbout.push(improvement.suggestedBehavior);
    }
  }

  // Apply word replacements to vocabulary
  if (improvement.area === 'word_choice') {
    const match = improvement.suggestedBehavior.match(/replace ['"](.+?)['"] with ['"](.+?)['"]/i);
    const avoidWord = match?.[1];
    const preferWord = match?.[2];

    if (avoidWord && preferWord) {
      if (!playbook.brandVoiceDNA.avoidWords.includes(avoidWord)) {
        playbook.brandVoiceDNA.avoidWords.push(avoidWord);
      }
      if (!playbook.brandVoiceDNA.vocabulary.includes(preferWord)) {
        playbook.brandVoiceDNA.vocabulary.push(preferWord);
      }
    }
  }

  // Apply structural patterns to key messages
  if (improvement.area === 'structure' || improvement.area === 'content_pattern') {
    if (!playbook.brandVoiceDNA.keyMessages.includes(improvement.suggestedBehavior)) {
      playbook.brandVoiceDNA.keyMessages.push(improvement.suggestedBehavior);
    }
  }
}

/**
 * Compile playbook into a single prompt
 * (Simplified version - should match actual builder logic)
 */
function compilePlaybookPrompt(playbook: GoldenPlaybook): string {
  const sections: string[] = [];

  // Brand Voice
  sections.push(`# BRAND VOICE`);
  sections.push(`Tone: ${playbook.brandVoiceDNA.tone}`);
  sections.push(`Key Messages: ${playbook.brandVoiceDNA.keyMessages.join(', ')}`);
  sections.push(`Common Phrases: ${playbook.brandVoiceDNA.commonPhrases.join(', ')}`);
  sections.push(`Preferred Words: ${playbook.brandVoiceDNA.vocabulary.join(', ')}`);
  sections.push(`Avoid Words: ${playbook.brandVoiceDNA.avoidWords.join(', ')}`);

  // Platform Rules
  sections.push(`\n# PLATFORM RULES`);
  for (const rule of playbook.platformRules) {
    sections.push(`\n## ${rule.platform.toUpperCase()}`);
    if (rule.maxLength) {
      sections.push(`Max Length: ${rule.maxLength} characters`);
    }
    if (rule.tone) {
      sections.push(`Tone: ${rule.tone}`);
    }
    if (rule.hashtagPolicy) {
      sections.push(`Hashtags: ${rule.hashtagPolicy}`);
    }
    if (rule.emojiPolicy) {
      sections.push(`Emojis: ${rule.emojiPolicy}`);
    }
    if (rule.ctaStyle) {
      sections.push(`CTA Style: ${rule.ctaStyle}`);
    }
    if (rule.customInstructions && rule.customInstructions.length > 0) {
      sections.push(`Custom: ${rule.customInstructions.join('; ')}`);
    }
  }

  // Explicit Rules
  sections.push(`\n# EXPLICIT RULES`);
  sections.push(`Never Post About: ${playbook.explicitRules.neverPostAbout.join(', ')}`);
  sections.push(`Always Require Approval: ${playbook.explicitRules.alwaysRequireApproval.join(', ')}`);
  sections.push(`Topic Restrictions: ${playbook.explicitRules.topicRestrictions.join(', ')}`);
  sections.push(`Custom Constraints: ${playbook.explicitRules.customConstraints.join(', ')}`);

  return sections.join('\n');
}
