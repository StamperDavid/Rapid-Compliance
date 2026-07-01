/**
 * Editable Canvas
 *
 * TRUE WYSIWYG editor surface. The page body is drawn by the SAME engine the
 * live site uses (`ResponsiveRenderer`), so the canvas is pixel-identical to
 * what publishes — no separate editor renderer, no gray "<type> widget"
 * placeholders.
 *
 * Editing affordances (hover outline, click-to-select, drag handles, drop
 * zones, duplicate / delete / hide controls) are drawn as an absolutely-
 * positioned overlay ON TOP of the faithful render and pixel-aligned to it.
 *
 * Drag-and-drop (layout engine):
 *   Because the body is rendered as ONE faithful `ResponsiveRenderer` tree
 *   (which we must not edit, and which injects a global `min-height:100vh`),
 *   we cannot host `@dnd-kit` SortableContext nodes inside the real content.
 *   Instead the overlay IS the drag surface: every widget/section gets a
 *   `useDraggable` grip handle, and every column (and the section list) gets a
 *   geometric `useDroppable` zone measured to the real DOM. `@dnd-kit`'s
 *   `pointerWithin` collision runs on those measured rects; the destination
 *   index is computed from the dragged grip's projected position against the
 *   target column's real widget rects, so a drop maps exactly onto the
 *   `page-tree-ops` `moveWidget` / `moveSection` contract. Result: widgets sort
 *   within a column, move across columns and across sections, and sections
 *   reorder — all on the faithful render.
 */

'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import type { Page, PageSection, Widget, WidgetType } from '@/types/website';
import type { SiteChrome, ChromeRegion } from '@/lib/website-builder/site-chrome-types';
import { findWidget, type WidgetDestination } from '@/lib/website-builder/page-tree-ops';
import { ResponsiveRenderer } from '@/components/website-builder/ResponsiveRenderer';
import SectionStructurePicker from '@/components/website-builder/SectionStructurePicker';
import { SiteHeaderPreview, SiteFooterPreview } from '@/components/website-builder/SiteChromePreview';
import { useWebsiteTheme } from '@/hooks/useWebsiteTheme';
import { widgetDefinitions, isContainerType } from '@/lib/website-builder/widget-definitions';

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
  // Picker-driven add: build + insert a section with 1..6 columns (optional
  // asymmetric widths) at `atIndex`. Falls back to `onAddSection` when absent.
  onAddSectionWithStructure?: (columnCount: number, widths?: number[], atIndex?: number) => void;
  onDeleteSection: (sectionId: string) => void;
  // Save the selected section to the block library (optional; gated when unset).
  onSaveSectionAsBlock?: (sectionId: string) => void;
  onAddWidget: (sectionId: string, widget: Widget, columnIndex?: number) => void;
  // Insert a widget INTO a container widget's children (true nesting).
  onAddWidgetToContainer?: (containerId: string, widget: Widget, index?: number) => void;
  // In-place (inline) text editing write-back. Double-clicking a text-bearing
  // widget on the canvas edits its text in situ and commits through this handler
  // (which funnels into the editor's `updateWidget` + undo history). Optional so
  // non-editor callers of the canvas stay source-compatible (no inline editing
  // when unset — widgets are then selectable/panel-editable only).
  onUpdateWidget?: (sectionId: string, widgetId: string, updates: Partial<Widget>) => void;
  onDeleteWidget: (sectionId: string, widgetId: string) => void;
  // --- Layout engine (drag-to-reorder + duplicate / hide) -------------------
  // Optional so other (non-editor) callers of the canvas stay source-compatible.
  onMoveWidget?: (widgetId: string, dest: WidgetDestination) => void;
  onMoveSection?: (sectionId: string, toIndex: number) => void;
  onDuplicateWidget?: (widgetId: string) => void;
  onDuplicateSection?: (sectionId: string) => void;
  onToggleWidgetHidden?: (widgetId: string) => void;
  // --- Site chrome (banner / header / footer) -------------------------------
  chrome?: SiteChrome | null;
  editable?: boolean;
  selectedRegion?: ChromeRegion | null;
  onSelectRegion?: (region: ChromeRegion) => void;
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

interface ColumnBox {
  key: string;
  sectionId: string;
  columnIndex: number;
  box: Box;
  empty: boolean;
}

interface SectionBox {
  sectionId: string;
  index: number;
  box: Box;
}

interface EmptyContainerBox {
  widgetId: string;
  box: Box;
}

interface ActiveDrag {
  type: 'section' | 'widget';
  id: string;
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
  const widget: Widget = {
    id: `widget_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    type,
    data: definition?.defaultData ?? {},
    style: definition?.defaultStyle ?? {},
  };
  // Container widgets are true nestable boxes — seed an (empty) children array so
  // the renderer treats them as a real flex/grid container, not a legacy box.
  if (isContainerType(type)) {
    widget.children = [];
  }
  return widget;
}

/** True when a widget subtree contains `widgetId` (self or nested). */
function subtreeContains(widgets: Widget[], widgetId: string): boolean {
  for (const w of widgets) {
    if (w.id === widgetId) {
      return true;
    }
    if (w.children && subtreeContains(w.children, widgetId)) {
      return true;
    }
  }
  return false;
}

/** The section a widget ultimately lives in — recurses through nested containers. */
function findSectionIdForWidget(page: Page, widgetId: string): string | null {
  for (const section of page.content) {
    for (const column of section.columns ?? []) {
      if (subtreeContains(column.widgets, widgetId)) {
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

/**
 * Inline (in-canvas) text editing config for a widget type. Only the
 * SINGLE-text-node widgets are inline-editable — the one where the whole
 * rendered text element maps to exactly one `data` key:
 *   - `heading` → `data.text`     (single line, `<h1..h6>`)
 *   - `text`    → `data.content`  (multi-line paragraph, `<p>`)
 *   - `button`  → `data.text`     (single line, `<button>`)
 *   - `link`    → `data.text`     (single line, `<a>`)
 * These match the keys the renderer READS and the Content panel WRITES, so a
 * canvas edit and a panel edit stay perfectly consistent.
 *
 * Multi-text widgets (hero heading+subheading, cta heading+text+buttonText,
 * testimonial quote/author/role, icon-box, etc.) have several text nodes under
 * one `data-widget-id`, so a single contentEditable can't be unambiguously
 * mapped to one key — those stay panel-only (return `null`). Images / forms /
 * complex widgets are likewise panel-only.
 */
interface EditableTextConfig {
  dataKey: string;
  multiline: boolean;
}

function editableTextConfig(type: string): EditableTextConfig | null {
  switch (type) {
    case 'heading':
      return { dataKey: 'text', multiline: false };
    case 'text':
      return { dataKey: 'content', multiline: true };
    case 'button':
      return { dataKey: 'text', multiline: false };
    case 'link':
      return { dataKey: 'text', multiline: false };
    default:
      return null;
  }
}

/**
 * The concrete rendered text element for a widget host. The render tree is
 * `AccessibleWidget (data-widget-id) → .widget → <text element>`, so the editable
 * node is the `.widget`'s first element child. Returns null if the structure
 * doesn't match (e.g. a widget with no direct text element).
 */
function editableElementForHost(host: HTMLElement): HTMLElement | null {
  const widgetBox = host.querySelector(':scope > .widget');
  const el = widgetBox?.firstElementChild ?? null;
  return el instanceof HTMLElement ? el : null;
}

/** A live inline-editing session (kept in a ref — never triggers re-render). */
interface EditingSession {
  widgetId: string;
  dataKey: string;
  el: HTMLElement;
  original: string;
  done: boolean;
  cleanup: () => void;
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' ? v : undefined;
}

export default function EditableCanvas({
  page,
  breakpoint,
  selectedElement,
  onSelectElement,
  onAddSection,
  onAddSectionWithStructure,
  onDeleteSection,
  onSaveSectionAsBlock,
  onAddWidget,
  onAddWidgetToContainer,
  onUpdateWidget,
  onDeleteWidget,
  onMoveWidget,
  onMoveSection,
  onDuplicateWidget,
  onDuplicateSection,
  onToggleWidgetHidden,
  chrome = null,
  editable = true,
  selectedRegion = null,
  onSelectRegion,
}: EditableCanvasProps) {
  const { theme } = useWebsiteTheme();
  const innerRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<HoverTarget | null>(null);
  const [boxes, setBoxes] = useState<{ selected: Box | null; hover: Box | null }>({
    selected: null,
    hover: null,
  });
  const [columnBoxes, setColumnBoxes] = useState<ColumnBox[]>([]);
  const [sectionBoxes, setSectionBoxes] = useState<SectionBox[]>([]);
  // Empty container widgets get a persistent "+ Add" affordance so a user can
  // drop the first child into a nested container.
  const [emptyContainerBoxes, setEmptyContainerBoxes] = useState<EmptyContainerBox[]>([]);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);
  // Structure picker ("Select your structure"). Holds the insert index for the
  // pending add; `atIndex: undefined` appends to the end of the page.
  const [structurePicker, setStructurePicker] = useState<{ atIndex?: number } | null>(null);
  // Bumped whenever layout may have shifted (resize, image load, reflow) so the
  // overlay rectangles stay glued to the real rendered elements.
  const [layoutTick, setLayoutTick] = useState(0);

  // --- Inline (in-canvas) text editing --------------------------------------
  // The live editing session lives in a REF so that keystrokes never trigger a
  // React re-render of the canvas (which would reconcile the faithful render and
  // risk clobbering the caret). `editingWidgetId` is the ONLY piece of editing
  // state that lives in React — it exists purely to swap the selected-widget
  // overlay for a non-interactive "editing" outline so the grip/controls don't
  // sit on top of the text the user is typing into.
  const editingRef = useRef<EditingSession | null>(null);
  const [editingWidgetId, setEditingWidgetId] = useState<string | null>(null);
  // Always-current page snapshot for the commit path (so a commit merges onto the
  // latest widget data without re-creating the commit callback per render).
  const pageRef = useRef(page);
  pageRef.current = page;

  const sensors = useSensors(
    // A small activation distance keeps a plain click on a grip = "select",
    // and only a real drag (>5px) starts moving the element.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

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

  // The column <div>s a section renders (section-inner → wrapper → columns).
  const columnNodesForSection = useCallback((sectionId: string): HTMLElement[] => {
    const sec = sectionNode(sectionId);
    if (!sec) {
      return [];
    }
    const inner = sec.querySelector('.section-inner');
    const wrapper = inner?.firstElementChild;
    if (!wrapper) {
      return [];
    }
    return Array.from(wrapper.children).filter((c): c is HTMLElement => c instanceof HTMLElement);
  }, [sectionNode]);

  // --- Recompute selection / hover overlay rectangles ------------------------

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return;
    }
    const innerRect = inner.getBoundingClientRect();
    const toBox = (el: HTMLElement): Box => {
      const r = el.getBoundingClientRect();
      return { top: r.top - innerRect.top, left: r.left - innerRect.left, width: r.width, height: r.height };
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

  // --- Recompute column + section drop-zone rectangles -----------------------

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return;
    }
    const innerRect = inner.getBoundingClientRect();
    const toBox = (el: HTMLElement): Box => {
      const r = el.getBoundingClientRect();
      return { top: r.top - innerRect.top, left: r.left - innerRect.left, width: r.width, height: r.height };
    };

    const nextColumns: ColumnBox[] = [];
    const nextSections: SectionBox[] = [];

    page.content.forEach((section, sectionIndex) => {
      const sec = sectionNode(section.id);
      if (sec) {
        nextSections.push({ sectionId: section.id, index: sectionIndex, box: toBox(sec) });
      }
      const colNodes = columnNodesForSection(section.id);
      (section.columns ?? []).forEach((column, columnIndex) => {
        const node = colNodes[columnIndex];
        if (node) {
          nextColumns.push({
            key: `${section.id}:${columnIndex}`,
            sectionId: section.id,
            columnIndex,
            box: toBox(node),
            empty: column.widgets.length === 0,
          });
        }
      });
    });

    setColumnBoxes(nextColumns);
    setSectionBoxes(nextSections);
  }, [page, breakpoint, layoutTick, sectionNode, columnNodesForSection]);

  // --- Recompute empty-container "+ Add" rectangles --------------------------

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) {
      return;
    }
    const innerRect = inner.getBoundingClientRect();
    const nodes = Array.from(inner.querySelectorAll<HTMLElement>('[data-container-empty="true"]'));
    const next: EmptyContainerBox[] = [];
    for (const node of nodes) {
      const host = node.closest<HTMLElement>('[data-widget-id]');
      const widgetId = host?.getAttribute('data-widget-id');
      if (!widgetId) {
        continue;
      }
      const r = node.getBoundingClientRect();
      next.push({
        widgetId,
        box: { top: r.top - innerRect.top, left: r.left - innerRect.left, width: r.width, height: r.height },
      });
    }
    setEmptyContainerBoxes(next);
  }, [page, breakpoint, layoutTick]);

  // Track layout changes (image loads, font reflow, window resize) so overlay
  // boxes follow the real content.
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
        return; // overlay controls handle their own clicks
      }

      // While inline-editing, a click INSIDE the editable element must place the
      // caret natively — don't re-select or run the widget's own behaviour. We
      // still stop propagation so a live behaviour (e.g. a button/link's own
      // click → navigation) can't fire mid-edit; the caret is already set on the
      // preceding mousedown, so suppressing the click is caret-safe.
      if (editingRef.current?.el.contains(target)) {
        e.stopPropagation();
        return;
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

  const handleSubmitCapture = useCallback((e: React.FormEvent) => {
    e.preventDefault();
  }, []);

  // Commit (write the new plain text) or cancel (restore the original) the live
  // inline-editing session. Idempotent — the `done` flag guards against the
  // blur-after-Enter double fire. On commit we read `textContent` (NEVER
  // innerHTML) so only sanitized plain text is stored, and we merge onto the
  // LATEST widget data (pageRef) so the whole `data` object is preserved.
  const finishEditing = useCallback(
    (mode: 'commit' | 'cancel') => {
      const session = editingRef.current;
      if (!session || session.done) {
        return;
      }
      session.done = true;
      session.cleanup();

      const { el } = session;
      el.removeAttribute('contenteditable');
      el.style.removeProperty('cursor');

      if (mode === 'cancel') {
        // Restore the original text so the DOM matches the (unchanged) model.
        el.textContent = session.original;
      } else {
        const next = el.textContent ?? '';
        if (next !== session.original && onUpdateWidget) {
          const loc = findWidget(pageRef.current, session.widgetId);
          if (loc) {
            const sectionId = findSectionIdForWidget(pageRef.current, session.widgetId) ?? '';
            onUpdateWidget(sectionId, session.widgetId, {
              data: { ...loc.widget.data, [session.dataKey]: next },
            });
          }
        }
      }

      editingRef.current = null;
      setEditingWidgetId(null);
    },
    [onUpdateWidget]
  );

  // Keep a stable handle to the latest `finishEditing` so the unmount cleanup can
  // commit an in-flight edit without re-subscribing every render.
  const finishEditingRef = useRef(finishEditing);
  finishEditingRef.current = finishEditing;
  useEffect(() => () => finishEditingRef.current('commit'), []);

  // Turn a text-bearing widget's rendered element into an in-place editor. The
  // element is made contentEditable IMPERATIVELY (the shared renderer stays pure —
  // it never learns about editing), and native keydown/blur listeners drive
  // commit/cancel. Because the page model is untouched until commit, the faithful
  // render keeps producing the SAME text for this node, so React never rewrites
  // the text node mid-edit — the caret and typed characters survive re-renders.
  const startEditing = useCallback(
    (host: HTMLElement, widgetId: string, config: EditableTextConfig) => {
      // Close any prior session first (commit it) so state can't leak between nodes.
      finishEditing('commit');

      const el = editableElementForHost(host);
      if (!el) {
        return;
      }

      const original = el.textContent ?? '';
      // `plaintext-only` blocks rich markup during editing (degrades to a plain
      // editable in engines without it); commit still reads textContent to be safe.
      el.setAttribute('contenteditable', 'plaintext-only');
      el.style.cursor = 'text';

      const onKeyDown = (ev: KeyboardEvent) => {
        if (ev.key === 'Escape') {
          ev.preventDefault();
          finishEditing('cancel');
          return;
        }
        if (ev.key === 'Enter') {
          if (!config.multiline) {
            // Single-line widgets commit on Enter (no newline inserted).
            ev.preventDefault();
            finishEditing('commit');
          } else if (ev.ctrlKey || ev.metaKey) {
            // Multi-line text: plain Enter inserts a newline; Ctrl/Cmd+Enter commits.
            ev.preventDefault();
            finishEditing('commit');
          }
        }
        // Keep keystrokes local: the editor's window-level shortcuts (undo/redo,
        // delete-element, duplicate) must not react to typing. They already guard
        // on isContentEditable, but stopping propagation is belt-and-suspenders and
        // lets the browser's native contentEditable undo own Ctrl+Z while editing.
        ev.stopPropagation();
      };
      const onBlur = () => finishEditing('commit');

      el.addEventListener('keydown', onKeyDown);
      el.addEventListener('blur', onBlur);

      editingRef.current = {
        widgetId,
        dataKey: config.dataKey,
        el,
        original,
        done: false,
        cleanup: () => {
          el.removeEventListener('keydown', onKeyDown);
          el.removeEventListener('blur', onBlur);
        },
      };
      setEditingWidgetId(widgetId);
      // Select the widget too, so the right panel + overlay reflect what's editing.
      onSelectElement({
        type: 'widget',
        sectionId: findSectionIdForWidget(pageRef.current, widgetId) ?? '',
        widgetId,
      });

      // Focus + place the caret after the current commit tick so contentEditable is
      // active and any selection-driven re-render has settled. Single-line widgets
      // select-all (easy overtype); multi-line drops the caret at the end.
      window.requestAnimationFrame(() => {
        if (editingRef.current?.el !== el) {
          return;
        }
        el.focus();
        const selection = window.getSelection();
        if (selection) {
          const range = document.createRange();
          range.selectNodeContents(el);
          if (config.multiline) {
            range.collapse(false);
          }
          selection.removeAllRanges();
          selection.addRange(range);
        }
      });
    },
    [finishEditing, onSelectElement]
  );

  // Double-click a text-bearing widget → edit it in place. Non-text (or
  // multi-text) widgets fall through untouched: they keep single-click selection
  // and panel editing. Gated on `onUpdateWidget` so the read-only canvas is inert.
  const handleDoubleClickCapture = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onUpdateWidget) {
        return;
      }
      const target = e.target as HTMLElement;
      if (isOverlayTarget(target)) {
        return;
      }
      const host = target.closest<HTMLElement>('[data-widget-id]');
      if (!host) {
        return;
      }
      const widgetId = host.getAttribute('data-widget-id');
      const type = host.getAttribute('data-widget-type') ?? '';
      const config = editableTextConfig(type);
      if (!widgetId || !config) {
        return; // not inline-editable → leave selection / panel behaviour intact
      }
      e.preventDefault();
      e.stopPropagation();
      startEditing(host, widgetId, config);
    },
    [onUpdateWidget, startEditing]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Freeze hover tracking while inline-editing so pointer movement over the
      // text can't churn overlay state (and thus the faithful render) mid-caret.
      if (editingRef.current) {
        return;
      }
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

  // --- Native drag-and-drop add (widgets dragged from the WidgetsPanel) ------

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

  // --- @dnd-kit: move widgets across columns/sections + reorder sections -----

  // Only consider droppables that match the active drag type, so a widget drop
  // resolves to a column (not the section it lives in) and vice-versa.
  const collisionDetection: CollisionDetection = useCallback((args) => {
    const accepts = asString(args.active.data.current?.type);
    const containers = args.droppableContainers.filter(
      (c) => asString(c.data.current?.accepts) === accepts,
    );
    return pointerWithin({ ...args, droppableContainers: containers });
  }, []);

  const handleDndStart = useCallback((event: DragStartEvent) => {
    const data = event.active.data.current;
    const type = asString(data?.type);
    const id = asString(data?.id);
    const label = asString(data?.label) ?? 'Element';
    if ((type === 'widget' || type === 'section') && id) {
      setActiveDrag({ type, id, label });
    }
  }, []);

  // Insertion index inside the target column, computed from the dragged grip's
  // final projected centre vs the column's real widget rects (excluding the
  // widget being moved, so a same-column drop lands exactly where intended).
  const computeDropIndex = useCallback(
    (sectionId: string, columnIndex: number, draggedId: string, centerY: number | null): number => {
      const section = page.content.find((s) => s.id === sectionId);
      const column = section?.columns?.[columnIndex];
      if (!column) {
        return 0;
      }
      const others = column.widgets.filter((w) => w.id !== draggedId);
      if (centerY === null) {
        return others.length;
      }
      for (let i = 0; i < others.length; i += 1) {
        const node = widgetNode(others[i].id);
        if (!node) {
          continue;
        }
        const r = node.getBoundingClientRect();
        if (centerY < r.top + r.height / 2) {
          return i;
        }
      }
      return others.length;
    },
    [page.content, widgetNode]
  );

  const handleDndEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDrag(null);
      const aData = event.active.data.current;
      const oData = event.over?.data.current;
      if (!aData || !oData) {
        return;
      }
      const aType = asString(aData.type);
      const aId = asString(aData.id);
      const accepts = asString(oData.accepts);

      if (aType === 'widget' && aId && accepts === 'widget' && onMoveWidget) {
        const sectionId = asString(oData.sectionId);
        const columnIndex = asNumber(oData.columnIndex);
        if (sectionId === undefined || columnIndex === undefined) {
          return;
        }
        const translated = event.active.rect.current.translated;
        const centerY = translated ? translated.top + translated.height / 2 : null;
        const index = computeDropIndex(sectionId, columnIndex, aId, centerY);
        onMoveWidget(aId, { parent: { kind: 'column', sectionId, columnIndex }, index });
        return;
      }

      if (aType === 'section' && aId && accepts === 'section' && onMoveSection) {
        const toIndex = asNumber(oData.index);
        if (toIndex !== undefined) {
          onMoveSection(aId, toIndex);
        }
      }
    },
    [onMoveWidget, onMoveSection, computeDropIndex]
  );

  // --- Structure picker ("Add Section" → Select your structure) --------------

  // Open the picker for an insert at `atIndex` (undefined = append). When no
  // picker handler is wired, fall back to the plain single-column add.
  const openStructurePicker = useCallback(
    (atIndex?: number) => {
      if (onAddSectionWithStructure) {
        setStructurePicker({ atIndex });
      } else {
        onAddSection();
      }
    },
    [onAddSectionWithStructure, onAddSection],
  );

  const handlePickStructure = useCallback(
    (columnCount: number, widths?: number[]) => {
      const atIndex = structurePicker?.atIndex;
      setStructurePicker(null);
      if (onAddSectionWithStructure) {
        onAddSectionWithStructure(columnCount, widths, atIndex);
      } else {
        onAddSection();
      }
    },
    [structurePicker, onAddSectionWithStructure, onAddSection],
  );

  // --- Render ----------------------------------------------------------------

  const isEmpty = page.content.length === 0;

  const selectedSectionId =
    selectedElement?.type === 'section' || selectedElement?.type === 'widget' ? selectedElement.sectionId : null;
  const selectedWidgetId = selectedElement?.type === 'widget' ? selectedElement.widgetId : undefined;
  const selectedWidget = selectedWidgetId ? (findWidget(page, selectedWidgetId)?.widget ?? null) : null;
  const selectedIsContainer = selectedWidget !== null && isContainerType(selectedWidget.type);

  const draggingWidget = activeDrag?.type === 'widget';
  const draggingSection = activeDrag?.type === 'section';

  const bodyContent = isEmpty ? (
    <EmptyState onAddSection={() => openStructurePicker()} />
  ) : (
    <>
      <div
        ref={innerRef}
        style={{ position: 'relative' }}
        onClickCapture={handleClickCapture}
        onDoubleClickCapture={handleDoubleClickCapture}
        onSubmitCapture={handleSubmitCapture}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* The SAME engine the live site renders through. */}
        <ResponsiveRenderer content={page.content} breakpoint={breakpoint} />

        {/* Editing overlay — pixel-aligned to the rendered output. */}
        <div data-editor-overlay style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 5 }}>
          {/* Column drop zones (geometric @dnd-kit droppables). Always mounted so
              they're measurable at drag start; only painted while dragging. */}
          {columnBoxes.map((cb) => (
            <ColumnDropZone
              key={cb.key}
              cb={cb}
              dragging={draggingWidget}
              onAdd={() => onAddWidget(cb.sectionId, createWidget('text'), cb.columnIndex)}
            />
          ))}

          {/* Section drop zones (only relevant while dragging a section). */}
          {sectionBoxes.map((sb) => (
            <SectionDropZone key={`drop-${sb.sectionId}`} sb={sb} dragging={draggingSection} />
          ))}

          {/* Empty-container "+ Add" affordances (only when a container add path
              is wired). Clicking drops a first child into that container. */}
          {onAddWidgetToContainer &&
            emptyContainerBoxes.map((ecb) => (
              <EmptyContainerAdd
                key={`empty-${ecb.widgetId}`}
                box={ecb.box}
                onAdd={() => onAddWidgetToContainer(ecb.widgetId, createWidget('text'))}
              />
            ))}

          {/* Hover outline (skip if it is the selected element). */}
          {boxes.hover &&
            hover &&
            !(hover.kind === 'widget'
              ? hover.widgetId === selectedWidgetId
              : selectedElement?.type === 'section' && hover.sectionId === selectedSectionId) && (
              <OutlineBox
                box={boxes.hover}
                color={hover.kind === 'widget' ? WIDGET_COLOR : SECTION_COLOR}
                dashed
                label={hover.label}
              >
                {/* A grip on the hovered element so you can drag without selecting first. */}
                {hover.kind === 'widget' && hover.widgetId ? (
                  <DragGrip
                    dragId={`w:${hover.widgetId}`}
                    data={{ type: 'widget', id: hover.widgetId, label: hover.label }}
                    color={WIDGET_COLOR}
                    title="Drag to move widget"
                  />
                ) : (
                  <DragGrip
                    dragId={`s:${hover.sectionId}`}
                    data={{ type: 'section', id: hover.sectionId, label: 'Section' }}
                    color={SECTION_COLOR}
                    title="Drag to reorder section"
                  />
                )}
              </OutlineBox>
            )}

          {/* Selected section outline + controls. */}
          {selectedElement?.type === 'section' && boxes.selected && selectedSectionId && (
            <OutlineBox box={boxes.selected} color={SECTION_COLOR} label="Section">
              <DragGrip
                dragId={`s:${selectedSectionId}`}
                data={{ type: 'section', id: selectedSectionId, label: 'Section' }}
                color={SECTION_COLOR}
                title="Drag to reorder section"
              />
              <SectionControls
                onAddWidget={() => onAddWidget(selectedSectionId, createWidget('text'), 0)}
                onDuplicate={onDuplicateSection ? () => onDuplicateSection(selectedSectionId) : undefined}
                onSaveAsBlock={onSaveSectionAsBlock ? () => onSaveSectionAsBlock(selectedSectionId) : undefined}
                onDelete={() => onDeleteSection(selectedSectionId)}
              />
            </OutlineBox>
          )}

          {/* Selected widget outline + controls. While THIS widget is being
              edited inline, drop the grip/controls (which would sit on top of the
              text) and show a passive "editing" outline instead, so the whole text
              stays clickable for caret placement. */}
          {selectedElement?.type === 'widget' && boxes.selected && selectedSectionId && selectedWidgetId && (
            editingWidgetId === selectedWidgetId ? (
              <OutlineBox box={boxes.selected} color={WIDGET_COLOR} label="Editing text — Enter to save · Esc to cancel" dashed />
            ) : (
              <OutlineBox box={boxes.selected} color={WIDGET_COLOR} label={hover?.label ?? 'Widget'}>
                <DragGrip
                  dragId={`w:${selectedWidgetId}`}
                  data={{ type: 'widget', id: selectedWidgetId, label: hover?.label ?? 'Widget' }}
                  color={WIDGET_COLOR}
                  title="Drag to move widget"
                />
                <WidgetControls
                  onAddInside={
                    selectedIsContainer && onAddWidgetToContainer
                      ? () => onAddWidgetToContainer(selectedWidgetId, createWidget('text'))
                      : undefined
                  }
                  onDuplicate={onDuplicateWidget ? () => onDuplicateWidget(selectedWidgetId) : undefined}
                  onToggleHidden={onToggleWidgetHidden ? () => onToggleWidgetHidden(selectedWidgetId) : undefined}
                  onDelete={() => onDeleteWidget(selectedSectionId, selectedWidgetId)}
                />
              </OutlineBox>
            )
          )}
        </div>
      </div>

      <div className="text-center" style={{ padding: '1rem', borderTop: '2px dashed rgba(255,255,255,0.1)' }}>
        <button
          type="button"
          onClick={() => openStructurePicker()}
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
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={handleDndStart}
      onDragEnd={handleDndEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
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
          {chrome && (
            <SiteHeaderPreview
              chrome={chrome}
              breakpoint={breakpoint}
              editable={editable}
              selectedRegion={selectedRegion}
              onSelectRegion={onSelectRegion}
            />
          )}

          {bodyContent}

          {chrome && (
            <SiteFooterPreview
              chrome={chrome}
              breakpoint={breakpoint}
              editable={editable}
              selectedRegion={selectedRegion}
              onSelectRegion={onSelectRegion}
            />
          )}
        </div>
      </div>

      {/* "Select your structure" — column-layout chooser for a new section. */}
      {structurePicker && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Select your structure"
          onClick={() => setStructurePicker(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
          }}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <SectionStructurePicker
              onPick={handlePickStructure}
              onClose={() => setStructurePicker(null)}
            />
          </div>
        </div>
      )}

      {/* Floating chip that follows the cursor while dragging. */}
      <DragOverlay dropAnimation={null}>
        {activeDrag ? (
          <div
            style={{
              background: activeDrag.type === 'widget' ? WIDGET_COLOR : SECTION_COLOR,
              color: '#ffffff',
              fontSize: '0.72rem',
              fontWeight: 600,
              padding: '0.3rem 0.6rem',
              borderRadius: '6px',
              boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
              fontFamily: 'Inter, system-ui, sans-serif',
              whiteSpace: 'nowrap',
            }}
          >
            ⠿ {activeDrag.label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ---------------------------------------------------------------------------
// Drop zones
// ---------------------------------------------------------------------------

function ColumnDropZone({ cb, dragging, onAdd }: { cb: ColumnBox; dragging: boolean; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `col:${cb.key}`,
    data: { accepts: 'widget', sectionId: cb.sectionId, columnIndex: cb.columnIndex },
  });
  const active = dragging && isOver;
  // Empty columns can collapse to ~0px; give them a usable hit/drop area.
  const height = cb.empty ? Math.max(cb.box.height, 48) : cb.box.height;

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        top: cb.box.top,
        left: cb.box.left,
        width: cb.box.width,
        height,
        pointerEvents: 'none',
        boxSizing: 'border-box',
        borderRadius: '4px',
        border: active
          ? `2px solid ${WIDGET_COLOR}`
          : dragging
            ? '1px dashed rgba(16,185,129,0.4)'
            : 'none',
        background: active ? 'rgba(16,185,129,0.10)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4,
      }}
    >
      {dragging && cb.empty && (
        <span style={{ fontSize: '0.7rem', color: 'rgba(16,185,129,0.9)', fontWeight: 600 }}>Drop here</span>
      )}
      {/* Persistent "+ Add" affordance for an empty column (not during a drag). */}
      {!dragging && cb.empty && (
        <button
          type="button"
          onClick={onAdd}
          style={{
            pointerEvents: 'auto',
            padding: '0.3rem 0.6rem',
            background: 'rgba(16,185,129,0.10)',
            border: '1px dashed rgba(16,185,129,0.45)',
            borderRadius: '6px',
            color: 'rgba(16,185,129,0.95)',
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          + Add
        </button>
      )}
    </div>
  );
}

function SectionDropZone({ sb, dragging }: { sb: SectionBox; dragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `sec:${sb.sectionId}`,
    data: { accepts: 'section', index: sb.index, sectionId: sb.sectionId },
  });
  const active = dragging && isOver;
  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        top: sb.box.top,
        left: sb.box.left,
        width: sb.box.width,
        height: sb.box.height,
        pointerEvents: 'none',
        boxSizing: 'border-box',
        border: active ? `2px solid ${SECTION_COLOR}` : 'none',
        background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
        zIndex: 3,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Drag handle (grip)
// ---------------------------------------------------------------------------

function DragGrip({
  dragId,
  data,
  color,
  title,
}: {
  dragId: string;
  data: { type: 'widget' | 'section'; id: string; label: string };
  color: string;
  title: string;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId, data });
  return (
    <button
      ref={setNodeRef}
      type="button"
      title={title}
      {...listeners}
      {...attributes}
      style={{
        position: 'absolute',
        top: '0.25rem',
        left: '0.25rem',
        pointerEvents: 'auto',
        zIndex: 11,
        width: '22px',
        height: '22px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: color,
        color: '#ffffff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'grab',
        fontSize: '0.8rem',
        lineHeight: 1,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none',
      }}
      aria-label={title}
    >
      ⠿
    </button>
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

function SectionControls({
  onAddWidget,
  onDuplicate,
  onSaveAsBlock,
  onDelete,
}: {
  onAddWidget: () => void;
  onDuplicate?: () => void;
  onSaveAsBlock?: () => void;
  onDelete: () => void;
}) {
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
      {onDuplicate && (
        <button type="button" onClick={onDuplicate} style={controlButtonStyle('#0ea5e9')}>
          Duplicate
        </button>
      )}
      {onSaveAsBlock && (
        <button type="button" onClick={onSaveAsBlock} style={controlButtonStyle('#8b5cf6')}>
          Save as block
        </button>
      )}
      <button type="button" onClick={onDelete} style={controlButtonStyle('#ef4444')}>
        Delete Section
      </button>
    </div>
  );
}

function WidgetControls({
  onAddInside,
  onDuplicate,
  onToggleHidden,
  onDelete,
}: {
  onAddInside?: () => void;
  onDuplicate?: () => void;
  onToggleHidden?: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '0.25rem',
        right: '0.25rem',
        display: 'flex',
        gap: '0.25rem',
        pointerEvents: 'auto',
        zIndex: 10,
      }}
    >
      {onAddInside && (
        <button type="button" onClick={onAddInside} style={controlButtonStyle('#10b981')} aria-label="Add widget inside container" title="Add inside">
          + Add
        </button>
      )}
      {onDuplicate && (
        <button type="button" onClick={onDuplicate} style={controlButtonStyle('#0ea5e9')} aria-label="Duplicate widget" title="Duplicate">
          ⧉
        </button>
      )}
      {onToggleHidden && (
        <button type="button" onClick={onToggleHidden} style={controlButtonStyle('#64748b')} aria-label="Hide / show widget" title="Hide / show">
          ◑
        </button>
      )}
      <button type="button" onClick={onDelete} style={controlButtonStyle('#ef4444')} aria-label="Delete widget" title="Delete">
        &times;
      </button>
    </div>
  );
}

function EmptyContainerAdd({ box, onAdd }: { box: Box; onAdd: () => void }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: box.top,
        left: box.left,
        width: box.width,
        height: Math.max(box.height, 40),
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 4,
      }}
    >
      <button
        type="button"
        onClick={onAdd}
        style={{
          pointerEvents: 'auto',
          padding: '0.3rem 0.6rem',
          background: 'rgba(16,185,129,0.12)',
          border: '1px dashed rgba(16,185,129,0.5)',
          borderRadius: '6px',
          color: 'rgba(16,185,129,0.95)',
          fontSize: '0.72rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        + Add widget
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
