'use client';

import { TrendingUp, Play, Star, Zap, Megaphone, Clock, X, LayoutTemplate, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VIDEO_TEMPLATES, type VideoTemplate } from '@/lib/video/templates';

// ─── Icon Map ─────────────────────────────────────────────────────────

const ICON_MAP: Record<string, LucideIcon> = {
  TrendingUp,
  Play,
  Star,
  Zap,
  Megaphone,
};

// ─── Category Badge ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<VideoTemplate['category'], string> = {
  sales:    'bg-amber-500/15 text-amber-400 border-amber-500/30',
  marketing:'bg-blue-500/15 text-blue-400 border-blue-500/30',
  social:   'bg-pink-500/15 text-pink-400 border-pink-500/30',
  internal: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

// ─── Props ─────────────────────────────────────────────────────────────

interface TemplatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (template: VideoTemplate) => void;
}

// ─── Component ─────────────────────────────────────────────────────────

export function TemplatePickerModal({ isOpen, onClose, onSelect }: TemplatePickerModalProps) {
  if (!isOpen) {
    return null;
  }

  const handleSelect = (template: VideoTemplate) => {
    onSelect(template);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-full max-w-3xl mx-4 shadow-2xl">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-amber-500" />
            Choose a Starter Template
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-zinc-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* ── Template Grid ───────────────────────────────────── */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[70vh] overflow-y-auto">
          {VIDEO_TEMPLATES.map((template) => {
            const IconComponent = ICON_MAP[template.icon] ?? Play;

            return (
              <button
                key={template.id}
                onClick={() => handleSelect(template)}
                className="text-left p-4 rounded-lg border border-zinc-800 hover:border-amber-500/50 hover:bg-zinc-800/50 transition-all group focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {/* Icon + Category */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-zinc-800 group-hover:bg-amber-500/10 transition-colors border border-zinc-700 group-hover:border-amber-500/30">
                    <IconComponent className="w-5 h-5 text-zinc-400 group-hover:text-amber-400 transition-colors" />
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[template.category]}`}
                  >
                    {template.category}
                  </span>
                </div>

                {/* Name + Description */}
                <h3 className="text-sm font-semibold text-white group-hover:text-amber-400 transition-colors mb-1">
                  {template.name}
                </h3>
                <p className="text-xs text-zinc-500 leading-relaxed mb-3">
                  {template.description}
                </p>

                {/* Meta badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
                    <Clock className="w-3 h-3" />
                    {template.estimatedDuration}s
                  </span>
                  <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-700">
                    {template.aspectRatio}
                  </span>
                  <span className="text-xs text-zinc-600 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-zinc-700/50 truncate max-w-[120px]" title={template.platform}>
                    {template.platform}
                  </span>
                </div>

                {/* Scene count */}
                <p className="text-xs text-zinc-600 mt-2">
                  {template.scenes.length} scene{template.scenes.length !== 1 ? 's' : ''}
                </p>
              </button>
            );
          })}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="p-4 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            Templates pre-fill your brief and scenes. You can edit everything after selecting.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
