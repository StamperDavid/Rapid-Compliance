'use client';

/**
 * Field Palette
 *
 * Draggable field type palette for the form builder.
 * Users drag fields from here onto the canvas.
 *
 * @module components/forms/FieldPalette
 * @version 1.0.0
 */

import { useState } from 'react';
import type { FormFieldType } from '@/lib/forms/types';

// ============================================================================
// TYPES
// ============================================================================

export interface PaletteFieldConfig {
  type: FormFieldType;
  label: string;
  icon: string;
  description: string;
}

export interface FieldCategory {
  id: string;
  label: string;
  fields: PaletteFieldConfig[];
}

// ============================================================================
// FIELD DEFINITIONS
// ============================================================================

const FIELD_CATEGORIES: FieldCategory[] = [
  {
    id: 'basic',
    label: 'Basic Fields',
    fields: [
      { type: 'text', label: 'Text', icon: '📝', description: 'Single line text input' },
      { type: 'textarea', label: 'Text Area', icon: '📋', description: 'Multi-line text input' },
      { type: 'email', label: 'Email', icon: '✉️', description: 'Email address with validation' },
      { type: 'phone', label: 'Phone', icon: '📞', description: 'Phone number input' },
      { type: 'number', label: 'Number', icon: '#️⃣', description: 'Numeric input' },
      { type: 'currency', label: 'Currency', icon: '💰', description: 'Currency amount' },
    ],
  },
  {
    id: 'selection',
    label: 'Selection Fields',
    fields: [
      { type: 'dropdown', label: 'Dropdown', icon: '▼', description: 'Single select dropdown' },
      { type: 'multiselect', label: 'Multi-Select', icon: '☑️', description: 'Multiple selection' },
      { type: 'radio', label: 'Radio', icon: '◉', description: 'Radio button group' },
      { type: 'checkbox', label: 'Checkbox', icon: '✓', description: 'Checkbox or group' },
    ],
  },
  {
    id: 'datetime',
    label: 'Date & Time',
    fields: [
      { type: 'date', label: 'Date', icon: '📅', description: 'Date picker' },
      { type: 'datetime', label: 'Date & Time', icon: '🕐', description: 'Date and time picker' },
      { type: 'time', label: 'Time', icon: '⏰', description: 'Time picker' },
    ],
  },
  {
    id: 'advanced',
    label: 'Advanced Fields',
    fields: [
      { type: 'file', label: 'File Upload', icon: '📎', description: 'Upload files' },
      { type: 'image', label: 'Image Upload', icon: '🖼️', description: 'Upload images' },
      { type: 'signature', label: 'Signature', icon: '✍️', description: 'E-signature capture' },
      { type: 'rating', label: 'Rating', icon: '⭐', description: 'Star rating' },
      { type: 'scale', label: 'Scale', icon: '📊', description: 'Linear scale (1-10)' },
    ],
  },
  {
    id: 'composite',
    label: 'Composite Fields',
    fields: [
      { type: 'name', label: 'Full Name', icon: '👤', description: 'First & last name' },
      { type: 'address', label: 'Address', icon: '📍', description: 'Complete address' },
    ],
  },
  {
    id: 'layout',
    label: 'Layout Elements',
    fields: [
      { type: 'heading', label: 'Heading', icon: 'H', description: 'Section header' },
      { type: 'paragraph', label: 'Paragraph', icon: '¶', description: 'Descriptive text' },
      { type: 'divider', label: 'Divider', icon: '—', description: 'Visual separator' },
      { type: 'pagebreak', label: 'Page Break', icon: '📄', description: 'Multi-step page break' },
    ],
  },
  {
    id: 'special',
    label: 'Special Fields',
    fields: [
      { type: 'hidden', label: 'Hidden', icon: '👁️', description: 'Hidden tracking field' },
    ],
  },
];

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    padding: '1rem',
  },
  searchContainer: {
    marginBottom: '1rem',
  },
  searchInput: {
    width: '100%',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    color: '#fff',
  },
  category: {
    marginBottom: '1.5rem',
  },
  categoryHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '0.5rem',
    cursor: 'pointer',
    padding: '0.25rem 0',
  },
  categoryTitle: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
  },
  categoryToggle: {
    fontSize: '0.75rem',
    color: '#666',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '0.5rem',
  },
  fieldItem: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0.75rem 0.5rem',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    cursor: 'grab',
    transition: 'all 0.2s',
    minHeight: '70px',
  },
  fieldItemHover: {
    backgroundColor: '#222',
    borderColor: '#6366f1',
  },
  fieldIcon: {
    fontSize: '1.25rem',
    marginBottom: '0.25rem',
  },
  fieldLabel: {
    fontSize: '0.75rem',
    color: '#ccc',
    textAlign: 'center' as const,
  },
  fieldDragging: {
    opacity: 0.5,
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function FieldPalette() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(FIELD_CATEGORIES.map((c) => c.id))
  );
  const [draggingField, setDraggingField] = useState<FormFieldType | null>(null);

  // Filter fields by search query
  const filteredCategories = FIELD_CATEGORIES.map((category) => ({
    ...category,
    fields: category.fields.filter(
      (field) =>
        field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        field.description.toLowerCase().includes(searchQuery.toLowerCase())
    ),
  })).filter((category) => category.fields.length > 0);

  // Toggle category expansion
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, fieldType: FormFieldType) => {
    setDraggingField(fieldType);
    e.dataTransfer.setData('fieldType', fieldType);
    e.dataTransfer.effectAllowed = 'copy';
  };

  // Handle drag end
  const handleDragEnd = () => {
    setDraggingField(null);
  };

  return (
    <div style={styles.container}>
      {/* Search */}
      <div style={styles.searchContainer}>
        <input
          type="text"
          placeholder="Search fields..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Field Categories */}
      {filteredCategories.map((category) => (
        <div key={category.id} style={styles.category}>
          {/* Category Header */}
          <div
            style={styles.categoryHeader}
            onClick={() => toggleCategory(category.id)}
          >
            <span style={styles.categoryTitle}>{category.label}</span>
            <span style={styles.categoryToggle}>
              {expandedCategories.has(category.id) ? '−' : '+'}
            </span>
          </div>

          {/* Fields Grid */}
          {expandedCategories.has(category.id) && (
            <div style={styles.fieldGrid}>
              {category.fields.map((field) => (
                <FieldItem
                  key={field.type}
                  field={field}
                  isDragging={draggingField === field.type}
                  onDragStart={(e) => handleDragStart(e, field.type)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// FIELD ITEM SUB-COMPONENT
// ============================================================================

interface FieldItemProps {
  field: PaletteFieldConfig;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}

function FieldItem({ field, isDragging, onDragStart, onDragEnd }: FieldItemProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...styles.fieldItem,
        ...(isHovered ? styles.fieldItemHover : {}),
        ...(isDragging ? styles.fieldDragging : {}),
      }}
      title={field.description}
    >
      <span style={styles.fieldIcon}>{field.icon}</span>
      <span style={styles.fieldLabel}>{field.label}</span>
    </div>
  );
}

export default FieldPalette;
