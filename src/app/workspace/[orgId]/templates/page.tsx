/**
 * Sales Templates Dashboard
 * 
 * Main dashboard for:
 * - Browsing and applying industry templates
 * - Viewing deal scores
 * - Revenue forecasting
 * - Quota tracking
 * 
 * Features:
 * - Template library with 5+ industry templates
 * - Predictive deal scoring with 7+ factors
 * - Revenue forecasting with confidence intervals
 * - Beautiful tabbed interface
 */

'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import TemplateSelector from '@/components/templates/TemplateSelector';
import DealScoreCard from '@/components/templates/DealScoreCard';
import RevenueForecastChart from '@/components/templates/RevenueForecastChart';
import type { DealScore, RevenueForecast } from '@/lib/templates';

type Tab = 'templates' | 'scoring' | 'forecasting';

export default function TemplatesDashboard() {
  const params = useParams();
  const organizationId = params?.orgId as string;
  const workspaceId = 'default';

  const [activeTab, setActiveTab] = useState<Tab>('templates');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('saas');
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [templateApplied, setTemplateApplied] = useState(false);

  // Deal Scoring State
  const [dealScores, setDealScores] = useState<Map<string, DealScore>>(new Map());
  const [loadingScores, setLoadingScores] = useState(false);

  // Revenue Forecast State
  const [forecast, setForecast] = useState<RevenueForecast | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [forecastPeriod, setForecastPeriod] = useState<'30-day' | '60-day' | '90-day'>('90-day');
  const [quota, setQuota] = useState<number>(500000);

  // Apply Template
  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) return;

    try {
      setApplyingTemplate(true);
      const response = await fetch('/api/templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          workspaceId,
          templateId: selectedTemplateId,
          merge: false,
          applyWorkflows: true,
          applyBestPractices: true
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setTemplateApplied(true);
        setTimeout(() => setTemplateApplied(false), 3000);
      }
    } catch (error) {
      console.error('Failed to apply template:', error);
    } finally {
      setApplyingTemplate(false);
    }
  };

  // Load Sample Deal Scores
  const loadDealScores = async () => {
    try {
      setLoadingScores(true);
      
      // Mock: In real app, fetch actual deals
      const mockDealIds = ['deal_1', 'deal_2', 'deal_3'];
      const scores = new Map<string, DealScore>();
      
      for (const dealId of mockDealIds) {
        const response = await fetch(`/api/templates/deals/${dealId}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            workspaceId,
            templateId: selectedTemplateId
          })
        });
        
        const data = await response.json();
        if (data.success) {
          scores.set(dealId, data.score);
        }
      }
      
      setDealScores(scores);
    } catch (error) {
      console.error('Failed to load deal scores:', error);
    } finally {
      setLoadingScores(false);
    }
  };

  // Generate Forecast
  const generateForecast = async () => {
    try {
      setLoadingForecast(true);
      
      const response = await fetch('/api/templates/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          workspaceId,
          period: forecastPeriod,
          quota,
          templateId: selectedTemplateId,
          includeQuotaPerformance: true
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setForecast(data.forecast);
      }
    } catch (error) {
      console.error('Failed to generate forecast:', error);
    } finally {
      setLoadingForecast(false);
    }
  };

  // Auto-load when switching tabs
  useEffect(() => {
    if (activeTab === 'scoring' && dealScores.size === 0) {
      loadDealScores();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'forecasting' && !forecast) {
      generateForecast();
    }
  }, [activeTab]);

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'templates', label: 'Industry Templates', icon: '📋' },
    { id: 'scoring', label: 'Deal Scoring', icon: '🎯' },
    { id: 'forecasting', label: 'Revenue Forecasting', icon: '📊' }
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-blue-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">
                Sales Intelligence Hub
              </h1>
              <p className="text-gray-300 text-lg">
                Industry templates, predictive scoring, and revenue forecasting
              </p>
            </div>
            {templateApplied && (
              <div className="bg-green-500/20 border border-green-500 text-green-400 px-6 py-3 rounded-lg flex items-center gap-2">
                <span className="text-2xl">✓</span>
                <span className="font-semibold">Template Applied!</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-6">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-3 rounded-t-lg font-semibold transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'bg-gray-900 text-white border-t-4 border-blue-500'
                    : 'bg-gray-800/50 text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                }`}
              >
                <span className="text-xl">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Choose Your Industry Template
                  </h2>
                  <p className="text-gray-400">
                    Pre-built sales processes optimized for your industry with stages, fields, workflows, and best practices
                  </p>
                </div>
                <button
                  onClick={handleApplyTemplate}
                  disabled={!selectedTemplateId || applyingTemplate}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    selectedTemplateId && !applyingTemplate
                      ? 'bg-blue-500 hover:bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  {applyingTemplate ? 'Applying...' : 'Apply Template'}
                </button>
              </div>

              <TemplateSelector
                organizationId={organizationId}
                selectedTemplateId={selectedTemplateId}
                onTemplateSelect={setSelectedTemplateId}
              />
            </div>

            {/* Template Benefits */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-blue-900 to-blue-800 rounded-lg p-6 border border-blue-700">
                <div className="text-4xl mb-3">⚡</div>
                <h3 className="text-xl font-bold text-white mb-2">Quick Setup</h3>
                <p className="text-blue-200">
                  Get started in minutes with pre-configured sales stages, custom fields, and automated workflows
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-900 to-purple-800 rounded-lg p-6 border border-purple-700">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="text-xl font-bold text-white mb-2">Best Practices</h3>
                <p className="text-purple-200">
                  Built-in industry best practices, discovery questions, and objection handling strategies
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-900 to-green-800 rounded-lg p-6 border border-green-700">
                <div className="text-4xl mb-3">📊</div>
                <h3 className="text-xl font-bold text-white mb-2">Data-Driven</h3>
                <p className="text-green-200">
                  Industry benchmarks for deal size, sales cycle, win rates, and forecasting accuracy
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Deal Scoring Tab */}
        {activeTab === 'scoring' && (
          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Predictive Deal Scoring
                  </h2>
                  <p className="text-gray-400">
                    AI-powered deal scoring with 7+ factors: age, velocity, engagement, decision maker, budget, competition, and historical win rate
                  </p>
                </div>
                <button
                  onClick={loadDealScores}
                  disabled={loadingScores}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:bg-gray-700 disabled:text-gray-500"
                >
                  {loadingScores ? 'Loading...' : 'Refresh Scores'}
                </button>
              </div>

              {loadingScores ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : dealScores.size > 0 ? (
                <div className="space-y-6">
                  {Array.from(dealScores.entries()).map(([dealId, score]) => (
                    <DealScoreCard
                      key={dealId}
                      dealId={dealId}
                      dealName={`Deal ${dealId.split('_')[1]}`}
                      score={score}
                      showDetails={true}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🎯</div>
                  <p className="text-gray-400 mb-4">No deals scored yet</p>
                  <button
                    onClick={loadDealScores}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    Score Sample Deals
                  </button>
                </div>
              )}
            </div>

            {/* Scoring Benefits */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl mb-2">🔍</div>
                <h4 className="text-white font-semibold mb-1">7+ Scoring Factors</h4>
                <p className="text-gray-400 text-sm">
                  Deal age, stage velocity, engagement, decision maker, budget, competition, historical win rate
                </p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl mb-2">⚠️</div>
                <h4 className="text-white font-semibold mb-1">Risk Detection</h4>
                <p className="text-gray-400 text-sm">
                  Automatically identifies at-risk deals with severity levels and mitigation strategies
                </p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl mb-2">💡</div>
                <h4 className="text-white font-semibold mb-1">AI Recommendations</h4>
                <p className="text-gray-400 text-sm">
                  Actionable next steps to improve deal scores and increase win probability
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Forecasting Tab */}
        {activeTab === 'forecasting' && (
          <div className="space-y-6">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Revenue Forecasting
                  </h2>
                  <p className="text-gray-400">
                    Stage-weighted pipeline forecasting with quota tracking and confidence intervals
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <select
                    value={forecastPeriod}
                    onChange={(e) => setForecastPeriod(e.target.value as '30-day' | '60-day' | '90-day')}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg border border-gray-600 focus:outline-none focus:border-blue-500"
                  >
                    <option value="30-day">30-Day</option>
                    <option value="60-day">60-Day</option>
                    <option value="90-day">90-Day</option>
                  </select>
                  <button
                    onClick={generateForecast}
                    disabled={loadingForecast}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:bg-gray-700 disabled:text-gray-500"
                  >
                    {loadingForecast ? 'Generating...' : 'Generate Forecast'}
                  </button>
                </div>
              </div>

              {loadingForecast ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                </div>
              ) : forecast ? (
                <RevenueForecastChart
                  forecast={forecast}
                  showStageBreakdown={true}
                  showQuotaTracking={true}
                />
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📊</div>
                  <p className="text-gray-400 mb-4">No forecast generated yet</p>
                  <button
                    onClick={generateForecast}
                    className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors"
                  >
                    Generate Forecast
                  </button>
                </div>
              )}
            </div>

            {/* Forecasting Benefits */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl mb-2">📈</div>
                <h4 className="text-white font-semibold mb-1">3 Scenarios</h4>
                <p className="text-gray-400 text-sm">
                  Best case, most likely, and worst case revenue forecasts with confidence intervals
                </p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl mb-2">🎯</div>
                <h4 className="text-white font-semibold mb-1">Quota Tracking</h4>
                <p className="text-gray-400 text-sm">
                  Real-time quota attainment tracking with gap analysis and pipeline coverage
                </p>
              </div>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="text-3xl mb-2">📍</div>
                <h4 className="text-white font-semibold mb-1">Stage Breakdown</h4>
                <p className="text-gray-400 text-sm">
                  Revenue weighted by stage probability based on industry benchmarks
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
