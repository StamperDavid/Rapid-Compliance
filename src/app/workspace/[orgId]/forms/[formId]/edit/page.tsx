'use client';

/**
 * Form Builder Editor Page
 *
 * Full-page form builder interface for creating and editing forms.
 * Wraps the FormBuilder component with data fetching and persistence.
 *
 * @route /workspace/[orgId]/forms/[formId]/edit
 * @version 1.0.0
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FormBuilder } from '@/components/forms';
import type { FormDefinition, FormFieldConfig } from '@/lib/forms/types';

// ============================================================================
// TYPES
// ============================================================================

type LoadingState = 'loading' | 'loaded' | 'error' | 'saving';

// ============================================================================
// STYLES
// ============================================================================

const styles = {
  container: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#0a0a0a',
  },
  loadingContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#0a0a0a',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '3px solid #1a1a1a',
    borderTop: '3px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  loadingText: {
    marginTop: '1.5rem',
    fontSize: '1rem',
    color: '#666',
  },
  errorContainer: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    backgroundColor: '#0a0a0a',
    padding: '2rem',
  },
  errorIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  errorTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: '0.5rem',
  },
  errorText: {
    fontSize: '1rem',
    color: '#666',
    marginBottom: '1.5rem',
    textAlign: 'center' as const,
    maxWidth: '400px',
  },
  errorButton: {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#6366f1',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
  },
  backButton: {
    position: 'absolute' as const,
    top: '1rem',
    left: '1rem',
    padding: '0.5rem 1rem',
    backgroundColor: '#1a1a1a',
    color: '#999',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    fontSize: '0.875rem',
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    zIndex: 100,
  },
  saveIndicator: {
    position: 'fixed' as const,
    bottom: '1.5rem',
    right: '1.5rem',
    padding: '0.75rem 1.25rem',
    backgroundColor: '#1a1a1a',
    border: '1px solid #333',
    borderRadius: '0.5rem',
    color: '#999',
    fontSize: '0.875rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    zIndex: 100,
  },
  saveSuccess: {
    borderColor: '#22c55e',
    color: '#22c55e',
  },
};

// ============================================================================
// DEFAULT FORM STRUCTURE
// ============================================================================

const createDefaultForm = (
  formId: string,
  orgId: string,
  workspaceId: string,
  name: string
): FormDefinition => ({
  id: formId,
  organizationId: orgId,
  workspaceId,
  name: name || 'Untitled Form',
  status: 'draft',
  version: 1,
  pages: [
    {
      id: 'page_1',
      title: 'Page 1',
      order: 0,
    },
  ],
  settings: {
    submitButtonText: 'Submit',
    showProgressBar: true,
    showPageNumbers: true,
    allowSaveDraft: false,
    confirmationType: 'message',
    confirmationMessage: 'Thank you for your submission!',
    sendEmailNotification: false,
    sendAutoReply: false,
    showBranding: true,
    enableCaptcha: false,
    requireLogin: false,
  },
  behavior: {
    maxSubmissions: 0,
    allowMultipleSubmissions: true,
    showThankYouPage: true,
    enableSaveAndContinue: false,
  },
  crmMapping: {
    enabled: false,
    entityType: 'lead',
    fieldMappings: [],
    createNew: true,
    updateExisting: false,
  },
  trackingEnabled: true,
  publicAccess: true,
  createdBy: '',
  lastModifiedBy: '',
  createdAt: new Date() as any,
  updatedAt: new Date() as any,
  fieldCount: 0,
  submissionCount: 0,
  viewCount: 0,
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function FormEditorPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const formId = params.formId as string;

  const [form, setForm] = useState<FormDefinition | null>(null);
  const [fields, setFields] = useState<FormFieldConfig[]>([]);
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [error, setError] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Fetch form data
  const fetchForm = useCallback(async () => {
    try {
      setLoadingState('loading');
      setError(null);

      // Check if this is a new form
      if (formId === 'new') {
        const newForm = createDefaultForm(
          `form_${Date.now()}`,
          orgId,
          'default',
          'Untitled Form'
        );
        setForm(newForm);
        setFields([]);
        setLoadingState('loaded');
        return;
      }

      const response = await fetch(
        `/api/workspace/${orgId}/forms/${formId}?workspaceId=default`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Form not found');
        }
        throw new Error('Failed to fetch form');
      }

      const data = await response.json();
      setForm(data.form);
      setFields(data.fields || []);
      setLoadingState('loaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load form');
      setLoadingState('error');
    }
  }, [orgId, formId]);

  useEffect(() => {
    fetchForm();
  }, [fetchForm]);

  // Handle form changes
  const handleFormChange = useCallback((updatedForm: FormDefinition) => {
    setForm(updatedForm);
    setHasUnsavedChanges(true);
  }, []);

  // Handle fields changes
  const handleFieldsChange = useCallback((updatedFields: FormFieldConfig[]) => {
    setFields(updatedFields);
    setHasUnsavedChanges(true);
  }, []);

  // Save form
  const handleSave = useCallback(async () => {
    if (!form) return;

    try {
      setLoadingState('saving');
      setSaveMessage(null);

      const response = await fetch(`/api/workspace/${orgId}/forms/${form.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'default',
          form,
          fields,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save form');
      }

      setHasUnsavedChanges(false);
      setSaveMessage('Saved successfully');
      setLoadingState('loaded');

      // Clear save message after 3 seconds
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save form');
      setLoadingState('loaded');
    }
  }, [orgId, form, fields]);

  // Publish form
  const handlePublish = useCallback(async () => {
    if (!form) return;

    try {
      setLoadingState('saving');

      const response = await fetch(
        `/api/workspace/${orgId}/forms/${form.id}/publish`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ workspaceId: 'default' }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to publish form');
      }

      setForm({ ...form, status: 'published' });
      setSaveMessage('Form published successfully!');
      setLoadingState('loaded');
      setHasUnsavedChanges(false);

      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish form');
      setLoadingState('loaded');
    }
  }, [orgId, form]);

  // Preview form
  const handlePreview = useCallback(() => {
    if (!form) return;
    window.open(`/forms/${form.id}/preview`, '_blank');
  }, [form]);

  // Handle back navigation
  const handleBack = useCallback(() => {
    if (hasUnsavedChanges) {
      const confirmed = window.confirm(
        'You have unsaved changes. Are you sure you want to leave?'
      );
      if (!confirmed) return;
    }
    router.push(`/workspace/${orgId}/forms`);
  }, [router, orgId, hasUnsavedChanges]);

  // Warn before unload
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Loading state
  if (loadingState === 'loading') {
    return (
      <div style={styles.loadingContainer}>
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading form builder...</p>
      </div>
    );
  }

  // Error state
  if (loadingState === 'error' || !form) {
    return (
      <div style={styles.errorContainer}>
        <div style={styles.errorIcon}>⚠️</div>
        <h1 style={styles.errorTitle}>Unable to Load Form</h1>
        <p style={styles.errorText}>
          {error || 'An unexpected error occurred while loading the form.'}
        </p>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            style={{
              ...styles.errorButton,
              backgroundColor: '#1a1a1a',
              border: '1px solid #333',
            }}
            onClick={handleBack}
          >
            ← Back to Forms
          </button>
          <button style={styles.errorButton} onClick={fetchForm}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* Back Button */}
      <button style={styles.backButton} onClick={handleBack}>
        ← Back to Forms
      </button>

      {/* Form Builder */}
      <FormBuilder
        form={form}
        fields={fields}
        onFormChange={handleFormChange}
        onFieldsChange={handleFieldsChange}
        onSave={handleSave}
        onPublish={handlePublish}
        onPreview={handlePreview}
      />

      {/* Save Indicator */}
      {(saveMessage || loadingState === 'saving') && (
        <div
          style={{
            ...styles.saveIndicator,
            ...(saveMessage?.includes('success') ? styles.saveSuccess : {}),
          }}
        >
          {loadingState === 'saving' ? (
            <>
              <span>💾</span>
              <span>Saving...</span>
            </>
          ) : (
            <>
              <span>✓</span>
              <span>{saveMessage}</span>
            </>
          )}
        </div>
      )}

      {/* Unsaved Changes Indicator */}
      {hasUnsavedChanges && !saveMessage && loadingState !== 'saving' && (
        <div style={styles.saveIndicator}>
          <span>●</span>
          <span>Unsaved changes</span>
        </div>
      )}
    </div>
  );
}
