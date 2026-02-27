'use client';

/**
 * Business Question Card
 *
 * Renders a single business question with the appropriate input type.
 */

import React from 'react';

type QuestionType = 'select' | 'checkbox';

interface SelectOption {
  value: string;
  label: string;
}

interface BusinessQuestionCardProps {
  question: string;
  description?: string;
  type: QuestionType;
  options?: SelectOption[];
  value: string | boolean;
  onChange: (value: string | boolean) => void;
}

export function BusinessQuestionCard({
  question,
  description,
  type,
  options,
  value,
  onChange,
}: BusinessQuestionCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-light)',
        borderRadius: '0.75rem',
        padding: '1.25rem',
      }}
    >
      <h4 style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
        {question}
      </h4>
      {description && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-text-disabled)', marginBottom: '0.75rem', marginTop: 0 }}>
          {description}
        </p>
      )}

      {type === 'select' && options && (
        <select
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          style={{
            width: '100%',
            padding: '0.625rem 0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border-light)',
            backgroundColor: 'var(--color-bg-paper)',
            color: 'var(--color-text-primary)',
            fontSize: '0.875rem',
            outline: 'none',
          }}
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      )}

      {type === 'checkbox' && (
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.875rem',
            color: 'var(--color-text-secondary)',
          }}
        >
          <input
            type="checkbox"
            checked={typeof value === 'boolean' ? value : false}
            onChange={(e) => onChange(e.target.checked)}
            style={{
              width: '1.125rem',
              height: '1.125rem',
              accentColor: 'var(--color-primary)',
              cursor: 'pointer',
            }}
          />
          Yes
        </label>
      )}
    </div>
  );
}
