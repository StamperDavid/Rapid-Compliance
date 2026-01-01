/**
 * SignalCoordinator Factory
 * 
 * Provides properly initialized SignalCoordinator instances
 * for both client and server contexts.
 * 
 * USAGE:
 * ```typescript
 * import { getSignalCoordinator } from '@/lib/orchestration/coordinator-factory';
 * 
 * const coordinator = getSignalCoordinator();
 * await coordinator.emitSignal({...});
 * ```
 */

import { SignalCoordinator, SignalCoordinatorConfig } from './SignalCoordinator';
import { BaseAgentDAL } from '@/lib/dal/BaseAgentDAL';

// Lazy-loaded instances to avoid circular dependencies
let serverCoordinator: SignalCoordinator | null = null;
let clientCoordinator: SignalCoordinator | null = null;

/**
 * Get SignalCoordinator for server-side (admin) context
 * Uses firebase-admin and admin-dal
 */
export function getServerSignalCoordinator(config?: SignalCoordinatorConfig): SignalCoordinator {
  if (serverCoordinator) {
    return serverCoordinator;
  }

  try {
    // Import server-side dependencies
    const { db } = require('@/lib/firebase-admin');
    const { adminDal } = require('@/lib/firebase/admin-dal');
    
    if (!db) {
      throw new Error('Firebase Admin DB not initialized');
    }
    
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    // Create server coordinator
    serverCoordinator = new SignalCoordinator(db, adminDal, config);
    
    return serverCoordinator;
  } catch (error) {
    throw new Error(`Failed to create server SignalCoordinator: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get SignalCoordinator for client-side context
 * Uses firebase client SDK and BaseAgentDAL
 */
export function getClientSignalCoordinator(config?: SignalCoordinatorConfig): SignalCoordinator {
  if (clientCoordinator) {
    return clientCoordinator;
  }

  try {
    // Import client-side dependencies
    const { db } = require('@/lib/firebase/config');
    
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
 * Get SignalCoordinator (auto-detects context)
 * 
 * Uses server coordinator in server context (Node.js),
 * uses client coordinator in browser context.
 */
export function getSignalCoordinator(config?: SignalCoordinatorConfig): SignalCoordinator {
  // Check if we're in a server context
  const isServer = typeof window === 'undefined';
  
  return isServer 
    ? getServerSignalCoordinator(config)
    : getClientSignalCoordinator(config);
}

/**
 * Reset coordinator instances (useful for testing)
 */
export function resetCoordinators(): void {
  serverCoordinator = null;
  clientCoordinator = null;
}
