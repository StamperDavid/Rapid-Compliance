/**
 * Page Tree Operations
 *
 * Pure, immutable structural operations on the canonical `Page` model
 * (`Page.content: PageSection[]` → `PageSection.columns: PageColumn[]` →
 * `PageColumn.widgets: Widget[]`). Every function returns a BRAND-NEW `Page`
 * and never mutates its input — safe to feed straight into React `setState`
 * and the editor's undo/redo history.
 *
 * These are the single source of truth for moving / duplicating / deleting /
 * re-columning the page tree. The editor canvas (drag-and-drop), the Navigator
 * / Layers panel, and the keyboard shortcuts all funnel through here so the
 * model can never be corrupted (a widget is never silently dropped, ids never
 * collide).
 *
 * Id scheme: new ids are `${prefix}-${n}` where `n` is the smallest positive
 * integer that is not already used anywhere in the page — collision-safe within
 * a page and deterministic-ish (no Date.now()/random needed). Prefix is the
 * widget `type` for widgets, `section` for sections, `col` for columns.
 */

import type { Page, PageSection, PageColumn, Widget } from '@/types/website';

export interface WidgetLocation {
  sectionId: string;
  columnIndex: number;
  widgetIndex: number;
  widget: Widget;
}

// ---------------------------------------------------------------------------
// Id helpers
// ---------------------------------------------------------------------------

/** Collect every id used anywhere in the page (sections, columns, widgets). */
function collectIds(page: Page): Set<string> {
  const ids = new Set<string>();
  for (const section of page.content) {
    if (section.id) {
      ids.add(section.id);
    }
    for (const column of section.columns ?? []) {
      if (column.id) {
        ids.add(column.id);
      }
      for (const widget of column.widgets ?? []) {
        if (widget.id) {
          ids.add(widget.id);
        }
      }
    }
  }
  return ids;
}

/**
 * Produce a fresh id with the given prefix that is not present in `existing`,
 * and register it in `existing` so repeated calls within one operation stay
 * unique (used when deep-cloning a whole section's worth of nested ids).
 */
function makeUniqueId(existing: Set<string>, prefix: string): string {
  let n = existing.size + 1;
  let id = `${prefix}-${n}`;
  while (existing.has(id)) {
    n += 1;
    id = `${prefix}-${n}`;
  }
  existing.add(id);
  return id;
}

/** Structural deep clone for the JSON-serialisable page model. */
function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Even-split column widths (summing ~100) for a given count. */
function defaultWidths(count: number): number[] {
  switch (count) {
    case 1:
      return [100];
    case 2:
      return [50, 50];
    case 3:
      return [33.34, 33.33, 33.33];
    case 4:
      return [25, 25, 25, 25];
    default: {
      const even = Math.round((100 / count) * 100) / 100;
      return Array.from({ length: count }, () => even);
    }
  }
}

// ---------------------------------------------------------------------------
// Widget queries
// ---------------------------------------------------------------------------

export function findWidget(page: Page, widgetId: string): WidgetLocation | null {
  for (const section of page.content) {
    const columns = section.columns ?? [];
    for (let columnIndex = 0; columnIndex < columns.length; columnIndex += 1) {
      const widgets = columns[columnIndex]?.widgets ?? [];
      for (let widgetIndex = 0; widgetIndex < widgets.length; widgetIndex += 1) {
        const widget = widgets[widgetIndex];
        if (widget?.id === widgetId) {
          return { sectionId: section.id, columnIndex, widgetIndex, widget };
        }
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Widget mutations
// ---------------------------------------------------------------------------

/**
 * Insert `widget` into `section`/`columnIndex` at `atIndex` (clamped; appended
 * when omitted). Column index is clamped to the section's real column range so
 * a stale index can never drop the widget. A section with no columns gets one.
 */
export function addWidget(
  page: Page,
  sectionId: string,
  columnIndex: number,
  widget: Widget,
  atIndex?: number,
): Page {
  const ids = collectIds(page);
  return {
    ...page,
    content: page.content.map((section) => {
      if (section.id !== sectionId) {
        return section;
      }
      const columns = section.columns ?? [];
      if (columns.length === 0) {
        return {
          ...section,
          columns: [{ id: makeUniqueId(ids, 'col'), width: 100, widgets: [widget] }],
        };
      }
      const ci = Math.max(0, Math.min(columnIndex, columns.length - 1));
      const newColumns = columns.map((column, i) => {
        if (i !== ci) {
          return column;
        }
        const widgets = [...column.widgets];
        const idx =
          atIndex === undefined ? widgets.length : Math.max(0, Math.min(atIndex, widgets.length));
        widgets.splice(idx, 0, widget);
        return { ...column, widgets };
      });
      return { ...section, columns: newColumns };
    }),
  };
}

/**
 * Move a widget to a new section/column/index. Removes it from its current
 * location first, then inserts at the destination (so `index` is the desired
 * final position in the post-removal column — the standard sortable contract).
 */
export function moveWidget(
  page: Page,
  widgetId: string,
  dest: { sectionId: string; columnIndex: number; index: number },
): Page {
  const loc = findWidget(page, widgetId);
  if (!loc) {
    return page;
  }
  const removed = deleteWidget(page, widgetId);
  return addWidget(removed, dest.sectionId, dest.columnIndex, loc.widget, dest.index);
}

/**
 * Deep-clone the widget (fresh id) and insert the copy directly after the
 * original in the same column. Returns the new page and the clone's id.
 */
export function duplicateWidget(page: Page, widgetId: string): { page: Page; newWidgetId: string } {
  const loc = findWidget(page, widgetId);
  if (!loc) {
    return { page, newWidgetId: '' };
  }
  const ids = collectIds(page);
  const clone = deepClone(loc.widget);
  clone.id = makeUniqueId(ids, loc.widget.type);
  const next = addWidget(page, loc.sectionId, loc.columnIndex, clone, loc.widgetIndex + 1);
  return { page: next, newWidgetId: clone.id };
}

export function deleteWidget(page: Page, widgetId: string): Page {
  return {
    ...page,
    content: page.content.map((section) => ({
      ...section,
      columns: (section.columns ?? []).map((column) => ({
        ...column,
        widgets: column.widgets.filter((w) => w.id !== widgetId),
      })),
    })),
  };
}

export function setWidgetHidden(page: Page, widgetId: string, hidden: boolean): Page {
  return {
    ...page,
    content: page.content.map((section) => ({
      ...section,
      columns: (section.columns ?? []).map((column) => ({
        ...column,
        widgets: column.widgets.map((w) => (w.id === widgetId ? { ...w, hidden } : w)),
      })),
    })),
  };
}

// ---------------------------------------------------------------------------
// Section mutations
// ---------------------------------------------------------------------------

/** Build a fresh, empty single-column section (optionally seeded from a partial). */
function buildEmptySection(ids: Set<string>, partial?: Partial<PageSection>): PageSection {
  const base: PageSection = {
    id: makeUniqueId(ids, 'section'),
    type: 'section',
    columns: [{ id: makeUniqueId(ids, 'col'), width: 100, widgets: [] }],
    padding: { top: '2rem', bottom: '2rem' },
  };
  if (!partial) {
    return base;
  }
  // Honour an explicit columns override, but never let the partial blank out
  // the required id/type.
  return {
    ...base,
    ...partial,
    id: base.id,
    type: 'section',
    columns: partial.columns && partial.columns.length > 0 ? partial.columns : base.columns,
  };
}

/**
 * Build a fresh, fully-formed section with `columnCount` (clamped 1..6) empty
 * columns and collision-safe ids (unique *within the returned section*). Widths
 * come from `widths` when its length matches the count, otherwise an even split.
 * An optional `section` partial seeds styling/metadata (its `columns` override is
 * honoured when non-empty). Pair with {@link insertSection}, which re-ids the
 * whole subtree against the destination page so a build → insert can never
 * collide with existing ids.
 */
export function buildSection(
  columnCount: number,
  widths?: number[],
  section?: Partial<PageSection>,
): PageSection {
  const count = Math.max(1, Math.min(6, Math.round(columnCount)));
  const resolvedWidths = widths?.length === count ? widths : defaultWidths(count);
  const ids = new Set<string>();
  const columns: PageColumn[] = Array.from({ length: count }, (_, i) => ({
    id: makeUniqueId(ids, 'col'),
    width: resolvedWidths[i] ?? Math.round((100 / count) * 100) / 100,
    widgets: [],
  }));
  const base: PageSection = {
    id: makeUniqueId(ids, 'section'),
    type: 'section',
    columns,
    padding: { top: '2rem', bottom: '2rem' },
  };
  if (!section) {
    return base;
  }
  return {
    ...base,
    ...section,
    id: base.id,
    type: 'section',
    columns: section.columns && section.columns.length > 0 ? section.columns : base.columns,
  };
}

export function addSection(page: Page, atIndex?: number, section?: Partial<PageSection>): Page {
  const ids = collectIds(page);
  const newSection = buildEmptySection(ids, section);
  const content = [...page.content];
  const idx = atIndex === undefined ? content.length : Math.max(0, Math.min(atIndex, content.length));
  content.splice(idx, 0, newSection);
  return { ...page, content };
}

/**
 * Insert a fully-formed `section` into the page at `atIndex` (default: end).
 * The section is deep-cloned and given fresh, collision-safe ids for itself, all
 * its columns, and every nested widget — so re-inserting the SAME block object
 * repeatedly (e.g. from the block library) can never produce duplicate ids.
 * Pure/immutable: returns a brand-new Page. This is the primitive the block
 * library reuses to drop a saved section onto the canvas.
 */
export function insertSection(page: Page, section: PageSection, atIndex?: number): Page {
  const ids = collectIds(page);
  const clone = deepClone(section);
  clone.id = makeUniqueId(ids, 'section');
  clone.type = 'section';
  clone.columns = (clone.columns ?? []).map((column) => ({
    ...column,
    id: makeUniqueId(ids, 'col'),
    widgets: (column.widgets ?? []).map((widget) => ({
      ...widget,
      id: makeUniqueId(ids, widget.type),
    })),
  }));
  const content = [...page.content];
  const idx = atIndex === undefined ? content.length : Math.max(0, Math.min(atIndex, content.length));
  content.splice(idx, 0, clone);
  return { ...page, content };
}

export function moveSection(page: Page, sectionId: string, toIndex: number): Page {
  const from = page.content.findIndex((s) => s.id === sectionId);
  if (from < 0) {
    return page;
  }
  const content = [...page.content];
  const [moved] = content.splice(from, 1);
  if (!moved) {
    return page;
  }
  const idx = Math.max(0, Math.min(toIndex, content.length));
  content.splice(idx, 0, moved);
  return { ...page, content };
}

/**
 * Deep-clone an entire section — fresh section id, fresh column ids, fresh
 * widget ids — and insert it directly after the original.
 */
export function duplicateSection(page: Page, sectionId: string): { page: Page; newSectionId: string } {
  const index = page.content.findIndex((s) => s.id === sectionId);
  if (index < 0) {
    return { page, newSectionId: '' };
  }
  const ids = collectIds(page);
  const clone = deepClone(page.content[index]);
  const newSectionId = makeUniqueId(ids, 'section');
  clone.id = newSectionId;
  clone.columns = (clone.columns ?? []).map((column) => ({
    ...column,
    id: makeUniqueId(ids, 'col'),
    widgets: column.widgets.map((widget) => ({ ...widget, id: makeUniqueId(ids, widget.type) })),
  }));
  const content = [...page.content];
  content.splice(index + 1, 0, clone);
  return { page: { ...page, content }, newSectionId };
}

export function deleteSection(page: Page, sectionId: string): Page {
  return { ...page, content: page.content.filter((s) => s.id !== sectionId) };
}

// ---------------------------------------------------------------------------
// Column structure
// ---------------------------------------------------------------------------

/**
 * Set the number of columns in a section (clamped 1..6), redistributing
 * existing widgets so none are ever lost:
 *  - reducing: the removed columns' widgets are appended to the last surviving
 *    column (in order);
 *  - increasing: new empty columns are added.
 * Widths come from `widths` (when its length === count) or an even default.
 */
export function setColumnLayout(
  page: Page,
  sectionId: string,
  count: number,
  widths?: number[],
): Page {
  const target = Math.max(1, Math.min(6, Math.round(count)));
  const ids = collectIds(page);
  const resolvedWidths =
    widths?.length === target ? widths : defaultWidths(target);

  return {
    ...page,
    content: page.content.map((section) => {
      if (section.id !== sectionId) {
        return section;
      }
      const existing = section.columns ?? [];
      let columns: PageColumn[];

      if (existing.length === 0) {
        columns = Array.from({ length: target }, () => ({
          id: makeUniqueId(ids, 'col'),
          width: 0,
          widgets: [],
        }));
      } else if (target < existing.length) {
        // Keep the first `target` columns; fold the rest into the last survivor.
        const survivors = existing.slice(0, target).map((c) => ({ ...c, widgets: [...c.widgets] }));
        const removed = existing.slice(target);
        const lastSurvivor = survivors[survivors.length - 1];
        for (const col of removed) {
          lastSurvivor.widgets.push(...col.widgets);
        }
        columns = survivors;
      } else if (target > existing.length) {
        const extra = Array.from({ length: target - existing.length }, () => ({
          id: makeUniqueId(ids, 'col'),
          width: 0,
          widgets: [] as Widget[],
        }));
        columns = [...existing.map((c) => ({ ...c })), ...extra];
      } else {
        columns = existing.map((c) => ({ ...c }));
      }

      columns = columns.map((column, i) => ({ ...column, width: resolvedWidths[i] ?? column.width }));
      return { ...section, columns };
    }),
  };
}

/**
 * Set the widths of a section's existing columns (no add/remove). Widths are
 * applied by index; extra entries are ignored, missing entries leave the
 * column's current width untouched.
 */
export function setColumnWidths(page: Page, sectionId: string, widths: number[]): Page {
  return {
    ...page,
    content: page.content.map((section) => {
      if (section.id !== sectionId) {
        return section;
      }
      return {
        ...section,
        columns: (section.columns ?? []).map((column, i) =>
          widths[i] !== undefined ? { ...column, width: widths[i] } : column,
        ),
      };
    }),
  };
}
