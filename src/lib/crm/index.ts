/**
 * CRM Module - Living Ledger Index
 * 
 * Central exports for the CRM "Living Ledger" with AI Next Best Action engine.
 * 
 * Modules:
 * - Deal Service: CRUD operations for deals/opportunities
 * - Deal Health: AI-powered health scoring (5 factors, 100-point scale)
 * - Next Best Action Engine: AI recommendations for optimal deal actions
 * - Deal Monitor: Real-time Signal Bus integration and monitoring
 * - Activity Service: Activity tracking and insights
 */

// Deal Service
export { getDeal, getDeals, createDeal, updateDeal, moveDealToStage, deleteDeal, getPipelineSummary } from './deal-service';
export type { Deal, DealFilters, PaginationOptions, PaginatedResult } from './deal-service';

// Deal Health
export { calculateDealHealth, getPipelineHealth } from './deal-health';
export type { DealHealthScore, DealHealthFactor } from './deal-health';

// Next Best Action Engine
export { generateNextBestActions } from './next-best-action-engine';
export type { NextBestAction, ActionRecommendations, ActionType } from './next-best-action-engine';

// Deal Monitor
export { startDealMonitor, runDealHealthCheck } from './deal-monitor';
export type { DealMonitorConfig } from './deal-monitor';

// Activity Service
export { createActivity, getActivities, getActivityStats } from './activity-service';
export type { Activity, ActivityFilters, ActivityStats, ActivityInsight } from '@/types/activity';
