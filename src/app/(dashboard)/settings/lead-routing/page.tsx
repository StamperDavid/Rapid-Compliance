'use client';

import { useEffect, useState, useCallback } from 'react';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import { useToast } from '@/hooks/useToast';
import type { RoutingRule, RoutingCondition } from '@/lib/crm/lead-routing';

type RoutingType = RoutingRule['routingType'];

const ROUTING_TYPE_CONFIG: Record<RoutingType, { label: string; badgeClass: string }> = {
  'round-robin': { label: 'Round Robin', badgeClass: 'bg-blue-500/20 text-blue-400' },
  'territory': { label: 'Territory', badgeClass: 'bg-purple-500/20 text-purple-400' },
  'skill-based': { label: 'Skill-Based', badgeClass: 'bg-cyan-500/20 text-cyan-400' },
  'load-balance': { label: 'Load Balance', badgeClass: 'bg-green-500/20 text-green-400' },
  'custom': { label: 'Custom', badgeClass: 'bg-orange-500/20 text-orange-400' },
};

const CONDITION_FIELDS = [
  { value: 'source', label: 'Lead Source' },
  { value: 'status', label: 'Status' },
  { value: 'score', label: 'Lead Score' },
  { value: 'company', label: 'Company' },
  { value: 'industry', label: 'Industry' },
  { value: 'state', label: 'State' },
  { value: 'country', label: 'Country' },
  { value: 'language', label: 'Language' },
  { value: 'dealValue', label: 'Deal Value' },
];

const CONDITION_OPERATORS: Array<{ value: RoutingCondition['operator']; label: string }> = [
  { value: 'equals', label: 'equals' },
  { value: 'contains', label: 'contains' },
  { value: 'greater_than', label: 'greater than' },
  { value: 'less_than', label: 'less than' },
  { value: 'in', label: 'is one of' },
];

const BALANCING_PERIODS: Array<{ value: string; label: string }> = [
  { value: 'day', label: 'Per Day' },
  { value: 'week', label: 'Per Week' },
  { value: 'month', label: 'Per Month' },
];

interface RuleFormData {
  name: string;
  routingType: RoutingType;
  priority: number;
  conditions: RoutingCondition[];
  maxLeadsPerUser: number;
  balancingPeriod: string;
}

const EMPTY_FORM: RuleFormData = {
  name: '',
  routingType: 'round-robin',
  priority: 50,
  conditions: [],
  maxLeadsPerUser: 50,
  balancingPeriod: 'week',
};

export default function LeadRoutingPage() {
  const toast = useToast();
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<RuleFormData>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const collectionPath = getSubCollection('leadRoutingRules');

  const loadRules = useCallback(async () => {
    try {
      const results = await FirestoreService.getAll<RoutingRule>(collectionPath);
      setRules(results.sort((a, b) => b.priority - a.priority));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Error loading routing rules:', error, { file: 'lead-routing/page.tsx' });
    } finally {
      setLoading(false);
    }
  }, [collectionPath]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await FirestoreService.update(collectionPath, ruleId, {
        enabled,
        updatedAt: Timestamp.now(),
      });
      setRules(rules.map(r => r.id === ruleId ? { ...r, enabled } : r));
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Error toggling rule:', error, { file: 'lead-routing/page.tsx' });
      toast.error('Failed to update rule');
    }
  };

  const handleDelete = async (ruleId: string) => {
    setDeletingId(ruleId);
    try {
      await FirestoreService.delete(collectionPath, ruleId);
      setRules(rules.filter(r => r.id !== ruleId));
      toast.success('Rule deleted');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Error deleting rule:', error, { file: 'lead-routing/page.tsx' });
      toast.error('Failed to delete rule');
    } finally {
      setDeletingId(null);
    }
  };

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [...formData.conditions, { field: 'source', operator: 'equals', value: '' }],
    });
  };

  const removeCondition = (idx: number) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== idx),
    });
  };

  const updateCondition = (idx: number, field: keyof RoutingCondition, value: string | number) => {
    const updated = [...formData.conditions];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormData({ ...formData, conditions: updated });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    setSaving(true);
    try {
      const ruleId = `rule-${Date.now()}`;
      const newRule: RoutingRule = {
        id: ruleId,
        name: formData.name,
        enabled: true,
        priority: formData.priority,
        routingType: formData.routingType,
        assignedUsers: [],
        conditions: formData.conditions.length > 0 ? formData.conditions : undefined,
        metadata: formData.routingType === 'load-balance' ? {
          maxLeadsPerUser: formData.maxLeadsPerUser,
          balancingPeriod: formData.balancingPeriod as 'day' | 'week' | 'month',
        } : undefined,
        createdAt: new Date(),
      };
      await FirestoreService.set(collectionPath, ruleId, {
        ...newRule,
        createdAt: Timestamp.now(),
      }, false);
      setRules([...rules, newRule].sort((a, b) => b.priority - a.priority));
      setFormData({ ...EMPTY_FORM });
      setShowForm(false);
      toast.success('Routing rule created');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      logger.error('Error creating rule:', error, { file: 'lead-routing/page.tsx' });
      toast.error('Failed to create rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 text-[var(--color-text-primary)]">Lead Routing</h1>
            <p className="text-[var(--color-text-secondary)]">Automatically assign leads to the right team members</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 rounded-lg bg-primary text-white hover:opacity-90"
          >
            {showForm ? 'Cancel' : '+ New Routing Rule'}
          </button>
        </div>

        {/* Create Rule Form */}
        {showForm && (
          <div className="bg-surface-paper rounded-lg p-6 mb-6 border border-border-light">
            <h2 className="text-lg font-semibold mb-4 text-[var(--color-text-primary)]">New Routing Rule</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Rule Name *</label>
                  <input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., West Coast Territory"
                    className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Routing Type</label>
                  <select
                    value={formData.routingType}
                    onChange={(e) => setFormData({ ...formData, routingType: e.target.value as RoutingType })}
                    className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                  >
                    {Object.entries(ROUTING_TYPE_CONFIG).map(([value, cfg]) => (
                      <option key={value} value={value}>{cfg.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">
                    Priority (1-100, higher = evaluated first)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 50 })}
                    className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                  />
                </div>
                {formData.routingType === 'load-balance' && (
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Max Leads/User</label>
                      <input
                        type="number"
                        min={1}
                        value={formData.maxLeadsPerUser}
                        onChange={(e) => setFormData({ ...formData, maxLeadsPerUser: parseInt(e.target.value) || 50 })}
                        className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-medium mb-1 text-[var(--color-text-secondary)]">Period</label>
                      <select
                        value={formData.balancingPeriod}
                        onChange={(e) => setFormData({ ...formData, balancingPeriod: e.target.value })}
                        className="w-full px-4 py-2 bg-surface-elevated border border-border-light rounded-lg focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                      >
                        {BALANCING_PERIODS.map((p) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Conditions */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                    Conditions (optional — when should this rule apply?)
                  </label>
                  <button
                    type="button"
                    onClick={addCondition}
                    className="text-xs px-3 py-1 bg-primary text-white rounded hover:opacity-90"
                  >
                    + Add Condition
                  </button>
                </div>
                {formData.conditions.length === 0 && (
                  <p className="text-xs text-[var(--color-text-secondary)] italic">No conditions — rule applies to all leads</p>
                )}
                <div className="space-y-2">
                  {formData.conditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={cond.field}
                        onChange={(e) => updateCondition(idx, 'field', e.target.value)}
                        className="px-3 py-1.5 text-sm bg-surface-elevated border border-border-light rounded focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                      >
                        {CONDITION_FIELDS.map((f) => (
                          <option key={f.value} value={f.value}>{f.label}</option>
                        ))}
                      </select>
                      <select
                        value={cond.operator}
                        onChange={(e) => updateCondition(idx, 'operator', e.target.value)}
                        className="px-3 py-1.5 text-sm bg-surface-elevated border border-border-light rounded focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                      >
                        {CONDITION_OPERATORS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                      <input
                        value={String(cond.value ?? '')}
                        onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                        placeholder="Value"
                        className="flex-1 px-3 py-1.5 text-sm bg-surface-elevated border border-border-light rounded focus:border-primary focus:outline-none text-[var(--color-text-primary)]"
                      />
                      <button
                        type="button"
                        onClick={() => removeCondition(idx)}
                        className="p-1 text-[var(--color-text-secondary)] hover:text-error"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => { setShowForm(false); setFormData({ ...EMPTY_FORM }); }}
                  className="px-4 py-2 bg-surface-elevated rounded-lg text-[var(--color-text-primary)]"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-6 py-2 bg-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? 'Creating...' : 'Create Rule'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Rules List */}
        {loading ? (
          <div className="text-[var(--color-text-primary)]">Loading rules...</div>
        ) : rules.length === 0 ? (
          <div className="bg-surface-paper rounded-lg p-12 text-center">
            <p className="text-[var(--color-text-secondary)] mb-4">No routing rules configured yet</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Leads will be assigned using default round-robin across all team members.
            </p>
            <button
              onClick={() => setShowForm(true)}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90"
            >
              Create Your First Rule
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {rules.map((rule) => {
              const typeConfig = ROUTING_TYPE_CONFIG[rule.routingType] ?? ROUTING_TYPE_CONFIG.custom;
              return (
                <div
                  key={rule.id}
                  className={`bg-surface-paper rounded-lg p-6 transition-opacity ${rule.enabled ? '' : 'opacity-50'}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">{rule.name}</h3>
                      <div className="flex items-center gap-3 text-sm">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeConfig.badgeClass}`}>
                          {typeConfig.label}
                        </span>
                        <span className="text-[var(--color-text-secondary)]">Priority: {rule.priority}</span>
                        {rule.assignedUsers.length > 0 && (
                          <span className="text-[var(--color-text-secondary)]">
                            {rule.assignedUsers.length} user{rule.assignedUsers.length !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => void handleDelete(rule.id)}
                        disabled={deletingId === rule.id}
                        className="text-xs text-[var(--color-text-secondary)] hover:text-error disabled:opacity-50"
                      >
                        {deletingId === rule.id ? 'Deleting...' : 'Delete'}
                      </button>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          onChange={(e) => void toggleRule(rule.id, e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-[var(--color-border-light)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[var(--color-border-light)] after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--color-primary)]" />
                      </label>
                    </div>
                  </div>

                  {/* Conditions */}
                  {rule.conditions && rule.conditions.length > 0 && (
                    <div className="space-y-1 text-sm">
                      {rule.conditions.map((cond, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-[var(--color-text-secondary)]">
                          <span className="font-medium">{cond.field}</span>
                          <span>{cond.operator.replace('_', ' ')}</span>
                          <span className="text-[var(--color-text-primary)]">{String(cond.value)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Load balance metadata */}
                  {rule.routingType === 'load-balance' && rule.metadata && (
                    <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                      Max {rule.metadata.maxLeadsPerUser} leads/{rule.metadata.balancingPeriod}
                    </div>
                  )}

                  {/* Territory metadata */}
                  {rule.routingType === 'territory' && rule.metadata?.territories && (
                    <div className="mt-2 space-y-1 text-sm text-[var(--color-text-secondary)]">
                      {rule.metadata.territories.map((t, idx) => (
                        <div key={idx}>
                          {t.states && <span>States: {t.states.join(', ')}</span>}
                          {t.countries && <span> Countries: {t.countries.join(', ')}</span>}
                          {t.industries && <span> Industries: {t.industries.join(', ')}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* How it works */}
        <div className="mt-8 bg-surface-paper rounded-lg p-6 border border-border-light">
          <h3 className="font-bold mb-2 text-[var(--color-text-primary)]">How Lead Routing Works</h3>
          <div className="text-sm space-y-1 text-[var(--color-text-secondary)]">
            <p>Rules are evaluated in priority order (highest first)</p>
            <p>First matching rule assigns the lead</p>
            <p>If no rules match, falls back to round-robin</p>
            <p>Routing happens automatically when leads are created</p>
          </div>
        </div>
      </div>
    </div>
  );
}
