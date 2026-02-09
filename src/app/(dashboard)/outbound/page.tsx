'use client';

import React from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';

export default function OutboundHomePage() {
  const { theme } = useOrgTheme();

  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  const outboundFeatures = [
    {
      icon: '✉️',
      title: 'AI Email Writer',
      description: 'Generate personalized cold emails using AI and prospect research',
      href: `/outbound/email-writer`,
      status: 'Available',
      color: 'var(--color-success)',
    },
    {
      icon: '📧',
      title: 'Email Sequences',
      description: 'Automated multi-step email campaigns with smart triggers',
      href: `/outbound/sequences`,
      status: 'Available',
      color: 'var(--color-success)',
    },
    // Removed "Coming Soon" features to avoid confusion in production
    // - AI Reply Handler
    // - Meeting Scheduler
    // - Prospect Finder
    // - Multi-Channel
    // These can be added back when fully implemented
  ];

  return (
      <div style={{ padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '3rem' }}>
            <Link href="/crm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to CRM
            </Link>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
              Outbound Sales Automation
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '1rem', maxWidth: '800px' }}>
              AI-powered outbound sales tools to find prospects, create personalized outreach, and book meetings automatically
            </p>
          </div>

          {/* Features Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
            {outboundFeatures.map((feature, index) => (
              <Link
                key={index}
                href={feature.status === 'Available' ? feature.href : '#'}
                style={{
                  display: 'block',
                  backgroundColor: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '1rem',
                  padding: '2rem',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  cursor: feature.status === 'Available' ? 'pointer' : 'not-allowed',
                  opacity: feature.status === 'Available' ? 1 : 0.6,
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  if (feature.status === 'Available') {
                    e.currentTarget.style.borderColor = primaryColor;
                    e.currentTarget.style.transform = 'translateY(-4px)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Status Badge */}
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: feature.color,
                  color: 'var(--color-bg-main)',
                  borderRadius: '0.375rem',
                  fontSize: '0.625rem',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {feature.status}
                </div>

                {/* Icon */}
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                  {feature.icon}
                </div>

                {/* Title */}
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
                  {feature.title}
                </h3>

                {/* Description */}
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', lineHeight: '1.6' }}>
                  {feature.description}
                </p>

                {/* Arrow (only for available features) */}
                {feature.status === 'Available' && (
                  <div style={{ 
                    marginTop: '1.5rem',
                    color: primaryColor, 
                    fontSize: '1.5rem',
                    transition: 'transform 0.2s',
                  }}>
                    →
                  </div>
                )}
              </Link>
            ))}
          </div>

          {/* Quick Stats */}
          <div style={{ marginTop: '3rem', backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
              Quick Access
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <Link 
                href={`/settings/subscription`}
                style={{
                  display: 'block',
                  padding: '1rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-bg-elevated)',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = primaryColor}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-bg-elevated)'}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                  Manage Features
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                  Subscription Settings →
                </div>
              </Link>

              <Link 
                href="/crm?view=leads"
                style={{
                  display: 'block',
                  padding: '1rem',
                  backgroundColor: 'var(--color-bg-main)',
                  border: '1px solid var(--color-bg-elevated)',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = primaryColor}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--color-bg-elevated)'}
              >
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
                  View Leads
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                  Lead Management →
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
  );
}










