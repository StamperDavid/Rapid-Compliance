'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AdminBar from '@/components/AdminBar';
import { usePermission } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState('30d');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);
  const canViewReports = usePermission('canViewReports');
  const canCreateRecords = usePermission('canCreateRecords');

  // Load theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    }
  }, []);

  const brandName = theme?.branding?.companyName || 'AI CRM';
  const logoUrl = theme?.branding?.logoUrl;
  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  // Dashboard Stats
  const stats = [
    { label: 'Total Revenue', value: '$284,500', change: '+12.5%', trend: 'up', icon: '💰', color: '#10b981' },
    { label: 'Active Deals', value: '47', change: '+8', trend: 'up', icon: '💼', color: '#6366f1' },
    { label: 'New Leads', value: '128', change: '+23%', trend: 'up', icon: '🎯', color: '#ec4899' },
    { label: 'Tasks Due', value: '12', change: '3 overdue', trend: 'down', icon: '✅', color: '#f59e0b' },
  ];

  // Sales Pipeline
  const pipeline = [
    { stage: 'Prospecting', count: 15, value: '$125K', color: '#94a3b8' },
    { stage: 'Qualification', count: 12, value: '$98K', color: '#6366f1' },
    { stage: 'Proposal', count: 8, value: '$156K', color: '#8b5cf6' },
    { stage: 'Negotiation', count: 5, value: '$285K', color: '#ec4899' },
    { stage: 'Closed Won', count: 7, value: '$342K', color: '#10b981' },
  ];

  // Recent Activity
  const recentActivity = [
    { type: 'deal', action: 'Deal closed', detail: 'Enterprise License - $125,000', time: '5 minutes ago', icon: '🎉', color: '#10b981' },
    { type: 'lead', action: 'New lead', detail: 'Sarah Williams from NewTech Inc', time: '23 minutes ago', icon: '🎯', color: '#6366f1' },
    { type: 'task', action: 'Task completed', detail: 'Follow up with Acme Corp', time: '1 hour ago', icon: '✅', color: '#8b5cf6' },
    { type: 'email', action: 'Email sent', detail: 'Quote sent to Global Industries', time: '2 hours ago', icon: '📧', color: '#f59e0b' },
    { type: 'meeting', action: 'Meeting scheduled', detail: 'Demo with Tech Solutions - Tomorrow 2PM', time: '3 hours ago', icon: '📅', color: '#ec4899' },
  ];

  // Todos
  const todos = [
    { id: 1, task: 'Follow up with Acme Corp', priority: 'High', dueDate: 'Today', completed: false },
    { id: 2, task: 'Send proposal to Global Industries', priority: 'Urgent', dueDate: 'Today', completed: false },
    { id: 3, task: 'Review contract with Tech Solutions', priority: 'High', dueDate: 'Tomorrow', completed: false },
    { id: 4, task: 'Prepare Q1 sales report', priority: 'Normal', dueDate: 'This week', completed: false },
  ];

  // AI Performance
  const aiMetrics = [
    { label: 'Lead Scoring Accuracy', value: '94%', change: '+3%', icon: '🎯' },
    { label: 'Response Time', value: '2.3s', change: '-0.4s', icon: '⚡' },
    { label: 'Recommendations', value: '156', change: '+12', icon: '🤖' },
    { label: 'Auto-Actions', value: '89', change: '+7', icon: '🔄' },
  ];

  // Top Performers
  const topPerformers = [
    { name: 'John Doe', deals: 12, revenue: '$342K', avatar: '👨' },
    { name: 'Jane Smith', deals: 10, revenue: '$298K', avatar: '👩' },
    { name: 'Bob Johnson', deals: 8, revenue: '$215K', avatar: '👨' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Sidebar */}
        <div style={{ 
          width: sidebarOpen ? '260px' : '70px',
          backgroundColor: '#0a0a0a',
          borderRight: '1px solid #1a1a1a',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            <Link
              href="/dashboard"
              style={{
                width: '100%',
                padding: '0.875rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: '#1a1a1a',
                color: primaryColor,
                borderLeft: `3px solid ${primaryColor}`,
                fontSize: '0.875rem',
                fontWeight: '600',
                textDecoration: 'none'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>📊</span>
              {sidebarOpen && <span>Dashboard</span>}
            </Link>

            {Object.entries(STANDARD_SCHEMAS).map(([key, schema]) => (
              <Link
                key={key}
                href={`/crm?view=${key}`}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: 'transparent',
                  color: '#999',
                  borderLeft: '3px solid transparent',
                  fontSize: '0.875rem',
                  fontWeight: '400',
                  textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
                {sidebarOpen && <span>{schema.pluralName}</span>}
              </Link>
            ))}
          </nav>

          <div style={{ padding: '1rem', borderTop: '1px solid #1a1a1a' }}>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{
                width: '100%',
                padding: '0.5rem',
                backgroundColor: '#1a1a1a',
                color: '#999',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              {sidebarOpen ? '← Collapse' : '→'}
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>Dashboard</h1>
                  <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    Welcome back! Here&apos;s what&apos;s happening today.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    style={{ padding: '0.625rem 1rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="1y">Last year</option>
                  </select>
                  {canCreateRecords && (
                    <Link href="/crm?action=new" style={{ padding: '0.625rem 1.5rem', backgroundColor: primaryColor, color: '#fff', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '600' }}>
                      + Quick Add
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              {stats.map((stat, idx) => (
                <div key={idx} style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>{stat.label}</p>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>{stat.value}</p>
                    </div>
                    <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>{stat.icon}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: stat.trend === 'up' ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                      {stat.trend === 'up' ? '↑' : '↓'} {stat.change}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>vs last period</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Sales Pipeline */}
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Sales Pipeline</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {pipeline.map((stage, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>{stage.stage}</span>
                        <span style={{ fontSize: '0.875rem', color: '#666' }}>{stage.count} deals • {stage.value}</span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: '#0a0a0a', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(stage.count / 20) * 100}%`, backgroundColor: stage.color, transition: 'width 0.3s' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/crm?view=deals" style={{ display: 'block', marginTop: '1.5rem', textAlign: 'center', color: primaryColor, fontSize: '0.875rem', fontWeight: '600', textDecoration: 'none' }}>
                  View All Deals →
                </Link>
              </div>

              {/* AI Performance */}
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🤖</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>AI Performance</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {aiMetrics.map((metric, idx) => (
                    <div key={idx} style={{ backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '0.75rem', padding: '1rem' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{metric.icon}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>{metric.value}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>{metric.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#10b981' }}>{metric.change}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
              {/* Recent Activity */}
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Recent Activity</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '1rem', padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '0.75rem' }}>
                      <div style={{ fontSize: '1.5rem' }}>{activity.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>{activity.action}</div>
                        <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>{activity.detail}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>{activity.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Todos & Top Performers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Todos */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Today&apos;s Tasks</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {todos.map((todo) => (
                      <div key={todo.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '0.5rem' }}>
                        <input type="checkbox" checked={todo.completed} style={{ width: '18px', height: '18px', marginTop: '2px' }} readOnly />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.875rem', color: '#fff', marginBottom: '0.25rem' }}>{todo.task}</div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>
                            <span style={{ 
                              padding: '2px 6px', 
                              backgroundColor: todo.priority === 'Urgent' ? '#7f1d1d' : todo.priority === 'High' ? '#7c2d12' : '#374151',
                              color: todo.priority === 'Urgent' ? '#fca5a5' : todo.priority === 'High' ? '#fdba74' : '#9ca3af',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              marginRight: '0.5rem'
                            }}>
                              {todo.priority}
                            </span>
                            {todo.dueDate}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/crm?view=tasks" style={{ display: 'block', marginTop: '1rem', textAlign: 'center', color: primaryColor, fontSize: '0.875rem', fontWeight: '600', textDecoration: 'none' }}>
                    View All Tasks →
                  </Link>
                </div>

                {/* Top Performers */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Top Performers</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {topPerformers.map((performer, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      {performer.avatar}
                    </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>{performer.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>{performer.deals} deals • {performer.revenue}</div>
                        </div>
                        <div style={{ fontSize: '1.5rem', color: idx === 0 ? '#fbbf24' : idx === 1 ? '#c0c0c0' : '#cd7f32' }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <Link href="/crm?view=leads" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', textDecoration: 'none', transition: 'all 0.2s' }}>
                <span style={{ fontSize: '2rem' }}>🎯</span>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Leads</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>128 active</div>
                </div>
              </Link>
              <Link href="/crm?view=companies" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', textDecoration: 'none', transition: 'all 0.2s' }}>
                <span style={{ fontSize: '2rem' }}>🏢</span>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Companies</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>89 total</div>
                </div>
              </Link>
              <Link href="/crm?view=contacts" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', textDecoration: 'none', transition: 'all 0.2s' }}>
                <span style={{ fontSize: '2rem' }}>👤</span>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Contacts</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>342 total</div>
                </div>
              </Link>
              <Link href="/crm?view=deals" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', textDecoration: 'none', transition: 'all 0.2s' }}>
                <span style={{ fontSize: '2rem' }}>💼</span>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Deals</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>47 active</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
