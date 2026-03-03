/**
 * Competitor Monitor Service
 *
 * Wraps the CompetitorResearcher specialist + DataForSEO domain metrics
 * with Firestore persistence and change detection. This is the service
 * layer for all competitor-related Growth Command Center operations.
 */

import { adminDb } from '@/lib/firebase/admin';
import {
  getGrowthCompetitorsCollection,
  getGrowthCompetitorSnapshotsCollection,
} from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import {
  getCompetitorResearcher,
  type CompetitorSearchRequest,
} from '@/lib/agents/intelligence/competitor/specialist';
import { getDataForSEOService } from '@/lib/integrations/seo/dataforseo-service';
import { getGrowthActivityLogger } from './growth-activity-logger';
import type {
  CompetitorProfile,
  CompetitorSnapshot,
} from '@/types/growth';

// ============================================================================
// SERVICE
// ============================================================================

class CompetitorMonitorService {
  /**
   * Add a competitor by domain. Runs full analysis immediately.
   */
  async addCompetitor(
    domain: string,
    name: string,
    niche: string,
    addedBy: string
  ): Promise<CompetitorProfile> {
    if (!adminDb) {throw new Error('Database not available');}

    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .toLowerCase();

    // Check for existing
    const existing = await this.getByDomain(cleanDomain);
    if (existing) {
      throw new Error(`Competitor ${cleanDomain} is already being tracked`);
    }

    // Fetch domain metrics from DataForSEO
    const dataForSEO = getDataForSEOService();
    const metricsResult = await dataForSEO.getDomainMetrics(cleanDomain);
    const metrics = metricsResult.data;

    const now = new Date().toISOString();
    const profile: Omit<CompetitorProfile, 'id'> = {
      domain: cleanDomain,
      name,
      url: `https://${cleanDomain}`,
      tagline: '',
      niche,
      domainAuthority: metrics?.domainRank ?? 0,
      organicTraffic: metrics?.organicTraffic ?? 0,
      organicKeywords: metrics?.organicKeywords ?? 0,
      backlinks: metrics?.backlinks ?? 0,
      referringDomains: metrics?.referringDomains ?? 0,
      techStack: [],
      strengths: [],
      weaknesses: [],
      positioning: '',
      addedAt: now,
      lastAnalyzedAt: now,
      addedBy,
      isActive: true,
    };

    const collectionPath = getGrowthCompetitorsCollection();
    const docRef = await adminDb.collection(collectionPath).add({
      ...profile,
      createdAt: FieldValue.serverTimestamp(),
    });

    const result: CompetitorProfile = { id: docRef.id, ...profile };

    // Take initial snapshot
    await this.captureSnapshot(result);

    // Log activity
    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'competitor_added',
      `Added competitor: ${name} (${cleanDomain})`,
      addedBy,
      { competitorId: docRef.id, domain: cleanDomain }
    );

    return result;
  }

  /**
   * Discover competitors using the CompetitorResearcher agent.
   */
  async discoverCompetitors(
    niche: string,
    location: string,
    limit: number,
    requestedBy: string
  ): Promise<{
    competitors: Array<{
      name: string;
      domain: string;
      url: string;
      domainAuthority: number;
      strengths: string[];
      weaknesses: string[];
    }>;
    marketInsights: {
      saturation: string;
      gaps: string[];
      recommendations: string[];
    };
  }> {
    const researcher = getCompetitorResearcher();
    const request: CompetitorSearchRequest = {
      niche,
      location,
      limit,
      includeAnalysis: true,
    };

    const result = await researcher.findCompetitors(request);

    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'competitor_discovered',
      `Discovered ${result.competitors.length} competitors in ${niche} (${location})`,
      requestedBy,
      { niche, location, count: result.competitors.length }
    );

    return {
      competitors: result.competitors.map((c) => ({
        name: c.name,
        domain: c.domain,
        url: c.url,
        domainAuthority: c.seoMetrics.domainAuthority,
        strengths: c.strengths,
        weaknesses: c.weaknesses,
      })),
      marketInsights: {
        saturation: result.marketInsights.saturation,
        gaps: result.marketInsights.gaps,
        recommendations: result.marketInsights.recommendations,
      },
    };
  }

  /**
   * Get a single competitor by Firestore ID.
   */
  async getById(competitorId: string): Promise<CompetitorProfile | null> {
    if (!adminDb) {return null;}

    const collectionPath = getGrowthCompetitorsCollection();
    const doc = await adminDb.collection(collectionPath).doc(competitorId).get();
    if (!doc.exists) {return null;}

    return { id: doc.id, ...doc.data() } as CompetitorProfile;
  }

  /**
   * Get a competitor by domain name.
   */
  async getByDomain(domain: string): Promise<CompetitorProfile | null> {
    if (!adminDb) {return null;}

    const collectionPath = getGrowthCompetitorsCollection();
    const snap = await adminDb
      .collection(collectionPath)
      .where('domain', '==', domain.toLowerCase())
      .limit(1)
      .get();

    if (snap.empty) {return null;}

    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as CompetitorProfile;
  }

  /**
   * List all tracked competitors.
   */
  async listCompetitors(options: {
    activeOnly?: boolean;
    limit?: number;
  } = {}): Promise<CompetitorProfile[]> {
    if (!adminDb) {return [];}

    const collectionPath = getGrowthCompetitorsCollection();
    let query: FirebaseFirestore.Query = adminDb
      .collection(collectionPath)
      .orderBy('domainAuthority', 'desc');

    if (options.activeOnly !== undefined) {
      query = query.where('isActive', '==', options.activeOnly);
    }

    query = query.limit(options.limit ?? 50);

    const snap = await query.get();
    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as CompetitorProfile[];
  }

  /**
   * Re-analyze a competitor: refresh metrics and capture new snapshot.
   */
  async reanalyzeCompetitor(
    competitorId: string,
    requestedBy: string
  ): Promise<CompetitorProfile> {
    if (!adminDb) {throw new Error('Database not available');}

    const profile = await this.getById(competitorId);
    if (!profile) {throw new Error('Competitor not found');}

    const dataForSEO = getDataForSEOService();
    const metricsResult = await dataForSEO.getDomainMetrics(profile.domain);
    const metrics = metricsResult.data;

    const now = new Date().toISOString();
    const updates: Partial<CompetitorProfile> = {
      domainAuthority: metrics?.domainRank ?? profile.domainAuthority,
      organicTraffic: metrics?.organicTraffic ?? profile.organicTraffic,
      organicKeywords: metrics?.organicKeywords ?? profile.organicKeywords,
      backlinks: metrics?.backlinks ?? profile.backlinks,
      referringDomains: metrics?.referringDomains ?? profile.referringDomains,
      lastAnalyzedAt: now,
    };

    const collectionPath = getGrowthCompetitorsCollection();
    await adminDb.collection(collectionPath).doc(competitorId).update(updates);

    const updated = { ...profile, ...updates };

    // Capture new snapshot
    await this.captureSnapshot(updated);

    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'competitor_analyzed',
      `Re-analyzed competitor: ${profile.name} (DA: ${updates.domainAuthority})`,
      requestedBy,
      { competitorId, domain: profile.domain }
    );

    return updated;
  }

  /**
   * Remove a competitor (soft-delete: set isActive=false).
   */
  async removeCompetitor(
    competitorId: string,
    removedBy: string
  ): Promise<void> {
    if (!adminDb) {throw new Error('Database not available');}

    const profile = await this.getById(competitorId);
    if (!profile) {throw new Error('Competitor not found');}

    const collectionPath = getGrowthCompetitorsCollection();
    await adminDb.collection(collectionPath).doc(competitorId).update({
      isActive: false,
    });

    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'competitor_removed',
      `Removed competitor: ${profile.name} (${profile.domain})`,
      removedBy,
      { competitorId, domain: profile.domain }
    );
  }

  /**
   * Capture a point-in-time snapshot of competitor metrics.
   */
  private async captureSnapshot(profile: CompetitorProfile): Promise<void> {
    if (!adminDb) {return;}

    const collectionPath = getGrowthCompetitorSnapshotsCollection();
    await adminDb.collection(collectionPath).add({
      competitorId: profile.id,
      domain: profile.domain,
      domainAuthority: profile.domainAuthority,
      organicTraffic: profile.organicTraffic,
      organicKeywords: profile.organicKeywords,
      backlinks: profile.backlinks,
      referringDomains: profile.referringDomains,
      capturedAt: FieldValue.serverTimestamp(),
    });
  }

  /**
   * Get historical snapshots for a competitor.
   */
  async getSnapshots(
    competitorId: string,
    limit: number = 30
  ): Promise<CompetitorSnapshot[]> {
    if (!adminDb) {return [];}

    const collectionPath = getGrowthCompetitorSnapshotsCollection();
    const snap = await adminDb
      .collection(collectionPath)
      .where('competitorId', '==', competitorId)
      .orderBy('capturedAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        competitorId: data.competitorId as string,
        domain: data.domain as string,
        domainAuthority: data.domainAuthority as number,
        organicTraffic: data.organicTraffic as number,
        organicKeywords: data.organicKeywords as number,
        backlinks: data.backlinks as number,
        referringDomains: data.referringDomains as number,
        capturedAt: (data.capturedAt as { toDate: () => Date } | undefined)?.toDate?.().toISOString() ?? new Date().toISOString(),
      };
    });
  }

  /**
   * Re-scan ALL active competitors. Used by the weekly cron.
   */
  async scanAllCompetitors(): Promise<{
    scanned: number;
    errors: string[];
  }> {
    const competitors = await this.listCompetitors({ activeOnly: true });
    const errs: string[] = [];
    let scanned = 0;

    for (const competitor of competitors) {
      try {
        await this.reanalyzeCompetitor(competitor.id, 'cron:competitor-monitor');
        scanned++;
      } catch (err) {
        const msg = `Failed to scan ${competitor.domain}: ${err instanceof Error ? err.message : String(err)}`;
        errs.push(msg);
        logger.error('CompetitorMonitor scan error', new Error(msg));
      }
    }

    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'cron_competitor_scan',
      `Weekly competitor scan: ${scanned} scanned, ${errs.length} errors`,
      'cron:competitor-monitor',
      { scanned, errors: errs.length }
    );

    return { scanned, errors: errs };
  }
}

// Singleton
let instance: CompetitorMonitorService | null = null;

export function getCompetitorMonitorService(): CompetitorMonitorService {
  instance ??= new CompetitorMonitorService();
  return instance;
}
