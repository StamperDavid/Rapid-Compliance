/**
 * Shot Doc — the cinematic, film-studio "production sheet" view.
 *
 * LAYOUT-DRIVEN (Jun 19 2026 rebuild): the page composition is AUTHORED BY THE AI.
 * The Shot Plan Planner emits `plan.layout` — an ordered stack of rows, each row a
 * set of blocks carrying relative width/height weights. This renderer is a generic
 * PAINTER: it lays the body out as a FIXED LANDSCAPE canvas (1920×1280 = 3:2),
 * distributes the AI's rows down that canvas by their `heightWeight` (fr units), and
 * inside each row distributes the blocks across by their `widthWeight` (fr units).
 * Each block is drawn by its `type` via `renderBlock`, which reuses the per-section
 * content renderers (cast columns, environment heroes, the editable floor plan, the
 * storyboard strip, the look-bible field columns, palette, prompt).
 *
 * So the page is EXACTLY the AI's composition stretched to fill a landscape sheet —
 * never a hard-coded vertical template. When `plan.layout` is absent or has no rows,
 * a sensible `DEFAULT_LAYOUT` covers the content-bearing blocks. Empty blocks (no
 * data for this plan) are dropped, and a row whose blocks are all empty is dropped
 * entirely, so the AI's layout never produces a blank panel.
 *
 * Light "production-paper" skin (stone/amber, no raw hex; palette swatches use the
 * dynamic computed colour, the sanctioned inline exception). Each block keeps its
 * Edit button mapped to the right section editor.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Clapperboard, Link2, Scissors, Pencil, ImageOff, Maximize, UserPlus, Check, Loader2 } from 'lucide-react';

import { FloorPlanCanvas } from './FloorPlanCanvas';
import { composeShotGenerationPrompt } from '@/lib/video/shot-plan-mapping';
import type {
  ShotPlan,
  ShotPlanShot,
  ShotPlanCastMember,
  ShotPlanLayout,
  ShotPlanLayoutRow,
  ShotPlanBlockType,
} from '@/types/shot-plan';

/** Which section's editor to open when a section is clicked. */
export type ShotPlanSection = 'shared' | 'characters' | 'environment' | 'lighting' | 'floorplan' | 'storyboard';

interface ShotPlanDocumentProps {
  plan: ShotPlan;
  /** Open the per-shot editor for a shot (storyboard panel click). */
  onEdit: (shotId: string) => void;
  /** Open the editor for a whole section (section header / block click). */
  onEditSection: (section: ShotPlanSection) => void;
  /**
   * One-click "Add to Character Library" for a single cast member. Optional — when
   * omitted (e.g. the read-only review render) no button is shown. Resolves with
   * `{ ok }` (and `alreadySaved` when the character was already in the library).
   */
  onSaveCharacterToLibrary?: (
    member: ShotPlanCastMember,
  ) => Promise<{ ok: boolean; alreadySaved?: boolean; error?: string }>;
}

/** The labeled views to show for a subject (model sheet, or refs as a fallback). */
function subjectViews(member: ShotPlanCastMember): { label: string; imageUrl: string }[] {
  if (member.modelSheet && member.modelSheet.length > 0) {
    return member.modelSheet;
  }
  return member.referenceImageUrls.map((url) => ({ label: 'REF', imageUrl: url }));
}

/** True when any of the given values is a non-empty (trimmed) string. */
function filled(...values: Array<string | undefined>): boolean {
  return values.some((v) => typeof v === 'string' && v.trim() !== '');
}

// ── Atoms ────────────────────────────────────────────────────────────────────

/** An edge-to-edge image cell: the image fills the cell (object-cover), with an
 *  optional tiny caption underneath. No card margin/rounding. Pass a fixed `aspect`
 *  for a natural-height tile, or `fill` to consume the full height of its parent
 *  (so the image stretches to remove blank space in a tall layout cell). */
function Cell({
  src,
  alt,
  caption,
  aspect,
  fill,
}: {
  src?: string;
  alt: string;
  caption?: string;
  aspect?: string;
  fill?: boolean;
}) {
  return (
    <figure className={`min-w-0${fill ? ' flex h-full min-h-0 flex-col' : ''}`}>
      <div
        className={`relative w-full overflow-hidden border border-stone-300 bg-stone-200 ${
          fill ? 'min-h-0 flex-1' : aspect ?? 'aspect-video'
        }`}
      >
        {src ? (
          <Image src={src} alt={alt} fill sizes="320px" unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-stone-400">
            <ImageOff className="h-5 w-5" />
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="truncate pt-0.5 text-center text-[8px] font-bold uppercase tracking-[0.1em] text-stone-500" title={caption}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) {
    return null;
  }
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-500">{label}</div>
      <div className="text-xs leading-snug text-stone-800" title={value}>{value}</div>
    </div>
  );
}

function IdentityStrip({ member }: { member: ShotPlanCastMember }) {
  const hair = [member.hairColor, member.hairStyle]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))
    .join(' ');
  const bits = [member.apparentAge, member.build, hair]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  const wardrobe = member.wardrobe?.trim();
  const all = [...bits, wardrobe].filter(Boolean).join(' · ');
  if (!all) {
    return null;
  }
  return <div className="truncate text-[10px] leading-snug text-stone-600" title={all}>{all}</div>;
}

function PaletteRow({ swatches }: { swatches: { name: string; hex: string }[] }) {
  if (swatches.length === 0) {
    return <span className="text-xs text-stone-400">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1">
      {swatches.slice(0, 12).map((sw, i) => (
        <span
          key={`${sw.hex}-${i}`}
          title={`${sw.name} (${sw.hex})`}
          className="h-7 w-7 rounded-sm border border-stone-300"
          style={{ backgroundColor: sw.hex }}
        />
      ))}
    </div>
  );
}

function HeaderMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-500">{label}</div>
      <div className="text-xs text-stone-800" title={value}>{value}</div>
    </div>
  );
}

/** A storyboard frame — edge-to-edge, click to edit. */
function StoryboardFrame({ shot, position, onEdit }: { shot: ShotPlanShot; position: number; onEdit: () => void }) {
  const still = shot.generated?.keyframeUrl ?? shot.generated?.lastFrameUrl ?? null;
  const specs = [shot.camera.shotType, shot.camera.movement, shot.camera.lensType ?? shot.camera.lens ?? shot.camera.focalLength]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  return (
    <button
      type="button"
      onClick={onEdit}
      className="group relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-stone-300 bg-white text-left transition-colors hover:border-amber-600/70"
    >
      <div className="relative min-h-0 w-full flex-1 bg-stone-200">
        {still ? (
          <Image src={still} alt={`Cut ${position + 1}`} fill sizes="320px" unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-400"><ImageOff className="h-5 w-5" /></div>
        )}
        <div className="absolute left-1 top-1 flex items-center gap-1">
          <span className="rounded-sm bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-amber-300">{position + 1}</span>
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-black/80 px-1 py-0.5 text-[9px] uppercase tracking-wide text-white">
            {shot.transitionIn === 'continue' ? (<><Link2 className="h-2.5 w-2.5 text-amber-300" /> cont</>) : (<><Scissors className="h-2.5 w-2.5 text-amber-300" /> cut</>)}
          </span>
        </div>
        <span className="absolute right-1 top-1 rounded-sm bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Pencil className="h-3 w-3" />
        </span>
      </div>
      <div className="space-y-0.5 border-t border-stone-200 p-1.5">
        <div className="truncate font-mono text-[9px] uppercase tracking-wide text-amber-700">
          {specs.length > 0 ? specs.join(' · ') : 'camera —'} · {shot.durationSeconds}s
        </div>
        <div className="line-clamp-2 text-[10px] leading-snug text-stone-700">
          {shot.action?.trim() || shot.title?.trim() || 'Untitled shot'}
        </div>
      </div>
    </button>
  );
}

// ── Layout primitives ────────────────────────────────────────────────────────

/** Inline style for an N-column edge-to-edge grid. */
function cols(n: number): React.CSSProperties {
  return { gridTemplateColumns: `repeat(${Math.max(1, n)}, minmax(0, 1fr))` };
}

/** A default section heading per block type, used when the AI omits `block.title`. */
const DEFAULT_BLOCK_TITLE: Record<ShotPlanBlockType, string> = {
  characters: 'Character Reference',
  environment: 'Environment / Set Design',
  floorplan: 'Floor Plan · Camera Blocking',
  storyboard: 'Storyboard',
  lighting: 'Lighting Setups',
  cinematography: 'Cinematography · Look',
  mood: 'Mood & Notes',
  palette: 'Color Palette',
  notes: 'Character Notes',
  prompt: 'Video Prompt',
};

/** Which section editor a block type opens, or `null` for non-editable blocks. */
const BLOCK_EDIT_SECTION: Record<ShotPlanBlockType, ShotPlanSection | null> = {
  characters: 'characters',
  notes: 'characters',
  environment: 'environment',
  floorplan: 'floorplan',
  lighting: 'lighting',
  cinematography: 'lighting',
  mood: 'lighting',
  palette: 'lighting',
  storyboard: 'storyboard',
  prompt: null,
};

/**
 * The fallback page composition when the AI did not author a `layout`. Covers the
 * content-bearing blocks in a landscape-friendly stack: a characters|environment
 * row, a four-up look-bible row, the floor plan, the storyboard strip, and the
 * assembled prompt.
 */
const DEFAULT_LAYOUT: ShotPlanLayout = {
  rows: [
    {
      heightWeight: 3,
      blocks: [
        { type: 'characters', widthWeight: 3 },
        { type: 'environment', widthWeight: 2 },
      ],
    },
    {
      heightWeight: 2,
      blocks: [
        { type: 'lighting', widthWeight: 1 },
        { type: 'cinematography', widthWeight: 1 },
        { type: 'mood', widthWeight: 1 },
        { type: 'palette', widthWeight: 1 },
      ],
    },
    {
      heightWeight: 3,
      blocks: [
        { type: 'floorplan', widthWeight: 3 },
        { type: 'notes', widthWeight: 2 },
      ],
    },
    {
      heightWeight: 3,
      blocks: [{ type: 'storyboard', widthWeight: 1 }],
    },
    {
      heightWeight: 2,
      blocks: [{ type: 'prompt', widthWeight: 1 }],
    },
  ],
};

// ── The document ───────────────────────────────────────────────────────────────

/**
 * In-place scroll-to-zoom for the read-only blocking diagram. The operator scrolls
 * over the diagram to magnify it WITHOUT leaving the shot doc (no popup). The doc's
 * ZoomPanViewport pans on wheel via a native, non-passive listener, so this uses its
 * own native non-passive wheel listener that `stopPropagation`s — scrolling over the
 * diagram zooms IT and never pans the sheet. Drag pans once zoomed in.
 */
function BlockingZoom({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const onWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setScale((s) => {
        const next = Math.min(5, Math.max(1, Math.round((s + (e.deltaY < 0 ? 0.3 : -0.3)) * 100) / 100));
        if (next === 1) {
          setPan({ x: 0, y: 0 });
        }
        return next;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (scale <= 1) {
      return;
    }
    drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) {
      return;
    }
    setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) });
  };
  const endDrag = () => {
    drag.current = null;
  };

  return (
    <div
      ref={ref}
      data-no-pan
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      className="relative h-full w-full overflow-hidden"
      style={{ cursor: scale > 1 ? 'grab' : 'default' }}
    >
      <div
        className="h-full w-full"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`, transformOrigin: 'center center' }}
      >
        {children}
      </div>
      <div
        data-no-pan
        className="pointer-events-none absolute bottom-1 left-1 z-10 rounded bg-white/85 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-stone-500"
      >
        Scroll to zoom{scale > 1 ? ` · ${Math.round(scale * 100)}%` : ''}
      </div>
      {scale > 1 && (
        <button
          type="button"
          data-no-pan
          onClick={() => {
            setScale(1);
            setPan({ x: 0, y: 0 });
          }}
          title="Reset zoom"
          className="absolute right-1 top-1 z-10 inline-flex items-center gap-1 rounded border border-stone-300 bg-white/90 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-stone-600 transition-colors hover:border-amber-600 hover:text-amber-700"
        >
          <Maximize className="h-3 w-3" /> Reset
        </button>
      )}
    </div>
  );
}

export function ShotPlanDocument({ plan, onEdit, onEditSection, onSaveCharacterToLibrary }: ShotPlanDocumentProps) {
  const { sharedChoices } = plan;
  const look = sharedChoices.lookBible ?? {};
  const orderedShots = [...plan.shots].sort((a, b) => a.index - b.index);

  // Per-character "Add to Character Library" state, keyed by characterId.
  const [libSave, setLibSave] = useState<Record<string, 'idle' | 'saving' | 'saved' | 'error'>>({});
  const handleAddToCharacterLibrary = async (member: ShotPlanCastMember): Promise<void> => {
    if (!onSaveCharacterToLibrary) {
      return;
    }
    setLibSave((s) => ({ ...s, [member.characterId]: 'saving' }));
    try {
      const res = await onSaveCharacterToLibrary(member);
      setLibSave((s) => ({ ...s, [member.characterId]: res.ok ? 'saved' : 'error' }));
    } catch {
      setLibSave((s) => ({ ...s, [member.characterId]: 'error' }));
    }
  };
  const objects = sharedChoices.objects ?? [];
  const envImages = sharedChoices.environmentReferenceImageUrls ?? [];
  const zones = sharedChoices.environmentZones ?? [];
  const heroFallback = sharedChoices.environmentHeroImageUrl;
  const billingRank = (m: ShotPlanCastMember): number => (m.billing === 'lead' ? 0 : m.billing === 'supporting' ? 1 : 2);
  const subjects = [...sharedChoices.cast]
    .map((member, i) => ({ member, i }))
    .sort((a, b) => billingRank(a.member) - billingRank(b.member) || a.i - b.i)
    .map((e) => e.member);

  const lensValue = look.lensType ?? look.focalLength;
  const dpStyle = look.videographerStyle ?? look.photographerStyle;
  const tempValue = typeof look.temperature === 'number' ? `${look.temperature}K` : undefined;
  const framingBits = [
    look.shotType,
    look.viewingDirection ? look.viewingDirection.replace(/-/g, ' ') : undefined,
    look.subjectUnawareOfCamera ? 'candid (unaware of camera)' : undefined,
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  const videoPrompt = orderedShots[0] ? composeShotGenerationPrompt(plan, orderedShots[0]) : '';

  // ── Per-block presence flags (the empty-block guard). A block only renders if
  //    it actually carries content for THIS plan. ───────────────────────────────
  const lightingSwatches = sharedChoices.lightingSwatches ?? [];
  const hasCharacters = subjects.length > 0;
  const hasEnvironment =
    zones.length > 0 || Boolean(heroFallback) || envImages.length > 0 || Boolean(sharedChoices.environmentFingerprint?.trim());
  const establishingHero = heroFallback ?? zones.find((z) => z.heroImageUrl)?.heroImageUrl;
  const hasFloorplan = Boolean(
    plan.floorPlan &&
      ((plan.floorPlan.cameras?.length ?? 0) > 0 ||
        (plan.floorPlan.elements?.length ?? 0) > 0 ||
        (plan.floorPlan.subjectPaths?.length ?? 0) > 0 ||
        plan.floorPlan.backdropImageUrl),
  );
  const showBlocking = hasFloorplan || Boolean(establishingHero) || Boolean(plan.floorPlan);
  const hasLightingFields = lightingSwatches.length > 0 || filled(look.lighting, look.atmosphere) || typeof look.temperature === 'number' || (look.filters?.length ?? 0) > 0;
  const hasCamera = filled(look.camera, lensValue, look.composition, look.aspectRatio) || framingBits.length > 0;
  const hasStyle = filled(look.artStyle, sharedChoices.artStyle, look.movieLook, look.filmStock, dpStyle);
  const hasCinematography = hasCamera || hasStyle;
  const hasMoodTags = sharedChoices.moodKeywords.length > 0;
  const hasNotes = sharedChoices.cinematographyNotes.length > 0;
  const hasMood = hasMoodTags || hasNotes;
  const hasPalette = sharedChoices.colorPalette.length > 0;
  const hasObjects = objects.length > 0;
  const hasStoryboard = orderedShots.length > 0;
  const hasPrompt = orderedShots.length > 0;

  /** True when a block of `type` carries content for this plan. */
  const blockHasContent = (type: ShotPlanBlockType): boolean => {
    switch (type) {
      case 'characters':
        return hasCharacters || hasObjects || hasPalette;
      case 'environment':
        return hasEnvironment;
      case 'floorplan':
        return showBlocking;
      case 'storyboard':
        return hasStoryboard;
      case 'lighting':
        return hasLightingFields;
      case 'cinematography':
        return hasCinematography;
      case 'mood':
        return hasMood;
      case 'palette':
        return hasPalette;
      case 'notes':
        return hasNotes || hasObjects;
      case 'prompt':
        return hasPrompt;
      default:
        return false;
    }
  };

  // ── Per-block-type content renderers (reuse of the old per-Section JSX). ──────

  /** Cast columns + object study + palette. Each character is a HERO image with a
   *  small thumbnail row of its remaining views beneath, so the cast reads like a
   *  call sheet — one prominent portrait per actor, not an equal-size view grid. */
  const renderCharacters = (): React.ReactNode => (
    // min-h-full (not h-full) lets the cast grow past the cell so the block's own
    // overflow-y-auto scrolls it — instead of the grid compressing and its content
    // spilling onto the costume/prop and palette rows below (the overlap bug).
    <div className="flex min-h-full flex-col gap-3">
      {subjects.length > 0 && (
        <div className="grid min-h-0 flex-1 items-stretch gap-2" style={cols(Math.min(Math.max(subjects.length, 1), 5))}>
          {subjects.map((member, mi) => {
            const views = subjectViews(member);
            const notes = (member.notes ?? '').trim();
            const tier = member.billing === 'lead' ? 'Lead' : member.billing === 'supporting' ? 'Support' : null;
            // The first view is the hero (front turnaround); the rest become a thin
            // thumbnail strip beneath it. With no views, show a single placeholder hero.
            const hero = views[0];
            const thumbs = views.slice(1, 5);
            const tn = Math.min(Math.max(thumbs.length, 1), 4);
            // Key includes the index — the AI can emit duplicate cast characterIds.
            return (
              <div key={`${member.characterId}-${mi}`} className="flex h-full min-h-0 min-w-0 flex-col">
                <div className="mb-1 flex shrink-0 flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-stone-900">{member.name}</span>
                  {member.role && <span className="truncate text-[9px] uppercase tracking-wider text-amber-700">{member.role}</span>}
                  {tier && <span className="rounded-sm bg-stone-200 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-stone-500">{tier}</span>}
                </div>
                <Cell
                  src={hero?.imageUrl}
                  alt={hero ? `${member.name} ${hero.label}` : 'generating'}
                  caption={hero?.label}
                  fill
                />
                {thumbs.length > 0 && (
                  <div className="mt-0.5 grid shrink-0 gap-0.5" style={cols(tn)}>
                    {thumbs.map((v, i) => (
                      <Cell key={`${v.imageUrl}-${i}`} src={v.imageUrl} alt={`${member.name} ${v.label}`} caption={v.label} aspect="aspect-[3/4]" />
                    ))}
                  </div>
                )}
                <div className="mt-1 shrink-0"><IdentityStrip member={member} /></div>
                {notes && <p className="mt-0.5 line-clamp-3 shrink-0 text-[10px] leading-snug text-stone-600">{notes}</p>}
                {onSaveCharacterToLibrary && hero?.imageUrl && (
                  <button
                    type="button"
                    data-no-pan
                    onClick={() => void handleAddToCharacterLibrary(member)}
                    disabled={libSave[member.characterId] === 'saving' || libSave[member.characterId] === 'saved'}
                    title="Add this character to your Character Library — reuses the images already generated for this doc"
                    className="mt-1 inline-flex shrink-0 items-center justify-center gap-1 rounded border border-stone-300 px-2 py-1 text-[9px] font-medium uppercase tracking-wider text-stone-600 transition-colors hover:border-amber-600/60 hover:text-amber-700 disabled:opacity-70"
                  >
                    {libSave[member.characterId] === 'saving' ? (
                      <><Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden /> Saving…</>
                    ) : libSave[member.characterId] === 'saved' ? (
                      <><Check className="h-2.5 w-2.5 text-green-600" aria-hidden /> In your library</>
                    ) : libSave[member.characterId] === 'error' ? (
                      <><UserPlus className="h-2.5 w-2.5" aria-hidden /> Couldn&apos;t save — retry</>
                    ) : (
                      <><UserPlus className="h-2.5 w-2.5" aria-hidden /> Add to Character Library</>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {objects.length > 0 && (
        <div className="shrink-0">
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-stone-500">Costume &amp; Prop Study</div>
          {/* A thin band of SMALL captioned thumbnails — never a featured grid. The
              row is left-aligned and the thumbs are width-capped so they stay small
              regardless of count, so the props never compete with the cast above. */}
          <div className="flex flex-wrap gap-1.5">
            {objects.slice(0, 12).map((obj, oi) => (
              <div key={`${obj.id}-${oi}`} className="w-16 shrink-0">
                <Cell src={obj.referenceImageUrls[0]} alt={obj.name} caption={obj.name} aspect="aspect-square" />
              </div>
            ))}
          </div>
        </div>
      )}

      {sharedChoices.colorPalette.length > 0 && (
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-stone-500">Palette</span>
          <PaletteRow swatches={sharedChoices.colorPalette} />
        </div>
      )}
    </div>
  );

  /** Environment hero(es) per zone + reference strip — heroes fill the cell. */
  const renderEnvironment = (): React.ReactNode => {
    const envCellCount = zones.length > 0 ? zones.length : 1;
    return (
      <div className="flex h-full min-h-0 flex-col gap-1.5">
        <div className="grid min-h-0 flex-1 items-stretch gap-1" style={cols(envCellCount)}>
          {(zones.length > 0
            ? zones.map((zone, zi) => ({ id: zone.id, label: zone.label, hero: zone.heroImageUrl ?? (zi === 0 ? heroFallback : undefined), setDesign: zone.setDesign }))
            : [{ id: 'env', label: `EXT. — ${(sharedChoices.environmentFingerprint || 'Environment').slice(0, 60)}`, hero: heroFallback, setDesign: undefined as string[] | undefined }]
          ).map((z, zix) => (
            <div key={`${z.id}-${zix}`} className="flex h-full min-h-0 min-w-0 flex-col">
              <Cell src={z.hero} alt={z.label} caption={z.label} fill />
              {z.setDesign && z.setDesign.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 marker:text-amber-600/60">
                  {z.setDesign.slice(0, 4).map((item, i) => (<li key={i} className="line-clamp-1 text-[9px] leading-snug text-stone-600" title={item}>{item}</li>))}
                </ul>
              )}
            </div>
          ))}
        </div>
        {envImages.length > 0 && (
          <div className="grid shrink-0 gap-1" style={cols(Math.min(Math.max(envImages.length, 1), 8))}>
            {envImages.slice(0, 8).map((url, i) => (<Cell key={`${url}-${i}`} src={url} alt={`Reference ${i + 1}`} aspect="aspect-video" />))}
          </div>
        )}
      </div>
    );
  };

  /** Read-only overhead camera map + establishing render. The map is a fully-visible
   *  document view (no toolbar, fit-to-container); editing happens in the section
   *  popup via the Edit button, so the document never mutates the plan inline. */
  const renderFloorplan = (): React.ReactNode => (
    <div className="grid h-full min-h-0 grid-cols-[3fr_2fr] gap-3">
      <div data-no-pan className="flex h-full min-h-0 min-w-0 flex-col">
        <div className="mb-1 shrink-0 text-[8px] font-bold uppercase tracking-[0.12em] text-stone-500">Overhead camera blocking</div>
        <div className="min-h-0 flex-1 overflow-hidden rounded border border-stone-300 bg-white">
          <BlockingZoom>
            <FloorPlanCanvas
              floorPlan={plan.floorPlan}
              shots={orderedShots.map((s) => ({ id: s.id, index: s.index, title: s.title }))}
              cast={sharedChoices.cast.map((c) => ({ characterId: c.characterId, name: c.name }))}
              objects={objects.map((o) => ({ id: o.id, name: o.name }))}
              readOnly
            />
          </BlockingZoom>
        </div>
      </div>
      <div className="flex h-full min-h-0 min-w-0 flex-col">
        <div className="mb-1 shrink-0 text-[8px] font-bold uppercase tracking-[0.12em] text-stone-500">Establishing shot — how the scene reads</div>
        <Cell src={establishingHero} alt="Establishing shot" fill />
      </div>
    </div>
  );

  /** The ordered storyboard strip — frames stretch to fill the cell height. */
  const renderStoryboard = (): React.ReactNode => (
    <div className="grid h-full min-h-0 gap-1" style={cols(Math.min(Math.max(orderedShots.length, 1), 6))}>
      {orderedShots.map((shot, i) => (<StoryboardFrame key={shot.id} shot={shot} position={i} onEdit={() => onEdit(shot.id)} />))}
    </div>
  );

  /** Lighting swatches + the lighting/atmosphere field column. */
  const renderLighting = (): React.ReactNode => (
    <div className="space-y-3">
      {lightingSwatches.length > 0 && (
        <div className="grid gap-1" style={cols(Math.min(Math.max(lightingSwatches.length, 1), 8))}>
          {lightingSwatches.slice(0, 8).map((sw, i) => (
            <Cell key={`${sw.imageUrl}-${i}`} src={sw.imageUrl} alt={sw.label} caption={sw.label} aspect="aspect-square" />
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">Lighting &amp; atmosphere</div>
        <Field label="Base lighting" value={look.lighting} />
        <Field label="Atmosphere" value={look.atmosphere} />
        <Field label="Color temperature" value={tempValue} />
        <Field label="Filters / grade" value={look.filters && look.filters.length > 0 ? look.filters.join(', ') : undefined} />
      </div>
    </div>
  );

  /** Camera + look/style field columns. */
  const renderCinematography = (): React.ReactNode => (
    <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
      {hasCamera && (
        <div className="space-y-1.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">Camera &amp; lens</div>
          <Field label="Camera body" value={look.camera} />
          <Field label="Lens / focal" value={lensValue} />
          <Field label="Framing" value={framingBits.length > 0 ? framingBits.join(' · ') : undefined} />
          <Field label="Composition" value={look.composition} />
          <Field label="Aspect ratio" value={look.aspectRatio} />
        </div>
      )}
      {hasStyle && (
        <div className="space-y-1.5">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">Look &amp; style</div>
          <Field label="Art style" value={look.artStyle ?? sharedChoices.artStyle} />
          <Field label="Movie look" value={look.movieLook} />
          <Field label="Film stock" value={look.filmStock} />
          <Field label="DP style" value={dpStyle} />
        </div>
      )}
    </div>
  );

  /** Mood keyword tags + cinematography notes. */
  const renderMood = (): React.ReactNode => (
    <div className="space-y-1.5">
      {hasMoodTags && (
        <div className="flex flex-wrap gap-1">
          {sharedChoices.moodKeywords.map((k) => (
            <span key={k} className="rounded-sm border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-700">{k}</span>
          ))}
        </div>
      )}
      {hasNotes && (
        <ul className="list-disc space-y-0.5 pl-4 marker:text-amber-600/60">
          {sharedChoices.cinematographyNotes.slice(0, 8).map((note, i) => (<li key={i} className="text-[11px] leading-snug text-stone-700">{note}</li>))}
        </ul>
      )}
    </div>
  );

  /** Color palette swatches. */
  const renderPalette = (): React.ReactNode => (
    <PaletteRow swatches={sharedChoices.colorPalette} />
  );

  /** Character / continuity notes — the per-character identity + notes column. */
  const renderNotes = (): React.ReactNode => (
    <div className="space-y-2">
      {subjects.map((member, mi) => {
        const notes = (member.notes ?? '').trim();
        return (
          <div key={`${member.characterId}-${mi}`} className="min-w-0 border-b border-stone-200 pb-1.5 last:border-b-0">
            <div className="text-[11px] font-bold uppercase tracking-wider text-stone-900">{member.name}</div>
            <IdentityStrip member={member} />
            {notes && <p className="mt-0.5 text-[10px] leading-snug text-stone-600">{notes}</p>}
          </div>
        );
      })}
      {sharedChoices.cinematographyNotes.length > 0 && (
        <ul className="list-disc space-y-0.5 pl-4 marker:text-amber-600/60">
          {sharedChoices.cinematographyNotes.slice(0, 8).map((note, i) => (<li key={i} className="text-[11px] leading-snug text-stone-700">{note}</li>))}
        </ul>
      )}
    </div>
  );

  /** The assembled opening-shot video prompt. */
  const renderPrompt = (): React.ReactNode => (
    <div>
      <div className="mb-1 flex items-center gap-2">
        <Clapperboard className="h-3.5 w-3.5 text-amber-700" />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-500">Assembled video prompt — opening shot</span>
      </div>
      <p className="font-mono text-[11px] leading-relaxed text-stone-700">{videoPrompt || '—'}</p>
    </div>
  );

  /**
   * Render a block's content by type. Text-heavy blocks let their content scroll
   * inside the cell; image/floorplan blocks fit the cell.
   */
  const renderBlock = (type: ShotPlanBlockType): React.ReactNode => {
    switch (type) {
      case 'characters':
        return renderCharacters();
      case 'environment':
        return renderEnvironment();
      case 'floorplan':
        return renderFloorplan();
      case 'storyboard':
        return renderStoryboard();
      case 'lighting':
        return renderLighting();
      case 'cinematography':
        return renderCinematography();
      case 'mood':
        return renderMood();
      case 'palette':
        return renderPalette();
      case 'notes':
        return renderNotes();
      case 'prompt':
        return renderPrompt();
      default:
        return null;
    }
  };

  /** Text-heavy blocks scroll their content inside the cell rather than overflow it.
   *  'characters' is included because a full cast (grid + costume/prop study +
   *  palette) can exceed its cell — without a scroll it would spill onto and overlap
   *  the neighboring blocks instead of staying inside its own bounds. */
  const isScrollableBlock = (type: ShotPlanBlockType): boolean =>
    type === 'characters' ||
    type === 'cinematography' ||
    type === 'mood' ||
    type === 'notes' ||
    type === 'prompt' ||
    type === 'palette';

  // ── Build the painted rows from the AI's layout (with empty-block/row drops). ─
  // The AI designs the composition (which blocks, their order and arrangement);
  // the guardrails below are usability FLOORS applied to every layout so the sheet
  // is always editable and never wastes space — the parity floor, enforced.
  const layout = plan.layout && plan.layout.rows.length > 0 ? plan.layout : DEFAULT_LAYOUT;
  const hasCharactersBlock =
    blockHasContent('characters') && layout.rows.some((r) => r.blocks.some((b) => b.type === 'characters'));
  const baseRows: ShotPlanLayoutRow[] = layout.rows
    .map((row) => ({
      ...row,
      // Character notes and the palette already render INSIDE the characters block.
      // A standalone notes/palette block just duplicates them and lets a one-swatch
      // "color arc" claim a whole cell — so when a cast block exists, drop the
      // redundant standalones. Notes therefore always stay WITH the characters.
      blocks: row.blocks.filter(
        (b) => blockHasContent(b.type) && !(hasCharactersBlock && (b.type === 'notes' || b.type === 'palette')),
      ),
    }))
    .filter((row) => row.blocks.length > 0);

  // The blocking diagram is an interactive tool the operator edits — it must always
  // render large enough to read and use. These are READABILITY FLOORS, not a fixed
  // shape: they guarantee the floorplan never becomes an unusable sliver, but they
  // RESPECT the layout the AI authored. The old floors (1.6× width, 0.32 height) forced
  // every floorplan to dominate the page, which made every shot doc look the same. The
  // softer floors below (≥1/3 of its row's width, ≥18% of page height) keep it readable
  // while letting an AI-authored small/shared floorplan stay small and a big one stay big
  // — so layouts actually vary with the story.
  const totalHeightWeight = baseRows.reduce((s, r) => s + r.heightWeight, 0) || 1;
  const renderRows: ShotPlanLayoutRow[] = baseRows.map((row) => {
    const floorIdx = row.blocks.findIndex((b) => b.type === 'floorplan');
    if (floorIdx !== -1) {
      const others = row.blocks.reduce((s, b, i) => (i === floorIdx ? s : s + b.widthWeight), 0);
      const blocks = row.blocks.map((b, i) =>
        i === floorIdx ? { ...b, widthWeight: Math.max(b.widthWeight, (others || 1) * 0.5) } : b,
      );
      return { ...row, blocks, heightWeight: Math.max(row.heightWeight, totalHeightWeight * 0.18) };
    }
    // The assembled prompt is a thin row, but it must still show ~2–3 lines (then
    // scroll) — floor its height so it can't be squeezed to nothing by taller rows.
    if (row.blocks.some((b) => b.type === 'prompt')) {
      return { ...row, heightWeight: Math.max(row.heightWeight, totalHeightWeight * 0.08) };
    }
    return row;
  });

  return (
    <div className="flex w-[1920px] flex-col overflow-hidden rounded-xl border border-stone-300 bg-stone-100 text-stone-800 shadow-2xl">
      {/* Header chrome */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-stone-300 bg-gradient-to-b from-white to-stone-100 px-6 py-3">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-700">Shot Doc</span>
        <span className="text-[10px] uppercase tracking-wider text-stone-500">{plan.title || 'Untitled production'}</span>
        <HeaderMeta label="Cuts" value={String(orderedShots.length)} />
        {sharedChoices.timePeriod?.trim() && <HeaderMeta label="Period" value={sharedChoices.timePeriod} />}
        {sharedChoices.genre?.trim() && <HeaderMeta label="Genre" value={sharedChoices.genre} />}
        <div className="min-w-[160px] flex-1">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-stone-500">Environment</div>
          <div className="line-clamp-1 text-[11px] text-stone-700">{sharedChoices.environmentFingerprint || '—'}</div>
        </div>
        <button
          type="button"
          onClick={() => onEditSection('shared')}
          className="inline-flex items-center gap-1 rounded border border-stone-300 px-2 py-1 text-[10px] uppercase tracking-wider text-stone-600 transition-colors hover:border-amber-600/60 hover:text-amber-700"
          data-no-pan
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>

      {/* ── LANDSCAPE LAYOUT BODY — a fixed 1920×1280 (3:2) sheet. The AI's rows
           fill the height by `heightWeight`; each row's blocks fill the width by
           `widthWeight`. The page is exactly the AI's composition, stretched. ── */}
      {renderRows.length > 0 && (
        <div
          className="grid min-h-0"
          style={{ height: '1280px', gridTemplateRows: renderRows.map((r) => `${r.heightWeight}fr`).join(' ') }}
        >
          {renderRows.map((row, ri) => (
            <div
              key={ri}
              className="grid min-h-0 border-t border-stone-300 first:border-t-0"
              style={{ gridTemplateColumns: row.blocks.map((b) => `${b.widthWeight}fr`).join(' ') }}
            >
              {row.blocks.map((block, bi) => {
                const editSection = BLOCK_EDIT_SECTION[block.type];
                const customTitle = block.title?.trim();
                const heading = customTitle && customTitle.length > 0 ? customTitle : DEFAULT_BLOCK_TITLE[block.type];
                return (
                  <section
                    key={`${block.type}-${bi}`}
                    className="flex min-h-0 min-w-0 flex-col border-l border-stone-300 px-4 py-3 first:border-l-0"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-700">{heading}</h3>
                      {editSection && (
                        <button
                          type="button"
                          onClick={() => onEditSection(editSection)}
                          className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-stone-300 px-2 py-0.5 text-[9px] uppercase tracking-wider text-stone-500 transition-colors hover:border-amber-600/60 hover:text-amber-700"
                          data-no-pan
                        >
                          <Pencil className="h-2.5 w-2.5" /> Edit
                        </button>
                      )}
                    </div>
                    <div
                      className={`min-h-0 min-w-0 flex-1 overflow-hidden${
                        isScrollableBlock(block.type) ? ' overflow-y-auto' : ''
                      }`}
                    >
                      {renderBlock(block.type)}
                    </div>
                  </section>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
