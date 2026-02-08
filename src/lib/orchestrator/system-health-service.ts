/**
 * System Health Service - Configuration Audit & Health Check
 *
 * Scans an organization's configuration state to identify:
 * - Configured vs unconfigured features
 * - Integration connection status
 * - Golden Master deployment status
 * - Overall "Platform Readiness" score
 *
 * Used by the Implementation Guide (Client AI) to proactively
 * guide clients through setup.
 *
 * @module system-health-service
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { SPECIALISTS, type SpecialistPlatform } from './feature-manifest';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// TYPES
// ============================================================================

export type FeatureStatus = 'configured' | 'partial' | 'unconfigured' | 'hidden';

export interface FeatureHealthCheck {
  featureId: string;
  featureName: string;
  icon: string;
  status: FeatureStatus;
  category: 'integration' | 'tool' | 'specialist' | 'data' | 'training';
  description: string;
  configuredAt?: Date;
  missingRequirements?: string[];
  recommendedAction?: string;
}

export interface IntegrationStatus {
  id: string;
  name: string;
  connected: boolean;
  connectedAt?: Date;
  lastSyncAt?: Date;
  error?: string;
}

export interface SystemHealthReport {
  generatedAt: Date;

  // Overall Score (0-100)
  readinessScore: number;
  readinessLevel: 'not-started' | 'getting-started' | 'in-progress' | 'almost-ready' | 'platform-ready';

  // Feature Status Breakdown
  features: FeatureHealthCheck[];

  // Integration Connections
  integrations: IntegrationStatus[];

  // Golden Master Status
  goldenMaster: {
    hasBaseModel: boolean;
    hasGoldenMaster: boolean;
    activeVersion?: string;
    lastTrainedAt?: Date;
    trainingScore?: number;
  };

  // Data Completeness
  data: {
    hasProducts: boolean;
    productCount: number;
    hasLeads: boolean;
    leadCount: number;
    hasContacts: boolean;
    contactCount: number;
    hasBrandDNA: boolean;
    hasKnowledgeBase: boolean;
  };

  // Proactive Recommendations
  recommendations: SystemRecommendation[];

  // Quick Stats
  stats: {
    configuredFeatures: number;
    totalFeatures: number;
    connectedIntegrations: number;
    totalIntegrations: number;
    hiddenFeatures: number;
  };
}

export interface SystemRecommendation {
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  action: string;
  impact: string;
}

// ============================================================================
// FEATURE DEFINITIONS
// ============================================================================

/**
 * All trackable features in the platform
 */
export const PLATFORM_FEATURES = {
  // Core Integrations
  EMAIL_SMTP: {
    id: 'email_smtp',
    name: 'Email/SMTP',
    icon: '📧',
    category: 'integration' as const,
    description: 'Send emails and newsletters',
    checkPath: 'integrations.email',
  },
  CRM_SYNC: {
    id: 'crm_sync',
    name: 'CRM Integration',
    icon: '🔄',
    category: 'integration' as const,
    description: 'Sync with external CRM systems',
    checkPath: 'integrations.crm',
  },
  CALENDAR: {
    id: 'calendar',
    name: 'Calendar Integration',
    icon: '📅',
    category: 'integration' as const,
    description: 'Schedule meetings and appointments',
    checkPath: 'integrations.calendar',
  },
  PAYMENTS: {
    id: 'payments',
    name: 'Payment Gateway',
    icon: '💳',
    category: 'integration' as const,
    description: 'Accept payments (Stripe, PayPal, Square)',
    checkPath: 'integrations.payments',
  },
  SOCIAL_ACCOUNTS: {
    id: 'social_accounts',
    name: 'Social Media Accounts',
    icon: '📱',
    category: 'integration' as const,
    description: 'Connected social platforms',
    checkPath: 'integrations.social',
  },

  // Tools
  LEAD_SCORING: {
    id: 'lead_scoring',
    name: 'Lead Scoring',
    icon: '⭐',
    category: 'tool' as const,
    description: 'Automatic lead qualification',
    checkPath: 'tools.leadScoring',
  },
  WORKFLOWS: {
    id: 'workflows',
    name: 'Automation Workflows',
    icon: '⚡',
    category: 'tool' as const,
    description: 'Automated task sequences',
    checkPath: 'tools.workflows',
  },
  EMAIL_SEQUENCES: {
    id: 'email_sequences',
    name: 'Email Sequences',
    icon: '📮',
    category: 'tool' as const,
    description: 'Automated email campaigns',
    checkPath: 'tools.emailSequences',
  },
  WEBSITE_BUILDER: {
    id: 'website_builder',
    name: 'Website Builder',
    icon: '🌐',
    category: 'tool' as const,
    description: 'Landing pages and website',
    checkPath: 'tools.websiteBuilder',
  },
  ECOMMERCE: {
    id: 'ecommerce',
    name: 'E-Commerce',
    icon: '🛒',
    category: 'tool' as const,
    description: 'Product catalog and orders',
    checkPath: 'tools.ecommerce',
  },

  // Data
  PRODUCT_CATALOG: {
    id: 'product_catalog',
    name: 'Product Catalog',
    icon: '📦',
    category: 'data' as const,
    description: 'Products, pricing, inventory',
    checkPath: 'data.products',
  },
  LEAD_DATABASE: {
    id: 'lead_database',
    name: 'Lead Database',
    icon: '🎯',
    category: 'data' as const,
    description: 'Leads and prospects',
    checkPath: 'data.leads',
  },
  KNOWLEDGE_BASE: {
    id: 'knowledge_base',
    name: 'Knowledge Base',
    icon: '📚',
    category: 'data' as const,
    description: 'Training documents and FAQs',
    checkPath: 'data.knowledgeBase',
  },
  BRAND_DNA: {
    id: 'brand_dna',
    name: 'Brand DNA',
    icon: '🧬',
    category: 'data' as const,
    description: 'Brand voice and identity',
    checkPath: 'data.brandDNA',
  },

  // Training
  AI_TRAINING: {
    id: 'ai_training',
    name: 'AI Training',
    icon: '🤖',
    category: 'training' as const,
    description: 'Conversation examples and feedback',
    checkPath: 'training.conversations',
  },
  GOLDEN_MASTER: {
    id: 'golden_master',
    name: 'Golden Master',
    icon: '👑',
    category: 'training' as const,
    description: 'Production-ready AI snapshot',
    checkPath: 'training.goldenMaster',
  },
};

// ============================================================================
// SYSTEM HEALTH SERVICE
// ============================================================================

export class SystemHealthService {

  /**
   * Generate a comprehensive health report for an organization
   */
  static async generateHealthReport(): Promise<SystemHealthReport> {
    // Fetch all required data in parallel
    const [
      organization,
      integrations,
      baseModel,
      goldenMasters,
      productCount,
      leadCount,
      contactCount,
      featureSettings,
    ] = await Promise.all([
      this.getOrganization(),
      this.getIntegrations(),
      this.getBaseModel(),
      this.getGoldenMasters(),
      this.getRecordCount('products'),
      this.getRecordCount('leads'),
      this.getRecordCount('contacts'),
      this.getFeatureSettings(),
    ]);

    // Build feature health checks
    const features = this.buildFeatureChecks(
      organization,
      integrations,
      baseModel,
      goldenMasters,
      { productCount, leadCount, contactCount },
      featureSettings
    );

    // Calculate readiness score
    const { score, level } = this.calculateReadinessScore(features);

    // Generate recommendations
    const recommendations = this.generateRecommendations(features, score);

    // Get active Golden Master (with proper type casting)
    const activeGM = goldenMasters.find(gm => gm.status === 'active') as {
      version?: string;
      deployedAt?: { toDate?: () => Date };
      avgScore?: number;
    } | undefined;

    // Build stats
    const configuredFeatures = features.filter(f => f.status === 'configured').length;
    const hiddenFeatures = features.filter(f => f.status === 'hidden').length;
    const connectedIntegrations = integrations.filter(i => i.connected).length;

    return {
      generatedAt: new Date(),
      readinessScore: score,
      readinessLevel: level,
      features,
      integrations,
      goldenMaster: {
        hasBaseModel: !!baseModel,
        hasGoldenMaster: goldenMasters.length > 0,
        activeVersion: activeGM?.version,
        lastTrainedAt: activeGM?.deployedAt?.toDate?.(),
        trainingScore: activeGM?.avgScore,
      },
      data: {
        hasProducts: productCount > 0,
        productCount,
        hasLeads: leadCount > 0,
        leadCount,
        hasContacts: contactCount > 0,
        contactCount,
        hasBrandDNA: !!organization?.brandDNA,
        hasKnowledgeBase: !!(baseModel?.knowledgeBase as { documents?: unknown[] } | undefined)?.documents?.length,
      },
      recommendations,
      stats: {
        configuredFeatures,
        totalFeatures: features.length - hiddenFeatures,
        connectedIntegrations,
        totalIntegrations: integrations.length,
        hiddenFeatures,
      },
    };
  }

  /**
   * Get a quick status check (lighter than full report)
   */
  static async getQuickStatus(): Promise<{
    readinessScore: number;
    readinessLevel: string;
    unconfiguredCount: number;
    topRecommendation?: string;
  }> {
    const report = await this.generateHealthReport();
    return {
      readinessScore: report.readinessScore,
      readinessLevel: report.readinessLevel,
      unconfiguredCount: report.features.filter(f => f.status === 'unconfigured').length,
      topRecommendation: report.recommendations[0]?.title,
    };
  }

  /**
   * Get specialist connection status
   */
  static async getSpecialistStatus(): Promise<Array<{
    specialist: typeof SPECIALISTS[number];
    connected: boolean;
    available: boolean;
  }>> {
    const integrations = await this.getIntegrations();

    return SPECIALISTS.map(specialist => {
      // Map specialist to integration
      const integrationId = this.mapSpecialistToIntegration(specialist.id);
      const integration = integrations.find(i => i.id === integrationId);

      return {
        specialist,
        connected: integration?.connected ?? false,
        available: !specialist.requiresConnection || (integration?.connected ?? false),
      };
    });
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private static async getOrganization() {
    try {
      return await FirestoreService.get<Record<string, unknown>>('organizations', PLATFORM_ID);
    } catch {
      return null;
    }
  }

  private static async getIntegrations(): Promise<IntegrationStatus[]> {
    // Define all possible integrations
    const integrationTypes = [
      { id: 'email', name: 'Email/SMTP' },
      { id: 'calendar', name: 'Google Calendar' },
      { id: 'stripe', name: 'Stripe Payments' },
      { id: 'paypal', name: 'PayPal' },
      { id: 'youtube', name: 'YouTube' },
      { id: 'instagram', name: 'Instagram' },
      { id: 'facebook', name: 'Facebook' },
      { id: 'linkedin', name: 'LinkedIn' },
      { id: 'twitter', name: 'X/Twitter' },
      { id: 'tiktok', name: 'TikTok' },
      { id: 'pinterest', name: 'Pinterest' },
    ];

    try {
      const integrationDocs = await FirestoreService.getAll<Record<string, unknown>>(
        `organizations/$rapid-compliance-root/integrations`,
        []
      );

      return integrationTypes.map(type => {
        const doc = integrationDocs.find(d => d.type === type.id || d.id === type.id);
        return {
          id: type.id,
          name: type.name,
          connected: !!doc?.connected || !!doc?.isActive,
          connectedAt: doc?.connectedAt ? new Date(doc.connectedAt as string) : undefined,
          lastSyncAt: doc?.lastSyncAt ? new Date(doc.lastSyncAt as string) : undefined,
        };
      });
    } catch {
      return integrationTypes.map(type => ({
        id: type.id,
        name: type.name,
        connected: false,
      }));
    }
  }

  private static async getBaseModel() {
    try {
      const models = await FirestoreService.getAll<Record<string, unknown>>(
        `organizations/$rapid-compliance-root/baseModels`,
        []
      );
      return models[0] ?? null;
    } catch {
      return null;
    }
  }

  private static async getGoldenMasters() {
    try {
      return await FirestoreService.getAll<Record<string, unknown>>(
        `organizations/$rapid-compliance-root/goldenMasters`,
        []
      );
    } catch {
      return [];
    }
  }

  private static async getRecordCount(collection: string): Promise<number> {
    try {
      const records = await FirestoreService.getAll<Record<string, unknown>>(
        `organizations/$rapid-compliance-root/${collection}`,
        []
      );
      return records.length;
    } catch {
      return 0;
    }
  }

  private static async getFeatureSettings(): Promise<Record<string, FeatureStatus>> {
    try {
      const settings = await FirestoreService.get<Record<string, unknown>>(
        `organizations/$rapid-compliance-root/settings`,
        'featureVisibility'
      );
      return (settings?.visibility as Record<string, FeatureStatus>) ?? {};
    } catch {
      return {};
    }
  }

  private static buildFeatureChecks(
    organization: Record<string, unknown> | null,
    integrations: IntegrationStatus[],
    baseModel: Record<string, unknown> | null,
    goldenMasters: Record<string, unknown>[],
    counts: { productCount: number; leadCount: number; contactCount: number },
    featureSettings: Record<string, FeatureStatus>
  ): FeatureHealthCheck[] {
    const checks: FeatureHealthCheck[] = [];

    // Check integrations
    for (const feature of Object.values(PLATFORM_FEATURES)) {
      if (feature.category === 'integration') {
        const integration = integrations.find(i =>
          feature.id.includes(i.id) || i.id.includes(feature.id.split('_')[0])
        );

        // Check if hidden
        const isHidden = featureSettings[feature.id] === 'hidden';

        checks.push({
          featureId: feature.id,
          featureName: feature.name,
          icon: feature.icon,
          status: isHidden ? 'hidden' : (integration?.connected ? 'configured' : 'unconfigured'),
          category: feature.category,
          description: feature.description,
          configuredAt: integration?.connectedAt,
          missingRequirements: integration?.connected ? undefined : ['Connection required'],
          recommendedAction: integration?.connected ? undefined : `Connect your ${feature.name}`,
        });
      }
    }

    // Check data
    checks.push({
      featureId: 'product_catalog',
      featureName: 'Product Catalog',
      icon: '📦',
      status: featureSettings.product_catalog === 'hidden' ? 'hidden' :
              (counts.productCount > 0 ? 'configured' : 'unconfigured'),
      category: 'data',
      description: 'Products, pricing, inventory',
      missingRequirements: counts.productCount > 0 ? undefined : ['Add at least one product'],
      recommendedAction: counts.productCount > 0 ? undefined : 'Upload your product catalog',
    });

    checks.push({
      featureId: 'lead_database',
      featureName: 'Lead Database',
      icon: '🎯',
      status: featureSettings.lead_database === 'hidden' ? 'hidden' :
              (counts.leadCount > 0 ? 'configured' : 'unconfigured'),
      category: 'data',
      description: 'Leads and prospects',
      missingRequirements: counts.leadCount > 0 ? undefined : ['Import or add leads'],
      recommendedAction: counts.leadCount > 0 ? undefined : 'Import your lead list',
    });

    checks.push({
      featureId: 'brand_dna',
      featureName: 'Brand DNA',
      icon: '🧬',
      status: featureSettings.brand_dna === 'hidden' ? 'hidden' :
              (organization?.brandDNA ? 'configured' : 'unconfigured'),
      category: 'data',
      description: 'Brand voice and identity',
      missingRequirements: organization?.brandDNA ? undefined : ['Complete brand profile'],
      recommendedAction: organization?.brandDNA ? undefined : 'Define your brand voice',
    });

    // Check training
    checks.push({
      featureId: 'ai_training',
      featureName: 'AI Training',
      icon: '🤖',
      status: featureSettings.ai_training === 'hidden' ? 'hidden' :
              (baseModel ? 'configured' : 'unconfigured'),
      category: 'training',
      description: 'Base model configuration',
      missingRequirements: baseModel ? undefined : ['Create base model'],
      recommendedAction: baseModel ? undefined : 'Start AI training',
    });

    checks.push({
      featureId: 'golden_master',
      featureName: 'Golden Master',
      icon: '👑',
      status: featureSettings.golden_master === 'hidden' ? 'hidden' :
              (goldenMasters.length > 0 ? 'configured' : 'unconfigured'),
      category: 'training',
      description: 'Production-ready AI snapshot',
      missingRequirements: goldenMasters.length > 0 ? undefined : ['Deploy Golden Master'],
      recommendedAction: goldenMasters.length > 0 ? undefined : 'Save your first Golden Master',
    });

    return checks;
  }

  private static calculateReadinessScore(features: FeatureHealthCheck[]): {
    score: number;
    level: 'not-started' | 'getting-started' | 'in-progress' | 'almost-ready' | 'platform-ready';
  } {
    const activeFeatures = features.filter(f => f.status !== 'hidden');
    const configured = activeFeatures.filter(f => f.status === 'configured').length;
    const total = activeFeatures.length;

    if (total === 0) {
      return { score: 0, level: 'not-started' };
    }

    const score = Math.round((configured / total) * 100);

    let level: 'not-started' | 'getting-started' | 'in-progress' | 'almost-ready' | 'platform-ready';
    if (score === 0) {
      level = 'not-started';
    } else if (score < 25) {
      level = 'getting-started';
    } else if (score < 50) {
      level = 'in-progress';
    } else if (score < 80) {
      level = 'almost-ready';
    } else {
      level = 'platform-ready';
    }

    return { score, level };
  }

  private static generateRecommendations(
    features: FeatureHealthCheck[],
    _score: number
  ): SystemRecommendation[] {
    const recommendations: SystemRecommendation[] = [];

    // Find unconfigured features and prioritize
    const unconfigured = features.filter(f => f.status === 'unconfigured');

    // Prioritize critical path: Brand DNA -> Training -> Golden Master
    const criticalPath = ['brand_dna', 'ai_training', 'golden_master'];

    for (const featureId of criticalPath) {
      const feature = unconfigured.find(f => f.featureId === featureId);
      if (feature) {
        recommendations.push({
          priority: featureId === 'golden_master' ? 'critical' : 'high',
          category: feature.category,
          title: feature.recommendedAction ?? `Configure ${feature.featureName}`,
          description: feature.description,
          action: `setup_${feature.featureId}`,
          impact: featureId === 'golden_master'
            ? 'Required for production deployment'
            : 'Improves AI performance',
        });
      }
    }

    // Add integration recommendations
    const integrationFeatures = unconfigured.filter(f => f.category === 'integration');
    for (const feature of integrationFeatures.slice(0, 2)) {
      recommendations.push({
        priority: 'medium',
        category: 'integration',
        title: feature.recommendedAction ?? `Connect ${feature.featureName}`,
        description: feature.description,
        action: `connect_${feature.featureId}`,
        impact: 'Enables specialist deployment',
      });
    }

    // Add data recommendations
    const dataFeatures = unconfigured.filter(f => f.category === 'data' && !criticalPath.includes(f.featureId));
    for (const feature of dataFeatures.slice(0, 1)) {
      recommendations.push({
        priority: 'low',
        category: 'data',
        title: feature.recommendedAction ?? `Add ${feature.featureName}`,
        description: feature.description,
        action: `import_${feature.featureId}`,
        impact: 'Improves AI knowledge',
      });
    }

    return recommendations.slice(0, 5); // Max 5 recommendations
  }

  private static mapSpecialistToIntegration(specialistId: SpecialistPlatform): string {
    const mapping: Record<string, string> = {
      youtube: 'youtube',
      tiktok: 'tiktok',
      instagram: 'instagram',
      x_twitter: 'twitter',
      truth_social: 'truth',
      linkedin: 'linkedin',
      pinterest: 'pinterest',
      meta_facebook: 'facebook',
      newsletter: 'email',
      web_migrator: 'none',
      lead_hunter: 'none',
    };
    return mapping[specialistId] || 'none';
  }
}

export default SystemHealthService;
