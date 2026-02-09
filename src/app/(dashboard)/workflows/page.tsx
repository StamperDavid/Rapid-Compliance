'use client';


/**
 * Workflow List Page
 * Admin page for viewing and managing workflows
 */

import { useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Workflow as WorkflowIcon,
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
import type { Workflow } from '@/types/workflow';
import type { QueryDocumentSnapshot } from 'firebase/firestore';

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
  const router = useRouter();
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Fetch function with pagination using service layer
  const fetchWorkflows = useCallback(async (lastDoc?: QueryDocumentSnapshot) => {
    return getWorkflows(
      'default',
      undefined,
      { pageSize: 50, lastDoc }
    );
  }, []);

  const {
    data: workflows,
    loading,
    error,
    hasMore,
    loadMore,
    refresh
  } = usePagination<Workflow, QueryDocumentSnapshot>({ fetchFn: fetchWorkflows });

  // Initial load
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleDelete = (workflowId: string) => {
    setConfirmDialog({
      message: 'Delete this workflow?',
      onConfirm: () => {
        void (async () => {
          try {
            await deleteWorkflow(workflowId, 'default');
            await refresh();
            setConfirmDialog(null);
            setNotification({ message: 'Workflow deleted successfully', type: 'success' });
          } catch (err) {
            logger.error('Error deleting workflow:', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
            setConfirmDialog(null);
            setNotification({ message: 'Failed to delete workflow', type: 'error' });
          }
        })();
      },
    });
  };

  const handleToggleStatus = async (workflowId: string, currentStatus: string) => {
    const newStatus: 'active' | 'paused' = currentStatus === 'active' ? 'paused' : 'active';

    try {
      await setWorkflowStatus(workflowId, newStatus, 'default');
      await refresh();
      setNotification({ message: `Workflow ${newStatus === 'active' ? 'activated' : 'paused'} successfully`, type: 'success' });
    } catch (err) {
      logger.error('Error updating workflow:', err instanceof Error ? err : new Error(String(err)), { file: 'page.tsx' });
      setNotification({ message: 'Failed to update workflow', type: 'error' });
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
    <div className="min-h-screen bg-surface-main p-8">
      {/* Header */}
      <motion.div
        className="mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
              <WorkflowIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">Workflows</h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-1">Automate your sales processes</p>
            </div>
          </div>
          <motion.button
            onClick={() => router.push(`/workflows/new`)}
            className="px-6 py-3 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-semibold rounded-xl shadow-lg shadow-primary/25 flex items-center gap-2 transition-all duration-300"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-5 h-5" />
            Create Workflow
          </motion.button>
        </div>
      </motion.div>

      {/* Notification */}
      {notification && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mb-6 p-3 rounded-lg text-sm border ${notification.type === 'success' ? 'text-success border-border-light' : 'text-error border-border-light'}`}
          style={{ backgroundColor: notification.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}
        >
          <div className="flex items-center justify-between">
            <span>{notification.message}</span>
            <button onClick={() => setNotification(null)} className="ml-2 text-current opacity-60 hover:opacity-100">&times;</button>
          </div>
        </motion.div>
      )}

      {/* Error Message */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 backdrop-blur-xl border border-border-strong rounded-xl"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
        >
          <div className="flex items-center gap-3 text-error">
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
          className="text-center py-16 bg-surface-paper backdrop-blur-xl border border-border-light rounded-2xl"
        >
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center border border-border-strong" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))' }}>
            <WorkflowIcon className="w-10 h-10 text-primary" />
          </div>
          <h3 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">No workflows yet</h3>
          <p className="text-[var(--color-text-secondary)] mb-6">Create your first automation to get started</p>
          <motion.button
            onClick={() => router.push(`/workflows/new`)}
            className="px-8 py-3 bg-gradient-to-r from-primary to-secondary hover:from-primary-light hover:to-secondary-light text-white font-semibold rounded-xl shadow-lg shadow-primary/25 inline-flex items-center gap-2 transition-all duration-300"
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
            { }
            {workflows.map((workflow) => (
              <motion.div
                key={workflow.id}
                variants={itemVariants}
                className="bg-surface-paper backdrop-blur-xl border border-border-light rounded-2xl p-6 hover:border-border-strong transition-all duration-300 group"
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Title and Status */}
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg flex items-center justify-center border border-border-strong" style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.2))' }}>
                        <WorkflowIcon className="w-5 h-5 text-primary" />
                      </div>
                      <h3 className="text-xl font-semibold text-[var(--color-text-primary)] group-hover:text-primary transition-colors">
                        {workflow.name}
                      </h3>
                      {getStatusBadge(workflow.status)}
                    </div>

                    {/* Description */}
                    {workflow.description && (
                      <p className="text-[var(--color-text-secondary)] mb-4 ml-13">{workflow.description}</p>
                    )}

                    {/* Metadata */}
                    <div className="flex items-center gap-6 text-sm text-[var(--color-text-secondary)] ml-13">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        <span>Trigger: {workflow.trigger?.type ?? 'manual'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        <span>{workflow.actions?.length ?? 0} actions</span>
                      </div>
                      {workflow.stats && (
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          <span>{workflow.stats.totalRuns ?? 0} runs</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 ml-4">
                    {/* Toggle Status Button */}
                    <motion.button
                      onClick={() => void handleToggleStatus(workflow.id, workflow.status)}
                      className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all duration-300 border ${
                        workflow.status === 'active'
                          ? 'text-warning border-border-strong'
                          : 'text-success border-border-strong'
                      }`}
                      style={{ backgroundColor: workflow.status === 'active' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)' }}
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
                      onClick={() => router.push(`/workflows/${workflow.id}`)}
                      className="px-4 py-2 text-primary border border-border-strong rounded-xl text-sm font-semibold flex items-center gap-2 transition-all duration-300"
                      style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)' }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Settings className="w-4 h-4" />
                      Edit
                    </motion.button>

                    {/* History Button */}
                    <motion.button
                      onClick={() => router.push(`/workflows/${workflow.id}/runs`)}
                      className="px-4 py-2 text-secondary border border-border-strong rounded-xl text-sm font-semibold flex items-center gap-2 transition-all duration-300"
                      style={{ backgroundColor: 'rgba(168, 85, 247, 0.1)' }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Clock className="w-4 h-4" />
                      History
                    </motion.button>

                    {/* Delete Button */}
                    <motion.button
                      onClick={() => void handleDelete(workflow.id)}
                      className="px-4 py-2 text-error border border-border-strong rounded-xl text-sm font-semibold flex items-center gap-2 transition-all duration-300"
                      style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}
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
            { }
          </motion.div>

          {/* Pagination */}
          {(hasMore || loading) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 flex justify-center"
            >
              <motion.button
                onClick={() => void loadMore()}
                disabled={loading || !hasMore}
                className="px-8 py-3 bg-surface-paper backdrop-blur-xl border border-border-light text-[var(--color-text-primary)] rounded-xl hover:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-border-light border-t-[var(--color-text-primary)] rounded-full animate-spin" />
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

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-surface-paper rounded-xl p-6 max-w-md mx-4 border border-border-light shadow-xl">
            <p className="text-[var(--color-text-primary)] mb-4">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmDialog(null)} className="px-4 py-2 rounded-lg text-[var(--color-text-secondary)] hover:bg-surface-elevated">Cancel</button>
              <button onClick={confirmDialog.onConfirm} className="px-4 py-2 rounded-lg text-white" style={{ backgroundColor: 'var(--color-error)' }}>Confirm</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
