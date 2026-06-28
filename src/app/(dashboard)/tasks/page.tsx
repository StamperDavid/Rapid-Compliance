'use client';

/**
 * CRM Tasks — reminders & queues surface.
 *
 * Reuses the existing dedicated task backend (`TeamTask` in
 * `src/lib/team/collaboration.ts`, collection `tasks`, API `/api/team/tasks`
 * + `/api/team/tasks/[taskId]`). NO new/parallel task store — this page groups
 * the real tasks into reminder queues (Overdue / Due today / Upcoming /
 * No due date / Completed) derived from each task's due date + completed status,
 * and lets the operator mark a task complete and re-assign its owner in place.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { PageTitle, SectionDescription, SectionTitle } from '@/components/ui/typography';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

/** The reminder queues a task can fall into, derived from due date + status. */
type QueueKey = 'overdue' | 'today' | 'upcoming' | 'no_due_date' | 'completed';

interface QueueDef {
  key: QueueKey;
  label: string;
  hint: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITIES: TeamTask['priority'][] = ['low', 'normal', 'high', 'urgent'];
const ENTITY_TYPES: Array<NonNullable<TeamTask['relatedEntityType']>> = ['lead', 'contact', 'deal'];

const QUEUES: QueueDef[] = [
  { key: 'overdue', label: 'Overdue', hint: 'Past their due date and still open' },
  { key: 'today', label: 'Due today', hint: 'Due before midnight tonight' },
  { key: 'upcoming', label: 'Upcoming', hint: 'Due in the days ahead' },
  { key: 'no_due_date', label: 'No due date', hint: 'Open tasks without a deadline' },
  { key: 'completed', label: 'Completed', hint: 'Recently finished' },
];

// ---------------------------------------------------------------------------
// Helpers — pure, no inline styles
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

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function toDateOrNull(value: Date | string | undefined): Date | null {
  if (!value) { return null; }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDate(date: Date | string | undefined): string {
  const d = toDateOrNull(date);
  if (!d) { return ''; }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Start of today (local) — boundary between overdue and due-today. */
function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Start of tomorrow (local) — boundary between due-today and upcoming. */
function startOfTomorrow(): Date {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}

/** Plain-English relative due-date label for an open task. */
function dueRelativeLabel(due: Date | null): string {
  if (!due) { return 'No due date'; }
  const today = startOfToday();
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);
  const diffDays = Math.round((dueDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) { return 'Due today'; }
  if (diffDays === 1) { return 'Due tomorrow'; }
  if (diffDays === -1) { return '1 day overdue'; }
  if (diffDays < -1) { return `${Math.abs(diffDays)} days overdue`; }
  return `Due in ${diffDays} days`;
}

/** Sort tasks: nearest/most-overdue due date first, then by priority. */
function sortByUrgency(a: TeamTask, b: TeamTask): number {
  const aDue = toDateOrNull(a.dueDate);
  const bDue = toDateOrNull(b.dueDate);
  if (aDue && bDue) {
    if (aDue.getTime() !== bDue.getTime()) { return aDue.getTime() - bDue.getTime(); }
  } else if (aDue) {
    return -1;
  } else if (bDue) {
    return 1;
  }
  const order = { urgent: 0, high: 1, normal: 2, low: 3 };
  return order[a.priority] - order[b.priority];
}

/** Bucket every task into exactly one reminder queue. */
function bucketTasks(tasks: TeamTask[]): Record<QueueKey, TeamTask[]> {
  const buckets: Record<QueueKey, TeamTask[]> = {
    overdue: [],
    today: [],
    upcoming: [],
    no_due_date: [],
    completed: [],
  };
  const todayStart = startOfToday();
  const tomorrowStart = startOfTomorrow();

  for (const task of tasks) {
    if (task.status === 'completed') {
      buckets.completed.push(task);
      continue;
    }
    const due = toDateOrNull(task.dueDate);
    if (!due) {
      buckets.no_due_date.push(task);
    } else if (due < todayStart) {
      buckets.overdue.push(task);
    } else if (due < tomorrowStart) {
      buckets.today.push(task);
    } else {
      buckets.upcoming.push(task);
    }
  }

  // Completed: most recently completed first.
  buckets.completed.sort((a, b) => {
    const aDate = toDateOrNull(a.completedAt) ?? toDateOrNull(a.updatedAt);
    const bDate = toDateOrNull(b.completedAt) ?? toDateOrNull(b.updatedAt);
    return (bDate?.getTime() ?? 0) - (aDate?.getTime() ?? 0);
  });
  buckets.overdue.sort(sortByUrgency);
  buckets.today.sort(sortByUrgency);
  buckets.upcoming.sort(sortByUrgency);
  buckets.no_due_date.sort(sortByUrgency);

  return buckets;
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
      toast.error('Please give the task a title.');
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
        toast.error(data.error ?? 'Could not create the task. Please try again.');
      }
    } catch {
      toast.error('Network error while creating the task.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-task-dialog-title"
    >
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <h2 id="create-task-dialog-title" className="text-xl font-bold text-foreground mb-5">
          New task
        </h2>

        <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
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

          <div>
            <label htmlFor="task-assigned-to" className="block text-sm font-medium text-foreground mb-1">
              Assigned to (user ID)
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <option key={p} value={p}>{formatLabel(p)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-due-date" className="block text-sm font-medium text-foreground mb-1">
                Due date
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-entity-type" className="block text-sm font-medium text-foreground mb-1">
                Related record type
              </label>
              <select
                id="task-entity-type"
                value={relatedEntityType}
                onChange={(e) => setRelatedEntityType(e.target.value as TeamTask['relatedEntityType'] | '')}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">None</option>
                {ENTITY_TYPES.map((et) => (
                  <option key={et} value={et}>{formatLabel(et)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-entity-id" className="block text-sm font-medium text-foreground mb-1">
                Related record ID
              </label>
              <input
                id="task-entity-id"
                type="text"
                placeholder="Record ID"
                value={relatedEntityId}
                onChange={(e) => setRelatedEntityId(e.target.value)}
                disabled={!relatedEntityType}
                className="w-full px-3 py-2 bg-surface-elevated border border-border rounded-lg text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()}>
              {submitting ? 'Creating...' : 'Create task'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Task card
// ---------------------------------------------------------------------------

interface TaskCardProps {
  task: TeamTask;
  busy: boolean;
  onToggleComplete: (task: TeamTask) => void;
  onReassign: (task: TeamTask, newOwnerId: string) => void;
}

function TaskCard({ task, busy, onToggleComplete, onReassign }: TaskCardProps) {
  const isCompleted = task.status === 'completed';
  const due = toDateOrNull(task.dueDate);
  const [reassigning, setReassigning] = useState(false);
  const [ownerInput, setOwnerInput] = useState(task.assignedTo);

  const overdue = !isCompleted && due !== null && due < startOfToday();

  return (
    <div className="bg-surface-elevated/40 border border-border rounded-xl p-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-3 min-w-0">
        <button
          type="button"
          onClick={() => onToggleComplete(task)}
          disabled={busy}
          aria-label={isCompleted ? 'Mark as to-do' : 'Mark as complete'}
          className={`mt-0.5 w-5 h-5 shrink-0 rounded-full border flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 ${
            isCompleted ? 'bg-primary border-primary' : 'border-border hover:border-primary'
          }`}
        >
          {isCompleted && (
            <svg className="w-3 h-3 text-primary-foreground" fill="none" viewBox="0 0 12 12" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
            </svg>
          )}
        </button>

        <div className="min-w-0">
          <p className={`text-sm font-medium ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
            {task.title}
          </p>
          {task.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{task.description}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge className={`border text-xs font-medium ${getPriorityClasses(task.priority)}`}>
              {formatLabel(task.priority)}
            </Badge>
            {task.relatedEntityType && (
              <span className="text-xs text-muted-foreground capitalize">
                {task.relatedEntityType}
                {task.relatedEntityId ? ` · ${task.relatedEntityId.slice(0, 8)}…` : ''}
              </span>
            )}
            <span className="text-xs text-muted-foreground">
              Owner: {task.assignedToName ?? task.assignedTo}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
        <div className="text-right">
          {isCompleted ? (
            <span className="text-xs text-muted-foreground">
              {task.completedAt ? `Completed ${formatDate(task.completedAt)}` : 'Completed'}
            </span>
          ) : (
            <span className={`text-xs font-medium ${overdue ? 'text-red-500' : 'text-muted-foreground'}`}>
              {dueRelativeLabel(due)}
              {due ? ` · ${formatDate(due)}` : ''}
            </span>
          )}
        </div>

        {reassigning ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={ownerInput}
              onChange={(e) => setOwnerInput(e.target.value)}
              placeholder="New owner user ID"
              className="w-40 px-2 py-1 bg-card border border-border rounded-md text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button
              type="button"
              size="sm"
              disabled={busy || !ownerInput.trim() || ownerInput.trim() === task.assignedTo}
              onClick={() => { onReassign(task, ownerInput.trim()); setReassigning(false); }}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { setOwnerInput(task.assignedTo); setReassigning(false); }}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => setReassigning(true)}>
              Re-assign
            </Button>
            {!isCompleted && (
              <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onToggleComplete(task)}>
                Complete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Queue section
// ---------------------------------------------------------------------------

interface QueueSectionProps {
  def: QueueDef;
  tasks: TeamTask[];
  busyId: string | null;
  onToggleComplete: (task: TeamTask) => void;
  onReassign: (task: TeamTask, newOwnerId: string) => void;
}

function QueueSection({ def, tasks, busyId, onToggleComplete, onReassign }: QueueSectionProps) {
  if (tasks.length === 0) { return null; }
  const accent = def.key === 'overdue' ? 'text-red-500' : 'text-foreground';
  return (
    <section className="space-y-3">
      <div className="flex items-baseline gap-3">
        <SectionTitle className={accent}>{def.label}</SectionTitle>
        <span className="text-sm text-muted-foreground">{tasks.length}</span>
        <span className="text-xs text-muted-foreground hidden sm:inline">· {def.hint}</span>
      </div>
      <div className="space-y-3">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            busy={busyId === task.id}
            onToggleComplete={onToggleComplete}
            onReassign={onReassign}
          />
        ))}
      </div>
    </section>
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
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!user) { return; }
    setLoading(true);
    try {
      // The team-tasks API returns the authenticated caller's own tasks
      // (owner filtering happens server-side via the requireAuth uid).
      const res = await authFetch('/api/team/tasks');
      const data = (await res.json()) as TaskListResponse;
      if (data.success) {
        setTasks(data.data);
      } else {
        toast.error('Could not load your tasks. Please refresh.');
      }
    } catch {
      toast.error('Network error while loading tasks.');
    } finally {
      setLoading(false);
    }
  }, [user, authFetch, toast]);

  useEffect(() => {
    if (user) { void loadTasks(); }
  }, [user, loadTasks]);

  const handleToggleComplete = useCallback(
    async (task: TeamTask) => {
      const newStatus: TeamTask['status'] = task.status === 'completed' ? 'todo' : 'completed';
      setBusyId(task.id);
      try {
        const res = await authFetch(`/api/team/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        });
        const data = (await res.json()) as TaskMutationResponse;
        if (data.success) {
          toast.success(newStatus === 'completed' ? 'Task marked complete' : 'Task reopened');
          await loadTasks();
        } else {
          toast.error(data.error ?? 'Could not update the task.');
        }
      } catch {
        toast.error('Network error while updating the task.');
      } finally {
        setBusyId(null);
      }
    },
    [authFetch, loadTasks, toast]
  );

  const handleReassign = useCallback(
    async (task: TeamTask, newOwnerId: string) => {
      if (!newOwnerId || newOwnerId === task.assignedTo) { return; }
      setBusyId(task.id);
      try {
        const res = await authFetch(`/api/team/tasks/${task.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignedTo: newOwnerId, assignedToName: newOwnerId }),
        });
        const data = (await res.json()) as TaskMutationResponse;
        if (data.success) {
          toast.success('Task re-assigned');
          await loadTasks();
        } else {
          toast.error(data.error ?? 'Could not re-assign the task.');
        }
      } catch {
        toast.error('Network error while re-assigning the task.');
      } finally {
        setBusyId(null);
      }
    },
    [authFetch, loadTasks, toast]
  );

  const buckets = useMemo(() => bucketTasks(tasks), [tasks]);
  const openCount = buckets.overdue.length + buckets.today.length + buckets.upcoming.length + buckets.no_due_date.length;
  const hasAny = tasks.length > 0;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <PageTitle>Tasks</PageTitle>
          <SectionDescription className="mt-1">
            Your reminders and follow-up queues — overdue, due today, and upcoming.
          </SectionDescription>
        </div>
        <Button type="button" onClick={() => setShowCreateModal(true)} className="self-start sm:self-auto shrink-0">
          + New task
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {([
          { label: 'Overdue', value: buckets.overdue.length, accent: 'text-red-500' },
          { label: 'Due today', value: buckets.today.length, accent: 'text-foreground' },
          { label: 'Upcoming', value: buckets.upcoming.length, accent: 'text-foreground' },
          { label: 'Open total', value: openCount, accent: 'text-foreground' },
        ]).map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.accent}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Body */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : !hasAny ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <p className="text-foreground font-semibold">No tasks yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Create a task to start tracking your follow-ups and reminders.
              </p>
            </div>
            <Button type="button" onClick={() => setShowCreateModal(true)}>+ New task</Button>
          </div>
        </div>
      ) : openCount === 0 && buckets.completed.length > 0 ? (
        <>
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <p className="text-foreground font-semibold">You&apos;re all caught up</p>
            <p className="text-sm text-muted-foreground mt-1">No open tasks. Nicely done.</p>
          </div>
          {QUEUES.filter((q) => q.key === 'completed').map((def) => (
            <QueueSection
              key={def.key}
              def={def}
              tasks={buckets[def.key]}
              busyId={busyId}
              onToggleComplete={(t) => void handleToggleComplete(t)}
              onReassign={(t, owner) => void handleReassign(t, owner)}
            />
          ))}
        </>
      ) : (
        <div className="space-y-8">
          {QUEUES.map((def) => (
            <QueueSection
              key={def.key}
              def={def}
              tasks={buckets[def.key]}
              busyId={busyId}
              onToggleComplete={(t) => void handleToggleComplete(t)}
              onReassign={(t, owner) => void handleReassign(t, owner)}
            />
          ))}
        </div>
      )}

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
