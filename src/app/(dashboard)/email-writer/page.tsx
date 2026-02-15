/**
 * Email Writer Dashboard Page
 *
 * AI-powered sales email generation dashboard.
 *
 * Features:
 * - Email generation with 5 template types
 * - Deal scoring integration
 * - Battlecard competitive positioning
 * - Email history and analytics
 * - A/B testing variants
 *
 * Route: /email-writer
 */

'use client';

import React, { useState } from 'react';
import { EmailWriterCard } from '@/components/email-writer/EmailWriterCard';
import type { GeneratedEmail } from '@/lib/email-writer';
import { useAuth } from '@/hooks/useAuth';

// ============================================================================
// TYPES
// ============================================================================

interface EmailHistory {
  emails: GeneratedEmail[];
  totalGenerated: number;
  totalSent: number;
  avgOpenRate: number;
  avgReplyRate: number;
}

// ============================================================================
// EMAIL WRITER PAGE
// ============================================================================

export default function EmailWriterPage() {
  const { user } = useAuth();
  const userId = user?.id ?? 'anonymous';

  // State
  const [emailHistory, setEmailHistory] = useState<EmailHistory>({
    emails: [],
    totalGenerated: 0,
    totalSent: 0,
    avgOpenRate: 0,
    avgReplyRate: 0,
  });
  
  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  /**
   * Handle email sent
   */
  const handleEmailSent = (email: GeneratedEmail) => {
    setEmailHistory((prev) => ({
      ...prev,
      emails: [email, ...prev.emails],
      totalGenerated: prev.totalGenerated + 1,
      totalSent: prev.totalSent + 1,
    }));
  };
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="min-h-screen bg-surface-main p-8">
      <div className="space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
              AI Email Writer
            </h1>
            <span className="px-3 py-1 bg-primary text-white text-xs font-semibold rounded-full">
              BETA
            </span>
          </div>
          <p className="text-[var(--color-text-secondary)]">
            Generate personalized sales emails powered by deal scoring, battlecards, and industry best practices
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-surface-paper border border-border-light rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Emails Generated</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
                  {emailHistory.totalGenerated}
                </p>
              </div>
              <div className="text-3xl">✉️</div>
            </div>
          </div>

          <div className="bg-surface-paper border border-border-light rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Emails Sent</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
                  {emailHistory.totalSent}
                </p>
              </div>
              <div className="text-3xl">📤</div>
            </div>
          </div>

          <div className="bg-surface-paper border border-border-light rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Avg. Open Rate</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
                  {emailHistory.avgOpenRate.toFixed(1)}%
                </p>
              </div>
              <div className="text-3xl">👁️</div>
            </div>
          </div>

          <div className="bg-surface-paper border border-border-light rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-[var(--color-text-secondary)]">Avg. Reply Rate</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">
                  {emailHistory.avgReplyRate.toFixed(1)}%
                </p>
              </div>
              <div className="text-3xl">💬</div>
            </div>
          </div>
        </div>
        
        {/* Email Writer Card */}
        <EmailWriterCard
          userId={userId}
          onEmailSent={handleEmailSent}
        />
        
        {/* Email History */}
        {emailHistory.emails.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
              Recent Emails
            </h2>

            <div className="space-y-3">
              {emailHistory.emails.map((email, index) => (
                <div
                  key={email.id || index}
                  className="bg-surface-paper border border-border-light rounded-lg p-4 hover:border-border-strong transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 text-primary text-xs font-medium rounded" style={{ backgroundColor: 'rgba(var(--color-primary-rgb), 0.3)' }}>
                          {email.emailType}
                        </span>
                        {email.dealTier && (
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              email.dealTier === 'hot'
                                ? 'text-error'
                                : email.dealTier === 'warm'
                                ? 'text-warning'
                                : email.dealTier === 'at-risk'
                                ? 'text-warning'
                                : 'text-[var(--color-text-disabled)]'
                            }`}
                            style={{ backgroundColor: email.dealTier === 'hot' ? 'rgba(var(--color-error-rgb), 0.3)' : email.dealTier === 'warm' ? 'rgba(var(--color-warning-rgb), 0.3)' : email.dealTier === 'at-risk' ? 'rgba(var(--color-warning-rgb), 0.3)' : 'var(--color-bg-elevated)' }}
                          >
                            {email.dealTier}
                          </span>
                        )}
                      </div>
                      <p className="text-[var(--color-text-primary)] font-medium">{email.subject}</p>
                      <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">
                        {email.bodyPlain}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1 ml-4">
                      <p className="text-xs text-[var(--color-text-disabled)]">
                        {new Date(email.generatedAt).toLocaleDateString()}
                      </p>
                      {email.dealScore !== undefined && (
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          Score: {email.dealScore}/100
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Features Info */}
        <div className="bg-surface-paper border border-border-light rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            How It Works
          </h3>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-2xl mb-2">🎯</div>
              <h4 className="font-medium text-[var(--color-text-primary)] mb-1">
                Deal Scoring Integration
              </h4>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Emails are personalized based on deal score and tier. Hot deals get aggressive close language, at-risk deals focus on salvaging the relationship.
              </p>
            </div>

            <div>
              <div className="text-2xl mb-2">⚔️</div>
              <h4 className="font-medium text-[var(--color-text-primary)] mb-1">
                Competitive Positioning
              </h4>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Include battlecard insights for competitive differentiation. AI automatically incorporates your advantages and objection handling strategies.
              </p>
            </div>

            <div>
              <div className="text-2xl mb-2">📚</div>
              <h4 className="font-medium text-[var(--color-text-primary)] mb-1">
                Industry Best Practices
              </h4>
              <p className="text-sm text-[var(--color-text-secondary)]">
                Leverage industry templates for proven email structures, discovery questions, and messaging frameworks tailored to your market.
              </p>
            </div>
          </div>
        </div>

        {/* Email Types Reference */}
        <div className="bg-surface-paper border border-border-light rounded-lg p-6">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Email Types
          </h3>

          <div className="grid grid-cols-5 gap-4">
            <div className="space-y-2">
              <div className="text-2xl">👋</div>
              <h4 className="font-medium text-[var(--color-text-primary)]">Intro</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                First contact to pique interest and get a response
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-2xl">🔄</div>
              <h4 className="font-medium text-[var(--color-text-primary)]">Follow-up</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                After meetings or demos to maintain momentum
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-2xl">📄</div>
              <h4 className="font-medium text-[var(--color-text-primary)]">Proposal</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Send pricing and get approval to move forward
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-2xl">🎯</div>
              <h4 className="font-medium text-[var(--color-text-primary)]">Close</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Final push to get signed contract and close deal
              </p>
            </div>

            <div className="space-y-2">
              <div className="text-2xl">🔥</div>
              <h4 className="font-medium text-[var(--color-text-primary)]">Re-engagement</h4>
              <p className="text-xs text-[var(--color-text-secondary)]">
                Revive cold or stalled deals with new value
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
