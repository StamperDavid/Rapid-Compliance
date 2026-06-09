'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Building2,
  MessageSquare,
  Image as ImageIcon,
  Palette,
  Type,
  Upload,
  Save,
  Loader2,
  CheckCircle,
  Megaphone,
  AlertTriangle,
  X,
  SlidersHorizontal,
  ChevronDown,
  ChevronRight,
  FolderUp,
  FileVideo,
  FileText,
  File as FileIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { BRAND_FONT_OPTIONS, type LogoPosition } from '@/types/brand-kit';
import {
  DEFAULT_BRAND_IDENTITY,
  type BrandIdentity,
  type BrandVoice,
  type BrandPalette,
  type BrandExampleAsset,
  type DashboardTheme,
} from '@/types/brand-identity';

// ── Publish-to-Agents job types (mirrors /api/training/rebake-brand-dna) ─────

interface RebakeJob {
  id: string;
  status: 'running' | 'completed' | 'failed';
  trigger: 'manual-publish' | 'voice-save';
  triggeredBy: string;
  total: number;
  done: number;
  rebaked: number;
  skipped: number;
  failed: number;
  failures: Array<{ id: string; error: string }>;
  startedAt: string;
  finishedAt?: string;
  error?: string;
}

interface StartRebakeResponse {
  success: boolean;
  jobId?: string;
  error?: string;
}

interface RebakeJobResponse {
  success: boolean;
  job?: RebakeJob | null;
}

const POLL_INTERVAL_MS = 1500;

// ── Logo Position Labels ────────────────────────────────────────────────────

const POSITION_OPTIONS: { value: LogoPosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

// ── Palette field labels (all 11 colors) ────────────────────────────────────

const PALETTE_FIELDS: { key: keyof BrandPalette; label: string }[] = [
  { key: 'primary', label: 'Primary' },
  { key: 'secondary', label: 'Secondary' },
  { key: 'accent', label: 'Accent' },
  { key: 'background', label: 'Background' },
  { key: 'surface', label: 'Surface' },
  { key: 'text', label: 'Text' },
  { key: 'textMuted', label: 'Text Muted' },
  { key: 'border', label: 'Border' },
  { key: 'success', label: 'Success' },
  { key: 'warning', label: 'Warning' },
  { key: 'error', label: 'Error' },
];

// ── Dashboard-theme group labels (object groups rendered by Object.entries) ──
// The grids map over `Object.entries(identity.dashboardTheme[group])`, so any
// sub-key that exists at runtime is rendered; these labels just prettify the
// known keys and fall back to the raw key for anything unmapped.

const THEME_GROUPS: {
  group: 'borderRadius' | 'spacing' | 'shadow' | 'fontSize' | 'fontWeight';
  title: string;
  numeric?: boolean;
}[] = [
  { group: 'borderRadius', title: 'Corner Radius' },
  { group: 'spacing', title: 'Spacing' },
  { group: 'shadow', title: 'Shadows' },
  { group: 'fontSize', title: 'Font Sizes' },
  { group: 'fontWeight', title: 'Font Weights', numeric: true },
];

const THEME_KEY_LABELS: Record<string, string> = {
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'X-Large',
  full: 'Full',
  card: 'Card',
  button: 'Button',
  input: 'Input',
  xs: 'X-Small',
  base: 'Base',
  '2xl': '2X-Large',
  '3xl': '3X-Large',
  glow: 'Glow',
  light: 'Light',
  normal: 'Normal',
  medium: 'Medium',
  semibold: 'Semibold',
  bold: 'Bold',
};

const themeKeyLabel = (key: string): string => THEME_KEY_LABELS[key] ?? key;

// ── Chip-list editor (keyPhrases / avoidPhrases / competitors) ───────────────

function ChipListEditor({
  label,
  placeholder,
  values,
  onAdd,
  onRemove,
}: {
  label: string;
  placeholder: string;
  values: string[];
  onAdd: (value: string) => void;
  onRemove: (index: number) => void;
}) {
  const [draft, setDraft] = useState('');

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) {
      onAdd(trimmed);
      setDraft('');
    }
  };

  return (
    <div>
      <label className="text-sm text-foreground block mb-1.5">{label}</label>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" onClick={commit}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {values.map((value, index) => (
            <span
              key={`${value}-${index}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated border border-border-light px-3 py-1 text-sm text-foreground"
            >
              {value}
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Remove ${value}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Component ───────────────────────────────────────────────────────────────

export default function BrandIdentityPage() {
  const authFetch = useAuthFetch();
  const [identity, setIdentity] = useState<BrandIdentity>(DEFAULT_BRAND_IDENTITY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  // ── Reference Materials (exampleAssets) state ───────────────────────────────
  const [uploadingAsset, setUploadingAsset] = useState(false);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [armedRemoveId, setArmedRemoveId] = useState<string | null>(null);
  const assetFileInputRef = useRef<HTMLInputElement>(null);
  const armDisarmRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Advanced dashboard-theme section is collapsed by default — most users never open it.
  const [themeOpen, setThemeOpen] = useState(false);

  // ── Publish-to-Agents state ─────────────────────────────────────────────────
  const [publishJob, setPublishJob] = useState<RebakeJob | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Begin polling a specific job until it leaves the `running` state.
  const beginPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const res = await authFetch(`/api/training/rebake-brand-dna/${jobId}`);
            if (!res.ok) {
              return;
            }
            const data = (await res.json()) as RebakeJobResponse;
            if (data.success && data.job) {
              setPublishJob(data.job);
              if (data.job.status !== 'running') {
                stopPolling();
              }
            }
          } catch {
            // Transient network error — keep polling; unmount/completion clears it.
          }
        })();
      }, POLL_INTERVAL_MS);
    },
    [authFetch, stopPolling],
  );

  // Clear any live interval when the component unmounts.
  useEffect(() => stopPolling, [stopPolling]);

  // Clear any pending remove-arm timeout when the component unmounts.
  useEffect(
    () => () => {
      if (armDisarmRef.current !== null) {
        clearTimeout(armDisarmRef.current);
        armDisarmRef.current = null;
      }
    },
    [],
  );

  // ── Publish: start the rebake job, then poll to completion ──────────────────
  const handlePublish = useCallback(async () => {
    setPublishError(null);
    try {
      const res = await authFetch('/api/training/rebake-brand-dna', { method: 'POST' });
      const data = (await res.json()) as StartRebakeResponse;
      if (!res.ok || !data.success || !data.jobId) {
        setPublishError(data.error ?? 'Could not start publishing. Please try again.');
        return;
      }
      // Optimistic running state so the UI updates before the first poll lands.
      setPublishJob({
        id: data.jobId,
        status: 'running',
        trigger: 'manual-publish',
        triggeredBy: '',
        total: 0,
        done: 0,
        rebaked: 0,
        skipped: 0,
        failed: 0,
        failures: [],
        startedAt: new Date().toISOString(),
      });
      beginPolling(data.jobId);
    } catch {
      setPublishError('Could not start publishing. Please check your connection and try again.');
    }
  }, [authFetch, beginPolling]);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const res = await authFetch('/api/settings/brand-identity');
        if (res.ok) {
          const data = (await res.json()) as { success: boolean; brandIdentity: BrandIdentity };
          if (data.success && data.brandIdentity) {
            setIdentity(data.brandIdentity);
          }
        }
      } catch {
        // Use defaults on error
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch]);

  // ── Load most-recent publish job (for last-published status + resume) ───────
  useEffect(() => {
    void (async () => {
      try {
        const res = await authFetch('/api/training/rebake-brand-dna');
        if (!res.ok) {
          return;
        }
        const data = (await res.json()) as RebakeJobResponse;
        if (data.success && data.job) {
          setPublishJob(data.job);
          if (data.job.status === 'running') {
            beginPolling(data.job.id);
          }
        }
      } catch {
        // No prior job / network issue — nothing to show.
      }
    })();
  }, [authFetch, beginPolling]);

  // ── Persist ─────────────────────────────────────────────────────────────────
  // Single writer for the brand-identity doc. Used by the explicit Save button AND
  // the logo upload, so an uploaded logo persists immediately — no silent "forgot
  // to Save" trap.
  const persistIdentity = useCallback(
    async (next: BrandIdentity): Promise<boolean> => {
      const res = await authFetch('/api/settings/brand-identity', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voice: next.voice,
          companyName: next.companyName,
          tagline: next.tagline,
          logo: next.logo,
          colors: next.colors,
          fonts: next.fonts,
          typography: next.typography,
          introOutro: next.introOutro,
          exampleAssets: next.exampleAssets,
          dashboardTheme: next.dashboardTheme,
        }),
      });
      return res.ok;
    },
    [authFetch],
  );

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      if (await persistIdentity(identity)) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // Error silently handled
    } finally {
      setSaving(false);
    }
  }, [persistIdentity, identity]);

  // ── Logo upload (reuses POST /api/settings/brand-kit/logo) ──────────────────
  const handleLogoFile = useCallback(
    async (file: File) => {
      setLogoError(null);
      setUploadingLogo(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await authFetch('/api/settings/brand-kit/logo', {
          method: 'POST',
          body: formData,
        });
        const data = (await res.json()) as { success: boolean; url?: string; error?: string };
        if (!res.ok || !data.success || !data.url) {
          setLogoError(data.error ?? 'Upload failed. Please try again.');
          return;
        }
        const updated: BrandIdentity = {
          ...identity,
          logo: {
            url: data.url,
            position: identity.logo?.position ?? 'bottom-right',
            opacity: identity.logo?.opacity ?? 0.85,
            scale: identity.logo?.scale ?? 0.1,
          },
        };
        setIdentity(updated);
        if (await persistIdentity(updated)) {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        }
      } catch {
        setLogoError('Upload failed. Please check your connection and try again.');
      } finally {
        setUploadingLogo(false);
      }
    },
    [authFetch, identity, persistIdentity],
  );

  // ── Reference Materials upload (POST /api/settings/brand-identity/asset) ────
  // Mirrors handleLogoFile: upload one file, append the new asset, persist
  // immediately so the upload isn't lost behind an un-clicked Save.
  const handleAssetFile = useCallback(
    async (file: File) => {
      setAssetError(null);
      setUploadingAsset(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const res = await authFetch('/api/settings/brand-identity/asset', {
          method: 'POST',
          body: formData,
        });
        const data = (await res.json()) as {
          success: boolean;
          url?: string;
          fileName?: string;
          contentType?: string;
          kind?: BrandExampleAsset['kind'];
          error?: string;
        };
        if (!res.ok || !data.success || !data.url) {
          setAssetError(data.error ?? 'Upload failed. Please try again.');
          return;
        }
        const newAsset: BrandExampleAsset = {
          id: crypto.randomUUID(),
          url: data.url,
          fileName: data.fileName ?? file.name,
          contentType: data.contentType ?? file.type,
          kind: data.kind ?? 'other',
          description: '',
          purpose: '',
          uploadedAt: new Date().toISOString(),
        };
        const updated: BrandIdentity = {
          ...identity,
          exampleAssets: [...identity.exampleAssets, newAsset],
        };
        setIdentity(updated);
        if (await persistIdentity(updated)) {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        }
      } catch {
        setAssetError('Upload failed. Please check your connection and try again.');
      } finally {
        setUploadingAsset(false);
      }
    },
    [authFetch, identity, persistIdentity],
  );

  // Immutable per-field update of a single asset by id (state only — persisted on blur).
  const updateAsset = (id: string, field: 'description' | 'purpose', value: string) => {
    setIdentity((prev) => ({
      ...prev,
      exampleAssets: prev.exampleAssets.map((a) =>
        a.id === id ? { ...a, [field]: value } : a,
      ),
    }));
  };

  // Persist the current identity on field blur so typed text isn't lost on navigate-away.
  const persistAssetsOnBlur = useCallback(() => {
    setIdentity((current) => {
      void persistIdentity(current);
      return current;
    });
  }, [persistIdentity]);

  // Two-step remove: first click arms (auto-disarms after 5s), second click removes.
  const handleRemoveAsset = (id: string) => {
    if (armDisarmRef.current !== null) {
      clearTimeout(armDisarmRef.current);
      armDisarmRef.current = null;
    }
    if (armedRemoveId !== id) {
      setArmedRemoveId(id);
      armDisarmRef.current = setTimeout(() => setArmedRemoveId(null), 5000);
      return;
    }
    setArmedRemoveId(null);
    const updated: BrandIdentity = {
      ...identity,
      exampleAssets: identity.exampleAssets.filter((a) => a.id !== id),
    };
    setIdentity(updated);
    void persistIdentity(updated);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const updateCompany = (field: 'companyName' | 'tagline', value: string) => {
    setIdentity((prev) => ({ ...prev, [field]: value }));
  };

  const updateVoice = (field: keyof BrandVoice, value: string) => {
    setIdentity((prev) => ({ ...prev, voice: { ...prev.voice, [field]: value } }));
  };

  const addToVoiceList = (field: 'keyPhrases' | 'avoidPhrases' | 'competitors', value: string) => {
    setIdentity((prev) => ({
      ...prev,
      voice: { ...prev.voice, [field]: [...prev.voice[field], value] },
    }));
  };

  const removeFromVoiceList = (
    field: 'keyPhrases' | 'avoidPhrases' | 'competitors',
    index: number,
  ) => {
    setIdentity((prev) => ({
      ...prev,
      voice: { ...prev.voice, [field]: prev.voice[field].filter((_, i) => i !== index) },
    }));
  };

  const updateColor = (field: keyof BrandPalette, value: string) => {
    setIdentity((prev) => ({ ...prev, colors: { ...prev.colors, [field]: value } }));
  };

  const updateFont = (field: 'heading' | 'body', value: string) => {
    setIdentity((prev) => ({ ...prev, fonts: { ...prev.fonts, [field]: value } }));
  };

  // ── Dashboard-theme setters ─────────────────────────────────────────────────
  // Top-level scalar fields (favicon / showPoweredBy / monoFont).
  const updateThemeField = <K extends keyof DashboardTheme>(field: K, value: DashboardTheme[K]) =>
    setIdentity((prev) => ({
      ...prev,
      dashboardTheme: { ...prev.dashboardTheme, [field]: value },
    }));

  // Nested object-group fields (borderRadius / spacing / shadow / fontSize / fontWeight).
  const updateThemeGroup = <G extends 'borderRadius' | 'spacing' | 'shadow' | 'fontSize' | 'fontWeight'>(
    group: G,
    key: keyof DashboardTheme[G],
    value: DashboardTheme[G][keyof DashboardTheme[G]],
  ) =>
    setIdentity((prev) => ({
      ...prev,
      dashboardTheme: {
        ...prev.dashboardTheme,
        [group]: { ...prev.dashboardTheme[group], [key]: value },
      },
    }));

  // The theme object is present from defaults; guard only for the brief window
  // before a freshly-fetched identity has been normalised upstream.
  const theme = identity.dashboardTheme;

  // ── Derived publish UI values ───────────────────────────────────────────────
  const publishing = publishJob?.status === 'running';
  const progressPct =
    publishJob && publishJob.total > 0
      ? Math.min(100, Math.round((publishJob.done / publishJob.total) * 100))
      : 0;
  const lastPublishedAt =
    publishJob?.status !== 'running' && publishJob?.finishedAt
      ? new Date(publishJob.finishedAt).toLocaleString()
      : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <PageTitle>Brand Identity</PageTitle>
          <SectionDescription className="mt-1">
            One home for your brand voice, logo, colors, and fonts — used across every AI feature.
          </SectionDescription>
        </div>
        <Button
          onClick={() => {
            void handleSave();
          }}
          disabled={saving}
          className="gap-2"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="w-4 h-4" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
        </Button>
      </div>

      {/* ── Section 1: Company ──────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            Company
          </CardTitle>
          <CardDescription>Your company name and tagline.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-foreground block mb-1.5">Company Name</label>
            <Input
              value={identity.companyName}
              onChange={(e) => updateCompany('companyName', e.target.value)}
              placeholder="e.g., SalesVelocity.ai"
            />
          </div>
          <div>
            <label className="text-sm text-foreground block mb-1.5">Tagline</label>
            <Input
              value={identity.tagline}
              onChange={(e) => updateCompany('tagline', e.target.value)}
              placeholder="e.g., Close more, faster."
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Section 2: Brand Voice ──────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Brand Voice
          </CardTitle>
          <CardDescription>
            Voice changes save here; once saved, use the Publish to Agents button below to push them
            to your AI agents.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm text-foreground block mb-1.5">Company Description</label>
            <Textarea
              value={identity.voice.companyDescription}
              onChange={(e) => updateVoice('companyDescription', e.target.value)}
              placeholder="What your company does and who it serves."
            />
          </div>
          <div>
            <label className="text-sm text-foreground block mb-1.5">Unique Value</label>
            <Textarea
              value={identity.voice.uniqueValue}
              onChange={(e) => updateVoice('uniqueValue', e.target.value)}
              placeholder="What sets you apart from competitors."
            />
          </div>
          <div>
            <label className="text-sm text-foreground block mb-1.5">Target Audience</label>
            <Textarea
              value={identity.voice.targetAudience}
              onChange={(e) => updateVoice('targetAudience', e.target.value)}
              placeholder="Who you are trying to reach."
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm text-foreground block mb-1.5">Tone of Voice</label>
              <Input
                value={identity.voice.toneOfVoice}
                onChange={(e) => updateVoice('toneOfVoice', e.target.value)}
                placeholder="e.g., professional"
              />
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1.5">Communication Style</label>
              <Input
                value={identity.voice.communicationStyle}
                onChange={(e) => updateVoice('communicationStyle', e.target.value)}
                placeholder="e.g., Helpful and informative"
              />
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1.5">Industry</label>
              <Input
                value={identity.voice.industry}
                onChange={(e) => updateVoice('industry', e.target.value)}
                placeholder="e.g., SaaS / Compliance"
              />
            </div>
          </div>
          <ChipListEditor
            label="Key Phrases"
            placeholder="Add a phrase to use…"
            values={identity.voice.keyPhrases}
            onAdd={(v) => addToVoiceList('keyPhrases', v)}
            onRemove={(i) => removeFromVoiceList('keyPhrases', i)}
          />
          <ChipListEditor
            label="Avoid Phrases"
            placeholder="Add a phrase to avoid…"
            values={identity.voice.avoidPhrases}
            onAdd={(v) => addToVoiceList('avoidPhrases', v)}
            onRemove={(i) => removeFromVoiceList('avoidPhrases', i)}
          />
          <ChipListEditor
            label="Competitors"
            placeholder="Add a competitor…"
            values={identity.voice.competitors}
            onAdd={(v) => addToVoiceList('competitors', v)}
            onRemove={(i) => removeFromVoiceList('competitors', i)}
          />
        </CardContent>
      </Card>

      {/* ── Publish to Agents ───────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Publish to Agents
          </CardTitle>
          <CardDescription>
            Pushes your current saved brand voice out to every one of your AI agents so they all
            speak in the updated voice. This only updates the brand voice part of each agent — it
            never erases an agent&apos;s training, and it&apos;s safe and reversible. Save your
            changes first, then publish.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Button
              onClick={() => {
                void handlePublish();
              }}
              disabled={publishing}
              className="gap-2"
            >
              {publishing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Megaphone className="w-4 h-4" />
              )}
              {publishing ? 'Publishing…' : 'Publish to Agents'}
            </Button>
            {lastPublishedAt && !publishing && (
              <span className="text-xs text-muted-foreground">Last published: {lastPublishedAt}</span>
            )}
          </div>

          {publishError && <p className="text-sm text-destructive">{publishError}</p>}

          {/* Live progress while running */}
          {publishing && (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-elevated">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Updating your agents…{' '}
                {publishJob ? `${publishJob.done} of ${publishJob.total}` : 'starting'}
              </p>
            </div>
          )}

          {/* Completion (succeeded job) */}
          {publishJob?.status === 'completed' && (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                Your agents are now using the updated brand voice — {publishJob.rebaked} updated,{' '}
                {publishJob.skipped} already current.
              </p>
              {publishJob.failed > 0 && (
                <div className="space-y-1">
                  <p className="flex items-center gap-2 text-sm text-destructive">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    {publishJob.failed} agent(s) had a problem.
                  </p>
                  <ul className="space-y-0.5 pl-6 text-xs text-muted-foreground">
                    {publishJob.failures.map((f) => (
                      <li key={f.id}>
                        <span className="font-mono">{f.id}</span> — {f.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Fatal job failure */}
          {publishJob?.status === 'failed' && (
            <p className="flex items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {publishJob.error ?? 'Publishing failed. Please try again.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* ── Section 3: Logo ─────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-primary" />
            Logo
          </CardTitle>
          <CardDescription>
            Your logo is overlaid on generated images and video. Upload a PNG or SVG with a
            transparent background.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload logo file */}
          <div>
            <input
              ref={logoFileInputRef}
              type="file"
              accept="image/png,image/svg+xml,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleLogoFile(file);
                }
                e.target.value = '';
              }}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="gap-1.5"
                disabled={uploadingLogo}
                onClick={() => logoFileInputRef.current?.click()}
              >
                {uploadingLogo ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Upload className="w-3.5 h-3.5" />
                )}
                {uploadingLogo ? 'Uploading…' : 'Upload Logo'}
              </Button>
              {identity.logo?.url && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIdentity((prev) => ({ ...prev, logo: null }))}
                >
                  Remove
                </Button>
              )}
            </div>
            {logoError && <p className="text-xs text-destructive mt-2">{logoError}</p>}
          </div>

          {/* Logo Preview + controls */}
          {identity.logo?.url && (
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 bg-surface-elevated rounded-lg flex items-center justify-center border border-border-light overflow-hidden relative">
                <Image
                  src={identity.logo.url}
                  alt="Brand logo preview"
                  fill
                  className="object-contain"
                  style={{ opacity: identity.logo.opacity }}
                  unoptimized
                />
              </div>

              <div className="flex-1 space-y-3">
                {/* Position */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Position</label>
                  <div className="flex flex-wrap gap-2">
                    {POSITION_OPTIONS.map((opt) => (
                      <Button
                        key={opt.value}
                        type="button"
                        size="sm"
                        variant={identity.logo?.position === opt.value ? 'default' : 'outline'}
                        onClick={() =>
                          setIdentity((prev) => ({
                            ...prev,
                            logo: prev.logo ? { ...prev.logo, position: opt.value } : null,
                          }))
                        }
                      >
                        {opt.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Opacity */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Opacity: {Math.round((identity.logo?.opacity ?? 0.85) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={identity.logo?.opacity ?? 0.85}
                    onChange={(e) =>
                      setIdentity((prev) => ({
                        ...prev,
                        logo: prev.logo ? { ...prev.logo, opacity: Number(e.target.value) } : null,
                      }))
                    }
                    className="w-full accent-primary"
                  />
                </div>

                {/* Scale */}
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">
                    Size: {Math.round((identity.logo?.scale ?? 0.1) * 100)}% of width
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.25"
                    step="0.01"
                    value={identity.logo?.scale ?? 0.1}
                    onChange={(e) =>
                      setIdentity((prev) => ({
                        ...prev,
                        logo: prev.logo ? { ...prev.logo, scale: Number(e.target.value) } : null,
                      }))
                    }
                    className="w-full accent-primary"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 4: Colors (all 11 palette colors) ───────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            Colors
          </CardTitle>
          <CardDescription>
            Your full brand palette — used across generated content, your website, and video.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {PALETTE_FIELDS.map(({ key, label }) => (
              <div key={key}>
                <label className="text-sm text-foreground block mb-1.5">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={identity.colors[key]}
                    onChange={(e) => updateColor(key, e.target.value)}
                    className="w-10 h-10 rounded-lg border border-border-light cursor-pointer bg-transparent shrink-0"
                  />
                  <Input
                    value={identity.colors[key]}
                    onChange={(e) => updateColor(key, e.target.value)}
                    className="font-mono"
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ── Section 5: Fonts ────────────────────────────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Type className="w-5 h-5 text-primary" />
            Fonts
          </CardTitle>
          <CardDescription>Heading and body fonts for your brand.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-foreground block mb-1.5">Heading Font</label>
              <select
                value={identity.fonts.heading}
                onChange={(e) => updateFont('heading', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {BRAND_FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-foreground block mb-1.5">Body Font</label>
              <select
                value={identity.fonts.body}
                onChange={(e) => updateFont('body', e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {BRAND_FONT_OPTIONS.map((font) => (
                  <option key={font} value={font}>
                    {font}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 6: Advanced — Dashboard Theme (collapsible, collapsed by default) ── */}
      <Card>
        <button
          type="button"
          onClick={() => setThemeOpen((o) => !o)}
          aria-expanded={themeOpen}
          className="w-full text-left"
        >
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-primary" />
                Advanced — Dashboard Theme
              </CardTitle>
              <CardDescription>
                Fine-tune how your dashboard looks. Most people never need these.
              </CardDescription>
            </div>
            {themeOpen ? (
              <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />
            )}
          </CardHeader>
        </button>

        {themeOpen && theme && (
          <CardContent className="space-y-6">
            {/* Branding */}
            <div className="space-y-4">
              <label className="text-sm font-medium text-foreground block">Branding</label>
              <div>
                <label className="text-sm text-foreground block mb-1.5">Favicon URL</label>
                <Input
                  value={theme.favicon}
                  onChange={(e) => updateThemeField('favicon', e.target.value)}
                  placeholder="https://…/favicon.ico"
                />
              </div>
              <div>
                <label className="text-sm text-foreground block mb-1.5">
                  &ldquo;Powered by&rdquo; badge
                </label>
                <Button
                  type="button"
                  variant={theme.showPoweredBy ? 'default' : 'outline'}
                  onClick={() => updateThemeField('showPoweredBy', !theme.showPoweredBy)}
                >
                  {theme.showPoweredBy ? 'Showing' : 'Hidden'}
                </Button>
              </div>
            </div>

            {/* Object-group grids: Corner Radius / Spacing / Shadows / Font Sizes / Font Weights */}
            {THEME_GROUPS.map(({ group, title, numeric }) => (
              <div key={group} className="space-y-3">
                <label className="text-sm font-medium text-foreground block">{title}</label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(theme[group]).map(([key, value]) => (
                    <div key={key}>
                      <label className="text-xs text-muted-foreground block mb-1">
                        {themeKeyLabel(key)}
                      </label>
                      <Input
                        type={numeric ? 'number' : 'text'}
                        value={String(value)}
                        onChange={(e) =>
                          updateThemeGroup(
                            group,
                            key as keyof DashboardTheme[typeof group],
                            (numeric
                              ? Number(e.target.value)
                              : e.target.value) as DashboardTheme[typeof group][keyof DashboardTheme[typeof group]],
                          )
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Mono Font */}
            <div>
              <label className="text-sm text-foreground block mb-1.5">Monospace Font</label>
              <Input
                value={theme.monoFont}
                onChange={(e) => updateThemeField('monoFont', e.target.value)}
                placeholder="e.g., JetBrains Mono"
              />
            </div>
          </CardContent>
        )}
      </Card>

      {/* ── Section 7: Reference Materials (exampleAssets) ──────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderUp className="w-5 h-5 text-primary" />
            Reference Materials
          </CardTitle>
          <CardDescription>
            Upload examples of your brand — past marketing, ads, imagery, your logo, brand
            guidelines — and tell your AI agents what each one is and why it matters.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload control */}
          <div>
            <input
              ref={assetFileInputRef}
              type="file"
              accept="image/*,video/*,application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleAssetFile(file);
                }
                e.target.value = '';
              }}
            />
            <Button
              size="sm"
              className="gap-1.5"
              disabled={uploadingAsset}
              onClick={() => assetFileInputRef.current?.click()}
            >
              {uploadingAsset ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Upload className="w-3.5 h-3.5" />
              )}
              {uploadingAsset ? 'Uploading…' : 'Upload Reference'}
            </Button>
            {assetError && <p className="text-xs text-destructive mt-2">{assetError}</p>}
          </div>

          {/* List of uploaded assets */}
          {identity.exampleAssets.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No reference materials yet. Upload your first example above.
            </p>
          ) : (
            <div className="space-y-4">
              {identity.exampleAssets.map((asset) => (
                <div
                  key={asset.id}
                  className="bg-surface-elevated border border-border-light rounded-lg p-4 space-y-4"
                >
                  {/* Preview */}
                  <div className="flex items-center gap-3">
                    {asset.kind === 'image' ? (
                      <div className="w-16 h-16 bg-background rounded-lg flex items-center justify-center border border-border-light overflow-hidden relative shrink-0">
                        <Image
                          src={asset.url}
                          alt={asset.fileName}
                          fill
                          className="object-contain"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 bg-background rounded-lg flex items-center justify-center border border-border-light shrink-0">
                        {asset.kind === 'video' ? (
                          <FileVideo className="w-7 h-7 text-muted-foreground" />
                        ) : asset.kind === 'document' ? (
                          <FileText className="w-7 h-7 text-muted-foreground" />
                        ) : (
                          <FileIcon className="w-7 h-7 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <p className="text-sm text-foreground break-all">{asset.fileName}</p>
                  </div>

                  {/* Labeled fields */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-foreground block mb-1.5">What is this?</label>
                      <Input
                        value={asset.description}
                        onChange={(e) => updateAsset(asset.id, 'description', e.target.value)}
                        onBlur={persistAssetsOnBlur}
                        placeholder="e.g. Our 2025 product launch ad"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-foreground block mb-1.5">
                        Why are you sharing it?
                      </label>
                      <Input
                        value={asset.purpose}
                        onChange={(e) => updateAsset(asset.id, 'purpose', e.target.value)}
                        onBlur={persistAssetsOnBlur}
                        placeholder="e.g. example of prior marketing / our new logo / tone we want to match"
                      />
                    </div>
                  </div>

                  {/* Two-step remove */}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant={armedRemoveId === asset.id ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => handleRemoveAsset(asset.id)}
                    >
                      {armedRemoveId === asset.id ? 'Click again to remove' : 'Remove'}
                    </Button>
                    {armedRemoveId === asset.id && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setArmedRemoveId(null)}
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
