'use client';

/**
 * Studio Tool Palette — left sidebar
 *
 * Switches the canvas mode between Image / Video / Music / Text. Clicking a
 * tool does NOT reset state; the per-tool prompt and last result are kept in
 * the parent's per-tool state map and restored when the operator switches back.
 */

import { Image as ImageIcon, Video, Music, Type } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export type StudioTool = 'image' | 'video' | 'music' | 'text';

interface ToolDefinition {
  id: StudioTool;
  label: string;
  description: string;
  Icon: typeof ImageIcon;
}

const TOOLS: readonly ToolDefinition[] = [
  {
    id: 'image',
    label: 'Image',
    description: 'Generate photos, graphics, thumbnails',
    Icon: ImageIcon,
  },
  {
    id: 'video',
    label: 'Video',
    description: 'Prompt-only or talking-head avatar',
    Icon: Video,
  },
  {
    id: 'music',
    label: 'Music',
    description: 'Background tracks, jingles, beds',
    Icon: Music,
  },
  {
    id: 'text',
    label: 'Text',
    description: 'Captions, scripts, copy',
    Icon: Type,
  },
];

// ============================================================================
// Component
// ============================================================================

interface StudioToolPaletteProps {
  activeTool: StudioTool;
  onToolChange: (tool: StudioTool) => void;
}

export function StudioToolPalette({ activeTool, onToolChange }: StudioToolPaletteProps) {
  return (
    <aside
      aria-label="Studio tool palette"
      className="w-56 shrink-0 border-r border-border-light bg-card/40 flex flex-col"
    >
      <div className="px-4 py-4 border-b border-border-light">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Tools
        </h2>
      </div>
      <nav className="flex flex-col gap-1 p-2">
        {TOOLS.map((tool) => {
          const isActive = tool.id === activeTool;
          const Icon = tool.Icon;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onToolChange(tool.id)}
              aria-pressed={isActive}
              className={cn(
                'flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-accent hover:text-accent-foreground',
              )}
            >
              <Icon className="h-5 w-5 shrink-0 mt-0.5" aria-hidden="true" />
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{tool.label}</span>
                <span className="text-xs text-muted-foreground line-clamp-2">
                  {tool.description}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
