/**
 * Properties Panel
 * Right sidebar for editing a selected element. The Style tab is a real,
 * Elementor-class styling panel: grouped controls (typography, background,
 * border, spacing, size, layout, effects) with proper inputs (colour pickers,
 * gradient builder, number+unit, selects) and genuine per-breakpoint editing.
 *
 * Per-breakpoint model — matches what ResponsiveRenderer reads:
 *  - desktop  → writes the widget's base `style`
 *  - tablet   → writes `widget.responsive.tablet` (overrides desktop)
 *  - mobile   → writes `widget.responsive.mobile`  (overrides desktop)
 * The renderer shallow-merges `responsive[bp]` over `style` before applying, so
 * every field below renders exactly as edited, per device.
 */

'use client';

import { useState } from 'react';
import type { Page, PageSection, Widget, WidgetStyle, Spacing } from '@/types/website';
import { widgetDefinitions } from '@/lib/website-builder/widget-definitions';
import { ImageField, ImageArrayField, detectItemImageKey } from './ImageField';
import {
  Group,
  FieldRow,
  SegmentedControl,
  SelectField,
  TextField,
  ColorField,
  UnitField,
  NumberField,
  SpacingField,
  GradientField,
  DEFAULT_GRADIENT,
  labelStyle,
  inputStyle,
} from './StyleControls';

type Breakpoint = 'desktop' | 'tablet' | 'mobile';

const BREAKPOINT_LABEL: Record<Breakpoint, string> = {
  desktop: 'Desktop',
  tablet: 'Tablet',
  mobile: 'Mobile',
};

/** Widget data keys that hold a single image URL (image/hero/logo/testimonial). */
const IMAGE_STRING_KEYS = new Set([
  'src',
  'backgroundImage',
  'avatar',
  'image',
  'imageUrl',
  'logo',
  'poster',
]);

interface PropertiesPanelProps {
  selectedElement: {
    type: 'section' | 'widget';
    sectionId: string;
    widgetId?: string;
  } | null;
  page: Page;
  breakpoint: Breakpoint;
  onUpdatePage: (updates: Partial<Page>) => void;
  onUpdateSection: (sectionId: string, updates: Partial<PageSection>) => void;
  onUpdateWidget: (sectionId: string, widgetId: string, updates: Partial<Widget>) => void;
}

export default function PropertiesPanel({
  selectedElement,
  page,
  breakpoint,
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
          style={tabButtonStyle(activeTab === 'content')}
        >
          Content
        </button>
        <button
          onClick={() => setActiveTab('style')}
          style={tabButtonStyle(activeTab === 'style')}
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
              widget={widget}
              breakpoint={breakpoint}
              onUpdate={(updates) => onUpdateWidget(section.id, widget.id, updates)}
            />
          ) : (
            <SectionStyleEditor
              section={section}
              breakpoint={breakpoint}
              onUpdate={(updates) => onUpdateSection(section.id, updates)}
            />
          )
        )}
      </div>
    </div>
  );
}

function tabButtonStyle(active: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: '0.65rem',
    background: active ? '#6366f1' : 'transparent',
    color: active ? '#ffffff' : 'rgba(255,255,255,0.5)',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.8rem',
    fontWeight: 500,
  };
}

// ===========================================================================
// Widget Content Editor (unchanged behaviour — content fields per widget type)
// ===========================================================================

interface WidgetContentEditorProps {
  widget: Widget;
  onUpdate: (updates: Partial<Widget>) => void;
}

function WidgetContentEditor({ widget, onUpdate }: WidgetContentEditorProps) {
  const updateData = (
    key: string,
    value: Record<string, unknown> | string | number | boolean | unknown[],
  ) => {
    onUpdate({
      data: { ...widget.data, [key]: value },
    });
  };

  const renderField = (key: string, value: unknown) => {
    if (typeof value === 'string') {
      if (IMAGE_STRING_KEYS.has(key)) {
        return (
          <ImageField
            key={key}
            label={formatLabel(key)}
            value={value}
            onChange={(url) => updateData(key, url)}
          />
        );
      }
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
      const imageKey = detectItemImageKey(value[0]);
      if (imageKey) {
        return (
          <ImageArrayField
            key={key}
            label={formatLabel(key)}
            items={value as Record<string, unknown>[]}
            imageKey={imageKey}
            onChange={(items) => updateData(key, items)}
          />
        );
      }
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

// ===========================================================================
// Section Content Editor (unchanged)
// ===========================================================================

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

// ===========================================================================
// Widget Style Editor — per-breakpoint, grouped, Elementor-class
// ===========================================================================

interface StyleEditorProps {
  widget: Widget;
  breakpoint: Breakpoint;
  onUpdate: (updates: Partial<Widget>) => void;
}

function StyleEditor({ widget, breakpoint, onUpdate }: StyleEditorProps) {
  const base: WidgetStyle = widget.style ?? {};

  // --- Active-breakpoint layer ------------------------------------------------
  const get = <K extends keyof WidgetStyle>(key: K): WidgetStyle[K] | undefined => {
    if (breakpoint === 'tablet' || breakpoint === 'mobile') {
      const override = widget.responsive?.[breakpoint];
      if (override?.[key] !== undefined) {
        return override[key];
      }
    }
    return base[key];
  };

  const isOverridden = (key: keyof WidgetStyle): boolean => {
    if (breakpoint === 'tablet' || breakpoint === 'mobile') {
      return widget.responsive?.[breakpoint]?.[key] !== undefined;
    }
    return false;
  };

  const patch = (partial: Partial<WidgetStyle>) => {
    if (breakpoint === 'desktop') {
      onUpdate({ style: { ...base, ...partial } });
      return;
    }
    const resp = { ...(widget.responsive ?? {}) };
    if (breakpoint === 'tablet') {
      resp.tablet = { ...(resp.tablet ?? {}), ...partial };
    } else {
      resp.mobile = { ...(resp.mobile ?? {}), ...partial };
    }
    onUpdate({ responsive: resp });
  };

  const unset = (keys: Array<keyof WidgetStyle>) => {
    if (breakpoint === 'desktop') {
      const next = { ...base };
      keys.forEach((k) => { delete next[k]; });
      onUpdate({ style: next });
      return;
    }
    const resp = { ...(widget.responsive ?? {}) };
    if (breakpoint === 'tablet') {
      const cur = { ...(resp.tablet ?? {}) };
      keys.forEach((k) => { delete cur[k]; });
      resp.tablet = cur;
    } else {
      const cur = { ...(resp.mobile ?? {}) };
      keys.forEach((k) => { delete cur[k]; });
      resp.mobile = cur;
    }
    onUpdate({ responsive: resp });
  };

  /** FieldRow props (override dot + reset) — only meaningful off desktop. */
  const row = (...keys: Array<keyof WidgetStyle>) => {
    if (breakpoint === 'desktop') {
      return {};
    }
    return {
      overridden: keys.some((k) => isOverridden(k)),
      onReset: () => unset(keys),
    };
  };

  const setSpacing = (type: 'padding' | 'margin', value: Spacing) => {
    if (type === 'padding') {
      patch({ padding: value });
    } else {
      patch({ margin: value });
    }
  };

  const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));

  // --- Text colour: solid vs gradient ----------------------------------------
  const textIsGradient = get('textGradient') !== undefined;

  // --- Background type --------------------------------------------------------
  const bgImageRaw = get('backgroundImage');
  const bgType: 'none' | 'color' | 'gradient' | 'image' =
    bgImageRaw !== undefined && bgImageRaw !== '' ? 'image'
      : get('backgroundGradient') !== undefined ? 'gradient'
        : (get('backgroundColor') !== undefined && get('backgroundColor') !== '') ? 'color'
          : 'none';

  const setBgType = (type: 'none' | 'color' | 'gradient' | 'image') => {
    switch (type) {
      case 'none':
        unset(['backgroundColor', 'backgroundGradient', 'backgroundImage', 'backgroundSize', 'backgroundPosition']);
        break;
      case 'color':
        unset(['backgroundGradient', 'backgroundImage', 'backgroundSize', 'backgroundPosition']);
        if (get('backgroundColor') === undefined) {
          patch({ backgroundColor: '#111827' });
        }
        break;
      case 'gradient':
        unset(['backgroundImage', 'backgroundSize', 'backgroundPosition']);
        if (get('backgroundGradient') === undefined) {
          patch({ backgroundGradient: DEFAULT_GRADIENT });
        }
        break;
      case 'image':
        unset(['backgroundGradient']);
        break;
    }
  };

  return (
    <div>
      <BreakpointBanner breakpoint={breakpoint} />

      {/* TYPOGRAPHY */}
      <Group title="Typography" defaultOpen>
        <FieldRow label="Text Colour" {...row('color', 'textGradient')}>
          <div style={{ marginBottom: '0.5rem' }}>
            <SegmentedControl
              value={textIsGradient ? 'gradient' : 'solid'}
              options={[
                { value: 'solid', label: 'Solid' },
                { value: 'gradient', label: 'Gradient' },
              ]}
              onChange={(mode) => {
                if (mode === 'solid') {
                  unset(['textGradient']);
                } else if (get('textGradient') === undefined) {
                  patch({ textGradient: DEFAULT_GRADIENT });
                }
              }}
            />
          </div>
          {textIsGradient ? (
            <GradientField value={get('textGradient')} onChange={(g) => patch({ textGradient: g })} />
          ) : (
            <ColorField
              value={get('color')}
              fallback="#ffffff"
              placeholder="#ffffff"
              onChange={(v) => patch({ color: v })}
            />
          )}
        </FieldRow>

        <FieldRow label="Font" {...row('fontFamily')}>
          <SelectField
            value={str(get('fontFamily'))}
            onChange={(v) => patch({ fontFamily: v === '' ? undefined : v })}
            options={[
              { value: '', label: 'Default' },
              { value: 'Inter, system-ui, sans-serif', label: 'Inter' },
              { value: 'system-ui, sans-serif', label: 'System UI' },
              { value: 'Georgia, serif', label: 'Georgia' },
              { value: '"Times New Roman", serif', label: 'Times' },
              { value: 'monospace', label: 'Monospace' },
            ]}
          />
        </FieldRow>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <FieldRow label="Size" {...row('fontSize')}>
            <UnitField
              value={get('fontSize')}
              units={['px', 'rem', 'em', '%']}
              placeholder="16"
              onChange={(v) => patch({ fontSize: v })}
            />
          </FieldRow>
          <FieldRow label="Weight" {...row('fontWeight')}>
            <SelectField
              value={str(get('fontWeight'))}
              onChange={(v) => patch({ fontWeight: v === '' ? undefined : v })}
              options={[
                { value: '', label: 'Default' },
                { value: '300', label: 'Light' },
                { value: '400', label: 'Normal' },
                { value: '500', label: 'Medium' },
                { value: '600', label: 'Semi-bold' },
                { value: '700', label: 'Bold' },
                { value: '800', label: 'Extra-bold' },
              ]}
            />
          </FieldRow>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <FieldRow label="Line Height" {...row('lineHeight')}>
            <UnitField
              value={get('lineHeight')}
              units={['', 'px', 'em', '%']}
              placeholder="1.6"
              onChange={(v) => patch({ lineHeight: v })}
            />
          </FieldRow>
          <FieldRow label="Letter Spacing" {...row('letterSpacing')}>
            <UnitField
              value={get('letterSpacing')}
              units={['px', 'em', 'normal']}
              placeholder="0"
              onChange={(v) => patch({ letterSpacing: v })}
            />
          </FieldRow>
        </div>

        <FieldRow label="Alignment" {...row('textAlign')}>
          <SegmentedControl
            value={str(get('textAlign')) === '' ? 'left' : str(get('textAlign'))}
            options={[
              { value: 'left', label: 'Left' },
              { value: 'center', label: 'Center' },
              { value: 'right', label: 'Right' },
              { value: 'justify', label: 'Justify' },
            ]}
            onChange={(v) => patch({ textAlign: v as WidgetStyle['textAlign'] })}
          />
        </FieldRow>

        <FieldRow label="Capitalisation" {...row('textTransform')}>
          <SelectField
            value={str(get('textTransform'))}
            onChange={(v) => patch({ textTransform: v === '' ? undefined : (v as WidgetStyle['textTransform']) })}
            options={[
              { value: '', label: 'None' },
              { value: 'uppercase', label: 'UPPERCASE' },
              { value: 'lowercase', label: 'lowercase' },
              { value: 'capitalize', label: 'Capitalize' },
            ]}
          />
        </FieldRow>
      </Group>

      {/* BACKGROUND */}
      <Group title="Background" defaultOpen>
        <FieldRow
          label="Type"
          {...row('backgroundColor', 'backgroundGradient', 'backgroundImage')}
        >
          <SegmentedControl
            value={bgType}
            options={[
              { value: 'none', label: 'None' },
              { value: 'color', label: 'Colour' },
              { value: 'gradient', label: 'Gradient' },
              { value: 'image', label: 'Image' },
            ]}
            onChange={setBgType}
          />
        </FieldRow>

        {bgType === 'color' && (
          <FieldRow label="Background Colour" {...row('backgroundColor')}>
            <ColorField
              value={get('backgroundColor')}
              fallback="#111827"
              onChange={(v) => patch({ backgroundColor: v })}
            />
          </FieldRow>
        )}

        {bgType === 'gradient' && (
          <FieldRow label="Background Gradient" {...row('backgroundGradient')}>
            <GradientField
              value={get('backgroundGradient')}
              onChange={(g) => patch({ backgroundGradient: g })}
            />
          </FieldRow>
        )}

        {bgType === 'image' && (
          <>
            <ImageField
              label="Background Image"
              value={unwrapCssUrl(get('backgroundImage'))}
              onChange={(url) => patch({ backgroundImage: url === '' ? undefined : wrapCssUrl(url) })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.5rem' }}>
              <FieldRow label="Fit" {...row('backgroundSize')}>
                <SelectField
                  value={str(get('backgroundSize'))}
                  onChange={(v) => patch({ backgroundSize: v === '' ? undefined : (v as WidgetStyle['backgroundSize']) })}
                  options={[
                    { value: '', label: 'Default' },
                    { value: 'cover', label: 'Cover' },
                    { value: 'contain', label: 'Contain' },
                    { value: 'auto', label: 'Auto' },
                  ]}
                />
              </FieldRow>
              <FieldRow label="Position" {...row('backgroundPosition')}>
                <SelectField
                  value={str(get('backgroundPosition')) === '' ? 'center' : str(get('backgroundPosition'))}
                  onChange={(v) => patch({ backgroundPosition: v })}
                  options={[
                    { value: 'center', label: 'Center' },
                    { value: 'top', label: 'Top' },
                    { value: 'bottom', label: 'Bottom' },
                    { value: 'left', label: 'Left' },
                    { value: 'right', label: 'Right' },
                  ]}
                />
              </FieldRow>
            </div>
          </>
        )}
      </Group>

      {/* BORDER */}
      <Group title="Border" defaultOpen={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <FieldRow label="Style" {...row('borderStyle')}>
            <SelectField
              value={str(get('borderStyle'))}
              onChange={(v) => patch({ borderStyle: v === '' ? undefined : (v as WidgetStyle['borderStyle']) })}
              options={[
                { value: '', label: 'None' },
                { value: 'solid', label: 'Solid' },
                { value: 'dashed', label: 'Dashed' },
                { value: 'dotted', label: 'Dotted' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Width" {...row('borderWidth')}>
            <UnitField
              value={get('borderWidth')}
              units={['px', 'rem']}
              placeholder="1"
              onChange={(v) => patch({ borderWidth: v })}
            />
          </FieldRow>
        </div>
        <FieldRow label="Border Colour" {...row('borderColor')}>
          <ColorField
            value={get('borderColor')}
            fallback="#333333"
            onChange={(v) => patch({ borderColor: v })}
          />
        </FieldRow>
        <FieldRow label="Corner Radius" {...row('borderRadius')}>
          <UnitField
            value={get('borderRadius')}
            units={['px', 'rem', '%']}
            placeholder="8"
            onChange={(v) => patch({ borderRadius: v })}
          />
        </FieldRow>
      </Group>

      {/* SPACING */}
      <Group title="Spacing" defaultOpen>
        <FieldRow label="Padding" {...row('padding')}>
          <SpacingField
            value={get('padding')}
            units={['px', 'rem', 'em', '%']}
            onChange={(v) => setSpacing('padding', v)}
          />
        </FieldRow>
        <FieldRow label="Margin" {...row('margin')}>
          <SpacingField
            value={get('margin')}
            units={['px', 'rem', 'em', '%', 'auto']}
            onChange={(v) => setSpacing('margin', v)}
          />
        </FieldRow>
      </Group>

      {/* SIZE */}
      <Group title="Size" defaultOpen={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <FieldRow label="Width" {...row('width')}>
            <UnitField
              value={get('width')}
              units={['auto', 'px', '%', 'rem', 'vw']}
              placeholder="auto"
              onChange={(v) => patch({ width: v })}
            />
          </FieldRow>
          <FieldRow label="Max Width" {...row('maxWidth')}>
            <UnitField
              value={get('maxWidth')}
              units={['none', 'px', '%', 'rem', 'vw']}
              placeholder="none"
              onChange={(v) => patch({ maxWidth: v })}
            />
          </FieldRow>
          <FieldRow label="Height" {...row('height')}>
            <UnitField
              value={get('height')}
              units={['auto', 'px', '%', 'rem', 'vh']}
              placeholder="auto"
              onChange={(v) => patch({ height: v })}
            />
          </FieldRow>
          <FieldRow label="Min Height" {...row('minHeight')}>
            <UnitField
              value={get('minHeight')}
              units={['auto', 'px', '%', 'rem', 'vh']}
              placeholder="auto"
              onChange={(v) => patch({ minHeight: v })}
            />
          </FieldRow>
        </div>
      </Group>

      {/* LAYOUT */}
      <Group title="Layout" defaultOpen={false}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <FieldRow label="Display" {...row('display')}>
            <SelectField
              value={str(get('display'))}
              onChange={(v) => patch({ display: v === '' ? undefined : (v as WidgetStyle['display']) })}
              options={[
                { value: '', label: 'Default' },
                { value: 'block', label: 'Block' },
                { value: 'inline-block', label: 'Inline' },
                { value: 'flex', label: 'Flex' },
                { value: 'grid', label: 'Grid' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Direction" {...row('flexDirection')}>
            <SelectField
              value={str(get('flexDirection'))}
              onChange={(v) => patch({ flexDirection: v === '' ? undefined : (v as WidgetStyle['flexDirection']) })}
              options={[
                { value: '', label: 'Default' },
                { value: 'row', label: 'Row' },
                { value: 'column', label: 'Column' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Justify" {...row('justifyContent')}>
            <SelectField
              value={str(get('justifyContent'))}
              onChange={(v) => patch({ justifyContent: v === '' ? undefined : (v as WidgetStyle['justifyContent']) })}
              options={[
                { value: '', label: 'Default' },
                { value: 'flex-start', label: 'Start' },
                { value: 'center', label: 'Center' },
                { value: 'flex-end', label: 'End' },
                { value: 'space-between', label: 'Between' },
                { value: 'space-around', label: 'Around' },
              ]}
            />
          </FieldRow>
          <FieldRow label="Align" {...row('alignItems')}>
            <SelectField
              value={str(get('alignItems'))}
              onChange={(v) => patch({ alignItems: v === '' ? undefined : (v as WidgetStyle['alignItems']) })}
              options={[
                { value: '', label: 'Default' },
                { value: 'flex-start', label: 'Start' },
                { value: 'center', label: 'Center' },
                { value: 'flex-end', label: 'End' },
                { value: 'stretch', label: 'Stretch' },
              ]}
            />
          </FieldRow>
        </div>
      </Group>

      {/* EFFECTS */}
      <Group title="Effects" defaultOpen={false}>
        <FieldRow label="Shadow" {...row('boxShadow')}>
          <TextField
            value={str(get('boxShadow'))}
            placeholder="0 4px 12px rgba(0,0,0,0.3)"
            mono
            onChange={(v) => patch({ boxShadow: v })}
          />
        </FieldRow>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
          <FieldRow label="Opacity" {...row('opacity')}>
            <NumberField
              value={get('opacity')}
              min={0}
              max={1}
              step={0.1}
              onChange={(v) => patch({ opacity: v })}
            />
          </FieldRow>
          <FieldRow label="Transform" {...row('transform')}>
            <TextField
              value={str(get('transform'))}
              placeholder="none"
              mono
              onChange={(v) => patch({ transform: v })}
            />
          </FieldRow>
        </div>
      </Group>
    </div>
  );
}

// ===========================================================================
// Section Style Editor
// ===========================================================================

interface SectionStyleEditorProps {
  section: PageSection;
  breakpoint: Breakpoint;
  onUpdate: (updates: Partial<PageSection>) => void;
}

function SectionStyleEditor({ section, breakpoint, onUpdate }: SectionStyleEditorProps) {
  const updateSpacing = (type: 'padding' | 'margin', value: Spacing) => {
    if (type === 'padding') {
      onUpdate({ padding: value });
    } else {
      onUpdate({ margin: value });
    }
  };

  return (
    <div>
      {breakpoint !== 'desktop' && (
        <div
          style={{
            fontSize: '0.7rem',
            color: 'rgba(255,255,255,0.55)',
            background: 'rgba(99,102,241,0.12)',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '6px',
            padding: '0.5rem 0.6rem',
            marginBottom: '1rem',
            lineHeight: 1.4,
          }}
        >
          Section styles apply to all devices. Use a widget&apos;s Style tab for
          per-device overrides.
        </div>
      )}

      <Group title="Background" defaultOpen>
        <FieldRow label="Background Colour">
          <ColorField
            value={section.backgroundColor}
            fallback="#000000"
            onChange={(v) => onUpdate({ backgroundColor: v ?? '' })}
          />
        </FieldRow>
        <ImageField
          label="Background Image"
          value={section.backgroundImage ?? ''}
          onChange={(url) => onUpdate({ backgroundImage: url })}
        />
      </Group>

      <Group title="Spacing" defaultOpen>
        <FieldRow label="Padding">
          <SpacingField
            value={section.padding}
            units={['px', 'rem', 'em', '%']}
            onChange={(v) => updateSpacing('padding', v)}
          />
        </FieldRow>
        <FieldRow label="Margin">
          <SpacingField
            value={section.margin}
            units={['px', 'rem', 'em', '%', 'auto']}
            onChange={(v) => updateSpacing('margin', v)}
          />
        </FieldRow>
      </Group>
    </div>
  );
}

// ===========================================================================
// Breakpoint banner
// ===========================================================================

function BreakpointBanner({ breakpoint }: { breakpoint: Breakpoint }) {
  const isBase = breakpoint === 'desktop';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        background: isBase ? 'rgba(255,255,255,0.05)' : 'rgba(99,102,241,0.14)',
        border: `1px solid ${isBase ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.4)'}`,
        borderRadius: '8px',
        padding: '0.55rem 0.7rem',
        marginBottom: '1rem',
      }}
    >
      <span style={{ fontSize: '1rem', lineHeight: 1 }}>
        {breakpoint === 'desktop' ? '🖥️' : breakpoint === 'tablet' ? '📱' : '📱'}
      </span>
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#ffffff' }}>
          Editing {BREAKPOINT_LABEL[breakpoint]}
        </div>
        <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.55)' }}>
          {isBase
            ? 'Base styles — apply to every device'
            : `Overrides the desktop base on ${BREAKPOINT_LABEL[breakpoint].toLowerCase()}`}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function formatLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

/** Wrap a bare image URL into a CSS `url("…")` value (widget renderer applies it raw). */
function wrapCssUrl(url: string): string {
  return `url("${url}")`;
}

/** Extract the bare URL from a CSS `url("…")` value for editing. */
function unwrapCssUrl(value: string | undefined): string {
  if (value === undefined || value === '') {
    return '';
  }
  const match = value.match(/^url\(["']?(.*?)["']?\)$/);
  if (match) {
    return match[1] ?? '';
  }
  return value.startsWith('linear-gradient') ? '' : value;
}
