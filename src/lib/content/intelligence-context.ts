/**
 * Intelligence Context Builder
 *
 * When the Content Manager is about to brief BLOG_WRITER (or any other content
 * specialist), it needs to pass the actual research output from upstream
 * Intelligence steps — not the shallow synthesis rollup the UI uses.
 *
 * The synthesis layer (intelligence/manager.ts:generateSynthesis) extracts
 * only hand-picked shallow fields ("Identified N competitors", "N pivot
 * recommendations available") and throws the rest away. But the **full
 * brief** — including competitor positioning narratives, strengths,
 * weaknesses, market gaps, trend signals with urgency — is preserved in
 * the MemoryVault under category STRATEGY, keyed by `intelligence_brief_*`.
 *
 * This module reads the latest brief from the vault and formats it into a
 * plain-text research block that BLOG_WRITER can embed in its user message
 * to the LLM. The LLM then has the raw research to cite and synthesize,
 * instead of generating generic industry commentary.
 *
 * Returns null when no intelligence brief is available (pure content-only
 * missions, or cases where the Intelligence Manager hasn't produced a brief
 * yet). Callers should treat null as "no research — brief BLOG_WRITER
 * without research context."
 */

import { getMemoryVault } from '@/lib/agents/shared/memory-vault';

// ============================================================================
// TYPES — shapes we care about extracting from the raw brief
// ============================================================================

interface RawCompetitor {
  rank?: number;
  name?: string;
  url?: string;
  positioning?: {
    tagline?: string;
    targetAudience?: string;
    pricePoint?: string;
  };
  positioningNarrative?: string;
  strengths?: string[];
  weaknesses?: string[];
}

interface RawMarketInsights {
  saturation?: string;
  saturationReasoning?: string;
  dominantPlayers?: string[];
  gaps?: string[];
  opportunities?: string[];
  recommendations?: string[];
  competitiveDynamics?: string;
}

interface RawTrendSignal {
  type?: string;
  urgency?: string;
  title?: string;
  description?: string;
}

// The brief shape from intelligence/manager.ts:IntelligenceBrief — fields
// we extract are optional because older/failed runs may omit them.
interface VaultBrief {
  briefId?: string;
  completedAt?: Date | string;
  competitorAnalysis?: {
    competitors?: RawCompetitor[];
    marketInsights?: RawMarketInsights;
  } | null;
  trendAnalysis?: {
    signals?: RawTrendSignal[];
  } | null;
}

// ============================================================================
// FORMATTERS
// ============================================================================

function formatCompetitor(c: RawCompetitor, idx: number): string {
  const lines: string[] = [];
  const header = c.name ? `${idx + 1}. ${c.name}` : `${idx + 1}. (Unnamed competitor)`;
  lines.push(header + (c.url ? ` — ${c.url}` : ''));

  if (c.positioning?.tagline) {
    lines.push(`   Tagline: ${c.positioning.tagline}`);
  }
  if (c.positioning?.targetAudience) {
    lines.push(`   Target audience: ${c.positioning.targetAudience}`);
  }
  if (c.positioning?.pricePoint) {
    lines.push(`   Price point: ${c.positioning.pricePoint}`);
  }
  if (c.positioningNarrative) {
    lines.push(`   Positioning: ${c.positioningNarrative}`);
  }
  if (c.strengths && c.strengths.length > 0) {
    lines.push(`   Strengths: ${c.strengths.join('; ')}`);
  }
  if (c.weaknesses && c.weaknesses.length > 0) {
    lines.push(`   Weaknesses: ${c.weaknesses.join('; ')}`);
  }

  return lines.join('\n');
}

function formatMarketInsights(m: RawMarketInsights): string {
  const lines: string[] = [];
  if (m.saturation) {
    lines.push(`Market saturation: ${m.saturation}${m.saturationReasoning ? ` — ${m.saturationReasoning}` : ''}`);
  }
  if (m.dominantPlayers && m.dominantPlayers.length > 0) {
    lines.push(`Dominant players: ${m.dominantPlayers.join(', ')}`);
  }
  if (m.competitiveDynamics) {
    lines.push(`Competitive dynamics: ${m.competitiveDynamics}`);
  }
  if (m.gaps && m.gaps.length > 0) {
    lines.push('Market gaps:');
    for (const g of m.gaps) { lines.push(`  - ${g}`); }
  }
  if (m.opportunities && m.opportunities.length > 0) {
    lines.push('Opportunities:');
    for (const o of m.opportunities) { lines.push(`  - ${o}`); }
  }
  if (m.recommendations && m.recommendations.length > 0) {
    lines.push('Analyst recommendations:');
    for (const r of m.recommendations) { lines.push(`  - ${r}`); }
  }
  return lines.join('\n');
}

function formatTrendSignals(signals: RawTrendSignal[]): string {
  const lines: string[] = ['Trend signals:'];
  for (const s of signals.slice(0, 10)) {
    const tag = s.type ? `[${s.type}]` : '';
    const urgency = s.urgency ? `(${s.urgency})` : '';
    const title = s.title ?? '(untitled signal)';
    const desc = s.description ? ` — ${s.description}` : '';
    lines.push(`  ${tag}${urgency} ${title}${desc}`);
  }
  return lines.join('\n');
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Build a plain-text research context block from the latest intelligence
 * brief in MemoryVault. Returns null if no brief is available.
 *
 * Why plain text: the downstream consumer is an LLM, which reads natural
 * language better than JSON for narrative briefing.
 */
export async function buildResearchContextFromVault(
  consumerAgentId: string,
): Promise<string | null> {
  const vault = getMemoryVault();

  const entries = await vault.query(consumerAgentId, {
    category: 'STRATEGY',
    tags: ['intelligence'],
  });

  if (entries.length === 0) { return null; }

  // Most recent first — brief entries are keyed by `intelligence_brief_*`
  // and carry createdAt. Sort DESC and pick the most recent.
  entries.sort((a, b) => {
    const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
    const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
    return bTime - aTime;
  });

  const latest = entries[0];
  const brief = latest.value as VaultBrief | undefined;
  if (!brief) { return null; }

  const sections: string[] = [];

  // Competitor research — the meat of what we usually want to cite
  const comp = brief.competitorAnalysis;
  if (comp && Array.isArray(comp.competitors) && comp.competitors.length > 0) {
    sections.push('## Competitors researched');
    for (let i = 0; i < comp.competitors.length; i++) {
      sections.push(formatCompetitor(comp.competitors[i], i));
    }
    if (comp.marketInsights) {
      sections.push('');
      sections.push('## Market insights');
      sections.push(formatMarketInsights(comp.marketInsights));
    }
  }

  // Trend signals — forward-looking context
  const trend = brief.trendAnalysis;
  if (trend && Array.isArray(trend.signals) && trend.signals.length > 0) {
    sections.push('');
    sections.push('## Trends and signals');
    sections.push(formatTrendSignals(trend.signals));
  }

  if (sections.length === 0) { return null; }

  return sections.join('\n');
}
