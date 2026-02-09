'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ProposalTemplate, ProposalSection } from '@/lib/documents/proposal-generator';
import { useToast } from '@/hooks/useToast';

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
    <div className="h-screen flex flex-col bg-gray-950">
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white">← Back</button>
          <input
            type="text"
            value={template.name}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-lg font-medium"
            placeholder="Template Name"
          />
          <select
            value={template.type}
            onChange={(e) => setTemplate({ ...template, type: e.target.value as TemplateType })}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1"
          >
            <option value="proposal">Proposal</option>
            <option value="quote">Quote</option>
            <option value="contract">Contract</option>
            <option value="invoice">Invoice</option>
          </select>
        </div>
        <button onClick={saveTemplate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          Save Template
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-64 bg-gray-900 border-r border-gray-800 p-4 overflow-y-auto">
          <h3 className="font-bold mb-4">Add Sections</h3>
          <div className="space-y-2">
            {(['header', 'text', 'pricing_table', 'terms', 'signature', 'image'] as ProposalSection['type'][]).map(type => (
              <button
                key={type}
                onClick={() => addSection(type)}
                className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded text-left capitalize"
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 bg-gray-950 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-2xl p-12">
            {template.sections?.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <p className="text-lg mb-2">Your proposal is empty</p>
                <p className="text-sm">Add sections from the left sidebar</p>
              </div>
            ) : (
              <div className="space-y-6">
                {template.sections?.map((section) => (
                  <div
                    key={section.id}
                    onClick={() => setSelectedSection(section)}
                    className={`relative cursor-pointer border-2 rounded p-4 ${
                      selectedSection?.id === section.id ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                    }`}
                  >
                    <div dangerouslySetInnerHTML={{ __html: section.content }} />
                    
                    {selectedSection?.id === section.id && (
                      <button
                        onClick={() => deleteSection(section.id)}
                        className="absolute top-2 right-2 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700"
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
          <div className="w-96 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto">
            <h3 className="font-bold mb-4">Edit Section</h3>
            <textarea
              value={selectedSection.content}
              onChange={(e) => updateSection(selectedSection.id, e.target.value)}
              className="w-full h-64 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm font-mono"
            />
            <div className="mt-4 text-xs text-gray-400">
              <div className="font-medium mb-2">Available Variables:</div>
              <div className="space-y-1">
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

