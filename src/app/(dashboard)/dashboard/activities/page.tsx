'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import SubpageNav from '@/components/ui/SubpageNav';
import { DASHBOARD_TABS } from '@/lib/constants/subpage-nav';
import { useAuth } from '@/hooks/useAuth';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import {
  Activity,
  Loader2,
  AlertCircle,
  Mail,
  Phone,
  Calendar,
  FileText,
  MessageSquare,
  Target,
  TrendingUp,
  CheckSquare,
} from 'lucide-react';

interface ActivityItem {
  id: string;
  type: string;
  subject?: string;
  body?: string;
  summary?: string;
  createdBy?: string;
  createdByName?: string;
  occurredAt?: string;
  createdAt?: string;
  relatedTo?: { entityType: string; entityId: string; entityName?: string }[];
}

const TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  email_sent: { icon: <Mail className="w-4 h-4" />, color: 'text-blue-400', label: 'Email Sent' },
  email_received: { icon: <Mail className="w-4 h-4" />, color: 'text-cyan-400', label: 'Email Received' },
  email_opened: { icon: <Mail className="w-4 h-4" />, color: 'text-green-400', label: 'Email Opened' },
  call_made: { icon: <Phone className="w-4 h-4" />, color: 'text-purple-400', label: 'Call Made' },
  call_received: { icon: <Phone className="w-4 h-4" />, color: 'text-violet-400', label: 'Call Received' },
  meeting_scheduled: { icon: <Calendar className="w-4 h-4" />, color: 'text-amber-400', label: 'Meeting Scheduled' },
  meeting_completed: { icon: <Calendar className="w-4 h-4" />, color: 'text-emerald-400', label: 'Meeting Completed' },
  note_added: { icon: <FileText className="w-4 h-4" />, color: 'text-gray-400', label: 'Note Added' },
  deal_stage_changed: { icon: <TrendingUp className="w-4 h-4" />, color: 'text-primary', label: 'Deal Stage Changed' },
  lead_status_changed: { icon: <Target className="w-4 h-4" />, color: 'text-orange-400', label: 'Lead Status Changed' },
  task_completed: { icon: <CheckSquare className="w-4 h-4" />, color: 'text-green-400', label: 'Task Completed' },
  ai_chat: { icon: <MessageSquare className="w-4 h-4" />, color: 'text-primary', label: 'AI Chat' },
};

const DEFAULT_CONFIG = { icon: <Activity className="w-4 h-4" />, color: 'text-muted-foreground', label: 'Activity' };

export default function DashboardActivitiesPage() {
  const { loading: authLoading } = useAuth();
  const authFetch = useAuthFetch();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const fetchActivities = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ pageSize: '100' });
      if (filter !== 'all') {
        params.set('types', filter);
      }
      const response = await authFetch(`/api/crm/activities?${params}`);
      if (!response.ok) { throw new Error('Failed to fetch activities'); }
      const result = await response.json() as { data: ActivityItem[] };
      setActivities(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities');
    } finally {
      setLoading(false);
    }
  }, [authFetch, filter]);

  useEffect(() => {
    if (authLoading) { return; }
    void fetchActivities();
  }, [fetchActivities, authLoading]);

  const filterOptions = [
    { value: 'all', label: 'All Activities' },
    { value: 'email_sent,email_received,email_opened', label: 'Emails' },
    { value: 'call_made,call_received', label: 'Calls' },
    { value: 'meeting_scheduled,meeting_completed', label: 'Meetings' },
    { value: 'deal_stage_changed', label: 'Deal Changes' },
    { value: 'lead_status_changed', label: 'Lead Changes' },
  ];

  const formatDate = (dateStr: string | undefined) => {
    if (!dateStr) { return ''; }
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) { return 'Just now'; }
    if (hours < 24) { return `${hours}h ago`; }
    const days = Math.floor(hours / 24);
    if (days < 7) { return `${days}d ago`; }
    return date.toLocaleDateString();
  };

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={DASHBOARD_TABS} />

      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg shadow-primary/25">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <PageTitle>Activities</PageTitle>
            <SectionDescription>{activities.length} activities across all CRM entities</SectionDescription>
          </div>
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                filter === opt.value
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-surface-elevated text-muted-foreground border-border-light hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </motion.div>

      {error && (
        <div className="p-4 rounded-xl border border-error/20 flex items-center gap-3" style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}>
          <AlertCircle className="w-5 h-5 text-error" />
          <span className="text-error-light">{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex items-center gap-3 text-muted-foreground">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span>Loading activities...</span>
          </div>
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-16">
          <Activity className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No activities found</p>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
          {activities.map((activity, idx) => {
            const config = TYPE_CONFIG[activity.type] ?? DEFAULT_CONFIG;
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.02 }}
                className="flex items-start gap-4 p-4 bg-card border border-border-light rounded-xl hover:border-border-strong transition-colors"
              >
                <div className={`mt-0.5 ${config.color}`}>
                  {config.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">{config.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(activity.occurredAt ?? activity.createdAt)}
                    </span>
                  </div>
                  {activity.subject && (
                    <p className="text-sm text-foreground">{activity.subject}</p>
                  )}
                  {activity.summary && (
                    <p className="text-xs text-muted-foreground mt-1">{activity.summary}</p>
                  )}
                  {activity.relatedTo && activity.relatedTo.length > 0 && (
                    <div className="flex gap-2 mt-2">
                      {activity.relatedTo.map((rel, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-surface-elevated text-muted-foreground border border-border-light capitalize">
                          {rel.entityType}: {rel.entityName ?? rel.entityId.slice(0, 8)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {activity.createdByName && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{activity.createdByName}</span>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
