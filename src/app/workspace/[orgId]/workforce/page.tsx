'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

interface AgentConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  status: 'active' | 'training' | 'paused' | 'inactive';
  lastActivity?: string;
  tasksCompleted?: number;
  accuracy?: number;
}

/**
 * Workforce Command Center
 * Central hub for managing all AI agents and autonomous systems
 */
export default function WorkforceCommandCenterPage() {
  const params = useParams();
  const _orgId = params.orgId as string;
  const { user: _user } = useAuth();

  // Agent configurations with toggles
  const [agents, setAgents] = useState<AgentConfig[]>([
    {
      id: 'sales-agent',
      name: 'Sales Agent',
      description: 'Handles inbound inquiries, qualifies leads, and books meetings',
      icon: '🤝',
      status: 'active',
      lastActivity: '2 minutes ago',
      tasksCompleted: 1247,
      accuracy: 94,
    },
    {
      id: 'email-agent',
      name: 'Email Writer',
      description: 'Generates personalized outreach emails and follow-ups',
      icon: '✉️',
      status: 'active',
      lastActivity: '5 minutes ago',
      tasksCompleted: 3421,
      accuracy: 91,
    },
    {
      id: 'voice-agent',
      name: 'Voice AI',
      description: 'Handles phone calls, voicemails, and call summaries',
      icon: '📞',
      status: 'training',
      lastActivity: '1 hour ago',
      tasksCompleted: 156,
      accuracy: 87,
    },
    {
      id: 'video-agent',
      name: 'Video Director',
      description: 'Creates storyboards and orchestrates video generation',
      icon: '🎬',
      status: 'active',
      lastActivity: '15 minutes ago',
      tasksCompleted: 89,
      accuracy: 96,
    },
    {
      id: 'social-agent',
      name: 'Social Media Agent',
      description: 'Autonomous posting, engagement, and trend monitoring',
      icon: '📱',
      status: 'active',
      lastActivity: '30 minutes ago',
      tasksCompleted: 567,
      accuracy: 92,
    },
    {
      id: 'seo-agent',
      name: 'SEO Analyst',
      description: 'Keyword research, content optimization, and ranking tracking',
      icon: '🔍',
      status: 'paused',
      lastActivity: '2 hours ago',
      tasksCompleted: 234,
      accuracy: 89,
    },
    {
      id: 'research-agent',
      name: 'Lead Researcher',
      description: 'Enriches leads with company data, contacts, and insights',
      icon: '🔬',
      status: 'active',
      lastActivity: '10 minutes ago',
      tasksCompleted: 892,
      accuracy: 95,
    },
    {
      id: 'proposal-agent',
      name: 'Proposal Generator',
      description: 'Creates customized proposals and quotes from templates',
      icon: '📄',
      status: 'active',
      lastActivity: '45 minutes ago',
      tasksCompleted: 156,
      accuracy: 93,
    },
    {
      id: 'scraper-agent',
      name: 'Web Intelligence',
      description: 'Scrapes competitor data, pricing, and market intelligence',
      icon: '🕷️',
      status: 'inactive',
      lastActivity: 'Never',
      tasksCompleted: 0,
      accuracy: 0,
    },
  ]);

  const toggleAgent = (agentId: string) => {
    setAgents(prev => prev.map(agent => {
      if (agent.id === agentId) {
        const newStatus = agent.status === 'active' ? 'paused' : 'active';
        return { ...agent, status: newStatus };
      }
      return agent;
    }));
  };

  const getStatusColor = (status: AgentConfig['status']) => {
    switch (status) {
      case 'active': return '#22c55e';
      case 'training': return '#eab308';
      case 'paused': return '#f59e0b';
      case 'inactive': return '#666';
    }
  };

  const getStatusLabel = (status: AgentConfig['status']) => {
    switch (status) {
      case 'active': return 'ACTIVE';
      case 'training': return 'TRAINING';
      case 'paused': return 'PAUSED';
      case 'inactive': return 'INACTIVE';
    }
  };

  const activeCount = agents.filter(a => a.status === 'active').length;
  const totalTasks = agents.reduce((sum, a) => sum + (a.tasksCompleted ?? 0), 0);
  const avgAccuracy = Math.round(agents.filter(a => a.accuracy).reduce((sum, a) => sum + (a.accuracy ?? 0), 0) / agents.filter(a => a.accuracy).length);

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)',
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: '#fff',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <span>🎛️</span> Workforce Command Center
            </h1>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
              Manage your autonomous AI workforce from a single dashboard
            </p>
          </div>

          {/* Master Controls */}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'rgba(34, 197, 94, 0.1)',
                border: '1px solid #22c55e',
                borderRadius: '0.5rem',
                color: '#22c55e',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>▶️</span> Activate All
            </button>
            <button
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid #ef4444',
                borderRadius: '0.5rem',
                color: '#ef4444',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>⏸️</span> Pause All
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          {[
            { label: 'Active Agents', value: `${activeCount}/${agents.length}`, color: '#22c55e', icon: '🤖' },
            { label: 'Tasks Completed', value: totalTasks.toLocaleString(), color: '#6366f1', icon: '✅' },
            { label: 'Avg. Accuracy', value: `${avgAccuracy}%`, color: '#f59e0b', icon: '🎯' },
            { label: 'System Status', value: 'Operational', color: '#22c55e', icon: '💚' },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                backgroundColor: 'rgba(26, 26, 26, 0.8)',
                border: '1px solid #333',
                borderRadius: '1rem',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{stat.icon}</span>
                <span style={{ color: '#666', fontSize: '0.75rem' }}>{stat.label}</span>
              </div>
              <div style={{ color: stat.color, fontSize: '1.5rem', fontWeight: '700' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Agent Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '1rem',
        }}>
          {agents.map((agent) => (
            <div
              key={agent.id}
              style={{
                backgroundColor: 'rgba(26, 26, 26, 0.8)',
                border: `1px solid ${agent.status === 'active' ? '#333' : '#222'}`,
                borderRadius: '1rem',
                padding: '1.5rem',
                opacity: agent.status === 'inactive' ? 0.6 : 1,
              }}
            >
              {/* Agent Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '1rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '2rem' }}>{agent.icon}</span>
                  <div>
                    <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', margin: 0 }}>
                      {agent.name}
                    </h3>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      marginTop: '0.25rem',
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        backgroundColor: getStatusColor(agent.status),
                        borderRadius: '50%',
                      }} />
                      <span style={{
                        color: getStatusColor(agent.status),
                        fontSize: '0.625rem',
                        fontWeight: '600',
                        letterSpacing: '0.05em',
                      }}>
                        {getStatusLabel(agent.status)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Toggle Switch */}
                <button
                  onClick={() => toggleAgent(agent.id)}
                  disabled={agent.status === 'training' || agent.status === 'inactive'}
                  style={{
                    width: '48px',
                    height: '26px',
                    backgroundColor: agent.status === 'active' ? '#22c55e' : '#333',
                    borderRadius: '13px',
                    border: 'none',
                    cursor: agent.status === 'training' || agent.status === 'inactive' ? 'not-allowed' : 'pointer',
                    position: 'relative',
                    transition: 'background-color 0.2s',
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: agent.status === 'active' ? '25px' : '3px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>

              {/* Description */}
              <p style={{
                color: '#999',
                fontSize: '0.75rem',
                lineHeight: '1.5',
                marginBottom: '1rem',
              }}>
                {agent.description}
              </p>

              {/* Stats */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '0.5rem',
              }}>
                <div>
                  <div style={{ color: '#666', fontSize: '0.625rem', marginBottom: '0.125rem' }}>
                    Tasks
                  </div>
                  <div style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '600' }}>
                    {agent.tasksCompleted?.toLocaleString() ?? '-'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: '0.625rem', marginBottom: '0.125rem' }}>
                    Accuracy
                  </div>
                  <div style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '600' }}>
                    {agent.accuracy ? `${agent.accuracy}%` : '-'}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#666', fontSize: '0.625rem', marginBottom: '0.125rem' }}>
                    Last Active
                  </div>
                  <div style={{ color: '#999', fontSize: '0.75rem' }}>
                    {agent.lastActivity}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div style={{
                display: 'flex',
                gap: '0.5rem',
                marginTop: '1rem',
              }}>
                <button
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '0.375rem',
                    color: '#999',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Configure
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '0.375rem',
                    color: '#999',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  View Logs
                </button>
                <button
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    backgroundColor: '#1a1a1a',
                    border: '1px solid #333',
                    borderRadius: '0.375rem',
                    color: '#999',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                  }}
                >
                  Train
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Activity Feed */}
        <div style={{
          marginTop: '2rem',
          backgroundColor: 'rgba(26, 26, 26, 0.8)',
          border: '1px solid #333',
          borderRadius: '1rem',
          padding: '1.5rem',
        }}>
          <h2 style={{ color: '#fff', fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
            Recent Activity
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {[
              { agent: 'Sales Agent', action: 'Qualified lead', detail: 'john@acme.com marked as hot lead', time: '2 min ago', icon: '🤝' },
              { agent: 'Email Writer', action: 'Sent follow-up', detail: '3 personalized emails queued', time: '5 min ago', icon: '✉️' },
              { agent: 'Video Director', action: 'Storyboard complete', detail: 'Product demo video ready for review', time: '15 min ago', icon: '🎬' },
              { agent: 'Social Media', action: 'Post scheduled', detail: 'LinkedIn post scheduled for 2pm', time: '30 min ago', icon: '📱' },
              { agent: 'Lead Researcher', action: 'Enriched contact', detail: 'Added 12 new data points to lead', time: '45 min ago', icon: '🔬' },
            ].map((activity, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.75rem',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '0.5rem',
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{activity.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '500' }}>
                    {activity.agent}: {activity.action}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.75rem' }}>
                    {activity.detail}
                  </div>
                </div>
                <div style={{ color: '#666', fontSize: '0.75rem' }}>
                  {activity.time}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
