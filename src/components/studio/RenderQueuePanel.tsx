'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import {
  Clock,
  Loader2,
  CheckCircle2,
  XCircle,
  Ban,
  RefreshCw,
  Inbox,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { RenderQueueItem, GenerationStatus } from '@/types/creative-studio';

// ─── Types ─────────────────────────────────────────────────────────

interface RenderQueuePanelProps {
  items: RenderQueueItem[];
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onSelect?: (id: string) => void;
  className?: string;
}

// ─── Status Helpers ────────────────────────────────────────────────

interface StatusConfig {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  label: string;
}

function getStatusConfig(status: GenerationStatus): StatusConfig {
  switch (status) {
    case 'queued':
      return {
        icon: <Clock className="h-4 w-4" />,
        color: 'text-zinc-400',
        bgColor: 'bg-zinc-500/10',
        label: 'Queued',
      };
    case 'processing':
      return {
        icon: <Loader2 className="h-4 w-4 animate-spin" />,
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/10',
        label: 'Processing',
      };
    case 'completed':
      return {
        icon: <CheckCircle2 className="h-4 w-4" />,
        color: 'text-green-400',
        bgColor: 'bg-green-500/10',
        label: 'Completed',
      };
    case 'failed':
      return {
        icon: <XCircle className="h-4 w-4" />,
        color: 'text-red-400',
        bgColor: 'bg-red-500/10',
        label: 'Failed',
      };
    case 'cancelled':
      return {
        icon: <Ban className="h-4 w-4" />,
        color: 'text-zinc-500',
        bgColor: 'bg-zinc-500/10',
        label: 'Cancelled',
      };
  }
}

function formatTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatCost(cost: number): string {
  if (cost === 0) {
    return 'Free';
  }
  if (cost < 0.01) {
    return '<$0.01';
  }
  return `$${cost.toFixed(2)}`;
}

// ─── Queue Item ────────────────────────────────────────────────────

interface QueueItemRowProps {
  item: RenderQueueItem;
  onCancel?: (id: string) => void;
  onRetry?: (id: string) => void;
  onSelect?: (id: string) => void;
}

function QueueItemRow({ item, onCancel, onRetry, onSelect }: QueueItemRowProps) {
  const statusConfig = getStatusConfig(item.status);
  const isClickable = item.status === 'completed' && onSelect;
  const truncatedPrompt =
    item.prompt.length > 60 ? `${item.prompt.slice(0, 60)}...` : item.prompt;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      onClick={() => isClickable && onSelect(item.id)}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 p-3 transition-colors',
        isClickable && 'cursor-pointer hover:border-zinc-500 hover:bg-zinc-800/80',
      )}
    >
      {/* Status icon */}
      <div
        className={cn(
          'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
          statusConfig.bgColor,
          statusConfig.color,
        )}
      >
        {statusConfig.icon}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-zinc-300 truncate">{truncatedPrompt}</p>
        <div className="mt-1 flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-600 text-zinc-500">
            {item.provider}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-zinc-600 text-zinc-500">
            {item.model}
          </Badge>
          <span className="text-[10px] text-zinc-600">
            {formatCost(item.estimatedCost)}
          </span>
          <span className="text-[10px] text-zinc-600">
            {formatTimestamp(item.createdAt)}
          </span>
        </div>
        {/* Progress bar for processing items */}
        {item.status === 'processing' && item.progress !== undefined && (
          <div className="mt-1.5 h-1 w-full rounded-full bg-zinc-800 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(item.progress, 100)}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
        {/* Error message */}
        {item.status === 'failed' && item.error && (
          <p className="mt-1 text-[10px] text-red-400/80 truncate">
            {item.error}
          </p>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex-shrink-0 flex items-center gap-1">
        {(item.status === 'queued' || item.status === 'processing') && onCancel && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onCancel(item.id);
            }}
            className="h-7 w-7 text-zinc-500 hover:text-red-400"
            title="Cancel"
          >
            <XCircle className="h-3.5 w-3.5" />
          </Button>
        )}
        {item.status === 'failed' && onRetry && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation();
              onRetry(item.id);
            }}
            className="h-7 w-7 text-zinc-500 hover:text-blue-400"
            title="Retry"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export function RenderQueuePanel({
  items,
  onCancel,
  onRetry,
  onSelect,
  className,
}: RenderQueuePanelProps) {
  if (items.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-12 text-zinc-500',
          className,
        )}
      >
        <Inbox className="h-10 w-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">No generations in queue</p>
        <p className="text-xs text-zinc-600 mt-1">
          Generated content will appear here
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <QueueItemRow
            key={item.id}
            item={item}
            onCancel={onCancel}
            onRetry={onRetry}
            onSelect={onSelect}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

RenderQueuePanel.displayName = 'RenderQueuePanel';
