/**
 * Predictive Lead Scoring — Server-Only Training Module
 *
 * Uses Firebase Admin SDK for training lead scoring models from historical data.
 * This module MUST only be imported from server-side code (API routes, server actions).
 */

import 'server-only';

import type { Lead } from './lead-service';
import { getActivityStats } from './activity-service';
import { logger } from '@/lib/logger/logger';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase-admin/firestore';
import type { ScoringWeights, ScoringModel } from './predictive-scoring';

// Minimum sample size required for training
const MIN_TRAINING_SAMPLES = 50;

/**
 * Score demographics (title, seniority) — duplicated from client module for server use
 */
function scoreDemographics(lead: Lead): number {
  let score = 50;
  if (lead.title) {
    const title = lead.title.toLowerCase();
    if (/(ceo|cto|cfo|coo|president|vp|vice president|director)/.test(title)) {
      score += 30;
    } else if (/(manager|lead|head)/.test(title)) {
      score += 15;
    } else {
      score += 5;
    }
  } else {
    score -= 20;
  }
  return Math.min(100, Math.max(0, score));
}

/**
 * Score firmographics (company size, industry, revenue)
 */
function scoreFirmographics(lead: Lead): number {
  let score = 50;
  if (lead.enrichmentData) {
    score += 10;
    const enrichment = lead.enrichmentData;
    if (enrichment.companySize) {
      if (enrichment.companySize >= 100) { score += 20; }
      else if (enrichment.companySize >= 50) { score += 15; }
      else if (enrichment.companySize >= 10) { score += 10; }
      else { score += 5; }
    }
    if (enrichment.revenue) {
      if (enrichment.revenue >= 10000000) { score += 20; }
      else if (enrichment.revenue >= 1000000) { score += 15; }
      else if (enrichment.revenue >= 100000) { score += 10; }
    }
    if (enrichment.industry) { score += 10; }
  } else if (lead.company) {
    score += 5;
  } else {
    score -= 20;
  }
  return Math.min(100, Math.max(0, score));
}

interface BehavioralActivityStats {
  lastActivityDate?: string | Date;
  avgActivitiesPerDay?: number;
  engagementScore?: number;
}

/**
 * Score behavioral signals
 */
function scoreBehavioralSignals(lead: Lead, activityStats: BehavioralActivityStats): number {
  let score = 50;
  if (activityStats.lastActivityDate) {
    const daysSince = (Date.now() - new Date(activityStats.lastActivityDate).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 1) { score += 25; }
    else if (daysSince < 3) { score += 15; }
    else if (daysSince < 7) { score += 5; }
    else { score -= 10; }
  }
  if (activityStats.avgActivitiesPerDay) {
    if (activityStats.avgActivitiesPerDay > 1) { score += 15; }
    else if (activityStats.avgActivitiesPerDay > 0.5) { score += 10; }
    else if (activityStats.avgActivitiesPerDay > 0.2) { score += 5; }
  }
  if (lead.source) {
    const highQualitySources = ['Referral', 'Website', 'Demo Request'];
    const mediumQualitySources = ['Social Media', 'Email Campaign'];
    if (highQualitySources.includes(lead.source)) { score += 10; }
    else if (mediumQualitySources.includes(lead.source)) { score += 5; }
  }
  return Math.min(100, Math.max(0, score));
}

/**
 * Train scoring model from historical conversion data
 * Uses logistic regression approximation to adjust weights based on predictive power
 */
export async function trainFromHistoricalData(workspaceId: string): Promise<ScoringModel | null> {
  try {
    if (!adminDal) {
      throw new Error('Admin DAL not initialized');
    }

    logger.info('Starting lead scoring model training', { workspaceId });

    const leadsRef = adminDal.getNestedCollection(
      `${getSubCollection('workspaces')}/{wsId}/entities/leads/records`,
      { wsId: workspaceId }
    );

    const [convertedSnapshot, lostSnapshot] = await Promise.all([
      leadsRef.where('status', '==', 'converted').get(),
      leadsRef.where('status', '==', 'lost').get(),
    ]);

    const totalSamples = convertedSnapshot.size + lostSnapshot.size;

    if (totalSamples < MIN_TRAINING_SAMPLES) {
      logger.warn('Insufficient training data', {
        totalSamples,
        required: MIN_TRAINING_SAMPLES,
      });
      return null;
    }

    const convertedLeads = convertedSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[];
    const lostLeads = lostSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Lead[];

    const convertedFeatures = { demographics: 0, firmographics: 0, engagement: 0, behavioral: 0 };
    const lostFeatures = { demographics: 0, firmographics: 0, engagement: 0, behavioral: 0 };

    for (const lead of convertedLeads) {
      convertedFeatures.demographics += scoreDemographics(lead);
      convertedFeatures.firmographics += scoreFirmographics(lead);
      const stats = await getActivityStats(workspaceId, 'lead', lead.id);
      convertedFeatures.engagement += stats.engagementScore ?? 0;
      convertedFeatures.behavioral += scoreBehavioralSignals(lead, stats);
    }

    for (const lead of lostLeads) {
      lostFeatures.demographics += scoreDemographics(lead);
      lostFeatures.firmographics += scoreFirmographics(lead);
      const stats = await getActivityStats(workspaceId, 'lead', lead.id);
      lostFeatures.engagement += stats.engagementScore ?? 0;
      lostFeatures.behavioral += scoreBehavioralSignals(lead, stats);
    }

    const convertedAvg = {
      demographics: convertedFeatures.demographics / convertedLeads.length,
      firmographics: convertedFeatures.firmographics / convertedLeads.length,
      engagement: convertedFeatures.engagement / convertedLeads.length,
      behavioral: convertedFeatures.behavioral / convertedLeads.length,
    };

    const lostAvg = {
      demographics: lostFeatures.demographics / lostLeads.length,
      firmographics: lostFeatures.firmographics / lostLeads.length,
      engagement: lostFeatures.engagement / lostLeads.length,
      behavioral: lostFeatures.behavioral / lostLeads.length,
    };

    const predictivePower = {
      demographics: Math.abs(convertedAvg.demographics - lostAvg.demographics) / 100,
      firmographics: Math.abs(convertedAvg.firmographics - lostAvg.firmographics) / 100,
      engagement: Math.abs(convertedAvg.engagement - lostAvg.engagement) / 100,
      behavioral: Math.abs(convertedAvg.behavioral - lostAvg.behavioral) / 100,
    };

    const totalPower =
      predictivePower.demographics +
      predictivePower.firmographics +
      predictivePower.engagement +
      predictivePower.behavioral;

    const trainedWeights: ScoringWeights = {
      demographics: predictivePower.demographics / totalPower,
      firmographics: predictivePower.firmographics / totalPower,
      engagement: predictivePower.engagement / totalPower,
      behavioral: predictivePower.behavioral / totalPower,
    };

    const accuracy = convertedLeads.length / totalSamples;

    const model: ScoringModel = {
      weights: trainedWeights,
      modelVersion: `v1.0-${Date.now()}`,
      trainedAt: new Date(),
      sampleSize: totalSamples,
      accuracy,
    };

    await adminDal.getNestedDocRef(
      `${getSubCollection('config')}/scoringWeights`,
      {}
    ).set({
      weights: trainedWeights,
      modelVersion: model.modelVersion,
      trainedAt: Timestamp.fromDate(model.trainedAt),
      sampleSize: model.sampleSize,
      accuracy: model.accuracy,
    });

    logger.info('Lead scoring model trained successfully', {
      modelVersion: model.modelVersion,
      sampleSize: model.sampleSize,
      accuracy: `${Math.round(accuracy * 100)}%`,
      demographics: trainedWeights.demographics,
      firmographics: trainedWeights.firmographics,
      engagement: trainedWeights.engagement,
      behavioral: trainedWeights.behavioral,
    });

    return model;
  } catch (error) {
    logger.error('Failed to train scoring model', error instanceof Error ? error : new Error(String(error)));
    throw new Error(`Model training failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
