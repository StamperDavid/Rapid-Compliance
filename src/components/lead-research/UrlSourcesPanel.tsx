'use client';

import { useState, type FormEvent } from 'react';
import { Plus, Globe, Loader2 } from 'lucide-react';
import UrlSourceItem from './UrlSourceItem';
import type { UrlSource } from '@/types/lead-research';

interface UrlSourcesPanelProps {
  sources: UrlSource[];
  loading: boolean;
  onAdd: (url: string, label?: string) => Promise<void>;
  onRemove: (id: string) => void;
}

export default function UrlSourcesPanel({ sources, loading, onAdd, onRemove }: UrlSourcesPanelProps) {
  const [urlInput, setUrlInput] = useState('');
  const [adding, setAdding] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim() || adding) {return;}
    setAdding(true);
    try {
      await onAdd(urlInput.trim());
      setUrlInput('');
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-elevated)] border-l border-[var(--color-border-light)]">
      <div className="p-3 border-b border-[var(--color-border-light)]">
        <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          URL Sources
        </h2>
      </div>

      {/* Add URL form */}
      <form onSubmit={(e) => void handleSubmit(e)} className="p-3 border-b border-[var(--color-border-light)]">
        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
            placeholder="https://example.com"
            className="flex-1 bg-[var(--color-bg-main)] border border-[var(--color-border-light)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!urlInput.trim() || adding}
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {adding ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </form>

      {/* Source list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-disabled)]" />
          </div>
        ) : sources.length === 0 ? (
          <p className="text-xs text-[var(--color-text-disabled)] text-center py-8">
            Add URLs to scrape for business intelligence
          </p>
        ) : (
          sources.map(source => (
            <UrlSourceItem
              key={source.id}
              source={source}
              onRemove={() => onRemove(source.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
