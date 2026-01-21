'use client';

import { useState, useCallback } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { auth } from '@/lib/firebase/config';

// ============================================================================
// AGENT REGISTRY - Real status from codebase audit
// ============================================================================

interface AgentInfo {
  id: string;
  name: string;
  category: 'manager' | 'specialist';
  status: 'FUNCTIONAL' | 'SHELL' | 'GHOST';
  reportsTo: string;
  capabilities: string[];
  loc: number;
  executable: boolean;
}

const AGENT_REGISTRY: AgentInfo[] = [
  // MANAGERS
  {
    id: 'MARKETING_MANAGER',
    name: 'Marketing Manager',
    category: 'manager',
    status: 'FUNCTIONAL',
    reportsTo: 'JASPER',
    capabilities: ['campaign_goal_parsing', 'platform_selection', 'multi_specialist_coordination', 'cross_platform_campaigns'],
    loc: 960,
    executable: true,
  },
  {
    id: 'INTELLIGENCE_MANAGER',
    name: 'Intelligence Manager',
    category: 'manager',
    status: 'SHELL',
    reportsTo: 'JASPER',
    capabilities: ['market_research_coordination', 'competitor_analysis'],
    loc: 150,
    executable: false,
  },
  {
    id: 'BUILDER_MANAGER',
    name: 'Builder Manager',
    category: 'manager',
    status: 'SHELL',
    reportsTo: 'JASPER',
    capabilities: ['asset_coordination', 'funnel_building'],
    loc: 150,
    executable: false,
  },
  {
    id: 'COMMERCE_MANAGER',
    name: 'Commerce Manager',
    category: 'manager',
    status: 'SHELL',
    reportsTo: 'JASPER',
    capabilities: ['pricing_coordination', 'inventory_management'],
    loc: 150,
    executable: false,
  },
  {
    id: 'OUTREACH_MANAGER',
    name: 'Outreach Manager',
    category: 'manager',
    status: 'SHELL',
    reportsTo: 'JASPER',
    capabilities: ['email_coordination', 'sms_coordination'],
    loc: 150,
    executable: false,
  },
  {
    id: 'CONTENT_MANAGER',
    name: 'Content Manager',
    category: 'manager',
    status: 'SHELL',
    reportsTo: 'JASPER',
    capabilities: ['content_calendar', 'copywriting_coordination'],
    loc: 150,
    executable: false,
  },
  // SPECIALISTS - INTELLIGENCE
  {
    id: 'COMPETITOR_ANALYST',
    name: 'Competitor Researcher',
    category: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'INTELLIGENCE_MANAGER',
    capabilities: ['competitor_discovery', 'seo_analysis', 'market_positioning', 'feature_comparison', 'gap_analysis'],
    loc: 947,
    executable: true,
  },
  {
    id: 'SENTIMENT_ANALYST',
    name: 'Sentiment Analyst',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'INTELLIGENCE_MANAGER',
    capabilities: ['sentiment_analysis'],
    loc: 50,
    executable: false,
  },
  {
    id: 'TECHNOGRAPHIC_SCOUT',
    name: 'Technographic Scout',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'INTELLIGENCE_MANAGER',
    capabilities: ['technographic_analysis'],
    loc: 50,
    executable: false,
  },
  // SPECIALISTS - MARKETING
  {
    id: 'TIKTOK_EXPERT',
    name: 'TikTok Expert',
    category: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['viral_hook_generation', 'video_pacing_scripts', 'trending_sound_analysis', 'retention_optimization'],
    loc: 1064,
    executable: true,
  },
  {
    id: 'X_EXPERT',
    name: 'X/Twitter Expert',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['tweet_strategy', 'thread_writing'],
    loc: 50,
    executable: false,
  },
  {
    id: 'FACEBOOK_EXPERT',
    name: 'Facebook Ads Expert',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['ad_campaign_strategy', 'audience_targeting'],
    loc: 50,
    executable: false,
  },
  {
    id: 'LINKEDIN_EXPERT',
    name: 'LinkedIn Expert',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['linkedin_content', 'professional_networking'],
    loc: 50,
    executable: false,
  },
  {
    id: 'SEO_EXPERT',
    name: 'SEO Expert',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['keyword_research', 'content_optimization'],
    loc: 50,
    executable: false,
  },
  // SPECIALISTS - BUILDER
  {
    id: 'UX_UI_ARCHITECT',
    name: 'UX/UI Architect',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'BUILDER_MANAGER',
    capabilities: ['design_system', 'user_flows'],
    loc: 50,
    executable: false,
  },
  {
    id: 'FUNNEL_ENGINEER',
    name: 'Funnel Engineer',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'BUILDER_MANAGER',
    capabilities: ['funnel_design', 'conversion_optimization'],
    loc: 50,
    executable: false,
  },
  {
    id: 'ASSET_GENERATOR',
    name: 'Asset Generator',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'BUILDER_MANAGER',
    capabilities: ['image_generation', 'video_assets'],
    loc: 50,
    executable: false,
  },
  // SPECIALISTS - COMMERCE
  {
    id: 'PRICING_STRATEGIST',
    name: 'Pricing Strategist',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'COMMERCE_MANAGER',
    capabilities: ['pricing_analysis', 'competitive_pricing'],
    loc: 50,
    executable: false,
  },
  {
    id: 'INVENTORY_MANAGER',
    name: 'Inventory Manager',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'COMMERCE_MANAGER',
    capabilities: ['stock_management', 'demand_forecasting'],
    loc: 50,
    executable: false,
  },
  // SPECIALISTS - OUTREACH
  {
    id: 'EMAIL_SPECIALIST',
    name: 'Email Specialist',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'OUTREACH_MANAGER',
    capabilities: ['email_campaigns', 'drip_sequences'],
    loc: 50,
    executable: false,
  },
  {
    id: 'SMS_SPECIALIST',
    name: 'SMS Specialist',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'OUTREACH_MANAGER',
    capabilities: ['sms_campaigns', 'text_sequences'],
    loc: 50,
    executable: false,
  },
  // SPECIALISTS - CONTENT
  {
    id: 'COPYWRITER',
    name: 'Copywriter',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'CONTENT_MANAGER',
    capabilities: ['copy_writing', 'headline_generation'],
    loc: 50,
    executable: false,
  },
  {
    id: 'CALENDAR_COORDINATOR',
    name: 'Calendar Coordinator',
    category: 'specialist',
    status: 'GHOST',
    reportsTo: 'CONTENT_MANAGER',
    capabilities: ['content_scheduling', 'calendar_management'],
    loc: 50,
    executable: false,
  },
];

// ============================================================================
// TYPES
// ============================================================================

interface ExecutionResult {
  agentId: string;
  taskId: string;
  status: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
  startedAt: string;
  completedAt?: string;
  data: unknown;
  errors?: string[];
  duration?: number;
}

interface CircuitBreakerStatus {
  agentId: string;
  isOpen: boolean;
  failures: number;
  lastFailure?: string;
  cooldownUntil?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function SwarmControlPage() {
  useAdminAuth();
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionResult[]>([]);
  const [circuitBreakers, setCircuitBreakers] = useState<Map<string, CircuitBreakerStatus>>(new Map());
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'execute' | 'history'>('overview');

  // Form state for execution
  const [executionInput, setExecutionInput] = useState({
    // Marketing Manager
    campaignMessage: '',
    campaignObjective: 'awareness' as 'awareness' | 'engagement' | 'conversions' | 'leads',
    // Competitor Researcher
    competitorNiche: '',
    competitorLocation: '',
    // TikTok Expert
    tiktokTopic: '',
    tiktokAudience: '',
    tiktokMethod: 'generate_viral_hook' as 'generate_viral_hook' | 'script_video_pacing' | 'analyze_trending_sounds',
  });

  // Calculate swarm stats
  const functionalCount = AGENT_REGISTRY.filter(a => a.status === 'FUNCTIONAL').length;
  const shellCount = AGENT_REGISTRY.filter(a => a.status === 'SHELL').length;
  const ghostCount = AGENT_REGISTRY.filter(a => a.status === 'GHOST').length;
  const totalLOC = AGENT_REGISTRY.reduce((sum, a) => sum + a.loc, 0);

  // Execute agent
  const executeAgent = useCallback(async (agent: AgentInfo) => {
    if (!agent.executable) {
      return;
    }

    // Check circuit breaker
    const breaker = circuitBreakers.get(agent.id);
    if (breaker?.isOpen && breaker.cooldownUntil && new Date(breaker.cooldownUntil) > new Date()) {
      setExecutionHistory(prev => [{
        agentId: agent.id,
        taskId: `task_${Date.now()}`,
        status: 'FAILED',
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        data: null,
        errors: [`Circuit breaker OPEN. Agent ${agent.id} is in cooldown until ${breaker.cooldownUntil}`],
      }, ...prev]);
      return;
    }

    setIsExecuting(true);
    const taskId = `task_${Date.now()}`;
    const startTime = Date.now();

    try {
      const token = await auth?.currentUser?.getIdToken();

      // Build payload based on agent type
      let payload: Record<string, unknown> = {};

      if (agent.id === 'MARKETING_MANAGER') {
        payload = {
          message: executionInput.campaignMessage,
          objective: executionInput.campaignObjective,
        };
      } else if (agent.id === 'COMPETITOR_ANALYST') {
        payload = {
          niche: executionInput.competitorNiche,
          location: executionInput.competitorLocation,
          limit: 10,
          includeAnalysis: true,
        };
      } else if (agent.id === 'TIKTOK_EXPERT') {
        payload = {
          method: executionInput.tiktokMethod,
          topic: executionInput.tiktokTopic,
          targetAudience: executionInput.tiktokAudience,
          contentGoal: 'engagement',
          niche: executionInput.tiktokTopic,
          brandVoice: 'casual',
          count: 5,
        };
      }

      const response = await fetch('/api/admin/swarm/execute', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agentId: agent.id,
          taskId,
          payload,
        }),
      });

      const data = await response.json() as { data?: unknown; errors?: string[] };
      const duration = Date.now() - startTime;

      if (response.ok) {
        // Reset circuit breaker on success
        setCircuitBreakers(prev => {
          const newMap = new Map(prev);
          newMap.set(agent.id, { agentId: agent.id, isOpen: false, failures: 0 });
          return newMap;
        });

        setExecutionHistory(prev => [{
          agentId: agent.id,
          taskId,
          status: 'COMPLETED',
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          data: data.data,
          duration,
        }, ...prev]);
      } else {
        // Update circuit breaker on failure
        setCircuitBreakers(prev => {
          const newMap = new Map(prev);
          const current = prev.get(agent.id) ?? { agentId: agent.id, isOpen: false, failures: 0 };
          const newFailures = current.failures + 1;
          const shouldOpen = newFailures >= 3;

          newMap.set(agent.id, {
            agentId: agent.id,
            isOpen: shouldOpen,
            failures: newFailures,
            lastFailure: new Date().toISOString(),
            cooldownUntil: shouldOpen ? new Date(Date.now() + 60000).toISOString() : undefined, // 1 min cooldown
          });
          return newMap;
        });

        setExecutionHistory(prev => [{
          agentId: agent.id,
          taskId,
          status: 'FAILED',
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
          data: null,
          errors: data.errors ?? ['Execution failed'],
          duration,
        }, ...prev]);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update circuit breaker on error
      setCircuitBreakers(prev => {
        const newMap = new Map(prev);
        const current = prev.get(agent.id) ?? { agentId: agent.id, isOpen: false, failures: 0 };
        const newFailures = current.failures + 1;
        const shouldOpen = newFailures >= 3;

        newMap.set(agent.id, {
          agentId: agent.id,
          isOpen: shouldOpen,
          failures: newFailures,
          lastFailure: new Date().toISOString(),
          cooldownUntil: shouldOpen ? new Date(Date.now() + 60000).toISOString() : undefined,
        });
        return newMap;
      });

      setExecutionHistory(prev => [{
        agentId: agent.id,
        taskId,
        status: 'FAILED',
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        data: null,
        errors: [errorMessage],
        duration: Date.now() - startTime,
      }, ...prev]);
    } finally {
      setIsExecuting(false);
    }
  }, [executionInput, circuitBreakers]);

  return (
    <div className="p-8 text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">
          Swarm Control Center
        </h1>
        <p className="text-[var(--color-text-secondary)] text-sm">
          Monitor and execute AI agents across the platform
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4 mb-8">
        <StatCard label="Total Agents" value={AGENT_REGISTRY.length.toString()} />
        <StatCard label="Functional" value={functionalCount.toString()} statusType="FUNCTIONAL" />
        <StatCard label="Shell" value={shellCount.toString()} statusType="SHELL" />
        <StatCard label="Ghost" value={ghostCount.toString()} statusType="GHOST" />
        <StatCard label="Total LOC" value={totalLOC.toLocaleString()} />
        <StatCard
          label="Coverage"
          value={`${Math.round((functionalCount / AGENT_REGISTRY.length) * 100)}%`}
          statusType="FUNCTIONAL"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 border-b border-[var(--color-border)] pb-4">
        {(['overview', 'execute', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`
              px-5 py-2.5 rounded-lg capitalize font-semibold transition-all
              ${activeTab === tab
                ? 'bg-[var(--color-primary)] border border-[var(--color-primary)] text-[var(--color-text-primary)]'
                : 'bg-transparent border border-[var(--color-border)] text-[var(--color-text-primary)] font-normal'
              }
            `}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Managers Section */}
          <h2 className="text-xl font-semibold mb-4">
            Managers (L2 Orchestrators)
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4 mb-8">
            {AGENT_REGISTRY.filter(a => a.category === 'manager').map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                circuitBreaker={circuitBreakers.get(agent.id)}
                onSelect={() => {
                  setSelectedAgent(agent);
                  setActiveTab('execute');
                }}
              />
            ))}
          </div>

          {/* Specialists Section */}
          <h2 className="text-xl font-semibold mb-4">
            Specialists (L3 Workers)
          </h2>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
            {AGENT_REGISTRY.filter(a => a.category === 'specialist').map(agent => (
              <AgentCard
                key={agent.id}
                agent={agent}
                circuitBreaker={circuitBreakers.get(agent.id)}
                onSelect={() => {
                  setSelectedAgent(agent);
                  setActiveTab('execute');
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Execute Tab */}
      {activeTab === 'execute' && (
        <div className="grid grid-cols-2 gap-6">
          {/* Agent Selection */}
          <div className="bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">
              Select Agent to Execute
            </h3>
            <div className="flex flex-col gap-2">
              {AGENT_REGISTRY.filter(a => a.executable).map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  className={`
                    px-4 py-3 rounded-lg text-[var(--color-text-primary)] cursor-pointer text-left flex justify-between items-center
                    ${selectedAgent?.id === agent.id
                      ? 'bg-[var(--color-primary)] border border-[var(--color-primary)]'
                      : 'bg-[var(--color-bg-primary)] border border-[var(--color-border)]'
                    }
                  `}
                >
                  <span>{agent.name}</span>
                  <span className="text-xs px-2 py-1 rounded bg-[var(--color-success)]/20 text-[var(--color-success)]">
                    FUNCTIONAL
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Execution Form */}
          <div className="bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl p-6">
            <h3 className="text-lg font-semibold mb-4">
              {selectedAgent ? `Execute: ${selectedAgent.name}` : 'Select an Agent'}
            </h3>

            {selectedAgent?.id === 'MARKETING_MANAGER' && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm text-[var(--color-text-muted)] mb-2">
                    Campaign Message
                  </label>
                  <textarea
                    value={executionInput.campaignMessage}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, campaignMessage: e.target.value }))}
                    placeholder="Launch viral TikTok campaign for B2C product targeting Gen Z"
                    className="w-full h-[100px] p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-muted)] mb-2">
                    Campaign Objective
                  </label>
                  <select
                    value={executionInput.campaignObjective}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, campaignObjective: e.target.value as 'awareness' | 'engagement' | 'conversions' | 'leads' }))}
                    className="w-full p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]"
                  >
                    <option value="awareness">Awareness</option>
                    <option value="engagement">Engagement</option>
                    <option value="conversions">Conversions</option>
                    <option value="leads">Lead Generation</option>
                  </select>
                </div>
              </div>
            )}

            {selectedAgent?.id === 'COMPETITOR_ANALYST' && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm text-[var(--color-text-muted)] mb-2">
                    Business Niche
                  </label>
                  <input
                    type="text"
                    value={executionInput.competitorNiche}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, competitorNiche: e.target.value }))}
                    placeholder="e.g., SaaS CRM, organic skincare, plumbing services"
                    className="w-full p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-muted)] mb-2">
                    Target Location
                  </label>
                  <input
                    type="text"
                    value={executionInput.competitorLocation}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, competitorLocation: e.target.value }))}
                    placeholder="e.g., Austin TX, United Kingdom, Global"
                    className="w-full p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]"
                  />
                </div>
              </div>
            )}

            {selectedAgent?.id === 'TIKTOK_EXPERT' && (
              <div className="flex flex-col gap-4">
                <div>
                  <label className="block text-sm text-[var(--color-text-muted)] mb-2">
                    Method
                  </label>
                  <select
                    value={executionInput.tiktokMethod}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, tiktokMethod: e.target.value as 'generate_viral_hook' | 'script_video_pacing' | 'analyze_trending_sounds' }))}
                    className="w-full p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]"
                  >
                    <option value="generate_viral_hook">Generate Viral Hooks</option>
                    <option value="script_video_pacing">Script Video Pacing</option>
                    <option value="analyze_trending_sounds">Analyze Trending Sounds</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-muted)] mb-2">
                    Topic/Niche
                  </label>
                  <input
                    type="text"
                    value={executionInput.tiktokTopic}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, tiktokTopic: e.target.value }))}
                    placeholder="e.g., AI productivity tools, fitness hacks"
                    className="w-full p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-muted)] mb-2">
                    Target Audience
                  </label>
                  <input
                    type="text"
                    value={executionInput.tiktokAudience}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, tiktokAudience: e.target.value }))}
                    placeholder="e.g., Gen Z entrepreneurs, fitness enthusiasts"
                    className="w-full p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)]"
                  />
                </div>
              </div>
            )}

            {selectedAgent && (
              <button
                onClick={() => { void executeAgent(selectedAgent); }}
                disabled={isExecuting}
                className={`
                  mt-6 w-full py-3.5 rounded-lg text-[var(--color-text-primary)] font-semibold
                  ${isExecuting
                    ? 'bg-[var(--color-border)] cursor-not-allowed'
                    : 'bg-[var(--color-primary)] cursor-pointer'
                  }
                `}
              >
                {isExecuting ? 'Executing...' : `Execute ${selectedAgent.name}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl p-6">
          <h3 className="text-lg font-semibold mb-4">
            Execution History
          </h3>

          {executionHistory.length === 0 ? (
            <p className="text-[var(--color-text-secondary)] text-center py-8">
              No executions yet. Go to the Execute tab to run an agent.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {executionHistory.map((execution, index) => (
                <div
                  key={`${execution.taskId}-${index}`}
                  className="p-4 bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-semibold">
                        {AGENT_REGISTRY.find(a => a.id === execution.agentId)?.name ?? execution.agentId}
                      </span>
                      <span className="ml-3 text-xs text-[var(--color-text-secondary)]">
                        {execution.taskId}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {execution.duration !== undefined && (
                        <span className="text-xs text-[var(--color-text-secondary)]">
                          {execution.duration}ms
                        </span>
                      )}
                      <span className={`
                        text-xs px-2 py-1 rounded
                        ${execution.status === 'COMPLETED'
                          ? 'bg-[var(--color-success)]/20 text-[var(--color-success)]'
                          : 'bg-[var(--color-error)]/20 text-[var(--color-error)]'
                        }
                      `}>
                        {execution.status}
                      </span>
                    </div>
                  </div>

                  <div className="text-xs text-[var(--color-text-secondary)] mb-2">
                    Started: {new Date(execution.startedAt).toLocaleString()}
                  </div>

                  {execution.errors && execution.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-[var(--color-error)]/10 border border-[var(--color-error)] rounded-md">
                      <div className="text-xs font-semibold text-[var(--color-error)] mb-1">
                        Errors:
                      </div>
                      {execution.errors.map((err, i) => (
                        <div key={i} className="text-xs text-[var(--color-error)]">{err}</div>
                      ))}
                    </div>
                  )}

                  {execution.data !== null && execution.data !== undefined && (
                    <details className="mt-3">
                      <summary className="text-xs text-[var(--color-text-muted)] cursor-pointer">
                        View Result Data
                      </summary>
                      <pre className="mt-2 p-3 bg-[var(--color-bg-elevated)] rounded-md text-xs text-[var(--color-text-secondary)] overflow-auto max-h-[300px]">
                        {JSON.stringify(execution.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatCard({
  label,
  value,
  statusType
}: {
  label: string;
  value: string;
  statusType?: 'FUNCTIONAL' | 'SHELL' | 'GHOST';
}) {
  const getColorClass = () => {
    if (!statusType) return 'text-[var(--color-text-primary)]';

    switch (statusType) {
      case 'FUNCTIONAL':
        return 'text-[var(--color-success)]';
      case 'SHELL':
        return 'text-[var(--color-warning)]';
      case 'GHOST':
        return 'text-[var(--color-text-disabled)]';
      default:
        return 'text-[var(--color-text-primary)]';
    }
  };

  return (
    <div className="p-4 bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-lg">
      <div className="text-xs text-[var(--color-text-secondary)] mb-1">{label}</div>
      <div className={`text-2xl font-bold ${getColorClass()}`}>{value}</div>
    </div>
  );
}

function AgentCard({
  agent,
  circuitBreaker,
  onSelect
}: {
  agent: AgentInfo;
  circuitBreaker?: CircuitBreakerStatus;
  onSelect: () => void;
}) {
  const getStatusColorClass = (status: 'FUNCTIONAL' | 'SHELL' | 'GHOST') => {
    switch (status) {
      case 'FUNCTIONAL':
        return 'bg-[var(--color-success)]/20 text-[var(--color-success)]';
      case 'SHELL':
        return 'bg-[var(--color-warning)]/20 text-[var(--color-warning)]';
      case 'GHOST':
        return 'bg-[var(--color-text-disabled)]/20 text-[var(--color-text-disabled)]';
      default:
        return 'bg-[var(--color-text-secondary)]/20 text-[var(--color-text-secondary)]';
    }
  };

  return (
    <div
      className={`
        p-4 bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl
        transition-all duration-200
        ${agent.executable ? 'cursor-pointer hover:border-[var(--color-primary)]' : 'cursor-default'}
      `}
      onClick={agent.executable ? onSelect : undefined}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <div className="font-semibold text-[15px]">{agent.name}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">{agent.id}</div>
        </div>
        <div className="flex items-center gap-2">
          {circuitBreaker?.isOpen && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-error)]/20 text-[var(--color-error)]">
              CIRCUIT OPEN
            </span>
          )}
          <span className={`text-xs px-2 py-1 rounded ${getStatusColorClass(agent.status)}`}>
            {agent.status}
          </span>
        </div>
      </div>

      <div className="text-xs text-[var(--color-text-secondary)] mb-2">
        Reports to: {agent.reportsTo}
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {agent.capabilities.slice(0, 3).map(cap => (
          <span
            key={cap}
            className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-muted)]"
          >
            {cap}
          </span>
        ))}
        {agent.capabilities.length > 3 && (
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            +{agent.capabilities.length - 3} more
          </span>
        )}
      </div>

      <div className="flex justify-between items-center">
        <span className="text-xs text-[var(--color-text-secondary)]">
          {agent.loc.toLocaleString()} LOC
        </span>
        {agent.executable && (
          <span className="text-xs text-[var(--color-primary)]">
            Click to Execute
          </span>
        )}
      </div>
    </div>
  );
}
