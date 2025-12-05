'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';

interface Subscription {
  id: string;
  organizationId: string;
  organizationName: string;
  plan: 'free' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due' | 'trialing';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  amount: number;
  currency: string;
  billingEmail: string;
}

interface Payment {
  id: string;
  organizationId: string;
  organizationName: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded';
  date: Date;
  invoiceId?: string;
}

export default function BillingPage() {
  const { adminUser, hasPermission } = useAdminAuth();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'subscriptions' | 'payments' | 'invoices'>('subscriptions');

  useEffect(() => {
    setTimeout(() => {
      setSubscriptions([
        {
          id: 'sub-1',
          organizationId: 'org-1',
          organizationName: 'Acme Corporation',
          plan: 'enterprise',
          status: 'active',
          currentPeriodStart: new Date('2024-03-01'),
          currentPeriodEnd: new Date('2024-04-01'),
          amount: 5000,
          currency: 'USD',
          billingEmail: 'billing@acme.com',
        },
        {
          id: 'sub-2',
          organizationId: 'org-2',
          organizationName: 'TechStart Inc',
          plan: 'pro',
          status: 'trialing',
          currentPeriodStart: new Date('2024-03-15'),
          currentPeriodEnd: new Date('2024-04-15'),
          amount: 299,
          currency: 'USD',
          billingEmail: 'admin@techstart.com',
        },
      ]);

      setPayments([
        {
          id: 'pay-1',
          organizationId: 'org-1',
          organizationName: 'Acme Corporation',
          amount: 5000,
          currency: 'USD',
          status: 'succeeded',
          date: new Date('2024-03-01'),
          invoiceId: 'inv-1',
        },
        {
          id: 'pay-2',
          organizationId: 'org-2',
          organizationName: 'TechStart Inc',
          amount: 299,
          currency: 'USD',
          status: 'succeeded',
          date: new Date('2024-03-15'),
          invoiceId: 'inv-2',
        },
      ]);

      setLoading(false);
    }, 500);
  }, []);

  const totalMRR = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + s.amount, 0);

  const totalRevenue = payments
    .filter(p => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0);

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Billing Management
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Manage subscriptions, payments, and invoices
        </p>
      </div>

      {/* Revenue Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Monthly Recurring Revenue" value={`$${totalMRR.toLocaleString()}`} />
        <StatCard label="Total Revenue" value={`$${totalRevenue.toLocaleString()}`} />
        <StatCard label="Active Subscriptions" value={subscriptions.filter(s => s.status === 'active').length} />
        <StatCard label="Trial Subscriptions" value={subscriptions.filter(s => s.status === 'trialing').length} />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: `1px solid ${borderColor}` }}>
        {[
          { id: 'subscriptions', label: 'Subscriptions' },
          { id: 'payments', label: 'Payments' },
          { id: 'invoices', label: 'Invoices' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '0.75rem 1.5rem',
              borderBottom: `2px solid ${activeTab === tab.id ? primaryColor : 'transparent'}`,
              color: activeTab === tab.id ? primaryColor : '#666',
              fontSize: '0.875rem',
              fontWeight: activeTab === tab.id ? '600' : '400',
              backgroundColor: 'transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              cursor: 'pointer',
              marginBottom: '-1px'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'subscriptions' && (
        <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Organization</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Plan</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Period</th>
                <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subscriptions.map((sub) => (
                <tr key={sub.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ fontWeight: '600' }}>{sub.organizationName}</div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>{sub.billingEmail}</div>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: sub.plan === 'enterprise' ? '#7c3aed' : sub.plan === 'pro' ? '#6366f1' : '#6b7280',
                      color: '#fff',
                      textTransform: 'uppercase'
                    }}>
                      {sub.plan}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: sub.status === 'active' ? '#065f46' : sub.status === 'trialing' ? '#78350f' : '#7f1d1d',
                      color: sub.status === 'active' ? '#10b981' : sub.status === 'trialing' ? '#f59e0b' : '#ef4444',
                      textTransform: 'uppercase'
                    }}>
                      {sub.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontWeight: '600' }}>
                    ${sub.amount.toLocaleString()}/{sub.currency === 'USD' ? 'mo' : 'mo'}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#999' }}>
                    {sub.currentPeriodStart.toLocaleDateString()} - {sub.currentPeriodEnd.toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    {hasPermission('canManageSubscriptions') && (
                      <button
                        onClick={() => alert(`Manage subscription ${sub.id} - Feature coming soon`)}
                        style={{
                          padding: '0.375rem 0.75rem',
                          backgroundColor: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: '0.375rem',
                          color: '#999',
                          cursor: 'pointer',
                          fontSize: '0.75rem'
                        }}
                      >
                        Manage
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'payments' && (
        <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Organization</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Amount</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Status</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Invoice</th>
                <th style={{ textAlign: 'right', padding: '1rem', fontSize: '0.875rem', fontWeight: '600', color: '#666' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((payment) => (
                <tr key={payment.id} style={{ borderBottom: `1px solid ${borderColor}` }}>
                  <td style={{ padding: '1rem', fontWeight: '600' }}>{payment.organizationName}</td>
                  <td style={{ padding: '1rem', fontWeight: '600' }}>
                    ${payment.amount.toLocaleString()} {payment.currency}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      backgroundColor: payment.status === 'succeeded' ? '#065f46' : payment.status === 'pending' ? '#78350f' : '#7f1d1d',
                      color: payment.status === 'succeeded' ? '#10b981' : payment.status === 'pending' ? '#f59e0b' : '#ef4444',
                      textTransform: 'uppercase'
                    }}>
                      {payment.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#999' }}>
                    {payment.date.toLocaleDateString()}
                  </td>
                  <td style={{ padding: '1rem', fontSize: '0.875rem', color: '#999' }}>
                    {payment.invoiceId || 'N/A'}
                  </td>
                  <td style={{ padding: '1rem', textAlign: 'right' }}>
                    {hasPermission('canProcessRefunds') && payment.status === 'succeeded' && (
                      <button
                        style={{
                          padding: '0.375rem 0.75rem',
                          backgroundColor: 'transparent',
                          border: `1px solid ${borderColor}`,
                          borderRadius: '0.375rem',
                          color: '#ef4444',
                          fontSize: '0.75rem',
                          cursor: 'pointer'
                        }}
                      >
                        Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'invoices' && (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#666' }}>
          Invoice management coming soon...
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';

  return (
    <div style={{
      backgroundColor: bgPaper,
      border: `1px solid ${borderColor}`,
      borderRadius: '0.5rem',
      padding: '1rem',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#666' }}>{label}</div>
    </div>
  );
}






