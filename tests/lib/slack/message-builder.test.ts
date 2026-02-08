/**
 * Slack Message Builder Tests
 * 
 * Comprehensive test coverage for SlackMessageBuilder class.
 */

import { SlackMessageBuilder } from '@/lib/slack/message-builder';
import type { NotificationVariables } from '@/lib/notifications/types';

describe('SlackMessageBuilder', () => {
  let builder: SlackMessageBuilder;
  
  beforeEach(() => {
    builder = new SlackMessageBuilder();
  });
  
  describe('buildDealRiskAlert', () => {
    it('should build critical risk alert', () => {
      const variables: NotificationVariables = {
        dealId: 'deal-1',
        dealName: 'Acme Corp Deal',
        dealValue: 100000,
        dealStage: 'Negotiation',
        riskLevel: 'critical',
        riskProbability: 0.85,
      };
      
      const message = builder.buildDealRiskAlert(variables, 'critical');
      
      expect(message.type).toBe('blocks');
      expect(message.text).toContain('CRITICAL');
      expect(message.text).toContain('Acme Corp Deal');
      expect(message.text).toContain('85%');
      expect(message.blocks).toBeDefined();
      expect(message.blocks?.length).toBeGreaterThan(0);
    });
    
    it('should build high risk alert', () => {
      const variables: NotificationVariables = {
        dealId: 'deal-1',
        dealName: 'Test Deal',
        dealValue: 50000,
        dealStage: 'Discovery',
        riskLevel: 'high',
        riskProbability: 0.65,
      };
      
      const message = builder.buildDealRiskAlert(variables, 'high');
      
      expect(message.text).toContain('HIGH');
      expect(message.text).toContain('65%');
    });
    
    it('should include action buttons', () => {
      const variables: NotificationVariables = {
        dealId: 'deal-1',
        dealName: 'Test Deal',
        dealValue: 100000,
        dealStage: 'Negotiation',
        riskProbability: 0.85,
      };
      
      const message = builder.buildDealRiskAlert(variables, 'critical');
      
      const actionsBlock = message.blocks?.find(b => b.type === 'actions');
      expect(actionsBlock).toBeDefined();
      expect(actionsBlock?.elements).toHaveLength(2);
    });
  });
  
  describe('buildConversationAlert', () => {
    it('should build low score alert', () => {
      const variables: NotificationVariables = {
        conversationId: 'conv-1',
        conversationScore: 42,
        userId: 'user-1',
        userName: 'John Doe',
      };
      
      const message = builder.buildConversationAlert(variables, 'low_score');
      
      expect(message.text).toContain('Low Conversation Score');
      expect(message.text).toContain('John Doe');
      expect(message.blocks).toBeDefined();
    });
    
    it('should build red flag alert', () => {
      const variables: NotificationVariables = {
        conversationId: 'conv-1',
        redFlagType: 'Competitor Mentioned',
        redFlagDetails: 'Customer mentioned evaluating competitor X',
        userId: 'user-1',
        userName: 'Jane Smith',
      };

      const message = builder.buildConversationAlert(variables, 'red_flag');

      expect(message.text).toContain('Red Flag');
      expect(message.text).toContain('Jane Smith');
      // Check for red flag details in section blocks
      expect(message.blocks?.some(b =>
        b.type === 'section' &&
        (b.text?.text?.includes('Competitor Mentioned') ??
         b.fields?.some(f => f.text?.includes('Competitor Mentioned')))
      )).toBe(true);
    });
  });
  
  describe('buildPerformanceAlert', () => {
    it('should build top performer alert', () => {
      const variables: NotificationVariables = {
        userId: 'user-1',
        userName: 'Sarah Johnson',
        performanceScore: 95,
        performanceTier: 'Top Performer',
      };
      
      const message = builder.buildPerformanceAlert(variables, 'top_performer');
      
      expect(message.text).toContain('Top Performer');
      expect(message.text).toContain('Sarah Johnson');
      expect(message.blocks).toBeDefined();
    });
    
    it('should build improvement alert', () => {
      const variables: NotificationVariables = {
        userId: 'user-1',
        userName: 'Bob Williams',
        skillGap: 'Objection Handling',
        improvementArea: 'Discovery Skills',
      };
      
      const message = builder.buildPerformanceAlert(variables, 'improvement');
      
      expect(message.text).toContain('Improvement Opportunity');
      expect(message.text).toContain('Bob Williams');
    });
  });
  
  describe('buildLeadRoutingAlert', () => {
    it('should build lead assignment alert', () => {
      const variables: NotificationVariables = {
        leadId: 'lead-1',
        leadName: 'Alice Cooper',
        leadCompany: 'Acme Inc',
        userId: 'user-1',
        userName: 'Rep Name',
        routingScore: 0.92,
      };
      
      const message = builder.buildLeadRoutingAlert(variables);

      expect(message.text).toContain('New lead assigned');
      expect(message.text).toContain('Alice Cooper');
      expect(message.blocks).toBeDefined();
      
      const fieldsBlock = message.blocks?.find(b => b.fields);
      expect(fieldsBlock?.fields?.some(f => 
        f.text.includes('92%')
      )).toBe(true);
    });
  });
  
  describe('buildWorkflowAlert', () => {
    it('should build successful workflow alert', () => {
      const variables: NotificationVariables = {
        workflowId: 'workflow-1',
        workflowName: 'Deal Follow-up',
        actionsExecuted: 3,
        success: true,
      };
      
      const message = builder.buildWorkflowAlert(variables);

      expect(message.text).toContain('✅');
      expect(message.text).toContain('completed');
      expect(message.text).toContain('Deal Follow-up');
    });
    
    it('should build failed workflow alert', () => {
      const variables: NotificationVariables = {
        workflowId: 'workflow-1',
        workflowName: 'Email Sequence',
        actionsExecuted: 1,
        success: false,
      };
      
      const message = builder.buildWorkflowAlert(variables);

      expect(message.text).toContain('❌');
      expect(message.text).toContain('failed');
    });
  });
  
  describe('buildForecastingAlert', () => {
    it('should build quota at risk alert', () => {
      const variables: NotificationVariables = {
        userId: 'user-1',
        userName: 'Tom Brady',
        quota: 100000,
        attainment: 0.65,
        gap: 35000,
      };
      
      const message = builder.buildForecastingAlert(variables, 'at_risk');
      
      expect(message.text).toContain('Quota At Risk');
      expect(message.text).toContain('Tom Brady');
      expect(message.blocks?.some(b => 
        b.fields?.some(f => f.text.includes('$35,000'))
      )).toBe(true);
    });
    
    it('should build quota achieved alert', () => {
      const variables: NotificationVariables = {
        userId: 'user-1',
        userName: 'Lisa Anderson',
        quota: 100000,
        attainment: 1.05,
      };
      
      const message = builder.buildForecastingAlert(variables, 'achieved');
      
      expect(message.text).toContain('Quota Achieved');
      expect(message.text).toContain('Lisa Anderson');
      expect(message.text).toContain('🎉');
    });
  });
  
  describe('buildPlaybookAlert', () => {
    it('should build playbook generated alert', () => {
      const variables: NotificationVariables = {
        playbookId: 'playbook-1',
        playbookName: 'Enterprise Sales Playbook',
        patternsCount: 12,
      };
      
      const message = builder.buildPlaybookAlert(variables);
      
      expect(message.text).toContain('New playbook');
      expect(message.text).toContain('Enterprise Sales Playbook');
      expect(message.blocks?.some(b => 
        b.fields?.some(f => f.text.includes('12'))
      )).toBe(true);
    });
  });
  
  describe('buildSequenceAlert', () => {
    it('should build underperforming sequence alert', () => {
      const variables: NotificationVariables = {
        sequenceId: 'seq-1',
        sequenceName: 'Cold Outreach',
        performanceScore: 35,
      };
      
      const message = builder.buildSequenceAlert(variables, 'underperforming');
      
      expect(message.text).toContain('Underperforming Sequence');
      expect(message.text).toContain('Cold Outreach');
    });
    
    it('should build optimization alert', () => {
      const variables: NotificationVariables = {
        sequenceId: 'seq-1',
        sequenceName: 'Product Demo',
        optimizationCount: 5,
      };
      
      const message = builder.buildSequenceAlert(variables, 'optimization');

      expect(message.text).toContain('Optimization Available');
      // Check blocks for optimization count since it's not in the main text
      expect(message.blocks?.some(b =>
        b.fields?.some(f => f.text?.includes('5'))
      )).toBe(true);

    });
  });
});
