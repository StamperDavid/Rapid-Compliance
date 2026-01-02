/**
 * Email Sequence Intelligence Engine
 * 
 * AI-powered email sequence analysis, pattern detection, optimization,
 * and performance tracking. Analyzes email sequences to identify high-
 * performing patterns and provide actionable optimization recommendations.
 * 
 * @module sequence/sequence-engine
 */

import { 
  SequenceAnalysis, 
  SequenceAnalysisInput,
  SequenceMetrics,
  EmailMetrics,
  SequencePattern,
  OptimizationRecommendation,
  PatternDetectionRequest,
  OptimizationRequest,
  EmailSequence,
  SequenceExecution,
  ExecutionStatus,
  HourOfDay,
  DayOfWeek,
  PatternConfidence,
  PatternType,
  OptimizationArea,
  RecommendationPriority,
} from './types';
import { 
  sequenceAnalysisInputSchema,
  sequenceMetricsSchema,
  patternDetectionRequestSchema,
  optimizationRequestSchema,
} from './validation';
import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_TIME_RANGE_DAYS = 30;
const MIN_SAMPLE_SIZE_FOR_PATTERNS = 30;
const MIN_LIFT_FOR_PATTERN = 10; // 10% minimum lift
const HIGH_CONFIDENCE_THRESHOLD = 0.95;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.80;

// ============================================================================
// SEQUENCE INTELLIGENCE ENGINE
// ============================================================================

/**
 * Main sequence intelligence engine
 */
export class SequenceIntelligenceEngine {
  /**
   * Analyze email sequences with comprehensive insights
   * 
   * @param input - Analysis input parameters
   * @returns Complete sequence analysis with metrics, patterns, and optimizations
   * @throws {Error} If validation fails or AI analysis encounters an error
   */
  async analyzeSequences(input: SequenceAnalysisInput): Promise<SequenceAnalysis> {
    // Validate input
    const validatedInput = sequenceAnalysisInputSchema.parse(input);
    
    // Set default time range if not provided
    const endDate = validatedInput.endDate || new Date();
    const startDate = validatedInput.startDate || new Date(endDate.getTime() - (DEFAULT_TIME_RANGE_DAYS * 24 * 60 * 60 * 1000));
    
    // TODO: In production, fetch from database
    // For now, we'll use mock data structure
    const sequences = await this.fetchSequences(validatedInput);
    const metrics = await this.calculateMetrics(sequences, startDate, endDate);
    
    // Generate analysis components based on input flags
    const patterns = validatedInput.includePatterns !== false 
      ? await this.detectPatterns({ sequenceMetrics: metrics })
      : undefined;
    
    const optimizations = validatedInput.includeOptimizations !== false && patterns
      ? await this.generateOptimizations(metrics, patterns)
      : undefined;
    
    const timingAnalysis = validatedInput.includeTimingAnalysis !== false
      ? await this.analyzeTimings(metrics)
      : undefined;
    
    // TODO: Implement A/B test fetching
    const abTests = validatedInput.includeABTests !== false
      ? { active: 0, completed: 0, winningVariants: [], ongoingTests: [] }
      : undefined;
    
    // Generate AI insights
    const aiInsights = await this.generateAIInsights(metrics, patterns, optimizations);
    
    // Calculate summary
    const summary = this.calculateSummary(sequences, metrics);
    
    return {
      analysisId: this.generateAnalysisId(),
      generatedAt: new Date(),
      timeRange: { start: startDate, end: endDate },
      sequences,
      metrics,
      patterns: patterns ? this.categorizePatterns(patterns) : undefined,
      optimizations: optimizations ? this.categorizeOptimizations(optimizations) : undefined,
      timingAnalysis,
      abTests,
      summary,
      aiInsights,
    };
  }
  
  /**
   * Detect patterns in sequence performance
   * 
   * @param request - Pattern detection request
   * @returns Identified sequence patterns
   */
  async detectPatterns(request: PatternDetectionRequest): Promise<SequencePattern[]> {
    // Validate request
    const validatedRequest = patternDetectionRequestSchema.parse(request);
    
    const minimumSampleSize = validatedRequest.minimumSampleSize || MIN_SAMPLE_SIZE_FOR_PATTERNS;
    const minimumLift = validatedRequest.minimumLift || MIN_LIFT_FOR_PATTERN;
    
    // Filter sequences with sufficient data
    const qualifiedMetrics = (validatedRequest.sequenceMetrics as SequenceMetrics[]).filter(
      m => m.totalRecipients >= minimumSampleSize
    );
    
    if (qualifiedMetrics.length === 0) {
      return [];
    }
    
    // Use AI to detect patterns
    const aiPatterns = await this.detectPatternsWithAI(qualifiedMetrics, minimumLift);
    
    // Statistical validation
    const validatedPatterns = aiPatterns.filter(pattern => {
      return pattern.sampleSize >= minimumSampleSize &&
             (pattern.replyLift >= minimumLift || 
              pattern.meetingLift >= minimumLift ||
              pattern.opportunityLift >= minimumLift);
    });
    
    return validatedPatterns;
  }
  
  /**
   * Generate optimization recommendations
   * 
   * @param metrics - Sequence metrics
   * @param patterns - Detected patterns
   * @returns Optimization recommendations
   */
  async generateOptimizations(
    metrics: SequenceMetrics[], 
    patterns: SequencePattern[]
  ): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    
    // Generate optimizations for each sequence
    for (const metric of metrics) {
      const sequenceOptimizations = await this.generateOptimizationsForSequence(
        metric,
        patterns
      );
      recommendations.push(...sequenceOptimizations);
    }
    
    // Sort by priority and expected impact
    return recommendations.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.expectedLift - a.expectedLift;
    });
  }
  
  // ============================================================================
  // PRIVATE METHODS - AI-POWERED ANALYSIS
  // ============================================================================
  
  /**
   * Detect patterns using AI analysis
   */
  private async detectPatternsWithAI(
    metrics: SequenceMetrics[],
    minimumLift: number
  ): Promise<SequencePattern[]> {
    // Calculate baseline performance
    const baseline = this.calculateBaselinePerformance(metrics);
    
    // Prepare data for AI
    const metricsData = metrics.map(m => ({
      sequenceId: m.sequenceId,
      name: m.sequenceName,
      replyRate: m.overallReplyRate,
      meetingRate: m.meetingRate,
      opportunityRate: m.opportunityRate,
      recipients: m.totalRecipients,
      stepCount: m.stepMetrics.length,
      stepMetrics: m.stepMetrics.map(s => ({
        step: s.stepNumber,
        type: s.stepType,
        openRate: s.openRate,
        clickRate: s.clickRate,
        replyRate: s.replyRate,
      })),
    }));
    
    const prompt = `Analyze these email sequence performance metrics and identify high-performing patterns.

BASELINE PERFORMANCE:
- Reply Rate: ${baseline.replyRate.toFixed(1)}%
- Meeting Rate: ${baseline.meetingRate.toFixed(1)}%
- Opportunity Rate: ${baseline.opportunityRate.toFixed(1)}%

SEQUENCE METRICS:
${JSON.stringify(metricsData, null, 2)}

ANALYSIS REQUIREMENTS:
1. Identify sequences performing ${minimumLift}%+ above baseline
2. Find common patterns in high-performing sequences:
   - Subject line formulas
   - Content structure
   - Timing strategies
   - Step count optimization
   - Delay optimization
   - Call-to-action approaches
   - Personalization techniques
3. Provide specific, actionable characteristics for each pattern
4. Include statistical validation (sample size, confidence level)

Return patterns in this JSON format:
{
  "patterns": [
    {
      "type": "subject_line_formula",
      "name": "Pattern name",
      "description": "Clear description",
      "sampleSize": 50,
      "occurrences": 12,
      "patternPerformance": {"replyRate": 25.5, "meetingRate": 15.2, "opportunityRate": 8.3},
      "replyLift": 35.2,
      "meetingLift": 28.1,
      "opportunityLift": 42.0,
      "confidence": "high",
      "characteristics": [
        {
          "attribute": "Subject line length",
          "value": "40-60 characters",
          "importance": "critical",
          "description": "Optimal length for mobile preview"
        }
      ],
      "recommendation": "Apply this pattern to underperforming sequences",
      "implementationSteps": ["Step 1", "Step 2"],
      "exampleSequences": ["seq-123", "seq-456"]
    }
  ]
}`;

    try {
      const response = await sendUnifiedChatMessage({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert email sequence analyst specializing in B2B sales. Analyze performance data and identify actionable patterns with statistical rigor.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 3000,
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      // Transform AI response to SequencePattern objects
      return result.patterns.map((p: any, index: number) => ({
        id: `pattern-${Date.now()}-${index}`,
        type: p.type as PatternType,
        name: p.name,
        description: p.description,
        sampleSize: p.sampleSize,
        occurrences: p.occurrences,
        patternPerformance: p.patternPerformance,
        baselinePerformance: baseline,
        replyLift: p.replyLift,
        meetingLift: p.meetingLift,
        opportunityLift: p.opportunityLift,
        confidence: p.confidence as PatternConfidence,
        pValue: p.pValue,
        characteristics: p.characteristics,
        exampleSequences: p.exampleSequences || [],
        recommendation: p.recommendation,
        implementationSteps: p.implementationSteps,
        identifiedAt: new Date(),
        lastValidated: new Date(),
      }));
    } catch (error) {
      console.error('Error detecting patterns with AI:', error);
      return [];
    }
  }
  
  /**
   * Generate optimizations for a single sequence
   */
  private async generateOptimizationsForSequence(
    metrics: SequenceMetrics,
    patterns: SequencePattern[]
  ): Promise<OptimizationRecommendation[]> {
    // Build AI prompt
    const prompt = `Analyze this email sequence and provide optimization recommendations.

SEQUENCE: ${metrics.sequenceName}
CURRENT PERFORMANCE:
- Reply Rate: ${metrics.overallReplyRate.toFixed(1)}%
- Meeting Rate: ${metrics.meetingRate.toFixed(1)}%
- Opportunity Rate: ${metrics.opportunityRate.toFixed(1)}%
- Recipients: ${metrics.totalRecipients}

STEP-BY-STEP METRICS:
${metrics.stepMetrics.map(s => `
Step ${s.stepNumber} (${s.stepType}):
- Open Rate: ${s.openRate.toFixed(1)}%
- Click Rate: ${s.clickRate.toFixed(1)}%
- Reply Rate: ${s.replyRate.toFixed(1)}%
`).join('\n')}

HIGH-PERFORMING PATTERNS:
${patterns.map(p => `
- ${p.name} (${p.confidence} confidence)
  Lifts: Reply +${p.replyLift.toFixed(1)}%, Meeting +${p.meetingLift.toFixed(1)}%
  Key: ${p.characteristics[0]?.description || 'N/A'}
`).join('\n')}

Provide 3-5 specific, actionable optimization recommendations:
1. Identify areas for improvement (timing, subject lines, content, CTAs, etc.)
2. Quantify expected impact
3. Provide step-by-step implementation
4. Suggest A/B tests where appropriate

Return JSON format:
{
  "recommendations": [
    {
      "area": "subject_lines",
      "priority": "high",
      "title": "Optimize subject line length",
      "description": "Current subject lines are too long for mobile",
      "currentMetric": {"name": "Avg subject length", "value": 85, "unit": "characters"},
      "projectedMetric": {"name": "Avg subject length", "value": 50, "unit": "characters"},
      "expectedLift": 25.5,
      "issue": "Long subjects truncate on mobile",
      "solution": "Shorten to 40-60 characters",
      "rationale": "Mobile opens are 65% of total, need optimization",
      "actionItems": [
        {"step": 1, "action": "Review all subject lines", "estimatedTime": 30},
        {"step": 2, "action": "Rewrite subjects to 40-60 chars", "estimatedTime": 60}
      ],
      "estimatedEffort": "low",
      "estimatedImpact": "high",
      "basedOnPatterns": ["pattern-123"],
      "confidence": "high"
    }
  ]
}`;

    try {
      const response = await sendUnifiedChatMessage({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are an expert email sequence optimizer. Provide specific, data-driven recommendations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 2500,
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }
      
      const result = JSON.parse(jsonMatch[0]);
      
      // Transform to OptimizationRecommendation objects
      return result.recommendations.map((r: any, index: number) => ({
        id: `opt-${metrics.sequenceId}-${index}`,
        area: r.area as OptimizationArea,
        priority: r.priority as RecommendationPriority,
        title: r.title,
        description: r.description,
        currentMetric: r.currentMetric,
        projectedMetric: r.projectedMetric,
        expectedLift: r.expectedLift,
        issue: r.issue,
        solution: r.solution,
        rationale: r.rationale,
        actionItems: r.actionItems,
        estimatedEffort: r.estimatedEffort,
        estimatedImpact: r.estimatedImpact,
        basedOnPatterns: r.basedOnPatterns || [],
        sampleSize: metrics.totalRecipients,
        confidence: r.confidence as PatternConfidence,
        suggestedTest: r.suggestedTest,
        createdAt: new Date(),
      }));
    } catch (error) {
      console.error('Error generating optimizations:', error);
      return [];
    }
  }
  
  /**
   * Generate AI insights summary
   */
  private async generateAIInsights(
    metrics: SequenceMetrics[],
    patterns?: SequencePattern[],
    optimizations?: OptimizationRecommendation[]
  ): Promise<{ keyFindings: string[]; concerns: string[]; opportunities: string[]; nextSteps: string[] }> {
    const prompt = `Summarize key insights from this email sequence analysis.

OVERALL METRICS:
${metrics.map(m => `
- ${m.sequenceName}: ${m.overallReplyRate.toFixed(1)}% reply, ${m.meetingRate.toFixed(1)}% meeting
`).join('\n')}

PATTERNS FOUND: ${patterns?.length || 0}
TOP PATTERN: ${patterns?.[0]?.name || 'None'}

OPTIMIZATIONS: ${optimizations?.length || 0}
TOP PRIORITY: ${optimizations?.[0]?.title || 'None'}

Provide:
1. 3-5 key findings (what's working well)
2. 2-3 concerns (what needs attention)
3. 3-5 opportunities (potential improvements)
4. 3-5 next steps (actionable items)

Return concise JSON:
{
  "keyFindings": ["Finding 1", "Finding 2"],
  "concerns": ["Concern 1", "Concern 2"],
  "opportunities": ["Opportunity 1", "Opportunity 2"],
  "nextSteps": ["Step 1", "Step 2"]
}`;

    try {
      const response = await sendUnifiedChatMessage({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are a sales analytics expert. Provide concise, actionable insights.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1000,
      });
      
      const content = response.content || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Error generating AI insights:', error);
    }
    
    // Fallback
    return {
      keyFindings: ['Analysis complete'],
      concerns: [],
      opportunities: [],
      nextSteps: ['Review patterns and optimizations'],
    };
  }
  
  // ============================================================================
  // PRIVATE METHODS - DATA PROCESSING
  // ============================================================================
  
  /**
   * Fetch sequences based on input
   */
  private async fetchSequences(input: SequenceAnalysisInput): Promise<EmailSequence[]> {
    // TODO: Implement database fetching
    // For now, return mock structure
    const sequenceIds = input.sequenceIds || (input.sequenceId ? [input.sequenceId] : []);
    
    return sequenceIds.map((id, index) => ({
      id,
      name: `Email Sequence ${index + 1}`,
      description: 'Sample sequence',
      status: 'active' as const,
      steps: [
        {
          stepNumber: 1,
          stepType: 'initial_outreach' as const,
          subject: 'Sample subject',
          body: 'Sample body',
          delayHours: 0,
          timingStrategy: 'business_hours' as const,
        },
      ],
      targetAudience: 'Enterprise prospects',
      useCase: 'Cold outbound',
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: 'system',
    }));
  }
  
  /**
   * Calculate sequence metrics
   */
  private async calculateMetrics(
    sequences: EmailSequence[],
    startDate: Date,
    endDate: Date
  ): Promise<SequenceMetrics[]> {
    // TODO: Implement real metric calculation from database
    // For now, generate sample metrics
    return sequences.map(seq => this.generateMockMetrics(seq, startDate, endDate));
  }
  
  /**
   * Generate mock metrics (to be replaced with real data)
   */
  private generateMockMetrics(
    sequence: EmailSequence,
    startDate: Date,
    endDate: Date
  ): SequenceMetrics {
    const totalRecipients = 150;
    const totalSent = totalRecipients * sequence.steps.length;
    
    return {
      sequenceId: sequence.id,
      sequenceName: sequence.name,
      totalRecipients,
      activeExecutions: 45,
      completedExecutions: 95,
      stoppedExecutions: 10,
      totalSent,
      totalDelivered: Math.floor(totalSent * 0.97),
      totalOpened: Math.floor(totalSent * 0.45),
      totalClicked: Math.floor(totalSent * 0.15),
      totalReplied: Math.floor(totalSent * 0.08),
      totalUnsubscribed: Math.floor(totalSent * 0.02),
      overallDeliveryRate: 97.0,
      overallOpenRate: 45.0,
      overallClickRate: 15.0,
      overallReplyRate: 8.0,
      overallUnsubscribeRate: 2.0,
      conversationStarted: 12,
      meetingBooked: 8,
      opportunityCreated: 5,
      conversationRate: 8.0,
      meetingRate: 5.3,
      opportunityRate: 3.3,
      stepMetrics: sequence.steps.map((step, index) => ({
        stepNumber: step.stepNumber,
        stepType: step.stepType,
        sent: totalRecipients,
        delivered: Math.floor(totalRecipients * 0.97),
        bounced: Math.floor(totalRecipients * 0.03),
        opened: Math.floor(totalRecipients * (0.50 - index * 0.05)),
        clicked: Math.floor(totalRecipients * (0.18 - index * 0.03)),
        replied: Math.floor(totalRecipients * (0.10 - index * 0.02)),
        unsubscribed: Math.floor(totalRecipients * 0.01),
        deliveryRate: 97.0,
        openRate: 50.0 - index * 5,
        clickRate: 18.0 - index * 3,
        replyRate: 10.0 - index * 2,
        unsubscribeRate: 1.0,
        avgOpenCount: 1.2,
        avgClickCount: 0.3,
      })),
      startDate,
      endDate,
      dataPoints: totalRecipients,
    };
  }
  
  /**
   * Analyze timing patterns
   */
  private async analyzeTimings(metrics: SequenceMetrics[]): Promise<{
    bestSendTimes: HourOfDay[];
    bestDaysOfWeek: DayOfWeek[];
    worstSendTimes: HourOfDay[];
    worstDaysOfWeek: DayOfWeek[];
    recommendation: string;
  }> {
    // TODO: Implement real timing analysis
    // For now, return sample data
    const bestSendTimes: HourOfDay[] = [
      { hour: 9, openRate: 55.2, clickRate: 18.3, replyRate: 12.1, sampleSize: 450 },
      { hour: 14, openRate: 52.1, clickRate: 17.1, replyRate: 11.3, sampleSize: 380 },
      { hour: 10, openRate: 51.3, clickRate: 16.8, replyRate: 10.9, sampleSize: 420 },
    ];
    
    const worstSendTimes: HourOfDay[] = [
      { hour: 22, openRate: 12.3, clickRate: 3.2, replyRate: 1.1, sampleSize: 85 },
      { hour: 1, openRate: 8.1, clickRate: 1.8, replyRate: 0.5, sampleSize: 45 },
    ];
    
    const bestDaysOfWeek: DayOfWeek[] = [
      { day: 'tuesday', openRate: 53.2, clickRate: 17.8, replyRate: 11.5, sampleSize: 650 },
      { day: 'wednesday', openRate: 52.1, clickRate: 17.2, replyRate: 11.1, sampleSize: 680 },
      { day: 'thursday', openRate: 51.3, clickRate: 16.9, replyRate: 10.8, sampleSize: 620 },
    ];
    
    const worstDaysOfWeek: DayOfWeek[] = [
      { day: 'saturday', openRate: 22.1, clickRate: 5.3, replyRate: 2.1, sampleSize: 120 },
      { day: 'sunday', openRate: 18.3, clickRate: 4.1, replyRate: 1.5, sampleSize: 95 },
    ];
    
    return {
      bestSendTimes,
      bestDaysOfWeek,
      worstSendTimes,
      worstDaysOfWeek,
      recommendation: 'Send emails Tuesday-Thursday between 9-10 AM or 2-3 PM for optimal engagement.',
    };
  }
  
  /**
   * Calculate baseline performance across all sequences
   */
  private calculateBaselinePerformance(metrics: SequenceMetrics[]): {
    replyRate: number;
    meetingRate: number;
    opportunityRate: number;
  } {
    const totalRecipients = metrics.reduce((sum, m) => sum + m.totalRecipients, 0);
    const totalReplies = metrics.reduce((sum, m) => sum + m.totalReplied, 0);
    const totalMeetings = metrics.reduce((sum, m) => sum + m.meetingBooked, 0);
    const totalOpportunities = metrics.reduce((sum, m) => sum + m.opportunityCreated, 0);
    
    return {
      replyRate: totalRecipients > 0 ? (totalReplies / totalRecipients) * 100 : 0,
      meetingRate: totalRecipients > 0 ? (totalMeetings / totalRecipients) * 100 : 0,
      opportunityRate: totalRecipients > 0 ? (totalOpportunities / totalRecipients) * 100 : 0,
    };
  }
  
  /**
   * Categorize patterns by confidence
   */
  private categorizePatterns(patterns: SequencePattern[]): {
    total: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
    patterns: SequencePattern[];
    topPatterns: SequencePattern[];
  } {
    return {
      total: patterns.length,
      highConfidence: patterns.filter(p => p.confidence === 'high').length,
      mediumConfidence: patterns.filter(p => p.confidence === 'medium').length,
      lowConfidence: patterns.filter(p => p.confidence === 'low').length,
      patterns,
      topPatterns: patterns
        .sort((a, b) => b.replyLift - a.replyLift)
        .slice(0, 5),
    };
  }
  
  /**
   * Categorize optimizations by priority
   */
  private categorizeOptimizations(optimizations: OptimizationRecommendation[]): {
    total: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    recommendations: OptimizationRecommendation[];
    quickWins: OptimizationRecommendation[];
    topPriority: OptimizationRecommendation[];
  } {
    const quickWins = optimizations.filter(
      o => o.estimatedEffort === 'low' && o.estimatedImpact === 'high'
    );
    
    return {
      total: optimizations.length,
      critical: optimizations.filter(o => o.priority === 'critical').length,
      high: optimizations.filter(o => o.priority === 'high').length,
      medium: optimizations.filter(o => o.priority === 'medium').length,
      low: optimizations.filter(o => o.priority === 'low').length,
      recommendations: optimizations,
      quickWins,
      topPriority: optimizations.slice(0, 3),
    };
  }
  
  /**
   * Calculate summary statistics
   */
  private calculateSummary(
    sequences: EmailSequence[],
    metrics: SequenceMetrics[]
  ): {
    totalSequences: number;
    totalRecipients: number;
    totalEmails: number;
    avgReplyRate: number;
    avgMeetingRate: number;
    avgOpportunityRate: number;
    topPerformingSequence: { id: string; name: string; replyRate: number };
    lowestPerformingSequence: { id: string; name: string; replyRate: number };
  } {
    const totalRecipients = metrics.reduce((sum, m) => sum + m.totalRecipients, 0);
    const totalEmails = metrics.reduce((sum, m) => sum + m.totalSent, 0);
    const avgReplyRate = metrics.reduce((sum, m) => sum + m.overallReplyRate, 0) / metrics.length;
    const avgMeetingRate = metrics.reduce((sum, m) => sum + m.meetingRate, 0) / metrics.length;
    const avgOpportunityRate = metrics.reduce((sum, m) => sum + m.opportunityRate, 0) / metrics.length;
    
    const sortedByReply = [...metrics].sort((a, b) => b.overallReplyRate - a.overallReplyRate);
    const topMetric = sortedByReply[0];
    const lowestMetric = sortedByReply[sortedByReply.length - 1];
    
    return {
      totalSequences: sequences.length,
      totalRecipients,
      totalEmails,
      avgReplyRate,
      avgMeetingRate,
      avgOpportunityRate,
      topPerformingSequence: {
        id: topMetric.sequenceId,
        name: topMetric.sequenceName,
        replyRate: topMetric.overallReplyRate,
      },
      lowestPerformingSequence: {
        id: lowestMetric.sequenceId,
        name: lowestMetric.sequenceName,
        replyRate: lowestMetric.overallReplyRate,
      },
    };
  }
  
  /**
   * Generate unique analysis ID
   */
  private generateAnalysisId(): string {
    return `analysis-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const sequenceEngine = new SequenceIntelligenceEngine();
