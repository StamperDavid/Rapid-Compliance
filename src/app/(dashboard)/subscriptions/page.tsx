'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { auth } from '@/lib/firebase/config';
import { logger } from '@/lib/logger/logger';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import {
  Repeat,
  CreditCard,
  Calendar,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Subscription {
  id?: string;
  userId: string;
  tier: string;
  billingPeriod?: string;
  status: string;
  paymentProvider?: string;
  providerSubscriptionId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  lastPaymentAt?: string;
  lastPaymentAmount?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface SubscriptionResponse {
  success: boolean;
  subscription: Subscription;
}

const STATUS_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  active: { color: 'text-success', icon: CheckCircle, label: 'Active' },
  canceled: { color: 'text-error', icon: XCircle, label: 'Canceled' },
  past_due: { color: 'text-warning', icon: AlertCircle, label: 'Past Due' },
  trialing: { color: 'text-info', icon: Clock, label: 'Trial' },
  incomplete: { color: 'text-muted-foreground', icon: Clock, label: 'Incomplete' },
};

const TIER_CONFIG: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'text-muted-foreground' },
  starter: { label: 'Starter', color: 'text-info' },
  professional: { label: 'Professional', color: 'text-primary' },
  enterprise: { label: 'Enterprise', color: 'text-accent' },
};

export default function SubscriptionsPage() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const token = await auth?.currentUser?.getIdToken();
      if (!token) { setLoading(false); return; }

      const res = await fetch('/api/subscriptions', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) { throw new Error('Failed to fetch subscription'); }

      const data = await res.json() as SubscriptionResponse;
      if (data.success) {
        setSubscription(data.subscription);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Failed to load subscription', err instanceof Error ? err : new Error(message));
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSubscription();
  }, [fetchSubscription]);

  const handleManageSubscription = async () => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) { return; }

      const returnUrl = window.location.href;
      const res = await fetch('/api/subscriptions/portal', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ returnUrl }),
      });

      if (res.ok) {
        const data = await res.json() as { url?: string };
        if (data.url) {
          window.location.assign(data.url);
        }
      }
    } catch (err) {
      logger.error('Failed to open portal', err instanceof Error ? err : new Error(String(err)));
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) { return '—'; }
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const statusConfig = STATUS_CONFIG[subscription?.status ?? ''] ?? STATUS_CONFIG.incomplete;
  const StatusIcon = statusConfig?.icon ?? Clock;
  const tierConfig = TIER_CONFIG[subscription?.tier ?? 'free'] ?? TIER_CONFIG.free;

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-surface-elevated rounded" />
          <div className="h-4 w-72 bg-surface-elevated rounded" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            {[1, 2, 3].map(i => <div key={i} className="h-32 bg-surface-elevated rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <PageTitle>Subscriptions</PageTitle>
          <SectionDescription className="mt-1">Manage your subscription plan and billing</SectionDescription>
        </div>
        <Button onClick={() => void handleManageSubscription()} variant="default">
          Manage Billing <ArrowUpRight size={14} className="ml-1" />
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-error/10 border border-error/30 rounded-xl text-error text-sm flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Current Plan Card */}
      <div className="bg-card border border-border-strong rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
            <Repeat size={20} className="text-primary" />
          </div>
          <h2 className="text-xl font-semibold text-foreground">Current Plan</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Tier */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Plan</p>
            <p className={`text-2xl font-bold ${tierConfig.color}`}>{tierConfig.label}</p>
            {subscription?.billingPeriod && (
              <p className="text-xs text-muted-foreground mt-1 capitalize">{subscription.billingPeriod} billing</p>
            )}
          </div>

          {/* Status */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
            <div className={`flex items-center gap-2 ${statusConfig.color}`}>
              <StatusIcon size={18} />
              <span className="text-lg font-semibold">{statusConfig.label}</span>
            </div>
            {subscription?.cancelAtPeriodEnd && (
              <p className="text-xs text-warning mt-1">Cancels at period end</p>
            )}
          </div>

          {/* Billing Period */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Current Period</p>
            <div className="flex items-center gap-2 text-foreground">
              <Calendar size={16} className="text-muted-foreground" />
              <span className="text-sm">
                {formatDate(subscription?.currentPeriodStart)} — {formatDate(subscription?.currentPeriodEnd)}
              </span>
            </div>
          </div>

          {/* Payment Info */}
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Last Payment</p>
            <div className="flex items-center gap-2 text-foreground">
              <CreditCard size={16} className="text-muted-foreground" />
              <span className="text-sm">
                {subscription?.lastPaymentAmount
                  ? `$${(subscription.lastPaymentAmount / 100).toFixed(2)}`
                  : '—'
                }
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatDate(subscription?.lastPaymentAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Provider Info */}
      {subscription?.paymentProvider && (
        <div className="bg-card border border-border-strong rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-foreground mb-4">Payment Provider</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Provider</p>
              <p className="text-sm text-foreground capitalize">{subscription.paymentProvider}</p>
            </div>
            {subscription.providerSubscriptionId && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Subscription ID</p>
                <p className="text-sm text-muted-foreground font-mono">{subscription.providerSubscriptionId}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upgrade CTA for free tier */}
      {subscription?.tier === 'free' && (
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/30 rounded-2xl p-6 text-center">
          <h3 className="text-lg font-semibold text-foreground mb-2">Upgrade Your Plan</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Unlock advanced features, more AI agents, and priority support.
          </p>
          <Button
            onClick={() => window.location.href = '/settings/billing'}
            variant="default"
          >
            View Plans
          </Button>
        </div>
      )}
    </div>
  );
}
