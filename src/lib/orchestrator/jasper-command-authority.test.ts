/**
 * Jasper Command Authority Tests
 *
 * Tests for Phase 8 of Autonomous Business Operations
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  type JasperCommandAuthority,
  getJasperCommandAuthority,
  resetJasperCommandAuthority,
} from './jasper-command-authority';
import { AGENT_IDS } from '@/lib/agents';
import { getMemoryVault } from '@/lib/agents/shared/memory-vault';

describe('JasperCommandAuthority', () => {
  let authority: JasperCommandAuthority;

  beforeEach(() => {
    resetJasperCommandAuthority();
    authority = getJasperCommandAuthority();
  });

  describe('8a. Briefing System', () => {
    it('should generate an executive briefing', async () => {
      const briefing = await authority.generateExecutiveBriefing();

      expect(briefing).toBeDefined();
      expect(briefing.briefingId).toMatch(/^brief_/);
      expect(briefing.summary).toBeDefined();
      expect(Array.isArray(briefing.highlights)).toBe(true);
      expect(Array.isArray(briefing.pendingApprovals)).toBe(true);
      expect(Array.isArray(briefing.departmentSummaries)).toBe(true);
      expect(briefing.metrics).toBeDefined();
    });

    it('should include department summaries for all managers', async () => {
      const briefing = await authority.generateExecutiveBriefing();

      expect(briefing.departmentSummaries.length).toBeGreaterThan(0);

      // Each department should have required fields
      briefing.departmentSummaries.forEach(dept => {
        expect(dept.department).toBeDefined();
        expect(dept.managerId).toBeDefined();
        expect(dept.status).toMatch(/HEALTHY|NEEDS_ATTENTION|CRITICAL/);
        expect(typeof dept.actionsCompleted).toBe('number');
        expect(typeof dept.actionsPending).toBe('number');
      });
    });

    it('should include operational metrics', async () => {
      const briefing = await authority.generateExecutiveBriefing();

      expect(typeof briefing.metrics.totalOperationalCycles).toBe('number');
      expect(typeof briefing.metrics.totalActionsExecuted).toBe('number');
      expect(typeof briefing.metrics.successRate).toBe('number');
      expect(briefing.metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(briefing.metrics.successRate).toBeLessThanOrEqual(1);
    });
  });

  describe('8b. Approval Gateway', () => {
    it('should queue an approval', () => {
      const approvalId = authority.queueForApproval({
        requestedBy: AGENT_IDS.REPUTATION_MANAGER,
        type: 'REVIEW_RESPONSE',
        description: 'Respond to 1-star review',
        urgency: 'HIGH',
        context: { reviewId: 'rev_123', rating: 1 },
      });

      expect(approvalId).toMatch(/^appr_/);

      const pendingApprovals = authority.getPendingApprovals();
      expect(pendingApprovals).toHaveLength(1);
      expect(pendingApprovals[0].approvalId).toBe(approvalId);
    });

    it('should process approval decisions', async () => {
      const approvalId = authority.queueForApproval({
        requestedBy: AGENT_IDS.MARKETING_MANAGER,
        type: 'LARGE_CAMPAIGN',
        description: 'Launch campaign to 500 recipients',
        urgency: 'NORMAL',
        context: { campaignId: 'camp_456', recipients: 500 },
      });

      const result = await authority.processApproval(approvalId, 'APPROVED');

      expect(result.status).toBe('EXECUTED');
      expect(result.commandId).toBe(approvalId);

      // Approval should be removed from pending
      const pendingApprovals = authority.getPendingApprovals();
      expect(pendingApprovals).toHaveLength(0);
    });

    it('should determine when approval is required', () => {
      // Low confidence → requires approval
      expect(
        authority.shouldRequireApproval({
          type: 'review_response',
          confidence: 65,
        })
      ).toBe(true);

      // Large campaign → requires approval
      expect(
        authority.shouldRequireApproval({
          type: 'email_campaign',
          confidence: 90,
          recipientCount: 150,
        })
      ).toBe(true);

      // Pricing change → requires approval
      expect(
        authority.shouldRequireApproval({
          type: 'pricing_change',
          confidence: 95,
        })
      ).toBe(true);

      // High confidence, small campaign → no approval
      expect(
        authority.shouldRequireApproval({
          type: 'email_campaign',
          confidence: 90,
          recipientCount: 50,
        })
      ).toBe(false);
    });
  });

  describe('8c. Command Authority', () => {
    it('should issue a command to a manager', async () => {
      const result = await authority.issueCommand(
        AGENT_IDS.OUTREACH_MANAGER,
        'PROCESS_INBOUND_REPLIES',
        { batchSize: 10 },
        'HIGH'
      );

      expect(result).toBeDefined();
      expect(result.commandId).toMatch(/^cmd_/);
      expect(['EXECUTED', 'QUEUED', 'FAILED']).toContain(result.status);

      // Command should be in history
      const history = authority.getCommandHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[history.length - 1].commandId).toBe(result.commandId);
    });

    it('should override an autonomous decision', async () => {
      const result = await authority.overrideAutonomousDecision(
        AGENT_IDS.REPUTATION_MANAGER,
        'REVIEW_RESPONSE_OVERRIDE',
        {
          reviewId: 'rev_789',
          originalResponse: 'Template response',
          newResponse: 'Custom personalized response',
        }
      );

      expect(result).toBeDefined();
      expect(result.commandId).toMatch(/^cmd_/);

      // Override should be written to MemoryVault
      const vault = getMemoryVault();
      const strategies = vault.query('JASPER', {
        category: 'STRATEGY',
        tags: ['jasper-override'],
        limit: 1,
      });

      expect(strategies.length).toBeGreaterThan(0);
    });

    it('should set a strategic objective', async () => {
      const result = await authority.setObjective(
        AGENT_IDS.REVENUE_DIRECTOR,
        'Increase qualified leads by 25%',
        'Q2 2026',
        '125 qualified leads'
      );

      expect(result).toBeDefined();
      expect(result.commandId).toMatch(/^cmd_/);

      // Objective should be written to MemoryVault
      const vault = getMemoryVault();
      const objectives = vault.query('JASPER', {
        category: 'STRATEGY',
        tags: ['quarterly-objective'],
        limit: 1,
      });

      expect(objectives.length).toBeGreaterThan(0);
    });

    it('should maintain command history', async () => {
      await authority.issueCommand(
        AGENT_IDS.CONTENT_MANAGER,
        'GENERATE_CONTENT',
        { contentType: 'BLOG_POST', topic: 'AI in Sales' },
        'NORMAL'
      );

      await authority.issueCommand(
        AGENT_IDS.MARKETING_MANAGER,
        'ANALYZE_PERFORMANCE',
        { timeframe: 'last_7_days' },
        'HIGH'
      );

      const history = authority.getCommandHistory();
      expect(history.length).toBeGreaterThanOrEqual(2);

      // Commands should be in chronological order
      expect(history[history.length - 1].issuedAt.getTime()).toBeGreaterThanOrEqual(
        history[history.length - 2].issuedAt.getTime()
      );
    });
  });

  describe('Singleton Management', () => {
    it('should return the same instance', () => {
      const instance1 = getJasperCommandAuthority();
      const instance2 = getJasperCommandAuthority();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = getJasperCommandAuthority();
      resetJasperCommandAuthority();
      const instance2 = getJasperCommandAuthority();

      expect(instance1).not.toBe(instance2);
    });
  });
});
