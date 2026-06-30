/**
 * IconPicker
 * -----------------------------------------------------------------------------
 * Searchable, categorized icon browser over the full lucide set. Drops into the
 * Properties panel's content editor wherever a widget stores an icon by name
 * (`icon-box`, `social-icons` links, optional `button` leading icon).
 *
 * - Category chips (incl. "All" = every lucide icon) for browsing.
 * - Free-text search filters across the entire catalog by name.
 * - Results are capped with a "Show more" control so a 1,900-icon set stays snappy.
 * - Clicking an icon calls `onChange(name)` with the PascalCase lucide name.
 *
 * Styled to match the builder's dark editor chrome (inline rgba tokens), the same
 * idiom as StyleControls / the surrounding Properties panel.
 */

'use client';

import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Icon } from './Icon';
import { ICON_CATEGORIES, allIconNames } from '@/lib/website-builder/icon-catalog';

export interface IconPickerProps {
  value?: string;
  onChange: (name: string) => void;
  onClose?: () => void;
}

const PAGE_SIZE = 120;

const TABS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  ...ICON_CATEGORIES.map((c) => ({ id: c.id, label: c.label })),
];

export function IconPicker({ value, onChange, onClose }: IconPickerProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [query, setQuery] = useState<string>('');
  const [limit, setLimit] = useState<number>(PAGE_SIZE);

  const trimmed = query.trim().toLowerCase();

  // When searching, span the entire catalog; otherwise show the active category.
  const baseList = useMemo<string[]>(() => {
    if (trimmed || activeTab === 'all') {
      return allIconNames();
    }
    return ICON_CATEGORIES.find((c) => c.id === activeTab)?.icons ?? [];
  }, [trimmed, activeTab]);

  const filtered = useMemo<string[]>(() => {
    if (!trimmed) {
      return baseList;
    }
    return baseList.filter((n) => n.toLowerCase().includes(trimmed));
  }, [baseList, trimmed]);

  const visible = filtered.slice(0, limit);

  const resetLimit = () => setLimit(PAGE_SIZE);

  return (
    <div style={panelStyle}>
      {/* Header: search + close */}
      <div style={headerStyle}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '0.5rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(255,255,255,0.4)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={query}
            placeholder="Search icons…"
            autoFocus
            onChange={(e) => {
              setQuery(e.target.value);
              resetLimit();
            }}
            style={searchInputStyle}
          />
        </div>
        {onClose && (
          <button type="button" onClick={onClose} style={iconButtonStyle} aria-label="Close icon picker">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Category chips (hidden while searching across all) */}
      {!trimmed && (
        <div style={chipRowStyle}>
          {TABS.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setActiveTab(tab.id);
                  resetLimit();
                }}
                style={{
                  ...chipStyle,
                  background: active ? 'rgba(99,102,241,0.25)' : 'rgba(255,255,255,0.05)',
                  borderColor: active ? '#6366f1' : 'rgba(255,255,255,0.12)',
                  color: active ? '#c7d2fe' : 'rgba(255,255,255,0.6)',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Count / current selection */}
      <div style={metaRowStyle}>
        <span>
          {filtered.length} icon{filtered.length === 1 ? '' : 's'}
          {trimmed ? ' found' : ''}
        </span>
        {value && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
            <Icon name={value} size={14} />
            <span style={{ color: 'rgba(255,255,255,0.7)' }}>{value}</span>
          </span>
        )}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div style={emptyStyle}>No icons match “{query}”.</div>
      ) : (
        <div style={gridStyle}>
          {visible.map((name) => {
            const selected = name === value;
            return (
              <button
                key={name}
                type="button"
                title={name}
                onClick={() => onChange(name)}
                style={{
                  ...cellStyle,
                  background: selected ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.04)',
                  borderColor: selected ? '#6366f1' : 'rgba(255,255,255,0.08)',
                }}
              >
                <Icon name={name} size={20} color={selected ? '#c7d2fe' : 'rgba(255,255,255,0.85)'} />
              </button>
            );
          })}
        </div>
      )}

      {/* Show more */}
      {filtered.length > limit && (
        <button type="button" onClick={() => setLimit((n) => n + PAGE_SIZE)} style={showMoreStyle}>
          Show more ({filtered.length - limit} remaining)
        </button>
      )}
    </div>
  );
}

export default IconPicker;

// --- Dark editor chrome (inline, matches StyleControls idiom) --------------

const panelStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  padding: '0.6rem',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '8px',
  background: 'rgba(15,17,28,0.6)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
};

const searchInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.4rem 0.5rem 0.4rem 1.6rem',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
  fontSize: '0.8rem',
  background: 'rgba(255,255,255,0.05)',
  color: '#ffffff',
  outline: 'none',
};

const iconButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '28px',
  height: '28px',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '6px',
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.6)',
  cursor: 'pointer',
};

const chipRowStyle: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.3rem',
  maxHeight: '4.5rem',
  overflowY: 'auto',
};

const chipStyle: React.CSSProperties = {
  padding: '0.2rem 0.5rem',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '999px',
  fontSize: '0.68rem',
  fontWeight: 600,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

const metaRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: '0.68rem',
  color: 'rgba(255,255,255,0.45)',
};

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(38px, 1fr))',
  gap: '0.35rem',
  maxHeight: '260px',
  overflowY: 'auto',
  padding: '0.15rem',
};

const cellStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  aspectRatio: '1 / 1',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '6px',
  cursor: 'pointer',
};

const emptyStyle: React.CSSProperties = {
  padding: '1.5rem 0.5rem',
  textAlign: 'center',
  fontSize: '0.75rem',
  color: 'rgba(255,255,255,0.4)',
};

const showMoreStyle: React.CSSProperties = {
  padding: '0.4rem',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '6px',
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.7)',
  fontSize: '0.72rem',
  fontWeight: 600,
  cursor: 'pointer',
};
