/**
 * Workflow Executions Service
 *
 * Thin Firestore-only read layer for workflow execution history. Lives
 * apart from workflow-engine.ts so that the dashboard /workflows/[id]/runs
 * page can import getWorkflowExecutions WITHOUT pulling the rest of the
 * engine (which transitively imports schedule-trigger →
 * google-calendar-service → googleapis). Keeping this file dependency-light
 * is what makes that page bundle for the client at all.
 */

import { where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import type { WorkflowTriggerData } from '@/types/workflow';

export interface WorkflowEngineExecution {
  id: string;
  workflowId: string;
  triggerId: string;
  triggerData: WorkflowTriggerData;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  actionResults: Array<{
    actionId: string;
    status: 'success' | 'failed' | 'skipped';
    result?: unknown;
    error?: string;
  }>;
}

interface FirestoreWorkflowEngineExecution {
  id: string;
  workflowId: string;
  triggerId: string;
  triggerData: WorkflowTriggerData;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  error?: string;
  actionResults: Array<{
    actionId: string;
    status: 'success' | 'failed' | 'skipped';
    result?: unknown;
    error?: string;
  }>;
}

/**
 * Get workflow execution history. Queries Firestore for historical
 * workflow executions, newest first, capped at `limit`.
 */
export async function getWorkflowExecutions(
  workflowId: string,
  limit = 50,
): Promise<WorkflowEngineExecution[]> {
  const { getSubCollection } = await import('@/lib/firebase/collections');
  const { AdminFirestoreService } = await import('@/lib/db/admin-firestore-service');
  const executions = await AdminFirestoreService.getAll(
    getSubCollection('workflowExecutions'),
    [
      where('workflowId', '==', workflowId),
      orderBy('startedAt', 'desc'),
      firestoreLimit(limit),
    ],
  );

  return executions.map((e): WorkflowEngineExecution => {
    const firestoreExec = e as unknown as FirestoreWorkflowEngineExecution;
    return {
      ...firestoreExec,
      status: firestoreExec.status,
      startedAt: new Date(firestoreExec.startedAt),
      completedAt: firestoreExec.completedAt ? new Date(firestoreExec.completedAt) : undefined,
      actionResults: firestoreExec.actionResults.map((ar) => ({
        ...ar,
        status: ar.status,
      })),
    };
  });
}
