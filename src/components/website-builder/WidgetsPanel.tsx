/**
 * Left Panel (Widgets / Pages / Branding)
 * Three-tab layout matching the original editor
 */

'use client';

import { useState } from 'react';
import type { Widget, WidgetType } from '@/types/website';
import type { WebsiteConfig, GlobalBranding } from '@/types/website-editor';
import { widgetDefinitions } from '@/lib/website-builder/widget-definitions';

interface WidgetsPanelProps {
  onAddWidget: (widget: Widget) => void;
  config?: WebsiteConfig;
  selectedPageId?: string;
  onSwitchPage?: (pageId: string) => void;
  onUpdateBranding?: (updates: Partial<GlobalBranding>) => void;
}

type PanelTab = 'widgets' | 'pages' | 'branding';

export default function WidgetsPanel({
  onAddWidget,
  config,
  selectedPageId,
  onSwitchPage,
  onUpdateBranding,
}: WidgetsPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('widgets');
  const [activeCategory, setActiveCategory] = useState<string>('layout');
  const [searchQuery, setSearchQuery] = useState('');

  const categories = [
    { id: 'layout', label: 'Layout', icon: 'L' },
    { id: 'content', label: 'Content', icon: 'C' },
    { id: 'forms', label: 'Forms', icon: 'F' },
    { id: 'media', label: 'Media', icon: 'M' },
    { id: 'advanced', label: 'Advanced', icon: 'A' },
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
      style: definition.defaultStyle ?? {},
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
      background: '#0a0a0a',
      borderRight: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        {([
          { id: 'widgets' as PanelTab, label: 'Widgets' },
          { id: 'pages' as PanelTab, label: 'Pages' },
          { id: 'branding' as PanelTab, label: 'Brand' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              flex: 1,
              padding: '0.65rem 0.5rem',
              background: activeTab === tab.id ? '#6366f1' : 'transparent',
              color: activeTab === tab.id ? '#ffffff' : 'rgba(255,255,255,0.5)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: '500',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'widgets' && (
          <WidgetsTabContent
            categories={categories}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            filteredWidgets={filteredWidgets}
            handleAddWidget={handleAddWidget}
            handleDragStart={handleDragStart}
          />
        )}
        {activeTab === 'pages' && config && onSwitchPage && (
          <PagesTabContent
            config={config}
            selectedPageId={selectedPageId ?? 'home'}
            onSwitchPage={onSwitchPage}
          />
        )}
        {activeTab === 'branding' && config && onUpdateBranding && (
          <BrandingTabContent
            branding={config.branding}
            onUpdate={onUpdateBranding}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Widgets Tab
// ============================================================================

function WidgetsTabContent({
  categories,
  activeCategory,
  setActiveCategory,
  searchQuery,
  setSearchQuery,
  filteredWidgets,
  handleAddWidget,
  handleDragStart,
}: {
  categories: { id: string; label: string; icon: string }[];
  activeCategory: string;
  setActiveCategory: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  filteredWidgets: [string, { label: string; description?: string; icon: string }][];
  handleAddWidget: (type: WidgetType) => void;
  handleDragStart: (e: React.DragEvent, type: WidgetType) => void;
}) {
  return (
    <>
      {/* Search */}
      <div style={{ padding: '0.75rem' }}>
        <input
          type="text"
          placeholder="Search widgets..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.5rem',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '4px',
            fontSize: '0.8rem',
            background: 'rgba(255,255,255,0.05)',
            color: '#ffffff',
          }}
        />
      </div>

      {/* Categories */}
      <div style={{
        display: 'flex',
        gap: '0.2rem',
        padding: '0 0.75rem 0.75rem',
        overflowX: 'auto',
      }}>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            title={cat.label}
            style={{
              padding: '0.4rem 0.6rem',
              background: activeCategory === cat.id ? '#6366f1' : 'rgba(255,255,255,0.05)',
              color: activeCategory === cat.id ? '#ffffff' : 'rgba(255,255,255,0.5)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.7rem',
              whiteSpace: 'nowrap',
              fontWeight: '500',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Widgets List */}
      <div style={{ padding: '0 0.75rem 0.75rem' }}>
        {filteredWidgets.length === 0 ? (
          <div style={{
            padding: '2rem 1rem',
            textAlign: 'center',
            color: 'rgba(255,255,255,0.4)',
            fontSize: '0.8rem',
          }}>
            No widgets found
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {filteredWidgets.map(([type, def]) => (
              <div
                key={type}
                draggable
                onClick={() => handleAddWidget(type as WidgetType)}
                onDragStart={(e) => handleDragStart(e, type as WidgetType)}
                style={{
                  padding: '0.6rem',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '6px',
                  cursor: 'grab',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#6366f1';
                  e.currentTarget.style.background = 'rgba(99, 102, 241, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <span style={{ fontSize: '1rem', width: '24px', textAlign: 'center' }}>{def.icon}</span>
                  <span style={{
                    fontSize: '0.8rem',
                    fontWeight: '500',
                    color: '#ffffff',
                  }}>
                    {def.label}
                  </span>
                </div>

                {def.description && (
                  <div style={{
                    fontSize: '0.7rem',
                    color: 'rgba(255,255,255,0.4)',
                    marginLeft: '2rem',
                    marginTop: '0.15rem',
                  }}>
                    {def.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ============================================================================
// Pages Tab
// ============================================================================

function PagesTabContent({
  config,
  selectedPageId,
  onSwitchPage,
}: {
  config: WebsiteConfig;
  selectedPageId: string;
  onSwitchPage: (pageId: string) => void;
}) {
  return (
    <div style={{ padding: '0.75rem' }}>
      <div style={{
        fontSize: '0.7rem',
        fontWeight: '600',
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '0.75rem',
        padding: '0 0.25rem',
      }}>
        Website Pages ({config.pages.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {config.pages.map(page => (
          <button
            key={page.id}
            onClick={() => onSwitchPage(page.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '0.6rem 0.75rem',
              background: selectedPageId === page.id ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              border: selectedPageId === page.id ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid transparent',
              borderRadius: '6px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              if (selectedPageId !== page.id) {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }
            }}
            onMouseLeave={(e) => {
              if (selectedPageId !== page.id) {
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            <div>
              <div style={{
                fontSize: '0.8rem',
                fontWeight: selectedPageId === page.id ? '600' : '400',
                color: selectedPageId === page.id ? '#ffffff' : 'rgba(255,255,255,0.7)',
              }}>
                {page.name}
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: 'rgba(255,255,255,0.35)',
                marginTop: '0.1rem',
              }}>
                {page.slug}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {page.isInNav && (
                <span style={{
                  fontSize: '0.6rem',
                  padding: '0.1rem 0.3rem',
                  background: 'rgba(99, 102, 241, 0.2)',
                  color: '#6366f1',
                  borderRadius: '3px',
                  fontWeight: '600',
                }}>
                  NAV
                </span>
              )}
              {page.pageType === 'auth' && (
                <span style={{
                  fontSize: '0.6rem',
                  padding: '0.1rem 0.3rem',
                  background: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  borderRadius: '3px',
                  fontWeight: '600',
                }}>
                  AUTH
                </span>
              )}
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: page.isPublished ? '#10b981' : '#6b7280',
                display: 'inline-block',
              }} />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Branding Tab
// ============================================================================

function BrandingTabContent({
  branding,
  onUpdate,
}: {
  branding: GlobalBranding;
  onUpdate: (updates: Partial<GlobalBranding>) => void;
}) {
  const updateColor = (key: string, value: string) => {
    onUpdate({
      colors: { ...branding.colors, [key]: value },
    });
  };

  return (
    <div style={{ padding: '0.75rem' }}>
      {/* Company */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={brandLabelStyle}>Company Name</label>
        <input
          type="text"
          value={branding.companyName}
          onChange={(e) => onUpdate({ companyName: e.target.value })}
          style={brandInputStyle}
        />
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={brandLabelStyle}>Tagline</label>
        <input
          type="text"
          value={branding.tagline}
          onChange={(e) => onUpdate({ tagline: e.target.value })}
          style={brandInputStyle}
        />
      </div>

      {/* Fonts */}
      <div style={{ marginBottom: '1.25rem' }}>
        <label style={brandLabelStyle}>Heading Font</label>
        <select
          value={branding.fonts.heading}
          onChange={(e) => onUpdate({ fonts: { ...branding.fonts, heading: e.target.value } })}
          style={brandInputStyle}
        >
          <option value="Inter">Inter</option>
          <option value="system-ui">System UI</option>
          <option value="Georgia">Georgia</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Roboto">Roboto</option>
          <option value="Poppins">Poppins</option>
        </select>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={brandLabelStyle}>Body Font</label>
        <select
          value={branding.fonts.body}
          onChange={(e) => onUpdate({ fonts: { ...branding.fonts, body: e.target.value } })}
          style={brandInputStyle}
        >
          <option value="Inter">Inter</option>
          <option value="system-ui">System UI</option>
          <option value="Georgia">Georgia</option>
          <option value="Helvetica">Helvetica</option>
          <option value="Roboto">Roboto</option>
          <option value="Poppins">Poppins</option>
        </select>
      </div>

      <div style={{ marginBottom: '1.25rem' }}>
        <label style={brandLabelStyle}>Border Radius</label>
        <input
          type="text"
          value={branding.borderRadius}
          onChange={(e) => onUpdate({ borderRadius: e.target.value })}
          style={brandInputStyle}
          placeholder="8px"
        />
      </div>

      {/* Colors */}
      <div style={{
        fontSize: '0.7rem',
        fontWeight: '600',
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '0.75rem',
      }}>
        Colors
      </div>

      {[
        { key: 'primary', label: 'Primary' },
        { key: 'secondary', label: 'Secondary' },
        { key: 'accent', label: 'Accent' },
        { key: 'background', label: 'Background' },
        { key: 'surface', label: 'Surface' },
        { key: 'text', label: 'Text' },
        { key: 'success', label: 'Success' },
        { key: 'warning', label: 'Warning' },
        { key: 'error', label: 'Error' },
      ].map(({ key, label }) => (
        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <input
            type="color"
            value={branding.colors[key as keyof typeof branding.colors] ?? '#000000'}
            onChange={(e) => updateColor(key, e.target.value)}
            style={{
              width: '28px',
              height: '28px',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '4px',
              cursor: 'pointer',
              padding: '0',
              background: 'transparent',
            }}
          />
          <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', flex: 1 }}>{label}</span>
          <input
            type="text"
            value={branding.colors[key as keyof typeof branding.colors] ?? ''}
            onChange={(e) => updateColor(key, e.target.value)}
            style={{
              width: '80px',
              padding: '0.25rem 0.4rem',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '3px',
              color: '#ffffff',
              fontSize: '0.7rem',
              fontFamily: 'monospace',
            }}
          />
        </div>
      ))}
    </div>
  );
}

// Shared styles
const brandLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: '600',
  color: 'rgba(255,255,255,0.5)',
  marginBottom: '0.3rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const brandInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.5rem',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '4px',
  fontSize: '0.8rem',
  background: 'rgba(255,255,255,0.05)',
  color: '#ffffff',
};
