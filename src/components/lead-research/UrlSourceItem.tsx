'use client';

import { X, ExternalLink, Loader2, Check, AlertCircle } from 'lucide-react';
import type { UrlSource } from '@/types/lead-research';

interface UrlSourceItemProps {
  source: UrlSource;
  onRemove: () => void;
}

function statusIcon(status: string) {
  switch (status) {
    case 'scraped':
      return <Check className="w-3 h-3 text-green-400" />;
    case 'scraping':
      return <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />;
    case 'failed':
      return <AlertCircle className="w-3 h-3 text-red-400" />;
    default:
      return <Loader2 className="w-3 h-3 text-gray-400" />;
  }
}

export default function UrlSourceItem({ source, onRemove }: UrlSourceItemProps) {
  const displayUrl = source.url.replace(/^https?:\/\//, '').replace(/\/$/, '');

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[var(--color-bg-main)] border border-[var(--color-border-light)] group">
      <div className="flex-shrink-0">{statusIcon(source.status)}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs text-[var(--color-text-primary)] truncate">
            {source.label ?? displayUrl}
          </span>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 text-[var(--color-text-disabled)] hover:text-blue-400 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        {source.label && (
          <div className="text-[10px] text-[var(--color-text-disabled)] truncate">{displayUrl}</div>
        )}
        {source.signalsFound != null && source.signalsFound > 0 && (
          <div className="text-[10px] text-green-400">{source.signalsFound} signals</div>
        )}
      </div>
      <button
        onClick={onRemove}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-[var(--color-text-disabled)] hover:text-red-400 transition-all"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
