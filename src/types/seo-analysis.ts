/**
 * Shared SEO Analysis Types
 * Used by API routes, components, and the SEO Expert agent
 */

export interface DomainAnalysisResult {
  domain: string;
  analysisDate: string;
  metrics: {
    organicTraffic: number;
    organicKeywords: number;
    domainRank: number;
  };
  backlinkProfile: {
    totalBacklinks: number;
    totalReferringDomains: number;
    dofollow: number;
    nofollow: number;
    anchorLinks: number;
    imageLinks: number;
    redirectLinks: number;
    brokenBacklinks: number;
    referringIPs: number;
    referringSubnets: number;
  };
  referringDomains: Array<{
    domain: string;
    rank: number;
    backlinks: number;
    dofollow: number;
    nofollow: number;
    firstSeen: string | null;
  }>;
  topKeywords: Array<{
    keyword: string;
    position: number;
    url: string;
    searchVolume: number;
    estimatedTraffic: number;
    cpc: number;
  }>;
  topPages: Array<{
    url: string;
    keywords: number;
    traffic: number;
  }>;
  competitors: Array<{
    domain: string;
    avgPosition: number;
    intersections: number;
    relevance: number;
    organicTraffic: number;
    organicKeywords: number;
  }>;
  summary: string;
}

export interface CompetitorEntry {
  id: string;
  domain: string;
  status: 'pending' | 'analyzing' | 'complete' | 'error';
  result: DomainAnalysisResult | null;
  error: string | null;
  addedAt: string;
  analyzedAt: string | null;
}

export interface ThirtyDayStrategy {
  industry: string;
  generatedDate: string;
  weeks: Array<{
    weekNumber: number;
    theme: string;
    tasks: Array<{
      day: number;
      taskType: 'technical' | 'content' | 'outreach' | 'analysis';
      task: string;
      targetKeywords?: string[];
      expectedOutcome: string;
      effort: 'low' | 'medium' | 'high';
    }>;
    keyMetrics: string[];
  }>;
  priorityKeywords: Array<{
    keyword: string;
    currentPosition: number | null;
    targetPosition: number;
    strategy: string;
  }>;
  expectedResults: {
    trafficIncrease: string;
    rankingImprovements: string;
    technicalScore: string;
  };
}
