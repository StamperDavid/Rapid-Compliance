'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Loader2, Trash2, Download, User, Save } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { CharacterReference, CharacterProfile } from '@/types/creative-studio';

// ─── Types ─────────────────────────────────────────────────────────

interface CharacterLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The currently active character to offer saving */
  currentCharacter?: CharacterReference;
  /** Called when user loads a saved character */
  onLoadCharacter: (character: CharacterReference) => void;
}

// ─── Main Component ────────────────────────────────────────────────

export function CharacterLibraryModal({
  open,
  onOpenChange,
  currentCharacter,
  onLoadCharacter,
}: CharacterLibraryModalProps) {
  const authFetch = useAuthFetch();

  const [characters, setCharacters] = useState<CharacterProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch characters when modal opens
  const fetchCharacters = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch('/api/studio/characters');
      const data = await response.json() as {
        success: boolean;
        data?: CharacterProfile[];
      };
      if (data.success && data.data) {
        setCharacters(data.data);
      }
    } catch {
      // Silently fail — empty list shown
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (open) {
      void fetchCharacters();
      setSaveName('');
    }
  }, [open, fetchCharacters]);

  // Save current character
  const handleSave = useCallback(async () => {
    if (!currentCharacter || !saveName.trim()) {
      return;
    }
    setSaving(true);
    try {
      const response = await authFetch('/api/studio/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          slots: currentCharacter.slots,
          physicalDescription: currentCharacter.physicalDescription,
          tags: [],
        }),
      });
      const data = await response.json() as { success: boolean };
      if (data.success) {
        setSaveName('');
        void fetchCharacters();
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }, [currentCharacter, saveName, authFetch, fetchCharacters]);

  // Load a character
  const handleLoad = useCallback((char: CharacterProfile) => {
    const reference: CharacterReference = {
      id: char.id,
      name: char.name,
      slots: char.slots,
      physicalDescription: char.physicalDescription,
    };
    onLoadCharacter(reference);
    onOpenChange(false);
  }, [onLoadCharacter, onOpenChange]);

  // Delete a character
  const handleDelete = useCallback(async (id: string) => {
    setDeleteId(id);
    try {
      await authFetch(`/api/studio/characters?id=${id}`, {
        method: 'DELETE',
      });
      setCharacters((prev) => prev.filter((c) => c.id !== id));
    } catch {
      // Silently fail
    } finally {
      setDeleteId(null);
    }
  }, [authFetch]);

  // Get first face image from character for thumbnail
  const getCharThumbnail = (char: CharacterProfile): string | undefined => {
    const faceSlot = char.slots?.find((s) => s.type === 'face');
    return faceSlot?.imageUrls?.[0] ?? char.thumbnailUrl;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-lg max-h-[80vh] flex flex-col',
          'bg-zinc-900 border-zinc-700 text-white',
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <User className="h-5 w-5 text-amber-500" />
            Character Library
          </DialogTitle>
        </DialogHeader>

        {/* Save Current Character */}
        {currentCharacter?.name && (
          <div className="border border-zinc-700 rounded-lg p-3 space-y-2">
            <p className="text-xs text-zinc-400">
              Save current character as a Preset to reuse later:
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Name your character..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500 text-sm flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') { void handleSave(); } }}
              />
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving || !saveName.trim()}
                className="bg-amber-600 hover:bg-amber-500 text-black font-semibold"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </div>
          </div>
        )}

        {/* Saved Characters List */}
        <div className="flex-1 overflow-y-auto space-y-2 mt-2">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Saved Characters
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : characters.length === 0 ? (
            <div className="text-center py-12">
              <User className="h-10 w-10 mx-auto text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">No saved characters yet</p>
              <p className="text-xs text-zinc-600 mt-1">
                Add a character above and save it to build your library
              </p>
            </div>
          ) : (
            characters.map((char) => {
              const thumb = getCharThumbnail(char);
              return (
                <div
                  key={char.id}
                  className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 hover:border-zinc-600 transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="h-12 w-12 flex-shrink-0 rounded-lg bg-zinc-800 overflow-hidden flex items-center justify-center">
                    {thumb ? (
                      <div className="relative h-full w-full">
                        <Image
                          src={thumb}
                          alt={char.name}
                          fill
                          unoptimized
                          className="object-cover"
                        />
                      </div>
                    ) : (
                      <User className="h-5 w-5 text-zinc-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{char.name}</p>
                    <p className="text-[10px] text-zinc-500">
                      {char.slots?.filter((s) => s.imageUrls.length > 0).length ?? 0} slots filled
                      {char.physicalDescription && ' — has description'}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-amber-400 hover:text-amber-300"
                      onClick={() => handleLoad(char)}
                      title="Load character"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-zinc-500 hover:text-red-400"
                      onClick={() => void handleDelete(char.id)}
                      disabled={deleteId === char.id}
                      title="Delete character"
                    >
                      {deleteId === char.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        : <Trash2 className="h-3.5 w-3.5" />
                      }
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

CharacterLibraryModal.displayName = 'CharacterLibraryModal';
