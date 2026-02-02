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
 * Route: /workspace/[orgId]/email-writer
 */

'use client';

import React, { useState } from 'react';
import { EmailWriterCard } from '@/components/email-writer/EmailWriterCard';
import type { GeneratedEmail } from '@/lib/email-writer';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

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
  const organizationId = DEFAULT_ORG_ID;
  
  // TODO: Get from auth context
  const workspaceId = 'workspace_default';
  const userId = 'user_current';
  
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
    <div className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-white">
              AI Email Writer
            </h1>
            <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
              BETA
            </span>
          </div>
          <p className="text-gray-400">
            Generate personalized sales emails powered by deal scoring, battlecards, and industry best practices
          </p>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Emails Generated</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {emailHistory.totalGenerated}
                </p>
              </div>
              <div className="text-3xl">✉️</div>
            </div>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Emails Sent</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {emailHistory.totalSent}
                </p>
              </div>
              <div className="text-3xl">📤</div>
            </div>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Avg. Open Rate</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {emailHistory.avgOpenRate.toFixed(1)}%
                </p>
              </div>
              <div className="text-3xl">👁️</div>
            </div>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Avg. Reply Rate</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {emailHistory.avgReplyRate.toFixed(1)}%
                </p>
              </div>
              <div className="text-3xl">💬</div>
            </div>
          </div>
        </div>
        
        {/* Email Writer Card */}
        <EmailWriterCard
          organizationId={organizationId}
          workspaceId={workspaceId}
          userId={userId}
          onEmailSent={handleEmailSent}
        />
        
        {/* Email History */}
        {emailHistory.emails.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">
              Recent Emails
            </h2>
            
            <div className="space-y-3">
              {emailHistory.emails.map((email, index) => (
                <div
                  key={email.id || index}
                  className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 bg-blue-900/30 text-blue-400 text-xs font-medium rounded">
                          {email.emailType}
                        </span>
                        {email.dealTier && (
                          <span
                            className={`px-2 py-0.5 text-xs font-medium rounded ${
                              email.dealTier === 'hot'
                                ? 'bg-red-900/30 text-red-400'
                                : email.dealTier === 'warm'
                                ? 'bg-yellow-900/30 text-yellow-400'
                                : email.dealTier === 'at-risk'
                                ? 'bg-orange-900/30 text-orange-400'
                                : 'bg-gray-800 text-gray-400'
                            }`}
                          >
                            {email.dealTier}
                          </span>
                        )}
                      </div>
                      <p className="text-white font-medium">{email.subject}</p>
                      <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                        {email.bodyPlain}
                      </p>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1 ml-4">
                      <p className="text-xs text-gray-500">
                        {new Date(email.generatedAt).toLocaleDateString()}
                      </p>
                      {email.dealScore !== undefined && (
                        <p className="text-xs text-gray-400">
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
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            How It Works
          </h3>
          
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div className="text-2xl mb-2">🎯</div>
              <h4 className="font-medium text-white mb-1">
                Deal Scoring Integration
              </h4>
              <p className="text-sm text-gray-400">
                Emails are personalized based on deal score and tier. Hot deals get aggressive close language, at-risk deals focus on salvaging the relationship.
              </p>
            </div>
            
            <div>
              <div className="text-2xl mb-2">⚔️</div>
              <h4 className="font-medium text-white mb-1">
                Competitive Positioning
              </h4>
              <p className="text-sm text-gray-400">
                Include battlecard insights for competitive differentiation. AI automatically incorporates your advantages and objection handling strategies.
              </p>
            </div>
            
            <div>
              <div className="text-2xl mb-2">📚</div>
              <h4 className="font-medium text-white mb-1">
                Industry Best Practices
              </h4>
              <p className="text-sm text-gray-400">
                Leverage industry templates for proven email structures, discovery questions, and messaging frameworks tailored to your market.
              </p>
            </div>
          </div>
        </div>
        
        {/* Email Types Reference */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Email Types
          </h3>
          
          <div className="grid grid-cols-5 gap-4">
            <div className="space-y-2">
              <div className="text-2xl">👋</div>
              <h4 className="font-medium text-white">Intro</h4>
              <p className="text-xs text-gray-400">
                First contact to pique interest and get a response
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="text-2xl">🔄</div>
              <h4 className="font-medium text-white">Follow-up</h4>
              <p className="text-xs text-gray-400">
                After meetings or demos to maintain momentum
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="text-2xl">📄</div>
              <h4 className="font-medium text-white">Proposal</h4>
              <p className="text-xs text-gray-400">
                Send pricing and get approval to move forward
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="text-2xl">🎯</div>
              <h4 className="font-medium text-white">Close</h4>
              <p className="text-xs text-gray-400">
                Final push to get signed contract and close deal
              </p>
            </div>
            
            <div className="space-y-2">
              <div className="text-2xl">🔥</div>
              <h4 className="font-medium text-white">Re-engagement</h4>
              <p className="text-xs text-gray-400">
                Revive cold or stalled deals with new value
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
