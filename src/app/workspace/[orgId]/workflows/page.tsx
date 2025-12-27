'use client';

/**
 * Workflow List Page
 * Admin page for viewing and managing workflows
 */

import { useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getWorkflows, setWorkflowStatus, deleteWorkflow } from '@/lib/workflows/workflow-service';
import { usePagination } from '@/hooks/usePagination'
import { logger } from '@/lib/logger/logger';;

export default function WorkflowsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  // Fetch function with pagination using service layer
  const fetchWorkflows = useCallback(async (lastDoc?: any) => {
    return await getWorkflows(
      orgId,
      'default',
      undefined,
      { pageSize: 50, lastDoc }
    );
  }, [orgId]);

  const {
    data: workflows,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination({ fetchFn: fetchWorkflows });

  // Initial load
  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDelete = async (workflowId: string) => {
    if (!confirm('Delete this workflow?')) return;
    
    try {
      await deleteWorkflow(orgId, workflowId, 'default');
      await refresh(); // Refresh pagination after delete
    } catch (error) {
      logger.error('Error deleting workflow:', error, { file: 'page.tsx' });
      alert('Failed to delete workflow');
    }
  };

  const handleToggleStatus = async (workflowId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    
    try {
      await setWorkflowStatus(orgId, workflowId, newStatus as any, 'default');
      await refresh(); // Refresh to get updated data
    } catch (error) {
      logger.error('Error updating workflow:', error, { file: 'page.tsx' });
      alert('Failed to update workflow');
    }
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Workflows</h1>
        <button onClick={() => router.push(`/workspace/${orgId}/workflows/new`)} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          + Create Workflow
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-900/20 border border-red-900 rounded-lg text-red-300">
          {error}
        </div>
      )}

      {workflows.length === 0 && !loading ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg">
          <p className="text-gray-400 mb-4">No workflows yet. Create your first automation!</p>
          <button onClick={() => router.push(`/workspace/${orgId}/workflows/new`)} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Create Workflow
          </button>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {workflows.map(workflow => (
              <div key={workflow.id} className="bg-gray-900 rounded-lg p-6 hover:bg-gray-800/50 transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-semibold">{workflow.name}</h3>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${workflow.status === 'active' ? 'bg-green-900 text-green-300' : workflow.status === 'paused' ? 'bg-yellow-900 text-yellow-300' : 'bg-gray-700 text-gray-300'}`}>
                        {workflow.status}
                      </span>
                    </div>
                    {workflow.description && (
                      <p className="text-gray-400 mb-3">{workflow.description}</p>
                    )}
                    <div className="flex gap-4 text-sm text-gray-400">
                      <span>Trigger: {workflow.trigger?.type || 'manual'}</span>
                      <span>•</span>
                      <span>{workflow.actions?.length || 0} actions</span>
                      {workflow.stats && (
                        <>
                          <span>•</span>
                          <span>{workflow.stats.totalRuns || 0} runs</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleToggleStatus(workflow.id, workflow.status)} className={`px-3 py-1.5 rounded text-sm font-medium ${workflow.status === 'active' ? 'bg-yellow-900 text-yellow-300 hover:bg-yellow-800' : 'bg-green-900 text-green-300 hover:bg-green-800'}`}>
                      {workflow.status === 'active' ? 'Pause' : 'Activate'}
                    </button>
                    <button onClick={() => router.push(`/workspace/${orgId}/workflows/${workflow.id}`)} className="px-3 py-1.5 bg-blue-900 text-blue-300 rounded hover:bg-blue-800 text-sm font-medium">
                      Edit
                    </button>
                    <button onClick={() => router.push(`/workspace/${orgId}/workflows/${workflow.id}/runs`)} className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded hover:bg-gray-700 text-sm font-medium">
                      History
                    </button>
                    <button onClick={() => handleDelete(workflow.id)} className="px-3 py-1.5 bg-red-900 text-red-300 rounded hover:bg-red-800 text-sm font-medium">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {(hasMore || loading) && (
            <div className="mt-6 flex justify-center">
              <button
                onClick={loadMore}
                disabled={loading || !hasMore}
                className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Loading...' : hasMore ? `Load More (Showing ${workflows.length})` : 'All loaded'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
