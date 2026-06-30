'use client';

/**
 * FilterBuilderDialog — plain-English filter builder for CRM Saved Views.
 *
 * Lets a non-technical operator assemble "Where [field] [is] [value]" rows,
 * choose whether records must match ALL or ANY of them, name the view, and
 * save it. Creating posts to /api/crm/views; editing patches
 * /api/crm/views/[viewId]. The list of filterable fields is supplied by the
 * parent (each CRM object passes its own fields) so this dialog is reusable.
 *
 * Self-contained: the parent mounts it and reacts to onSaved / onClose.
 */

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Loader2, AlertCircle } from 'lucide-react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { SectionDescription, Caption } from '@/components/ui/typography';
import type {
  SavedView,
  SavedViewObject,
  FilterCondition,
  FilterOperator,
  MatchMode,
  FilterFieldDef,
} from '@/types/saved-view';

interface OperatorOption {
  value: FilterOperator;
  label: string;
  /** Operators that take no value input. */
  noValue?: boolean;
}

const OPERATORS: OperatorOption[] = [
  { value: 'eq', label: 'is' },
  { value: 'neq', label: 'is not' },
  { value: 'contains', label: 'contains' },
  { value: 'in', label: 'is any of' },
  { value: 'gt', label: 'greater than' },
  { value: 'gte', label: 'greater than or equal' },
  { value: 'lt', label: 'less than' },
  { value: 'lte', label: 'less than or equal' },
  { value: 'exists', label: 'is set' },
  { value: 'not_exists', label: 'is empty' },
];

/** A condition while it is being edited — value stays a string for the inputs. */
interface DraftCondition {
  field: string;
  operator: FilterOperator;
  value: string;
}

interface FilterBuilderDialogProps {
  open: boolean;
  onClose: () => void;
  object: SavedViewObject;
  /** The fields this object can be filtered on. */
  fields: FilterFieldDef[];
  /** Pass an existing view to edit it; omit/null to create a new one. */
  existingView?: SavedView | null;
  /** Fired after a successful create/update with the saved view. */
  onSaved: (view: SavedView) => void;
}

function valueToString(value: FilterCondition['value']): string {
  if (value === undefined) { return ''; }
  if (Array.isArray(value)) { return value.join(', '); }
  return String(value);
}

function isNoValueOperator(operator: FilterOperator): boolean {
  return operator === 'exists' || operator === 'not_exists';
}

export default function FilterBuilderDialog({
  open,
  onClose,
  object,
  fields,
  existingView,
  onSaved,
}: FilterBuilderDialogProps) {
  const authFetch = useAuthFetch();
  const defaultField = fields[0]?.value ?? '';

  const [name, setName] = useState('');
  const [match, setMatch] = useState<MatchMode>('all');
  const [conditions, setConditions] = useState<DraftCondition[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the dialog opens (for create or for a given view).
  useEffect(() => {
    if (!open) { return; }
    setError(null);
    if (existingView) {
      setName(existingView.name);
      setMatch(existingView.match);
      setConditions(
        existingView.filters.length > 0
          ? existingView.filters.map((c) => ({
              field: c.field,
              operator: c.operator,
              value: valueToString(c.value),
            }))
          : [{ field: defaultField, operator: 'eq', value: '' }]
      );
    } else {
      setName('');
      setMatch('all');
      setConditions([{ field: defaultField, operator: 'eq', value: '' }]);
    }
  }, [open, existingView, defaultField]);

  const fieldMap = useMemo(() => {
    const map = new Map<string, FilterFieldDef>();
    for (const f of fields) { map.set(f.value, f); }
    return map;
  }, [fields]);

  const updateCondition = (index: number, patch: Partial<DraftCondition>) => {
    setConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const addCondition = () => {
    setConditions((prev) => [...prev, { field: defaultField, operator: 'eq', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const buildFilters = (): FilterCondition[] => {
    return conditions.map((c) => {
      if (isNoValueOperator(c.operator)) {
        return { field: c.field, operator: c.operator };
      }
      const def = fieldMap.get(c.field);
      let value: FilterCondition['value'];
      if (c.operator === 'in') {
        value = c.value.split(',').map((s) => s.trim()).filter(Boolean);
      } else if (def?.type === 'boolean') {
        value = c.value === 'true';
      } else if (def?.type === 'number') {
        const n = Number(c.value);
        value = Number.isNaN(n) ? c.value : n;
      } else {
        value = c.value;
      }
      return { field: c.field, operator: c.operator, value };
    });
  };

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Please give this view a name.');
      return;
    }
    if (conditions.length === 0) {
      setError('Add at least one condition, or use the "All" tab to see everything.');
      return;
    }
    const missingValue = conditions.find(
      (c) => !isNoValueOperator(c.operator) && c.value.trim() === ''
    );
    if (missingValue) {
      setError('Please fill in a value for every condition (or choose "is set" / "is empty").');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        object,
        name: name.trim(),
        filters: buildFilters(),
        match,
      };

      const response = existingView
        ? await authFetch(`/api/crm/views/${existingView.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: payload.name, filters: payload.filters, match: payload.match }),
          })
        : await authFetch('/api/crm/views', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const result = (await response.json()) as { success?: boolean; view?: SavedView; error?: string };
      if (!response.ok || !result.success || !result.view) {
        throw new Error(result.error ?? 'Could not save this view. Please try again.');
      }

      onSaved(result.view);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save this view. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); } }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existingView ? 'Edit view' : 'New view'}</DialogTitle>
          <SectionDescription>
            Build a filter to narrow this list. Records can match all of your conditions, or any one of them.
          </SectionDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Caption>View name</Caption>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. VIP contacts in California"
            />
          </div>

          <div className="flex items-center gap-2">
            <Caption>Match</Caption>
            <div className="w-40">
              <Select value={match} onValueChange={(v) => setMatch(v === 'any' ? 'any' : 'all')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">all conditions</SelectItem>
                  <SelectItem value="any">any condition</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            {conditions.map((condition, index) => {
              const def = fieldMap.get(condition.field);
              const noValue = isNoValueOperator(condition.operator);
              return (
                <div
                  key={index}
                  className="flex flex-col md:flex-row md:items-center gap-2 p-3 rounded-xl bg-surface-elevated border border-border-light"
                >
                  <Caption className="md:w-12 shrink-0">{index === 0 ? 'Where' : (match === 'any' ? 'or' : 'and')}</Caption>

                  <div className="flex-1 min-w-0">
                    <Select
                      value={condition.field}
                      onValueChange={(v) => updateCondition(index, { field: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Field" />
                      </SelectTrigger>
                      <SelectContent>
                        {fields.map((f) => (
                          <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="md:w-48 shrink-0">
                    <Select
                      value={condition.operator}
                      onValueChange={(v) => updateCondition(index, { operator: v as FilterOperator })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Condition" />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex-1 min-w-0">
                    {noValue ? (
                      <span className="block text-sm text-muted-foreground px-1 py-2">— no value needed —</span>
                    ) : def?.type === 'boolean' ? (
                      <Select
                        value={condition.value || 'true'}
                        onValueChange={(v) => updateCondition(index, { value: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="true">Yes</SelectItem>
                          <SelectItem value="false">No</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : def?.type === 'select' && def.options && condition.operator !== 'in' ? (
                      <Select
                        value={condition.value}
                        onValueChange={(v) => updateCondition(index, { value: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose…" />
                        </SelectTrigger>
                        <SelectContent>
                          {def.options.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={def?.type === 'number' ? 'number' : 'text'}
                        value={condition.value}
                        onChange={(e) => updateCondition(index, { value: e.target.value })}
                        placeholder={condition.operator === 'in' ? 'value 1, value 2, …' : 'Value'}
                      />
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => removeCondition(index)}
                    aria-label="Remove condition"
                    className="shrink-0 p-2 rounded-lg text-muted-foreground hover:text-error hover:bg-error/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}

            <Button variant="outline" size="sm" onClick={addCondition}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add condition
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-error">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                Saving…
              </>
            ) : (
              existingView ? 'Save changes' : 'Create view'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
