'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme'
import { logger } from '@/lib/logger/logger';;

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

export default function WorkspaceDashboardPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const { user } = useAuth();
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

  const primaryColor = (theme?.colors?.primary?.main !== '' && theme?.colors?.primary?.main != null) ? theme.colors.primary.main : '#6366f1';

  useEffect(() => {
    async function fetchDashboardData() {
      if (!db || !orgId) {
        setLoading(false);
        return;
      }

      try {
        // Fetch leads
        const leadsQuery = query(
          collection(db, 'organizations', orgId, 'records'),
          where('entityType', '==', 'leads')
        );
        const leadsSnapshot = await getDocs(leadsQuery);

        // Fetch deals
        const dealsQuery = query(
          collection(db, 'organizations', orgId, 'records'),
          where('entityType', '==', 'deals')
        );
        const dealsSnapshot = await getDocs(dealsQuery);

        // Calculate pipeline metrics
        let pipelineValue = 0;
        let wonDeals = 0;
        let lostDeals = 0;
        const stageMap: Record<string, { count: number; value: number }> = {};

        dealsSnapshot.forEach((doc) => {
          const data = doc.data();
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
          'Prospecting': '#94a3b8',
          'Qualification': '#6366f1',
          'Proposal': '#8b5cf6',
          'Negotiation': '#ec4899',
          'Closed Won': '#10b981',
          'Closed Lost': '#ef4444',
        };

        const pipelineData = Object.entries(stageMap).map(([stage, data]) => ({
          stage,
          count: data.count,
          value: data.value,
          color: stageColors[stage] || '#6366f1',
        }));

        setPipeline(pipelineData);

        // Fetch conversations
        const convoQuery = query(
          collection(db, 'organizations', orgId, 'conversations'),
          limit(100)
        );
        const convoSnapshot = await getDocs(convoQuery);

        // Fetch tasks
        const tasksQuery = query(
          collection(db, 'organizations', orgId, 'records'),
          where('entityType', '==', 'tasks'),
          where('completed', '==', false),
          limit(10)
        );
        
        let tasksData: Task[] = [];
        try {
          const tasksSnapshot = await getDocs(tasksQuery);
          tasksData = tasksSnapshot.docs.map((doc) => {
            const data = doc.data();
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
          collection(db, 'organizations', orgId, 'records'),
          where('entityType', '==', 'deals'),
          orderBy('createdAt', 'desc'),
          limit(3)
        );
        
        try {
          const recentDealsSnapshot = await getDocs(recentDealsQuery);
          recentDealsSnapshot.forEach((doc) => {
            const data = doc.data();
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
          collection(db, 'organizations', orgId, 'records'),
          where('entityType', '==', 'leads'),
          orderBy('createdAt', 'desc'),
          limit(2)
        );
        
        try {
          const recentLeadsSnapshot = await getDocs(recentLeadsQuery);
          recentLeadsSnapshot.forEach((doc) => {
            const data = doc.data();
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
      } catch (error) {
        logger.error('Error fetching dashboard data:', error, { file: 'page.tsx' });
      } finally {
        setLoading(false);
      }
    }

    fetchDashboardData();
  }, [orgId]);

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
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>Dashboard</h1>
              <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                Welcome back! Here's what's happening in your workspace.
              </p>
            </div>
            <Link 
              href={`/workspace/${orgId}/entities/leads?action=new`}
              style={{ 
                padding: '0.625rem 1.5rem', 
                backgroundColor: primaryColor, 
                color: '#fff', 
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
            color="#6366f1"
          />
          <StatCard 
            label="Active Deals" 
            value={loading ? '...' : stats.activeDeals.toLocaleString()} 
            icon="💼" 
            color="#8b5cf6"
          />
          <StatCard 
            label="Pipeline Value" 
            value={loading ? '...' : `$${stats.pipelineValue.toLocaleString()}`} 
            icon="💰" 
            color="#10b981"
          />
          <StatCard 
            label="Win Rate" 
            value={loading ? '...' : `${winRate}%`} 
            icon="🏆" 
            color="#f59e0b"
            subtitle={`${stats.wonDeals} won / ${stats.lostDeals} lost`}
          />
        </div>

        {/* Main Content Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Sales Pipeline */}
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Sales Pipeline</h3>
            {loading ? (
              <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>Loading...</div>
            ) : pipeline.length === 0 ? (
              <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
                No deals yet. <Link href={`/workspace/${orgId}/entities/deals`} style={{ color: primaryColor }}>Create your first deal</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {pipeline.map((stage, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>{stage.stage}</span>
                      <span style={{ fontSize: '0.875rem', color: '#666' }}>{stage.count} deals • ${stage.value.toLocaleString()}</span>
                    </div>
                    <div style={{ height: '8px', backgroundColor: '#0a0a0a', borderRadius: '9999px', overflow: 'hidden' }}>
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
              href={`/workspace/${orgId}/entities/deals`} 
              style={{ display: 'block', marginTop: '1.5rem', textAlign: 'center', color: primaryColor, fontSize: '0.875rem', fontWeight: '600', textDecoration: 'none' }}
            >
              View All Deals →
            </Link>
          </div>

          {/* Recent Activity */}
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Recent Activity</h3>
            {loading ? (
              <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>Loading...</div>
            ) : recentActivity.length === 0 ? (
              <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
                No recent activity yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {recentActivity.map((activity) => (
                  <div key={activity.id} style={{ display: 'flex', gap: '1rem', padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '0.75rem' }}>
                    <div style={{ fontSize: '1.5rem' }}>{activity.icon}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>{activity.action}</div>
                      <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>{activity.detail}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>{activity.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
          {/* Quick Actions */}
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Quick Actions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <QuickAction href={`/workspace/${orgId}/entities/leads`} icon="🎯" label="Leads" count={stats.totalLeads} />
              <QuickAction href={`/workspace/${orgId}/entities/deals`} icon="💼" label="Deals" count={stats.activeDeals} />
              <QuickAction href={`/workspace/${orgId}/entities/contacts`} icon="👤" label="Contacts" />
              <QuickAction href={`/workspace/${orgId}/entities/companies`} icon="🏢" label="Companies" />
              <QuickAction href={`/workspace/${orgId}/conversations`} icon="💬" label="Conversations" count={stats.conversations} />
              <QuickAction href={`/workspace/${orgId}/analytics`} icon="📊" label="Analytics" />
            </div>
          </div>

          {/* Tasks */}
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Upcoming Tasks</h3>
            {loading ? (
              <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>Loading...</div>
            ) : tasks.length === 0 ? (
              <div style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
                No tasks yet. <Link href={`/workspace/${orgId}/entities/tasks`} style={{ color: primaryColor }}>Create a task</Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {tasks.map((task) => (
                  <div key={task.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '0.5rem' }}>
                    <input type="checkbox" checked={task.completed} style={{ width: '18px', height: '18px', marginTop: '2px' }} readOnly />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.875rem', color: '#fff', marginBottom: '0.25rem' }}>{task.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>
                        <span style={{ 
                          padding: '2px 6px', 
                          backgroundColor: task.priority === 'Urgent' ? '#7f1d1d' : task.priority === 'High' ? '#7c2d12' : '#374151',
                          color: task.priority === 'Urgent' ? '#fca5a5' : task.priority === 'High' ? '#fdba74' : '#9ca3af',
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
              href={`/workspace/${orgId}/entities/tasks`} 
              style={{ display: 'block', marginTop: '1rem', textAlign: 'center', color: primaryColor, fontSize: '0.875rem', fontWeight: '600', textDecoration: 'none' }}
            >
              View All Tasks →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color, subtitle }: { label: string; value: string; icon: string; color: string; subtitle?: string }) {
  return (
    <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>{label}</p>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>{value}</p>
          {subtitle && <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>{subtitle}</p>}
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
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '1rem', 
        padding: '1rem', 
        backgroundColor: '#0a0a0a', 
        border: '1px solid #222', 
        borderRadius: '0.75rem', 
        textDecoration: 'none', 
        transition: 'all 0.2s' 
      }}
    >
      <span style={{ fontSize: '2rem' }}>{icon}</span>
      <div>
        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>{label}</div>
        {count !== undefined && <div style={{ fontSize: '0.75rem', color: '#666' }}>{count} total</div>}
      </div>
    </Link>
  );
}








