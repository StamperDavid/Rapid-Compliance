'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';

export default function AIAgentsPage() {
  const { user: _user } = useAuth();
  const { theme } = useOrgTheme();


  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  const agentOptions = [
    {
      title: 'Agent Persona',
      description: 'Configure your AI agent\'s knowledge base, personality, and capabilities',
      icon: '🎭',
      href: `/settings/ai-agents/persona`,
      stats: [
        { label: 'Knowledge Sources', value: '12' },
        { label: 'Last Updated', value: '2 days ago' }
      ]
    },
    {
      title: 'Training Center',
      description: 'Train your agent, review conversations, and deploy Golden Master versions',
      icon: '🎓',
      href: `/settings/ai-agents/training`,
      stats: [
        { label: 'Training Sessions', value: '34' },
        { label: 'Current Version', value: 'v3' }
      ]
    }
  ];

  return (
        <div style={{ padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: '2rem' }}>
              <Link href={`/settings`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                ← Back to Settings
              </Link>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem', marginTop: '1rem' }}>AI Agent</h1>
              <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>Manage your Sales & Customer Service AI Agent</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
              {agentOptions.map((option) => (
                <Link 
                  key={option.title}
                  href={option.href}
                  style={{ 
                    backgroundColor: 'var(--color-bg-paper)', 
                    border: '1px solid var(--color-border-strong)', 
                    borderRadius: '1rem', 
                    padding: '2rem',
                    textDecoration: 'none',
                    display: 'block',
                    transition: 'all 0.2s',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = primaryColor;
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = `0 10px 40px rgba(var(--color-primary-rgb), 0.2)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ 
                      width: '64px', 
                      height: '64px', 
                      borderRadius: '1rem', 
                      background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)`,
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      fontSize: '2rem',
                      flexShrink: 0
                    }}>
                      {option.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                        {option.title}
                      </h3>
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: '1.5' }}>
                        {option.description}
                      </p>
                    </div>
                  </div>
                  
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: '1fr 1fr', 
                    gap: '1rem', 
                    padding: '1.25rem', 
                    backgroundColor: 'var(--color-bg-main)', 
                    borderRadius: '0.75rem',
                    border: '1px solid var(--color-bg-elevated)'
                  }}>
                    {option.stats.map((stat) => (
                      <div key={stat.label}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginBottom: '0.25rem' }}>
                          {stat.label}
                        </div>
                        <div style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ 
                    marginTop: '1.5rem',
                    padding: '0.75rem',
                    backgroundColor: 'var(--color-bg-elevated)',
                    borderRadius: '0.5rem',
                    textAlign: 'center',
                    color: primaryColor,
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}>
                    Manage →
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
  );
}

