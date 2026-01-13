'use client';

/**
 * Form Builder
 *
 * Main drag-and-drop form builder component.
 * Combines FieldPalette, FormCanvas, and FieldEditor.
 *
 * @module components/forms/FormBuilder
 * @version 1.0.0
 */

import { useState, useCallback, useMemo } from 'react';
import { FieldPalette } from './FieldPalette';
import { FormCanvas } from './FormCanvas';
import { FieldEditor } from './FieldEditor';
import type {
  FormFieldConfig,
  FormFieldType,
  FormDefinition,
  FormPage,
} from '@/lib/forms/types';

// ============================================================================
// TYPES
// ============================================================================

interface FormBuilderProps {
  form: FormDefinition;
  fields: FormFieldConfig[];
  onFormChange: (form: FormDefinition) => void;
  onFieldsChange: (fields: FormFieldConfig[]) => void;
  onSave?: () => void;
  onPublish?: () => void;
  onPreview?: () => void;
}

type ViewMode = 'edit' | 'preview';

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: '#0a0a0a',
    color: '#fff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid #333',
    backgroundColor: '#111',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    color: '#fff',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#666',
    margin: 0,
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '280px',
    borderRight: '1px solid #333',
    backgroundColor: '#111',
    overflowY: 'auto' as const,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  canvas: {
    flex: 1,
    overflow: 'auto',
    padding: '2rem',
    backgroundColor: '#0a0a0a',
  },
  editorPanel: {
    width: '320px',
    borderLeft: '1px solid #333',
    backgroundColor: '#111',
    overflowY: 'auto' as const,
  },
  button: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  buttonPrimary: {
    backgroundColor: '#6366f1',
    color: '#fff',
    border: 'none',
  },
  buttonSecondary: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: '1px solid #333',
  },
  buttonSuccess: {
    backgroundColor: '#22c55e',
    color: '#fff',
    border: 'none',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid #333',
  },
  tab: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    color: '#999',
    backgroundColor: 'transparent',
    border: 'none',
  },
  tabActive: {
    color: '#fff',
    borderBottom: '2px solid #6366f1',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function generateFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getDefaultFieldConfig(type: FormFieldType, pageIndex: number, order: number): Partial<FormFieldConfig> {
  const baseConfig: Partial<FormFieldConfig> = {
    type,
    label: getDefaultLabel(type),
    name: `field_${Date.now()}`,
    placeholder: '',
    width: 'full',
    pageIndex,
    order,
  };

  // Type-specific defaults
  switch (type) {
    case 'dropdown':
    case 'multiselect':
    case 'radio':
    case 'checkbox':
      return {
        ...baseConfig,
        options: [
          { label: 'Option 1', value: 'option1' },
          { label: 'Option 2', value: 'option2' },
          { label: 'Option 3', value: 'option3' },
        ],
      };
    case 'rating':
      return { ...baseConfig, label: 'Rating' };
    case 'scale':
      return { ...baseConfig, label: 'Scale' };
    case 'heading':
      return { ...baseConfig, label: 'Section Title' };
    case 'paragraph':
      return { ...baseConfig, label: 'Add your description text here...' };
    default:
      return baseConfig;
  }
}

function getDefaultLabel(type: FormFieldType): string {
  const labels: Record<FormFieldType, string> = {
    text: 'Text Field',
    textarea: 'Text Area',
    email: 'Email Address',
    phone: 'Phone Number',
    number: 'Number',
    currency: 'Amount',
    date: 'Date',
    datetime: 'Date & Time',
    time: 'Time',
    dropdown: 'Select One',
    multiselect: 'Select Multiple',
    radio: 'Choose One',
    checkbox: 'Checkbox',
    file: 'File Upload',
    image: 'Image Upload',
    signature: 'Signature',
    rating: 'Rating',
    scale: 'Scale',
    address: 'Address',
    name: 'Full Name',
    hidden: 'Hidden Field',
    heading: 'Section Title',
    paragraph: 'Paragraph',
    divider: '',
    pagebreak: 'Page Break',
  };
  return labels[type] || 'New Field';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function FormBuilder({
  form,
  fields,
  onFormChange,
  onFieldsChange,
  onSave,
  onPublish,
  onPreview,
}: FormBuilderProps) {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>('edit');
  const [activeTab, setActiveTab] = useState<'fields' | 'settings'>('fields');

  // Get fields for current page
  const pageFields = useMemo(() => {
    return fields
      .filter((f) => f.pageIndex === currentPageIndex)
      .sort((a, b) => a.order - b.order);
  }, [fields, currentPageIndex]);

  // Get selected field
  const selectedField = useMemo(() => {
    return fields.find((f) => f.id === selectedFieldId) || null;
  }, [fields, selectedFieldId]);

  // Handle field drop from palette
  const handleFieldDrop = useCallback(
    (type: FormFieldType, dropIndex: number) => {
      const newFieldId = generateFieldId();
      const newField: FormFieldConfig = {
        id: newFieldId,
        formId: form.id,
        organizationId: form.organizationId,
        workspaceId: form.workspaceId,
        ...getDefaultFieldConfig(type, currentPageIndex, dropIndex),
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      } as FormFieldConfig;

      // Reorder existing fields
      const updatedFields = fields.map((f) => {
        if (f.pageIndex === currentPageIndex && f.order >= dropIndex) {
          return { ...f, order: f.order + 1 };
        }
        return f;
      });

      onFieldsChange([...updatedFields, newField]);
      setSelectedFieldId(newFieldId);
    },
    [form, fields, currentPageIndex, onFieldsChange]
  );

  // Handle field reorder
  const handleFieldReorder = useCallback(
    (sourceId: string, targetIndex: number) => {
      const sourceField = fields.find((f) => f.id === sourceId);
      if (!sourceField) return;

      const sourceIndex = sourceField.order;

      // Calculate new order
      const updatedFields = fields.map((f) => {
        if (f.pageIndex !== currentPageIndex) return f;
        if (f.id === sourceId) {
          return { ...f, order: targetIndex };
        }
        if (sourceIndex < targetIndex) {
          // Moving down
          if (f.order > sourceIndex && f.order <= targetIndex) {
            return { ...f, order: f.order - 1 };
          }
        } else {
          // Moving up
          if (f.order >= targetIndex && f.order < sourceIndex) {
            return { ...f, order: f.order + 1 };
          }
        }
        return f;
      });

      onFieldsChange(updatedFields);
    },
    [fields, currentPageIndex, onFieldsChange]
  );

  // Handle field update
  const handleFieldUpdate = useCallback(
    (fieldId: string, updates: Partial<FormFieldConfig>) => {
      const updatedFields = fields.map((f) =>
        f.id === fieldId ? { ...f, ...updates, updatedAt: new Date() as any } : f
      );
      onFieldsChange(updatedFields);
    },
    [fields, onFieldsChange]
  );

  // Handle field delete
  const handleFieldDelete = useCallback(
    (fieldId: string) => {
      const deletedField = fields.find((f) => f.id === fieldId);
      if (!deletedField) return;

      // Remove field and reorder remaining
      const updatedFields = fields
        .filter((f) => f.id !== fieldId)
        .map((f) => {
          if (f.pageIndex === deletedField.pageIndex && f.order > deletedField.order) {
            return { ...f, order: f.order - 1 };
          }
          return f;
        });

      onFieldsChange(updatedFields);
      if (selectedFieldId === fieldId) {
        setSelectedFieldId(null);
      }
    },
    [fields, selectedFieldId, onFieldsChange]
  );

  // Handle field duplicate
  const handleFieldDuplicate = useCallback(
    (fieldId: string) => {
      const sourceField = fields.find((f) => f.id === fieldId);
      if (!sourceField) return;

      const newFieldId = generateFieldId();
      const newField: FormFieldConfig = {
        ...sourceField,
        id: newFieldId,
        name: `${sourceField.name}_copy`,
        label: `${sourceField.label} (Copy)`,
        order: sourceField.order + 1,
        createdAt: new Date() as any,
        updatedAt: new Date() as any,
      };

      // Reorder fields after the duplicate
      const updatedFields = fields.map((f) => {
        if (f.pageIndex === sourceField.pageIndex && f.order > sourceField.order) {
          return { ...f, order: f.order + 1 };
        }
        return f;
      });

      onFieldsChange([...updatedFields, newField]);
      setSelectedFieldId(newFieldId);
    },
    [fields, onFieldsChange]
  );

  // Handle page add
  const handleAddPage = useCallback(() => {
    const newPage: FormPage = {
      id: `page_${Date.now()}`,
      title: `Page ${form.pages.length + 1}`,
      order: form.pages.length,
    };
    onFormChange({ ...form, pages: [...form.pages, newPage] });
  }, [form, onFormChange]);

  // Handle page delete
  const handleDeletePage = useCallback(
    (pageIndex: number) => {
      if (form.pages.length <= 1) return;

      // Remove page
      const updatedPages = form.pages
        .filter((_, i) => i !== pageIndex)
        .map((p, i) => ({ ...p, order: i }));

      // Remove fields on that page
      const updatedFields = fields.filter((f) => f.pageIndex !== pageIndex);

      // Update page indices for fields after the deleted page
      const reindexedFields = updatedFields.map((f) => {
        if (f.pageIndex > pageIndex) {
          return { ...f, pageIndex: f.pageIndex - 1 };
        }
        return f;
      });

      onFormChange({ ...form, pages: updatedPages });
      onFieldsChange(reindexedFields);

      // Adjust current page index if needed
      if (currentPageIndex >= updatedPages.length) {
        setCurrentPageIndex(Math.max(0, updatedPages.length - 1));
      }
    },
    [form, fields, currentPageIndex, onFormChange, onFieldsChange]
  );

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div>
            <h1 style={styles.title}>{form.name || 'Untitled Form'}</h1>
            <p style={styles.subtitle}>
              {fields.length} fields · {form.pages.length} page{form.pages.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <button
            onClick={onPreview}
            style={{ ...styles.button, ...styles.buttonSecondary }}
          >
            👁️ Preview
          </button>
          <button
            onClick={onSave}
            style={{ ...styles.button, ...styles.buttonSecondary }}
          >
            💾 Save Draft
          </button>
          <button
            onClick={onPublish}
            style={{ ...styles.button, ...styles.buttonSuccess }}
          >
            🚀 Publish
          </button>
        </div>
      </header>

      {/* Body */}
      <div style={styles.body}>
        {/* Left Sidebar - Field Palette */}
        <aside style={styles.sidebar}>
          <div style={styles.tabs}>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'fields' ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab('fields')}
            >
              Fields
            </button>
            <button
              style={{
                ...styles.tab,
                ...(activeTab === 'settings' ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab('settings')}
            >
              Settings
            </button>
          </div>
          {activeTab === 'fields' && <FieldPalette />}
          {activeTab === 'settings' && (
            <FormSettings form={form} onFormChange={onFormChange} />
          )}
        </aside>

        {/* Main Canvas */}
        <main style={styles.main}>
          {/* Page Tabs */}
          <PageTabs
            pages={form.pages}
            currentPageIndex={currentPageIndex}
            onPageSelect={setCurrentPageIndex}
            onAddPage={handleAddPage}
            onDeletePage={handleDeletePage}
          />

          {/* Canvas */}
          <div style={styles.canvas}>
            <FormCanvas
              fields={pageFields}
              selectedFieldId={selectedFieldId}
              onFieldSelect={setSelectedFieldId}
              onFieldDrop={handleFieldDrop}
              onFieldReorder={handleFieldReorder}
              onFieldDelete={handleFieldDelete}
              onFieldDuplicate={handleFieldDuplicate}
            />
          </div>
        </main>

        {/* Right Panel - Field Editor */}
        {selectedField && (
          <aside style={styles.editorPanel}>
            <FieldEditor
              field={selectedField}
              onUpdate={(updates) => handleFieldUpdate(selectedField.id, updates)}
              onClose={() => setSelectedFieldId(null)}
            />
          </aside>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// PAGE TABS SUB-COMPONENT
// ============================================================================

interface PageTabsProps {
  pages: FormPage[];
  currentPageIndex: number;
  onPageSelect: (index: number) => void;
  onAddPage: () => void;
  onDeletePage: (index: number) => void;
}

function PageTabs({
  pages,
  currentPageIndex,
  onPageSelect,
  onAddPage,
  onDeletePage,
}: PageTabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.5rem 1rem',
        borderBottom: '1px solid #333',
        gap: '0.5rem',
        backgroundColor: '#111',
        overflowX: 'auto',
      }}
    >
      {pages.map((page, index) => (
        <div
          key={page.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
        >
          <button
            onClick={() => onPageSelect(index)}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: currentPageIndex === index ? '600' : '400',
              color: currentPageIndex === index ? '#fff' : '#999',
              backgroundColor: currentPageIndex === index ? '#1a1a1a' : 'transparent',
              border: currentPageIndex === index ? '1px solid #333' : '1px solid transparent',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            {page.title || `Page ${index + 1}`}
          </button>
          {pages.length > 1 && currentPageIndex === index && (
            <button
              onClick={() => onDeletePage(index)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                color: '#dc2626',
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          )}
        </div>
      ))}
      <button
        onClick={onAddPage}
        style={{
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          color: '#6366f1',
          backgroundColor: 'transparent',
          border: '1px dashed #333',
          borderRadius: '0.375rem',
          cursor: 'pointer',
        }}
      >
        + Add Page
      </button>
    </div>
  );
}

// ============================================================================
// FORM SETTINGS SUB-COMPONENT
// ============================================================================

interface FormSettingsProps {
  form: FormDefinition;
  onFormChange: (form: FormDefinition) => void;
}

function FormSettings({ form, onFormChange }: FormSettingsProps) {
  return (
    <div style={{ padding: '1rem' }}>
      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: '#fff' }}>
        Form Settings
      </h3>

      {/* Form Name */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>
          Form Name
        </label>
        <input
          type="text"
          value={form.name}
          onChange={(e) => onFormChange({ ...form, name: e.target.value })}
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '0.875rem',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '0.375rem',
            color: '#fff',
          }}
        />
      </div>

      {/* Description */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>
          Description
        </label>
        <textarea
          value={form.description || ''}
          onChange={(e) => onFormChange({ ...form, description: e.target.value })}
          rows={3}
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '0.875rem',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '0.375rem',
            color: '#fff',
            resize: 'vertical',
          }}
        />
      </div>

      {/* Submit Button Text */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', color: '#999', marginBottom: '0.25rem' }}>
          Submit Button Text
        </label>
        <input
          type="text"
          value={form.settings.submitButtonText}
          onChange={(e) =>
            onFormChange({
              ...form,
              settings: { ...form.settings, submitButtonText: e.target.value },
            })
          }
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '0.875rem',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '0.375rem',
            color: '#fff',
          }}
        />
      </div>

      {/* Toggles */}
      <div style={{ marginBottom: '1rem' }}>
        <ToggleSetting
          label="Show Progress Bar"
          checked={form.settings.showProgressBar}
          onChange={(checked) =>
            onFormChange({
              ...form,
              settings: { ...form.settings, showProgressBar: checked },
            })
          }
        />
        <ToggleSetting
          label="Enable CAPTCHA"
          checked={form.settings.enableCaptcha}
          onChange={(checked) =>
            onFormChange({
              ...form,
              settings: { ...form.settings, enableCaptcha: checked },
            })
          }
        />
        <ToggleSetting
          label="Allow Save & Continue"
          checked={form.behavior.enableSaveAndContinue}
          onChange={(checked) =>
            onFormChange({
              ...form,
              behavior: { ...form.behavior, enableSaveAndContinue: checked },
            })
          }
        />
        <ToggleSetting
          label="Allow Multiple Submissions"
          checked={form.behavior.allowMultipleSubmissions}
          onChange={(checked) =>
            onFormChange({
              ...form,
              behavior: { ...form.behavior, allowMultipleSubmissions: checked },
            })
          }
        />
      </div>
    </div>
  );
}

// ============================================================================
// TOGGLE SETTING SUB-COMPONENT
// ============================================================================

interface ToggleSettingProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleSetting({ label, checked, onChange }: ToggleSettingProps) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0.5rem 0',
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: '0.875rem', color: '#ccc' }}>{label}</span>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: '40px',
          height: '22px',
          backgroundColor: checked ? '#6366f1' : '#333',
          borderRadius: '11px',
          position: 'relative',
          cursor: 'pointer',
          transition: 'background-color 0.2s',
        }}
      >
        <div
          style={{
            width: '18px',
            height: '18px',
            backgroundColor: '#fff',
            borderRadius: '50%',
            position: 'absolute',
            top: '2px',
            left: checked ? '20px' : '2px',
            transition: 'left 0.2s',
          }}
        />
      </div>
    </label>
  );
}

export default FormBuilder;
