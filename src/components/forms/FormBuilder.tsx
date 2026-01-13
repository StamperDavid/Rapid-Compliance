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
type ShareTab = 'link' | 'embed' | 'qr';

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
    backgroundColor: '#1a1a1a',
    borderRadius: '1rem',
    border: '1px solid #333',
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
    borderBottom: '1px solid #333',
  },
  modalTitle: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#fff',
    margin: 0,
  },
  modalClose: {
    backgroundColor: 'transparent',
    border: 'none',
    color: '#666',
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
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    color: '#999',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  shareTabActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
    color: '#fff',
  },
  inputGroup: {
    marginBottom: '1rem',
  },
  inputLabel: {
    display: 'block',
    fontSize: '0.75rem',
    color: '#999',
    marginBottom: '0.5rem',
  },
  inputWrapper: {
    display: 'flex',
    gap: '0.5rem',
  },
  shareInput: {
    flex: 1,
    padding: '0.75rem 1rem',
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    color: '#fff',
    fontSize: '0.875rem',
    fontFamily: 'monospace',
  },
  copyButton: {
    padding: '0.75rem 1rem',
    backgroundColor: '#333',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
    whiteSpace: 'nowrap' as const,
  },
  copySuccess: {
    backgroundColor: '#22c55e',
  },
  embedCode: {
    width: '100%',
    padding: '1rem',
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    color: '#fff',
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
    backgroundColor: '#fff',
    padding: '1rem',
    borderRadius: '0.5rem',
  },
  downloadButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#6366f1',
    border: 'none',
    borderRadius: '0.5rem',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.875rem',
    fontWeight: '500',
  },
  notPublishedWarning: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '1rem',
    backgroundColor: '#7f1d1d30',
    border: '1px solid #b91c1c',
    borderRadius: '0.5rem',
    marginBottom: '1rem',
  },
  warningIcon: {
    fontSize: '1.25rem',
  },
  warningText: {
    fontSize: '0.875rem',
    color: '#fca5a5',
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
  const [showShareModal, setShowShareModal] = useState(false);

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

  const handleCopy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  // Generate simple QR code as SVG (basic implementation)
  const qrSize = 200;
  const generateQRPlaceholder = () => {
    // This is a placeholder - in production, use a QR library like qrcode
    return (
      <svg width={qrSize} height={qrSize} viewBox={`0 0 ${qrSize} ${qrSize}`}>
        <rect fill="#fff" width={qrSize} height={qrSize} />
        <rect fill="#000" x="20" y="20" width="40" height="40" />
        <rect fill="#fff" x="30" y="30" width="20" height="20" />
        <rect fill="#000" x="140" y="20" width="40" height="40" />
        <rect fill="#fff" x="150" y="30" width="20" height="20" />
        <rect fill="#000" x="20" y="140" width="40" height="40" />
        <rect fill="#fff" x="30" y="150" width="20" height="20" />
        <rect fill="#000" x="80" y="80" width="40" height="40" />
        <text
          x={qrSize / 2}
          y={qrSize - 10}
          textAnchor="middle"
          fontSize="10"
          fill="#666"
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
                    onClick={() => handleCopy(formUrl)}
                  >
                    {copied ? '✓ Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>
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
                <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>
                  Paste this code into your website HTML.
                </p>
                <button
                  style={{
                    ...styles.copyButton,
                    ...(copied ? styles.copySuccess : {}),
                  }}
                  onClick={() => handleCopy(embedCode)}
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
              <p style={{ fontSize: '0.75rem', color: '#666', margin: 0, textAlign: 'center' }}>
                Scan this QR code to open the form on a mobile device.
              </p>
              <button
                style={styles.downloadButton}
                onClick={() => {
                  // In production, generate and download actual QR code
                  alert('QR code download coming soon!');
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
