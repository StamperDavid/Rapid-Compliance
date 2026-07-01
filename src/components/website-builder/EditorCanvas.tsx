/**
 * Editor Canvas
 *
 * Thin wrapper that preserves the editor's existing prop contract while
 * delegating all drawing to {@link EditableCanvas}, which renders through the
 * SAME engine the live site uses (`ResponsiveRenderer`). This makes the canvas
 * a true WYSIWYG: what you see in the editor is exactly what publishes, with no
 * gray "<type> widget" placeholder boxes.
 *
 * The external props are unchanged so `editor/page.tsx` needs no edits.
 */

'use client';

import type { Page, PageSection, Widget } from '@/types/website';
import type { SiteChrome, ChromeRegion } from '@/lib/website-builder/site-chrome-types';
import type { WidgetDestination } from '@/lib/website-builder/page-tree-ops';
import EditableCanvas from '@/components/website-builder/EditableCanvas';

interface SelectedElement {
  type: 'section' | 'widget';
  sectionId: string;
  widgetId?: string;
}

interface EditorCanvasProps {
  page: Page;
  breakpoint: 'desktop' | 'tablet' | 'mobile';
  selectedElement: SelectedElement | null;
  onSelectElement: (element: SelectedElement) => void;
  onAddSection: (sectionData?: Partial<PageSection>) => void;
  // Open the structure picker → build + insert a section with N columns (1..6).
  onAddSectionWithStructure?: (columnCount: number, widths?: number[], atIndex?: number) => void;
  onUpdateSection: (sectionId: string, updates: Partial<PageSection>) => void;
  onDeleteSection: (sectionId: string) => void;
  // Save the selected section to the block library (wired during integration).
  onSaveSectionAsBlock?: (sectionId: string) => void;
  onAddWidget: (sectionId: string, widget: Widget, columnIndex?: number) => void;
  // Insert a widget INTO a container widget's children (true nesting).
  onAddWidgetToContainer?: (containerId: string, widget: Widget, index?: number) => void;
  onUpdateWidget: (sectionId: string, widgetId: string, updates: Partial<Widget>) => void;
  onDeleteWidget: (sectionId: string, widgetId: string) => void;
  // Layout engine (drag-to-reorder + duplicate / hide) — forwarded to EditableCanvas.
  onMoveWidget?: (widgetId: string, dest: WidgetDestination) => void;
  onMoveSection?: (sectionId: string, toIndex: number) => void;
  onDuplicateWidget?: (widgetId: string) => void;
  onDuplicateSection?: (sectionId: string) => void;
  onToggleWidgetHidden?: (widgetId: string) => void;
  // Site chrome (banner / header / footer) — forwarded straight to EditableCanvas.
  chrome?: SiteChrome | null;
  editable?: boolean;
  selectedRegion?: ChromeRegion | null;
  onSelectRegion?: (region: ChromeRegion) => void;
}

export default function EditorCanvas({
  page,
  breakpoint,
  selectedElement,
  onSelectElement,
  onAddSection,
  onAddSectionWithStructure,
  onUpdateSection: _onUpdateSection,
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
}: EditorCanvasProps) {
  // Section property edits flow through PropertiesPanel (onUpdateSection), so the
  // canvas doesn't need that handler. Widget text edits, however, happen INLINE on
  // the canvas (double-click a text widget), so `onUpdateWidget` is forwarded to
  // EditableCanvas as the write-back path for in-place text editing.
  return (
    <EditableCanvas
      page={page}
      breakpoint={breakpoint}
      selectedElement={selectedElement}
      onSelectElement={onSelectElement}
      onAddSection={onAddSection}
      onAddSectionWithStructure={onAddSectionWithStructure}
      onDeleteSection={onDeleteSection}
      onSaveSectionAsBlock={onSaveSectionAsBlock}
      onAddWidget={onAddWidget}
      onAddWidgetToContainer={onAddWidgetToContainer}
      onUpdateWidget={onUpdateWidget}
      onDeleteWidget={onDeleteWidget}
      onMoveWidget={onMoveWidget}
      onMoveSection={onMoveSection}
      onDuplicateWidget={onDuplicateWidget}
      onDuplicateSection={onDuplicateSection}
      onToggleWidgetHidden={onToggleWidgetHidden}
      chrome={chrome}
      editable={editable}
      selectedRegion={selectedRegion}
      onSelectRegion={onSelectRegion}
    />
  );
}
