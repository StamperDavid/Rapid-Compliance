'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { getTierConfig } from '@/lib/pricing/subscription-tiers';
import { PageTitle } from '@/components/ui/typography';

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

export default function BillingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const authFetch = useAuthFetch();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [usage, setUsage] = useState<{ contacts: string; emails: string; aiCredits: string }>({
    contacts: '—', emails: '—', aiCredits: '—',
  });

  const loadSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/subscriptions');
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
  }, [toast, authFetch]);

  useEffect(() => {
    if (user) {
      void loadSubscription();
      // Fetch usage metrics
      const fetchUsage = async () => {
        try {
          const res = await authFetch('/api/admin/usage');
          if (res.ok) {
            const data = (await res.json()) as { success: boolean; contacts?: number; emailsSent?: number; aiCredits?: number };
            if (data.success) {
              setUsage({
                contacts: typeof data.contacts === 'number' ? data.contacts.toLocaleString() : '0',
                emails: typeof data.emailsSent === 'number' ? data.emailsSent.toLocaleString() : '0',
                aiCredits: typeof data.aiCredits === 'number' ? data.aiCredits.toLocaleString() : '0',
              });
            }
          }
        } catch {
          // Leave as defaults — non-critical
        }
      };
      void fetchUsage();
    }
  }, [user, loadSubscription, authFetch]);

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await authFetch('/api/subscriptions/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as { success: boolean; url?: string; error?: string };
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error ?? 'Failed to open billing portal');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open billing portal');
      setPortalLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!subscription) { return; }
    setActionLoading(true);
    try {
      const res = await authFetch('/api/subscriptions', {
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
      const res = await authFetch('/api/subscriptions', {
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
  const tierConfig = getTierConfig(tier);
  const billingPeriod = subscription?.billingPeriod ?? 'monthly';
  const price = billingPeriod === 'annual' ? tierConfig.annualPrice : tierConfig.monthlyPrice;
  const isActive = subscription?.status !== 'cancelled';
  const isCancelled = subscription?.status === 'cancelled';
  const isProvisioned = subscription?.provisionedBy === 'admin';

  return (
    <div className="p-8 space-y-6 text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/settings" className="text-muted-foreground no-underline text-sm">
            Settings
          </Link>
          <span className="text-muted-foreground">/</span>
          <PageTitle as="h1" className="text-xl font-semibold m-0">Billing &amp; Plans</PageTitle>
        </div>
        <Link
          href="/settings/subscription"
          className="px-4 py-2 bg-primary text-white rounded no-underline text-sm font-medium"
        >
          Compare Plans
        </Link>
      </div>

      <div className="max-w-4xl">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading billing information...
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {/* Current Plan Card */}
            <div className="bg-card border border-border rounded-xl p-6">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    Current Plan
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl font-bold">{tierConfig.label}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${isActive ? 'bg-green-500/15 text-[var(--color-success)]' : 'bg-red-500/15 text-[var(--color-error)]'}`}>
                      {isActive ? 'Active' : 'Cancelled'}
                    </span>
                    {isProvisioned && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-400">
                        Admin Provisioned
                      </span>
                    )}
                  </div>
                  {tier !== 'free' && (
                    <div className="text-muted-foreground text-sm">
                      ${price}/{billingPeriod === 'annual' ? 'year' : 'month'}
                      {billingPeriod === 'annual' && (
                        <span className="text-[var(--color-success)] ml-2">
                          Save ${(tierConfig.monthlyPrice * 12) - tierConfig.annualPrice}/year
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
                  style={{ backgroundColor: tierConfig.badge }}
                >
                  {tier === 'free' ? '🆓' : tier === 'starter' ? '🚀' : tier === 'professional' ? '⭐' : '👑'}
                </div>
              </div>

              {/* Cancellation Warning */}
              {isCancelled && (
                <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-[var(--color-error)]">
                  Your subscription was cancelled{subscription?.cancelledAt ? ` on ${new Date(subscription.cancelledAt).toLocaleDateString()}` : ''}.
                  {subscription?.cancelAtPeriodEnd && ' Access continues until the end of the billing period.'}
                </div>
              )}

              {/* Tier Change History */}
              {subscription?.previousTier && subscription.tierChangedAt && (
                <div className="mt-4 px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-[var(--color-info)]">
                  Changed from {getTierConfig(subscription.previousTier).label} on{' '}
                  {new Date(subscription.tierChangedAt).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Billing Details */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold mb-4">Billing Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Billing Period</div>
                  <div className="text-sm font-medium">
                    {billingPeriod === 'annual' ? 'Annual' : 'Monthly'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Status</div>
                  <div className={`text-sm font-medium ${isActive ? 'text-[var(--color-success)]' : 'text-[var(--color-error)]'}`}>
                    {isActive ? 'Active' : 'Cancelled'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Member Since</div>
                  <div className="text-sm font-medium">
                    {subscription?.createdAt ? new Date(subscription.createdAt).toLocaleDateString() : '—'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">Payment Method</div>
                  <div className="text-sm font-medium">
                    {subscription?.stripeSubscriptionId ? 'Stripe' : isProvisioned ? 'Admin Provisioned' : 'None'}
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold mb-4">Manage Subscription</h3>
              <div className="flex gap-3 flex-wrap">
                <Link
                  href="/settings/subscription"
                  className="px-4 py-2 bg-primary text-white rounded no-underline text-sm font-medium"
                >
                  {tier === 'free' ? 'Upgrade Plan' : 'Change Plan'}
                </Link>

                {isActive && subscription?.stripeSubscriptionId && !isProvisioned && (
                  <button
                    onClick={() => void handleOpenPortal()}
                    disabled={portalLoading}
                    className={`px-4 py-2 bg-transparent border border-muted-foreground text-foreground rounded text-sm font-medium ${portalLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    {portalLoading ? 'Opening...' : 'Manage Billing'}
                  </button>
                )}

                {isActive && tier !== 'free' && (
                  <button
                    onClick={() => void handleCancel()}
                    disabled={actionLoading}
                    className={`px-4 py-2 bg-transparent border border-[var(--color-error)] text-[var(--color-error)] rounded text-sm font-medium ${actionLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    {actionLoading ? 'Processing...' : 'Cancel Subscription'}
                  </button>
                )}

                {isCancelled && (
                  <button
                    onClick={() => void handleReactivate()}
                    disabled={actionLoading}
                    className={`px-4 py-2 bg-[var(--color-success)] border-none text-white rounded text-sm font-medium ${actionLoading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                  >
                    {actionLoading ? 'Processing...' : 'Reactivate Subscription'}
                  </button>
                )}
              </div>
            </div>

            {/* Usage Summary */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-base font-semibold mb-4">Usage This Period</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { label: 'Contacts', value: usage.contacts, limit: tier === 'free' ? '100' : 'Unlimited' },
                  { label: 'Emails Sent', value: usage.emails, limit: tier === 'free' ? '500/mo' : tier === 'starter' ? '5,000/mo' : 'Unlimited' },
                  { label: 'AI Credits', value: usage.aiCredits, limit: tier === 'free' ? '50/mo' : tier === 'starter' ? '500/mo' : tier === 'professional' ? '5,000/mo' : 'Unlimited' },
                ].map((metric) => (
                  <div key={metric.label} className="p-4 bg-background rounded-lg text-center">
                    <div className="text-xs text-muted-foreground mb-1">{metric.label}</div>
                    <div className="text-xl font-bold">{metric.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">Limit: {metric.limit}</div>
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
