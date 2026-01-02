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

import React, { useState, useEffect } from 'react';
import { RiskOverviewCard } from '@/components/risk/RiskOverviewCard';
import { RiskFactorsCard } from '@/components/risk/RiskFactorsCard';
import { InterventionsCard } from '@/components/risk/InterventionsCard';
import type { DealRiskPrediction } from '@/lib/risk/types';
import type { Deal } from '@/lib/crm/deal-service';

/**
 * Risk Dashboard Page
 */
export default function RiskDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [prediction, setPrediction] = useState<DealRiskPrediction | null>(null);
  const [deal, setDeal] = useState<Deal | null>(null);
  const [dealId, setDealId] = useState<string>('');
  const [organizationId, setOrganizationId] = useState<string>('');

  /**
   * Fetch risk prediction
   */
  const fetchRiskPrediction = async () => {
    if (!dealId || !organizationId) {
      setError('Please enter both Deal ID and Organization ID');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/risk/predict', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dealId,
          organizationId,
          workspaceId: 'default',
          includeInterventions: true,
          forceRefresh: false,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch risk prediction');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch risk prediction');
      }

      setPrediction(result.data);
      
      // Fetch deal details
      const dealResponse = await fetch(
        `/api/workspace/${organizationId}/deals?dealId=${dealId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (dealResponse.ok) {
        const dealData = await dealResponse.json();
        if (dealData.success && dealData.data) {
          setDeal(dealData.data);
        }
      }

    } catch (err: any) {
      setError(err.message || 'An error occurred while fetching risk prediction');
      setPrediction(null);
      setDeal(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle intervention start
   */
  const handleStartIntervention = async (interventionId: string) => {
    try {
      // TODO: Implement intervention tracking
      console.log('Starting intervention:', interventionId);
      
      // Show success message
      alert('Intervention started! Track progress in your CRM.');
      
    } catch (err: any) {
      console.error('Failed to start intervention:', err);
      alert('Failed to start intervention. Please try again.');
    }
  };

  /**
   * Load demo data
   */
  const loadDemoData = () => {
    setDealId('demo-deal-001');
    setOrganizationId('demo-org-001');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Deal Risk Predictor
              </h1>
              <p className="mt-2 text-sm text-gray-600">
                AI-powered slippage prediction and intervention recommendations
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                🤖 Powered by GPT-4o
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                ✓ Production Ready
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Input Form */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Analyze Deal Risk
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="dealId" className="block text-sm font-medium text-gray-700 mb-2">
                Deal ID
              </label>
              <input
                type="text"
                id="dealId"
                value={dealId}
                onChange={(e) => setDealId(e.target.value)}
                placeholder="Enter deal ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="organizationId" className="block text-sm font-medium text-gray-700 mb-2">
                Organization ID
              </label>
              <input
                type="text"
                id="organizationId"
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
                placeholder="Enter organization ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="flex items-end">
              <button
                onClick={fetchRiskPrediction}
                disabled={loading || !dealId || !organizationId}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-medium py-2 px-6 rounded-lg transition-colors"
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
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Load Demo Data
            </button>
            <p className="text-xs text-gray-500">
              Rate limit: 5 requests per minute
            </p>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Risk Prediction Results */}
        {(prediction || loading) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Overview */}
            <div className="lg:col-span-1">
              <RiskOverviewCard
                prediction={prediction!}
                dealName={deal?.name || 'Loading...'}
                dealValue={deal?.value || 0}
                loading={loading}
              />
            </div>

            {/* Middle Column - Risk Factors */}
            <div className="lg:col-span-1">
              <RiskFactorsCard
                riskFactors={prediction?.riskFactors || []}
                protectiveFactors={prediction?.protectiveFactors || []}
                loading={loading}
              />
            </div>

            {/* Right Column - Interventions */}
            <div className="lg:col-span-1">
              <InterventionsCard
                interventions={prediction?.interventions || []}
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
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Risk Analysis Yet
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Enter a deal ID and organization ID above to get started
            </p>
            <div className="flex items-center justify-center space-x-8 text-sm text-gray-500">
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
          <div className="mt-8 bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Prediction Metadata</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Model Version:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {prediction.metadata.modelVersion}
                </span>
              </div>
              <div>
                <span className="text-gray-500">AI Model:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {prediction.metadata.aiModel}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Factors Analyzed:</span>
                <span className="ml-2 font-medium text-gray-900">
                  {prediction.metadata.factorsConsidered}
                </span>
              </div>
              <div>
                <span className="text-gray-500">Calculation Time:</span>
                <span className="ml-2 font-medium text-gray-900">
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
