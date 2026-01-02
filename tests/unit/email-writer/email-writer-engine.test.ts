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
  getBattlecard: jest.fn(),
}));

// Now import after mocks are set up
import { generateSalesEmail, generateEmailVariants } from '@/lib/email-writer/server';
import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { calculateDealScore } from '@/lib/templates/deal-scoring-engine';
import { getBattlecard } from '@/lib/battlecard/battlecard-engine';
import type { DealScore } from '@/lib/templates/deal-scoring-engine';
import type { Battlecard } from '@/lib/battlecard/battlecard-engine';

describe('Email Writer Engine', () => {
  // ============================================================================
  // SETUP
  // ============================================================================
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Signal Coordinator
    (getServerSignalCoordinator as jest.MockedFunction<typeof getServerSignalCoordinator>)
      .mockResolvedValue({
        emitSignal: jest.fn().mockResolvedValue(undefined),
      } as never);
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
  
  const mockBattlecard: Battlecard = {
    id: 'battlecard_123',
    organizationId: 'org_123',
    competitorDomain: 'competitor.com',
    competitorName: 'Competitor Inc',
    ourProductName: 'Our Product',
    battleTactics: {
      whenWeWin: ['Better pricing', 'Superior support'],
      whenTheyWin: ['Established brand'],
      commonObjections: [
        {
          objection: 'Too expensive',
          response: 'Our ROI is 3x higher',
          proofPoints: ['Case study A', 'Case study B'],
          category: 'pricing',
        },
      ],
    },
    featureComparison: [
      {
        feature: 'Advanced Analytics',
        usValue: 'Yes',
        themValue: 'No',
        advantage: 'us',
      },
    ],
    generatedAt: new Date(),
  };
  
  const mockLLMResponse = {
    success: true,
    content: `SUBJECT: Quick question about your sales process

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
      prompt_tokens: 500,
      completion_tokens: 200,
      total_tokens: 700,
    },
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
          content: mockLLMResponse.content.replace('Quick question', 'Following up on our conversation'),
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
          content: mockLLMResponse.content.replace('Quick question', 'Proposal for Acme Corp'),
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
          content: mockLLMResponse.content.replace('Quick question', 'Ready to move forward?'),
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
          content: mockLLMResponse.content.replace('Quick question', 'Checking back in'),
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
        .mockResolvedValue(mockDealScore);
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
      (getBattlecard as jest.MockedFunction<typeof getBattlecard>)
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
      
      expect(getBattlecard).toHaveBeenCalledWith({
        organizationId: 'org_123',
        competitorDomain: 'https://competitor.com',
        ourProductName: '[Company]',
      });
      expect(result.success).toBe(true);
      expect(result.email?.includeCompetitive).toBe(true);
    });
    
    it('should handle battlecard fetch failure gracefully', async () => {
      (getBattlecard as jest.MockedFunction<typeof getBattlecard>)
        .mockRejectedValue(new Error('Battlecard not found'));
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
      
      // Should still succeed even if battlecard fails
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
      const mockEmitSignal = jest.fn().mockResolvedValue(undefined);
      (getServerSignalCoordinator as jest.MockedFunction<typeof getServerSignalCoordinator>)
        .mockResolvedValue({
          emitSignal: mockEmitSignal,
        } as never);
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
