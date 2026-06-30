/**
 * Chrome Editor
 *
 * Right-hand editing panel for ONE selected region of the site chrome — the
 * early-access banner, the top nav/header, or the footer. It mirrors the
 * Properties panel's dark editor idiom (see {@link PropertiesPanel} /
 * {@link StyleControls}) so the builder reads as one coherent surface.
 *
 * EDITOR-SIDE ONLY. Every change is reported through `onChange(next)`; the host
 * page persists the result to a DRAFT store (browser localStorage today — see
 * `editor/page.tsx`). It never touches `PublicLayout` or the live public site.
 *
 * --- Contract this file is coded to (from `site-chrome-types.ts`) -----------
 * The shared `SiteChrome` shape this panel reads/writes is:
 *   SiteChrome {
 *     banner: { enabled: boolean; text: string; ctaLabel: string; ctaUrl: string }
 *     header: { logoUrl: string; links: ChromeLink[]; ctaLabel: string; ctaUrl: string }
 *     footer: { columns: { title: string; links: ChromeLink[] }[]; copyright: string }
 *   }
 *   ChromeLink { label: string; url: string }
 *   ChromeRegion = 'banner' | 'header' | 'footer'
 * If the shared type's field names differ, only the field reads below need to
 * align — the structure/UX is otherwise complete.
 */

'use client';

import type {
  SiteChrome,
  ChromeLink,
  ChromeRegion,
} from '@/lib/website-builder/site-chrome-types';
import { ImageField } from './ImageField';
import { Group, FieldRow, labelStyle, inputStyle, smallInputStyle } from './StyleControls';

interface ChromeEditorProps {
  chrome: SiteChrome;
  region: ChromeRegion;
  onChange: (next: SiteChrome) => void;
  onClose: () => void;
}

const REGION_TITLE: Record<ChromeRegion, string> = {
  banner: 'Top banner',
  header: 'Header & navigation',
  footer: 'Footer',
};

const REGION_HELP: Record<ChromeRegion, string> = {
  banner: 'The slim promo bar across the very top of every page.',
  header: 'Your logo, the menu links, and the call-to-action button.',
  footer: 'The link columns and copyright line at the bottom of every page.',
};

const ACCENT = '#6366f1';
const DANGER = '#ef4444';

// ---------------------------------------------------------------------------
// Small dark-theme buttons (match the builder chrome, not the dashboard theme)
// ---------------------------------------------------------------------------

const addButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem',
  marginTop: '0.5rem',
  background: 'rgba(99,102,241,0.12)',
  color: ACCENT,
  border: '1px solid rgba(99,102,241,0.35)',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 600,
};

const dangerButtonStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.55rem',
  background: 'rgba(239,68,68,0.12)',
  color: DANGER,
  border: '1px solid rgba(239,68,68,0.35)',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 600,
};

const iconButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: '24px',
  height: '24px',
  flexShrink: 0,
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(255,255,255,0.7)',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '5px',
  cursor: 'pointer',
  fontSize: '0.8rem',
  lineHeight: 1,
};

function PlainInput({
  value,
  placeholder,
  onChange,
  small,
}: {
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
  small?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      style={small === true ? smallInputStyle : inputStyle}
    />
  );
}

// ---------------------------------------------------------------------------
// Link list editor — add / edit (label + url) / remove / reorder
// ---------------------------------------------------------------------------

function LinkListEditor({
  links,
  onChange,
}: {
  links: ChromeLink[];
  onChange: (next: ChromeLink[]) => void;
}) {
  const patch = (index: number, next: Partial<ChromeLink>): void => {
    onChange(links.map((link, i) => (i === index ? { ...link, ...next } : link)));
  };
  const remove = (index: number): void => {
    onChange(links.filter((_, i) => i !== index));
  };
  const move = (index: number, direction: -1 | 1): void => {
    const target = index + direction;
    if (target < 0 || target >= links.length) {
      return;
    }
    const next = [...links];
    const moved = next[index];
    next[index] = next[target];
    next[target] = moved;
    onChange(next);
  };
  const add = (): void => {
    onChange([...links, { label: 'New link', url: '#' }]);
  };

  return (
    <div>
      {links.length === 0 && (
        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 0.5rem' }}>
          No links yet.
        </p>
      )}
      {links.map((link, index) => (
        <div
          key={index}
          style={{
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '0.55rem',
            marginBottom: '0.55rem',
            background: 'rgba(255,255,255,0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
            <span style={{ ...labelStyle, marginBottom: 0 }}>Link {index + 1}</span>
            <div style={{ display: 'flex', gap: '0.3rem' }}>
              <button
                type="button"
                onClick={() => move(index, -1)}
                disabled={index === 0}
                title="Move up"
                aria-label="Move link up"
                style={{ ...iconButtonStyle, opacity: index === 0 ? 0.35 : 1 }}
              >
                &#x2191;
              </button>
              <button
                type="button"
                onClick={() => move(index, 1)}
                disabled={index === links.length - 1}
                title="Move down"
                aria-label="Move link down"
                style={{ ...iconButtonStyle, opacity: index === links.length - 1 ? 0.35 : 1 }}
              >
                &#x2193;
              </button>
              <button
                type="button"
                onClick={() => remove(index)}
                title="Remove link"
                aria-label="Remove link"
                style={{ ...iconButtonStyle, color: DANGER }}
              >
                &times;
              </button>
            </div>
          </div>
          <div style={{ marginBottom: '0.4rem' }}>
            <PlainInput
              value={link.label}
              placeholder="Label (e.g. Pricing)"
              onChange={(next) => patch(index, { label: next })}
              small
            />
          </div>
          <PlainInput
            value={link.url}
            placeholder="Link address (e.g. /pricing)"
            onChange={(next) => patch(index, { url: next })}
            small
          />
        </div>
      ))}
      <button type="button" onClick={add} style={addButtonStyle}>
        + Add link
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Region editors
// ---------------------------------------------------------------------------

function BannerEditor({ chrome, onChange }: { chrome: SiteChrome; onChange: (next: SiteChrome) => void }) {
  const banner = chrome.banner;
  const patch = (next: Partial<SiteChrome['banner']>): void => {
    onChange({ ...chrome, banner: { ...banner, ...next } });
  };

  return (
    <>
      <Group title="Visibility">
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={banner.enabled}
            onChange={(e) => patch({ enabled: e.target.checked })}
            style={{ width: '16px', height: '16px', accentColor: ACCENT, cursor: 'pointer' }}
          />
          <span style={{ fontSize: '0.8rem', color: '#ffffff' }}>Show the top banner</span>
        </label>
      </Group>

      <Group title="Banner content">
        <FieldRow label="Message">
          <textarea
            value={banner.text}
            placeholder="Launching soon — reserve your spot."
            onChange={(e) => patch({ text: e.target.value })}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </FieldRow>
        <FieldRow label="Button label">
          <PlainInput value={banner.ctaLabel ?? ''} placeholder="Reserve my spot" onChange={(next) => patch({ ctaLabel: next })} />
        </FieldRow>
        <FieldRow label="Button link">
          <PlainInput value={banner.ctaUrl ?? ''} placeholder="/early-access" onChange={(next) => patch({ ctaUrl: next })} />
        </FieldRow>
      </Group>

      <div style={{ padding: '0.5rem 0 0' }}>
        <button type="button" onClick={() => patch({ enabled: false })} style={dangerButtonStyle}>
          Delete banner (hide it)
        </button>
        <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', margin: '0.4rem 0 0' }}>
          This hides the banner. Turn &ldquo;Show the top banner&rdquo; back on to bring it back.
        </p>
      </div>
    </>
  );
}

function HeaderEditor({ chrome, onChange }: { chrome: SiteChrome; onChange: (next: SiteChrome) => void }) {
  const header = chrome.header;
  const patch = (next: Partial<SiteChrome['header']>): void => {
    onChange({ ...chrome, header: { ...header, ...next } });
  };

  return (
    <>
      <Group title="Logo">
        <ImageField label="Logo image" value={header.logoUrl} onChange={(url) => patch({ logoUrl: url })} />
      </Group>

      <Group title="Menu links">
        <LinkListEditor links={header.links} onChange={(links) => patch({ links })} />
      </Group>

      <Group title="Call-to-action button">
        <FieldRow label="Button label">
          <PlainInput value={header.ctaLabel ?? ''} placeholder="Early Access" onChange={(next) => patch({ ctaLabel: next })} />
        </FieldRow>
        <FieldRow label="Button link">
          <PlainInput value={header.ctaUrl ?? ''} placeholder="/early-access" onChange={(next) => patch({ ctaUrl: next })} />
        </FieldRow>
      </Group>

      <div style={{ padding: '0.5rem 0 0' }}>
        <button
          type="button"
          onClick={() => patch({ logoUrl: '', links: [], ctaLabel: '', ctaUrl: '' })}
          style={dangerButtonStyle}
        >
          Clear header (remove logo, links &amp; button)
        </button>
        <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', margin: '0.4rem 0 0' }}>
          This empties the header. Add a logo or links again any time.
        </p>
      </div>
    </>
  );
}

function FooterEditor({ chrome, onChange }: { chrome: SiteChrome; onChange: (next: SiteChrome) => void }) {
  const footer = chrome.footer;
  const patch = (next: Partial<SiteChrome['footer']>): void => {
    onChange({ ...chrome, footer: { ...footer, ...next } });
  };

  const columns = footer.columns;
  const patchColumn = (index: number, next: Partial<SiteChrome['footer']['columns'][number]>): void => {
    patch({ columns: columns.map((col, i) => (i === index ? { ...col, ...next } : col)) });
  };
  const removeColumn = (index: number): void => {
    patch({ columns: columns.filter((_, i) => i !== index) });
  };
  const addColumn = (): void => {
    patch({ columns: [...columns, { title: 'New column', links: [] }] });
  };

  return (
    <>
      <Group title="Footer columns">
        {columns.length === 0 && (
          <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', margin: '0 0 0.5rem' }}>
            No columns yet.
          </p>
        )}
        {columns.map((column, index) => (
          <div
            key={index}
            style={{
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              padding: '0.6rem',
              marginBottom: '0.7rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.45rem' }}>
              <span style={{ ...labelStyle, marginBottom: 0 }}>Column {index + 1}</span>
              <button
                type="button"
                onClick={() => removeColumn(index)}
                title="Remove column"
                aria-label="Remove column"
                style={{ ...iconButtonStyle, color: DANGER }}
              >
                &times;
              </button>
            </div>
            <div style={{ marginBottom: '0.55rem' }}>
              <PlainInput
                value={column.title}
                placeholder="Column heading (e.g. Product)"
                onChange={(next) => patchColumn(index, { title: next })}
                small
              />
            </div>
            <LinkListEditor links={column.links} onChange={(links) => patchColumn(index, { links })} />
          </div>
        ))}
        <button type="button" onClick={addColumn} style={addButtonStyle}>
          + Add column
        </button>
      </Group>

      <Group title="Copyright line">
        <PlainInput
          value={footer.copyright}
          placeholder="© 2026 SalesVelocity.ai. All rights reserved."
          onChange={(next) => patch({ copyright: next })}
        />
      </Group>

      <div style={{ padding: '0.5rem 0 0' }}>
        <button type="button" onClick={() => patch({ columns: [], copyright: '' })} style={dangerButtonStyle}>
          Clear footer (remove all columns &amp; text)
        </button>
        <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', margin: '0.4rem 0 0' }}>
          This empties the footer. Add columns again any time.
        </p>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Panel shell
// ---------------------------------------------------------------------------

export default function ChromeEditor({ chrome, region, onChange, onClose }: ChromeEditorProps) {
  return (
    <div
      style={{
        width: '320px',
        background: '#0a0a0a',
        borderLeft: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Inter, system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: '0.5rem',
          padding: '1rem',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: '#ffffff' }}>
            {REGION_TITLE[region]}
          </h2>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>
            {REGION_HELP[region]}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Close"
          aria-label="Close chrome editor"
          style={{ ...iconButtonStyle, width: '28px', height: '28px', fontSize: '1rem' }}
        >
          &times;
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem 1rem 2rem' }}>
        {region === 'banner' && <BannerEditor chrome={chrome} onChange={onChange} />}
        {region === 'header' && <HeaderEditor chrome={chrome} onChange={onChange} />}
        {region === 'footer' && <FooterEditor chrome={chrome} onChange={onChange} />}

        <p
          style={{
            marginTop: '1.25rem',
            padding: '0.6rem 0.7rem',
            fontSize: '0.7rem',
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.5)',
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '8px',
          }}
        >
          These edits update your editor preview only. Your live site banner, menu and footer stay
          exactly as they are until publishing chrome is turned on.
        </p>
      </div>
    </div>
  );
}
