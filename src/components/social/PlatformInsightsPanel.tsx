'use client';

/**
 * PlatformInsightsPanel — operator-facing AI guidance card on every
 * per-platform dashboard.
 *
 * Surfaces three things produced by the platform specialist:
 *   1. Best times to post for THIS brand on THIS platform
 *   2. Trending topics in the brand's niche
 *   3. Suggested content (ready-to-queue post ideas)
 *
 * On mount, GETs any previously saved insights from Firestore so the panel
 * is pre-populated after a page reload (no LLM call on load).
 * The Generate / Refresh button POSTs to regenerate and overwrites the saved doc.
 *
 * "Best times" tiles each carry an Adopt / Adopted toggle that writes the
 * parsed TimeSlot into the platform's autonomous-agent preferredPostingTimes
 * setting via PUT /api/social/platforms/{platform}/preferred-times.
 * Manual scheduling (Post now / Schedule picker) is entirely separate and
 * untouched — adopted slots only bias AI auto-scheduling.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  Brain,
  Check,
  Clock,
  Flame,
  Lightbulb,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { SocialPlatform, TimeSlot } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import {
  parseSuggestionSlot,
  deduplicateSlots,
  isSuggestionAdopted,
} from '@/lib/social/parse-suggestion-slot';
import { normalizeFormat } from '@/lib/social/format-normalizer';

// ─── Local types that mirror PlatformInsightsResult ──────────────────────────
// Kept local so this client component carries no server-only imports.

interface OptimalPostingTime {
  dayOfWeek: string;
  timeWindow: string;
  reasoning: string;
}

interface TrendingTopic {
  topic: string;
  whyItMatters: string;
  angleForBrand: string;
}

interface SuggestedContent {
  hook: string;
  body: string;
  format: string;
  bestPostedAt: string;
}

interface TrendingTag {
  tag: string;
  whyRelevant: string;
}

interface DiscoverySeo {
  recommendedHashtags: string[];
  trendingTags: TrendingTag[];
  keywords: string[];
  platformSpecific: Record<string, string>;
}

interface PlatformInsightsResult {
  optimalPostingTimes: OptimalPostingTime[];
  trendingTopics: TrendingTopic[];
  suggestedContent: SuggestedContent[];
  audienceNotes: string;
  /** May be absent on insights generated before this feature shipped. */
  discoverySeo?: DiscoverySeo;
}

interface InsightsResponse {
  success: boolean;
  insights?: PlatformInsightsResult | null;
  specialistName?: string | null;
  generatedAt?: string;
  connected?: boolean;
  error?: string;
}

interface PreferredTimesResponse {
  success: boolean;
  slots?: TimeSlot[];
  error?: string;
}

interface ComposerTagsResponse {
  success: boolean;
  hashtags?: string[];
  keywords?: string[];
  platformSpecific?: Record<string, string>;
  error?: string;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlatformInsightsPanelProps {
  platform: SocialPlatform;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface GeneratePostResponse {
  success: boolean;
  missionId?: string;
  error?: string;
}

export default function PlatformInsightsPanel({ platform }: PlatformInsightsPanelProps) {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const toast = useToast();
  const meta = PLATFORM_META[platform];

  const [initialLoading, setInitialLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<PlatformInsightsResult | null>(null);
  const [specialistName, setSpecialistName] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  // Preferred times state — loaded on mount alongside saved insights
  const [preferredSlots, setPreferredSlots] = useState<TimeSlot[]>([]);
  // Per-tile adopt-in-flight flag keyed by index in optimalPostingTimes
  const [adoptingIndex, setAdoptingIndex] = useState<number | null>(null);
  const [adoptError, setAdoptError] = useState<string | null>(null);

  // Per-suggestion-card "Use this content" in-flight flag keyed by card index
  const [usingContentIndex, setUsingContentIndex] = useState<number | null>(null);

  // Saved composer tags — loaded on mount, updated when operator adopts tags
  const [savedHashtags, setSavedHashtags] = useState<string[]>([]);
  const [savedKeywords, setSavedKeywords] = useState<string[]>([]);
  // In-flight flag for tag adoption
  const [adoptingTags, setAdoptingTags] = useState(false);
  const [adoptTagsError, setAdoptTagsError] = useState<string | null>(null);

  // ── Load saved insights + preferred times on mount ───────────────────────
  useEffect(() => {
    let cancelled = false;

    const loadSaved = async () => {
      try {
        // Fire all three reads in parallel — none depends on the others
        const [insightsRes, timesRes, tagsRes] = await Promise.all([
          authFetch(`/api/social/platforms/${platform}/insights`),
          authFetch(`/api/social/platforms/${platform}/preferred-times`),
          authFetch(`/api/social/platforms/${platform}/composer-tags`),
        ]);

        if (cancelled) { return; }

        const insightsBody = (await insightsRes.json()) as InsightsResponse;
        const timesBody = (await timesRes.json()) as PreferredTimesResponse;
        const tagsBody = (await tagsRes.json()) as ComposerTagsResponse;

        if (insightsBody.success && insightsBody.insights) {
          setInsights(insightsBody.insights);
          setSpecialistName(insightsBody.specialistName ?? null);
          setGeneratedAt(insightsBody.generatedAt ?? null);
        }

        if (timesBody.success && timesBody.slots) {
          setPreferredSlots(timesBody.slots);
        }

        if (tagsBody.success) {
          setSavedHashtags(tagsBody.hashtags ?? []);
          setSavedKeywords(tagsBody.keywords ?? []);
        }
      } catch {
        // Network errors on initial load are swallowed — empty state is fine
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    };

    void loadSaved();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platform]);
  // authFetch intentionally omitted from dep array — see comment in original.

  // ── Generate / Refresh (POST — calls LLM, persists result) ──────────────
  const generateInsights = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await authFetch(`/api/social/platforms/${platform}/insights`, {
        method: 'POST',
      });
      const body = (await res.json()) as InsightsResponse;
      if (!res.ok || !body.success || !body.insights) {
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setInsights(body.insights);
      setSpecialistName(body.specialistName ?? null);
      setGeneratedAt(body.generatedAt ?? new Date().toISOString());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate insights');
    } finally {
      setGenerating(false);
    }
  }, [authFetch, platform]);

  // ── Adopt a single posting-time suggestion ───────────────────────────────
  const adoptSlot = useCallback(async (suggestion: OptimalPostingTime, index: number) => {
    if (adoptingIndex !== null) { return; } // prevent concurrent adopts

    setAdoptingIndex(index);
    setAdoptError(null);

    try {
      const incoming = parseSuggestionSlot(suggestion, platform);
      const merged = deduplicateSlots(preferredSlots, incoming);

      const res = await authFetch(
        `/api/social/platforms/${platform}/preferred-times`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slots: merged }),
        },
      );

      const body = (await res.json()) as PreferredTimesResponse;

      if (!res.ok || !body.success) {
        setAdoptError(body.error ?? `HTTP ${res.status}`);
        return;
      }

      // Update local state only after server confirms write
      setPreferredSlots(body.slots ?? merged);
    } catch (e) {
      setAdoptError(e instanceof Error ? e.message : 'Failed to save slot');
    } finally {
      setAdoptingIndex(null);
    }
  }, [adoptingIndex, authFetch, platform, preferredSlots]);

  // ── Adopt hashtags/keywords from the Discovery & SEO section ────────────
  const adoptTags = useCallback(async (
    incomingHashtags: string[],
    incomingKeywords: string[],
  ) => {
    if (adoptingTags) { return; }
    setAdoptingTags(true);
    setAdoptTagsError(null);

    // Merge new tags into saved set — deduplicate, preserve existing.
    const mergedHashtags = Array.from(new Set([...savedHashtags, ...incomingHashtags]));
    const mergedKeywords = Array.from(new Set([...savedKeywords, ...incomingKeywords]));

    try {
      const res = await authFetch(
        `/api/social/platforms/${platform}/composer-tags`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hashtags: mergedHashtags,
            keywords: mergedKeywords,
            platformSpecific: {},
          }),
        },
      );

      const body = (await res.json()) as ComposerTagsResponse;

      if (!res.ok || !body.success) {
        setAdoptTagsError(body.error ?? `HTTP ${res.status}`);
        return;
      }

      // Optimistic update — server echoes back the merged sets
      setSavedHashtags(body.hashtags ?? mergedHashtags);
      setSavedKeywords(body.keywords ?? mergedKeywords);
    } catch (e) {
      setAdoptTagsError(e instanceof Error ? e.message : 'Failed to save tags');
    } finally {
      setAdoptingTags(false);
    }
  }, [adoptingTags, authFetch, platform, savedHashtags, savedKeywords]);

  // ── "Use this content" — spawn a generate-post mission ─────────────────
  const startContentMission = useCallback(async (idea: SuggestedContent, index: number) => {
    if (usingContentIndex !== null) { return; } // prevent concurrent requests
    setUsingContentIndex(index);
    try {
      const res = await authFetch(
        `/api/social/platforms/${platform}/generate-post`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            hook: idea.hook,
            body: idea.body,
            format: normalizeFormat(idea.format),
          }),
        },
      );
      const data = (await res.json()) as GeneratePostResponse;
      if (!res.ok || !data.success) {
        toast.error(data.error ?? `HTTP ${res.status} — could not start mission`);
        return;
      }
      toast.success('Mission started — review at the top of this page');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to start mission');
    } finally {
      setUsingContentIndex(null);
    }
  }, [authFetch, platform, router, toast, usingContentIndex]);

  const generatedRelative = generatedAt ? formatRelative(generatedAt) : null;

  // Show full skeleton only during the initial Firestore read
  const showSkeleton = initialLoading;
  const loading = generating;

  // Count adopted tiles for the header pill
  const totalTiles = insights?.optimalPostingTimes.length ?? 0;
  const adoptedCount = insights?.optimalPostingTimes.filter((s) =>
    isSuggestionAdopted(s, platform, preferredSlots)
  ).length ?? 0;

  return (
    <Card className="border-primary/30 bg-primary/[0.03] w-full h-full flex flex-col">
      <CardHeader className="pb-3 flex-shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" aria-hidden />
            <CardTitle className="text-base">
              {specialistName ? `${specialistName} Insights` : `AI Insights for ${meta.label}`}
            </CardTitle>
          </div>
          <div className="flex items-center gap-3">
            {generatedRelative && (
              <span className="text-xs text-muted-foreground">
                Generated {generatedRelative}
              </span>
            )}
            <Button
              size="sm"
              variant={insights ? 'outline' : 'default'}
              onClick={() => { void generateInsights(); }}
              disabled={loading || showSkeleton}
              className="h-7 px-3 gap-1.5"
            >
              {loading ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : insights ? (
                <RefreshCw size={12} />
              ) : (
                <Sparkles size={12} />
              )}
              <span className="text-xs font-semibold">
                {loading ? 'Generating...' : insights ? 'Refresh' : 'Generate insights'}
              </span>
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-5 flex-1 overflow-y-auto">
        {/* Initial load skeleton */}
        {showSkeleton && (
          <div className="space-y-3">
            <div className="h-4 w-1/3 rounded bg-surface-elevated animate-pulse" />
            <div className="h-20 w-full rounded bg-surface-elevated animate-pulse" />
            <div className="h-20 w-full rounded bg-surface-elevated animate-pulse" />
          </div>
        )}

        {/* Generation skeleton (overlay while refreshing, no existing insights yet) */}
        {!showSkeleton && loading && !insights && (
          <div className="space-y-3">
            <div className="h-4 w-1/3 rounded bg-surface-elevated animate-pulse" />
            <div className="h-20 w-full rounded bg-surface-elevated animate-pulse" />
            <div className="h-20 w-full rounded bg-surface-elevated animate-pulse" />
          </div>
        )}

        {/* Empty state — shown only once initial load finishes and no insights exist */}
        {!showSkeleton && !insights && !loading && !error && (
          <div className="rounded-lg border border-dashed border-border-strong bg-card p-5 text-center">
            <Sparkles className="mx-auto mb-2 h-5 w-5 text-primary" aria-hidden />
            <p className="text-sm text-foreground font-medium">
              No insights yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Click <span className="font-semibold">Generate insights</span> to have your{' '}
              {meta.label} specialist analyze the best times to post, trending topics in
              your niche, and ready-to-queue content ideas.
            </p>
          </div>
        )}

        {/* Error state */}
        {!showSkeleton && error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-sm text-destructive font-medium">
              Couldn&apos;t generate insights
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          </div>
        )}

        {/* Adopt error — shown beneath the insights body, above content */}
        {adoptError && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
            <p className="text-xs text-destructive">
              Failed to save slot: {adoptError}
            </p>
          </div>
        )}

        {/* Populated state */}
        {insights && (
          <>
            {/* Audience notes */}
            <div className="rounded-lg border border-border-light bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Audience read
              </p>
              <p className="mt-1.5 text-sm text-foreground leading-relaxed">
                {insights.audienceNotes}
              </p>
            </div>

            {/* Best times */}
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Best times to post
                  </h3>
                </div>
                {totalTiles > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {adoptedCount} of {totalTiles} windows adopted
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {insights.optimalPostingTimes.map((slot, i) => {
                  const adopted = isSuggestionAdopted(slot, platform, preferredSlots);
                  const adopting = adoptingIndex === i;

                  return (
                    <div
                      key={`time-${i}`}
                      className="rounded-lg border border-border-light bg-card p-3 flex flex-col gap-2"
                    >
                      <div>
                        <div className="text-xs font-bold text-primary">{slot.dayOfWeek}</div>
                        <div className="mt-0.5 text-sm font-semibold text-foreground">
                          {slot.timeWindow}
                        </div>
                        <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                          {slot.reasoning}
                        </p>
                      </div>

                      {/* Adopt toggle */}
                      {adopted ? (
                        <div className="flex items-center gap-1 text-xs font-medium text-primary self-start">
                          <Check size={12} aria-hidden />
                          Adopted
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { void adoptSlot(slot, i); }}
                          disabled={adopting || adoptingIndex !== null}
                          className="h-6 px-2 text-xs self-start"
                        >
                          {adopting ? (
                            <RefreshCw size={10} className="animate-spin mr-1" aria-hidden />
                          ) : null}
                          {adopting ? 'Saving...' : 'Adopt this slot'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trending topics */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Flame size={14} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Trending in your niche
                </h3>
              </div>
              <div className="space-y-2">
                {insights.trendingTopics.map((topic, i) => (
                  <div
                    key={`topic-${i}`}
                    className="rounded-lg border border-border-light bg-card p-3"
                  >
                    <div className="text-sm font-semibold text-foreground">
                      {topic.topic}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground">Why it matters: </span>
                      {topic.whyItMatters}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      <span className="font-medium text-foreground">Your angle: </span>
                      {topic.angleForBrand}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Discovery & SEO — only rendered when the LLM returned the field */}
            {insights.discoverySeo && (
              <DiscoverySeoSection
                discoverySeo={insights.discoverySeo}
                platform={platform}
                savedHashtags={savedHashtags}
                savedKeywords={savedKeywords}
                onAdopt={adoptTags}
                adopting={adoptingTags}
                adoptError={adoptTagsError}
              />
            )}

            {/* Suggested content */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Lightbulb size={14} className="text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Suggested content
                </h3>
              </div>
              <div className="space-y-2">
                {insights.suggestedContent.map((idea, i) => {
                  const isUsing = usingContentIndex === i;
                  const anyUsing = usingContentIndex !== null;
                  return (
                    <div
                      key={`idea-${i}`}
                      className="rounded-lg border border-border-light bg-card p-3 flex flex-col gap-2"
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                          {idea.format}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          · best for {idea.bestPostedAt}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-foreground">
                        {idea.hook}
                      </div>
                      <p className="mt-1.5 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {idea.body}
                      </p>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => { void startContentMission(idea, i); }}
                        disabled={anyUsing}
                        className="h-7 px-3 gap-1.5 self-start mt-1"
                      >
                        {isUsing ? (
                          <RefreshCw size={11} className="animate-spin" aria-hidden />
                        ) : (
                          <Sparkles size={11} aria-hidden />
                        )}
                        <span className="text-xs font-semibold">
                          {isUsing ? 'Starting...' : 'Use this content'}
                        </span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Discovery & SEO sub-component ───────────────────────────────────────────

interface DiscoverySeoSectionProps {
  discoverySeo: DiscoverySeo;
  platform: SocialPlatform;
  savedHashtags: string[];
  savedKeywords: string[];
  onAdopt: (hashtags: string[], keywords: string[]) => Promise<void>;
  adopting: boolean;
  adoptError: string | null;
}

function DiscoverySeoSection({
  discoverySeo,
  savedHashtags,
  savedKeywords,
  onAdopt,
  adopting,
  adoptError,
}: DiscoverySeoSectionProps): React.ReactElement {
  const { recommendedHashtags, trendingTags, keywords, platformSpecific } = discoverySeo;

  const allHashtagsAdopted =
    recommendedHashtags.length > 0 &&
    recommendedHashtags.every((h) => savedHashtags.includes(h));

  const allKeywordsAdopted =
    keywords.length > 0 &&
    keywords.every((k) => savedKeywords.includes(k));

  const adoptedHashtagCount = recommendedHashtags.filter((h) =>
    savedHashtags.includes(h),
  ).length;

  const adoptedKeywordCount = keywords.filter((k) =>
    savedKeywords.includes(k),
  ).length;

  const hasPlatformSpecific = Object.keys(platformSpecific).length > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Search size={14} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">
          Discovery &amp; SEO
        </h3>
      </div>

      <div className="rounded-lg border border-border-light bg-card p-4 space-y-4">
        {/* Recommended hashtags */}
        {recommendedHashtags.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <Tag size={12} className="text-muted-foreground" />
                <span className="text-xs font-semibold text-foreground">
                  Recommended hashtags
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {adoptedHashtagCount} of {recommendedHashtags.length} adopted
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recommendedHashtags.map((tag, i) => {
                const adopted = savedHashtags.includes(tag);
                return (
                  <span
                    key={`htag-${i}`}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                      adopted
                        ? 'bg-primary/10 text-primary border-primary/20'
                        : 'bg-card text-foreground border-border-strong'
                    }`}
                  >
                    {adopted && <Check size={9} aria-hidden />}
                    {tag}
                  </span>
                );
              })}
            </div>
            {!allHashtagsAdopted && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { void onAdopt(recommendedHashtags, []); }}
                disabled={adopting}
                className="h-6 px-2 text-xs self-start"
              >
                {adopting ? (
                  <RefreshCw size={10} className="animate-spin mr-1" aria-hidden />
                ) : null}
                {adopting ? 'Saving...' : 'Adopt all hashtags'}
              </Button>
            )}
            {allHashtagsAdopted && (
              <div className="flex items-center gap-1 text-xs font-medium text-primary">
                <Check size={12} aria-hidden />
                All adopted
              </div>
            )}
          </div>
        )}

        {/* Keywords */}
        {keywords.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                SEO keywords
              </span>
              <span className="text-xs text-muted-foreground">
                {adoptedKeywordCount} of {keywords.length} adopted
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw, i) => {
                const adopted = savedKeywords.includes(kw);
                return (
                  <span
                    key={`kw-${i}`}
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border ${
                      adopted
                        ? 'bg-muted text-muted-foreground border-border-light'
                        : 'bg-card text-foreground border-border-strong'
                    }`}
                  >
                    {adopted && <Check size={9} aria-hidden />}
                    {kw}
                  </span>
                );
              })}
            </div>
            {!allKeywordsAdopted && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { void onAdopt([], keywords); }}
                disabled={adopting}
                className="h-6 px-2 text-xs self-start"
              >
                {adopting ? (
                  <RefreshCw size={10} className="animate-spin mr-1" aria-hidden />
                ) : null}
                {adopting ? 'Saving...' : 'Adopt all keywords'}
              </Button>
            )}
            {allKeywordsAdopted && (
              <div className="flex items-center gap-1 text-xs font-medium text-primary">
                <Check size={12} aria-hidden />
                All adopted
              </div>
            )}
          </div>
        )}

        {/* Trending tags */}
        {trendingTags.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={12} className="text-muted-foreground" />
              <span className="text-xs font-semibold text-foreground">
                Trending tags to consider
              </span>
            </div>
            <div className="space-y-1.5">
              {trendingTags.map((entry, i) => (
                <div key={`ttag-${i}`} className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                    {entry.tag}
                  </span>
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {entry.whyRelevant}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Platform-specific extras */}
        {hasPlatformSpecific && (
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-foreground">
              Platform-specific guidance
            </span>
            <div className="space-y-1">
              {Object.entries(platformSpecific).map(([key, val]) => (
                <div key={key} className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground capitalize">
                    {key.replace(/([A-Z])/g, ' $1').trim()}:{' '}
                  </span>
                  {val}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Adoption error */}
        {adoptError && (
          <p className="text-xs text-destructive">
            Failed to save tags: {adoptError}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatRelative(iso: string): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) { return ''; }
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) { return 'just now'; }
  if (min < 60) { return `${min}m ago`; }
  const hr = Math.floor(min / 60);
  if (hr < 24) { return `${hr}h ago`; }
  return new Date(iso).toLocaleString();
}
