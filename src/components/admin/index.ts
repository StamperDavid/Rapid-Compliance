/**
 * Admin Component Exports
 *
 * Unified Admin Command Center components for platform management
 */

// Core Components
export { default as JasperTrainingLab } from './JasperTrainingLab';
export { UnderConstruction } from './UnderConstruction';
export type { UnderConstructionProps, ConstructionStatus } from './UnderConstruction';

// Re-export types used by admin components
export type {
  NavCategory,
  NavItem,
  AdminPermission,
  SpecialistCategory,
  SpecialistStatus,
  AISpecialist,
  JasperPersona,
  TrainingModule,
  TrainingExample,
  CommandCenterContext,
  AdminUser,
  AdminRole,
  FeatureVisibility,
} from '@/types/command-center';
