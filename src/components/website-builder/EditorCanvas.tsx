/**
 * Editor Canvas
 * Center panel showing page preview with drag-drop
 */

'use client';

import { Page, PageSection, Widget } from '@/types/website';
import WidgetRenderer from '@/components/website-builder/WidgetRenderer';
import { widgetDefinitions } from '@/lib/website-builder/widget-definitions';

interface EditorCanvasProps {
  page: Page;
  breakpoint: 'desktop' | 'tablet' | 'mobile';
  selectedElement: {
    type: 'section' | 'widget';
    sectionId: string;
    widgetId?: string;
  } | null;
  onSelectElement: (element: any) => void;
  onAddSection: (sectionData?: Partial<PageSection>) => void;
  onUpdateSection: (sectionId: string, updates: Partial<PageSection>) => void;
  onDeleteSection: (sectionId: string) => void;
  onAddWidget: (sectionId: string, widget: Widget, columnIndex?: number) => void;
  onUpdateWidget: (sectionId: string, widgetId: string, updates: Partial<Widget>) => void;
  onDeleteWidget: (sectionId: string, widgetId: string) => void;
}

export default function EditorCanvas({
  page,
  breakpoint,
  selectedElement,
  onSelectElement,
  onAddSection,
  onUpdateSection,
  onDeleteSection,
  onAddWidget,
  onUpdateWidget,
  onDeleteWidget,
}: EditorCanvasProps) {
  // Canvas width based on breakpoint
  const canvasWidth = {
    desktop: '100%',
    tablet: '768px',
    mobile: '375px',
  }[breakpoint];

  const canvasStyles: React.CSSProperties = {
    width: canvasWidth,
    margin: '0 auto',
    minHeight: '600px',
    background: 'white',
    boxShadow: breakpoint !== 'desktop' ? '0 0 20px rgba(0,0,0,0.1)' : 'none',
  };

  return (
    <div style={{
      flex: 1,
      background: '#e9ecef',
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: '2rem',
    }}>
      {/* Canvas */}
      <div style={canvasStyles}>
        {page.content.length === 0 ? (
          // Empty state
          <div style={{
            padding: '4rem 2rem',
            textAlign: 'center',
            color: '#6c757d',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
            <h3 style={{ fontSize: '1.25rem', margin: '0 0 0.5rem', color: '#495057' }}>
              Empty Page
            </h3>
            <p style={{ margin: '0 0 1.5rem', fontSize: '0.875rem' }}>
              Add a section to get started
            </p>
            <button
              onClick={() => onAddSection()}
              style={{
                padding: '0.75rem 1.5rem',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
              }}
            >
              + Add Section
            </button>
          </div>
        ) : (
          // Render sections
          <>
            {page.content.map((section, sectionIndex) => (
              <SectionRenderer
                key={section.id}
                section={section}
                isSelected={selectedElement?.type === 'section' && selectedElement.sectionId === section.id}
                selectedWidgetId={selectedElement?.type === 'widget' && selectedElement.sectionId === section.id ? selectedElement.widgetId : undefined}
                onSelectSection={() => onSelectElement({ type: 'section', sectionId: section.id })}
                onSelectWidget={(widgetId) => onSelectElement({ type: 'widget', sectionId: section.id, widgetId })}
                onUpdateSection={(updates) => onUpdateSection(section.id, updates)}
                onDeleteSection={() => onDeleteSection(section.id)}
                onDeleteWidget={(widgetId) => onDeleteWidget(section.id, widgetId)}
              />
            ))}

            {/* Add Section Button */}
            <div style={{
              padding: '1rem',
              textAlign: 'center',
              borderTop: '2px dashed #dee2e6',
            }}>
              <button
                onClick={() => onAddSection()}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#f8f9fa',
                  color: '#495057',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                + Add Section
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

interface SectionRendererProps {
  section: PageSection;
  isSelected: boolean;
  selectedWidgetId?: string;
  onSelectSection: () => void;
  onSelectWidget: (widgetId: string) => void;
  onUpdateSection: (updates: Partial<PageSection>) => void;
  onDeleteSection: () => void;
  onDeleteWidget: (widgetId: string) => void;
}

function SectionRenderer({
  section,
  isSelected,
  selectedWidgetId,
  onSelectSection,
  onSelectWidget,
  onUpdateSection,
  onDeleteSection,
  onDeleteWidget,
}: SectionRendererProps) {
  const sectionStyles: React.CSSProperties = {
    position: 'relative',
    backgroundColor: section.backgroundColor || 'transparent',
    backgroundImage: section.backgroundImage ? `url(${section.backgroundImage})` : undefined,
    padding: `${section.padding?.top || '0'} ${section.padding?.right || '0'} ${section.padding?.bottom || '0'} ${section.padding?.left || '0'}`,
    margin: `${section.margin?.top || '0'} ${section.margin?.right || '0'} ${section.margin?.bottom || '0'} ${section.margin?.left || '0'}`,
    maxWidth: section.fullWidth ? '100%' : (section.maxWidth ? `${section.maxWidth}px` : '1200px'),
    marginLeft: section.fullWidth ? '0' : 'auto',
    marginRight: section.fullWidth ? '0' : 'auto',
    outline: isSelected ? '2px solid #007bff' : 'none',
    cursor: 'pointer',
  };

  return (
    <div
      style={sectionStyles}
      onClick={(e) => {
        e.stopPropagation();
        onSelectSection();
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.outline = '2px dashed #007bff';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.outline = 'none';
        }
      }}
    >
      {/* Section Controls */}
      {isSelected && (
        <div style={{
          position: 'absolute',
          top: '0.5rem',
          right: '0.5rem',
          display: 'flex',
          gap: '0.5rem',
          zIndex: 10,
        }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDeleteSection();
            }}
            style={{
              padding: '0.25rem 0.5rem',
              background: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Delete Section
          </button>
        </div>
      )}

      {/* Columns */}
      <div style={{
        display: 'flex',
        gap: '1rem',
      }}>
        {section.columns.map((column, colIndex) => (
          <div
            key={column.id}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.style.backgroundColor = '#e7f3ff';
            }}
            onDragLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              e.currentTarget.style.backgroundColor = 'transparent';

              const widgetType = e.dataTransfer.getData('widgetType');
              if (widgetType) {
                const definition = widgetDefinitions[widgetType as any];
                if (definition) {
                  const newWidget: Widget = {
                    id: `widget_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                    type: widgetType as any,
                    data: definition.defaultData || {},
                    style: definition.defaultStyle || {},
                  };
                  onAddWidget(section.id, newWidget, colIndex);
                }
              }
            }}
            style={{
              flex: column.width || 1,
              minHeight: column.widgets.length === 0 ? '100px' : 'auto',
              border: column.widgets.length === 0 ? '2px dashed #dee2e6' : 'none',
              borderRadius: '4px',
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              transition: 'background-color 0.2s',
            }}
          >
            {column.widgets.length === 0 ? (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#adb5bd',
                fontSize: '0.875rem',
              }}>
                Drop widgets here
              </div>
            ) : (
              column.widgets.map((widget) => (
                <div
                  key={widget.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectWidget(widget.id);
                  }}
                  style={{
                    position: 'relative',
                    outline: selectedWidgetId === widget.id ? '2px solid #28a745' : 'none',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedWidgetId !== widget.id) {
                      e.currentTarget.style.outline = '2px dashed #28a745';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedWidgetId !== widget.id) {
                      e.currentTarget.style.outline = 'none';
                    }
                  }}
                >
                  {/* Widget Controls */}
                  {selectedWidgetId === widget.id && (
                    <div style={{
                      position: 'absolute',
                      top: '0.25rem',
                      right: '0.25rem',
                      zIndex: 10,
                    }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteWidget(widget.id);
                        }}
                        style={{
                          padding: '0.25rem 0.5rem',
                          background: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                        }}
                      >
                        ×
                      </button>
                    </div>
                  )}

                  <WidgetRenderer widget={widget} />
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

