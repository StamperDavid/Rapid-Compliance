/**
 * Layers Panel (a.k.a. Navigator)
 *
 * Elementor-style "Navigator" for the website visual editor: a collapsible tree
 * of the page structure — Sections → Columns → Widgets — docked in the editor.
 * Each row can select, show/hide, duplicate and delete its element, and sections
 * + widgets can be dragged to reorder.
 *
 * This component is PURELY presentational. It never mutates the page and never
 * fetches data — it renders `props.page` and emits the caller's callbacks. The
 * parent (editor page) owns every mutation.
 */

'use client';

import * as React from 'react';
import { useMemo, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronRight,
  ChevronDown,
  Eye,
  EyeOff,
  Copy,
  Trash2,
  GripVertical,
  LayoutGrid,
  Columns,
  Square,
  Layers as LayersIcon,
  X,
} from 'lucide-react';
import type { Page, PageColumn, Widget, WidgetType } from '@/types/website';
import type { WidgetParent, WidgetDestination } from '@/lib/website-builder/page-tree-ops';
import { widgetDefinitions, isContainerType } from '@/lib/website-builder/widget-definitions';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ===========================================================================
// Public API
// ===========================================================================

export type LayerTarget =
  | { kind: 'section'; sectionId: string }
  | { kind: 'column'; sectionId: string; columnIndex: number }
  | { kind: 'widget'; sectionId: string; columnIndex: number; widgetId: string };

export type LayerReorder =
  | { kind: 'section'; sectionId: string; toIndex: number }
  | { kind: 'widget'; widgetId: string; to: WidgetDestination };

export interface LayersPanelProps {
  page: Page;
  /** id of the currently-selected section OR widget (so the matching row highlights) */
  selectedId: string | null;
  onSelect: (target: LayerTarget) => void;
  onToggleHidden: (target: LayerTarget) => void;
  onDuplicate: (target: LayerTarget) => void;
  onDelete: (target: LayerTarget) => void;
  onReorder: (move: LayerReorder) => void;
  /** optional: collapse the whole panel */
  onClose?: () => void;
}

// ===========================================================================
// Sortable-id encoding helpers
// ===========================================================================
// dnd-kit ids must be unique strings. We prefix by kind so a single DndContext
// can host both section sorting and widget sorting without id collisions.

const SECTION_PREFIX = 'sec:';
const WIDGET_PREFIX = 'wid:';
const COLUMN_PREFIX = 'col:';
const CONTAINER_PREFIX = 'cont:';

const sectionDragId = (sectionId: string): string => `${SECTION_PREFIX}${sectionId}`;
const widgetDragId = (widgetId: string): string => `${WIDGET_PREFIX}${widgetId}`;
const columnDropId = (sectionId: string, columnIndex: number): string =>
  `${COLUMN_PREFIX}${sectionId}:${columnIndex}`;
const containerDropId = (containerId: string): string => `${CONTAINER_PREFIX}${containerId}`;

/** Where a widget currently lives: its parent (column or container) + index. */
type WidgetLocation = WidgetDestination;

/** Recursively record every widget's location (parent + index), keyed by id. */
function collectWidgetLocations(
  widgets: Widget[],
  parent: WidgetParent,
  map: Map<string, WidgetLocation>,
): void {
  widgets.forEach((widget, index) => {
    map.set(widget.id, { parent, index });
    if (widget.children && widget.children.length > 0) {
      collectWidgetLocations(widget.children, { kind: 'container', containerId: widget.id }, map);
    }
  });
}

// ===========================================================================
// Label helpers
// ===========================================================================

const WIDGET_SNIPPET_KEYS = ['text', 'heading', 'title', 'label', 'content', 'buttonText', 'subtitle'];

function widgetLabel(type: WidgetType): string {
  const def = widgetDefinitions[type];
  if (def?.label) {
    return def.label;
  }
  return type
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function widgetSnippet(widget: Widget): string {
  const data = widget.data;
  for (const key of WIDGET_SNIPPET_KEYS) {
    const value = data[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed.length > 32 ? `${trimmed.slice(0, 32)}…` : trimmed;
      }
    }
  }
  return '';
}

// ===========================================================================
// Panel
// ===========================================================================

export function LayersPanel(props: LayersPanelProps): React.JSX.Element {
  const { page, selectedId, onSelect, onToggleHidden, onDuplicate, onDelete, onReorder, onClose } = props;

  // Collapse state — sections/columns are expanded unless their id is in here.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const toggleCollapse = (id: string): void => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Flat lookup of every widget's location, keyed by widget id — used to resolve
  // drag targets back to a { sectionId, columnIndex, index } tuple.
  const widgetLocations = useMemo<Map<string, WidgetLocation>>(() => {
    const map = new Map<string, WidgetLocation>();
    page.content.forEach((section) => {
      section.columns.forEach((column, columnIndex) => {
        collectWidgetLocations(
          column.widgets,
          { kind: 'column', sectionId: section.id, columnIndex },
          map,
        );
      });
    });
    return map;
  }, [page.content]);

  // Resolve a container widget by id (to append when dropping onto its zone).
  const containersById = useMemo<Map<string, Widget>>(() => {
    const map = new Map<string, Widget>();
    const walk = (widgets: Widget[]): void => {
      for (const widget of widgets) {
        if (widget.children) {
          map.set(widget.id, widget);
          walk(widget.children);
        }
      }
    };
    page.content.forEach((section) => section.columns.forEach((c) => walk(c.widgets)));
    return map;
  }, [page.content]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragStart = (event: DragStartEvent): void => {
    setActiveDragId(String(event.active.id));
  };

  const handleDragEnd = (event: DragEndEvent): void => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) {
      return;
    }
    const activeId = String(active.id);
    const overId = String(over.id);
    if (activeId === overId) {
      return;
    }

    // --- Section → Section reorder ---
    if (activeId.startsWith(SECTION_PREFIX)) {
      if (!overId.startsWith(SECTION_PREFIX)) {
        return;
      }
      const sectionId = activeId.slice(SECTION_PREFIX.length);
      const overSectionId = overId.slice(SECTION_PREFIX.length);
      const toIndex = page.content.findIndex((s) => s.id === overSectionId);
      if (toIndex < 0) {
        return;
      }
      onReorder({ kind: 'section', sectionId, toIndex });
      return;
    }

    // --- Widget → Widget / Column / Container reorder (cross-parent moves) ---
    if (activeId.startsWith(WIDGET_PREFIX)) {
      const widgetId = activeId.slice(WIDGET_PREFIX.length);

      // Dropped over another widget: insert at that widget's slot (its parent).
      if (overId.startsWith(WIDGET_PREFIX)) {
        const overWidgetId = overId.slice(WIDGET_PREFIX.length);
        const dest = widgetLocations.get(overWidgetId);
        if (!dest) {
          return;
        }
        onReorder({ kind: 'widget', widgetId, to: dest });
        return;
      }

      // Dropped over a (possibly empty) column: append to its end.
      if (overId.startsWith(COLUMN_PREFIX)) {
        const rest = overId.slice(COLUMN_PREFIX.length);
        const sepIndex = rest.lastIndexOf(':');
        if (sepIndex < 0) {
          return;
        }
        const sectionId = rest.slice(0, sepIndex);
        const columnIndex = Number.parseInt(rest.slice(sepIndex + 1), 10);
        if (Number.isNaN(columnIndex)) {
          return;
        }
        const section = page.content.find((s) => s.id === sectionId);
        const column = section?.columns[columnIndex];
        const index = column ? column.widgets.length : 0;
        onReorder({
          kind: 'widget',
          widgetId,
          to: { parent: { kind: 'column', sectionId, columnIndex }, index },
        });
        return;
      }

      // Dropped over a container's child zone: append into that container.
      if (overId.startsWith(CONTAINER_PREFIX)) {
        const containerId = overId.slice(CONTAINER_PREFIX.length);
        if (containerId === widgetId) {
          return;
        }
        const container = containersById.get(containerId);
        const index = container?.children ? container.children.length : 0;
        onReorder({
          kind: 'widget',
          widgetId,
          to: { parent: { kind: 'container', containerId }, index },
        });
      }
    }
  };

  const sectionIds = page.content.map((s) => sectionDragId(s.id));

  return (
    <div
      className="flex h-full w-72 flex-col overflow-hidden border-l border-border-light bg-card text-foreground"
      aria-label="Layers navigator"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-light px-3 py-2.5">
        <div className="flex items-center gap-2">
          <LayersIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-foreground">Layers</span>
        </div>
        {onClose && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
            onClick={onClose}
            aria-label="Close layers panel"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </Button>
        )}
      </div>

      {/* Tree */}
      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {page.content.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            This page has no sections yet. Add a section to start building.
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
              {page.content.map((section, sectionIndex) => (
                <SectionRow
                  key={section.id}
                  section={section}
                  sectionIndex={sectionIndex}
                  selectedId={selectedId}
                  collapsed={collapsed}
                  onToggleCollapse={toggleCollapse}
                  onSelect={onSelect}
                  onToggleHidden={onToggleHidden}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                  isDragging={activeDragId === sectionDragId(section.id)}
                />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

// ===========================================================================
// Section row
// ===========================================================================

interface SectionRowProps {
  section: Page['content'][number];
  sectionIndex: number;
  selectedId: string | null;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  onSelect: (target: LayerTarget) => void;
  onToggleHidden: (target: LayerTarget) => void;
  onDuplicate: (target: LayerTarget) => void;
  onDelete: (target: LayerTarget) => void;
  isDragging: boolean;
}

function SectionRow({
  section,
  sectionIndex,
  selectedId,
  collapsed,
  onToggleCollapse,
  onSelect,
  onToggleHidden,
  onDuplicate,
  onDelete,
  isDragging,
}: SectionRowProps): React.JSX.Element {
  const sortable = useSortable({ id: sectionDragId(section.id) });
  const isCollapsed = collapsed.has(section.id);
  const isSelected = selectedId === section.id;
  const label = section.name && section.name.trim().length > 0 ? section.name : `Section ${sectionIndex + 1}`;
  const target: LayerTarget = { kind: 'section', sectionId: section.id };
  const childCount = section.columns.reduce((sum, c) => sum + c.widgets.length, 0);

  // Sections contain children, so deleting one asks for an explicit inline
  // confirmation rather than firing onDelete on the first click.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn('select-none', isDragging && 'opacity-50')}
    >
      <TreeRow
        depth={0}
        icon={<LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
        label={label}
        selected={isSelected}
        expandable
        collapsed={isCollapsed}
        onToggleCollapse={() => onToggleCollapse(section.id)}
        onSelect={() => onSelect(target)}
        dragHandleProps={{ ...sortable.attributes, ...sortable.listeners }}
        actions={
          <RowActions
            onDuplicate={() => onDuplicate(target)}
            onDelete={() => setConfirmingDelete(true)}
            duplicateLabel={`Duplicate ${label}`}
            deleteLabel={`Delete ${label}`}
          />
        }
      />

      {confirmingDelete && (
        <div
          className="flex items-center justify-between gap-2 border-y border-destructive/40 bg-destructive/10 py-1.5 pr-2"
          style={{ paddingLeft: depthPadding(0) }}
          role="alertdialog"
          aria-label={`Confirm delete ${label}`}
        >
          <span className="truncate text-[0.7rem] text-foreground">
            Delete {label}
            {childCount > 0 ? ` and ${childCount} widget${childCount === 1 ? '' : 's'}?` : '?'}
          </span>
          <span className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-6 px-2 text-[0.7rem]"
              onClick={() => {
                setConfirmingDelete(false);
                onDelete(target);
              }}
            >
              Delete
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[0.7rem] text-muted-foreground"
              onClick={() => setConfirmingDelete(false)}
            >
              Cancel
            </Button>
          </span>
        </div>
      )}

      {!isCollapsed &&
        section.columns.map((column, columnIndex) => (
          <ColumnRow
            key={column.id}
            sectionId={section.id}
            column={column}
            columnIndex={columnIndex}
            selectedId={selectedId}
            collapsed={collapsed}
            onToggleCollapse={onToggleCollapse}
            onSelect={onSelect}
            onToggleHidden={onToggleHidden}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

// ===========================================================================
// Column row (not reorderable — droppable target for widgets)
// ===========================================================================

interface ColumnRowProps {
  sectionId: string;
  column: PageColumn;
  columnIndex: number;
  selectedId: string | null;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  onSelect: (target: LayerTarget) => void;
  onToggleHidden: (target: LayerTarget) => void;
  onDuplicate: (target: LayerTarget) => void;
  onDelete: (target: LayerTarget) => void;
}

function ColumnRow({
  sectionId,
  column,
  columnIndex,
  selectedId,
  collapsed,
  onToggleCollapse,
  onSelect,
  onToggleHidden,
  onDuplicate,
  onDelete,
}: ColumnRowProps): React.JSX.Element {
  const collapseKey = `${sectionId}:col:${column.id}`;
  const isCollapsed = collapsed.has(collapseKey);
  const target: LayerTarget = { kind: 'column', sectionId, columnIndex };
  const { setNodeRef, isOver } = useDroppable({ id: columnDropId(sectionId, columnIndex) });
  const widgetIds = column.widgets.map((w) => widgetDragId(w.id));

  return (
    <div>
      <TreeRow
        depth={1}
        icon={<Columns className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
        label={`Column ${columnIndex + 1}`}
        meta={`${Math.round(column.width)}%`}
        selected={false}
        expandable
        collapsed={isCollapsed}
        onToggleCollapse={() => onToggleCollapse(collapseKey)}
        onSelect={() => onSelect(target)}
        actions={
          <RowActions
            onDuplicate={() => onDuplicate(target)}
            onDelete={() => onDelete(target)}
            duplicateLabel={`Duplicate column ${columnIndex + 1}`}
            deleteLabel={`Delete column ${columnIndex + 1}`}
          />
        }
      />

      {!isCollapsed && (
        <div ref={setNodeRef} className={cn(isOver && 'bg-surface-elevated/60')}>
          <SortableContext items={widgetIds} strategy={verticalListSortingStrategy}>
            {column.widgets.length === 0 ? (
              <div
                className="py-1.5 pr-2 text-xs italic text-muted-foreground"
                style={{ paddingLeft: depthPadding(2) }}
              >
                (empty)
              </div>
            ) : (
              column.widgets.map((widget) => (
                <WidgetRow
                  key={widget.id}
                  sectionId={sectionId}
                  columnIndex={columnIndex}
                  depth={2}
                  widget={widget}
                  selectedId={selectedId}
                  collapsed={collapsed}
                  onToggleCollapse={onToggleCollapse}
                  onSelect={onSelect}
                  onToggleHidden={onToggleHidden}
                  onDuplicate={onDuplicate}
                  onDelete={onDelete}
                />
              ))
            )}
          </SortableContext>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Widget row (reorderable)
// ===========================================================================

interface WidgetRowProps {
  sectionId: string;
  columnIndex: number;
  depth: number;
  widget: Widget;
  selectedId: string | null;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  onSelect: (target: LayerTarget) => void;
  onToggleHidden: (target: LayerTarget) => void;
  onDuplicate: (target: LayerTarget) => void;
  onDelete: (target: LayerTarget) => void;
}

function WidgetRow({
  sectionId,
  columnIndex,
  depth,
  widget,
  selectedId,
  collapsed,
  onToggleCollapse,
  onSelect,
  onToggleHidden,
  onDuplicate,
  onDelete,
}: WidgetRowProps): React.JSX.Element {
  const sortable = useSortable({ id: widgetDragId(widget.id) });
  const isSelected = selectedId === widget.id;
  const isHidden = widget.hidden === true;
  const isContainer = isContainerType(widget.type);
  const label = widgetLabel(widget.type);
  const snippet = widgetSnippet(widget);
  const target: LayerTarget = { kind: 'widget', sectionId, columnIndex, widgetId: widget.id };
  const isCollapsed = collapsed.has(widget.id);
  const children = widget.children ?? [];

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
  };

  return (
    <div ref={sortable.setNodeRef} style={style} className={cn('select-none', sortable.isDragging && 'opacity-50')}>
      <TreeRow
        depth={depth}
        icon={
          isContainer ? (
            <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          ) : (
            <Square className="h-3 w-3 text-muted-foreground" aria-hidden />
          )
        }
        label={label}
        meta={snippet}
        dimmed={isHidden}
        struck={isHidden}
        selected={isSelected}
        expandable={isContainer}
        collapsed={isCollapsed}
        onToggleCollapse={() => onToggleCollapse(widget.id)}
        onSelect={() => onSelect(target)}
        dragHandleProps={{ ...sortable.attributes, ...sortable.listeners }}
        actions={
          <RowActions
            hidden={isHidden}
            onToggleHidden={() => onToggleHidden(target)}
            onDuplicate={() => onDuplicate(target)}
            onDelete={() => onDelete(target)}
            toggleHiddenLabel={`${isHidden ? 'Show' : 'Hide'} ${label}`}
            duplicateLabel={`Duplicate ${label}`}
            deleteLabel={`Delete ${label}`}
          />
        }
      />

      {isContainer && !isCollapsed && (
        <ContainerChildren
          containerId={widget.id}
          sectionId={sectionId}
          columnIndex={columnIndex}
          depth={depth + 1}
          widgets={children}
          selectedId={selectedId}
          collapsed={collapsed}
          onToggleCollapse={onToggleCollapse}
          onSelect={onSelect}
          onToggleHidden={onToggleHidden}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Container children (droppable zone + sortable list of nested widget rows)
// ===========================================================================

interface ContainerChildrenProps {
  containerId: string;
  sectionId: string;
  columnIndex: number;
  depth: number;
  widgets: Widget[];
  selectedId: string | null;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  onSelect: (target: LayerTarget) => void;
  onToggleHidden: (target: LayerTarget) => void;
  onDuplicate: (target: LayerTarget) => void;
  onDelete: (target: LayerTarget) => void;
}

function ContainerChildren({
  containerId,
  sectionId,
  columnIndex,
  depth,
  widgets,
  selectedId,
  collapsed,
  onToggleCollapse,
  onSelect,
  onToggleHidden,
  onDuplicate,
  onDelete,
}: ContainerChildrenProps): React.JSX.Element {
  const { setNodeRef, isOver } = useDroppable({ id: containerDropId(containerId) });
  const widgetIds = widgets.map((w) => widgetDragId(w.id));

  return (
    <div ref={setNodeRef} className={cn(isOver && 'bg-surface-elevated/60')}>
      <SortableContext items={widgetIds} strategy={verticalListSortingStrategy}>
        {widgets.length === 0 ? (
          <div
            className="py-1.5 pr-2 text-xs italic text-muted-foreground"
            style={{ paddingLeft: depthPadding(depth) }}
          >
            (empty — drop widgets here)
          </div>
        ) : (
          widgets.map((child) => (
            <WidgetRow
              key={child.id}
              sectionId={sectionId}
              columnIndex={columnIndex}
              depth={depth}
              widget={child}
              selectedId={selectedId}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              onSelect={onSelect}
              onToggleHidden={onToggleHidden}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))
        )}
      </SortableContext>
    </div>
  );
}

// ===========================================================================
// Generic tree row
// ===========================================================================

/** Left indent per tree depth (px). */
function depthPadding(depth: number): number {
  return 8 + depth * 14;
}

interface DragHandleProps {
  [key: string]: unknown;
}

interface TreeRowProps {
  depth: number;
  icon: React.ReactNode;
  label: string;
  meta?: string;
  selected: boolean;
  dimmed?: boolean;
  struck?: boolean;
  expandable?: boolean;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onSelect: () => void;
  dragHandleProps?: DragHandleProps;
  actions?: React.ReactNode;
}

function TreeRow({
  depth,
  icon,
  label,
  meta,
  selected,
  dimmed,
  struck,
  expandable,
  collapsed,
  onToggleCollapse,
  onSelect,
  dragHandleProps,
  actions,
}: TreeRowProps): React.JSX.Element {
  return (
    <div
      className={cn(
        'group/row flex items-center gap-1 pr-1.5 transition-colors',
        selected ? 'bg-primary/15 text-foreground' : 'hover:bg-surface-elevated',
      )}
      style={{ paddingLeft: depthPadding(depth) }}
    >
      {/* Drag handle (widgets + sections). Reserved-width slot keeps rows aligned. */}
      <span className="flex w-4 shrink-0 items-center justify-center">
        {dragHandleProps ? (
          <button
            type="button"
            className="cursor-grab text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none group-hover/row:opacity-100 active:cursor-grabbing"
            aria-label={`Drag ${label}`}
            {...dragHandleProps}
          >
            <GripVertical className="h-3.5 w-3.5" aria-hidden />
          </button>
        ) : null}
      </span>

      {/* Expand / collapse caret (reserved width even when not expandable). */}
      <span className="flex w-4 shrink-0 items-center justify-center">
        {expandable ? (
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            onClick={onToggleCollapse}
            aria-label={collapsed ? `Expand ${label}` : `Collapse ${label}`}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        ) : null}
      </span>

      {/* Selectable label area */}
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          dimmed && 'opacity-50',
        )}
      >
        <span className="shrink-0">{icon}</span>
        <span className={cn('truncate text-xs', struck ? 'line-through text-muted-foreground' : 'text-foreground')}>
          {label}
        </span>
        {meta && meta.length > 0 && (
          <span className="truncate text-[0.65rem] text-muted-foreground">{meta}</span>
        )}
      </button>

      {/* Hover/focus-revealed actions */}
      {actions && (
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover/row:opacity-100">
          {actions}
        </span>
      )}
    </div>
  );
}

// ===========================================================================
// Row action buttons
// ===========================================================================

interface RowActionsProps {
  hidden?: boolean;
  onToggleHidden?: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  toggleHiddenLabel?: string;
  duplicateLabel: string;
  deleteLabel: string;
}

function RowActions({
  hidden,
  onToggleHidden,
  onDuplicate,
  onDelete,
  toggleHiddenLabel,
  duplicateLabel,
  deleteLabel,
}: RowActionsProps): React.JSX.Element {
  return (
    <>
      {onToggleHidden && (
        <IconAction onClick={onToggleHidden} label={toggleHiddenLabel ?? (hidden ? 'Show' : 'Hide')}>
          {hidden ? <EyeOff className="h-3.5 w-3.5" aria-hidden /> : <Eye className="h-3.5 w-3.5" aria-hidden />}
        </IconAction>
      )}
      <IconAction onClick={onDuplicate} label={duplicateLabel}>
        <Copy className="h-3.5 w-3.5" aria-hidden />
      </IconAction>
      <IconAction onClick={onDelete} label={deleteLabel} destructive>
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </IconAction>
    </>
  );
}

interface IconActionProps {
  onClick: () => void;
  label: string;
  destructive?: boolean;
  children: React.ReactNode;
}

function IconAction({ onClick, label, destructive, children }: IconActionProps): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn(
        'h-6 w-6 text-muted-foreground hover:text-foreground',
        destructive && 'hover:text-destructive',
      )}
      onClick={(e) => {
        // Keep clicks off the row's select handler.
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}
