'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useOrgTheme } from '@/hooks/useOrgTheme';

export default function SubscriptionPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  
  const { theme } = useOrgTheme();
  const [subscription, setSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const response = await fetch(`/api/subscription?orgId=${orgId}`);
      const data = await response.json();
      if (data.success) {
        setSubscription(data.subscription);
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleFeature = async (feature: string, enabled: boolean) => {
    try {
      const response = await fetch('/api/subscription/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, feature, enabled }),
      });
      
      const data = await response.json();
      if (data.success) {
        loadSubscription(); // Reload
      }
    } catch (error) {
      console.error('Failed to toggle feature:', error);
    }
  };

  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000' }}>
        <AdminBar />
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: '#999', fontSize: '1rem' }}>Loading subscription...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000' }}>
      <AdminBar />
      
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link href={`/workspace/${orgId}/settings`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to Settings
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.5rem' }}>
              Subscription & Features
            </h1>
            <p style={{ color: '#999', fontSize: '0.875rem' }}>
              Manage your subscription plan and outbound features
            </p>
          </div>

          {/* Current Plan */}
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                  Current Plan
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 'bold', color: primaryColor, textTransform: 'capitalize' }}>
                    {subscription?.plan || 'Professional'}
                  </span>
                  {subscription?.isTrialing && (
                    <span style={{ padding: '0.25rem 0.75rem', backgroundColor: '#10b981', color: '#000', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '600' }}>
                      TRIAL
                    </span>
                  )}
                  <span style={{ padding: '0.25rem 0.75rem', backgroundColor: subscription?.status === 'active' ? '#10b981' : '#666', color: '#fff', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase' }}>
                    {subscription?.status || 'Active'}
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>Monthly</div>
                <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff' }}>
                  ${subscription?.billing?.basePrice || 299}
                  <span style={{ fontSize: '1rem', color: '#999' }}>/mo</span>
                </div>
              </div>
            </div>

            {subscription?.isTrialing && (
              <div style={{ padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.25rem' }}>
                  Trial ends: {new Date(subscription.trialEndsAt).toLocaleDateString()}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>
                  {Math.ceil((new Date(subscription.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days remaining
                </div>
              </div>
            )}
          </div>

          {/* Outbound Features */}
          <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: '#fff', marginBottom: '1.5rem' }}>
              Outbound Features
            </h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* AI Email Writer */}
              <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                      AI Email Writer
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.75rem' }}>
                      Generate personalized cold emails using AI
                    </p>
                    {subscription?.outboundFeatures?.aiEmailWriter?.enabled && (
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>
                        <span style={{ color: primaryColor, fontWeight: '600' }}>
                          {subscription.outboundFeatures.aiEmailWriter.used}
                        </span>
                        {' / '}
                        {subscription.outboundFeatures.aiEmailWriter.monthlyLimit}
                        {' emails used this month'}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleFeature('aiEmailWriter', !subscription?.outboundFeatures?.aiEmailWriter?.enabled)}
                    disabled={!subscription?.outboundFeatures?.aiEmailWriter}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: subscription?.outboundFeatures?.aiEmailWriter?.enabled ? primaryColor : '#333',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: subscription?.outboundFeatures?.aiEmailWriter ? 'pointer' : 'not-allowed',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    {subscription?.outboundFeatures?.aiEmailWriter?.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Email Sequences */}
              <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                      Email Sequences
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.75rem' }}>
                      Multi-step automated email campaigns
                    </p>
                    {subscription?.outboundFeatures?.emailSequences?.enabled && (
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>
                        <span style={{ color: primaryColor, fontWeight: '600' }}>
                          {subscription.outboundFeatures.emailSequences.currentSequences}
                        </span>
                        {' / '}
                        {subscription.outboundFeatures.emailSequences.maxActiveSequences}
                        {' active sequences'}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleFeature('emailSequences', !subscription?.outboundFeatures?.emailSequences?.enabled)}
                    disabled={!subscription?.outboundFeatures?.emailSequences}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: subscription?.outboundFeatures?.emailSequences?.enabled ? primaryColor : '#333',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: subscription?.outboundFeatures?.emailSequences ? 'pointer' : 'not-allowed',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    {subscription?.outboundFeatures?.emailSequences?.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Reply Handler */}
              <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                      AI Reply Handler
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.75rem' }}>
                      Automatically respond to prospect emails
                    </p>
                    {subscription?.outboundFeatures?.emailReplyHandler?.enabled && subscription?.outboundFeatures?.emailReplyHandler?.autonomousMode && (
                      <div style={{ padding: '0.5rem', backgroundColor: '#7f1d1d', border: '1px solid #991b1b', borderRadius: '0.25rem', fontSize: '0.75rem', color: '#fecaca' }}>
                        ⚠️ Autonomous mode enabled - AI will send replies automatically
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleFeature('emailReplyHandler', !subscription?.outboundFeatures?.emailReplyHandler?.enabled)}
                    disabled={!subscription?.outboundFeatures?.emailReplyHandler}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: subscription?.outboundFeatures?.emailReplyHandler?.enabled ? primaryColor : '#333',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: subscription?.outboundFeatures?.emailReplyHandler ? 'pointer' : 'not-allowed',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    {subscription?.outboundFeatures?.emailReplyHandler?.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Prospect Finder */}
              <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                      Prospect Finder
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.75rem' }}>
                      Find and enrich prospects automatically
                    </p>
                    {subscription?.outboundFeatures?.prospectFinder?.enabled && (
                      <div style={{ fontSize: '0.75rem', color: '#666' }}>
                        <span style={{ color: primaryColor, fontWeight: '600' }}>
                          {subscription.outboundFeatures.prospectFinder.used}
                        </span>
                        {' / '}
                        {subscription.outboundFeatures.prospectFinder.monthlyLimit}
                        {' prospects found this month'}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleFeature('prospectFinder', !subscription?.outboundFeatures?.prospectFinder?.enabled)}
                    disabled={!subscription?.outboundFeatures?.prospectFinder}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: subscription?.outboundFeatures?.prospectFinder?.enabled ? primaryColor : '#333',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: subscription?.outboundFeatures?.prospectFinder ? 'pointer' : 'not-allowed',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    {subscription?.outboundFeatures?.prospectFinder?.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>

              {/* Multi-Channel */}
              <div style={{ padding: '1.5rem', backgroundColor: '#0a0a0a', border: '1px solid #333', borderRadius: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                      Multi-Channel Outreach
                    </h3>
                    <p style={{ fontSize: '0.75rem', color: '#999', marginBottom: '0.75rem' }}>
                      LinkedIn + SMS + Email coordination
                    </p>
                    {subscription?.outboundFeatures?.multiChannel?.enabled && (
                      <div style={{ display: 'flex', gap: '1rem', fontSize: '0.75rem', color: '#666' }}>
                        <div>Email: {subscription.outboundFeatures.multiChannel.channels.email.used}/{subscription.outboundFeatures.multiChannel.channels.email.monthlyLimit}</div>
                        <div>LinkedIn: {subscription.outboundFeatures.multiChannel.channels.linkedin.used}/{subscription.outboundFeatures.multiChannel.channels.linkedin.monthlyLimit}</div>
                        <div>SMS: {subscription.outboundFeatures.multiChannel.channels.sms.used}/{subscription.outboundFeatures.multiChannel.channels.sms.monthlyLimit}</div>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleFeature('multiChannel', !subscription?.outboundFeatures?.multiChannel?.enabled)}
                    disabled={!subscription?.outboundFeatures?.multiChannel}
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: subscription?.outboundFeatures?.multiChannel?.enabled ? primaryColor : '#333',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.375rem',
                      cursor: subscription?.outboundFeatures?.multiChannel ? 'pointer' : 'not-allowed',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                    }}
                  >
                    {subscription?.outboundFeatures?.multiChannel?.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
