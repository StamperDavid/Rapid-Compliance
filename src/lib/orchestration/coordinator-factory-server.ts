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

import { SignalCoordinator, type SignalCoordinatorConfig } from './SignalCoordinator';
import { db } from '@/lib/firebase-admin';
import { adminDal } from '@/lib/firebase/admin-dal';
import type { Firestore as ClientFirestore } from 'firebase/firestore';
import type { BaseAgentDAL } from '@/lib/dal/BaseAgentDAL';

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

    // Create server coordinator
    // Note: firebase-admin Firestore is runtime-compatible with firebase/firestore client SDK
    // The type assertion is safe because both SDKs share the same core Firestore interface
    serverCoordinator = new SignalCoordinator(
      db as unknown as ClientFirestore,
      adminDal as unknown as BaseAgentDAL,
      config
    );
    
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
