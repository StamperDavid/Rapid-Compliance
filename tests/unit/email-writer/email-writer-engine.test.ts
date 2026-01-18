/**
 * Email Writer Engine Unit Tests
 * 
 * Tests for AI-powered sales email generation.
 * 
 * Coverage:
 * - Email generation with different types
 * - Tone personalization based on deal score
 * - Competitive positioning integration
 * - Template structure validation
 * - Email parsing and formatting
 * - Variant generation for A/B testing
 * - Signal emission
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// Mock dependencies before imports
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
  getServerSignalCoordinator: jest.fn(),
}));

jest.mock('@/lib/templates/deal-scoring-engine', () => ({
  calculateDealScore: jest.fn(),
}));

jest.mock('@/lib/battlecard/battlecard-engine', () => ({
  discoverCompetitor: jest.fn(),
  generateBattlecard: jest.fn(),
}));

// Now import after mocks are set up
import { generateSalesEmail, generateEmailVariants } from '@/lib/email-writer/server';
import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { calculateDealScore } from '@/lib/templates/deal-scoring-engine';
import { discoverCompetitor, generateBattlecard } from '@/lib/battlecard/battlecard-engine';
import type { DealScore } from '@/lib/templates/deal-scoring-engine';
import type { Battlecard, CompetitorProfile } from '@/lib/battlecard/battlecard-engine';

describe('Email Writer Engine', () => {
  // ============================================================================
  // SETUP
  // ============================================================================
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Signal Coordinator
    (getServerSignalCoordinator as jest.MockedFunction<typeof getServerSignalCoordinator>)
      .mockReturnValue({
        emitSignal: (jest.fn() as any).mockResolvedValue(undefined),
      } as unknown as ReturnType<typeof getServerSignalCoordinator>);
  });
  
  // ============================================================================
  // HELPER DATA
  // ============================================================================
  
  const mockDealScore: DealScore = {
    dealId: 'deal_123',
    score: 75,
    closeProbability: 65,
    tier: 'warm',
    confidence: 80,
    factors: [
      {
        id: 'engagement',
        name: 'Engagement',
        score: 80,
        weight: 0.2,
        contribution: 16,
        impact: 'positive',
        description: 'High engagement',
        value: 'High',
      },
    ],
    riskFactors: [],
    recommendations: ['Schedule demo'],
    predictedCloseDate: new Date('2026-02-01'),
    predictedValue: 50000,
    calculatedAt: new Date(),
  };
  
  const mockCompetitorProfile: CompetitorProfile = {
    id: 'comp_123',
    organizationId: 'org_123',
    domain: 'competitor.com',
    companyName: 'Competitor Inc',
    productOffering: {
      category: 'SaaS',
      targetMarket: ['Enterprise'],
      verticals: ['Technology'],
      keyFeatures: [],
    },
    pricing: {
      model: 'subscription',
      tiers: [],
      hasFreeTrial: false,
      competitivePosition: 'premium',
    },
    positioning: {
      valueProposition: [],
      differentiators: [],
      targetPersonas: [],
      useCases: [],
    },
    analysis: {
      strengths: [],
      weaknesses: [],
    },
    techStack: [],
    socialProof: {
      notableCustomers: [],
      awards: [],
      pressmentions: [],
    },
    growthSignals: {
      isHiring: false,
      jobCount: 0,
      recentActivity: [],
      expansionPlans: [],
    },
    metadata: {
      scrapedAt: new Date(),
      expiresAt: new Date(),
      confidence: 0.8,
      source: 'battlecard-engine',
      lastUpdated: new Date(),
    },
  };
  
  const mockBattlecard: Battlecard = {
    id: 'battlecard_123',
    organizationId: 'org_123',
    ourProduct: 'Our Product',
    competitorId: 'comp_123',
    competitorName: 'Competitor Inc',
    competitorDomain: 'competitor.com',
    featureComparison: [
      {
        category: 'Core Features',
        features: [
          {
            featureName: 'Advanced Analytics',
            us: 'yes',
            them: 'no',
            advantage: 'us',
          },
        ],
      },
    ],
    pricingComparison: {
      ourPositioning: 'Premium',
      theirPositioning: 'Mid-market',
      advantage: 'us',
      keyDifferences: ['Better ROI'],
      valueJustification: ['3x ROI'],
    },
    tactics: {
      idealSituations: [
        {
          situation: 'Better pricing needed',
          reasoning: 'Our pricing is more competitive',
          talkTrack: 'We offer better value',
        },
      ],
      challengingSituations: [],
      objectionHandling: [
        {
          objection: 'Too expensive',
          response: 'Our ROI is 3x higher',
          proofPoints: ['Case study A', 'Case study B'],
        },
      ],
      competitiveTraps: [],
    },
    discoveryQuestions: {
      qualifyingQuestions: [],
      landmineQuestions: [],
    },
    keyMessages: {
      elevator: 'We help companies win',
      executiveSummary: 'Better ROI and support',
      riskMitigation: [],
    },
    metadata: {
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      confidence: 0.85,
      source: 'battlecard-engine',
      version: 1,
    },
  };
  
  const mockLLMResponse = {
    text: `SUBJECT: Quick question about your sales process

---
BODY:
Hi John,

I noticed Acme Corp recently expanded to the East Coast. Congrats!

We help companies like TechCorp solve pipeline visibility challenges by providing real-time deal scoring. They saw 25% improvement in win rates.

Would a quick 15-minute call make sense to explore if we could help Acme achieve similar results?

Best,
Sales Rep

---
PLAIN:
Hi John,

I noticed Acme Corp recently expanded to the East Coast. Congrats!

We help companies like TechCorp solve pipeline visibility challenges by providing real-time deal scoring. They saw 25% improvement in win rates.

Would a quick 15-minute call make sense to explore if we could help Acme achieve similar results?

Best,
Sales Rep

---
IMPROVEMENTS:
- Consider adding a specific time slot
- Include a P.S. with a relevant resource`,
    usage: {
      promptTokens: 500,
      completionTokens: 200,
      totalTokens: 700,
    },
    model: 'gpt-4o',
    provider: 'openai' as const,
  };
  
  // ============================================================================
  // TESTS: EMAIL GENERATION
  // ============================================================================
  
  describe('generateSalesEmail', () => {
    it('should generate intro email successfully', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
        recipientEmail: 'john@acme.com',
        companyName: 'Acme Corp',
      });
      
      expect(result.success).toBe(true);
      expect(result.email).toBeDefined();
      expect(result.email?.emailType).toBe('intro');
      expect(result.email?.subject).toContain('Quick question');
      expect(result.email?.body).toContain('Hi John');
      expect(result.email?.bodyPlain).toBeDefined();
    });
    
    it('should generate follow-up email successfully', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue({
          ...mockLLMResponse,
          text: mockLLMResponse.text.replace('Quick question', 'Following up on our conversation'),
        } as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'follow-up',
        dealId: 'deal_123',
        recipientName: 'John Doe',
        companyName: 'Acme Corp',
      });
      
      expect(result.success).toBe(true);
      expect(result.email?.emailType).toBe('follow-up');
    });
    
    it('should generate proposal email successfully', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue({
          ...mockLLMResponse,
          text: mockLLMResponse.text.replace('Quick question', 'Proposal for Acme Corp'),
        } as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'proposal',
        dealId: 'deal_123',
        recipientName: 'John Doe',
        companyName: 'Acme Corp',
      });
      
      expect(result.success).toBe(true);
      expect(result.email?.emailType).toBe('proposal');
    });
    
    it('should generate close email successfully', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue({
          ...mockLLMResponse,
          text: mockLLMResponse.text.replace('Quick question', 'Ready to move forward?'),
        } as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'close',
        dealId: 'deal_123',
        recipientName: 'John Doe',
        companyName: 'Acme Corp',
      });
      
      expect(result.success).toBe(true);
      expect(result.email?.emailType).toBe('close');
    });
    
    it('should generate re-engagement email successfully', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue({
          ...mockLLMResponse,
          text: mockLLMResponse.text.replace('Quick question', 'Checking back in'),
        } as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 're-engagement',
        dealId: 'deal_123',
        recipientName: 'John Doe',
        companyName: 'Acme Corp',
      });
      
      expect(result.success).toBe(true);
      expect(result.email?.emailType).toBe('re-engagement');
    });
  });
  
  // ============================================================================
  // TESTS: DEAL SCORING INTEGRATION
  // ============================================================================
  
  describe('Deal Scoring Integration', () => {
    it('should use provided deal score for personalization', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        dealScore: mockDealScore,
        recipientName: 'John Doe',
      });
      
      expect(result.success).toBe(true);
      expect(result.email?.dealScore).toBe(75);
      expect(result.email?.dealTier).toBe('warm');
    });
    
    it('should fetch deal score if not provided', async () => {
      (calculateDealScore as jest.MockedFunction<typeof calculateDealScore>)
        .mockReturnValue(mockDealScore);
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        deal: {
          id: 'deal_123',
          name: 'Acme Deal',
          organizationId: 'org_123',
        } as never,
        recipientName: 'John Doe',
      });
      
      expect(calculateDealScore).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(result.email?.dealScore).toBe(75);
    });
    
    it('should adjust tone based on deal tier (hot)', async () => {
      const hotDealScore: DealScore = {
        ...mockDealScore,
        score: 85,
        tier: 'hot',
      };
      
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'close',
        dealId: 'deal_123',
        dealScore: hotDealScore,
        recipientName: 'John Doe',
      });
      
      expect(result.success).toBe(true);
      expect(result.email?.tone).toBe('urgent');
    });
    
    it('should adjust tone based on deal tier (at-risk)', async () => {
      const atRiskDealScore: DealScore = {
        ...mockDealScore,
        score: 35,
        tier: 'at-risk',
      };
      
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 're-engagement',
        dealId: 'deal_123',
        dealScore: atRiskDealScore,
        recipientName: 'John Doe',
      });
      
      expect(result.success).toBe(true);
      expect(result.email?.tone).toBe('friendly');
    });
  });
  
  // ============================================================================
  // TESTS: COMPETITIVE POSITIONING
  // ============================================================================
  
  describe('Competitive Positioning', () => {
    it('should include battlecard data when requested', async () => {
      (discoverCompetitor as jest.MockedFunction<typeof discoverCompetitor>)
        .mockResolvedValue(mockCompetitorProfile);
      (generateBattlecard as jest.MockedFunction<typeof generateBattlecard>)
        .mockResolvedValue(mockBattlecard);
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
        competitorDomain: 'https://competitor.com',
        includeCompetitive: true,
      });
      
      expect(discoverCompetitor).toHaveBeenCalledWith('https://competitor.com', 'org_123');
      expect(generateBattlecard).toHaveBeenCalledWith(mockCompetitorProfile, {
        ourProduct: '[Company]',
      });
      expect(result.success).toBe(true);
      expect(result.email?.includeCompetitive).toBe(true);
    });
    
    it('should handle battlecard fetch failure gracefully', async () => {
      (discoverCompetitor as jest.MockedFunction<typeof discoverCompetitor>)
        .mockRejectedValue(new Error('Competitor not found'));
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
        competitorDomain: 'https://competitor.com',
        includeCompetitive: true,
      });
      
      // Should still succeed even if competitor discovery fails
      expect(result.success).toBe(true);
    });
  });
  
  // ============================================================================
  // TESTS: CUSTOMIZATION
  // ============================================================================
  
  describe('Email Customization', () => {
    it('should respect tone parameter', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
        tone: 'casual',
      });
      
      expect(result.success).toBe(true);
      expect(result.email?.tone).toBe('casual');
    });
    
    it('should respect length parameter', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
        length: 'short',
      });
      
      expect(result.success).toBe(true);
      expect(result.email?.length).toBe('short');
    });
    
    it('should include custom instructions in prompt', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
        customInstructions: 'Mention our new product launch',
      });
      
      // Check that custom instructions were included in the prompt
      const llmCall = (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>).mock.calls[0][0];
      expect(llmCall.messages[1].content).toContain('Mention our new product launch');
    });
  });
  
  // ============================================================================
  // TESTS: EMAIL PARSING
  // ============================================================================
  
  describe('Email Parsing', () => {
    it('should parse subject from LLM response', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
      });
      
      expect(result.email?.subject).toBe('Quick question about your sales process');
    });
    
    it('should parse body from LLM response', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
      });
      
      expect(result.email?.body).toContain('Hi John');
      expect(result.email?.bodyPlain).toContain('Hi John');
    });
    
    it('should parse improvement suggestions', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
      });
      
      expect(result.suggestedImprovements).toBeDefined();
      expect(result.suggestedImprovements?.length).toBeGreaterThan(0);
    });
  });
  
  // ============================================================================
  // TESTS: VARIANT GENERATION
  // ============================================================================
  
  describe('generateEmailVariants', () => {
    it('should generate multiple email variants', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateEmailVariants({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
      }, 3);
      
      expect(result.success).toBe(true);
      expect(result.email).toBeDefined();
      expect(result.email?.variants).toBeDefined();
      expect(result.email?.variants?.length).toBeGreaterThan(0);
    });
    
    it('should generate variants with different tones', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      const result = await generateEmailVariants({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
      }, 3);
      
      // Check that multiple LLM calls were made with different tones
      expect(sendUnifiedChatMessage).toHaveBeenCalledTimes(3);
    });
  });
  
  // ============================================================================
  // TESTS: ERROR HANDLING
  // ============================================================================
  
  describe('Error Handling', () => {
    it('should handle LLM failure gracefully', async () => {
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue({
          success: false,
          error: 'LLM service unavailable',
        } as never);
      
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
    
    it('should handle missing email template', async () => {
      const result = await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'invalid-type' as never,
        dealId: 'deal_123',
        recipientName: 'John Doe',
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Email template not found');
    });
  });
  
  // ============================================================================
  // TESTS: SIGNAL EMISSION
  // ============================================================================
  
  describe('Signal Emission', () => {
    it('should emit email.generated signal', async () => {
      const mockEmitSignal = (jest.fn() as any).mockResolvedValue(undefined);
      (getServerSignalCoordinator as jest.MockedFunction<typeof getServerSignalCoordinator>)
        .mockReturnValue({
          emitSignal: mockEmitSignal,
        } as unknown as ReturnType<typeof getServerSignalCoordinator>);
      (sendUnifiedChatMessage as jest.MockedFunction<typeof sendUnifiedChatMessage>)
        .mockResolvedValue(mockLLMResponse as never);
      
      await generateSalesEmail({
        organizationId: 'org_123',
        workspaceId: 'workspace_123',
        userId: 'user_123',
        emailType: 'intro',
        dealId: 'deal_123',
        recipientName: 'John Doe',
      });
      
      expect(mockEmitSignal).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'email.generated',
          orgId: 'org_123',
          metadata: expect.objectContaining({
            emailType: 'intro',
            dealId: 'deal_123',
          }),
        })
      );
    });
  });
});
