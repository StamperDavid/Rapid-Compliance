/**
 * ShapeDividerControl
 * -------------------
 * Standalone, dark-themed editor control for a single section shape divider
 * (top OR bottom). Renders a tile grid of the 13 built-in shapes plus a "None"
 * tile, then colour / height / width inputs and flip / invert / front toggles.
 *
 * Every interaction calls `onChange` with the FULL updated `ShapeDivider` so the
 * caller can persist it onto `section.shapeDividerTop` / `shapeDividerBottom`.
 * The editor wires this into the section panel — this file only exports it.
 *
 * Styling matches the builder's own dark chrome (Elementor-style Style tab), not
 * the light dashboard design system, so it reads as one coherent surface.
 */

'use client';

import { FlipHorizontal, FlipVertical, Layers } from 'lucide-react';
import type { ShapeDivider, ShapeDividerType } from '@/types/website';
import { SHAPE_DIVIDERS, SHAPE_DIVIDER_TYPES } from '@/lib/website-builder/shape-divider-catalog';

const ACCENT = '#6366f1';

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.7rem',
  fontWeight: 600,
  color: 'rgba(255,255,255,0.55)',
  marginBottom: '0.35rem',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.4rem 0.5rem',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
  fontSize: '0.8rem',
  background: 'rgba(255,255,255,0.05)',
  color: '#ffffff',
  outline: 'none',
};

const DEFAULT_DIVIDER: ShapeDivider = {
  type: 'none',
  color: '#6366f1',
  height: 100,
  width: 100,
  flip: false,
  invert: false,
  front: false,
};

/** A single shape preview drawn from catalog path data. */
function ShapePreview({ type, fill }: { type: Exclude<ShapeDividerType, 'none'>; fill: string }) {
  const shape = SHAPE_DIVIDERS[type];
  return (
    <svg
      viewBox={shape.viewBox}
      preserveAspectRatio={shape.preserveAspectRatio ?? 'none'}
      width="100%"
      height="26"
      style={{ display: 'block' }}
      aria-hidden="true"
    >
      {(shape.paths ?? []).map((d, idx) => (
        <path key={idx} d={d} fill={fill} fillOpacity={0.5} />
      ))}
      <path d={shape.path} fill={fill} />
    </svg>
  );
}

interface TileProps {
  selected: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}

function Tile({ selected, onClick, title, children }: TileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '38px',
        padding: '0.25rem',
        borderRadius: '6px',
        cursor: 'pointer',
        background: selected ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${selected ? ACCENT : 'rgba(255,255,255,0.12)'}`,
        overflow: 'hidden',
      }}
    >
      {children}
    </button>
  );
}

interface ToggleProps {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}

function Toggle({ active, onClick, label, icon }: ToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.3rem',
        padding: '0.4rem 0.3rem',
        fontSize: '0.7rem',
        fontWeight: 600,
        borderRadius: '6px',
        cursor: 'pointer',
        background: active ? 'rgba(99,102,241,0.18)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? ACCENT : 'rgba(255,255,255,0.12)'}`,
        color: active ? '#ffffff' : 'rgba(255,255,255,0.6)',
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function ShapeDividerControl(props: {
  value?: ShapeDivider;
  position: 'top' | 'bottom';
  onChange: (next: ShapeDivider) => void;
}): React.JSX.Element {
  const { value, position, onChange } = props;
  const current: ShapeDivider = { ...DEFAULT_DIVIDER, ...(value ?? {}) };

  const update = (patch: Partial<ShapeDivider>): void => {
    onChange({ ...current, ...patch });
  };

  const fill = current.color && current.color.trim() !== '' ? current.color : ACCENT;
  const hasShape = current.type !== 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Shape picker grid */}
      <div>
        <span style={labelStyle}>{position === 'top' ? 'Top' : 'Bottom'} divider shape</span>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.4rem' }}>
          <Tile selected={!hasShape} onClick={() => update({ type: 'none' })} title="None">
            <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.55)' }}>None</span>
          </Tile>
          {SHAPE_DIVIDER_TYPES.map((type) => (
            <Tile
              key={type}
              selected={current.type === type}
              onClick={() => update({ type })}
              title={SHAPE_DIVIDERS[type].label}
            >
              <ShapePreview type={type} fill={current.type === type ? fill : 'rgba(255,255,255,0.6)'} />
            </Tile>
          ))}
        </div>
      </div>

      {/* The remaining controls only matter once a real shape is chosen. */}
      {hasShape && (
        <>
          {/* Colour */}
          <div>
            <span style={labelStyle}>Color</span>
            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <input
                type="color"
                value={/^#[0-9a-fA-F]{6}$/.test(fill) ? fill : ACCENT}
                onChange={(e) => update({ color: e.target.value })}
                style={{
                  width: '32px',
                  height: '32px',
                  minWidth: '32px',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  padding: 0,
                  background: 'transparent',
                }}
              />
              <input
                type="text"
                value={current.color ?? ''}
                placeholder="#6366f1 or var(--token)"
                onChange={(e) => update({ color: e.target.value })}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Height (px) */}
          <div>
            <span style={labelStyle}>Height — {current.height ?? 100}px</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="range"
                min={20}
                max={400}
                step={2}
                value={current.height ?? 100}
                onChange={(e) => update({ height: Number(e.target.value) })}
                style={{ flex: 1, accentColor: ACCENT }}
              />
              <input
                type="number"
                min={20}
                max={400}
                value={current.height ?? 100}
                onChange={(e) => update({ height: Number(e.target.value) })}
                style={{ ...inputStyle, width: '64px' }}
              />
            </div>
          </div>

          {/* Width (%) */}
          <div>
            <span style={labelStyle}>Width — {current.width ?? 100}%</span>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input
                type="range"
                min={100}
                max={300}
                step={5}
                value={current.width ?? 100}
                onChange={(e) => update({ width: Number(e.target.value) })}
                style={{ flex: 1, accentColor: ACCENT }}
              />
              <input
                type="number"
                min={100}
                max={300}
                value={current.width ?? 100}
                onChange={(e) => update({ width: Math.max(100, Number(e.target.value)) })}
                style={{ ...inputStyle, width: '64px' }}
              />
            </div>
          </div>

          {/* Flip / Invert / Front */}
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <Toggle
              active={current.flip === true}
              onClick={() => update({ flip: !current.flip })}
              label="Flip"
              icon={<FlipHorizontal size={13} />}
            />
            <Toggle
              active={current.invert === true}
              onClick={() => update({ invert: !current.invert })}
              label="Invert"
              icon={<FlipVertical size={13} />}
            />
            <Toggle
              active={current.front === true}
              onClick={() => update({ front: !current.front })}
              label="Front"
              icon={<Layers size={13} />}
            />
          </div>
        </>
      )}
    </div>
  );
}
