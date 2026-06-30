/**
 * Shared SEO Analysis Types
 *
 * Aligned to the SEO Expert specialist's REAL `domain_analysis` output
 * (`src/lib/agents/marketing/seo/specialist.ts` → `DomainAnalysisResultSchema`).
 *
 * The specialist is explicitly instructed NOT to fabricate traffic numbers,
 * backlink counts, DA/DR scores, keyword search volumes, CPC, or ranking
 * positions. It returns a qualitative SEO assessment instead. These types
 * therefore mirror that qualitative shape exactly — the UI renders what the
 * agent really produces, never invented metrics.
 */

export type SeoPriority = 'high' | 'medium' | 'low';
export type SeoImpact = 'high' | 'medium' | 'low';
export type SeoEffort = 'low' | 'medium' | 'high';

export interface DomainAnalysisResult {
  /** Overall assessment. May be prefixed with "[ACTION REQUIRED]" for critical issues. */
  summary: string;
  technicalHealth: {
    /** 0-100 technical SEO health score. */
    score: number;
    /** Concrete technical issues found (at least one). */
    issues: string[];
    /** Technical strengths found (can be empty). */
    strengths: string[];
  };
  contentGaps: Array<{
    topic: string;
    opportunity: string;
    priority: SeoPriority;
  }>;
  recommendations: Array<{
    action: string;
    impact: SeoImpact;
    effort: SeoEffort;
    timeframe: string;
  }>;
  /** Where the domain stands in its industry (challenger / leader / invisible). */
  competitivePosition: string;
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
