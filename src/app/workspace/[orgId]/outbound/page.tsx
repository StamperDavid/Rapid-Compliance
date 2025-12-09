'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';

export default function OutboundHomePage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const [theme, setTheme] = React.useState<any>(null);

  React.useEffect(() => {
    // LEGACY BACKUP (DO NOT USE): const savedTheme = localStorage.getItem('appTheme');
    // TODO: Load theme from Firestore
  }, []);

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const outboundFeatures = [
    {
      icon: '✉️',
      title: 'AI Email Writer',
      description: 'Generate personalized cold emails using AI and prospect research',
      href: `/workspace/${orgId}/outbound/email-writer`,
      status: 'Available',
      color: '#10b981',
    },
    {
      icon: '📧',
      title: 'Email Sequences',
      description: 'Automated multi-step email campaigns with smart triggers',
      href: `/workspace/${orgId}/outbound/sequences`,
      status: 'Available',
      color: '#10b981',
    },
    {
      icon: '🤖',
      title: 'AI Reply Handler',
      description: 'Automatically respond to prospect emails with AI',
      href: `/workspace/${orgId}/outbound/replies`,
      status: 'Coming Soon',
      color: '#f59e0b',
    },
    {
      icon: '📅',
      title: 'Meeting Scheduler',
      description: 'Autonomous meeting booking and calendar management',
      href: `/workspace/${orgId}/outbound/meetings`,
      status: 'Coming Soon',
      color: '#f59e0b',
    },
    {
      icon: '🔍',
      title: 'Prospect Finder',
      description: 'Find and enrich prospects automatically',
      href: `/workspace/${orgId}/outbound/prospects`,
      status: 'Coming Soon',
      color: '#f59e0b',
    },
    {
      icon: '📱',
      title: 'Multi-Channel',
      description: 'LinkedIn + SMS + Email outreach coordination',
      href: `/workspace/${orgId}/outbound/multi-channel`,
      status: 'Coming Soon',
      color: '#f59e0b',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000' }}>
      <AdminBar />
      
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '3rem' }}>
            <Link href="/crm" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to CRM
            </Link>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
              Outbound Sales Automation
            </h1>
            <p style={{ color: '#999', fontSize: '1rem', maxWidth: '800px' }}>
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
                  backgroundColor: '#1a1a1a',
                  border: '1px solid #333',
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
                  e.currentTarget.style.borderColor = '#333';
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
                  color: '#000',
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
                <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '0.75rem' }}>
                  {feature.title}
                </h3>

                {/* Description */}
                <p style={{ fontSize: '0.875rem', color: '#999', lineHeight: '1.6' }}>
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
          <div style={{ marginTop: '3rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '1.5rem' }}>
              Quick Access
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <Link 
                href={`/workspace/${orgId}/settings/subscription`}
                style={{
                  display: 'block',
                  padding: '1rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #222',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = primaryColor}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#222'}
              >
                <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>
                  Manage Features
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>
                  Subscription Settings →
                </div>
              </Link>

              <Link 
                href="/crm?view=leads"
                style={{
                  display: 'block',
                  padding: '1rem',
                  backgroundColor: '#0a0a0a',
                  border: '1px solid #222',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.borderColor = primaryColor}
                onMouseLeave={(e) => e.currentTarget.style.borderColor = '#222'}
              >
                <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>
                  View Leads
                </div>
                <div style={{ fontSize: '1rem', fontWeight: '600', color: '#fff' }}>
                  Lead Management →
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}










