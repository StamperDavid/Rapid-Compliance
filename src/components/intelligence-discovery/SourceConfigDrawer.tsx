'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2, Play, Plus } from 'lucide-react';
import type {
  DiscoverySource,
  EnrichmentDepth,
  ScheduleFrequency,
  FieldDefinition,
} from '@/types/intelligence-discovery';

// ============================================================================
// TYPES
// ============================================================================

interface SourceConfigUpdates {
  name: string;
  description: string;
  baseUrl: string;
  urlPattern: string | null;
  enrichmentDepth: EnrichmentDepth;
  maxRecordsPerRun: number;
  schedule: {
    frequency: ScheduleFrequency;
    timeOfDay: string;
    enabled: boolean;
  };
  enrichmentHints: string[];
  extractionSchema: FieldDefinition[];
}

interface SourceConfigDrawerProps {
  source: DiscoverySource | null;
  onClose: () => void;
  onSave: (sourceId: string, updates: SourceConfigUpdates) => Promise<void>;
  onTestScrape: (sourceId: string) => Promise<void>;
}

interface FormState {
  name: string;
  description: string;
  baseUrl: string;
  urlPattern: string;
  enrichmentDepth: EnrichmentDepth;
  maxRecordsPerRun: number;
  scheduleFrequency: ScheduleFrequency;
  scheduleTimeOfDay: string;
  scheduleEnabled: boolean;
  enrichmentHintsRaw: string;
  extractionSchema: FieldDefinition[];
}

interface NewFieldState {
  fieldName: string;
  fieldType: FieldDefinition['fieldType'];
  required: boolean;
  description: string;
  extractionHint: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function sourceToForm(s: DiscoverySource): FormState {
  return {
    name: s.name,
    description: s.description,
    baseUrl: s.baseUrl,
    urlPattern: s.urlPattern ?? '',
    enrichmentDepth: s.enrichmentDepth,
    maxRecordsPerRun: s.maxRecordsPerRun,
    scheduleFrequency: s.schedule.frequency,
    scheduleTimeOfDay: s.schedule.timeOfDay,
    scheduleEnabled: s.schedule.enabled,
    enrichmentHintsRaw: s.enrichmentHints.join(', '),
    extractionSchema: [...s.extractionSchema],
  };
}

function emptyNewField(): NewFieldState {
  return {
    fieldName: '',
    fieldType: 'string',
    required: false,
    description: '',
    extractionHint: '',
  };
}

const ENRICHMENT_DEPTH_DESCRIPTIONS: Record<EnrichmentDepth, string> = {
  basic: 'Primary source only — fastest, lowest cost',
  standard: 'Primary + 2 secondary sources',
  deep: 'Primary + all configured secondary sources',
};

// ============================================================================
// INPUT / LABEL CLASS CONSTANTS
// ============================================================================

const INPUT_CLASS =
  'w-full bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-cyan)]';

const LABEL_CLASS = 'block text-xs text-[var(--color-text-secondary)] mb-1';

const SECTION_HEADER_CLASS =
  'text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-disabled)] mb-2';

// ============================================================================
// COMPONENT
// ============================================================================

export default function SourceConfigDrawer({
  source,
  onClose,
  onSave,
  onTestScrape,
}: SourceConfigDrawerProps) {
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showAddField, setShowAddField] = useState(false);
  const [newField, setNewField] = useState<NewFieldState>(emptyNewField());

  useEffect(() => {
    if (source) {
      setForm(sourceToForm(source));
      setShowAddField(false);
      setNewField(emptyNewField());
    }
  }, [source]);

  if (!source) { return null; }
  if (!form) { return null; }

  const setFormField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(prev => {
      if (!prev) { return prev; }
      return { ...prev, [key]: value };
    });
  };

  const handleDeleteField = (index: number) => {
    setForm(prev => {
      if (!prev) { return prev; }
      const next = [...prev.extractionSchema];
      next.splice(index, 1);
      return { ...prev, extractionSchema: next };
    });
  };

  const handleAddField = () => {
    if (!newField.fieldName.trim() || !newField.description.trim() || !newField.extractionHint.trim()) {
      return;
    }
    const field: FieldDefinition = {
      fieldName: newField.fieldName.trim(),
      fieldType: newField.fieldType,
      required: newField.required,
      description: newField.description.trim(),
      extractionHint: newField.extractionHint.trim(),
    };
    setForm(prev => {
      if (!prev) { return prev; }
      return { ...prev, extractionSchema: [...prev.extractionSchema, field] };
    });
    setNewField(emptyNewField());
    setShowAddField(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { return; }
    setSaving(true);
    try {
      const updates: SourceConfigUpdates = {
        name: form.name.trim(),
        description: form.description.trim(),
        baseUrl: form.baseUrl.trim(),
        urlPattern: form.urlPattern.trim() || null,
        enrichmentDepth: form.enrichmentDepth,
        maxRecordsPerRun: form.maxRecordsPerRun,
        schedule: {
          frequency: form.scheduleFrequency,
          timeOfDay: form.scheduleTimeOfDay,
          enabled: form.scheduleEnabled,
        },
        enrichmentHints: form.enrichmentHintsRaw
          .split(',')
          .map(s => s.trim())
          .filter(Boolean),
        extractionSchema: form.extractionSchema,
      };
      await onSave(source.id, updates);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleTestScrape = async () => {
    setTesting(true);
    try {
      await onTestScrape(source.id);
    } finally {
      setTesting(false);
    }
  };

  const canSave = form.name.trim().length > 0 && form.baseUrl.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />

      {/* Drawer */}
      <div className="w-[480px] bg-[var(--color-bg-elevated)] border-l border-[var(--color-border-light)] flex flex-col h-full">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border-light)] shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Configure Source
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate max-w-[340px]">
              {source.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--color-text-disabled)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

          {/* ---------------------------------------------------------------- */}
          {/* SECTION 1: Source Info                                           */}
          {/* ---------------------------------------------------------------- */}
          <div>
            <p className={SECTION_HEADER_CLASS}>Source Info</p>
            <div className="space-y-3">
              <div>
                <label className={LABEL_CLASS}>Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setFormField('name', e.target.value)}
                  placeholder="e.g. FMCSA Motor Carriers"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>Description</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={e => setFormField('description', e.target.value)}
                  placeholder="What this source discovers and why it's valuable"
                  className={`${INPUT_CLASS} resize-none`}
                />
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* SECTION 2: URL Configuration                                     */}
          {/* ---------------------------------------------------------------- */}
          <div>
            <p className={SECTION_HEADER_CLASS}>URL Configuration</p>
            <div className="space-y-3">
              <div>
                <label className={LABEL_CLASS}>Base URL</label>
                <input
                  type="url"
                  value={form.baseUrl}
                  onChange={e => setFormField('baseUrl', e.target.value)}
                  placeholder="https://..."
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className={LABEL_CLASS}>
                  URL Pattern
                  <span className="ml-1 text-[var(--color-text-disabled)]">(optional)</span>
                </label>
                <input
                  type="text"
                  value={form.urlPattern}
                  onChange={e => setFormField('urlPattern', e.target.value)}
                  placeholder="Pattern for record pages"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* SECTION 3: Schedule                                              */}
          {/* ---------------------------------------------------------------- */}
          <div>
            <p className={SECTION_HEADER_CLASS}>Schedule</p>
            <div className="space-y-3">
              {/* Enabled toggle */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-[var(--color-text-secondary)]">Schedule Enabled</label>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.scheduleEnabled}
                    onChange={e => setFormField('scheduleEnabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-8 h-4 bg-[var(--color-bg-main)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-[var(--color-cyan)] border border-[var(--color-border-light)]" />
                </label>
              </div>

              {/* Frequency */}
              <div>
                <label className={LABEL_CLASS}>Frequency</label>
                <select
                  value={form.scheduleFrequency}
                  onChange={e => setFormField('scheduleFrequency', e.target.value as ScheduleFrequency)}
                  className={INPUT_CLASS}
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Time of day */}
              <div>
                <label className={LABEL_CLASS}>Time of Day (HH:MM)</label>
                <input
                  type="time"
                  value={form.scheduleTimeOfDay}
                  onChange={e => setFormField('scheduleTimeOfDay', e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* SECTION 4: Enrichment Settings                                   */}
          {/* ---------------------------------------------------------------- */}
          <div>
            <p className={SECTION_HEADER_CLASS}>Enrichment Settings</p>
            <div className="space-y-3">
              {/* Depth */}
              <div>
                <label className={LABEL_CLASS}>Enrichment Depth</label>
                <select
                  value={form.enrichmentDepth}
                  onChange={e => setFormField('enrichmentDepth', e.target.value as EnrichmentDepth)}
                  className={INPUT_CLASS}
                >
                  {(['basic', 'standard', 'deep'] as const).map(depth => (
                    <option key={depth} value={depth}>
                      {depth.charAt(0).toUpperCase() + depth.slice(1)} — {ENRICHMENT_DEPTH_DESCRIPTIONS[depth]}
                    </option>
                  ))}
                </select>
              </div>

              {/* Max records */}
              <div>
                <label className={LABEL_CLASS}>Max Records Per Run</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={form.maxRecordsPerRun}
                  onChange={e => setFormField('maxRecordsPerRun', Math.max(1, Math.min(10000, Number(e.target.value))))}
                  className={INPUT_CLASS}
                />
              </div>

              {/* Enrichment hints */}
              <div>
                <label className={LABEL_CLASS}>
                  Enrichment Hints
                  <span className="ml-1 text-[var(--color-text-disabled)]">(comma-separated secondary sources)</span>
                </label>
                <input
                  type="text"
                  value={form.enrichmentHintsRaw}
                  onChange={e => setFormField('enrichmentHintsRaw', e.target.value)}
                  placeholder="google, linkedin, facebook"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* SECTION 5: Extraction Schema Builder                             */}
          {/* ---------------------------------------------------------------- */}
          <div>
            <p className={SECTION_HEADER_CLASS}>Extraction Schema</p>
            <div className="space-y-2">
              {form.extractionSchema.length === 0 && (
                <p className="text-xs text-[var(--color-text-disabled)] py-2">
                  No fields defined. Add fields below to instruct the extractor.
                </p>
              )}

              {form.extractionSchema.map((field, index) => (
                <div
                  key={`${field.fieldName}-${index}`}
                  className="flex items-start gap-3 bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-3 py-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-medium text-[var(--color-text-primary)]">
                        {field.fieldName}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-disabled)] bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded px-1.5 py-0.5">
                        {field.fieldType}
                      </span>
                      {field.required && (
                        <span className="text-[10px] text-[var(--color-cyan)] bg-[var(--color-cyan)]/10 rounded px-1.5 py-0.5">
                          required
                        </span>
                      )}
                    </div>
                    {field.description && (
                      <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 truncate">
                        {field.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteField(index)}
                    className="shrink-0 text-[var(--color-text-disabled)] hover:text-red-400 transition-colors mt-0.5"
                    aria-label={`Remove field ${field.fieldName}`}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {/* Inline add field form */}
              {showAddField ? (
                <div className="border border-[var(--color-cyan)]/40 rounded-lg p-3 space-y-2 bg-[var(--color-bg-main)]">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-cyan)] mb-2">
                    New Field
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LABEL_CLASS}>Field Name</label>
                      <input
                        type="text"
                        value={newField.fieldName}
                        onChange={e => setNewField(prev => ({ ...prev, fieldName: e.target.value }))}
                        placeholder="e.g. company_name"
                        className={INPUT_CLASS}
                      />
                    </div>
                    <div>
                      <label className={LABEL_CLASS}>Field Type</label>
                      <select
                        value={newField.fieldType}
                        onChange={e => setNewField(prev => ({ ...prev, fieldType: e.target.value as FieldDefinition['fieldType'] }))}
                        className={INPUT_CLASS}
                      >
                        <option value="string">string</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="date">date</option>
                        <option value="array">array</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>Description</label>
                    <input
                      type="text"
                      value={newField.description}
                      onChange={e => setNewField(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="What this field contains"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div>
                    <label className={LABEL_CLASS}>Extraction Hint</label>
                    <input
                      type="text"
                      value={newField.extractionHint}
                      onChange={e => setNewField(prev => ({ ...prev, extractionHint: e.target.value }))}
                      placeholder="CSS selector, XPath, or label hint"
                      className={INPUT_CLASS}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="new-field-required"
                      checked={newField.required}
                      onChange={e => setNewField(prev => ({ ...prev, required: e.target.checked }))}
                      className="accent-[var(--color-cyan)]"
                    />
                    <label
                      htmlFor="new-field-required"
                      className="text-xs text-[var(--color-text-secondary)] cursor-pointer"
                    >
                      Required field
                    </label>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleAddField}
                      disabled={!newField.fieldName.trim() || !newField.description.trim() || !newField.extractionHint.trim()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-cyan)] text-black text-xs font-medium hover:opacity-90 disabled:opacity-40 transition-opacity"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Field
                    </button>
                    <button
                      onClick={() => { setShowAddField(false); setNewField(emptyNewField()); }}
                      className="text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddField(true)}
                  className="flex items-center gap-1.5 text-xs text-[var(--color-cyan)] hover:opacity-80 transition-opacity pt-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Field
                </button>
              )}
            </div>
          </div>

          {/* ---------------------------------------------------------------- */}
          {/* SECTION 6: Test Scrape                                           */}
          {/* ---------------------------------------------------------------- */}
          <div>
            <p className={SECTION_HEADER_CLASS}>Test Scrape</p>
            <button
              onClick={() => void handleTestScrape()}
              disabled={testing}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border-light)] bg-[var(--color-bg-main)] text-sm text-[var(--color-text-primary)] hover:border-[var(--color-cyan)] hover:text-[var(--color-cyan)] disabled:opacity-50 transition-colors"
            >
              {testing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              {testing ? 'Running Test...' : 'Test Scrape'}
            </button>
            <p className="text-xs text-[var(--color-text-disabled)] mt-1.5">
              Runs a single pass against the source to verify extraction.
            </p>
          </div>

        </div>

        {/* Sticky footer */}
        <div className="shrink-0 px-5 py-4 border-t border-[var(--color-border-light)] space-y-2">
          <button
            onClick={() => void handleSave()}
            disabled={!canSave || saving}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--color-cyan)] text-black text-sm font-semibold hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={onClose}
            className="w-full text-center text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors py-1"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
