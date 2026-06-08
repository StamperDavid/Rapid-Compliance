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
  X,
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
} from '@/types/brand-identity';

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
            Voice changes save here; publishing them to your AI agents is a separate step (coming
            next).
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

      {/*
        DEFERRED (do NOT build here): exampleAssets uploads — reference assets that
        exemplify the brand (social posts / ads / images). The store + API already carry
        `exampleAssets`; the upload UI is intentionally out of scope for this page.
      */}
    </div>
  );
}
