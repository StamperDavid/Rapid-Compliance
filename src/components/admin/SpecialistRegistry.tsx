/**
 * AI Specialist Registry Component
 *
 * Comprehensive registry displaying all 35 AI specialists across 9 categories.
 * Supports filtering, search, and detailed specialist views.
 *
 * Performance optimized with React.memo, useMemo, and useCallback.
 *
 * Updated: Sprint 3 - Added Video Specialist, Trend Scout, Workflow Optimizer, X Expert (revived)
 */

import React, { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { AISpecialist, SpecialistCategory, SpecialistStatus } from '@/types/command-center';

// ============================================================================
// PROPS INTERFACE
// ============================================================================

export interface SpecialistRegistryProps {
  organizationId: string;
  onSelectSpecialist?: (specialistId: string) => void;
}

// ============================================================================
// SPECIALIST DATA REGISTRY
// ============================================================================

const SPECIALIST_REGISTRY: AISpecialist[] = [
  // Intelligence Category (4 specialists)
  {
    id: 'COMPETITOR_RESEARCHER',
    name: 'Competitor Researcher',
    category: 'intelligence',
    status: 'FUNCTIONAL',
    description: 'Discovers and analyzes top competitors by SEO ranking in any niche and location',
    capabilities: [
      'Competitor discovery by niche/location',
      'SEO ranking analysis',
      'Market positioning analysis',
      'Competitive landscape mapping',
      'Feature comparison extraction',
    ],
    managerId: 'INTELLIGENCE_MANAGER',
  },
  {
    id: 'SENTIMENT_ANALYST',
    name: 'Sentiment Analyst',
    category: 'intelligence',
    status: 'FUNCTIONAL',
    description: 'Analyzes customer sentiment from reviews, social media, and feedback',
    capabilities: [
      'Multi-source sentiment analysis',
      'Emotion detection and classification',
      'Trend identification in customer feedback',
      'Brand perception tracking',
      'Competitive sentiment comparison',
    ],
    managerId: 'INTELLIGENCE_MANAGER',
  },
  {
    id: 'TECHNOGRAPHIC_SCOUT',
    name: 'Technographic Scout',
    category: 'intelligence',
    status: 'FUNCTIONAL',
    description: 'Identifies technology stacks and tools used by target companies',
    capabilities: [
      'Technology stack detection',
      'Tool and platform identification',
      'Integration opportunity mapping',
      'Tech adoption patterns',
      'Compatibility analysis',
    ],
    managerId: 'INTELLIGENCE_MANAGER',
  },
  {
    id: 'WEB_SCRAPER',
    name: 'Web Scraper',
    category: 'intelligence',
    status: 'FUNCTIONAL',
    description: 'Extracts structured data from websites and online sources',
    capabilities: [
      'HTML content extraction',
      'Data point identification',
      'Metadata parsing',
      'Contact information discovery',
      'Social media link extraction',
    ],
    managerId: 'INTELLIGENCE_MANAGER',
  },
  {
    id: 'TREND_SCOUT',
    name: 'Trend Scout',
    category: 'intelligence',
    status: 'FUNCTIONAL',
    description: 'Market signal detection specialist that monitors trends and triggers agent pivots',
    capabilities: [
      'Market signal detection and classification',
      'Competitor movement tracking',
      'Industry shift analysis',
      'Agent pivot triggering (Chain of Action)',
      'Trend forecasting with confidence scoring',
      'Signal aggregation from multiple sources',
      'Urgency-based alert prioritization',
    ],
    managerId: 'INTELLIGENCE_MANAGER',
  },

  // Marketing Category (5 specialists)
  {
    id: 'TIKTOK_EXPERT',
    name: 'TikTok Expert',
    category: 'marketing',
    status: 'FUNCTIONAL',
    description: 'Creates viral TikTok content strategies with hooks, pacing, and trending sounds',
    capabilities: [
      'Viral hook generation (5 psychological patterns)',
      'Video pacing and script beats',
      'Trending sound/music analysis',
      'Retention optimization strategies',
      'TikTok algorithm alignment',
    ],
    managerId: 'MARKETING_MANAGER',
  },
  {
    id: 'X_EXPERT',
    name: 'X (Twitter) Expert',
    category: 'marketing',
    status: 'FUNCTIONAL',
    description: 'Thread generation and scheduling engine with viral pattern analysis',
    capabilities: [
      'Thread generation with 6 hook formulas',
      'Scheduling optimizer with engagement prediction',
      'Viral content analysis and replication',
      'Hashtag strategy and trend riding',
      'Engagement benchmarking and optimization',
      'Audience growth tactics',
      'Content calendar management',
    ],
    managerId: 'MARKETING_MANAGER',
  },
  {
    id: 'FACEBOOK_ADS_EXPERT',
    name: 'Facebook Ads Expert',
    category: 'marketing',
    status: 'FUNCTIONAL',
    description: 'Designs and optimizes Facebook advertising campaigns',
    capabilities: [
      'Ad creative development',
      'Audience targeting',
      'Campaign optimization',
      'A/B testing',
      'ROI analysis',
    ],
    managerId: 'MARKETING_MANAGER',
  },
  {
    id: 'LINKEDIN_EXPERT',
    name: 'LinkedIn Expert',
    category: 'marketing',
    status: 'FUNCTIONAL',
    description: '3-tier personalization engine with automation bridge for LinkedIn outreach',
    capabilities: [
      '3-tier personalization (Connection, Follow-up, High-Value)',
      'Automation bridge for webhooks/Zapier/Make/n8n',
      'Tenant playbook voice matching',
      'Connection request script generation',
      'Follow-up sequence builder (5+ touches)',
      'High-value offer personalization engine',
      'LinkedIn algorithm optimization',
    ],
    managerId: 'MARKETING_MANAGER',
  },
  {
    id: 'SEO_EXPERT',
    name: 'SEO Expert',
    category: 'marketing',
    status: 'FUNCTIONAL',
    description: 'Crawl analysis engine with keyword gap analysis and 30-day strategy generator',
    capabilities: [
      'Simulated crawl analysis (SSL, Speed, Meta, Indexing)',
      'Technical health report generation',
      'Keyword gap analysis vs market trends',
      '30-day SEO strategy builder',
      'Mobile readiness assessment',
      'Content gap identification',
      'Priority fix list generation',
    ],
    managerId: 'MARKETING_MANAGER',
  },

  // Builder Category (3 specialists)
  {
    id: 'UX_UI_ARCHITECT',
    name: 'UX/UI Architect',
    category: 'builder',
    status: 'FUNCTIONAL',
    description: 'Designs user experiences and interfaces for optimal conversion',
    capabilities: [
      'User experience design',
      'Interface architecture',
      'Wireframe creation',
      'Conversion optimization',
      'Accessibility compliance',
    ],
    managerId: 'BUILDER_MANAGER',
  },
  {
    id: 'FUNNEL_ENGINEER',
    name: 'Funnel Engineer',
    category: 'builder',
    status: 'FUNCTIONAL',
    description: 'Builds and optimizes sales funnels for maximum conversion',
    capabilities: [
      'Funnel architecture design',
      'Conversion path optimization',
      'Landing page engineering',
      'A/B testing implementation',
      'Analytics integration',
    ],
    managerId: 'BUILDER_MANAGER',
  },
  {
    id: 'ASSET_GENERATOR',
    name: 'Asset Generator',
    category: 'builder',
    status: 'FUNCTIONAL',
    description: 'Creates digital assets including images, graphics, and media',
    capabilities: [
      'Image generation and editing',
      'Graphic design automation',
      'Brand asset creation',
      'Template generation',
      'Media optimization',
    ],
    managerId: 'BUILDER_MANAGER',
  },
  {
    id: 'WORKFLOW_OPTIMIZER',
    name: 'Workflow Optimizer',
    category: 'builder',
    status: 'FUNCTIONAL',
    description: 'Multi-agent chain optimization specialist implementing the Chain of Action pattern',
    capabilities: [
      'Workflow composition from high-level goals',
      'Chain optimization (speed, reliability, cost)',
      'Dependency analysis and parallel execution',
      'Bottleneck detection and remediation',
      'Critical path calculation',
      'Failure recovery and retry orchestration',
      'Performance analytics and benchmarking',
    ],
    managerId: 'BUILDER_MANAGER',
  },

  // Commerce Category (2 specialists)
  {
    id: 'PRICING_STRATEGIST',
    name: 'Pricing Strategist',
    category: 'commerce',
    status: 'FUNCTIONAL',
    description: 'Optimizes pricing strategies based on market analysis and psychology',
    capabilities: [
      'Price optimization',
      'Competitive pricing analysis',
      'Psychological pricing tactics',
      'Discount strategy',
      'Value perception optimization',
    ],
    managerId: 'COMMERCE_MANAGER',
  },
  {
    id: 'INVENTORY_MANAGER',
    name: 'Inventory Manager',
    category: 'commerce',
    status: 'FUNCTIONAL',
    description: 'Manages product inventory and stock optimization',
    capabilities: [
      'Stock level monitoring',
      'Reorder point calculation',
      'Demand forecasting',
      'Inventory optimization',
      'Dead stock identification',
    ],
    managerId: 'COMMERCE_MANAGER',
  },

  // Outreach Category (2 specialists)
  {
    id: 'EMAIL_SPECIALIST',
    name: 'Email Specialist',
    category: 'outreach',
    status: 'FUNCTIONAL',
    description: '5-stage drip campaign architect with spam pre-check and dynamic personalization',
    capabilities: [
      '5-stage drip campaign builder (Opening, Discovery, Value, Social Proof, Ask)',
      'Spam-filter pre-check with trigger word detection',
      'Dynamic tag insertion ({{first_name}}, {{company}}, {{pain_point}})',
      'Subject line A/B test generator',
      'SendGrid/Resend integration',
      'Email open and click tracking',
      'Deliverability prediction scoring',
    ],
    managerId: 'OUTREACH_MANAGER',
  },
  {
    id: 'SMS_SPECIALIST',
    name: 'SMS Specialist',
    category: 'outreach',
    status: 'FUNCTIONAL',
    description: 'Designs SMS campaigns with high engagement and conversion rates',
    capabilities: [
      'SMS copywriting',
      'Character optimization',
      'Timing strategies',
      'Compliance management',
      'Response rate optimization',
    ],
    managerId: 'OUTREACH_MANAGER',
  },

  // Content Category (2 specialists)
  {
    id: 'COPYWRITER',
    name: 'Copywriter',
    category: 'content',
    status: 'FUNCTIONAL',
    description: 'Creates compelling copy for various marketing channels',
    capabilities: [
      'Persuasive copywriting',
      'Brand voice consistency',
      'Multi-channel content',
      'Headline optimization',
      'Call-to-action creation',
    ],
    managerId: 'CONTENT_MANAGER',
  },
  {
    id: 'CALENDAR_COORDINATOR',
    name: 'Calendar Coordinator',
    category: 'content',
    status: 'FUNCTIONAL',
    description: 'Manages content calendars and publishing schedules',
    capabilities: [
      'Content scheduling',
      'Multi-channel coordination',
      'Publishing workflow',
      'Campaign timing optimization',
      'Content gap analysis',
    ],
    managerId: 'CONTENT_MANAGER',
  },
  {
    id: 'VIDEO_SPECIALIST',
    name: 'Video Specialist',
    category: 'content',
    status: 'FUNCTIONAL',
    description: 'Script-to-storyboard transformation with audio cue markers and platform optimization',
    capabilities: [
      'Script-to-storyboard generation',
      'Audio cue markers for narration pacing',
      'Scene breakdown with visual direction',
      'Thumbnail strategy generator',
      'Video SEO metadata optimization',
      'B-roll suggestion engine',
      'Platform-specific formatting (YouTube, TikTok, Reels)',
    ],
    managerId: 'CONTENT_MANAGER',
  },

  // Sales Category (5 specialists)
  {
    id: 'LEAD_QUALIFIER',
    name: 'Lead Qualifier',
    category: 'sales',
    status: 'FUNCTIONAL',
    description: 'Qualifies and scores leads based on fit and intent signals',
    capabilities: [
      'Lead scoring',
      'Qualification criteria application',
      'Intent signal analysis',
      'Fit assessment',
      'Priority ranking',
    ],
    managerId: 'SALES_MANAGER',
  },
  {
    id: 'OUTREACH_SPECIALIST',
    name: 'Outreach Specialist',
    category: 'sales',
    status: 'FUNCTIONAL',
    description: 'Executes personalized sales outreach campaigns',
    capabilities: [
      'Outreach personalization',
      'Multi-touch sequences',
      'Follow-up automation',
      'Response handling',
      'Engagement tracking',
    ],
    managerId: 'SALES_MANAGER',
  },
  {
    id: 'MERCHANDISER',
    name: 'Merchandiser',
    category: 'sales',
    status: 'FUNCTIONAL',
    description: 'Optimizes product presentation and cross-sell opportunities',
    capabilities: [
      'Product positioning',
      'Cross-sell recommendations',
      'Bundle creation',
      'Visual merchandising',
      'Conversion optimization',
    ],
    managerId: 'SALES_MANAGER',
  },
  {
    id: 'DEAL_CLOSER',
    name: 'Deal Closer',
    category: 'sales',
    status: 'FUNCTIONAL',
    description: 'Analyzes lead history and generates personalized closing strategies using decision-tree engine',
    capabilities: [
      'Lead readiness assessment',
      'Closing strategy selection (urgency, value stack, trial close)',
      'Personalized script generation',
      'Contract template creation',
      'Objection preemption strategies',
    ],
    managerId: 'REVENUE_DIRECTOR',
  },
  {
    id: 'OBJ_HANDLER',
    name: 'Objection Handler',
    category: 'sales',
    status: 'FUNCTIONAL',
    description: 'Lookup-and-reframing engine providing triple-verified rebuttals based on value propositions',
    capabilities: [
      'Objection classification',
      'Triple-verified rebuttal generation',
      'Value proposition mapping',
      'Reframing strategy selection',
      'Sales playbook integration',
    ],
    managerId: 'REVENUE_DIRECTOR',
  },

  // Trust Category (4 specialists)
  {
    id: 'REVIEW_SPECIALIST',
    name: 'Review Specialist',
    category: 'trust',
    status: 'FUNCTIONAL',
    description: 'Manages online reviews and reputation',
    capabilities: [
      'Review monitoring',
      'Response automation',
      'Sentiment tracking',
      'Review generation campaigns',
      'Reputation management',
    ],
    managerId: 'TRUST_MANAGER',
  },
  {
    id: 'GMB_SPECIALIST',
    name: 'GMB Specialist',
    category: 'trust',
    status: 'FUNCTIONAL',
    description: 'Map Pack optimizer with 30-day post generator and Q&A database builder',
    capabilities: [
      '30-day Google Business post calendar generation',
      'Q&A database builder for local service area',
      'SEO-optimized business description generator',
      'Local Map Pack ranking optimization',
      'NAP consistency audit',
      'Competitor analysis engine',
      'Local keyword strategy',
    ],
    managerId: 'TRUST_MANAGER',
  },
  {
    id: 'REV_MGR',
    name: 'Review Manager',
    category: 'trust',
    status: 'FUNCTIONAL',
    description: 'Automated sentiment analysis bridge with SEO-optimized response generation',
    capabilities: [
      'Multi-tenant sentiment analysis',
      'SEO keyword injection in responses',
      'Review request campaign generation',
      'Brand voice consistency',
      'Reputation trend analysis',
    ],
    managerId: 'REPUTATION_MANAGER',
  },
  {
    id: 'CASE_STUDY',
    name: 'Case Study Builder',
    category: 'trust',
    status: 'FUNCTIONAL',
    description: 'Structured narrative engine transforming success stories into SEO-optimized case studies',
    capabilities: [
      'Before/After data transformation',
      'Challenge-Solution-Results narrative',
      'JSON-LD schema generation',
      'Multi-format export (HTML, PDF, Markdown)',
      'Dynamic metric visualization',
    ],
    managerId: 'REPUTATION_MANAGER',
  },

  // Architect Category (3 specialists)
  {
    id: 'ARCHITECT_COPY_SPECIALIST',
    name: 'Architect Copy Specialist',
    category: 'intelligence',
    status: 'FUNCTIONAL',
    description: 'Provides high-level copywriting strategy and oversight',
    capabilities: [
      'Copy strategy architecture',
      'Brand voice definition',
      'Messaging framework',
      'Content governance',
      'Quality assurance',
    ],
    managerId: 'ARCHITECT',
  },
  {
    id: 'ARCHITECT_FUNNEL_SPECIALIST',
    name: 'Architect Funnel Specialist',
    category: 'intelligence',
    status: 'FUNCTIONAL',
    description: 'Designs comprehensive funnel strategies and architectures',
    capabilities: [
      'Funnel strategy design',
      'Customer journey mapping',
      'Conversion architecture',
      'Multi-funnel orchestration',
      'Performance framework',
    ],
    managerId: 'ARCHITECT',
  },
  {
    id: 'ARCHITECT_UX_UI_SPECIALIST',
    name: 'Architect UX/UI Specialist',
    category: 'intelligence',
    status: 'FUNCTIONAL',
    description: 'Establishes UX/UI standards and design systems',
    capabilities: [
      'Design system architecture',
      'UX strategy framework',
      'Interface standards',
      'Accessibility guidelines',
      'Design governance',
    ],
    managerId: 'ARCHITECT',
  },
];

// ============================================================================
// CATEGORY METADATA
// ============================================================================

interface CategoryMetadata {
  label: string;
  description: string;
  color: string;
  icon: string;
}

const CATEGORY_METADATA: Record<SpecialistCategory, CategoryMetadata> = {
  intelligence: {
    label: 'Intelligence',
    description: 'Strategic analysis and decision-making',
    color: 'var(--color-intelligence, #3b82f6)',
    icon: '🧠',
  },
  marketing: {
    label: 'Marketing',
    description: 'Marketing automation and campaigns',
    color: 'var(--color-marketing, #8b5cf6)',
    icon: '📢',
  },
  builder: {
    label: 'Builder',
    description: 'Development and technical tasks',
    color: 'var(--color-builder, #10b981)',
    icon: '🔨',
  },
  commerce: {
    label: 'Commerce',
    description: 'E-commerce and transactions',
    color: 'var(--color-commerce, #f59e0b)',
    icon: '💰',
  },
  outreach: {
    label: 'Outreach',
    description: 'Customer engagement and communication',
    color: 'var(--color-outreach, #06b6d4)',
    icon: '📧',
  },
  content: {
    label: 'Content',
    description: 'Content creation and management',
    color: 'var(--color-content, #ec4899)',
    icon: '✍️',
  },
  sales: {
    label: 'Sales',
    description: 'Sales automation and enablement',
    color: 'var(--color-sales, #ef4444)',
    icon: '💼',
  },
  trust: {
    label: 'Trust',
    description: 'Security and compliance',
    color: 'var(--color-trust, #14b8a6)',
    icon: '🛡️',
  },
};

// ============================================================================
// STATUS BADGE STYLES
// ============================================================================

const STATUS_STYLES: Record<SpecialistStatus, { bg: string; text: string; label: string }> = {
  GHOST: {
    bg: 'var(--color-status-ghost-bg, #f3f4f6)',
    text: 'var(--color-status-ghost-text, #6b7280)',
    label: 'Ghost',
  },
  UNBUILT: {
    bg: 'var(--color-status-unbuilt-bg, #fef3c7)',
    text: 'var(--color-status-unbuilt-text, #92400e)',
    label: 'Unbuilt',
  },
  SHELL: {
    bg: 'var(--color-status-shell-bg, #dbeafe)',
    text: 'var(--color-status-shell-text, #1e40af)',
    label: 'Shell',
  },
  FUNCTIONAL: {
    bg: 'var(--color-status-functional-bg, #d1fae5)',
    text: 'var(--color-status-functional-text, #065f46)',
    label: 'Functional',
  },
  TESTED: {
    bg: 'var(--color-status-tested-bg, #dcfce7)',
    text: 'var(--color-status-tested-text, #14532d)',
    label: 'Tested',
  },
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface StatusBadgeProps {
  status: SpecialistStatus;
}

const StatusBadge: React.FC<StatusBadgeProps> = React.memo(({ status }) => {
  const style = STATUS_STYLES[status];

  return (
    <span
      style={{
        backgroundColor: style.bg,
        color: style.text,
        padding: '0.25rem 0.5rem',
        borderRadius: '0.375rem',
        fontSize: '0.75rem',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {style.label}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

// ============================================================================
// SPECIALIST CARD COMPONENT
// ============================================================================

interface SpecialistCardProps {
  specialist: AISpecialist;
  onSelect?: (specialistId: string) => void;
}

const SpecialistCard: React.FC<SpecialistCardProps> = React.memo(({ specialist, onSelect }) => {
  const handleClick = useCallback(() => {
    onSelect?.(specialist.id);
  }, [specialist.id, onSelect]);

  const categoryMeta = CATEGORY_METADATA[specialist.category];

  return (
    <Card
      onClick={handleClick}
      style={{
        cursor: onSelect ? 'pointer' : 'default',
        transition: 'all 0.2s ease',
        borderLeft: `4px solid ${categoryMeta.color}`,
      }}
      className="hover:shadow-md"
    >
      <CardHeader>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <CardTitle style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
              {categoryMeta.icon} {specialist.name}
            </CardTitle>
            <StatusBadge status={specialist.status} />
          </div>
        </div>
        <CardDescription style={{ marginTop: '0.75rem' }}>{specialist.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ marginTop: '0.5rem' }}>
          <h4 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--color-text-primary, #111827)' }}>
            Capabilities:
          </h4>
          <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', fontSize: '0.875rem', color: 'var(--color-text-secondary, #6b7280)' }}>
            {specialist.capabilities.slice(0, 3).map((capability, index) => (
              <li key={index} style={{ marginBottom: '0.25rem' }}>
                {capability}
              </li>
            ))}
            {specialist.capabilities.length > 3 && (
              <li style={{ fontStyle: 'italic', color: 'var(--color-text-muted, #9ca3af)' }}>
                +{specialist.capabilities.length - 3} more...
              </li>
            )}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
});

SpecialistCard.displayName = 'SpecialistCard';

// ============================================================================
// FILTER BAR COMPONENT
// ============================================================================

interface FilterBarProps {
  selectedCategory: SpecialistCategory | 'all';
  selectedStatus: SpecialistStatus | 'all';
  searchQuery: string;
  onCategoryChange: (category: SpecialistCategory | 'all') => void;
  onStatusChange: (status: SpecialistStatus | 'all') => void;
  onSearchChange: (query: string) => void;
}

const FilterBar: React.FC<FilterBarProps> = React.memo(
  ({ selectedCategory, selectedStatus, searchQuery, onCategoryChange, onStatusChange, onSearchChange }) => {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          marginBottom: '2rem',
          padding: '1.5rem',
          backgroundColor: 'var(--color-bg-secondary, #f9fafb)',
          borderRadius: '0.5rem',
          border: '1px solid var(--color-border, #e5e7eb)',
        }}
      >
        {/* Search Input */}
        <div>
          <input
            type="text"
            placeholder="Search specialists..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border, #d1d5db)',
              fontSize: '0.875rem',
            }}
          />
        </div>

        {/* Category Filter */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            onClick={() => onCategoryChange('all')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border, #d1d5db)',
              backgroundColor: selectedCategory === 'all' ? 'var(--color-primary, #3b82f6)' : 'white',
              color: selectedCategory === 'all' ? 'white' : 'var(--color-text-primary, #111827)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            All Categories
          </button>
          {(Object.keys(CATEGORY_METADATA) as SpecialistCategory[]).map((category) => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: `1px solid ${CATEGORY_METADATA[category].color}`,
                backgroundColor: selectedCategory === category ? CATEGORY_METADATA[category].color : 'white',
                color: selectedCategory === category ? 'white' : CATEGORY_METADATA[category].color,
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {CATEGORY_METADATA[category].icon} {CATEGORY_METADATA[category].label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          <button
            onClick={() => onStatusChange('all')}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border, #d1d5db)',
              backgroundColor: selectedStatus === 'all' ? 'var(--color-primary, #3b82f6)' : 'white',
              color: selectedStatus === 'all' ? 'white' : 'var(--color-text-primary, #111827)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            All Statuses
          </button>
          {(Object.keys(STATUS_STYLES) as SpecialistStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => onStatusChange(status)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: '1px solid var(--color-border, #d1d5db)',
                backgroundColor: selectedStatus === status ? STATUS_STYLES[status].bg : 'white',
                color: selectedStatus === status ? STATUS_STYLES[status].text : 'var(--color-text-primary, #111827)',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {STATUS_STYLES[status].label}
            </button>
          ))}
        </div>
      </div>
    );
  }
);

FilterBar.displayName = 'FilterBar';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const SpecialistRegistry: React.FC<SpecialistRegistryProps> = React.memo(({ organizationId, onSelectSpecialist }) => {
  const [selectedCategory, setSelectedCategory] = useState<SpecialistCategory | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<SpecialistStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Filter specialists based on selected filters
  const filteredSpecialists = useMemo(() => {
    return SPECIALIST_REGISTRY.filter((specialist) => {
      const categoryMatch = selectedCategory === 'all' || specialist.category === selectedCategory;
      const statusMatch = selectedStatus === 'all' || specialist.status === selectedStatus;
      const searchMatch =
        searchQuery === '' ||
        specialist.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        specialist.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        specialist.capabilities.some((cap) => cap.toLowerCase().includes(searchQuery.toLowerCase()));

      return categoryMatch && statusMatch && searchMatch;
    });
  }, [selectedCategory, selectedStatus, searchQuery]);

  // Group specialists by category
  const specialistsByCategory = useMemo(() => {
    const grouped: Partial<Record<SpecialistCategory, AISpecialist[]>> = {};

    filteredSpecialists.forEach((specialist) => {
      const category = specialist.category;
      grouped[category] ??= [];
      grouped[category].push(specialist);
    });

    return grouped;
  }, [filteredSpecialists]);

  const handleCategoryChange = useCallback((category: SpecialistCategory | 'all') => {
    setSelectedCategory(category);
  }, []);

  const handleStatusChange = useCallback((status: SpecialistStatus | 'all') => {
    setSelectedStatus(status);
  }, []);

  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  // Calculate statistics
  const stats = useMemo(() => {
    return {
      total: SPECIALIST_REGISTRY.length,
      functional: SPECIALIST_REGISTRY.filter((s) => s.status === 'FUNCTIONAL').length,
      tested: SPECIALIST_REGISTRY.filter((s) => s.status === 'TESTED').length,
      filtered: filteredSpecialists.length,
    };
  }, [filteredSpecialists.length]);

  return (
    <div style={{ padding: '2rem' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: '700', marginBottom: '0.5rem', color: 'var(--color-text-primary, #111827)' }}>
          AI Specialist Registry
        </h1>
        <p style={{ fontSize: '1rem', color: 'var(--color-text-secondary, #6b7280)', marginBottom: '1rem' }}>
          Organization ID: {organizationId}
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-bg-info, #eff6ff)',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Total: {stats.total}
          </div>
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-bg-success, #dcfce7)',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Functional: {stats.functional}
          </div>
          <div
            style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--color-bg-primary, #f3f4f6)',
              borderRadius: '0.375rem',
              fontSize: '0.875rem',
              fontWeight: '600',
            }}
          >
            Showing: {stats.filtered}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <FilterBar
        selectedCategory={selectedCategory}
        selectedStatus={selectedStatus}
        searchQuery={searchQuery}
        onCategoryChange={handleCategoryChange}
        onStatusChange={handleStatusChange}
        onSearchChange={handleSearchChange}
      />

      {/* Specialists Grid by Category */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
        {(Object.keys(specialistsByCategory) as SpecialistCategory[])
          .sort((a, b) => CATEGORY_METADATA[a].label.localeCompare(CATEGORY_METADATA[b].label))
          .map((category) => {
            const specialists = specialistsByCategory[category];
            if (!specialists) {
              return null;
            }
            const meta = CATEGORY_METADATA[category];

            return (
              <div key={category}>
                {/* Category Header */}
                <div
                  style={{
                    marginBottom: '1rem',
                    paddingBottom: '0.5rem',
                    borderBottom: `2px solid ${meta.color}`,
                  }}
                >
                  <h2
                    style={{
                      fontSize: '1.5rem',
                      fontWeight: '600',
                      color: meta.color,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span>{meta.icon}</span>
                    <span>{meta.label}</span>
                    <span style={{ fontSize: '1rem', fontWeight: '400', color: 'var(--color-text-muted, #9ca3af)' }}>
                      ({specialists.length})
                    </span>
                  </h2>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #6b7280)', marginTop: '0.25rem' }}>
                    {meta.description}
                  </p>
                </div>

                {/* Specialists Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                    gap: '1.5rem',
                  }}
                >
                  {specialists.map((specialist) => (
                    <SpecialistCard key={specialist.id} specialist={specialist} onSelect={onSelectSpecialist} />
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      {/* Empty State */}
      {filteredSpecialists.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            backgroundColor: 'var(--color-bg-secondary, #f9fafb)',
            borderRadius: '0.5rem',
          }}
        >
          <p style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-secondary, #6b7280)', marginBottom: '0.5rem' }}>
            No specialists found
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted, #9ca3af)' }}>
            Try adjusting your filters or search query
          </p>
        </div>
      )}
    </div>
  );
});

SpecialistRegistry.displayName = 'SpecialistRegistry';

// ============================================================================
// EXPORTS
// ============================================================================

export default SpecialistRegistry;

// Export specialist data for external use
export { SPECIALIST_REGISTRY, CATEGORY_METADATA, STATUS_STYLES };
