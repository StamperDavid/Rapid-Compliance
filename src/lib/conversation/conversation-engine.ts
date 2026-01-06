/**
 * Conversation Intelligence - Analysis Engine
 * 
 * AI-powered analysis of sales conversations using GPT-4o.
 * Provides comprehensive insights including sentiment, talk ratio,
 * topics, objections, coaching, and follow-up recommendations.
 * 
 * FEATURES:
 * - Transcript analysis with AI
 * - Sentiment tracking and critical moments
 * - Talk ratio calculation and assessment
 * - Topic extraction and coverage mapping
 * - Objection detection and handling evaluation
 * - Competitor mention tracking
 * - Coaching insights generation
 * - Follow-up action recommendations
 * 
 * @module lib/conversation
 */

import { logger } from '@/lib/logger/logger';
import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import type {
  Conversation,
  ConversationAnalysis,
  AnalyzeConversationRequest,
  AnalyzeTranscriptRequest,
  BatchAnalysisRequest,
  BatchAnalysisResponse,
  SentimentAnalysis,
  TalkRatioAnalysis,
  TopicAnalysis,
  ObjectionAnalysis,
  CompetitorMention,
  KeyMoment,
  CoachingInsight,
  FollowUpAction,
  ConversationScores,
  QualityIndicator,
  RedFlag,
  PositiveSignal,
  ConversationEngineConfig,
  Participant,
  ConversationType,
  AnalysisSummary,
} from './types';
import { DEFAULT_CONVERSATION_CONFIG } from './types';

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze a conversation and generate comprehensive insights
 * 
 * @param request - Analysis request
 * @param config - Optional engine configuration
 * @returns Complete conversation analysis
 */
export async function analyzeConversation(
  request: AnalyzeConversationRequest,
  config: Partial<ConversationEngineConfig> = {}
): Promise<ConversationAnalysis> {
  const startTime = Date.now();
  const fullConfig: ConversationEngineConfig = { ...DEFAULT_CONVERSATION_CONFIG, ...config };
  
  try {
    logger.info('Analyzing conversation', {
      conversationId: request.conversationId,
      organizationId: request.organizationId,
      includeCoaching: request.includeCoaching,
    });
    
    // 1. Get conversation data
    const conversation = await getConversation(
      request.organizationId,
      request.conversationId,
      request.workspaceId || 'default'
    );
    
    if (!conversation) {
      throw new Error(`Conversation not found: ${request.conversationId}`);
    }
    
    if (!conversation.transcript || conversation.transcript.length < fullConfig.minTranscriptLength) {
      throw new Error('Conversation transcript is missing or too short');
    }
    
    // 2. Perform AI-powered analysis
    const analysis = await analyzeTranscript({
      organizationId: request.organizationId,
      workspaceId: request.workspaceId,
      transcript: conversation.transcript,
      conversationType: conversation.type,
      participants: conversation.participants,
      repId: conversation.repId,
      duration: conversation.duration,
      dealId: conversation.dealId,
      leadId: conversation.leadId,
      title: conversation.title,
      includeCoaching: request.includeCoaching,
      includeFollowUps: request.includeFollowUps,
      customContext: request.customContext,
    }, fullConfig);
    
    logger.info('Conversation analysis complete', {
      conversationId: request.conversationId,
      overallScore: analysis.scores.overall,
      processingTime: Date.now() - startTime,
    });
    
    // 3. Emit signal for analysis completion
    await emitAnalysisSignal(analysis, conversation);
    
    return analysis;
    
  } catch (error: any) {
    logger.error('Conversation analysis failed', error, {
      conversationId: request.conversationId,
      organizationId: request.organizationId,
    });
    throw new Error(`Conversation analysis failed: ${error.message}`);
  }
}

/**
 * Analyze raw transcript directly
 * 
 * @param request - Transcript analysis request
 * @param config - Engine configuration
 * @returns Conversation analysis
 */
export async function analyzeTranscript(
  request: AnalyzeTranscriptRequest,
  config: ConversationEngineConfig = DEFAULT_CONVERSATION_CONFIG
): Promise<ConversationAnalysis> {
  const startTime = Date.now();
  
  try {
    // 1. Build AI prompt
    const prompt = buildAnalysisPrompt(request);
    
    // 2. Call AI for comprehensive analysis
    const response = await sendUnifiedChatMessage({
      model: config.aiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: config.temperature,
      maxTokens: config.maxTokens,
    });
    
    // 3. Parse AI response
    const aiAnalysis = parseAIAnalysis(response.text);
    
    // 4. Calculate talk ratio (deterministic, not AI-based)
    const talkRatio = calculateTalkRatio(
      request.transcript,
      request.participants,
      request.repId,
      request.duration,
      config
    );
    
    // 5. Calculate scores
    const scores = calculateScores(aiAnalysis, talkRatio);
    
    // 6. Identify quality indicators
    const qualityIndicators = identifyQualityIndicators(
      aiAnalysis,
      talkRatio,
      scores
    );
    
    // 7. Extract red flags and positive signals
    const redFlags = extractRedFlags(aiAnalysis, qualityIndicators);
    const positiveSignals = extractPositiveSignals(aiAnalysis);
    
    // 8. Generate coaching insights (if requested)
    let coachingInsights: CoachingInsight[] = [];
    if (request.includeCoaching) {
      coachingInsights = await generateCoachingInsights(
        aiAnalysis,
        talkRatio,
        scores,
        request.customContext,
        config
      );
    }
    
    // 9. Generate follow-up actions (if requested)
    let followUpActions: FollowUpAction[] = [];
    if (request.includeFollowUps) {
      followUpActions = await generateFollowUpActions(
        aiAnalysis,
        request.conversationType,
        request.customContext,
        config
      );
    }
    
    // 10. Build complete analysis
    const analysis: ConversationAnalysis = {
      conversationId: `analysis_${Date.now()}`, // Will be updated if saving
      organizationId: request.organizationId,
      workspaceId: request.workspaceId || 'default',
      
      sentiment: aiAnalysis.sentiment,
      talkRatio,
      topics: aiAnalysis.topics,
      objections: aiAnalysis.objections,
      competitors: aiAnalysis.competitors,
      
      keyMoments: aiAnalysis.keyMoments,
      coachingInsights,
      followUpActions,
      
      scores,
      qualityIndicators,
      redFlags,
      positiveSignals,
      
      summary: aiAnalysis.summary,
      highlights: aiAnalysis.highlights,
      
      confidence: aiAnalysis.confidence,
      analyzedAt: new Date(),
      analysisVersion: '1.0.0',
      aiModel: config.aiModel,
      tokensUsed: response.usage?.totalTokens || 0,
      processingTime: Date.now() - startTime,
    };
    
    return analysis;
    
  } catch (error: any) {
    logger.error('Transcript analysis failed', error, {
      organizationId: request.organizationId,
    });
    throw new Error(`Transcript analysis failed: ${error.message}`);
  }
}

/**
 * Analyze multiple conversations in batch
 */
export async function analyzeBatchConversations(
  request: BatchAnalysisRequest,
  config: Partial<ConversationEngineConfig> = {}
): Promise<BatchAnalysisResponse> {
  const startTime = Date.now();
  
  try {
    logger.info('Batch conversation analysis started', {
      conversationCount: request.conversationIds.length,
      organizationId: request.organizationId,
    });
    
    const analyses = new Map<string, ConversationAnalysis>();
    
    // Analyze each conversation
    for (const conversationId of request.conversationIds) {
      try {
        const analysis = await analyzeConversation(
          {
            conversationId,
            organizationId: request.organizationId,
            workspaceId: request.workspaceId,
            includeCoaching: request.includeCoaching,
            includeFollowUps: request.includeFollowUps,
          },
          config
        );
        
        analyses.set(conversationId, analysis);
      } catch (error: any) {
        logger.warn('Failed to analyze conversation', {
          conversationId,
          error: error.message,
        });
      }
    }
    
    // Calculate summary
    const summary = calculateAnalysisSummary(analyses);
    
    logger.info('Batch conversation analysis complete', {
      totalConversations: request.conversationIds.length,
      successful: analyses.size,
      duration: Date.now() - startTime,
    });
    
    return {
      analyses,
      summary,
      analyzedAt: new Date(),
    };
    
  } catch (error: any) {
    logger.error('Batch conversation analysis failed', error, {
      organizationId: request.organizationId,
    });
    throw new Error(`Batch conversation analysis failed: ${error.message}`);
  }
}

// ============================================================================
// AI PROMPT BUILDING
// ============================================================================

/**
 * Build AI prompt for conversation analysis
 */
function buildAnalysisPrompt(request: AnalyzeTranscriptRequest): string {
  const repInfo = request.participants.find(p => p.id === request.repId);
  const prospects = request.participants.filter(p => 
    p.role === 'prospect' || p.role === 'decision_maker' || p.role === 'influencer'
  );
  
  return `You are an expert sales conversation analyst. Analyze this sales conversation and provide comprehensive insights.

CONVERSATION METADATA:
- Type: ${request.conversationType}
- Title: ${request.title || 'Untitled'}
- Duration: ${Math.floor(request.duration / 60)} minutes
- Sales Rep: ${repInfo?.name || 'Unknown'}
- Prospects: ${prospects.map(p => `${p.name} (${p.role}${p.title ? `, ${  p.title}` : ''})`).join(', ')}
${request.customContext ? `\nADDITIONAL CONTEXT:\n${request.customContext}\n` : ''}

TRANSCRIPT:
${request.transcript}

Analyze this conversation and provide a JSON response with the following structure:

{
  "sentiment": {
    "overall": {
      "polarity": "positive" | "negative" | "neutral" | "very_positive" | "very_negative",
      "score": -1 to 1,
      "confidence": 0-100,
      "tone": ["professional", "enthusiastic", "hesitant", etc.]
    },
    "byParticipant": {
      "participantName": { /* same as overall */ }
    },
    "timeline": [
      { "timestamp": seconds, "sentiment": -1 to 1, "speaker": "name", "context": "..." }
    ],
    "trendDirection": "improving" | "declining" | "stable",
    "criticalMoments": [
      {
        "timestamp": seconds,
        "type": "spike" | "drop",
        "magnitude": number,
        "speaker": "name",
        "quote": "...",
        "context": "...",
        "impact": "high" | "medium" | "low"
      }
    ]
  },
  
  "topics": {
    "mainTopics": [
      {
        "name": "topic name",
        "category": "pain_points" | "business_value" | "pricing" | "timeline" | "competition" | "stakeholders" | "decision_process" | etc.,
        "mentions": number,
        "duration": seconds,
        "sentiment": -1 to 1,
        "importance": "critical" | "high" | "medium" | "low",
        "quotes": ["relevant quote 1", "relevant quote 2"]
      }
    ],
    "coverageMap": { "topic": durationInSeconds },
    "uncoveredTopics": ["expected topic that wasn't discussed"],
    "timeAllocation": [
      {
        "topic": "name",
        "duration": seconds,
        "percentage": 0-100,
        "isAppropriate": boolean,
        "recommendation": "..."
      }
    ]
  },
  
  "objections": [
    {
      "id": "unique_id",
      "type": "pricing" | "timing" | "authority" | "competition" | "technical" | "trust" | "need" | "urgency",
      "objection": "summary",
      "quote": "exact quote",
      "timestamp": seconds,
      "speaker": "name",
      "severity": "critical" | "high" | "medium" | "low",
      "wasAddressed": boolean,
      "repResponse": "...",
      "responseQuality": "excellent" | "good" | "poor" | "none",
      "recommendedResponse": "..."
    }
  ],
  
  "competitors": [
    {
      "competitor": "name",
      "mentions": number,
      "context": ["quote 1", "quote 2"],
      "sentiment": -1 to 1,
      "concernLevel": "high" | "medium" | "low",
      "recommendedResponse": "..."
    }
  ],
  
  "keyMoments": [
    {
      "id": "unique_id",
      "timestamp": seconds,
      "type": "buying_signal" | "objection" | "commitment" | "concern" | "decision_maker_engagement" | "competitor_mention" | "timeline_discussed" | "budget_revealed" | "next_steps_agreed" | "red_flag",
      "title": "brief title",
      "description": "detailed description",
      "speaker": "name",
      "quote": "exact quote",
      "impact": "positive" | "negative" | "neutral",
      "significance": "critical" | "high" | "medium" | "low"
    }
  ],
  
  "summary": "2-3 sentence summary of the conversation",
  "highlights": ["key highlight 1", "key highlight 2", "key highlight 3"],
  "confidence": 0-100 (how confident you are in this analysis)
}

Focus on actionable insights. Be specific and use exact quotes. Identify both strengths and areas for improvement.`;
}

// ============================================================================
// AI RESPONSE PARSING
// ============================================================================

/**
 * Parse AI analysis response
 */
function parseAIAnalysis(aiResponse: string): any {
  try {
    // Extract JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate required fields
    if (!parsed.sentiment || !parsed.topics || !parsed.summary) {
      throw new Error('Missing required fields in AI response');
    }
    
    return {
      sentiment: parsed.sentiment,
      topics: parsed.topics,
      objections: parsed.objections || [],
      competitors: parsed.competitors || [],
      keyMoments: parsed.keyMoments || [],
      summary: parsed.summary,
      highlights: parsed.highlights || [],
      confidence: parsed.confidence || 75,
    };
    
  } catch (error: any) {
    logger.error('Failed to parse AI analysis', { error: error.message });
    
    // Return minimal fallback
    return {
      sentiment: {
        overall: {
          polarity: 'neutral',
          score: 0,
          confidence: 50,
          tone: ['unknown'],
        },
        byParticipant: {},
        timeline: [],
        trendDirection: 'stable',
        criticalMoments: [],
      },
      topics: {
        mainTopics: [],
        coverageMap: {},
        uncoveredTopics: [],
        timeAllocation: [],
      },
      objections: [],
      competitors: [],
      keyMoments: [],
      summary: 'Analysis failed to parse AI response',
      highlights: [],
      confidence: 30,
    };
  }
}

// ============================================================================
// TALK RATIO CALCULATION
// ============================================================================

/**
 * Calculate talk ratio from transcript
 */
function calculateTalkRatio(
  transcript: string,
  participants: Participant[],
  repId: string,
  duration: number,
  config: ConversationEngineConfig
): TalkRatioAnalysis {
  try {
    // Parse transcript into turns
    const turns = parseTranscriptTurns(transcript, participants);
    
    // Calculate per-participant stats
    const byParticipant: Record<string, any> = {};
    let repTalkTime = 0;
    let prospectTalkTime = 0;
    
    participants.forEach(participant => {
      const participantTurns = turns.filter(t => t.speakerId === participant.id);
      const totalTime = participantTurns.reduce((sum, turn) => sum + turn.duration, 0);
      const questionCount = participantTurns.filter(t => t.isQuestion).length;
      
      const stats = {
        totalTime,
        percentage: duration > 0 ? Math.round((totalTime / duration) * 100) : 0,
        turnCount: participantTurns.length,
        avgTurnDuration: participantTurns.length > 0 ? totalTime / participantTurns.length : 0,
        longestTurn: Math.max(0, ...participantTurns.map(t => t.duration)),
        interruptionCount: participantTurns.filter(t => t.wasInterruption).length,
        questionCount,
      };
      
      byParticipant[participant.id] = stats;
      
      // Track rep vs prospect time
      if (participant.id === repId || participant.role === 'sales_rep' || participant.role === 'sales_manager') {
        repTalkTime += totalTime;
      } else if (participant.role === 'prospect' || participant.role === 'decision_maker' || participant.role === 'influencer') {
        prospectTalkTime += totalTime;
      }
    });
    
    // Calculate overall ratio
    const totalTalkTime = repTalkTime + prospectTalkTime;
    const repPercentage = totalTalkTime > 0 ? Math.round((repTalkTime / totalTalkTime) * 100) : 0;
    const prospectPercentage = totalTalkTime > 0 ? Math.round((prospectTalkTime / totalTalkTime) * 100) : 0;
    const ratio = prospectTalkTime > 0 ? repTalkTime / prospectTalkTime : 1;
    
    // Assess talk ratio
    const repRatio = totalTalkTime > 0 ? repTalkTime / totalTalkTime : 0.5;
    let assessment: any;
    let recommendation: string;
    
    if (repRatio >= config.idealTalkRatioMin && repRatio <= config.idealTalkRatioMax) {
      assessment = 'ideal';
      recommendation = 'Excellent talk ratio! Continue listening actively and asking thoughtful questions.';
    } else if (repRatio > 0.5) {
      assessment = 'rep_dominating';
      recommendation = 'You\'re talking too much. Focus on asking more questions and letting the prospect share their challenges.';
    } else if (repRatio < 0.2) {
      assessment = 'prospect_dominating';
      recommendation = 'Good listening, but try to guide the conversation more. Ask clarifying questions and share relevant insights.';
    } else if (repRatio >= 0.4 && repRatio <= 0.5) {
      assessment = 'balanced';
      recommendation = 'Good balance. Aim for slightly more listening to reach the ideal 30-40% talk time.';
    } else {
      assessment = 'needs_improvement';
      recommendation = 'Work on finding the right talk/listen balance. Aim for 30-40% of the conversation.';
    }
    
    return {
      overall: {
        speakerTime: repTalkTime,
        listenerTime: prospectTalkTime,
        ratio,
        isIdeal: assessment === 'ideal',
      },
      byParticipant,
      repTalkTime,
      prospectTalkTime,
      repPercentage,
      prospectPercentage,
      assessment,
      recommendation,
    };
    
  } catch (error: any) {
    logger.error('Talk ratio calculation failed', { error: error.message });
    
    // Return default/fallback
    return {
      overall: {
        speakerTime: 0,
        listenerTime: 0,
        ratio: 1,
        isIdeal: false,
      },
      byParticipant: {},
      repTalkTime: 0,
      prospectTalkTime: 0,
      repPercentage: 50,
      prospectPercentage: 50,
      assessment: 'needs_improvement',
      recommendation: 'Unable to calculate talk ratio from transcript',
    };
  }
}

/**
 * Parse transcript into individual speaking turns
 */
function parseTranscriptTurns(transcript: string, participants: Participant[]): any[] {
  const turns: any[] = [];
  
  // Common transcript formats:
  // "Speaker Name: text"
  // "[Speaker Name]: text"
  // "Speaker Name - text"
  
  const lines = transcript.split('\n').filter(line => line.trim().length > 0);
  
  lines.forEach((line, index) => {
    // Try to extract speaker name
    const match = line.match(/^[[()]?([^:\])]+ )[\])]?\s*[:-]\s*(.+)$/);
    
    if (match) {
      const speakerName = match[1].trim();
      const text = match[2].trim();
      
      // Find matching participant
      const participant = participants.find(p => 
        p.name.toLowerCase().includes(speakerName.toLowerCase()) ||
        speakerName.toLowerCase().includes(p.name.toLowerCase())
      );
      
      if (participant) {
        // Estimate duration (rough: ~150 words per minute, ~2.5 words per second)
        const wordCount = text.split(/\s+/).length;
        const estimatedDuration = wordCount / 2.5;
        
        turns.push({
          speakerId: participant.id,
          speakerName: participant.name,
          text,
          wordCount,
          duration: estimatedDuration,
          isQuestion: text.includes('?'),
          wasInterruption: false, // Hard to detect from transcript alone
        });
      }
    }
  });
  
  return turns;
}

// ============================================================================
// SCORING
// ============================================================================

/**
 * Calculate conversation scores
 */
function calculateScores(aiAnalysis: any, talkRatio: TalkRatioAnalysis): ConversationScores {
  // Overall sentiment score (convert -1 to 1 → 0 to 100)
  const sentimentScore = Math.round(((aiAnalysis.sentiment.overall.score + 1) / 2) * 100);
  
  // Talk ratio score
  const talkRatioScore = talkRatio.assessment === 'ideal' ? 95 :
                         talkRatio.assessment === 'balanced' ? 80 :
                         talkRatio.assessment === 'needs_improvement' ? 60 :
                         talkRatio.assessment === 'rep_dominating' ? 40 : 50;
  
  // Discovery score (based on questions and topics covered)
  const questioningScore = 70; // Would analyze question quality from transcript
  const topicsCovered = aiAnalysis.topics.mainTopics.length;
  const discoveryScore = Math.min(100, Math.round((topicsCovered * 10) + (questioningScore * 0.7)));
  
  // Objection handling score
  const totalObjections = aiAnalysis.objections.length;
  const addressedObjections = aiAnalysis.objections.filter((obj: any) => obj.wasAddressed).length;
  const objectionScore = totalObjections > 0 
    ? Math.round((addressedObjections / totalObjections) * 100)
    : 80; // No objections = good
  
  // Closing score (based on next steps and commitments)
  const hasNextSteps = aiAnalysis.keyMoments.some((m: any) => m.type === 'next_steps_agreed');
  const hasCommitment = aiAnalysis.keyMoments.some((m: any) => m.type === 'commitment');
  const closingScore = hasNextSteps && hasCommitment ? 90 :
                       hasNextSteps ? 75 :
                       hasCommitment ? 70 : 50;
  
  // Rapport score (based on sentiment and engagement)
  const rapportScore = Math.max(50, sentimentScore);
  
  // Engagement score (positive signals - red flags)
  const positiveSignals = aiAnalysis.keyMoments.filter((m: any) => m.impact === 'positive').length;
  const negativeSignals = aiAnalysis.keyMoments.filter((m: any) => m.impact === 'negative').length;
  const engagementScore = Math.min(100, Math.max(30, 70 + (positiveSignals * 5) - (negativeSignals * 10)));
  
  // Overall score (weighted average)
  const overallScore = Math.round(
    discoveryScore * 0.25 +
    objectionScore * 0.2 +
    closingScore * 0.2 +
    rapportScore * 0.15 +
    engagementScore * 0.1 +
    talkRatioScore * 0.1
  );
  
  return {
    overall: overallScore,
    discovery: discoveryScore,
    valueArticulation: 75, // Would need more specific analysis
    objectionHandling: objectionScore,
    closing: closingScore,
    rapport: rapportScore,
    engagement: engagementScore,
  };
}

// ============================================================================
// QUALITY INDICATORS
// ============================================================================

/**
 * Identify quality indicators
 */
function identifyQualityIndicators(
  aiAnalysis: any,
  talkRatio: TalkRatioAnalysis,
  scores: ConversationScores
): QualityIndicator[] {
  const indicators: QualityIndicator[] = [];
  
  // Talk ratio indicator
  indicators.push({
    type: 'talk_ratio',
    status: talkRatio.assessment === 'ideal' ? 'excellent' :
            talkRatio.assessment === 'balanced' ? 'good' :
            talkRatio.assessment === 'needs_improvement' ? 'needs_improvement' : 'poor',
    score: talkRatio.overall.isIdeal ? 95 : 60,
    description: `Rep spoke ${talkRatio.repPercentage}% of the time`,
    recommendation: talkRatio.recommendation,
  });
  
  // Discovery depth indicator
  const topicCount = aiAnalysis.topics.mainTopics.length;
  indicators.push({
    type: 'discovery_depth',
    status: topicCount >= 5 ? 'excellent' :
            topicCount >= 3 ? 'good' :
            topicCount >= 2 ? 'needs_improvement' : 'poor',
    score: Math.min(100, topicCount * 20),
    description: `Covered ${topicCount} key topics`,
    recommendation: topicCount < 3 ? 'Ask more open-ended questions to uncover additional pain points and requirements' : undefined,
  });
  
  // Next steps clarity indicator
  const hasNextSteps = aiAnalysis.keyMoments.some((m: any) => m.type === 'next_steps_agreed');
  indicators.push({
    type: 'next_steps_clarity',
    status: hasNextSteps ? 'excellent' : 'poor',
    score: hasNextSteps ? 100 : 30,
    description: hasNextSteps ? 'Clear next steps defined' : 'No clear next steps',
    recommendation: hasNextSteps ? undefined : 'Always end calls with specific next steps and timeline',
  });
  
  // Objection handling indicator
  const objectionCount = aiAnalysis.objections.length;
  const handledCount = aiAnalysis.objections.filter((obj: any) => obj.wasAddressed).length;
  if (objectionCount > 0) {
    indicators.push({
      type: 'objection_handling',
      status: handledCount === objectionCount ? 'excellent' :
              handledCount >= objectionCount * 0.7 ? 'good' :
              handledCount >= objectionCount * 0.5 ? 'needs_improvement' : 'poor',
      score: Math.round((handledCount / objectionCount) * 100),
      description: `Addressed ${handledCount}/${objectionCount} objections`,
      recommendation: handledCount < objectionCount ? 'Acknowledge and address all objections before moving forward' : undefined,
    });
  }
  
  return indicators;
}

// ============================================================================
// RED FLAGS & POSITIVE SIGNALS
// ============================================================================

/**
 * Extract red flags from analysis
 */
function extractRedFlags(aiAnalysis: any, qualityIndicators: QualityIndicator[]): RedFlag[] {
  const redFlags: RedFlag[] = [];
  
  // No next steps
  const hasNextSteps = aiAnalysis.keyMoments.some((m: any) => m.type === 'next_steps_agreed');
  if (!hasNextSteps) {
    redFlags.push({
      type: 'no_next_steps',
      severity: 'critical',
      description: 'Call ended without clear next steps',
      recommendation: 'Always establish concrete next actions and timeline before ending the call',
    });
  }
  
  // Multiple unaddressed objections
  const unaddressedObjections = aiAnalysis.objections.filter((obj: any) => !obj.wasAddressed);
  if (unaddressedObjections.length >= 2) {
    redFlags.push({
      type: 'multiple_objections',
      severity: 'high',
      description: `${unaddressedObjections.length} objections left unaddressed`,
      recommendation: 'Circle back to acknowledge and address all concerns',
    });
  }
  
  // Competitor preference
  const competitorConcerns = aiAnalysis.competitors.filter((c: any) => c.concernLevel === 'high');
  if (competitorConcerns.length > 0) {
    redFlags.push({
      type: 'competitor_preference',
      severity: 'high',
      description: `Strong preference indicated for: ${competitorConcerns.map((c: any) => c.competitor).join(', ')}`,
      recommendation: 'Use battlecard to differentiate and highlight unique value proposition',
    });
  }
  
  // Negative sentiment trend
  if (aiAnalysis.sentiment.trendDirection === 'declining') {
    redFlags.push({
      type: 'low_engagement',
      severity: 'medium',
      description: 'Prospect engagement declined during conversation',
      recommendation: 'Re-engage by asking about their specific challenges and desired outcomes',
    });
  }
  
  return redFlags;
}

/**
 * Extract positive signals from analysis
 */
function extractPositiveSignals(aiAnalysis: any): PositiveSignal[] {
  const signals: PositiveSignal[] = [];
  
  // Buying intent
  const buyingSignals = aiAnalysis.keyMoments.filter((m: any) => m.type === 'buying_signal');
  buyingSignals.forEach((signal: any) => {
    signals.push({
      type: 'buying_intent',
      strength: signal.significance === 'critical' ? 'strong' : 
                signal.significance === 'high' ? 'moderate' : 'weak',
      description: signal.description,
      quote: signal.quote,
      timestamp: signal.timestamp,
      impact: 'Strong indicator of purchase intent',
    });
  });
  
  // Decision maker engaged
  const dmEngagement = aiAnalysis.keyMoments.filter((m: any) => m.type === 'decision_maker_engagement');
  if (dmEngagement.length > 0) {
    signals.push({
      type: 'decision_maker_engaged',
      strength: 'strong',
      description: 'Decision maker actively participated',
      impact: 'Direct access to economic buyer increases close probability',
    });
  }
  
  // Clear pain point
  const painTopics = aiAnalysis.topics.mainTopics.filter((t: any) => t.category === 'pain_points');
  if (painTopics.length > 0) {
    signals.push({
      type: 'clear_pain_point',
      strength: painTopics.length >= 2 ? 'strong' : 'moderate',
      description: `Identified ${painTopics.length} clear pain point(s)`,
      impact: 'Strong pain points drive purchase urgency',
    });
  }
  
  // Positive sentiment
  if (aiAnalysis.sentiment.overall.score > 0.5) {
    signals.push({
      type: 'value_acknowledged',
      strength: 'moderate',
      description: 'Overall positive sentiment throughout conversation',
      impact: 'Prospect is receptive to the solution',
    });
  }
  
  return signals;
}

// ============================================================================
// COACHING INSIGHTS GENERATION
// ============================================================================

/**
 * Generate coaching insights with AI
 */
async function generateCoachingInsights(
  aiAnalysis: any,
  talkRatio: TalkRatioAnalysis,
  scores: ConversationScores,
  customContext: string | undefined,
  config: ConversationEngineConfig
): Promise<CoachingInsight[]> {
  try {
    const prompt = buildCoachingPrompt(aiAnalysis, talkRatio, scores, customContext);
    
    const response = await sendUnifiedChatMessage({
      model: config.aiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 2000,
    });
    
    const insights = parseCoachingInsights(response.text, config.maxCoachingInsights);
    
    return insights;
    
  } catch (error: any) {
    logger.error('Coaching insights generation failed', { error: error.message });
    return [];
  }
}

/**
 * Build coaching prompt
 */
function buildCoachingPrompt(
  aiAnalysis: any,
  talkRatio: TalkRatioAnalysis,
  scores: ConversationScores,
  customContext?: string
): string {
  return `You are a sales coaching expert. Analyze this conversation and provide actionable coaching insights.

CONVERSATION ANALYSIS:
- Overall Score: ${scores.overall}/100
- Discovery Score: ${scores.discovery}/100
- Objection Handling: ${scores.objectionHandling}/100
- Closing Score: ${scores.closing}/100
- Talk Ratio: ${talkRatio.repPercentage}% rep, ${talkRatio.prospectPercentage}% prospect (${talkRatio.assessment})
- Sentiment: ${aiAnalysis.sentiment.overall.polarity} (${aiAnalysis.sentiment.overall.score})
- Topics Covered: ${aiAnalysis.topics.mainTopics.length}
- Objections: ${aiAnalysis.objections.length}
- Key Moments: ${aiAnalysis.keyMoments.length}
${customContext ? `\nCONTEXT:\n${customContext}\n` : ''}

Provide 3-5 coaching insights as a JSON array:

[
  {
    "id": "unique_id",
    "category": "discovery" | "listening" | "objection_handling" | "value_articulation" | "questioning" | "closing" | "rapport_building" | "time_management",
    "priority": "critical" | "high" | "medium" | "low",
    "insight": "One sentence insight",
    "whatWentWell": "What the rep did well (if applicable)",
    "whatToImprove": "Specific improvement area",
    "specificExample": "Quote or specific moment from conversation",
    "recommendedAction": "Concrete action to take",
    "skillArea": "Specific skill to develop",
    "impact": 0-100 (potential impact of improvement)
  }
]

Focus on the highest-impact improvements. Be specific and actionable.`;
}

/**
 * Parse coaching insights from AI response
 */
function parseCoachingInsights(aiResponse: string, maxInsights: number): CoachingInsight[] {
  try {
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.slice(0, maxInsights);
    
  } catch (error) {
    logger.warn('Failed to parse coaching insights', { error });
    return [];
  }
}

// ============================================================================
// FOLLOW-UP ACTIONS GENERATION
// ============================================================================

/**
 * Generate follow-up action recommendations
 */
async function generateFollowUpActions(
  aiAnalysis: any,
  conversationType: ConversationType,
  customContext: string | undefined,
  config: ConversationEngineConfig
): Promise<FollowUpAction[]> {
  try {
    const prompt = buildFollowUpPrompt(aiAnalysis, conversationType, customContext);
    
    const response = await sendUnifiedChatMessage({
      model: config.aiModel,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 1500,
    });
    
    const actions = parseFollowUpActions(response.text, config.maxFollowUpActions);
    
    return actions;
    
  } catch (error: any) {
    logger.error('Follow-up actions generation failed', { error: error.message });
    return [];
  }
}

/**
 * Build follow-up actions prompt
 */
function buildFollowUpPrompt(
  aiAnalysis: any,
  conversationType: ConversationType,
  customContext?: string
): string {
  return `Generate follow-up actions based on this conversation analysis.

CONVERSATION TYPE: ${conversationType}
SUMMARY: ${aiAnalysis.summary}
KEY MOMENTS: ${aiAnalysis.keyMoments.map((m: any) => `- ${m.description}`).join('\n')}
OBJECTIONS: ${aiAnalysis.objections.map((o: any) => `- ${o.objection}`).join('\n')}
${customContext ? `\nCONTEXT:\n${customContext}\n` : ''}

Provide 3-5 follow-up actions as a JSON array:

[
  {
    "id": "unique_id",
    "type": "send_follow_up_email" | "schedule_meeting" | "send_proposal" | "share_resources" | "introduce_stakeholder" | "address_concern" | "provide_pricing" | "schedule_demo" | "send_case_study",
    "priority": "critical" | "high" | "medium" | "low",
    "title": "Short title",
    "description": "Detailed description of the action",
    "reasoning": "Why this action is important",
    "deadline": "within 24 hours" | "within 2 days" | "within 1 week",
    "estimatedEffort": hours (0.5 to 8)
  }
]

Prioritize based on what will most advance the deal.`;
}

/**
 * Parse follow-up actions from AI response
 */
function parseFollowUpActions(aiResponse: string, maxActions: number): FollowUpAction[] {
  try {
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [];
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.slice(0, maxActions);
    
  } catch (error) {
    logger.warn('Failed to parse follow-up actions', { error });
    return [];
  }
}

// ============================================================================
// SUMMARY CALCULATION
// ============================================================================

/**
 * Calculate analysis summary for batch results
 */
function calculateAnalysisSummary(
  analyses: Map<string, ConversationAnalysis>
): AnalysisSummary {
  if (analyses.size === 0) {
    return {
      totalConversations: 0,
      avgOverallScore: 0,
      avgSentiment: 0,
      avgTalkRatio: 0,
      topCoachingAreas: [],
      commonObjections: [],
      topCompetitors: [],
      sentimentTrend: 'stable',
      scoreTrend: 'stable',
    };
  }
  
  let totalScore = 0;
  let totalSentiment = 0;
  let totalTalkRatio = 0;
  
  const coachingMap = new Map<string, { count: number; impact: number }>();
  const objectionMap = new Map<string, { count: number; addressed: number }>();
  const competitorMap = new Map<string, { count: number; sentiment: number }>();
  
  analyses.forEach(analysis => {
    totalScore += analysis.scores.overall;
    totalSentiment += analysis.sentiment.overall.score;
    totalTalkRatio += analysis.talkRatio.repPercentage;
    
    // Aggregate coaching areas
    analysis.coachingInsights.forEach(insight => {
      const existing = coachingMap.get(insight.category) || { count: 0, impact: 0 };
      coachingMap.set(insight.category, {
        count: existing.count + 1,
        impact: existing.impact + insight.impact,
      });
    });
    
    // Aggregate objections
    analysis.objections.forEach(objection => {
      const existing = objectionMap.get(objection.type) || { count: 0, addressed: 0 };
      objectionMap.set(objection.type, {
        count: existing.count + 1,
        addressed: existing.addressed + (objection.wasAddressed ? 1 : 0),
      });
    });
    
    // Aggregate competitors
    analysis.competitors.forEach(competitor => {
      const existing = competitorMap.get(competitor.competitor) || { count: 0, sentiment: 0 };
      competitorMap.set(competitor.competitor, {
        count: existing.count + competitor.mentions,
        sentiment: existing.sentiment + competitor.sentiment,
      });
    });
  });
  
  const count = analyses.size;
  
  return {
    totalConversations: count,
    avgOverallScore: Math.round(totalScore / count),
    avgSentiment: totalSentiment / count,
    avgTalkRatio: Math.round(totalTalkRatio / count),
    
    topCoachingAreas: Array.from(coachingMap.entries())
      .map(([area, data]) => ({
        area,
        frequency: data.count,
        avgImpact: Math.round(data.impact / data.count),
        recommendation: `Focus on improving ${area} skills`,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5),
    
    commonObjections: Array.from(objectionMap.entries())
      .map(([type, data]) => ({
        type: type as any,
        frequency: data.count,
        avgSeverity: 50, // Would need more data
        successRate: Math.round((data.addressed / data.count) * 100),
        bestResponse: 'Review successful objection handling examples',
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5),
    
    topCompetitors: Array.from(competitorMap.entries())
      .map(([competitor, data]) => ({
        competitor,
        mentions: data.count,
        avgSentiment: data.sentiment / data.count,
        winRate: 50, // Would need deal outcome data
        positioning: 'Use battlecard for competitive differentiation',
      }))
      .sort((a, b) => b.mentions - a.mentions)
      .slice(0, 5),
    
    sentimentTrend: 'stable',
    scoreTrend: 'stable',
  };
}

// ============================================================================
// SIGNAL BUS INTEGRATION
// ============================================================================

/**
 * Emit analysis signal to Signal Bus
 */
async function emitAnalysisSignal(
  analysis: ConversationAnalysis,
  conversation: Conversation
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();
    
    await coordinator.emitSignal({
      type: 'conversation.analyzed' as any,
      leadId: conversation.leadId || 'unknown',
      orgId: analysis.organizationId,
      workspaceId: analysis.workspaceId,
      confidence: analysis.confidence / 100,
      priority: analysis.scores.overall >= 70 ? 'Low' : analysis.scores.overall >= 50 ? 'Medium' : 'High',
      metadata: {
        source: 'conversation-intelligence',
        conversationId: conversation.id,
        conversationType: conversation.type,
        overallScore: analysis.scores.overall,
        sentiment: analysis.sentiment.overall.polarity,
        talkRatio: analysis.talkRatio.repPercentage,
        redFlagsCount: analysis.redFlags.length,
        coachingInsightsCount: analysis.coachingInsights.length,
      },
    });
    
    logger.info('Analysis signal emitted', {
      conversationId: conversation.id,
      overallScore: analysis.scores.overall,
    });
    
  } catch (error) {
    logger.error('Failed to emit analysis signal', error, {
      conversationId: conversation.id,
    });
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get conversation data (placeholder - would query Firestore)
 */
async function getConversation(
  organizationId: string,
  conversationId: string,
  workspaceId: string
): Promise<Conversation | null> {
  // TODO: Implement Firestore query
  // For now, return null to indicate not found
  return null;
}
