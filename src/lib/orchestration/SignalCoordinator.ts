/**
 * SignalCoordinator.ts - The Neural Net
 * 
 * SOVEREIGN CORPORATE BRAIN - SIGNAL BUS ORCHESTRATION
 * 
 * This is the nervous system of the Universal AI Sales Operating System.
 * Every piece of intelligence flows through this coordinator:
 * - Lead discovery signals
 * - Website intelligence signals
 * - Engagement signals
 * - CRM events
 * - System events
 * 
 * CRITICAL FEATURES:
 * ✅ Real-time signal observation via Firestore onSnapshot
 * ✅ Circuit Breaker to prevent runaway AI costs
 * ✅ Throttler to prevent event loops
 * ✅ Full audit trail via signal_logs sub-collection
 * ✅ Organization isolation via orgId
 * ✅ TTL-based signal expiration
 *
 * SAFETY CONTROLS:
 * - Circuit Breaker opens after 5 consecutive failures (configurable)
 * - Throttler limits to 100 signals per minute per org (configurable)
 * - All signals logged to signal_logs for compliance
 * - Firestore security rules enforce orgId isolation
 */

import {
  addDoc,
  query,
  where,
  onSnapshot,
  Timestamp,
  updateDoc,
  doc,
  orderBy,
  limit as firestoreLimit,
  type Firestore,
  type Unsubscribe,
  type QueryConstraint
} from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import type {
  SalesSignal,
  SignalObserver,
  SignalSubscription,
  SignalPriority,
  CircuitBreakerState,
  ThrottlerState,
  SignalEmissionResult} from './types';
import type { BaseAgentDAL } from '@/lib/dal/BaseAgentDAL';

/**
 * Configuration for SignalCoordinator
 */
export interface SignalCoordinatorConfig {
  /**
   * Circuit breaker failure threshold
   * Default: 5 consecutive failures
   */
  circuitBreakerThreshold?: number;
  
  /**
   * Circuit breaker reset timeout (milliseconds)
   * Default: 60000 (1 minute)
   */
  circuitBreakerResetTimeout?: number;
  
  /**
   * Throttler window duration (milliseconds)
   * Default: 60000 (1 minute)
   */
  throttlerWindowDuration?: number;
  
  /**
   * Max signals per throttler window
   * Default: 100 signals per minute
   */
  throttlerMaxSignals?: number;
  
  /**
   * TTL for signals (days)
   * Default: 30 days
   */
  signalTTLDays?: number;
}

/**
 * SignalCoordinator - The Firestore-Native Signal Bus
 * 
 * Usage Example:
 * ```typescript
 * const coordinator = new SignalCoordinator(db, dal);
 * 
 * // Emit a signal
 * const result = await coordinator.emitSignal({
 *   type: 'lead.intent.high',
 *   leadId: 'lead_123',
 *   orgId: 'org_acme',
 *   confidence: 0.94,
 *   priority: 'High',
 *   metadata: {
 *     source: 'website-scraper',
 *     reason: 'visited pricing page 3x in 24h'
 *   }
 * });
 * 
 * // Observe signals
 * const unsubscribe = coordinator.observeSignals(
 *   {
 *     orgId: 'org_acme',
 *     types: ['lead.intent.high'],
 *     minConfidence: 0.8
 *   },
 *   async (signal) => {
 *     console.log('High-intent lead detected:', signal);
 *     // Trigger next best action...
 *   }
 * );
 * ```
 */
export class SignalCoordinator {
  private db: Firestore;
  private dal: BaseAgentDAL;
  private config: Required<SignalCoordinatorConfig>;
  
  // Circuit Breakers per organization
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  
  // Throttlers per organization
  private throttlers: Map<string, ThrottlerState> = new Map();
  
  // Active subscriptions (for cleanup)
  private activeSubscriptions: Set<Unsubscribe> = new Set();
  
  constructor(
    firestoreInstance: Firestore,
    dalInstance: BaseAgentDAL,
    config?: SignalCoordinatorConfig
  ) {
    if (!firestoreInstance) {
      throw new Error('SignalCoordinator requires a valid Firestore instance');
    }
    if (!dalInstance) {
      throw new Error('SignalCoordinator requires a valid BaseAgentDAL instance');
    }
    
    this.db = firestoreInstance;
    this.dal = dalInstance;
    
    // Set default configuration
    this.config = {
      circuitBreakerThreshold: config?.circuitBreakerThreshold ?? 5,
      circuitBreakerResetTimeout: config?.circuitBreakerResetTimeout ?? 60000, // 1 minute
      throttlerWindowDuration: config?.throttlerWindowDuration ?? 60000, // 1 minute
      throttlerMaxSignals: config?.throttlerMaxSignals ?? 100,
      signalTTLDays: config?.signalTTLDays ?? 30,
    };
    
    logger.info('🧠 SignalCoordinator initialized', {
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV ?? 'unknown',
      circuitBreakerThreshold: this.config.circuitBreakerThreshold,
      circuitBreakerResetTimeout: this.config.circuitBreakerResetTimeout,
      throttlerWindowDuration: this.config.throttlerWindowDuration,
      throttlerMaxSignals: this.config.throttlerMaxSignals,
      signalTTLDays: this.config.signalTTLDays,
      file: 'SignalCoordinator.ts'
    });
  }
  
  // ========================================
  // SIGNAL EMISSION
  // ========================================
  
  /**
   * Emit a signal to the Signal Bus
   * 
   * This is the primary way modules communicate intelligence across the system.
   * 
   * SAFETY CHECKS:
   * 1. Circuit breaker check (prevents runaway failures)
   * 2. Throttler check (prevents event loops)
   * 3. Validation (ensures signal integrity)
   * 4. Logging (audit trail to signal_logs)
   * 
   * @param signalData - The signal to emit (partial, will be enriched)
   * @returns SignalEmissionResult indicating success/failure
   * 
   * @example
   * await coordinator.emitSignal({
   *   type: 'lead.discovered',
   *   leadId: 'lead_123',
   *   orgId: 'org_acme',
   *   confidence: 0.85,
   *   priority: 'Medium',
   *   metadata: { source: 'linkedin-scraper' }
   * });
   */
  async emitSignal(
    signalData: Omit<SalesSignal, 'id' | 'createdAt' | 'processed' | 'processedAt' | 'ttl'>
  ): Promise<SignalEmissionResult> {
    const startTime = Date.now();
    
    try {
      // Validate required fields
      this.validateSignal(signalData);
      
      // Check circuit breaker
      if (this.isCircuitBreakerOpen(signalData.orgId)) {
        logger.warn('🚨 Circuit breaker OPEN - signal emission blocked', {
          orgId: signalData.orgId,
          type: signalData.type,
          file: 'SignalCoordinator.ts'
        });
        
        return {
          success: false,
          error: 'Circuit breaker is open - too many recent failures',
          circuitBreakerBlocked: true,
        };
      }
      
      // Check throttler
      if (this.isThrottled(signalData.orgId)) {
        logger.warn('⏱️ Throttler active - signal emission blocked', {
          orgId: signalData.orgId,
          type: signalData.type,
          file: 'SignalCoordinator.ts'
        });
        
        return {
          success: false,
          error: 'Rate limit exceeded - too many signals in current window',
          throttled: true,
        };
      }
      
      // Enrich signal with system fields
      const enrichedSignal: Omit<SalesSignal, 'id'> = {
        ...signalData,
        createdAt: Timestamp.now(),
        processed: false,
        processedAt: null,
        ttl: this.calculateTTL(),
      };

      // Get signals collection with environment awareness
      const signalsCollection = this.dal.getOrgSubCollection(
        signalData.orgId,
        'signals'
      );

      // Emit to Firestore
      const docRef = await addDoc(signalsCollection, enrichedSignal);

      // Update throttler
      this.incrementThrottler(signalData.orgId);
      
      // Log to signal_logs sub-collection for audit trail
      await this.logSignal(signalData.orgId, docRef.id, enrichedSignal);
      
      // Reset circuit breaker on success
      this.resetCircuitBreaker(signalData.orgId);
      
      const duration = Date.now() - startTime;
      
      logger.info('📡 Signal emitted successfully', {
        signalId: docRef.id,
        type: signalData.type,
        orgId: signalData.orgId,
        leadId: signalData.leadId,
        priority: signalData.priority,
        confidence: signalData.confidence,
        durationMs: duration,
        file: 'SignalCoordinator.ts'
      });
      
      return {
        success: true,
        signalId: docRef.id,
      };
      
    } catch (error) {
      // Record failure in circuit breaker
      this.recordCircuitBreakerFailure(signalData.orgId);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorObj = error instanceof Error ? error : undefined;

      logger.error('❌ Signal emission failed', errorObj, {
        organizationId: signalData.orgId,
        file: 'SignalCoordinator.ts'
      });
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }
  
  // ========================================
  // SIGNAL OBSERVATION
  // ========================================
  
  /**
   * Observe signals in real-time via Firestore onSnapshot
   * 
   * This creates a persistent listener that fires whenever matching signals
   * are created or updated. This is the real-time reactivity that powers
   * the "Sovereign Corporate Brain."
   * 
   * MULTI-TENANCY: All queries are scoped to orgId
   * FILTERING: Supports type, priority, and confidence filters
   * CLEANUP: Returns unsubscribe function - MUST be called to prevent memory leaks
   * 
   * @param subscription - Subscription configuration
   * @param observer - Callback function invoked for each matching signal
   * @returns Unsubscribe function - call this to stop observing
   * 
   * @example
   * // Observe high-priority unprocessed signals
   * const unsubscribe = coordinator.observeSignals(
   *   {
   *     orgId: 'org_acme',
   *     types: ['lead.intent.high', 'deal.won'],
   *     minPriority: 'High',
   *     minConfidence: 0.9,
   *     unprocessedOnly: true
   *   },
   *   async (signal) => {
   *     // React to signal...
   *     await processSignal(signal);
   *     
   *     // Mark as processed
   *     await coordinator.markSignalProcessed(signal.orgId, signal.id!, {
   *       success: true,
   *       action: 'sent-email',
   *       module: 'email-sequencer'
   *     });
   *   }
   * );
   * 
   * // Later: cleanup
   * unsubscribe();
   */
  observeSignals(
    subscription: SignalSubscription,
    observer: SignalObserver
  ): Unsubscribe {
    // Build query constraints
    const constraints: QueryConstraint[] = [];
    
    // Filter by signal types (if specified)
    if (subscription.types && subscription.types.length > 0) {
      constraints.push(where('type', 'in', subscription.types));
    }
    
    // Filter by processed status
    if (subscription.unprocessedOnly !== false) {
      constraints.push(where('processed', '==', false));
    }
    
    // Filter by workspace (if specified)
    if (subscription.workspaceId) {
      constraints.push(where('workspaceId', '==', subscription.workspaceId));
    }
    
    // Order by creation time (newest first)
    constraints.push(orderBy('createdAt', 'desc'));
    
    // Limit to prevent overwhelming observers
    constraints.push(firestoreLimit(100));


    // Get signals collection with environment awareness
    const signalsCollection = this.dal.getOrgSubCollection(
      subscription.orgId,
      'signals'
    );

    // Build query
    const q = query(signalsCollection, ...constraints);
    
    logger.info('👂 Signal observer registered', {
      orgId: subscription.orgId,
      types: subscription.types,
      minPriority: subscription.minPriority,
      minConfidence: subscription.minConfidence,
      workspaceId: subscription.workspaceId,
      file: 'SignalCoordinator.ts'
    });
    
    // Create real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type === 'added' || change.type === 'modified') {
            const docData = change.doc.data();
            if (!docData) {
              logger.warn('📨 Signal document has no data', {
                signalId: change.doc.id,
                file: 'SignalCoordinator.ts'
              });
              return;
            }
            // Type assertion after null check
            const signalData = docData as Omit<SalesSignal, 'id'>;
            const signal: SalesSignal = {
              id: change.doc.id,
              ...signalData,
            };
            
            // Apply client-side filters (priority and confidence)
            if (!this.matchesSubscription(signal, subscription)) {
              return;
            }
            
            logger.debug('📨 Signal received', {
              signalId: signal.id,
              type: signal.type,
              orgId: signal.orgId,
              priority: signal.priority,
              confidence: signal.confidence,
              file: 'SignalCoordinator.ts'
            });
            
            // Invoke observer callback (async-safe)
            Promise.resolve(observer(signal)).catch((error) => {
              const errorObj = error instanceof Error ? error : undefined;
              logger.error('❌ Signal observer failed', errorObj, {
                file: 'SignalCoordinator.ts'
              });
            });
          }
        });
      },
      (error) => {
        const errorObj = error instanceof Error ? error : undefined;
        logger.error('❌ Signal observation error', errorObj, {
          organizationId: subscription.orgId,
          file: 'SignalCoordinator.ts'
        });
      }
    );
    
    // Track subscription for cleanup
    this.activeSubscriptions.add(unsubscribe);
    
    // Return unsubscribe wrapper that also removes from tracking
    return () => {
      unsubscribe();
      this.activeSubscriptions.delete(unsubscribe);
      
      logger.info('🔌 Signal observer unsubscribed', {
        orgId: subscription.orgId,
        file: 'SignalCoordinator.ts'
      });
    };
  }
  
  /**
   * Mark a signal as processed
   * 
   * This prevents duplicate processing and records the outcome for audit purposes.
   * 
   * @param orgId - Organization ID
   * @param signalId - Signal ID
   * @param result - Processing result
   */
  async markSignalProcessed(
    orgId: string,
    signalId: string,
    result: {
      success: boolean;
      action: string;
      module: string;
      error?: string;
    }
  ): Promise<void> {
    try {
      const signalsCollection = this.dal.getOrgSubCollection(orgId, 'signals');
      const signalRef = doc(signalsCollection, signalId);
      
      await updateDoc(signalRef, {
        processed: true,
        processedAt: Timestamp.now(),
        processingResult: result,
      });

      logger.info('✅ Signal marked as processed', {
        organizationId: orgId,
        file: 'SignalCoordinator.ts'
      });
      
    } catch (error) {
      const errorObj = error instanceof Error ? error : undefined;
      logger.error('❌ Failed to mark signal as processed', errorObj, {
        organizationId: orgId,
        file: 'SignalCoordinator.ts'
      });

      throw error;
    }
  }
  
  // ========================================
  // CIRCUIT BREAKER
  // ========================================
  
  /**
   * Check if circuit breaker is open for an organization
   */
  private isCircuitBreakerOpen(orgId: string): boolean {
    const breaker = this.circuitBreakers.get(orgId);
    
    if (!breaker?.isOpen) {
      return false;
    }
    
    // Check if reset timeout has elapsed
    if (breaker.lastOpenedAt) {
      const now = Date.now();
      const openedAt = breaker.lastOpenedAt.toMillis();
      const elapsed = now - openedAt;
      
      if (elapsed >= this.config.circuitBreakerResetTimeout) {
        // Attempt to close circuit breaker
        logger.info('🔄 Circuit breaker reset attempt', {
          orgId,
          file: 'SignalCoordinator.ts'
        });
        
        breaker.isOpen = false;
        breaker.failureCount = 0;
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Record a failure in the circuit breaker
   */
  private recordCircuitBreakerFailure(orgId: string): void {
    let breaker = this.circuitBreakers.get(orgId);
    
    if (!breaker) {
      breaker = {
        isOpen: false,
        failureCount: 0,
        failureThreshold: this.config.circuitBreakerThreshold,
        lastOpenedAt: null,
        resetTimeout: this.config.circuitBreakerResetTimeout,
      };
      this.circuitBreakers.set(orgId, breaker);
    }
    
    breaker.failureCount++;
    
    // Open circuit if threshold exceeded
    if (breaker.failureCount >= breaker.failureThreshold) {
      breaker.isOpen = true;
      breaker.lastOpenedAt = Timestamp.now();

      logger.error('🚨 Circuit breaker OPENED', undefined, {
        organizationId: orgId,
        file: 'SignalCoordinator.ts'
      });
    } else {
      logger.warn('⚠️ Circuit breaker failure recorded', {
        organizationId: orgId,
        file: 'SignalCoordinator.ts'
      });
    }
  }
  
  /**
   * Reset circuit breaker on successful emission
   */
  private resetCircuitBreaker(orgId: string): void {
    const breaker = this.circuitBreakers.get(orgId);
    
    if (breaker && breaker.failureCount > 0) {
      logger.info('✅ Circuit breaker reset', {
        orgId,
        previousFailures: breaker.failureCount,
        file: 'SignalCoordinator.ts'
      });
      
      breaker.failureCount = 0;
      breaker.isOpen = false;
    }
  }
  
  // ========================================
  // THROTTLER
  // ========================================
  
  /**
   * Check if organization is currently throttled
   */
  private isThrottled(orgId: string): boolean {
    const throttler = this.throttlers.get(orgId);
    
    if (!throttler) {
      return false;
    }
    
    const now = Date.now();
    const windowStart = throttler.windowStartedAt.toMillis();
    const elapsed = now - windowStart;
    
    // Reset window if expired
    if (elapsed >= this.config.throttlerWindowDuration) {
      throttler.signalCount = 0;
      throttler.windowStartedAt = Timestamp.now();
      throttler.isThrottled = false;
      return false;
    }
    
    // Check if limit exceeded
    if (throttler.signalCount >= throttler.maxSignalsPerWindow) {
      throttler.isThrottled = true;
      return true;
    }
    
    return false;
  }
  
  /**
   * Increment throttler counter
   */
  private incrementThrottler(orgId: string): void {
    let throttler = this.throttlers.get(orgId);
    
    if (!throttler) {
      throttler = {
        signalCount: 0,
        windowStartedAt: Timestamp.now(),
        windowDuration: this.config.throttlerWindowDuration,
        maxSignalsPerWindow: this.config.throttlerMaxSignals,
        isThrottled: false,
      };
      this.throttlers.set(orgId, throttler);
    }
    
    throttler.signalCount++;
    
    // Log warning if approaching limit
    const percentUsed = (throttler.signalCount / throttler.maxSignalsPerWindow) * 100;
    if (percentUsed >= 80 && percentUsed < 100) {
      logger.warn('⏱️ Approaching throttle limit', {
        orgId,
        signalCount: throttler.signalCount,
        limit: throttler.maxSignalsPerWindow,
        percentUsed: `${percentUsed.toFixed(1)}%`,
        file: 'SignalCoordinator.ts'
      });
    }
  }
  
  // ========================================
  // AUDIT LOGGING
  // ========================================
  
  /**
   * Log signal to signal_logs sub-collection
   * 
   * This creates an immutable audit trail for compliance.
   */
  private async logSignal(
    orgId: string,
    signalId: string,
    signal: Omit<SalesSignal, 'id'>
  ): Promise<void> {
    try {
      const logsCollection = this.dal.getOrgSubCollection(orgId, 'signal_logs');

      const logEntry = {
        signalId,
        type: signal.type,
        leadId: signal.leadId,
        workspaceId: signal.workspaceId,
        confidence: signal.confidence,
        priority: signal.priority,
        metadata: signal.metadata,
        createdAt: signal.createdAt,
        ttl: signal.ttl,
        environment:process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
      };
      
      await addDoc(logsCollection, logEntry);
      
      logger.debug('📋 Signal logged to audit trail', {
        signalId,
        orgId,
        type: signal.type,
        file: 'SignalCoordinator.ts'
      });
      
    } catch (error) {
      // Log errors but don't fail signal emission
      const errorObj = error instanceof Error ? error : undefined;
      logger.error('❌ Failed to log signal to audit trail', errorObj, {
        organizationId: orgId,
        file: 'SignalCoordinator.ts'
      });
    }
  }
  
  // ========================================
  // UTILITIES
  // ========================================
  
  /**
   * Validate signal data
   */
  private validateSignal(
    signalData: Omit<SalesSignal, 'id' | 'createdAt' | 'processed' | 'processedAt' | 'ttl'>
  ): void {
    if (!signalData.type) {
      throw new Error('Signal must have a type');
    }
    
    if (!signalData.orgId) {
      throw new Error('Signal must have an orgId (multi-tenancy requirement)');
    }
    
    if (typeof signalData.confidence !== 'number' || signalData.confidence < 0 || signalData.confidence > 1) {
      throw new Error('Signal confidence must be a number between 0 and 1');
    }
    
    if (!signalData.priority || !['High', 'Medium', 'Low'].includes(signalData.priority)) {
      throw new Error('Signal priority must be High, Medium, or Low');
    }
    
    if (!signalData.metadata || typeof signalData.metadata !== 'object') {
      throw new Error('Signal must have metadata object');
    }
  }
  
  /**
   * Calculate TTL timestamp
   */
  private calculateTTL(): Timestamp {
    const ttlMs = this.config.signalTTLDays * 24 * 60 * 60 * 1000;
    const expiryDate = new Date(Date.now() + ttlMs);
    return Timestamp.fromDate(expiryDate);
  }
  
  /**
   * Check if signal matches subscription filters
   */
  private matchesSubscription(
    signal: SalesSignal,
    subscription: SignalSubscription
  ): boolean {
    // Check minimum priority
    if (subscription.minPriority) {
      const priorityOrder: Record<SignalPriority, number> = {
        High: 3,
        Medium: 2,
        Low: 1,
      };
      
      if (priorityOrder[signal.priority] < priorityOrder[subscription.minPriority]) {
        return false;
      }
    }
    
    // Check minimum confidence
    if (subscription.minConfidence !== undefined) {
      if (signal.confidence < subscription.minConfidence) {
        return false;
      }
    }
    
    return true;
  }
  
  /**
   * Cleanup all active subscriptions
   * 
   * IMPORTANT: Call this when shutting down to prevent memory leaks
   */
  cleanup(): void {
    logger.info('🧹 Cleaning up SignalCoordinator subscriptions', {
      activeSubscriptions: this.activeSubscriptions.size,
      file: 'SignalCoordinator.ts'
    });
    
    this.activeSubscriptions.forEach((unsubscribe) => {
      unsubscribe();
    });
    
    this.activeSubscriptions.clear();
    this.circuitBreakers.clear();
    this.throttlers.clear();
  }
}

/**
 * Export for use throughout the application
 */
export default SignalCoordinator;
