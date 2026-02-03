'use client';

/**
 * Admin AI Agents / Tools
 * Management hub for AI agent configuration and orchestration.
 * Uses DEFAULT_ORG_ID (rapid-compliance-root) for single-tenant access.
 */

import React from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

interface AgentCard {
  title: string;
  description: string;
  icon: string;
  href: string;
  status: 'active' | 'available' | 'coming-soon';
  stats: { label: string; value: string }[];
}

const AGENT_CARDS: AgentCard[] = [
  {
    title: 'Agent Persona',
    description: 'Configure your AI agent\'s knowledge base, personality, and capabilities for sales and customer service.',
    icon: 'P',
    href: '/settings/ai-agents/persona',
    status: 'active',
    stats: [
      { label: 'Knowledge Sources', value: '12' },
      { label: 'Last Updated', value: '2 days ago' },
    ],
  },
  {
    title: 'Training Center',
    description: 'Train your agent, review conversations, and deploy Golden Master versions for production use.',
    icon: 'T',
    href: '/settings/ai-agents/training',
    status: 'active',
    stats: [
      { label: 'Training Sessions', value: '34' },
      { label: 'Current Version', value: 'v3' },
    ],
  },
  {
    title: 'Business Setup',
    description: 'Define business rules, pricing logic, and operational parameters for agent-driven workflows.',
    icon: 'B',
    href: '/settings/ai-agents/business-setup',
    status: 'active',
    stats: [
      { label: 'Rules Configured', value: '8' },
      { label: 'Workflows', value: '3' },
    ],
  },
  {
    title: 'Agent Configuration',
    description: 'Advanced model parameters, API keys, and integration settings for agent infrastructure.',
    icon: 'C',
    href: '/settings/ai-agents/configuration',
    status: 'active',
    stats: [
      { label: 'Active Models', value: '2' },
      { label: 'API Integrations', value: '5' },
    ],
  },
];

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  active: { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981', label: 'Active' },
  available: { bg: 'rgba(99, 102, 241, 0.1)', text: '#6366f1', label: 'Available' },
  'coming-soon': { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b', label: 'Coming Soon' },
};

export default function AdminAIAgentsPage() {
  const { adminUser } = useAdminAuth();
  const _orgId = DEFAULT_ORG_ID;

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '0.6875rem', color: '#6366f1', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Admin / {adminUser?.email}
            </span>
          </div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
            AI Agents / Tools
          </h1>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
            Manage your Sales &amp; Customer Service AI Agents for RapidCompliance.US
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
            { label: 'Active Agents', value: '4', color: '#10b981' },
            { label: 'Total Training Sessions', value: '34', color: '#6366f1' },
            { label: 'Conversations Today', value: '127', color: '#06b6d4' },
            { label: 'Success Rate', value: '94%', color: '#f59e0b' },
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: '1.25rem',
                backgroundColor: '#0a0a0a',
                border: '1px solid #1a1a1a',
                borderRadius: '0.75rem',
              }}
            >
              <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
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
          {AGENT_CARDS.map((card) => {
            const statusStyle = STATUS_COLORS[card.status];
            return (
              <Link
                key={card.title}
                href={card.href}
                style={{
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  textDecoration: 'none',
                  display: 'block',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#6366f1';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 30px rgba(99, 102, 241, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#333';
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
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: '#fff',
                        fontSize: '1.125rem',
                        flexShrink: 0,
                      }}
                    >
                      {card.icon}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: '#fff', margin: 0 }}>
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

                <p style={{ fontSize: '0.8125rem', color: '#999', lineHeight: 1.6, marginBottom: '1rem' }}>
                  {card.description}
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '0.75rem',
                    padding: '1rem',
                    backgroundColor: '#0a0a0a',
                    borderRadius: '0.5rem',
                    border: '1px solid #222',
                  }}
                >
                  {card.stats.map((stat) => (
                    <div key={stat.label}>
                      <div style={{ fontSize: '0.6875rem', color: '#666', marginBottom: '0.125rem' }}>
                        {stat.label}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: 600, color: '#fff' }}>
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
