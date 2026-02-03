'use client';

/**
 * Form Canvas
 *
 * Drop zone and display area for form fields.
 * Handles drag-and-drop reordering and field selection.
 *
 * @module components/forms/FormCanvas
 * @version 1.0.0
 */

import { useState, useCallback } from 'react';
import type { FormFieldConfig, FormFieldType } from '@/lib/forms/types';

// ============================================================================
// TYPES
// ============================================================================

interface FormCanvasProps {
  fields: FormFieldConfig[];
  selectedFieldId: string | null;
  onFieldSelect: (fieldId: string | null) => void;
  onFieldDrop: (type: FormFieldType, dropIndex: number) => void;
  onFieldReorder: (sourceId: string, targetIndex: number) => void;
  onFieldDelete: (fieldId: string) => void;
  onFieldDuplicate: (fieldId: string) => void;
}

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    maxWidth: '720px',
    margin: '0 auto',
    minHeight: '400px',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    border: '2px dashed var(--color-border-light)',
    borderRadius: '1rem',
    backgroundColor: 'var(--color-bg-main)',
    textAlign: 'center' as const,
  },
  emptyIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#666',
    marginBottom: '0.5rem',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: '#555',
  },
  dropZone: {
    padding: '0.5rem',
    border: '2px dashed transparent',
    borderRadius: '0.5rem',
    transition: 'all 0.2s',
  },
  dropZoneActive: {
    border: '2px dashed var(--color-primary)',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  fieldWrapper: {
    marginBottom: '0.5rem',
  },
  fieldCard: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '1rem',
    backgroundColor: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  fieldCardSelected: {
    borderColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-bg-elevated)',
  },
  fieldCardHovered: {
    borderColor: '#444',
  },
  fieldDragHandle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    marginRight: '0.75rem',
    cursor: 'grab',
    color: '#666',
    fontSize: '1rem',
  },
  fieldContent: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#fff',
    marginBottom: '0.25rem',
  },
  fieldType: {
    fontSize: '0.75rem',
    color: '#666',
  },
  fieldPreview: {
    marginTop: '0.5rem',
    padding: '0.5rem',
    backgroundColor: 'var(--color-bg-paper)',
    borderRadius: '0.25rem',
  },
  fieldActions: {
    display: 'flex',
    gap: '0.25rem',
    marginLeft: '0.5rem',
    opacity: 0,
    transition: 'opacity 0.2s',
  },
  fieldActionsVisible: {
    opacity: 1,
  },
  actionButton: {
    padding: '0.375rem',
    fontSize: '0.75rem',
    color: '#999',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderRadius: '0.25rem',
  },
  actionButtonHover: {
    color: '#fff',
    backgroundColor: 'var(--color-border-light)',
  },
  actionButtonDelete: {
    color: 'var(--color-error-dark)',
  },
  dropIndicator: {
    height: '3px',
    backgroundColor: 'var(--color-primary)',
    borderRadius: '2px',
    margin: '0.25rem 0',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function FormCanvas({
  fields,
  selectedFieldId,
  onFieldSelect,
  onFieldDrop,
  onFieldReorder,
  onFieldDelete,
  onFieldDuplicate,
}: FormCanvasProps) {
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);

  // Handle drag over
  const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverIndex(index);
  }, []);

  // Handle drag leave
  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      setDragOverIndex(null);

      const fieldType = e.dataTransfer.getData('fieldType') as FormFieldType;
      const sourceFieldId = e.dataTransfer.getData('fieldId');

      if (sourceFieldId && sourceFieldId !== '') {
        // Reordering existing field
        onFieldReorder(sourceFieldId, index);
      } else if (fieldType) {
        // Dropping new field from palette
        onFieldDrop(fieldType, index);
      }
    },
    [onFieldDrop, onFieldReorder]
  );

  // Handle field drag start (for reordering)
  const handleFieldDragStart = useCallback(
    (e: React.DragEvent, fieldId: string) => {
      setDraggingFieldId(fieldId);
      e.dataTransfer.setData('fieldId', fieldId);
      e.dataTransfer.effectAllowed = 'move';
    },
    []
  );

  // Handle field drag end
  const handleFieldDragEnd = useCallback(() => {
    setDraggingFieldId(null);
    setDragOverIndex(null);
  }, []);

  // Empty state
  if (fields.length === 0) {
    return (
      <div
        style={styles.container}
        onDragOver={(e) => handleDragOver(e, 0)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, 0)}
      >
        <div
          style={{
            ...styles.emptyState,
            ...(dragOverIndex === 0 ? styles.dropZoneActive : {}),
          }}
        >
          <div style={styles.emptyIcon}>📝</div>
          <div style={styles.emptyTitle}>Start Building Your Form</div>
          <div style={styles.emptyText}>
            Drag and drop fields from the left panel to get started
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Top drop zone */}
      <DropZone
        index={0}
        isActive={dragOverIndex === 0}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      />

      {/* Fields */}
      {fields.map((field, index) => (
        <div key={field.id} style={styles.fieldWrapper}>
          <FieldCard
            field={field}
            isSelected={selectedFieldId === field.id}
            isDragging={draggingFieldId === field.id}
            onClick={() => onFieldSelect(field.id)}
            onDragStart={(e) => handleFieldDragStart(e, field.id)}
            onDragEnd={handleFieldDragEnd}
            onDelete={() => onFieldDelete(field.id)}
            onDuplicate={() => onFieldDuplicate(field.id)}
          />

          {/* Drop zone after each field */}
          <DropZone
            index={index + 1}
            isActive={dragOverIndex === index + 1}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          />
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// DROP ZONE SUB-COMPONENT
// ============================================================================

interface DropZoneProps {
  index: number;
  isActive: boolean;
  onDragOver: (e: React.DragEvent, index: number) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, index: number) => void;
}

function DropZone({ index, isActive, onDragOver, onDragLeave, onDrop }: DropZoneProps) {
  return (
    <div
      style={{
        ...styles.dropZone,
        ...(isActive ? styles.dropZoneActive : {}),
        minHeight: isActive ? '50px' : '10px',
      }}
      onDragOver={(e) => onDragOver(e, index)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, index)}
    >
      {isActive && <div style={styles.dropIndicator} />}
    </div>
  );
}

// ============================================================================
// FIELD CARD SUB-COMPONENT
// ============================================================================

interface FieldCardProps {
  field: FormFieldConfig;
  isSelected: boolean;
  isDragging: boolean;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function FieldCard({
  field,
  isSelected,
  isDragging,
  onClick,
  onDragStart,
  onDragEnd,
  onDelete,
  onDuplicate,
}: FieldCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      style={{
        ...styles.fieldCard,
        ...(isSelected ? styles.fieldCardSelected : {}),
        ...(isHovered && !isSelected ? styles.fieldCardHovered : {}),
        opacity: isDragging ? 0.5 : 1,
      }}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag Handle */}
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        style={styles.fieldDragHandle}
      >
        ⋮⋮
      </div>

      {/* Field Content */}
      <div style={styles.fieldContent}>
        <div style={styles.fieldLabel}>
          {field.label}
          {field.validation?.required && (
            <span style={{ color: 'var(--color-error-dark)', marginLeft: '0.25rem' }}>*</span>
          )}
        </div>
        <div style={styles.fieldType}>{getFieldTypeLabel(field.type)}</div>

        {/* Field Preview */}
        <div style={styles.fieldPreview}>
          <FieldPreview field={field} />
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          ...styles.fieldActions,
          ...(isHovered || isSelected ? styles.fieldActionsVisible : {}),
        }}
      >
        <ActionButton icon="📋" title="Duplicate" onClick={onDuplicate} />
        <ActionButton icon="🗑️" title="Delete" onClick={onDelete} isDelete />
      </div>
    </div>
  );
}

// ============================================================================
// ACTION BUTTON SUB-COMPONENT
// ============================================================================

interface ActionButtonProps {
  icon: string;
  title: string;
  onClick: () => void;
  isDelete?: boolean;
}

function ActionButton({ icon, title, onClick, isDelete }: ActionButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      style={{
        ...styles.actionButton,
        ...(isHovered ? styles.actionButtonHover : {}),
        ...(isDelete && isHovered ? styles.actionButtonDelete : {}),
      }}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {icon}
    </button>
  );
}

// ============================================================================
// FIELD PREVIEW SUB-COMPONENT
// ============================================================================

interface FieldPreviewProps {
  field: FormFieldConfig;
}

function FieldPreview({ field }: FieldPreviewProps) {
  const inputStyle = {
    width: '100%',
    padding: '0.5rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '0.375rem',
    color: '#666',
  };

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'number':
    case 'currency':
      return (
        <input
          type="text"
          placeholder={field.placeholder ?? 'Enter text...'}
          style={inputStyle}
          disabled
        />
      );

    case 'textarea':
      return (
        <textarea
          placeholder={field.placeholder ?? 'Enter text...'}
          rows={2}
          style={{ ...inputStyle, resize: 'none' }}
          disabled
        />
      );

    case 'dropdown':
    case 'multiselect':
      return (
        <select style={inputStyle} disabled>
          <option>Select an option...</option>
          {field.options?.slice(0, 3).map((opt) => (
            <option key={opt.value}>{opt.label}</option>
          ))}
        </select>
      );

    case 'radio':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {field.options?.slice(0, 3).map((opt) => (
            <label
              key={opt.value}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#999' }}
            >
              <input type="radio" disabled />
              {opt.label}
            </label>
          ))}
        </div>
      );

    case 'checkbox':
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {field.options?.slice(0, 3).map((opt) => (
            <label
              key={opt.value}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: '#999' }}
            >
              <input type="checkbox" disabled />
              {opt.label}
            </label>
          ))}
        </div>
      );

    case 'date':
      return <input type="date" style={inputStyle} disabled />;

    case 'time':
      return <input type="time" style={inputStyle} disabled />;

    case 'datetime':
      return <input type="datetime-local" style={inputStyle} disabled />;

    case 'rating':
      return (
        <div style={{ display: 'flex', gap: '0.25rem' }}>
          {[1, 2, 3, 4, 5].map((star) => (
            <span key={star} style={{ fontSize: '1.25rem', color: '#666' }}>
              ☆
            </span>
          ))}
        </div>
      );

    case 'file':
    case 'image':
      return (
        <div
          style={{
            padding: '1rem',
            border: '2px dashed var(--color-border-light)',
            borderRadius: '0.5rem',
            textAlign: 'center',
            color: '#666',
            fontSize: '0.875rem',
          }}
        >
          {field.type === 'image' ? '🖼️' : '📎'} Click or drag to upload
        </div>
      );

    case 'signature':
      return (
        <div
          style={{
            padding: '2rem 1rem',
            border: '1px solid var(--color-border-light)',
            borderRadius: '0.5rem',
            textAlign: 'center',
            color: '#666',
            fontSize: '0.875rem',
            backgroundColor: 'var(--color-bg-paper)',
          }}
        >
          ✍️ Sign here
        </div>
      );

    case 'heading':
      return (
        <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', margin: 0 }}>
          {field.label}
        </h3>
      );

    case 'paragraph':
      return (
        <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>{field.label}</p>
      );

    case 'divider':
      return <hr style={{ border: 'none', borderTop: '1px solid var(--color-border-light)', margin: '0.5rem 0' }} />;

    case 'pagebreak':
      return (
        <div
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--color-bg-elevated)',
            borderRadius: '0.25rem',
            textAlign: 'center',
            color: 'var(--color-primary)',
            fontSize: '0.75rem',
            fontWeight: '600',
          }}
        >
          📄 PAGE BREAK
        </div>
      );

    default:
      return (
        <input
          type="text"
          placeholder="Field preview"
          style={inputStyle}
          disabled
        />
      );
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getFieldTypeLabel(type: FormFieldType): string {
  const labels: Record<FormFieldType, string> = {
    text: 'Text',
    textarea: 'Text Area',
    email: 'Email',
    phone: 'Phone',
    number: 'Number',
    currency: 'Currency',
    date: 'Date',
    datetime: 'Date & Time',
    time: 'Time',
    dropdown: 'Dropdown',
    multiselect: 'Multi-Select',
    radio: 'Radio',
    checkbox: 'Checkbox',
    file: 'File Upload',
    image: 'Image Upload',
    signature: 'Signature',
    rating: 'Rating',
    scale: 'Scale',
    address: 'Address',
    name: 'Name',
    hidden: 'Hidden',
    heading: 'Heading',
    paragraph: 'Paragraph',
    divider: 'Divider',
    pagebreak: 'Page Break',
  };
  return labels[type] || type;
}

export default FormCanvas;
