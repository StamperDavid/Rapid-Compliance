'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type EntityType = 'contact' | 'company' | 'deal';

interface EntityOption {
  id: string;
  label: string;
  sublabel?: string;
}

interface EntitySearchSelectProps {
  entityType: EntityType;
  /** Currently selected entity id (for display of the chosen label). */
  value?: string;
  /** Display label for the currently selected value, if known. */
  valueLabel?: string;
  onSelect: (id: string, label: string) => void;
  /** Optional handler to clear the current selection. */
  onClear?: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Maps an entity type to its list endpoint. All return an object with a `data` array. */
const LIST_ENDPOINTS: Record<EntityType, string> = {
  contact: '/api/contacts?pageSize=200',
  company: '/api/crm/companies?pageSize=200',
  deal: '/api/deals?pageSize=200',
};

interface RawContact {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  company?: string;
}
interface RawCompany {
  id: string;
  name?: string;
  industry?: string;
}
interface RawDeal {
  id: string;
  name?: string;
  company?: string;
  value?: number;
}

function toOption(entityType: EntityType, raw: unknown): EntityOption | null {
  if (!raw || typeof raw !== 'object' || !('id' in raw)) {
    return null;
  }
  if (entityType === 'contact') {
    const c = raw as RawContact;
    const composed = (c.name ?? `${c.firstName ?? ''} ${c.lastName ?? ''}`.trim());
    const label = composed ? composed : (c.email ?? 'Unnamed contact');
    return { id: c.id, label, sublabel: c.company ?? c.email };
  }
  if (entityType === 'company') {
    const c = raw as RawCompany;
    return { id: c.id, label: c.name ?? 'Unnamed company', sublabel: c.industry };
  }
  const d = raw as RawDeal;
  return {
    id: d.id,
    label: d.name ?? 'Untitled deal',
    sublabel: d.company,
  };
}

/**
 * Reusable typeahead for picking a CRM entity (contact / company / deal).
 * Loads the entity's list endpoint once, filters client-side, and returns the
 * chosen id + display label via onSelect.
 */
export function EntitySearchSelect({
  entityType,
  value,
  valueLabel,
  onSelect,
  onClear,
  placeholder,
  disabled = false,
  className,
}: EntitySearchSelectProps): React.JSX.Element {
  const authFetch = useAuthFetch();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<EntityOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadOptions = useCallback(async () => {
    if (loaded || loading) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(LIST_ENDPOINTS[entityType]);
      const json = (await res.json()) as { data?: unknown[] };
      const rawList = Array.isArray(json.data) ? json.data : [];
      const mapped = rawList
        .map((raw) => toOption(entityType, raw))
        .filter((o): o is EntityOption => o !== null);
      setOptions(mapped);
      setLoaded(true);
    } catch (e) {
      logger.error('EntitySearchSelect load failed', e instanceof Error ? e : new Error(String(e)), { entityType });
      setError("Couldn't load options. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [authFetch, entityType, loaded, loading]);

  // Close on outside click.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return options.slice(0, 20);
    }
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) ||
          (o.sublabel?.toLowerCase().includes(q) ?? false)
      )
      .slice(0, 20);
  }, [options, query]);

  const handleFocus = useCallback(() => {
    setOpen(true);
    void loadOptions();
  }, [loadOptions]);

  const handleSelect = useCallback(
    (option: EntityOption) => {
      onSelect(option.id, option.label);
      setQuery('');
      setOpen(false);
    },
    [onSelect]
  );

  const selectedLabel = valueLabel ?? (value ? options.find((o) => o.id === value)?.label : undefined);

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {value && selectedLabel ? (
        <div className="flex items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm">
          <span className="truncate">{selectedLabel}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFocus}
              className="text-primary hover:opacity-80"
              disabled={disabled}
            >
              Change
            </button>
            {onClear && (
              <button
                type="button"
                onClick={onClear}
                className="text-muted-foreground hover:text-foreground"
                disabled={disabled}
                aria-label="Clear selection"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      ) : (
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={handleFocus}
          placeholder={placeholder ?? `Search ${entityType}s…`}
          disabled={disabled}
        />
      )}

      {open && (!value || !selectedLabel) && (
        <div className="absolute z-20 mt-1 w-full rounded-md border border-border-strong bg-card shadow-lg">
          {loading && <div className="px-3 py-2 text-sm text-muted-foreground">Loading…</div>}
          {error && <div className="px-3 py-2 text-sm text-destructive">{error}</div>}
          {!loading && !error && filtered.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted-foreground">No matches.</div>
          )}
          {!loading &&
            !error &&
            filtered.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => handleSelect(option)}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-surface-elevated"
              >
                <span className="font-medium text-foreground">{option.label}</span>
                {option.sublabel && (
                  <span className="text-xs text-muted-foreground">{option.sublabel}</span>
                )}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export default EntitySearchSelect;
