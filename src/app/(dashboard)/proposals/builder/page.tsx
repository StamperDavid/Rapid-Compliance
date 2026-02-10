'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProposalTemplate, ProposalSection } from '@/lib/documents/proposal-generator';
import { useToast } from '@/hooks/useToast';
import SafeHtml from '@/components/SafeHtml';

type TemplateType = 'proposal' | 'quote' | 'contract' | 'invoice';

export default function ProposalBuilderPage() {
  const router = useRouter();
  const toast = useToast();

  const [template, setTemplate] = useState<Partial<ProposalTemplate>>({
    name: 'Untitled Proposal',
    type: 'proposal',
    sections: [],
    variables: [],
    styling: {
      primaryColor: 'var(--color-info)',
      fontFamily: 'Arial, sans-serif',
    },
  });

  const [selectedSection, setSelectedSection] = useState<ProposalSection | null>(null);

  const addSection = (type: ProposalSection['type']) => {
    const newSection: ProposalSection = {
      id: `section-${Date.now()}`,
      type,
      content: getDefaultContent(type),
      order: (template.sections?.length ?? 0) + 1,
      editable: true,
    };

    setTemplate({
      ...template,
      sections: [...(template.sections ?? []), newSection],
    });
  };

  const getDefaultContent = (type: ProposalSection['type']): string => {
    const defaults: Record<ProposalSection['type'], string> = {
      header: '<h1>{{company_name}} Proposal</h1><p>Prepared for: {{customer_name}}</p>',
      text: '<p>Add your content here...</p>',
      pricing_table: 'PRICING_TABLE',
      terms: '<h3>Terms & Conditions</h3><p>Payment terms, cancellation policy, etc.</p>',
      signature: 'SIGNATURE_BLOCK',
      image: 'https://via.placeholder.com/600x200',
    };
    return defaults[type];
  };

  const updateSection = (sectionId: string, content: string) => {
    setTemplate({
      ...template,
      sections: template.sections?.map(s =>
        s.id === sectionId ? { ...s, content } : s
      ),
    });
  };

  const deleteSection = (sectionId: string) => {
    setTemplate({
      ...template,
      sections: template.sections?.filter(s => s.id !== sectionId),
    });
    setSelectedSection(null);
  };

  const saveTemplate = () => {
    try {
      toast.info('Proposal template would be saved to database');
      router.push(`/proposals`);
    } catch (_error) {
      toast.error('Failed to save template');
    }
  };

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-main)' }}>
      <div style={{
        backgroundColor: 'var(--color-bg-paper)',
        borderBottom: '1px solid var(--color-border-main)',
        padding: '1rem 1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => router.back()}
            style={{
              color: 'var(--color-text-secondary)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            ← Back
          </button>
          <input
            type="text"
            value={template.name}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            placeholder="Template Name"
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '0.375rem',
              padding: '0.375rem 0.75rem',
              color: 'var(--color-text-primary)',
              fontSize: '1.125rem',
              fontWeight: '500',
            }}
          />
          <select
            value={template.type}
            onChange={(e) => setTemplate({ ...template, type: e.target.value as TemplateType })}
            style={{
              backgroundColor: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border-light)',
              borderRadius: '0.375rem',
              padding: '0.375rem 0.75rem',
              color: 'var(--color-text-primary)',
              fontSize: '0.875rem',
            }}
          >
            <option value="proposal">Proposal</option>
            <option value="quote">Quote</option>
            <option value="contract">Contract</option>
            <option value="invoice">Invoice</option>
          </select>
        </div>
        <button
          onClick={saveTemplate}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: 'var(--color-primary)',
            color: 'var(--color-primary-contrast)',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '0.875rem',
          }}
        >
          Save Template
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div style={{
          width: '16rem',
          backgroundColor: 'var(--color-bg-paper)',
          borderRight: '1px solid var(--color-border-main)',
          padding: '1rem',
          overflowY: 'auto',
        }}>
          <h3 style={{
            color: 'var(--color-text-primary)',
            fontWeight: '700',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}>
            Add Sections
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {(['header', 'text', 'pricing_table', 'terms', 'signature', 'image'] as ProposalSection['type'][]).map(type => (
              <button
                key={type}
                onClick={() => addSection(type)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid transparent',
                  borderRadius: '0.375rem',
                  color: 'var(--color-text-primary)',
                  textAlign: 'left',
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  transition: 'background-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-border-light)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
                }}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div style={{
          flex: 1,
          backgroundColor: 'var(--color-bg-main)',
          padding: '2rem',
          overflowY: 'auto',
        }}>
          <div style={{
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '0.5rem',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            padding: '3rem',
            color: '#1a1a1a',
          }}>
            {template.sections?.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '5rem 0',
                color: 'var(--color-text-disabled)',
              }}>
                <p style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>Your proposal is empty</p>
                <p style={{ fontSize: '0.875rem' }}>Add sections from the left sidebar</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {template.sections?.map((section) => (
                  <div
                    key={section.id}
                    onClick={() => setSelectedSection(section)}
                    style={{
                      position: 'relative',
                      cursor: 'pointer',
                      border: `2px solid ${selectedSection?.id === section.id ? 'var(--color-primary)' : 'transparent'}`,
                      borderRadius: '0.25rem',
                      padding: '1rem',
                      transition: 'border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedSection?.id !== section.id) {
                        e.currentTarget.style.borderColor = '#d1d5db';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedSection?.id !== section.id) {
                        e.currentTarget.style.borderColor = 'transparent';
                      }
                    }}
                  >
                    <SafeHtml html={section.content} preset="rich-text" />

                    {selectedSection?.id === section.id && (
                      <button
                        onClick={() => deleteSection(section.id)}
                        style={{
                          position: 'absolute',
                          top: '0.5rem',
                          right: '0.5rem',
                          padding: '0.25rem 0.5rem',
                          backgroundColor: 'var(--color-error)',
                          color: 'var(--color-text-primary)',
                          fontSize: '0.75rem',
                          border: 'none',
                          borderRadius: '0.25rem',
                          cursor: 'pointer',
                        }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedSection && (
          <div style={{
            width: '24rem',
            backgroundColor: 'var(--color-bg-paper)',
            borderLeft: '1px solid var(--color-border-main)',
            padding: '1rem',
            overflowY: 'auto',
          }}>
            <h3 style={{
              color: 'var(--color-text-primary)',
              fontWeight: '700',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}>
              Edit Section
            </h3>
            <textarea
              value={selectedSection.content}
              onChange={(e) => updateSection(selectedSection.id, e.target.value)}
              style={{
                width: '100%',
                height: '16rem',
                padding: '0.75rem',
                backgroundColor: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-light)',
                borderRadius: '0.375rem',
                color: 'var(--color-text-primary)',
                fontSize: '0.875rem',
                fontFamily: 'monospace',
                resize: 'vertical',
              }}
            />
            <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: 'var(--color-text-disabled)' }}>
              <div style={{ fontWeight: '500', marginBottom: '0.5rem' }}>Available Variables:</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div>{'{{customer_name}}'}</div>
                <div>{'{{company_name}}'}</div>
                <div>{'{{date}}'}</div>
                <div>{'{{proposal_number}}'}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
