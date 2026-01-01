/**
 * SignalCoordinator Factory - CLIENT ONLY
 * 
 * This file is for client-side (browser) contexts only.
 * Uses firebase client SDK and BaseAgentDAL.
 * 
 * USAGE:
 * ```typescript
 * import { getClientSignalCoordinator } from '@/lib/orchestration/coordinator-factory-client';
 * 
 * const coordinator = getClientSignalCoordinator();
 * await coordinator.emitSignal({...});
 * ```
 */

import { SignalCoordinator, SignalCoordinatorConfig } from './SignalCoordinator';
import { BaseAgentDAL } from '@/lib/dal/BaseAgentDAL';
import { db } from '@/lib/firebase/config';

// Lazy-loaded instance to avoid circular dependencies
let clientCoordinator: SignalCoordinator | null = null;

/**
 * Get SignalCoordinator for client-side context
 * Uses firebase client SDK and BaseAgentDAL
 */
export function getClientSignalCoordinator(config?: SignalCoordinatorConfig): SignalCoordinator {
  if (clientCoordinator) {
    return clientCoordinator;
  }

  try {
    if (!db) {
      throw new Error('Firebase Client DB not initialized');
    }

    // Create client-side DAL instance
    const dal = new BaseAgentDAL(db);
    
    // Create client coordinator
    clientCoordinator = new SignalCoordinator(db, dal, config);
    
    return clientCoordinator;
  } catch (error) {
    throw new Error(`Failed to create client SignalCoordinator: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Reset coordinator instance (useful for testing)
 */
export function resetClientCoordinator(): void {
  clientCoordinator = null;
}
