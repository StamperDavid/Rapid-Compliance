'use client';

/**
 * Public Form View
 *
 * Renders published forms for public submission.
 * Supports multi-page forms, validation, and confirmation.
 *
 * @route /f/[formId]
 * @version 1.0.0
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import type {
  FormDefinition,
  FormFieldConfig,
} from '@/lib/forms/types';

// ============================================================================
// TYPES
// ============================================================================

interface PublicFormData {
  form: Partial<FormDefinition>;
  fields: Partial<FormFieldConfig>[];
}

type FormState = 'loading' | 'ready' | 'submitting' | 'success' | 'error';

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0a0a0a',
    color: '#fff',
  },
  loading: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    gap: '1rem',
  },
  spinner: {
    width: '40px',
    height: '40px',
    border: '3px solid #1a1a1a',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  formWrapper: {
    maxWidth: '680px',
    margin: '0 auto',
    padding: '2rem 1.5rem 4rem',
  },
  header: {
    marginBottom: '2rem',
    textAlign: 'center' as const,
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '0.5rem',
  },
  description: {
    fontSize: '1rem',
    color: '#999',
    lineHeight: 1.6,
  },
  progressBar: {
    marginBottom: '2rem',
  },
  progressTrack: {
    height: '4px',
    backgroundColor: '#1a1a1a',
    borderRadius: '2px',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#6366f1',
    transition: 'width 0.3s ease',
  },
  progressText: {
    fontSize: '0.75rem',
    color: '#666',
    marginTop: '0.5rem',
    textAlign: 'center' as const,
  },
  fieldGroup: {
    marginBottom: '1.5rem',
  },
  label: {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#fff',
    marginBottom: '0.5rem',
  },
  required: {
    color: '#ef4444',
    marginLeft: '4px',
  },
  helpText: {
    fontSize: '0.75rem',
    color: '#666',
    marginTop: '0.25rem',
  },
  input: {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '1rem',
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    color: '#fff',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  inputFocus: {
    borderColor: '#6366f1',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textarea: {
    resize: 'vertical' as const,
    minHeight: '120px',
  },
  select: {
    appearance: 'none' as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23999'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 0.75rem center',
    backgroundSize: '1.25rem',
    paddingRight: '2.5rem',
  },
  radioGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.75rem',
  },
  radioOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.75rem 1rem',
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  },
  radioOptionSelected: {
    borderColor: '#6366f1',
    backgroundColor: '#6366f1/10',
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.5rem',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    cursor: 'pointer',
  },
  error: {
    fontSize: '0.75rem',
    color: '#ef4444',
    marginTop: '0.25rem',
  },
  navigation: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '2rem',
    gap: '1rem',
  },
  button: {
    padding: '0.875rem 1.5rem',
    fontSize: '1rem',
    fontWeight: '600',
    borderRadius: '0.5rem',
    cursor: 'pointer',
    transition: 'all 0.2s',
    border: 'none',
  },
  buttonPrimary: {
    backgroundColor: '#6366f1',
    color: '#fff',
  },
  buttonSecondary: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    border: '1px solid #333',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  success: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    textAlign: 'center' as const,
    padding: '2rem',
  },
  successIcon: {
    width: '80px',
    height: '80px',
    borderRadius: '50%',
    backgroundColor: '#22c55e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.5rem',
    fontSize: '2.5rem',
  },
  successTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '0.75rem',
  },
  successMessage: {
    fontSize: '1rem',
    color: '#999',
    maxWidth: '400px',
    lineHeight: 1.6,
  },
  confirmationNumber: {
    marginTop: '1.5rem',
    padding: '1rem 1.5rem',
    backgroundColor: '#111',
    border: '1px solid #333',
    borderRadius: '0.5rem',
  },
  confirmationLabel: {
    fontSize: '0.75rem',
    color: '#666',
    marginBottom: '0.25rem',
  },
  confirmationValue: {
    fontSize: '1.125rem',
    fontWeight: '600',
    color: '#6366f1',
    fontFamily: 'monospace',
  },
  errorState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    textAlign: 'center' as const,
    padding: '2rem',
  },
  errorIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  branding: {
    textAlign: 'center' as const,
    marginTop: '3rem',
    paddingTop: '2rem',
    borderTop: '1px solid #1a1a1a',
  },
  brandingText: {
    fontSize: '0.75rem',
    color: '#666',
  },
  brandingLink: {
    color: '#6366f1',
    textDecoration: 'none',
  },
  divider: {
    height: '1px',
    backgroundColor: '#333',
    margin: '2rem 0',
  },
  heading: {
    fontSize: '1.25rem',
    fontWeight: '600',
    color: '#fff',
    marginBottom: '0.5rem',
  },
  paragraph: {
    fontSize: '0.9375rem',
    color: '#999',
    lineHeight: 1.6,
  },
};

// ============================================================================
// FIELD RENDERER
// ============================================================================

interface FieldRendererProps {
  field: Partial<FormFieldConfig>;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
}

function FieldRenderer({ field, value, error, onChange }: FieldRendererProps) {
  const isRequired = field.validation?.required;

  // Display-only fields
  if (field.type === 'heading') {
    return (
      <div style={styles.fieldGroup}>
        <h3 style={styles.heading}>{field.label}</h3>
      </div>
    );
  }

  if (field.type === 'paragraph') {
    return (
      <div style={styles.fieldGroup}>
        <p style={styles.paragraph}>{field.label}</p>
      </div>
    );
  }

  if (field.type === 'divider') {
    return <div style={styles.divider} />;
  }

  // Input fields
  const inputStyle = {
    ...styles.input,
    ...(error ? styles.inputError : {}),
  };

  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'number':
    case 'currency':
      return (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            {field.label}
            {isRequired && <span style={styles.required}>*</span>}
          </label>
          <input
            type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : field.type === 'number' || field.type === 'currency' ? 'number' : 'text'}
            value={typeof value === 'string' || typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            style={inputStyle}
          />
          {field.helpText && <p style={styles.helpText}>{field.helpText}</p>}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      );

    case 'textarea':
      return (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            {field.label}
            {isRequired && <span style={styles.required}>*</span>}
          </label>
          <textarea
            value={typeof value === 'string' || typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            style={{ ...inputStyle, ...styles.textarea }}
          />
          {field.helpText && <p style={styles.helpText}>{field.helpText}</p>}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      );

    case 'date':
    case 'datetime':
    case 'time':
      return (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            {field.label}
            {isRequired && <span style={styles.required}>*</span>}
          </label>
          <input
            type={field.type === 'datetime' ? 'datetime-local' : field.type}
            value={typeof value === 'string' || typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            style={inputStyle}
          />
          {field.helpText && <p style={styles.helpText}>{field.helpText}</p>}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      );

    case 'dropdown':
      return (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            {field.label}
            {isRequired && <span style={styles.required}>*</span>}
          </label>
          <select
            value={typeof value === 'string' || typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...inputStyle, ...styles.select }}
          >
            <option value="">{field.placeholder ?? 'Select an option'}</option>
            {field.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {field.helpText && <p style={styles.helpText}>{field.helpText}</p>}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      );

    case 'radio':
      return (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            {field.label}
            {isRequired && <span style={styles.required}>*</span>}
          </label>
          <div style={styles.radioGroup}>
            {field.options?.map((opt) => (
              <label
                key={opt.value}
                style={{
                  ...styles.radioOption,
                  ...(value === opt.value ? styles.radioOptionSelected : {}),
                }}
              >
                <input
                  type="radio"
                  name={field.name}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={() => onChange(opt.value)}
                  style={{ accentColor: '#6366f1' }}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
          {field.helpText && <p style={styles.helpText}>{field.helpText}</p>}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      );

    case 'checkbox':
      // Single checkbox
      if (!field.options || field.options.length === 0) {
        return (
          <div style={styles.fieldGroup}>
            <label style={styles.checkbox}>
              <input
                type="checkbox"
                checked={!!value}
                onChange={(e) => onChange(e.target.checked)}
                style={{ accentColor: '#6366f1', width: '18px', height: '18px' }}
              />
              <span style={{ color: '#fff' }}>
                {field.label}
                {isRequired && <span style={styles.required}>*</span>}
              </span>
            </label>
            {field.helpText && <p style={styles.helpText}>{field.helpText}</p>}
            {error && <p style={styles.error}>{error}</p>}
          </div>
        );
      }
      // Checkbox group
      return (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            {field.label}
            {isRequired && <span style={styles.required}>*</span>}
          </label>
          <div style={styles.checkboxGroup}>
            {field.options.map((opt) => {
              const checked = Array.isArray(value) && value.includes(opt.value);
              return (
                <label key={opt.value} style={styles.checkbox}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const current: string[] = Array.isArray(value) ? (value as string[]) : [];
                      if (checked) {
                        onChange(current.filter((v: string) => v !== opt.value));
                      } else {
                        onChange([...current, opt.value]);
                      }
                    }}
                    style={{ accentColor: '#6366f1', width: '18px', height: '18px' }}
                  />
                  <span style={{ color: '#ccc' }}>{opt.label}</span>
                </label>
              );
            })}
          </div>
          {field.helpText && <p style={styles.helpText}>{field.helpText}</p>}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      );

    case 'multiselect':
      return (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            {field.label}
            {isRequired && <span style={styles.required}>*</span>}
          </label>
          <div style={styles.checkboxGroup}>
            {field.options?.map((opt) => {
              const checked = Array.isArray(value) && value.includes(opt.value);
              return (
                <label
                  key={opt.value}
                  style={{
                    ...styles.radioOption,
                    ...(checked ? styles.radioOptionSelected : {}),
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const current: string[] = Array.isArray(value) ? (value as string[]) : [];
                      if (checked) {
                        onChange(current.filter((v: string) => v !== opt.value));
                      } else {
                        onChange([...current, opt.value]);
                      }
                    }}
                    style={{ accentColor: '#6366f1' }}
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
          {field.helpText && <p style={styles.helpText}>{field.helpText}</p>}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      );

    case 'rating':
      return (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            {field.label}
            {isRequired && <span style={styles.required}>*</span>}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => onChange(star)}
                style={{
                  fontSize: '1.75rem',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: star <= (typeof value === 'number' ? value : 0) ? '#fbbf24' : '#333',
                  transition: 'color 0.2s',
                }}
              >
                ★
              </button>
            ))}
          </div>
          {field.helpText && <p style={styles.helpText}>{field.helpText}</p>}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      );

    case 'scale':
      return (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            {field.label}
            {isRequired && <span style={styles.required}>*</span>}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
              <button
                key={num}
                type="button"
                onClick={() => onChange(num)}
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '0.375rem',
                  border: value === num ? '2px solid #6366f1' : '1px solid #333',
                  backgroundColor: value === num ? '#6366f1' : '#111',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                {num}
              </button>
            ))}
          </div>
          {field.helpText && <p style={styles.helpText}>{field.helpText}</p>}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      );

    default:
      return (
        <div style={styles.fieldGroup}>
          <label style={styles.label}>
            {field.label}
            {isRequired && <span style={styles.required}>*</span>}
          </label>
          <input
            type="text"
            value={typeof value === 'string' || typeof value === 'number' ? value : ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            style={inputStyle}
          />
          {field.helpText && <p style={styles.helpText}>{field.helpText}</p>}
          {error && <p style={styles.error}>{error}</p>}
        </div>
      );
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function PublicFormPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const formId = params.formId as string;

  const [formData, setFormData] = useState<PublicFormData | null>(null);
  const [formState, setFormState] = useState<FormState>('loading');
  const [currentPage, setCurrentPage] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmationNumber, setConfirmationNumber] = useState<string | null>(null);

  // Fetch form data
  useEffect(() => {
    const fetchForm = async () => {
      try {
        const response = await fetch(`/api/public/forms/${formId}`);
        if (!response.ok) {
          const data = await response.json() as { error?: string };
          throw new Error(data.error ?? 'Failed to load form');
        }
        const data = await response.json() as PublicFormData;
        setFormData(data);
        setFormState('ready');

        // Set default values
        const defaults: Record<string, unknown> = {};
        data.fields.forEach((field: Partial<FormFieldConfig>) => {
          if (field.defaultValue !== undefined && field.name) {
            defaults[field.name] = field.defaultValue;
          }
        });
        setValues(defaults);
      } catch (err) {
        setSubmitError(err instanceof Error ? err.message : 'Failed to load form');
        setFormState('error');
      }
    };

    void fetchForm();
  }, [formId]);

  // Get fields for current page
  const pageFields = useMemo(() => {
    if (!formData) {
      return [];
    }
    return formData.fields
      .filter((f) => f.pageIndex === currentPage)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [formData, currentPage]);

  // Total pages
  const totalPages = formData?.form.pages?.length ?? 1;

  // Validate current page
  const validatePage = useCallback(() => {
    const newErrors: Record<string, string> = {};

    pageFields.forEach((field) => {
      if (!field.name) {
        return;
      }

      const value = values[field.name];
      const validation = field.validation;

      if (validation?.required) {
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          newErrors[field.name] = validation.customMessage ?? `${field.label} is required`;
        }
      }

      if (value && validation?.minLength && String(value).length < validation.minLength) {
        newErrors[field.name] = `Minimum ${validation.minLength} characters required`;
      }

      if (value && validation?.maxLength && String(value).length > validation.maxLength) {
        newErrors[field.name] = `Maximum ${validation.maxLength} characters allowed`;
      }

      if (value && field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) {
        newErrors[field.name] = 'Please enter a valid email address';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [pageFields, values]);

  // Handle value change
  const handleChange = useCallback((fieldName: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
    setErrors((prev) => {
      const { [fieldName]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Handle next page
  const handleNext = useCallback(() => {
    if (!validatePage()) {
      return;
    }
    if (currentPage < totalPages - 1) {
      setCurrentPage((p) => p + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [validatePage, currentPage, totalPages]);

  // Handle previous page
  const handlePrevious = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage((p) => p - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!validatePage()) {
      return;
    }
    if (!formData) {
      return;
    }

    setFormState('submitting');
    setSubmitError(null);

    try {
      // Build responses object
      const responses: Record<string, unknown> = {};
      formData.fields.forEach((field) => {
        if (field.name && values[field.name] !== undefined) {
          responses[field.name] = values[field.name];
        }
      });

      // Get UTM params
      const metadata = {
        sessionId: Math.random().toString(36).substring(2),
        source: searchParams.get('source') ?? undefined,
        utmSource: searchParams.get('utm_source') ?? undefined,
        utmMedium: searchParams.get('utm_medium') ?? undefined,
        utmCampaign: searchParams.get('utm_campaign') ?? undefined,
      };

      const response = await fetch(`/api/public/forms/${formId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses, metadata }),
      });

      const data = await response.json() as { error?: string; confirmationNumber?: string; redirectUrl?: string };

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to submit form');
      }

      setConfirmationNumber(data.confirmationNumber ?? null);
      setFormState('success');

      // Handle redirect
      if (data.redirectUrl) {
        setTimeout(() => {
          window.location.href = data.redirectUrl as string;
        }, 2000);
      }
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to submit form');
      setFormState('ready');
    }
  }, [validatePage, formData, values, formId, searchParams]);

  // Loading state
  if (formState === 'loading') {
    return (
      <div style={styles.container}>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={styles.loading}>
          <div style={styles.spinner} />
          <p style={{ color: '#666' }}>Loading form...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (formState === 'error') {
    return (
      <div style={styles.container}>
        <div style={styles.errorState}>
          <div style={styles.errorIcon}>⚠️</div>
          <h1 style={styles.successTitle}>Unable to Load Form</h1>
          <p style={styles.successMessage}>{submitError}</p>
        </div>
      </div>
    );
  }

  // Success state
  if (formState === 'success') {
    return (
      <div style={styles.container}>
        <div style={styles.success}>
          <div style={styles.successIcon}>✓</div>
          <h1 style={styles.successTitle}>Thank You!</h1>
          <p style={styles.successMessage}>
            {formData?.form.settings?.confirmationMessage ?? 'Your submission has been received.'}
          </p>
          {confirmationNumber && (
            <div style={styles.confirmationNumber}>
              <p style={styles.confirmationLabel}>Confirmation Number</p>
              <p style={styles.confirmationValue}>{confirmationNumber}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Form view
  return (
    <div style={styles.container}>
      <div style={styles.formWrapper}>
        {/* Header */}
        <header style={styles.header}>
          <h1 style={styles.title}>{formData?.form.name}</h1>
          {formData?.form.description && (
            <p style={styles.description}>{formData.form.description}</p>
          )}
        </header>

        {/* Progress Bar */}
        {totalPages > 1 && formData?.form.settings?.showProgressBar && (
          <div style={styles.progressBar}>
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${((currentPage + 1) / totalPages) * 100}%`,
                }}
              />
            </div>
            {formData?.form.settings?.showPageNumbers && (
              <p style={styles.progressText}>
                Page {currentPage + 1} of {totalPages}
              </p>
            )}
          </div>
        )}

        {/* Form Fields */}
        <form onSubmit={(e) => e.preventDefault()}>
          {pageFields.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              value={field.name ? values[field.name] : undefined}
              error={field.name ? errors[field.name] : undefined}
              onChange={(value) => field.name && handleChange(field.name, value)}
            />
          ))}

          {/* Submit Error */}
          {submitError && (
            <div style={{ ...styles.error, marginBottom: '1rem', padding: '1rem', backgroundColor: '#7f1d1d30', borderRadius: '0.5rem' }}>
              {submitError}
            </div>
          )}

          {/* Navigation */}
          <div style={styles.navigation}>
            {currentPage > 0 ? (
              <button
                type="button"
                onClick={handlePrevious}
                style={{ ...styles.button, ...styles.buttonSecondary }}
              >
                ← Previous
              </button>
            ) : (
              <div />
            )}

            {currentPage < totalPages - 1 ? (
              <button
                type="button"
                onClick={handleNext}
                style={{ ...styles.button, ...styles.buttonPrimary }}
              >
                Next →
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { void handleSubmit(); }}
                disabled={formState === 'submitting'}
                style={{
                  ...styles.button,
                  ...styles.buttonPrimary,
                  ...(formState === 'submitting' ? styles.buttonDisabled : {}),
                }}
              >
                {formState === 'submitting' ? 'Submitting...' : formData?.form.settings?.submitButtonText ?? 'Submit'}
              </button>
            )}
          </div>
        </form>

        {/* Branding - external link to homepage, not internal navigation */}
        {formData?.form.settings?.showBranding && (
          <div style={styles.branding}>
            <p style={styles.brandingText}>
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- External branding link */}
              Powered by <a href="/" style={styles.brandingLink}>AI Sales Platform</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
