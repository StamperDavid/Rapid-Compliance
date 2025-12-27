'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { EmailTemplate, EmailBlock } from '@/lib/email/email-builder';

export default function EmailBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  
  const [template, setTemplate] = useState<Partial<EmailTemplate>>({
    name: 'Untitled Email',
    subject: '',
    preheader: '',
    blocks: [],
    variables: [],
    styling: {
      backgroundColor: '#f4f4f4',
      primaryColor: '#0066cc',
      fontFamily: 'Arial, sans-serif',
    },
  });

  const [selectedBlock, setSelectedBlock] = useState<EmailBlock | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  const addBlock = (type: EmailBlock['type']) => {
    const newBlock: EmailBlock = {
      id: `block-${Date.now()}`,
      type,
      content: getDefaultContent(type),
      order: (template.blocks?.length || 0) + 1,
      styling: {},
    };

    setTemplate({
      ...template,
      blocks: [...(template.blocks || []), newBlock],
    });
  };

  const getDefaultContent = (type: EmailBlock['type']): string => {
    const defaults: Record<EmailBlock['type'], string> = {
      header: 'Welcome to Our Newsletter',
      text: 'Add your content here...',
      image: 'https://via.placeholder.com/600x300',
      button: 'Click Here',
      divider: '',
      social: '',
      footer: 'Unsubscribe | View in browser',
    };
    return defaults[type];
  };

  const updateBlock = (blockId: string, updates: Partial<EmailBlock>) => {
    setTemplate({
      ...template,
      blocks: template.blocks?.map(b => 
        b.id === blockId ? { ...b, ...updates } : b
      ),
    });
  };

  const deleteBlock = (blockId: string) => {
    setTemplate({
      ...template,
      blocks: template.blocks?.filter(b => b.id !== blockId),
    });
    setSelectedBlock(null);
  };

  const moveBlock = (blockId: string, direction: 'up' | 'down') => {
    const blocks = [...(template.blocks || [])];
    const index = blocks.findIndex(b => b.id === blockId);
    if (index === -1) return;

    if (direction === 'up' && index > 0) {
      [blocks[index], blocks[index - 1]] = [blocks[index - 1], blocks[index]];
    } else if (direction === 'down' && index < blocks.length - 1) {
      [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
    }

    // Update order
    blocks.forEach((b, i) => b.order = i + 1);
    setTemplate({ ...template, blocks });
  };

  const saveTemplate = async () => {
    try {
      const response = await fetch('/api/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      if (response.ok) {
        alert('Template saved!');
        router.push(`/workspace/${orgId}/marketing/templates`);
      }
    } catch (error) {
      alert('Failed to save template');
    }
  };

  const renderPreview = () => {
    const { buildEmailHTML } = require('@/lib/email/email-builder');
    return buildEmailHTML(template as EmailTemplate, {
      first_name: 'John',
      company_name: 'Acme Corp',
    });
  };

  return (
    <div className="h-screen flex flex-col bg-gray-950">
      {/* Top Bar */}
      <div className="bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-gray-400 hover:text-white">
            ← Back
          </button>
          <input
            type="text"
            value={template.name}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-1 text-lg font-medium"
            placeholder="Template Name"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="px-4 py-2 bg-gray-800 rounded hover:bg-gray-700"
          >
            {previewMode ? '✏️ Edit' : '👁️ Preview'}
          </button>
          <button
            onClick={saveTemplate}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Save Template
          </button>
        </div>
      </div>

      {!previewMode ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Block Library */}
          <div className="w-64 bg-gray-900 border-r border-gray-800 p-4 overflow-y-auto">
            <h3 className="font-bold mb-4">Add Blocks</h3>
            <div className="space-y-2">
              {(['header', 'text', 'image', 'button', 'divider', 'footer'] as EmailBlock['type'][]).map(type => (
                <button
                  key={type}
                  onClick={() => addBlock(type)}
                  className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded text-left capitalize"
                >
                  {type === 'header' && '📰'} 
                  {type === 'text' && '📝'} 
                  {type === 'image' && '🖼️'} 
                  {type === 'button' && '🔘'} 
                  {type === 'divider' && '➖'} 
                  {type === 'footer' && '📄'} 
                  {' '}{type.replace('_', ' ')}
                </button>
              ))}
            </div>

            <div className="mt-6">
              <h3 className="font-bold mb-4">Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-400">Subject Line</label>
                  <input
                    type="text"
                    value={template.subject}
                    onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                    placeholder="Email subject..."
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-400">Primary Color</label>
                  <input
                    type="color"
                    value={template.styling?.primaryColor}
                    onChange={(e) => setTemplate({
                      ...template,
                      styling: { ...template.styling, primaryColor: e.target.value },
                    })}
                    className="w-full mt-1 h-10 rounded"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Center - Canvas */}
          <div className="flex-1 bg-gray-950 p-8 overflow-y-auto">
            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-2xl">
              <div className="p-8">
                {template.blocks && template.blocks.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">
                    <p className="text-lg mb-2">Your email is empty</p>
                    <p className="text-sm">Add blocks from the left sidebar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {template.blocks?.map((block, index) => (
                      <div
                        key={block.id}
                        onClick={() => setSelectedBlock(block)}
                        className={`relative group cursor-pointer border-2 rounded p-4 ${
                          selectedBlock?.id === block.id ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
                        }`}
                      >
                        {/* Block Content */}
                        {block.type === 'header' && (
                          <h1 className="text-2xl font-bold" style={{ color: block.styling?.textColor || template.styling?.primaryColor }}>
                            {block.content}
                          </h1>
                        )}
                        {block.type === 'text' && (
                          <div className="text-gray-700" style={{ fontSize: block.styling?.fontSize }}>
                            {block.content}
                          </div>
                        )}
                        {block.type === 'image' && (
                          <img src={block.content} alt="Email" className="w-full rounded" />
                        )}
                        {block.type === 'button' && (
                          <div style={{ textAlign: block.styling?.alignment || 'center' }}>
                            <button
                              className="px-6 py-3 rounded font-medium"
                              style={{
                                backgroundColor: block.styling?.buttonColor || template.styling?.primaryColor,
                                color: block.styling?.buttonTextColor || '#ffffff',
                              }}
                            >
                              {block.content}
                            </button>
                          </div>
                        )}
                        {block.type === 'divider' && (
                          <hr className="border-gray-300" />
                        )}
                        {block.type === 'footer' && (
                          <div className="text-center text-xs text-gray-500">{block.content}</div>
                        )}

                        {/* Block Controls */}
                        {selectedBlock?.id === block.id && (
                          <div className="absolute -top-3 right-2 flex gap-1 bg-gray-900 rounded shadow-lg p-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'up'); }}
                              disabled={index === 0}
                              className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'down'); }}
                              disabled={index === (template.blocks?.length || 0) - 1}
                              className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded disabled:opacity-30"
                            >
                              ↓
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                              className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Block Editor */}
          {selectedBlock && (
            <div className="w-80 bg-gray-900 border-l border-gray-800 p-4 overflow-y-auto">
              <h3 className="font-bold mb-4">Edit {selectedBlock.type}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-400">Content</label>
                  {selectedBlock.type === 'text' || selectedBlock.type === 'header' ? (
                    <textarea
                      value={selectedBlock.content}
                      onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm h-32"
                    />
                  ) : selectedBlock.type === 'button' ? (
                    <>
                      <input
                        type="text"
                        value={selectedBlock.content}
                        onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                        placeholder="Button text"
                      />
                      <input
                        type="text"
                        value={selectedBlock.styling?.buttonUrl || ''}
                        onChange={(e) => updateBlock(selectedBlock.id, { 
                          styling: { ...selectedBlock.styling, buttonUrl: e.target.value }
                        })}
                        className="w-full mt-2 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                        placeholder="Button URL"
                      />
                    </>
                  ) : selectedBlock.type === 'image' ? (
                    <input
                      type="text"
                      value={selectedBlock.content}
                      onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                      placeholder="Image URL"
                    />
                  ) : (
                    <input
                      type="text"
                      value={selectedBlock.content}
                      onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="text-sm text-gray-400">Alignment</label>
                  <select
                    value={selectedBlock.styling?.alignment || 'left'}
                    onChange={(e) => updateBlock(selectedBlock.id, {
                      styling: { ...selectedBlock.styling, alignment: e.target.value as any }
                    })}
                    className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>

                {selectedBlock.type === 'button' && (
                  <>
                    <div>
                      <label className="text-sm text-gray-400">Button Color</label>
                      <input
                        type="color"
                        value={selectedBlock.styling?.buttonColor || template.styling?.primaryColor}
                        onChange={(e) => updateBlock(selectedBlock.id, {
                          styling: { ...selectedBlock.styling, buttonColor: e.target.value }
                        })}
                        className="w-full mt-1 h-10 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400">Text Color</label>
                      <input
                        type="color"
                        value={selectedBlock.styling?.buttonTextColor || '#ffffff'}
                        onChange={(e) => updateBlock(selectedBlock.id, {
                          styling: { ...selectedBlock.styling, buttonTextColor: e.target.value }
                        })}
                        className="w-full mt-1 h-10 rounded"
                      />
                    </div>
                  </>
                )}

                {(selectedBlock.type === 'text' || selectedBlock.type === 'header') && (
                  <div>
                    <label className="text-sm text-gray-400">Text Color</label>
                    <input
                      type="color"
                      value={selectedBlock.styling?.textColor || '#333333'}
                      onChange={(e) => updateBlock(selectedBlock.id, {
                        styling: { ...selectedBlock.styling, textColor: e.target.value }
                      })}
                      className="w-full mt-1 h-10 rounded"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-8 bg-gray-900">
          <div className="max-w-4xl mx-auto">
            <div 
              className="bg-white rounded shadow-lg"
              dangerouslySetInnerHTML={{ __html: renderPreview() }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

