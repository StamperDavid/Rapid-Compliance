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

  // Styles
  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const functionalColor = '#10b981';
  const shellColor = '#f59e0b';
  const ghostColor = '#6b7280';
  const indigoColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Swarm Control Center
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Monitor and execute AI agents across the platform
        </p>
      </div>

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Total Agents" value={AGENT_REGISTRY.length.toString()} />
        <StatCard label="Functional" value={functionalCount.toString()} color={functionalColor} />
        <StatCard label="Shell" value={shellCount.toString()} color={shellColor} />
        <StatCard label="Ghost" value={ghostCount.toString()} color={ghostColor} />
        <StatCard label="Total LOC" value={totalLOC.toLocaleString()} />
        <StatCard
          label="Coverage"
          value={`${Math.round((functionalCount / AGENT_REGISTRY.length) * 100)}%`}
          color={functionalColor}
        />
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: `1px solid ${borderColor}`, paddingBottom: '1rem' }}>
        {(['overview', 'execute', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: activeTab === tab ? indigoColor : 'transparent',
              border: `1px solid ${activeTab === tab ? indigoColor : borderColor}`,
              borderRadius: '0.5rem',
              color: '#fff',
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontWeight: activeTab === tab ? '600' : '400',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div>
          {/* Managers Section */}
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
            Managers (L2 Orchestrators)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
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
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>
            Specialists (L3 Workers)
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Agent Selection */}
          <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
              Select Agent to Execute
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {AGENT_REGISTRY.filter(a => a.executable).map(agent => (
                <button
                  key={agent.id}
                  onClick={() => setSelectedAgent(agent)}
                  style={{
                    padding: '0.75rem 1rem',
                    backgroundColor: selectedAgent?.id === agent.id ? indigoColor : '#0a0a0a',
                    border: `1px solid ${selectedAgent?.id === agent.id ? indigoColor : borderColor}`,
                    borderRadius: '0.5rem',
                    color: '#fff',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span>{agent.name}</span>
                  <span style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '0.25rem',
                    backgroundColor: `${functionalColor}20`,
                    color: functionalColor,
                  }}>
                    FUNCTIONAL
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Execution Form */}
          <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
              {selectedAgent ? `Execute: ${selectedAgent.name}` : 'Select an Agent'}
            </h3>

            {selectedAgent?.id === 'MARKETING_MANAGER' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Campaign Message
                  </label>
                  <textarea
                    value={executionInput.campaignMessage}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, campaignMessage: e.target.value }))}
                    placeholder="Launch viral TikTok campaign for B2C product targeting Gen Z"
                    style={{
                      width: '100%',
                      height: '100px',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      color: '#fff',
                      resize: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Campaign Objective
                  </label>
                  <select
                    value={executionInput.campaignObjective}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, campaignObjective: e.target.value as 'awareness' | 'engagement' | 'conversions' | 'leads' }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      color: '#fff',
                    }}
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Business Niche
                  </label>
                  <input
                    type="text"
                    value={executionInput.competitorNiche}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, competitorNiche: e.target.value }))}
                    placeholder="e.g., SaaS CRM, organic skincare, plumbing services"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      color: '#fff',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Target Location
                  </label>
                  <input
                    type="text"
                    value={executionInput.competitorLocation}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, competitorLocation: e.target.value }))}
                    placeholder="e.g., Austin TX, United Kingdom, Global"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      color: '#fff',
                    }}
                  />
                </div>
              </div>
            )}

            {selectedAgent?.id === 'TIKTOK_EXPERT' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Method
                  </label>
                  <select
                    value={executionInput.tiktokMethod}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, tiktokMethod: e.target.value as 'generate_viral_hook' | 'script_video_pacing' | 'analyze_trending_sounds' }))}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      color: '#fff',
                    }}
                  >
                    <option value="generate_viral_hook">Generate Viral Hooks</option>
                    <option value="script_video_pacing">Script Video Pacing</option>
                    <option value="analyze_trending_sounds">Analyze Trending Sounds</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Topic/Niche
                  </label>
                  <input
                    type="text"
                    value={executionInput.tiktokTopic}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, tiktokTopic: e.target.value }))}
                    placeholder="e.g., AI productivity tools, fitness hacks"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      color: '#fff',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>
                    Target Audience
                  </label>
                  <input
                    type="text"
                    value={executionInput.tiktokAudience}
                    onChange={(e) => setExecutionInput(prev => ({ ...prev, tiktokAudience: e.target.value }))}
                    placeholder="e.g., Gen Z entrepreneurs, fitness enthusiasts"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: '#0a0a0a',
                      border: `1px solid ${borderColor}`,
                      borderRadius: '0.5rem',
                      color: '#fff',
                    }}
                  />
                </div>
              </div>
            )}

            {selectedAgent && (
              <button
                onClick={() => { void executeAgent(selectedAgent); }}
                disabled={isExecuting}
                style={{
                  marginTop: '1.5rem',
                  width: '100%',
                  padding: '0.875rem',
                  backgroundColor: isExecuting ? '#333' : indigoColor,
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  fontWeight: '600',
                  cursor: isExecuting ? 'not-allowed' : 'pointer',
                }}
              >
                {isExecuting ? 'Executing...' : `Execute ${selectedAgent.name}`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: '600', marginBottom: '1rem' }}>
            Execution History
          </h3>

          {executionHistory.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
              No executions yet. Go to the Execute tab to run an agent.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {executionHistory.map((execution, index) => (
                <div
                  key={`${execution.taskId}-${index}`}
                  style={{
                    padding: '1rem',
                    backgroundColor: '#0a0a0a',
                    border: `1px solid ${borderColor}`,
                    borderRadius: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                    <div>
                      <span style={{ fontWeight: '600' }}>
                        {AGENT_REGISTRY.find(a => a.id === execution.agentId)?.name ?? execution.agentId}
                      </span>
                      <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: '#666' }}>
                        {execution.taskId}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      {execution.duration !== undefined && (
                        <span style={{ fontSize: '0.75rem', color: '#666' }}>
                          {execution.duration}ms
                        </span>
                      )}
                      <span style={{
                        fontSize: '0.75rem',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.25rem',
                        backgroundColor: execution.status === 'COMPLETED' ? `${functionalColor}20` : '#ef444420',
                        color: execution.status === 'COMPLETED' ? functionalColor : '#ef4444',
                      }}>
                        {execution.status}
                      </span>
                    </div>
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>
                    Started: {new Date(execution.startedAt).toLocaleString()}
                  </div>

                  {execution.errors && execution.errors.length > 0 && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.75rem',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid #ef4444',
                      borderRadius: '0.375rem',
                    }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#ef4444', marginBottom: '0.25rem' }}>
                        Errors:
                      </div>
                      {execution.errors.map((err, i) => (
                        <div key={i} style={{ fontSize: '0.75rem', color: '#ef4444' }}>{err}</div>
                      ))}
                    </div>
                  )}

                  {execution.data !== null && execution.data !== undefined && (
                    <details style={{ marginTop: '0.75rem' }}>
                      <summary style={{ fontSize: '0.75rem', color: '#999', cursor: 'pointer' }}>
                        View Result Data
                      </summary>
                      <pre style={{
                        marginTop: '0.5rem',
                        padding: '0.75rem',
                        backgroundColor: '#111',
                        borderRadius: '0.375rem',
                        fontSize: '0.75rem',
                        color: '#ccc',
                        overflow: 'auto',
                        maxHeight: '300px',
                      }}>
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

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: '1rem',
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '0.5rem',
    }}>
      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: color ?? '#fff' }}>{value}</div>
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
  const statusColors = {
    FUNCTIONAL: '#10b981',
    SHELL: '#f59e0b',
    GHOST: '#6b7280',
  };

  const statusColor = statusColors[agent.status];

  return (
    <div
      style={{
        padding: '1rem',
        backgroundColor: '#1a1a1a',
        border: `1px solid #333`,
        borderRadius: '0.75rem',
        cursor: agent.executable ? 'pointer' : 'default',
        transition: 'all 0.2s',
      }}
      onClick={agent.executable ? onSelect : undefined}
      onMouseEnter={(e) => {
        if (agent.executable) {
          e.currentTarget.style.borderColor = '#6366f1';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = '#333';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
        <div>
          <div style={{ fontWeight: '600', fontSize: '0.9375rem' }}>{agent.name}</div>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>{agent.id}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {circuitBreaker?.isOpen && (
            <span style={{
              fontSize: '0.625rem',
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              backgroundColor: '#ef4444' + '20',
              color: '#ef4444',
            }}>
              CIRCUIT OPEN
            </span>
          )}
          <span style={{
            fontSize: '0.75rem',
            padding: '0.25rem 0.5rem',
            borderRadius: '0.25rem',
            backgroundColor: `${statusColor}20`,
            color: statusColor,
          }}>
            {agent.status}
          </span>
        </div>
      </div>

      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>
        Reports to: {agent.reportsTo}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginBottom: '0.75rem' }}>
        {agent.capabilities.slice(0, 3).map(cap => (
          <span
            key={cap}
            style={{
              fontSize: '0.625rem',
              padding: '0.125rem 0.375rem',
              borderRadius: '0.25rem',
              backgroundColor: '#333',
              color: '#999',
            }}
          >
            {cap}
          </span>
        ))}
        {agent.capabilities.length > 3 && (
          <span style={{ fontSize: '0.625rem', color: '#666' }}>
            +{agent.capabilities.length - 3} more
          </span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '0.75rem', color: '#666' }}>
          {agent.loc.toLocaleString()} LOC
        </span>
        {agent.executable && (
          <span style={{ fontSize: '0.75rem', color: '#6366f1' }}>
            Click to Execute
          </span>
        )}
      </div>
    </div>
  );
}
