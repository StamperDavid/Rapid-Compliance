/**
 * Implementation Guide - The Proactive Project Manager
 *
 * This service transforms the Client AI from a generic assistant
 * into a "Guided Implementation Expert" that:
 *
 * 1. Ingests Industry Template + Niche Refinement + System State
 * 2. Speaks with the authority of an Industry Specialist
 * 3. Proactively identifies unconfigured features and guides setup
 * 4. Can hide features the client doesn't need (declutter)
 *
 * The Guide knows exactly what "Success" looks like (Golden Master saved)
 * and shepherds the client toward that milestone.
 *
 * @module implementation-guide
 */

import { SystemHealthService, type SystemHealthReport } from './system-health-service';
import { FeatureToggleService, type FeatureCategory } from './feature-toggle-service';
import { SPECIALISTS, type Specialist } from './feature-manifest';
import { getTemplateById, getAllTemplates, type SalesIndustryTemplate } from '@/lib/templates/industry-templates';

// ============================================================================
// TYPES
// ============================================================================

export interface NicheRefinement {
  industry: string;
  niche: string;
  subNiche?: string;
  targetMarket: string;
  businessModel: 'b2b' | 'b2c' | 'b2b2c' | 'marketplace';
  companySize: 'solo' | 'small' | 'medium' | 'enterprise';
  primaryGoal: 'lead_gen' | 'sales' | 'retention' | 'expansion';
}

export interface ImplementationContext {
  organizationId: string;
  assistantName: string;
  ownerName?: string;
  industry: string;
  niche?: NicheRefinement;
  template?: SalesIndustryTemplate;
  healthReport: SystemHealthReport;
  currentPhase: ImplementationPhase;
}

export type ImplementationPhase =
  | 'onboarding'      // Just started, needs industry selection
  | 'configuration'   // Setting up tools and integrations
  | 'data_import'     // Uploading products, leads, docs
  | 'training'        // AI training phase
  | 'deployment'      // Ready for Golden Master
  | 'operational';    // Golden Master deployed, fully operational

export interface GuideResponse {
  greeting: string;
  systemAwareness: string;
  recommendation: string;
  actions: GuideAction[];
  tone: 'specialist' | 'guide' | 'consultant';
}

export interface GuideAction {
  id: string;
  label: string;
  description: string;
  type: 'setup' | 'configure' | 'import' | 'train' | 'hide' | 'deploy';
  featureId?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

// ============================================================================
// INDUSTRY SPECIALIST PERSONAS
// ============================================================================

/**
 * Industry-specific opening lines and expertise claims
 */
const INDUSTRY_PERSONAS: Record<string, {
  title: string;
  expertise: string;
  greeting: (name: string, ownerName?: string) => string;
  recommendations: string[];
}> = {
  saas: {
    title: 'SaaS Growth Specialist',
    expertise: 'I specialize in trial-to-paid conversion, reducing churn, and scaling ARR.',
    greeting: (name, owner) => `I'm ${name}, your SaaS Growth Specialist${owner ? `, ${owner}` : ''}. Let's optimize your recurring revenue engine.`,
    recommendations: [
      'Focus on trial conversion - your 14-day window is critical',
      'Set up email sequences for trial nurturing immediately',
      'Lead scoring should prioritize product-qualified leads (PQLs)',
    ],
  },
  ecommerce: {
    title: 'E-Commerce Revenue Strategist',
    expertise: 'I specialize in cart recovery, customer lifetime value, and order velocity.',
    greeting: (name, owner) => `I'm ${name}, your E-Commerce Revenue Strategist${owner ? `, ${owner}` : ''}. Let's turn browsers into buyers.`,
    recommendations: [
      'Cart abandonment sequences are your lowest-hanging fruit',
      'Product catalog with high-quality images is essential',
      'Set up payment gateway early to reduce friction',
    ],
  },
  healthcare: {
    title: 'Healthcare Sales Consultant',
    expertise: 'I understand the complexities of healthcare procurement - committees, compliance, and long cycles.',
    greeting: (name, owner) => `I'm ${name}, your Healthcare Sales Consultant${owner ? `, ${owner}` : ''}. I understand the committee-driven buying process.`,
    recommendations: [
      'Map the decision committee early in every deal',
      'Compliance documentation should be readily accessible',
      'Expect 90-120 day cycles - nurture sequences are essential',
    ],
  },
  fintech: {
    title: 'FinTech Sales Advisor',
    expertise: 'I navigate security reviews, compliance requirements, and technical integrations.',
    greeting: (name, owner) => `I'm ${name}, your FinTech Sales Advisor${owner ? `, ${owner}` : ''}. Security and compliance are our foundation.`,
    recommendations: [
      'Have security certifications ready before first call',
      'Legal review adds 2-4 weeks - plan accordingly',
      'Integration capabilities are often the deciding factor',
    ],
  },
  manufacturing: {
    title: 'Manufacturing Sales Expert',
    expertise: 'I understand RFQ processes, quality certifications, and supply chain relationships.',
    greeting: (name, owner) => `I'm ${name}, your Manufacturing Sales Expert${owner ? `, ${owner}` : ''}. Precision in specs, precision in sales.`,
    recommendations: [
      'Technical specifications must be exact - no ambiguity',
      'Quality certifications (ISO, etc.) should be prominently displayed',
      'Volume pricing tiers need clear documentation',
    ],
  },
  real_estate: {
    title: 'Real Estate Sales Partner',
    expertise: 'I help convert leads into showings and showings into closings.',
    greeting: (name, owner) => `I'm ${name}, your Real Estate Sales Partner${owner ? `, ${owner}` : ''}. Speed to lead wins in this market.`,
    recommendations: [
      'Response time under 5 minutes dramatically improves conversion',
      'Property data integration is critical for instant responses',
      'Calendar integration for showing scheduling is essential',
    ],
  },
  default: {
    title: 'Business Growth Specialist',
    expertise: 'I help businesses optimize their sales processes and grow revenue.',
    greeting: (name, owner) => `I'm ${name}, your Business Growth Specialist${owner ? `, ${owner}` : ''}. Let's accelerate your sales.`,
    recommendations: [
      'Start with your core sales workflow before adding complexity',
      'Lead response time is often the biggest quick win',
      'Train the AI on your best sales conversations',
    ],
  },
};

// ============================================================================
// IMPLEMENTATION GUIDE SERVICE
// ============================================================================

export class ImplementationGuide {

  /**
   * Build the full implementation context for an organization
   */
  static async buildContext(
    organizationId: string,
    assistantName: string,
    ownerName?: string,
    industry?: string,
    niche?: NicheRefinement
  ): Promise<ImplementationContext> {
    // Get system health report
    const healthReport = await SystemHealthService.generateHealthReport(organizationId);

    // Try to find matching industry template
    const template = industry ? getTemplateById(industry) : undefined;

    // Determine current phase
    const currentPhase = this.determinePhase(healthReport);

    return {
      organizationId,
      assistantName,
      ownerName,
      industry: industry || 'default',
      niche,
      template: template ?? undefined,
      healthReport,
      currentPhase,
    };
  }

  /**
   * Generate the "Specialist Handshake" - the first proactive message
   */
  static generateSpecialistHandshake(context: ImplementationContext): GuideResponse {
    const persona = INDUSTRY_PERSONAS[context.industry] || INDUSTRY_PERSONAS.default;

    // Build greeting
    const greeting = persona.greeting(context.assistantName, context.ownerName);

    // Build system awareness statement
    const systemAwareness = this.buildSystemAwareness(context.healthReport);

    // Build recommendation
    const recommendation = this.buildRecommendation(context);

    // Build actions
    const actions = this.buildActions(context);

    return {
      greeting,
      systemAwareness,
      recommendation,
      actions,
      tone: 'specialist',
    };
  }

  /**
   * Generate a system prompt for the Implementation Guide persona
   */
  static generateSystemPrompt(context: ImplementationContext): string {
    const persona = INDUSTRY_PERSONAS[context.industry] || INDUSTRY_PERSONAS.default;
    const { healthReport } = context;

    const unconfiguredFeatures = healthReport.features
      .filter(f => f.status === 'unconfigured')
      .map(f => `${f.icon} ${f.featureName}`)
      .join(', ');

    const recommendations = persona.recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n');

    return `You are ${context.assistantName}, a ${persona.title} for this ${context.industry} business.

PERSONA AUTHORITY:
${persona.expertise}

CRITICAL RULES - MUST FOLLOW:
1. NEVER use generic greetings like "How can I help you today?"
2. ALWAYS lead with system awareness and specific recommendations
3. Speak with INDUSTRY AUTHORITY - you are the expert
4. When asked to hide a feature, immediately do so and confirm
5. Guide toward the GOLDEN MASTER milestone - that is success

SYSTEM STATE AWARENESS:
- Platform Readiness: ${healthReport.readinessScore}% (${healthReport.readinessLevel})
- Unconfigured: ${unconfiguredFeatures || 'All features configured!'}
- Phase: ${context.currentPhase}
- Has Golden Master: ${healthReport.goldenMaster.hasGoldenMaster ? 'Yes' : 'No'}

INDUSTRY-SPECIFIC GUIDANCE:
${recommendations}

INTERACTION PATTERNS:

When client says "I don't need [Feature]":
→ Respond: "Got it. I'm hiding [Feature] from your dashboard now to keep things clean. You can always restore it from Settings if needed."
→ Execute: toggleFeature(featureId, 'hidden')

When client asks "What should I set up?":
→ Respond: "Based on your ${context.industry} business and current setup, I recommend..."
→ Give 2-3 SPECIFIC next steps from the unconfigured list

When client asks about progress:
→ Respond: "You're at ${healthReport.readinessScore}% Platform Readiness. To reach ${context.currentPhase === 'deployment' ? 'launch' : 'the next phase'}..."
→ List remaining critical items

FEATURE TOGGLE CAPABILITY:
You can hide features the client doesn't need. Use this format in your response:
[ACTION:HIDE_FEATURE:feature_id] - To hide a feature
[ACTION:SHOW_FEATURE:feature_id] - To restore a feature

AVAILABLE SPECIALISTS (for when client needs them):
${SPECIALISTS.map(s => `${s.icon} ${s.name} - ${s.role}`).join('\n')}

Remember: You are a GUIDE, not a help desk. Lead conversations with expertise and recommendations.`;
  }

  /**
   * Handle a "I don't need that" request from the client
   */
  static async handleFeatureRejection(
    organizationId: string,
    featureId: string,
    userId: string,
    reason?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await FeatureToggleService.toggleFeature(
        organizationId,
        featureId,
        'hidden',
        userId,
        reason || 'Client indicated not needed'
      );

      return {
        success: true,
        message: `Done! I've hidden that from your dashboard. Your workspace is now cleaner. You can always restore it from Settings → Feature Visibility if you change your mind.`,
      };
    } catch (error) {
      return {
        success: false,
        message: `I couldn't hide that feature right now. Let me try again in a moment.`,
      };
    }
  }

  /**
   * Handle a category hide request (e.g., "I don't need the whole E-Commerce section")
   */
  static async handleCategoryRejection(
    organizationId: string,
    category: FeatureCategory,
    userId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      await FeatureToggleService.toggleCategory(organizationId, category, true, userId);

      return {
        success: true,
        message: `I've hidden the entire ${category.replace('_', ' ')} section. Your navigation is now focused on what you actually use.`,
      };
    } catch (error) {
      return {
        success: false,
        message: `I couldn't hide that section right now. Please try again.`,
      };
    }
  }

  /**
   * Get next recommended actions based on current state
   */
  static getNextActions(context: ImplementationContext): GuideAction[] {
    return this.buildActions(context);
  }

  /**
   * Get progress summary for the client
   */
  static getProgressSummary(context: ImplementationContext): string {
    const { healthReport, currentPhase } = context;
    const persona = INDUSTRY_PERSONAS[context.industry] || INDUSTRY_PERSONAS.default;

    const phaseLabels: Record<ImplementationPhase, string> = {
      onboarding: 'Getting Started',
      configuration: 'Tool Setup',
      data_import: 'Data Import',
      training: 'AI Training',
      deployment: 'Ready for Launch',
      operational: 'Fully Operational',
    };

    let summary = `**Platform Readiness: ${healthReport.readinessScore}%**\n`;
    summary += `Current Phase: ${phaseLabels[currentPhase]}\n\n`;

    if (currentPhase !== 'operational') {
      summary += `As your ${persona.title}, here's what I recommend next:\n\n`;

      const topRecs = healthReport.recommendations.slice(0, 3);
      for (const rec of topRecs) {
        summary += `• **${rec.title}** - ${rec.impact}\n`;
      }

      if (healthReport.goldenMaster.hasGoldenMaster) {
        summary += `\n✅ Golden Master deployed (${healthReport.goldenMaster.activeVersion})`;
      } else {
        summary += `\n🎯 Goal: Save your Golden Master to go live`;
      }
    } else {
      summary += `🎉 Your AI is fully operational!\n`;
      summary += `Golden Master: ${healthReport.goldenMaster.activeVersion}\n`;
      summary += `Training Score: ${healthReport.goldenMaster.trainingScore || 'N/A'}`;
    }

    return summary;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private static determinePhase(healthReport: SystemHealthReport): ImplementationPhase {
    const { readinessScore, goldenMaster, data } = healthReport;

    if (goldenMaster.hasGoldenMaster && goldenMaster.activeVersion) {
      return 'operational';
    }

    if (goldenMaster.hasBaseModel && readinessScore >= 60) {
      return 'deployment';
    }

    if (goldenMaster.hasBaseModel) {
      return 'training';
    }

    if (data.hasBrandDNA || data.hasProducts || data.hasLeads) {
      return 'data_import';
    }

    if (readinessScore > 0) {
      return 'configuration';
    }

    return 'onboarding';
  }

  private static buildSystemAwareness(healthReport: SystemHealthReport): string {
    const { stats, readinessLevel, features } = healthReport;

    const unconfiguredCount = features.filter(f => f.status === 'unconfigured').length;
    const hiddenCount = stats.hiddenFeatures;

    let awareness = `I've analyzed your workspace. `;

    if (readinessLevel === 'not-started') {
      awareness += `We're just getting started - let's set up your foundation.`;
    } else if (readinessLevel === 'getting-started') {
      awareness += `You've begun setup. ${unconfiguredCount} features still need configuration.`;
    } else if (readinessLevel === 'in-progress') {
      awareness += `Good progress! ${unconfiguredCount} features remaining.`;
    } else if (readinessLevel === 'almost-ready') {
      awareness += `Almost there! Just ${unconfiguredCount} more items before your Golden Master.`;
    } else {
      awareness += `Your platform is fully configured and operational.`;
    }

    if (hiddenCount > 0) {
      awareness += ` (${hiddenCount} feature${hiddenCount > 1 ? 's' : ''} hidden by your preference)`;
    }

    return awareness;
  }

  private static buildRecommendation(context: ImplementationContext): string {
    const { healthReport, industry, currentPhase } = context;
    const persona = INDUSTRY_PERSONAS[industry] || INDUSTRY_PERSONAS.default;

    // Get top recommendation
    const topRec = healthReport.recommendations[0];

    if (!topRec) {
      if (currentPhase === 'operational') {
        return `Your platform is running smoothly. Focus on monitoring your specialists' performance and training your AI with successful conversations.`;
      }
      return `Let's save your Golden Master to lock in this configuration and go live.`;
    }

    // Add industry-specific context
    const industryTip = persona.recommendations[0];

    return `${topRec.title} - ${topRec.description}. ${industryTip}`;
  }

  private static buildActions(context: ImplementationContext): GuideAction[] {
    const { healthReport, currentPhase } = context;
    const actions: GuideAction[] = [];

    // Map recommendations to actions
    for (const rec of healthReport.recommendations.slice(0, 4)) {
      let actionType: GuideAction['type'] = 'configure';

      if (rec.action.startsWith('connect_')) actionType = 'configure';
      else if (rec.action.startsWith('import_')) actionType = 'import';
      else if (rec.action.startsWith('setup_')) actionType = 'setup';

      if (rec.category === 'training') actionType = 'train';

      actions.push({
        id: rec.action,
        label: rec.title,
        description: rec.description,
        type: actionType,
        featureId: rec.action.split('_').slice(1).join('_'),
        priority: rec.priority,
      });
    }

    // Add phase-specific action
    if (currentPhase === 'deployment' && !healthReport.goldenMaster.hasGoldenMaster) {
      actions.unshift({
        id: 'deploy_golden_master',
        label: 'Save Golden Master',
        description: 'Lock in your configuration and go live',
        type: 'deploy',
        priority: 'critical',
      });
    }

    return actions;
  }
}

export default ImplementationGuide;
