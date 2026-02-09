'use client';

import { useEffect, useState, useCallback } from 'react';
import type { TeamTask } from '@/lib/team/collaboration';

interface TaskResponse {
  success: boolean;
  data: TeamTask[];
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [filter, setFilter] = useState<'all' | 'todo' | 'in_progress' | 'completed'>('all');
  const [_loading, setLoading] = useState(true);
  const [_showNewTask, setShowNewTask] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const statusParam = filter !== 'all' ? `&status=${filter}` : '';
      const response = await fetch(`/api/team/tasks?${statusParam}`);
      const data = await response.json() as TaskResponse;
      if (data.success) {
        setTasks(data.data);
      }
    } catch (_error) {
      // Error is logged silently
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const completeTask = async (taskId: string) => {
    try {
      await fetch(`/api/team/tasks/${taskId}/complete`, { method: 'POST' });
      void loadTasks();
    } catch (_error) {
      // Show error in console instead of alert for better UX
      console.error('Failed to complete task');
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      urgent: 'bg-error/20 text-error border-error',
      high: 'bg-warning/20 text-warning border-warning',
      normal: 'bg-primary/20 text-primary border-primary',
      low: 'bg-surface-elevated text-[var(--color-text-disabled)] border-border-light',
    };
    return colors[priority as keyof typeof colors] || colors.normal;
  };

  const tasksByStatus = {
    todo: tasks.filter(t => t.status === 'todo'),
    in_progress: tasks.filter(t => t.status === 'in_progress'),
    blocked: tasks.filter(t => t.status === 'blocked'),
    completed: tasks.filter(t => t.status === 'completed'),
  };

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">My Tasks</h1>
        <button
          onClick={() => setShowNewTask(true)}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-light"
        >
          + New Task
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        {(['all', 'todo', 'in_progress', 'completed'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg capitalize ${
              filter === status ? 'bg-primary text-white' : 'bg-surface-elevated text-[var(--color-text-secondary)] hover:bg-surface-paper'
            }`}
          >
            {status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-4 gap-4">
        {Object.entries(tasksByStatus).map(([status, statusTasks]) => (
          <div key={status} className="bg-surface-paper rounded-lg p-4">
            <h3 className="font-bold mb-4 capitalize flex items-center justify-between">
              <span>{status.replace('_', ' ')}</span>
              <span className="text-sm text-[var(--color-text-secondary)]">({statusTasks.length})</span>
            </h3>
            <div className="space-y-3">
              {statusTasks.map(task => (
                <div
                  key={task.id}
                  className={`border rounded-lg p-3 ${getPriorityColor(task.priority)}`}
                >
                  <div className="font-medium text-sm mb-2">{task.title}</div>
                  {task.description && (
                    <div className="text-xs opacity-75 mb-2">{task.description}</div>
                  )}
                  {task.dueDate && (
                    <div className="text-xs opacity-75 mb-2">
                      Due: {new Date(task.dueDate).toLocaleDateString()}
                    </div>
                  )}
                  {task.relatedEntityType && (
                    <div className="text-xs opacity-75 mb-2">
                      Related: {task.relatedEntityType}
                    </div>
                  )}
                  {status !== 'completed' && (
                    <button
                      onClick={() => void completeTask(task.id)}
                      className="text-xs bg-success text-white px-2 py-1 rounded hover:bg-success/80 w-full mt-2"
                    >
                      ✓ Complete
                    </button>
                  )}
                </div>
              ))}
              {statusTasks.length === 0 && (
                <div className="text-center text-[var(--color-text-disabled)] text-sm py-8">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

