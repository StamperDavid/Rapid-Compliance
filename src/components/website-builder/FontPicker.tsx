/**
 * FontPicker — Elementor-class Google Fonts picker for the website builder.
 *
 * A searchable popover: a text filter plus a categorised, scrollable list of the
 * font catalog. Each option renders its OWN name in its OWN font face, loaded
 * lazily as it scrolls into view (via `ensureFontLoaded`) so opening the picker
 * doesn't fetch the whole catalog at once. Selecting an option emits the bare
 * family name (e.g. "Inter") and closes.
 *
 * Dark editor idiom to match the other builder panels (StyleControls / WidgetsPanel).
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import {
  SYSTEM_FONTS,
  GOOGLE_FONTS,
  type FontDef,
  getFont,
  matchCatalogFamily,
  fontFamilyStack,
} from '@/lib/website-builder/font-catalog';
import { ensureFontLoaded } from './FontLoader';

const ACCENT = '#6366f1';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.55)',
  marginBottom: '0.3rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const triggerStyle: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '0.5rem',
  padding: '0.45rem 0.5rem',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
  fontSize: '0.8rem',
  background: 'rgba(255,255,255,0.05)',
  color: '#ffffff',
  cursor: 'pointer',
  textAlign: 'left',
};

interface CategoryGroup {
  key: string;
  label: string;
  fonts: FontDef[];
}

const CATEGORY_LABELS: Record<FontDef['category'], string> = {
  'sans-serif': 'Sans Serif',
  serif: 'Serif',
  display: 'Display',
  handwriting: 'Handwriting',
  monospace: 'Monospace',
};

const CATEGORY_ORDER: FontDef['category'][] = [
  'sans-serif',
  'serif',
  'display',
  'handwriting',
  'monospace',
];

function buildGroups(query: string): CategoryGroup[] {
  const q = query.trim().toLowerCase();
  const matches = (f: FontDef): boolean => q === '' || f.family.toLowerCase().includes(q);

  const groups: CategoryGroup[] = [];

  const systemMatches = SYSTEM_FONTS.filter(matches);
  if (systemMatches.length > 0) {
    groups.push({ key: 'system', label: 'System', fonts: systemMatches });
  }

  for (const category of CATEGORY_ORDER) {
    const fonts = GOOGLE_FONTS.filter((f) => f.category === category && matches(f));
    if (fonts.length > 0) {
      groups.push({ key: category, label: CATEGORY_LABELS[category], fonts });
    }
  }

  return groups;
}

// ---------------------------------------------------------------------------
// Single option row — lazily loads its own font when scrolled into view
// ---------------------------------------------------------------------------

function FontOption({
  font,
  selected,
  scrollRoot,
  onSelect,
}: {
  font: FontDef;
  selected: boolean;
  scrollRoot: HTMLElement | null;
  onSelect: (family: string) => void;
}): React.JSX.Element {
  const ref = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (el === null) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
          }
        }
      },
      { root: scrollRoot, rootMargin: '120px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollRoot]);

  useEffect(() => {
    if (visible) {
      ensureFontLoaded(font.family);
    }
  }, [visible, font.family]);

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(font.family)}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.5rem',
        padding: '0.5rem 0.6rem',
        background: selected ? 'rgba(99,102,241,0.18)' : 'transparent',
        border: 'none',
        borderRadius: '5px',
        cursor: 'pointer',
        color: '#ffffff',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.background = 'transparent';
        }
      }}
    >
      <span
        style={{
          fontSize: '0.95rem',
          fontFamily: visible ? fontFamilyStack(font.family) : 'inherit',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {font.family}
      </span>
      {selected && <Check size={14} color={ACCENT} style={{ flexShrink: 0 }} />}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Picker
// ---------------------------------------------------------------------------

export function FontPicker(props: {
  value?: string;
  onChange: (family: string) => void;
  label?: string;
}): React.JSX.Element {
  const { value, onChange, label } = props;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scrollRoot, setScrollRoot] = useState<HTMLElement | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (e: MouseEvent): void => {
      if (containerRef.current !== null && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const groups = useMemo(() => buildGroups(query), [query]);

  const matchedFamily = matchCatalogFamily(value);
  const displayLabel =
    matchedFamily ?? (value !== undefined && value !== '' ? value : 'Default');
  const displayDef = matchedFamily !== undefined ? getFont(matchedFamily) : undefined;

  const select = (family: string): void => {
    onChange(family);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {label !== undefined && <span style={labelStyle}>{label}</span>}

      <button type="button" style={triggerStyle} onClick={() => setOpen((v) => !v)}>
        <span
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            fontFamily: displayDef !== undefined ? fontFamilyStack(displayDef.family) : 'inherit',
          }}
        >
          {displayLabel}
        </span>
        <ChevronDown size={14} color="rgba(255,255,255,0.5)" style={{ flexShrink: 0 }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            zIndex: 50,
            background: '#161616',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            overflow: 'hidden',
          }}
        >
          {/* Search */}
          <div style={{ padding: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <div style={{ position: 'relative' }}>
              <Search
                size={13}
                color="rgba(255,255,255,0.4)"
                style={{ position: 'absolute', left: '0.5rem', top: '50%', transform: 'translateY(-50%)' }}
              />
              <input
                type="text"
                autoFocus
                value={query}
                placeholder="Search fonts…"
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.5rem 0.4rem 1.7rem',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  fontSize: '0.78rem',
                  background: 'rgba(255,255,255,0.05)',
                  color: '#ffffff',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          {/* List */}
          <div ref={setScrollRoot} style={{ maxHeight: '300px', overflowY: 'auto', padding: '0.35rem' }}>
            {groups.length === 0 ? (
              <div
                style={{
                  padding: '1.5rem 1rem',
                  textAlign: 'center',
                  color: 'rgba(255,255,255,0.4)',
                  fontSize: '0.78rem',
                }}
              >
                No fonts found
              </div>
            ) : (
              groups.map((group) => (
                <div key={group.key} style={{ marginBottom: '0.4rem' }}>
                  <div
                    style={{
                      fontSize: '0.62rem',
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.4)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      padding: '0.35rem 0.6rem 0.25rem',
                    }}
                  >
                    {group.label}
                  </div>
                  {group.fonts.map((font) => (
                    <FontOption
                      key={font.family}
                      font={font}
                      selected={matchedFamily === font.family}
                      scrollRoot={scrollRoot}
                      onSelect={select}
                    />
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
