'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Copy, RotateCcw, Save, Pencil, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { buildPromptFromPresets } from '@/lib/ai/cinematic-presets';
import type { CinematicConfig } from '@/types/creative-studio';

// ─── Types ─────────────────────────────────────────────────────────

interface ConstructedPromptDisplayProps {
  basePrompt: string;
  config: CinematicConfig;
  className?: string;
  onSavePreset?: () => void;
  onCopy?: () => void;
  onReset?: () => void;
  onEdit?: (editedPrompt: string) => void;
}

// ─── Main Component ────────────────────────────────────────────────

export function ConstructedPromptDisplay({
  basePrompt,
  config,
  className,
  onSavePreset,
  onCopy,
  onReset,
  onEdit,
}: ConstructedPromptDisplayProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState('');
  const [copied, setCopied] = useState(false);

  // Assemble the prompt from base + presets
  const assembledPrompt = useMemo(
    () => buildPromptFromPresets(basePrompt, config),
    [basePrompt, config],
  );

  // Character count
  const charCount = isEditing ? editedText.length : assembledPrompt.length;
  // Rough token estimate (1 token ~ 4 chars for English)
  const tokenEstimate = Math.ceil(charCount / 4);

  const handleEditToggle = useCallback(() => {
    if (isEditing) {
      // Exiting edit mode — commit the edit
      onEdit?.(editedText);
      setIsEditing(false);
    } else {
      // Entering edit mode
      setEditedText(assembledPrompt);
      setIsEditing(true);
    }
  }, [isEditing, editedText, assembledPrompt, onEdit]);

  const handleCopy = useCallback(() => {
    const text = isEditing ? editedText : assembledPrompt;
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard API may fail in some contexts; fail silently
    });
  }, [isEditing, editedText, assembledPrompt, onCopy]);

  const displayText = isEditing ? editedText : assembledPrompt;
  const isEmpty = !displayText.trim();

  return (
    <Card className={cn('border-zinc-700 bg-zinc-900', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-zinc-200">
            Constructed Prompt
          </CardTitle>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span>{charCount} chars</span>
            <span className="text-zinc-700">/</span>
            <span>~{tokenEstimate} tokens</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Prompt display / edit area */}
        <AnimatePresence mode="wait">
          {isEditing ? (
            <motion.div
              key="edit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
            >
              <Textarea
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                rows={6}
                className="bg-zinc-800 border-zinc-600 text-zinc-200 text-sm font-mono resize-y"
                placeholder="Edit your assembled prompt..."
              />
            </motion.div>
          ) : (
            <motion.div
              key="display"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className={cn(
                'min-h-[120px] rounded-md border border-zinc-700 bg-zinc-800/50 p-3',
                'text-sm leading-relaxed',
                isEmpty ? 'text-zinc-600 italic' : 'text-zinc-300',
              )}
            >
              {isEmpty
                ? 'Your assembled prompt will appear here as you configure settings...'
                : displayText}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="mt-3 flex items-center gap-2">
          {onSavePreset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSavePreset}
              disabled={isEmpty}
              className="text-zinc-400 hover:text-white"
            >
              <Save className="mr-1.5 h-3.5 w-3.5" />
              Save Preset
            </Button>
          )}

          {onEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleEditToggle}
              className={cn(
                'text-zinc-400 hover:text-white',
                isEditing && 'text-indigo-400 hover:text-indigo-300',
              )}
            >
              {isEditing ? (
                <>
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                  Done
                </>
              ) : (
                <>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </>
              )}
            </Button>
          )}

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            disabled={isEmpty}
            className="text-zinc-400 hover:text-white"
          >
            {copied ? (
              <>
                <Check className="mr-1.5 h-3.5 w-3.5 text-green-400" />
                <span className="text-green-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </>
            )}
          </Button>

          {onReset && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              disabled={isEmpty}
              className="text-zinc-400 hover:text-white ml-auto"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

ConstructedPromptDisplay.displayName = 'ConstructedPromptDisplay';
