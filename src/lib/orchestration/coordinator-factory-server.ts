/**
 * SignalCoordinator Factory - SERVER ONLY
 * 
 * This file is for server-side (Node.js) contexts only.
 * Uses firebase-admin and admin-dal.
 * 
 * USAGE:
 * ```typescript
 * import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
 * 
 * const coordinator = getServerSignalCoordinator();
 * await coordinator.emitSignal({...});
 * ```
 */

import 'server-only';

import type { SignalCoordinatorConfig } from './SignalCoordinator';
import { SignalCoordinator } from './SignalCoordinator';
import { db } from '@/lib/firebase-admin';
import { adminDal } from '@/lib/firebase/admin-dal';

// Lazy-loaded instance to avoid circular dependencies
let serverCoordinator: SignalCoordinator | null = null;

/**
 * Get SignalCoordinator for server-side (admin) context
 * Uses firebase-admin and admin-dal
 */
export function getServerSignalCoordinator(config?: SignalCoordinatorConfig): SignalCoordinator {
  if (serverCoordinator) {
    return serverCoordinator;
  }

  try {
    if (!db) {
      throw new Error('Firebase Admin DB not initialized');
    }
    
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    // Create server coordinator - cast to any to handle firebase-admin vs client SDK type mismatch
    serverCoordinator = new SignalCoordinator(db as any, adminDal as any, config);
    
    return serverCoordinator;
  } catch (error) {
    throw new Error(`Failed to create server SignalCoordinator: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Reset coordinator instance (useful for testing)
 */
export function resetServerCoordinator(): void {
  serverCoordinator = null;
}
