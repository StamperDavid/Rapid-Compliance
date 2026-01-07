/**
 * Properties Panel
 * Right sidebar for editing selected element's properties
 */

'use client';

import { useState } from 'react';
import type { Page, PageSection, Widget, WidgetStyle, Spacing } from '@/types/website';
import { widgetDefinitions } from '@/lib/website-builder/widget-definitions';

interface PropertiesPanelProps {
  selectedElement: {
    type: 'section' | 'widget';
    sectionId: string;
    widgetId?: string;
  } | null;
  page: Page;
  breakpoint: 'desktop' | 'tablet' | 'mobile';
  onUpdatePage: (updates: Partial<Page>) => void;
  onUpdateSection: (sectionId: string, updates: Partial<PageSection>) => void;
  onUpdateWidget: (sectionId: string, widgetId: string, updates: Partial<Widget>) => void;
}

export default function PropertiesPanel({
  selectedElement,
  page,
  breakpoint,
  onUpdatePage,
  onUpdateSection,
  onUpdateWidget,
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'style'>('content');

  if (!selectedElement) {
    return (
      <div style={{
        width: '320px',
        background: '#f8f9fa',
        borderLeft: '1px solid #dee2e6',
        padding: '2rem 1rem',
        textAlign: 'center',
        color: '#6c757d',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚙️</div>
        <p style={{ fontSize: '0.875rem' }}>
          Select a section or widget to edit its properties
        </p>
      </div>
    );
  }

  // Find selected section
  const section = page.content.find(s => s.id === selectedElement.sectionId);
  if (!section) {return null;}

  // Find selected widget if applicable
  let widget: Widget | null = null;
  if (selectedElement.type === 'widget' && selectedElement.widgetId) {
    for (const column of section.columns) {
      const found = column.widgets.find(w => w.id === selectedElement.widgetId);
      if (found) {
        widget = found;
        break;
      }
    }
  }

  return (
    <div style={{
      width: '320px',
      background: '#f8f9fa',
      borderLeft: '1px solid #dee2e6',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #dee2e6',
        background: 'white',
      }}>
        <h3 style={{
          margin: '0 0 0.5rem',
          fontSize: '0.875rem',
          fontWeight: '600',
          color: '#495057',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Properties
        </h3>
        <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>
          {selectedElement.type === 'section' ? 'Section' : 
           widget ? widgetDefinitions[widget.type]?.label : 'Widget'}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        background: 'white',
        borderBottom: '1px solid #dee2e6',
      }}>
        <button
          onClick={() => setActiveTab('content')}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: activeTab === 'content' ? '#007bff' : 'transparent',
            color: activeTab === 'content' ? 'white' : '#495057',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
          }}
        >
          Content
        </button>
        <button
          onClick={() => setActiveTab('style')}
          style={{
            flex: 1,
            padding: '0.75rem',
            background: activeTab === 'style' ? '#007bff' : 'transparent',
            color: activeTab === 'style' ? 'white' : '#495057',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: '500',
          }}
        >
          Style
        </button>
      </div>

      {/* Properties Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '1rem',
      }}>
        {activeTab === 'content' ? (
          selectedElement.type === 'widget' && widget ? (
            <WidgetContentEditor
              widget={widget}
              onUpdate={(updates) => onUpdateWidget(section.id, widget.id, updates)}
            />
          ) : (
            <SectionContentEditor
              section={section}
              onUpdate={(updates) => onUpdateSection(section.id, updates)}
            />
          )
        ) : (
          selectedElement.type === 'widget' && widget ? (
            <StyleEditor
              style={widget.style ?? {}}
              onUpdate={(style) => onUpdateWidget(section.id, widget.id, { style })}
            />
          ) : (
            <SectionStyleEditor
              section={section}
              onUpdate={(updates) => onUpdateSection(section.id, updates)}
            />
          )
        )}
      </div>
    </div>
  );
}

// Widget Content Editor
interface WidgetContentEditorProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

function WidgetContentEditor({ widget, onUpdate }: WidgetContentEditorProps) {
  const updateData = (key: string, value: any) => {
    onUpdate({
      data: { ...widget.data, [key]: value },
    });
  };

  const renderField = (key: string, value: any) => {
    if (typeof value === 'string') {
      if (value.length > 50 || key === 'content' || key === 'html') {
        return (
          <div key={key} style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>{formatLabel(key)}</label>
            <textarea
              value={value}
              onChange={(e) => updateData(key, e.target.value)}
              rows={3}
              style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>
        );
      }
      return (
        <div key={key} style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>{formatLabel(key)}</label>
          <input
            type="text"
            value={value}
            onChange={(e) => updateData(key, e.target.value)}
            style={inputStyle}
          />
        </div>
      );
    } else if (typeof value === 'number') {
      return (
        <div key={key} style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>{formatLabel(key)}</label>
          <input
            type="number"
            value={value}
            onChange={(e) => updateData(key, parseFloat(e.target.value))}
            style={inputStyle}
          />
        </div>
      );
    } else if (typeof value === 'boolean') {
      return (
        <div key={key} style={{ marginBottom: '1rem' }}>
          <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={value}
              onChange={(e) => updateData(key, e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            {formatLabel(key)}
          </label>
        </div>
      );
    } else if (Array.isArray(value)) {
      return (
        <div key={key} style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>{formatLabel(key)}</label>
          <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: '0.25rem' }}>
            {value.length} items (advanced editing)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div>
      {Object.entries(widget.data).map(([key, value]) => renderField(key, value))}
      {Object.keys(widget.data).length === 0 && (
        <div style={{ color: '#6c757d', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
          No content options available
        </div>
      )}
    </div>
  );
}

// Section Content Editor
interface SectionContentEditorProps {
  section: PageSection;
  onUpdate: (updates: Partial<PageSection>) => void;
}

function SectionContentEditor({ section, onUpdate }: SectionContentEditorProps) {
  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Section Name</label>
        <input
          type="text"
          value={section.name ?? ''}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="Section name (optional)"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={section.fullWidth || false}
            onChange={(e) => onUpdate({ fullWidth: e.target.checked })}
            style={{ width: '16px', height: '16px' }}
          />
          Full Width
        </label>
      </div>

      {!section.fullWidth && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Max Width (px)</label>
          <input
            type="number"
            value={section.maxWidth || 1200}
            onChange={(e) => onUpdate({ maxWidth: parseInt(e.target.value) })}
            style={inputStyle}
          />
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Columns</label>
        <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>
          {section.columns.length} column(s)
        </div>
      </div>
    </div>
  );
}

// Style Editor
interface StyleEditorProps {
  style: WidgetStyle;
  onUpdate: (style: WidgetStyle) => void;
}

function StyleEditor({ style, onUpdate }: StyleEditorProps) {
  const updateStyle = (key: keyof WidgetStyle, value: any) => {
    onUpdate({ ...style, [key]: value });
  };

  const updateSpacing = (type: 'padding' | 'margin', side: keyof Spacing, value: string) => {
    const current = style[type] ?? {};
    onUpdate({
      ...style,
      [type]: { ...current, [side]: value },
    });
  };

  return (
    <div>
      {/* Spacing */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={sectionHeadingStyle}>Spacing</h4>
        
        <label style={labelStyle}>Padding</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Top"
            value={style.padding?.top ?? ''}
            onChange={(e) => updateSpacing('padding', 'top', e.target.value)}
            style={smallInputStyle}
          />
          <input
            type="text"
            placeholder="Right"
            value={style.padding?.right ?? ''}
            onChange={(e) => updateSpacing('padding', 'right', e.target.value)}
            style={smallInputStyle}
          />
          <input
            type="text"
            placeholder="Bottom"
            value={style.padding?.bottom ?? ''}
            onChange={(e) => updateSpacing('padding', 'bottom', e.target.value)}
            style={smallInputStyle}
          />
          <input
            type="text"
            placeholder="Left"
            value={style.padding?.left ?? ''}
            onChange={(e) => updateSpacing('padding', 'left', e.target.value)}
            style={smallInputStyle}
          />
        </div>

        <label style={labelStyle}>Margin</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Top"
            value={style.margin?.top ?? ''}
            onChange={(e) => updateSpacing('margin', 'top', e.target.value)}
            style={smallInputStyle}
          />
          <input
            type="text"
            placeholder="Right"
            value={style.margin?.right ?? ''}
            onChange={(e) => updateSpacing('margin', 'right', e.target.value)}
            style={smallInputStyle}
          />
          <input
            type="text"
            placeholder="Bottom"
            value={style.margin?.bottom ?? ''}
            onChange={(e) => updateSpacing('margin', 'bottom', e.target.value)}
            style={smallInputStyle}
          />
          <input
            type="text"
            placeholder="Left"
            value={style.margin?.left ?? ''}
            onChange={(e) => updateSpacing('margin', 'left', e.target.value)}
            style={smallInputStyle}
          />
        </div>
      </div>

      {/* Typography */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={sectionHeadingStyle}>Typography</h4>
        
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Font Size</label>
          <input
            type="text"
            value={style.fontSize ?? ''}
            onChange={(e) => updateStyle('fontSize', e.target.value)}
            placeholder="1rem, 16px, etc."
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Font Weight</label>
          <select
            value={style.fontWeight ?? ''}
            onChange={(e) => updateStyle('fontWeight', e.target.value)}
            style={inputStyle}
          >
            <option value="">Default</option>
            <option value="300">Light (300)</option>
            <option value="400">Normal (400)</option>
            <option value="500">Medium (500)</option>
            <option value="600">Semi-bold (600)</option>
            <option value="700">Bold (700)</option>
          </select>
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Text Align</label>
          <select
            value={style.textAlign ?? ''}
            onChange={(e) => updateStyle('textAlign', e.target.value as any)}
            style={inputStyle}
          >
            <option value="">Default</option>
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
            <option value="justify">Justify</option>
          </select>
        </div>
      </div>

      {/* Colors */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={sectionHeadingStyle}>Colors</h4>
        
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Text Color</label>
          <input
            type="color"
            value={style.color || '#000000'}
            onChange={(e) => updateStyle('color', e.target.value)}
            style={{ ...inputStyle, height: '40px' }}
          />
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Background Color</label>
          <input
            type="color"
            value={style.backgroundColor || '#ffffff'}
            onChange={(e) => updateStyle('backgroundColor', e.target.value)}
            style={{ ...inputStyle, height: '40px' }}
          />
        </div>
      </div>

      {/* Border & Effects */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={sectionHeadingStyle}>Border & Effects</h4>
        
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Border Radius</label>
          <input
            type="text"
            value={style.borderRadius ?? ''}
            onChange={(e) => updateStyle('borderRadius', e.target.value)}
            placeholder="4px, 0.5rem, etc."
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Box Shadow</label>
          <input
            type="text"
            value={style.boxShadow ?? ''}
            onChange={(e) => updateStyle('boxShadow', e.target.value)}
            placeholder="0 2px 4px rgba(0,0,0,0.1)"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Opacity</label>
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            value={style.opacity || 1}
            onChange={(e) => updateStyle('opacity', parseFloat(e.target.value))}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}

// Section Style Editor
interface SectionStyleEditorProps {
  section: PageSection;
  onUpdate: (updates: Partial<PageSection>) => void;
}

function SectionStyleEditor({ section, onUpdate }: SectionStyleEditorProps) {
  const updateSpacing = (type: 'padding' | 'margin', side: keyof Spacing, value: string) => {
    const current = section[type] ?? {};
    onUpdate({
      [type]: { ...current, [side]: value },
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>Background Color</label>
        <input
          type="color"
          value={section.backgroundColor || '#ffffff'}
          onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
          style={{ ...inputStyle, height: '40px' }}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <label style={labelStyle}>Background Image URL</label>
        <input
          type="text"
          value={section.backgroundImage ?? ''}
          onChange={(e) => onUpdate({ backgroundImage: e.target.value })}
          placeholder="https://..."
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={sectionHeadingStyle}>Padding</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Top"
            value={section.padding?.top ?? ''}
            onChange={(e) => updateSpacing('padding', 'top', e.target.value)}
            style={smallInputStyle}
          />
          <input
            type="text"
            placeholder="Right"
            value={section.padding?.right ?? ''}
            onChange={(e) => updateSpacing('padding', 'right', e.target.value)}
            style={smallInputStyle}
          />
          <input
            type="text"
            placeholder="Bottom"
            value={section.padding?.bottom ?? ''}
            onChange={(e) => updateSpacing('padding', 'bottom', e.target.value)}
            style={smallInputStyle}
          />
          <input
            type="text"
            placeholder="Left"
            value={section.padding?.left ?? ''}
            onChange={(e) => updateSpacing('padding', 'left', e.target.value)}
            style={smallInputStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={sectionHeadingStyle}>Margin</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Top"
            value={section.margin?.top ?? ''}
            onChange={(e) => updateSpacing('margin', 'top', e.target.value)}
            style={smallInputStyle}
          />
          <input
            type="text"
            placeholder="Right"
            value={section.margin?.right ?? ''}
            onChange={(e) => updateSpacing('margin', 'right', e.target.value)}
            style={smallInputStyle}
          />
          <input
            type="text"
            placeholder="Bottom"
            value={section.margin?.bottom ?? ''}
            onChange={(e) => updateSpacing('margin', 'bottom', e.target.value)}
            style={smallInputStyle}
          />
          <input
            type="text"
            placeholder="Left"
            value={section.margin?.left ?? ''}
            onChange={(e) => updateSpacing('margin', 'left', e.target.value)}
            style={smallInputStyle}
          />
        </div>
      </div>
    </div>
  );
}

// Helper functions
function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

// Styles
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: '600',
  color: '#495057',
  marginBottom: '0.25rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  border: '1px solid #ced4da',
  borderRadius: '4px',
  fontSize: '0.875rem',
};

const smallInputStyle: React.CSSProperties = {
  ...inputStyle,
  padding: '0.375rem 0.5rem',
  fontSize: '0.75rem',
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '0.75rem',
  fontWeight: '600',
  color: '#495057',
  marginBottom: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};


