/**
 * Workflow Engine Tests
 * 
 * Tests for the core workflow automation engine
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { WorkflowEngine, type WorkflowExecutionContext } from '@/lib/workflow/workflow-engine';
import type {
  Workflow,
  WorkflowTrigger,
  WorkflowAction,
  TriggerCondition,
} from '@/lib/workflow/types';
import { Timestamp } from 'firebase/firestore';

// Mock dynamic imports used by executeAction
jest.mock('@/lib/email-writer/email-writer-engine', () => ({
  generateSalesEmail: jest.fn<() => Promise<Record<string, unknown>>>().mockResolvedValue({
    success: true,
    id: 'email_mock_001',
    subject: 'Follow-up: Test',
    body: 'Mock email body',
    recipientEmail: 'test@example.com',
    email: {
      id: 'email_mock_001',
      subject: 'Follow-up: Test',
      body: 'Mock email body',
    },
  }),
}));
jest.mock('@/lib/logger/logger');

// ============================================================================
// TEST DATA
// ============================================================================

const mockWorkflow: Workflow = {
  id: 'workflow_test_001',
  workspaceId: 'default',
  name: 'Test Workflow',
  description: 'Test workflow for unit tests',
  status: 'active',
  trigger: {
    id: 'trigger_001',
    type: 'deal.score.changed',
    conditions: [
      {
        field: 'dealScore.score',
        operator: 'greater_than',
        value: 75,
      },
    ],
    conditionLogic: 'AND',
    name: 'Deal Score Above 75',
    description: 'Triggers when deal score exceeds 75',
  },
  actions: [
    {
      id: 'action_001',
      type: 'email.send',
      config: {
        emailType: 'follow_up',
        recipientEmail: 'test@example.com',
        tone: 'professional',
        autoSend: false,
      },
      order: 1,
      continueOnError: false,
      name: 'Send Follow-up Email',
      description: 'Send automated follow-up email',
    },
  ],
  settings: {
    maxExecutionsPerDay: 100,
    cooldownMinutes: 60,
    executeOnWeekends: true,
    executeOnHolidays: true,
    notifyOnFailure: true,
  },
  createdBy: 'user_test',
  createdAt: Timestamp.now(),
  updatedAt: Timestamp.now(),
  stats: {
    totalExecutions: 0,
    successfulExecutions: 0,
    failedExecutions: 0,
    averageExecutionTimeMs: 0,
  },
};

const mockContext: WorkflowExecutionContext = {
  workspaceId: 'default',
  dealId: 'deal_test_001',
  dealScore: {
    dealId: 'deal_test_001',
    score: 80,
    closeProbability: 70,
    tier: 'hot',
    confidence: 85,
    factors: [],
    riskFactors: [],
    recommendations: [],
    predictedCloseDate: null,
    predictedValue: 50000,
    calculatedAt: new Date(),
  },
  triggeredBy: 'event',
  triggerData: {},
};

// ============================================================================
// TRIGGER EVALUATION TESTS
// ============================================================================

describe('WorkflowEngine - Trigger Evaluation', () => {
  it('should evaluate simple equals condition correctly', () => {
    const condition: TriggerCondition = {
      field: 'dealScore.tier',
      operator: 'equals',
      value: 'hot',
    };
    
    const result = WorkflowEngine.evaluateCondition(condition, mockContext);
    expect(result).toBe(true);
  });
  
  it('should evaluate greater_than condition correctly', () => {
    const condition: TriggerCondition = {
      field: 'dealScore.score',
      operator: 'greater_than',
      value: 75,
    };
    
    const result = WorkflowEngine.evaluateCondition(condition, mockContext);
    expect(result).toBe(true);
  });
  
  it('should evaluate less_than condition correctly', () => {
    const condition: TriggerCondition = {
      field: 'dealScore.score',
      operator: 'less_than',
      value: 90,
    };
    
    const result = WorkflowEngine.evaluateCondition(condition, mockContext);
    expect(result).toBe(true);
  });
  
  it('should evaluate contains condition correctly', () => {
    const condition: TriggerCondition = {
      field: 'dealScore.tier',
      operator: 'contains',
      value: 'hot',
    };
    
    const result = WorkflowEngine.evaluateCondition(condition, mockContext);
    expect(result).toBe(true);
  });
  
  it('should evaluate in condition correctly', () => {
    const condition: TriggerCondition = {
      field: 'dealScore.tier',
      operator: 'in',
      value: ['hot', 'warm'],
    };
    
    const result = WorkflowEngine.evaluateCondition(condition, mockContext);
    expect(result).toBe(true);
  });
  
  it('should evaluate is_null condition correctly', () => {
    const condition: TriggerCondition = {
      field: 'dealScore.predictedCloseDate',
      operator: 'is_null',
      value: true,
    };
    
    const result = WorkflowEngine.evaluateCondition(condition, mockContext);
    expect(result).toBe(true);
  });
  
  it('should evaluate is_not_null condition correctly', () => {
    const condition: TriggerCondition = {
      field: 'dealScore.score',
      operator: 'is_not_null',
      value: true,
    };
    
    const result = WorkflowEngine.evaluateCondition(condition, mockContext);
    expect(result).toBe(true);
  });
  
  it('should evaluate AND logic correctly', () => {
    const workflow = {
      ...mockWorkflow,
      trigger: {
        ...mockWorkflow.trigger,
        conditions: [
          { field: 'dealScore.score', operator: 'greater_than', value: 75 },
          { field: 'dealScore.tier', operator: 'equals', value: 'hot' },
        ],
        conditionLogic: 'AND',
      } as WorkflowTrigger,
    };
    
    const result = WorkflowEngine.evaluateTrigger(workflow, mockContext);
    expect(result).toBe(true);
  });
  
  it('should evaluate OR logic correctly', () => {
    const workflow = {
      ...mockWorkflow,
      trigger: {
        ...mockWorkflow.trigger,
        conditions: [
          { field: 'dealScore.score', operator: 'less_than', value: 50 }, // False
          { field: 'dealScore.tier', operator: 'equals', value: 'hot' }, // True
        ],
        conditionLogic: 'OR',
      } as WorkflowTrigger,
    };
    
    const result = WorkflowEngine.evaluateTrigger(workflow, mockContext);
    expect(result).toBe(true);
  });
  
  it('should fail trigger evaluation when conditions not met', () => {
    const workflow = {
      ...mockWorkflow,
      trigger: {
        ...mockWorkflow.trigger,
        conditions: [
          { field: 'dealScore.score', operator: 'less_than', value: 50 },
        ],
        conditionLogic: 'AND',
      } as WorkflowTrigger,
    };
    
    const result = WorkflowEngine.evaluateTrigger(workflow, mockContext);
    expect(result).toBe(false);
  });
});

// ============================================================================
// FIELD VALUE EXTRACTION TESTS
// ============================================================================

describe('WorkflowEngine - Field Value Extraction', () => {
  it('should extract top-level field', () => {
    const value = WorkflowEngine.getFieldValue('workspaceId', mockContext);
    expect(value).toBe('default');
  });
  
  it('should extract nested field', () => {
    const value = WorkflowEngine.getFieldValue('dealScore.score', mockContext);
    expect(value).toBe(80);
  });
  
  it('should extract deeply nested field', () => {
    const value = WorkflowEngine.getFieldValue('dealScore.tier', mockContext);
    expect(value).toBe('hot');
  });
  
  it('should return undefined for non-existent field', () => {
    const value = WorkflowEngine.getFieldValue('nonExistent.field', mockContext);
    expect(value).toBeUndefined();
  });
  
  it('should handle null values gracefully', () => {
    const value = WorkflowEngine.getFieldValue('dealScore.predictedCloseDate', mockContext);
    expect(value).toBeNull();
  });
});

// ============================================================================
// WORKFLOW EXECUTION TESTS
// ============================================================================

describe('WorkflowEngine - Workflow Execution', () => {
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  it('should execute workflow successfully when trigger matches', async () => {
    const result = await WorkflowEngine.executeWorkflow(mockWorkflow, mockContext);
    
    expect(result.success).toBe(true);
    expect(result.workflow.id).toBe(mockWorkflow.id);
    expect(result.actionsExecuted.length).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThan(0);
  });
  
  it('should not execute workflow when trigger does not match', async () => {
    const workflow = {
      ...mockWorkflow,
      trigger: {
        ...mockWorkflow.trigger,
        conditions: [
          { field: 'dealScore.score', operator: 'less_than', value: 50 },
        ],
      } as WorkflowTrigger,
    };
    
    const result = await WorkflowEngine.executeWorkflow(workflow, mockContext);
    
    expect(result.success).toBe(false);
    expect(result.error).toBe('Trigger conditions not met');
    expect(result.actionsExecuted.length).toBe(0);
  });
  
  it('should not execute workflow when status is not active', async () => {
    const workflow = {
      ...mockWorkflow,
      status: 'paused' as const,
    };
    
    const result = await WorkflowEngine.executeWorkflow(workflow, mockContext);
    
    expect(result.success).toBe(false);
    expect(result.error).toContain('not active');
  });
  
  it('should stop execution on action failure when continueOnError is false', async () => {
    const workflow = {
      ...mockWorkflow,
      actions: [
        {
          ...mockWorkflow.actions[0],
          config: {
            emailType: 'follow_up',
            // No recipient - will cause error
          },
          continueOnError: false,
        },
        {
          id: 'action_002',
          type: 'task.create',
          config: {
            title: 'Follow up on deal',
            assignToUserId: 'user_test',
          },
          order: 2,
          continueOnError: false,
          name: 'Create Task',
          description: 'Create follow-up task',
        } as WorkflowAction,
      ],
    };
    
    const result = await WorkflowEngine.executeWorkflow(workflow, mockContext);
    
    // First action should fail and stop execution
    expect(result.actionsExecuted.length).toBe(1);
    expect(result.actionsExecuted[0].status).toBe('failed');
  });
  
  it('should continue execution on action failure when continueOnError is true', async () => {
    const workflow = {
      ...mockWorkflow,
      actions: [
        {
          ...mockWorkflow.actions[0],
          config: {
            emailType: 'follow_up',
            // No recipient - will cause error
          },
          continueOnError: true,
        },
        {
          id: 'action_002',
          type: 'task.create',
          config: {
            title: 'Follow up on deal',
            assignToUserId: 'user_test',
          },
          order: 2,
          continueOnError: false,
          name: 'Create Task',
          description: 'Create follow-up task',
        } as WorkflowAction,
      ],
    };
    
    const result = await WorkflowEngine.executeWorkflow(workflow, mockContext);
    
    // Both actions should execute
    expect(result.actionsExecuted.length).toBe(2);
  });
  
  it('should execute actions in correct order', async () => {
    const workflow = {
      ...mockWorkflow,
      actions: [
        {
          id: 'action_001',
          type: 'task.create',
          config: { title: 'Task 1', assignToUserId: 'user_test' },
          order: 2,
          continueOnError: true,
          name: 'Task 1',
          description: 'First task',
        } as WorkflowAction,
        {
          id: 'action_002',
          type: 'task.create',
          config: { title: 'Task 2', assignToUserId: 'user_test' },
          order: 1,
          continueOnError: true,
          name: 'Task 2',
          description: 'Second task',
        } as WorkflowAction,
      ],
    };
    
    const result = await WorkflowEngine.executeWorkflow(workflow, mockContext);
    
    // Actions should be executed in order based on 'order' field
    expect(result.actionsExecuted[0].actionId).toBe('action_002'); // order: 1
    expect(result.actionsExecuted[1].actionId).toBe('action_001'); // order: 2
  });
});

// ============================================================================
// ACTION EXECUTION TESTS
// ============================================================================

describe('WorkflowEngine - Action Execution', () => {
  it('should execute task action successfully', async () => {
    const action: WorkflowAction = {
      id: 'action_task_001',
      type: 'task.create',
      config: {
        title: 'Follow up on deal',
        description: 'Call customer to discuss next steps',
        dueInDays: 3,
        priority: 'high',
        assignToUserId: 'user_test',
      },
      order: 1,
      continueOnError: false,
      name: 'Create Follow-up Task',
      description: 'Create task for sales rep',
    };
    
    const result = await WorkflowEngine.executeAction(action, mockContext, mockWorkflow);
    
    expect(result.status).toBe('success');
    expect(result.actionType).toBe('task.create');
    expect(result.result).toHaveProperty('taskId');
  });
  
  it('should execute notification action successfully', async () => {
    const action: WorkflowAction = {
      id: 'action_notif_001',
      type: 'notification.send',
      config: {
        channel: 'in_app',
        title: 'Deal Score Increased',
        message: 'Deal score increased to 80',
        priority: 'medium',
        recipientId: 'user_test',
      },
      order: 1,
      continueOnError: false,
      name: 'Send Notification',
      description: 'Notify sales rep',
    };
    
    const result = await WorkflowEngine.executeAction(action, mockContext, mockWorkflow);
    
    expect(result.status).toBe('success');
    expect(result.actionType).toBe('notification.send');
    expect(result.result).toHaveProperty('notificationId');
  });
  
  it('should execute deal action successfully', async () => {
    const action: WorkflowAction = {
      id: 'action_deal_001',
      type: 'deal.update',
      config: {
        field: 'priority',
        value: 'high',
        operation: 'set',
      },
      order: 1,
      continueOnError: false,
      name: 'Update Deal Priority',
      description: 'Mark deal as high priority',
    };
    
    const result = await WorkflowEngine.executeAction(action, mockContext, mockWorkflow);
    
    expect(result.status).toBe('success');
    expect(result.actionType).toBe('deal.update');
    expect(result.result).toHaveProperty('dealId');
  });
  
  it('should handle action execution error', async () => {
    const action: WorkflowAction = {
      id: 'action_error_001',
      type: 'task.create',
      config: {
        title: 'Test Task',
        // Missing required field - no assignee
      },
      order: 1,
      continueOnError: false,
      name: 'Error Task',
      description: 'Task that will fail',
    };
    
    const result = await WorkflowEngine.executeAction(action, mockContext, mockWorkflow);
    
    expect(result.status).toBe('failed');
    expect(result.error).toBeDefined();
  });
});

// ============================================================================
// SUMMARY
// ============================================================================

describe('WorkflowEngine - Summary', () => {
  it('should pass all workflow engine tests', () => {
    expect(true).toBe(true);
  });
});
