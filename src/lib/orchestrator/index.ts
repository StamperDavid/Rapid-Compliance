/**
 * Orchestrator Module Index
 *
 * This module provides the complete orchestration system including:
 * - Feature Manifest (11 Specialists)
 * - System Health Service (Configuration Auditing)
 * - Feature Toggle Service (UI Clutter Management)
 * - Implementation Guide (Proactive Project Manager)
 * - Action Handler (AI Response Processing)
 * - Jasper Proactive Intelligence (Admin AI)
 *
 * @module orchestrator
 */

// Feature Manifest - The 11 Specialists
export {
  SPECIALISTS,
  MERCHANT_ORCHESTRATOR_PROMPT,
  ADMIN_ORCHESTRATOR_PROMPT,
  JASPER_PROACTIVE_DIRECTIVES,
  getSpecialist,
  getSpecialistsByCategory,
  findMatchingSpecialists,
  getAllCapabilities,
  getCapabilityByAction,
  type Specialist,
  type SpecialistPlatform,
  type SpecialistCategory,
  type SpecialistCapability,
} from './feature-manifest';

// System Health Service - Configuration Auditing
export {
  SystemHealthService,
  PLATFORM_FEATURES,
  type FeatureStatus,
  type FeatureHealthCheck,
  type IntegrationStatus,
  type SystemHealthReport,
  type SystemRecommendation,
} from './system-health-service';

// Feature Toggle Service - UI Clutter Management
export {
  FeatureToggleService,
  buildNavigationStructure,
  type FeatureCategory,
  type FeatureVisibility,
  type FeatureVisibilitySettings,
  type NavSection,
  type NavItem,
} from './feature-toggle-service';

// Implementation Guide - Proactive Project Manager
export {
  ImplementationGuide,
  type NicheRefinement,
  type ImplementationContext,
  type ImplementationPhase,
  type GuideResponse,
  type GuideAction,
} from './implementation-guide';

// Action Handler - AI Response Processing
export {
  ActionHandler,
  type ActionType,
  type ParsedAction,
  type ActionResult,
  type ProcessedResponse,
} from './action-handler';

// Jasper Proactive Intelligence - Admin AI
export {
  generateLaunchContext,
  generateListDeflection,
  generateDataDrivenResponse,
  LAUNCH_CONTEXT_EXAMPLES,
  LIST_DEFLECTION_EXAMPLES,
  type PlatformState,
  type OrgSummary,
  type PlatformMetrics,
  type LaunchContextResponse,
} from './jasper-proactive-intelligence';
