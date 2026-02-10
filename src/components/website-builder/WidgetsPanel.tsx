/**
 * Widgets Panel
 * Left sidebar with draggable widget library
 */

'use client';

import { useState } from 'react';
import type { Widget, WidgetType } from '@/types/website';
import { widgetDefinitions } from '@/lib/website-builder/widget-definitions';

interface WidgetsPanelProps {
  onAddWidget: (widget: Widget) => void;
}

export default function WidgetsPanel({ onAddWidget }: WidgetsPanelProps) {
  const [activeCategory, setActiveCategory] = useState<string>('layout');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'layout', label: 'Layout', icon: '📐' },
    { id: 'content', label: 'Content', icon: '📝' },
    { id: 'forms', label: 'Forms', icon: '📋' },
    { id: 'media', label: 'Media', icon: '🖼️' },
    { id: 'advanced', label: 'Advanced', icon: '⚙️' },
  ];

  const filteredWidgets = Object.entries(widgetDefinitions)
    .filter(([_type, def]) => {
      const matchesCategory = def.category === activeCategory;
      const matchesSearch = searchQuery === '' || 
        def.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        def.description?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });

  function handleAddWidget(type: WidgetType) {
    const definition = widgetDefinitions[type];
    if (!definition) {return;}

    const newWidget: Widget = {
      id: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data: definition.defaultData || {},
      style:definition.defaultStyle ?? {},
    };

    onAddWidget(newWidget);
  }

  function handleDragStart(e: React.DragEvent, widgetType: WidgetType) {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('widgetType', widgetType);
  }

  return (
    <div style={{
      width: '280px',
      background: 'var(--color-bg-elevated)',
      borderRight: '1px solid var(--color-border-light)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid var(--color-border-light)',
      }}>
        <h3 style={{
          margin: '0 0 0.75rem',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: 'var(--color-text-primary)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Widgets
        </h3>

        <input
          type="text"
          placeholder="Search widgets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid var(--color-border-light)',
            borderRadius: '4px',
            fontSize: '0.875rem',
          }}
        />
      </div>

      {/* Categories */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        padding: '0.75rem',
        borderBottom: '1px solid var(--color-border-light)',
        background: 'var(--color-bg-paper)',
        overflowX: 'auto',
      }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            title={cat.label}
            style={{
              padding: '0.5rem 0.75rem',
              background: activeCategory === cat.id ? 'var(--color-primary)' : 'var(--color-bg-main)',
              color: activeCategory === cat.id ? 'white' : 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {cat.icon}
          </button>
        ))}
      </div>

      {/* Widgets List */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '0.75rem',
      }}>
        {filteredWidgets.length === 0 ? (
          <div style={{
            padding: '2rem 1rem',
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: '0.875rem',
          }}>
            No widgets found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {filteredWidgets.map(([type, def]) => (
              <div
                key={type}
                draggable
                onClick={() => handleAddWidget(type as WidgetType)}
                onDragStart={(e) => handleDragStart(e, type as WidgetType)}
                style={{
                  padding: '0.75rem',
                  background: 'var(--color-bg-paper)',
                  border: '1px solid var(--color-border-light)',
                  borderRadius: '4px',
                  cursor: 'grab',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-primary)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(99, 102, 241, 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-border-light)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.25rem',
                }}>
                  <span style={{ fontSize: '1.25rem' }}>{def.icon}</span>
                  <span style={{
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    color: 'var(--color-text-primary)',
                  }}>
                    {def.label}
                  </span>
                </div>

                {def.description && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--color-text-secondary)',
                    marginLeft: '1.75rem',
                  }}>
                    {def.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

