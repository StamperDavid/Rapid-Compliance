/**
 * Style Controls
 * Reusable, dark-themed form primitives for the website-builder Properties
 * panel's Style tab. These are deliberately styled to match the builder's own
 * dark editor chrome (not the light dashboard design system) so the panel reads
 * as one coherent surface, the same way Elementor's Style tab does.
 */

'use client';

import { useState } from 'react';
import type { GradientStops } from '@/types/website';
import { FontPicker } from './FontPicker';
import { useGlobalStyles } from './GlobalStylesContext';
import {
  globalColorRef,
  globalFontRef,
  isGlobalColorRef,
  isGlobalFontRef,
  refTokenId,
} from '@/lib/website-builder/global-styles';

// ---------------------------------------------------------------------------
// Shared dark-theme style tokens (single source for the panel)
// ---------------------------------------------------------------------------

export const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.55)',
  marginBottom: '0.3rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.45rem 0.5rem',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
  fontSize: '0.8rem',
  background: 'rgba(255,255,255,0.05)',
  color: '#ffffff',
  outline: 'none',
};

export const smallInputStyle: React.CSSProperties = {
  ...inputStyle,
  padding: '0.35rem 0.5rem',
  fontSize: '0.75rem',
};

export const colorPickerStyle: React.CSSProperties = {
  width: '30px',
  height: '30px',
  minWidth: '30px',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
  cursor: 'pointer',
  padding: 0,
  background: 'transparent',
};

export const sectionHeadingStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.45)',
  margin: 0,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const ACCENT = '#6366f1';

// ---------------------------------------------------------------------------
// Group — collapsible labelled section
// ---------------------------------------------------------------------------

interface GroupProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function Group({ title, defaultOpen = true, children }: GroupProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        paddingBottom: open ? '1rem' : 0,
        marginBottom: '0.5rem',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: '0.85rem 0',
        }}
      >
        <span style={sectionHeadingStyle}>{title}</span>
        <span
          style={{
            fontSize: '0.6rem',
            color: 'rgba(255,255,255,0.4)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.15s',
          }}
        >
          &#x25BC;
        </span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FieldRow — label + per-breakpoint override indicator + reset
// ---------------------------------------------------------------------------

interface FieldRowProps {
  label: string;
  /** True when this control's value is overridden on the active (non-desktop) breakpoint. */
  overridden?: boolean;
  /** Provided only on non-desktop breakpoints — resets the override to inherit desktop. */
  onReset?: () => void;
  children: React.ReactNode;
}

export function FieldRow({ label, overridden, onReset, children }: FieldRowProps) {
  return (
    <div style={{ marginBottom: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
        <label style={{ ...labelStyle, marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          {overridden && (
            <span
              title="Overridden on this device"
              style={{ width: '6px', height: '6px', borderRadius: '50%', background: ACCENT, display: 'inline-block' }}
            />
          )}
          {label}
        </label>
        {overridden && onReset && (
          <button
            type="button"
            onClick={onReset}
            title="Reset to desktop value"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.45)',
              cursor: 'pointer',
              fontSize: '0.7rem',
              padding: '0 0.15rem',
              lineHeight: 1,
            }}
          >
            &#x21BA; reset
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SegmentedControl — Elementor-style pill toggle
// ---------------------------------------------------------------------------

interface SegmentOption<T extends string> {
  value: T;
  label: string;
  title?: string;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
}

export function SegmentedControl<T extends string>({ value, options, onChange }: SegmentedControlProps<T>) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, 1fr)`,
        gap: '2px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '6px',
        padding: '2px',
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            title={opt.title ?? opt.label}
            onClick={() => onChange(opt.value)}
            style={{
              padding: '0.35rem 0.25rem',
              fontSize: '0.72rem',
              fontWeight: 500,
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              background: active ? ACCENT : 'transparent',
              color: active ? '#ffffff' : 'rgba(255,255,255,0.55)',
              transition: 'background 0.12s',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SelectField
// ---------------------------------------------------------------------------

interface SelectFieldProps {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

export function SelectField({ value, options, onChange }: SelectFieldProps) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// FontField — Google-Fonts picker bound to a WidgetStyle.fontFamily value
// ---------------------------------------------------------------------------

interface FontFieldProps {
  value?: string;
  /** Emits the bare family name, or undefined when cleared to "Default". */
  onChange: (value: string | undefined) => void;
}

/**
 * The per-widget typography font control. Wraps {@link FontPicker} and adapts its
 * `(family: string)` callback to the `string | undefined` patch contract the Style
 * tab uses elsewhere (an empty selection clears the override back to the default).
 *
 * When a {@link useGlobalStyles} provider exposes brand fonts, a "Brand fonts" quick-pick
 * row is rendered above the picker. Picking one stores a CSS-var reference
 * (`var(--gf-<id>)`) so the widget tracks later brand edits automatically. Selecting a
 * catalog font from the picker switches the field back to that raw family. Outside the
 * editor (no provider) the control renders exactly as the plain Google-Fonts picker.
 */
export function FontField({ value, onChange }: FontFieldProps) {
  const tokens = useGlobalStyles();
  const brandFonts = tokens?.fonts ?? [];
  const isBrand = isGlobalFontRef(value);
  const activeTokenId = isBrand ? refTokenId(value) : null;
  const activeToken =
    activeTokenId !== null ? brandFonts.find((f) => f.id === activeTokenId) : undefined;

  // No provider / no brand fonts → render exactly the plain picker (unchanged behaviour).
  if (brandFonts.length === 0) {
    return <FontPicker value={value} onChange={(family) => onChange(family === '' ? undefined : family)} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div>
        <span style={{ ...labelStyle, fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>
          Brand fonts
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
          {brandFonts.map((token) => {
            const active = activeTokenId === token.id;
            return (
              <button
                key={token.id}
                type="button"
                title={token.name}
                onClick={() => onChange(globalFontRef(token.id))}
                style={{
                  padding: '0.3rem 0.55rem',
                  fontSize: '0.72rem',
                  fontFamily: token.family,
                  borderRadius: '5px',
                  border: active ? `1px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.15)',
                  background: active ? 'rgba(99,102,241,0.20)' : 'rgba(255,255,255,0.05)',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {token.name}
              </button>
            );
          })}
        </div>
      </div>
      {isBrand && (
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}>
          Using brand font:{' '}
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{activeToken?.name ?? 'Brand font'}</span>
          {' · '}
          <button
            type="button"
            onClick={() => onChange(undefined)}
            style={{
              background: 'transparent',
              border: 'none',
              color: ACCENT,
              cursor: 'pointer',
              fontSize: '0.68rem',
              padding: 0,
            }}
          >
            use a custom font
          </button>
        </div>
      )}
      {/* When a brand ref is active, show "Default" in the picker (not the raw var) and let
          any catalog pick switch the field back to a raw family. */}
      <FontPicker
        value={isBrand ? '' : value}
        onChange={(family) => onChange(family === '' ? undefined : family)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// TextField — plain text (e.g. box-shadow, transform)
// ---------------------------------------------------------------------------

interface TextFieldProps {
  value: string;
  placeholder?: string;
  onChange: (value: string | undefined) => void;
  mono?: boolean;
}

export function TextField({ value, placeholder, onChange, mono }: TextFieldProps) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
      style={{ ...inputStyle, fontFamily: mono === true ? 'monospace' : 'inherit' }}
    />
  );
}

// ---------------------------------------------------------------------------
// ColorField — swatch + hex/keyword text
// ---------------------------------------------------------------------------

interface ColorFieldProps {
  value?: string;
  placeholder?: string;
  /** Swatch fallback colour when no value is set. */
  fallback?: string;
  onChange: (value: string | undefined) => void;
}

export function ColorField({ value, placeholder, fallback = '#000000', onChange }: ColorFieldProps) {
  const tokens = useGlobalStyles();
  const brandColors = tokens?.colors ?? [];
  const isBrand = isGlobalColorRef(value);
  const activeTokenId = isBrand ? refTokenId(value) : null;
  const activeToken =
    activeTokenId !== null ? brandColors.find((c) => c.id === activeTokenId) : undefined;

  // Swatch preview: a brand ref resolves to its token's colour; a raw hex shows itself;
  // anything else (keyword / gradient var) falls back. The native <input type="color">
  // always needs a real hex, so a click there emits a hex → switches to a custom colour.
  const swatch =
    activeToken !== undefined
      ? activeToken.value
      : value !== undefined && value !== '' && value.startsWith('#')
        ? value
        : fallback;

  const customRow = (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <input
        type="color"
        value={swatch.startsWith('#') ? swatch : fallback}
        onChange={(e) => onChange(e.target.value)}
        style={colorPickerStyle}
        aria-label="Pick colour"
      />
      <input
        type="text"
        value={value ?? ''}
        placeholder={placeholder ?? 'transparent'}
        onChange={(e) => onChange(e.target.value === '' ? undefined : e.target.value)}
        style={{ ...smallInputStyle, flex: 1, fontFamily: 'monospace' }}
      />
    </div>
  );

  // No provider / no brand colours → render exactly the original control (unchanged).
  if (brandColors.length === 0) {
    return customRow;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <div>
        <span style={{ ...labelStyle, fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)' }}>
          Brand colors
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
          {brandColors.map((token) => {
            const active = activeTokenId === token.id;
            return (
              <button
                key={token.id}
                type="button"
                title={token.name}
                aria-label={token.name}
                aria-pressed={active}
                onClick={() => onChange(globalColorRef(token.id))}
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '50%',
                  background: token.value,
                  border: active ? `2px solid ${ACCENT}` : '1px solid rgba(255,255,255,0.25)',
                  boxShadow: active ? '0 0 0 2px rgba(99,102,241,0.35)' : 'none',
                  cursor: 'pointer',
                  padding: 0,
                  flexShrink: 0,
                }}
              />
            );
          })}
        </div>
      </div>
      {isBrand && (
        <div style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.5)' }}>
          Using brand color:{' '}
          <span style={{ color: '#ffffff', fontWeight: 600 }}>{activeToken?.name ?? 'Brand color'}</span>
          {' · '}
          <button
            type="button"
            onClick={() => onChange(undefined)}
            style={{
              background: 'transparent',
              border: 'none',
              color: ACCENT,
              cursor: 'pointer',
              fontSize: '0.68rem',
              padding: 0,
            }}
          >
            use a custom color
          </button>
        </div>
      )}
      {customRow}
    </div>
  );
}

// ---------------------------------------------------------------------------
// UnitField — number + unit (px / rem / % / auto …)
// ---------------------------------------------------------------------------

const KEYWORD_UNITS = new Set(['auto', 'none', 'normal']);

function unitLabel(u: string): string {
  if (u === '') {
    return '—';
  }
  return u;
}

function splitUnit(value: string | undefined, units: string[]): { num: string; unit: string } {
  const first = units[0] ?? 'px';
  if (value === undefined || value === '') {
    return { num: '', unit: first };
  }
  const keyword = units.find((u) => u === value && KEYWORD_UNITS.has(u));
  if (keyword !== undefined) {
    return { num: '', unit: keyword };
  }
  const match = value.match(/^(-?\d*\.?\d+)\s*([a-z%]*)$/i);
  if (match) {
    const parsedUnit = match[2];
    const numericUnits = units.filter((u) => !KEYWORD_UNITS.has(u));
    const unit = numericUnits.includes(parsedUnit) ? parsedUnit : (numericUnits[0] ?? '');
    return { num: match[1] ?? '', unit };
  }
  return { num: '', unit: first };
}

interface UnitFieldProps {
  value?: string;
  units: string[];
  placeholder?: string;
  onChange: (value: string | undefined) => void;
}

export function UnitField({ value, units, placeholder, onChange }: UnitFieldProps) {
  const { num, unit } = splitUnit(value, units);
  const isKeyword = KEYWORD_UNITS.has(unit);

  const emit = (nextNum: string, nextUnit: string) => {
    if (KEYWORD_UNITS.has(nextUnit)) {
      onChange(nextUnit);
      return;
    }
    if (nextNum === '') {
      onChange(undefined);
      return;
    }
    onChange(`${nextNum}${nextUnit}`);
  };

  return (
    <div style={{ display: 'flex', gap: '0.35rem' }}>
      <input
        type="number"
        value={isKeyword ? '' : num}
        placeholder={placeholder ?? 'auto'}
        disabled={isKeyword}
        onChange={(e) => emit(e.target.value, unit)}
        style={{ ...smallInputStyle, flex: 1, opacity: isKeyword ? 0.5 : 1 }}
      />
      <select
        value={unit}
        onChange={(e) => emit(num, e.target.value)}
        style={{ ...smallInputStyle, width: '4.5rem', flexShrink: 0 }}
        aria-label="Unit"
      >
        {units.map((u) => (
          <option key={u === '' ? '_unitless' : u} value={u}>
            {unitLabel(u)}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NumberField — bare number (e.g. opacity 0–1)
// ---------------------------------------------------------------------------

interface NumberFieldProps {
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number | undefined) => void;
}

export function NumberField({ value, min, max, step, onChange }: NumberFieldProps) {
  return (
    <input
      type="number"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
      style={smallInputStyle}
    />
  );
}

// ---------------------------------------------------------------------------
// SpacingField — 4-side box (top/right/bottom/left) with optional link
// ---------------------------------------------------------------------------

export interface SpacingValue {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

interface SpacingFieldProps {
  value?: SpacingValue;
  units: string[];
  onChange: (value: SpacingValue) => void;
}

const SIDES: Array<keyof SpacingValue> = ['top', 'right', 'bottom', 'left'];

export function SpacingField({ value, units, onChange }: SpacingFieldProps) {
  const current = value ?? {};
  const allEqual =
    current.top === current.right && current.right === current.bottom && current.bottom === current.left;
  const [linked, setLinked] = useState(allEqual);

  const setSide = (side: keyof SpacingValue, next: string | undefined) => {
    if (linked) {
      onChange({ top: next, right: next, bottom: next, left: next });
    } else {
      onChange({ ...current, [side]: next });
    }
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '0.35rem' }}>
        {SIDES.map((side) => (
          <div key={side}>
            <UnitField
              value={current[side]}
              units={units}
              placeholder={side[0]?.toUpperCase()}
              onChange={(v) => setSide(side, v)}
            />
            <div
              style={{
                fontSize: '0.6rem',
                color: 'rgba(255,255,255,0.35)',
                textAlign: 'center',
                marginTop: '0.2rem',
                textTransform: 'capitalize',
              }}
            >
              {side}
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setLinked((v) => !v)}
        style={{
          marginTop: '0.4rem',
          background: 'transparent',
          border: 'none',
          color: linked ? ACCENT : 'rgba(255,255,255,0.45)',
          cursor: 'pointer',
          fontSize: '0.68rem',
          padding: 0,
        }}
      >
        {linked ? '🔗 Linked (edit all sides together)' : '⛓️‍💥 Unlinked (edit sides separately)'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GradientField — structured GradientStops editor with live preview
// ---------------------------------------------------------------------------

export const DEFAULT_GRADIENT: GradientStops = { from: '#a855f7', to: '#6366f1', angle: 90 };

function gradientCss(g: GradientStops): string {
  const angle = typeof g.angle === 'number' ? g.angle : 90;
  const stops = g.via !== undefined && g.via !== '' ? `${g.from}, ${g.via}, ${g.to}` : `${g.from}, ${g.to}`;
  return `linear-gradient(${angle}deg, ${stops})`;
}

interface GradientFieldProps {
  value?: GradientStops;
  onChange: (value: GradientStops) => void;
}

export function GradientField({ value, onChange }: GradientFieldProps) {
  const g = value ?? DEFAULT_GRADIENT;
  const angle = typeof g.angle === 'number' ? g.angle : 90;
  const hasVia = g.via !== undefined && g.via !== '';

  const patch = (next: Partial<GradientStops>) => onChange({ ...g, ...next });

  return (
    <div>
      <div
        style={{
          height: '32px',
          borderRadius: '6px',
          marginBottom: '0.6rem',
          background: gradientCss(g),
          border: '1px solid rgba(255,255,255,0.12)',
        }}
      />
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ ...labelStyle, fontSize: '0.65rem' }}>From</span>
        <ColorField value={g.from} fallback="#a855f7" onChange={(v) => patch({ from: v ?? '#000000' })} />
      </div>
      {hasVia && (
        <div style={{ marginBottom: '0.5rem' }}>
          <span style={{ ...labelStyle, fontSize: '0.65rem' }}>Middle</span>
          <ColorField value={g.via} fallback="#ec4899" onChange={(v) => patch({ via: v ?? '' })} />
        </div>
      )}
      <div style={{ marginBottom: '0.5rem' }}>
        <span style={{ ...labelStyle, fontSize: '0.65rem' }}>To</span>
        <ColorField value={g.to} fallback="#6366f1" onChange={(v) => patch({ to: v ?? '#000000' })} />
      </div>
      <button
        type="button"
        onClick={() => patch({ via: hasVia ? undefined : '#ec4899' })}
        style={{
          background: 'transparent',
          border: 'none',
          color: ACCENT,
          cursor: 'pointer',
          fontSize: '0.68rem',
          padding: 0,
          marginBottom: '0.6rem',
        }}
      >
        {hasVia ? '− Remove middle colour' : '+ Add middle colour'}
      </button>
      <div>
        <span style={{ ...labelStyle, fontSize: '0.65rem' }}>Angle: {angle}&deg;</span>
        <input
          type="range"
          min={0}
          max={360}
          value={angle}
          onChange={(e) => patch({ angle: parseInt(e.target.value, 10) })}
          style={{ width: '100%', accentColor: ACCENT }}
        />
      </div>
    </div>
  );
}
