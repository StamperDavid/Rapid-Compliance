/**
 * Email Sequence Intelligence Dashboard
 * 
 * Main dashboard page for email sequence analysis with AI-powered insights,
 * pattern detection, and optimization recommendations.
 * 
 * @module app/dashboard/sequence
 */

'use client';

import React, { useState, useEffect } from 'react';
import { SequenceAnalysis, SequenceAnalysisResponse } from '@/lib/sequence';
import { SequenceOverviewCard } from '@/components/sequence/SequenceOverviewCard';
import { SequencePerformanceCard } from '@/components/sequence/SequencePerformanceCard';
import { SequencePatternsCard } from '@/components/sequence/SequencePatternsCard';
import { SequenceOptimizationCard } from '@/components/sequence/SequenceOptimizationCard';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SequenceIntelligencePage() {
  const [analysis, setAnalysis] = useState<SequenceAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cached, setCached] = useState(false);
  
  // Fetch sequence analysis
  const fetchAnalysis = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/sequence/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': 'demo-user', // TODO: Replace with actual user ID
        },
        body: JSON.stringify({
          sequenceId: 'demo-sequence-1', // TODO: Replace with actual sequence ID
          includePatterns: true,
          includeOptimizations: true,
          includeTimingAnalysis: true,
          includeABTests: false,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json() as SequenceAnalysisResponse;
        throw new Error(errorData.error?.message || 'Failed to fetch analysis');
      }
      
      const data = await response.json() as SequenceAnalysisResponse;
      
      if (data.success && data.analysis) {
        setAnalysis(data.analysis);
        setCached(data.metadata.cached);
      } else {
        throw new Error(data.error?.message || 'No analysis data returned');
      }
    } catch (err) {
      console.error('Error fetching sequence analysis:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  // Load analysis on mount
  useEffect(() => {
    fetchAnalysis();
  }, []);
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Email Sequence Intelligence</h1>
            <p className="text-gray-600 mt-2">
              AI-powered sequence analysis with performance insights and optimization recommendations
            </p>
          </div>
          <button
            onClick={fetchAnalysis}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Analyzing...' : 'Refresh Analysis'}</span>
          </button>
        </div>
        
        {cached && !loading && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              ℹ️ Showing cached results. Analysis updates every hour.
            </p>
          </div>
        )}
      </div>
      
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Analyzing email sequences with AI...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
          </div>
        </div>
      )}
      
      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-red-900">Analysis Failed</h3>
              <p className="text-red-800 mt-1">{error}</p>
              <button
                onClick={fetchAnalysis}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Analysis Dashboard */}
      {analysis && !loading && !error && (
        <div className="space-y-6">
          {/* Overview Card */}
          <SequenceOverviewCard analysis={analysis} />
          
          {/* Performance Card */}
          <SequencePerformanceCard analysis={analysis} />
          
          {/* Two Column Layout for Patterns and Optimizations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SequencePatternsCard analysis={analysis} />
            <SequenceOptimizationCard analysis={analysis} />
          </div>
          
          {/* Timing Analysis */}
          {analysis.timingAnalysis && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Timing Analysis</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Best Send Times */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Best Send Times</h3>
                  <div className="space-y-2">
                    {analysis.timingAnalysis.bestSendTimes.slice(0, 5).map((time, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded">
                        <span className="text-sm font-medium text-gray-900">
                          {time.hour}:00 - {time.hour + 1}:00
                        </span>
                        <div className="text-xs text-gray-600">
                          <span className="font-medium text-green-600">{time.replyRate.toFixed(1)}%</span> reply
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Best Days */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Best Days of Week</h3>
                  <div className="space-y-2">
                    {analysis.timingAnalysis.bestDaysOfWeek.slice(0, 5).map((day, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-green-50 rounded">
                        <span className="text-sm font-medium text-gray-900 capitalize">
                          {day.day}
                        </span>
                        <div className="text-xs text-gray-600">
                          <span className="font-medium text-green-600">{day.replyRate.toFixed(1)}%</span> reply
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Recommendation */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="text-sm font-semibold text-blue-900 mb-2">Timing Recommendation</h3>
                <p className="text-sm text-blue-800">{analysis.timingAnalysis.recommendation}</p>
              </div>
            </div>
          )}
          
          {/* Footer */}
          <div className="text-center text-sm text-gray-500 pt-6">
            Analysis generated at {new Date(analysis.generatedAt).toLocaleString()} • 
            {' '}Time range: {new Date(analysis.timeRange.start).toLocaleDateString()} - {new Date(analysis.timeRange.end).toLocaleDateString()}
          </div>
        </div>
      )}
    </div>
  );
}
