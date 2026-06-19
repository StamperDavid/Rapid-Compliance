/**
 * Shot Doc — the cinematic, film-studio "production sheet" view.
 *
 * DISPLAY-first rendering of a ShotPlan (the OpenArt-style document): image-forward,
 * dense, small uppercase technical labels — NOT a form. Editing lives in the form
 * view (toggled by the parent); this surface is for review, plus the inline floor-plan
 * popup and click-a-shot-to-edit.
 *
 * LAYOUT (Jun 19 2026): a MASONRY of filled tiles. The page is divided into labelled
 * bands (Character Reference, Environment, Storyboard, Look bible, Prompt); inside each
 * band every piece — a character, a prop, a zone, a look-bible field group, a storyboard
 * frame — is its own filled tile, and the tiles pack into balanced columns BY THEIR
 * ACTUAL HEIGHT (CSS multi-column + break-inside-avoid). Short tiles fill in under tall
 * ones, so there is no equal-height-row coupling and therefore no structural white
 * voids — the failure mode of the old grid-row layout. Every tile is a filled card, so
 * bare page never shows through as a "gap". Light "production-paper" skin (stone/amber,
 * no raw hex; palette swatches use the dynamic computed colour, the sanctioned inline
 * exception). This matches OpenArt Smart Shot's density, the parity floor.
 */

'use client';

import { type ReactNode, useState } from 'react';
import Image from 'next/image';
import { Clapperboard, Link2, Scissors, Pencil, ImageOff, Maximize2, Map } from 'lucide-react';

import { FloorPlanCanvas } from './FloorPlanCanvas';
import { composeShotGenerationPrompt } from '@/lib/video/shot-plan-mapping';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type {
  ShotPlan,
  ShotPlanShot,
  ShotPlanFloorPlan,
  ShotPlanCastMember,
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

// ── Small presentational atoms ──────────────────────────────────────────────

/** A filled card. Every piece of the sheet is one of these, so there is never bare
 *  page showing through as a "gap". `break-inside-avoid` keeps it whole in a column. */
function Tile({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-3 break-inside-avoid rounded-lg border border-stone-300 bg-white ${className ?? 'p-3'}`}>
      {children}
    </div>
  );
}

/** A masonry container — packs its tile children into EXACTLY `colCount` balanced
 *  columns (the caller sets colCount = number of tiles, capped), so the columns always
 *  stretch to fill the full width and there is never an empty column. Tiles pack by
 *  their real height (CSS multi-column + break-inside-avoid), so no equal-height row
 *  coupling and no voids. This is OpenArt's "columns always equal the content" rule. */
function Masonry({ colCount, children }: { colCount: number; children: ReactNode }) {
  return (
    <div style={{ columnCount: Math.max(1, colCount), columnGap: '0.75rem' }}>
      {children}
    </div>
  );
}

/** A labelled full-width band. Resets the masonry flow so sections stay grouped. */
function Band({
  n,
  title,
  onEdit,
  children,
}: {
  n?: number;
  title: string;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-stone-300 px-5 py-4">
      <div className="mb-3 flex items-center gap-2">
        {typeof n === 'number' && (
          <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-stone-800 text-[11px] font-bold text-amber-400">
            {n}
          </span>
        )}
        <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-stone-700">{title}</h3>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-stone-300 px-2 py-0.5 text-[9px] uppercase tracking-wider text-stone-500 transition-colors hover:border-amber-600/60 hover:text-amber-700"
            data-no-pan
          >
            <Pencil className="h-2.5 w-2.5" /> Edit
          </button>
        )}
      </div>
      {children}
    </section>
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

function RefImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded border border-stone-300 bg-stone-200 ${className ?? 'h-20 w-20'}`}>
      <Image src={src} alt={alt} fill sizes="160px" unoptimized className="object-cover" />
    </div>
  );
}

function EmptyImage({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded border border-dashed border-stone-300 bg-stone-200 text-stone-400 ${className ?? 'h-20 w-full'}`}
    >
      <ImageOff className="h-5 w-5" />
      <span className="text-[9px] uppercase tracking-wider">{label}</span>
    </div>
  );
}

function IdentityStrip({ member }: { member: ShotPlanCastMember }) {
  const hair = [member.hairColor, member.hairStyle]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s))
    .join(' ');
  const identityBits = [member.apparentAge, member.build, hair]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  const wardrobe = member.wardrobe?.trim();
  const isSignature = member.wardrobeMode === 'signature';

  if (identityBits.length === 0 && !wardrobe) {
    return null;
  }
  return (
    <div className="space-y-0.5">
      {identityBits.length > 0 && (
        <div className="text-[10px] leading-snug text-stone-600" title={identityBits.join(' · ')}>
          {identityBits.join(' · ')}
        </div>
      )}
      {wardrobe && (
        <div className="flex items-center gap-1.5 text-[10px] leading-snug text-stone-600">
          <span className="min-w-0 truncate" title={wardrobe}>{wardrobe}</span>
          {isSignature && (
            <span className="shrink-0 rounded-sm border border-amber-600/50 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-amber-700">
              Signature
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function PaletteRow({ swatches }: { swatches: { name: string; hex: string }[] }) {
  if (swatches.length === 0) {
    return <span className="text-xs text-stone-400">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {swatches.slice(0, 10).map((sw, i) => (
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

// ── Tiles ───────────────────────────────────────────────────────────────────

/** One cast member — header, identity, a 3-up turnaround grid (fills the tile width),
 *  and that character's own notes. A self-contained call-sheet card. */
function CharacterTile({ member }: { member: ShotPlanCastMember }) {
  const views = subjectViews(member);
  const noteLines = (member.notes ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const tier = member.billing === 'lead' ? 'Primary' : member.billing === 'supporting' ? 'Supporting' : null;

  return (
    <Tile>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] font-bold uppercase tracking-wider text-stone-900">{member.name}</span>
        {member.role && <span className="text-[10px] uppercase tracking-wider text-amber-700">{member.role}</span>}
        {tier && (
          <span className="rounded-sm bg-stone-200 px-1.5 py-px text-[8px] font-bold uppercase tracking-wider text-stone-500">{tier}</span>
        )}
        {member.subjectKind === 'group' && (
          <span className="rounded-sm border border-amber-600/50 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-amber-700">Group</span>
        )}
      </div>
      <div className="mt-1.5">
        <IdentityStrip member={member} />
      </div>
      {views.length > 0 ? (
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {views.slice(0, 6).map((v, i) => (
            <figure key={`${v.imageUrl}-${i}`} className="min-w-0">
              <div className="relative aspect-[3/4] overflow-hidden rounded border border-stone-300 bg-stone-200">
                <Image src={v.imageUrl} alt={`${member.name} ${v.label}`} fill sizes="160px" unoptimized className="object-cover" />
              </div>
              <figcaption className="mt-0.5 truncate text-center text-[8px] font-bold uppercase tracking-[0.1em] text-stone-500">{v.label}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <EmptyImage label="generating…" className="mt-2 aspect-[3/2] w-full" />
      )}
      {noteLines.length > 0 && (
        <ul className="mt-2 list-disc space-y-0.5 pl-4 marker:text-amber-600/60">
          {noteLines.slice(0, 5).map((s, i) => (
            <li key={i} className="text-[11px] leading-snug text-stone-600">{s}</li>
          ))}
        </ul>
      )}
    </Tile>
  );
}

/** One prop / object — costume & prop study card. */
function PropTile({ obj }: { obj: { id: string; name: string; subjectKind?: 'object' | 'creature'; referenceImageUrls: string[] } }) {
  return (
    <Tile>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="truncate text-[11px] font-bold uppercase tracking-wider text-stone-900" title={obj.name}>{obj.name}</span>
        <span className="shrink-0 text-[9px] uppercase tracking-wider text-stone-500">
          {obj.subjectKind === 'creature' ? 'Creature' : 'Object'}
        </span>
      </div>
      {obj.referenceImageUrls.length > 0 ? (
        <div className="grid grid-cols-2 gap-1.5">
          {obj.referenceImageUrls.slice(0, 4).map((url, i) => (
            <RefImage key={`${url}-${i}`} src={url} alt={`${obj.name} reference ${i + 1}`} className="aspect-square w-full" />
          ))}
        </div>
      ) : (
        <EmptyImage label="generating…" className="aspect-[3/2] w-full" />
      )}
    </Tile>
  );
}

/** One environment zone — hero render, label, set-design notes. */
function ZoneTile({ label, hero, setDesign }: { label: string; hero?: string; setDesign?: string[] }) {
  return (
    <Tile className="overflow-hidden p-0">
      <div className="relative aspect-video w-full bg-stone-200">
        {hero ? (
          <Image src={hero} alt={`${label} hero render`} fill sizes="600px" unoptimized className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-stone-400"><ImageOff className="h-6 w-6" /></div>
        )}
      </div>
      <div className="p-3">
        <div className="truncate text-[9px] font-bold uppercase tracking-[0.12em] text-stone-600" title={label}>{label}</div>
        {setDesign && setDesign.length > 0 && (
          <ul className="mt-1 list-disc space-y-0.5 pl-4 marker:text-amber-600/60">
            {setDesign.slice(0, 6).map((item, i) => (<li key={i} className="text-[10px] leading-snug text-stone-600">{item}</li>))}
          </ul>
        )}
      </div>
    </Tile>
  );
}

// ── Storyboard panel ────────────────────────────────────────────────────────

function DocStoryboardPanel({
  shot,
  position,
  onEdit,
}: {
  shot: ShotPlanShot;
  position: number;
  onEdit: () => void;
}) {
  const still = shot.generated?.keyframeUrl ?? shot.generated?.lastFrameUrl ?? null;
  const specs = [shot.camera.shotType, shot.camera.movement, shot.camera.lensType ?? shot.camera.lens ?? shot.camera.focalLength]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));

  return (
    <button
      type="button"
      onClick={onEdit}
      className="group relative flex w-full flex-col overflow-hidden rounded-lg border border-stone-300 bg-white text-left shadow-sm transition-colors hover:border-amber-600/60"
    >
      <div className="relative aspect-video bg-stone-200">
        {still ? (
          <Image src={still} alt={`Cut ${position + 1}`} fill sizes="320px" unoptimized className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-stone-400"><ImageOff className="h-6 w-6" /></div>
        )}
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
          <span className="rounded-sm bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-amber-300">{position + 1}</span>
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-black/80 px-1 py-0.5 text-[9px] uppercase tracking-wide text-white">
            {shot.transitionIn === 'continue' ? (<><Link2 className="h-2.5 w-2.5 text-amber-300" /> cont</>) : (<><Scissors className="h-2.5 w-2.5 text-amber-300" /> cut</>)}
          </span>
          {shot.timeOfDay?.trim() && (
            <span className="rounded-sm bg-black/80 px-1 py-0.5 text-[9px] uppercase tracking-wide text-white" title={shot.timeOfDay}>{shot.timeOfDay}</span>
          )}
        </div>
        <span className="absolute right-1.5 top-1.5 rounded-sm bg-black/70 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100">
          <Pencil className="h-3 w-3" />
        </span>
      </div>
      <div className="space-y-1 border-t border-stone-200 p-2">
        <div className="truncate font-mono text-[10px] uppercase tracking-wide text-amber-700">
          {specs.length > 0 ? specs.join(' · ') : 'camera —'} · {shot.durationSeconds}s
        </div>
        <div className="line-clamp-3 text-[11px] leading-snug text-stone-700">
          {shot.action?.trim() || shot.title?.trim() || 'Untitled shot'}
        </div>
      </div>
    </button>
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

// ── The document ────────────────────────────────────────────────────────────

export function ShotPlanDocument({ plan, onEdit, onEditSection, onFloorPlanChange }: ShotPlanDocumentProps) {
  const [floorPlanOpen, setFloorPlanOpen] = useState(false);
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

  // Band visibility (each band renders only when it has content — no empty bands).
  const hasCharacters = subjects.length > 0 || objects.length > 0 || sharedChoices.colorPalette.length > 0;
  const hasEnvironment =
    zones.length > 0 || Boolean(heroFallback) || envImages.length > 0 || Boolean(sharedChoices.environmentFingerprint?.trim());
  const hasFloorplan = Boolean(
    plan.floorPlan &&
      ((plan.floorPlan.cameras?.length ?? 0) > 0 ||
        (plan.floorPlan.elements?.length ?? 0) > 0 ||
        (plan.floorPlan.subjectPaths?.length ?? 0) > 0 ||
        plan.floorPlan.backdropImageUrl),
  );
  const hasLighting = (sharedChoices.lightingSwatches?.length ?? 0) > 0 || filled(look.lighting, look.atmosphere) || typeof look.temperature === 'number' || (look.filters?.length ?? 0) > 0;
  const hasCamera = filled(look.camera, lensValue, look.composition, look.aspectRatio) || framingBits.length > 0;
  const hasStyle = filled(look.artStyle, sharedChoices.artStyle, look.movieLook, look.filmStock, dpStyle);
  const hasMood = sharedChoices.moodKeywords.length > 0 || sharedChoices.cinematographyNotes.length > 0;
  const hasLook = hasLighting || hasCamera || hasStyle || hasMood;

  const floorPlanTile = (
    <Tile className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setFloorPlanOpen(true)}
        className="group relative block w-full text-left"
        data-no-pan
      >
        <div className="relative aspect-video w-full bg-stone-200">
          {plan.floorPlan?.backdropImageUrl ? (
            <Image src={plan.floorPlan.backdropImageUrl} alt="Floor plan — camera blocking" fill sizes="600px" unoptimized className="object-cover" />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-stone-500">
              <Map className="h-7 w-7" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Top-down camera blocking</span>
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:bg-black/30 group-hover:opacity-100">
            <span className="inline-flex items-center gap-1.5 rounded bg-black/80 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white">
              <Maximize2 className="h-3 w-3" /> Open &amp; edit blocking
            </span>
          </span>
        </div>
        <div className="px-3 py-2 text-[9px] font-bold uppercase tracking-[0.12em] text-stone-600">Floor plan · camera blocking</div>
      </button>
    </Tile>
  );

  return (
    <div className="flex w-[1920px] flex-col overflow-hidden rounded-2xl border border-stone-300 bg-stone-100 text-stone-800 shadow-2xl">
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

      {/* CHARACTER REFERENCE — characters, props and palette pack together (short prop
          and palette tiles fill in under the taller character tiles). */}
      {hasCharacters && (
        <Band n={1} title="Character Reference" onEdit={() => onEditSection('characters')}>
          <Masonry colCount={Math.min(4, Math.max(1, subjects.length || objects.length))}>
            {subjects.map((member) => (<CharacterTile key={member.characterId} member={member} />))}
            {objects.map((obj) => (<PropTile key={obj.id} obj={obj} />))}
            {sharedChoices.colorPalette.length > 0 && (
              <Tile>
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-stone-500">Palette</div>
                <PaletteRow swatches={sharedChoices.colorPalette} />
              </Tile>
            )}
          </Masonry>
        </Band>
      )}

      {/* ENVIRONMENT / SET DESIGN — zone heroes + the floor-plan preview tile pack
          together; the floor plan is a small click-to-open tile, never a giant diagram. */}
      {hasEnvironment && (
        <Band n={2} title="Environment / Set Design" onEdit={() => onEditSection('environment')}>
          <Masonry colCount={Math.min(4, (zones.length > 0 ? zones.length : 1) + (envImages.length > 0 ? 1 : 0) + (hasFloorplan ? 1 : 0))}>
            {zones.length > 0
              ? zones.map((zone, zi) => (
                  <ZoneTile
                    key={zone.id}
                    label={zone.label}
                    hero={zone.heroImageUrl ?? (zi === 0 ? heroFallback : undefined)}
                    setDesign={zone.setDesign}
                  />
                ))
              : (
                <ZoneTile
                  label={`EXT. — ${(sharedChoices.environmentFingerprint || 'Environment').slice(0, 80)}`}
                  hero={heroFallback}
                />
              )}
            {envImages.length > 0 && (
              <Tile>
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-stone-500">Reference</div>
                <div className="grid grid-cols-2 gap-1.5">
                  {envImages.slice(0, 4).map((url, i) => (<RefImage key={`${url}-${i}`} src={url} alt={`Environment ${i + 1}`} className="aspect-video w-full" />))}
                </div>
              </Tile>
            )}
            {hasFloorplan && floorPlanTile}
          </Masonry>
        </Band>
      )}

      {/* STORYBOARD — uniform frames, fill the width edge to edge. */}
      {orderedShots.length > 0 && (
        <Band n={3} title="Storyboard">
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(260px, 1fr))` }}>
            {orderedShots.map((shot, i) => (<DocStoryboardPanel key={shot.id} shot={shot} position={i} onEdit={() => onEdit(shot.id)} />))}
          </div>
        </Band>
      )}

      {/* LOOK BIBLE — lighting swatches + field-group tiles pack together. */}
      {hasLook && (
        <Band title="Lighting · Camera · Look · Mood" onEdit={() => onEditSection('lighting')}>
          <Masonry colCount={Math.min(4, (sharedChoices.lightingSwatches && sharedChoices.lightingSwatches.length > 0 ? 1 : 0) + (hasLighting ? 1 : 0) + (hasCamera ? 1 : 0) + (hasStyle ? 1 : 0) + (hasMood ? 1 : 0))}>
            {sharedChoices.lightingSwatches && sharedChoices.lightingSwatches.length > 0 && (
              <Tile>
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">Lighting setups</div>
                <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))' }}>
                  {sharedChoices.lightingSwatches.map((sw, i) => (
                    <figure key={`${sw.imageUrl}-${i}`}>
                      <div className="relative aspect-square w-full overflow-hidden rounded border border-stone-300 bg-stone-200">
                        <Image src={sw.imageUrl} alt={sw.label} fill sizes="120px" unoptimized className="object-cover" />
                      </div>
                      <figcaption className="mt-0.5 truncate text-[7px] font-bold uppercase tracking-wider text-stone-500" title={sw.label}>{sw.label}</figcaption>
                    </figure>
                  ))}
                </div>
              </Tile>
            )}
            {hasLighting && (
              <Tile>
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">Lighting &amp; atmosphere</div>
                <div className="space-y-2">
                  <Field label="Base lighting" value={look.lighting} />
                  <Field label="Atmosphere" value={look.atmosphere} />
                  <Field label="Color temperature" value={tempValue} />
                  <Field label="Filters / grade" value={look.filters && look.filters.length > 0 ? look.filters.join(', ') : undefined} />
                </div>
              </Tile>
            )}
            {hasCamera && (
              <Tile>
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">Camera &amp; lens</div>
                <div className="space-y-2">
                  <Field label="Camera body" value={look.camera} />
                  <Field label="Lens / focal" value={lensValue} />
                  <Field label="Framing" value={framingBits.length > 0 ? framingBits.join(' · ') : undefined} />
                  <Field label="Composition" value={look.composition} />
                  <Field label="Aspect ratio" value={look.aspectRatio} />
                </div>
              </Tile>
            )}
            {hasStyle && (
              <Tile>
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">Look &amp; style</div>
                <div className="space-y-2">
                  <Field label="Art style" value={look.artStyle ?? sharedChoices.artStyle} />
                  <Field label="Movie look" value={look.movieLook} />
                  <Field label="Film stock" value={look.filmStock} />
                  <Field label="DP style" value={dpStyle} />
                </div>
              </Tile>
            )}
            {hasMood && (
              <Tile>
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">Mood &amp; notes</div>
                {sharedChoices.moodKeywords.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {sharedChoices.moodKeywords.map((k) => (
                      <span key={k} className="rounded-sm border border-stone-300 bg-stone-50 px-2 py-0.5 text-[10px] uppercase tracking-wide text-stone-700">{k}</span>
                    ))}
                  </div>
                )}
                {sharedChoices.cinematographyNotes.length > 0 && (
                  <ul className="list-disc space-y-1 pl-4 marker:text-amber-600/60">
                    {sharedChoices.cinematographyNotes.map((note, i) => (<li key={i} className="text-[11px] leading-snug text-stone-700">{note}</li>))}
                  </ul>
                )}
              </Tile>
            )}
          </Masonry>
        </Band>
      )}

      {/* VIDEO PROMPT — full-width footer. */}
      {orderedShots.length > 0 && (
        <Band title="Video Prompt">
          <Tile>
            <div className="mb-1 flex items-center gap-2">
              <Clapperboard className="h-3.5 w-3.5 text-amber-700" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-500">Assembled video prompt — opening shot</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-stone-700">{videoPrompt || '—'}</p>
          </Tile>
        </Band>
      )}

      {/* Floor-plan editor — opened from the compact preview tile. */}
      <Dialog open={floorPlanOpen} onOpenChange={setFloorPlanOpen}>
        <DialogContent className="max-w-[1120px]">
          <DialogHeader>
            <DialogTitle>Floor plan · camera blocking</DialogTitle>
          </DialogHeader>
          <div className="mt-2" data-no-pan>
            <FloorPlanCanvas
              floorPlan={plan.floorPlan}
              shots={orderedShots.map((s) => ({ id: s.id, index: s.index, title: s.title }))}
              cast={sharedChoices.cast.map((c) => ({ characterId: c.characterId, name: c.name }))}
              objects={objects.map((o) => ({ id: o.id, name: o.name }))}
              onChange={onFloorPlanChange}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
