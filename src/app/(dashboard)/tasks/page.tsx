'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import type { TeamTask } from '@/lib/team/collaboration';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaskListResponse {
  success: boolean;
  data: TeamTask[];
}

interface TaskMutationResponse {
  success: boolean;
  error?: string;
}

type StatusFilter = 'all' | 'todo' | 'in_progress' | 'blocked' | 'completed';

interface CreateTaskPayload {
  title: string;
  description?: string;
  assignedTo: string;
  assignedToName?: string;
  priority: TeamTask['priority'];
  dueDate?: string;
  relatedEntityType?: TeamTask['relatedEntityType'];
  relatedEntityId?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITIES: TeamTask['priority'][] = ['low', 'normal', 'high', 'urgent'];
const STATUSES: TeamTask['status'][] = ['todo', 'in_progress', 'blocked', 'completed'];
const ENTITY_TYPES: Array<TeamTask['relatedEntityType']> = ['lead', 'contact', 'deal'];

const STATUS_FILTER_TABS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Completed' },
];

// ---------------------------------------------------------------------------
// Badge helpers — pure Tailwind, no inline styles
// ---------------------------------------------------------------------------

function getPriorityClasses(priority: TeamTask['priority']): string {
  switch (priority) {
    case 'urgent':
      return 'bg-red-500/15 text-red-500 border-red-500/30';
    case 'high':
      return 'bg-orange-500/15 text-orange-500 border-orange-500/30';
    case 'normal':
      return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
    case 'low':
      return 'bg-muted text-muted-foreground border-border';
  }
}

function getStatusClasses(status: TeamTask['status']): string {
  switch (status) {
    case 'todo':
      return 'bg-muted text-muted-foreground border-border';
    case 'in_progress':
      return 'bg-blue-500/15 text-blue-500 border-blue-500/30';
    case 'blocked':
      return 'bg-red-500/15 text-red-500 border-red-500/30';
    case 'completed':
      return 'bg-green-500/15 text-green-500 border-green-500/30';
  }
}

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(date: Date | string | undefined): string {
  if (!date) { return ''; }
  return new Date(date).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Skeleton row
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <tr className="border-b border-border animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-muted rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Create Task Modal
// ---------------------------------------------------------------------------

interface CreateModalProps {
  currentUserId: string;
  currentUserEmail: string;
  onClose: () => void;
  onCreated: () => void;
  authFetch: (url: string, options?: RequestInit) => Promise<Response>;
  toast: ReturnType<typeof useToast>;
}

function CreateTaskModal({
  currentUserId,
  currentUserEmail,
  onClose,
  onCreated,
  authFetch,
  toast,
}: CreateModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState(currentUserId);
  const [priority, setPriority] = useState<TeamTask['priority']>('normal');
  const [dueDate, setDueDate] = useState('');
  const [relatedEntityType, setRelatedEntityType] = useState<TeamTask['relatedEntityType'] | ''>('');
  const [relatedEntityId, setRelatedEntityId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Title is required');
      return;
    }

    const payload: CreateTaskPayload = {
      title: title.trim(),
      assignedTo: assignedTo.trim() || currentUserId,
      assignedToName: assignedTo === currentUserId ? currentUserEmail : undefined,
      priority,
    };
    if (description.trim()) { payload.description = description.trim(); }
    if (dueDate) { payload.dueDate = dueDate; }
    if (relatedEntityType) { payload.relatedEntityType = relatedEntityType; }
    if (relatedEntityId.trim()) { payload.relatedEntityId = relatedEntityId.trim(); }

    setSubmitting(true);
    try {
      const res = await authFetch('/api/team/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as TaskMutationResponse;
      if (data.success) {
        toast.success('Task created');
        onCreated();
        onClose();
      } else {
        toast.error(data.error ?? 'Failed to create task');
      }
    } catch {
      toast.error('Network error while creating task');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-dialog-title"
    >
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl">
        <h2
          id="create-task-dialog-title"
          className="text-xl font-bold text-foreground mb-5"
        >
          Create Task
        </h2>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
          {/* Title */}
          <div>
            <label htmlFor="task-title" className="block text-sm font-medium text-foreground mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              required
              placeholder="What needs to be done?"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="task-description" className="block text-sm font-medium text-foreground mb-1">
              Description
            </label>
            <textarea
              id="task-description"
              placeholder="Optional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Assigned To */}
          <div>
            <label htmlFor="task-assigned-to" className="block text-sm font-medium text-foreground mb-1">
              Assigned To (User ID)
            </label>
            <input
              id="task-assigned-to"
              type="text"
              placeholder="User ID"
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Priority + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-priority" className="block text-sm font-medium text-foreground mb-1">
                Priority
              </label>
              <select
                id="task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TeamTask['priority'])}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {formatLabel(p)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-due-date" className="block text-sm font-medium text-foreground mb-1">
                Due Date
              </label>
              <input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Related Entity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-entity-type" className="block text-sm font-medium text-foreground mb-1">
                Related Entity Type
              </label>
              <select
                id="task-entity-type"
                value={relatedEntityType}
                onChange={(e) =>
                  setRelatedEntityType(e.target.value as TeamTask['relatedEntityType'] | '')
                }
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">None</option>
                {ENTITY_TYPES.map((et) => (
                  <option key={et} value={et}>
                    {et ? formatLabel(et) : ''}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="task-entity-id"
                className="block text-sm font-medium text-foreground mb-1"
              >
                Related Entity ID
              </label>
              <input
                id="task-entity-id"
                type="text"
                placeholder="Entity ID"
                value={relatedEntityId}
                onChange={(e) => setRelatedEntityId(e.target.value)}
                disabled={!relatedEntityType}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !title.trim()}
              className="px-5 py-2 bg-primary text-white text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task row
// ---------------------------------------------------------------------------

interface TaskRowProps {
  task: TeamTask;
  onToggleComplete: (task: TeamTask) => void;
}

function TaskRow({ task, onToggleComplete }: TaskRowProps) {
  const isCompleted = task.status === 'completed';

  return (
    <tr className="border-b border-border hover:bg-surface-elevated/50 transition-colors">
      {/* Completion toggle */}
      <td className="px-4 py-3">
        <button
          type="button"
          onClick={() => onToggleComplete(task)}
          aria-label={isCompleted ? 'Mark as to-do' : 'Mark as completed'}
          className="w-4 h-4 rounded border border-border flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
          style={{
            backgroundColor: isCompleted ? 'var(--color-primary, #6366f1)' : undefined,
          }}
        >
          {isCompleted && (
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 12 12"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
            </svg>
          )}
        </button>
      </td>

      {/* Title */}
      <td className="px-4 py-3">
        <span
          className={`text-sm font-medium ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}
        >
          {task.title}
        </span>
        {task.description && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
        )}
      </td>

      {/* Priority */}
      <td className="px-4 py-3">
        <Badge
          className={`border text-xs font-medium ${getPriorityClasses(task.priority)}`}
        >
          {formatLabel(task.priority)}
        </Badge>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <Badge
          className={`border text-xs font-medium ${getStatusClasses(task.status)}`}
        >
          {formatLabel(task.status)}
        </Badge>
      </td>

      {/* Assignee */}
      <td className="px-4 py-3">
        <span className="text-sm text-muted-foreground truncate max-w-[140px] block">
          {task.assignedToName ?? task.assignedTo}
        </span>
      </td>

      {/* Due Date */}
      <td className="px-4 py-3">
        {task.dueDate ? (
          <span className="text-sm text-muted-foreground">{formatDate(task.dueDate)}</span>
        ) : (
          <span className="text-muted-foreground/40 text-sm">—</span>
        )}
      </td>

      {/* Related Entity */}
      <td className="px-4 py-3">
        {task.relatedEntityType ? (
          <span className="text-sm text-muted-foreground capitalize">
            {task.relatedEntityType}
            {task.relatedEntityId ? ` · ${task.relatedEntityId.slice(0, 8)}…` : ''}
          </span>
        ) : (
          <span className="text-muted-foreground/40 text-sm">—</span>
        )}
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function TasksPage() {
  const { user } = useAuth();
  const authFetch = useAuthFetch();
  const toast = useToast();

  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const query = activeFilter !== 'all' ? `?status=${activeFilter}` : '';
      const res = await authFetch(`/api/team/tasks${query}`);
      const data = (await res.json()) as TaskListResponse;
      if (data.success) {
        setTasks(data.data);
      } else {
        toast.error('Failed to load tasks');
      }
    } catch {
      toast.error('Network error while loading tasks');
    } finally {
      setLoading(false);
    }
  }, [activeFilter, authFetch, toast]);

  useEffect(() => {
    if (user) {
      void loadTasks();
    }
  }, [user, loadTasks]);

  const handleToggleComplete = useCallback(
    async (task: TeamTask) => {
      const newStatus: TeamTask['status'] =
        task.status === 'completed' ? 'todo' : 'completed';
      try {
        const res = await authFetch(`/api/team/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        const data = (await res.json()) as TaskMutationResponse;
        if (data.success) {
          await loadTasks();
        } else {
          toast.error(data.error ?? 'Failed to update task');
        }
      } catch {
        toast.error('Network error while updating task');
      }
    },
    [authFetch, loadTasks, toast]
  );

  const filteredTasks =
    activeFilter === 'all'
      ? tasks
      : tasks.filter((t) => t.status === activeFilter);

  const statusCounts = STATUSES.reduce<Record<TeamTask['status'], number>>(
    (acc, s) => {
      acc[s] = tasks.filter((t) => t.status === s).length;
      return acc;
    },
    { todo: 0, in_progress: 0, blocked: 0, completed: 0 }
  );

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageTitle>Tasks</PageTitle>
          <SectionDescription className="mt-1">
            Track and manage team tasks, follow-ups, and action items.
          </SectionDescription>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="self-start sm:self-auto px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity shrink-0"
        >
          + Create Task
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTER_TABS.map((tab) => {
          const count =
            tab.value === 'all'
              ? tasks.length
              : (statusCounts[tab.value] ?? 0);
          const isActive = activeFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveFilter(tab.value)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${
                isActive
                  ? 'bg-primary text-white'
                  : 'bg-card text-muted-foreground border border-border hover:bg-surface-elevated'
              }`}
            >
              {tab.label}
              <span
                className={`text-xs rounded-full px-1.5 py-0.5 ${
                  isActive
                    ? 'bg-white/20 text-white'
                    : 'bg-surface-elevated text-muted-foreground'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Table card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border bg-surface-elevated">
                <th className="px-4 py-3 w-8" aria-label="Complete" />
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Assignee
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Related Entity
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-muted-foreground"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-foreground font-semibold">No tasks yet</p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {activeFilter === 'all'
                            ? 'Create your first task to get started.'
                            : `No tasks with status "${formatLabel(activeFilter)}".`}
                        </p>
                      </div>
                      {activeFilter === 'all' && (
                        <button
                          type="button"
                          onClick={() => setShowCreateModal(true)}
                          className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:opacity-90 transition-opacity"
                        >
                          + Create Task
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggleComplete={(t) => void handleToggleComplete(t)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create modal */}
      {showCreateModal && user && (
        <CreateTaskModal
          currentUserId={user.id}
          currentUserEmail={user.email}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => void loadTasks()}
          authFetch={authFetch}
          toast={toast}
        />
      )}
    </div>
  );
}
