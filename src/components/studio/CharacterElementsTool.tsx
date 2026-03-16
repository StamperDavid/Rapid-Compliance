'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import {
  Plus,
  Trash2,
  Upload,
  User,
  Shirt,
  Box,
  ImageIcon,
  Library,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type {
  CharacterReference,
  CharacterSlot,
  CharacterSlotType,
  StitchMode,
} from '@/types/creative-studio';

// ─── Types ─────────────────────────────────────────────────────────

interface CharacterElementsToolProps {
  characters: CharacterReference[];
  onChange: (characters: CharacterReference[]) => void;
  globalReference?: string;
  onGlobalReferenceChange?: (url: string | undefined) => void;
  additionalReferences?: string[];
  onAdditionalReferencesChange?: (urls: string[]) => void;
  narrativeAnglePrompting?: boolean;
  onNarrativeAnglePromptingChange?: (enabled: boolean) => void;
  /** Callback when Library button is clicked — enables the button when provided */
  onLibraryClick?: () => void;
  className?: string;
}

// ─── Constants ─────────────────────────────────────────────────────

const MAX_CHARACTERS = 4;
const MAX_ADDITIONAL_REFS = 14;

const SLOT_TYPES: { type: CharacterSlotType; label: string; icon: React.ReactNode }[] = [
  { type: 'face', label: 'Person Face', icon: <User className="h-5 w-5" /> },
  { type: 'outfit', label: 'Outfit', icon: <Shirt className="h-5 w-5" /> },
  { type: 'object', label: 'Object', icon: <Box className="h-5 w-5" /> },
  { type: 'scene', label: 'Scene', icon: <ImageIcon className="h-5 w-5" /> },
];

// ─── Helpers ───────────────────────────────────────────────────────

function createDefaultCharacter(index: number): CharacterReference {
  return {
    name: `Character ${index + 1}`,
    slots: SLOT_TYPES.map(({ type }) => ({
      type,
      mode: 'single' as StitchMode,
      imageUrls: [],
    })),
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Drop Zone Component ───────────────────────────────────────────

interface DropZoneProps {
  label: string;
  icon: React.ReactNode;
  images: string[];
  mode: StitchMode;
  onModeChange: (mode: StitchMode) => void;
  onAddImage: (dataUrl: string) => void;
  onRemoveImage: (index: number) => void;
}

function DropZone({
  label,
  icon,
  images,
  mode,
  onModeChange,
  onAddImage,
  onRemoveImage,
}: DropZoneProps) {
  const maxImages = mode === 'stitch' ? 4 : 1;
  const canAddMore = images.length < maxImages;
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      void readFileAsDataUrl(file).then((dataUrl) => {
        onAddImage(dataUrl);
        // Reset input so same file can be re-selected
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });
    },
    [onAddImage],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-zinc-400">{label}</Label>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-zinc-600">
            {mode === 'single' ? 'Single' : 'Stitch'}
          </span>
          <Switch
            checked={mode === 'stitch'}
            onCheckedChange={(checked) => onModeChange(checked ? 'stitch' : 'single')}
            label={`Toggle ${label} stitch mode`}
          />
        </div>
      </div>

      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {images.map((url, idx) => (
            <div key={idx} className="relative group rounded-md overflow-hidden aspect-square">
              <Image
                src={url}
                alt={`${label} ref ${idx + 1}`}
                fill
                unoptimized
                className="object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveImage(idx)}
                className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Remove image ${idx + 1}`}
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
          {canAddMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center rounded-md border border-dashed border-zinc-600 aspect-square hover:border-zinc-400 transition-colors"
            >
              <Plus className="h-4 w-4 text-zinc-500" />
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-2 rounded-lg',
            'border-2 border-dashed border-zinc-700 bg-zinc-900/50 p-4',
            'hover:border-zinc-500 hover:bg-zinc-800/30 transition-all',
            'cursor-pointer',
          )}
        >
          <div className="text-zinc-600">{icon}</div>
          <span className="text-[10px] text-zinc-600">Click to upload</span>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label={`Upload ${label} image`}
      />
    </div>
  );
}

// ─── Single Image Upload (for global ref / additional refs) ────────

interface ImageUploadSlotProps {
  imageUrl?: string;
  label: string;
  onUpload: (dataUrl: string) => void;
  onRemove: () => void;
}

function ImageUploadSlot({ imageUrl, label, onUpload, onRemove }: ImageUploadSlotProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) {
        return;
      }
      void readFileAsDataUrl(file).then((dataUrl) => {
        onUpload(dataUrl);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      });
    },
    [onUpload],
  );

  return (
    <div className="relative">
      {imageUrl ? (
        <div className="relative group rounded-md overflow-hidden aspect-square">
          <Image
            src={imageUrl}
            alt={label}
            fill
            unoptimized
            className="object-cover"
          />
          <button
            type="button"
            onClick={onRemove}
            className="absolute top-1 right-1 rounded-full bg-black/60 p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={`Remove ${label}`}
          >
            <X className="h-3 w-3 text-white" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-1 rounded-md',
            'border border-dashed border-zinc-700 bg-zinc-900/50 aspect-square',
            'hover:border-zinc-500 transition-colors cursor-pointer',
          )}
        >
          <Upload className="h-3.5 w-3.5 text-zinc-600" />
          <span className="text-[9px] text-zinc-600 truncate max-w-full px-1">
            {label}
          </span>
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label={`Upload ${label}`}
      />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export function CharacterElementsTool({
  characters,
  onChange,
  globalReference,
  onGlobalReferenceChange,
  additionalReferences = [],
  onAdditionalReferencesChange,
  narrativeAnglePrompting,
  onNarrativeAnglePromptingChange,
  onLibraryClick,
  className,
}: CharacterElementsToolProps) {
  const [activeTab, setActiveTab] = useState(0);

  // ─── Character CRUD ───────────────────────────────────────────

  const addCharacter = useCallback(() => {
    if (characters.length >= MAX_CHARACTERS) {
      return;
    }
    onChange([...characters, createDefaultCharacter(characters.length)]);
    setActiveTab(characters.length);
  }, [characters, onChange]);

  const removeCharacter = useCallback(
    (index: number) => {
      const updated = characters.filter((_, i) => i !== index);
      onChange(updated);
      if (activeTab >= updated.length) {
        setActiveTab(Math.max(0, updated.length - 1));
      }
    },
    [characters, onChange, activeTab],
  );

  const updateCharacter = useCallback(
    (index: number, partial: Partial<CharacterReference>) => {
      const updated = characters.map((char, i) =>
        i === index ? { ...char, ...partial } : char,
      );
      onChange(updated);
    },
    [characters, onChange],
  );

  const updateSlot = useCallback(
    (charIndex: number, slotType: CharacterSlotType, partial: Partial<CharacterSlot>) => {
      const char = characters[charIndex];
      if (!char) {
        return;
      }
      const updatedSlots = char.slots.map((slot) =>
        slot.type === slotType ? { ...slot, ...partial } : slot,
      );
      updateCharacter(charIndex, { slots: updatedSlots });
    },
    [characters, updateCharacter],
  );

  const addImageToSlot = useCallback(
    (charIndex: number, slotType: CharacterSlotType, dataUrl: string) => {
      const char = characters[charIndex];
      if (!char) {
        return;
      }
      const slot = char.slots.find((s) => s.type === slotType);
      if (!slot) {
        return;
      }
      const maxImages = slot.mode === 'stitch' ? 4 : 1;
      if (slot.imageUrls.length >= maxImages) {
        return;
      }
      updateSlot(charIndex, slotType, {
        imageUrls: [...slot.imageUrls, dataUrl],
      });
    },
    [characters, updateSlot],
  );

  const removeImageFromSlot = useCallback(
    (charIndex: number, slotType: CharacterSlotType, imageIndex: number) => {
      const char = characters[charIndex];
      if (!char) {
        return;
      }
      const slot = char.slots.find((s) => s.type === slotType);
      if (!slot) {
        return;
      }
      updateSlot(charIndex, slotType, {
        imageUrls: slot.imageUrls.filter((_, i) => i !== imageIndex),
      });
    },
    [characters, updateSlot],
  );

  // ─── Additional References ────────────────────────────────────

  const handleAdditionalRefUpload = useCallback(
    (index: number, dataUrl: string) => {
      const updated = [...additionalReferences];
      updated[index] = dataUrl;
      onAdditionalReferencesChange?.(updated);
    },
    [additionalReferences, onAdditionalReferencesChange],
  );

  const handleAdditionalRefRemove = useCallback(
    (index: number) => {
      const updated = additionalReferences.filter((_, i) => i !== index);
      onAdditionalReferencesChange?.(updated);
    },
    [additionalReferences, onAdditionalReferencesChange],
  );

  const activeCharacter = characters[activeTab];

  return (
    <div className={cn('space-y-6', className)}>
      {/* ─── Character Tabs ────────────────────────────────────── */}
      <div>
        <div className="flex items-center gap-1.5 mb-4">
          {characters.map((char, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                idx === activeTab
                  ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-500',
              )}
            >
              {char.name || `Character ${idx + 1}`}
            </button>
          ))}
          {characters.length < MAX_CHARACTERS && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={addCharacter}
              className="h-8 w-8 text-zinc-500 hover:text-white"
              title="Add character"
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* ─── Active Character Editor ───────────────────────── */}
        <AnimatePresence mode="wait">
          {activeCharacter && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="space-y-4"
            >
              {/* Name */}
              <div className="flex items-center gap-2">
                <Input
                  value={activeCharacter.name}
                  onChange={(e) => updateCharacter(activeTab, { name: e.target.value })}
                  placeholder="Character name..."
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 flex-1"
                />
                {characters.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeCharacter(activeTab)}
                    className="h-9 w-9 text-zinc-500 hover:text-red-400"
                    title="Remove character"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* 2x2 Drop Zone Grid */}
              <div className="grid grid-cols-2 gap-3">
                {SLOT_TYPES.map(({ type, label, icon }) => {
                  const slot = activeCharacter.slots.find((s) => s.type === type);
                  return (
                    <DropZone
                      key={type}
                      label={label}
                      icon={icon}
                      images={slot?.imageUrls ?? []}
                      mode={slot?.mode ?? 'single'}
                      onModeChange={(mode) => updateSlot(activeTab, type, { mode })}
                      onAddImage={(dataUrl) => addImageToSlot(activeTab, type, dataUrl)}
                      onRemoveImage={(idx) => removeImageFromSlot(activeTab, type, idx)}
                    />
                  );
                })}
              </div>

              {/* Physical Description */}
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-400">Physical Description</Label>
                <Textarea
                  value={activeCharacter.physicalDescription ?? ''}
                  onChange={(e) =>
                    updateCharacter(activeTab, {
                      physicalDescription: e.target.value || undefined,
                    })
                  }
                  placeholder="Describe physical features, clothing, distinguishing traits..."
                  rows={3}
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 text-sm resize-y"
                />
              </div>

              {/* Character Library button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-400"
                disabled={!onLibraryClick}
                onClick={onLibraryClick}
              >
                <Library className="mr-2 h-4 w-4" />
                Character Library
                {!onLibraryClick && (
                  <span className="ml-auto text-[10px] text-zinc-600">Coming soon</span>
                )}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {characters.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-zinc-500">
            <User className="h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">No characters added</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={addCharacter}
              className="mt-2 text-indigo-400 hover:text-indigo-300"
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Character
            </Button>
          </div>
        )}
      </div>

      {/* ─── Global Reference ──────────────────────────────────── */}
      {onGlobalReferenceChange && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-zinc-300">Global Reference</Label>
          <p className="text-[10px] text-zinc-600">
            A reference image or video applied to the entire generation
          </p>
          <div className="w-24">
            <ImageUploadSlot
              imageUrl={globalReference}
              label="Global Ref"
              onUpload={(dataUrl) => onGlobalReferenceChange(dataUrl)}
              onRemove={() => onGlobalReferenceChange(undefined)}
            />
          </div>
        </div>
      )}

      {/* ─── Additional Reference Images ───────────────────────── */}
      {onAdditionalReferencesChange && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-zinc-300">
            Additional Reference Images
          </Label>
          <p className="text-[10px] text-zinc-600">
            Up to {MAX_ADDITIONAL_REFS} images referenced as @Image1 through @Image{MAX_ADDITIONAL_REFS}
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {Array.from({ length: MAX_ADDITIONAL_REFS }, (_, i) => (
              <ImageUploadSlot
                key={i}
                imageUrl={additionalReferences[i]}
                label={`@Image${i + 1}`}
                onUpload={(dataUrl) => handleAdditionalRefUpload(i, dataUrl)}
                onRemove={() => handleAdditionalRefRemove(i)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Narrative Angle Prompting ─────────────────────────── */}
      {onNarrativeAnglePromptingChange && (
        <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3">
          <Label className="text-xs text-zinc-300">Narrative Angle Prompting</Label>
          <Switch
            checked={narrativeAnglePrompting ?? false}
            onCheckedChange={onNarrativeAnglePromptingChange}
            label="Toggle narrative angle prompting"
          />
        </div>
      )}
    </div>
  );
}

CharacterElementsTool.displayName = 'CharacterElementsTool';
