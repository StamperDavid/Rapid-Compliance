/**
 * Scraper Intelligence - Main Export
 * 
 * Unified export for all scraper intelligence components.
 */

// Types
export * from './scraper-runner-types';

// Core Services
export { 
  getResearchIntelligence,
  saveResearchIntelligence,
  deleteResearchIntelligence,
  listResearchIntelligence,
  saveExtractedSignals,
  getExtractedSignals,
  querySignalsByPlatform,
  deleteExtractedSignals,
  processAndStoreScrape,
  getSignalAnalytics,
  batchProcessScrapes,
  clearAllCaches,
  getCacheStats,
  invalidateOrganizationCaches,
  healthCheck,
  ScraperIntelligenceError,
} from './scraper-intelligence-service';

// Distillation Engine
export {
  detectHighValueSignals,
  removeFluffPatterns,
  calculateLeadScore,
  getDistillationStats,
} from './distillation-engine';

// Temporary Scrapes
export {
  saveTemporaryScrape,
  getTemporaryScrape,
  getTemporaryScrapesByUrl,
  deleteExpiredScrapes,
  flagScrapeForDeletion,
  deleteFlaggedScrapes,
  calculateContentHash,
  calculateExpirationDate,
  calculateStorageCost,
  getStorageStats,
} from './temporary-scrapes-service';

// Scraper Runner
export {
  createScraperRunner,
  getScraperRunner,
  resetScraperRunner,
  ProductionScraperRunner,
} from './scraper-runner';

// Cache
export {
  createScrapeCache,
  getScrapeCacheKey,
  calculateCacheTTL,
  validateCacheEntry,
  InMemoryScrapeCache,
} from './scraper-cache';

// Rate Limiter
export {
  createDomainRateLimiter,
  getRecommendedRateLimit,
  parseRobotsCrawlDelay,
  DomainBasedRateLimiter,
} from './domain-rate-limiter';

// Queue
export {
  createScrapeQueue,
  calculateJobPriority,
  validateJobConfig,
  InMemoryScrapeQueue,
} from './scraper-queue';

// Progress Tracker
export {
  createProgressTracker,
  createProgressEvent,
  calculateProgress,
  formatProgressMessage,
  InMemoryProgressTracker,
} from './progress-tracker';

// Error Handler
export {
  createErrorHandler,
  createNetworkError,
  createTimeoutError,
  createRateLimitError,
  createValidationError,
  createExtractionError,
  createCacheError,
  withRetry,
  withTimeout,
  logError,
  ScraperErrorHandler,
} from './error-handler';
