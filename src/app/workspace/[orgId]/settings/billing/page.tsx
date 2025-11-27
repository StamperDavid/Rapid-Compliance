'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import AdminBar from '@/components/AdminBar';
import { useAuth } from '@/hooks/useAuth';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

export default function BillingSettingsPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState('professional');

  React.useEffect(() => {
    const savedTheme = localStorage.getItem('appTheme');
    if (savedTheme) {
      try {
        setTheme(JSON.parse(savedTheme));
      } catch (error) {
        console.error('Failed to load theme:', error);
      }
    }
  }, []);

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      price: '$29',
      period: 'month',
      features: [
        'Up to 1,000 contacts',
        '1 user',
        'Basic CRM features',
        'Email support',
        '1GB storage'
      ]
    },
    {
      id: 'professional',
      name: 'Professional',
      price: '$99',
      period: 'month',
      features: [
        'Up to 10,000 contacts',
        '5 users',
        'Advanced CRM + AI features',
        'Priority support',
        'Custom schemas',
        '10GB storage',
        'API access'
      ],
      popular: true
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      features: [
        'Unlimited contacts',
        'Unlimited users',
        'Full platform access',
        '24/7 dedicated support',
        'Custom integrations',
        'Unlimited storage',
        'White-label options',
        'SLA guarantee'
      ]
    }
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
              href="/crm"
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
              <span style={{ fontSize: '1.25rem' }}>🏠</span>
              {sidebarOpen && <span>Back to CRM</span>}
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
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <Link href="/workspace/demo-org/settings" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                ← Back to Settings
              </Link>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Billing & Plans</h1>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>
                Manage your subscription, view usage, and update billing information
              </p>
            </div>

            {/* Current Plan */}
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>Current Plan</h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>Professional Plan</div>
                  <div style={{ color: '#999', marginTop: '0.25rem' }}>$99/month • Renews on Dec 15, 2025</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>Usage this month</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: primaryColor }}>3,247 / 10,000 contacts</div>
                </div>
              </div>
              
              {/* Usage Bars */}
              <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#ccc', marginBottom: '0.5rem' }}>
                    <span>Storage</span>
                    <span>4.2 GB / 10 GB</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#0a0a0a', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '42%', height: '100%', backgroundColor: primaryColor }}></div>
                  </div>
                </div>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#ccc', marginBottom: '0.5rem' }}>
                    <span>API Calls</span>
                    <span>12,450 / 50,000</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#0a0a0a', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: '25%', height: '100%', backgroundColor: primaryColor }}></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Available Plans */}
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Available Plans</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {plans.map(plan => (
                  <div
                    key={plan.id}
                    style={{
                      backgroundColor: '#1a1a1a',
                      border: selectedPlan === plan.id ? `2px solid ${primaryColor}` : '1px solid #333',
                      borderRadius: '1rem',
                      padding: '2rem',
                      position: 'relative'
                    }}
                  >
                    {plan.popular && (
                      <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: primaryColor, color: '#fff', padding: '0.25rem 1rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>
                        CURRENT PLAN
                      </div>
                    )}
                    <div style={{ marginBottom: '1.5rem' }}>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>{plan.name}</h3>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                        <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>{plan.price}</span>
                        {plan.period && <span style={{ color: '#999', fontSize: '0.875rem' }}>/{plan.period}</span>}
                      </div>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '1.5rem' }}>
                      {plan.features.map((feature, idx) => (
                        <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ccc', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
                          <span style={{ color: primaryColor }}>✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => setSelectedPlan(plan.id)}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: selectedPlan === plan.id ? '#222' : primaryColor,
                        color: '#fff',
                        border: selectedPlan === plan.id ? '1px solid #333' : 'none',
                        borderRadius: '0.5rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        fontWeight: '600'
                      }}
                    >
                      {selectedPlan === plan.id ? 'Current Plan' : plan.id === 'enterprise' ? 'Contact Sales' : 'Upgrade'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Method */}
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Payment Method</h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ fontSize: '2rem' }}>💳</div>
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Visa ending in 4242</div>
                    <div style={{ fontSize: '0.75rem', color: '#999' }}>Expires 12/2026</div>
                  </div>
                </div>
                <button style={{ padding: '0.5rem 1rem', backgroundColor: '#222', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.875rem' }}>
                  Update
                </button>
              </div>
            </div>

            {/* Billing History */}
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Billing History</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #333' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Description</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Amount</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Status</th>
                      <th style={{ textAlign: 'right', padding: '0.75rem', fontSize: '0.875rem', fontWeight: '600', color: '#999' }}>Invoice</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { date: 'Nov 15, 2025', description: 'Professional Plan', amount: '$99.00', status: 'Paid' },
                      { date: 'Oct 15, 2025', description: 'Professional Plan', amount: '$99.00', status: 'Paid' },
                      { date: 'Sep 15, 2025', description: 'Professional Plan', amount: '$99.00', status: 'Paid' }
                    ].map((invoice, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid #222' }}>
                        <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#ccc' }}>{invoice.date}</td>
                        <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#ccc' }}>{invoice.description}</td>
                        <td style={{ padding: '1rem 0.75rem', fontSize: '0.875rem', color: '#fff', textAlign: 'right', fontWeight: '600' }}>{invoice.amount}</td>
                        <td style={{ padding: '1rem 0.75rem', textAlign: 'center' }}>
                          <span style={{ display: 'inline-block', padding: '0.25rem 0.75rem', backgroundColor: '#0f4c0f', color: '#4ade80', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>
                            {invoice.status}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>
                          <button style={{ color: primaryColor, background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline' }}>
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


