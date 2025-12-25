'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import AdminBar from '@/components/AdminBar'
import { logger } from '@/lib/logger/logger';;

interface SubscriptionData {
  plan: string;
  status: string;
  currentPeriodEnd: string;
  trialEnd: string | null;
  usage: {
    records: number;
    aiConversations: number;
    emails: number;
  };
}

export default function BillingSettingsPage() {
  const { user } = useAuth();
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const { theme } = useOrgTheme();
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState('professional');

  useEffect(() => {

    // Load organization billing data
    loadBillingData();
  }, [orgId]);

  const loadBillingData = async () => {
    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const org = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, orgId);
      
      if (org) {
        setSubscription({
          plan: org.planId || org.plan || 'starter',
          status: org.subscriptionStatus || 'trialing',
          currentPeriodEnd: org.currentPeriodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          trialEnd: org.trialEndsAt || org.trialEnd || null,
          usage: org.usage || { records: 0, aiConversations: 0, emails: 0 },
        });
        setSelectedPlan(org.planId || org.plan || 'starter');
      }
    } catch (error) {
      logger.error('Failed to load billing data:', error, { file: 'page.tsx' });
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (planId === 'enterprise') {
      // Contact sales for enterprise
      window.location.href = '/contact?plan=enterprise';
      return;
    }

    setUpgrading(true);
    try {
      const response = await fetch('/api/billing/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          planId,
          email: user?.email,
          name: user?.displayName,
        }),
      });

      const data = await response.json();
      
      if (data.success && data.clientSecret) {
        // Redirect to Stripe checkout or open payment modal
        // For now, just show success
        alert('Upgrade initiated! Complete payment to activate your new plan.');
        loadBillingData();
      } else if (data.success) {
        alert('Plan updated successfully!');
        loadBillingData();
      } else {
        throw new Error(data.error || 'Failed to upgrade plan');
      }
    } catch (error: any) {
      logger.error('Upgrade error:', error, { file: 'page.tsx' });
      alert(error.message || 'Failed to upgrade plan. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleManageBilling = async () => {
    try {
      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId }),
      });

      const data = await response.json();
      
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Failed to open billing portal');
      }
    } catch (error: any) {
      logger.error('Billing portal error:', error, { file: 'page.tsx' });
      alert('Billing portal is not available. Please contact support.');
    }
  };

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  // NEW: Volume-based tiers (all-inclusive features)
  const tiers = [
    {
      id: 'tier1',
      name: 'Tier 1',
      price: '$400',
      period: 'month',
      recordCapacity: '0-100 records',
      limits: { records: 100, aiConversations: -1, emails: -1 },
      features: [
        '✓ All Features Included',
        '✓ AI Sales Agents (Unlimited)',
        '✓ Lead Scraper & Enrichment',
        '✓ Email Sequences (Unlimited)',
        '✓ Multi-Channel Outreach',
        '✓ Social Media AI',
        '✓ Full CRM Suite',
        '✓ Workflow Automation',
        '✓ API Access',
        '✓ White-Label Options'
      ]
    },
    {
      id: 'tier2',
      name: 'Tier 2',
      price: '$650',
      period: 'month',
      recordCapacity: '101-250 records',
      limits: { records: 250, aiConversations: -1, emails: -1 },
      features: [
        '✓ All Features Included',
        '✓ AI Sales Agents (Unlimited)',
        '✓ Lead Scraper & Enrichment',
        '✓ Email Sequences (Unlimited)',
        '✓ Multi-Channel Outreach',
        '✓ Social Media AI',
        '✓ Full CRM Suite',
        '✓ Workflow Automation',
        '✓ API Access',
        '✓ White-Label Options'
      ],
      popular: true
    },
    {
      id: 'tier3',
      name: 'Tier 3',
      price: '$1,000',
      period: 'month',
      recordCapacity: '251-500 records',
      limits: { records: 500, aiConversations: -1, emails: -1 },
      features: [
        '✓ All Features Included',
        '✓ AI Sales Agents (Unlimited)',
        '✓ Lead Scraper & Enrichment',
        '✓ Email Sequences (Unlimited)',
        '✓ Multi-Channel Outreach',
        '✓ Social Media AI',
        '✓ Full CRM Suite',
        '✓ Workflow Automation',
        '✓ API Access',
        '✓ White-Label Options'
      ]
    },
    {
      id: 'tier4',
      name: 'Tier 4',
      price: '$1,250',
      period: 'month',
      recordCapacity: '501-1,000 records',
      limits: { records: 1000, aiConversations: -1, emails: -1 },
      features: [
        '✓ All Features Included',
        '✓ AI Sales Agents (Unlimited)',
        '✓ Lead Scraper & Enrichment',
        '✓ Email Sequences (Unlimited)',
        '✓ Multi-Channel Outreach',
        '✓ Social Media AI',
        '✓ Full CRM Suite',
        '✓ Workflow Automation',
        '✓ API Access',
        '✓ White-Label Options'
      ]
    }
  ];

  const currentPlan = tiers.find(p => p.id === subscription?.tier || p.id === subscription?.plan) || tiers[0];
  const isTrialing = subscription?.status === 'trialing';
  const trialDaysLeft = subscription?.trialEnd
    ? Math.max(0, Math.ceil((new Date(subscription.trialEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
          <p>Loading billing information...</p>
        </div>
      </div>
    );
  }

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
              href={`/workspace/${orgId}/dashboard`}
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
              {sidebarOpen && <span>Dashboard</span>}
            </Link>
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
              <Link href={`/workspace/${orgId}/settings`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
                ← Back to Settings
              </Link>
              <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>Billing & Plans</h1>
              <p style={{ color: '#666', fontSize: '0.875rem' }}>
                Manage your subscription, view usage, and update billing information
              </p>
            </div>

            {/* Trial Banner */}
            {isTrialing && trialDaysLeft > 0 && (
              <div style={{
                backgroundColor: '#0f3460',
                border: '1px solid #1e4976',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>
                    🎉 You're on a free trial!
                  </div>
                  <div style={{ color: '#93c5fd', fontSize: '0.875rem' }}>
                    {trialDaysLeft} days left on your {currentPlan.name} trial
                  </div>
                </div>
                <button
                  onClick={() => handleUpgrade(subscription?.plan || 'professional')}
                  disabled={upgrading}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#fff',
                    color: '#0f3460',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}
                >
                  {upgrading ? 'Processing...' : 'Upgrade Now'}
                </button>
              </div>
            )}

            {/* Current Plan */}
            <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>Current Plan</h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {currentPlan.name}
                    {isTrialing && (
                      <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', fontWeight: '600', backgroundColor: '#fbbf24', color: '#000', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                        TRIAL
                      </span>
                    )}
                  </div>
                  <div style={{ color: '#999', marginTop: '0.25rem', fontSize: '0.875rem' }}>
                    {currentPlan.price}/{currentPlan.period} • {currentPlan.recordCapacity}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                    {subscription?.currentPeriodEnd && `Renews on ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`}
                  </div>
                  <div style={{ 
                    marginTop: '0.75rem',
                    padding: '0.5rem 0.75rem',
                    backgroundColor: '#0a0a0a',
                    borderRadius: '0.375rem',
                    fontSize: '0.75rem',
                    color: primaryColor,
                    fontWeight: '500'
                  }}>
                    ✓ All Features Included • No Limits on Usage
                  </div>
                </div>
                <button
                  onClick={handleManageBilling}
                  style={{
                    padding: '0.75rem 1.5rem',
                    backgroundColor: '#222',
                    color: '#fff',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}
                >
                  Manage Billing
                </button>
              </div>
              
              {/* Usage Bars */}
              <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#ccc', marginBottom: '0.5rem' }}>
                    <span>Contacts</span>
                    <span>
                      {subscription?.usage?.records?.toLocaleString() || 0} / 
                      {currentPlan.limits.records === -1 ? ' Unlimited' : ` ${currentPlan.limits.records.toLocaleString()}`}
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#0a0a0a', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: currentPlan.limits.records === -1 ? '5%' : `${Math.min(100, ((subscription?.usage?.records || 0) / currentPlan.limits.records) * 100)}%`, 
                      height: '100%', 
                      backgroundColor: primaryColor 
                    }}></div>
                  </div>
                </div>
                
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#ccc', marginBottom: '0.5rem' }}>
                    <span>AI Conversations</span>
                    <span>
                      {subscription?.usage?.aiConversations?.toLocaleString() || 0} / 
                      {currentPlan.limits.aiConversations === -1 ? ' Unlimited' : ` ${currentPlan.limits.aiConversations.toLocaleString()}`}
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#0a0a0a', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: currentPlan.limits.aiConversations === -1 ? '5%' : `${Math.min(100, ((subscription?.usage?.aiConversations || 0) / currentPlan.limits.aiConversations) * 100)}%`, 
                      height: '100%', 
                      backgroundColor: '#4ade80' 
                    }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#ccc', marginBottom: '0.5rem' }}>
                    <span>Emails Sent</span>
                    <span>
                      {subscription?.usage?.emails?.toLocaleString() || 0} / 
                      {currentPlan.limits.emails === -1 ? ' Unlimited' : ` ${currentPlan.limits.emails.toLocaleString()}`}
                    </span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#0a0a0a', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: currentPlan.limits.emails === -1 ? '5%' : `${Math.min(100, ((subscription?.usage?.emails || 0) / currentPlan.limits.emails) * 100)}%`, 
                      height: '100%', 
                      backgroundColor: '#fbbf24' 
                    }}></div>
                  </div>
                </div>
              </div>

              {/* NEW: BYOK Callout */}
              <div style={{ 
                backgroundColor: '#0a0a0a', 
                border: '1px solid #1a1a1a',
                borderRadius: '0.5rem', 
                padding: '1rem',
                marginTop: '1rem'
              }}>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: primaryColor, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  💡 Bring Your Own Keys (BYOK)
                </div>
                <div style={{ fontSize: '0.875rem', color: '#999', lineHeight: '1.5' }}>
                  We don't markup AI tokens. Connect your own OpenRouter, OpenAI, or Anthropic API keys to pay raw market rates for compute.
                </div>
              </div>
            </div>

            {/* Available Plans */}
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Available Plans</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
                {plans.map(plan => {
                  const isCurrent = plan.id === subscription?.plan;
                  const isUpgrade = plans.findIndex(p => p.id === plan.id) > plans.findIndex(p => p.id === subscription?.plan);
                  
                  return (
                    <div
                      key={plan.id}
                      style={{
                        backgroundColor: '#1a1a1a',
                        border: isCurrent ? `2px solid ${primaryColor}` : '1px solid #333',
                        borderRadius: '1rem',
                        padding: '1.5rem',
                        position: 'relative'
                      }}
                    >
                      {plan.popular && (
                        <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: primaryColor, color: '#fff', padding: '0.25rem 1rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '600' }}>
                          MOST POPULAR
                        </div>
                      )}
                      <div style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>{plan.name}</h3>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.25rem' }}>
                          <span style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>{plan.price}</span>
                          {plan.period && <span style={{ color: '#999', fontSize: '0.875rem' }}>/{plan.period}</span>}
                        </div>
                      </div>
                      <ul style={{ listStyle: 'none', padding: 0, margin: 0, marginBottom: '1.5rem' }}>
                        {plan.features.slice(0, 5).map((feature, idx) => (
                          <li key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ccc', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                            <span style={{ color: primaryColor }}>✓</span>
                            {feature}
                          </li>
                        ))}
                        {plan.features.length > 5 && (
                          <li style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                            + {plan.features.length - 5} more features
                          </li>
                        )}
                      </ul>
                      <button
                        onClick={() => !isCurrent && handleUpgrade(plan.id)}
                        disabled={isCurrent || upgrading}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          backgroundColor: isCurrent ? '#222' : isUpgrade ? primaryColor : '#333',
                          color: '#fff',
                          border: isCurrent ? '1px solid #333' : 'none',
                          borderRadius: '0.5rem',
                          cursor: isCurrent ? 'default' : 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          opacity: upgrading ? 0.5 : 1
                        }}
                      >
                        {isCurrent ? 'Current Plan' : plan.id === 'enterprise' ? 'Contact Sales' : isUpgrade ? 'Upgrade' : 'Downgrade'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Need Help */}
            <div style={{
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: '1rem',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💬</div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                Need help choosing a plan?
              </h3>
              <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                Our team is here to help you find the perfect plan for your business
              </p>
              <Link
                href="/contact"
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 2rem',
                  backgroundColor: primaryColor,
                  color: '#fff',
                  borderRadius: '0.5rem',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: '600'
                }}
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
