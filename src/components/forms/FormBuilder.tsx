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
import { Timestamp } from 'firebase/firestore';
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

type ShareTab = 'link' | 'embed' | 'qr';

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    height: '100%',
    backgroundColor: 'var(--color-bg-paper)',
    color: 'var(--color-text-primary)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--color-border-light)',
    backgroundColor: 'var(--color-bg-main)',
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
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  subtitle: {
    fontSize: '0.875rem',
    color: 'var(--color-text-disabled)',
    margin: 0,
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '280px',
    borderRight: '1px solid var(--color-border-light)',
    backgroundColor: 'var(--color-bg-main)',
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
    backgroundColor: 'var(--color-bg-paper)',
  },
  editorPanel: {
    width: '320px',
    borderLeft: '1px solid var(--color-border-light)',
    backgroundColor: 'var(--color-bg-main)',
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
    backgroundColor: 'var(--color-primary)',
    color: 'var(--color-text-primary)',
    border: 'none',
  },
  buttonSecondary: {
    backgroundColor: 'var(--color-bg-elevated)',
    color: 'var(--color-text-primary)',
    border: '1px solid var(--color-border-light)',
  },
  buttonSuccess: {
    backgroundColor: 'var(--color-success)',
    color: 'var(--color-text-primary)',
    border: 'none',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--color-border-light)',
  },
  tab: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    color: 'var(--color-text-secondary)',
    backgroundColor: 'transparent',
    border: 'none',
  },
  tabActive: {
    color: 'var(--color-text-primary)',
    borderBottom: '2px solid var(--color-primary)',
  },
  // Share Modal Styles
  modalOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'var(--color-bg-elevated)',
    borderRadius: '1rem',
    border: '1px solid var(--color-border-light)',
    width: '100%',
    maxWidth: '520px',
    maxHeight: '90vh',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.5rem',
    borderBottom: '1px solid var(--color-border-light)',
  },
  modalTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: 'var(--color-text-primary)',
    margin: 0,
  },
  modalClose: {
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--color-text-disabled)',
    fontSize: '1.5rem',
    cursor: 'pointer',
    padding: '0.25rem',
    lineHeight: 1,
  },
  modalBody: {
    padding: '1.5rem',
  },
  shareTabList: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
  },
  shareTab: {
    flex: 1,
    padding: '0.75rem',
    backgroundColor: 'var(--color-bg-main)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '0.5rem',
    color: 'var(--color-text-secondary)',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  shareTabActive: {
    backgroundColor: 'var(--color-primary)',
    borderColor: 'var(--color-primary)',
    color: 'var(--color-text-primary)',
  },
  inputGroup: {
    marginBottom: '1rem',
  },
  inputLabel: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
    marginBottom: '0.5rem',
  },
  inputWrapper: {
    display: 'flex',
    gap: '0.5rem',
  },
  shareInput: {
    flex: 1,
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--color-bg-main)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '0.5rem',
    color: 'var(--color-text-primary)',
    fontSize: '0.875rem',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: '0.75rem 1rem',
    backgroundColor: 'var(--color-border-light)',
    border: 'none',
    borderRadius: '0.5rem',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    whiteSpace: 'nowrap' as const,
  },
  copySuccess: {
    backgroundColor: 'var(--color-success)',
  },
  embedCode: {
    width: '100%',
    padding: '1rem',
    backgroundColor: 'var(--color-bg-main)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '0.5rem',
    color: 'var(--color-text-primary)',
    fontSize: '0.75rem',
    fontFamily: 'monospace',
    resize: 'vertical' as const,
    minHeight: '100px',
  },
  qrContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem',
  },
  qrCode: {
    backgroundColor: 'var(--color-text-primary)',
    padding: '1rem',
    borderRadius: '0.5rem',
  },
  downloadButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: 'var(--color-primary)',
    border: 'none',
    borderRadius: '0.5rem',
    color: 'var(--color-text-primary)',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  notPublishedWarning: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    backgroundColor: 'var(--color-error-dark)',
    border: '1px solid var(--color-error-dark)',
    borderRadius: '0.5rem',
    marginBottom: '1rem',
  },
  warningIcon: {
    fontSize: '1.25rem',
  },
  warningText: {
    fontSize: '0.875rem',
    color: 'var(--color-error-light)',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert JavaScript Date to Firestore Timestamp
 */
function dateToTimestamp(date: Date): Timestamp {
  return Timestamp.fromDate(date);
}

function generateFieldId(): string {
  return `field_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
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
  const [activeTab, setActiveTab] = useState<'fields' | 'settings'>('fields');
  const [showShareModal, setShowShareModal] = useState(false);

  // Get fields for current page
  const pageFields = useMemo(() => {
    return fields
      .filter((f) => f.pageIndex === currentPageIndex)
      .sort((a, b) => a.order - b.order);
  }, [fields, currentPageIndex]);

  // Get selected field
  const selectedField = useMemo(() => {
    return fields.find((f) => f.id === selectedFieldId) ?? null;
  }, [fields, selectedFieldId]);

  // Handle field drop from palette
  const handleFieldDrop = useCallback(
    (type: FormFieldType, dropIndex: number) => {
      const newFieldId = generateFieldId();
      const defaultConfig = getDefaultFieldConfig(type, currentPageIndex, dropIndex);
      const timestamp = dateToTimestamp(new Date());

      const newField: FormFieldConfig = {
        id: newFieldId,
        formId: form.id,
        type: defaultConfig.type ?? type,
        label: defaultConfig.label ?? '',
        name: defaultConfig.name ?? `field_${Date.now()}`,
        placeholder: defaultConfig.placeholder,
        width: defaultConfig.width ?? 'full',
        pageIndex: defaultConfig.pageIndex ?? currentPageIndex,
        order: defaultConfig.order ?? dropIndex,
        options: defaultConfig.options,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

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
      if (!sourceField) {
        return;
      }

      const sourceIndex = sourceField.order;

      // Calculate new order
      const updatedFields = fields.map((f) => {
        if (f.pageIndex !== currentPageIndex) {
          return f;
        }
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
      const timestamp = dateToTimestamp(new Date());
      const updatedFields = fields.map((f) =>
        f.id === fieldId ? { ...f, ...updates, updatedAt: timestamp } : f
      );
      onFieldsChange(updatedFields);
    },
    [fields, onFieldsChange]
  );

  // Handle field delete
  const handleFieldDelete = useCallback(
    (fieldId: string) => {
      const deletedField = fields.find((f) => f.id === fieldId);
      if (!deletedField) {
        return;
      }

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
      if (!sourceField) {
        return;
      }

      const newFieldId = generateFieldId();
      const timestamp = dateToTimestamp(new Date());
      const newField: FormFieldConfig = {
        ...sourceField,
        id: newFieldId,
        name: `${sourceField.name}_copy`,
        label: `${sourceField.label} (Copy)`,
        order: sourceField.order + 1,
        createdAt: timestamp,
        updatedAt: timestamp,
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
      if (form.pages.length <= 1) {
        return;
      }

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
            <h1 style={styles.title}>{form.name.length > 0 ? form.name : 'Untitled Form'}</h1>
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
          <button
            onClick={() => setShowShareModal(true)}
            style={{ ...styles.button, ...styles.buttonSecondary }}
          >
            🔗 Share
          </button>
        </div>
      </header>

      {/* Share Modal */}
      {showShareModal && (
        <ShareModal
          form={form}
          onClose={() => setShowShareModal(false)}
        />
      )}

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
        borderBottom: '1px solid var(--color-border-light)',
        gap: '0.5rem',
        backgroundColor: 'var(--color-bg-main)',
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
              color: currentPageIndex === index ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              backgroundColor: currentPageIndex === index ? 'var(--color-bg-elevated)' : 'transparent',
              border: currentPageIndex === index ? '1px solid var(--color-border-light)' : '1px solid transparent',
              borderRadius: '0.375rem',
              cursor: 'pointer',
            }}
          >
            {page.title.length > 0 ? page.title : `Page ${index + 1}`}
          </button>
          {pages.length > 1 && currentPageIndex === index && (
            <button
              onClick={() => onDeletePage(index)}
              style={{
                padding: '0.25rem 0.5rem',
                fontSize: '0.75rem',
                color: 'var(--color-error-dark)',
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
          color: 'var(--color-primary)',
          backgroundColor: 'transparent',
          border: '1px dashed var(--color-border-light)',
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
      <h3 style={{ fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text-primary)' }}>
        Form Settings
      </h3>

      {/* Form Name */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
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
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '0.375rem',
            color: 'var(--color-text-primary)',
          }}
        />
      </div>

      {/* Description */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
          Description
        </label>
        <textarea
          value={form.description ?? ''}
          onChange={(e) => onFormChange({ ...form, description: e.target.value })}
          rows={3}
          style={{
            width: '100%',
            padding: '0.5rem',
            fontSize: '0.875rem',
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '0.375rem',
            color: 'var(--color-text-primary)',
            resize: 'vertical',
          }}
        />
      </div>

      {/* Submit Button Text */}
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
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
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-light)',
            borderRadius: '0.375rem',
            color: 'var(--color-text-primary)',
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
      <span style={{ fontSize: '0.875rem', color: 'var(--color-text-primary)' }}>{label}</span>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: '40px',
          height: '22px',
          backgroundColor: checked ? 'var(--color-primary)' : 'var(--color-border-light)',
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
            backgroundColor: 'var(--color-text-primary)',
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

// ============================================================================
// SHARE MODAL SUB-COMPONENT
// ============================================================================

interface ShareModalProps {
  form: FormDefinition;
  onClose: () => void;
}

function ShareModal({ form, onClose }: ShareModalProps) {
  const [activeTab, setActiveTab] = useState<ShareTab>('link');
  const [copied, setCopied] = useState(false);

  const isPublished = form.status === 'published';
  const formUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/f/${form.id}`
    : `/f/${form.id}`;

  const embedCode = `<iframe
  src="${formUrl}?embed=true"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; border-radius: 8px;"
  title="${form.name}"
></iframe>`;

  const handleCopy = useCallback((text: string) => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    })();
  }, []);

  // Generate simple QR code as SVG (basic implementation)
  const qrSize = 200;
  const generateQRPlaceholder = () => {
    // This is a placeholder - in production, use a QR library like qrcode
    return (
      <svg width={qrSize} height={qrSize} viewBox={`0 0 ${qrSize} ${qrSize}`}>
        <rect fill="var(--color-text-primary)" width={qrSize} height={qrSize} />
        <rect fill="var(--color-bg-main)" x="20" y="20" width="40" height="40" />
        <rect fill="var(--color-text-primary)" x="30" y="30" width="20" height="20" />
        <rect fill="var(--color-bg-main)" x="140" y="20" width="40" height="40" />
        <rect fill="var(--color-text-primary)" x="150" y="30" width="20" height="20" />
        <rect fill="var(--color-bg-main)" x="20" y="140" width="40" height="40" />
        <rect fill="var(--color-text-primary)" x="30" y="150" width="20" height="20" />
        <rect fill="var(--color-bg-main)" x="80" y="80" width="40" height="40" />
        <text
          x={qrSize / 2}
          y={qrSize - 10}
          textAnchor="middle"
          fontSize="10"
          fill="var(--color-text-disabled)"
        >
          QR Code Preview
        </text>
      </svg>
    );
  };

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Share Form</h2>
          <button style={styles.modalClose} onClick={onClose}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={styles.modalBody}>
          {/* Warning if not published */}
          {!isPublished && (
            <div style={styles.notPublishedWarning}>
              <span style={styles.warningIcon}>⚠️</span>
              <span style={styles.warningText}>
                This form is not published. Publish it first to make it accessible.
              </span>
            </div>
          )}

          {/* Tab List */}
          <div style={styles.shareTabList}>
            <button
              style={{
                ...styles.shareTab,
                ...(activeTab === 'link' ? styles.shareTabActive : {}),
              }}
              onClick={() => setActiveTab('link')}
            >
              Direct Link
            </button>
            <button
              style={{
                ...styles.shareTab,
                ...(activeTab === 'embed' ? styles.shareTabActive : {}),
              }}
              onClick={() => setActiveTab('embed')}
            >
              Embed
            </button>
            <button
              style={{
                ...styles.shareTab,
                ...(activeTab === 'qr' ? styles.shareTabActive : {}),
              }}
              onClick={() => setActiveTab('qr')}
            >
              QR Code
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'link' && (
            <div>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Form URL</label>
                <div style={styles.inputWrapper}>
                  <input
                    type="text"
                    value={formUrl}
                    readOnly
                    style={styles.shareInput}
                  />
                  <button
                    style={{
                      ...styles.copyButton,
                      ...(copied ? styles.copySuccess : {}),
                    }}
                    onClick={() => {
                      handleCopy(formUrl);
                    }}
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', margin: 0 }}>
                Share this link with anyone to let them fill out your form.
              </p>
            </div>
          )}

          {activeTab === 'embed' && (
            <div>
              <div style={styles.inputGroup}>
                <label style={styles.inputLabel}>Embed Code</label>
                <textarea
                  value={embedCode}
                  readOnly
                  style={styles.embedCode}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', margin: 0 }}>
                  Paste this code into your website HTML.
                </p>
                <button
                  style={{
                    ...styles.copyButton,
                    ...(copied ? styles.copySuccess : {}),
                  }}
                  onClick={() => {
                    handleCopy(embedCode);
                  }}
                >
                  {copied ? '✓ Copied!' : 'Copy Code'}
                </button>
              </div>
            </div>
          )}

          {activeTab === 'qr' && (
            <div style={styles.qrContainer}>
              <div style={styles.qrCode}>
                {generateQRPlaceholder()}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', margin: 0, textAlign: 'center' }}>
                Scan this QR code to open the form on a mobile device.
              </p>
              <button
                style={styles.downloadButton}
                onClick={() => {
                  // Generate QR code as PNG and trigger download
                  const canvas = document.createElement('canvas');
                  const size = 400;
                  canvas.width = size;
                  canvas.height = size;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) {
                    return;
                  }

                  // Draw a simple QR-style image with the form URL encoded as text
                  ctx.fillStyle = '#ffffff';
                  ctx.fillRect(0, 0, size, size);
                  ctx.fillStyle = '#000000';

                  // Create a data URL QR representation
                  // Use the SVG element from the placeholder as source
                  const svgEl = document.querySelector<SVGElement>('.qr-container svg');
                  if (svgEl) {
                    const svgData = new XMLSerializer().serializeToString(svgEl);
                    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
                    const url = URL.createObjectURL(svgBlob);
                    const img = new Image();
                    img.onload = () => {
                      ctx.drawImage(img, 0, 0, size, size);
                      // Add URL text at bottom
                      ctx.fillStyle = '#666666';
                      ctx.font = '12px sans-serif';
                      ctx.textAlign = 'center';
                      ctx.fillText(formUrl, size / 2, size - 8);

                      const link = document.createElement('a');
                      link.download = `form-${form.id}-qr-code.png`;
                      link.href = canvas.toDataURL('image/png');
                      link.click();
                      URL.revokeObjectURL(url);
                    };
                    img.src = url;
                  }
                }}
              >
                Download QR Code
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FormBuilder;
