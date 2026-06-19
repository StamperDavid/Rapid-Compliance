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

import Image from 'next/image';
import { Clapperboard, Link2, Scissors, Pencil, ImageOff } from 'lucide-react';

import { FloorPlanCanvas } from './FloorPlanCanvas';
import { composeShotGenerationPrompt } from '@/lib/video/shot-plan-mapping';
import type {
  ShotPlan,
  ShotPlanShot,
  ShotPlanFloorPlan,
  ShotPlanCastMember,
  ShotPlanLayout,
  ShotPlanLayoutRow,
  ShotPlanBlockType,
} from '@/types/shot-plan';

/** Which section's editor to open when a section is clicked. */
export type ShotPlanSection = 'shared' | 'characters' | 'environment' | 'lighting';

interface ShotPlanDocumentProps {
  plan: ShotPlan;
  /** Open the per-shot editor for a shot (storyboard panel click). */
  onEdit: (shotId: string) => void;
  /** Open the editor for a whole section (section header / block click). */
  onEditSection: (section: ShotPlanSection) => void;
  /** Floor plan is editable inline on the document (drag), committed via this. */
  onFloorPlanChange: (floorPlan: ShotPlanFloorPlan) => void;
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

/** An edge-to-edge image cell: the image fills the cell (object-cover), uniform
 *  aspect, with an optional tiny caption underneath. No card margin/rounding. */
function Cell({
  src,
  alt,
  caption,
  aspect,
}: {
  src?: string;
  alt: string;
  caption?: string;
  aspect: string;
}) {
  return (
    <figure className="min-w-0">
      <div className={`relative ${aspect} w-full overflow-hidden border border-stone-300 bg-stone-200`}>
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
      className="group relative flex min-w-0 flex-col overflow-hidden border border-stone-300 bg-white text-left transition-colors hover:border-amber-600/70"
    >
      <div className="relative aspect-video w-full bg-stone-200">
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
  floorplan: 'environment',
  lighting: 'lighting',
  cinematography: 'lighting',
  mood: 'lighting',
  palette: 'lighting',
  storyboard: null,
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

export function ShotPlanDocument({ plan, onEdit, onEditSection, onFloorPlanChange }: ShotPlanDocumentProps) {
  const { sharedChoices } = plan;
  const look = sharedChoices.lookBible ?? {};
  const orderedShots = [...plan.shots].sort((a, b) => a.index - b.index);
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

  /** Cast columns + object study + palette. */
  const renderCharacters = (): React.ReactNode => (
    <div className="space-y-3">
      {subjects.length > 0 && (
        <div className="grid items-start gap-2" style={cols(Math.min(Math.max(subjects.length, 1), 5))}>
          {subjects.map((member) => {
            const views = subjectViews(member);
            const notes = (member.notes ?? '').trim();
            const tier = member.billing === 'lead' ? 'Lead' : member.billing === 'supporting' ? 'Support' : null;
            const vn = Math.min(Math.max(views.length, 1), 5);
            return (
              <div key={member.characterId} className="min-w-0">
                <div className="mb-1 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                  <span className="text-[12px] font-bold uppercase tracking-wider text-stone-900">{member.name}</span>
                  {member.role && <span className="truncate text-[9px] uppercase tracking-wider text-amber-700">{member.role}</span>}
                  {tier && <span className="rounded-sm bg-stone-200 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-stone-500">{tier}</span>}
                </div>
                {views.length > 0 ? (
                  <div className="grid gap-0.5" style={cols(vn)}>
                    {views.slice(0, 5).map((v, i) => (
                      <Cell key={`${v.imageUrl}-${i}`} src={v.imageUrl} alt={`${member.name} ${v.label}`} caption={v.label} aspect="aspect-[3/4]" />
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-0.5" style={cols(4)}>
                    {[0, 1, 2, 3].map((i) => (<Cell key={i} alt="generating" aspect="aspect-[3/4]" />))}
                  </div>
                )}
                <div className="mt-1"><IdentityStrip member={member} /></div>
                {notes && <p className="mt-0.5 line-clamp-3 text-[10px] leading-snug text-stone-600">{notes}</p>}
              </div>
            );
          })}
        </div>
      )}

      {objects.length > 0 && (
        <div>
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-stone-500">Costume &amp; Prop Study</div>
          <div className="grid gap-1" style={cols(Math.min(Math.max(objects.length, 1), 8))}>
            {objects.slice(0, 8).map((obj) => (
              <Cell key={obj.id} src={obj.referenceImageUrls[0]} alt={obj.name} caption={obj.name} aspect="aspect-square" />
            ))}
          </div>
        </div>
      )}

      {sharedChoices.colorPalette.length > 0 && (
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-stone-500">Palette</span>
          <PaletteRow swatches={sharedChoices.colorPalette} />
        </div>
      )}
    </div>
  );

  /** Environment hero(es) per zone + reference strip. */
  const renderEnvironment = (): React.ReactNode => {
    const envCellCount = zones.length > 0 ? zones.length : 1;
    return (
      <div>
        <div className="grid items-start gap-1" style={cols(envCellCount)}>
          {(zones.length > 0
            ? zones.map((zone, zi) => ({ id: zone.id, label: zone.label, hero: zone.heroImageUrl ?? (zi === 0 ? heroFallback : undefined), setDesign: zone.setDesign }))
            : [{ id: 'env', label: `EXT. — ${(sharedChoices.environmentFingerprint || 'Environment').slice(0, 60)}`, hero: heroFallback, setDesign: undefined as string[] | undefined }]
          ).map((z) => (
            <div key={z.id} className="min-w-0">
              <Cell src={z.hero} alt={z.label} caption={z.label} aspect="aspect-video" />
              {z.setDesign && z.setDesign.length > 0 && (
                <ul className="mt-1 list-disc space-y-0.5 pl-4 marker:text-amber-600/60">
                  {z.setDesign.slice(0, 4).map((item, i) => (<li key={i} className="line-clamp-1 text-[9px] leading-snug text-stone-600" title={item}>{item}</li>))}
                </ul>
              )}
            </div>
          ))}
        </div>
        {envImages.length > 0 && (
          <div className="mt-1.5 grid gap-1" style={cols(Math.min(Math.max(envImages.length, 1), 8))}>
            {envImages.slice(0, 8).map((url, i) => (<Cell key={`${url}-${i}`} src={url} alt={`Reference ${i + 1}`} aspect="aspect-video" />))}
          </div>
        )}
      </div>
    );
  };

  /** Editable overhead camera map + establishing render. Scales to its cell. */
  const renderFloorplan = (): React.ReactNode => (
    <div className="grid h-full grid-cols-[3fr_2fr] items-start gap-3">
      <div data-no-pan className="min-w-0">
        <div className="mb-1 text-[8px] font-bold uppercase tracking-[0.12em] text-stone-500">Overhead camera blocking — drag to edit</div>
        <div className="overflow-hidden rounded border border-stone-300 bg-white">
          <FloorPlanCanvas
            floorPlan={plan.floorPlan}
            shots={orderedShots.map((s) => ({ id: s.id, index: s.index, title: s.title }))}
            cast={sharedChoices.cast.map((c) => ({ characterId: c.characterId, name: c.name }))}
            objects={objects.map((o) => ({ id: o.id, name: o.name }))}
            onChange={onFloorPlanChange}
          />
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-1 text-[8px] font-bold uppercase tracking-[0.12em] text-stone-500">Establishing shot — how the scene reads</div>
        <Cell src={establishingHero} alt="Establishing shot" aspect="aspect-video" />
      </div>
    </div>
  );

  /** The ordered storyboard strip. */
  const renderStoryboard = (): React.ReactNode => (
    <div className="grid gap-1" style={cols(Math.min(Math.max(orderedShots.length, 1), 6))}>
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
      {subjects.map((member) => {
        const notes = (member.notes ?? '').trim();
        return (
          <div key={member.characterId} className="min-w-0 border-b border-stone-200 pb-1.5 last:border-b-0">
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

  /** Text-heavy blocks scroll their content inside the cell rather than overflow it. */
  const isScrollableBlock = (type: ShotPlanBlockType): boolean =>
    type === 'cinematography' || type === 'mood' || type === 'notes' || type === 'prompt' || type === 'palette';

  // ── Build the painted rows from the AI's layout (with empty-block/row drops). ─
  const layout = plan.layout && plan.layout.rows.length > 0 ? plan.layout : DEFAULT_LAYOUT;
  const renderRows: ShotPlanLayoutRow[] = layout.rows
    .map((row) => ({
      ...row,
      blocks: row.blocks.filter((b) => blockHasContent(b.type)),
    }))
    .filter((row) => row.blocks.length > 0);

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
