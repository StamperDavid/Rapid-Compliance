/**
 * Battlecards Dashboard
 * 
 * SOVEREIGN CORPORATE BRAIN - COMPETITIVE INTELLIGENCE CENTER
 * 
 * This page allows sales teams to:
 * - Discover and profile competitors
 * - Generate AI-powered battlecards
 * - Monitor competitors for changes
 * - Access competitive intelligence in real-time
 */

'use client';

import React, { useState } from 'react';
import { CompetitorProfileCard } from '@/components/battlecard/CompetitorProfileCard';
import { BattlecardView } from '@/components/battlecard/BattlecardView';
import type { CompetitorProfile, Battlecard, BattlecardOptions } from '@/lib/battlecard';
import { showSuccessToast } from '@/components/ErrorToast';
import { auth } from '@/lib/firebase/config';
interface ApiErrorResponse {
  error?: string;
}

interface DiscoverCompetitorResponse {
  profile: CompetitorProfile;
}

interface GenerateBattlecardResponse {
  battlecard: Battlecard;
}

export default function BattlecardsPage() {
  const [view, setView] = useState<'discovery' | 'battlecard'>('discovery');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Discovery state
  const [competitorDomain, setCompetitorDomain] = useState('');
  const [competitorProfile, setCompetitorProfile] = useState<CompetitorProfile | null>(null);
  
  // Battlecard state
  const [ourProduct, setOurProduct] = useState('');
  const [battlecard, setBattlecard] = useState<Battlecard | null>(null);

  const handleDiscoverCompetitor = async () => {
    if (!competitorDomain.trim()) {
      setError('Please enter a competitor domain');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch('/api/battlecard/competitor/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          domain: competitorDomain,
        }),
      });

      const data = await response.json() as ApiErrorResponse | DiscoverCompetitorResponse;

      if (!response.ok) {
        const errorData = data as ApiErrorResponse;
        throw new Error(errorData.error ?? 'Failed to discover competitor');
      }

      const successData = data as DiscoverCompetitorResponse;
      setCompetitorProfile(successData.profile);
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to discover competitor:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateBattlecard = async () => {
    if (!competitorProfile) {
      setError('Please discover a competitor first');
      return;
    }

    if (!ourProduct.trim()) {
      setError('Please enter your product name');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const options: BattlecardOptions = {
        ourProduct,
        includeAdvanced: true,
        focusAreas: ['features', 'pricing', 'positioning', 'objections'],
      };

      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch('/api/battlecard/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          competitorDomain: competitorProfile.domain,
          options,
        }),
      });

      const data = await response.json() as ApiErrorResponse | GenerateBattlecardResponse;

      if (!response.ok) {
        const errorData = data as ApiErrorResponse;
        throw new Error(errorData.error ?? 'Failed to generate battlecard');
      }

      const successData = data as GenerateBattlecardResponse;
      setBattlecard(successData.battlecard);
      setView('battlecard');
      setError(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to generate battlecard:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)]">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary to-secondary border-b border-border-light">
        <div className="px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)] mb-2">
                🎯 Competitive Battlecards
              </h1>
              <p className="text-[var(--color-text-secondary)]">
                AI-powered competitive intelligence for winning more deals
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setView('discovery')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'discovery'
                    ? 'bg-primary text-white'
                    : 'bg-surface-elevated text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Discover Competitor
              </button>
              {battlecard && (
                <button
                  onClick={() => setView('battlecard')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    view === 'battlecard'
                      ? 'bg-primary text-white'
                      : 'bg-surface-elevated text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  }`}
                >
                  View Battlecard
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 border border-error/30 rounded-lg p-4" style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}>
            <div className="flex items-center">
              <svg className="w-5 h-5 text-error mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-error text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Discovery View */}
        {view === 'discovery' && (
          <div className="space-y-6">
            {/* Discovery Form */}
            <div className="bg-surface-paper border border-border-light rounded-lg p-6">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Discover Competitor
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                    Competitor Domain
                  </label>
                  <input
                    type="text"
                    value={competitorDomain}
                    onChange={(e) => setCompetitorDomain(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        void handleDiscoverCompetitor();
                      }
                    }}
                    placeholder="competitor.com"
                    className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-[var(--color-text-disabled)] mt-1">
                    Enter competitor&apos;s website domain (e.g., salesforce.com, hubspot.com)
                  </p>
                </div>
                <button
                  onClick={() => { void handleDiscoverCompetitor(); }}
                  disabled={isLoading || !competitorDomain.trim()}
                  className="w-full px-6 py-3 bg-primary hover:from-primary-light hover:to-secondary-light disabled:bg-surface-elevated disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Discovering...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Discover Competitor
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Competitor Profile */}
            {competitorProfile && (
              <>
                <CompetitorProfileCard profile={competitorProfile} />

                {/* Generate Battlecard */}
                <div className="bg-surface-paper border border-border-light rounded-lg p-6">
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Generate Battlecard
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                        Your Product Name
                      </label>
                      <input
                        type="text"
                        value={ourProduct}
                        onChange={(e) => setOurProduct(e.target.value)}
                        placeholder="SalesVelocity"
                        className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary"
                        disabled={isLoading}
                      />
                    </div>
                    <button
                      onClick={() => { void handleGenerateBattlecard(); }}
                      disabled={isLoading || !ourProduct.trim()}
                      className="w-full px-6 py-3 bg-primary hover:bg-primary-light disabled:bg-surface-elevated disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center"
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Generating Battlecard...
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          Generate AI Battlecard
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Empty State */}
            {!competitorProfile && !isLoading && (
              <div className="bg-surface-paper border-2 border-dashed border-border-light rounded-lg p-12 text-center">
                <svg className="w-16 h-16 mx-auto text-[var(--color-text-disabled)] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-[var(--color-text-secondary)] mb-2">
                  No Competitor Discovered Yet
                </h3>
                <p className="text-[var(--color-text-disabled)] text-sm max-w-md mx-auto">
                  Enter a competitor&apos;s domain above to start gathering competitive intelligence.
                  Our AI will scrape their website, analyze their offering, and identify strengths & weaknesses.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Battlecard View */}
        {view === 'battlecard' && battlecard && (
          <div className="space-y-6">
            <BattlecardView battlecard={battlecard} />
            
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setView('discovery')}
                className="px-6 py-2 bg-surface-elevated hover:bg-surface-paper text-white rounded-lg font-medium transition-colors"
              >
                Discover Another Competitor
              </button>
              <button
                onClick={() => {
                  showSuccessToast('Battlecard export is being prepared. Check your downloads shortly.');
                }}
                className="px-6 py-2 bg-primary hover:bg-primary-light text-white rounded-lg font-medium transition-colors flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Battlecard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
