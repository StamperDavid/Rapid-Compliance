/**
 * Shot Doc — the cinematic, film-studio "production sheet" view.
 *
 * DISPLAY-first rendering of a ShotPlan, built to REPLICATE OpenArt Smart Shot's
 * production sheet (the parity floor): a TIGHT GRID, not a card collage.
 *
 * LAYOUT (Jun 19 2026 rebuild): the page is a stack of full-width SECTIONS divided
 * by thin rules (Character Reference, Environment / Set Design, Storyboard, Look
 * Bible, Video Prompt). Inside each section, images are laid in a grid where every
 * row's cells are EQUAL width (`repeat(N, 1fr)`) and EQUAL aspect, packed EDGE TO
 * EDGE with a 1px gutter and object-cover — so each row fills the full width with
 * no floating boxes, no card margins, and no ragged column bottoms. That tight
 * grid is what makes OpenArt's sheet read as dense; the old floating-card masonry
 * leaked the page background through every gap. Text (labels, notes, captions) is
 * compact and clamped so it never opens a tall void. Each section keeps its Edit
 * button. Light "production-paper" skin (stone/amber, no raw hex; palette swatches
 * use the dynamic computed colour, the sanctioned inline exception).
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

/** A full-width section band with a numbered header + optional Edit button. */
function Section({
  n,
  title,
  onEdit,
  children,
}: {
  n?: number;
  title: string;
  onEdit?: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-stone-300 px-6 py-4 first:border-t-0">
      <div className="mb-2.5 flex items-center gap-2">
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

  // Section visibility.
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
  const hasMoodTags = sharedChoices.moodKeywords.length > 0;
  const hasNotes = sharedChoices.cinematographyNotes.length > 0;
  const hasLook = hasLighting || hasCamera || hasStyle || hasMoodTags || hasNotes;

  // Environment cells = one per zone (or a single hero). The floor plan is its OWN
  // section now (overhead camera map + establishing render), not crammed in here.
  const envCellCount = zones.length > 0 ? zones.length : 1;
  // The establishing / master render for the Floor Plan · Camera Blocking section —
  // "what the scene looks like" beside the overhead camera map.
  const establishingHero = heroFallback ?? zones.find((z) => z.heroImageUrl)?.heroImageUrl;
  const showBlocking = hasFloorplan || Boolean(establishingHero) || Boolean(plan.floorPlan);

  /** Inline style for an N-column edge-to-edge grid. */
  const cols = (n: number): React.CSSProperties => ({ gridTemplateColumns: `repeat(${Math.max(1, n)}, minmax(0, 1fr))` });

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

      {/* ── 1 · CHARACTER REFERENCE ─────────────────────────────────────────── */}
      {hasCharacters && (
        <Section n={1} title="Character Reference" onEdit={() => onEditSection('characters')}>
          <div className="space-y-3">
            {/* Cast as side-by-side COLUMNS — compact: 1 or 5 characters, it's one
                short band, never a third of the page (the professional cast-reference
                convention). Each column is one character's small turnaround strip. */}
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
        </Section>
      )}

      {/* ── 2 · ENVIRONMENT / SET DESIGN ────────────────────────────────────── */}
      {hasEnvironment && (
        <Section n={2} title="Environment / Set Design" onEdit={() => onEditSection('environment')}>
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
        </Section>
      )}

      {/* ── 3 · FLOOR PLAN · CAMERA BLOCKING ── its own section (a standard pre-prod
           deliverable): the overhead camera-angle map + an establishing render of how
           the scene reads. The map is editable inline (drag the cameras/markers). ── */}
      {showBlocking && (
        <Section n={3} title="Floor Plan · Camera Blocking" onEdit={() => onEditSection('environment')}>
          <div className="grid grid-cols-[3fr_2fr] items-start gap-3">
            <div data-no-pan>
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
            <div>
              <div className="mb-1 text-[8px] font-bold uppercase tracking-[0.12em] text-stone-500">Establishing shot — how the scene reads</div>
              <Cell src={establishingHero} alt="Establishing shot" aspect="aspect-video" />
            </div>
          </div>
        </Section>
      )}

      {/* ── 4 · STORYBOARD ──────────────────────────────────────────────────── */}
      {orderedShots.length > 0 && (
        <Section n={4} title="Storyboard">
          <div className="grid gap-1" style={cols(Math.min(orderedShots.length, 6))}>
            {orderedShots.map((shot, i) => (<StoryboardFrame key={shot.id} shot={shot} position={i} onEdit={() => onEdit(shot.id)} />))}
          </div>
        </Section>
      )}

      {/* ── 4 · LOOK BIBLE ──────────────────────────────────────────────────── */}
      {hasLook && (
        <Section n={5} title="Lighting · Camera · Look · Mood" onEdit={() => onEditSection('lighting')}>
          {sharedChoices.lightingSwatches && sharedChoices.lightingSwatches.length > 0 && (
            <div className="mb-3 grid gap-1" style={cols(Math.min(Math.max(sharedChoices.lightingSwatches.length, 1), 8))}>
              {sharedChoices.lightingSwatches.slice(0, 8).map((sw, i) => (
                <Cell key={`${sw.imageUrl}-${i}`} src={sw.imageUrl} alt={sw.label} caption={sw.label} aspect="aspect-square" />
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-4">
            {hasLighting && (
              <div className="space-y-1.5">
                <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">Lighting &amp; atmosphere</div>
                <Field label="Base lighting" value={look.lighting} />
                <Field label="Atmosphere" value={look.atmosphere} />
                <Field label="Color temperature" value={tempValue} />
                <Field label="Filters / grade" value={look.filters && look.filters.length > 0 ? look.filters.join(', ') : undefined} />
              </div>
            )}
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
            {(hasMoodTags || hasNotes) && (
              <div className="space-y-1.5">
                <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-700">Mood &amp; notes</div>
                {hasMoodTags && (
                  <div className="flex flex-wrap gap-1">
                    {sharedChoices.moodKeywords.map((k) => (
                      <span key={k} className="rounded-sm border border-stone-300 bg-stone-50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-stone-700">{k}</span>
                    ))}
                  </div>
                )}
                {hasNotes && (
                  <ul className="list-disc space-y-0.5 pl-4 marker:text-amber-600/60">
                    {sharedChoices.cinematographyNotes.slice(0, 6).map((note, i) => (<li key={i} className="text-[11px] leading-snug text-stone-700">{note}</li>))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── VIDEO PROMPT ────────────────────────────────────────────────────── */}
      {orderedShots.length > 0 && (
        <Section title="Video Prompt">
          <div className="mb-1 flex items-center gap-2">
            <Clapperboard className="h-3.5 w-3.5 text-amber-700" />
            <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-stone-500">Assembled video prompt — opening shot</span>
          </div>
          <p className="font-mono text-[11px] leading-relaxed text-stone-700">{videoPrompt || '—'}</p>
        </Section>
      )}

    </div>
  );
}
