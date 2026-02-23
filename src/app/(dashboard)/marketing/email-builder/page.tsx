'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { buildEmailHTML, type EmailTemplate, type EmailBlock } from '@/lib/email/email-builder';
import { useToast } from '@/hooks/useToast';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SafeHtml from '@/components/SafeHtml';

export default function EmailBuilderPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const toast = useToast();
  const [template, setTemplate] = useState<Partial<EmailTemplate>>({
    name: 'Untitled Email',
    subject: '',
    preheader: '',
    blocks: [],
    variables: [],
    styling: {
      backgroundColor: 'var(--color-bg-paper)',
      primaryColor: 'var(--color-primary)',
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
      order: (template.blocks?.length ?? 0) + 1,
      styling: {},
    };

    setTemplate({
      ...template,
      blocks: [...(template.blocks ?? []), newBlock],
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
    const blocks = [...(template.blocks ?? [])];
    const index = blocks.findIndex(b => b.id === blockId);
    if (index === -1) {return;}

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
      const response = await authFetch('/api/email/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(template),
      });

      if (response.ok) {
        toast.success('Template saved!');
        router.push(`/marketing/templates`);
      }
    } catch (_error) {
      toast.error('Failed to save template');
    }
  };

  const renderPreview = () => {
    return buildEmailHTML(template as EmailTemplate, {
      first_name: 'John',
      company_name: 'Acme Corp',
    });
  };

  return (
    <div className="h-screen flex flex-col bg-surface-main">
      {/* Top Bar */}
      <div className="bg-surface-paper border-b border-border-light px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            ← Back
          </button>
          <input
            type="text"
            value={template.name}
            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
            className="bg-surface-elevated border border-border-light rounded px-3 py-1 text-lg font-medium"
            placeholder="Template Name"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className="px-4 py-2 bg-surface-elevated rounded hover:bg-surface-paper"
          >
            {previewMode ? '✏️ Edit' : '👁️ Preview'}
          </button>
          <button
            onClick={() => void saveTemplate()}
            className="px-4 py-2 bg-primary text-white rounded hover:bg-primary-light"
          >
            Save Template
          </button>
        </div>
      </div>

      {!previewMode ? (
        <div className="flex-1 flex overflow-hidden">
          {/* Left Sidebar - Block Library */}
          <div className="w-64 bg-surface-paper border-r border-border-light p-4 overflow-y-auto">
            <h3 className="font-bold mb-4">Add Blocks</h3>
            <div className="space-y-2">
              {(['header', 'text', 'image', 'button', 'divider', 'footer'] as EmailBlock['type'][]).map(type => (
                <button
                  key={type}
                  onClick={() => addBlock(type)}
                  className="w-full px-4 py-3 bg-surface-elevated hover:bg-surface-paper rounded text-left capitalize"
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
                  <label className="text-sm text-[var(--color-text-secondary)]">Subject Line</label>
                  <input
                    type="text"
                    value={template.subject}
                    onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                    className="w-full mt-1 px-3 py-2 bg-surface-elevated border border-border-light rounded text-sm"
                    placeholder="Email subject..."
                  />
                </div>
                <div>
                  <label className="text-sm text-[var(--color-text-secondary)]">Primary Color</label>
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
          <div className="flex-1 bg-surface-main p-8 overflow-y-auto">
            <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-2xl">
              <div className="p-8">
                {template.blocks?.length === 0 ? (
                  <div className="text-center py-20 text-[var(--color-text-secondary)]">
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
                          selectedBlock?.id === block.id ? 'border-[var(--color-primary)]' : 'border-transparent hover:border-[var(--color-border-light)]'
                        }`}
                      >
                        {/* Block Content */}
                        {block.type === 'header' && (
                          <h1 className="text-2xl font-bold" style={{ color: block.styling?.textColor ?? template.styling?.primaryColor}}>
                            {block.content}
                          </h1>
                        )}
                        {block.type === 'text' && (
                          <div style={{ fontSize: block.styling?.fontSize, color: 'var(--color-text-primary)' }}>
                            {block.content}
                          </div>
                        )}
                        {block.type === 'image' && (
                          <Image src={block.content} alt="Email" width={600} height={300} className="w-full rounded" />
                        )}
                        {block.type === 'button' && (
                          <div style={{ textAlign: block.styling?.alignment ?? 'center' }}>
                            <button
                              className="px-6 py-3 rounded font-medium"
                              style={{
                                backgroundColor: block.styling?.buttonColor ?? template.styling?.primaryColor,
                                color: block.styling?.buttonTextColor ?? 'var(--color-text-primary)',
                              }}
                            >
                              {block.content}
                            </button>
                          </div>
                        )}
                        {block.type === 'divider' && (
                          <hr className="border-[var(--color-border-light)]" />
                        )}
                        {block.type === 'footer' && (
                          <div className="text-center text-xs text-[var(--color-text-disabled)]">{block.content}</div>
                        )}

                        {/* Block Controls */}
                        {selectedBlock?.id === block.id && (
                          <div className="absolute -top-3 right-2 flex gap-1 bg-surface-paper rounded shadow-lg p-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'up'); }}
                              disabled={index === 0}
                              className="px-2 py-1 text-xs bg-surface-elevated hover:bg-surface-paper rounded disabled:opacity-30"
                            >
                              ↑
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 'down'); }}
                              disabled={index === (template.blocks?.length ?? 0) - 1}
                              className="px-2 py-1 text-xs bg-surface-elevated hover:bg-surface-paper rounded disabled:opacity-30"
                            >
                              ↓
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
                              className="px-2 py-1 text-xs bg-error hover:opacity-80 rounded"
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
            <div className="w-80 bg-surface-paper border-l border-border-light p-4 overflow-y-auto">
              <h3 className="font-bold mb-4">Edit {selectedBlock.type}</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-[var(--color-text-secondary)]">Content</label>
                  {selectedBlock.type === 'text' || selectedBlock.type === 'header' ? (
                    <textarea
                      value={selectedBlock.content}
                      onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-surface-elevated border border-border-light rounded text-sm h-32"
                    />
                  ) : selectedBlock.type === 'button' ? (
                    <>
                      <input
                        type="text"
                        value={selectedBlock.content}
                        onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-surface-elevated border border-border-light rounded text-sm"
                        placeholder="Button text"
                      />
                      <input
                        type="text"
                        value={selectedBlock.styling?.buttonUrl ?? ''}
                        onChange={(e) => updateBlock(selectedBlock.id, {
                          styling: { ...selectedBlock.styling, buttonUrl: e.target.value }
                        })}
                        className="w-full mt-2 px-3 py-2 bg-surface-elevated border border-border-light rounded text-sm"
                        placeholder="Button URL"
                      />
                    </>
                  ) : selectedBlock.type === 'image' ? (
                    <input
                      type="text"
                      value={selectedBlock.content}
                      onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-surface-elevated border border-border-light rounded text-sm"
                      placeholder="Image URL"
                    />
                  ) : (
                    <input
                      type="text"
                      value={selectedBlock.content}
                      onChange={(e) => updateBlock(selectedBlock.id, { content: e.target.value })}
                      className="w-full mt-1 px-3 py-2 bg-surface-elevated border border-border-light rounded text-sm"
                    />
                  )}
                </div>

                <div>
                  <label className="text-sm text-[var(--color-text-secondary)]">Alignment</label>
                  <select
                    value={selectedBlock.styling?.alignment ?? 'left'}
                    onChange={(e) => updateBlock(selectedBlock.id, {
                      styling: { ...selectedBlock.styling, alignment: e.target.value as 'left' | 'center' | 'right' }
                    })}
                    className="w-full mt-1 px-3 py-2 bg-surface-elevated border border-border-light rounded text-sm"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </div>

                {selectedBlock.type === 'button' && (
                  <>
                    <div>
                      <label className="text-sm text-[var(--color-text-secondary)]">Button Color</label>
                      <input
                        type="color"
                        value={selectedBlock.styling?.buttonColor ?? template.styling?.primaryColor}
                        onChange={(e) => updateBlock(selectedBlock.id, {
                          styling: { ...selectedBlock.styling, buttonColor: e.target.value }
                        })}
                        className="w-full mt-1 h-10 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-[var(--color-text-secondary)]">Text Color</label>
                      <input
                        type="color"
                        value={selectedBlock.styling?.buttonTextColor ?? 'var(--color-text-primary)'}
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
                    <label className="text-sm text-[var(--color-text-secondary)]">Text Color</label>
                    <input
                      type="color"
                      value={selectedBlock.styling?.textColor ?? 'var(--color-border-light)'}
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
        <div className="flex-1 overflow-auto p-8 bg-surface-paper">
          <div className="max-w-4xl mx-auto">
            <SafeHtml
              className="bg-white rounded shadow-lg"
              html={renderPreview()}
              preset="email"
            />
          </div>
        </div>
      )}
    </div>
  );
}

