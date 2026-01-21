/**
 * Admin Component Exports
 *
 * Unified Admin Command Center components for platform management
 */

// Core Components
export { default as CommandCenterSidebar } from './CommandCenterSidebar';
export { default as JasperTrainingLab } from './JasperTrainingLab';

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
