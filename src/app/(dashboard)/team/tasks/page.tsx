'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import type { TeamTask } from '@/lib/team/collaboration';

interface TaskResponse {
  success: boolean;
  data: TeamTask[];
}

interface MutationResponse {
  success: boolean;
  error?: string;
}

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
const STATUSES = ['todo', 'in_progress', 'blocked', 'completed'] as const;

export default function TasksPage() {
  const { user } = useAuth();
  const authFetch = useAuthFetch();
  const toast = useToast();

  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<TeamTask['priority']>('normal');
  const [formDueDate, setFormDueDate] = useState('');

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const statusParam = filter !== 'all' ? `&status=${filter}` : '';
      const response = await authFetch(`/api/team/tasks?${statusParam}`);
      const data = (await response.json()) as TaskResponse;
      if (data.success) {
        setTasks(data.data);
      }
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [filter, toast, authFetch]);

  useEffect(() => {
    if (user) {
      void loadTasks();
    }
  }, [user, loadTasks]);

  const resetForm = () => {
    setFormTitle('');
    setFormDescription('');
    setFormPriority('normal');
    setFormDueDate('');
  };

  const openCreateModal = () => {
    resetForm();
    setEditingTask(null);
    setShowModal(true);
  };

  const openEditModal = (task: TeamTask) => {
    setFormTitle(task.title);
    setFormDescription(task.description ?? '');
    setFormPriority(task.priority);
    setFormDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    setEditingTask(task);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      if (editingTask) {
        const res = await authFetch(`/api/team/tasks/${editingTask.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formTitle,
            description: formDescription || undefined,
            priority: formPriority,
            dueDate: formDueDate || undefined,
          }),
        });
        const data = (await res.json()) as MutationResponse;
        if (data.success) {
          toast.success('Task updated');
        } else {
          toast.error(data.error ?? 'Failed to update');
          return;
        }
      } else {
        const res = await authFetch('/api/team/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: formTitle,
            description: formDescription || undefined,
            priority: formPriority,
            dueDate: formDueDate || undefined,
            assignedTo: user?.id ?? '',
            assignedToName: user?.email ?? undefined,
          }),
        });
        const data = (await res.json()) as MutationResponse;
        if (data.success) {
          toast.success('Task created');
        } else {
          toast.error(data.error ?? 'Failed to create');
          return;
        }
      }

      setShowModal(false);
      resetForm();
      await loadTasks();
    } catch {
      toast.error('Failed to save task');
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: TeamTask['status']) => {
    try {
      await authFetch(`/api/team/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      await loadTasks();
    } catch {
      toast.error('Failed to update task status');
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      const res = await authFetch(`/api/team/tasks/${taskId}`, {
        method: 'DELETE',
      });
      const data = (await res.json()) as MutationResponse;
      if (data.success) {
        toast.success('Task deleted');
        setDeleteConfirm(null);
        await loadTasks();
      } else {
        toast.error(data.error ?? 'Failed to delete');
      }
    } catch {
      toast.error('Failed to delete task');
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      urgent: 'bg-error/20 text-error border-error/30',
      high: 'bg-warning/20 text-warning border-warning/30',
      normal: 'bg-primary/20 text-primary border-primary/30',
      low: 'bg-surface-elevated text-[var(--color-text-disabled)] border-border-light',
    };
    return colors[priority] ?? colors.normal;
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ');
  };

  const tasksByStatus = {
    todo: tasks.filter((t) => t.status === 'todo'),
    in_progress: tasks.filter((t) => t.status === 'in_progress'),
    blocked: tasks.filter((t) => t.status === 'blocked'),
    completed: tasks.filter((t) => t.status === 'completed'),
  };

  return (
    <div className="min-h-screen bg-surface-main p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">My Tasks</h1>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary-light transition-all text-sm"
        >
          + New Task
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {(['all', 'todo', 'in_progress', 'completed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-xl capitalize text-sm font-medium transition-all ${
              filter === status
                ? 'bg-primary text-white'
                : 'bg-surface-paper text-[var(--color-text-secondary)] hover:bg-surface-elevated border border-border-light'
            }`}
          >
            {getStatusLabel(status)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-[var(--color-text-secondary)]">Loading tasks...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
            <div key={status} className="bg-surface-paper rounded-2xl p-4 border border-border-light">
              <h3 className="font-bold mb-4 capitalize flex items-center justify-between text-[var(--color-text-primary)]">
                <span>{getStatusLabel(status)}</span>
                <span className="text-xs text-[var(--color-text-secondary)] bg-surface-elevated px-2 py-0.5 rounded-full">
                  {statusTasks.length}
                </span>
              </h3>
              <div className="space-y-3">
                {statusTasks.map((task) => (
                  <div
                    key={task.id}
                    className={`border rounded-xl p-3 ${getPriorityColor(task.priority)}`}
                  >
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <div className="font-medium text-sm flex-1">{task.title}</div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          onClick={() => openEditModal(task)}
                          className="p-1 hover:bg-white/10 rounded text-xs opacity-60 hover:opacity-100"
                          title="Edit"
                        >
                          ✏️
                        </button>
                        {deleteConfirm === task.id ? (
                          <div className="flex items-center gap-0.5">
                            <button
                              onClick={() => void handleDelete(task.id)}
                              className="px-1.5 py-0.5 text-[9px] font-bold bg-error text-white rounded"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(null)}
                              className="px-1 py-0.5 text-[9px]"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(task.id)}
                            className="p-1 hover:bg-white/10 rounded text-xs opacity-60 hover:opacity-100"
                            title="Delete"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    </div>
                    {task.description && (
                      <div className="text-xs opacity-75 mb-2 line-clamp-2">{task.description}</div>
                    )}
                    <div className="flex flex-wrap gap-1 mb-2">
                      {task.dueDate && (
                        <span className="text-[10px] opacity-75">
                          Due: {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}
                      {task.relatedEntityType && (
                        <span className="text-[10px] opacity-75">
                          &middot; {task.relatedEntityType}
                        </span>
                      )}
                    </div>
                    {/* Status change buttons */}
                    {status !== 'completed' && (
                      <div className="flex gap-1">
                        {status === 'todo' && (
                          <button
                            onClick={() => void handleStatusChange(task.id, 'in_progress')}
                            className="text-[10px] bg-primary/80 text-white px-2 py-0.5 rounded hover:bg-primary flex-1"
                          >
                            Start
                          </button>
                        )}
                        {status === 'in_progress' && (
                          <button
                            onClick={() => void handleStatusChange(task.id, 'blocked')}
                            className="text-[10px] bg-warning/80 text-white px-2 py-0.5 rounded hover:bg-warning flex-1"
                          >
                            Block
                          </button>
                        )}
                        {status === 'blocked' && (
                          <button
                            onClick={() => void handleStatusChange(task.id, 'in_progress')}
                            className="text-[10px] bg-primary/80 text-white px-2 py-0.5 rounded hover:bg-primary flex-1"
                          >
                            Unblock
                          </button>
                        )}
                        <button
                          onClick={() => void handleStatusChange(task.id, 'completed')}
                          className="text-[10px] bg-success/80 text-white px-2 py-0.5 rounded hover:bg-success flex-1"
                        >
                          Complete
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {statusTasks.length === 0 && (
                  <div className="text-center text-[var(--color-text-disabled)] text-xs py-8">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-surface-paper border border-border-light rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
              {editingTask ? 'Edit Task' : 'New Task'}
            </h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Title</label>
                <input
                  type="text"
                  placeholder="Task title"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Description</label>
                <textarea
                  placeholder="Optional description"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Priority</label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as TeamTask['priority'])}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p} className="capitalize">{p}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Due Date</label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              {editingTask && (
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">Status</label>
                  <select
                    defaultValue={editingTask.status}
                    onChange={(e) => void handleStatusChange(editingTask.id, e.target.value as TeamTask['status'])}
                    className="w-full px-3 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s} className="capitalize">{getStatusLabel(s)}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowModal(false); resetForm(); }}
                className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={!formTitle.trim()}
                className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary-light transition-all disabled:opacity-50"
              >
                {editingTask ? 'Save Changes' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
