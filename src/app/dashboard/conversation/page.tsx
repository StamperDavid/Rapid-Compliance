/**
 * Conversation Intelligence Dashboard
 * 
 * Main dashboard for viewing conversation analysis insights.
 * Displays overview, topics, coaching, and follow-up recommendations.
 * 
 * FEATURES:
 * - Real-time conversation analysis
 * - Comprehensive insights display
 * - Coaching recommendations
 * - Follow-up action tracking
 * 
 * @module app/dashboard/conversation
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ConversationOverviewCard } from '@/components/conversation/ConversationOverviewCard';
import { ConversationTopicsCard } from '@/components/conversation/ConversationTopicsCard';
import { ConversationCoachingCard } from '@/components/conversation/ConversationCoachingCard';
import { ConversationFollowUpsCard } from '@/components/conversation/ConversationFollowUpsCard';
import type { ConversationAnalysis } from '@/lib/conversation/types';

/**
 * Conversation Intelligence Dashboard Page
 */
export default function ConversationDashboardPage() {
  const [analysis, setAnalysis] = useState<ConversationAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'topics' | 'coaching' | 'followups'>('overview');
  
  // Mock conversation ID (in production, get from URL params or state)
  const conversationId = 'demo-conversation-1';
  const organizationId = 'demo-org';
  
  /**
   * Load conversation analysis
   */
  const loadAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/conversation/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          organizationId,
          includeCoaching: true,
          includeFollowUps: true,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error((errorData.message !== '' && errorData.message != null) ? errorData.message : 'Failed to load analysis');
      }

      const data = await response.json() as { data: ConversationAnalysis };
      setAnalysis(data.data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(message);
      console.error('Failed to load analysis:', err);
    } finally {
      setLoading(false);
    }
  };
  
  /**
   * Load analysis on mount (in production, load when conversation selected)
   */
  useEffect(() => {
    // Uncomment to auto-load:
    // loadAnalysis();
  }, []);
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Conversation Intelligence
          </h1>
          <p className="text-gray-600">
            AI-powered insights from your sales conversations
          </p>
        </div>
        
        {/* Demo Notice */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div>
              <h3 className="text-sm font-semibold text-blue-900 mb-1">
                Demo Dashboard
              </h3>
              <p className="text-sm text-blue-700 mb-2">
                This dashboard displays AI-powered conversation analysis. In production, you would:
              </p>
              <ul className="text-xs text-blue-600 space-y-1 ml-4">
                <li>• Upload call recordings or paste transcripts</li>
                <li>• Automatically sync from Zoom, Teams, or your phone system</li>
                <li>• Get real-time analysis after each conversation</li>
                <li>• Track coaching progress over time</li>
              </ul>
              <button
                onClick={() => { void loadAnalysis(); }}
                disabled={loading}
                className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Loading Demo...' : 'Load Demo Analysis'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="text-sm font-semibold text-red-900 mb-1">
                  Error Loading Analysis
                </h3>
                <p className="text-sm text-red-700">{error}</p>
                <button
                  onClick={() => { void loadAnalysis(); }}
                  className="mt-2 text-sm text-red-600 hover:text-red-800 font-medium"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600">Analyzing conversation with AI...</p>
            <p className="text-sm text-gray-500 mt-2">This may take 10-30 seconds</p>
          </div>
        )}
        
        {/* Analysis Display */}
        {analysis && !loading && (
          <>
            {/* Mobile Tabs */}
            <div className="mb-6 lg:hidden">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-4">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'overview'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('topics')}
                    className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'topics'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Topics
                  </button>
                  <button
                    onClick={() => setActiveTab('coaching')}
                    className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'coaching'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Coaching
                  </button>
                  <button
                    onClick={() => setActiveTab('followups')}
                    className={`py-2 px-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === 'followups'
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Follow-Ups
                  </button>
                </nav>
              </div>
            </div>
            
            {/* Desktop Grid / Mobile Tabs */}
            <div className="space-y-6">
              {/* Mobile: Show active tab only */}
              <div className="lg:hidden">
                {activeTab === 'overview' && <ConversationOverviewCard analysis={analysis} />}
                {activeTab === 'topics' && <ConversationTopicsCard analysis={analysis} />}
                {activeTab === 'coaching' && <ConversationCoachingCard analysis={analysis} />}
                {activeTab === 'followups' && <ConversationFollowUpsCard analysis={analysis} />}
              </div>
              
              {/* Desktop: Show all cards */}
              <div className="hidden lg:grid lg:grid-cols-2 lg:gap-6">
                <div className="space-y-6">
                  <ConversationOverviewCard analysis={analysis} />
                  <ConversationCoachingCard analysis={analysis} />
                </div>
                <div className="space-y-6">
                  <ConversationTopicsCard analysis={analysis} />
                  <ConversationFollowUpsCard analysis={analysis} />
                </div>
              </div>
            </div>
            
            {/* Actions Bar */}
            <div className="mt-8 p-4 bg-white rounded-lg shadow flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Analysis Complete
                </h3>
                <p className="text-xs text-gray-600">
                  Overall Score: <span className="font-semibold">{analysis.scores.overall}/100</span>
                  {' • '}
                  {analysis.coachingInsights.length} coaching insights
                  {' • '}
                  {analysis.followUpActions.length} follow-up actions
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    // TODO: Export analysis
                    // eslint-disable-next-line no-console
                    console.log('Export feature coming soon');
                  }}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded hover:bg-gray-200 transition-colors"
                >
                  Export
                </button>
                <button
                  onClick={() => {
                    // TODO: Share analysis
                    // eslint-disable-next-line no-console
                    console.log('Share feature coming soon');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 transition-colors"
                >
                  Share
                </button>
              </div>
            </div>
          </>
        )}
        
        {/* Empty State */}
        {!analysis && !loading && !error && (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">🎙️</span>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No Conversation Selected
            </h2>
            <p className="text-gray-600 mb-6">
              Upload a recording or paste a transcript to get AI-powered insights
            </p>
            <button
              onClick={() => { void loadAnalysis(); }}
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Load Demo Analysis
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
