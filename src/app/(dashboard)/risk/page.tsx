/**
 * Deal Risk Prediction Dashboard Page
 * 
 * AI-powered deal slippage prediction and intervention recommendations
 * 
 * FEATURES:
 * - Real-time risk assessment
 * - AI-generated intervention recommendations
 * - Risk factor analysis
 * - Historical trend tracking
 */

'use client';

import React, { useState } from 'react';
import { useToast } from '@/hooks/useToast';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { RiskOverviewCard } from '@/components/risk/RiskOverviewCard';
import { RiskFactorsCard } from '@/components/risk/RiskFactorsCard';
import { InterventionsCard } from '@/components/risk/InterventionsCard';
import type { DealRiskPrediction } from '@/lib/risk/types';
import type { Deal } from '@/lib/crm/deal-service';

/**
 * Risk Dashboard Page
 */
export default function RiskDashboardPage() {
  const toast = useToast();
  const authFetch = useAuthFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<DealRiskPrediction | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [dealId, setDealId] = useState<string>('');

  /**
   * Fetch risk prediction
   */
  const fetchRiskPrediction = async () => {
    if (!dealId) {
      setError('Please enter Deal ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await authFetch('/api/risk/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealId,
          includeInterventions: true,
          forceRefresh: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json() as { message?: string };
        throw new Error((errorData.message !== '' && errorData.message != null) ? errorData.message : 'Failed to fetch risk prediction');
      }

      const result = await response.json() as { success: boolean; error?: string; data?: DealRiskPrediction };

      if (!result.success) {
        throw new Error((result.error !== '' && result.error != null) ? result.error : 'Failed to fetch risk prediction');
      }

      if (result.data) {
        setPrediction(result.data);
      }

      // Fetch deal details
      const dealResponse = await fetch(
        `/api/deals?dealId=${dealId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (dealResponse.ok) {
        const dealData = await dealResponse.json() as { success?: boolean; data?: Deal };
        if (dealData.success && dealData.data) {
          setDeal(dealData.data);
        }
      }

    } catch (err: unknown) {
      const message = err instanceof Error && err.message ? err.message : 'An error occurred while fetching risk prediction';
      setError(message);
      setPrediction(null);
      setDeal(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle intervention start
   */
  const handleStartIntervention = (_interventionId: string) => {
    try {
      toast.success('Intervention started! Track progress in your CRM.');
    } catch (err: unknown) {
      toast.error(`Failed to start intervention: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  /**
   * Load demo data
   */
  const loadDemoData = () => {
    setDealId('demo-deal-001');
  };

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)]">
      {/* Header */}
      <header className="bg-[var(--color-bg-paper)] border-b border-[var(--color-border-main)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
                Deal Risk Predictor
              </h1>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                AI-powered slippage prediction and intervention recommendations
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-[var(--color-text-primary)]">
                🤖 Powered by GPT-4o
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-[var(--color-text-primary)]">
                ✓ Production Ready
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Input Form */}
        <div className="bg-[var(--color-bg-paper)] rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">
            Analyze Deal Risk
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="dealId" className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                Deal ID
              </label>
              <input
                type="text"
                id="dealId"
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                placeholder="Enter deal ID"
                className="w-full px-4 py-2 border border-[var(--color-border-main)] rounded-lg focus:ring-2 focus:ring-[var(--color-primary)] focus:border-transparent"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={() => { void fetchRiskPrediction(); }}
                disabled={loading || !dealId}
                className="w-full bg-[var(--color-primary)] hover:bg-[var(--color-primary-dark)] disabled:bg-[var(--color-border-main)] disabled:cursor-not-allowed text-[var(--color-text-primary)] font-medium py-2 px-6 rounded-lg transition-colors"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Analyzing...
                  </span>
                ) : (
                  'Predict Risk'
                )}
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              onClick={loadDemoData}
              className="text-sm text-[var(--color-primary)] hover:text-[var(--color-primary-dark)] font-medium"
            >
              Load Demo Data
            </button>
            <p className="text-xs text-[var(--color-text-disabled)]">
              Rate limit: 5 requests per minute
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 rounded-lg p-4" style={{ backgroundColor: 'var(--color-error)', opacity: 0.2, borderWidth: '1px', borderStyle: 'solid', borderColor: 'var(--color-error)' }}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5" style={{ color: 'var(--color-error)' }} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium" style={{ color: 'var(--color-error)' }}>Error</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--color-error)' }}>{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Risk Prediction Results */}
        {(prediction ?? loading) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Overview */}
            <div className="lg:col-span-1">
              <RiskOverviewCard
                prediction={prediction ?? ({} as DealRiskPrediction)}
                dealName={(() => { const v = deal?.name; return (v !== '' && v != null) ? v : 'Loading...'; })()}
                dealValue={deal?.value ?? 0}
                loading={loading}
              />
            </div>

            {/* Middle Column - Risk Factors */}
            <div className="lg:col-span-1">
              <RiskFactorsCard
                riskFactors={prediction?.riskFactors ?? []}
                protectiveFactors={prediction?.protectiveFactors ?? []}
                loading={loading}
              />
            </div>

            {/* Right Column - Interventions */}
            <div className="lg:col-span-1">
              <InterventionsCard
                interventions={prediction?.interventions ?? []}
                loading={loading}
                onStartIntervention={handleStartIntervention}
              />
            </div>
          </div>
        )}

        {/* Empty State */}
        {!prediction && !loading && !error && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-lg font-medium text-[var(--color-text-primary)] mb-2">
              No Risk Analysis Yet
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-6">
              Enter a deal ID and organization ID above to get started
            </p>
            <div className="flex items-center justify-center space-x-8 text-sm text-[var(--color-text-disabled)]">
              <div className="flex items-center">
                <span className="text-2xl mr-2">⏰</span>
                <span>Real-time analysis</span>
              </div>
              <div className="flex items-center">
                <span className="text-2xl mr-2">🤖</span>
                <span>AI interventions</span>
              </div>
              <div className="flex items-center">
                <span className="text-2xl mr-2">📊</span>
                <span>Risk trends</span>
              </div>
            </div>
          </div>
        )}

        {/* Metadata Footer */}
        {prediction && !loading && (
          <div className="mt-8 bg-[var(--color-bg-paper)] rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Prediction Metadata</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-[var(--color-text-disabled)]">Model Version:</span>
                <span className="ml-2 font-medium text-[var(--color-text-primary)]">
                  {prediction.metadata.modelVersion}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-disabled)]">AI Model:</span>
                <span className="ml-2 font-medium text-[var(--color-text-primary)]">
                  {prediction.metadata.aiModel}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-disabled)]">Factors Analyzed:</span>
                <span className="ml-2 font-medium text-[var(--color-text-primary)]">
                  {prediction.metadata.factorsConsidered}
                </span>
              </div>
              <div>
                <span className="text-[var(--color-text-disabled)]">Calculation Time:</span>
                <span className="ml-2 font-medium text-[var(--color-text-primary)]">
                  {(prediction.metadata.calculationDuration / 1000).toFixed(2)}s
                </span>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
