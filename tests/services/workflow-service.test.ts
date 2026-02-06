/**
 * Workflow Service Tests
 * Integration tests for workflow service layer
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import {
  getWorkflows,
  getWorkflow,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  setWorkflowStatus,
} from '@/lib/workflows/workflow-service';
import { FirestoreService } from '@/lib/db/firestore-service';

describe('WorkflowService', () => {
  const testOrgId = `test-org-${Date.now()}`;
  const testWorkspaceId = 'default';
  let testWorkflowId: string;

  beforeEach(async () => {
    await FirestoreService.set('organizations', testOrgId, {
      id: testOrgId,
      name: 'Test Organization',
    }, false);
  });

  afterEach(async () => {
    if (testWorkflowId) {
      try {
        await deleteWorkflow(testWorkflowId, testWorkspaceId);
      } catch (error) {
        // Ignore
      }
    }
  });

  describe('createWorkflow', () => {
    it('should create a new workflow', async () => {
      const workflow = await createWorkflow(
        {
          name: 'Test Workflow',
          description: 'A test workflow',
          trigger: {
            id: 'trigger-1',
            type: 'manual',
            name: 'Manual Trigger',
            requireConfirmation: false,
          },
          actions: [
            {
              id: 'action-1',
              type: 'delay',
              name: 'Wait 1 hour',
              continueOnError: false,
              duration: {
                value: 1,
                unit: 'hours',
              },
            },
          ],
          status: 'draft',
          conditions: [],
          settings: {
            stopOnError: false,
            queueStrategy: 'sequential',
          },
          permissions: {
            canView: ['owner', 'admin'],
            canEdit: ['owner', 'admin'],
            canExecute: ['owner', 'admin', 'member'],
          },
        },
        'test-user',
        testWorkspaceId
      );
      testWorkflowId = workflow.id;

      expect(workflow.id).toBeDefined();
      expect(workflow.name).toBe('Test Workflow');
      expect(workflow.status).toBe('draft');
      expect(workflow.stats?.totalRuns).toBe(0);
      expect(workflow.version).toBe(1);
    });
  });

  describe('setWorkflowStatus', () => {
    it('should activate workflow', async () => {
      const workflow = await createWorkflow(
        {
          name: 'Activatable Workflow',
          trigger: { id: 't1', type: 'manual', name: 'Manual', requireConfirmation: false },
          actions: [],
          status: 'draft',
          conditions: [],
          settings: { stopOnError: false },
          permissions: { canView: ['owner'], canEdit: ['owner'], canExecute: ['owner'] },
        },
        'test-user',
        testWorkspaceId
      );
      testWorkflowId = workflow.id;

      const activated = await setWorkflowStatus(workflow.id, 'active', testWorkspaceId);

      expect(activated.status).toBe('active');
    });

    it('should pause workflow', async () => {
      const workflow = await createWorkflow(
        {
          name: 'Pausable Workflow',
          trigger: { id: 't1', type: 'manual', name: 'Manual', requireConfirmation: false },
          actions: [],
          status: 'active',
          conditions: [],
          settings: { stopOnError: false },
          permissions: { canView: ['owner'], canEdit: ['owner'], canExecute: ['owner'] },
        },
        'test-user',
        testWorkspaceId
      );
      testWorkflowId = workflow.id;

      const paused = await setWorkflowStatus(workflow.id, 'paused', testWorkspaceId);

      expect(paused.status).toBe('paused');
    });
  });

  describe('getWorkflows with filters', () => {
    it('should filter workflows by status', async () => {
      const active = await createWorkflow(
        {
          name: 'Active Workflow',
          trigger: { id: 't1', type: 'manual', name: 'Manual', requireConfirmation: false },
          actions: [],
          status: 'active',
          conditions: [],
          settings: { stopOnError: false },
          permissions: { canView: ['owner'], canEdit: ['owner'], canExecute: ['owner'] },
        },
        'test-user',
        testWorkspaceId
      );

      const draft = await createWorkflow(
        {
          name: 'Draft Workflow',
          trigger: { id: 't2', type: 'manual', name: 'Manual', requireConfirmation: false },
          actions: [],
          status: 'draft',
          conditions: [],
          settings: { stopOnError: false },
          permissions: { canView: ['owner'], canEdit: ['owner'], canExecute: ['owner'] },
        },
        'test-user',
        testWorkspaceId
      );

      const result = await getWorkflows(testWorkspaceId, { status: 'active' });

      expect(result.data.some(w => w.id === active.id)).toBe(true);
      expect(result.data.every(w => w.status === 'active')).toBe(true);

      await deleteWorkflow(active.id, testWorkspaceId);
      await deleteWorkflow(draft.id, testWorkspaceId);
    });
  });
});




