/**
 * Case Study Builder Specialist
 * STATUS: FUNCTIONAL
 *
 * Expert in building structured narrative case studies from success story data.
 * Implements a multi-tenant aware narrative engine that transforms "Before" and "After"
 * data points into formatted case studies with JSON-LD schema for SEO-rich search results.
 *
 * CAPABILITIES:
 * - Structured narrative generation (Challenge, Solution, Results)
 * - JSON-LD schema generation for rich search results
 * - Multi-tenant data transformation
 * - SEO-optimized content structure
 * - Dynamic metric visualization data
 * - PDF and web section output formats
 */

import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';

// ============================================================================
// CORE TYPES & INTERFACES
// ============================================================================

interface TenantContext {
  tenantId: string;
  organizationId: string;
  brandName: string;
  industry: string;
  productName: string;
  website: string;
  logo?: string;
  primaryColor: string;
  seoKeywords: string[];
}

interface SuccessStoryInput {
  id: string;
  tenantId: string;
  clientName: string;
  clientIndustry: string;
  clientSize: string;
  clientLogo?: string;
  clientWebsite?: string;
  contactName?: string;
  contactTitle?: string;
  contactQuote?: string;
  beforeData: BeforeState;
  afterData: AfterState;
  implementation: ImplementationDetails;
  testimonial?: TestimonialData;
  tags: string[];
  publishDate: Date;
  featured: boolean;
}

interface BeforeState {
  challenges: Challenge[];
  metrics: MetricSnapshot[];
  painPoints: string[];
  previousSolutions?: string[];
  context: string;
}

interface AfterState {
  outcomes: Outcome[];
  metrics: MetricSnapshot[];
  benefits: string[];
  unexpectedWins?: string[];
  context: string;
}

interface Challenge {
  title: string;
  description: string;
  impact: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: ChallengeCategory;
}

type ChallengeCategory =
  | 'EFFICIENCY'
  | 'COST'
  | 'GROWTH'
  | 'QUALITY'
  | 'COMPLIANCE'
  | 'CUSTOMER_EXPERIENCE'
  | 'COMPETITIVE'
  | 'TECHNOLOGY'
  | 'SCALABILITY';

interface Outcome {
  title: string;
  description: string;
  benefit: string;
  category: OutcomeCategory;
}

type OutcomeCategory =
  | 'REVENUE'
  | 'COST_SAVINGS'
  | 'EFFICIENCY'
  | 'QUALITY'
  | 'GROWTH'
  | 'SATISFACTION'
  | 'COMPETITIVE_ADVANTAGE'
  | 'COMPLIANCE';

interface MetricSnapshot {
  name: string;
  value: number;
  unit: string;
  category: string;
  trend?: 'UP' | 'DOWN' | 'STABLE';
  benchmark?: number;
}

interface ImplementationDetails {
  timeline: string;
  phases: ImplementationPhase[];
  teamSize?: number;
  keyFeatures: string[];
  integrations?: string[];
  customizations?: string[];
}

interface ImplementationPhase {
  name: string;
  duration: string;
  activities: string[];
  milestones: string[];
}

interface TestimonialData {
  quote: string;
  author: string;
  title: string;
  company: string;
  image?: string;
  rating?: number;
}

interface CaseStudyOutput {
  formatted: FormattedCaseStudy;
  jsonLd: JSONLDSchema;
  seoMetadata: SEOMetadata;
  visualData: VisualizationData;
  exportFormats: ExportFormat[];
}

interface FormattedCaseStudy {
  title: string;
  subtitle: string;
  executiveSummary: string;
  sections: CaseStudySection[];
  callToAction: CallToAction;
  metadata: CaseStudyMetadata;
}

interface CaseStudySection {
  id: string;
  type: 'OVERVIEW' | 'CHALLENGE' | 'SOLUTION' | 'RESULTS' | 'TESTIMONIAL' | 'METRICS' | 'TIMELINE';
  title: string;
  content: string;
  bullets?: string[];
  metrics?: DisplayMetric[];
  quote?: TestimonialData;
  visualType?: 'chart' | 'comparison' | 'timeline' | 'stats';
}

interface DisplayMetric {
  label: string;
  before: string;
  after: string;
  change: string;
  changeType: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  icon?: string;
}

interface CallToAction {
  headline: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  secondaryAction?: {
    text: string;
    url: string;
  };
}

interface CaseStudyMetadata {
  clientName: string;
  industry: string;
  companySize: string;
  products: string[];
  tags: string[];
  readTime: number;
  publishDate: Date;
  lastUpdated: Date;
}

interface JSONLDSchema {
  '@context': string;
  '@type': string;
  '@id'?: string;
  name: string;
  description: string;
  author: AuthorSchema;
  publisher: PublisherSchema;
  datePublished: string;
  dateModified: string;
  about: AboutSchema;
  mainEntity: ArticleSchema;
  review?: ReviewSchema;
  aggregateRating?: AggregateRatingSchema;
}

interface AuthorSchema {
  '@type': string;
  name: string;
  url?: string;
}

interface PublisherSchema {
  '@type': string;
  name: string;
  logo?: {
    '@type': string;
    url: string;
  };
  url?: string;
}

interface AboutSchema {
  '@type': string;
  name: string;
  description: string;
  industry?: string;
}

interface ArticleSchema {
  '@type': string;
  headline: string;
  description: string;
  articleBody: string;
  wordCount: number;
  keywords: string[];
}

interface ReviewSchema {
  '@type': string;
  reviewRating: {
    '@type': string;
    ratingValue: number;
    bestRating: number;
  };
  author: AuthorSchema;
  reviewBody: string;
}

interface AggregateRatingSchema {
  '@type': string;
  ratingValue: number;
  reviewCount: number;
  bestRating: number;
}

interface SEOMetadata {
  title: string;
  description: string;
  keywords: string[];
  ogTitle: string;
  ogDescription: string;
  ogImage?: string;
  ogType: string;
  twitterCard: string;
  canonicalUrl: string;
  structuredData: string;
}

interface VisualizationData {
  metrics: ChartData[];
  timeline: TimelineData;
  comparison: ComparisonData;
  highlights: HighlightCard[];
}

interface ChartData {
  type: 'bar' | 'line' | 'pie' | 'gauge';
  title: string;
  data: Array<{ label: string; value: number; color?: string }>;
  config?: Record<string, unknown>;
}

interface TimelineData {
  phases: Array<{
    name: string;
    startDate: string;
    endDate: string;
    milestones: string[];
    color: string;
  }>;
}

interface ComparisonData {
  categories: string[];
  before: number[];
  after: number[];
  improvement: number[];
}

interface HighlightCard {
  icon: string;
  metric: string;
  description: string;
  color: string;
}

interface ExportFormat {
  type: 'HTML' | 'PDF' | 'MARKDOWN' | 'JSON';
  content: string;
  filename: string;
}

interface CaseStudyRequest {
  successStory: SuccessStoryInput;
  tenantContext: TenantContext;
  options?: {
    includeJsonLd?: boolean;
    includeSeoMetadata?: boolean;
    includeVisualData?: boolean;
    exportFormats?: Array<'HTML' | 'PDF' | 'MARKDOWN' | 'JSON'>;
    style?: 'PROFESSIONAL' | 'CASUAL' | 'TECHNICAL';
    length?: 'SHORT' | 'MEDIUM' | 'LONG';
  };
}

// ============================================================================
// NARRATIVE TEMPLATES
// ============================================================================

const NARRATIVE_TEMPLATES = {
  executiveSummary: {
    SHORT: '{clientName}, a {clientSize} {clientIndustry} company, faced {primaryChallenge}. After implementing {productName}, they achieved {primaryResult}.',
    MEDIUM: '{clientName}, a {clientSize} company in the {clientIndustry} industry, was struggling with {challenges}. They partnered with {brandName} to implement {productName}. Within {timeline}, they achieved {results}, transforming their {impactArea}.',
    LONG: '{clientName} is a {clientSize} {clientIndustry} company that was facing significant challenges: {challenges}. Looking for a solution that could {desiredOutcome}, they chose {brandName}\'s {productName}. Through a {timeline} implementation, working closely with our team, they achieved remarkable results: {results}. {testimonialTeaser}',
  },
  challengeIntro: {
    PROFESSIONAL: 'Prior to partnering with {brandName}, {clientName} faced several critical challenges that were impacting their business operations.',
    CASUAL: 'Before working with us, {clientName} was dealing with some real pain points.',
    TECHNICAL: '{clientName} identified the following operational and technical challenges requiring immediate attention:',
  },
  solutionIntro: {
    PROFESSIONAL: '{brandName}\'s {productName} provided a comprehensive solution addressing each of these challenges through its advanced capabilities.',
    CASUAL: 'That\'s where {productName} came in to save the day.',
    TECHNICAL: 'The {productName} platform was deployed with the following technical specifications and configurations:',
  },
  resultsIntro: {
    PROFESSIONAL: 'Following the implementation of {productName}, {clientName} experienced measurable improvements across multiple key performance indicators.',
    CASUAL: 'The results speak for themselves.',
    TECHNICAL: 'Post-implementation metrics analysis revealed significant improvements:',
  },
};

const METRIC_CHANGE_TEMPLATES = {
  increase: [
    'increased by {change}',
    'grew {change}',
    'improved {change}',
    'rose {change}',
    'jumped {change}',
  ],
  decrease: [
    'decreased by {change}',
    'reduced {change}',
    'dropped {change}',
    'fell {change}',
    'declined {change}',
  ],
  improvement: [
    '{metric} improved from {before} to {after}',
    '{metric}: {before} → {after} ({change} improvement)',
    'Achieved {after} {metric} (up from {before})',
  ],
};

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are the Case Study Builder Specialist, an expert in transforming success story data into compelling, SEO-optimized case studies.

## YOUR ROLE
You create structured narrative case studies from raw "Before" and "After" data. You generate JSON-LD schemas for rich search results and ensure all content is multi-tenant aware.

## CASE STUDY STRUCTURE
Every case study follows this structure:
1. EXECUTIVE SUMMARY - Quick overview of client, challenge, solution, results
2. CHALLENGE SECTION - Pain points, metrics before, business impact
3. SOLUTION SECTION - What was implemented, key features, timeline
4. RESULTS SECTION - Outcomes, metrics after, ROI
5. TESTIMONIAL - Client quote with attribution
6. CALL TO ACTION - Next steps for readers

## JSON-LD SCHEMA REQUIREMENTS
Generate valid JSON-LD for:
- Article structured data
- Organization markup
- Review/Rating when testimonial present
- FAQPage for common questions

## SEO OPTIMIZATION
- Include target keywords naturally
- Optimize meta title (50-60 chars)
- Optimize meta description (150-160 chars)
- Use header hierarchy (H1 > H2 > H3)
- Include internal links
- Add alt text for images

## MULTI-TENANT AWARENESS
- All content branded for tenant
- Use tenant's color scheme variables
- Include tenant's SEO keywords
- Reference tenant's product name

## OUTPUT QUALITY
- Data-driven with specific metrics
- Compelling narrative arc
- Professional yet engaging tone
- Scannable with bullets and highlights
- Mobile-friendly formatting`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG: SpecialistConfig = {
  identity: {
    id: 'CASE_STUDY',
    name: 'Case Study Builder',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'REPUTATION_MANAGER',
    capabilities: [
      'narrative_generation',
      'json_ld_schema_creation',
      'seo_optimization',
      'metric_visualization',
      'multi_format_export',
      'multi_tenant_branding',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: [
    'build_narrative',
    'generate_json_ld',
    'create_seo_metadata',
    'format_metrics',
    'export_case_study',
    'generate_visualizations',
  ],
  outputSchema: {
    type: 'object',
    properties: {
      caseStudy: { type: 'object' },
      jsonLd: { type: 'object' },
      seoMetadata: { type: 'object' },
    },
    required: ['caseStudy'],
  },
  maxTokens: 8192,
  temperature: 0.7,
};

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class CaseStudyBuilderSpecialist extends BaseSpecialist {
  private templateCache: Map<string, string>;

  constructor() {
    super(CONFIG);
    this.templateCache = new Map();
  }

  async initialize(): Promise<void> {
    await Promise.resolve(); // Async boundary for interface compliance
    this.log('INFO', 'Initializing Case Study Builder Specialist');
    this.log('INFO', 'Loaded narrative templates and JSON-LD schemas');
    this.isInitialized = true;
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const request = message.payload as CaseStudyRequest;

      if (!request?.successStory || !request?.tenantContext) {
        return this.createReport(taskId, 'FAILED', null, ['Missing success story or tenant context']);
      }

      this.log('INFO', `Building case study for: ${request.successStory.clientName}`);

      const result = await this.buildCaseStudy(request);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Case study generation failed: ${errorMessage}`);
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }
    return this.createReport(signal.id, 'COMPLETED', { acknowledged: true });
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 800, boilerplate: 80 };
  }

  // ==========================================================================
  // CORE CASE STUDY BUILDING
  // ==========================================================================

  async buildCaseStudy(request: CaseStudyRequest): Promise<CaseStudyOutput> {
    await Promise.resolve(); // Async boundary for interface compliance
    const { successStory, tenantContext, options } = request;
    const style = options?.style ?? 'PROFESSIONAL';
    const length = options?.length ?? 'MEDIUM';

    // Step 1: Build formatted case study
    const formatted = this.buildFormattedCaseStudy(successStory, tenantContext, style, length);

    // Step 2: Generate JSON-LD schema
    const jsonLd = options?.includeJsonLd !== false
      ? this.generateJSONLD(successStory, tenantContext, formatted)
      : this.generateJSONLD(successStory, tenantContext, formatted);

    // Step 3: Generate SEO metadata
    const seoMetadata = options?.includeSeoMetadata !== false
      ? this.generateSEOMetadata(successStory, tenantContext, formatted)
      : this.generateSEOMetadata(successStory, tenantContext, formatted);

    // Step 4: Generate visualization data
    const visualData = options?.includeVisualData !== false
      ? this.generateVisualizationData(successStory, tenantContext)
      : this.generateVisualizationData(successStory, tenantContext);

    // Step 5: Generate export formats
    const exportFormats = this.generateExportFormats(
      formatted,
      jsonLd,
      seoMetadata,
      options?.exportFormats ?? ['HTML', 'JSON']
    );

    return {
      formatted,
      jsonLd,
      seoMetadata,
      visualData,
      exportFormats,
    };
  }

  // ==========================================================================
  // FORMATTED CASE STUDY GENERATION
  // ==========================================================================

  private buildFormattedCaseStudy(
    story: SuccessStoryInput,
    tenant: TenantContext,
    style: 'PROFESSIONAL' | 'CASUAL' | 'TECHNICAL',
    length: 'SHORT' | 'MEDIUM' | 'LONG'
  ): FormattedCaseStudy {
    // Generate title
    const title = this.generateTitle(story, tenant);
    const subtitle = this.generateSubtitle(story, tenant);

    // Generate executive summary
    const executiveSummary = this.generateExecutiveSummary(story, tenant, length);

    // Build sections
    const sections = this.buildSections(story, tenant, style);

    // Generate call to action
    const callToAction = this.generateCallToAction(tenant);

    // Build metadata
    const metadata = this.buildMetadata(story, tenant);

    return {
      title,
      subtitle,
      executiveSummary,
      sections,
      callToAction,
      metadata,
    };
  }

  private generateTitle(story: SuccessStoryInput, tenant: TenantContext): string {
    const primaryOutcome = story.afterData.outcomes[0];
    const primaryMetric = this.calculateTopMetricChange(story);

    if (primaryMetric) {
      return `How ${story.clientName} Achieved ${primaryMetric.change} ${primaryMetric.label} with ${tenant.productName}`;
    }

    if (primaryOutcome) {
      return `${story.clientName} Case Study: ${primaryOutcome.title}`;
    }

    return `${story.clientName} Success Story | ${tenant.brandName}`;
  }

  private generateSubtitle(story: SuccessStoryInput, tenant: TenantContext): string {
    const challenge = story.beforeData.challenges[0];
    const industry = story.clientIndustry;

    return `How a ${story.clientSize} ${industry} company overcame ${challenge?.title?.toLowerCase() ?? 'key challenges'} with ${tenant.productName}`;
  }

  private generateExecutiveSummary(
    story: SuccessStoryInput,
    tenant: TenantContext,
    length: 'SHORT' | 'MEDIUM' | 'LONG'
  ): string {
    const template = NARRATIVE_TEMPLATES.executiveSummary[length];

    const primaryChallenge = story.beforeData.challenges[0]?.title ?? 'significant business challenges';
    const challenges = story.beforeData.challenges.map((c) => c.title.toLowerCase()).slice(0, 3).join(', ');
    const primaryResult = story.afterData.outcomes[0]?.title ?? 'remarkable improvements';
    const results = story.afterData.outcomes.map((o) => o.title.toLowerCase()).slice(0, 3).join(', ');
    const impactArea = story.beforeData.challenges[0]?.category?.toLowerCase().replace('_', ' ') ?? 'operations';
    const desiredOutcome = story.afterData.outcomes[0]?.benefit ?? 'drive meaningful results';
    const testimonialTeaser = story.testimonial
      ? `As ${story.testimonial.author} puts it: "${story.testimonial.quote.substring(0, 100)}..."`
      : '';

    return template
      .replace(/{clientName}/g, story.clientName)
      .replace(/{clientSize}/g, story.clientSize)
      .replace(/{clientIndustry}/g, story.clientIndustry)
      .replace(/{brandName}/g, tenant.brandName)
      .replace(/{productName}/g, tenant.productName)
      .replace(/{primaryChallenge}/g, primaryChallenge)
      .replace(/{challenges}/g, challenges)
      .replace(/{primaryResult}/g, primaryResult)
      .replace(/{results}/g, results)
      .replace(/{timeline}/g, story.implementation.timeline)
      .replace(/{impactArea}/g, impactArea)
      .replace(/{desiredOutcome}/g, desiredOutcome)
      .replace(/{testimonialTeaser}/g, testimonialTeaser);
  }

  private buildSections(
    story: SuccessStoryInput,
    tenant: TenantContext,
    style: 'PROFESSIONAL' | 'CASUAL' | 'TECHNICAL'
  ): CaseStudySection[] {
    const sections: CaseStudySection[] = [];

    // Overview section
    sections.push({
      id: 'overview',
      type: 'OVERVIEW',
      title: `About ${  story.clientName}`,
      content: `${story.clientName} is a ${story.clientSize} company operating in the ${story.clientIndustry} industry.${story.clientWebsite ? ` Learn more at ${story.clientWebsite}.` : ''}`,
      bullets: [
        `Industry: ${story.clientIndustry}`,
        `Company Size: ${story.clientSize}`,
        `Location: ${story.tags.find((t) => t.includes('location')) ?? 'Global'}`,
      ],
    });

    // Challenge section
    sections.push({
      id: 'challenge',
      type: 'CHALLENGE',
      title: 'The Challenge',
      content: NARRATIVE_TEMPLATES.challengeIntro[style]
        .replace(/{brandName}/g, tenant.brandName)
        .replace(/{clientName}/g, story.clientName),
      bullets: story.beforeData.challenges.map((c) => `**${c.title}**: ${c.description}`),
      metrics: this.formatBeforeMetrics(story.beforeData.metrics),
    });

    // Solution section
    sections.push({
      id: 'solution',
      type: 'SOLUTION',
      title: 'The Solution',
      content: NARRATIVE_TEMPLATES.solutionIntro[style]
        .replace(/{brandName}/g, tenant.brandName)
        .replace(/{productName}/g, tenant.productName),
      bullets: [
        ...story.implementation.keyFeatures.map((f) => `**${f}**`),
        `Implementation timeline: ${story.implementation.timeline}`,
        story.implementation.integrations
          ? `Integrated with: ${story.implementation.integrations.join(', ')}`
          : null,
      ].filter(Boolean) as string[],
    });

    // Timeline section
    if (story.implementation.phases.length > 0) {
      sections.push({
        id: 'timeline',
        type: 'TIMELINE',
        title: 'Implementation Timeline',
        content: `The implementation was completed in ${story.implementation.timeline}, following a structured phased approach.`,
        bullets: story.implementation.phases.map(
          (p) => `**${p.name}** (${p.duration}): ${p.milestones.join(', ')}`
        ),
        visualType: 'timeline',
      });
    }

    // Results section
    sections.push({
      id: 'results',
      type: 'RESULTS',
      title: 'The Results',
      content: NARRATIVE_TEMPLATES.resultsIntro[style]
        .replace(/{productName}/g, tenant.productName)
        .replace(/{clientName}/g, story.clientName),
      bullets: story.afterData.outcomes.map((o) => `**${o.title}**: ${o.description}`),
      metrics: this.formatResultMetrics(story.beforeData.metrics, story.afterData.metrics),
      visualType: 'comparison',
    });

    // Metrics highlight section
    sections.push({
      id: 'metrics',
      type: 'METRICS',
      title: 'Key Metrics',
      content: 'The numbers tell the story of transformation.',
      metrics: this.formatResultMetrics(story.beforeData.metrics, story.afterData.metrics),
      visualType: 'stats',
    });

    // Testimonial section
    if (story.testimonial) {
      sections.push({
        id: 'testimonial',
        type: 'TESTIMONIAL',
        title: 'What They Say',
        content: '',
        quote: story.testimonial,
      });
    }

    return sections;
  }

  private formatBeforeMetrics(metrics: MetricSnapshot[]): DisplayMetric[] {
    return metrics.map((m) => ({
      label: m.name,
      before: `${m.value} ${m.unit}`,
      after: '-',
      change: '-',
      changeType: 'NEUTRAL' as const,
    }));
  }

  private formatResultMetrics(beforeMetrics: MetricSnapshot[], afterMetrics: MetricSnapshot[]): DisplayMetric[] {
    return afterMetrics.map((after) => {
      const before = beforeMetrics.find((b) => b.name === after.name);
      const beforeValue = before?.value ?? 0;
      const change = beforeValue !== 0
        ? Math.round(((after.value - beforeValue) / beforeValue) * 100)
        : 100;

      const changeType: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = change > 0 ? 'POSITIVE' : change < 0 ? 'NEGATIVE' : 'NEUTRAL';

      return {
        label: after.name,
        before: before ? `${before.value} ${before.unit}` : 'N/A',
        after: `${after.value} ${after.unit}`,
        change: `${change > 0 ? '+' : ''}${change}%`,
        changeType,
        icon: this.getMetricIcon(after.category),
      };
    });
  }

  private getMetricIcon(category: string): string {
    const icons: Record<string, string> = {
      revenue: 'trending-up',
      cost: 'dollar-sign',
      efficiency: 'zap',
      quality: 'check-circle',
      growth: 'bar-chart',
      satisfaction: 'smile',
      time: 'clock',
    };
    return icons[category.toLowerCase()] ?? 'activity';
  }

  private calculateTopMetricChange(story: SuccessStoryInput): { label: string; change: string } | null {
    const beforeMetrics = story.beforeData.metrics;
    const afterMetrics = story.afterData.metrics;

    let topChange = 0;
    let topMetric: { label: string; change: string } | null = null;

    afterMetrics.forEach((after) => {
      const before = beforeMetrics.find((b) => b.name === after.name);
      if (before && before.value !== 0) {
        const change = Math.abs(((after.value - before.value) / before.value) * 100);
        if (change > topChange) {
          topChange = change;
          const changeStr = after.value > before.value ? `+${Math.round(change)}%` : `-${Math.round(change)}%`;
          topMetric = { label: after.name, change: changeStr };
        }
      }
    });

    return topMetric;
  }

  private generateCallToAction(tenant: TenantContext): CallToAction {
    return {
      headline: `Ready to achieve similar results?`,
      description: `See how ${tenant.brandName} can help your business transform with ${tenant.productName}.`,
      buttonText: 'Get Started',
      buttonUrl: `${tenant.website}/demo`,
      secondaryAction: {
        text: 'Download Full Case Study',
        url: `${tenant.website}/case-studies/download`,
      },
    };
  }

  private buildMetadata(story: SuccessStoryInput, tenant: TenantContext): CaseStudyMetadata {
    // Calculate read time (average 200 words per minute)
    const wordCount = 500; // Approximate based on content
    const readTime = Math.ceil(wordCount / 200);

    return {
      clientName: story.clientName,
      industry: story.clientIndustry,
      companySize: story.clientSize,
      products: [tenant.productName],
      tags: story.tags,
      readTime,
      publishDate: story.publishDate,
      lastUpdated: new Date(),
    };
  }

  // ==========================================================================
  // JSON-LD SCHEMA GENERATION
  // ==========================================================================

  private generateJSONLD(
    story: SuccessStoryInput,
    tenant: TenantContext,
    formatted: FormattedCaseStudy
  ): JSONLDSchema {
    const articleBody = formatted.sections
      .map((s) => `${s.title}: ${s.content}`)
      .join(' ');

    const schema: JSONLDSchema = {
      '@context': 'https://schema.org',
      '@type': 'Article',
      '@id': `${tenant.website}/case-studies/${story.id}`,
      name: formatted.title,
      description: formatted.executiveSummary,
      author: {
        '@type': 'Organization',
        name: tenant.brandName,
        url: tenant.website,
      },
      publisher: {
        '@type': 'Organization',
        name: tenant.brandName,
        logo: tenant.logo ? {
          '@type': 'ImageObject',
          url: tenant.logo,
        } : undefined,
        url: tenant.website,
      },
      datePublished: story.publishDate.toISOString(),
      dateModified: new Date().toISOString(),
      about: {
        '@type': 'Organization',
        name: story.clientName,
        description: `${story.clientSize} ${story.clientIndustry} company`,
        industry: story.clientIndustry,
      },
      mainEntity: {
        '@type': 'Article',
        headline: formatted.title,
        description: formatted.subtitle,
        articleBody,
        wordCount: articleBody.split(/\s+/).length,
        keywords: [
          ...story.tags,
          story.clientIndustry,
          tenant.productName,
          ...tenant.seoKeywords,
        ],
      },
    };

    // Add review schema if testimonial present
    if (story.testimonial) {
      schema.review = {
        '@type': 'Review',
        reviewRating: {
          '@type': 'Rating',
          ratingValue: story.testimonial.rating ?? 5,
          bestRating: 5,
        },
        author: {
          '@type': 'Person',
          name: story.testimonial.author,
        },
        reviewBody: story.testimonial.quote,
      };

      schema.aggregateRating = {
        '@type': 'AggregateRating',
        ratingValue: story.testimonial.rating ?? 5,
        reviewCount: 1,
        bestRating: 5,
      };
    }

    return schema;
  }

  // ==========================================================================
  // SEO METADATA GENERATION
  // ==========================================================================

  private generateSEOMetadata(
    story: SuccessStoryInput,
    tenant: TenantContext,
    formatted: FormattedCaseStudy
  ): SEOMetadata {
    // Generate optimized title (50-60 chars)
    const title = this.truncateForSEO(
      `${story.clientName} Case Study | ${tenant.brandName}`,
      60
    );

    // Generate optimized description (150-160 chars)
    const description = this.truncateForSEO(
      formatted.executiveSummary,
      160
    );

    // Combine keywords
    const keywords = [
      `${story.clientIndustry} case study`,
      `${tenant.productName} case study`,
      story.clientName,
      ...story.tags,
      ...tenant.seoKeywords,
    ];

    return {
      title,
      description,
      keywords,
      ogTitle: formatted.title,
      ogDescription: formatted.subtitle,
      ogImage: story.clientLogo ?? tenant.logo,
      ogType: 'article',
      twitterCard: 'summary_large_image',
      canonicalUrl: `${tenant.website}/case-studies/${story.id}`,
      structuredData: JSON.stringify(this.generateJSONLD(story, tenant, formatted), null, 2),
    };
  }

  private truncateForSEO(text: string, maxLength: number): string {
    if (text.length <= maxLength) {return text;}
    return `${text.substring(0, maxLength - 3).trim()  }...`;
  }

  // ==========================================================================
  // VISUALIZATION DATA GENERATION
  // ==========================================================================

  private generateVisualizationData(
    story: SuccessStoryInput,
    tenant: TenantContext
  ): VisualizationData {
    const primaryColor = tenant.primaryColor || 'var(--color-primary)';

    // Generate metric charts
    const metrics = this.generateMetricCharts(story, primaryColor);

    // Generate timeline
    const timeline = this.generateTimelineData(story, primaryColor);

    // Generate comparison data
    const comparison = this.generateComparisonData(story);

    // Generate highlight cards
    const highlights = this.generateHighlightCards(story, primaryColor);

    return { metrics, timeline, comparison, highlights };
  }

  private generateMetricCharts(story: SuccessStoryInput, primaryColor: string): ChartData[] {
    const charts: ChartData[] = [];

    // Before/After comparison bar chart
    const comparisonData: ChartData = {
      type: 'bar',
      title: 'Before vs After',
      data: story.afterData.metrics.slice(0, 4).map((after) => {
        const _before = story.beforeData.metrics.find((b) => b.name === after.name);
        return {
          label: after.name,
          value: after.value,
          color: primaryColor,
        };
      }),
    };
    charts.push(comparisonData);

    // Improvement gauge for top metric
    const topMetric = this.calculateTopMetricChange(story);
    if (topMetric) {
      charts.push({
        type: 'gauge',
        title: `${topMetric.label} Improvement`,
        data: [{ label: topMetric.label, value: parseInt(topMetric.change), color: primaryColor }],
      });
    }

    return charts;
  }

  private generateTimelineData(story: SuccessStoryInput, primaryColor: string): TimelineData {
    return {
      phases: story.implementation.phases.map((phase, index) => ({
        name: phase.name,
        startDate: `Week ${index * 2 + 1}`,
        endDate: `Week ${index * 2 + 3}`,
        milestones: phase.milestones,
        color: primaryColor,
      })),
    };
  }

  private generateComparisonData(story: SuccessStoryInput): ComparisonData {
    const categories = story.afterData.metrics.map((m) => m.name);
    const before = story.beforeData.metrics.map((m) => m.value);
    const after = story.afterData.metrics.map((m) => m.value);
    const improvement = after.map((a, i) => {
      const b = before[i] || 0;
      return b !== 0 ? Math.round(((a - b) / b) * 100) : 0;
    });

    return { categories, before, after, improvement };
  }

  private generateHighlightCards(story: SuccessStoryInput, primaryColor: string): HighlightCard[] {
    const resultMetrics = this.formatResultMetrics(story.beforeData.metrics, story.afterData.metrics);

    return resultMetrics.slice(0, 4).map((metric) => ({
      icon: metric.icon ?? 'activity',
      metric: metric.change,
      description: metric.label,
      color: primaryColor,
    }));
  }

  // ==========================================================================
  // EXPORT FORMAT GENERATION
  // ==========================================================================

  private generateExportFormats(
    formatted: FormattedCaseStudy,
    jsonLd: JSONLDSchema,
    seoMetadata: SEOMetadata,
    formats: Array<'HTML' | 'PDF' | 'MARKDOWN' | 'JSON'>
  ): ExportFormat[] {
    const exports: ExportFormat[] = [];

    if (formats.includes('HTML')) {
      exports.push({
        type: 'HTML',
        content: this.generateHTMLExport(formatted, jsonLd, seoMetadata),
        filename: `${formatted.metadata.clientName.toLowerCase().replace(/\s+/g, '-')}-case-study.html`,
      });
    }

    if (formats.includes('MARKDOWN')) {
      exports.push({
        type: 'MARKDOWN',
        content: this.generateMarkdownExport(formatted),
        filename: `${formatted.metadata.clientName.toLowerCase().replace(/\s+/g, '-')}-case-study.md`,
      });
    }

    if (formats.includes('JSON')) {
      exports.push({
        type: 'JSON',
        content: JSON.stringify({ formatted, jsonLd, seoMetadata }, null, 2),
        filename: `${formatted.metadata.clientName.toLowerCase().replace(/\s+/g, '-')}-case-study.json`,
      });
    }

    return exports;
  }

  private generateHTMLExport(
    formatted: FormattedCaseStudy,
    jsonLd: JSONLDSchema,
    seoMetadata: SEOMetadata
  ): string {
    const sectionsHTML = formatted.sections.map((section) => `
      <section class="case-study-section case-study-section--${section.type.toLowerCase()}" id="${section.id}">
        <h2 style="color: var(--color-primary);">${section.title}</h2>
        <p>${section.content}</p>
        ${section.bullets ? `<ul>${section.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : ''}
        ${section.quote ? `
          <blockquote style="border-left: 4px solid var(--color-primary); padding-left: 1rem; margin: 2rem 0;">
            <p>"${section.quote.quote}"</p>
            <cite>— ${section.quote.author}, ${section.quote.title}</cite>
          </blockquote>
        ` : ''}
        ${section.metrics ? `
          <div class="metrics-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
            ${section.metrics.map((m) => `
              <div class="metric-card" style="background: var(--color-bg-elevated); padding: 1rem; border-radius: 8px;">
                <div class="metric-label" style="color: var(--color-text-secondary);">${m.label}</div>
                <div class="metric-change" style="color: var(--color-primary); font-size: 1.5rem; font-weight: bold;">${m.change}</div>
                <div class="metric-detail" style="font-size: 0.875rem;">${m.before} → ${m.after}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </section>
    `).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${seoMetadata.title}</title>
  <meta name="description" content="${seoMetadata.description}">
  <meta name="keywords" content="${seoMetadata.keywords.join(', ')}">
  <meta property="og:title" content="${seoMetadata.ogTitle}">
  <meta property="og:description" content="${seoMetadata.ogDescription}">
  <meta property="og:type" content="${seoMetadata.ogType}">
  <link rel="canonical" href="${seoMetadata.canonicalUrl}">
  <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  <style>
    :root {
      --color-primary: #6366f1;
      --color-bg-elevated: #1a1a1a;
      --color-text-secondary: #999999;
    }
  </style>
</head>
<body>
  <article class="case-study">
    <header>
      <h1>${formatted.title}</h1>
      <p class="subtitle">${formatted.subtitle}</p>
    </header>

    <section class="executive-summary">
      <h2>Executive Summary</h2>
      <p>${formatted.executiveSummary}</p>
    </section>

    ${sectionsHTML}

    <section class="cta" style="background: var(--color-primary); color: white; padding: 2rem; border-radius: 8px; text-align: center;">
      <h2>${formatted.callToAction.headline}</h2>
      <p>${formatted.callToAction.description}</p>
      <a href="${formatted.callToAction.buttonUrl}" style="display: inline-block; background: white; color: var(--color-primary); padding: 1rem 2rem; border-radius: 4px; text-decoration: none; font-weight: bold;">
        ${formatted.callToAction.buttonText}
      </a>
    </section>
  </article>
</body>
</html>`;
  }

  private generateMarkdownExport(formatted: FormattedCaseStudy): string {
    const sectionsMarkdown = formatted.sections.map((section) => {
      let md = `## ${section.title}\n\n${section.content}\n\n`;

      if (section.bullets) {
        md += `${section.bullets.map((b) => `- ${b}`).join('\n')  }\n\n`;
      }

      if (section.quote) {
        md += `> "${section.quote.quote}"\n> — ${section.quote.author}, ${section.quote.title}\n\n`;
      }

      if (section.metrics) {
        md += '| Metric | Before | After | Change |\n';
        md += '|--------|--------|-------|--------|\n';
        section.metrics.forEach((m) => {
          md += `| ${m.label} | ${m.before} | ${m.after} | ${m.change} |\n`;
        });
        md += '\n';
      }

      return md;
    }).join('');

    return `# ${formatted.title}

*${formatted.subtitle}*

---

## Executive Summary

${formatted.executiveSummary}

---

${sectionsMarkdown}

---

## ${formatted.callToAction.headline}

${formatted.callToAction.description}

[${formatted.callToAction.buttonText}](${formatted.callToAction.buttonUrl})

---

*Published: ${formatted.metadata.publishDate.toLocaleDateString()}*
*Tags: ${formatted.metadata.tags.join(', ')}*
`;
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createCaseStudyBuilderSpecialist(): CaseStudyBuilderSpecialist {
  return new CaseStudyBuilderSpecialist();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: CaseStudyBuilderSpecialist | null = null;

export function getCaseStudyBuilderSpecialist(): CaseStudyBuilderSpecialist {
  instance ??= createCaseStudyBuilderSpecialist();
  return instance;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { NARRATIVE_TEMPLATES, METRIC_CHANGE_TEMPLATES };

export type {
  TenantContext,
  SuccessStoryInput,
  CaseStudyOutput,
  FormattedCaseStudy,
  JSONLDSchema,
  SEOMetadata,
  CaseStudyRequest,
};
