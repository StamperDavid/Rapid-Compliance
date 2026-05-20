'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { PageTitle } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { PRICING } from '@/lib/config/pricing';

type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'cancelled';

interface Subscription {
  userId: string;
  status: string;
  paymentProvider?: string;
  providerSubscriptionId?: string;
  stripeSubscriptionId?: string;
  trialEndsAt?: string;
  currentPeriodEnd?: string;
  cancelAtPeriodEnd?: boolean;
  cancelledAt?: string;
  reactivatedAt?: string;
  provisionedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface SubscriptionResponse {
  success: boolean;
  subscription?: Subscription | null;
  error?: string;
}

interface CheckoutResponse {
  success: boolean;
  url?: string;
  error?: string;
}

const PRICE = PRICING.monthlyPrice;
const TRIAL_DAYS = PRICING.trial.days;

export default function BillingPage() {
  const { user } = useAuth();
  const toast = useToast();
  const authFetch = useAuthFetch();
  const searchParams = useSearchParams();

  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [startingTrial, setStartingTrial] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelArmed, setCancelArmed] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [usage, setUsage] = useState<{ contacts: string; emails: string; socialPosts: string }>({
    contacts: '-',
    emails: '-',
    socialPosts: '-',
  });
  const cancelDisarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const checkoutHandledRef = useRef(false);

  const loadSubscription = useCallback(async () => {
    try {
      setLoading(true);
      const res = await authFetch('/api/subscriptions');
      if (res.ok) {
        const data = (await res.json()) as SubscriptionResponse;
        if (data.success) {
          setSubscription(data.subscription ?? null);
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
      const fetchUsage = async () => {
        try {
          const res = await authFetch('/api/admin/usage');
          if (res.ok) {
            const data = (await res.json()) as {
              success: boolean;
              contacts?: number;
              emailsSent?: number;
              socialPosts?: number;
              aiCredits?: number;
            };
            if (data.success) {
              const social = typeof data.socialPosts === 'number'
                ? data.socialPosts
                : typeof data.aiCredits === 'number' ? data.aiCredits : 0;
              setUsage({
                contacts: typeof data.contacts === 'number' ? data.contacts.toLocaleString() : '0',
                emails: typeof data.emailsSent === 'number' ? data.emailsSent.toLocaleString() : '0',
                socialPosts: social.toLocaleString(),
              });
            }
          }
        } catch {
          // Leave defaults. Non-critical.
        }
      };
      void fetchUsage();
    }
  }, [user, loadSubscription, authFetch]);

  // Handle return from Stripe Checkout: ?checkout=success&session_id=X
  useEffect(() => {
    if (checkoutHandledRef.current || !user) { return; }
    const checkoutState = searchParams.get('checkout');
    const sessionId = searchParams.get('session_id');

    if (checkoutState === 'success' && sessionId) {
      checkoutHandledRef.current = true;
      const finalize = async () => {
        try {
          const res = await authFetch('/api/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ checkoutSessionId: sessionId }),
          });
          const data = (await res.json()) as SubscriptionResponse;
          if (data.success && data.subscription) {
            setSubscription(data.subscription);
            toast.success('Your 14-day free trial has started.');
          } else {
            toast.error(data.error ?? 'Failed to activate subscription');
          }
        } catch {
          toast.error('Failed to activate subscription');
        }
      };
      void finalize();
    } else if (checkoutState === 'cancelled') {
      checkoutHandledRef.current = true;
      toast.error('Checkout cancelled.');
    }
  }, [searchParams, user, authFetch, toast]);

  const handleStartTrial = async () => {
    setStartingTrial(true);
    try {
      const res = await authFetch('/api/subscriptions/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as CheckoutResponse;
      if (data.success && data.url) {
        window.location.href = data.url;
        return;
      }
      throw new Error(data.error ?? 'Failed to start checkout');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start checkout');
      setStartingTrial(false);
    }
  };

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
        return;
      }
      throw new Error(data.error ?? 'Failed to open billing portal');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open billing portal');
      setPortalLoading(false);
    }
  };

  const armCancel = () => {
    setCancelArmed(true);
    if (cancelDisarmTimer.current) { clearTimeout(cancelDisarmTimer.current); }
    cancelDisarmTimer.current = setTimeout(() => setCancelArmed(false), 5000);
  };

  const disarmCancel = () => {
    setCancelArmed(false);
    if (cancelDisarmTimer.current) { clearTimeout(cancelDisarmTimer.current); }
  };

  const handleCancel = async () => {
    if (!cancelArmed) {
      armCancel();
      return;
    }
    disarmCancel();
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
        toast.success('Subscription cancelled. Access continues until period end.');
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
        toast.success('Subscription reactivated.');
      } else {
        throw new Error(data.error ?? 'Failed to reactivate');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reactivate subscription');
    } finally {
      setActionLoading(false);
    }
  };

  const status = subscription?.status as SubscriptionStatus | undefined;
  const isProvisioned = subscription?.provisionedBy === 'admin';
  const hasProviderSubscription = Boolean(
    subscription?.providerSubscriptionId ?? subscription?.stripeSubscriptionId
  );

  return (
    <div className="p-8 space-y-6 text-foreground">
      <div className="flex items-center gap-4">
        <Link href="/settings" className="text-muted-foreground no-underline text-sm">
          Settings
        </Link>
        <span className="text-muted-foreground">/</span>
        <PageTitle as="h1" className="text-xl font-semibold m-0">Subscription</PageTitle>
      </div>

      <div className="max-w-3xl space-y-6">
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">
            Loading billing information...
          </div>
        ) : !subscription ? (
          <NotSubscribedCard
            price={PRICE}
            trialDays={TRIAL_DAYS}
            starting={startingTrial}
            onStart={() => void handleStartTrial()}
          />
        ) : (
          <ActiveSubscriptionCard
            subscription={subscription}
            status={status}
            isProvisioned={isProvisioned}
            hasProviderSubscription={hasProviderSubscription}
            price={PRICE}
            cancelArmed={cancelArmed}
            actionLoading={actionLoading}
            portalLoading={portalLoading}
            onOpenPortal={() => void handleOpenPortal()}
            onCancel={() => void handleCancel()}
            onDisarmCancel={disarmCancel}
            onReactivate={() => void handleReactivate()}
          />
        )}

        {!loading && (
          <UsageCard usage={usage} />
        )}
      </div>
    </div>
  );
}

interface UsageCardProps {
  usage: { contacts: string; emails: string; socialPosts: string };
}

function UsageCard({ usage }: UsageCardProps) {
  const limits = PRICING.fairUseLimits;
  const rows = [
    { label: 'Contacts', value: usage.contacts, limit: `${limits.crmRecords.toLocaleString()} records` },
    { label: 'Emails Sent', value: usage.emails, limit: `${limits.emailsPerDay.toLocaleString()}/day` },
    { label: 'Social Posts', value: usage.socialPosts, limit: `${limits.socialPostsPerMonth.toLocaleString()}/month` },
  ];
  return (
    <div className="bg-card border border-border-strong rounded-2xl p-6">
      <h3 className="text-base font-semibold mb-1">Usage this period</h3>
      <p className="text-xs text-muted-foreground mb-4">
        Fair-use limits apply to every active subscription. These are soft caps, not tiers.
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {rows.map((row) => (
          <div key={row.label} className="p-4 bg-background rounded-lg text-center">
            <div className="text-xs text-muted-foreground mb-1">{row.label}</div>
            <div className="text-xl font-bold">{row.value}</div>
            <div className="text-xs text-muted-foreground mt-1">Limit: {row.limit}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface NotSubscribedCardProps {
  price: number;
  trialDays: number;
  starting: boolean;
  onStart: () => void;
}

function NotSubscribedCard({ price, trialDays, starting, onStart }: NotSubscribedCardProps) {
  return (
    <div className="space-y-6">
      <div className="bg-card border border-border-strong rounded-2xl p-8">
        <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">SalesVelocity.ai</div>
        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-4xl font-bold">${price}</span>
          <span className="text-muted-foreground">/month</span>
        </div>
        <p className="text-muted-foreground mb-6">
          Full access to every feature. {trialDays}-day free trial. Cancel anytime.
        </p>

        <ul className="space-y-2 mb-8 text-sm">
          <Bullet>Full AI workforce (40+ specialists)</Bullet>
          <Bullet>CRM + outbound email + SMS + voice AI</Bullet>
          <Bullet>Content Factory + Video Studio + Website Builder</Bullet>
          <Bullet>BYOK — pay raw AI rates with zero markup</Bullet>
          <Bullet>{trialDays}-day free trial, cancel anytime</Bullet>
        </ul>

        <Button onClick={onStart} disabled={starting} className="w-full">
          {starting ? 'Starting…' : `Start ${trialDays}-day free trial`}
        </Button>
        <div className="mt-3 text-xs text-muted-foreground text-center">
          Credit card required. You won&apos;t be charged for {trialDays} days.
        </div>
      </div>

      <div className="bg-card border border-border-strong rounded-2xl p-6">
        <h3 className="text-base font-semibold mb-1">What you can do after your trial starts</h3>
        <p className="text-xs text-muted-foreground mb-4">
          These controls activate once you have an active subscription. Stripe&apos;s secure customer portal handles payment changes and invoices.
        </p>
        <ul className="space-y-3 text-sm">
          <ManageRow icon="💳" title="Update payment method" detail="Change the card on file via the Stripe customer portal." />
          <ManageRow icon="🧾" title="View invoices and receipts" detail="Full billing history, downloadable PDFs, in the Stripe customer portal." />
          <ManageRow icon="✋" title="Cancel anytime" detail="Two-step confirmation. During the trial cancellation is free; after, access continues to the end of the paid period." />
          <ManageRow icon="🔄" title="Reactivate" detail="If you cancel and change your mind before the period ends, one click reactivates." />
        </ul>
      </div>
    </div>
  );
}

function ManageRow({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span className="text-lg" aria-hidden>{icon}</span>
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-muted-foreground text-xs">{detail}</div>
      </div>
    </li>
  );
}

interface ActiveSubscriptionCardProps {
  subscription: Subscription;
  status: SubscriptionStatus | undefined;
  isProvisioned: boolean;
  hasProviderSubscription: boolean;
  price: number;
  cancelArmed: boolean;
  actionLoading: boolean;
  portalLoading: boolean;
  onOpenPortal: () => void;
  onCancel: () => void;
  onDisarmCancel: () => void;
  onReactivate: () => void;
}

function ActiveSubscriptionCard({
  subscription,
  status,
  isProvisioned,
  hasProviderSubscription,
  price,
  cancelArmed,
  actionLoading,
  portalLoading,
  onOpenPortal,
  onCancel,
  onDisarmCancel,
  onReactivate,
}: ActiveSubscriptionCardProps) {
  const isTrialing = status === 'trialing';
  const isActive = status === 'active';
  const isCancelled = status === 'cancelled';
  const isPastDue = status === 'past_due';
  const cancelAtPeriodEnd = Boolean(subscription.cancelAtPeriodEnd);

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border-strong rounded-2xl p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
              Current Subscription
            </div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-2xl font-bold">SalesVelocity.ai</span>
              <StatusBadge status={status} cancelAtPeriodEnd={cancelAtPeriodEnd} />
              {isProvisioned && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-violet-500/15 text-violet-400">
                  Admin Provisioned
                </span>
              )}
            </div>
            <div className="text-muted-foreground text-sm">${price}/month</div>
          </div>
        </div>

        {isTrialing && subscription.trialEndsAt && (
          <div className="px-4 py-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-info">
            Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}. You won&apos;t be charged until then.
          </div>
        )}

        {isPastDue && (
          <div className="px-4 py-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-sm text-warning">
            Payment failed. Update your payment method to keep your subscription active.
          </div>
        )}

        {(isCancelled || cancelAtPeriodEnd) && (
          <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-error">
            {cancelAtPeriodEnd && subscription.currentPeriodEnd ? (
              <>Subscription will end on {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.</>
            ) : subscription.cancelledAt ? (
              <>Subscription cancelled on {new Date(subscription.cancelledAt).toLocaleDateString()}.</>
            ) : (
              <>Subscription cancelled.</>
            )}
          </div>
        )}
      </div>

      <div className="bg-card border border-border-strong rounded-2xl p-6">
        <h3 className="text-base font-semibold mb-4">Manage Subscription</h3>
        <div className="flex gap-3 flex-wrap items-center">
          {hasProviderSubscription && !isProvisioned && (
            <Button
              variant="outline"
              onClick={onOpenPortal}
              disabled={portalLoading}
            >
              {portalLoading ? 'Opening…' : 'Manage billing & payment method'}
            </Button>
          )}

          {(isActive || isTrialing) && !cancelAtPeriodEnd && hasProviderSubscription && (
            cancelArmed ? (
              <>
                <Button
                  variant="destructive"
                  onClick={onCancel}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Cancelling…' : 'Click again to confirm cancel'}
                </Button>
                <Button variant="ghost" onClick={onDisarmCancel}>Cancel</Button>
              </>
            ) : (
              <Button
                variant="outline"
                onClick={onCancel}
                disabled={actionLoading}
                className="text-error border-error/40 hover:bg-error/10"
              >
                Cancel subscription
              </Button>
            )
          )}

          {(isCancelled || cancelAtPeriodEnd) && (
            <Button onClick={onReactivate} disabled={actionLoading}>
              {actionLoading ? 'Reactivating…' : 'Reactivate subscription'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="text-primary mt-0.5">✓</span>
      <span>{children}</span>
    </li>
  );
}

function StatusBadge({
  status,
  cancelAtPeriodEnd,
}: {
  status: SubscriptionStatus | undefined;
  cancelAtPeriodEnd: boolean;
}) {
  if (cancelAtPeriodEnd && status !== 'cancelled') {
    return (
      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-warning">
        Cancels at period end
      </span>
    );
  }
  switch (status) {
    case 'trialing':
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-info">
          Trial
        </span>
      );
    case 'active':
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-500/15 text-success">
          Active
        </span>
      );
    case 'past_due':
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-warning">
          Past due
        </span>
      );
    case 'cancelled':
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-error">
          Cancelled
        </span>
      );
    default:
      return (
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-muted/40 text-muted-foreground">
          {status ?? 'Unknown'}
        </span>
      );
  }
}
