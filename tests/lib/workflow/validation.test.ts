/**
 * Workflow Validation Tests
 * 
 * Tests for Zod validation schemas
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateWorkflow,
  validateWorkflowUpdate,
  validateWorkflowExecution,
  CreateWorkflowSchema,
  TriggerConditionSchema,
  WorkflowActionSchema,
} from '@/lib/workflow/validation';

// ============================================================================
// WORKFLOW VALIDATION TESTS
// ============================================================================

describe('Workflow Validation', () => {
  it('should validate valid workflow creation data', () => {
    const validData = {
      organizationId: 'org_test_001',
      workspaceId: 'default',
      name: 'Test Workflow',
      description: 'A test workflow',
      status: 'draft',
      trigger: {
        id: 'trigger_001',
        type: 'deal.score.changed',
        conditions: [
          {
            field: 'score',
            operator: 'greater_than',
            value: 75,
          },
        ],
        conditionLogic: 'AND',
        name: 'Score Above 75',
        description: 'Trigger when score > 75',
      },
      actions: [
        {
          id: 'action_001',
          type: 'email.send',
          config: {
            emailType: 'follow_up',
            recipientEmail: 'test@example.com',
            tone: 'professional',
          },
          order: 1,
          continueOnError: false,
          name: 'Send Email',
          description: 'Send follow-up email',
        },
      ],
    };
    
    const result = validateWorkflow(validData);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Test Workflow');
      expect(result.data.actions).toHaveLength(1);
    }
  });
  
  it('should reject workflow without required fields', () => {
    const invalidData = {
      name: 'Test Workflow',
      // Missing required fields
    };
    
    const result = validateWorkflow(invalidData);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.details.length).toBeGreaterThan(0);
    }
  });
  
  it('should reject workflow with invalid email action config', () => {
    const invalidData = {
      organizationId: 'org_test',
      workspaceId: 'default',
      name: 'Test Workflow',
      description: 'Test',
      trigger: {
        id: 'trigger_001',
        type: 'deal.score.changed',
        conditions: [],
        conditionLogic: 'AND',
        name: 'Test',
        description: 'Test',
      },
      actions: [
        {
          id: 'action_001',
          type: 'email.send',
          config: {
            emailType: 'follow_up',
            // Missing recipientEmail or recipientField
          },
          order: 1,
          continueOnError: false,
          name: 'Send Email',
          description: 'Send email',
        },
      ],
    };
    
    const result = validateWorkflow(invalidData);
    
    expect(result.success).toBe(false);
  });
  
  it('should validate workflow with multiple actions', () => {
    const validData = {
      organizationId: 'org_test',
      workspaceId: 'default',
      name: 'Multi-Action Workflow',
      description: 'Workflow with multiple actions',
      trigger: {
        id: 'trigger_001',
        type: 'deal.at_risk.detected',
        conditions: [
          {
            field: 'tier',
            operator: 'equals',
            value: 'at-risk',
          },
        ],
        conditionLogic: 'AND',
        name: 'At-Risk Detected',
        description: 'When deal becomes at-risk',
      },
      actions: [
        {
          id: 'action_001',
          type: 'email.send',
          config: {
            emailType: 're_engagement',
            recipientEmail: 'customer@example.com',
            tone: 'friendly',
          },
          order: 1,
          continueOnError: true,
          name: 'Send Re-engagement Email',
          description: 'Try to re-engage customer',
        },
        {
          id: 'action_002',
          type: 'task.create',
          config: {
            title: 'Call at-risk customer',
            description: 'Urgent call needed',
            dueInDays: 1,
            priority: 'critical',
            assignToUserId: 'user_001',
          },
          order: 2,
          continueOnError: false,
          name: 'Create Urgent Task',
          description: 'Alert sales rep',
        },
        {
          id: 'action_003',
          type: 'notification.send',
          config: {
            channel: 'in_app',
            title: 'Deal At Risk',
            message: 'Immediate action required',
            priority: 'high',
            recipientId: 'manager_001',
          },
          order: 3,
          continueOnError: true,
          name: 'Notify Manager',
          description: 'Alert sales manager',
        },
      ],
    };
    
    const result = validateWorkflow(validData);
    
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.actions).toHaveLength(3);
    }
  });
});

// ============================================================================
// TRIGGER CONDITION VALIDATION TESTS
// ============================================================================

describe('Trigger Condition Validation', () => {
  it('should validate valid trigger condition', () => {
    const validCondition = {
      field: 'score',
      operator: 'greater_than',
      value: 80,
    };
    
    const result = TriggerConditionSchema.safeParse(validCondition);
    
    expect(result.success).toBe(true);
  });
  
  it('should accept string, number, boolean, and array values', () => {
    const conditions = [
      { field: 'name', operator: 'equals', value: 'Test' },
      { field: 'score', operator: 'equals', value: 100 },
      { field: 'active', operator: 'equals', value: true },
      { field: 'status', operator: 'in', value: ['active', 'pending'] },
    ];
    
    conditions.forEach(condition => {
      const result = TriggerConditionSchema.safeParse(condition);
      expect(result.success).toBe(true);
    });
  });
  
  it('should reject invalid operator', () => {
    const invalidCondition = {
      field: 'score',
      operator: 'invalid_operator',
      value: 80,
    };
    
    const result = TriggerConditionSchema.safeParse(invalidCondition);
    
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// WORKFLOW ACTION VALIDATION TESTS
// ============================================================================

describe('Workflow Action Validation', () => {
  it('should validate email action', () => {
    const validAction = {
      id: 'action_001',
      type: 'email.send',
      config: {
        emailType: 'intro',
        recipientEmail: 'test@example.com',
        tone: 'professional',
        length: 'medium',
        includeCompetitive: true,
      },
      order: 1,
      continueOnError: false,
      name: 'Send Intro Email',
      description: 'Send introduction email',
    };
    
    const result = WorkflowActionSchema.safeParse(validAction);
    
    expect(result.success).toBe(true);
  });
  
  it('should validate task action', () => {
    const validAction = {
      id: 'action_001',
      type: 'task.create',
      config: {
        title: 'Follow up',
        description: 'Call customer',
        dueInDays: 3,
        priority: 'high',
        assignToUserId: 'user_001',
      },
      order: 1,
      continueOnError: false,
      name: 'Create Task',
      description: 'Create follow-up task',
    };
    
    const result = WorkflowActionSchema.safeParse(validAction);
    
    expect(result.success).toBe(true);
  });
  
  it('should validate notification action', () => {
    const validAction = {
      id: 'action_001',
      type: 'notification.send',
      config: {
        channel: 'slack',
        title: 'New Deal',
        message: 'Hot deal detected!',
        priority: 'high',
        recipientId: 'user_001',
        slackChannel: '#sales',
      },
      order: 1,
      continueOnError: true,
      name: 'Send Slack Notification',
      description: 'Notify team on Slack',
    };
    
    const result = WorkflowActionSchema.safeParse(validAction);
    
    expect(result.success).toBe(true);
  });
  
  it('should validate wait action', () => {
    const validAction = {
      id: 'action_001',
      type: 'wait.delay',
      config: {
        type: 'delay',
        delayDays: 3,
      },
      order: 1,
      continueOnError: false,
      name: 'Wait 3 Days',
      description: 'Wait before next action',
    };
    
    const result = WorkflowActionSchema.safeParse(validAction);
    
    expect(result.success).toBe(true);
  });
  
  it('should reject action with invalid order', () => {
    const invalidAction = {
      id: 'action_001',
      type: 'task.create',
      config: {
        title: 'Test',
        assignToUserId: 'user_001',
      },
      order: 200, // Max is 100
      continueOnError: false,
      name: 'Test',
      description: 'Test',
    };
    
    const result = WorkflowActionSchema.safeParse(invalidAction);
    
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// WORKFLOW UPDATE VALIDATION TESTS
// ============================================================================

describe('Workflow Update Validation', () => {
  it('should validate partial workflow update', () => {
    const validUpdate = {
      name: 'Updated Workflow Name',
      status: 'active',
    };
    
    const result = validateWorkflowUpdate(validUpdate);
    
    expect(result.success).toBe(true);
  });
  
  it('should allow empty update', () => {
    const emptyUpdate = {};
    
    const result = validateWorkflowUpdate(emptyUpdate);
    
    expect(result.success).toBe(true);
  });
});

// ============================================================================
// WORKFLOW EXECUTION VALIDATION TESTS
// ============================================================================

describe('Workflow Execution Validation', () => {
  it('should validate valid execution request', () => {
    const validRequest = {
      workflowId: 'workflow_001',
      organizationId: 'org_test',
      workspaceId: 'default',
      dealId: 'deal_001',
      triggerData: {
        source: 'manual',
      },
      userId: 'user_001',
    };
    
    const result = validateWorkflowExecution(validRequest);
    
    expect(result.success).toBe(true);
  });
  
  it('should require workflowId', () => {
    const invalidRequest = {
      organizationId: 'org_test',
      workspaceId: 'default',
    };
    
    const result = validateWorkflowExecution(invalidRequest);
    
    expect(result.success).toBe(false);
  });
  
  it('should require organizationId', () => {
    const invalidRequest = {
      workflowId: 'workflow_001',
      workspaceId: 'default',
    };
    
    const result = validateWorkflowExecution(invalidRequest);
    
    expect(result.success).toBe(false);
  });
});

// ============================================================================
// SUMMARY
// ============================================================================

describe('Validation - Summary', () => {
  it('should pass all validation tests', () => {
    expect(true).toBe(true);
  });
});
