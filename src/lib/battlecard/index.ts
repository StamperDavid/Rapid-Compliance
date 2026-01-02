/**
 * Battlecard Module Exports
 * 
 * Competitive Intelligence System for the Sovereign Corporate Brain
 */

// Core Engine
export {
  discoverCompetitor,
  generateBattlecard,
  discoverCompetitorsBatch,
  type CompetitorProfile,
  type Battlecard,
  type BattlecardOptions,
} from './battlecard-engine';

// Competitive Monitor
export {
  CompetitiveMonitor,
  getCompetitiveMonitor,
  startCompetitiveMonitoring,
  stopCompetitiveMonitoring,
  type CompetitorMonitorConfig,
  type CompetitorChange,
  type MonitoringStats,
} from './competitive-monitor';
