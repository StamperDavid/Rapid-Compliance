/**
 * Editable Canvas
 *
 * TRUE WYSIWYG editor surface. The page is drawn by the SAME engine the live
 * site uses (`ResponsiveRenderer`), so the canvas is pixel-identical to what
 * publishes — no separate editor renderer, no gray "<type> widget" placeholders.
 *
 * Editing affordances (hover outline, click-to-select, delete, add-widget) are
 * drawn as an absolutely-positioned overlay layer ON TOP of the faithful render.
 * Selection and clicks are captured via event delegation so widget links /
 * buttons / forms never navigate or submit while you are editing.
 */

'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Page, PageSection, Widget, WidgetType } from '@/types/website';
import { ResponsiveRenderer } from '@/components/website-builder/ResponsiveRenderer';
import { SiteHeaderPreview, SiteFooterPreview } from '@/components/website-builder/SiteChromePreview';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';
import { widgetDefinitions } from '@/lib/website-builder/widget-definitions';

interface SelectedElement {
  type: 'section' | 'widget';
  sectionId: string;
  widgetId?: string;
}

interface EditableCanvasProps {
  page: Page;
  breakpoint: 'desktop' | 'tablet' | 'mobile';
  selectedElement: SelectedElement | null;
  onSelectElement: (element: SelectedElement) => void;
  onAddSection: (sectionData?: Partial<PageSection>) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddWidget: (sectionId: string, widget: Widget, columnIndex?: number) => void;
  onDeleteWidget: (sectionId: string, widgetId: string) => void;
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface HoverTarget {
  kind: 'section' | 'widget';
  sectionId: string;
  widgetId?: string;
  label: string;
}

// Editor chrome colors (overlay only — never part of the published render).
const SECTION_COLOR = '#6366f1';
const WIDGET_COLOR = '#10b981';

const CANVAS_WIDTHS: Record<EditableCanvasProps['breakpoint'], string> = {
  desktop: '100%',
  tablet: '768px',
  mobile: '375px',
};

function createWidget(type: WidgetType): Widget {
  const definition = widgetDefinitions[type];
  return {
    id: `widget_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    type,
    data: definition?.defaultData ?? {},
    style: definition?.defaultStyle ?? {},
  };
}

function findSectionIdForWidget(page: Page, widgetId: string): string | null {
  for (const section of page.content) {
    for (const column of section.columns ?? []) {
      if (column.widgets.some((w) => w.id === widgetId)) {
        return section.id;
      }
    }
  }
  return null;
}

function widgetLabel(type: string): string {
  const def = widgetDefinitions[type as WidgetType];
  return def?.label ?? type;
}

export default function EditableCanvas({
  page,
  breakpoint,
  selectedElement,
  onSelectElement,
  onAddSection,
  onDeleteSection,
  onAddWidget,
  onDeleteWidget,
}: EditableCanvasProps) {
  // The canvas page area is painted on the SITE'S real published theme (dark base)
  // so the editor matches what publishes instead of a hardcoded white sheet that
  // hides the site's light text. The faithful render itself (ResponsiveRenderer)
  // also applies this theme; the wrapper bg keeps the empty state / footer chrome
  // consistent with it.
  const { theme } = useWebsiteTheme();
  const innerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [boxes, setBoxes] = useState<{ selected: Box | null; hover: Box | null }>({
    selected: null,
    hover: null,
  });
  // Bumped whenever layout may have shifted (resize, image load, reflow) so the
  // overlay rectangles stay glued to the real rendered elements.
  const [layoutTick, setLayoutTick] = useState(0);

  // --- DOM lookups (by data attribute / index against the live render) -------

  const sectionNode = useCallback((sectionId: string): HTMLElement | null => {
    const inner = innerRef.current;
    if (!inner) {
      return null;
    }
    const index = page.content.findIndex((s) => s.id === sectionId);
    if (index < 0) {
      return null;
    }
    const nodes = inner.querySelectorAll<HTMLElement>('section.section');
    return nodes[index] ?? null;
  }, [page.content]);

  const widgetNode = useCallback((widgetId: string): HTMLElement | null => {
    const inner = innerRef.current;
    if (!inner) {
      return null;
    }
    const nodes = Array.from(inner.querySelectorAll<HTMLElement>('[data-widget-id]'));
    return nodes.find((n) => n.getAttribute('data-widget-id') === widgetId) ?? null;
  }, []);

  // --- Recompute overlay rectangles -----------------------------------------

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return;
    }
    const innerRect = inner.getBoundingClientRect();
    const toBox = (el: HTMLElement): Box => {
      const r = el.getBoundingClientRect();
      return {
        top: r.top - innerRect.top,
        left: r.left - innerRect.left,
        width: r.width,
        height: r.height,
      };
    };

    let selected: Box | null = null;
    if (selectedElement) {
      const el =
        selectedElement.type === 'widget' && selectedElement.widgetId
          ? widgetNode(selectedElement.widgetId)
          : sectionNode(selectedElement.sectionId);
      selected = el ? toBox(el) : null;
    }

    let hoverBox: Box | null = null;
    if (hover) {
      const el = hover.kind === 'widget' && hover.widgetId ? widgetNode(hover.widgetId) : sectionNode(hover.sectionId);
      hoverBox = el ? toBox(el) : null;
    }

    setBoxes({ selected, hover: hoverBox });
  }, [page, breakpoint, selectedElement, hover, layoutTick, sectionNode, widgetNode]);

  // Track layout changes (image loads, font reflow, window resize) so overlay
  // boxes follow the real content. Inner-relative coords mean scrolling needs
  // no listener — the overlay scrolls with the content.
  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return;
    }
    const bump = () => setLayoutTick((t) => t + 1);
    const ro = new ResizeObserver(bump);
    ro.observe(inner);
    window.addEventListener('resize', bump);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', bump);
    };
  }, [page.content.length]);

  // --- Event delegation: select + suppress live widget behavior --------------

  const isOverlayTarget = (target: HTMLElement): boolean => Boolean(target.closest('[data-editor-overlay]'));

  const handleClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (isOverlayTarget(target)) {
        return; // let overlay controls (delete/add) handle their own clicks
      }

      const widgetEl = target.closest<HTMLElement>('[data-widget-id]');
      if (widgetEl) {
        e.preventDefault();
        e.stopPropagation();
        const widgetId = widgetEl.getAttribute('data-widget-id');
        if (widgetId) {
          const sectionId = findSectionIdForWidget(page, widgetId);
          if (sectionId) {
            onSelectElement({ type: 'widget', sectionId, widgetId });
          }
        }
        return;
      }

      const sectionEl = target.closest<HTMLElement>('section.section');
      if (sectionEl) {
        e.preventDefault();
        e.stopPropagation();
        const nodes = innerRef.current?.querySelectorAll<HTMLElement>('section.section');
        if (nodes) {
          const index = Array.from(nodes).indexOf(sectionEl);
          const section = page.content[index];
          if (section) {
            onSelectElement({ type: 'section', sectionId: section.id });
          }
        }
      }
    },
    [page, onSelectElement]
  );

  // Stop any in-canvas form from actually submitting while editing.
  const handleSubmitCapture = useCallback((e: React.FormEvent) => {
    e.preventDefault();
  }, []);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (isOverlayTarget(target)) {
        return;
      }
      const widgetEl = target.closest<HTMLElement>('[data-widget-id]');
      if (widgetEl) {
        const widgetId = widgetEl.getAttribute('data-widget-id') ?? '';
        const sectionId = findSectionIdForWidget(page, widgetId) ?? '';
        setHover((prev) =>
          prev?.widgetId === widgetId
            ? prev
            : { kind: 'widget', sectionId, widgetId, label: widgetLabel(widgetEl.getAttribute('data-widget-type') ?? '') }
        );
        return;
      }
      const sectionEl = target.closest<HTMLElement>('section.section');
      if (sectionEl) {
        const nodes = innerRef.current?.querySelectorAll<HTMLElement>('section.section');
        const index = nodes ? Array.from(nodes).indexOf(sectionEl) : -1;
        const section = page.content[index];
        if (section) {
          setHover((prev) =>
            prev?.kind === 'section' && prev.sectionId === section.id
              ? prev
              : { kind: 'section', sectionId: section.id, label: 'Section' }
          );
          return;
        }
      }
      setHover(null);
    },
    [page]
  );

  const handleMouseLeave = useCallback(() => setHover(null), []);

  // --- Drag-and-drop add (widgets dragged from the WidgetsPanel) -------------

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (Array.from(e.dataTransfer.types).includes('widgetType')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const widgetType = e.dataTransfer.getData('widgetType');
      if (!widgetType || !(widgetType in widgetDefinitions)) {
        return;
      }
      e.preventDefault();
      const target = e.target as HTMLElement;
      const sectionEl = target.closest<HTMLElement>('section.section');
      const nodes = innerRef.current?.querySelectorAll<HTMLElement>('section.section');
      const index = sectionEl && nodes ? Array.from(nodes).indexOf(sectionEl) : page.content.length - 1;
      const section = page.content[index];
      if (section) {
        onAddWidget(section.id, createWidget(widgetType as WidgetType), 0);
      }
    },
    [page.content, onAddWidget]
  );

  // --- Render ----------------------------------------------------------------

  const isEmpty = page.content.length === 0;

  const selectedSectionId =
    selectedElement?.type === 'section' || selectedElement?.type === 'widget' ? selectedElement.sectionId : null;
  const selectedWidgetId = selectedElement?.type === 'widget' ? selectedElement.widgetId : undefined;

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-hidden bg-[#111111]"
      style={{ padding: breakpoint !== 'desktop' ? '2rem' : '0' }}
    >
      <div
        className="mx-auto"
        style={{
          width: CANVAS_WIDTHS[breakpoint],
          minHeight: '600px',
          background: theme.backgroundColor,
          color: theme.textColor,
          fontFamily: theme.fontFamily,
          boxShadow: breakpoint !== 'desktop' ? '0 0 30px rgba(99, 102, 241, 0.15)' : 'none',
          border: breakpoint !== 'desktop' ? '1px solid rgba(255,255,255,0.1)' : 'none',
          borderRadius: breakpoint !== 'desktop' ? '8px' : '0',
        }}
      >
        {/* Faithful, non-interactive preview of the published site frame so the
            canvas shows the COMPLETE page (banner + header + body + footer),
            not a chopped-off body. The chrome is inert — the body below stays
            the only editable / selectable area. */}
        <SiteHeaderPreview theme={theme} breakpoint={breakpoint} />

        {isEmpty ? (
          <EmptyState onAddSection={() => onAddSection()} />
        ) : (
          <>
            <div
              ref={innerRef}
              style={{ position: 'relative' }}
              onClickCapture={handleClickCapture}
              onSubmitCapture={handleSubmitCapture}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
            >
              {/* The SAME engine the live site renders through. */}
              <ResponsiveRenderer content={page.content} breakpoint={breakpoint} />

              {/* Editing overlay — pixel-aligned to the rendered output. */}
              <div
                data-editor-overlay
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  zIndex: 5,
                }}
              >
                {/* Hover outline (skip if it is the selected element). */}
                {boxes.hover &&
                  hover &&
                  !(hover.kind === 'widget' ? hover.widgetId === selectedWidgetId : selectedElement?.type === 'section' && hover.sectionId === selectedSectionId) && (
                    <OutlineBox
                      box={boxes.hover}
                      color={hover.kind === 'widget' ? WIDGET_COLOR : SECTION_COLOR}
                      dashed
                      label={hover.label}
                    />
                  )}

                {/* Selected section outline + controls. */}
                {selectedElement?.type === 'section' && boxes.selected && selectedSectionId && (
                  <OutlineBox box={boxes.selected} color={SECTION_COLOR} label="Section">
                    <SectionControls
                      onAddWidget={() => onAddWidget(selectedSectionId, createWidget('text'), 0)}
                      onDelete={() => onDeleteSection(selectedSectionId)}
                    />
                  </OutlineBox>
                )}

                {/* Selected widget outline + controls. */}
                {selectedElement?.type === 'widget' && boxes.selected && selectedSectionId && selectedWidgetId && (
                  <OutlineBox box={boxes.selected} color={WIDGET_COLOR} label={hover?.label ?? 'Widget'}>
                    <WidgetControls onDelete={() => onDeleteWidget(selectedSectionId, selectedWidgetId)} />
                  </OutlineBox>
                )}
              </div>
            </div>

            <div
              className="text-center"
              style={{ padding: '1rem', borderTop: '2px dashed rgba(255,255,255,0.1)' }}
            >
              <button
                type="button"
                onClick={() => onAddSection()}
                className="cursor-pointer rounded border"
                style={{
                  padding: '0.5rem 1rem',
                  background: 'rgba(99,102,241,0.08)',
                  color: SECTION_COLOR,
                  borderColor: 'rgba(99,102,241,0.3)',
                  fontSize: '0.875rem',
                }}
              >
                + Add Section
              </button>
            </div>
          </>
        )}

        <SiteFooterPreview theme={theme} breakpoint={breakpoint} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overlay primitives
// ---------------------------------------------------------------------------

function OutlineBox({
  box,
  color,
  dashed = false,
  label,
  children,
}: {
  box: Box;
  color: string;
  dashed?: boolean;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
        outline: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
        outlineOffset: '-1px',
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    >
      {label && (
        <span
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            transform: 'translateY(-100%)',
            background: color,
            color: '#ffffff',
            fontSize: '0.6875rem',
            fontWeight: 600,
            padding: '1px 6px',
            borderRadius: '3px 3px 0 0',
            whiteSpace: 'nowrap',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

function SectionControls({ onAddWidget, onDelete }: { onAddWidget: () => void; onDelete: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '0.5rem',
        right: '0.5rem',
        display: 'flex',
        gap: '0.5rem',
        pointerEvents: 'auto',
        zIndex: 10,
      }}
    >
      <button type="button" onClick={onAddWidget} style={controlButtonStyle('#6366f1')}>
        + Widget
      </button>
      <button type="button" onClick={onDelete} style={controlButtonStyle('#ef4444')}>
        Delete Section
      </button>
    </div>
  );
}

function WidgetControls({ onDelete }: { onDelete: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '0.25rem',
        right: '0.25rem',
        pointerEvents: 'auto',
        zIndex: 10,
      }}
    >
      <button type="button" onClick={onDelete} style={controlButtonStyle('#ef4444')} aria-label="Delete widget">
        &times;
      </button>
    </div>
  );
}

function controlButtonStyle(background: string): React.CSSProperties {
  return {
    padding: '0.25rem 0.5rem',
    background,
    color: '#ffffff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.75rem',
    fontWeight: 500,
    fontFamily: 'Inter, system-ui, sans-serif',
    lineHeight: 1.2,
  };
}

function EmptyState({ onAddSection }: { onAddSection: () => void }) {
  return (
    <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'rgba(255,255,255,0.55)' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.4 }}>+</div>
      <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem', color: 'rgba(255,255,255,0.8)' }}>Empty Page</h3>
      <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem' }}>
        Add a section to get started, then drag widgets from the left panel.
      </p>
      <button
        type="button"
        onClick={onAddSection}
        style={{
          padding: '0.75rem 1.5rem',
          background: SECTION_COLOR,
          color: '#ffffff',
          border: 'none',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 500,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        + Add Section
      </button>
    </div>
  );
}
