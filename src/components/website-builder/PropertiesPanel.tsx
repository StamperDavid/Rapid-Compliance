/**
 * Properties Panel
 * Right sidebar for editing selected element's properties (dark theme)
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
  breakpoint: _breakpoint,
  onUpdatePage: _onUpdatePage,
  onUpdateSection,
  onUpdateWidget,
}: PropertiesPanelProps) {
  const [activeTab, setActiveTab] = useState<'content' | 'style'>('content');

  if (!selectedElement) {
    return (
      <div style={{
        width: '320px',
        background: '#0a0a0a',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        padding: '2rem 1rem',
        textAlign: 'center',
        color: 'rgba(255,255,255,0.5)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem', opacity: 0.4 }}>+</div>
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
      background: '#0a0a0a',
      borderLeft: '1px solid rgba(255,255,255,0.1)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: 'Inter, system-ui, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '0.75rem 1rem',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <h3 style={{
          margin: '0 0 0.25rem',
          fontSize: '0.8rem',
          fontWeight: '600',
          color: '#ffffff',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}>
          Properties
        </h3>
        <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)' }}>
          {selectedElement.type === 'section' ? 'Section' :
           widget ? widgetDefinitions[widget.type]?.label : 'Widget'}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid rgba(255,255,255,0.1)',
      }}>
        <button
          onClick={() => setActiveTab('content')}
          style={{
            flex: 1,
            padding: '0.65rem',
            background: activeTab === 'content' ? '#6366f1' : 'transparent',
            color: activeTab === 'content' ? '#ffffff' : 'rgba(255,255,255,0.5)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: '500',
          }}
        >
          Content
        </button>
        <button
          onClick={() => setActiveTab('style')}
          style={{
            flex: 1,
            padding: '0.65rem',
            background: activeTab === 'style' ? '#6366f1' : 'transparent',
            color: activeTab === 'style' ? '#ffffff' : 'rgba(255,255,255,0.5)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.8rem',
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
  const updateData = (key: string, value: Record<string, unknown> | string | number | boolean) => {
    onUpdate({
      data: { ...widget.data, [key]: value },
    });
  };

  const renderField = (key: string, value: unknown) => {
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
              style={{ width: '14px', height: '14px', accentColor: '#6366f1' }}
            />
            {formatLabel(key)}
          </label>
        </div>
      );
    } else if (Array.isArray(value)) {
      return (
        <div key={key} style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>{formatLabel(key)}</label>
          <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.25rem' }}>
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
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
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
            checked={section.fullWidth ?? false}
            onChange={(e) => onUpdate({ fullWidth: e.target.checked })}
            style={{ width: '14px', height: '14px', accentColor: '#6366f1' }}
          />
          Full Width
        </label>
      </div>

      {!section.fullWidth && (
        <div style={{ marginBottom: '1rem' }}>
          <label style={labelStyle}>Max Width (px)</label>
          <input
            type="number"
            value={section.maxWidth ?? 1200}
            onChange={(e) => onUpdate({ maxWidth: parseInt(e.target.value) })}
            style={inputStyle}
          />
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <label style={labelStyle}>Columns</label>
        <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)' }}>
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
  const updateStyle = (key: keyof WidgetStyle, value: unknown) => {
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

      {/* Size */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={sectionHeadingStyle}>Size</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Width</label>
            <input
              type="text"
              value={style.width ?? ''}
              onChange={(e) => updateStyle('width', e.target.value)}
              placeholder="auto"
              style={smallInputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Height</label>
            <input
              type="text"
              value={style.height ?? ''}
              onChange={(e) => updateStyle('height', e.target.value)}
              placeholder="auto"
              style={smallInputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Max Width</label>
            <input
              type="text"
              value={style.maxWidth ?? ''}
              onChange={(e) => updateStyle('maxWidth', e.target.value)}
              placeholder="none"
              style={smallInputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Min Height</label>
            <input
              type="text"
              value={style.minHeight ?? ''}
              onChange={(e) => updateStyle('minHeight', e.target.value)}
              placeholder="auto"
              style={smallInputStyle}
            />
          </div>
        </div>
      </div>

      {/* Typography */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={sectionHeadingStyle}>Typography</h4>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Font Family</label>
          <select
            value={style.fontFamily ?? ''}
            onChange={(e) => updateStyle('fontFamily', e.target.value)}
            style={inputStyle}
          >
            <option value="">Default</option>
            <option value="Inter, system-ui, sans-serif">Inter</option>
            <option value="system-ui, sans-serif">System UI</option>
            <option value="Georgia, serif">Georgia</option>
            <option value="monospace">Monospace</option>
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Font Size</label>
            <input
              type="text"
              value={style.fontSize ?? ''}
              onChange={(e) => updateStyle('fontSize', e.target.value)}
              placeholder="1rem"
              style={smallInputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Font Weight</label>
            <select
              value={style.fontWeight ?? ''}
              onChange={(e) => updateStyle('fontWeight', e.target.value)}
              style={smallInputStyle}
            >
              <option value="">Default</option>
              <option value="300">Light</option>
              <option value="400">Normal</option>
              <option value="500">Medium</option>
              <option value="600">Semi-bold</option>
              <option value="700">Bold</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Line Height</label>
            <input
              type="text"
              value={style.lineHeight ?? ''}
              onChange={(e) => updateStyle('lineHeight', e.target.value)}
              placeholder="1.6"
              style={smallInputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Letter Spacing</label>
            <input
              type="text"
              value={style.letterSpacing ?? ''}
              onChange={(e) => updateStyle('letterSpacing', e.target.value)}
              placeholder="normal"
              style={smallInputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Text Align</label>
            <select
              value={style.textAlign ?? ''}
              onChange={(e) => updateStyle('textAlign', e.target.value)}
              style={smallInputStyle}
            >
              <option value="">Default</option>
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
              <option value="justify">Justify</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Transform</label>
            <select
              value={style.textTransform ?? ''}
              onChange={(e) => updateStyle('textTransform', e.target.value)}
              style={smallInputStyle}
            >
              <option value="">None</option>
              <option value="uppercase">Uppercase</option>
              <option value="lowercase">Lowercase</option>
              <option value="capitalize">Capitalize</option>
            </select>
          </div>
        </div>
      </div>

      {/* Colors */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={sectionHeadingStyle}>Colors</h4>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Text Color</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="color"
              value={(style.color !== '' && style.color != null) ? style.color : '#ffffff'}
              onChange={(e) => updateStyle('color', e.target.value)}
              style={colorPickerStyle}
            />
            <input
              type="text"
              value={style.color ?? ''}
              onChange={(e) => updateStyle('color', e.target.value)}
              placeholder="#ffffff"
              style={{ ...smallInputStyle, flex: 1, fontFamily: 'monospace' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Background</label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="color"
              value={(style.backgroundColor !== '' && style.backgroundColor != null) ? style.backgroundColor : '#000000'}
              onChange={(e) => updateStyle('backgroundColor', e.target.value)}
              style={colorPickerStyle}
            />
            <input
              type="text"
              value={style.backgroundColor ?? ''}
              onChange={(e) => updateStyle('backgroundColor', e.target.value)}
              placeholder="transparent"
              style={{ ...smallInputStyle, flex: 1, fontFamily: 'monospace' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Background Image URL</label>
          <input
            type="text"
            value={style.backgroundImage ?? ''}
            onChange={(e) => updateStyle('backgroundImage', e.target.value)}
            placeholder="https://..."
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>BG Size</label>
            <select
              value={style.backgroundSize ?? ''}
              onChange={(e) => updateStyle('backgroundSize', e.target.value)}
              style={smallInputStyle}
            >
              <option value="">Default</option>
              <option value="cover">Cover</option>
              <option value="contain">Contain</option>
              <option value="auto">Auto</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>BG Position</label>
            <input
              type="text"
              value={style.backgroundPosition ?? ''}
              onChange={(e) => updateStyle('backgroundPosition', e.target.value)}
              placeholder="center"
              style={smallInputStyle}
            />
          </div>
        </div>
      </div>

      {/* Border */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={sectionHeadingStyle}>Border</h4>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Border</label>
          <input
            type="text"
            value={style.border ?? ''}
            onChange={(e) => updateStyle('border', e.target.value)}
            placeholder="1px solid rgba(255,255,255,0.1)"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Border Radius</label>
            <input
              type="text"
              value={style.borderRadius ?? ''}
              onChange={(e) => updateStyle('borderRadius', e.target.value)}
              placeholder="8px"
              style={smallInputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Border Width</label>
            <input
              type="text"
              value={style.borderWidth ?? ''}
              onChange={(e) => updateStyle('borderWidth', e.target.value)}
              placeholder="1px"
              style={smallInputStyle}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Border Color</label>
            <input
              type="text"
              value={style.borderColor ?? ''}
              onChange={(e) => updateStyle('borderColor', e.target.value)}
              placeholder="#333"
              style={smallInputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Border Style</label>
            <select
              value={style.borderStyle ?? ''}
              onChange={(e) => updateStyle('borderStyle', e.target.value)}
              style={smallInputStyle}
            >
              <option value="">None</option>
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </div>
        </div>
      </div>

      {/* Layout */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={sectionHeadingStyle}>Layout</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Display</label>
            <select
              value={style.display ?? ''}
              onChange={(e) => updateStyle('display', e.target.value)}
              style={smallInputStyle}
            >
              <option value="">Default</option>
              <option value="block">Block</option>
              <option value="inline-block">Inline Block</option>
              <option value="flex">Flex</option>
              <option value="grid">Grid</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Direction</label>
            <select
              value={style.flexDirection ?? ''}
              onChange={(e) => updateStyle('flexDirection', e.target.value)}
              style={smallInputStyle}
            >
              <option value="">Default</option>
              <option value="row">Row</option>
              <option value="column">Column</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Justify</label>
            <select
              value={style.justifyContent ?? ''}
              onChange={(e) => updateStyle('justifyContent', e.target.value)}
              style={smallInputStyle}
            >
              <option value="">Default</option>
              <option value="flex-start">Start</option>
              <option value="center">Center</option>
              <option value="flex-end">End</option>
              <option value="space-between">Between</option>
              <option value="space-around">Around</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Align</label>
            <select
              value={style.alignItems ?? ''}
              onChange={(e) => updateStyle('alignItems', e.target.value)}
              style={smallInputStyle}
            >
              <option value="">Default</option>
              <option value="flex-start">Start</option>
              <option value="center">Center</option>
              <option value="flex-end">End</option>
              <option value="stretch">Stretch</option>
            </select>
          </div>
        </div>
      </div>

      {/* Effects */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={sectionHeadingStyle}>Effects</h4>

        <div style={{ marginBottom: '0.75rem' }}>
          <label style={labelStyle}>Box Shadow</label>
          <input
            type="text"
            value={style.boxShadow ?? ''}
            onChange={(e) => updateStyle('boxShadow', e.target.value)}
            placeholder="0 2px 4px rgba(0,0,0,0.3)"
            style={inputStyle}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label style={labelStyle}>Opacity</label>
            <input
              type="number"
              min="0"
              max="1"
              step="0.1"
              value={style.opacity ?? 1}
              onChange={(e) => updateStyle('opacity', parseFloat(e.target.value))}
              style={smallInputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Transform</label>
            <input
              type="text"
              value={style.transform ?? ''}
              onChange={(e) => updateStyle('transform', e.target.value)}
              placeholder="none"
              style={smallInputStyle}
            />
          </div>
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
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <input
            type="color"
            value={(section.backgroundColor !== '' && section.backgroundColor != null) ? section.backgroundColor : '#000000'}
            onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
            style={colorPickerStyle}
          />
          <input
            type="text"
            value={section.backgroundColor ?? ''}
            onChange={(e) => onUpdate({ backgroundColor: e.target.value })}
            placeholder="#000000"
            style={{ ...smallInputStyle, flex: 1, fontFamily: 'monospace' }}
          />
        </div>
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

// Dark theme styles
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: '600',
  color: 'rgba(255,255,255,0.5)',
  marginBottom: '0.25rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.5rem',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '4px',
  fontSize: '0.8rem',
  background: 'rgba(255,255,255,0.05)',
  color: '#ffffff',
};

const smallInputStyle: React.CSSProperties = {
  ...inputStyle,
  padding: '0.35rem 0.5rem',
  fontSize: '0.75rem',
};

const colorPickerStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '4px',
  cursor: 'pointer',
  padding: '0',
  background: 'transparent',
};

const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: '600',
  color: 'rgba(255,255,255,0.4)',
  marginBottom: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};
