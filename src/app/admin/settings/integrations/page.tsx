'use client';

import React, { useState } from 'react';
import Link from 'next/link';

export default function PlatformIntegrationsPage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const handleGmailConnect = () => {
    // Redirect to Google OAuth
    window.location.href = `/api/integrations/google/auth?userId=platform-admin&orgId=platform-admin`;
  };

  const categories = [
    { id: 'all', label: 'All', icon: null },
    { id: 'email', label: 'Email', icon: '📧' },
    { id: 'calendar', label: 'Calendar', icon: '📅' },
  ];

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffffff', marginBottom: '0.5rem' }}>
          Platform Integrations
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Connect platform-level services for email sending and calendar management
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #1f2937', borderRadius: '0.75rem', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Connected</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#6366f1' }}>0</div>
        </div>
        <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #1f2937', borderRadius: '0.75rem', padding: '1.5rem' }}>
          <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Available</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#ffffff' }}>3</div>
        </div>
      </div>

      {/* Category filters */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id === 'all' ? null : cat.id)}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: (!activeCategory && cat.id === 'all') || activeCategory === cat.id ? '#6366f1' : 'transparent',
              border: '1px solid',
              borderColor: (!activeCategory && cat.id === 'all') || activeCategory === cat.id ? '#6366f1' : '#1f2937',
              borderRadius: '0.375rem',
              color: '#ffffff',
              fontSize: '0.875rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            {cat.icon && <span>{cat.icon}</span>}
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Email Section */}
      {(!activeCategory || activeCategory === 'email') && (
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📧</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffffff' }}>Email</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
            {/* Gmail */}
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #1f2937', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '3rem' }}>📧</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ffffff', marginBottom: '0.25rem' }}>
                    Gmail
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#666' }}>
                    Connect your Google Workspace to send emails from the platform
                  </p>
                </div>
              </div>
              <button
                onClick={handleGmailConnect}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#6366f1',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}
              >
                Connect Gmail
              </button>
              <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.75rem', textAlign: 'center' }}>
                You'll be redirected to Google to authorize the connection
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Section */}
      {(!activeCategory || activeCategory === 'calendar') && (
        <div style={{ marginBottom: '3rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '1.5rem' }}>📅</span>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ffffff' }}>Calendar</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: '1.5rem' }}>
            {/* Google Calendar */}
            <div style={{ backgroundColor: '#0a0a0a', border: '1px solid #1f2937', borderRadius: '0.75rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'start', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ fontSize: '3rem' }}>📅</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#ffffff', marginBottom: '0.25rem' }}>
                    Google Calendar
                  </h3>
                  <p style={{ fontSize: '0.875rem', color: '#666' }}>
                    Sync events, meetings, and appointments
                  </p>
                </div>
              </div>
              <button
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  backgroundColor: '#444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.5rem',
                  cursor: 'not-allowed',
                  fontSize: '0.875rem',
                  fontWeight: 600
                }}
                disabled
              >
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



