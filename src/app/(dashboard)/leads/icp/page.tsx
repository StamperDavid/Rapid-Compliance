'use client';

/**
 * ICP Profile Builder Page
 *
 * Define Ideal Customer Profiles to guide lead discovery scoring.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import SubpageNav from '@/components/ui/SubpageNav';
import { LEADS_TABS } from '@/lib/constants/subpage-nav';
import {
  Target,
  Plus,
  Save,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronUp,
  Building2,
  UserSearch,
  SlidersHorizontal,
  Globe,
  Check,
  X,
} from 'lucide-react';

interface IcpProfile {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  targetIndustries: string[];
  excludedIndustries: string[];
  companySizeRange: { min: number; max: number };
  preferredLocations: string[];
  preferredTechStack: string[];
  preferredFundingStages: string[];
  revenueRange?: { min: number; max: number };
  targetTitles: string[];
  targetDepartments: string[];
  targetSeniority: string[];
  weights: Record<string, number>;
  exampleCompanies: Array<{ domain: string; isPositive: boolean }>;
  feedbackStats: { positiveCount: number; negativeCount: number };
}

interface ApiIcpListResponse {
  profiles: IcpProfile[];
}

interface ApiIcpResponse {
  profile: IcpProfile;
}

const SENIORITY_OPTIONS = ['c-level', 'vp', 'director', 'manager', 'individual'] as const;
const FUNDING_STAGE_OPTIONS = ['Pre-Seed', 'Seed', 'Series A', 'Series B', 'Series C+', 'Public', 'Bootstrapped'] as const;

const DEFAULT_WEIGHTS: Record<string, number> = {
  industry: 5, companySize: 5, location: 3,
  techStack: 3, fundingStage: 2, title: 4, seniority: 4,
};

function emptyProfile(): Omit<IcpProfile, 'id' | 'feedbackStats'> {
  return {
    name: '',
    description: '',
    isActive: false,
    targetIndustries: [],
    excludedIndustries: [],
    companySizeRange: { min: 1, max: 10000 },
    preferredLocations: [],
    preferredTechStack: [],
    preferredFundingStages: [],
    targetTitles: [],
    targetDepartments: [],
    targetSeniority: [],
    weights: { ...DEFAULT_WEIGHTS },
    exampleCompanies: [],
  };
}

export default function IcpProfilePage() {
  const authFetch = useAuthFetch();
  const [profiles, setProfiles] = useState<IcpProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProfile());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string>('company');

  // Tag input state
  const [tagInputs, setTagInputs] = useState<Record<string, string>>({});

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await authFetch('/api/leads/icp');
      const data = (await res.json()) as ApiIcpListResponse;
      setProfiles(data.profiles ?? []);
    } catch (error) {
      logger.error('Failed to fetch ICP profiles', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  const selectProfile = (profile: IcpProfile) => {
    setSelectedId(profile.id);
    setForm({
      name: profile.name,
      description: profile.description ?? '',
      isActive: profile.isActive,
      targetIndustries: profile.targetIndustries,
      excludedIndustries: profile.excludedIndustries,
      companySizeRange: profile.companySizeRange,
      preferredLocations: profile.preferredLocations,
      preferredTechStack: profile.preferredTechStack,
      preferredFundingStages: profile.preferredFundingStages,
      revenueRange: profile.revenueRange,
      targetTitles: profile.targetTitles,
      targetDepartments: profile.targetDepartments,
      targetSeniority: profile.targetSeniority,
      weights: profile.weights,
      exampleCompanies: profile.exampleCompanies,
    });
  };

  const handleNew = () => {
    setSelectedId(null);
    setForm(emptyProfile());
  };

  const handleSave = async () => {
    if (!form.name.trim()) {return;}
    setIsSaving(true);

    try {
      if (selectedId) {
        const res = await authFetch(`/api/leads/icp/${selectedId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = (await res.json()) as ApiIcpResponse;
        setProfiles(prev => prev.map(p => p.id === selectedId ? data.profile : p));
      } else {
        const res = await authFetch('/api/leads/icp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = (await res.json()) as ApiIcpResponse;
        setProfiles(prev => [...prev, data.profile]);
        setSelectedId(data.profile.id);
      }
    } catch (error) {
      logger.error('Failed to save ICP profile', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) {return;}
    try {
      await authFetch(`/api/leads/icp/${selectedId}`, { method: 'DELETE' });
      setProfiles(prev => prev.filter(p => p.id !== selectedId));
      handleNew();
    } catch (error) {
      logger.error('Failed to delete ICP profile', error instanceof Error ? error : new Error(String(error)));
    }
  };

  const addTag = (field: keyof typeof form, value: string) => {
    if (!value.trim()) {return;}
    const current = form[field] as unknown;
    if (Array.isArray(current) && !(current as string[]).includes(value.trim())) {
      setForm(prev => ({ ...prev, [field]: [...(prev[field] as string[]), value.trim()] }));
    }
    setTagInputs(prev => ({ ...prev, [field]: '' }));
  };

  const removeTag = (field: keyof typeof form, value: string) => {
    const current = form[field];
    if (!Array.isArray(current)) {return;}
    setForm(prev => ({
      ...prev,
      [field]: (prev[field] as string[]).filter((v: string) => v !== value),
    }));
  };

  const TagInput = ({ field, placeholder }: { field: keyof typeof form; placeholder: string }) => (
    <div>
      <div className="flex gap-2 mb-2">
        <input
          type="text"
          value={tagInputs[field] ?? ''}
          onChange={e => setTagInputs(prev => ({ ...prev, [field]: e.target.value }))}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(field, tagInputs[field] ?? '');
            }
          }}
          placeholder={placeholder}
          className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
        />
        <button
          type="button"
          onClick={() => addTag(field, tagInputs[field] ?? '')}
          className="px-3 py-2 bg-white/10 border border-white/10 rounded-lg text-white/70 hover:bg-white/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {((form[field] as string[]) ?? []).map(tag => (
          <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 bg-violet-500/20 text-violet-300 text-xs rounded-full border border-violet-500/30">
            {tag}
            <button type="button" onClick={() => removeTag(field, tag)} className="hover:text-white">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
      </div>
    </div>
  );

  const Section = ({ id, icon: Icon, title, children }: { id: string; icon: React.ElementType; title: string; children: React.ReactNode }) => (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setExpandedSection(expandedSection === id ? '' : id)}
        className="w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/[0.07] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-violet-400" />
          <span className="font-medium text-white">{title}</span>
        </div>
        {expandedSection === id ? <ChevronUp className="w-4 h-4 text-white/50" /> : <ChevronDown className="w-4 h-4 text-white/50" />}
      </button>
      <AnimatePresence>
        {expandedSection === id && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--color-bg-main)] p-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
          <Target className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">ICP Profile Builder</h1>
          <p className="text-[var(--color-text-secondary)] text-sm">Define your Ideal Customer Profile to guide lead discovery</p>
        </div>
      </motion.div>

      <SubpageNav items={LEADS_TABS} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
        {/* Profile List (sidebar) */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-white/10 overflow-hidden" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <span className="text-sm font-medium text-white">Profiles</span>
              <button onClick={handleNew} className="p-1.5 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-colors">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {isLoading ? (
              <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>
            ) : profiles.length === 0 ? (
              <div className="p-6 text-center text-white/40 text-sm">No profiles yet. Create your first ICP.</div>
            ) : (
              <div className="divide-y divide-white/5">
                {profiles.map(p => (
                  <button
                    key={p.id}
                    onClick={() => selectProfile(p)}
                    className={`w-full text-left p-3 hover:bg-white/5 transition-colors ${selectedId === p.id ? 'bg-white/10 border-l-2 border-violet-500' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-white truncate">{p.name}</span>
                      {p.isActive && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-green-500/20 text-green-400 rounded-full border border-green-500/30">Active</span>
                      )}
                    </div>
                    {p.description && <p className="text-xs text-white/40 mt-0.5 truncate">{p.description}</p>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Profile Form */}
        <div className="lg:col-span-3 space-y-4">
          {/* Name + Active */}
          <div className="rounded-xl border border-white/10 p-4 space-y-4" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Profile Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Mid-market SaaS in US"
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Description</label>
                <input
                  type="text"
                  value={form.description ?? ''}
                  onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Brief description..."
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                />
              </div>
            </div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setForm(prev => ({ ...prev, isActive: !prev.isActive }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-violet-500' : 'bg-white/20'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.isActive ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm text-white/80">Set as active profile</span>
            </label>
          </div>

          {/* Company Criteria */}
          <Section id="company" icon={Building2} title="Company Criteria">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Target Industries</label>
                <TagInput field="targetIndustries" placeholder="e.g. SaaS, FinTech, Healthcare..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Excluded Industries</label>
                <TagInput field="excludedIndustries" placeholder="e.g. Government, Non-profit..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1">Min Employees</label>
                  <input
                    type="number"
                    value={form.companySizeRange.min}
                    onChange={e => setForm(prev => ({ ...prev, companySizeRange: { ...prev.companySizeRange, min: parseInt(e.target.value) || 0 } }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-white/60 mb-1">Max Employees</label>
                  <input
                    type="number"
                    value={form.companySizeRange.max}
                    onChange={e => setForm(prev => ({ ...prev, companySizeRange: { ...prev.companySizeRange, max: parseInt(e.target.value) || 10000 } }))}
                    className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Preferred Locations</label>
                <TagInput field="preferredLocations" placeholder="e.g. United States, California, London..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Tech Stack</label>
                <TagInput field="preferredTechStack" placeholder="e.g. React, AWS, Stripe..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Funding Stages</label>
                <div className="flex flex-wrap gap-2">
                  {FUNDING_STAGE_OPTIONS.map(stage => {
                    const selected = form.preferredFundingStages.includes(stage);
                    return (
                      <button
                        key={stage}
                        type="button"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            preferredFundingStages: selected
                              ? prev.preferredFundingStages.filter(s => s !== stage)
                              : [...prev.preferredFundingStages, stage],
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                          selected
                            ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                            : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 inline mr-1" />}
                        {stage}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Section>

          {/* Person Criteria */}
          <Section id="person" icon={UserSearch} title="Person Criteria">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Target Job Titles</label>
                <TagInput field="targetTitles" placeholder="e.g. VP of Sales, Marketing Director..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Target Departments</label>
                <TagInput field="targetDepartments" placeholder="e.g. Sales, Marketing, Engineering..." />
              </div>
              <div>
                <label className="block text-xs font-medium text-white/60 mb-1">Seniority Levels</label>
                <div className="flex flex-wrap gap-2">
                  {SENIORITY_OPTIONS.map(level => {
                    const selected = form.targetSeniority.includes(level);
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => {
                          setForm(prev => ({
                            ...prev,
                            targetSeniority: selected
                              ? prev.targetSeniority.filter(s => s !== level)
                              : [...prev.targetSeniority, level],
                          }));
                        }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border capitalize ${
                          selected
                            ? 'bg-violet-500/20 text-violet-300 border-violet-500/30'
                            : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'
                        }`}
                      >
                        {selected && <Check className="w-3 h-3 inline mr-1" />}
                        {level}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </Section>

          {/* Scoring Weights */}
          <Section id="weights" icon={SlidersHorizontal} title="Scoring Weights">
            <div className="space-y-3">
              {Object.entries(form.weights).map(([key, value]) => (
                <div key={key} className="flex items-center gap-4">
                  <span className="w-28 text-sm text-white/70 capitalize">{key.replace(/([A-Z])/g, ' $1')}</span>
                  <input
                    type="range"
                    min={0}
                    max={10}
                    value={value}
                    onChange={e => setForm(prev => ({ ...prev, weights: { ...prev.weights, [key]: parseInt(e.target.value) } }))}
                    className="flex-1 accent-violet-500"
                  />
                  <span className="w-8 text-sm text-white/60 text-right">{value}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* Example Companies */}
          <Section id="examples" icon={Globe} title="Example Companies">
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="domain.com"
                  id="example-domain-input"
                  className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const input = e.currentTarget;
                      if (input.value.trim()) {
                        setForm(prev => ({
                          ...prev,
                          exampleCompanies: [...prev.exampleCompanies, { domain: input.value.trim(), isPositive: true }],
                        }));
                        input.value = '';
                      }
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('example-domain-input') as HTMLInputElement;
                    if (input?.value.trim()) {
                      setForm(prev => ({
                        ...prev,
                        exampleCompanies: [...prev.exampleCompanies, { domain: input.value.trim(), isPositive: true }],
                      }));
                      input.value = '';
                    }
                  }}
                  className="px-3 py-2 bg-green-500/20 text-green-400 border border-green-500/30 rounded-lg text-sm hover:bg-green-500/30 transition-colors"
                >
                  + Positive
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const input = document.getElementById('example-domain-input') as HTMLInputElement;
                    if (input?.value.trim()) {
                      setForm(prev => ({
                        ...prev,
                        exampleCompanies: [...prev.exampleCompanies, { domain: input.value.trim(), isPositive: false }],
                      }));
                      input.value = '';
                    }
                  }}
                  className="px-3 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-lg text-sm hover:bg-red-500/30 transition-colors"
                >
                  + Negative
                </button>
              </div>
              <div className="space-y-1.5">
                {form.exampleCompanies.map((ex, idx) => (
                  <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${ex.isPositive ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                      {ex.isPositive ? 'Good' : 'Bad'}
                    </span>
                    <span className="text-sm text-white flex-1">{ex.domain}</span>
                    <button
                      type="button"
                      onClick={() => setForm(prev => ({
                        ...prev,
                        exampleCompanies: prev.exampleCompanies.filter((_, i) => i !== idx),
                      }))}
                      className="text-white/30 hover:text-red-400"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => void handleSave()}
              disabled={isSaving || !form.name.trim()}
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-400 hover:to-purple-500 disabled:from-gray-600 disabled:to-gray-600 text-white font-medium rounded-xl transition-all disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {selectedId ? 'Update Profile' : 'Create Profile'}
            </button>
            {selectedId && (
              <button
                onClick={() => void handleDelete()}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded-xl transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
