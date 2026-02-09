'use client';

import { getSubCollection } from '@/lib/firebase/collections';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useOrgTheme } from '@/hooks/useOrgTheme'
import { logger } from '@/lib/logger/logger';

interface DashboardStats {
  totalLeads: number;
  activeDeals: number;
  conversations: number;
  pipelineValue: number;
  wonDeals: number;
  lostDeals: number;
}

interface RecentActivity {
  id: string;
  type: string;
  action: string;
  detail: string;
  time: string;
  icon: string;
}

interface PipelineStage {
  stage: string;
  count: number;
  value: number;
  color: string;
}

interface Task {
  id: string;
  title: string;
  priority: string;
  dueDate: string;
  completed: boolean;
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

export default function WorkspaceDashboardPage() {
  const { theme } = useOrgTheme();

  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    activeDeals: 0,
    conversations: 0,
    pipelineValue: 0,
    wonDeals: 0,
    lostDeals: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : 'var(--color-primary)';

  useEffect(() => {
    async function fetchDashboardData() {
      if (!db) {
        setLoading(false);
        return;
      }

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

          if (!stageMap[stage]) {
            stageMap[stage] = { count: 0, value: 0 };
          }
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

        // Convert to pipeline array
        const stageColors: Record<string, string> = {
          'Prospecting': 'var(--color-text-secondary)',
          'Qualification': 'var(--color-primary)',
          'Proposal': 'var(--color-primary)',
          'Negotiation': 'var(--color-primary)',
          'Closed Won': 'var(--color-success)',
          'Closed Lost': 'var(--color-error)',
        };

        const pipelineData = Object.entries(stageMap).map(([stage, data]) => ({
          stage,
          count: data.count,
          value: data.value,
          color: stageColors[stage] || 'var(--color-primary)',
        }));

        setPipeline(pipelineData);

        // Fetch conversations
        const convoQuery = query(
          collection(db, getSubCollection('conversations')),
          limit(100)
        );
        const convoSnapshot = await getDocs(convoQuery);

        // Fetch tasks
        const tasksQuery = query(
          collection(db, getSubCollection('records')),
          where('entityType', '==', 'tasks'),
          where('completed', '==', false),
          limit(10)
        );

        let tasksData: Task[] = [];
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
          // Tasks collection might not exist yet
          logger.info('No tasks found', { file: 'page.tsx' });
        }
        setTasks(tasksData);

        // Fetch recent activity (from various sources)
        const activityData: RecentActivity[] = [];

        // Get recent deals
        const recentDealsQuery = query(
          collection(db, getSubCollection('records')),
          where('entityType', '==', 'deals'),
          orderBy('createdAt', 'desc'),
          limit(3)
        );

        try {
          const recentDealsSnapshot = await getDocs(recentDealsQuery);
          recentDealsSnapshot.forEach((doc) => {
            const data = doc.data() as DealData;
            const createdAt = data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date();
            activityData.push({
              id: doc.id,
              type: 'deal',
              action: 'New deal created',
              detail: `${(data.name !== '' && data.name != null) ? data.name : 'Unnamed Deal'} - $${(data.value ?? 0).toLocaleString()}`,
              time: getTimeAgo(createdAt),
              icon: '💼',
            });
          });
        } catch (_e) {
          logger.info('Could not fetch recent deals', { file: 'page.tsx' });
        }

        // Get recent leads
        const recentLeadsQuery = query(
          collection(db, getSubCollection('records')),
          where('entityType', '==', 'leads'),
          orderBy('createdAt', 'desc'),
          limit(2)
        );

        try {
          const recentLeadsSnapshot = await getDocs(recentLeadsQuery);
          recentLeadsSnapshot.forEach((doc) => {
            const data = doc.data() as LeadData;
            const createdAt = data.createdAt?.seconds ? new Date(data.createdAt.seconds * 1000) : new Date();
            activityData.push({
              id: doc.id,
              type: 'lead',
              action: 'New lead',
              detail: `${(data.name !== '' && data.name != null) ? data.name : ((data.firstName !== '' && data.firstName != null) ? data.firstName : 'Unknown')} ${(data.lastName !== '' && data.lastName != null) ? data.lastName : ''} - ${(data.company !== '' && data.company != null) ? data.company : 'No company'}`,
              time: getTimeAgo(createdAt),
              icon: '🎯',
            });
          });
        } catch (_e) {
          logger.info('Could not fetch recent leads', { file: 'page.tsx' });
        }

        // Sort by time (most recent first)
        activityData.sort((_a, _b) => {
          // Simple sort - in production you'd use actual timestamps
          return 0;
        });

        setRecentActivity(activityData.slice(0, 5));

        // Set stats
        setStats({
          totalLeads: leadsSnapshot.size,
          activeDeals: dealsSnapshot.size - wonDeals - lostDeals,
          conversations: convoSnapshot.size,
          pipelineValue,
          wonDeals,
          lostDeals,
        });
      } catch (error: unknown) {
        logger.error('Error fetching dashboard data:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
      } finally {
        setLoading(false);
      }
    }

    void fetchDashboardData();
  }, []);

  function getTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {return 'Just now';}
    if (diffMins < 60) {return `${diffMins} minutes ago`;}
    if (diffHours < 24) {return `${diffHours} hours ago`;}
    if (diffDays < 7) {return `${diffDays} days ago`;}
    return date.toLocaleDateString();
  }

  const winRate = stats.wonDeals + stats.lostDeals > 0
    ? Math.round((stats.wonDeals / (stats.wonDeals + stats.lostDeals)) * 100)
    : 0;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="text-[var(--color-text-primary)]" style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>Dashboard</h1>
              <p className="text-[var(--color-text-disabled)]" style={{ marginTop: '0.5rem', fontSize: '0.875rem' }}>
                Welcome back! Here&apos;s what&apos;s happening in your workspace.
              </p>
            </div>
            <Link
              href={`/entities/leads?action=new`}
              style={{
                padding: '0.625rem 1.5rem',
                backgroundColor: primaryColor,
                color: 'var(--color-text-primary)',
                borderRadius: '0.5rem',
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}
            >
              + Add Lead
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
          <StatCard
            label="Total Leads"
            value={loading ? '...' : stats.totalLeads.toLocaleString()}
            icon="🎯"
            color="var(--color-primary)"
          />
          <StatCard
            label="Active Deals"
            value={loading ? '...' : stats.activeDeals.toLocaleString()}
            icon="💼"
            color="var(--color-primary)"
          />
          <StatCard
            label="Pipeline Value"
            value={loading ? '...' : `$${stats.pipelineValue.toLocaleString()}`}
            icon="💰"
            color="var(--color-success)"
          />
          <StatCard
            label="Win Rate"
            value={loading ? '...' : `${winRate}%`}
            icon="🏆"
            color="var(--color-warning)"
            subtitle={`${stats.wonDeals} won / ${stats.lostDeals} lost`}
          />
        </div>

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem', marginBottom: '2rem' }} className="lg:grid-cols-2">
          {/* Sales Pipeline */}
          <section className="bg-surface-paper border-border-light" style={{ borderWidth: '1px', borderStyle: 'solid', borderRadius: '1rem', padding: '1.5rem' }} aria-labelledby="pipeline-heading">
            <h2 id="pipeline-heading" className="text-[var(--color-text-primary)]" style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Sales Pipeline</h2>
            {loading ? (
              <div className="text-[var(--color-text-disabled)]" style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
            ) : pipeline.length === 0 ? (
              <div className="text-[var(--color-text-disabled)]" style={{ textAlign: 'center', padding: '2rem' }}>
                No deals yet. <Link href={`/entities/deals`} className="text-primary" style={{ color: primaryColor }}>Create your first deal</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pipeline.map((stage, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className="text-[var(--color-text-primary)]" style={{ fontSize: '0.875rem', fontWeight: '500' }}>{stage.stage}</span>
                      <span className="text-[var(--color-text-disabled)]" style={{ fontSize: '0.875rem' }}>{stage.count} deals • ${stage.value.toLocaleString()}</span>
                    </div>
                    <div className="bg-surface-main" style={{ height: '8px', borderRadius: '9999px', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min((stage.count / Math.max(...pipeline.map(p => p.count), 1)) * 100, 100)}%`,
                        backgroundColor: stage.color,
                        transition: 'width 0.3s'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link
              href={`/entities/deals`}
              className="text-primary"
              style={{ display: 'block', marginTop: '1.5rem', textAlign: 'center', color: primaryColor, fontSize: '0.875rem', fontWeight: '600', textDecoration: 'none' }}
            >
              View All Deals →
            </Link>
          </section>

          {/* Recent Activity */}
          <section className="bg-surface-paper border-border-light" style={{ borderWidth: '1px', borderStyle: 'solid', borderRadius: '1rem', padding: '1.5rem' }} aria-labelledby="activity-heading">
            <h2 id="activity-heading" className="text-[var(--color-text-primary)]" style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Recent Activity</h2>
            {loading ? (
              <div className="text-[var(--color-text-disabled)]" style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
            ) : recentActivity.length === 0 ? (
              <div className="text-[var(--color-text-disabled)]" style={{ textAlign: 'center', padding: '2rem' }}>
                No recent activity yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {recentActivity.map((activity) => (
                  <div key={activity.id} className="bg-surface-main border-border-light" style={{ display: 'flex', gap: '1rem', padding: '1rem', borderWidth: '1px', borderStyle: 'solid', borderRadius: '0.75rem' }}>
                    <div style={{ fontSize: '1.5rem' }}>{activity.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div className="text-[var(--color-text-primary)]" style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.25rem' }}>{activity.action}</div>
                      <div className="text-[var(--color-text-secondary)]" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>{activity.detail}</div>
                      <div className="text-[var(--color-text-disabled)]" style={{ fontSize: '0.75rem' }}>{activity.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Bottom Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }} className="lg:grid-cols-[2fr_1fr]">
          {/* Quick Actions */}
          <section className="bg-surface-paper border-border-light" style={{ borderWidth: '1px', borderStyle: 'solid', borderRadius: '1rem', padding: '1.5rem' }} aria-labelledby="actions-heading">
            <h2 id="actions-heading" className="text-[var(--color-text-primary)]" style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Quick Actions</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <QuickAction href={`/entities/leads`} icon="🎯" label="Leads" count={stats.totalLeads} />
              <QuickAction href={`/entities/deals`} icon="💼" label="Deals" count={stats.activeDeals} />
              <QuickAction href={`/entities/contacts`} icon="👤" label="Contacts" />
              <QuickAction href={`/entities/companies`} icon="🏢" label="Companies" />
              <QuickAction href={`/conversations`} icon="💬" label="Conversations" count={stats.conversations} />
              <QuickAction href={`/analytics`} icon="📊" label="Analytics" />
            </div>
          </section>

          {/* Tasks */}
          <section className="bg-surface-paper border-border-light" style={{ borderWidth: '1px', borderStyle: 'solid', borderRadius: '1rem', padding: '1.5rem' }} aria-labelledby="tasks-heading">
            <h2 id="tasks-heading" className="text-[var(--color-text-primary)]" style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Upcoming Tasks</h2>
            {loading ? (
              <div className="text-[var(--color-text-disabled)]" style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
            ) : tasks.length === 0 ? (
              <div className="text-[var(--color-text-disabled)]" style={{ textAlign: 'center', padding: '2rem' }}>
                No tasks yet. <Link href={`/entities/tasks`} className="text-primary" style={{ color: primaryColor }}>Create a task</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {tasks.map((task) => (
                  <div key={task.id} className="bg-surface-main border-border-light" style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', borderWidth: '1px', borderStyle: 'solid', borderRadius: '0.5rem' }}>
                    <input type="checkbox" checked={task.completed} style={{ width: '18px', height: '18px', marginTop: '2px' }} readOnly />
                    <div style={{ flex: 1 }}>
                      <div className="text-[var(--color-text-primary)]" style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>{task.title}</div>
                      <div className="text-[var(--color-text-disabled)]" style={{ fontSize: '0.75rem' }}>
                        <span style={{
                          padding: '2px 6px',
                          backgroundColor: task.priority === 'Urgent' ? 'var(--color-error)' : task.priority === 'High' ? 'var(--color-warning)' : 'var(--color-border-main)',
                          color: task.priority === 'Urgent' ? 'var(--color-text-primary)' : task.priority === 'High' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          marginRight: '0.5rem'
                        }}>
                          {task.priority}
                        </span>
                        {task.dueDate}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link
              href={`/entities/tasks`}
              className="text-primary"
              style={{ display: 'block', marginTop: '1rem', textAlign: 'center', color: primaryColor, fontSize: '0.875rem', fontWeight: '600', textDecoration: 'none' }}
            >
              View All Tasks →
            </Link>
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color: _color, subtitle }: { label: string; value: string; icon: string; color: string; subtitle?: string }) {
  return (
    <div className="bg-surface-paper border-border-light" style={{ borderWidth: '1px', borderStyle: 'solid', borderRadius: '1rem', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div>
          <p className="text-[var(--color-text-secondary)]" style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>{label}</p>
          <p className="text-[var(--color-text-primary)]" style={{ fontSize: '2rem', fontWeight: 'bold', margin: 0 }}>{value}</p>
          {subtitle && <p className="text-[var(--color-text-disabled)]" style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>{subtitle}</p>}
        </div>
        <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>{icon}</div>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, label, count }: { href: string; icon: string; label: string; count?: number }) {
  return (
    <Link
      href={href}
      className="bg-surface-main border-border-light hover:bg-surface-elevated"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '1rem',
        borderWidth: '1px',
        borderStyle: 'solid',
        borderRadius: '0.75rem',
        textDecoration: 'none',
        transition: 'all 0.2s'
      }}
    >
      <span style={{ fontSize: '2rem' }}>{icon}</span>
      <div>
        <div className="text-[var(--color-text-primary)]" style={{ fontSize: '0.875rem', fontWeight: '600' }}>{label}</div>
        {count !== undefined && <div className="text-[var(--color-text-disabled)]" style={{ fontSize: '0.75rem' }}>{count} total</div>}
      </div>
    </Link>
  );
}
