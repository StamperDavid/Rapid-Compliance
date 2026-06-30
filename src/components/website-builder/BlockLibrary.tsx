/**
 * Block Library Panel
 *
 * Browse + insert premade and operator-saved section blocks into the page
 * being edited. Presentational only: it renders the blocks handed in via props
 * and emits `onInsert(section)` — it never fetches or mutates the page itself
 * (the parent + `block-library-service` own data).
 *
 * Visual idiom matches the dark website editor (see `WidgetsPanel.tsx`):
 * inline-styled dark chrome, indigo accent, with the design-system `Button`
 * for the primary insert action and `lucide-react` icons.
 */

'use client';

import React, { useMemo, useState } from 'react';
import { Bookmark, Layers, Plus, Search, Sparkles, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PageSection } from '@/types/website';
import {
  BLOCK_CATEGORY_LABELS,
  type BlockCategory,
  type SectionBlock,
} from '@/lib/website-builder/section-blocks';

export interface BlockLibraryProps {
  premade: SectionBlock[];
  saved: SectionBlock[];
  onInsert: (section: PageSection) => void;
  onClose?: () => void;
  loading?: boolean;
}

type SourceTab = 'premade' | 'saved';
type CategoryFilter = BlockCategory | 'all';

const ACCENT = '#6366f1';

export function BlockLibrary({
  premade,
  saved,
  onInsert,
  onClose,
  loading = false,
}: BlockLibraryProps): React.JSX.Element {
  const [source, setSource] = useState<SourceTab>('premade');
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [search, setSearch] = useState('');

  const activeBlocks = source === 'premade' ? premade : saved;

  // Categories present in the active source (so we never show empty chips).
  const categories = useMemo<CategoryFilter[]>(() => {
    const present = new Set<BlockCategory>();
    for (const block of activeBlocks) {
      present.add(block.category);
    }
    const ordered: BlockCategory[] = [
      'hero',
      'features',
      'pricing',
      'testimonials',
      'cta',
      'stats',
      'logos',
      'faq',
      'contact',
      'content',
      'footer',
    ];
    return ['all', ...ordered.filter((c) => present.has(c))];
  }, [activeBlocks]);

  // If the selected category isn't present in the active source (e.g. after
  // switching Premade↔Saved), fall back to "all" for display + filtering
  // without mutating state during render.
  const safeCategory: CategoryFilter = categories.includes(category) ? category : 'all';

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return activeBlocks.filter((block) => {
      const matchesCategory = safeCategory === 'all' || block.category === safeCategory;
      const matchesSearch = query === '' || block.name.toLowerCase().includes(query);
      return matchesCategory && matchesSearch;
    });
  }, [activeBlocks, safeCategory, search]);

  return (
    <div
      style={{
        width: '320px',
        background: '#0a0a0a',
        borderRight: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        fontFamily: 'Inter, system-ui, sans-serif',
        color: '#ffffff',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.85rem 0.9rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Layers size={16} color={ACCENT} />
          <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Block Library</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close block library"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '26px',
              height: '26px',
              background: 'transparent',
              border: 'none',
              borderRadius: '4px',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Source toggle */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        {([
          { id: 'premade' as SourceTab, label: 'Premade', icon: <Sparkles size={13} />, count: premade.length },
          { id: 'saved' as SourceTab, label: 'Saved', icon: <Bookmark size={13} />, count: saved.length },
        ]).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSource(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.35rem',
              padding: '0.6rem 0.5rem',
              background: source === tab.id ? ACCENT : 'transparent',
              color: source === tab.id ? '#ffffff' : 'rgba(255,255,255,0.5)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 500,
            }}
          >
            {tab.icon}
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: '0.75rem 0.75rem 0.5rem' }}>
        <div style={{ position: 'relative' }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: '0.55rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(255,255,255,0.4)',
            }}
          />
          <input
            type="text"
            placeholder="Search blocks..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '0.5rem 0.5rem 0.5rem 1.85rem',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              fontSize: '0.8rem',
              background: 'rgba(255,255,255,0.05)',
              color: '#ffffff',
            }}
          />
        </div>
      </div>

      {/* Category chips */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.3rem',
          padding: '0 0.75rem 0.6rem',
        }}
      >
        {categories.map((cat) => {
          const label = cat === 'all' ? 'All' : BLOCK_CATEGORY_LABELS[cat];
          const active = safeCategory === cat;
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setCategory(cat)}
              style={{
                padding: '0.3rem 0.55rem',
                background: active ? ACCENT : 'rgba(255,255,255,0.05)',
                color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
                border: 'none',
                borderRadius: '999px',
                cursor: 'pointer',
                fontSize: '0.7rem',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 0.75rem 1rem' }}>
        {loading ? (
          <EmptyMessage text="Loading blocks..." />
        ) : filtered.length === 0 ? (
          source === 'saved' && saved.length === 0 ? (
            <SavedEmptyState />
          ) : (
            <EmptyMessage text="No blocks match your filters." />
          )
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {filtered.map((block) => (
              <BlockCard key={block.id} block={block} onInsert={onInsert} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Block card — label + category + lightweight schematic + Insert
// ---------------------------------------------------------------------------

function BlockCard({
  block,
  onInsert,
}: {
  block: SectionBlock;
  onInsert: (section: PageSection) => void;
}): React.JSX.Element {
  const widgetTypes = collectWidgetTypes(block.section);
  const columnCount = block.section.columns.length;

  return (
    <div
      style={{
        padding: '0.7rem',
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.5rem',
          marginBottom: '0.5rem',
        }}
      >
        <span style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.3 }}>{block.name}</span>
        <span
          style={{
            flexShrink: 0,
            fontSize: '0.6rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            padding: '0.12rem 0.4rem',
            background: 'rgba(99,102,241,0.18)',
            color: '#a5b4fc',
            borderRadius: '4px',
          }}
        >
          {BLOCK_CATEGORY_LABELS[block.category]}
        </span>
      </div>

      {/* Schematic preview: a faux band showing column split + first widgets */}
      <div
        style={{
          display: 'flex',
          gap: '3px',
          padding: '0.4rem',
          background: block.section.backgroundColor ?? 'rgba(255,255,255,0.04)',
          borderRadius: '5px',
          marginBottom: '0.55rem',
          minHeight: '34px',
        }}
      >
        {Array.from({ length: Math.max(1, columnCount) }).map((_, idx) => (
          <div
            key={idx}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
              justifyContent: 'center',
            }}
          >
            <div style={{ height: '5px', borderRadius: '2px', background: 'rgba(255,255,255,0.35)', width: '70%' }} />
            <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.18)', width: '90%' }} />
            <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.18)', width: '50%' }} />
          </div>
        ))}
      </div>

      {/* Widget-type pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginBottom: '0.6rem' }}>
        {widgetTypes.slice(0, 4).map((type, idx) => (
          <span
            key={`${type}-${idx}`}
            style={{
              fontSize: '0.62rem',
              padding: '0.1rem 0.35rem',
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(255,255,255,0.55)',
              borderRadius: '3px',
            }}
          >
            {type}
          </span>
        ))}
        {widgetTypes.length > 4 && (
          <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.4)' }}>
            +{widgetTypes.length - 4}
          </span>
        )}
      </div>

      <Button
        type="button"
        size="sm"
        className="w-full gap-1.5"
        onClick={() => onInsert(block.section)}
      >
        <Plus size={14} />
        Insert
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers + empty states
// ---------------------------------------------------------------------------

function collectWidgetTypes(section: PageSection): string[] {
  const types: string[] = [];
  for (const column of section.columns) {
    for (const widget of column.widgets) {
      types.push(widget.type);
    }
  }
  return types;
}

function EmptyMessage({ text }: { text: string }): React.JSX.Element {
  return (
    <div
      style={{
        padding: '2.5rem 1rem',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.4)',
        fontSize: '0.8rem',
      }}
    >
      {text}
    </div>
  );
}

function SavedEmptyState(): React.JSX.Element {
  return (
    <div
      style={{
        padding: '2rem 1rem',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.5)',
      }}
    >
      <Bookmark size={26} color="rgba(255,255,255,0.3)" style={{ marginBottom: '0.75rem' }} />
      <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', color: 'rgba(255,255,255,0.7)' }}>
        No saved blocks yet
      </div>
      <div style={{ fontSize: '0.75rem', lineHeight: 1.5 }}>
        Select a section on the page and choose
        <span style={{ color: '#a5b4fc' }}> &ldquo;Save as block&rdquo; </span>
        to reuse it here later.
      </div>
    </div>
  );
}
