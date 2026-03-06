'use client';

/**
 * FlowPalette
 * Left sidebar for the ReactFlow workflow builder.
 * Provides draggable node items categorized by Triggers, Actions, and Flow Control.
 * Items are dragged onto the canvas using HTML5 drag-and-drop.
 */

import { useState, memo, useCallback } from 'react';
import {
  TRIGGER_ITEMS,
  ACTION_ITEMS,
  FLOW_CONTROL_ITEMS,
  type FlowPaletteItem,
  type PaletteCategory,
} from './nodes/types';

/** Group items by their paletteCategory */
function groupByCategory(items: FlowPaletteItem[]): { category: PaletteCategory; items: FlowPaletteItem[] }[] {
  const map = new Map<PaletteCategory, FlowPaletteItem[]>();
  for (const item of items) {
    const existing = map.get(item.paletteCategory) ?? [];
    existing.push(item);
    map.set(item.paletteCategory, existing);
  }
  return Array.from(map.entries()).map(([category, groupItems]) => ({ category, items: groupItems }));
}

function FlowPalette() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['Triggers', 'Communication', 'Data', 'Flow Control', 'External', 'AI', 'Productivity'])
  );

  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  const filterItems = useCallback((items: FlowPaletteItem[]): FlowPaletteItem[] => {
    if (!searchQuery.trim()) {
      return items;
    }
    const q = searchQuery.toLowerCase();
    return items.filter(
      item =>
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.actionType.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const allItems = [...TRIGGER_ITEMS, ...ACTION_ITEMS, ...FLOW_CONTROL_ITEMS];
  const filteredItems = filterItems(allItems);
  const grouped = groupByCategory(filteredItems);

  const onDragStart = useCallback((event: React.DragEvent<HTMLDivElement>, item: FlowPaletteItem) => {
    event.dataTransfer.setData('application/reactflow-item', JSON.stringify(item));
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      {/* Header */}
      <div className="p-4 border-b" style={{ borderColor: 'var(--color-border-light)' }}>
        <h3
          className="text-sm font-semibold mb-3"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Node Palette
        </h3>

        {/* Search */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: 'var(--color-text-disabled)' }}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2"
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-light)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto p-3">
        {grouped.length === 0 && (
          <p className="text-center text-sm py-8" style={{ color: 'var(--color-text-disabled)' }}>
            No matching nodes
          </p>
        )}

        {grouped.map(group => (
          <div key={group.category} className="mb-3">
            {/* Category header */}
            <button
              onClick={() => toggleSection(group.category)}
              className="flex items-center justify-between w-full px-2 py-1.5 rounded-md transition-colors hover:bg-white/5"
            >
              <span
                className="text-[10px] font-bold uppercase tracking-widest"
                style={{ color: 'var(--color-text-disabled)' }}
              >
                {group.category}
              </span>
              <svg
                className={`w-3.5 h-3.5 transition-transform ${expandedSections.has(group.category) ? '' : '-rotate-90'}`}
                style={{ color: 'var(--color-text-disabled)' }}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Items */}
            {expandedSections.has(group.category) && (
              <div className="space-y-1 mt-1">
                {group.items.map(item => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => onDragStart(e, item)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-grab active:cursor-grabbing transition-all duration-150 border border-transparent hover:border-[var(--color-border-light)]"
                    style={{ backgroundColor: 'var(--color-bg-elevated)' }}
                    title={`Drag to canvas: ${item.name}`}
                  >
                    {/* Icon */}
                    <div
                      className={`
                        w-8 h-8 rounded-lg flex items-center justify-center text-base shrink-0
                        ${item.nodeCategory === 'trigger' ? 'bg-emerald-500/20' : ''}
                        ${item.nodeCategory === 'action' ? 'bg-indigo-500/20' : ''}
                        ${item.nodeCategory === 'condition' ? 'bg-amber-500/20' : ''}
                        ${item.nodeCategory === 'delay' ? 'bg-slate-500/20' : ''}
                      `}
                    >
                      {item.icon}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-xs font-medium truncate"
                        style={{ color: 'var(--color-text-primary)' }}
                      >
                        {item.name}
                      </p>
                      <p
                        className="text-[10px] truncate"
                        style={{ color: 'var(--color-text-disabled)' }}
                      >
                        {item.description}
                      </p>
                    </div>

                    {/* Drag indicator */}
                    <svg
                      className="w-3.5 h-3.5 shrink-0 opacity-40"
                      style={{ color: 'var(--color-text-disabled)' }}
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm8 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-8 8a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm8 0a2 2 0 1 1 0 4 2 2 0 0 1 0-4z" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--color-border-light)' }}>
        <p className="text-[10px] text-center" style={{ color: 'var(--color-text-disabled)' }}>
          Drag nodes onto the canvas to build your workflow
        </p>
      </div>
    </div>
  );
}

export default memo(FlowPalette);
