/**
 * Section Structure Picker
 *
 * Elementor-style "Select your structure" chooser. Presents a grid of clickable
 * mini-diagrams — equal splits for 1..6 columns plus a few common asymmetric
 * layouts — and calls `onPick(columnCount, widths?)` when a tile is chosen.
 *
 * Editor-side only and purely presentational: it owns no page state. The editor
 * turns the pick into a real section via `buildSection` + `insertSection`
 * (`page-tree-ops`). Dark editor idiom to match PropertiesPanel / ChromeEditor.
 */

'use client';

interface StructureOption {
  label: string;
  /** Column count to build. */
  columnCount: number;
  /**
   * Explicit per-column widths. Omitted for an even split (the builder fills in
   * the default even widths for that count).
   */
  widths?: number[];
  /** Relative column weights used purely to draw the mini-diagram. */
  diagram: number[];
}

// Equal splits 1..6, then a handful of common asymmetric layouts.
const EQUAL_OPTIONS: StructureOption[] = [1, 2, 3, 4, 5, 6].map((n) => ({
  label: n === 1 ? '1 Column' : `${n} Columns`,
  columnCount: n,
  diagram: Array.from({ length: n }, () => 1),
}));

const ASYMMETRIC_OPTIONS: StructureOption[] = [
  { label: '70 / 30', columnCount: 2, widths: [70, 30], diagram: [70, 30] },
  { label: '30 / 70', columnCount: 2, widths: [30, 70], diagram: [30, 70] },
  { label: '25 / 50 / 25', columnCount: 3, widths: [25, 50, 25], diagram: [25, 50, 25] },
];

interface SectionStructurePickerProps {
  onPick: (columnCount: number, widths?: number[]) => void;
  onClose?: () => void;
}

export default function SectionStructurePicker({ onPick, onClose }: SectionStructurePickerProps) {
  return (
    <div
      style={{
        width: '320px',
        background: '#0a0a0a',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '12px',
        boxShadow: '0 18px 50px rgba(0,0,0,0.55)',
        padding: '0.9rem',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '0.75rem',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#ffffff',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Select your structure
        </h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            title="Close"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255,255,255,0.5)',
              cursor: 'pointer',
              fontSize: '1.1rem',
              lineHeight: 1,
              padding: '0.1rem 0.3rem',
            }}
          >
            &times;
          </button>
        )}
      </div>

      <StructureGrid
        options={EQUAL_OPTIONS}
        onPick={(opt) => onPick(opt.columnCount, opt.widths)}
      />

      <div
        style={{
          fontSize: '0.66rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          margin: '0.85rem 0 0.5rem',
        }}
      >
        Common splits
      </div>

      <StructureGrid
        options={ASYMMETRIC_OPTIONS}
        onPick={(opt) => onPick(opt.columnCount, opt.widths)}
      />
    </div>
  );
}

function StructureGrid({
  options,
  onPick,
}: {
  options: StructureOption[];
  onPick: (option: StructureOption) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '0.5rem',
      }}
    >
      {options.map((option) => (
        <StructureTile key={option.label} option={option} onClick={() => onPick(option)} />
      ))}
    </div>
  );
}

function StructureTile({ option, onClick }: { option: StructureOption; onClick: () => void }) {
  const total = option.diagram.reduce((sum, w) => sum + w, 0) || 1;
  return (
    <button
      type="button"
      onClick={onClick}
      title={option.label}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.4rem',
        padding: '0.6rem 0.45rem',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: '8px',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = '#6366f1';
        e.currentTarget.style.background = 'rgba(99,102,241,0.12)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
      }}
    >
      {/* Mini-diagram of the column layout */}
      <span
        style={{
          display: 'flex',
          gap: '3px',
          width: '100%',
          height: '34px',
        }}
      >
        {option.diagram.map((weight, i) => (
          <span
            key={i}
            style={{
              flexGrow: weight,
              flexBasis: 0,
              minWidth: 0,
              background: 'rgba(99,102,241,0.55)',
              border: '1px solid rgba(99,102,241,0.85)',
              borderRadius: '3px',
              // Width share, shown as a tooltip-ish ratio on the diagram cell.
              opacity: 0.55 + 0.45 * (weight / total),
            }}
          />
        ))}
      </span>
      <span style={{ fontSize: '0.68rem', fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
        {option.label}
      </span>
    </button>
  );
}
