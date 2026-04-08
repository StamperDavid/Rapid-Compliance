'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Palette,
  Upload,
  Save,
  Loader2,
  CheckCircle,
  Type,
  Image as ImageIcon,
  Film,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  DEFAULT_BRAND_KIT,
  BRAND_FONT_OPTIONS,
  INTRO_OUTRO_TEMPLATES,
  type BrandKit,
  type LogoPosition,
} from '@/types/brand-kit';
import { PageTitle, SectionDescription } from '@/components/ui/typography';

// ── Logo Position Labels ────────────────────────────────────────────────────

const POSITION_OPTIONS: { value: LogoPosition; label: string }[] = [
  { value: 'top-left', label: 'Top Left' },
  { value: 'top-right', label: 'Top Right' },
  { value: 'bottom-left', label: 'Bottom Left' },
  { value: 'bottom-right', label: 'Bottom Right' },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function BrandKitPage() {
  const authFetch = useAuthFetch();
  const [brandKit, setBrandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const res = await authFetch('/api/settings/brand-kit');
        if (res.ok) {
          const data = await res.json() as { success: boolean; brandKit: BrandKit };
          if (data.success && data.brandKit) {
            setBrandKit(data.brandKit);
          }
        }
      } catch {
        // Use defaults on error
      } finally {
        setLoading(false);
      }
    })();
  }, [authFetch]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await authFetch('/api/settings/brand-kit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: brandKit.enabled,
          logo: brandKit.logo,
          colors: brandKit.colors,
          typography: brandKit.typography,
          introOutro: brandKit.introOutro,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {
      // Error silently handled
    } finally {
      setSaving(false);
    }
  }, [authFetch, brandKit]);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const updateColors = (field: string, value: string) => {
    setBrandKit((prev) => ({
      ...prev,
      colors: { ...prev.colors, [field]: value },
    }));
  };

  const updateTypography = (field: string, value: string) => {
    setBrandKit((prev) => ({
      ...prev,
      typography: { ...prev.typography, [field]: value },
    }));
  };

  const updateIntroOutro = (field: string, value: string | number | null) => {
    setBrandKit((prev) => ({
      ...prev,
      introOutro: { ...prev.introOutro, [field]: value },
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <PageTitle className="flex items-center gap-3">
            <Palette className="w-7 h-7 text-amber-500" />
            Brand Kit
          </PageTitle>
          <SectionDescription className="mt-1">
            Configure your visual identity — applied automatically to all video output
          </SectionDescription>
        </div>
        <div className="flex items-center gap-3">
          {/* Enable/Disable Toggle */}
          <button
            onClick={() => setBrandKit((prev) => ({ ...prev, enabled: !prev.enabled }))}
            className="flex items-center gap-2 text-sm"
          >
            {brandKit.enabled ? (
              <>
                <ToggleRight className="w-6 h-6 text-green-400" />
                <span className="text-green-400">Active</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-6 h-6 text-zinc-500" />
                <span className="text-zinc-500">Inactive</span>
              </>
            )}
          </button>

          <Button
            onClick={() => { void handleSave(); }}
            disabled={saving}
            className={`gap-2 ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-amber-600 hover:bg-amber-700'} text-white`}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save Brand Kit'}
          </Button>
        </div>
      </div>

      {/* ── Section 1: Logo ────────────────────────────────────────────────── */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <ImageIcon className="w-5 h-5 text-amber-500" />
            Logo Watermark
          </CardTitle>
          <CardDescription>
            Your logo is overlaid on every video. Upload a PNG or SVG with transparent background.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo URL Input */}
          <div>
            <label className="text-sm text-zinc-300 block mb-1">Logo URL</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={brandKit.logo?.url ?? ''}
                onChange={(e) =>
                  setBrandKit((prev) => ({
                    ...prev,
                    logo: {
                      url: e.target.value,
                      position: prev.logo?.position ?? 'bottom-right',
                      opacity: prev.logo?.opacity ?? 0.7,
                      scale: prev.logo?.scale ?? 0.1,
                    },
                  }))
                }
                placeholder="https://... (paste logo URL)"
                className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => {
                  // Clear logo
                  setBrandKit((prev) => ({ ...prev, logo: null }));
                }}
              >
                <Upload className="w-3.5 h-3.5" />
                Clear
              </Button>
            </div>
          </div>

          {/* Logo Preview */}
          {brandKit.logo?.url && (
            <div className="flex items-start gap-6">
              <div className="w-24 h-24 bg-zinc-800 rounded-lg flex items-center justify-center border border-zinc-700 overflow-hidden relative">
                <Image
                  src={brandKit.logo.url}
                  alt="Brand logo preview"
                  fill
                  className="object-contain"
                  style={{ opacity: brandKit.logo.opacity }}
                  unoptimized
                />
              </div>

              <div className="flex-1 space-y-3">
                {/* Position */}
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">Position</label>
                  <div className="flex gap-2">
                    {POSITION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() =>
                          setBrandKit((prev) => ({
                            ...prev,
                            logo: prev.logo ? { ...prev.logo, position: opt.value } : null,
                          }))
                        }
                        className={`px-3 py-1.5 text-xs rounded-md border ${
                          brandKit.logo?.position === opt.value
                            ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                            : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Opacity */}
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    Opacity: {Math.round((brandKit.logo?.opacity ?? 0.7) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.05"
                    value={brandKit.logo?.opacity ?? 0.7}
                    onChange={(e) =>
                      setBrandKit((prev) => ({
                        ...prev,
                        logo: prev.logo ? { ...prev.logo, opacity: Number(e.target.value) } : null,
                      }))
                    }
                    className="w-full accent-amber-500"
                  />
                </div>

                {/* Scale */}
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    Size: {Math.round((brandKit.logo?.scale ?? 0.1) * 100)}% of video width
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.25"
                    step="0.01"
                    value={brandKit.logo?.scale ?? 0.1}
                    onChange={(e) =>
                      setBrandKit((prev) => ({
                        ...prev,
                        logo: prev.logo ? { ...prev.logo, scale: Number(e.target.value) } : null,
                      }))
                    }
                    className="w-full accent-amber-500"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Section 2: Colors ──────────────────────────────────────────────── */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <Palette className="w-5 h-5 text-amber-500" />
            Brand Colors
          </CardTitle>
          <CardDescription>
            Used for captions, text overlays, intro/outro backgrounds, and accent elements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {(['primary', 'secondary', 'accent'] as const).map((field) => (
              <div key={field}>
                <label className="text-sm text-zinc-300 block mb-1.5 capitalize">{field}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={brandKit.colors[field]}
                    onChange={(e) => updateColors(field, e.target.value)}
                    className="w-10 h-10 rounded-lg border border-zinc-700 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={brandKit.colors[field]}
                    onChange={(e) => updateColors(field, e.target.value)}
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Color Preview */}
          <div className="mt-4 flex gap-2">
            <div
              className="h-8 flex-1 rounded-l-lg"
              style={{ backgroundColor: brandKit.colors.primary }}
            />
            <div
              className="h-8 flex-1"
              style={{ backgroundColor: brandKit.colors.secondary }}
            />
            <div
              className="h-8 flex-1 rounded-r-lg"
              style={{ backgroundColor: brandKit.colors.accent }}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Section 3: Typography ──────────────────────────────────────────── */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <Type className="w-5 h-5 text-amber-500" />
            Caption Typography
          </CardTitle>
          <CardDescription>
            Font and color settings for auto-generated captions and text overlays.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Font Family */}
          <div>
            <label className="text-sm text-zinc-300 block mb-1.5">Font Family</label>
            <select
              value={brandKit.typography.fontFamily}
              onChange={(e) => updateTypography('fontFamily', e.target.value)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-amber-500"
            >
              {BRAND_FONT_OPTIONS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </div>

          {/* Caption Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-zinc-300 block mb-1.5">Caption Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandKit.typography.captionColor}
                  onChange={(e) => updateTypography('captionColor', e.target.value)}
                  className="w-10 h-10 rounded-lg border border-zinc-700 cursor-pointer bg-transparent"
                />
                <input
                  type="text"
                  value={brandKit.typography.captionColor}
                  onChange={(e) => updateTypography('captionColor', e.target.value)}
                  className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
            <div>
              <label className="text-sm text-zinc-300 block mb-1.5">Caption Background</label>
              <input
                type="text"
                value={brandKit.typography.captionBackground}
                onChange={(e) => updateTypography('captionBackground', e.target.value)}
                placeholder="rgba(0,0,0,0.6)"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <p className="text-xs text-zinc-500 mb-2">Preview</p>
            <div className="flex justify-center">
              <span
                style={{
                  fontFamily: brandKit.typography.fontFamily,
                  color: brandKit.typography.captionColor,
                  backgroundColor: brandKit.typography.captionBackground,
                  padding: '4px 12px',
                  borderRadius: '4px',
                  fontSize: '16px',
                }}
              >
                This is what your captions will look like
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Section 4: Intro/Outro ─────────────────────────────────────────── */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white text-lg">
            <Film className="w-5 h-5 text-amber-500" />
            Intro &amp; Outro
          </CardTitle>
          <CardDescription>
            Branded intro and outro clips prepended/appended to every assembled video.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Intro */}
          <div>
            <h3 className="text-sm font-medium text-zinc-200 mb-3">Intro</h3>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {INTRO_OUTRO_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() =>
                    updateIntroOutro(
                      'introTemplate',
                      brandKit.introOutro.introTemplate === tmpl.id ? null : tmpl.id,
                    )
                  }
                  className={`p-3 rounded-lg border text-left ${
                    brandKit.introOutro.introTemplate === tmpl.id
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <p className="text-xs font-medium text-white">{tmpl.label}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{tmpl.description}</p>
                </button>
              ))}
            </div>

            {brandKit.introOutro.introTemplate === 'custom' && (
              <input
                type="text"
                value={brandKit.introOutro.introCustomUrl ?? ''}
                onChange={(e) => updateIntroOutro('introCustomUrl', e.target.value || null)}
                placeholder="https://... (custom intro video URL)"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            )}

            {brandKit.introOutro.introTemplate && (
              <div className="mt-2">
                <label className="text-xs text-zinc-400 block mb-1">
                  Duration: {brandKit.introOutro.introDuration}s
                </label>
                <input
                  type="range"
                  min="2"
                  max="10"
                  step="0.5"
                  value={brandKit.introOutro.introDuration}
                  onChange={(e) => updateIntroOutro('introDuration', Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
            )}
          </div>

          {/* Outro */}
          <div>
            <h3 className="text-sm font-medium text-zinc-200 mb-3">Outro</h3>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {INTRO_OUTRO_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() =>
                    updateIntroOutro(
                      'outroTemplate',
                      brandKit.introOutro.outroTemplate === tmpl.id ? null : tmpl.id,
                    )
                  }
                  className={`p-3 rounded-lg border text-left ${
                    brandKit.introOutro.outroTemplate === tmpl.id
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-zinc-700 hover:border-zinc-600'
                  }`}
                >
                  <p className="text-xs font-medium text-white">{tmpl.label}</p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{tmpl.description}</p>
                </button>
              ))}
            </div>

            {brandKit.introOutro.outroTemplate === 'custom' && (
              <input
                type="text"
                value={brandKit.introOutro.outroCustomUrl ?? ''}
                onChange={(e) => updateIntroOutro('outroCustomUrl', e.target.value || null)}
                placeholder="https://... (custom outro video URL)"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
              />
            )}

            {brandKit.introOutro.outroTemplate && (
              <div className="mt-2 space-y-2">
                <div>
                  <label className="text-xs text-zinc-400 block mb-1">
                    Duration: {brandKit.introOutro.outroDuration}s
                  </label>
                  <input
                    type="range"
                    min="2"
                    max="10"
                    step="0.5"
                    value={brandKit.introOutro.outroDuration}
                    onChange={(e) => updateIntroOutro('outroDuration', Number(e.target.value))}
                    className="w-full accent-amber-500"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 block mb-1">CTA Text</label>
                  <input
                    type="text"
                    value={brandKit.introOutro.outroCta}
                    onChange={(e) => updateIntroOutro('outroCta', e.target.value)}
                    placeholder="e.g., Visit salesvelocity.ai"
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
