'use client';

import { getSubCollection } from '@/lib/firebase/collections';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';
import SubpageNav from '@/components/ui/SubpageNav';
import { DASHBOARD_TABS } from '@/lib/constants/subpage-nav';
import { JasperTaskReminder } from '@/components/dashboard/JasperTaskReminder';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import {
  Target,
  Briefcase,
  DollarSign,
  Trophy,
  MessageSquare,
  Bot,
  Mail,
  Share2,
  Globe,
  ShoppingCart,
  BarChart3,
  CheckSquare,
  ArrowRight,
  TrendingUp,
  Send,
  FileText,
  Percent,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface DashboardStats {
  totalLeads: number;
  activeDeals: number;
  conversations: number;
  pipelineValue: number;
  wonDeals: number;
  lostDeals: number;
}

interface ConversationData {
  status?: string;
  outcome?: string;
  createdAt?: FirestoreTimestamp;
  updatedAt?: FirestoreTimestamp;
  leadName?: string;
  subject?: string;
}

interface RecentActivity {
  id: string;
  type: 'deal' | 'lead' | 'conversation' | 'task';
  action: string;
  detail: string;
  time: string;
  timestamp: number;
}

interface PipelineStage {
  stage: string;
  count: number;
  value: number;
  color: string;
}

interface TaskItem {
  id: string;
  title: string;
  priority: string;
  dueDate: string;
  completed: boolean;
}

interface ConversationStats {
  active: number;
  recent: number;
  total: number;
  converted: number;
}

interface AgentHealth {
  total: number;
  functional: number;
  executing: number;
  health: string;
}

interface FirestoreTimestamp {
  seconds: number;
  nanoseconds: number;
}

interface DealData {
  stage?: string;
  status?: string;
  value?: number;
  amount?: number;
  name?: string;
  createdAt?: FirestoreTimestamp;
}

interface LeadData {
  name?: string;
  firstName?: string;
  lastName?: string;
  company?: string;
  createdAt?: FirestoreTimestamp;
}

interface TaskData {
  title?: string;
  name?: string;
  priority?: string;
  status?: string;
  dueDate?: FirestoreTimestamp;
  completed?: boolean;
}

interface AgentStatusResponse {
  success: boolean;
  metrics: {
    totalAgents: number;
    functionalAgents: number;
    executingAgents: number;
  };
  overallHealth: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function WorkspaceDashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0, activeDeals: 0, conversations: 0,
    pipelineValue: 0, wonDeals: 0, lostDeals: 0,
  });
  const [convoStats, setConvoStats] = useState<ConversationStats>({
    active: 0, recent: 0, total: 0, converted: 0,
  });
  const [agentHealth, setAgentHealth] = useState<AgentHealth>({
    total: 0, functional: 0, executing: 0, health: 'UNKNOWN',
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDashboardData() {
      if (!db) { setLoading(false); return; }

      try {
        // Fetch leads
        const leadsQuery = query(
          collection(db, getSubCollection('records')),
          where('entityType', '==', 'leads')
        );
        const leadsSnapshot = await getDocs(leadsQuery);

        // Fetch deals
        const dealsQuery = query(
          collection(db, getSubCollection('records')),
          where('entityType', '==', 'deals')
        );
        const dealsSnapshot = await getDocs(dealsQuery);

        // Calculate pipeline metrics
        let pipelineValue = 0;
        let wonDeals = 0;
        let lostDeals = 0;
        const stageMap: Record<string, { count: number; value: number }> = {};

        dealsSnapshot.forEach((doc) => {
          const data = doc.data() as DealData;
          const stage = (data.stage !== '' && data.stage != null) ? data.stage : ((data.status !== '' && data.status != null) ? data.status : 'Unknown');
          const value = Number(data.value) || Number(data.amount) || 0;

          if (!stageMap[stage]) { stageMap[stage] = { count: 0, value: 0 }; }
          stageMap[stage].count++;
          stageMap[stage].value += value;

          if (stage.toLowerCase().includes('won') || stage.toLowerCase().includes('closed won')) {
            wonDeals++;
          } else if (stage.toLowerCase().includes('lost') || stage.toLowerCase().includes('closed lost')) {
            lostDeals++;
          } else {
            pipelineValue += value;
          }
        });

        const stageColors: Record<string, string> = {
          'Prospecting': 'var(--color-text-secondary)',
          'Qualification': 'var(--color-primary)',
          'Proposal': 'var(--color-primary)',
          'Negotiation': 'var(--color-primary)',
          'Closed Won': 'var(--color-success)',
          'Closed Lost': 'var(--color-error)',
        };
        setPipeline(Object.entries(stageMap).map(([stage, data]) => ({
          stage, count: data.count, value: data.value,
          color: stageColors[stage] ?? 'var(--color-primary)',
        })));

        // Fetch conversations with details
        const convoQuery = query(
          collection(db, getSubCollection('conversations')),
          limit(200)
        );
        const convoSnapshot = await getDocs(convoQuery);
        let activeConvos = 0;
        let recentConvos = 0;
        let convertedConvos = 0;
        const oneDayAgo = Date.now() - 86400000;

        convoSnapshot.forEach((doc) => {
          const data = doc.data() as ConversationData;
          const status = data.status ?? '';
          if (status === 'active' || status === 'open') { activeConvos++; }
          if (status === 'converted' || data.outcome === 'converted') { convertedConvos++; }
          const updatedAt = data.updatedAt?.seconds ?? data.createdAt?.seconds ?? 0;
          if (updatedAt * 1000 > oneDayAgo) { recentConvos++; }
        });

        setConvoStats({
          active: activeConvos,
          recent: recentConvos,
          total: convoSnapshot.size,
          converted: convertedConvos,
        });

        // Fetch tasks from teamTasks collection
        const tasksQuery = query(
          collection(db, getSubCollection('teamTasks')),
          where('status', 'in', ['todo', 'in_progress', 'blocked']),
          limit(5)
        );
        let tasksData: TaskItem[] = [];
        try {
          const tasksSnapshot = await getDocs(tasksQuery);
          tasksData = tasksSnapshot.docs.map((doc) => {
            const data = doc.data() as TaskData;
            return {
              id: doc.id,
              title: (data.title !== '' && data.title != null) ? data.title : 'Untitled Task',
              priority: (data.priority !== '' && data.priority != null) ? data.priority : 'Normal',
              dueDate: data.dueDate ? new Date(data.dueDate.seconds * 1000).toLocaleDateString() : 'No due date',
              completed: data.status === 'completed',
            };
          });
        } catch (_e) {
          logger.info('No tasks found', { file: 'dashboard/page.tsx' });
        }
        setTasks(tasksData);

        // Build activity feed from multiple sources
        const activityData: RecentActivity[] = [];

        const recentDealsQuery = query(
          collection(db, getSubCollection('records')),
          where('entityType', '==', 'deals'),
          orderBy('createdAt', 'desc'),
          limit(3)
        );
        try {
          const snap = await getDocs(recentDealsQuery);
          snap.forEach((doc) => {
            const data = doc.data() as DealData;
            const ts = data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now();
            activityData.push({
              id: doc.id, type: 'deal', action: 'New deal created',
              detail: `${(data.name !== '' && data.name != null) ? data.name : 'Unnamed Deal'} — $${(data.value ?? 0).toLocaleString()}`,
              time: getTimeAgo(new Date(ts)), timestamp: ts,
            });
          });
        } catch (_e) { logger.info('Could not fetch recent deals', { file: 'dashboard/page.tsx' }); }

        const recentLeadsQuery = query(
          collection(db, getSubCollection('records')),
          where('entityType', '==', 'leads'),
          orderBy('createdAt', 'desc'),
          limit(3)
        );
        try {
          const snap = await getDocs(recentLeadsQuery);
          snap.forEach((doc) => {
            const data = doc.data() as LeadData;
            const ts = data.createdAt?.seconds ? data.createdAt.seconds * 1000 : Date.now();
            const name = (data.name !== '' && data.name != null)
              ? data.name
              : `${(data.firstName !== '' && data.firstName != null) ? data.firstName : 'Unknown'} ${(data.lastName !== '' && data.lastName != null) ? data.lastName : ''}`.trim();
            activityData.push({
              id: doc.id, type: 'lead', action: 'New lead',
              detail: `${name} — ${(data.company !== '' && data.company != null) ? data.company : 'No company'}`,
              time: getTimeAgo(new Date(ts)), timestamp: ts,
            });
          });
        } catch (_e) { logger.info('Could not fetch recent leads', { file: 'dashboard/page.tsx' }); }

        activityData.sort((a, b) => b.timestamp - a.timestamp);
        setRecentActivity(activityData.slice(0, 5));

        setStats({
          totalLeads: leadsSnapshot.size,
          activeDeals: dealsSnapshot.size - wonDeals - lostDeals,
          conversations: convoSnapshot.size,
          pipelineValue, wonDeals, lostDeals,
        });

        // Fetch agent health
        try {
          const token = await auth?.currentUser?.getIdToken();
          if (token) {
            const res = await fetch('/api/system/status', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) {
              const data = await res.json() as AgentStatusResponse;
              if (data.success) {
                setAgentHealth({
                  total: data.metrics.totalAgents,
                  functional: data.metrics.functionalAgents,
                  executing: data.metrics.executingAgents,
                  health: data.overallHealth,
                });
              }
            }
          }
        } catch (_e) {
          logger.info('Could not fetch agent status', { file: 'dashboard/page.tsx' });
        }
      } catch (error: unknown) {
        logger.error('Error fetching dashboard data:', error instanceof Error ? error : new Error(String(error)), { file: 'dashboard/page.tsx' });
      } finally {
        setLoading(false);
      }
    }

    void fetchDashboardData();
  }, []);

  const winRate = stats.wonDeals + stats.lostDeals > 0
    ? Math.round((stats.wonDeals / (stats.wonDeals + stats.lostDeals)) * 100)
    : 0;

  const convoConversionRate = convoStats.total > 0
    ? Math.round((convoStats.converted / convoStats.total) * 100)
    : 0;

  const val = (v: number | string) => loading ? '—' : v;

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <PageTitle>Dashboard</PageTitle>
        <SectionDescription className="mt-1">
          Platform overview — everything at a glance.
        </SectionDescription>
      </div>

      <JasperTaskReminder />
      <SubpageNav items={DASHBOARD_TABS} />

      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPICard label="Pipeline" value={val(`$${stats.pipelineValue.toLocaleString()}`)} icon={<DollarSign size={16} />} color="var(--color-success)" href="/deals" />
        <KPICard label="Active Deals" value={val(stats.activeDeals)} icon={<Briefcase size={16} />} color="var(--color-primary)" href="/deals" />
        <KPICard label="Leads" value={val(stats.totalLeads)} icon={<Target size={16} />} color="var(--color-info)" href="/leads" />
        <KPICard label="Win Rate" value={val(`${winRate}%`)} icon={<Trophy size={16} />} color="var(--color-warning)" href="/analytics" subtitle={`${stats.wonDeals}W / ${stats.lostDeals}L`} />
        <KPICard label="Conversations" value={val(convoStats.total)} icon={<MessageSquare size={16} />} color="var(--color-secondary)" href="/conversations" subtitle={`${convoStats.active} active`} />
        <KPICard label="AI Agents" value={val(`${agentHealth.functional}/${agentHealth.total}`)} icon={<Bot size={16} />} color={agentHealth.health === 'HEALTHY' ? 'var(--color-success)' : 'var(--color-warning)'} href="/workforce" subtitle={agentHealth.health !== 'UNKNOWN' ? agentHealth.health : undefined} />
      </div>

      {/* Row 2: Conversations Monitor + Agent Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/conversations" className="no-underline">
          <SectionCard>
            <SectionHeader title="Conversations" icon={<MessageSquare size={16} />} />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              <MiniStat label="Active" value={val(convoStats.active)} color="var(--color-success)" />
              <MiniStat label="Recent (24h)" value={val(convoStats.recent)} color="var(--color-info)" />
              <MiniStat label="Total" value={val(convoStats.total)} color="var(--color-text-secondary)" />
              <MiniStat label="Conversion" value={val(`${convoConversionRate}%`)} color="var(--color-warning)" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Monitor and manage conversations</span>
              <ArrowRight size={12} />
            </div>
          </SectionCard>
        </Link>

        <Link href="/workforce" className="no-underline">
          <SectionCard>
            <SectionHeader title="AI Workforce" icon={<Bot size={16} />} />
            <div className="grid grid-cols-3 gap-3 mt-4">
              <MiniStat label="Functional" value={val(agentHealth.functional)} color="var(--color-success)" />
              <MiniStat label="Executing" value={val(agentHealth.executing)} color="var(--color-primary)" />
              <MiniStat label="Total" value={val(agentHealth.total)} color="var(--color-text-secondary)" />
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{
                    backgroundColor: agentHealth.health === 'HEALTHY' ? 'var(--color-success)' : agentHealth.health === 'DEGRADED' ? 'var(--color-warning)' : 'var(--color-text-disabled)',
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  {agentHealth.health !== 'UNKNOWN' ? agentHealth.health : 'Awaiting data'}
                </span>
              </div>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                Command Center <ArrowRight size={12} />
              </span>
            </div>
          </SectionCard>
        </Link>
      </div>

      {/* Row 3: Pipeline + Marketing + Content */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/deals" className="no-underline">
          <SectionCard>
            <SectionHeader title="Sales Pipeline" icon={<TrendingUp size={16} />} />
            {loading ? (
              <LoadingPlaceholder />
            ) : pipeline.length === 0 ? (
              <EmptyState text="No deals yet" />
            ) : (
              <div className="flex flex-col gap-2 mt-3">
                {pipeline.slice(0, 4).map((stage, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-medium text-foreground">{stage.stage}</span>
                      <span className="text-[0.7rem] text-muted-foreground">{stage.count} · ${stage.value.toLocaleString()}</span>
                    </div>
                    <div className="h-1 rounded-full bg-surface-main overflow-hidden">
                      <div
                        className="h-full transition-[width] duration-300"
                        style={{
                          width: `${Math.min((stage.count / Math.max(...pipeline.map(p => p.count), 1)) * 100, 100)}%`,
                          backgroundColor: stage.color,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <SectionFooter text="View deals" />
          </SectionCard>
        </Link>

        <SectionCard>
          <SectionHeader title="Marketing & Outreach" icon={<Share2 size={16} />} />
          <div className="flex flex-col gap-3 mt-3">
            <NavRow icon={<Mail size={14} />} label="Email Campaigns" href="/email/campaigns" />
            <NavRow icon={<Send size={14} />} label="Sequences" href="/outbound/sequences" />
            <NavRow icon={<Share2 size={14} />} label="Social Hub" href="/social" />
            <NavRow icon={<FileText size={14} />} label="Forms" href="/forms" />
          </div>
          <SectionFooter text="View outreach" />
        </SectionCard>

        <SectionCard>
          <SectionHeader title="Content & Website" icon={<Globe size={16} />} />
          <div className="flex flex-col gap-3 mt-3">
            <NavRow icon={<Globe size={14} />} label="Website Editor" href="/website/editor" />
            <NavRow icon={<BarChart3 size={14} />} label="SEO" href="/website/seo" />
            <NavRow icon={<FileText size={14} />} label="Proposals" href="/proposals" />
            <NavRow icon={<Share2 size={14} />} label="Social Analytics" href="/social/analytics" />
          </div>
          <SectionFooter text="View content" />
        </SectionCard>
      </div>

      {/* Row 4: Activity Feed + Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <SectionCard>
          <SectionHeader title="Recent Activity" icon={<BarChart3 size={16} />} />
          {loading ? (
            <LoadingPlaceholder />
          ) : recentActivity.length === 0 ? (
            <EmptyState text="No recent activity" />
          ) : (
            <div className="flex flex-col gap-2 mt-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-center gap-3 px-3 py-2.5 bg-surface-main border border-surface-elevated rounded-md">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: activity.type === 'deal' ? 'var(--color-success)' : activity.type === 'lead' ? 'var(--color-info)' : 'var(--color-primary)',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-[0.8rem] font-medium text-foreground">{activity.action}</span>
                    <span className="text-[0.8rem] text-muted-foreground ml-2">{activity.detail}</span>
                  </div>
                  <span className="text-[0.7rem] text-muted-foreground shrink-0">{activity.time}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard>
          <SectionHeader title="Tasks" icon={<CheckSquare size={16} />} />
          {loading ? (
            <LoadingPlaceholder />
          ) : tasks.length === 0 ? (
            <EmptyState text="No pending tasks" />
          ) : (
            <div className="flex flex-col gap-2 mt-3">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-center gap-2 px-3 py-2 bg-surface-main border border-surface-elevated rounded-md">
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: task.priority === 'Urgent' ? 'var(--color-error)' : task.priority === 'High' ? 'var(--color-warning)' : 'var(--color-border-main)',
                    }}
                  />
                  <span className="flex-1 text-[0.8rem] text-foreground overflow-hidden text-ellipsis whitespace-nowrap">{task.title}</span>
                  <span className="text-[0.65rem] text-muted-foreground shrink-0">{task.dueDate}</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/team/tasks" className="block mt-3 text-center text-xs text-muted-foreground no-underline hover:text-foreground transition-colors">
            View all tasks <ArrowRight size={10} className="inline align-middle" />
          </Link>
        </SectionCard>
      </div>

      {/* Row 5: Commerce + Analytics Strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/orders" className="no-underline">
          <SectionCard compact>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <ShoppingCart size={16} className="text-warning" />
                <span className="text-sm font-semibold text-foreground">Commerce</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-xs text-muted-foreground hidden sm:inline">Products · Orders · Storefront</span>
                <ArrowRight size={14} className="text-muted-foreground" />
              </div>
            </div>
          </SectionCard>
        </Link>
        <Link href="/analytics" className="no-underline">
          <SectionCard compact>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Percent size={16} className="text-info" />
                <span className="text-sm font-semibold text-foreground">Analytics</span>
              </div>
              <div className="flex items-center gap-6">
                <span className="text-xs text-muted-foreground hidden sm:inline">Revenue · CRM · Attribution · SEO</span>
                <ArrowRight size={14} className="text-muted-foreground" />
              </div>
            </div>
          </SectionCard>
        </Link>
      </div>
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS — Executive Briefing design language
// ============================================================================

function KPICard({ label, value, icon, color, href, subtitle }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; href: string; subtitle?: string;
}) {
  return (
    <Link href={href} className="no-underline">
      <div
        className="bg-card border border-border-strong rounded-xl p-4 transition-colors hover:border-primary/50"
        style={{ borderLeftWidth: '3px', borderLeftColor: color }}
      >
        <div className="flex items-center gap-2 mb-2">
          <span style={{ color }}>{icon}</span>
          <span className="text-[0.7rem] text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        <p className="text-xl font-bold text-foreground m-0">
          {value}
        </p>
        {subtitle && (
          <p className="text-[0.65rem] text-muted-foreground mt-1 m-0">{subtitle}</p>
        )}
      </div>
    </Link>
  );
}

function SectionCard({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`bg-card border border-border-strong rounded-2xl ${compact ? 'px-5 py-4' : 'p-6'}`}>
      {children}
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="text-[0.95rem] font-semibold text-foreground m-0">{title}</h2>
    </div>
  );
}

function SectionFooter({ text }: { text: string }) {
  return (
    <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
      {text} <ArrowRight size={10} />
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div>
      <p className="text-[0.65rem] text-muted-foreground mb-1 uppercase tracking-wide">{label}</p>
      <p className="text-lg font-bold m-0" style={{ color }}>{value}</p>
    </div>
  );
}

function NavRow({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className="flex items-center gap-2.5 px-2.5 py-2 bg-surface-main border border-surface-elevated rounded-md no-underline transition-colors hover:bg-surface-elevated"
    >
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[0.8rem] text-foreground">{label}</span>
      <ArrowRight size={10} className="ml-auto text-muted-foreground" />
    </Link>
  );
}

function LoadingPlaceholder() {
  return (
    <div className="py-6 text-center text-[0.8rem] text-muted-foreground">
      Loading...
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="py-6 text-center text-[0.8rem] text-muted-foreground">
      {text}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) { return 'Just now'; }
  if (diffMins < 60) { return `${diffMins}m ago`; }
  if (diffHours < 24) { return `${diffHours}h ago`; }
  if (diffDays < 7) { return `${diffDays}d ago`; }
  return date.toLocaleDateString();
}
