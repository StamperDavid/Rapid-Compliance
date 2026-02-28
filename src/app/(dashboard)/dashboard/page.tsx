'use client';

import { getSubCollection } from '@/lib/firebase/collections';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';
import SubpageNav from '@/components/ui/SubpageNav';
import { DASHBOARD_TABS } from '@/lib/constants/subpage-nav';
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
          color: stageColors[stage] || 'var(--color-primary)',
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

        // Fetch tasks
        const tasksQuery = query(
          collection(db, getSubCollection('records')),
          where('entityType', '==', 'tasks'),
          where('completed', '==', false),
          limit(5)
        );
        let tasksData: TaskItem[] = [];
        try {
          const tasksSnapshot = await getDocs(tasksQuery);
          tasksData = tasksSnapshot.docs.map((doc) => {
            const data = doc.data() as TaskData;
            return {
              id: doc.id,
              title: (data.title !== '' && data.title != null) ? data.title : ((data.name !== '' && data.name != null) ? data.name : 'Untitled Task'),
              priority: (data.priority !== '' && data.priority != null) ? data.priority : 'Normal',
              dueDate: data.dueDate ? new Date(data.dueDate.seconds * 1000).toLocaleDateString() : 'No due date',
              completed: data.completed ?? false,
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
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', color: 'var(--color-text-primary)', margin: 0 }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--color-text-disabled)', marginTop: '0.5rem', fontSize: '0.875rem' }}>
          Platform overview — everything at a glance.
        </p>
      </div>

      <SubpageNav items={DASHBOARD_TABS} />

      {/* Row 1: KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <KPICard label="Pipeline" value={val(`$${stats.pipelineValue.toLocaleString()}`)} icon={<DollarSign size={16} />} color="var(--color-success)" href="/deals" />
        <KPICard label="Active Deals" value={val(stats.activeDeals)} icon={<Briefcase size={16} />} color="var(--color-primary)" href="/deals" />
        <KPICard label="Leads" value={val(stats.totalLeads)} icon={<Target size={16} />} color="var(--color-info)" href="/leads" />
        <KPICard label="Win Rate" value={val(`${winRate}%`)} icon={<Trophy size={16} />} color="var(--color-warning)" href="/analytics" subtitle={`${stats.wonDeals}W / ${stats.lostDeals}L`} />
        <KPICard label="Conversations" value={val(convoStats.total)} icon={<MessageSquare size={16} />} color="var(--color-secondary)" href="/conversations" subtitle={`${convoStats.active} active`} />
        <KPICard label="AI Agents" value={val(`${agentHealth.functional}/${agentHealth.total}`)} icon={<Bot size={16} />} color={agentHealth.health === 'HEALTHY' ? 'var(--color-success)' : 'var(--color-warning)'} href="/workforce" subtitle={agentHealth.health !== 'UNKNOWN' ? agentHealth.health : undefined} />
      </div>

      {/* Row 2: Conversations Monitor + Agent Health */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Conversations Monitor */}
        <Link href="/conversations" style={{ textDecoration: 'none' }}>
          <SectionCard>
            <SectionHeader title="Conversations" icon={<MessageSquare size={16} />} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
              <MiniStat label="Active" value={val(convoStats.active)} color="var(--color-success)" />
              <MiniStat label="Recent (24h)" value={val(convoStats.recent)} color="var(--color-info)" />
              <MiniStat label="Total" value={val(convoStats.total)} color="var(--color-text-secondary)" />
              <MiniStat label="Conversion" value={val(`${convoConversionRate}%`)} color="var(--color-warning)" />
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
              <span>Monitor and manage conversations</span>
              <ArrowRight size={12} />
            </div>
          </SectionCard>
        </Link>

        {/* AI Workforce Health */}
        <Link href="/workforce" style={{ textDecoration: 'none' }}>
          <SectionCard>
            <SectionHeader title="AI Workforce" icon={<Bot size={16} />} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '1rem' }}>
              <MiniStat label="Functional" value={val(agentHealth.functional)} color="var(--color-success)" />
              <MiniStat label="Executing" value={val(agentHealth.executing)} color="var(--color-primary)" />
              <MiniStat label="Total" value={val(agentHealth.total)} color="var(--color-text-secondary)" />
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  backgroundColor: agentHealth.health === 'HEALTHY' ? 'var(--color-success)' : agentHealth.health === 'DEGRADED' ? 'var(--color-warning)' : 'var(--color-text-disabled)',
                }} />
                <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                  {agentHealth.health !== 'UNKNOWN' ? agentHealth.health : 'Awaiting data'}
                </span>
              </div>
              <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                Command Center <ArrowRight size={12} />
              </span>
            </div>
          </SectionCard>
        </Link>
      </div>

      {/* Row 3: Pipeline + Marketing + Content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Sales Pipeline */}
        <Link href="/deals" style={{ textDecoration: 'none' }}>
          <SectionCard>
            <SectionHeader title="Sales Pipeline" icon={<TrendingUp size={16} />} />
            {loading ? (
              <LoadingPlaceholder />
            ) : pipeline.length === 0 ? (
              <EmptyState text="No deals yet" />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
                {pipeline.slice(0, 4).map((stage, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>{stage.stage}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--color-text-disabled)' }}>{stage.count} · ${stage.value.toLocaleString()}</span>
                    </div>
                    <div style={{ height: '4px', borderRadius: '2px', backgroundColor: 'var(--color-bg-main)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min((stage.count / Math.max(...pipeline.map(p => p.count), 1)) * 100, 100)}%`,
                        backgroundColor: stage.color, transition: 'width 0.3s',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <SectionFooter text="View deals" />
          </SectionCard>
        </Link>

        {/* Marketing & Outreach */}
        <Link href="/social/command-center" style={{ textDecoration: 'none' }}>
          <SectionCard>
            <SectionHeader title="Marketing & Outreach" icon={<Share2 size={16} />} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
              <NavRow icon={<Mail size={14} />} label="Email Campaigns" href="/email/campaigns" />
              <NavRow icon={<Send size={14} />} label="Sequences" href="/outbound/sequences" />
              <NavRow icon={<Share2 size={14} />} label="Social Hub" href="/social/command-center" />
              <NavRow icon={<FileText size={14} />} label="Forms" href="/forms" />
            </div>
            <SectionFooter text="View outreach" />
          </SectionCard>
        </Link>

        {/* Content & Website */}
        <Link href="/website/editor" style={{ textDecoration: 'none' }}>
          <SectionCard>
            <SectionHeader title="Content & Website" icon={<Globe size={16} />} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.75rem' }}>
              <NavRow icon={<Globe size={14} />} label="Website Editor" href="/website/editor" />
              <NavRow icon={<BarChart3 size={14} />} label="SEO" href="/website/seo" />
              <NavRow icon={<FileText size={14} />} label="Proposals" href="/proposals" />
              <NavRow icon={<Share2 size={14} />} label="Social Analytics" href="/social/analytics" />
            </div>
            <SectionFooter text="View content" />
          </SectionCard>
        </Link>
      </div>

      {/* Row 4: Activity Feed + Tasks */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        {/* Recent Activity */}
        <SectionCard>
          <SectionHeader title="Recent Activity" icon={<BarChart3 size={16} />} />
          {loading ? (
            <LoadingPlaceholder />
          ) : recentActivity.length === 0 ? (
            <EmptyState text="No recent activity" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
              {recentActivity.map((activity) => (
                <div key={activity.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                  padding: '0.625rem 0.75rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-bg-elevated)',
                  borderRadius: '0.5rem',
                }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: activity.type === 'deal' ? 'var(--color-success)' : activity.type === 'lead' ? 'var(--color-info)' : 'var(--color-primary)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--color-text-primary)' }}>{activity.action}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginLeft: '0.5rem' }}>{activity.detail}</span>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-disabled)', flexShrink: 0 }}>{activity.time}</span>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Tasks */}
        <SectionCard>
          <SectionHeader title="Tasks" icon={<CheckSquare size={16} />} />
          {loading ? (
            <LoadingPlaceholder />
          ) : tasks.length === 0 ? (
            <EmptyState text="No pending tasks" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.75rem' }}>
              {tasks.map((task) => (
                <div key={task.id} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 0.75rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-bg-elevated)',
                  borderRadius: '0.375rem',
                }}>
                  <span style={{
                    width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0,
                    backgroundColor: task.priority === 'Urgent' ? 'var(--color-error)' : task.priority === 'High' ? 'var(--color-warning)' : 'var(--color-border-main)',
                  }} />
                  <span style={{ flex: 1, fontSize: '0.8rem', color: 'var(--color-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--color-text-disabled)', flexShrink: 0 }}>{task.dueDate}</span>
                </div>
              ))}
            </div>
          )}
          <Link href="/team/tasks" style={{ display: 'block', marginTop: '0.75rem', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '0.75rem', textDecoration: 'none' }}>
            View all tasks <ArrowRight size={10} style={{ verticalAlign: 'middle' }} />
          </Link>
        </SectionCard>
      </div>

      {/* Row 5: Commerce + Analytics Strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Link href="/orders" style={{ textDecoration: 'none' }}>
          <SectionCard compact>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <ShoppingCart size={16} style={{ color: 'var(--color-warning)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>Commerce</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Products · Orders · Storefront</span>
                <ArrowRight size={14} style={{ color: 'var(--color-text-disabled)' }} />
              </div>
            </div>
          </SectionCard>
        </Link>
        <Link href="/analytics" style={{ textDecoration: 'none' }}>
          <SectionCard compact>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Percent size={16} style={{ color: 'var(--color-info)' }} />
                <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>Analytics</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>Revenue · CRM · Attribution · SEO</span>
                <ArrowRight size={14} style={{ color: 'var(--color-text-disabled)' }} />
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
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        backgroundColor: 'var(--color-bg-paper)',
        border: '1px solid var(--color-border-strong)',
        borderLeft: `3px solid ${color}`,
        borderRadius: '0.75rem',
        padding: '1rem',
        transition: 'border-color 0.2s',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <span style={{ color }}>{icon}</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
        </div>
        <p style={{ fontSize: '1.375rem', fontWeight: '700', color: 'var(--color-text-primary)', margin: 0 }}>
          {value}
        </p>
        {subtitle && (
          <p style={{ fontSize: '0.65rem', color: 'var(--color-text-disabled)', margin: '0.25rem 0 0 0' }}>{subtitle}</p>
        )}
      </div>
    </Link>
  );
}

function SectionCard({ children, compact }: { children: React.ReactNode; compact?: boolean }) {
  return (
    <div style={{
      backgroundColor: 'var(--color-bg-paper)',
      border: '1px solid var(--color-border-strong)',
      borderRadius: '1rem',
      padding: compact ? '1rem 1.25rem' : '1.25rem 1.5rem',
    }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <span style={{ color: 'var(--color-text-disabled)' }}>{icon}</span>
      <h2 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--color-text-primary)', margin: 0 }}>{title}</h2>
    </div>
  );
}

function SectionFooter({ text }: { text: string }) {
  return (
    <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
      {text} <ArrowRight size={10} />
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div>
      <p style={{ fontSize: '0.65rem', color: 'var(--color-text-disabled)', margin: '0 0 0.25rem 0', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{label}</p>
      <p style={{ fontSize: '1.125rem', fontWeight: '700', color, margin: 0 }}>{value}</p>
    </div>
  );
}

function NavRow({ icon, label, href }: { icon: React.ReactNode; label: string; href: string }) {
  return (
    <Link href={href} onClick={(e) => e.stopPropagation()} style={{
      display: 'flex', alignItems: 'center', gap: '0.625rem',
      padding: '0.5rem 0.625rem',
      backgroundColor: 'var(--color-bg-main)',
      border: '1px solid var(--color-bg-elevated)',
      borderRadius: '0.375rem',
      textDecoration: 'none',
      transition: 'background-color 0.15s',
    }}>
      <span style={{ color: 'var(--color-text-disabled)' }}>{icon}</span>
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-primary)' }}>{label}</span>
      <ArrowRight size={10} style={{ marginLeft: 'auto', color: 'var(--color-text-disabled)' }} />
    </Link>
  );
}

function LoadingPlaceholder() {
  return (
    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '0.8rem' }}>
      Loading...
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '0.8rem' }}>
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
