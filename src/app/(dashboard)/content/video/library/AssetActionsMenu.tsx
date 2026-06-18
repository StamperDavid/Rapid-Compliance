'use client';

/**
 * Media Library — shared per-tile action menu + bulk action toolbar.
 *
 * Every common asset action is reachable WITHOUT opening the detail panel:
 *   - `AssetActionsMenu`  — the per-tile three-dot (⋯) hover popover
 *   - `BulkActionsBar`    — the sticky toolbar shown when ≥1 tile is selected,
 *                           applying the SAME action set to every checked asset
 *
 * Both share a small `MenuPopover` primitive (no design-system dropdown exists
 * yet, so this is the on-brand stand-in) and the same action descriptors:
 *   Assign to character · Assign to project · Set category · Edit tags ·
 *   Edit intended use · Download · Delete (two-step).
 *
 * All mutations are expressed as field patches the parent applies via the
 * `/api/media/[id]` PATCH endpoint, one call per asset.
 */

import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Caption } from '@/components/ui/typography';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  MoreVertical,
  Download,
  Trash2,
  Users,
  UserPlus,
  FolderPlus,
  Tag as TagIcon,
  Layers,
  Pencil,
  X,
  Plus,
  ChevronRight,
  Loader2,
  Check,
} from 'lucide-react';
import {
  MEDIA_CATEGORIES,
  type MediaAssetCategory,
  type UnifiedMediaAsset,
} from '@/types/media-library';

// ============================================================================
// Shared option shapes
// ============================================================================

/** A character the operator owns (subset of AvatarProfile we need here). */
export interface CharacterOption {
  id: string;
  name: string;
}

/** A distinct project derived from the loaded assets. */
export interface ProjectOption {
  id: string;
  name: string;
}

/**
 * The full action set, expressed as field patches. The parent owns the actual
 * `/api/media/[id]` PATCH call so single-tile and bulk paths share one code
 * path. Every handler returns a promise so callers can show progress.
 */
export interface AssetActions {
  onAssignCharacter: (character: CharacterOption | null) => Promise<void>;
  onAssignProject: (project: ProjectOption | null) => Promise<void>;
  onSetCategory: (category: MediaAssetCategory) => Promise<void>;
  onAddTags: (tags: string[]) => Promise<void>;
  onRemoveTags: (tags: string[]) => Promise<void>;
  onSetIntendedUse: (intendedUse: string) => Promise<void>;
  onDownload: () => Promise<void>;
  onDelete: () => Promise<void>;
  /**
   * MOVE this image onto a character as a reference image. Unlike
   * `onAssignCharacter` (which only tags the asset), this RELOCATES the image:
   * it lands on the character's reference set and leaves the media library.
   * Image assets only.
   */
  onMoveToCharacter: (character: CharacterOption) => Promise<void>;
}

// ============================================================================
// MenuPopover — a small click-to-open popover anchored to its trigger
// ============================================================================

interface MenuPopoverProps {
  /** The clickable trigger (e.g. the ⋯ button). */
  trigger: (props: {
    open: boolean;
    toggle: (e: React.MouseEvent) => void;
    ref: React.Ref<HTMLButtonElement>;
  }) => React.ReactNode;
  /** Panel contents. Receives a `close` callback. */
  children: (close: () => void) => React.ReactNode;
  /** Horizontal anchor edge of the panel. Defaults to right-aligned. */
  align?: 'left' | 'right';
  className?: string;
}

export function MenuPopover({
  trigger,
  children,
  align = 'right',
  className,
}: MenuPopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => setOpen(false), []);

  // Close on outside click + Escape.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onDocClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen((v) => !v);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className ?? ''}`}>
      {trigger({ open, toggle, ref: triggerRef })}
      {open && (
        <div
          role="menu"
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full z-30 mt-1 w-56 overflow-hidden rounded-xl border border-border-strong bg-card p-1 shadow-lg ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Small building blocks shared by the menu + dialogs
// ============================================================================

function MenuItem({
  icon: Icon,
  label,
  onClick,
  trailing,
  destructive,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium transition-colors disabled:opacity-50 ${
        destructive
          ? 'text-destructive hover:bg-destructive/10'
          : 'text-foreground hover:bg-surface-elevated'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </button>
  );
}

/** Inline tag add/remove editor (mirrors the detail panel's pattern). */
function TagEditor({
  tags,
  onAdd,
  onRemove,
  busy,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  busy: boolean;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const t = draft.trim();
    if (t && !tags.includes(t)) {
      onAdd(t);
    }
    setDraft('');
  };
  return (
    <div>
      {tags.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface-elevated px-2 py-0.5 text-[11px] text-foreground"
            >
              {tag}
              <button
                type="button"
                onClick={() => onRemove(tag)}
                disabled={busy}
                aria-label={`Remove tag ${tag}`}
                className="text-muted-foreground hover:text-destructive disabled:opacity-50"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            }
          }}
          placeholder="Add a tag"
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={commit}
          disabled={busy || !draft.trim()}
          className="h-8 px-2"
          aria-label="Add tag"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Dialogs — character picker, project picker, intended-use editor
// ============================================================================

function CharacterDialog({
  open,
  onOpenChange,
  characters,
  loading,
  onPick,
  onClear,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  characters: CharacterOption[];
  loading: boolean;
  onPick: (c: CharacterOption) => void;
  onClear: () => void;
  title: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Tag this media as belonging to one of your Character Library
            profiles. Reusable across videos.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : characters.length === 0 ? (
          <Caption className="block py-4 text-center">
            No characters yet. Create one in the Characters tab.
          </Caption>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {characters.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  onPick(c);
                  onOpenChange(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-border-strong bg-card px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-elevated"
              >
                <Users className="h-4 w-4 text-primary" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-between gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClear();
              onOpenChange(false);
            }}
            className="gap-1.5"
          >
            <X className="h-4 w-4" />
            Clear character
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * MoveToCharacterDialog — pick a character to MOVE this image onto.
 *
 * Distinct from `CharacterDialog`: this relocates the image (it becomes a
 * reference image on the character and leaves the library), so the copy is
 * explicit about that and there is no "clear" option.
 */
function MoveToCharacterDialog({
  open,
  onOpenChange,
  characters,
  loading,
  busy,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  characters: CharacterOption[];
  loading: boolean;
  busy: boolean;
  onPick: (c: CharacterOption) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add this image to a character</DialogTitle>
          <DialogDescription>
            Pick a character and this image moves onto it as one of its
            reference photos. It will leave your media library — its home is now
            the character.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : characters.length === 0 ? (
          <Caption className="block py-4 text-center">
            No characters yet. Create one in the Characters tab first.
          </Caption>
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {characters.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  onPick(c);
                  onOpenChange(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-border-strong bg-card px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-elevated disabled:opacity-50"
              >
                <Users className="h-4 w-4 text-primary" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProjectDialog({
  open,
  onOpenChange,
  projects,
  onPick,
  onCreate,
  onClear,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projects: ProjectOption[];
  onPick: (p: ProjectOption) => void;
  onCreate: (name: string) => void;
  onClear: () => void;
  title: string;
}) {
  const [newName, setNewName] = useState('');
  useEffect(() => {
    if (!open) {
      setNewName('');
    }
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Group this media under a project so it stays together across the
            library.
          </DialogDescription>
        </DialogHeader>
        {projects.length > 0 && (
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {projects.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPick(p);
                  onOpenChange(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg border border-border-strong bg-card px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-elevated"
              >
                <FolderPlus className="h-4 w-4 text-primary" />
                <span className="truncate">{p.name}</span>
              </button>
            ))}
          </div>
        )}
        <div className="pt-2">
          <Caption className="mb-1 block">New project</Caption>
          <div className="flex gap-1.5">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) {
                  e.preventDefault();
                  onCreate(newName.trim());
                  onOpenChange(false);
                }
              }}
              placeholder="Project name"
              className="h-9 text-sm"
            />
            <Button
              size="sm"
              disabled={!newName.trim()}
              onClick={() => {
                onCreate(newName.trim());
                onOpenChange(false);
              }}
              className="h-9 gap-1.5"
            >
              <FolderPlus className="h-4 w-4" />
              Create
            </Button>
          </div>
        </div>
        <div className="flex justify-between gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              onClear();
              onOpenChange(false);
            }}
            className="gap-1.5"
          >
            <X className="h-4 w-4" />
            Clear project
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function IntendedUseDialog({
  open,
  onOpenChange,
  initialValue,
  onSave,
  title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialValue: string;
  onSave: (value: string) => void;
  title: string;
}) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (open) {
      setValue(initialValue);
    }
  }, [open, initialValue]);
  const fieldId = useId();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            A short note on how this media is meant to be used.
          </DialogDescription>
        </DialogHeader>
        <Input
          id={fieldId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSave(value.trim());
              onOpenChange(false);
            }
          }}
          placeholder="e.g. Hero shot for the spring launch reel"
          autoFocus
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onSave(value.trim());
              onOpenChange(false);
            }}
            className="gap-1.5"
          >
            <Check className="h-4 w-4" />
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// AssetActionsMenu — the per-tile three-dot (⋯) menu
// ============================================================================

type SubView = 'root' | 'category' | 'tags';

interface AssetActionsMenuProps {
  asset: UnifiedMediaAsset;
  characters: CharacterOption[];
  charactersLoading: boolean;
  onLoadCharacters: () => void;
  projects: ProjectOption[];
  actions: AssetActions;
  /** Arms the parent's two-step delete; the tile renders the confirm overlay. */
  onArmDelete: () => void;
}

export function AssetActionsMenu({
  asset,
  characters,
  charactersLoading,
  onLoadCharacters,
  projects,
  actions,
  onArmDelete,
}: AssetActionsMenuProps) {
  const [view, setView] = useState<SubView>('root');
  const [busy, setBusy] = useState(false);
  const [charDialog, setCharDialog] = useState(false);
  const [moveCharDialog, setMoveCharDialog] = useState(false);
  const [projDialog, setProjDialog] = useState(false);
  const [useDialog, setUseDialog] = useState(false);

  const isImage = asset.type === 'image';

  const run = useCallback(async (fn: () => Promise<void>, close?: () => void) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
      close?.();
    }
  }, []);

  return (
    <>
      <MenuPopover
        align="right"
        trigger={({ toggle, ref }) => (
          <button
            ref={ref}
            type="button"
            onClick={toggle}
            aria-label="Asset actions"
            className="rounded-md bg-black/50 p-1 text-white hover:bg-black/70"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        )}
      >
        {(close) => {
          if (view === 'category') {
            return (
              <div className="max-h-72 overflow-y-auto">
                <MenuItem
                  icon={ChevronRight}
                  label="Back"
                  onClick={() => setView('root')}
                />
                <div className="my-1 border-t border-border-light" />
                {MEDIA_CATEGORIES.map((cat) => (
                  <MenuItem
                    key={cat}
                    icon={Layers}
                    label={cat}
                    disabled={busy}
                    trailing={
                      asset.category === cat ? (
                        <Check className="h-3.5 w-3.5 text-primary" />
                      ) : undefined
                    }
                    onClick={() => {
                      void run(() => actions.onSetCategory(cat), close);
                    }}
                  />
                ))}
              </div>
            );
          }
          if (view === 'tags') {
            return (
              <div className="p-2">
                <MenuItem
                  icon={ChevronRight}
                  label="Back"
                  onClick={() => setView('root')}
                />
                <div className="my-1 border-t border-border-light" />
                <TagEditor
                  tags={asset.tags}
                  busy={busy}
                  onAdd={(tag) => {
                    void run(() => actions.onAddTags([tag]));
                  }}
                  onRemove={(tag) => {
                    void run(() => actions.onRemoveTags([tag]));
                  }}
                />
              </div>
            );
          }
          // root
          return (
            <>
              {isImage && (
                <MenuItem
                  icon={UserPlus}
                  label="Add to a character (moves it here)"
                  trailing={
                    <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                  }
                  onClick={() => {
                    onLoadCharacters();
                    setMoveCharDialog(true);
                    close();
                  }}
                />
              )}
              <MenuItem
                icon={Users}
                label="Tag with a character (stays in library)"
                trailing={<ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                onClick={() => {
                  onLoadCharacters();
                  setCharDialog(true);
                  close();
                }}
              />
              <MenuItem
                icon={FolderPlus}
                label="Assign to project"
                trailing={<ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                onClick={() => {
                  setProjDialog(true);
                  close();
                }}
              />
              <MenuItem
                icon={Layers}
                label="Set category"
                trailing={<ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                onClick={() => setView('category')}
              />
              <MenuItem
                icon={TagIcon}
                label="Edit tags"
                trailing={<ChevronRight className="h-3.5 w-3.5 opacity-50" />}
                onClick={() => setView('tags')}
              />
              <MenuItem
                icon={Pencil}
                label="Edit intended use"
                onClick={() => {
                  setUseDialog(true);
                  close();
                }}
              />
              <div className="my-1 border-t border-border-light" />
              <MenuItem
                icon={Download}
                label="Download"
                disabled={busy}
                onClick={() => {
                  void run(() => actions.onDownload(), close);
                }}
              />
              <MenuItem
                icon={Trash2}
                label="Delete"
                destructive
                onClick={() => {
                  // Arm the parent's two-step delete (the tile renders its own
                  // confirm overlay) and close the menu.
                  onArmDelete();
                  close();
                }}
              />
            </>
          );
        }}
      </MenuPopover>

      <CharacterDialog
        open={charDialog}
        onOpenChange={setCharDialog}
        characters={characters}
        loading={charactersLoading}
        title="Assign to character"
        onPick={(c) => {
          void actions.onAssignCharacter(c);
        }}
        onClear={() => {
          void actions.onAssignCharacter(null);
        }}
      />
      <MoveToCharacterDialog
        open={moveCharDialog}
        onOpenChange={setMoveCharDialog}
        characters={characters}
        loading={charactersLoading}
        busy={busy}
        onPick={(c) => {
          void run(() => actions.onMoveToCharacter(c));
        }}
      />
      <ProjectDialog
        open={projDialog}
        onOpenChange={setProjDialog}
        projects={projects}
        title="Assign to project"
        onPick={(p) => {
          void actions.onAssignProject(p);
        }}
        onCreate={(name) => {
          void actions.onAssignProject({
            id: makeProjectId(name),
            name,
          });
        }}
        onClear={() => {
          void actions.onAssignProject(null);
        }}
      />
      <IntendedUseDialog
        open={useDialog}
        onOpenChange={setUseDialog}
        initialValue={asset.intendedUse ?? ''}
        title="Edit intended use"
        onSave={(value) => {
          void actions.onSetIntendedUse(value);
        }}
      />
    </>
  );
}

// ============================================================================
// BulkActionsBar — the sticky toolbar applying actions to every checked asset
// ============================================================================

interface BulkActionsBarProps {
  count: number;
  characters: CharacterOption[];
  charactersLoading: boolean;
  onLoadCharacters: () => void;
  projects: ProjectOption[];
  actions: AssetActions;
  busy: boolean;
  /** Progress label, e.g. "Updating 3 of 8…". Null when idle. */
  progress: string | null;
  isArmedDelete: boolean;
  onArmDelete: () => void;
  onCancelDelete: () => void;
  onClear: () => void;
}

export function BulkActionsBar({
  count,
  characters,
  charactersLoading,
  onLoadCharacters,
  projects,
  actions,
  busy,
  progress,
  isArmedDelete,
  onArmDelete,
  onCancelDelete,
  onClear,
}: BulkActionsBarProps) {
  const [charDialog, setCharDialog] = useState(false);
  const [projDialog, setProjDialog] = useState(false);
  const [useDialog, setUseDialog] = useState(false);
  const [tagMode, setTagMode] = useState<'add' | 'remove' | null>(null);
  const [tagDraft, setTagDraft] = useState('');

  const submitTags = () => {
    const tags = tagDraft
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (tags.length === 0 || !tagMode) {
      return;
    }
    if (tagMode === 'add') {
      void actions.onAddTags(tags);
    } else {
      void actions.onRemoveTags(tags);
    }
    setTagDraft('');
    setTagMode(null);
  };

  return (
    <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 backdrop-blur">
      <span className="text-sm font-medium text-foreground">
        {progress ?? `${count} selected`}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClear} disabled={busy}>
          Clear
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            onLoadCharacters();
            setCharDialog(true);
          }}
          className="gap-1.5"
        >
          <Users className="h-4 w-4" />
          Character
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setProjDialog(true)}
          className="gap-1.5"
        >
          <FolderPlus className="h-4 w-4" />
          Project
        </Button>

        <MenuPopover
          align="right"
          trigger={({ toggle, ref }) => (
            <Button
              ref={ref}
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={toggle}
              className="gap-1.5"
            >
              <Layers className="h-4 w-4" />
              Category
            </Button>
          )}
        >
          {(close) => (
            <div className="max-h-72 overflow-y-auto">
              {MEDIA_CATEGORIES.map((cat) => (
                <MenuItem
                  key={cat}
                  icon={Layers}
                  label={cat}
                  disabled={busy}
                  onClick={() => {
                    void actions.onSetCategory(cat);
                    close();
                  }}
                />
              ))}
            </div>
          )}
        </MenuPopover>

        {tagMode === null ? (
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setTagMode('add')}
              className="gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Add tags
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => setTagMode('remove')}
              className="gap-1.5"
            >
              <X className="h-4 w-4" />
              Remove tags
            </Button>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <Input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submitTags();
                }
              }}
              placeholder={
                tagMode === 'add' ? 'tags to add (comma)' : 'tags to remove (comma)'
              }
              className="h-8 w-44 text-xs"
            />
            <Button
              size="sm"
              disabled={busy || !tagDraft.trim()}
              onClick={submitTags}
              className="h-8 gap-1 px-2"
            >
              <Check className="h-3.5 w-3.5" />
              {tagMode === 'add' ? 'Add' : 'Remove'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTagMode(null);
                setTagDraft('');
              }}
              className="h-8 px-2"
            >
              Cancel
            </Button>
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => setUseDialog(true)}
          className="gap-1.5"
        >
          <Pencil className="h-4 w-4" />
          Intended use
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => {
            void actions.onDownload();
          }}
          className="gap-1.5"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Download
        </Button>

        {!isArmedDelete ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={onArmDelete}
            className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button
              variant="destructive"
              size="sm"
              disabled={busy}
              onClick={() => {
                void actions.onDelete();
              }}
              className="gap-1.5"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Delete {count} — confirm
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={onCancelDelete}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <CharacterDialog
        open={charDialog}
        onOpenChange={setCharDialog}
        characters={characters}
        loading={charactersLoading}
        title={`Assign ${count} to character`}
        onPick={(c) => {
          void actions.onAssignCharacter(c);
        }}
        onClear={() => {
          void actions.onAssignCharacter(null);
        }}
      />
      <ProjectDialog
        open={projDialog}
        onOpenChange={setProjDialog}
        projects={projects}
        title={`Assign ${count} to project`}
        onPick={(p) => {
          void actions.onAssignProject(p);
        }}
        onCreate={(name) => {
          void actions.onAssignProject({ id: makeProjectId(name), name });
        }}
        onClear={() => {
          void actions.onAssignProject(null);
        }}
      />
      <IntendedUseDialog
        open={useDialog}
        onOpenChange={setUseDialog}
        initialValue=""
        title={`Set intended use for ${count}`}
        onSave={(value) => {
          void actions.onSetIntendedUse(value);
        }}
      />
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

/** Stable, URL-safe project id derived from a name + a short random suffix. */
export function makeProjectId(name: string): string {
  const slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `proj-${slug || 'untitled'}-${suffix}`;
}
