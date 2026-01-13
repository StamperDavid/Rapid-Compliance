'use client';

/**
 * Workflow List Page
 * Admin page for viewing and managing workflows
 */

import { useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Workflow,
  Play,
  Pause,
  Settings,
  Trash2,
  Plus,
  Clock,
  Zap,
  AlertCircle,
  FileText
} from 'lucide-react';
import { getWorkflows, setWorkflowStatus, deleteWorkflow } from '@/lib/workflows/workflow-service';
import { usePagination } from '@/hooks/usePagination';
import { logger } from '@/lib/logger/logger';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      ease: [0.25, 0.1, 0.25, 1]
    }
  }
};

export default function WorkflowsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  // Fetch function with pagination using service layer
  const fetchWorkflows = useCallback(async (lastDoc?: any) => {
    return getWorkflows(
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
    if (!confirm('Delete this workflow?')) {return;}

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

  const getStatusBadge = (status: string) => {
    const badges = {
      active: (
        <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-emerald-500/20 to-green-500/20 text-emerald-300 border border-emerald-500/30">
          Active
        </span>
      ),
      paused: (
        <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border border-amber-500/30">
          Paused
        </span>
      ),
      draft: (
        <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-gradient-to-r from-slate-500/20 to-gray-500/20 text-slate-300 border border-slate-500/30">
          Draft
        </span>
      )
    };
    return badges[status as keyof typeof badges] || badges.draft;
  };

  return (
    <div className="min-h-screen bg-black p-8">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 flex items-center justify-center shadow-lg shadow-fuchsia-500/25">
              <Workflow className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Workflows</h1>
              <p className="text-sm text-gray-400 mt-1">Automate your sales processes</p>
            </div>
          </div>
          <motion.button
            onClick={() => router.push(`/workspace/${orgId}/workflows/new`)}
            className="px-6 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-semibold rounded-xl shadow-lg shadow-fuchsia-500/25 flex items-center gap-2 transition-all duration-300"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-5 h-5" />
            Create Workflow
          </motion.button>
        </div>
      </motion.div>

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-red-500/10 backdrop-blur-xl border border-red-500/30 rounded-xl"
        >
          <div className="flex items-center gap-3 text-red-300">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {workflows.length === 0 && !loading ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-16 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 flex items-center justify-center border border-fuchsia-500/30">
            <Workflow className="w-10 h-10 text-fuchsia-400" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">No workflows yet</h3>
          <p className="text-gray-400 mb-6">Create your first automation to get started</p>
          <motion.button
            onClick={() => router.push(`/workspace/${orgId}/workflows/new`)}
            className="px-8 py-3 bg-gradient-to-r from-fuchsia-600 to-pink-600 hover:from-fuchsia-500 hover:to-pink-500 text-white font-semibold rounded-xl shadow-lg shadow-fuchsia-500/25 inline-flex items-center gap-2 transition-all duration-300"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-5 h-5" />
            Create Workflow
          </motion.button>
        </motion.div>
      ) : (
        <>
          {/* Workflow Cards */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid gap-4"
          >
            {workflows.map((workflow) => (
              <motion.div
                key={workflow.id}
                variants={itemVariants}
                className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 group"
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Title and Status */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-fuchsia-500/20 to-pink-500/20 flex items-center justify-center border border-fuchsia-500/30">
                        <Workflow className="w-5 h-5 text-fuchsia-400" />
                      </div>
                      <h3 className="text-xl font-semibold text-white group-hover:text-fuchsia-300 transition-colors">
                        {workflow.name}
                      </h3>
                      {getStatusBadge(workflow.status)}
                    </div>

                    {/* Description */}
                    {workflow.description && (
                      <p className="text-gray-400 mb-4 ml-13">{workflow.description}</p>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-6 text-sm text-gray-400 ml-13">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        <span>Trigger: {workflow.trigger?.type || 'manual'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{workflow.actions?.length || 0} actions</span>
                      </div>
                      {workflow.stats && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{workflow.stats.totalRuns || 0} runs</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 ml-4">
                    {/* Toggle Status Button */}
                    <motion.button
                      onClick={() => handleToggleStatus(workflow.id, workflow.status)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all duration-300 ${
                        workflow.status === 'active'
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                          : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/20'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {workflow.status === 'active' ? (
                        <>
                          <Pause className="w-4 h-4" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="w-4 h-4" />
                          Activate
                        </>
                      )}
                    </motion.button>

                    {/* Edit Button */}
                    <motion.button
                      onClick={() => router.push(`/workspace/${orgId}/workflows/${workflow.id}`)}
                      className="px-4 py-2 bg-blue-500/10 text-blue-300 border border-blue-500/30 rounded-xl hover:bg-blue-500/20 text-sm font-semibold flex items-center gap-2 transition-all duration-300"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Settings className="w-4 h-4" />
                      Edit
                    </motion.button>

                    {/* History Button */}
                    <motion.button
                      onClick={() => router.push(`/workspace/${orgId}/workflows/${workflow.id}/runs`)}
                      className="px-4 py-2 bg-purple-500/10 text-purple-300 border border-purple-500/30 rounded-xl hover:bg-purple-500/20 text-sm font-semibold flex items-center gap-2 transition-all duration-300"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Clock className="w-4 h-4" />
                      History
                    </motion.button>

                    {/* Delete Button */}
                    <motion.button
                      onClick={() => handleDelete(workflow.id)}
                      className="px-4 py-2 bg-red-500/10 text-red-300 border border-red-500/30 rounded-xl hover:bg-red-500/20 text-sm font-semibold flex items-center gap-2 transition-all duration-300"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Pagination */}
          {(hasMore || loading) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 flex justify-center"
            >
              <motion.button
                onClick={loadMore}
                disabled={loading || !hasMore}
                className="px-8 py-3 bg-black/40 backdrop-blur-xl border border-white/10 text-white rounded-xl hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Loading...
                  </span>
                ) : hasMore ? (
                  `Load More (Showing ${workflows.length})`
                ) : (
                  'All loaded'
                )}
              </motion.button>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
