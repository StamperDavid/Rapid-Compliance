/**
 * Website Form Widget (live / published site)
 *
 * Renders contact-form, newsletter and custom-form widgets on a PUBLISHED
 * website with real submission behaviour: it POSTs to
 * `/api/website/forms/submit`, shows an honest submitting / success / error
 * state, and includes a honeypot + timing field for basic bot defence.
 *
 * This is intentionally separate from the editor-canvas `WidgetRenderer`,
 * whose forms stay inert (preventDefault) so designers don't fire real
 * submissions while building. The visual styling mirrors the editor's dark
 * theme so the live form matches the design preview.
 */

'use client';

import { useMemo, useRef, useState } from 'react';
import type { Widget } from '@/types/website';

interface WebsiteFormWidgetProps {
  widget: Widget;
  style: React.CSSProperties;
  breakpoint: string;
}

interface NormalizedField {
  name: string;
  label: string;
  type: 'text' | 'email' | 'tel' | 'textarea' | 'select';
  placeholder?: string;
  required: boolean;
  options?: string[];
}

type RawField =
  | string
  | {
      name?: string;
      label?: string;
      type?: string;
      placeholder?: string;
      required?: boolean;
      options?: string[];
    };

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
  fontSize: '1rem',
  background: 'rgba(255,255,255,0.05)',
  color: '#ffffff',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  marginBottom: '0.5rem',
  fontWeight: 500,
  color: '#ffffff',
};

const buttonStyle: React.CSSProperties = {
  padding: '0.75rem 1.5rem',
  background: '#6366f1',
  color: '#ffffff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '1rem',
  fontWeight: 500,
};

/** Human-friendly label for a known field name. */
function labelForName(name: string): string {
  const known: Record<string, string> = {
    name: 'Name',
    fullName: 'Name',
    firstName: 'First Name',
    lastName: 'Last Name',
    email: 'Email',
    phone: 'Phone',
    company: 'Company',
    message: 'Message',
    subject: 'Subject',
  };
  if (known[name]) {
    return known[name];
  }
  // Convert camelCase / snake_case to Title Case.
  const spaced = name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function typeForName(name: string): NormalizedField['type'] {
  const lower = name.toLowerCase();
  if (lower.includes('email')) {
    return 'email';
  }
  if (lower.includes('phone') || lower.includes('tel')) {
    return 'tel';
  }
  if (lower.includes('message') || lower.includes('comment') || lower.includes('note')) {
    return 'textarea';
  }
  return 'text';
}

function normalizeField(raw: RawField): NormalizedField | null {
  if (typeof raw === 'string') {
    const name = raw.trim();
    if (!name) {
      return null;
    }
    const type = typeForName(name);
    return {
      name,
      label: labelForName(name),
      type,
      required: type === 'email' || name.toLowerCase() === 'name',
    };
  }
  const name = (raw.name ?? raw.label ?? '').trim();
  if (!name) {
    return null;
  }
  const rawType = (raw.type ?? '').toLowerCase();
  const type: NormalizedField['type'] =
    rawType === 'email' ||
    rawType === 'tel' ||
    rawType === 'textarea' ||
    rawType === 'select'
      ? rawType
      : rawType === 'text'
        ? 'text'
        : typeForName(name);
  return {
    name,
    label: raw.label ?? labelForName(name),
    type,
    placeholder: raw.placeholder,
    required: raw.required ?? type === 'email',
    options: Array.isArray(raw.options) ? raw.options : undefined,
  };
}

/** Build the visible field list for contact-form / custom-form widgets. */
function buildFields(widget: Widget): NormalizedField[] {
  const rawFields = widget.data.fields;
  let fields: NormalizedField[] = [];
  if (Array.isArray(rawFields) && rawFields.length > 0) {
    fields = (rawFields as RawField[])
      .map(normalizeField)
      .filter((f): f is NormalizedField => f !== null);
  }
  // Fall back to a sensible default so the form is never empty / unusable.
  if (fields.length === 0) {
    fields = [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'message', label: 'Message', type: 'textarea', required: true },
    ];
  }
  return fields;
}

function readUtmMetadata(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }
  const params = new URLSearchParams(window.location.search);
  const meta: Record<string, string> = {};
  const map: Record<string, string> = {
    utm_source: 'utmSource',
    utm_medium: 'utmMedium',
    utm_campaign: 'utmCampaign',
    utm_term: 'utmTerm',
    utm_content: 'utmContent',
  };
  for (const [param, key] of Object.entries(map)) {
    const value = params.get(param);
    if (value) {
      meta[key] = value;
    }
  }
  if (document.referrer) {
    meta.referrer = document.referrer;
  }
  return meta;
}

export function WebsiteFormWidget({ widget, style, breakpoint }: WebsiteFormWidgetProps) {
  const isNewsletter = widget.type === 'newsletter';
  const fields = useMemo(() => (isNewsletter ? [] : buildFields(widget)), [widget, isNewsletter]);

  const [values, setValues] = useState<Record<string, string>>({});
  const [honeypot, setHoneypot] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const loadedAt = useRef<number>(Date.now());

  const saveToCRM = widget.data.saveToCRM === true;
  const successMessage =
    (typeof widget.data.successMessage === 'string' && widget.data.successMessage) ||
    'Thanks! Your submission has been received.';
  const submitText =
    (typeof widget.data.submitText === 'string' && widget.data.submitText) ||
    (typeof widget.data.buttonText === 'string' && widget.data.buttonText) ||
    (isNewsletter ? 'Subscribe' : 'Send Message');

  const setField = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'submitting') {
      return;
    }
    setStatus('submitting');
    setErrorMessage('');

    const collected: Record<string, string> = isNewsletter
      ? { email: values.email ?? '' }
      : values;

    try {
      const response = await fetch('/api/website/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          widgetType: widget.type,
          widgetId: widget.id,
          pagePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
          saveToCRM,
          fields: collected,
          metadata: readUtmMetadata(),
          _honeypot: honeypot,
          _loadedAt: loadedAt.current,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? 'Submission failed. Please try again.');
      }

      setStatus('success');
      setValues({});
    } catch (err) {
      setStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    }
  };

  // Honeypot field — visually hidden, off-screen, ignored by real users.
  const honeypotField = (
    <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', top: 'auto', height: 0, width: 0, overflow: 'hidden' }}>
      <label>
        Leave this field empty
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </label>
    </div>
  );

  if (status === 'success') {
    return (
      <div
        style={{
          ...style,
          padding: '1.5rem',
          background: 'rgba(99,102,241,0.1)',
          border: '1px solid rgba(99,102,241,0.4)',
          borderRadius: '8px',
          color: '#ffffff',
          textAlign: 'center',
        }}
        role="status"
      >
        {successMessage}
      </div>
    );
  }

  const errorBanner = status === 'error' && errorMessage && (
    <div
      style={{
        marginBottom: '1rem',
        padding: '0.75rem 1rem',
        background: 'rgba(239,68,68,0.12)',
        border: '1px solid rgba(239,68,68,0.4)',
        borderRadius: '6px',
        color: '#fca5a5',
        fontSize: '0.875rem',
      }}
      role="alert"
    >
      {errorMessage}
    </div>
  );

  const submitting = status === 'submitting';

  if (isNewsletter) {
    const heading = typeof widget.data.heading === 'string' ? widget.data.heading : '';
    const placeholder =
      (typeof widget.data.placeholder === 'string' && widget.data.placeholder) ||
      'Enter your email';
    const stack = breakpoint === 'mobile';
    return (
      <div style={style}>
        {heading && <h3 style={{ marginBottom: '1rem', color: '#ffffff' }}>{heading}</h3>}
        {errorBanner}
        <form
          onSubmit={(e) => { void handleSubmit(e); }}
          style={{ display: 'flex', flexDirection: stack ? 'column' : 'row', gap: '0.5rem' }}
        >
          {honeypotField}
          <input
            type="email"
            required
            placeholder={placeholder}
            value={values.email ?? ''}
            onChange={(e) => setField('email', e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
            disabled={submitting}
          />
          <button type="submit" style={{ ...buttonStyle, opacity: submitting ? 0.7 : 1 }} disabled={submitting}>
            {submitting ? 'Submitting…' : submitText}
          </button>
        </form>
      </div>
    );
  }

  return (
    <form style={style} onSubmit={(e) => { void handleSubmit(e); }}>
      {honeypotField}
      {errorBanner}
      {fields.map((field) => (
        <div key={field.name} style={{ marginBottom: '1rem' }}>
          <label style={labelStyle} htmlFor={`${widget.id}-${field.name}`}>
            {field.label}
            {field.required && <span style={{ color: '#fca5a5' }}> *</span>}
          </label>
          {field.type === 'textarea' ? (
            <textarea
              id={`${widget.id}-${field.name}`}
              rows={4}
              required={field.required}
              placeholder={field.placeholder}
              value={values[field.name] ?? ''}
              onChange={(e) => setField(field.name, e.target.value)}
              style={{ ...inputStyle, resize: 'vertical' }}
              disabled={submitting}
            />
          ) : field.type === 'select' && field.options ? (
            <select
              id={`${widget.id}-${field.name}`}
              required={field.required}
              value={values[field.name] ?? ''}
              onChange={(e) => setField(field.name, e.target.value)}
              style={inputStyle}
              disabled={submitting}
            >
              <option value="">Select…</option>
              {field.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : (
            <input
              id={`${widget.id}-${field.name}`}
              type={field.type}
              required={field.required}
              placeholder={field.placeholder}
              value={values[field.name] ?? ''}
              onChange={(e) => setField(field.name, e.target.value)}
              style={inputStyle}
              disabled={submitting}
            />
          )}
        </div>
      ))}
      <button type="submit" style={{ ...buttonStyle, opacity: submitting ? 0.7 : 1 }} disabled={submitting}>
        {submitting ? 'Submitting…' : submitText}
      </button>
    </form>
  );
}
