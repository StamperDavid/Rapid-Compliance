/**
 * Playbook Builder Dashboard Page
 * 
 * Main interface for viewing and managing playbooks.
 * Displays playbook library, patterns, talk tracks, and adoption metrics.
 * 
 * FEATURES:
 * - Browse playbook library
 * - View extracted patterns and talk tracks
 * - Track playbook adoption and effectiveness
 * - Generate new playbooks
 * 
 * @module app/dashboard/playbook
 */

'use client';

import React, { useState, useEffect } from 'react';
import { PlaybooksCard } from '@/components/playbook/PlaybooksCard';
import { PatternsCard } from '@/components/playbook/PatternsCard';
import { TalkTracksCard } from '@/components/playbook/TalkTracksCard';
import { AdoptionMetricsCard } from '@/components/playbook/AdoptionMetricsCard';
import type {
  Playbook,
  PlaybookAdoptionMetrics,
} from '@/lib/playbook/types';

// Mock data for development
const mockPlaybooks: Playbook[] = [
  {
    id: 'playbook_1',
    organizationId: 'org_123',
    workspaceId: 'workspace_1',
    name: 'Discovery Call Mastery',
    description: 'Proven patterns and talk tracks for conducting highly effective discovery calls',
    category: 'discovery',
    tags: ['discovery_call', 'discovery', 'B2B'],
    conversationType: 'discovery_call',
    patterns: [],
    talkTracks: [],
    objectionResponses: [],
    bestPractices: [],
    successMetrics: {
      avgConversionRate: 78,
      vsBaselineConversion: 12,
      avgSentimentScore: 0.65,
      vsBaselineSentiment: 0.15,
      avgOverallScore: 82,
      vsBaselineScore: 14,
      objectionSuccessRate: 85,
      vsBaselineObjectionSuccess: 18,
      winRate: 72,
      vsBaselineWinRate: 10,
      conversationsAnalyzed: 156,
      repsUsing: 23,
      confidence: 88,
    },
    sourceConversations: [],
    topPerformers: [],
    adoptionRate: 68,
    effectiveness: 82,
    usageCount: 342,
    status: 'active',
    confidence: 88,
    createdBy: 'user_123',
    createdAt: new Date('2024-12-15'),
    version: 1,
  },
  {
    id: 'playbook_2',
    organizationId: 'org_123',
    workspaceId: 'workspace_1',
    name: 'Objection Handling Playbook',
    description: 'Battle-tested responses to common objections with high success rates',
    category: 'objection_handling',
    tags: ['objection_handling', 'pricing', 'competition'],
    conversationType: 'discovery_call',
    patterns: [],
    talkTracks: [],
    objectionResponses: [],
    bestPractices: [],
    successMetrics: {
      avgConversionRate: 85,
      vsBaselineConversion: 22,
      avgSentimentScore: 0.58,
      vsBaselineSentiment: 0.12,
      avgOverallScore: 79,
      vsBaselineScore: 16,
      objectionSuccessRate: 92,
      vsBaselineObjectionSuccess: 28,
      winRate: 68,
      vsBaselineWinRate: 15,
      conversationsAnalyzed: 98,
      repsUsing: 31,
      confidence: 91,
    },
    sourceConversations: [],
    topPerformers: [],
    adoptionRate: 78,
    effectiveness: 91,
    usageCount: 267,
    status: 'active',
    confidence: 91,
    createdBy: 'user_123',
    createdAt: new Date('2024-12-10'),
    version: 1,
  },
  {
    id: 'playbook_3',
    organizationId: 'org_123',
    workspaceId: 'workspace_1',
    name: 'Closing Techniques',
    description: 'Proven closing strategies from top performers',
    category: 'closing',
    tags: ['closing', 'close_call', 'negotiation'],
    conversationType: 'close_call',
    patterns: [],
    talkTracks: [],
    objectionResponses: [],
    bestPractices: [],
    successMetrics: {
      avgConversionRate: 72,
      vsBaselineConversion: 18,
      avgSentimentScore: 0.62,
      vsBaselineSentiment: 0.10,
      avgOverallScore: 76,
      vsBaselineScore: 12,
      objectionSuccessRate: 78,
      vsBaselineObjectionSuccess: 14,
      winRate: 82,
      vsBaselineWinRate: 24,
      conversationsAnalyzed: 64,
      repsUsing: 18,
      confidence: 82,
    },
    sourceConversations: [],
    topPerformers: [],
    adoptionRate: 45,
    effectiveness: 76,
    usageCount: 124,
    status: 'testing',
    confidence: 82,
    createdBy: 'user_123',
    createdAt: new Date('2024-12-20'),
    version: 1,
  },
];

const mockAdoptionMetrics: PlaybookAdoptionMetrics = {
  playbookId: 'playbook_1',
  organizationId: 'org_123',
  workspaceId: 'workspace_1',
  overallAdoptionRate: 68,
  repsUsing: 23,
  repsAvailable: 34,
  adoptionByTier: {
    top_performer: 92,
    high_performer: 78,
    solid_performer: 64,
    developing: 42,
    needs_improvement: 28,
  },
  totalUsageCount: 342,
  usageOverTime: [
    { date: new Date('2025-12-26'), usageCount: 12, uniqueReps: 8, avgEffectiveness: 78 },
    { date: new Date('2025-12-27'), usageCount: 18, uniqueReps: 11, avgEffectiveness: 82 },
    { date: new Date('2025-12-28'), usageCount: 15, uniqueReps: 9, avgEffectiveness: 79 },
    { date: new Date('2025-12-29'), usageCount: 22, uniqueReps: 14, avgEffectiveness: 85 },
    { date: new Date('2025-12-30'), usageCount: 19, uniqueReps: 12, avgEffectiveness: 81 },
    { date: new Date('2025-12-31'), usageCount: 24, uniqueReps: 15, avgEffectiveness: 86 },
    { date: new Date('2026-01-01'), usageCount: 28, uniqueReps: 17, avgEffectiveness: 88 },
  ],
  avgEffectiveness: 82,
  effectivenessDistribution: {
    excellent: 42,
    good: 35,
    fair: 18,
    poor: 5,
  },
  impactMetrics: {
    conversionRateBefore: 66,
    conversionRateAfter: 78,
    conversionRateLift: 12,
    sentimentBefore: 0.50,
    sentimentAfter: 0.65,
    sentimentLift: 0.15,
    avgScoreBefore: 68,
    avgScoreAfter: 82,
    scoreLift: 14,
    winRateBefore: 62,
    winRateAfter: 72,
    winRateLift: 10,
    confidence: 88,
    pValue: 0.0032,
  },
  adoptionBarriers: [
    {
      type: 'training',
      description: 'Some reps need additional training on pattern application',
      repsAffected: 8,
      severity: 'medium',
      mitigation: 'Schedule weekly coaching sessions focused on pattern usage',
    },
    {
      type: 'complexity',
      description: 'Playbook contains too many patterns for quick reference',
      repsAffected: 5,
      severity: 'low',
      mitigation: 'Create quick reference guide with top 5 patterns',
    },
    {
      type: 'awareness',
      description: 'New reps not aware of playbook existence',
      repsAffected: 3,
      severity: 'high',
      mitigation: 'Add to onboarding checklist and send weekly reminders',
    },
  ],
  adoptionRecommendations: [
    'Focus training on developing tier reps (42% adoption)',
    'Share success stories from top performers',
    'Create quick reference guide to reduce complexity',
  ],
  generatedAt: new Date(),
  periodStartDate: new Date('2025-12-01'),
  periodEndDate: new Date('2026-01-01'),
};

export default function PlaybookDashboardPage() {
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Load data on mount
  useEffect(() => {
    loadData();
  }, []);
  
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // TODO: Replace with actual API calls
      // const response = await fetch('/api/playbook/list');
      // const data = await response.json();
      
      // For now, using mock data
      if (mockPlaybooks.length > 0) {
        setSelectedPlaybook(mockPlaybooks[0]);
      }
      
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load playbooks');
      setLoading(false);
    }
  };
  
  const handleSelectPlaybook = (playbook: Playbook) => {
    setSelectedPlaybook(playbook);
    // TODO: Load playbook details and adoption metrics
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading playbooks...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">Error</div>
          <p className="text-gray-600">{error}</p>
          <button
            onClick={loadData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Playbook Builder</h1>
        <p className="text-gray-600">
          Extract winning patterns from top performers and create reusable playbooks
        </p>
      </div>
      
      {/* Action Buttons */}
      <div className="mb-6 flex gap-4">
        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
          + Generate New Playbook
        </button>
        <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
          Extract Patterns
        </button>
        <button className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium">
          View Analytics
        </button>
      </div>
      
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Playbooks List */}
          <PlaybooksCard
            playbooks={mockPlaybooks}
            onSelectPlaybook={handleSelectPlaybook}
          />
        </div>
        
        {/* Right Column */}
        <div className="space-y-6">
          {/* Adoption Metrics (for selected playbook) */}
          {selectedPlaybook && (
            <AdoptionMetricsCard
              metrics={mockAdoptionMetrics}
            />
          )}
        </div>
      </div>
      
      {/* Bottom Row - Patterns and Talk Tracks */}
      {selectedPlaybook && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Patterns */}
          <PatternsCard
            patterns={selectedPlaybook.patterns}
          />
          
          {/* Talk Tracks */}
          <TalkTracksCard
            talkTracks={selectedPlaybook.talkTracks}
          />
        </div>
      )}
      
      {/* Empty State */}
      {!selectedPlaybook && mockPlaybooks.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📚</div>
          <h2 className="text-2xl font-semibold text-gray-700 mb-2">No Playbooks Yet</h2>
          <p className="text-gray-600 mb-6">
            Get started by generating your first playbook from conversation intelligence data
          </p>
          <button className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
            Generate Your First Playbook
          </button>
        </div>
      )}
    </div>
  );
}
