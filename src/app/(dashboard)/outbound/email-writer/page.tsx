'use client';

import { PLATFORM_ID } from '@/lib/constants/platform';

import React, { useState } from 'react';
import Link from 'next/link';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// TYPES
// ============================================================================

interface GeneratedEmail {
  success: boolean;
  error?: string;
  email: {
    subject: string;
    body: string;
    personalizationScore: number;
    subjectVariants?: string[];
  };
  research?: {
    insights: string[];
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function EmailWriterPage() {
  const { theme } = useOrgTheme();
  const toast = useToast();
  const [prospect, setProspect] = useState({
    name: '',
    company: '',
    title: '',
    email: '',
    linkedin: '',
  });
  const [template, setTemplate] = useState<'AIDA' | 'PAS' | 'BAB' | 'custom'>('AIDA');
  const [tone, setTone] = useState<'professional' | 'casual' | 'friendly' | 'direct'>('professional');
  const [valueProposition, setValueProposition] = useState('');
  const [cta, setCta] = useState('book a 15-minute call');
  const [skipResearch, setSkipResearch] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [generatedEmail, setGeneratedEmail] = useState<GeneratedEmail | null>(null);
  const [error, setError] = useState<string | null>(null);


  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  const handleGenerate = async () => {
    // Validate
    if (!prospect.name || !prospect.company) {
      setError('Name and company are required');
      return;
    }

    setGenerating(true);
    setError(null);
    setGeneratedEmail(null);

    try {
      const response = await fetch('/api/outbound/email/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          PLATFORM_ID,
          prospect,
          template,
          tone,
          valueProposition: valueProposition || undefined,
          cta,
          skipResearch,
        }),
      });

      const data = await response.json() as GeneratedEmail;

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to generate email');
      }

      if (data.success) {
        setGeneratedEmail(data);
      } else {
        setError(data.error ?? 'Failed to generate email');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard!');
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        <div>
          {/* Header */}
          <div style={{ marginBottom: '2rem' }}>
            <Link href={`/outbound`} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: primaryColor, fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', marginBottom: '1.5rem' }}>
              ← Back to Outbound
            </Link>
            <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
              AI Email Writer
            </h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Generate personalized cold emails using AI and prospect research
            </p>
          </div>

          {/* Main Content Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Left Column - Input Form */}
            <div>
              {/* Prospect Information */}
              <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '2rem', marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                  Prospect Information
                </h2>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      Full Name *
                    </label>
                    <input
                      type="text"
                      value={prospect.name}
                      onChange={(e) => setProspect({ ...prospect, name: e.target.value })}
                      placeholder="John Smith"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.5rem',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      Company *
                    </label>
                    <input
                      type="text"
                      value={prospect.company}
                      onChange={(e) => setProspect({ ...prospect, company: e.target.value })}
                      placeholder="Acme Corp"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.5rem',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      Title (Optional)
                    </label>
                    <input
                      type="text"
                      value={prospect.title}
                      onChange={(e) => setProspect({ ...prospect, title: e.target.value })}
                      placeholder="VP of Sales"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.5rem',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                      Email (Optional)
                    </label>
                    <input
                      type="email"
                      value={prospect.email}
                      onChange={(e) => setProspect({ ...prospect, email: e.target.value })}
                      placeholder="john@acme.com"
                      style={{
                        width: '100%',
                        padding: '0.75rem',
                        backgroundColor: 'var(--color-bg-main)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.5rem',
                        color: 'var(--color-text-primary)',
                        fontSize: '0.875rem',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Email Configuration */}
              <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '2rem' }}>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
                  Email Configuration
                </h2>

                {/* Template */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
                    Template Framework
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                    {(['AIDA', 'PAS', 'BAB', 'custom'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTemplate(t)}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: template === t ? primaryColor : 'var(--color-bg-main)',
                          border: `1px solid ${template === t ? primaryColor : 'var(--color-border-strong)'}`,
                          borderRadius: '0.5rem',
                          color: 'var(--color-text-primary)',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          transition: 'all 0.2s',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tone */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
                    Tone
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                    {(['professional', 'casual', 'friendly', 'direct'] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setTone(t)}
                        style={{
                          padding: '0.75rem',
                          backgroundColor: tone === t ? primaryColor : 'var(--color-bg-main)',
                          border: `1px solid ${tone === t ? primaryColor : 'var(--color-border-strong)'}`,
                          borderRadius: '0.5rem',
                          color: 'var(--color-text-primary)',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                          fontWeight: '600',
                          textTransform: 'capitalize',
                          transition: 'all 0.2s',
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Value Proposition */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Value Proposition (Optional)
                  </label>
                  <input
                    type="text"
                    value={valueProposition}
                    onChange={(e) => setValueProposition(e.target.value)}
                    placeholder="increase sales by 40%"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: '0.5rem',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                {/* CTA */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    Call to Action
                  </label>
                  <input
                    type="text"
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    placeholder="book a 15-minute call"
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-main)',
                      border: '1px solid var(--color-border-strong)',
                      borderRadius: '0.5rem',
                      color: 'var(--color-text-primary)',
                      fontSize: '0.875rem',
                    }}
                  />
                </div>

                {/* Skip Research */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                  <input
                    type="checkbox"
                    checked={skipResearch}
                    onChange={(e) => setSkipResearch(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  Skip research (faster generation, less personalized)
                </label>

                {/* Generate Button */}
                <button
                  onClick={() => void handleGenerate()}
                  disabled={generating || !prospect.name || !prospect.company}
                  style={{
                    width: '100%',
                    marginTop: '1.5rem',
                    padding: '1rem',
                    backgroundColor: generating || !prospect.name || !prospect.company ? 'var(--color-text-disabled)' : primaryColor,
                    color: 'var(--color-text-primary)',
                    border: 'none',
                    borderRadius: '0.5rem',
                    cursor: generating || !prospect.name || !prospect.company ? 'not-allowed' : 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600',
                    transition: 'all 0.2s',
                  }}
                >
                  {generating ? 'Generating...' : '✨ Generate Email'}
                </button>

                {error && (
                  <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: 'var(--color-error-dark)', border: '1px solid var(--color-error-dark)', borderRadius: '0.5rem', color: 'var(--color-error-light)', fontSize: '0.875rem' }}>
                    {error}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Generated Email */}
            <div>
              {generating && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                  <div style={{ color: 'var(--color-text-primary)', fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>
                    Generating your email...
                  </div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
                    {skipResearch ? 'This should take a few seconds' : 'Researching company and generating personalized content'}
                  </div>
                </div>
              )}

              {generatedEmail && !generating && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '2rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
                      Generated Email
                    </h2>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                      Personalization: {generatedEmail.email?.personalizationScore ?? 0}%
                    </div>
                  </div>

                  {/* Subject Line */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Subject Line</label>
                      <button
                        onClick={() => handleCopy(generatedEmail.email?.subject ?? '')}
                        style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--color-border-strong)', color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        Copy
                      </button>
                    </div>
                    <div style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem' }}>
                      {generatedEmail.email?.subject ?? ''}
                    </div>
                  </div>

                  {/* Email Body */}
                  <div style={{ marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <label style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>Email Body</label>
                      <button
                        onClick={() => handleCopy(generatedEmail.email?.body ?? '')}
                        style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--color-border-strong)', color: 'var(--color-text-primary)', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem' }}
                      >
                        Copy
                      </button>
                    </div>
                    <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', color: 'var(--color-text-primary)', fontSize: '0.875rem', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                      {generatedEmail.email?.body ?? ''}
                    </div>
                  </div>

                  {/* Subject Variants */}
                  {generatedEmail.email?.subjectVariants && generatedEmail.email.subjectVariants.length > 0 && (
                    <div style={{ marginBottom: '1.5rem' }}>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
                        Subject Line Variants (for A/B testing)
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {generatedEmail.email.subjectVariants.map((variant: string, index: number) => (
                          <div key={index} style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', color: 'var(--color-text-primary)', fontSize: '0.75rem' }}>
                            {variant}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Research Insights */}
                  {generatedEmail.research && generatedEmail.research.insights.length > 0 && (
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '0.75rem' }}>
                        Research Insights Used
                      </label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {generatedEmail.research.insights.map((insight: string, index: number) => (
                          <div key={index} style={{ padding: '0.5rem', backgroundColor: 'var(--color-bg-main)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', color: 'var(--color-text-secondary)', fontSize: '0.75rem' }}>
                            • {insight}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!generatedEmail && !generating && (
                <div style={{ backgroundColor: 'var(--color-bg-paper)', border: '1px solid var(--color-border-strong)', borderRadius: '1rem', padding: '3rem', textAlign: 'center' }}>
                  <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✉️</div>
                  <div style={{ color: 'var(--color-text-secondary)', fontSize: '1rem' }}>
                    Fill in prospect information and click &quot;Generate Email&quot; to create a personalized cold email
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}






















