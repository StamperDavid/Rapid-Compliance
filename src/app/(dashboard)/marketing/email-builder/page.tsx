'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { buildEmailHTML, type EmailTemplate, type EmailBlock } from '@/lib/email/email-builder';
import { useToast } from '@/hooks/useToast';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SafeHtml from '@/components/SafeHtml';
import SubpageNav from '@/components/ui/SubpageNav';
import { EMAIL_STUDIO_TABS } from '@/lib/constants/subpage-nav';
import {
  SEEDED_EMAIL_TEMPLATES,
  TEMPLATE_CATEGORIES,
  type SeededEmailTemplate,
  type TemplateCategory,
  type TemplateCategoryMeta,
} from '@/lib/email/seeded-templates';

// ─── Template Gallery ────────────────────────────────────────────────────────

interface TemplateGalleryProps {
  onSelectTemplate: (seeded: SeededEmailTemplate) => void;
  onStartFromScratch: () => void;
}

function TemplateGallery({ onSelectTemplate, onStartFromScratch }: TemplateGalleryProps) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory | 'all'>('all');

  const filtered = SEEDED_EMAIL_TEMPLATES.filter((t: SeededEmailTemplate) => {
    const categoryMatch = selectedCategory === 'all' || t.category === selectedCategory;
    const q = query.trim().toLowerCase();
    const textMatch =
      q.length === 0 ||
      t.name.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q);
    return categoryMatch && textMatch;
  });

  const clearFilters = () => {
    setQuery('');
    setSelectedCategory('all');
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-background">
      {/* ── Sticky header + filter strip ─────────────────────────────────── */}
      <div className="shrink-0 px-8 pt-8 pb-4 border-b border-border-strong bg-background">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Start from a template</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {SEEDED_EMAIL_TEMPLATES.length} templates across {TEMPLATE_CATEGORIES.length} categories
            </p>
          </div>
          <button
            onClick={onStartFromScratch}
            className="shrink-0 px-4 py-2 bg-card border border-border-strong text-foreground rounded-lg font-medium text-sm hover:bg-surface-elevated transition-colors"
          >
            Start from scratch
          </button>
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-full max-w-[360px]">
            <label htmlFor="template-search" className="sr-only">
              Search templates
            </label>
            <input
              id="template-search"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value.toLowerCase())}
              placeholder="Search templates..."
              className="w-full pl-9 pr-3 py-2 bg-card border border-border-strong rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden="true"
            >
              <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>

          {/* Category chips */}
          <div className="flex flex-wrap gap-2">
            <button
              aria-pressed={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card border border-border-strong text-foreground hover:border-primary'
              }`}
            >
              All
            </button>
            {TEMPLATE_CATEGORIES.map((cat: TemplateCategoryMeta) => (
              <button
                key={cat.id}
                aria-pressed={selectedCategory === cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-card border border-border-strong text-foreground hover:border-primary'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Scrollable grid ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <p className="text-muted-foreground text-sm">No templates match those filters.</p>
            <button
              onClick={clearFilters}
              className="px-4 py-2 bg-card border border-border-strong text-foreground rounded-lg text-sm font-medium hover:bg-surface-elevated transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((seeded: SeededEmailTemplate) => {
              const categoryLabel =
                TEMPLATE_CATEGORIES.find((c: TemplateCategoryMeta) => c.id === seeded.category)?.label ??
                seeded.category;
              return (
                <div
                  key={seeded.id}
                  className="h-full bg-card border border-border-strong rounded-2xl p-6 flex flex-col gap-3 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-4xl" aria-hidden="true">{seeded.iconEmoji}</div>
                    <span className="text-xs uppercase tracking-wide px-2 py-0.5 rounded bg-surface-elevated text-muted-foreground">
                      {categoryLabel}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{seeded.name}</p>
                    <p className="text-sm text-muted-foreground mt-1">{seeded.description}</p>
                  </div>
                  <div className="pt-2">
                    <button
                      onClick={() => onSelectTemplate(seeded)}
                      className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium text-sm hover:bg-primary/90 transition-colors"
                    >
                      Use this template
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function EmailBuilderPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const toast = useToast();

  const [hasChosenStartingPoint, setHasChosenStartingPoint] = useState(false);

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

  // ── Gallery handlers ────────────────────────────────────────────────────────

  const handleSelectTemplate = (seeded: SeededEmailTemplate) => {
    const reIdedBlocks: EmailBlock[] = seeded.template.blocks.map((block: EmailBlock, index: number) => ({
      ...block,
      id: `${Date.now()}-${index}`,
    }));

    setTemplate({
      ...seeded.template,
      blocks: reIdedBlocks,
    });
    setSelectedBlock(null);
    setHasChosenStartingPoint(true);
  };

  const handleStartFromScratch = () => {
    setHasChosenStartingPoint(true);
  };

  const handleChooseDifferentTemplate = () => {
    setTemplate((prev) => ({ ...prev, blocks: [] }));
    setSelectedBlock(null);
    setHasChosenStartingPoint(false);
  };

  // ── Block operations ────────────────────────────────────────────────────────

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
    blocks.forEach((b, i) => { b.order = i + 1; });
    setTemplate({ ...template, blocks });
  };

  // ── Save ────────────────────────────────────────────────────────────────────

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

  // ── Show gallery when no starting point has been chosen and canvas is empty ─

  const showGallery = !hasChosenStartingPoint && (template.blocks?.length ?? 0) === 0;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen flex flex-col bg-surface-main">
      <SubpageNav items={EMAIL_STUDIO_TABS} />

      {showGallery ? (
        <TemplateGallery
          onSelectTemplate={handleSelectTemplate}
          onStartFromScratch={handleStartFromScratch}
        />
      ) : (
        <>
          {/* Top Bar */}
          <div className="bg-surface-paper border-b border-border-light px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={handleChooseDifferentTemplate}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ← Choose a different template
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
                {previewMode ? 'Edit' : 'Preview'}
              </button>
              <button
                onClick={() => void saveTemplate()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
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
                      <label className="text-sm text-muted-foreground">Subject Line</label>
                      <input
                        type="text"
                        value={template.subject}
                        onChange={(e) => setTemplate({ ...template, subject: e.target.value })}
                        className="w-full mt-1 px-3 py-2 bg-surface-elevated border border-border-light rounded text-sm"
                        placeholder="Email subject..."
                      />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Primary Color</label>
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
                <div
                  className="max-w-2xl mx-auto rounded-lg shadow-2xl"
                  style={{
                    backgroundColor: template.styling?.backgroundColor ?? '#FFFFFF',
                    fontFamily: template.styling?.fontFamily ?? 'Helvetica, Arial, sans-serif',
                  }}
                >
                  <div className="p-2">
                    {template.blocks?.length === 0 ? (
                      <div className="text-center py-20 text-muted-foreground">
                        <p className="text-lg mb-2">Your email is empty</p>
                        <p className="text-sm">Add blocks from the left sidebar</p>
                      </div>
                    ) : (
                      <div>
                        {template.blocks?.map((block, index) => (
                          <div
                            key={block.id}
                            onClick={() => setSelectedBlock(block)}
                            className={`relative group cursor-pointer border-2 rounded ${
                              selectedBlock?.id === block.id
                                ? 'border-primary'
                                : 'border-transparent hover:border-border-light'
                            }`}
                            style={{
                              padding: block.styling?.padding ?? '12px 16px',
                              textAlign: block.styling?.alignment ?? 'left',
                            }}
                          >
                            {/* Block Content */}
                            {block.type === 'header' && (
                              <h1
                                className="font-bold m-0"
                                style={{
                                  color: block.styling?.textColor ?? template.styling?.primaryColor ?? '#111827',
                                  fontSize: block.styling?.fontSize ?? '28px',
                                  lineHeight: 1.2,
                                  whiteSpace: 'pre-line',
                                }}
                              >
                                {block.content}
                              </h1>
                            )}
                            {block.type === 'text' && (
                              <div
                                style={{
                                  fontSize: block.styling?.fontSize ?? '16px',
                                  color: block.styling?.textColor ?? '#374151',
                                  lineHeight: 1.55,
                                  whiteSpace: 'pre-line',
                                }}
                              >
                                {block.content}
                              </div>
                            )}
                            {block.type === 'image' && (
                              <Image
                                src={block.content}
                                alt="Email"
                                width={600}
                                height={300}
                                className="rounded"
                                style={{ display: 'inline-block', width: '100%', height: 'auto', maxWidth: '600px' }}
                              />
                            )}
                            {block.type === 'button' && (
                              <button
                                className="px-6 py-3 rounded-md font-semibold"
                                style={{
                                  backgroundColor: block.styling?.buttonColor ?? template.styling?.primaryColor ?? '#4F46E5',
                                  color: block.styling?.buttonTextColor ?? '#FFFFFF',
                                  border: 'none',
                                  cursor: 'pointer',
                                }}
                              >
                                {block.content}
                              </button>
                            )}
                            {block.type === 'divider' && (
                              <hr style={{ border: 0, borderTop: '1px solid #E5E7EB', margin: '4px 0' }} />
                            )}
                            {block.type === 'footer' && (
                              <div
                                style={{
                                  fontSize: '12px',
                                  color: '#6B7280',
                                  lineHeight: 1.5,
                                  whiteSpace: 'pre-line',
                                }}
                              >
                                {block.content}
                              </div>
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
                                  className="px-2 py-1 text-xs bg-destructive text-destructive-foreground hover:opacity-80 rounded"
                                >
                                  Delete
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
                      <label className="text-sm text-muted-foreground">Content</label>
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
                      <label className="text-sm text-muted-foreground">Alignment</label>
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
                          <label className="text-sm text-muted-foreground">Button Color</label>
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
                          <label className="text-sm text-muted-foreground">Text Color</label>
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
                        <label className="text-sm text-muted-foreground">Text Color</label>
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
        </>
      )}
    </div>
  );
}
