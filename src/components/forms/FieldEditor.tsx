'use client';

/**
 * Field Editor
 *
 * Property editor panel for configuring selected form fields.
 * Supports all field types with appropriate configuration options.
 *
 * @module components/forms/FieldEditor
 * @version 1.0.0
 */

import { useState } from 'react';
import type { FormFieldConfig, FormFieldOption, FormFieldValidation } from '@/lib/forms/types';

// ============================================================================
// TYPES
// ============================================================================

interface FieldEditorProps {
  field: FormFieldConfig;
  onUpdate: (updates: Partial<FormFieldConfig>) => void;
  onClose: () => void;
}

type EditorTab = 'general' | 'validation' | 'conditional' | 'mapping';

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
    borderBottom: '1px solid var(--color-border-light)',
  },
  headerTitle: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--color-text-primary)',
  },
  closeButton: {
    padding: '0.25rem 0.5rem',
    fontSize: '1rem',
    color: 'var(--color-text-secondary)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--color-border-light)',
    padding: '0 1rem',
  },
  tab: {
    padding: '0.75rem 1rem',
    fontSize: '0.75rem',
    fontWeight: '500',
    color: 'var(--color-text-secondary)',
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 0.2s',
  },
  tabActive: {
    color: 'var(--color-text-primary)',
    borderBottom: '2px solid var(--color-primary)',
  },
  content: {
    flex: 1,
    padding: '1rem',
    overflowY: 'auto' as const,
  },
  section: {
    marginBottom: '1.5rem',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--color-text-secondary)',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
  },
  field: {
    marginBottom: '1rem',
  },
  label: {
    display: 'block',
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
    marginBottom: '0.375rem',
  },
  input: {
    width: '100%',
    padding: '0.5rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '0.375rem',
    color: 'var(--color-text-primary)',
  },
  textarea: {
    width: '100%',
    padding: '0.5rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '0.375rem',
    color: 'var(--color-text-primary)',
    resize: 'vertical' as const,
    minHeight: '60px',
  },
  select: {
    width: '100%',
    padding: '0.5rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '0.375rem',
    color: 'var(--color-text-primary)',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 0',
    cursor: 'pointer',
  },
  checkboxLabel: {
    fontSize: '0.875rem',
    color: '#ccc',
  },
  optionRow: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '0.5rem',
    alignItems: 'center',
  },
  optionInput: {
    flex: 1,
    padding: '0.375rem 0.5rem',
    fontSize: '0.875rem',
    backgroundColor: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '0.375rem',
    color: 'var(--color-text-primary)',
  },
  optionButton: {
    padding: '0.375rem 0.5rem',
    fontSize: '0.75rem',
    color: 'var(--color-text-secondary)',
    backgroundColor: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '0.375rem',
    cursor: 'pointer',
  },
  addButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.75rem',
    color: 'var(--color-primary)',
    backgroundColor: 'transparent',
    border: '1px dashed var(--color-border-light)',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    width: '100%',
  },
  widthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '0.5rem',
  },
  widthOption: {
    padding: '0.5rem',
    fontSize: '0.75rem',
    textAlign: 'center' as const,
    color: 'var(--color-text-secondary)',
    backgroundColor: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-border-light)',
    borderRadius: '0.375rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  widthOptionActive: {
    color: 'var(--color-text-primary)',
    borderColor: 'var(--color-primary)',
    backgroundColor: '#1e1e2f',
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function FieldEditor({ field, onUpdate, onClose }: FieldEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>('general');

  const hasOptions = ['dropdown', 'multiselect', 'radio', 'checkbox'].includes(field.type);

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>Field Properties</span>
        <button style={styles.closeButton} onClick={onClose}>
          ×
        </button>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'general' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'validation' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('validation')}
        >
          Validation
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'conditional' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('conditional')}
        >
          Logic
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'mapping' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('mapping')}
        >
          CRM
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'general' && (
          <GeneralTab field={field} onUpdate={onUpdate} hasOptions={hasOptions} />
        )}
        {activeTab === 'validation' && (
          <ValidationTab field={field} onUpdate={onUpdate} />
        )}
        {activeTab === 'conditional' && (
          <ConditionalTab field={field} onUpdate={onUpdate} />
        )}
        {activeTab === 'mapping' && (
          <MappingTab field={field} onUpdate={onUpdate} />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// GENERAL TAB
// ============================================================================

interface TabProps {
  field: FormFieldConfig;
  onUpdate: (updates: Partial<FormFieldConfig>) => void;
  hasOptions?: boolean;
}

function GeneralTab({ field, onUpdate, hasOptions }: TabProps) {
  // Handle option update
  const updateOption = (index: number, updates: Partial<FormFieldOption>) => {
    const newOptions = [...(field.options ?? [])];
    newOptions[index] = { ...newOptions[index], ...updates };
    onUpdate({ options: newOptions });
  };

  // Handle option add
  const addOption = () => {
    const newOptions = [
      ...(field.options ?? []),
      {
        label: `Option ${(field.options?.length ?? 0) + 1}`,
        value: `option${(field.options?.length ?? 0) + 1}`,
      },
    ];
    onUpdate({ options: newOptions });
  };

  // Handle option delete
  const deleteOption = (index: number) => {
    const newOptions = field.options?.filter((_, i) => i !== index) ?? [];
    onUpdate({ options: newOptions });
  };

  return (
    <>
      {/* Basic Settings */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Basic Settings</div>

        {/* Label */}
        <div style={styles.field}>
          <label style={styles.label}>Label</label>
          <input
            type="text"
            value={field.label}
            onChange={(e) => onUpdate({ label: e.target.value })}
            style={styles.input}
          />
        </div>

        {/* Name (machine name) */}
        <div style={styles.field}>
          <label style={styles.label}>Field Name (ID)</label>
          <input
            type="text"
            value={field.name}
            onChange={(e) =>
              onUpdate({ name: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })
            }
            style={styles.input}
            placeholder="field_name"
          />
        </div>

        {/* Placeholder */}
        {!['heading', 'paragraph', 'divider', 'pagebreak'].includes(field.type) && (
          <div style={styles.field}>
            <label style={styles.label}>Placeholder</label>
            <input
              type="text"
              value={field.placeholder ?? ''}
              onChange={(e) => onUpdate({ placeholder: e.target.value })}
              style={styles.input}
            />
          </div>
        )}

        {/* Help Text */}
        <div style={styles.field}>
          <label style={styles.label}>Help Text</label>
          <textarea
            value={field.helpText ?? ''}
            onChange={(e) => onUpdate({ helpText: e.target.value })}
            style={styles.textarea}
            rows={2}
          />
        </div>
      </div>

      {/* Options (for select fields) */}
      {hasOptions && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>Options</div>
          {field.options?.map((option, index) => (
            <div key={index} style={styles.optionRow}>
              <input
                type="text"
                value={option.label}
                onChange={(e) => updateOption(index, { label: e.target.value })}
                style={styles.optionInput}
                placeholder="Label"
              />
              <input
                type="text"
                value={option.value}
                onChange={(e) => updateOption(index, { value: e.target.value })}
                style={{ ...styles.optionInput, flex: 0.5 }}
                placeholder="Value"
              />
              <button
                style={styles.optionButton}
                onClick={() => deleteOption(index)}
              >
                ×
              </button>
            </div>
          ))}
          <button style={styles.addButton} onClick={addOption}>
            + Add Option
          </button>
        </div>
      )}

      {/* Layout */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Layout</div>

        {/* Width */}
        <div style={styles.field}>
          <label style={styles.label}>Field Width</label>
          <div style={styles.widthGrid}>
            {(['full', 'half', 'third', 'quarter'] as const).map((width) => (
              <button
                key={width}
                style={{
                  ...styles.widthOption,
                  ...(field.width === width ? styles.widthOptionActive : {}),
                }}
                onClick={() => onUpdate({ width })}
              >
                {width === 'full' && '100%'}
                {width === 'half' && '50%'}
                {width === 'third' && '33%'}
                {width === 'quarter' && '25%'}
              </button>
            ))}
          </div>
        </div>

        {/* CSS Class */}
        <div style={styles.field}>
          <label style={styles.label}>CSS Class (optional)</label>
          <input
            type="text"
            value={field.cssClass ?? ''}
            onChange={(e) => onUpdate({ cssClass: e.target.value })}
            style={styles.input}
            placeholder="custom-class"
          />
        </div>
      </div>
    </>
  );
}

// ============================================================================
// VALIDATION TAB
// ============================================================================

function ValidationTab({ field, onUpdate }: TabProps) {
  const validation = field.validation ?? {};

  const updateValidation = (updates: Partial<FormFieldValidation>) => {
    onUpdate({
      validation: { ...validation, ...updates },
    });
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Validation Rules</div>

      {/* Required */}
      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={validation.required ?? false}
          onChange={(e) => updateValidation({ required: e.target.checked })}
        />
        <span style={styles.checkboxLabel}>Required field</span>
      </label>

      {/* Text fields */}
      {['text', 'textarea', 'email', 'phone'].includes(field.type) && (
        <>
          <div style={styles.field}>
            <label style={styles.label}>Minimum Length</label>
            <input
              type="number"
              value={validation.minLength ?? ''}
              onChange={(e) =>
                updateValidation({ minLength: parseInt(e.target.value) || undefined })
              }
              style={styles.input}
              min={0}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Maximum Length</label>
            <input
              type="number"
              value={validation.maxLength ?? ''}
              onChange={(e) =>
                updateValidation({ maxLength: parseInt(e.target.value) || undefined })
              }
              style={styles.input}
              min={0}
            />
          </div>
        </>
      )}

      {/* Number fields */}
      {['number', 'currency'].includes(field.type) && (
        <>
          <div style={styles.field}>
            <label style={styles.label}>Minimum Value</label>
            <input
              type="number"
              value={validation.min ?? ''}
              onChange={(e) =>
                updateValidation({ min: parseFloat(e.target.value) || undefined })
              }
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Maximum Value</label>
            <input
              type="number"
              value={validation.max ?? ''}
              onChange={(e) =>
                updateValidation({ max: parseFloat(e.target.value) || undefined })
              }
              style={styles.input}
            />
          </div>
        </>
      )}

      {/* File upload */}
      {['file', 'image'].includes(field.type) && (
        <>
          <div style={styles.field}>
            <label style={styles.label}>Max File Size (MB)</label>
            <input
              type="number"
              value={(validation.maxFileSize ?? 0) / 1024 / 1024 || ''}
              onChange={(e) =>
                updateValidation({
                  maxFileSize: parseFloat(e.target.value) * 1024 * 1024 || undefined,
                })
              }
              style={styles.input}
              min={0}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Allowed File Types</label>
            <input
              type="text"
              value={validation.allowedFileTypes?.join(', ') ?? ''}
              onChange={(e) =>
                updateValidation({
                  allowedFileTypes: e.target.value
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean),
                })
              }
              style={styles.input}
              placeholder=".pdf, .doc, .docx"
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Max Files</label>
            <input
              type="number"
              value={validation.maxFiles ?? ''}
              onChange={(e) =>
                updateValidation({ maxFiles: parseInt(e.target.value) || undefined })
              }
              style={styles.input}
              min={1}
            />
          </div>
        </>
      )}

      {/* Pattern */}
      <div style={styles.field}>
        <label style={styles.label}>Custom Pattern (Regex)</label>
        <input
          type="text"
          value={validation.pattern ?? ''}
          onChange={(e) => updateValidation({ pattern: e.target.value || undefined })}
          style={styles.input}
          placeholder="^[A-Z]{2,4}$"
        />
      </div>

      {/* Custom Error Message */}
      <div style={styles.field}>
        <label style={styles.label}>Custom Error Message</label>
        <input
          type="text"
          value={validation.customMessage ?? ''}
          onChange={(e) => updateValidation({ customMessage: e.target.value || undefined })}
          style={styles.input}
          placeholder="Please enter a valid value"
        />
      </div>
    </div>
  );
}

// ============================================================================
// CONDITIONAL TAB
// ============================================================================

function ConditionalTab({ field, onUpdate }: TabProps) {
  const logic = field.conditionalLogic ?? {
    enabled: false,
    action: 'show' as const,
    logicType: 'all' as const,
    conditions: [],
  };

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Conditional Logic</div>

      {/* Enable Toggle */}
      <label style={styles.checkbox}>
        <input
          type="checkbox"
          checked={logic.enabled}
          onChange={(e) =>
            onUpdate({
              conditionalLogic: { ...logic, enabled: e.target.checked },
            })
          }
        />
        <span style={styles.checkboxLabel}>Enable conditional logic</span>
      </label>

      {logic.enabled && (
        <>
          {/* Action */}
          <div style={styles.field}>
            <label style={styles.label}>Action</label>
            <select
              value={logic.action}
              onChange={(e) =>
                onUpdate({
                  conditionalLogic: { ...logic, action: e.target.value as 'show' | 'hide' },
                })
              }
              style={styles.select}
            >
              <option value="show">Show this field</option>
              <option value="hide">Hide this field</option>
            </select>
          </div>

          {/* Logic Type */}
          <div style={styles.field}>
            <label style={styles.label}>When</label>
            <select
              value={logic.logicType}
              onChange={(e) =>
                onUpdate({
                  conditionalLogic: { ...logic, logicType: e.target.value as 'all' | 'any' },
                })
              }
              style={styles.select}
            >
              <option value="all">ALL conditions are met</option>
              <option value="any">ANY condition is met</option>
            </select>
          </div>

          {/* Conditions Preview */}
          <div
            style={{
              padding: '1rem',
              backgroundColor: 'var(--color-bg-elevated)',
              borderRadius: '0.5rem',
              marginTop: '1rem',
            }}
          >
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', margin: 0 }}>
              {logic.conditions.length === 0
                ? 'No conditions configured. Add conditions by referencing other fields.'
                : `${logic.conditions.length} condition(s) configured.`}
            </p>
            <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem', margin: 0 }}>
              Note: Full condition builder available in form settings.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// CRM MAPPING TAB
// ============================================================================

function MappingTab({ field, onUpdate }: TabProps) {
  const mapping = field.crmMapping ?? { entityField: '' };

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>CRM Field Mapping</div>

      <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '1rem' }}>
        Map this form field to a CRM field to automatically sync data.
      </p>

      {/* CRM Entity Field */}
      <div style={styles.field}>
        <label style={styles.label}>CRM Field</label>
        <select
          value={mapping.entityField ?? ''}
          onChange={(e) =>
            onUpdate({
              crmMapping: { ...mapping, entityField: e.target.value },
            })
          }
          style={styles.select}
        >
          <option value="">-- Select CRM Field --</option>
          <optgroup label="Lead">
            <option value="lead.firstName">First Name</option>
            <option value="lead.lastName">Last Name</option>
            <option value="lead.email">Email</option>
            <option value="lead.phone">Phone</option>
            <option value="lead.company">Company</option>
            <option value="lead.title">Job Title</option>
            <option value="lead.website">Website</option>
            <option value="lead.source">Lead Source</option>
          </optgroup>
          <optgroup label="Contact">
            <option value="contact.firstName">First Name</option>
            <option value="contact.lastName">Last Name</option>
            <option value="contact.email">Email</option>
            <option value="contact.phone">Phone</option>
          </optgroup>
          <optgroup label="Deal">
            <option value="deal.name">Deal Name</option>
            <option value="deal.value">Deal Value</option>
            <option value="deal.notes">Notes</option>
          </optgroup>
          <optgroup label="Address">
            <option value="lead.street">Street</option>
            <option value="lead.city">City</option>
            <option value="lead.state">State</option>
            <option value="lead.zip">Zip Code</option>
            <option value="lead.country">Country</option>
          </optgroup>
        </select>
      </div>

      {/* Transform */}
      <div style={styles.field}>
        <label style={styles.label}>Transform</label>
        <select
          value={mapping.transform ?? 'none'}
          onChange={(e) =>
            onUpdate({
              crmMapping: { ...mapping, transform: e.target.value },
            })
          }
          style={styles.select}
        >
          <option value="none">None</option>
          <option value="uppercase">UPPERCASE</option>
          <option value="lowercase">lowercase</option>
          <option value="capitalize">Capitalize</option>
          <option value="trim">Trim whitespace</option>
        </select>
      </div>
    </div>
  );
}

export default FieldEditor;
