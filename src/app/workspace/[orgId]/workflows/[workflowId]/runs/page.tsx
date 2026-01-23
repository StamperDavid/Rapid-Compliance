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
  const orgId = params.orgId as string;
  const workflowId = params.workflowId as string;

  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [loading, setLoading] = useState(true);

  const loadExecutions = useCallback(async () => {
    try {
      const data = await getWorkflowExecutions(workflowId, orgId, 'default');
      setExecutions(data as WorkflowExecution[]);
    } catch (error) {
      logger.error('Error loading executions:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [workflowId, orgId]);

  useEffect(() => {
    void loadExecutions();
  }, [loadExecutions]);

  if (loading) {return <div className="p-8">Loading...</div>;}

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Workflow Execution History</h1>

      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800">
            <tr>
              <th className="text-left p-4">Started</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Actions</th>
              <th className="text-left p-4">Duration</th>
              <th className="text-left p-4">Details</th>
            </tr>
          </thead>
          <tbody>
            {executions.map(execution => (
              <tr key={execution.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                <td className="p-4">{new Date(execution.startedAt).toLocaleString()}</td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs ${execution.status === 'completed' ? 'bg-green-900 text-green-300' : execution.status === 'failed' ? 'bg-red-900 text-red-300' : 'bg-yellow-900 text-yellow-300'}`}>
                    {execution.status}
                  </span>
                </td>
                <td className="p-4 text-gray-400">
                  {execution.actionResults?.filter((a) => a.status === 'success').length ?? 0} / {execution.actionResults?.length ?? 0}
                </td>
                <td className="p-4 text-gray-400">
                  {execution.completedAt ? `${Math.round((new Date(execution.completedAt).getTime() - new Date(execution.startedAt).getTime()) / 1000)}s` : '-'}
                </td>
                <td className="p-4">
                  {execution.error && <span className="text-red-400 text-sm">{execution.error}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}




