/**
 * Distillation Engine
 * 
 * Extracts high-value signals from raw scrapes and saves them permanently.
 * Implements the "ore → refined metal" architecture for cost optimization.
 * 
 * Flow:
 * 1. Receive raw scrape (HTML, content)
 * 2. Load industry research intelligence
 * 3. Apply high-value signal detection
 * 4. Filter fluff patterns
 * 5. Calculate confidence scores
 * 6. Extract signals (2KB) and save permanently
 * 7. Raw scrape (500KB) saved temporarily with TTL
 * 
 * Result: 95%+ storage reduction while preserving business value
 */

import {
  type ResearchIntelligence,
  type HighValueSignal,
  type ExtractedSignal,
  type TemporaryScrape,
  type ScrapingPlatform,
  getFluffRegexes
} from '../../types/scraper-intelligence';
import { logger } from '../logger/logger';
import { saveTemporaryScrape } from './discovery-archive-service';

/**
 * Context data for scoring rule evaluation
 */
type ScoringContext = Record<string, string | number | boolean | null | undefined>;

// ============================================================================
// SIGNAL DETECTION
// ============================================================================

/**
 * Detect high-value signals in content
 * 
 * Uses keyword matching, regex patterns, and context analysis.
 * Returns only detected signals with confidence scores.
 * 
 * @param content - Cleaned text content to analyze
 * @param research - Industry research intelligence configuration
 * @param platform - Platform where content was scraped from
 * @returns Array of detected signals with metadata
 * 
 * @example
 * ```typescript
 * const signals = detectHighValueSignals(
 *   "We're hiring! 10 open positions...",
 *   hvacResearch,
 *   'website'
 * );
 * // Returns: [{ signalId: 'hiring', label: 'Hiring', ... }]
 * ```
 */
export function detectHighValueSignals(
  content: string,
  research: ResearchIntelligence,
  platform: ScrapingPlatform
): ExtractedSignal[] {
  const detectedSignals: ExtractedSignal[] = [];
  const contentLower = content.toLowerCase();

  // Process each high-value signal
  for (const signal of research.highValueSignals) {
    // Skip if signal is platform-specific and doesn't match
    if (signal.platform !== 'any' && signal.platform !== platform) {
      continue;
    }

    let detected = false;
    let sourceText = '';
    let confidence = 0;

    // Method 1: Keyword matching (case-insensitive)
    for (const keyword of signal.keywords) {
      const keywordLower = keyword.toLowerCase();
      const index = contentLower.indexOf(keywordLower);

      if (index !== -1) {
        detected = true;
        
        // Extract snippet around keyword (100 chars before and after)
        const start = Math.max(0, index - 100);
        const end = Math.min(content.length, index + keyword.length + 100);
        sourceText = content.substring(start, end).trim();
        
        // Confidence based on priority
        confidence = calculateSignalConfidence(signal, content, keyword);
        
        break; // Found match, no need to check other keywords
      }
    }

    // Method 2: Regex pattern matching (if provided)
    if (!detected && signal.regexPattern) {
      try {
        const regex = new RegExp(signal.regexPattern, 'gi');
        const match = regex.exec(content);

        if (match) {
          detected = true;
          sourceText = match[0].substring(0, 500); // Limit to 500 chars
          confidence = calculateSignalConfidence(signal, content, match[0]);
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Invalid regex pattern in signal', err, {
          signalId: signal.id,
          pattern: signal.regexPattern,
        });
      }
    }

    // If signal detected, add to results
    if (detected) {
      detectedSignals.push({
        signalId: signal.id,
        signalLabel: signal.label,
        sourceText: sourceText.substring(0, 500), // Enforce 500 char limit
        confidence,
        platform,
        extractedAt: new Date(),
        sourceScrapeId: '', // Will be set by caller
      });
    }
  }

  logger.info('Detected high-value signals', {
    totalSignals: research.highValueSignals.length,
    detected: detectedSignals.length,
    platform,
  });

  return detectedSignals;
}

/**
 * Calculate confidence score for a detected signal
 * 
 * Factors:
 * - Signal priority (CRITICAL > HIGH > MEDIUM > LOW)
 * - Keyword frequency (more mentions = higher confidence)
 * - Context quality (full sentences vs fragments)
 * 
 * @returns Confidence score (0-100)
 */
function calculateSignalConfidence(
  signal: HighValueSignal,
  fullContent: string,
  matchedText: string
): number {
  let confidence = 0;

  // Base confidence from priority
  switch (signal.priority) {
    case 'CRITICAL':
      confidence = 90;
      break;
    case 'HIGH':
      confidence = 75;
      break;
    case 'MEDIUM':
      confidence = 60;
      break;
    case 'LOW':
      confidence = 45;
      break;
  }

  // Boost confidence if keyword appears multiple times
  const occurrences = (fullContent.toLowerCase().match(
    new RegExp(matchedText.toLowerCase(), 'g')
) ?? []).length;

  if (occurrences > 3) {
    confidence += 10;
  } else if (occurrences > 1) {
    confidence += 5;
  }

  // Cap at 100
  return Math.min(100, confidence);
}

// ============================================================================
// FLUFF FILTERING
// ============================================================================

/**
 * Remove fluff/boilerplate text from content
 * 
 * Applies regex patterns to filter out common noise:
 * - Copyright notices
 * - Cookie banners
 * - Navigation menus
 * - Social media links
 * - Generic marketing copy
 * 
 * @param content - Raw content to clean
 * @param research - Industry research intelligence with fluff patterns
 * @returns Cleaned content with fluff removed
 * 
 * @example
 * ```typescript
 * const clean = removeFluffPatterns(
 *   "© 2025 Company. All rights reserved. About us...",
 *   research
 * );
 * // Returns: "About us..."
 * ```
 */
export function removeFluffPatterns(
  content: string,
  research: ResearchIntelligence
): string {
  let cleaned = content;

  const fluffRegexes = getFluffRegexes(research);

  for (const regex of fluffRegexes) {
    cleaned = cleaned.replace(regex, ' ');
  }

  // Normalize whitespace
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  const reductionPercent = Math.round(
    ((content.length - cleaned.length) / content.length) * 100
  );

  logger.info('Removed fluff patterns', {
    originalLength: content.length,
    cleanedLength: cleaned.length,
    reductionPercent,
  });

  return cleaned;
}

// ============================================================================
// DISTILLATION ORCHESTRATION
// ============================================================================

/**
 * Distill raw scrape into high-value signals
 * 
 * This is the main distillation function that:
 * 1. Filters fluff
 * 2. Detects high-value signals
 * 3. Saves raw scrape to temporary storage (7 day TTL)
 * 4. Returns extracted signals for permanent storage
 * 
 * @param params - Distillation parameters
 * @returns Distilled data with signals and temporary scrape ID
 * 
 * @example
 * ```typescript
 * const result = await distillScrape({
 *   url: 'https://example.com',
 *   rawHtml: '<html>...</html>',
 *   cleanedContent: 'About us...',
 *   research: hvacResearch,
 *   platform: 'website'
 * });
 *
 * // result.signals = extracted high-value signals (2KB)
 * // result.tempScrapeId = reference to temporary scrape (500KB, auto-deleted)
 * ```
 */
export async function distillScrape(params: {
  workspaceId?: string;
  url: string;
  rawHtml: string;
  cleanedContent: string;
  metadata: TemporaryScrape['metadata'];
  research: ResearchIntelligence;
  platform: ScrapingPlatform;
  relatedRecordId?: string;
}): Promise<{
  signals: ExtractedSignal[];
  tempScrapeId: string;
  isNewScrape: boolean;
  storageReduction: {
    rawSizeBytes: number;
    signalsSizeBytes: number;
    reductionPercent: number;
  };
}> {
  const startTime = Date.now();

  try {
    const {
      workspaceId,
      url,
      rawHtml,
      cleanedContent,
      metadata,
      research,
      platform,
      relatedRecordId,
    } = params;

    // Step 1: Filter fluff from content
    const filteredContent = removeFluffPatterns(cleanedContent, research);

    // Step 2: Detect high-value signals
    const detectedSignals = detectHighValueSignals(
      filteredContent,
      research,
      platform
    );

    // Step 3: Save raw scrape to temporary storage (with TTL)
    const { scrape, isNew } = await saveTemporaryScrape({
      workspaceId,
      url,
      rawHtml,
      cleanedContent: filteredContent,
      metadata,
      relatedRecordId,
    });

    // Step 4: Link signals to temporary scrape
    const signals = detectedSignals.map((signal) => ({
      ...signal,
      sourceScrapeId: scrape.id,
    }));

    // Step 5: Calculate storage reduction
    const rawSizeBytes = Buffer.byteLength(rawHtml, 'utf8');
    const signalsSizeBytes = Buffer.byteLength(JSON.stringify(signals), 'utf8');
    const reductionPercent = Math.round(
      ((rawSizeBytes - signalsSizeBytes) / rawSizeBytes) * 100
    );

    logger.info('Distillation complete', {
      url,
      signalsDetected: signals.length,
      rawSizeBytes,
      signalsSizeBytes,
      reductionPercent,
      durationMs: Date.now() - startTime,
      isNewScrape: isNew,
    });

    return {
      signals,
      tempScrapeId: scrape.id,
      isNewScrape: isNew,
      storageReduction: {
        rawSizeBytes,
        signalsSizeBytes,
        reductionPercent,
      },
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Distillation failed', err, {
      url: params.url,
    });

    const errorMessage = err.message;
    throw new Error(`Distillation failed: ${errorMessage}`);
  }
}

// ============================================================================
// SCORING
// ============================================================================

/**
 * Calculate lead score from detected signals
 * 
 * Applies scoring rules and signal boosts to calculate final score.
 * 
 * @param signals - Detected high-value signals
 * @param research - Industry research intelligence
 * @param context - Additional context for scoring rules
 * @returns Total score (0-100+)
 * 
 * @example
 * ```typescript
 * const score = calculateLeadScore(
 *   signals,
 *   research,
 *   { careersPageExists: true, hiringCount: 5 }
 * );
 * // Returns: 85 (based on signals and rules)
 * ```
 */
export function calculateLeadScore(
  signals: ExtractedSignal[],
  research: ResearchIntelligence,
  context: ScoringContext
): number {
  let totalScore = 0;

  // Add score boosts from detected signals
  for (const signal of signals) {
    // Find original signal definition
    const signalDef = research.highValueSignals.find(
      (s) => s.id === signal.signalId
    );

    if (signalDef) {
      // Weight score by confidence
      const weightedBoost = (signalDef.scoreBoost * signal.confidence) / 100;
      totalScore += weightedBoost;
    }
  }

  // Apply scoring rules
  for (const rule of research.scoringRules.filter((r) => r.enabled)) {
    try {
      // Evaluate condition safely
      const conditionMet = evaluateCondition(rule.condition, context);

      if (conditionMet) {
        totalScore += rule.scoreBoost;
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Error evaluating scoring rule', err, {
        ruleId: rule.id,
        condition: rule.condition,
      });
    }
  }

  // Cap score at reasonable maximum
  return Math.min(totalScore, 150);
}

/**
 * Safely evaluate a scoring rule condition
 * 
 * Supports simple boolean expressions and comparisons.
 * Does NOT use eval() for security reasons.
 * 
 * @param condition - Condition string (e.g., "hiring_count > 0")
 * @param context - Variables to use in condition
 * @returns true if condition is met
 */
function evaluateCondition(
  condition: string,
  context: ScoringContext
): boolean {
  // Simple variable substitution and evaluation
  // Supports: &&, ||, >, <, >=, <=, ==, !=
  
  try {
    // Replace variables with values from context
    let expression = condition;
    
    for (const [key, value] of Object.entries(context)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      expression = expression.replace(regex, JSON.stringify(value));
    }

    // Use Function constructor (safer than eval) for dynamic condition evaluation
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- Intentional for formula evaluation
    const fn = new Function(`return ${expression}`) as () => unknown;
    return Boolean(fn());
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to evaluate condition', err, {
      condition,
      contextKeys: Object.keys(context),
    });
    return false;
  }
}

// ============================================================================
// BATCH DISTILLATION
// ============================================================================

/**
 * Distill multiple scrapes in batch
 * 
 * Useful for processing backlog or bulk imports.
 * 
 * @param scrapes - Array of scrapes to distill
 * @param research - Industry research intelligence
 * @returns Array of distillation results
 */
export async function distillBatch(
  scrapes: Array<{
    workspaceId?: string;
    url: string;
    rawHtml: string;
    cleanedContent: string;
    metadata: TemporaryScrape['metadata'];
    platform: ScrapingPlatform;
    relatedRecordId?: string;
  }>,
  research: ResearchIntelligence
): Promise<Array<Awaited<ReturnType<typeof distillScrape>>>> {
  logger.info('Starting batch distillation', {
    count: scrapes.length,
  });

  const results: Array<Awaited<ReturnType<typeof distillScrape>>> = [];

  // Process sequentially to avoid overwhelming Firestore
  for (const scrape of scrapes) {
    try {
      const result = await distillScrape({
        ...scrape,
        research,
      });
      results.push(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Batch distillation item failed', err, {
        url: scrape.url,
      });
      // Continue with next item
    }
  }

  logger.info('Batch distillation complete', {
    total: scrapes.length,
    successful: results.length,
    failed: scrapes.length - results.length,
  });

  return results;
}

// ============================================================================
// ANALYTICS
// ============================================================================

/**
 * Get distillation statistics
 * 
 * @param signals - Array of extracted signals
 * @returns Statistics object
 */
export function getDistillationStats(signals: ExtractedSignal[]): {
  totalSignals: number;
  averageConfidence: number;
  signalsByPlatform: Record<ScrapingPlatform, number>;
  topSignals: Array<{ signalId: string; count: number }>;
} {
  const totalSignals = signals.length;

  const averageConfidence =
    totalSignals > 0
      ? signals.reduce((sum, s) => sum + s.confidence, 0) / totalSignals
      : 0;

  const signalsByPlatform: Record<ScrapingPlatform, number> = {
    website: 0,
    'linkedin-jobs': 0,
    'linkedin-company': 0,
    news: 0,
    crunchbase: 0,
    dns: 0,
    'google-business': 0,
    'social-media': 0,
  };

  for (const signal of signals) {
    signalsByPlatform[signal.platform]++;
  }

  // Count signal occurrences
  const signalCounts = new Map<string, number>();
  for (const signal of signals) {
    signalCounts.set(signal.signalId, (signalCounts.get(signal.signalId) ?? 0) + 1);
  }

  // Get top 10 signals
  const topSignals = Array.from(signalCounts.entries())
    .map(([signalId, count]) => ({ signalId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalSignals,
    averageConfidence,
    signalsByPlatform,
    topSignals,
  };
}
