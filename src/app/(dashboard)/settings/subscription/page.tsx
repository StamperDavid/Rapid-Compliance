'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { auth } from '@/lib/firebase/config';
import { SUBSCRIPTION_TIERS, TIER_RANK, type SubscriptionTierKey } from '@/lib/pricing/subscription-tiers';
import { PRICING } from '@/lib/config/pricing';

interface Subscription {
  userId: string;
  tier: string;
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
  const hasHandledCheckoutRef = useRef(false);

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
  const currentTier = (subscription?.tier ?? 'pro') as TierKey;
  const currentRank = TIER_RANK[currentTier] ?? 0;

  // Handle return from Stripe Checkout — runs once per mount via ref guard
  useEffect(() => {
    if (hasHandledCheckoutRef.current) { return; }
    const checkout = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');
    const tier = searchParams.get('tier') as TierKey | null;

    if (checkout === 'success' && sessionId && tier) {
      hasHandledCheckoutRef.current = true;
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
            toast.success('Subscription activated!');
          } else {
            throw new Error(data.error ?? 'Activation failed');
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Failed to activate subscription');
        } finally {
          setChangingTier(null);
          window.history.replaceState({}, '', '/settings/subscription');
        }
      };
      void activateSubscription();
    } else if (checkout === 'cancelled') {
      hasHandledCheckoutRef.current = true;
      toast.error('Checkout was cancelled');
      window.history.replaceState({}, '', '/settings/subscription');
    }
  }, [searchParams, toast]);

  const handleChangePlan = async (targetTier: TierKey) => {
    if (targetTier === currentTier) { return; }
    const targetRank = TIER_RANK[targetTier] ?? 0;
    const isUpgrade = targetRank > currentRank;

    setChangingTier(targetTier);
    try {
      if (isUpgrade) {
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
          return;
        } else {
          throw new Error(data.error ?? 'Failed to create checkout session');
        }
      } else {
        const res = await authFetch('/api/subscriptions', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tier: targetTier, action: 'downgrade' }),
        });
        const data = (await res.json()) as SubscriptionResponse;
        if (data.success) {
          setSubscription(data.subscription ?? null);
          toast.success('Plan updated');
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
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Subscription &amp; Features</h1>
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

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '2rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            Loading plan...
          </div>
        ) : (
          <>
            {/* Flat-rate pricing header */}
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                One Plan. Every Feature. No Tiers.
              </h2>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9375rem', marginBottom: '1.5rem' }}>
                ${PRICING.monthlyPrice}/month flat &mdash; all features included, no record limits, no upsells.
              </p>

              {/* Billing toggle */}
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
                    Save 2 months
                  </span>
                )}
              </div>
            </div>

            {/* Plan Card */}
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              {PLANS.map((plan) => {
                const isCurrent = plan.key === currentTier;
                const price = billingToggle === 'annual' ? plan.annualPrice : plan.monthlyPrice;
                const isChanging = changingTier === plan.key;

                return (
                  <div
                    key={plan.key}
                    style={{
                      backgroundColor: 'var(--color-bg-card)',
                      border: isCurrent
                        ? '2px solid var(--color-primary)'
                        : `2px solid ${plan.color}`,
                      borderRadius: '0.75rem',
                      padding: '2rem',
                      maxWidth: '480px',
                      width: '100%',
                      position: 'relative',
                    }}
                  >
                    {/* Badge */}
                    <div style={{
                      position: 'absolute',
                      top: '-12px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      padding: '0.125rem 0.75rem',
                      backgroundColor: isCurrent ? 'var(--color-primary)' : plan.color,
                      color: '#fff',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      borderRadius: '9999px',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap' as const,
                    }}>
                      {isCurrent ? 'Current Plan' : 'All Features Included'}
                    </div>

                    {/* Icon + Name */}
                    <div style={{ textAlign: 'center', marginBottom: '1rem', marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{plan.icon}</div>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: plan.color }}>
                        {plan.label}
                      </div>
                    </div>

                    {/* Price */}
                    <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                      <span style={{ fontSize: '2.5rem', fontWeight: 800 }}>
                        ${price}
                      </span>
                      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                        /{billingToggle === 'annual' ? 'year' : 'mo'}
                      </span>
                      {billingToggle === 'annual' && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-success)', marginTop: '0.25rem' }}>
                          2 months free vs. monthly
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 1.5rem 0' }}>
                      {plan.features.map((feature) => (
                        <li key={feature} style={{
                          padding: '0.375rem 0',
                          fontSize: '0.875rem',
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

                    {/* CTA */}
                    <button
                      onClick={() => void handleChangePlan(plan.key)}
                      disabled={isCurrent || isChanging}
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        backgroundColor: isCurrent ? 'var(--color-bg-elevated)' : plan.color,
                        color: isCurrent ? 'var(--color-text-muted)' : '#fff',
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        cursor: isCurrent || isChanging ? 'not-allowed' : 'pointer',
                        opacity: isChanging ? 0.5 : 1,
                      }}
                    >
                      {isChanging
                        ? 'Processing...'
                        : isCurrent
                          ? 'Current Plan'
                          : 'Start Free Trial'}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Fair-use limits note */}
            <div style={{
              marginTop: '2rem',
              padding: '1rem 1.5rem',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: '0.5rem',
              fontSize: '0.8125rem',
              color: 'var(--color-text-secondary)',
              textAlign: 'center',
            }}>
              Fair-use limits: {PRICING.fairUseLimits.crmRecords.toLocaleString()} CRM records &bull; {PRICING.fairUseLimits.socialPostsPerMonth.toLocaleString()} social posts/month &bull; {PRICING.fairUseLimits.emailsPerDay.toLocaleString()} emails/day &bull; {PRICING.fairUseLimits.aiAgents} AI agents. Contact support for higher limits.
            </div>
          </>
        )}
      </div>
    </div>
  );
}
