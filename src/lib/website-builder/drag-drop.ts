/**
 * Drag and Drop Utilities
 * Handles drag-drop logic for page builder
 */

import { Widget, PageSection } from '@/types/website';

export interface DragData {
  type: 'widget' | 'section';
  widgetType?: string;
  widget?: Widget;
  sectionId?: string;
  widgetId?: string;
}

export interface DropZone {
  sectionId: string;
  columnIndex: number;
  insertIndex?: number;
}

/**
 * Start dragging a widget from the library
 */
export function handleDragStart(
  e: React.DragEvent,
  data: DragData
) {
  e.dataTransfer.effectAllowed = 'copy';
  e.dataTransfer.setData('application/json', JSON.stringify(data));
}

/**
 * Handle drag over drop zone
 */
export function handleDragOver(e: React.DragEvent) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}

/**
 * Handle drop
 */
export function handleDrop(
  e: React.DragEvent,
  dropZone: DropZone,
  onDrop: (data: DragData, zone: DropZone) => void
) {
  e.preventDefault();
  e.stopPropagation();

  try {
    const dataStr = e.dataTransfer.getData('application/json');
    if (!dataStr) return;

    const data: DragData = JSON.parse(dataStr);
    onDrop(data, dropZone);
  } catch (error) {
    console.error('[DragDrop] Error handling drop:', error);
  }
}

/**
 * Reorder widgets within a column
 */
export function reorderWidgets(
  widgets: Widget[],
  fromIndex: number,
  toIndex: number
): Widget[] {
  const result = Array.from(widgets);
  const [removed] = result.splice(fromIndex, 1);
  result.splice(toIndex, 0, removed);
  return result;
}

/**
 * Move widget between columns
 */
export function moveWidgetBetweenColumns(
  sourceWidgets: Widget[],
  destWidgets: Widget[],
  sourceIndex: number,
  destIndex: number
): { source: Widget[]; dest: Widget[] } {
  const sourceCopy = Array.from(sourceWidgets);
  const destCopy = Array.from(destWidgets);

  const [movedWidget] = sourceCopy.splice(sourceIndex, 1);
  destCopy.splice(destIndex, 0, movedWidget);

  return {
    source: sourceCopy,
    dest: destCopy,
  };
}

/**
 * Clone widget (for dragging from library)
 */
export function cloneWidget(widget: Widget): Widget {
  return {
    ...widget,
    id: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  };
}

