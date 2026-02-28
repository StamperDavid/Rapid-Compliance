/**
 * types.ts - The Signal Bus Type Definitions
 * 
 * SOVEREIGN CORPORATE BRAIN - NEURAL NET PROTOCOL
 * 
 * This file defines the SalesSignal interface that powers the Firestore-native
 * Signal Bus. Every piece of intelligence discovered across modules flows through
 * this type-safe, auditable pipeline.
 * 
 * CRITICAL FEATURES:
 * - Platform-scoped signal routing
 * - TTL-based signal expiration (default 30 days)
 * - Priority-based signal handling (High/Med/Low)
 * - Confidence scoring for AI-driven decisions
 * - Metadata extensibility for module-specific data
 * - Full audit trail via signal_logs sub-collection
 */

import type { Timestamp } from 'firebase/firestore';

/**
 * Signal Priority Levels
 * 
 * - High: Requires immediate action (e.g., high-intent lead detected, website down)
 * - Medium: Normal flow (e.g., email opened, form submitted)
 * - Low: Background intelligence (e.g., website updated, new competitor detected)
 */
export type SignalPriority = 'High' | 'Medium' | 'Low';

/**
 * Signal Types
 * 
 * These define the categories of intelligence flowing through the system.
 * Each type triggers different downstream actions in the orchestration layer.
 */
export type SignalType =
  // Lead Intelligence Signals
  | 'lead.discovered'           // New lead identified
  | 'lead.qualified'            // Lead met qualification criteria
  | 'lead.engaged'              // Lead interacted (email open, click, etc.)
  | 'lead.intent.high'          // High-intent behavior detected
  | 'lead.intent.low'           // Low-intent behavior detected
  | 'lead.status.changed'       // Lead status transition
  
  // Website Intelligence Signals
  | 'website.discovered'        // New website scraped
  | 'website.updated'           // Existing website changed
  | 'website.technology.detected' // New tech stack identified
  | 'website.competitor.detected' // Competitor mentioned
  
  // Competitive Intelligence Signals
  | 'competitor.discovered'     // New competitor profiled
  | 'competitor.updated'        // Competitor intelligence refreshed
  | 'competitor.weakness.detected' // New weakness identified
  | 'battlecard.generated'      // New battlecard created
  | 'battlecard.updated'        // Battlecard refreshed
  
  // Engagement Signals
  | 'email.opened'              // Email tracking event
  | 'email.clicked'             // Link click in email
  | 'email.bounced'             // Email delivery failure
  | 'email.replied'             // Lead replied to email
  
  // Email Writer Signals
  | 'email.generated'           // AI email generated
  | 'email.sent'                // Email sent to recipient
  | 'email.variant.created'     // Email variant created for A/B testing
  | 'email.delivery.failed'     // Email delivery failed
                 // Email opened by recipient (duplicate from engagement)
                // Email clicked by recipient (duplicate from engagement)
  
  // Sequence Signals
  | 'sequence.started'          // Lead entered sequence
  | 'sequence.completed'        // Lead completed sequence
  | 'sequence.paused'           // Sequence manually paused
  | 'sequence.failed'           // Sequence execution error
  
  // CRM Signals
  | 'deal.created'              // New deal/opportunity
  | 'deal.stage.changed'        // Deal moved to new stage
  | 'deal.won'                  // Deal closed-won
  | 'deal.lost'                 // Deal closed-lost
  | 'deal.health.updated'       // Deal health score recalculated
  | 'deal.recommendations.generated' // Next best actions generated
  | 'deal.action.recommended'   // Specific action recommended
  
  // Onboarding Signals
  | 'onboarding.started'        // User began onboarding flow
  | 'onboarding.prefilled'      // Business data auto-prefilled from Discovery Engine
  | 'onboarding.completed'      // User completed onboarding
  | 'onboarding.abandoned'      // User left onboarding incomplete
  
  // Template Signals
  | 'template.applied'          // Industry template applied to organization
  | 'template.customized'       // Template was customized
  | 'template.validation.failed' // Template validation failed
  
  // Deal Scoring Signals
  | 'deal.scored'               // Deal score calculated
  | 'deal.risk.detected'        // Risk factor identified in deal
  | 'deal.risk.critical'        // Critical risk level detected
  | 'deal.risk.high'            // High risk level detected
  | 'deal.tier.changed'         // Deal tier changed (hot/warm/cold/at-risk)
  
  // Revenue Forecasting Signals
  | 'forecast.updated'          // Revenue forecast updated
  | 'quota.at_risk'             // Quota attainment at risk
  | 'quota.achieved'            // Quota achieved
  
  // Conversation Intelligence Signals
  | 'conversation.analyzed'     // Conversation analysis completed
  | 'conversation.low_score'    // Poor conversation quality detected
  | 'conversation.red_flag'     // Critical warning identified
  | 'conversation.coaching_needed' // Coaching opportunity detected
  | 'conversation.competitor_mentioned' // Competitor discussed
  | 'conversation.objection_raised' // Unaddressed objection detected
  | 'conversation.positive_signal' // Buying signal identified
  | 'conversation.follow_up_required' // Action items generated
  | 'conversation.sentiment_negative' // Negative sentiment trend
  
  // Performance Analytics Signals
  | 'performance.analyzed'      // Team performance analysis completed
  | 'performance.top_performer_identified' // Top performer identified
  | 'performance.improvement_opportunity' // Improvement opportunity detected
  | 'performance.coaching_priority_created' // Coaching priority identified
  | 'performance.best_practice_extracted' // Best practice extracted
  | 'performance.trend_detected' // Performance trend detected
  | 'performance.leaderboard_updated' // Leaderboard updated
  | 'performance.benchmark_changed' // Performance benchmark changed
  | 'performance.alert_triggered' // Performance alert triggered
  
  // Coaching Signals
  | 'coaching.insights.generated' // Personalized coaching insights generated
  
  // Playbook Builder Signals
  | 'playbook.generated'        // New playbook created
  | 'playbook.patterns_extracted' // Patterns extracted from conversations
  | 'playbook.activated'        // Playbook activated for use
  | 'playbook.used'             // Playbook used in conversation
  | 'playbook.updated'          // Playbook content updated
  | 'playbook.adoption_tracked' // Adoption metrics calculated
  | 'playbook.effectiveness_measured' // Effectiveness metrics measured
  | 'playbook.archived'         // Playbook archived/deprecated
  | 'playbook.pattern_identified' // New pattern identified
  
  // Email Sequence Intelligence Signals
  | 'sequence.analyzed'         // Sequence analysis completed
  | 'sequence.pattern_detected' // High-performing pattern detected
  | 'sequence.underperforming'  // Low-performing sequence identified
  | 'sequence.optimization_needed' // Critical optimization recommended
  | 'sequence.optimal_timing_found' // Optimal send time discovered
  | 'sequence.ab_test_completed' // A/B test completed with results
  | 'sequence.performance_decline' // Sequence performance declined
  | 'sequence.best_practice_found' // Best practice identified
  | 'sequence.metrics_updated'  // Sequence metrics refreshed
  
  // Lead Routing Signals
  | 'lead.routed'               // Lead routed to sales rep
  
  // Workflow Automation Signals
  | 'workflow.executed'         // Workflow automation completed
  
  // Slack Integration Signals
  | 'slack.connected'           // Slack workspace connected
  | 'slack.disconnected'        // Slack workspace disconnected
  | 'slack.message.sent'        // Message sent to Slack
  | 'slack.message.failed'      // Message failed to send
  | 'slack.rate_limited'        // Rate limit hit
  
  // System Signals
  | 'system.error'              // System error occurred
  | 'system.quota.warning'      // API quota approaching limit
  | 'system.quota.exceeded'     // API quota exceeded

  // Workforce Orchestration Signals
  | 'workforce.deployed'        // Workforce template deployed to org
  | 'workforce.updated'         // Workforce configuration updated
  | 'agent.activated'           // Specialist agent activated
  | 'agent.hibernated'          // Specialist agent hibernated (dormant)
  | 'agent.disabled'            // Specialist agent disabled
  | 'platform.connected'        // Social platform connected
  | 'platform.disconnected'     // Social platform disconnected
  | 'content.generated'         // AI content generated by agent
  | 'content.published'         // Content published to platform
  | 'content.scheduled'         // Content scheduled for publishing

  // Custom Signals (for extensibility)
  | 'custom';

/**
 * SalesSignal - The Core Intelligence Unit
 * 
 * Every piece of intelligence flowing through the Sovereign Corporate Brain
 * is represented as a SalesSignal. These are persisted in Firestore and
 * observed in real-time by the SignalCoordinator.
 * 
 * PLATFORM-SCOPED: All signals are scoped to the platform (PLATFORM_ID)
 * AUDITABILITY: All signals are logged to signal_logs sub-collection
 * TTL: Signals auto-expire after ttl period (default 30 days)
 *
 * @example
 * const signal: SalesSignal = {
 *   id: 'sig_12345',
 *   type: 'lead.intent.high',
 *   leadId: 'lead_abc',
 *   confidence: 0.94,
 *   priority: 'High',
 *   metadata: {
 *     source: 'website-scraper',
 *     behaviourPattern: 'visited pricing page 3x in 24h',
 *     nextBestAction: 'send pricing email'
 *   },
 *   ttl: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
 *   createdAt: Timestamp.now(),
 *   processed: false,
 *   processedAt: null
 * };
 */
export interface SalesSignal {
  /**
   * Unique signal identifier (auto-generated by Firestore)
   */
  id?: string;
  
  /**
   * Signal type - determines which modules react to this signal
   */
  type: SignalType;
  
  /**
   * Lead ID this signal relates to (optional - some signals are org-level)
   */
  leadId?: string;

  /**
   * Confidence score (0.0 to 1.0)
   * 
   * This drives AI-powered decision making:
   * - > 0.9: High confidence, auto-act
   * - 0.7 - 0.9: Medium confidence, suggest action
   * - < 0.7: Low confidence, log for review
   */
  confidence: number;
  
  /**
   * Priority level - determines processing order and urgency
   */
  priority: SignalPriority;
  
  /**
   * Extensible metadata for module-specific data
   * 
   * This is intentionally flexible to support diverse signal types.
   * Each module can add its own metadata structure.
   * 
   * Common patterns:
   * - source: string (which module emitted this signal)
   * - nextBestAction: string (AI recommendation)
   * - reason: string (why this signal was emitted)
   * - context: Record<string, any> (additional context)
   */
  metadata: Record<string, unknown>;
  
  /**
   * Time-to-live - when this signal expires
   * Default: 30 days from creation
   * 
   * Expired signals are automatically cleaned up by maintenance jobs
   */
  ttl: Timestamp;
  
  /**
   * Creation timestamp
   */
  createdAt: Timestamp;
  
  /**
   * Whether this signal has been processed by downstream modules
   */
  processed: boolean;
  
  /**
   * When the signal was processed (null if not yet processed)
   */
  processedAt: Timestamp | null;
  
  /**
   * Processing result (optional)
   * Modules can record what they did in response to this signal
   */
  processingResult?: {
    success: boolean;
    action: string;
    module: string;
    error?: string;
  };
}

/**
 * Signal Observer Callback
 * 
 * This is the function signature for modules that observe signals.
 * The SignalCoordinator calls this whenever a matching signal is detected.
 */
export type SignalObserver = (signal: SalesSignal) => void | Promise<void>;

/**
 * Signal Subscription Options
 * 
 * Fine-grained control over which signals a module receives
 */
export interface SignalSubscription {
  /**
   * Which signal types to observe
   * If empty/undefined, observes all signals for the org
   */
  types?: SignalType[];
  
  /**
   * Minimum priority to observe (filters out lower priority signals)
   */
  minPriority?: SignalPriority;
  
  /**
   * Minimum confidence threshold (0.0 to 1.0)
   * Only signals with confidence >= this value are delivered
   */
  minConfidence?: number;

  /**
   * Only observe unprocessed signals
   * Default: true
   */
  unprocessedOnly?: boolean;
}

/**
 * Circuit Breaker State
 * 
 * Prevents runaway AI costs by tracking error rates and throttling
 */
export interface CircuitBreakerState {
  /**
   * Is the circuit breaker open (blocking signals)?
   */
  isOpen: boolean;
  
  /**
   * Count of consecutive failures
   */
  failureCount: number;
  
  /**
   * Threshold before circuit opens
   */
  failureThreshold: number;
  
  /**
   * When the circuit breaker last opened
   */
  lastOpenedAt: Timestamp | null;
  
  /**
   * How long to keep circuit open before attempting reset (milliseconds)
   */
  resetTimeout: number;
}

/**
 * Throttler State
 * 
 * Prevents event loops by rate-limiting signal emission
 */
export interface ThrottlerState {
  /**
   * Count of signals emitted in current window
   */
  signalCount: number;
  
  /**
   * When the current window started
   */
  windowStartedAt: Timestamp;
  
  /**
   * Window duration in milliseconds
   */
  windowDuration: number;
  
  /**
   * Max signals allowed per window
   */
  maxSignalsPerWindow: number;
  
  /**
   * Is throttling currently active?
   */
  isThrottled: boolean;
}

/**
 * Signal Emission Result
 * 
 * Returned by emitSignal() to indicate success/failure
 */
export interface SignalEmissionResult {
  /**
   * Was the signal successfully emitted?
   */
  success: boolean;
  
  /**
   * ID of the emitted signal (if successful)
   */
  signalId?: string;
  
  /**
   * Error message (if failed)
   */
  error?: string;
  
  /**
   * Was emission blocked by circuit breaker?
   */
  circuitBreakerBlocked?: boolean;
  
  /**
   * Was emission blocked by throttler?
   */
  throttled?: boolean;
}
