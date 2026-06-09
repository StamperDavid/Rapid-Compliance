'use client';

/**
 * MediaLibraryPicker — browse the existing media library and select assets to
 * attach to the Content Assistant chat as reference materials. Selecting a
 * library asset attaches it exactly like an upload (the chat then has the agent
 * "understand" it), but with no re-upload since it is already stored.
 */

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, Film, Music, Loader2 } from 'lucide-react';

export interface LibraryAsset {
  id: string;
  name: string;
  url: string;
  type: 'image' | 'video' | 'audio' | 'document';
  mimeType: string;
  thumbnailUrl?: string;
}

interface MediaLibraryPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (assets: LibraryAsset[]) => void;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
}

export function MediaLibraryPicker({ open, onOpenChange, onSelect, authFetch }: MediaLibraryPickerProps) {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch('/api/media?limit=500');
      const data = (await res.json()) as { success?: boolean; assets?: LibraryAsset[]; items?: LibraryAsset[] };
      const all = data.assets ?? data.items ?? [];
      // Reference-able media in chat = visual/audio assets.
      setAssets(all.filter((a) => a.type === 'image' || a.type === 'video' || a.type === 'audio'));
    } catch {
      setAssets([]);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (open) {
      setSelected(new Set());
      setSearch('');
      void load();
    }
  }, [open, load]);

  const toggle = (id: string): void => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const filtered = assets.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()));

  const confirm = (): void => {
    onSelect(assets.filter((a) => selected.has(a.id)));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Choose from your library</DialogTitle>
          <DialogDescription>
            Pick reference images or clips already in your library to attach to the chat — no re-uploading.
          </DialogDescription>
        </DialogHeader>

        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto py-2">
          {loading ? (
            <div className="col-span-full flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading your library…
            </div>
          ) : filtered.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {assets.length === 0 ? 'Nothing in your library yet.' : 'No matches.'}
            </div>
          ) : (
            filtered.map((a) => {
              const isSelected = selected.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggle(a.id)}
                  className={`relative rounded-lg border overflow-hidden text-left transition-colors ${
                    isSelected ? 'border-primary ring-2 ring-primary' : 'border-border-strong hover:border-primary'
                  }`}
                >
                  <div className="relative aspect-square bg-surface-elevated flex items-center justify-center">
                    {a.type === 'image' ? (
                      <Image
                        src={a.thumbnailUrl ?? a.url}
                        alt={a.name}
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                    ) : a.type === 'video' ? (
                      <Film className="h-8 w-8 text-muted-foreground" />
                    ) : (
                      <Music className="h-8 w-8 text-muted-foreground" />
                    )}
                    {isSelected && (
                      <span className="absolute top-1 right-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                  </div>
                  <span className="block truncate px-2 py-1 text-xs text-foreground">{a.name}</span>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={confirm} disabled={selected.size === 0}>
            Add{selected.size > 0 ? ` ${selected.size}` : ''} selected
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
