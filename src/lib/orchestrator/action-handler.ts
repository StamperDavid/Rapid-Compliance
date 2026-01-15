/**
 * Action Handler - AI Response Action Processor
 *
 * Parses AI responses for action markers and executes them.
 * This allows the AI to trigger real changes in the system
 * (like hiding features) through its responses.
 *
 * Action Format in AI Response:
 * [ACTION:ACTION_TYPE:parameters]
 *
 * Examples:
 * [ACTION:HIDE_FEATURE:email_sequences]
 * [ACTION:SHOW_FEATURE:email_sequences]
 * [ACTION:HIDE_CATEGORY:ecommerce]
 * [ACTION:DEPLOY_SPECIALIST:lead_hunter]
 *
 * @module action-handler
 */

import { FeatureToggleService, type FeatureCategory } from './feature-toggle-service';
import { SPECIALISTS } from './feature-manifest';

// ============================================================================
// TYPES
// ============================================================================

export type ActionType =
  | 'HIDE_FEATURE'
  | 'SHOW_FEATURE'
  | 'HIDE_CATEGORY'
  | 'SHOW_CATEGORY'
  | 'DEPLOY_SPECIALIST'
  | 'SETUP_FEATURE'
  | 'NAVIGATE_TO';

export interface ParsedAction {
  type: ActionType;
  target: string;
  params?: Record<string, string>;
}

export interface ActionResult {
  success: boolean;
  action: ParsedAction;
  message: string;
  error?: string;
}

export interface ProcessedResponse {
  cleanText: string;
  actions: ActionResult[];
  hasActions: boolean;
}

// ============================================================================
// ACTION PATTERNS
// ============================================================================

const ACTION_PATTERN = /\[ACTION:(\w+):([^\]]+)\]/g;

// Feature ID aliases for natural language matching
const FEATURE_ALIASES: Record<string, string> = {
  // Email
  'email': 'email_sequences',
  'email sequences': 'email_sequences',
  'sequences': 'email_sequences',
  'newsletter': 'email_sequences',
  'campaigns': 'email_campaigns',
  'email campaigns': 'email_campaigns',

  // CRM
  'leads': 'leads',
  'deals': 'deals',
  'contacts': 'contacts',
  'ledger': 'living_ledger',
  'living ledger': 'living_ledger',

  // Lead Gen
  'forms': 'forms',
  'lead research': 'lead_research',
  'lead scoring': 'lead_scoring',
  'scoring': 'lead_scoring',

  // Outbound
  'nurture': 'nurture',
  'calls': 'calls',
  'email writer': 'email_writer',

  // Automation
  'workflows': 'workflows',
  'ab tests': 'ab_tests',
  'a/b tests': 'ab_tests',

  // Content
  'video': 'video_studio',
  'video studio': 'video_studio',
  'social media': 'social_media',
  'social': 'social_media',
  'proposals': 'proposals',
  'battlecards': 'battlecards',

  // AI
  'agent training': 'agent_training',
  'training': 'agent_training',
  'voice ai': 'voice_ai',
  'voice': 'voice_ai',
  'social ai': 'social_ai',
  'seo ai': 'seo_ai',
  'seo': 'seo_ai',
  'datasets': 'datasets',
  'fine tuning': 'fine_tuning',
  'fine-tuning': 'fine_tuning',

  // E-commerce
  'products': 'products',
  'orders': 'orders',
  'storefront': 'storefront',
  'ecommerce': 'ecommerce',
  'e-commerce': 'ecommerce',

  // Website
  'pages': 'website_pages',
  'website pages': 'website_pages',
  'blog': 'website_blog',
  'domains': 'website_domains',
  'website seo': 'website_seo',
  'site settings': 'website_settings',

  // Analytics
  'analytics': 'analytics_overview',
  'revenue': 'revenue_analytics',
  'pipeline': 'pipeline_analytics',
};

// Category aliases
const CATEGORY_ALIASES: Record<string, FeatureCategory> = {
  'command center': 'command_center',
  'crm': 'crm',
  'lead gen': 'lead_gen',
  'lead generation': 'lead_gen',
  'outbound': 'outbound',
  'automation': 'automation',
  'content': 'content_factory',
  'content factory': 'content_factory',
  'ai': 'ai_workforce',
  'ai workforce': 'ai_workforce',
  'ecommerce': 'ecommerce',
  'e-commerce': 'ecommerce',
  'analytics': 'analytics',
  'website': 'website',
  'settings': 'settings',
};

// ============================================================================
// ACTION HANDLER
// ============================================================================

export class ActionHandler {

  /**
   * Parse AI response for action markers
   */
  static parseActions(text: string): ParsedAction[] {
    const actions: ParsedAction[] = [];
    let match;

    while ((match = ACTION_PATTERN.exec(text)) !== null) {
      const [, type, target] = match;
      actions.push({
        type: type as ActionType,
        target: target.trim(),
      });
    }

    return actions;
  }

  /**
   * Process an AI response - extract actions, execute them, return clean text
   */
  static async processResponse(
    response: string,
    organizationId: string,
    userId: string
  ): Promise<ProcessedResponse> {
    const parsedActions = this.parseActions(response);

    if (parsedActions.length === 0) {
      return {
        cleanText: response,
        actions: [],
        hasActions: false,
      };
    }

    // Execute all actions
    const results = await Promise.all(
      parsedActions.map(action =>
        this.executeAction(action, organizationId, userId)
      )
    );

    // Remove action markers from response text
    const cleanText = response.replace(ACTION_PATTERN, '').trim();

    return {
      cleanText,
      actions: results,
      hasActions: true,
    };
  }

  /**
   * Execute a single action
   */
  static async executeAction(
    action: ParsedAction,
    organizationId: string,
    userId: string
  ): Promise<ActionResult> {
    try {
      switch (action.type) {
        case 'HIDE_FEATURE': {
          const featureId = this.resolveFeatureId(action.target);
          await FeatureToggleService.toggleFeature(
            organizationId,
            featureId,
            'hidden',
            userId,
            'Hidden via AI assistant'
          );
          return {
            success: true,
            action,
            message: `Hidden ${featureId} from dashboard`,
          };
        }

        case 'SHOW_FEATURE': {
          const featureId = this.resolveFeatureId(action.target);
          await FeatureToggleService.toggleFeature(
            organizationId,
            featureId,
            'unconfigured',
            userId
          );
          return {
            success: true,
            action,
            message: `Restored ${featureId} to dashboard`,
          };
        }

        case 'HIDE_CATEGORY': {
          const category = this.resolveCategoryId(action.target);
          await FeatureToggleService.toggleCategory(
            organizationId,
            category,
            true,
            userId
          );
          return {
            success: true,
            action,
            message: `Hidden ${category} category from navigation`,
          };
        }

        case 'SHOW_CATEGORY': {
          const category = this.resolveCategoryId(action.target);
          await FeatureToggleService.toggleCategory(
            organizationId,
            category,
            false,
            userId
          );
          return {
            success: true,
            action,
            message: `Restored ${category} category to navigation`,
          };
        }

        case 'DEPLOY_SPECIALIST': {
          // Find the specialist by trigger or ID
          const specialist = SPECIALISTS.find(
            s => s.id === action.target ||
              s.name.toLowerCase().includes(action.target.toLowerCase()) ||
              s.triggerPhrases.some(t => action.target.toLowerCase().includes(t))
          );

          if (!specialist) {
            return {
              success: false,
              action,
              message: `Specialist "${action.target}" not found`,
              error: 'Unknown specialist',
            };
          }

          // In a real implementation, this would trigger the specialist
          return {
            success: true,
            action,
            message: `Deploying ${specialist.icon} ${specialist.name}`,
          };
        }

        case 'NAVIGATE_TO': {
          // Navigation is handled client-side, just return success
          return {
            success: true,
            action,
            message: `Navigate to ${action.target}`,
          };
        }

        default:
          return {
            success: false,
            action,
            message: `Unknown action type: ${action.type}`,
            error: 'Unknown action type',
          };
      }
    } catch (error) {
      return {
        success: false,
        action,
        message: `Failed to execute action`,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Detect natural language feature hide requests
   * Returns the feature ID if detected, null otherwise
   */
  static detectHideRequest(text: string): string | null {
    const lowerText = text.toLowerCase();

    // Patterns for hide requests
    const hidePatterns = [
      /i don'?t need (?:the )?(.+)/i,
      /hide (?:the )?(.+)/i,
      /remove (?:the )?(.+)/i,
      /don'?t show (?:me )?(?:the )?(.+)/i,
      /get rid of (?:the )?(.+)/i,
    ];

    for (const pattern of hidePatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        const target = match[1].trim();
        // Try to resolve to a feature ID
        const resolved = FEATURE_ALIASES[target] || CATEGORY_ALIASES[target];
        if (resolved) {
          return resolved;
        }
      }
    }

    return null;
  }

  /**
   * Detect natural language show/restore requests
   */
  static detectShowRequest(text: string): string | null {
    const lowerText = text.toLowerCase();

    const showPatterns = [
      /show (?:me )?(?:the )?(.+) (?:again|back)/i,
      /restore (?:the )?(.+)/i,
      /bring back (?:the )?(.+)/i,
      /enable (?:the )?(.+)/i,
      /i need (?:the )?(.+) (?:now|back)/i,
    ];

    for (const pattern of showPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        const target = match[1].trim();
        const resolved = FEATURE_ALIASES[target] || CATEGORY_ALIASES[target];
        if (resolved) {
          return resolved;
        }
      }
    }

    return null;
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private static resolveFeatureId(input: string): string {
    const lower = input.toLowerCase().trim();
    return FEATURE_ALIASES[lower] || input;
  }

  private static resolveCategoryId(input: string): FeatureCategory {
    const lower = input.toLowerCase().trim();
    return CATEGORY_ALIASES[lower] || input as FeatureCategory;
  }
}

export default ActionHandler;
