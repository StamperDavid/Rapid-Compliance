'use client';

/**
 * AI Agents / Tools
 * Management hub for AI agent configuration and orchestration.
 * Uses getSubCollection() for penthouse-model Firestore access.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase/config';

interface AgentStats {
  totalAgentCount: number;
  swarmAgentCount: number;
  standaloneAgentCount: number;
  totalConversations: number;
  trainingMaterialsCount: number;
  trainingSessionsCount: number;
  goldenMastersCount: number;
  workflowsCount: number;
}

interface StatsApiResponse {
  stats: {
    totalAgentCount?: number;
    swarmAgentCount?: number;
    standaloneAgentCount?: number;
    totalConversations?: number;
    trainingMaterialsCount?: number;
    trainingSessionsCount?: number;
    goldenMastersCount?: number;
    workflowsCount?: number;
  };
}

interface AgentCard {
  title: string;
  description: string;
  icon: string;
  href: string;
  status: 'active' | 'available' | 'beta';
  stats: { label: string; value: string }[];
}

function getAgentCards(agentStats: AgentStats | null): AgentCard[] {
  return [
    {
      title: 'Agent Persona',
      description: 'Configure your AI agent\'s knowledge base, personality, and capabilities for sales and customer service.',
      icon: 'P',
      href: '/settings/ai-agents/persona',
      status: 'active',
      stats: [
        { label: 'Knowledge Sources', value: (agentStats?.trainingMaterialsCount ?? 0).toString() },
        { label: 'Golden Masters', value: (agentStats?.goldenMastersCount ?? 0).toString() },
      ],
    },
    {
      title: 'Training Center',
      description: 'Train your agent, review conversations, and deploy Golden Master versions for production use.',
      icon: 'T',
      href: '/settings/ai-agents/training',
      status: 'active',
      stats: [
        { label: 'Training Sessions', value: (agentStats?.trainingSessionsCount ?? 0).toString() },
        { label: 'Golden Masters', value: (agentStats?.goldenMastersCount ?? 0).toString() },
      ],
    },
    {
      title: 'Business Setup',
      description: 'Define business rules, pricing logic, and operational parameters for agent-driven workflows.',
      icon: 'B',
      href: '/settings/ai-agents/business-setup',
      status: 'active',
      stats: [
        { label: 'Workflows', value: (agentStats?.workflowsCount ?? 0).toString() },
        { label: 'Active Agents', value: (agentStats?.standaloneAgentCount ?? 0).toString() },
      ],
    },
    {
      title: 'Agent Configuration',
      description: 'Advanced model parameters, API keys, and integration settings for agent infrastructure.',
      icon: 'C',
      href: '/settings/ai-agents/configuration',
      status: 'active',
      stats: [
        { label: 'Total Agents', value: (agentStats?.totalAgentCount ?? 0).toString() },
        { label: 'Conversations', value: (agentStats?.totalConversations ?? 0).toLocaleString() },
      ],
    },
  ];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'rgba(var(--color-success-rgb), 0.1)', text: 'var(--color-success)', label: 'Active' },
  available: { bg: 'rgba(var(--color-primary-rgb), 0.1)', text: 'var(--color-primary)', label: 'Available' },
  'beta': { bg: 'rgba(var(--color-warning-rgb), 0.1)', text: 'var(--color-warning)', label: 'Beta' },
};

export default function AIAgentsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const data = (await res.json()) as StatsApiResponse;
        setStats({
          totalAgentCount: data.stats.totalAgentCount ?? 51,
          swarmAgentCount: data.stats.swarmAgentCount ?? 47,
          standaloneAgentCount: data.stats.standaloneAgentCount ?? 4,
          totalConversations: data.stats.totalConversations ?? 0,
          trainingMaterialsCount: data.stats.trainingMaterialsCount ?? 0,
          trainingSessionsCount: data.stats.trainingSessionsCount ?? 0,
          goldenMastersCount: data.stats.goldenMastersCount ?? 0,
          workflowsCount: data.stats.workflowsCount ?? 0,
        });
      }
    } catch {
      // Silently fail, will use defaults
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  const activeAgents = stats?.standaloneAgentCount ?? 4;
  const conversationsToday = stats?.totalConversations ?? 0;

  return (
    <div style={{ padding: '2rem' }}>
      <div>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.6875rem', color: 'var(--color-primary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Command Center / {user?.email}
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            AI Agents / Tools
          </h1>
          <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
            Manage your Sales &amp; Customer Service AI Agents for SalesVelocity.ai
          </p>
        </div>

        {/* Overview Stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}
        >
          {[
            { label: 'Active Agents', value: loading ? '...' : activeAgents.toString(), color: 'var(--color-success)' },
            { label: 'Total Agents', value: loading ? '...' : (stats?.totalAgentCount ?? 51).toString(), color: 'var(--color-primary)' },
            { label: 'Conversations', value: loading ? '...' : conversationsToday.toLocaleString(), color: 'var(--color-cyan)' },
            { label: 'Swarm Agents', value: loading ? '...' : (stats?.swarmAgentCount ?? 47).toString(), color: 'var(--color-warning)' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: '1.25rem',
                backgroundColor: 'var(--color-bg-paper)',
                border: '1px solid var(--color-border-main)',
                borderRadius: '0.75rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>
                {stat.label}
              </div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Agent Cards Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
            gap: '1.5rem',
          }}
        >
          {getAgentCards(stats).map((card) => {
            const statusStyle = STATUS_COLORS[card.status];
            return (
              <Link
                key={card.title}
                href={card.href}
                style={{
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  textDecoration: 'none',
                  display: 'block',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(var(--color-primary-rgb), 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-light)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '0.75rem',
                        background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                        fontSize: '1.125rem',
                        flexShrink: 0,
                      }}
                    >
                      {card.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                        {card.title}
                      </h3>
                    </div>
                  </div>
                  <span
                    style={{
                      padding: '0.25rem 0.75rem',
                      backgroundColor: statusStyle.bg,
                      color: statusStyle.text,
                      borderRadius: '9999px',
                      fontSize: '0.6875rem',
                      fontWeight: 600,
                    }}
                  >
                    {statusStyle.label}
                  </span>
                </div>

                <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.6, marginBottom: '1rem' }}>
                  {card.description}
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-paper)',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--color-border-main)',
                  }}
                >
                  {card.stats.map((stat) => (
                    <div key={stat.label}>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', marginBottom: '0.125rem' }}>
                        {stat.label}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {stat.value}
                      </div>
                    </div>
                  ))}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
