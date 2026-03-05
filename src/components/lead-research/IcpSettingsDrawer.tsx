'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2 } from 'lucide-react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import type { IcpProfile } from '@/types/icp-profile';

interface IcpSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  profile: IcpProfile | null;
  profiles: IcpProfile[];
  onSaved: () => void;
}

interface FormState {
  name: string;
  description: string;
  isActive: boolean;
  targetIndustries: string[];
  excludedIndustries: string[];
  companySizeMin: number;
  companySizeMax: number;
  preferredLocations: string[];
  preferredTechStack: string[];
  preferredFundingStages: string[];
  targetTitles: string[];
  targetSeniority: string[];
}

function profileToForm(p: IcpProfile | null): FormState {
  return {
    name: p?.name ?? '',
    description: p?.description ?? '',
    isActive: p?.isActive ?? true,
    targetIndustries: p?.targetIndustries ?? [],
    excludedIndustries: p?.excludedIndustries ?? [],
    companySizeMin: p?.companySizeRange?.min ?? 1,
    companySizeMax: p?.companySizeRange?.max ?? 10000,
    preferredLocations: p?.preferredLocations ?? [],
    preferredTechStack: p?.preferredTechStack ?? [],
    preferredFundingStages: p?.preferredFundingStages ?? [],
    targetTitles: p?.targetTitles ?? [],
    targetSeniority: p?.targetSeniority ?? [],
  };
}

export default function IcpSettingsDrawer({
  isOpen,
  onClose,
  profile,
  profiles,
  onSaved,
}: IcpSettingsDrawerProps) {
  const authFetch = useAuthFetch();
  const [form, setForm] = useState<FormState>(profileToForm(profile));
  const [saving, setSaving] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>(profile?.id ?? 'new');

  useEffect(() => {
    if (isOpen) {
      const p = profiles.find(pr => pr.id === selectedProfileId) ?? null;
      setForm(profileToForm(selectedProfileId === 'new' ? null : p));
    }
  }, [isOpen, selectedProfileId, profiles]);

  const handleArrayFieldChange = (field: keyof FormState, value: string) => {
    const items = value.split(',').map(s => s.trim()).filter(Boolean);
    setForm(prev => ({ ...prev, [field]: items }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) { return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        description: form.description || undefined,
        isActive: form.isActive,
        targetIndustries: form.targetIndustries,
        excludedIndustries: form.excludedIndustries,
        companySizeRange: { min: form.companySizeMin, max: form.companySizeMax },
        preferredLocations: form.preferredLocations,
        preferredTechStack: form.preferredTechStack,
        preferredFundingStages: form.preferredFundingStages,
        targetTitles: form.targetTitles,
        targetDepartments: [],
        targetSeniority: form.targetSeniority,
        weights: { industry: 5, companySize: 5, location: 3, techStack: 3, fundingStage: 2, title: 4, seniority: 4 },
        exampleCompanies: [],
      };

      if (selectedProfileId === 'new') {
        const res = await authFetch('/api/leads/icp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { throw new Error(`Create failed: ${res.status}`); }
      } else {
        const res = await authFetch(`/api/leads/icp/${selectedProfileId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) { throw new Error(`Update failed: ${res.status}`); }
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      logger.error('ICP save failed', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) { return null; }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="w-[420px] bg-[var(--color-bg-elevated)] border-l border-[var(--color-border-light)] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border-light)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            ICP Profile Settings
          </h3>
          <button onClick={onClose} className="text-[var(--color-text-disabled)] hover:text-[var(--color-text-primary)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Profile selector */}
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Profile</label>
            <select
              value={selectedProfileId}
              onChange={e => setSelectedProfileId(e.target.value)}
              className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
            >
              <option value="new">+ New Profile</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.name}{p.isActive ? ' (Active)' : ''}</option>
              ))}
            </select>
          </div>

          {/* Name */}
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Name</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. SaaS Decision Makers"
              className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Target Industries */}
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Target Industries (comma-separated)</label>
            <input
              type="text"
              value={form.targetIndustries.join(', ')}
              onChange={e => handleArrayFieldChange('targetIndustries', e.target.value)}
              placeholder="SaaS, Fintech, Healthcare"
              className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Company Size */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Min Employees</label>
              <input
                type="number"
                min={1}
                value={form.companySizeMin}
                onChange={e => setForm(prev => ({ ...prev, companySizeMin: Number(e.target.value) }))}
                className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Max Employees</label>
              <input
                type="number"
                min={1}
                value={form.companySizeMax}
                onChange={e => setForm(prev => ({ ...prev, companySizeMax: Number(e.target.value) }))}
                className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Locations */}
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Preferred Locations</label>
            <input
              type="text"
              value={form.preferredLocations.join(', ')}
              onChange={e => handleArrayFieldChange('preferredLocations', e.target.value)}
              placeholder="Austin TX, San Francisco CA"
              className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Tech Stack */}
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Preferred Tech Stack</label>
            <input
              type="text"
              value={form.preferredTechStack.join(', ')}
              onChange={e => handleArrayFieldChange('preferredTechStack', e.target.value)}
              placeholder="React, Stripe, AWS"
              className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Target Titles */}
          <div>
            <label className="block text-xs text-[var(--color-text-secondary)] mb-1">Target Job Titles</label>
            <input
              type="text"
              value={form.targetTitles.join(', ')}
              onChange={e => handleArrayFieldChange('targetTitles', e.target.value)}
              placeholder="CTO, VP Engineering, Head of Sales"
              className="w-full bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-[var(--color-text-secondary)]">Set as Active Profile</label>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={e => setForm(prev => ({ ...prev, isActive: e.target.checked }))}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-[var(--color-bg-main)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600 border border-[var(--color-border-light)]" />
            </label>
          </div>
        </div>

        {/* Save button */}
        <div className="p-4 border-t border-[var(--color-border-light)]">
          <button
            onClick={() => void handleSave()}
            disabled={!form.name.trim() || saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : selectedProfileId === 'new' ? 'Create Profile' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
