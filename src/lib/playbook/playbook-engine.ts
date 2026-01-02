/**
 * Playbook Builder - Pattern Extraction Engine
 * 
 * AI-powered engine that analyzes conversation intelligence data from
 * top performers to extract winning patterns, talk tracks, objection
 * responses, and best practices.
 * 
 * CORE CAPABILITIES:
 * - Pattern extraction from conversation analysis
 * - Talk track identification and cataloging
 * - Objection response library building
 * - Best practice playbook creation
 * - Success pattern matching
 * - Playbook generation and optimization
 * 
 * @module lib/playbook
 */

import { logger } from '@/lib/logger/logger';
import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { adminDal } from '@/lib/firebase/admin-dal';
import type {
  ExtractPatternsRequest,
  PatternExtractionResult,
  Pattern,
  TalkTrack,
  ObjectionResponse,
  PlaybookBestPractice,
  Playbook,
  GeneratePlaybookRequest,
  GeneratePlaybookResponse,
  PlaybookEngineConfig,
  ExtractionSummary,
  PlaybookSuggestion,
  PatternExample,
  TalkTrackSection,
  ObjectionResponseExample,
  BestPracticeEvidence,
  SuccessMetrics,
  ApplicabilityRule,
} from './types';
import { DEFAULT_PLAYBOOK_CONFIG } from './types';
import type {
  ConversationAnalysis,
  Conversation,
  ObjectionAnalysis,
  CoachingInsight,
  KeyMoment,
} from '@/lib/conversation/types';
import type {
  RepPerformanceMetrics,
} from '@/lib/performance/types';

// ============================================================================
// MAIN EXTRACTION FUNCTION
// ============================================================================

/**
 * Extract patterns from conversation intelligence data
 * 
 * @param request - Extraction request
 * @param config - Optional engine configuration
 * @returns Pattern extraction results
 */
export async function extractPatterns(
  request: ExtractPatternsRequest,
  config: Partial<PlaybookEngineConfig> = {}
): Promise<PatternExtractionResult> {
  const startTime = Date.now();
  const fullConfig: PlaybookEngineConfig = { ...DEFAULT_PLAYBOOK_CONFIG, ...config };
  
  try {
    logger.info('Extracting patterns from conversations', {
      organizationId: request.organizationId,
      conversationCount: request.conversationIds?.length || 'all',
      repCount: request.repIds?.length || 'top performers',
    });
    
    // 1. Get conversation analyses to extract from
    const analyses = await getConversationAnalyses(request, fullConfig);
    
    if (analyses.length < fullConfig.minSampleSize) {
      throw new Error(
        `Insufficient data: Need at least ${fullConfig.minSampleSize} conversations, got ${analyses.length}`
      );
    }
    
    logger.info(`Analyzing ${analyses.length} conversations for pattern extraction`);
    
    // 2. Extract different types of patterns
    const patterns: Pattern[] = [];
    const talkTracks: TalkTrack[] = [];
    const objectionResponses: ObjectionResponse[] = [];
    const bestPractices: PlaybookBestPractice[] = [];
    
    // Extract patterns
    if (request.extractPatterns !== false && fullConfig.enablePatternDetection) {
      const extractedPatterns = await extractConversationPatterns(
        analyses,
        request,
        fullConfig
      );
      patterns.push(...extractedPatterns);
      logger.info(`Extracted ${extractedPatterns.length} patterns`);
    }
    
    // Extract talk tracks
    if (request.extractTalkTracks !== false && fullConfig.enableTalkTrackExtraction) {
      const extractedTalkTracks = await extractTalkTracks(
        analyses,
        request,
        fullConfig
      );
      talkTracks.push(...extractedTalkTracks);
      logger.info(`Extracted ${extractedTalkTracks.length} talk tracks`);
    }
    
    // Extract objection responses
    if (request.extractObjectionResponses !== false && fullConfig.enableObjectionResponseExtraction) {
      const extractedObjectionResponses = await extractObjectionResponses(
        analyses,
        request,
        fullConfig
      );
      objectionResponses.push(...extractedObjectionResponses);
      logger.info(`Extracted ${extractedObjectionResponses.length} objection responses`);
    }
    
    // Extract best practices
    if (request.extractBestPractices !== false && fullConfig.enableBestPracticeExtraction) {
      const extractedBestPractices = await extractBestPractices(
        analyses,
        request,
        fullConfig
      );
      bestPractices.push(...extractedBestPractices);
      logger.info(`Extracted ${extractedBestPractices.length} best practices`);
    }
    
    // 3. Generate summary and suggestions
    const summary = generateExtractionSummary(
      patterns,
      talkTracks,
      objectionResponses,
      bestPractices,
      fullConfig
    );
    
    const processingTime = Date.now() - startTime;
    
    // 4. Emit signal
    const coordinator = await getServerSignalCoordinator();
    await coordinator.emitSignal({
      type: 'playbook.patterns_extracted' as any,
      orgId: request.organizationId,
      workspaceId: request.workspaceId || 'default',
      priority: 'Medium',
      confidence: summary.highConfidencePatterns > 0 ? 0.8 : 0.6,
      metadata: {
        conversationsAnalyzed: analyses.length,
        patternsExtracted: patterns.length,
        talkTracksExtracted: talkTracks.length,
        objectionResponsesExtracted: objectionResponses.length,
        bestPracticesExtracted: bestPractices.length,
        highConfidencePatterns: summary.highConfidencePatterns,
        processingTime,
      },
    });
    
    logger.info('Pattern extraction completed', {
      organizationId: request.organizationId,
      patterns: patterns.length,
      talkTracks: talkTracks.length,
      objectionResponses: objectionResponses.length,
      bestPractices: bestPractices.length,
      processingTime,
    });
    
    return {
      organizationId: request.organizationId,
      workspaceId: request.workspaceId || 'default',
      patterns,
      talkTracks,
      objectionResponses,
      bestPractices,
      summary,
      extractedAt: new Date(),
      conversationsAnalyzed: analyses.length,
      repsAnalyzed: getUniqueReps(analyses).length,
      aiModel: fullConfig.aiModel,
      processingTime,
    };
    
  } catch (error) {
    logger.error('Pattern extraction failed', { error, request });
    throw error;
  }
}

// ============================================================================
// PATTERN EXTRACTION
// ============================================================================

/**
 * Extract conversation patterns from analyses
 */
async function extractConversationPatterns(
  analyses: ConversationAnalysisWithConversation[],
  request: ExtractPatternsRequest,
  config: PlaybookEngineConfig
): Promise<Pattern[]> {
  // Group analyses by category for pattern detection
  const patternCandidates: Map<string, PatternCandidate> = new Map();
  
  // Analyze each conversation for patterns
  for (const analysis of analyses) {
    // Extract patterns from key moments
    for (const moment of analysis.analysis.keyMoments) {
      const patternKey = generatePatternKey(moment);
      
      if (!patternCandidates.has(patternKey)) {
        patternCandidates.set(patternKey, {
          key: patternKey,
          type: moment.type,
          occurrences: [],
          successRate: 0,
          avgSentimentChange: 0,
        });
      }
      
      const candidate = patternCandidates.get(patternKey)!;
      candidate.occurrences.push({
        conversationId: analysis.conversation.id,
        repId: analysis.conversation.repId,
        moment,
        overallScore: analysis.analysis.scores.overall,
        sentimentScore: analysis.analysis.sentiment.overall.score,
      });
    }
    
    // Extract patterns from coaching insights
    for (const insight of analysis.analysis.coachingInsights) {
      if (insight.whatWentWell) {
        const patternKey = `coaching_${insight.category}_${insight.skillArea}`;
        
        if (!patternCandidates.has(patternKey)) {
          patternCandidates.set(patternKey, {
            key: patternKey,
            type: 'coaching',
            category: insight.category,
            occurrences: [],
            successRate: 0,
            avgSentimentChange: 0,
          });
        }
        
        const candidate = patternCandidates.get(patternKey)!;
        candidate.occurrences.push({
          conversationId: analysis.conversation.id,
          repId: analysis.conversation.repId,
          insight,
          overallScore: analysis.analysis.scores.overall,
          sentimentScore: analysis.analysis.sentiment.overall.score,
        });
      }
    }
  }
  
  // Use AI to analyze pattern candidates and extract real patterns
  const patterns = await analyzePatternCandidatesWithAI(
    Array.from(patternCandidates.values()),
    analyses,
    config
  );
  
  // Filter patterns by frequency and success rate
  return patterns.filter(p => 
    p.frequency >= (request.minFrequency || config.minFrequency) &&
    p.successRate >= (request.minSuccessRate || config.minSuccessRate) &&
    p.confidence >= (request.minConfidence || config.minConfidence)
  );
}

/**
 * Use AI to analyze pattern candidates and extract structured patterns
 */
async function analyzePatternCandidatesWithAI(
  candidates: PatternCandidate[],
  analyses: ConversationAnalysisWithConversation[],
  config: PlaybookEngineConfig
): Promise<Pattern[]> {
  if (candidates.length === 0) return [];
  
  const prompt = buildPatternExtractionPrompt(candidates, analyses);
  
  const response = await sendUnifiedChatMessage({
    model: config.aiModel,
    messages: [
      {
        role: 'system',
        content: PATTERN_EXTRACTION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
  
  const content = response.text;
  if (!content) {
    throw new Error('Failed to get AI response for pattern extraction');
  }
  
  // Parse AI response into structured patterns
  return parsePatternResponse(content, candidates, analyses);
}

// ============================================================================
// TALK TRACK EXTRACTION
// ============================================================================

/**
 * Extract talk tracks from analyses
 */
async function extractTalkTracks(
  analyses: ConversationAnalysisWithConversation[],
  request: ExtractPatternsRequest,
  config: PlaybookEngineConfig
): Promise<TalkTrack[]> {
  // Group high-performing conversations by purpose
  const talkTrackCandidates: Map<string, TalkTrackCandidate> = new Map();
  
  // Only analyze conversations with high scores
  const highPerformers = analyses.filter(a => 
    a.analysis.scores.overall >= config.minPerformanceScore
  );
  
  // Extract successful talk tracks from transcripts
  for (const analysis of highPerformers) {
    if (!analysis.conversation.transcript) continue;
    
    // Extract key phrases and successful messaging
    const keyPhrases = extractKeyPhrasesFromTranscript(
      analysis.conversation.transcript,
      analysis.analysis
    );
    
    for (const phrase of keyPhrases) {
      const trackKey = phrase.purpose;
      
      if (!talkTrackCandidates.has(trackKey)) {
        talkTrackCandidates.set(trackKey, {
          purpose: phrase.purpose,
          examples: [],
          avgSuccessRate: 0,
          avgSentiment: 0,
        });
      }
      
      const candidate = talkTrackCandidates.get(trackKey)!;
      candidate.examples.push({
        conversationId: analysis.conversation.id,
        repId: analysis.conversation.repId,
        repName: getRepName(analysis.conversation.repId, analyses),
        phrase: phrase.text,
        context: phrase.context,
        overallScore: analysis.analysis.scores.overall,
        sentimentScore: analysis.analysis.sentiment.overall.score,
      });
    }
  }
  
  // Use AI to generate structured talk tracks
  const talkTracks = await analyzeTalkTrackCandidatesWithAI(
    Array.from(talkTrackCandidates.values()),
    highPerformers,
    config
  );
  
  // Filter by success rate
  return talkTracks.filter(t => 
    t.successRate >= config.minTalkTrackSuccessRate &&
    t.confidence >= config.minConfidence
  );
}

/**
 * Use AI to generate structured talk tracks from candidates
 */
async function analyzeTalkTrackCandidatesWithAI(
  candidates: TalkTrackCandidate[],
  analyses: ConversationAnalysisWithConversation[],
  config: PlaybookEngineConfig
): Promise<TalkTrack[]> {
  if (candidates.length === 0) return [];
  
  const prompt = buildTalkTrackExtractionPrompt(candidates, analyses);
  
  const response = await sendUnifiedChatMessage({
    model: config.aiModel,
    messages: [
      {
        role: 'system',
        content: TALK_TRACK_EXTRACTION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
  
  const content = response.text;
  if (!content) {
    throw new Error('Failed to get AI response for talk track extraction');
  }
  
  return parseTalkTrackResponse(content, candidates, analyses);
}

// ============================================================================
// OBJECTION RESPONSE EXTRACTION
// ============================================================================

/**
 * Extract objection responses from analyses
 */
async function extractObjectionResponses(
  analyses: ConversationAnalysisWithConversation[],
  request: ExtractPatternsRequest,
  config: PlaybookEngineConfig
): Promise<ObjectionResponse[]> {
  // Group objections by type and successful responses
  const responseMap: Map<string, ObjectionResponseCandidate> = new Map();
  
  for (const analysis of analyses) {
    for (const objection of analysis.analysis.objections) {
      // Only extract from successfully handled objections
      if (!objection.wasAddressed || objection.responseQuality === 'poor' || objection.responseQuality === 'none') {
        continue;
      }
      
      const responseKey = `${objection.type}_${objection.severity}`;
      
      if (!responseMap.has(responseKey)) {
        responseMap.set(responseKey, {
          objectionType: objection.type,
          severity: objection.severity,
          examples: [],
          avgSuccessRate: 0,
        });
      }
      
      const candidate = responseMap.get(responseKey)!;
      candidate.examples.push({
        conversationId: analysis.conversation.id,
        repId: analysis.conversation.repId,
        repName: getRepName(analysis.conversation.repId, analyses),
        objection,
        overallScore: analysis.analysis.scores.overall,
        objectionHandlingScore: analysis.analysis.scores.objectionHandling,
        sentimentChange: calculateSentimentChange(analysis.analysis, objection.timestamp),
      });
    }
  }
  
  // Use AI to generate structured objection responses
  const objectionResponses = await analyzeObjectionResponsesWithAI(
    Array.from(responseMap.values()),
    analyses,
    config
  );
  
  // Filter by success rate
  return objectionResponses.filter(r => 
    r.successRate >= config.minObjectionResponseSuccessRate &&
    r.confidence >= config.minConfidence
  );
}

/**
 * Use AI to generate structured objection responses
 */
async function analyzeObjectionResponsesWithAI(
  candidates: ObjectionResponseCandidate[],
  analyses: ConversationAnalysisWithConversation[],
  config: PlaybookEngineConfig
): Promise<ObjectionResponse[]> {
  if (candidates.length === 0) return [];
  
  const prompt = buildObjectionResponseExtractionPrompt(candidates, analyses);
  
  const response = await sendUnifiedChatMessage({
    model: config.aiModel,
    messages: [
      {
        role: 'system',
        content: OBJECTION_RESPONSE_EXTRACTION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
  
  const content = response.text;
  if (!content) {
    throw new Error('Failed to get AI response for objection response extraction');
  }
  
  return parseObjectionResponseResponse(content, candidates, analyses);
}

// ============================================================================
// BEST PRACTICE EXTRACTION
// ============================================================================

/**
 * Extract best practices from analyses
 */
async function extractBestPractices(
  analyses: ConversationAnalysisWithConversation[],
  request: ExtractPatternsRequest,
  config: PlaybookEngineConfig
): Promise<PlaybookBestPractice[]> {
  // Identify top performers
  const topPerformers = analyses
    .filter(a => a.analysis.scores.overall >= config.minPerformanceScore)
    .sort((a, b) => b.analysis.scores.overall - a.analysis.scores.overall)
    .slice(0, Math.ceil(analyses.length * (1 - config.topPerformerPercentile / 100)));
  
  // Group by coaching category
  const practiceMap: Map<string, BestPracticeCandidate> = new Map();
  
  for (const analysis of topPerformers) {
    for (const insight of analysis.analysis.coachingInsights) {
      if (!insight.whatWentWell) continue;
      
      const practiceKey = `${insight.category}_${insight.skillArea}`;
      
      if (!practiceMap.has(practiceKey)) {
        practiceMap.set(practiceKey, {
          category: insight.category,
          skillArea: insight.skillArea,
          examples: [],
          topPerformerIds: new Set(),
          avgImpact: 0,
        });
      }
      
      const candidate = practiceMap.get(practiceKey)!;
      candidate.examples.push({
        conversationId: analysis.conversation.id,
        repId: analysis.conversation.repId,
        repName: getRepName(analysis.conversation.repId, analyses),
        insight,
        overallScore: analysis.analysis.scores.overall,
      });
      candidate.topPerformerIds.add(analysis.conversation.repId);
    }
  }
  
  // Use AI to generate structured best practices
  const bestPractices = await analyzeBestPracticesWithAI(
    Array.from(practiceMap.values()),
    topPerformers,
    analyses,
    config
  );
  
  // Filter by impact and confidence
  return bestPractices.filter(p => 
    p.confidence >= config.minConfidence &&
    p.sampleSize >= config.minFrequency
  );
}

/**
 * Use AI to generate structured best practices
 */
async function analyzeBestPracticesWithAI(
  candidates: BestPracticeCandidate[],
  topPerformers: ConversationAnalysisWithConversation[],
  allAnalyses: ConversationAnalysisWithConversation[],
  config: PlaybookEngineConfig
): Promise<PlaybookBestPractice[]> {
  if (candidates.length === 0) return [];
  
  const prompt = buildBestPracticeExtractionPrompt(candidates, topPerformers, allAnalyses);
  
  const response = await sendUnifiedChatMessage({
    model: config.aiModel,
    messages: [
      {
        role: 'system',
        content: BEST_PRACTICE_EXTRACTION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    temperature: config.temperature,
    maxTokens: config.maxTokens,
  });
  
  const content = response.text;
  if (!content) {
    throw new Error('Failed to get AI response for best practice extraction');
  }
  
  return parseBestPracticeResponse(content, candidates, topPerformers, allAnalyses);
}

// ============================================================================
// PLAYBOOK GENERATION
// ============================================================================

/**
 * Generate a complete playbook from extracted patterns
 * 
 * @param request - Playbook generation request
 * @param config - Optional engine configuration
 * @returns Generated playbook and metadata
 */
export async function generatePlaybook(
  request: GeneratePlaybookRequest,
  config: Partial<PlaybookEngineConfig> = {}
): Promise<GeneratePlaybookResponse> {
  const startTime = Date.now();
  
  try {
    logger.info('Generating playbook', {
      organizationId: request.organizationId,
      name: request.name,
      category: request.category,
    });
    
    // 1. Extract patterns from conversations
    const extractionRequest: ExtractPatternsRequest = {
      organizationId: request.organizationId,
      workspaceId: request.workspaceId,
      conversationIds: request.sourceConversationIds,
      repIds: request.topPerformerIds,
      conversationType: request.conversationType,
      minPerformanceScore: request.minPerformanceScore,
      dateRange: request.dateRange,
      extractPatterns: request.includePatterns,
      extractTalkTracks: request.includeTalkTracks,
      extractObjectionResponses: request.includeObjectionResponses,
      extractBestPractices: request.includeBestPractices,
      includeExamples: true,
      maxExamplesPerPattern: 5,
    };
    
    const extractionResult = await extractPatterns(extractionRequest, config);
    
    // 2. Calculate success metrics
    const successMetrics = calculateSuccessMetrics(extractionResult);
    
    // 3. Build playbook
    const playbook: Playbook = {
      id: generatePlaybookId(),
      organizationId: request.organizationId,
      workspaceId: request.workspaceId || 'default',
      name: request.name,
      description: request.description || `Playbook for ${request.conversationType} conversations`,
      category: request.category,
      tags: [request.conversationType, request.category],
      conversationType: request.conversationType,
      patterns: extractionResult.patterns,
      talkTracks: extractionResult.talkTracks,
      objectionResponses: extractionResult.objectionResponses,
      bestPractices: extractionResult.bestPractices,
      successMetrics,
      sourceConversations: request.sourceConversationIds || [],
      topPerformers: request.topPerformerIds || [],
      adoptionRate: 0,
      effectiveness: successMetrics.confidence,
      usageCount: 0,
      status: request.autoActivate ? 'active' : 'draft',
      confidence: extractionResult.summary.highConfidencePatterns / Math.max(1, extractionResult.summary.totalPatternsFound) * 100,
      createdBy: request.organizationId, // TODO: Get actual user ID
      createdAt: new Date(),
      version: 1,
    };
    
    // 4. Save playbook to Firestore (if auto-activate)
    if (request.autoActivate) {
      await savePlaybook(playbook);
    }
    
    // 5. Emit signal
    const coordinator = await getServerSignalCoordinator();
    await coordinator.emitSignal({
      type: 'playbook.generated' as any,
      orgId: request.organizationId,
      workspaceId: request.workspaceId || 'default',
      priority: 'Medium',
      confidence: playbook.confidence / 100,
      metadata: {
        playbookId: playbook.id,
        playbookName: playbook.name,
        category: playbook.category,
        conversationType: playbook.conversationType,
        patternsCount: playbook.patterns.length,
        talkTracksCount: playbook.talkTracks.length,
        objectionResponsesCount: playbook.objectionResponses.length,
        bestPracticesCount: playbook.bestPractices.length,
        sourceConversations: playbook.sourceConversations.length,
        topPerformers: playbook.topPerformers.length,
        confidence: playbook.confidence,
        status: playbook.status,
      },
    });
    
    const processingTime = Date.now() - startTime;
    
    logger.info('Playbook generated successfully', {
      playbookId: playbook.id,
      organizationId: request.organizationId,
      processingTime,
    });
    
    return {
      success: true,
      playbook,
      extractionResult,
      metadata: {
        generatedAt: new Date(),
        processingTime,
        aiModel: config.aiModel || DEFAULT_PLAYBOOK_CONFIG.aiModel,
        confidence: playbook.confidence,
      },
    };
    
  } catch (error) {
    logger.error('Playbook generation failed', { error, request });
    
    return {
      success: false,
      playbook: {} as Playbook,
      extractionResult: {} as PatternExtractionResult,
      metadata: {
        generatedAt: new Date(),
        processingTime: Date.now() - startTime,
        aiModel: config.aiModel || DEFAULT_PLAYBOOK_CONFIG.aiModel,
        confidence: 0,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get conversation analyses based on request criteria
 */
async function getConversationAnalyses(
  request: ExtractPatternsRequest,
  config: PlaybookEngineConfig
): Promise<ConversationAnalysisWithConversation[]> {
  // TODO: Implement actual Firestore queries
  // For now, return mock data structure
  
  // This would query:
  // 1. Conversations collection filtered by:
  //    - organizationId
  //    - conversationIds (if specified)
  //    - conversationType (if specified)
  //    - dateRange (if specified)
  // 2. ConversationAnalyses collection for those conversations
  // 3. Filter by minPerformanceScore
  // 4. If repIds specified, filter by those reps
  // 5. Otherwise, get top performers based on topPerformerPercentile
  
  return [];
}

/**
 * Generate pattern key for grouping similar patterns
 */
function generatePatternKey(moment: KeyMoment): string {
  return `${moment.type}_${moment.significance}`;
}

/**
 * Extract key phrases from transcript
 */
function extractKeyPhrasesFromTranscript(
  transcript: string,
  analysis: ConversationAnalysis
): KeyPhrase[] {
  // TODO: Implement NLP-based key phrase extraction
  // For now, return empty array
  return [];
}

/**
 * Get rep name from analyses
 */
function getRepName(repId: string, analyses: ConversationAnalysisWithConversation[]): string {
  // TODO: Get actual rep name from user database
  return `Rep ${repId.slice(0, 8)}`;
}

/**
 * Calculate sentiment change at a specific timestamp
 */
function calculateSentimentChange(analysis: ConversationAnalysis, timestamp: number): number {
  const timeline = analysis.sentiment.timeline;
  if (timeline.length === 0) return 0;
  
  const beforeIndex = timeline.findIndex(t => t.timestamp >= timestamp);
  if (beforeIndex <= 0) return 0;
  
  const afterIndex = Math.min(beforeIndex + 5, timeline.length - 1);
  const before = timeline[beforeIndex - 1].sentiment;
  const after = timeline[afterIndex].sentiment;
  
  return after - before;
}

/**
 * Get unique reps from analyses
 */
function getUniqueReps(analyses: ConversationAnalysisWithConversation[]): string[] {
  const reps = new Set<string>();
  for (const analysis of analyses) {
    reps.add(analysis.conversation.repId);
  }
  return Array.from(reps);
}

/**
 * Generate extraction summary
 */
function generateExtractionSummary(
  patterns: Pattern[],
  talkTracks: TalkTrack[],
  objectionResponses: ObjectionResponse[],
  bestPractices: PlaybookBestPractice[],
  config: PlaybookEngineConfig
): ExtractionSummary {
  const highConfidencePatterns = patterns.filter(p => p.confidence >= 80).length;
  
  const topPatterns = patterns
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5);
  
  const topTalkTracks = talkTracks
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5);
  
  const topObjectionResponses = objectionResponses
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 5);
  
  return {
    totalPatternsFound: patterns.length,
    highConfidencePatterns,
    totalTalkTracksFound: talkTracks.length,
    totalObjectionResponsesFound: objectionResponses.length,
    totalBestPracticesFound: bestPractices.length,
    topPatterns,
    topTalkTracks,
    topObjectionResponses,
    recommendations: [],
    suggestedPlaybooks: [],
  };
}

/**
 * Calculate success metrics for a playbook
 */
function calculateSuccessMetrics(extraction: PatternExtractionResult): SuccessMetrics {
  // Calculate aggregate metrics from all patterns
  const avgConversion = extraction.patterns.reduce((sum, p) => sum + p.successRate, 0) / Math.max(1, extraction.patterns.length);
  const avgSentiment = extraction.patterns.reduce((sum, p) => sum + (p.avgSentimentChange + 1) / 2 * 100, 0) / Math.max(1, extraction.patterns.length);
  const avgObjectionSuccess = extraction.objectionResponses.reduce((sum, r) => sum + r.successRate, 0) / Math.max(1, extraction.objectionResponses.length);
  
  return {
    avgConversionRate: avgConversion,
    vsBaselineConversion: 0, // TODO: Calculate from baseline data
    avgSentimentScore: (avgSentiment - 50) / 50, // Convert to -1 to 1
    vsBaselineSentiment: 0,
    avgOverallScore: avgConversion,
    vsBaselineScore: 0,
    objectionSuccessRate: avgObjectionSuccess,
    vsBaselineObjectionSuccess: 0,
    winRate: avgConversion,
    vsBaselineWinRate: 0,
    conversationsAnalyzed: extraction.conversationsAnalyzed,
    repsUsing: extraction.repsAnalyzed,
    confidence: extraction.summary.highConfidencePatterns / Math.max(1, extraction.summary.totalPatternsFound) * 100,
  };
}

/**
 * Save playbook to Firestore
 */
async function savePlaybook(playbook: Playbook): Promise<void> {
  // TODO: Implement Firestore save
  logger.info('Saving playbook to Firestore', { playbookId: playbook.id });
}

/**
 * Generate unique playbook ID
 */
function generatePlaybookId(): string {
  return `playbook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================================================
// AI PROMPT BUILDERS
// ============================================================================

function buildPatternExtractionPrompt(
  candidates: PatternCandidate[],
  analyses: ConversationAnalysisWithConversation[]
): string {
  return `Analyze the following pattern candidates from ${analyses.length} sales conversations and extract structured patterns.

Pattern Candidates:
${JSON.stringify(candidates.slice(0, 10), null, 2)}

For each pattern, provide:
1. Name and description
2. Category (opening, discovery_question, value_proposition, etc.)
3. When to use it (situation)
4. How to use it (approach)
5. Expected outcome
6. Success rate and confidence

Return as JSON array.`;
}

function buildTalkTrackExtractionPrompt(
  candidates: TalkTrackCandidate[],
  analyses: ConversationAnalysisWithConversation[]
): string {
  return `Extract structured talk tracks from ${analyses.length} top-performing sales conversations.

Talk Track Candidates:
${JSON.stringify(candidates.slice(0, 10), null, 2)}

For each talk track, provide:
1. Name and description
2. Purpose (opening, value_prop, objection_handling, etc.)
3. Script (the actual talk track)
4. Key phrases
5. Tonality and pace
6. When to use and when to avoid

Return as JSON array.`;
}

function buildObjectionResponseExtractionPrompt(
  candidates: ObjectionResponseCandidate[],
  analyses: ConversationAnalysisWithConversation[]
): string {
  return `Extract proven objection responses from ${analyses.length} sales conversations.

Objection Response Candidates:
${JSON.stringify(candidates.slice(0, 10), null, 2)}

For each objection response, provide:
1. Objection type and common phrasing
2. Proven response
3. Response type and strategy
4. Success rate
5. Key techniques

Return as JSON array.`;
}

function buildBestPracticeExtractionPrompt(
  candidates: BestPracticeCandidate[],
  topPerformers: ConversationAnalysisWithConversation[],
  allAnalyses: ConversationAnalysisWithConversation[]
): string {
  return `Extract best practices from ${topPerformers.length} top-performing sales conversations (out of ${allAnalyses.length} total).

Best Practice Candidates:
${JSON.stringify(candidates.slice(0, 10), null, 2)}

For each best practice, provide:
1. Title and description
2. What to do and what not to do
3. Why it works (rationale)
4. Implementation steps
5. Expected impact

Return as JSON array.`;
}

// ============================================================================
// AI RESPONSE PARSERS
// ============================================================================

function parsePatternResponse(
  content: string,
  candidates: PatternCandidate[],
  analyses: ConversationAnalysisWithConversation[]
): Pattern[] {
  // TODO: Implement robust JSON parsing with error handling
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseTalkTrackResponse(
  content: string,
  candidates: TalkTrackCandidate[],
  analyses: ConversationAnalysisWithConversation[]
): TalkTrack[] {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseObjectionResponseResponse(
  content: string,
  candidates: ObjectionResponseCandidate[],
  analyses: ConversationAnalysisWithConversation[]
): ObjectionResponse[] {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseBestPracticeResponse(
  content: string,
  candidates: BestPracticeCandidate[],
  topPerformers: ConversationAnalysisWithConversation[],
  allAnalyses: ConversationAnalysisWithConversation[]
): PlaybookBestPractice[] {
  try {
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ============================================================================
// AI SYSTEM PROMPTS
// ============================================================================

const PATTERN_EXTRACTION_SYSTEM_PROMPT = `You are an expert sales coach analyzing high-performing sales conversations to extract winning patterns.

Your task is to identify recurring successful approaches, techniques, and behaviors that correlate with positive outcomes.

Focus on:
- Patterns that appear multiple times across different conversations
- Approaches that consistently lead to positive sentiment changes
- Techniques used by top performers that differ from average reps
- Context-specific patterns (when X happens, do Y)

Return structured JSON with clear, actionable patterns.`;

const TALK_TRACK_EXTRACTION_SYSTEM_PROMPT = `You are an expert sales trainer extracting proven talk tracks from top-performing sales conversations.

Your task is to identify effective scripts, messaging, and verbal techniques that consistently produce positive results.

Focus on:
- Complete talk tracks with clear structure
- Key phrases that resonate with prospects
- Tonality and pacing guidance
- When to use each track and when to avoid it

Return structured JSON with polished, ready-to-use talk tracks.`;

const OBJECTION_RESPONSE_EXTRACTION_SYSTEM_PROMPT = `You are an expert sales coach identifying proven objection handling techniques from successful conversations.

Your task is to extract responses that consistently overcome objections and move deals forward.

Focus on:
- Common objection phrasings and variations
- Proven response strategies that work
- Response types (reframe, question-based, story-based, etc.)
- Success rates and effectiveness

Return structured JSON with actionable objection responses.`;

const BEST_PRACTICE_EXTRACTION_SYSTEM_PROMPT = `You are an expert sales leader identifying best practices from top-performing sales reps.

Your task is to extract behavioral patterns and techniques that distinguish top performers from average reps.

Focus on:
- Practices that top performers consistently use
- Behaviors that correlate with high scores
- What top performers do differently
- Practical, implementable practices

Return structured JSON with clear, evidence-based best practices.`;

// ============================================================================
// INTERNAL TYPES
// ============================================================================

interface ConversationAnalysisWithConversation {
  conversation: Conversation;
  analysis: ConversationAnalysis;
}

interface PatternCandidate {
  key: string;
  type: string;
  category?: string;
  occurrences: any[];
  successRate: number;
  avgSentimentChange: number;
}

interface TalkTrackCandidate {
  purpose: string;
  examples: any[];
  avgSuccessRate: number;
  avgSentiment: number;
}

interface ObjectionResponseCandidate {
  objectionType: string;
  severity: string;
  examples: any[];
  avgSuccessRate: number;
}

interface BestPracticeCandidate {
  category: string;
  skillArea: string;
  examples: any[];
  topPerformerIds: Set<string>;
  avgImpact: number;
}

interface KeyPhrase {
  text: string;
  purpose: string;
  context: string;
}
