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
  sales:    'bg-primary/15 text-primary-light border-primary/30',
  marketing:'bg-blue-500/15 text-blue-400 border-blue-500/30',
  social:   'bg-primary/15 text-primary-light border-primary/30',
  internal: 'bg-surface-elevated/30 text-muted-foreground border-border/30',
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
      <div className="bg-card border border-border-strong rounded-xl w-full max-w-3xl mx-4 shadow-2xl">
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 border-b border-border-strong">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5 text-primary" />
            Choose a Starter Template
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-white"
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
                className="text-left p-4 rounded-lg border border-border-strong hover:border-primary/50 hover:bg-surface-elevated/50 transition-all group focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {/* Icon + Category */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-surface-elevated group-hover:bg-primary/10 transition-colors border border-border-strong group-hover:border-primary/30">
                    <IconComponent className="w-5 h-5 text-muted-foreground group-hover:text-primary-light transition-colors" />
                  </div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border font-medium ${CATEGORY_COLORS[template.category]}`}
                  >
                    {template.category}
                  </span>
                </div>

                {/* Name + Description */}
                <h3 className="text-sm font-semibold text-white group-hover:text-primary-light transition-colors mb-1">
                  {template.name}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  {template.description}
                </p>

                {/* Meta badges */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-surface-elevated px-2 py-0.5 rounded-full border border-border-strong">
                    <Clock className="w-3 h-3" />
                    {template.estimatedDuration}s
                  </span>
                  <span className="text-xs text-muted-foreground bg-surface-elevated px-2 py-0.5 rounded-full border border-border-strong">
                    {template.aspectRatio}
                  </span>
                  <span className="text-xs text-muted-foreground bg-surface-elevated/50 px-2 py-0.5 rounded-full border border-border-strong/50 truncate max-w-[120px]" title={template.platform}>
                    {template.platform}
                  </span>
                </div>

                {/* Scene count */}
                <p className="text-xs text-muted-foreground mt-2">
                  {template.scenes.length} scene{template.scenes.length !== 1 ? 's' : ''}
                </p>
              </button>
            );
          })}
        </div>

        {/* ── Footer ─────────────────────────────────────────── */}
        <div className="p-4 border-t border-border-strong flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Templates pre-fill your brief and scenes. You can edit everything after selecting.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-muted-foreground hover:text-white"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
