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
 * - Jasper Tools (Anti-Hallucination Tool Calling)
 * - System State Service (Mandatory State Reflection)
 * - Jasper Command Authority (Phase 8 Briefing, Approval Gateway, Command Issuance)
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
  SystemHealthService as SystemHealthServiceClass,
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
  formatJasperResponse,
  isLaunchIntent,
  isListRequest,
  FORBIDDEN_PATTERNS,
  STRATEGIC_TONE_MARKERS,
  type PlatformState,
  type OrgSummary,
  type PlatformMetrics,
  type LaunchContextResponse,
} from './jasper-proactive-intelligence';

// Jasper Tools - Anti-Hallucination Tool Calling
export {
  JASPER_TOOLS,
  executeToolCall,
  executeToolCalls,
  executeQueryDocs,
  executeGetPlatformStats,
  executeDelegateToAgent,
  executeInspectAgentLogs,
  executeGetSystemState,
  type ToolDefinition,
  type ToolCall,
  type ToolResult,
  type SystemState,
  type BlueprintSection,
  type AgentDelegation,
  type AgentLog,
} from './jasper-tools';

// System State Service - Mandatory State Reflection
export {
  SystemStateService,
  type StateValidation,
  type StateCorrection,
  type QueryClassification,
} from './system-state-service';

// Jasper Command Authority - Phase 8 Autonomous Business Operations
export {
  JasperCommandAuthority,
  getJasperCommandAuthority,
  resetJasperCommandAuthority,
  type ExecutiveBriefing,
  type BriefingHighlight,
  type DepartmentSummary,
  type BriefingMetrics,
  type PendingApproval,
  type JasperCommand,
  type CommandResult,
} from './jasper-command-authority';
