/**
 * AI Search Monitor Service
 *
 * Checks brand visibility in AI search overviews (Google AI Overview,
 * ChatGPT, Perplexity mentions). Uses Serper's SERP data to detect
 * AI overviews and checks for brand mentions.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getGrowthAiVisibilityCollection } from '@/lib/firebase/collections';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import { getSerperSEOService } from '@/lib/integrations/seo/serper-seo-service';
import { getGrowthActivityLogger } from './growth-activity-logger';
import { getCompetitorMonitorService } from './competitor-monitor';
import type {
  AIVisibilityCheck,
  AIVisibilityQueryResult,
  AICompetitorMention,
} from '@/types/growth';

const OUR_DOMAIN = process.env.NEXT_PUBLIC_SITE_DOMAIN ?? 'salesvelocity.ai';
const OUR_BRAND_NAMES = ['salesvelocity', 'salesvelocity.ai', 'sales velocity'];

// ============================================================================
// SERVICE
// ============================================================================

class AISearchMonitorService {
  /**
   * Run an AI visibility check across a set of queries.
   */
  async runVisibilityCheck(
    queries: string[],
    targetDomain: string,
    initiatedBy: string
  ): Promise<AIVisibilityCheck> {
    if (!adminDb) {throw new Error('Database not available');}

    const serper = getSerperSEOService();
    const competitorService = getCompetitorMonitorService();
    const competitors = await competitorService.listCompetitors({ activeOnly: true, limit: 20 });

    const queryResults: AIVisibilityQueryResult[] = [];
    const competitorMentionMap = new Map<string, { domain: string; name: string; count: number }>();

    // Initialize competitor tracking
    for (const comp of competitors) {
      competitorMentionMap.set(comp.domain, { domain: comp.domain, name: comp.name, count: 0 });
    }

    // Check each query
    for (const query of queries) {
      try {
        const serpResult = await serper.searchSERP(query, { num: 10 });

        if (!serpResult.success || !serpResult.data) {
          queryResults.push({
            query,
            mentioned: false,
            organicPosition: null,
            hasAIOverview: false,
            mentionSnippet: null,
            competitorsMentioned: [],
          });
          continue;
        }

        const data = serpResult.data;

        // Check if our domain appears in organic results
        const ourResult = data.organic.find(
          (r) =>
            r.domain === targetDomain ||
            r.domain === `www.${targetDomain}` ||
            targetDomain === `www.${r.domain}`
        );

        // Check for AI overview by looking at knowledge graph and
        // people-also-ask (as a proxy — Serper doesn't have a direct AI overview field)
        const hasAIOverview = data.knowledgeGraph !== null || data.peopleAlsoAsk.length > 0;

        // Check if our brand is mentioned in snippets or knowledge graph
        let mentioned = false;
        let mentionSnippet: string | null = null;

        // Check knowledge graph
        if (data.knowledgeGraph) {
          const kgText = `${data.knowledgeGraph.title} ${data.knowledgeGraph.description}`.toLowerCase();
          for (const brandName of OUR_BRAND_NAMES) {
            if (kgText.includes(brandName)) {
              mentioned = true;
              mentionSnippet = data.knowledgeGraph.description;
              break;
            }
          }
        }

        // Check organic snippets for brand mentions
        if (!mentioned) {
          for (const organic of data.organic) {
            const snippetText = `${organic.title} ${organic.snippet}`.toLowerCase();
            for (const brandName of OUR_BRAND_NAMES) {
              if (snippetText.includes(brandName)) {
                mentioned = true;
                mentionSnippet = organic.snippet;
                break;
              }
            }
            if (mentioned) {break;}
          }
        }

        // Check People Also Ask for brand mentions
        if (!mentioned) {
          for (const paa of data.peopleAlsoAsk) {
            const paaText = `${paa.question} ${paa.snippet}`.toLowerCase();
            for (const brandName of OUR_BRAND_NAMES) {
              if (paaText.includes(brandName)) {
                mentioned = true;
                mentionSnippet = paa.snippet;
                break;
              }
            }
            if (mentioned) {break;}
          }
        }

        // Track competitor mentions in search results
        const competitorsMentionedInQuery: string[] = [];
        for (const organic of data.organic) {
          const tracker = competitorMentionMap.get(organic.domain) ??
            competitorMentionMap.get(organic.domain.replace('www.', ''));
          if (tracker) {
            tracker.count++;
            competitorsMentionedInQuery.push(tracker.name);
          }
        }

        queryResults.push({
          query,
          mentioned,
          organicPosition: ourResult?.position ?? null,
          hasAIOverview,
          mentionSnippet,
          competitorsMentioned: competitorsMentionedInQuery,
        });
      } catch (err) {
        logger.error('AI Search Monitor query error', err instanceof Error ? err : new Error(String(err)), { query });
        queryResults.push({
          query,
          mentioned: false,
          organicPosition: null,
          hasAIOverview: false,
          mentionSnippet: null,
          competitorsMentioned: [],
        });
      }
    }

    // Calculate aggregate metrics
    const aiOverviewMentions = queryResults.filter((r) => r.mentioned).length;
    const visibilityScore = queries.length > 0
      ? Math.round((aiOverviewMentions / queries.length) * 100)
      : 0;

    // Build competitor mention summary
    const competitorMentions: AICompetitorMention[] = Array.from(competitorMentionMap.values())
      .filter((c) => c.count > 0)
      .map((c) => ({
        domain: c.domain,
        name: c.name,
        mentionCount: c.count,
        mentionRate: queries.length > 0 ? Math.round((c.count / queries.length) * 100) : 0,
      }))
      .sort((a, b) => b.mentionCount - a.mentionCount);

    const now = new Date().toISOString();
    const check: Omit<AIVisibilityCheck, 'id'> = {
      checkedAt: now,
      targetDomain,
      visibilityScore,
      aiOverviewMentions,
      totalQueriesChecked: queries.length,
      queryResults,
      competitorMentions,
      initiatedBy,
    };

    const collectionPath = getGrowthAiVisibilityCollection();
    const docRef = await adminDb.collection(collectionPath).add({
      ...check,
      createdAt: FieldValue.serverTimestamp(),
    });

    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'ai_visibility_checked',
      `AI visibility check: score ${visibilityScore}% (${aiOverviewMentions}/${queries.length} queries mentioned us)`,
      initiatedBy,
      { checkId: docRef.id, score: visibilityScore }
    );

    return { id: docRef.id, ...check };
  }

  /**
   * Get the latest visibility check.
   */
  async getLatestCheck(): Promise<AIVisibilityCheck | null> {
    if (!adminDb) {return null;}

    const collectionPath = getGrowthAiVisibilityCollection();
    const snap = await adminDb
      .collection(collectionPath)
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (snap.empty) {return null;}
    const doc = snap.docs[0];
    return { id: doc.id, ...doc.data() } as AIVisibilityCheck;
  }

  /**
   * Get visibility check history.
   */
  async getHistory(limit: number = 20): Promise<AIVisibilityCheck[]> {
    if (!adminDb) {return [];}

    const collectionPath = getGrowthAiVisibilityCollection();
    const snap = await adminDb
      .collection(collectionPath)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    return snap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as AIVisibilityCheck[];
  }

  /**
   * Run a cron-triggered visibility check using default brand queries.
   */
  async runScheduledCheck(): Promise<AIVisibilityCheck> {
    // Generate a set of relevant queries for the brand
    const defaultQueries = [
      'best sales automation software',
      'ai sales platform',
      'sales velocity tools',
      'crm with ai features',
      'automated marketing platform',
      'sales ai assistant',
      'best sales software for small business',
      'ai powered crm',
      'marketing automation with ai',
      'sales pipeline automation tools',
    ];

    const result = await this.runVisibilityCheck(
      defaultQueries,
      OUR_DOMAIN,
      'cron:ai-visibility'
    );

    const activityLogger = getGrowthActivityLogger();
    await activityLogger.log(
      'cron_ai_visibility',
      `Scheduled AI visibility sweep: score ${result.visibilityScore}%`,
      'cron:ai-visibility',
      { checkId: result.id, score: result.visibilityScore }
    );

    return result;
  }
}

// Singleton
let instance: AISearchMonitorService | null = null;

export function getAISearchMonitorService(): AISearchMonitorService {
  instance ??= new AISearchMonitorService();
  return instance;
}
