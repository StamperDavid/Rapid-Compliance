'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { auth } from '@/lib/firebase/config';
import { SUBSCRIPTION_TIERS, TIER_RANK, type SubscriptionTierKey } from '@/lib/pricing/subscription-tiers';

interface Subscription {
  userId: string;
  tier: 'free' | 'starter' | 'professional' | 'enterprise';
  billingPeriod?: 'monthly' | 'annual';
  status: 'active' | 'cancelled';
  stripeSubscriptionId?: string;
}

interface SubscriptionResponse {
  success: boolean;
  subscription?: Subscription;
  error?: string;
}

type TierKey = SubscriptionTierKey;

const PLANS = SUBSCRIPTION_TIERS;

export default function SubscriptionPage() {
  const { user } = useAuth();
  const toast = useToast();
  const authFetch = useAuthFetch();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingToggle, setBillingToggle] = useState<'monthly' | 'annual'>('monthly');
  const [changingTier, setChangingTier] = useState<string | null>(null);

  const loadSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/subscriptions');
      if (res.ok) {
        const data = (await res.json()) as SubscriptionResponse;
        if (data.success && data.subscription) {
          setSubscription(data.subscription);
          if (data.subscription.billingPeriod) {
            setBillingToggle(data.subscription.billingPeriod);
          }
        }
      }
    } catch {
      toast.error('Failed to load subscription');
    } finally {
      setLoading(false);
    }
  }, [toast, authFetch]);

  useEffect(() => {
    if (user) {
      void loadSubscription();
    }
  }, [user, loadSubscription]);

  const searchParams = useSearchParams();
  const currentTier = subscription?.tier ?? 'free';
  const currentRank = TIER_RANK[currentTier] ?? 0;

  // Handle return from Stripe Checkout
  useEffect(() => {
    const checkout = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    const tier = searchParams.get('tier') as TierKey | null;

    if (checkout === 'success' && sessionId && tier) {
      const activateSubscription = async () => {
        setChangingTier(tier);
        try {
          const token = await auth?.currentUser?.getIdToken();
          const res = await fetch('/api/subscriptions', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: JSON.stringify({
              tier,
              action: 'upgrade',
              stripeSessionId: sessionId,
            }),
          });
          const data = (await res.json()) as SubscriptionResponse;
          if (data.success) {
            setSubscription(data.subscription ?? null);
            toast.success(`Upgraded to ${tier}!`);
          } else {
            throw new Error(data.error ?? 'Activation failed');
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to activate subscription');
        } finally {
          setChangingTier(null);
          // Clean up URL params
          window.history.replaceState({}, '', '/settings/subscription');
        }
      };
      void activateSubscription();
    } else if (checkout === 'cancelled') {
      toast.error('Checkout was cancelled');
      window.history.replaceState({}, '', '/settings/subscription');
    }
  // Run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleChangePlan = async (targetTier: TierKey) => {
    if (targetTier === currentTier) { return; }
    const targetRank = TIER_RANK[targetTier] ?? 0;
    const isUpgrade = targetRank > currentRank;
    const isPaidUpgrade = isUpgrade && targetTier !== 'free';

    setChangingTier(targetTier);
    try {
      if (isPaidUpgrade) {
        // Redirect to Stripe Checkout for paid upgrades
        const token = await auth?.currentUser?.getIdToken();
        const res = await fetch('/api/subscriptions/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            tier: targetTier,
            billingPeriod: billingToggle,
          }),
        });
        const data = (await res.json()) as { success: boolean; url?: string; error?: string };
        if (data.success && data.url) {
          window.location.href = data.url;
          return; // Don't clear changingTier — page is navigating away
        } else {
          throw new Error(data.error ?? 'Failed to create checkout session');
        }
      } else {
        // Downgrade (free or lower paid tier)
        const res = await authFetch('/api/subscriptions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: targetTier, action: 'downgrade' }),
        });
        const data = (await res.json()) as SubscriptionResponse;
        if (data.success) {
          setSubscription(data.subscription ?? null);
          toast.success(targetTier === 'free' ? 'Downgraded to Free plan' : `Changed to ${targetTier} plan`);
        } else {
          throw new Error(data.error ?? 'Plan change failed');
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to change plan');
    } finally {
      setChangingTier(null);
    }
  };

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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Subscription & Features</h1>
        </div>
        <Link
          href="/settings/billing"
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--color-bg-elevated)',
            color: 'var(--color-text-primary)',
            borderRadius: '0.375rem',
            textDecoration: 'none',
            fontSize: '0.875rem',
            fontWeight: 500,
          }}
        >
          Billing Details
        </Link>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            Loading plans...
          </div>
        ) : (
          <>
            {/* Billing Toggle */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.375rem',
                backgroundColor: 'var(--color-bg-elevated)',
                borderRadius: '0.5rem',
              }}>
                <button
                  onClick={() => setBillingToggle('monthly')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    backgroundColor: billingToggle === 'monthly' ? 'var(--color-primary)' : 'transparent',
                    color: billingToggle === 'monthly' ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingToggle('annual')}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    border: 'none',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    backgroundColor: billingToggle === 'annual' ? 'var(--color-primary)' : 'transparent',
                    color: billingToggle === 'annual' ? '#fff' : 'var(--color-text-secondary)',
                  }}
                >
                  Annual
                </button>
                {billingToggle === 'annual' && (
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600 }}>
                    Save ~17%
                  </span>
                )}
              </div>
            </div>

            {/* Plan Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1rem',
            }}>
              {PLANS.map((plan) => {
                const isCurrent = plan.key === currentTier;
                const rank = TIER_RANK[plan.key] ?? 0;
                const isUpgrade = rank > currentRank;
                const isDowngrade = rank < currentRank;
                const price = billingToggle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
                const isChanging = changingTier === plan.key;

                return (
                  <div
                    key={plan.key}
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      border: plan.highlight && !isCurrent
                        ? `2px solid ${plan.color}`
                        : isCurrent
                          ? '2px solid var(--color-primary)'
                          : '1px solid var(--color-bg-elevated)',
                      borderRadius: '0.75rem',
                      padding: '1.5rem',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                    }}
                  >
                    {/* Popular badge */}
                    {plan.highlight && !isCurrent && (
                      <div style={{
                        position: 'absolute',
                        top: '-12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '0.125rem 0.75rem',
                        backgroundColor: plan.color,
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '9999px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        Most Popular
                      </div>
                    )}

                    {/* Current badge */}
                    {isCurrent && (
                      <div style={{
                        position: 'absolute',
                        top: '-12px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        padding: '0.125rem 0.75rem',
                        backgroundColor: 'var(--color-primary)',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        borderRadius: '9999px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>
                        Current Plan
                      </div>
                    )}

                    {/* Icon + Name */}
                    <div style={{ textAlign: 'center', marginBottom: '1rem', marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{plan.icon}</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: 700, color: plan.color }}>
                        {plan.label}
                      </div>
                    </div>

                    {/* Price */}
                    <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                      <span style={{ fontSize: '2rem', fontWeight: 800 }}>
                        ${price}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        /{billingToggle === 'annual' ? 'year' : 'mo'}
                      </span>
                    </div>

                    {/* Features */}
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0', flex: 1 }}>
                      {plan.features.map((feature) => (
                        <li key={feature} style={{
                          padding: '0.375rem 0',
                          fontSize: '0.8125rem',
                          color: 'var(--color-text-secondary)',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.5rem',
                        }}>
                          <span style={{ color: plan.color, flexShrink: 0 }}>✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {/* CTA Button */}
                    <button
                      onClick={() => void handleChangePlan(plan.key)}
                      disabled={isCurrent || isChanging}
                      style={{
                        width: '100%',
                        padding: '0.625rem',
                        borderRadius: '0.375rem',
                        border: isCurrent
                          ? '1px solid var(--color-bg-elevated)'
                          : isDowngrade
                            ? '1px solid var(--color-text-muted)'
                            : 'none',
                        backgroundColor: isCurrent
                          ? 'transparent'
                          : isUpgrade
                            ? plan.color
                            : 'transparent',
                        color: isCurrent
                          ? 'var(--color-text-muted)'
                          : isUpgrade
                            ? '#fff'
                            : 'var(--color-text-secondary)',
                        fontSize: '0.875rem',
                        fontWeight: 600,
                        cursor: isCurrent || isChanging ? 'not-allowed' : 'pointer',
                        opacity: isChanging ? 0.5 : 1,
                      }}
                    >
                      {isChanging
                        ? 'Processing...'
                        : isCurrent
                          ? 'Current Plan'
                          : isUpgrade
                            ? 'Upgrade'
                            : 'Downgrade'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Feature Comparison Table */}
            <div style={{
              marginTop: '3rem',
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-bg-elevated)',
              borderRadius: '0.75rem',
              overflow: 'hidden',
            }}>
              <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-bg-elevated)' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Feature Comparison</h3>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--color-bg-elevated)' }}>
                    <th style={{ padding: '0.75rem 1.5rem', textAlign: 'left', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Feature</th>
                    {PLANS.map((plan) => (
                      <th key={plan.key} style={{
                        padding: '0.75rem 1rem',
                        textAlign: 'center',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: plan.key === currentTier ? 'var(--color-primary)' : plan.color,
                      }}>
                        {plan.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { feature: 'Contacts', values: ['100', '1,000', '10,000', 'Unlimited'] },
                    { feature: 'Emails/month', values: ['500', '5,000', 'Unlimited', 'Unlimited'] },
                    { feature: 'AI Credits/month', values: ['50', '500', '5,000', 'Unlimited'] },
                    { feature: 'Lead Scoring', values: ['—', '✓', '✓', '✓'] },
                    { feature: 'A/B Testing', values: ['—', '✓', '✓', '✓'] },
                    { feature: 'Workflows', values: ['—', '—', '✓', '✓'] },
                    { feature: 'Webhooks', values: ['—', '—', '✓', '✓'] },
                    { feature: 'Custom Branding', values: ['—', '—', '✓', '✓'] },
                    { feature: 'AI Agent Swarm', values: ['—', '—', '—', '✓'] },
                    { feature: 'Voice AI', values: ['—', '—', '—', '✓'] },
                    { feature: 'Video Generation', values: ['—', '—', '—', '✓'] },
                    { feature: 'Support', values: ['Email', 'Priority', 'Phone', 'Dedicated'] },
                  ].map((row, idx) => (
                    <tr key={row.feature} style={{
                      borderBottom: idx < 11 ? '1px solid var(--color-bg-elevated)' : 'none',
                    }}>
                      <td style={{ padding: '0.625rem 1.5rem', fontSize: '0.8125rem', color: 'var(--color-text-primary)' }}>
                        {row.feature}
                      </td>
                      {row.values.map((value, i) => (
                        <td key={`${row.feature}-${PLANS[i]?.key ?? i}`} style={{
                          padding: '0.625rem 1rem',
                          textAlign: 'center',
                          fontSize: '0.8125rem',
                          color: value === '—' ? 'var(--color-text-muted)' : value === '✓' ? 'var(--color-success)' : 'var(--color-text-secondary)',
                        }}>
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
