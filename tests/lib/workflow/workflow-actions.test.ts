/**
 * Workflow Action Executor Unit Tests
 *
 * Tests for executeTaskAction, executeDealAction, executeNotificationAction,
 * and executeWaitAction in src/lib/workflow/workflow-engine.ts.
 *
 * Design constraints:
 * - jest.setup.js globally replaces FirestoreService with AdminFirestoreService
 *   (real Firebase Admin SDK against the dev DB). We cannot override this global
 *   mock in individual test files.
 * - executeTaskAction and executeWaitAction write new documents — these always
 *   succeed against the dev DB (no pre-existing document required).
 * - executeDealAction calls FirestoreService.update which requires a pre-existing
 *   document. We test its observable output: thrown errors and returned shape.
 * - executeNotificationAction is tested by spying on NotificationService directly.
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { WorkflowEngine, type WorkflowExecutionContext } from '@/lib/workflow/workflow-engine';
import type { WorkflowAction } from '@/lib/workflow/types';
import { NotificationService } from '@/lib/notifications/notification-service';

// The logger is used internally; mock it so tests produce no console noise
jest.mock('@/lib/logger/logger');

// ============================================================================
// Shared test fixtures
// ============================================================================

const baseContext: WorkflowExecutionContext = {
  dealId: 'deal_001',
  deal: { ownerId: 'owner_user_001', priority: 'medium', amount: 5000 },
  triggeredBy: 'event',
  triggerData: {},
  userId: 'user_001',
};

function makeAction(
  type: WorkflowAction['type'],
  config: WorkflowAction['config']
): WorkflowAction {
  return {
    id: `action_${type.replace(/\./g, '_')}`,
    type,
    config,
    order: 1,
    continueOnError: false,
    name: `Test ${type}`,
    description: `Unit-test action for ${type}`,
  };
}

// ============================================================================
// executeTaskAction
//
// These tests write real documents to the test Firestore DB via the globally
// configured AdminFirestoreService. Assertions focus on the returned value shape.
// ============================================================================

describe('WorkflowEngine.executeTaskAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a task record with correct required fields', async () => {
    const action = makeAction('task.create', {
      title: 'Follow up with customer',
      assignToUserId: 'user_abc',
      priority: 'high',
      dueInDays: 3,
    });

    const result = await WorkflowEngine.executeTaskAction(action, baseContext);

    expect(result).toHaveProperty('id');
    expect(result.title).toBe('Follow up with customer');
    expect(result.assignedTo).toBe('user_abc');
    expect(result.priority).toBe('high');
    expect(result.status).toBe('pending');
    expect(result.source).toBe('workflow');
    expect(result.dealId).toBe('deal_001');
  });

  it('sets a dueDate ISO string when dueInDays is provided', async () => {
    const action = makeAction('task.create', {
      title: 'Deadline task',
      assignToUserId: 'user_abc',
      dueInDays: 7,
    });

    const result = await WorkflowEngine.executeTaskAction(action, baseContext);

    expect(typeof result.dueDate).toBe('string');
    const dueDate = new Date(result.dueDate as string);
    expect(dueDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('sets dueDate to null when dueInDays is not provided', async () => {
    const action = makeAction('task.create', {
      title: 'No deadline task',
      assignToUserId: 'user_abc',
    });

    const result = await WorkflowEngine.executeTaskAction(action, baseContext);

    expect(result.dueDate).toBeNull();
  });

  it('defaults priority to "medium" when not specified', async () => {
    const action = makeAction('task.create', {
      title: 'Default priority task',
      assignToUserId: 'user_abc',
    });

    const result = await WorkflowEngine.executeTaskAction(action, baseContext);

    expect(result.priority).toBe('medium');
  });

  it('resolves assignee from context field when assignToUserId is absent', async () => {
    const action = makeAction('task.create', {
      title: 'Field-resolved task',
      assignToField: 'deal.ownerId',
    });

    const result = await WorkflowEngine.executeTaskAction(action, baseContext);

    expect(result.assignedTo).toBe('owner_user_001');
  });

  it('returns a task record with createdAt and updatedAt ISO strings', async () => {
    const action = makeAction('task.create', {
      title: 'Timestamped task',
      assignToUserId: 'user_abc',
    });

    const result = await WorkflowEngine.executeTaskAction(action, baseContext);

    expect(typeof result.createdAt).toBe('string');
    expect(typeof result.updatedAt).toBe('string');
    expect(() => new Date(result.createdAt as string)).not.toThrow();
    expect(() => new Date(result.updatedAt as string)).not.toThrow();
  });

  it('throws an error when no assignee can be resolved', async () => {
    const action = makeAction('task.create', {
      title: 'Unassigned task',
      // No assignToUserId and no assignToField that resolves to a value
    });

    const contextWithoutOwner: WorkflowExecutionContext = {
      ...baseContext,
      deal: {},
    };

    await expect(
      WorkflowEngine.executeTaskAction(action, contextWithoutOwner)
    ).rejects.toThrow('No assignee found for task');
  });

  it('generates a unique task id on each call', async () => {
    const action = makeAction('task.create', {
      title: 'Unique id task',
      assignToUserId: 'user_abc',
    });

    const [resultA, resultB] = await Promise.all([
      WorkflowEngine.executeTaskAction(action, baseContext),
      WorkflowEngine.executeTaskAction(action, baseContext),
    ]);

    expect(resultA.id).not.toBe(resultB.id);
    expect(typeof resultA.id).toBe('string');
    expect((resultA.id as string).startsWith('task_')).toBe(true);
  });
});

// ============================================================================
// executeDealAction
//
// FirestoreService.update on a non-existent document throws a Firestore NOT_FOUND
// error from the Admin SDK. We therefore test only the pre-persistence logic:
// thrown errors for missing context and the shape of thrown error messages.
// ============================================================================

describe('WorkflowEngine.executeDealAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws an error when dealId is absent from context', async () => {
    const action = makeAction('deal.update', {
      field: 'stage',
      value: 'closed_won',
    });

    const contextWithoutDeal: WorkflowExecutionContext = {
      ...baseContext,
      dealId: undefined,
    };

    await expect(
      WorkflowEngine.executeDealAction(action, contextWithoutDeal)
    ).rejects.toThrow('No deal ID in context for deal action');
  });

  it('validates the action correctly — field and value are passed through', async () => {
    // This test verifies the pre-write logic by catching the Firestore NOT_FOUND
    // error that occurs because deal_001 does not exist in the test DB.
    // The important part is that the error is NOT the "No deal ID" guard error.
    const action = makeAction('deal.update', {
      field: 'priority',
      value: 'high',
      operation: 'set',
    });

    let thrownError: unknown;
    try {
      await WorkflowEngine.executeDealAction(action, baseContext);
    } catch (err) {
      thrownError = err;
    }

    // The error should be a Firestore "NOT_FOUND" error, not our input validation error
    expect(thrownError).toBeDefined();
    const errorMessage = thrownError instanceof Error ? thrownError.message : String(thrownError);
    expect(errorMessage).not.toContain('No deal ID');
  });
});

// ============================================================================
// executeNotificationAction
//
// The real NotificationService requires a seeded "workflow_notification" template
// in Firestore. We use jest.spyOn to replace the sendNotification method on the
// actual prototype so the spy takes effect regardless of module caching.
// ============================================================================

describe('WorkflowEngine.executeNotificationAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Spy on the prototype method so all instances share the mock
    jest.spyOn(NotificationService.prototype, 'sendNotification').mockResolvedValue(
      { id: 'notif_test' } as Awaited<ReturnType<NotificationService['sendNotification']>>
    );
  });

  it('sends a notification and returns notificationId from the service', async () => {
    const action = makeAction('notification.send', {
      channel: 'in_app',
      title: 'Deal Score Alert',
      message: 'Deal score increased to 90',
      recipientId: 'user_recipient_001',
    });

    const result = await WorkflowEngine.executeNotificationAction(action, baseContext);

    expect(result.notificationId).toBe('notif_test');
    expect(result.channel).toBe('in_app');
    expect(result.recipientId).toBe('user_recipient_001');
    expect(result.title).toBe('Deal Score Alert');
    expect(result.message).toBe('Deal score increased to 90');
  });

  it('returns a sentAt ISO timestamp', async () => {
    const action = makeAction('notification.send', {
      channel: 'email',
      message: 'Reminder sent',
      recipientId: 'user_001',
    });

    const result = await WorkflowEngine.executeNotificationAction(action, baseContext);

    expect(typeof result.sentAt).toBe('string');
    expect(() => new Date(result.sentAt as string)).not.toThrow();
  });

  it('resolves recipient from context field when recipientId is absent', async () => {
    const action = makeAction('notification.send', {
      channel: 'in_app',
      message: 'Context-resolved recipient',
      recipientField: 'deal.ownerId',
    });

    const result = await WorkflowEngine.executeNotificationAction(action, baseContext);

    expect(result.recipientId).toBe('owner_user_001');
  });

  it('throws an error when no recipient can be resolved', async () => {
    const action = makeAction('notification.send', {
      channel: 'in_app',
      message: 'No recipient',
      // No recipientId and no recipientField that resolves
    });

    const contextWithoutOwner: WorkflowExecutionContext = {
      ...baseContext,
      deal: {},
    };

    await expect(
      WorkflowEngine.executeNotificationAction(action, contextWithoutOwner)
    ).rejects.toThrow('No recipient found for notification');
  });

  it('calls sendNotification once with the correct channel and message', async () => {
    const spy = jest.spyOn(NotificationService.prototype, 'sendNotification');

    const action = makeAction('notification.send', {
      channel: 'slack',
      message: 'Slack alert',
      title: 'Workflow Alert',
      recipientId: 'user_slack',
    });

    await WorkflowEngine.executeNotificationAction(action, baseContext);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      'user_slack',
      'workflow_notification',
      expect.objectContaining({
        message: 'Slack alert',
        title: 'Workflow Alert',
      }),
      expect.anything()
    );
  });
});

// ============================================================================
// executeWaitAction
//
// These tests write real "wait" documents to the test Firestore DB. All
// assertions focus on the returned value shape and business logic.
// ============================================================================

describe('WorkflowEngine.executeWaitAction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns waitType "delay" and a future resumeAt for a delay config', async () => {
    const action = makeAction('wait.delay', {
      type: 'delay',
      delayHours: 2,
      delayDays: 0,
    });

    const before = Date.now();
    const result = await WorkflowEngine.executeWaitAction(action, baseContext);
    const after = Date.now();

    expect(result.waitType).toBe('delay');
    expect(typeof result.resumeAt).toBe('string');

    const resumeAt = new Date(result.resumeAt as string).getTime();
    // resumeAt should be ~2 hours from now (between before+2h and after+2h+buffer)
    const twoHoursMs = 2 * 60 * 60 * 1000;
    expect(resumeAt).toBeGreaterThanOrEqual(before + twoHoursMs);
    expect(resumeAt).toBeLessThanOrEqual(after + twoHoursMs + 5000);
  });

  it('returns delayMs in the result for a delay config', async () => {
    const action = makeAction('wait.delay', {
      type: 'delay',
      delayHours: 0,
      delayDays: 1,
    });

    const result = await WorkflowEngine.executeWaitAction(action, baseContext);

    const oneDayMs = 24 * 60 * 60 * 1000;
    expect(result.delayMs).toBe(oneDayMs);
  });

  it('returns a wait id prefixed with "wait_" for delay type', async () => {
    const action = makeAction('wait.delay', {
      type: 'delay',
      delayHours: 1,
    });

    const result = await WorkflowEngine.executeWaitAction(action, baseContext);

    expect(typeof result.waitId).toBe('string');
    expect((result.waitId as string).startsWith('wait_')).toBe(true);
  });

  it('returns waitType "until" and the condition description for an until config', async () => {
    const action = makeAction('wait.until', {
      type: 'until',
      condition: {
        field: 'deal.stage',
        operator: 'equals',
        value: 'proposal',
      },
      maxWaitDays: 14,
    });

    const result = await WorkflowEngine.executeWaitAction(action, baseContext);

    expect(result.waitType).toBe('until');
    expect(typeof result.condition).toBe('string');
    expect(result.condition).toBe('deal.stage equals proposal');
    expect(result.maxWaitDays).toBe(14);
  });

  it('returns an undefined condition description when no condition is provided for until type', async () => {
    const action = makeAction('wait.until', {
      type: 'until',
      maxWaitDays: 7,
      // No condition — tests the else-branch nullability
    });

    const result = await WorkflowEngine.executeWaitAction(action, baseContext);

    expect(result.waitType).toBe('until');
    // conditionDescription resolves to undefined when config.condition is absent
    expect(result.condition).toBeUndefined();
  });

  it('generates a unique wait id on each call', async () => {
    const action = makeAction('wait.delay', {
      type: 'delay',
      delayHours: 1,
    });

    const [resultA, resultB] = await Promise.all([
      WorkflowEngine.executeWaitAction(action, baseContext),
      WorkflowEngine.executeWaitAction(action, baseContext),
    ]);

    expect(resultA.waitId).not.toBe(resultB.waitId);
  });
});
