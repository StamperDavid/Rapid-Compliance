'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { PageTitle, SectionDescription } from '@/components/ui/typography';

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
    },
    {
      title: 'Voice & Speech',
      description: 'Configure Jasper\'s voice provider, select voices, and manage TTS settings',
      icon: '🎙️',
      href: `/settings/ai-agents/voice`,
      stats: [
        { label: 'Provider', value: 'ElevenLabs' },
        { label: 'Voices Available', value: '13' }
      ]
    }
  ];

  return (
    <div className="p-8 space-y-6 overflow-y-auto">
      <div className="max-w-6xl">
        <div className="mb-8">
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 text-sm font-medium no-underline mb-6"
            style={{ color: primaryColor }}
          >
            ← Back to Settings
          </Link>
          <PageTitle className="mt-4">AI Agent</PageTitle>
          <SectionDescription className="mt-1">Manage your Sales &amp; Customer Service AI Agent</SectionDescription>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {agentOptions.map((option) => (
            <Link
              key={option.title}
              href={option.href}
              className="bg-card border border-border rounded-2xl p-8 no-underline block transition-all duration-200 hover:-translate-y-1"
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = primaryColor;
                e.currentTarget.style.boxShadow = `0 10px 40px rgba(var(--color-primary-rgb), 0.2)`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div className="flex items-start gap-6 mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}dd)` }}
                >
                  {option.icon}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-foreground mb-2">
                    {option.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {option.description}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 p-5 bg-background rounded-xl border border-border">
                {option.stats.map((stat) => (
                  <div key={stat.label}>
                    <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
                    <div className="text-lg font-semibold text-foreground">{stat.value}</div>
                  </div>
                ))}
              </div>

              <div
                className="mt-6 py-3 bg-surface-elevated rounded-lg text-center text-sm font-semibold"
                style={{ color: primaryColor }}
              >
                Manage →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

