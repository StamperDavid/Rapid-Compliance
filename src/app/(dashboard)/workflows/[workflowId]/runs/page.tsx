'use client';


import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { getWorkflowExecutions } from '@/lib/workflows/workflow-engine'
import { logger } from '@/lib/logger/logger';

interface ActionResult {
  status: string;
  [key: string]: unknown;
}

interface WorkflowExecution {
  id: string;
  startedAt: string;
  completedAt?: string;
  status: string;
  error?: string;
  actionResults?: ActionResult[];
}

export default function WorkflowRunsPage() {
  const params = useParams();
  const workflowId = params.workflowId as string;

  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExecutions = useCallback(async () => {
    try {
      const data = await getWorkflowExecutions(workflowId, 'default');
      // Map WorkflowEngineExecution to WorkflowExecution format
      const mappedExecutions: WorkflowExecution[] = data.map((exec) => ({
        id: exec.id,
        startedAt: exec.startedAt instanceof Date ? exec.startedAt.toISOString() : String(exec.startedAt),
        completedAt: exec.completedAt instanceof Date ? exec.completedAt.toISOString() : exec.completedAt ? String(exec.completedAt) : undefined,
        status: exec.status,
        error: exec.error,
        actionResults: exec.actionResults.map((result) => {
          const { status: _status, ...rest } = result;
          return {
            ...rest,
            status: result.status
          };
        })
      }));
      setExecutions(mappedExecutions);
    } catch (error) {
      logger.error('Error loading executions:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    void loadExecutions();
  }, [loadExecutions]);

  if (loading) {return <div className="p-8 text-[var(--color-text-primary)]">Loading...</div>;}

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6 text-[var(--color-text-primary)]">Workflow Execution History</h1>

      <div className="bg-surface-paper rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-surface-elevated">
            <tr>
              <th className="text-left p-4 text-[var(--color-text-primary)]">Started</th>
              <th className="text-left p-4 text-[var(--color-text-primary)]">Status</th>
              <th className="text-left p-4 text-[var(--color-text-primary)]">Actions</th>
              <th className="text-left p-4 text-[var(--color-text-primary)]">Duration</th>
              <th className="text-left p-4 text-[var(--color-text-primary)]">Details</th>
            </tr>
          </thead>
          <tbody>
            {executions.map(execution => {
              const statusClass = execution.status === 'completed' ? 'text-success' : execution.status === 'failed' ? 'text-error' : 'text-warning';
              const statusBg = execution.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : execution.status === 'failed' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)';

              return (
                <tr key={execution.id} className="border-t border-border-light hover:bg-surface-elevated">
                  <td className="p-4 text-[var(--color-text-primary)]">{new Date(execution.startedAt).toLocaleString()}</td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs ${statusClass}`} style={{ backgroundColor: statusBg }}>
                      {execution.status}
                    </span>
                  </td>
                  <td className="p-4 text-[var(--color-text-secondary)]">
                    {execution.actionResults?.filter((a) => a.status === 'success').length ?? 0} / {execution.actionResults?.length ?? 0}
                  </td>
                  <td className="p-4 text-[var(--color-text-secondary)]">
                    {execution.completedAt ? `${Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)}s` : '-'}
                  </td>
                  <td className="p-4">
                    {execution.error && <span className="text-error text-sm">{execution.error}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}




