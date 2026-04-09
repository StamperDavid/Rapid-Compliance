'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import SubpageNav from '@/components/ui/SubpageNav';
import { DEALS_TABS } from '@/lib/constants/subpage-nav';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import {
  CheckSquare,
  AlertCircle,
  Clock,
  CheckCircle2,
} from 'lucide-react';

interface DealTask {
  id: string;
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  dueDate?: string;
  assignedTo?: string;
  dealId?: string;
  createdAt?: string;
}

const PRIORITY_BADGES: Record<string, string> = {
  urgent: 'bg-red-500/10 text-red-400 border-red-500/20',
  high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

export default function DealsTasksPage() {
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await authFetch('/api/tasks?pageSize=100');
      if (!response.ok) { throw new Error('Failed to fetch tasks'); }
      const result = await response.json() as { data?: DealTask[]; tasks?: DealTask[] };
      setTasks(result.data ?? result.tasks ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (authLoading) { return; }
    void fetchTasks();
  }, [fetchTasks, authLoading]);

  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const pendingCount = tasks.length - completedCount;

  const columns: ColumnDef<DealTask>[] = useMemo(() => [
    {
      key: 'status',
      header: '',
      sortable: false,
      render: (t) => (
        t.status === 'completed'
          ? <CheckCircle2 className="w-5 h-5 text-success" />
          : <Clock className="w-5 h-5 text-muted-foreground" />
      ),
    },
    {
      key: 'title',
      header: 'Task',
      accessor: (t) => t.title ?? '',
      render: (t) => (
        <span className={`font-medium ${t.status === 'completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
          {t.title ?? 'Untitled Task'}
        </span>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      accessor: (t) => t.priority ?? 'medium',
      render: (t) => {
        const priority = t.priority ?? 'medium';
        const cls = PRIORITY_BADGES[priority] ?? PRIORITY_BADGES.medium;
        return (
          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border capitalize ${cls}`}>
            {priority}
          </span>
        );
      },
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      accessor: (t) => t.dueDate ?? '',
      render: (t) => {
        if (!t.dueDate) { return <span className="text-muted-foreground text-xs">No due date</span>; }
        const date = new Date(t.dueDate);
        const isOverdue = date < new Date() && t.status !== 'completed';
        return (
          <span className={`text-sm ${isOverdue ? 'text-error font-medium' : 'text-muted-foreground'}`}>
            {date.toLocaleDateString()}
          </span>
        );
      },
    },
    {
      key: 'assignedTo',
      header: 'Assigned To',
      accessor: (t) => t.assignedTo ?? '',
      render: (t) => <span className="text-muted-foreground text-sm">{t.assignedTo ?? '-'}</span>,
    },
  ], []);

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={DEALS_TABS} />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/25">
          <CheckSquare className="w-6 h-6 text-white" />
        </div>
        <div>
          <PageTitle>Deal Tasks</PageTitle>
          <SectionDescription>
            {pendingCount} pending &bull; {completedCount} completed
          </SectionDescription>
        </div>
      </motion.div>

      {error && (
        <div className="p-4 rounded-xl border border-error/20 flex items-center gap-3" style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}>
          <AlertCircle className="w-5 h-5 text-error" />
          <span className="text-error-light">{error}</span>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <DataTable
          columns={columns}
          data={tasks}
          loading={loading}
          searchPlaceholder="Search tasks..."
          searchFilter={(t, q) => (t.title?.toLowerCase().includes(q) ?? false)}
          enableCsvExport
          csvFilename="deal-tasks"
          emptyMessage="No deal-related tasks"
          emptyIcon={<CheckSquare className="w-8 h-8 text-muted-foreground" />}
          accentColor="amber"
        />
      </motion.div>
    </div>
  );
}
