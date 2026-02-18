'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';

interface Subscription {
  userId: string;
  tier: 'free' | 'starter' | 'professional' | 'enterprise';
  billingPeriod?: 'monthly' | 'annual';
  status: 'active' | 'cancelled';
  stripeSubscriptionId?: string;
  cancelledAt?: string;
  cancelAtPeriodEnd?: boolean;
  reactivatedAt?: string;
  provisionedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  previousTier?: string;
  tierChangedAt?: string;
}

interface SubscriptionResponse {
  success: boolean;
  subscription?: Subscription;
  error?: string;
}

const TIER_CONFIG: Record<string, { label: string; color: string; badge: string; monthlyPrice: number; annualPrice: number }> = {
  free: {
    label: 'Free',
    color: 'var(--color-text-secondary)',
    badge: '#374151',
    monthlyPrice: 0,
    annualPrice: 0,
  },
  starter: {
    label: 'Starter',
    color: 'var(--color-info)',
    badge: '#2563eb',
    monthlyPrice: 29,
    annualPrice: 290,
  },
  professional: {
    label: 'Professional',
    color: 'var(--color-success)',
    badge: '#059669',
    monthlyPrice: 79,
    annualPrice: 790,
  },
  enterprise: {
    label: 'Enterprise',
    color: 'var(--color-warning)',
    badge: '#d97706',
    monthlyPrice: 199,
    annualPrice: 1990,
  },
};

export default function BillingPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const loadSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/subscriptions');
      if (res.ok) {
        const data = (await res.json()) as SubscriptionResponse;
        if (data.success && data.subscription) {
          setSubscription(data.subscription);
        }
      }
    } catch {
      toast.error('Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
      void loadSubscription();
    }
  }, [user, loadSubscription]);

  const handleCancel = async () => {
    if (!subscription) { return; }
    setActionLoading(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });
      const data = (await res.json()) as SubscriptionResponse;
      if (data.success && data.subscription) {
        setSubscription(data.subscription);
        toast.success('Subscription cancelled');
      } else {
        throw new Error(data.error ?? 'Failed to cancel');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReactivate = async () => {
    if (!subscription) { return; }
    setActionLoading(true);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reactivate' }),
      });
      const data = (await res.json()) as SubscriptionResponse;
      if (data.success && data.subscription) {
        setSubscription(data.subscription);
        toast.success('Subscription reactivated');
      } else {
        throw new Error(data.error ?? 'Failed to reactivate');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reactivate subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const tier = subscription?.tier ?? 'free';
  const tierConfig = TIER_CONFIG[tier] ?? TIER_CONFIG.free;
  const billingPeriod = subscription?.billingPeriod ?? 'monthly';
  const price = billingPeriod === 'annual' ? tierConfig.annualPrice : tierConfig.monthlyPrice;
  const isActive = subscription?.status !== 'cancelled';
  const isCancelled = subscription?.status === 'cancelled';
  const isProvisioned = subscription?.provisionedBy === 'admin';

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem 2rem',
        borderBottom: '1px solid var(--color-bg-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/settings" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
            Settings
          </Link>
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Billing & Plans</h1>
        </div>
        <Link
          href="/settings/subscription"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--color-primary)',
            color: '#fff',
            borderRadius: '0.375rem',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          Compare Plans
        </Link>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            Loading billing information...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Current Plan Card */}
            <div style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-bg-elevated)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                    Current Plan
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '1.5rem', fontWeight: 700 }}>{tierConfig.label}</span>
                    <span style={{
                      padding: '0.125rem 0.5rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: isActive ? 'var(--color-success)' : 'var(--color-error)',
                    }}>
                      {isActive ? 'Active' : 'Cancelled'}
                    </span>
                    {isProvisioned && (
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: 'rgba(139, 92, 246, 0.15)',
                        color: '#a78bfa',
                      }}>
                        Admin Provisioned
                      </span>
                    )}
                  </div>
                  {tier !== 'free' && (
                    <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                      ${price}/{billingPeriod === 'annual' ? 'year' : 'month'}
                      {billingPeriod === 'annual' && (
                        <span style={{ color: 'var(--color-success)', marginLeft: '0.5rem' }}>
                          Save ${(tierConfig.monthlyPrice * 12) - tierConfig.annualPrice}/year
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '0.75rem',
                  backgroundColor: tierConfig.badge,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                }}>
                  {tier === 'free' ? '🆓' : tier === 'starter' ? '🚀' : tier === 'professional' ? '⭐' : '👑'}
                </div>
              </div>

              {/* Cancellation Warning */}
              {isCancelled && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--color-error)',
                }}>
                  Your subscription was cancelled{subscription?.cancelledAt ? ` on ${new Date(subscription.cancelledAt).toLocaleDateString()}` : ''}.
                  {subscription?.cancelAtPeriodEnd && ' Access continues until the end of the billing period.'}
                </div>
              )}

              {/* Tier Change History */}
              {subscription?.previousTier && subscription.tierChangedAt && (
                <div style={{
                  marginTop: '1rem',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  color: 'var(--color-info)',
                }}>
                  Changed from {TIER_CONFIG[subscription.previousTier]?.label ?? subscription.previousTier} on{' '}
                  {new Date(subscription.tierChangedAt).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Billing Details */}
            <div style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-bg-elevated)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>
                Billing Details
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                    Billing Period
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    {billingPeriod === 'annual' ? 'Annual' : 'Monthly'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                    Status
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: isActive ? 'var(--color-success)' : 'var(--color-error)' }}>
                    {isActive ? 'Active' : 'Cancelled'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                    Member Since
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    {subscription?.createdAt ? new Date(subscription.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                    Payment Method
                  </div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                    {subscription?.stripeSubscriptionId ? 'Stripe' : isProvisioned ? 'Admin Provisioned' : 'None'}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-bg-elevated)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>
                Manage Subscription
              </h3>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link
                  href="/settings/subscription"
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    borderRadius: '0.375rem',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  {tier === 'free' ? 'Upgrade Plan' : 'Change Plan'}
                </Link>

                {isActive && tier !== 'free' && (
                  <button
                    onClick={() => void handleCancel()}
                    disabled={actionLoading}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: 'transparent',
                      border: '1px solid var(--color-error)',
                      color: 'var(--color-error)',
                      borderRadius: '0.375rem',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      opacity: actionLoading ? 0.5 : 1,
                    }}
                  >
                    {actionLoading ? 'Processing...' : 'Cancel Subscription'}
                  </button>
                )}

                {isCancelled && (
                  <button
                    onClick={() => void handleReactivate()}
                    disabled={actionLoading}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: 'var(--color-success)',
                      border: 'none',
                      color: '#fff',
                      borderRadius: '0.375rem',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      opacity: actionLoading ? 0.5 : 1,
                    }}
                  >
                    {actionLoading ? 'Processing...' : 'Reactivate Subscription'}
                  </button>
                )}
              </div>
            </div>

            {/* Usage Summary (placeholder for future metrics) */}
            <div style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-bg-elevated)',
              borderRadius: '0.75rem',
              padding: '1.5rem',
            }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 1rem 0' }}>
                Usage This Period
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {[
                  { label: 'Contacts', value: '—', limit: tier === 'free' ? '100' : 'Unlimited' },
                  { label: 'Emails Sent', value: '—', limit: tier === 'free' ? '500/mo' : tier === 'starter' ? '5,000/mo' : 'Unlimited' },
                  { label: 'AI Credits', value: '—', limit: tier === 'free' ? '50/mo' : tier === 'starter' ? '500/mo' : tier === 'professional' ? '5,000/mo' : 'Unlimited' },
                ].map((metric) => (
                  <div key={metric.label} style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-main)',
                    borderRadius: '0.5rem',
                    textAlign: 'center',
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
                      {metric.label}
                    </div>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>{metric.value}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
                      Limit: {metric.limit}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
