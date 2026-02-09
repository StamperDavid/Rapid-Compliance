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
import TemplateSelector from '@/components/templates/TemplateSelector';
import DealScoreCard from '@/components/templates/DealScoreCard';
import RevenueForecastChart from '@/components/templates/RevenueForecastChart';
import type { DealScore, RevenueForecast } from '@/lib/templates';
import { PLATFORM_ID } from '@/lib/constants/platform';

type Tab = 'templates' | 'scoring' | 'forecasting';

export default function TemplatesDashboard() {
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
  const [quota, _setQuota] = useState<number>(500000);

  // Apply Template
  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) {return;}

    try {
      setApplyingTemplate(true);
      const response = await fetch('/api/templates/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId,
          templateId: selectedTemplateId,
          merge: false,
          applyWorkflows: true,
          applyBestPractices: true
        })
      });

      const data = await response.json() as { success: boolean };
      
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

  // Load Deal Scores from Firestore
  const loadDealScores = async () => {
    try {
      setLoadingScores(true);

      // Fetch real deal IDs from Firestore
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      const collectionPath = `organizations/${PLATFORM_ID}/workspaces/${workspaceId}/entities/deals/records`;
      const dealRecords = await FirestoreService.getAll<{ id: string }>(collectionPath);
      const dealIds = dealRecords.map(d => d.id);
      const scores = new Map<string, DealScore>();

      for (const dealId of dealIds) {
        const response = await fetch(`/api/templates/deals/${dealId}/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspaceId,
            templateId: selectedTemplateId
          })
        });

        const data = await response.json() as { success: boolean; score: DealScore };
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
          workspaceId,
          period: forecastPeriod,
          quota,
          templateId: selectedTemplateId,
          includeQuotaPerformance: true
        })
      });

      const data = await response.json() as { success: boolean; forecast: RevenueForecast };
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
      void loadDealScores();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'forecasting' && !forecast) {
      void generateForecast();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const tabs: Array<{ id: Tab; label: string; icon: string }> = [
    { id: 'templates', label: 'Industry Templates', icon: '📋' },
    { id: 'scoring', label: 'Deal Scoring', icon: '🎯' },
    { id: 'forecasting', label: 'Revenue Forecasting', icon: '📊' }
  ];

  return (
    <div className="min-h-screen bg-surface-paper">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary via-primary to-secondary border-b border-border-light">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-[var(--color-text-primary)] mb-2">
                Sales Intelligence Hub
              </h1>
              <p className="text-[var(--color-text-secondary)] text-lg">
                Industry templates, predictive scoring, and revenue forecasting
              </p>
            </div>
            {templateApplied && (
              <div className="bg-green-500/20 border border-green-500 text-success px-6 py-3 rounded-lg flex items-center gap-2">
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
                    ? 'bg-surface-paper text-[var(--color-text-primary)] border-t-4 border-primary'
                    : 'bg-surface-elevated text-[var(--color-text-secondary)] hover:bg-surface-elevated hover:text-[var(--color-text-primary)]'
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
            <div className="bg-surface-elevated border border-border-light rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                    Choose Your Industry Template
                  </h2>
                  <p className="text-[var(--color-text-secondary)]">
                    Pre-built sales processes optimized for your industry with stages, fields, workflows, and best practices
                  </p>
                </div>
                <button
                  onClick={() => void handleApplyTemplate()}
                  disabled={!selectedTemplateId || applyingTemplate}
                  className={`px-6 py-3 rounded-lg font-semibold transition-all ${
                    selectedTemplateId && !applyingTemplate
                      ? 'bg-primary hover:bg-primary-light text-[var(--color-text-primary)]'
                      : 'bg-surface-main text-[var(--color-text-disabled)] cursor-not-allowed'
                  }`}
                >
                  {applyingTemplate ? 'Applying...' : 'Apply Template'}
                </button>
              </div>

              <TemplateSelector
                selectedTemplateId={selectedTemplateId}
                onTemplateSelect={setSelectedTemplateId}
              />
            </div>

            {/* Template Benefits */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-gradient-to-br from-primary to-primary-light rounded-lg p-6 border border-primary">
                <div className="text-4xl mb-3">⚡</div>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Quick Setup</h3>
                <p className="text-[var(--color-text-secondary)]">
                  Get started in minutes with pre-configured sales stages, custom fields, and automated workflows
                </p>
              </div>
              <div className="bg-gradient-to-br from-secondary to-secondary-light rounded-lg p-6 border border-secondary">
                <div className="text-4xl mb-3">🎯</div>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Best Practices</h3>
                <p className="text-[var(--color-text-secondary)]">
                  Built-in industry best practices, discovery questions, and objection handling strategies
                </p>
              </div>
              <div className="bg-gradient-to-br from-success to-[#22c55e] rounded-lg p-6 border border-success">
                <div className="text-4xl mb-3">📊</div>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2">Data-Driven</h3>
                <p className="text-[var(--color-text-secondary)]">
                  Industry benchmarks for deal size, sales cycle, win rates, and forecasting accuracy
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Deal Scoring Tab */}
        {activeTab === 'scoring' && (
          <div className="space-y-6">
            <div className="bg-surface-elevated border border-border-light rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                    Predictive Deal Scoring
                  </h2>
                  <p className="text-[var(--color-text-secondary)]">
                    AI-powered deal scoring with 7+ factors: age, velocity, engagement, decision maker, budget, competition, and historical win rate
                  </p>
                </div>
                <button
                  onClick={() => void loadDealScores()}
                  disabled={loadingScores}
                  className="px-6 py-3 bg-primary hover:bg-primary-light text-[var(--color-text-primary)] rounded-lg font-semibold transition-colors disabled:bg-[var(--color-bg-elevated)] disabled:text-[var(--color-text-disabled)]"
                >
                  {loadingScores ? 'Loading...' : 'Refresh Scores'}
                </button>
              </div>

              {loadingScores ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
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
                  <p className="text-[var(--color-text-secondary)] mb-4">No deals scored yet</p>
                  <button
                    onClick={() => void loadDealScores()}
                    className="px-6 py-3 bg-primary hover:bg-primary-light text-[var(--color-text-primary)] rounded-lg font-semibold transition-colors"
                  >
                    Score Sample Deals
                  </button>
                </div>
              )}
            </div>

            {/* Scoring Benefits */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-surface-elevated border border-border-light rounded-lg p-4">
                <div className="text-3xl mb-2">🔍</div>
                <h4 className="text-[var(--color-text-primary)] font-semibold mb-1">7+ Scoring Factors</h4>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Deal age, stage velocity, engagement, decision maker, budget, competition, historical win rate
                </p>
              </div>
              <div className="bg-surface-elevated border border-border-light rounded-lg p-4">
                <div className="text-3xl mb-2">⚠️</div>
                <h4 className="text-[var(--color-text-primary)] font-semibold mb-1">Risk Detection</h4>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Automatically identifies at-risk deals with severity levels and mitigation strategies
                </p>
              </div>
              <div className="bg-surface-elevated border border-border-light rounded-lg p-4">
                <div className="text-3xl mb-2">💡</div>
                <h4 className="text-[var(--color-text-primary)] font-semibold mb-1">AI Recommendations</h4>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Actionable next steps to improve deal scores and increase win probability
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Revenue Forecasting Tab */}
        {activeTab === 'forecasting' && (
          <div className="space-y-6">
            <div className="bg-surface-elevated border border-border-light rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
                    Revenue Forecasting
                  </h2>
                  <p className="text-[var(--color-text-secondary)]">
                    Stage-weighted pipeline forecasting with quota tracking and confidence intervals
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <select
                    value={forecastPeriod}
                    onChange={(e) => setForecastPeriod(e.target.value as '30-day' | '60-day' | '90-day')}
                    className="px-4 py-2 bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border-light)] focus:outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="30-day">30-Day</option>
                    <option value="60-day">60-Day</option>
                    <option value="90-day">90-Day</option>
                  </select>
                  <button
                    onClick={() => void generateForecast()}
                    disabled={loadingForecast}
                    className="px-6 py-3 bg-primary hover:bg-primary-light text-[var(--color-text-primary)] rounded-lg font-semibold transition-colors disabled:bg-[var(--color-bg-elevated)] disabled:text-[var(--color-text-disabled)]"
                  >
                    {loadingForecast ? 'Generating...' : 'Generate Forecast'}
                  </button>
                </div>
              </div>

              {loadingForecast ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--color-primary)]"></div>
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
                  <p className="text-[var(--color-text-secondary)] mb-4">No forecast generated yet</p>
                  <button
                    onClick={() => void generateForecast()}
                    className="px-6 py-3 bg-primary hover:bg-primary-light text-[var(--color-text-primary)] rounded-lg font-semibold transition-colors"
                  >
                    Generate Forecast
                  </button>
                </div>
              )}
            </div>

            {/* Forecasting Benefits */}
            <div className="grid grid-cols-3 gap-6">
              <div className="bg-surface-elevated border border-border-light rounded-lg p-4">
                <div className="text-3xl mb-2">📈</div>
                <h4 className="text-[var(--color-text-primary)] font-semibold mb-1">3 Scenarios</h4>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Best case, most likely, and worst case revenue forecasts with confidence intervals
                </p>
              </div>
              <div className="bg-surface-elevated border border-border-light rounded-lg p-4">
                <div className="text-3xl mb-2">🎯</div>
                <h4 className="text-[var(--color-text-primary)] font-semibold mb-1">Quota Tracking</h4>
                <p className="text-[var(--color-text-secondary)] text-sm">
                  Real-time quota attainment tracking with gap analysis and pipeline coverage
                </p>
              </div>
              <div className="bg-surface-elevated border border-border-light rounded-lg p-4">
                <div className="text-3xl mb-2">📍</div>
                <h4 className="text-[var(--color-text-primary)] font-semibold mb-1">Stage Breakdown</h4>
                <p className="text-[var(--color-text-secondary)] text-sm">
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
