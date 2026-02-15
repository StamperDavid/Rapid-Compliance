/**
 * Conversation Intelligence Engine - Unit Tests
 * 
 * Comprehensive tests for conversation analysis functionality.
 * Tests AI analysis, talk ratio calculation, scoring, and event emission.
 * 
 * @module tests/lib/conversation
 */

import {
  analyzeTranscript,
} from '@/lib/conversation/conversation-engine';
import {
  DEFAULT_CONVERSATION_CONFIG,
  type AnalyzeTranscriptRequest,
  type ConversationType,
  type Participant,
  type ParticipantRole,
  type ConversationEngineConfig,
} from '@/lib/conversation/types';

// Mock dependencies
jest.mock('@/lib/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/ai/unified-ai-service', () => ({
  sendUnifiedChatMessage: jest.fn(),
}));

jest.mock('@/lib/orchestration/coordinator-factory-server', () => ({
  getServerSignalCoordinator: jest.fn(() => ({
    emitSignal: jest.fn(),
  })),
}));

import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
const mockSendUnifiedChatMessage = sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>;

// ============================================================================
// TEST DATA
// ============================================================================

const createMockParticipants = (): Participant[] => [
  {
    id: 'rep-1',
    name: 'John Sales',
    email: 'john@company.com',
    role: 'sales_rep' as ParticipantRole,
    company: 'Company Inc',
  },
  {
    id: 'prospect-1',
    name: 'Jane Buyer',
    email: 'jane@prospect.com',
    role: 'decision_maker' as ParticipantRole,
    company: 'Prospect Corp',
    title: 'VP of Sales',
  },
];

const createMockTranscript = (): string => `
John Sales: Hi Jane, thanks for joining the call today. How are you?
Jane Buyer: I'm doing well, thanks. Looking forward to learning more about your solution.
John Sales: Great! Before we dive in, can you tell me about your current challenges with lead management?
Jane Buyer: Sure. We're struggling with response times. Our reps take 2-3 hours to respond to new leads, and we're losing opportunities because of it.
John Sales: That's a common pain point. How many leads do you get per month?
Jane Buyer: About 500 inbound leads.
John Sales: And what's your current conversion rate?
Jane Buyer: Around 12%. We know we could do better.
John Sales: Absolutely. Our platform can help you respond within minutes. Would improving that response time be valuable?
Jane Buyer: Definitely. How does your solution compare to Salesforce?
John Sales: Good question. While Salesforce is a great CRM, our AI-powered routing ensures the right rep gets the lead instantly.
Jane Buyer: That sounds interesting. What's the pricing?
John Sales: Our pricing starts at $5,000 per month for up to 1,000 leads. Does that fit your budget?
Jane Buyer: That's a bit higher than we expected. We were thinking more like $3,000.
John Sales: I understand. Let me show you the ROI. If we can improve your conversion rate from 12% to even 15%, that's 15 extra deals per month.
Jane Buyer: That's a good point. I'd need to discuss this with our CFO.
John Sales: Of course. Would you like me to prepare a proposal for your review?
Jane Buyer: Yes, that would be helpful. Can we schedule a follow-up for next week?
John Sales: Absolutely. How does Tuesday at 2 PM work?
Jane Buyer: Perfect.
`;

const createMockAIResponse = () => ({
  text: JSON.stringify({
    sentiment: {
      overall: {
        polarity: 'positive',
        score: 0.6,
        confidence: 85,
        tone: ['professional', 'interested', 'engaged'],
      },
      byParticipant: {
        'John Sales': {
          polarity: 'positive',
          score: 0.7,
          confidence: 90,
          tone: ['confident', 'professional'],
        },
        'Jane Buyer': {
          polarity: 'neutral',
          score: 0.5,
          confidence: 80,
          tone: ['curious', 'analytical'],
        },
      },
      timeline: [
        { timestamp: 60, sentiment: 0.5, speaker: 'Jane Buyer', context: 'Initial greeting' },
        { timestamp: 180, sentiment: 0.6, speaker: 'Jane Buyer', context: 'Discussing pain points' },
      ],
      trendDirection: 'improving',
      criticalMoments: [
        {
          timestamp: 300,
          type: 'spike',
          magnitude: 0.3,
          speaker: 'Jane Buyer',
          quote: 'That sounds interesting',
          context: 'Positive reaction to solution',
          impact: 'high',
        },
      ],
    },
    topics: {
      mainTopics: [
        {
          name: 'Lead response time',
          category: 'pain_points',
          mentions: 3,
          duration: 120,
          sentiment: 0.4,
          importance: 'critical',
          quotes: ["We're struggling with response times"],
        },
        {
          name: 'Pricing',
          category: 'pricing',
          mentions: 2,
          duration: 60,
          sentiment: -0.2,
          importance: 'high',
          quotes: ["That's a bit higher than we expected"],
        },
      ],
      coverageMap: {
        'pain_points': 120,
        'pricing': 60,
      },
      uncoveredTopics: ['Implementation timeline', 'Training requirements'],
      timeAllocation: [
        {
          topic: 'pain_points',
          duration: 120,
          percentage: 40,
          isAppropriate: true,
        },
      ],
    },
    objections: [
      {
        id: 'obj-1',
        type: 'pricing',
        objection: 'Price too high',
        quote: "That's a bit higher than we expected. We were thinking more like $3,000.",
        timestamp: 420,
        speaker: 'Jane Buyer',
        severity: 'high',
        wasAddressed: true,
        repResponse: 'Let me show you the ROI',
        responseQuality: 'good',
        recommendedResponse: 'Focus on value and ROI calculation',
      },
    ],
    competitors: [
      {
        competitor: 'Salesforce',
        mentions: 1,
        context: ['How does your solution compare to Salesforce?'],
        sentiment: 0.3,
        concernLevel: 'medium',
        recommendedResponse: 'Emphasize AI-powered routing advantage',
      },
    ],
    keyMoments: [
      {
        id: 'moment-1',
        timestamp: 180,
        type: 'buying_signal',
        title: 'Expressed pain point',
        description: 'Prospect shared critical challenge with lead response times',
        speaker: 'Jane Buyer',
        quote: "We're struggling with response times",
        impact: 'positive',
        significance: 'high',
      },
      {
        id: 'moment-2',
        timestamp: 600,
        type: 'next_steps_agreed',
        title: 'Scheduled follow-up',
        description: 'Agreement on next steps and proposal',
        speaker: 'Jane Buyer',
        quote: 'Yes, that would be helpful',
        impact: 'positive',
        significance: 'critical',
      },
    ],
    summary: 'Positive discovery call with engaged prospect. Clear pain points identified around lead response times. Pricing objection raised but addressed with ROI discussion. Next steps confirmed.',
    highlights: [
      'Prospect has clear pain point with 2-3 hour response times',
      'Pricing objection handled well with ROI focus',
      'Next steps scheduled for proposal review',
    ],
    confidence: 85,
  }),
  usage: {
    promptTokens: 1000,
    completionTokens: 500,
    totalTokens: 1500,
    cost: 0.05,
  },
  model: 'gpt-4o',
  provider: 'openai' as const,
});

// ============================================================================
// TESTS
// ============================================================================

describe('Conversation Analysis Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  describe('analyzeTranscript', () => {
    it('should analyze transcript successfully', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
        includeCoaching: true,
        includeFollowUps: true,
      };
      
      mockSendUnifiedChatMessage.mockResolvedValue(createMockAIResponse());
      
      // Act
      const result = await analyzeTranscript(request);


      // Assert
      expect(result).toBeDefined();
      expect(result.sentiment).toBeDefined();
      expect(result.sentiment.overall.polarity).toBe('positive');
      expect(result.talkRatio).toBeDefined();
      expect(result.topics).toBeDefined();
      expect(result.scores).toBeDefined();
      expect(result.scores.overall).toBeGreaterThan(0);
      expect(result.scores.overall).toBeLessThanOrEqual(100);
    });
    
    it('should calculate talk ratio correctly', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
      };
      
      mockSendUnifiedChatMessage.mockResolvedValue(createMockAIResponse());
      
      // Act
      const result = await analyzeTranscript(request);
      
      // Assert
      expect(result.talkRatio).toBeDefined();
      expect(result.talkRatio.repPercentage).toBeGreaterThanOrEqual(0);
      expect(result.talkRatio.repPercentage).toBeLessThanOrEqual(100);
      expect(result.talkRatio.prospectPercentage).toBeGreaterThanOrEqual(0);
      expect(result.talkRatio.prospectPercentage).toBeLessThanOrEqual(100);
      expect(result.talkRatio.repPercentage + result.talkRatio.prospectPercentage).toBeLessThanOrEqual(100);
      expect(result.talkRatio.assessment).toBeDefined();
      expect(result.talkRatio.recommendation).toBeDefined();
    });
    
    it('should generate coaching insights when requested', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
        includeCoaching: true,
      };
      
      const aiResponse = createMockAIResponse();
      const coachingResponse = {
        ...aiResponse,
        text: JSON.stringify([
          {
            id: 'coaching-1',
            category: 'objection_handling',
            priority: 'high',
            insight: 'Good objection handling',
            whatToImprove: 'Could be more proactive',
            specificExample: 'Pricing objection',
            recommendedAction: 'Practice value-based selling',
            skillArea: 'Negotiation',
            impact: 75,
          },
        ]),
      };
      
      mockSendUnifiedChatMessage
        .mockResolvedValueOnce(aiResponse)
        .mockResolvedValueOnce(coachingResponse);
      
      // Act
      const result = await analyzeTranscript(request);
      
      // Assert
      expect(result.coachingInsights).toBeDefined();
      expect(Array.isArray(result.coachingInsights)).toBe(true);
    });
    
    it('should generate follow-up actions when requested', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
        includeFollowUps: true,
      };
      
      const aiResponse = createMockAIResponse();
      const followUpResponse = {
        ...aiResponse,
        text: JSON.stringify([
          {
            id: 'followup-1',
            type: 'send_proposal',
            priority: 'high',
            title: 'Send proposal',
            description: 'Send detailed proposal to Jane',
            reasoning: 'Prospect requested proposal',
            deadline: 'within 24 hours',
            estimatedEffort: 2,
          },
        ]),
      };
      
      mockSendUnifiedChatMessage
        .mockResolvedValueOnce(aiResponse)
        .mockResolvedValueOnce(followUpResponse);
      
      // Act
      const result = await analyzeTranscript(request);
      
      // Assert
      expect(result.followUpActions).toBeDefined();
      expect(Array.isArray(result.followUpActions)).toBe(true);
    });
    
    it('should calculate conversation scores', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
      };
      
      mockSendUnifiedChatMessage.mockResolvedValue(createMockAIResponse());
      
      // Act
      const result = await analyzeTranscript(request);
      
      // Assert
      expect(result.scores).toBeDefined();
      expect(result.scores.overall).toBeGreaterThan(0);
      expect(result.scores.discovery).toBeGreaterThan(0);
      expect(result.scores.objectionHandling).toBeGreaterThan(0);
      expect(result.scores.closing).toBeGreaterThan(0);
      expect(result.scores.rapport).toBeGreaterThan(0);
      expect(result.scores.engagement).toBeGreaterThan(0);
      
      // All scores should be 0-100
      Object.values(result.scores).forEach(score => {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      });
    });
    
    it('should identify quality indicators', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
      };
      
      mockSendUnifiedChatMessage.mockResolvedValue(createMockAIResponse());
      
      // Act
      const result = await analyzeTranscript(request);
      
      // Assert
      expect(result.qualityIndicators).toBeDefined();
      expect(Array.isArray(result.qualityIndicators)).toBe(true);
      expect(result.qualityIndicators.length).toBeGreaterThan(0);
      
      result.qualityIndicators.forEach(indicator => {
        expect(indicator.type).toBeDefined();
        expect(indicator.status).toBeDefined();
        expect(indicator.score).toBeGreaterThanOrEqual(0);
        expect(indicator.score).toBeLessThanOrEqual(100);
        expect(indicator.description).toBeDefined();
      });
    });
    
    it('should extract red flags', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
      };
      
      const aiResponseNoNextSteps = createMockAIResponse();
      const parsed = JSON.parse(aiResponseNoNextSteps.text);
      parsed.keyMoments = []; // Remove next steps
      aiResponseNoNextSteps.text = JSON.stringify(parsed);
      
      mockSendUnifiedChatMessage.mockResolvedValue(aiResponseNoNextSteps);
      
      // Act
      const result = await analyzeTranscript(request);
      
      // Assert
      expect(result.redFlags).toBeDefined();
      expect(Array.isArray(result.redFlags)).toBe(true);
      // Should have "no next steps" red flag
      const noNextStepsFlag = result.redFlags.find(f => f.type === 'no_next_steps');
      expect(noNextStepsFlag).toBeDefined();
    });
    
    it('should extract positive signals', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
      };
      
      mockSendUnifiedChatMessage.mockResolvedValue(createMockAIResponse());
      
      // Act
      const result = await analyzeTranscript(request);
      
      // Assert
      expect(result.positiveSignals).toBeDefined();
      expect(Array.isArray(result.positiveSignals)).toBe(true);
    });
    
    it('should handle short transcripts', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: 'Very short transcript',
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 60,
      };
      
      mockSendUnifiedChatMessage.mockResolvedValue(createMockAIResponse());
      
      // Act & Assert
      await expect(analyzeTranscript(request)).resolves.toBeDefined();
    });
    
    it('should respect custom config', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
        includeCoaching: true,
      };
      
      const customConfig: Partial<ConversationEngineConfig> = {
        aiModel: 'gpt-4o-mini',
        maxCoachingInsights: 3,
      };
      
      mockSendUnifiedChatMessage.mockResolvedValue(createMockAIResponse());
      
      // Act
      const result = await analyzeTranscript(request, { ...DEFAULT_CONVERSATION_CONFIG, ...customConfig });
      
      // Assert
      expect(result.aiModel).toBe('gpt-4o-mini');
    });
    
    it('should track token usage', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
      };
      
      mockSendUnifiedChatMessage.mockResolvedValue(createMockAIResponse());
      
      // Act
      const result = await analyzeTranscript(request);
      
      // Assert
      expect(result.tokensUsed).toBeDefined();
      expect(result.tokensUsed).toBeGreaterThan(0);
    });
    
    it('should track processing time', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
      };
      
      mockSendUnifiedChatMessage.mockResolvedValue(createMockAIResponse());
      
      // Act
      const result = await analyzeTranscript(request);
      
      // Assert
      expect(result.processingTime).toBeDefined();
      expect(result.processingTime).toBeGreaterThanOrEqual(0);
    });
    
    it('should handle AI errors gracefully', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
      };
      
      mockSendUnifiedChatMessage.mockRejectedValue(new Error('AI service error'));
      
      // Act & Assert
      await expect(analyzeTranscript(request)).rejects.toThrow();
    });
    
    it('should handle malformed AI responses', async () => {
      // Arrange
      const request: AnalyzeTranscriptRequest = {
        transcript: createMockTranscript(),
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
      };
      
      const malformedResponse = {
        text: 'Not JSON',
        usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        model: 'gpt-4o',
        provider: 'openai' as const,
      };
      
      mockSendUnifiedChatMessage.mockResolvedValue(malformedResponse);
      
      // Act
      const result = await analyzeTranscript(request);
      
      // Assert
      // Should return fallback analysis
      expect(result).toBeDefined();
      expect(result.sentiment).toBeDefined();
      expect(result.confidence).toBeLessThan(50); // Low confidence for fallback
    });
  });
  
  describe('Talk Ratio Analysis', () => {
    it('should assess ideal talk ratio', async () => {
      // Arrange
      const transcript = `
John Sales: Question 1?
Jane Buyer: Long answer about their business and challenges and goals and timeline and budget and decision process and stakeholders and competition and integration and support and training needs.
John Sales: Question 2?
Jane Buyer: Another long detailed answer with lots of information sharing about their specific situation and requirements and expectations.
John Sales: Question 3?
Jane Buyer: Even more detailed response with comprehensive information.
      `;
      
      const request: AnalyzeTranscriptRequest = {
        transcript,
        conversationType: 'discovery_call' as ConversationType,
        participants: createMockParticipants(),
        repId: 'rep-1',
        duration: 600,
      };
      
      mockSendUnifiedChatMessage.mockResolvedValue(createMockAIResponse());
      
      // Act
      const result = await analyzeTranscript(request);
      
      // Assert
      expect(result.talkRatio.assessment).toBeDefined();
      expect(['ideal', 'balanced', 'needs_improvement', 'rep_dominating', 'prospect_dominating']).toContain(result.talkRatio.assessment);
    });
  });
});
