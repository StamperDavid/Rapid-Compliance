'use client';

import { useState, useEffect, useCallback, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Dna, Save, Loader2, X } from 'lucide-react';
import { auth } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger/logger';
import type { BrandDNA } from '@/lib/brand/brand-dna-service';

const FILE = 'settings/brand-dna/page.tsx';

const TONE_OPTIONS = [
  { value: 'professional', label: 'Professional' },
  { value: 'casual', label: 'Casual' },
  { value: 'friendly', label: 'Friendly' },
  { value: 'authoritative', label: 'Authoritative' },
  { value: 'conversational', label: 'Conversational' },
  { value: 'inspirational', label: 'Inspirational' },
] as const;

type ToneOption = (typeof TONE_OPTIONS)[number]['value'];

const DEFAULT_FORM: BrandDNA = {
  companyDescription: '',
  uniqueValue: '',
  targetAudience: '',
  toneOfVoice: 'professional',
  communicationStyle: '',
  keyPhrases: [],
  avoidPhrases: [],
  industry: '',
  competitors: [],
};

interface BrandDNAGetResponse {
  success: boolean;
  data: BrandDNA | null;
}

function isBrandDNAGetResponse(value: unknown): value is BrandDNAGetResponse {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    typeof (value as Record<string, unknown>).success === 'boolean'
  );
}

// ---------------------------------------------------------------------------
// Tag Input sub-component
// ---------------------------------------------------------------------------

interface TagInputProps {
  label: string;
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (index: number) => void;
  placeholder?: string;
  helpText?: string;
}

function TagInput({ label, tags, onAdd, onRemove, placeholder, helpText }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const commitTag = () => {
    const trimmed = inputValue.trim();
    if (trimmed.length === 0) { return; }
    const entries = trimmed.split(',').map(s => s.trim()).filter(s => s.length > 0);
    entries.forEach(entry => onAdd(entry));
    setInputValue('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitTag();
    }
    if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      onRemove(tags.length - 1);
    }
  };

  return (
    <div>
      <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">
        {label}
      </label>
      <div className="flex flex-wrap gap-2 p-3 rounded-lg border border-border-light bg-surface-main focus-within:border-[var(--color-primary)] transition-colors min-h-[3rem]">
        {tags.map((tag, index) => (
          <span
            key={`${tag}-${index}`}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[var(--color-primary)]/20 text-[var(--color-primary)] border border-[var(--color-primary)]/30"
          >
            {tag}
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="hover:opacity-70 transition-opacity"
              aria-label={`Remove ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitTag}
          placeholder={tags.length === 0 ? (placeholder ?? 'Type and press Enter') : ''}
          className="flex-1 min-w-[8rem] bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none"
        />
      </div>
      {helpText && (
        <p className="mt-1 text-xs text-[var(--color-text-secondary)] italic">{helpText}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BrandDNAPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState<BrandDNA>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadBrandDNA = useCallback(async () => {
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) { setLoading(false); return; }

      const response = await fetch('/api/brand-dna', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const raw: unknown = await response.json();
      if (isBrandDNAGetResponse(raw) && raw.success && raw.data) {
        setForm(raw.data);
      }
    } catch (error: unknown) {
      logger.error('Failed to load Brand DNA', error instanceof Error ? error : new Error(String(error)), { file: FILE });
      toast.error('Failed to load Brand DNA profile');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) { void loadBrandDNA(); }
  }, [user, loadBrandDNA]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = await auth?.currentUser?.getIdToken();
      if (!token) { toast.error('Authentication required'); return; }

      const response = await fetch('/api/brand-dna', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const raw: unknown = await response.json();
      const isSuccess = typeof raw === 'object' && raw !== null && 'success' in raw && (raw as Record<string, unknown>).success === true;

      if (response.ok && isSuccess) {
        toast.success('Brand DNA saved — AI tools will now use your brand voice');
      } else {
        const errorMsg = typeof raw === 'object' && raw !== null && 'error' in raw
          ? String((raw as Record<string, unknown>).error)
          : 'Failed to save Brand DNA';
        toast.error(errorMsg);
      }
    } catch (error: unknown) {
      logger.error('Failed to save Brand DNA', error instanceof Error ? error : new Error(String(error)), { file: FILE });
      toast.error('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const setTextField = (key: keyof Pick<BrandDNA, 'companyDescription' | 'uniqueValue' | 'targetAudience' | 'communicationStyle' | 'industry'>) =>
    (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [key]: e.target.value }));
    };

  const setTone = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setForm(prev => ({ ...prev, toneOfVoice: e.target.value as ToneOption }));
  };

  const addTag = (field: 'keyPhrases' | 'avoidPhrases' | 'competitors') => (tag: string) => {
    setForm(prev => ({ ...prev, [field]: [...prev[field], tag] }));
  };

  const removeTag = (field: 'keyPhrases' | 'avoidPhrases' | 'competitors') => (index: number) => {
    setForm(prev => ({ ...prev, [field]: prev[field].filter((_, i) => i !== index) }));
  };

  const inputCls = 'w-full px-3 py-2 rounded-lg border border-border-light bg-surface-main text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] focus:outline-none focus:border-[var(--color-primary)] transition-colors';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface-main">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-main text-[var(--color-text-primary)]">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="sticky top-0 z-10 px-6 py-4 border-b border-border-light bg-surface-elevated backdrop-blur-sm flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
            Settings
          </Link>
          <span className="text-[var(--color-text-secondary)]">/</span>
          <div className="flex items-center gap-2">
            <Dna className="w-5 h-5 text-[var(--color-primary)]" />
            <h1 className="text-lg font-semibold">Brand DNA</h1>
          </div>
        </div>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-primary to-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </motion.div>

      {/* Body */}
      <div className="max-w-3xl mx-auto px-6 py-8">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.05 }} className="mb-8">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Define your brand identity for AI-powered content. These values are used across email, social, and SEO tools to ensure consistent, on-brand output.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35, delay: 0.1 }} className="flex flex-col gap-6">
          {/* Company Identity */}
          <section className="rounded-xl border border-border-light bg-surface-elevated p-6 flex flex-col gap-5">
            <h2 className="text-base font-semibold">Company Identity</h2>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">Company Description</label>
              <textarea rows={3} value={form.companyDescription} onChange={setTextField('companyDescription')} placeholder="Describe what your company does in 2-3 sentences..." className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">Industry</label>
              <input type="text" value={form.industry} onChange={setTextField('industry')} placeholder="e.g. B2B SaaS, Real Estate, Healthcare" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">Unique Value Proposition</label>
              <textarea rows={2} value={form.uniqueValue} onChange={setTextField('uniqueValue')} placeholder="What sets you apart from competitors?" className={inputCls} />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">Target Audience</label>
              <textarea rows={2} value={form.targetAudience} onChange={setTextField('targetAudience')} placeholder="Who are your ideal customers? Job titles, company sizes, pain points..." className={inputCls} />
            </div>
            <TagInput label="Competitors" tags={form.competitors} onAdd={addTag('competitors')} onRemove={removeTag('competitors')} placeholder="Type a competitor name and press Enter" helpText="Add main competitors so the AI knows the competitive landscape." />
          </section>

          {/* Voice & Style */}
          <section className="rounded-xl border border-border-light bg-surface-elevated p-6 flex flex-col gap-5">
            <h2 className="text-base font-semibold">Voice &amp; Style</h2>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">Tone of Voice</label>
              <select value={form.toneOfVoice} onChange={setTone} className={inputCls}>
                {TONE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)] italic">The overall emotional register used in all AI-generated content.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-[var(--color-text-primary)] mb-1">Communication Style</label>
              <textarea rows={2} value={form.communicationStyle} onChange={setTextField('communicationStyle')} placeholder="e.g. Data-driven and direct. Lead with outcomes, back with evidence." className={inputCls} />
              <p className="mt-1 text-xs text-[var(--color-text-secondary)] italic">Describe how your brand communicates — structure, depth, rhythm.</p>
            </div>
          </section>

          {/* Language Rules */}
          <section className="rounded-xl border border-border-light bg-surface-elevated p-6 flex flex-col gap-5">
            <h2 className="text-base font-semibold">Language Rules</h2>
            <TagInput label="Key Phrases to Use" tags={form.keyPhrases} onAdd={addTag('keyPhrases')} onRemove={removeTag('keyPhrases')} placeholder='e.g. "revenue acceleration", "sales velocity"' helpText="Words and phrases the AI should actively use in content." />
            <TagInput label="Phrases to Avoid" tags={form.avoidPhrases} onAdd={addTag('avoidPhrases')} onRemove={removeTag('avoidPhrases')} placeholder='e.g. "cheap", "basic", "just"' helpText="Words and phrases the AI must never use in content." />
          </section>

          {/* Footer save */}
          <div className="flex justify-end pb-4">
            <button
              onClick={() => void handleSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-primary to-secondary disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Brand DNA'}
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
