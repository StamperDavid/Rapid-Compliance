'use client';

/**
 * Social Strategy Co-Pilot — the "describe your business → full cross-platform
 * strategy + a filled content queue" magic moment.
 *
 * Step 1: describe the business + pick goals/platforms.
 * Step 2: generating (real LLM specialists, Brand DNA baked in).
 * Step 3: review the strategy + editable per-platform drafts; keep/discard each.
 * Step 4: add the kept drafts to the evergreen queue (review-only; nothing posts).
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  PageTitle,
  SectionTitle,
  CardTitle,
  SectionDescription,
  Caption,
} from '@/components/ui/typography';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { getPlatformConfig } from '@/components/social/_platform-state';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';

// ─── Plan shapes (mirror the wizard service response) ──────────────────────────

interface WizardDraft {
  platform: SocialPlatform;
  platformLabel: string;
  content: string;
  suggestedTime?: string;
  hashtags: string[];
  rationale?: string;
  live: boolean;
}

interface WizardPlatformStrategy {
  platform: SocialPlatform;
  platformLabel: string;
  specialistName: string | null;
  live: boolean;
  audienceNotes: string;
  optimalPostingTimes: Array<{ dayOfWeek: string; timeWindow: string; reasoning: string }>;
  trendingTopics: Array<{ topic: string; whyItMatters: string; angleForBrand: string }>;
}

interface WizardSkippedPlatform {
  platform: SocialPlatform;
  platformLabel: string;
  reason: string;
}

interface StrategyWizardPlan {
  businessDescription: string;
  goals: string[];
  generatedAt: string;
  postsPerPlatform: number;
  strategy: { platforms: WizardPlatformStrategy[]; skipped: WizardSkippedPlatform[] };
  drafts: WizardDraft[];
}

interface PlanResponse {
  success: boolean;
  plan?: StrategyWizardPlan;
  error?: string;
}

interface QueueResponse {
  success: boolean;
  queued?: number;
  failed?: number;
  errors?: string[];
  error?: string;
}

/** A draft the operator can edit + keep/discard in the review step. */
interface EditableDraft extends WizardDraft {
  keep: boolean;
}

// ─── Static option lists ───────────────────────────────────────────────────────

const GOAL_OPTIONS = [
  'Grow followers & awareness',
  'Drive website traffic',
  'Generate leads & signups',
  'Boost engagement',
  'Promote a product or offer',
  'Establish thought leadership',
] as const;

const POSTS_PER_PLATFORM_OPTIONS = [2, 3, 4, 5] as const;

type WizardStep = 'describe' | 'generating' | 'review';

// ─── Component ─────────────────────────────────────────────────────────────────

export default function StrategyCopilotPage() {
  const authFetch = useAuthFetch();
  const toast = useToast();

  const [step, setStep] = useState<WizardStep>('describe');
  const [businessDescription, setBusinessDescription] = useState('');
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [postsPerPlatform, setPostsPerPlatform] = useState<number>(4);

  const [plan, setPlan] = useState<StrategyWizardPlan | null>(null);
  const [drafts, setDrafts] = useState<EditableDraft[]>([]);
  const [queuing, setQueuing] = useState(false);
  const [queuedCount, setQueuedCount] = useState<number | null>(null);

  // Live platforms default to checked-eligible; coming-soon are draft-only.
  const platformRows = useMemo(
    () =>
      SOCIAL_PLATFORMS.map((p) => {
        const config = getPlatformConfig(p);
        const live = ['live_full', 'live_dm_blocked', 'live_no_dm'].includes(config.state);
        const hasSpecialist = config.specialistId !== null && config.state !== 'parked';
        return { platform: p, label: PLATFORM_META[p].label, live, hasSpecialist };
      }).filter((row) => row.hasSpecialist),
    [],
  );

  const toggle = useCallback(
    <T,>(setter: React.Dispatch<React.SetStateAction<T[]>>, value: T) => {
      setter((prev) => (prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]));
    },
    [],
  );

  const canGenerate = businessDescription.trim().length >= 10 && !queuing;

  const handleGenerate = useCallback(async () => {
    if (!canGenerate) {
      toast.error('Add a sentence or two about your business so the specialists can tailor the plan.');
      return;
    }
    setStep('generating');
    setPlan(null);
    setDrafts([]);
    setQueuedCount(null);
    try {
      const res = await authFetch('/api/social/strategy-wizard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessDescription: businessDescription.trim(),
          goals: selectedGoals,
          platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
          postsPerPlatform,
        }),
      });
      const data = (await res.json()) as PlanResponse;
      if (!res.ok || !data.success || !data.plan) {
        throw new Error(data.error ?? 'The specialists could not build a plan right now.');
      }
      setPlan(data.plan);
      setDrafts(data.plan.drafts.map((d) => ({ ...d, keep: true })));
      setStep('review');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not generate your plan. Please try again.');
      setStep('describe');
    }
  }, [authFetch, businessDescription, canGenerate, postsPerPlatform, selectedGoals, selectedPlatforms, toast]);

  const updateDraft = useCallback((index: number, patch: Partial<EditableDraft>) => {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }, []);

  const keptDrafts = useMemo(() => drafts.filter((d) => d.keep && d.content.trim().length > 0), [drafts]);

  const handleAddToQueue = useCallback(async () => {
    if (keptDrafts.length === 0) {
      toast.error('Keep at least one draft to add it to your queue.');
      return;
    }
    setQueuing(true);
    try {
      const res = await authFetch('/api/social/strategy-wizard/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drafts: keptDrafts.map((d) => ({
            platform: d.platform,
            content: d.content.trim(),
            hashtags: d.hashtags,
            preferredTimeSlot: d.suggestedTime,
          })),
        }),
      });
      const data = (await res.json()) as QueueResponse;
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Could not add the drafts to your queue.');
      }
      setQueuedCount(data.queued ?? keptDrafts.length);
      toast.success(
        `${data.queued ?? keptDrafts.length} draft(s) added to your evergreen queue. Nothing posts until you turn on auto-posting.`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not add the drafts to your queue.');
    } finally {
      setQueuing(false);
    }
  }, [authFetch, keptDrafts, toast]);

  const resetWizard = useCallback(() => {
    setStep('describe');
    setPlan(null);
    setDrafts([]);
    setQueuedCount(null);
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 space-y-6">
      <div className="space-y-1">
        <PageTitle>Strategy Co-Pilot</PageTitle>
        <SectionDescription>
          Describe your business once. Your platform specialists draft a cross-platform plan and a
          queue of ready-to-review posts — all in your brand voice. Nothing posts until you say so.
        </SectionDescription>
      </div>

      {step === 'describe' && (
        <DescribeStep
          businessDescription={businessDescription}
          setBusinessDescription={setBusinessDescription}
          selectedGoals={selectedGoals}
          toggleGoal={(g) => toggle(setSelectedGoals, g)}
          platformRows={platformRows}
          selectedPlatforms={selectedPlatforms}
          togglePlatform={(p) => toggle(setSelectedPlatforms, p)}
          postsPerPlatform={postsPerPlatform}
          setPostsPerPlatform={setPostsPerPlatform}
          canGenerate={canGenerate}
          onGenerate={() => { void handleGenerate(); }}
        />
      )}

      {step === 'generating' && <GeneratingStep />}

      {step === 'review' && plan && (
        <ReviewStep
          plan={plan}
          drafts={drafts}
          updateDraft={updateDraft}
          keptCount={keptDrafts.length}
          queuing={queuing}
          queuedCount={queuedCount}
          onAddToQueue={() => { void handleAddToQueue(); }}
          onStartOver={resetWizard}
        />
      )}
    </div>
  );
}

// ─── Step 1: Describe ──────────────────────────────────────────────────────────

interface PlatformRow {
  platform: SocialPlatform;
  label: string;
  live: boolean;
  hasSpecialist: boolean;
}

function DescribeStep(props: {
  businessDescription: string;
  setBusinessDescription: (v: string) => void;
  selectedGoals: string[];
  toggleGoal: (g: string) => void;
  platformRows: PlatformRow[];
  selectedPlatforms: SocialPlatform[];
  togglePlatform: (p: SocialPlatform) => void;
  postsPerPlatform: number;
  setPostsPerPlatform: (n: number) => void;
  canGenerate: boolean;
  onGenerate: () => void;
}) {
  const {
    businessDescription, setBusinessDescription, selectedGoals, toggleGoal,
    platformRows, selectedPlatforms, togglePlatform, postsPerPlatform,
    setPostsPerPlatform, canGenerate, onGenerate,
  } = props;

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-3">
        <CardTitle>What does your business do?</CardTitle>
        <SectionDescription>
          A few plain sentences is perfect — what you sell, who it&apos;s for, and what makes you
          different. Your specialists already know your brand voice; this sharpens today&apos;s focus.
        </SectionDescription>
        <Textarea
          value={businessDescription}
          onChange={(e) => setBusinessDescription(e.target.value)}
          rows={5}
          placeholder="e.g. We're a compliance software company helping small accounting firms stay audit-ready without hiring a compliance officer..."
        />
        <Caption>{businessDescription.trim().length}/4000 characters (10 minimum)</Caption>
      </div>

      <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-3">
        <CardTitle>What are you trying to achieve?</CardTitle>
        <SectionDescription>Optional — pick any that apply to steer the plan.</SectionDescription>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {GOAL_OPTIONS.map((goal) => (
            <label key={goal} className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
              <Checkbox checked={selectedGoals.includes(goal)} onChange={() => toggleGoal(goal)} />
              <span>{goal}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-3">
        <CardTitle>Which platforms?</CardTitle>
        <SectionDescription>
          Leave all unchecked to draft for every platform that&apos;s live today.
          &quot;Draft only&quot; platforms get posts now and publish once you connect them.
        </SectionDescription>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {platformRows.map((row) => (
            <label
              key={row.platform}
              className="flex items-center justify-between gap-2 cursor-pointer text-sm text-foreground border border-border-light rounded-xl px-3 py-2"
            >
              <span className="flex items-center gap-2">
                <Checkbox
                  checked={selectedPlatforms.includes(row.platform)}
                  onChange={() => togglePlatform(row.platform)}
                />
                <span>{row.label}</span>
              </span>
              <span className={row.live ? 'text-xs text-primary' : 'text-xs text-muted-foreground'}>
                {row.live ? 'Live' : 'Draft only'}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border-strong rounded-2xl p-6 space-y-3">
        <CardTitle>How many post drafts per platform?</CardTitle>
        <div className="flex gap-2">
          {POSTS_PER_PLATFORM_OPTIONS.map((n) => (
            <Button
              key={n}
              type="button"
              variant={postsPerPlatform === n ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPostsPerPlatform(n)}
            >
              {n}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={onGenerate} disabled={!canGenerate} size="lg">
          Generate my strategy
        </Button>
      </div>
    </div>
  );
}

// ─── Step 2: Generating ────────────────────────────────────────────────────────

function GeneratingStep() {
  return (
    <div className="bg-card border border-border-strong rounded-2xl p-12 flex flex-col items-center justify-center text-center space-y-3">
      <div className="h-10 w-10 rounded-full border-2 border-border-light border-t-primary animate-spin" />
      <SectionTitle>Your specialists are drafting your plan…</SectionTitle>
      <SectionDescription>
        Each platform specialist is writing a strategy and post drafts in your brand voice. This
        usually takes 20–40 seconds.
      </SectionDescription>
    </div>
  );
}

// ─── Step 3: Review ────────────────────────────────────────────────────────────

function ReviewStep(props: {
  plan: StrategyWizardPlan;
  drafts: EditableDraft[];
  updateDraft: (index: number, patch: Partial<EditableDraft>) => void;
  keptCount: number;
  queuing: boolean;
  queuedCount: number | null;
  onAddToQueue: () => void;
  onStartOver: () => void;
}) {
  const { plan, drafts, updateDraft, keptCount, queuing, queuedCount, onAddToQueue, onStartOver } = props;

  return (
    <div className="space-y-6">
      {queuedCount !== null && (
        <div className="bg-card border border-primary rounded-2xl p-6 space-y-2">
          <CardTitle>{queuedCount} draft(s) added to your evergreen queue</CardTitle>
          <SectionDescription>
            They&apos;re saved as queued drafts. Nothing posts to a real audience until you turn on
            auto-posting in AI Settings — and even then it&apos;s rate-limited.
          </SectionDescription>
          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onStartOver}>Start a new plan</Button>
          </div>
        </div>
      )}

      {/* Strategy summary */}
      <div className="space-y-4">
        <SectionTitle>Your cross-platform strategy</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {plan.strategy.platforms.map((p) => (
            <div key={p.platform} className="bg-card border border-border-strong rounded-2xl p-6 space-y-3">
              <div className="flex items-center justify-between">
                <CardTitle>{p.platformLabel}</CardTitle>
                <span className={p.live ? 'text-xs text-primary' : 'text-xs text-muted-foreground'}>
                  {p.live ? 'Live' : 'Draft only'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{p.audienceNotes}</p>
              {p.optimalPostingTimes.length > 0 && (
                <div className="space-y-1">
                  <Caption>Best times to post</Caption>
                  <ul className="text-sm text-foreground space-y-1">
                    {p.optimalPostingTimes.map((t, i) => (
                      <li key={i}>
                        <span className="font-medium">{t.dayOfWeek}, {t.timeWindow}</span> — {t.reasoning}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {p.trendingTopics.length > 0 && (
                <div className="space-y-1">
                  <Caption>Topics to ride</Caption>
                  <ul className="text-sm text-foreground list-disc pl-5 space-y-1">
                    {p.trendingTopics.map((t, i) => (
                      <li key={i}><span className="font-medium">{t.topic}</span> — {t.angleForBrand}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {plan.strategy.skipped.length > 0 && (
          <div className="bg-surface-elevated border border-border-light rounded-2xl p-4 space-y-1">
            <Caption>Skipped platforms</Caption>
            <ul className="text-sm text-muted-foreground space-y-1">
              {plan.strategy.skipped.map((s) => (
                <li key={s.platform}>{s.reason}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Drafts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <SectionTitle>Your post drafts ({drafts.length})</SectionTitle>
          <div className="flex items-center gap-3">
            <Caption>{keptCount} selected to queue</Caption>
            <Button type="button" onClick={onAddToQueue} disabled={queuing || keptCount === 0}>
              {queuing ? 'Adding…' : `Add ${keptCount} draft(s) to my queue`}
            </Button>
          </div>
        </div>

        <div className="space-y-4">
          {drafts.map((draft, index) => (
            <div
              key={`${draft.platform}-${index}`}
              className={`bg-card border rounded-2xl p-5 space-y-3 ${draft.keep ? 'border-border-strong' : 'border-border-light opacity-70'}`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CardTitle>{draft.platformLabel}</CardTitle>
                  <span className={draft.live ? 'text-xs text-primary' : 'text-xs text-muted-foreground'}>
                    {draft.live ? 'Live' : 'Draft only'}
                  </span>
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-sm text-foreground">
                  <Checkbox checked={draft.keep} onChange={() => updateDraft(index, { keep: !draft.keep })} />
                  <span>Keep this draft</span>
                </label>
              </div>
              <Textarea
                value={draft.content}
                onChange={(e) => updateDraft(index, { content: e.target.value })}
                rows={4}
              />
              {draft.hashtags.length > 0 && (
                <Caption>Hashtags added on post: {draft.hashtags.map((h) => `#${h.replace(/^#/, '')}`).join(' ')}</Caption>
              )}
              {draft.rationale && <Caption>{draft.rationale}</Caption>}
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between flex-wrap gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onStartOver}>Start over</Button>
          <Button type="button" onClick={onAddToQueue} disabled={queuing || keptCount === 0}>
            {queuing ? 'Adding…' : `Add ${keptCount} draft(s) to my queue`}
          </Button>
        </div>
      </div>
    </div>
  );
}
