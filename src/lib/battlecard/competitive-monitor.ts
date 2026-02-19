/**
 * Competitive Monitor - Real-Time Competitor Tracking
 * 
 * SOVEREIGN CORPORATE BRAIN - COMPETITIVE INTELLIGENCE MODULE
 * 
 * This service monitors competitors for changes and alerts sales teams
 * to competitive opportunities and threats in real-time.
 * 
 * CAPABILITIES:
 * - Scheduled competitor re-scraping
 * - Change detection (pricing, features, positioning)
 * - Growth signal monitoring (hiring, funding, expansion)
 * - Alert generation via Signal Bus
 * - Automated battlecard updates
 * 
 * MONITORING STRATEGY:
 * - High-priority competitors: Daily checks
 * - Medium-priority: Weekly checks
 * - Low-priority: Monthly checks
 * - Smart diffing to detect meaningful changes
 */

import { logger } from '@/lib/logger/logger';
import { discoverCompetitor, type CompetitorProfile } from './battlecard-engine';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Competitor Monitoring Configuration
 */
export interface CompetitorMonitorConfig {
  competitorId: string;
  domain: string;
  priority: 'high' | 'medium' | 'low';
  checkFrequency: 'daily' | 'weekly' | 'monthly';
  alertOn: {
    pricingChanges: boolean;
    featureChanges: boolean;
    positioningChanges: boolean;
    growthSignals: boolean;
    weaknessesDetected: boolean;
  };
  lastChecked?: Date;
  nextCheck?: Date;
}

/**
 * Detected Change
 */
export interface CompetitorChange {
  changeId: string;
  competitorId: string;
  competitorName: string;
  domain: string;

  changeType:
    | 'pricing_update'
    | 'new_feature'
    | 'removed_feature'
    | 'positioning_shift'
    | 'funding_announced'
    | 'hiring_surge'
    | 'expansion'
    | 'weakness_detected'
    | 'strength_improved';

  severity: 'critical' | 'high' | 'medium' | 'low';

  details: {
    field: string;
    oldValue: string;
    newValue: string;
    impact: string;
    recommendedAction: string;
  };

  detectedAt: Date;
  alertSent: boolean;
}

/**
 * Monitoring Stats
 */
export interface MonitoringStats {
  totalCompetitors: number;
  activeMonitors: number;
  checksPerformedToday: number;
  changesDetectedToday: number;
  alertsSentToday: number;
  lastCheckTime?: Date;
}

// ============================================================================
// COMPETITIVE MONITOR CLASS
// ============================================================================

/**
 * CompetitiveMonitor
 * 
 * Manages real-time competitor monitoring and change detection
 */
export class CompetitiveMonitor {
  private monitoringConfigs: Map<string, CompetitorMonitorConfig>;
  private isRunning: boolean = false;
  private checkInterval?: NodeJS.Timeout;

  // Daily tracking counters
  private checksToday: number = 0;
  private changesDetectedToday: number = 0;
  private alertsSentToday: number = 0;
  private lastCheckTime?: Date;
  private lastResetDate: string = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  constructor() {
    this.monitoringConfigs = new Map();
  }

  /**
   * Start monitoring competitors
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Competitive monitor already running');
      return;
    }

    logger.info('Starting competitive monitor', {
      competitorsTracked: this.monitoringConfigs.size,
    });

    this.isRunning = true;

    // Run initial check
    await this.performScheduledChecks();

    // Schedule periodic checks (every hour)
    this.checkInterval = setInterval(
      () => {
        void this.performScheduledChecks();
      },
      60 * 60 * 1000 // 1 hour
    );

    logger.info('Competitive monitor started', {
      checkIntervalMs: 60 * 60 * 1000,
    });
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping competitive monitor');

    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    this.isRunning = false;
  }

  /**
   * Add competitor to monitoring
   */
  addCompetitor(config: CompetitorMonitorConfig): void {
    this.monitoringConfigs.set(config.competitorId, {
      ...config,
      lastChecked: config.lastChecked ?? undefined,
      nextCheck:config.nextCheck ?? this.calculateNextCheck(config.checkFrequency),
    });

    logger.info('Competitor added to monitoring', {
      competitorId: config.competitorId,
      domain: config.domain,
      priority: config.priority,
      checkFrequency: config.checkFrequency,
    });
  }

  /**
   * Remove competitor from monitoring
   */
  removeCompetitor(competitorId: string): void {
    this.monitoringConfigs.delete(competitorId);

    logger.info('Competitor removed from monitoring', {
      competitorId,
    });
  }

  /**
   * Get monitoring stats
   */
  getStats(): MonitoringStats {
    const now = new Date();

    // Reset daily counters if the date has changed
    this.resetDailyCountersIfNeeded();

    return {
      totalCompetitors: this.monitoringConfigs.size,
      activeMonitors: Array.from(this.monitoringConfigs.values()).filter(
        c => c.nextCheck && c.nextCheck <= now
      ).length,
      checksPerformedToday: this.checksToday,
      changesDetectedToday: this.changesDetectedToday,
      alertsSentToday: this.alertsSentToday,
      lastCheckTime: this.lastCheckTime,
    };
  }

  /**
   * Reset daily counters at midnight boundary
   */
  private resetDailyCountersIfNeeded(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.lastResetDate) {
      this.checksToday = 0;
      this.changesDetectedToday = 0;
      this.alertsSentToday = 0;
      this.lastResetDate = today;
    }
  }

  /**
   * Perform scheduled checks for all competitors
   */
  private async performScheduledChecks(): Promise<void> {
    const now = new Date();
    const competitorsToCheck = Array.from(this.monitoringConfigs.values()).filter(
      config => config.nextCheck && config.nextCheck <= now
    );

    if (competitorsToCheck.length === 0) {
      logger.debug('No competitors due for checking', {
        totalCompetitors: this.monitoringConfigs.size,
      });
      return;
    }

    logger.info('Performing scheduled competitor checks', {
      competitorsToCheck: competitorsToCheck.length,
    });

    for (const config of competitorsToCheck) {
      try {
        await this.checkCompetitor(config);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('Failed to check competitor', err, {
          competitorId: config.competitorId,
          domain: config.domain,
        });
      }
    }
  }

  /**
   * Check a single competitor for changes
   */
  private async checkCompetitor(config: CompetitorMonitorConfig): Promise<void> {
    logger.info('Checking competitor for changes', {
      competitorId: config.competitorId,
      domain: config.domain,
    });

    this.resetDailyCountersIfNeeded();

    try {
      // Re-scrape competitor (will use cache if < 30 days)
      const newProfile = await discoverCompetitor(config.domain);

      // Load previous profile from Firestore for comparison
      const profilePath = getSubCollection('competitor_profiles');
      const previousProfile = await FirestoreService.get<CompetitorProfile>(
        profilePath,
        config.competitorId
      );

      // Detect changes if we have a previous profile
      let changes: CompetitorChange[] = [];
      if (previousProfile) {
        changes = this.detectChanges(previousProfile, newProfile, config);
        this.changesDetectedToday += changes.length;

        // Send alerts for each detected change
        for (const change of changes) {
          await this.sendAlert(change);
          change.alertSent = true;
          this.alertsSentToday++;
        }

        if (changes.length > 0) {
          logger.info('Competitor changes detected', {
            competitorId: config.competitorId,
            changesCount: changes.length,
            types: changes.map(c => c.changeType),
          });
        }
      } else {
        logger.info('First check for competitor — no previous profile for comparison', {
          competitorId: config.competitorId,
        });
      }

      // Store updated profile in Firestore for next comparison
      await FirestoreService.set(
        profilePath,
        config.competitorId,
        { ...newProfile, lastUpdated: new Date().toISOString() },
        true // merge
      );

      // Track counters
      this.checksToday++;
      this.lastCheckTime = new Date();

      logger.info('Competitor check complete', {
        competitorId: config.competitorId,
        domain: config.domain,
        featuresFound: newProfile.productOffering.keyFeatures.length,
        strengthsFound: newProfile.analysis.strengths.length,
        weaknessesFound: newProfile.analysis.weaknesses.length,
        changesDetected: changes.length,
      });

      // Update last checked time and calculate next check
      const updatedConfig: CompetitorMonitorConfig = {
        ...config,
        lastChecked: new Date(),
        nextCheck: this.calculateNextCheck(config.checkFrequency),
      };

      this.monitoringConfigs.set(config.competitorId, updatedConfig);

    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Competitor check failed', err, {
        competitorId: config.competitorId,
        domain: config.domain,
      });

      // Still update next check time to avoid retry loops
      const updatedConfig: CompetitorMonitorConfig = {
        ...config,
        lastChecked: new Date(),
        nextCheck: this.calculateNextCheck(config.checkFrequency),
      };

      this.monitoringConfigs.set(config.competitorId, updatedConfig);
    }
  }

  /**
   * Calculate next check time based on frequency
   */
  private calculateNextCheck(frequency: 'daily' | 'weekly' | 'monthly'): Date {
    const now = new Date();
    
    switch (frequency) {
      case 'daily':
        return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly':
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'monthly':
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }

  /**
   * Detect changes between two competitor profiles
   */
  private detectChanges(
    oldProfile: CompetitorProfile,
    newProfile: CompetitorProfile,
    config: CompetitorMonitorConfig
  ): CompetitorChange[] {
    const changes: CompetitorChange[] = [];

    // Pricing changes
    if (config.alertOn.pricingChanges) {
      const pricingChanges = this.detectPricingChanges(oldProfile, newProfile);
      changes.push(...pricingChanges);
    }

    // Feature changes
    if (config.alertOn.featureChanges) {
      const featureChanges = this.detectFeatureChanges(oldProfile, newProfile);
      changes.push(...featureChanges);
    }

    // Positioning changes
    if (config.alertOn.positioningChanges) {
      const positioningChanges = this.detectPositioningChanges(oldProfile, newProfile);
      changes.push(...positioningChanges);
    }

    // Growth signals
    if (config.alertOn.growthSignals) {
      const growthChanges = this.detectGrowthSignals(oldProfile, newProfile);
      changes.push(...growthChanges);
    }

    // New weaknesses
    if (config.alertOn.weaknessesDetected) {
      const weaknessChanges = this.detectNewWeaknesses(oldProfile, newProfile);
      changes.push(...weaknessChanges);
    }

    return changes;
  }

  /**
   * Detect pricing changes
   */
  private detectPricingChanges(
    oldProfile: CompetitorProfile,
    newProfile: CompetitorProfile
  ): CompetitorChange[] {
    const changes: CompetitorChange[] = [];

    // Compare pricing model
    if (oldProfile.pricing.model !== newProfile.pricing.model) {
      changes.push({
        changeId: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        competitorId: newProfile.id,
        competitorName: newProfile.companyName,
        domain: newProfile.domain,
                changeType: 'pricing_update',
        severity: 'high',
        details: {
          field: 'pricing_model',
          oldValue: oldProfile.pricing.model,
          newValue: newProfile.pricing.model,
          impact: 'Competitor changed their pricing strategy',
          recommendedAction: 'Review our pricing positioning and update battlecards',
        },
        detectedAt: new Date(),
        alertSent: false,
      });
    }

    // Compare tier count
    if (oldProfile.pricing.tiers.length !== newProfile.pricing.tiers.length) {
      changes.push({
        changeId: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        competitorId: newProfile.id,
        competitorName: newProfile.companyName,
        domain: newProfile.domain,
                changeType: 'pricing_update',
        severity: 'medium',
        details: {
          field: 'pricing_tiers',
          oldValue: `${oldProfile.pricing.tiers.length} tiers`,
          newValue: `${newProfile.pricing.tiers.length} tiers`,
          impact: 'Competitor adjusted their pricing structure',
          recommendedAction: 'Analyze new tiers and adjust our positioning',
        },
        detectedAt: new Date(),
        alertSent: false,
      });
    }

    return changes;
  }

  /**
   * Detect feature changes
   */
  private detectFeatureChanges(
    oldProfile: CompetitorProfile,
    newProfile: CompetitorProfile
  ): CompetitorChange[] {
    const changes: CompetitorChange[] = [];

    const oldFeatures = new Set(oldProfile.productOffering.keyFeatures.map(f => f.feature));
    const newFeatures = new Set(newProfile.productOffering.keyFeatures.map(f => f.feature));

    // New features added
    for (const feature of newFeatures) {
      if (!oldFeatures.has(feature)) {
        changes.push({
          changeId: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          competitorId: newProfile.id,
          competitorName: newProfile.companyName,
          domain: newProfile.domain,
                    changeType: 'new_feature',
          severity: 'medium',
          details: {
            field: 'features',
            oldValue: 'Feature did not exist',
            newValue: feature,
            impact: 'Competitor added new capability',
            recommendedAction: 'Evaluate if we need to match this feature',
          },
          detectedAt: new Date(),
          alertSent: false,
        });
      }
    }

    // Features removed
    for (const feature of oldFeatures) {
      if (!newFeatures.has(feature)) {
        changes.push({
          changeId: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          competitorId: newProfile.id,
          competitorName: newProfile.companyName,
          domain: newProfile.domain,
                    changeType: 'removed_feature',
          severity: 'low',
          details: {
            field: 'features',
            oldValue: feature,
            newValue: 'Feature removed',
            impact: 'Competitor removed a feature',
            recommendedAction: 'Use this as a competitive advantage',
          },
          detectedAt: new Date(),
          alertSent: false,
        });
      }
    }

    return changes;
  }

  /**
   * Detect positioning changes
   */
  private detectPositioningChanges(
    oldProfile: CompetitorProfile,
    newProfile: CompetitorProfile
  ): CompetitorChange[] {
    const changes: CompetitorChange[] = [];

    // Tagline change
    if (oldProfile.positioning.tagline !== newProfile.positioning.tagline) {
      changes.push({
        changeId: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        competitorId: newProfile.id,
        competitorName: newProfile.companyName,
        domain: newProfile.domain,
                changeType: 'positioning_shift',
        severity: 'medium',
        details: {
          field: 'tagline',
          oldValue:(oldProfile.positioning.tagline !== '' && oldProfile.positioning.tagline != null) ? oldProfile.positioning.tagline : 'None',
          newValue:(newProfile.positioning.tagline !== '' && newProfile.positioning.tagline != null) ? newProfile.positioning.tagline : 'None',
          impact: 'Competitor changed their messaging',
          recommendedAction: 'Analyze new positioning and adjust our messaging',
        },
        detectedAt: new Date(),
        alertSent: false,
      });
    }

    return changes;
  }

  /**
   * Detect growth signals
   */
  private detectGrowthSignals(
    oldProfile: CompetitorProfile,
    newProfile: CompetitorProfile
  ): CompetitorChange[] {
    const changes: CompetitorChange[] = [];

    // Hiring surge
    const hiringIncrease = newProfile.growthSignals.jobCount - oldProfile.growthSignals.jobCount;
    if (hiringIncrease > 10) {
      changes.push({
        changeId: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        competitorId: newProfile.id,
        competitorName: newProfile.companyName,
        domain: newProfile.domain,
                changeType: 'hiring_surge',
        severity: 'high',
        details: {
          field: 'job_count',
          oldValue: `${oldProfile.growthSignals.jobCount} openings`,
          newValue: `${newProfile.growthSignals.jobCount} openings`,
          impact: `Competitor is hiring rapidly (+${hiringIncrease} roles)`,
          recommendedAction: 'Monitor for expansion into new markets or products',
        },
        detectedAt: new Date(),
        alertSent: false,
      });
    }

    // Funding change
    if (oldProfile.socialProof.fundingStage !== newProfile.socialProof.fundingStage) {
      changes.push({
        changeId: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        competitorId: newProfile.id,
        competitorName: newProfile.companyName,
        domain: newProfile.domain,
                changeType: 'funding_announced',
        severity: 'critical',
        details: {
          field: 'funding_stage',
          oldValue:(oldProfile.socialProof.fundingStage !== '' && oldProfile.socialProof.fundingStage != null) ? oldProfile.socialProof.fundingStage : 'Unknown',
          newValue:(newProfile.socialProof.fundingStage !== '' && newProfile.socialProof.fundingStage != null) ? newProfile.socialProof.fundingStage : 'Unknown',
          impact: 'Competitor raised new funding',
          recommendedAction: 'Expect aggressive expansion and pricing pressure',
        },
        detectedAt: new Date(),
        alertSent: false,
      });
    }

    return changes;
  }

  /**
   * Detect new weaknesses
   */
  private detectNewWeaknesses(
    oldProfile: CompetitorProfile,
    newProfile: CompetitorProfile
  ): CompetitorChange[] {
    const changes: CompetitorChange[] = [];

    const oldWeaknesses = new Set(oldProfile.analysis.weaknesses.map(w => w.weakness));
    const newWeaknesses = new Set(newProfile.analysis.weaknesses.map(w => w.weakness));

    for (const weakness of newWeaknesses) {
      if (!oldWeaknesses.has(weakness)) {
        const weaknessData = newProfile.analysis.weaknesses.find(w => w.weakness === weakness);
        if (weaknessData) {
          changes.push({
            changeId: `change_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            competitorId: newProfile.id,
            competitorName: newProfile.companyName,
            domain: newProfile.domain,
                        changeType: 'weakness_detected',
            severity: weaknessData.impact === 'high' ? 'high' : 'medium',
            details: {
              field: 'weaknesses',
              oldValue: 'Weakness not previously detected',
              newValue: weakness,
              impact: `New competitive weakness identified (${weaknessData.impact} impact)`,
              recommendedAction: weaknessData.howToExploit,
            },
            detectedAt: new Date(),
            alertSent: false,
          });
        }
      }
    }

    return changes;
  }

  /**
   * Send alert for detected change
   */
  private async sendAlert(change: CompetitorChange): Promise<void> {
    try {
      const coordinator = getServerSignalCoordinator();

      await coordinator.emitSignal({
        type: 'competitor.updated',
        confidence: 0.9,
        priority: change.severity === 'critical' ? 'High' : change.severity === 'high' ? 'High' : 'Medium',
        metadata: {
          source: 'competitive-monitor',
          competitorId: change.competitorId,
          competitorName: change.competitorName,
          domain: change.domain,
          changeType: change.changeType,
          severity: change.severity,
          field: change.details.field,
          oldValue: change.details.oldValue,
          newValue: change.details.newValue,
          impact: change.details.impact,
          recommendedAction: change.details.recommendedAction,
          detectedAt: change.detectedAt.toISOString(),
        },
      });

      logger.info('Competitor change alert sent', {
        competitorName: change.competitorName,
        changeType: change.changeType,
        severity: change.severity,
      });
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error('Failed to send competitor change alert', err, {
        competitorId: change.competitorId,
      });
    }
  }
}

// ============================================================================
// FACTORY & EXPORTS
// ============================================================================

const monitors = new Map<string, CompetitiveMonitor>();

/**
 * Get or create competitive monitor for organization
 */
export function getCompetitiveMonitor(): CompetitiveMonitor {
  let monitor = monitors.get(PLATFORM_ID);

  if (!monitor) {
    monitor = new CompetitiveMonitor();
    monitors.set(PLATFORM_ID, monitor);
  }

  return monitor;
}

/**
 * Start monitoring for organization
 */
export async function startCompetitiveMonitoring(): Promise<void> {
  const monitor = getCompetitiveMonitor();
  await monitor.start();
}

/**
 * Stop monitoring for organization
 */
export function stopCompetitiveMonitoring(): void {
  const monitor = monitors.get(PLATFORM_ID);
  if (monitor) {
    monitor.stop();
  }
}
