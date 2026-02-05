/**
 * Shared Agent Infrastructure
 *
 * Exports common utilities and services used across all agents.
 *
 * @module agents/shared
 */

export {
  MemoryVault,
  getMemoryVault,
  shareInsight,
  broadcastSignal,
  readAgentInsights,
  checkPendingSignals,
  type MemoryCategory,
  type MemoryPriority,
  type MemoryEntry,
  type InsightEntry,
  type InsightData,
  type SignalEntry,
  type SignalData,
  type ContentEntry,
  type ContentData,
  type CrossAgentEntry,
  type CrossAgentData,
  type WriteOptions,
  type QueryOptions,
  type MemorySubscriptionCallback,
  type SubscriptionOptions,
} from './memory-vault';
