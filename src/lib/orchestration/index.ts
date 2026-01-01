/**
 * Orchestration Module - The Sovereign Corporate Brain Neural Net
 * 
 * This module exports the Signal Bus infrastructure that powers
 * real-time intelligence coordination across the Universal AI Sales Platform.
 * 
 * EXPORTS:
 * - SignalCoordinator: Main orchestration class
 * - All signal types and interfaces
 * 
 * USAGE:
 * ```typescript
 * import { SignalCoordinator, SalesSignal } from '@/lib/orchestration';
 * 
 * const coordinator = new SignalCoordinator(db, dal);
 * 
 * // Emit intelligence
 * await coordinator.emitSignal({
 *   type: 'lead.intent.high',
 *   orgId: 'org_acme',
 *   confidence: 0.95,
 *   priority: 'High',
 *   metadata: { source: 'website-scraper' }
 * });
 * 
 * // React to intelligence
 * coordinator.observeSignals(
 *   { orgId: 'org_acme', types: ['lead.intent.high'] },
 *   async (signal) => {
 *     // Take action...
 *   }
 * );
 * ```
 */

// Main coordinator (class export)
export { SignalCoordinator } from './SignalCoordinator';
export { default as DefaultSignalCoordinator } from './SignalCoordinator';

// Types and interfaces
export type {
  SignalCoordinatorConfig,
} from './SignalCoordinator';

export type {
  SalesSignal,
  SignalObserver,
  SignalSubscription,
  SignalType,
  SignalPriority,
  CircuitBreakerState,
  ThrottlerState,
  SignalEmissionResult,
} from './types';
