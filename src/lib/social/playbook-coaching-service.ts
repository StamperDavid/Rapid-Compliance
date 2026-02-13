/**
 * Playbook Coaching Service
 * Conversational coaching that analyzes correction patterns and playbook state
 * to generate targeted, actionable improvement suggestions.
 *
 * Flow:
 *  1. Load active playbook + recent corrections
 *  2. AI identifies correction patterns and gaps
 *  3. Generates coaching prompts the user can accept/reject
 *  4. Accepted suggestions are queued for playbook update
 */

import type { GoldenPlaybook } from '@/types/agent-memory';
import type { SocialCorrection } from '@/types/social';
import { logger } from '@/lib/logger/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CoachingInsight {
  id: string;
  category: 'tone' | 'length' | 'vocabulary' | 'structure' | 'platform' | 'engagement' | 'compliance';
  severity: 'suggestion' | 'recommendation' | 'important';
  title: string;
  observation: string;
  suggestion: string;
  evidence: { original: string; corrected: string; platform: string }[];
  estimatedImpact: 'low' | 'medium' | 'high';
}

export interface CoachingSession {
  id: string;
  playbookId: string;
  playbookVersion: string;
  insights: CoachingInsight[];
  correctionsAnalyzed: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Coaching Analysis
// ---------------------------------------------------------------------------

/**
 * Generate coaching insights from correction patterns and playbook state.
 * Uses heuristic analysis first, then AI for deeper pattern recognition.
 */
export async function generateCoachingSession(
  playbook: GoldenPlaybook,
  corrections: SocialCorrection[]
): Promise<CoachingSession> {
  logger.info('[Playbook Coach] Generating coaching session', {
    playbookVersion: playbook.version,
    correctionCount: corrections.length,
    file: 'playbook-coaching-service.ts',
  });

  const insights: CoachingInsight[] = [];

  // Heuristic analysis (fast, no AI needed)
  const lengthInsights = analyzeLengthPatterns(corrections);
  const toneInsights = analyzeTonePatterns(corrections);
  const vocabularyInsights = analyzeVocabularyPatterns(corrections);
  const structureInsights = analyzeStructurePatterns(corrections);
  const platformInsights = analyzePlatformPatterns(corrections);

  insights.push(...lengthInsights, ...toneInsights, ...vocabularyInsights, ...structureInsights, ...platformInsights);

  // Playbook gap analysis
  const gapInsights = analyzePlaybookGaps(playbook, corrections);
  insights.push(...gapInsights);

  // AI-powered deep analysis if enough corrections exist
  if (corrections.length >= 3) {
    try {
      const aiInsights = await analyzeWithAI(playbook, corrections);
      insights.push(...aiInsights);
    } catch (err) {
      logger.warn('[Playbook Coach] AI analysis failed, using heuristics only', {
        error: err instanceof Error ? err.message : String(err),
        file: 'playbook-coaching-service.ts',
      });
    }
  }

  // Deduplicate by category (keep highest severity)
  const deduped = deduplicateInsights(insights);

  const session: CoachingSession = {
    id: `coach_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    playbookId: playbook.id,
    playbookVersion: playbook.version,
    insights: deduped,
    correctionsAnalyzed: corrections.length,
    createdAt: new Date().toISOString(),
  };

  logger.info('[Playbook Coach] Session generated', {
    sessionId: session.id,
    insightCount: session.insights.length,
    file: 'playbook-coaching-service.ts',
  });

  return session;
}

// ---------------------------------------------------------------------------
// Heuristic Analyzers
// ---------------------------------------------------------------------------

function analyzeLengthPatterns(corrections: SocialCorrection[]): CoachingInsight[] {
  const insights: CoachingInsight[] = [];

  const shortenedCount = corrections.filter(c => c.corrected.length < c.original.length * 0.85).length;
  const lengthenedCount = corrections.filter(c => c.corrected.length > c.original.length * 1.15).length;

  if (shortenedCount >= 2 && shortenedCount / corrections.length > 0.3) {
    const examples = corrections
      .filter(c => c.corrected.length < c.original.length * 0.85)
      .slice(0, 3)
      .map(c => ({ original: c.original, corrected: c.corrected, platform: c.platform }));

    insights.push({
      id: `insight_length_short_${Date.now()}`,
      category: 'length',
      severity: 'recommendation',
      title: 'Posts are being shortened consistently',
      observation: `${shortenedCount} out of ${corrections.length} corrections shortened the AI-generated content significantly. The AI may be writing too verbosely.`,
      suggestion: 'Update the playbook to instruct shorter, more concise posts. Consider reducing max length guidelines by 20-30%.',
      evidence: examples,
      estimatedImpact: 'medium',
    });
  }

  if (lengthenedCount >= 2 && lengthenedCount / corrections.length > 0.3) {
    const examples = corrections
      .filter(c => c.corrected.length > c.original.length * 1.15)
      .slice(0, 3)
      .map(c => ({ original: c.original, corrected: c.corrected, platform: c.platform }));

    insights.push({
      id: `insight_length_long_${Date.now()}`,
      category: 'length',
      severity: 'suggestion',
      title: 'Posts are being expanded with more detail',
      observation: `${lengthenedCount} corrections added more content. The AI may not be providing enough detail or context.`,
      suggestion: 'Update the playbook to encourage more detailed, substantive posts. Add instructions to include specific examples or data points.',
      evidence: examples,
      estimatedImpact: 'medium',
    });
  }

  return insights;
}

function analyzeTonePatterns(corrections: SocialCorrection[]): CoachingInsight[] {
  const insights: CoachingInsight[] = [];

  // Check for exclamation point reduction (formality increase)
  const exclamationReduced = corrections.filter(c => {
    const originalExcl = (c.original.match(/!/g) ?? []).length;
    const correctedExcl = (c.corrected.match(/!/g) ?? []).length;
    return originalExcl > correctedExcl;
  });

  if (exclamationReduced.length >= 2) {
    insights.push({
      id: `insight_tone_formal_${Date.now()}`,
      category: 'tone',
      severity: 'suggestion',
      title: 'Tone is being made more professional',
      observation: `${exclamationReduced.length} corrections removed exclamation marks or toned down enthusiasm. The AI may be too casual.`,
      suggestion: 'Adjust the brand voice tone from casual/enthusiastic to professional/measured. Reduce exclamation usage in the compiled prompt.',
      evidence: exclamationReduced.slice(0, 2).map(c => ({ original: c.original, corrected: c.corrected, platform: c.platform })),
      estimatedImpact: 'medium',
    });
  }

  // Check for emoji changes
  const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojiReduced = corrections.filter(c => {
    const originalEmojis = (c.original.match(emojiPattern) ?? []).length;
    const correctedEmojis = (c.corrected.match(emojiPattern) ?? []).length;
    return originalEmojis > correctedEmojis + 1;
  });

  if (emojiReduced.length >= 2) {
    insights.push({
      id: `insight_tone_emoji_${Date.now()}`,
      category: 'tone',
      severity: 'recommendation',
      title: 'Emoji usage is being reduced',
      observation: `${emojiReduced.length} corrections removed emojis. The AI may be using too many emojis for the brand voice.`,
      suggestion: 'Update the emoji policy in platform rules to "minimal" or "none". Add explicit instruction to avoid emojis unless context demands them.',
      evidence: emojiReduced.slice(0, 2).map(c => ({ original: c.original, corrected: c.corrected, platform: c.platform })),
      estimatedImpact: 'low',
    });
  }

  return insights;
}

function analyzeVocabularyPatterns(corrections: SocialCorrection[]): CoachingInsight[] {
  const insights: CoachingInsight[] = [];

  // Track word replacements across corrections
  const wordReplacements = new Map<string, { replacement: string; count: number }>();

  for (const c of corrections) {
    const originalWords = new Set(c.original.toLowerCase().split(/\s+/));
    const correctedWords = new Set(c.corrected.toLowerCase().split(/\s+/));

    // Words removed from original
    const removed = [...originalWords].filter(w => !correctedWords.has(w) && w.length > 3);
    // Words added in correction
    const added = [...correctedWords].filter(w => !originalWords.has(w) && w.length > 3);

    // Simple 1:1 mapping heuristic
    if (removed.length === 1 && added.length === 1) {
      const key = removed[0];
      const existing = wordReplacements.get(key);
      if (existing?.replacement === added[0]) {
        existing.count++;
      } else if (!existing) {
        wordReplacements.set(key, { replacement: added[0], count: 1 });
      }
    }
  }

  const frequentReplacements = [...wordReplacements.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count);

  if (frequentReplacements.length > 0) {
    const replacementList = frequentReplacements
      .slice(0, 5)
      .map(([word, { replacement, count }]) => `"${word}" → "${replacement}" (${count}x)`)
      .join(', ');

    insights.push({
      id: `insight_vocab_${Date.now()}`,
      category: 'vocabulary',
      severity: 'recommendation',
      title: 'Consistent word replacements detected',
      observation: `The same words are being replaced repeatedly: ${replacementList}`,
      suggestion: 'Add these preferred words to the playbook vocabulary and the replaced words to the "avoid" list.',
      evidence: corrections.slice(0, 2).map(c => ({ original: c.original, corrected: c.corrected, platform: c.platform })),
      estimatedImpact: 'high',
    });
  }

  return insights;
}

function analyzeStructurePatterns(corrections: SocialCorrection[]): CoachingInsight[] {
  const insights: CoachingInsight[] = [];

  // Check for hashtag additions/removals
  const hashtagPattern = /#\w+/g;
  const hashtagsAdded = corrections.filter(c => {
    const orig = (c.original.match(hashtagPattern) ?? []).length;
    const corr = (c.corrected.match(hashtagPattern) ?? []).length;
    return corr > orig + 1;
  });

  const hashtagsRemoved = corrections.filter(c => {
    const orig = (c.original.match(hashtagPattern) ?? []).length;
    const corr = (c.corrected.match(hashtagPattern) ?? []).length;
    return orig > corr + 1;
  });

  if (hashtagsRemoved.length >= 2) {
    insights.push({
      id: `insight_structure_hashtags_${Date.now()}`,
      category: 'structure',
      severity: 'suggestion',
      title: 'Hashtags are being removed',
      observation: `${hashtagsRemoved.length} corrections removed hashtags. The AI may be over-hashtagging.`,
      suggestion: 'Reduce the hashtag count in platform rules. Consider "sparingly" policy for professional platforms.',
      evidence: hashtagsRemoved.slice(0, 2).map(c => ({ original: c.original, corrected: c.corrected, platform: c.platform })),
      estimatedImpact: 'low',
    });
  }

  if (hashtagsAdded.length >= 2) {
    insights.push({
      id: `insight_structure_hashtags_add_${Date.now()}`,
      category: 'structure',
      severity: 'suggestion',
      title: 'More hashtags are being added',
      observation: `${hashtagsAdded.length} corrections added hashtags. The AI could include more relevant hashtags.`,
      suggestion: 'Update the hashtag policy to "always" and increase the recommended count in platform rules.',
      evidence: hashtagsAdded.slice(0, 2).map(c => ({ original: c.original, corrected: c.corrected, platform: c.platform })),
      estimatedImpact: 'low',
    });
  }

  // Check for CTA changes (links, "learn more", "check out", etc.)
  const ctaPattern = /learn more|check out|click|visit|sign up|try|get started|link in bio/i;
  const ctaAdded = corrections.filter(c => !ctaPattern.test(c.original) && ctaPattern.test(c.corrected));

  if (ctaAdded.length >= 2) {
    insights.push({
      id: `insight_structure_cta_${Date.now()}`,
      category: 'engagement',
      severity: 'recommendation',
      title: 'CTAs are consistently being added',
      observation: `${ctaAdded.length} corrections added a call-to-action that wasn't in the original. The AI should include CTAs by default.`,
      suggestion: 'Update the CTA style in platform rules to "direct" and add instruction to always include a clear call-to-action.',
      evidence: ctaAdded.slice(0, 2).map(c => ({ original: c.original, corrected: c.corrected, platform: c.platform })),
      estimatedImpact: 'high',
    });
  }

  return insights;
}

function analyzePlatformPatterns(corrections: SocialCorrection[]): CoachingInsight[] {
  const insights: CoachingInsight[] = [];

  // Group corrections by platform
  const byPlatform = new Map<string, SocialCorrection[]>();
  for (const c of corrections) {
    const existing = byPlatform.get(c.platform) ?? [];
    existing.push(c);
    byPlatform.set(c.platform, existing);
  }

  // Check if one platform has disproportionate corrections
  const platformCounts = [...byPlatform.entries()]
    .map(([platform, items]) => ({ platform, count: items.length }))
    .sort((a, b) => b.count - a.count);

  if (platformCounts.length >= 2 && platformCounts[0].count > platformCounts[1].count * 2) {
    insights.push({
      id: `insight_platform_focus_${Date.now()}`,
      category: 'platform',
      severity: 'important',
      title: `${platformCounts[0].platform} needs the most correction`,
      observation: `${platformCounts[0].count} corrections on ${platformCounts[0].platform} vs ${platformCounts[1].count} on ${platformCounts[1].platform}. The AI content for ${platformCounts[0].platform} needs more tuning.`,
      suggestion: `Review and update the ${platformCounts[0].platform}-specific rules in the playbook. Consider adding more custom instructions for this platform.`,
      evidence: (byPlatform.get(platformCounts[0].platform) ?? []).slice(0, 2).map(c => ({ original: c.original, corrected: c.corrected, platform: c.platform })),
      estimatedImpact: 'high',
    });
  }

  return insights;
}

function analyzePlaybookGaps(playbook: GoldenPlaybook, corrections: SocialCorrection[]): CoachingInsight[] {
  const insights: CoachingInsight[] = [];

  // Check if playbook has empty sections that corrections could fill
  if (playbook.brandVoiceDNA.keyMessages.length === 0 && corrections.length >= 3) {
    insights.push({
      id: `insight_gap_messages_${Date.now()}`,
      category: 'compliance',
      severity: 'important',
      title: 'No key messages defined in playbook',
      observation: 'Your playbook has no key messages. Without key messages, the AI has no brand messaging to reference during generation.',
      suggestion: 'Add 3-5 key brand messages that should be reflected in your social content. E.g., your unique value proposition, core benefits, or brand promises.',
      evidence: [],
      estimatedImpact: 'high',
    });
  }

  if (playbook.brandVoiceDNA.vocabulary.length === 0 && corrections.length >= 3) {
    insights.push({
      id: `insight_gap_vocab_${Date.now()}`,
      category: 'compliance',
      severity: 'recommendation',
      title: 'No preferred vocabulary defined',
      observation: 'Your playbook has no preferred vocabulary list. The AI is choosing words without brand-specific guidance.',
      suggestion: 'Add industry terms, branded phrases, and preferred word choices to the vocabulary list. This helps the AI match your brand voice.',
      evidence: [],
      estimatedImpact: 'medium',
    });
  }

  if (playbook.correctionHistory.length === 0 && corrections.length >= 5) {
    insights.push({
      id: `insight_gap_corrections_${Date.now()}`,
      category: 'compliance',
      severity: 'important',
      title: 'Playbook has no learned corrections yet',
      observation: `You have ${corrections.length} corrections captured but none applied to the playbook. The AI isn't learning from your edits yet.`,
      suggestion: 'Go to the Corrections Pipeline tab and run "Analyze Corrections" to generate improvement suggestions, then apply them to create a new playbook version.',
      evidence: [],
      estimatedImpact: 'high',
    });
  }

  return insights;
}

// ---------------------------------------------------------------------------
// AI-Powered Analysis
// ---------------------------------------------------------------------------

async function analyzeWithAI(
  playbook: GoldenPlaybook,
  corrections: SocialCorrection[]
): Promise<CoachingInsight[]> {
  const { generateText } = await import('@/lib/ai/gemini-service');

  const correctionSummary = corrections.slice(0, 10).map((c, i) =>
    `${i + 1}. [${c.platform}] Original: "${c.original.slice(0, 150)}" → Corrected: "${c.corrected.slice(0, 150)}"`
  ).join('\n');

  const prompt = `You are a social media coaching AI. Analyze these user corrections to AI-generated social media posts and identify actionable coaching insights.

Current playbook tone: ${playbook.brandVoiceDNA.tone}
Current avoid words: ${playbook.brandVoiceDNA.avoidWords.join(', ') || 'none'}
Current vocabulary: ${playbook.brandVoiceDNA.vocabulary.join(', ') || 'none'}

User corrections:
${correctionSummary}

Identify 1-3 coaching insights that are NOT about post length, NOT about hashtags, and NOT about emojis (those are already detected heuristically). Focus on:
- Brand voice consistency
- Messaging alignment
- Industry-specific language patterns
- Audience engagement patterns

Respond ONLY with a valid JSON array of objects with this exact structure:
[{"title": "string", "observation": "string", "suggestion": "string", "category": "tone|vocabulary|structure|engagement", "estimatedImpact": "low|medium|high"}]`;

  const response = await generateText(prompt, 'You are a social media coaching expert. Respond only with valid JSON.');

  try {
    const jsonMatch = response.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) { return []; }

    const parsed = JSON.parse(jsonMatch[0]) as {
      title: string;
      observation: string;
      suggestion: string;
      category: string;
      estimatedImpact: string;
    }[];

    return parsed.map((item, i) => ({
      id: `insight_ai_${Date.now()}_${i}`,
      category: (['tone', 'vocabulary', 'structure', 'engagement'].includes(item.category)
        ? item.category
        : 'engagement') as CoachingInsight['category'],
      severity: 'suggestion' as const,
      title: item.title,
      observation: item.observation,
      suggestion: item.suggestion,
      evidence: corrections.slice(0, 2).map(c => ({ original: c.original, corrected: c.corrected, platform: c.platform })),
      estimatedImpact: (['low', 'medium', 'high'].includes(item.estimatedImpact)
        ? item.estimatedImpact
        : 'medium') as CoachingInsight['estimatedImpact'],
    }));
  } catch {
    logger.warn('[Playbook Coach] Failed to parse AI coaching response', { file: 'playbook-coaching-service.ts' });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deduplicateInsights(insights: CoachingInsight[]): CoachingInsight[] {
  const byCategory = new Map<string, CoachingInsight[]>();
  for (const insight of insights) {
    const existing = byCategory.get(insight.category) ?? [];
    existing.push(insight);
    byCategory.set(insight.category, existing);
  }

  const severityOrder: Record<string, number> = { important: 3, recommendation: 2, suggestion: 1 };
  const result: CoachingInsight[] = [];

  for (const [, categoryInsights] of byCategory) {
    // Keep up to 2 per category, sorted by severity
    const sorted = categoryInsights.sort(
      (a, b) => (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0)
    );
    result.push(...sorted.slice(0, 2));
  }

  return result;
}
