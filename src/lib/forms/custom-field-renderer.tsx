'use client';

/**
 * Custom Field Renderer
 *
 * Reusable renderer for operator-defined custom fields on CRM objects.
 * Extracted from the inline `renderFormField` logic in
 * `src/app/(dashboard)/entities/[entityName]/page.tsx` so the bespoke
 * contact/company/deal/lead detail + edit pages render custom fields
 * consistently.
 *
 * Two surfaces:
 *  - `CustomFieldInput`  — definition + value -> editable input (edit pages)
 *  - `CustomFieldsCard`  — read-only "Custom Fields" card (detail pages)
 *
 * The field definitions come from the generic schema engine
 * (`/api/schemas/<object>` or the standard CRM schema), so this component
 * accepts the lightweight `{ key, label, type, options? }` field shape.
 *
 * @module lib/forms/custom-field-renderer
 */

import type { CustomFieldValue } from '@/types/crm-entities';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Minimal field-definition shape needed to render an input.
 * Matches the schema-engine field shape: { id, key, label, type, required, options? }.
 */
export interface CustomFieldDef {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  description?: string;
}

export type CustomFieldRecord = Record<string, CustomFieldValue>;

interface CustomFieldInputProps {
  field: CustomFieldDef;
  value: CustomFieldValue;
  onChange: (key: string, value: CustomFieldValue) => void;
}

interface CustomFieldsCardProps {
  fields: CustomFieldDef[];
  values: CustomFieldRecord | undefined;
  /** Optional heading override. */
  title?: string;
}

// ============================================================================
// VALUE FORMATTING (read-only display)
// ============================================================================

/**
 * Format a custom-field value for read-only display, honouring the field type.
 */
export function formatCustomFieldValue(
  value: CustomFieldValue,
  field: CustomFieldDef
): string {
  if (value === null || value === undefined || value === '') {
    return '—';
  }

  switch (field.type) {
    case 'currency':
      return `$${Number(value).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    case 'percent':
      return `${String(value)}%`;
    case 'checkbox':
      return value ? 'Yes' : 'No';
    case 'date':
      try {
        return new Date(value as string | number).toLocaleDateString();
      } catch {
        return String(value);
      }
    case 'multiSelect':
      return Array.isArray(value) ? value.join(', ') : String(value);
    default:
      return String(value);
  }
}

// ============================================================================
// INPUT RENDERER (edit pages)
// ============================================================================

const INPUT_CLASS =
  'w-full px-4 py-2 bg-surface-elevated text-foreground border border-border-strong rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary';

/**
 * Render an editable input for a single custom field, keyed by `field.key`.
 */
export function CustomFieldInput({ field, value, onChange }: CustomFieldInputProps): React.JSX.Element {
  switch (field.type) {
    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(field.key, e.target.checked)}
            className="w-5 h-5 accent-primary"
          />
          <span className="text-foreground text-sm">{value ? 'Yes' : 'No'}</span>
        </label>
      );

    case 'singleSelect': {
      const options = field.options ?? [];
      return (
        <select
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={`${INPUT_CLASS} cursor-pointer`}
        >
          <option value="">Select {field.label}…</option>
          {options.map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      );
    }

    case 'multiSelect': {
      const options = field.options ?? [];
      const selected = Array.isArray(value) ? (value as string[]) : [];
      const toggle = (opt: string): void => {
        const next = selected.includes(opt)
          ? selected.filter((v) => v !== opt)
          : [...selected, opt];
        onChange(field.key, next);
      };
      return (
        <div className="flex flex-col gap-1 p-2 max-h-48 overflow-y-auto bg-surface-elevated border border-border-strong rounded-lg">
          {options.length === 0 ? (
            <span className="text-muted-foreground text-sm">No options available</span>
          ) : (
            options.map((opt) => (
              <label key={opt} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.includes(opt)}
                  onChange={() => toggle(opt)}
                  className="w-4 h-4 accent-primary"
                />
                <span className="text-foreground text-sm">{opt}</span>
              </label>
            ))
          )}
        </div>
      );
    }

    case 'longText':
      return (
        <textarea
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={`${INPUT_CLASS} min-h-[100px] resize-y`}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      );

    case 'number':
    case 'currency':
    case 'percent':
      return (
        <input
          type="number"
          value={value != null && value !== '' ? Number(value) : ''}
          onChange={(e) =>
            onChange(field.key, e.target.value === '' ? null : parseFloat(e.target.value))
          }
          className={INPUT_CLASS}
          placeholder={`Enter ${field.label.toLowerCase()}`}
          step={field.type === 'currency' ? '0.01' : '1'}
        />
      );

    case 'date':
      return (
        <input
          type="date"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={INPUT_CLASS}
        />
      );

    case 'email':
      return (
        <input
          type="email"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={INPUT_CLASS}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      );

    case 'url':
      return (
        <input
          type="url"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={INPUT_CLASS}
          placeholder="https://…"
        />
      );

    case 'phoneNumber':
      return (
        <input
          type="tel"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={INPUT_CLASS}
          placeholder="+1 (555) 123-4567"
        />
      );

    default:
      return (
        <input
          type="text"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(field.key, e.target.value)}
          className={INPUT_CLASS}
          placeholder={`Enter ${field.label.toLowerCase()}`}
        />
      );
  }
}

/**
 * Render a labelled group of custom-field inputs (for edit forms).
 * Returns null when there are no custom fields defined.
 */
export function CustomFieldInputs({
  fields,
  values,
  onChange,
}: {
  fields: CustomFieldDef[];
  values: CustomFieldRecord;
  onChange: (key: string, value: CustomFieldValue) => void;
}): React.JSX.Element | null {
  if (fields.length === 0) {
    return null;
  }
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <div key={field.key}>
          <label className="block text-sm font-medium mb-2">
            {field.label}
            {field.required ? <span className="text-destructive"> *</span> : null}
          </label>
          <CustomFieldInput field={field} value={values[field.key] ?? null} onChange={onChange} />
          {field.description ? (
            <p className="text-xs text-muted-foreground mt-1">{field.description}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// READ-ONLY CARD (detail pages)
// ============================================================================

/**
 * Read-only "Custom Fields" card for detail pages.
 * Returns null when there are no custom fields defined for the object.
 */
export function CustomFieldsCard({
  fields,
  values,
  title = 'Custom Fields',
}: CustomFieldsCardProps): React.JSX.Element | null {
  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-lg p-6">
      <h2 className="text-lg font-semibold mb-4">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {fields.map((field) => (
          <div key={field.key}>
            <div className="text-sm text-muted-foreground mb-1">{field.label}</div>
            <div className="text-sm text-foreground whitespace-pre-wrap">
              {formatCustomFieldValue(values?.[field.key] ?? null, field)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
