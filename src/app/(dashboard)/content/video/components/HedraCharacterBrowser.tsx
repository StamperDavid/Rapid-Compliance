'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { motion } from 'framer-motion';
import { X, Loader2, Search, Check, Download, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface HedraCharacter {
  id: string;
  name: string;
  rawName: string;
  description: string | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  alreadyImported: boolean;
}

interface HedraCharacterBrowserProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

export function HedraCharacterBrowser({ isOpen, onClose, onImportComplete }: HedraCharacterBrowserProps) {
  const authFetch = useAuthFetch();
  const [characters, setCharacters] = useState<HedraCharacter[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);

  // Fetch characters from Hedra when modal opens
  useEffect(() => {
    if (!isOpen) {return;}

    const fetchCharacters = async () => {
      setIsLoading(true);
      setError(null);
      setSelectedIds(new Set());
      setImportResult(null);

      try {
        const response = await authFetch('/api/video/avatar-profiles/hedra-characters');
        if (!response.ok) {
          throw new Error('Failed to fetch Hedra characters');
        }
        const data = await response.json() as {
          success: boolean;
          characters: HedraCharacter[];
          error?: string;
        };
        if (!data.success) {
          throw new Error(data.error ?? 'Failed to fetch');
        }
        setCharacters(data.characters);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Hedra characters');
      } finally {
        setIsLoading(false);
      }
    };

    void fetchCharacters();
  }, [isOpen, authFetch]);

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAllUnimported = useCallback(() => {
    const unimportedIds = characters
      .filter((c) => !c.alreadyImported && c.imageUrl)
      .map((c) => c.id);
    setSelectedIds(new Set(unimportedIds));
  }, [characters]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const importSelected = useCallback(async () => {
    if (selectedIds.size === 0) {return;}

    setIsImporting(true);
    setImportResult(null);

    try {
      const response = await authFetch('/api/video/avatar-profiles/sync-hedra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ characterIds: Array.from(selectedIds) }),
      });
      const data = await response.json() as {
        success: boolean;
        imported?: number;
        skipped?: number;
        error?: string;
      };

      if (!data.success) {
        setImportResult(data.error ?? 'Import failed');
        return;
      }

      const msg = data.imported
        ? `Imported ${data.imported} character${data.imported !== 1 ? 's' : ''}`
        : 'All selected characters were already imported';

      setImportResult(msg);

      // Mark imported ones in local state
      if (data.imported && data.imported > 0) {
        setCharacters((prev) =>
          prev.map((c) =>
            selectedIds.has(c.id) ? { ...c, alreadyImported: true } : c
          )
        );
        setSelectedIds(new Set());
        onImportComplete();
      }
    } catch (err) {
      setImportResult(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  }, [selectedIds, authFetch, onImportComplete]);

  const filteredCharacters = useMemo(() => {
    if (!searchQuery.trim()) {return characters;}
    const query = searchQuery.toLowerCase();
    return characters.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        (c.description?.toLowerCase().includes(query) ?? false)
    );
  }, [characters, searchQuery]);

  const availableCount = useMemo(
    () => characters.filter((c) => !c.alreadyImported && c.imageUrl).length,
    [characters]
  );

  if (!isOpen) {return null;}

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="relative w-full max-w-4xl max-h-[85vh] bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Hedra Character Library</h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              {characters.length} characters available
              {availableCount < characters.length && ` · ${characters.length - availableCount} already imported`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search characters..."
              className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
          </div>
          <button
            onClick={selectAllUnimported}
            className="px-3 py-2 text-xs font-medium text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg hover:bg-zinc-700 hover:text-white transition-colors whitespace-nowrap"
          >
            Select All New
          </button>
          {selectedIds.size > 0 && (
            <button
              onClick={clearSelection}
              className="px-3 py-2 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors whitespace-nowrap"
            >
              Clear ({selectedIds.size})
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading && (
            <div className="flex items-center justify-center py-16 gap-2 text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading Hedra characters...</span>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {!isLoading && !error && (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {filteredCharacters.map((character) => {
                const isSelected = selectedIds.has(character.id);
                const isDisabled = character.alreadyImported || !character.imageUrl;

                return (
                  <button
                    key={character.id}
                    onClick={() => {
                      if (!isDisabled) {toggleSelection(character.id);}
                    }}
                    disabled={isDisabled}
                    className={cn(
                      'relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all',
                      isDisabled
                        ? 'border-zinc-800 bg-zinc-900/50 opacity-50 cursor-not-allowed'
                        : isSelected
                          ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/30'
                          : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500 hover:bg-zinc-800 cursor-pointer',
                    )}
                  >
                    {/* Image */}
                    {character.imageUrl ? (
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden">
                        <Image
                          src={character.thumbnailUrl ?? character.imageUrl}
                          alt={character.name}
                          fill
                          className="object-cover"
                          sizes="64px"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-zinc-700 flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-zinc-500" />
                      </div>
                    )}

                    {/* Name */}
                    <span className="text-[10px] font-medium text-zinc-300 truncate w-full text-center leading-tight">
                      {character.name}
                    </span>

                    {/* Already imported badge */}
                    {character.alreadyImported && (
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 bg-green-500/20 border border-green-500/30 text-green-400 text-[8px] font-bold rounded">
                        IMPORTED
                      </span>
                    )}

                    {/* Selection checkmark */}
                    {isSelected && (
                      <div className="absolute top-1 left-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-black" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!isLoading && !error && filteredCharacters.length === 0 && searchQuery && (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Search className="w-6 h-6 text-zinc-600" />
              <p className="text-sm text-zinc-500">No characters match &ldquo;{searchQuery}&rdquo;</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-700">
          <div className="text-xs text-zinc-400">
            {importResult && (
              <span className={importResult.includes('failed') ? 'text-red-400' : 'text-green-400'}>
                {importResult}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              {importResult ? 'Done' : 'Cancel'}
            </button>
            <button
              onClick={() => void importSelected()}
              disabled={selectedIds.size === 0 || isImporting}
              className="flex items-center gap-2 px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isImporting
                ? 'Importing...'
                : selectedIds.size > 0
                  ? `Import ${selectedIds.size} Character${selectedIds.size !== 1 ? 's' : ''}`
                  : 'Select Characters to Import'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
