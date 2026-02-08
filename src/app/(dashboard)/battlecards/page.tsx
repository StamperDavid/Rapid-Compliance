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
      const response = await fetch('/api/battlecard/competitor/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      const response = await fetch('/api/battlecard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">
                🎯 Competitive Battlecards
              </h1>
              <p className="text-gray-400">
                AI-powered competitive intelligence for winning more deals
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setView('discovery')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === 'discovery'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Discover Competitor
              </button>
              {battlecard && (
                <button
                  onClick={() => setView('battlecard')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    view === 'battlecard'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
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
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <div className="flex items-center">
              <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Discovery View */}
        {view === 'discovery' && (
          <div className="space-y-6">
            {/* Discovery Form */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <svg className="w-6 h-6 mr-2 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Discover Competitor
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Competitor Domain
                  </label>
                  <input
                    type="text"
                    value={competitorDomain}
                    onChange={(e) => setCompetitorDomain(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        void handleDiscoverCompetitor();
                      }
                    }}
                    placeholder="competitor.com"
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Enter competitor&apos;s website domain (e.g., salesforce.com, hubspot.com)
                  </p>
                </div>
                <button
                  onClick={() => { void handleDiscoverCompetitor(); }}
                  disabled={isLoading || !competitorDomain.trim()}
                  className="w-full px-6 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center"
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
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
                  <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                    <svg className="w-6 h-6 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                    Generate Battlecard
                  </h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Your Product Name
                      </label>
                      <input
                        type="text"
                        value={ourProduct}
                        onChange={(e) => setOurProduct(e.target.value)}
                        placeholder="SalesVelocity"
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                        disabled={isLoading}
                      />
                    </div>
                    <button
                      onClick={() => { void handleGenerateBattlecard(); }}
                      disabled={isLoading || !ourProduct.trim()}
                      className="w-full px-6 py-3 bg-purple-500 hover:bg-purple-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center"
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
              <div className="bg-gray-900 border-2 border-dashed border-gray-800 rounded-lg p-12 text-center">
                <svg className="w-16 h-16 mx-auto text-gray-700 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="text-lg font-semibold text-gray-400 mb-2">
                  No Competitor Discovered Yet
                </h3>
                <p className="text-gray-600 text-sm max-w-md mx-auto">
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
                className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
              >
                Discover Another Competitor
              </button>
              <button
                onClick={() => {
                  // TODO: Implement export to PDF
                  showSuccessToast('Export to PDF - Coming soon!');
                }}
                className="px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium transition-colors flex items-center"
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
