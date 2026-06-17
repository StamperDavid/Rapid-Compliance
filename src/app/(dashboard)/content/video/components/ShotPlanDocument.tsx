/**
 * Shot Doc — the cinematic, film-studio "production sheet" view.
 *
 * This is a DISPLAY-first rendering of a ShotPlan (the OpenArt-style document):
 * image-forward, dense, with small uppercase technical labels — NOT a form.
 * Editing lives in the form view (toggled by the parent); this surface is for
 * review, plus the inline-interactive floor-plan canvas and click-a-shot-to-edit.
 *
 * Styling latitude (operator-approved, Jun 13 2026): this surface uses a
 * medium-charcoal "production sheet" palette (Tailwind zinc/amber scale, no raw
 * hex) — a dark slate paper with bright ink. §1 (Character Reference) and §2
 * (Environment / Set Design) are ADAPTIVE: §1 reflows by subject count, §2 by
 * environment-zone count, with no empty/placeholder cells.
 */

'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { Clapperboard, Link2, Scissors, Camera as CameraIcon, Pencil, ImageOff } from 'lucide-react';

import { FloorPlanCanvas } from './FloorPlanCanvas';
import { composeShotGenerationPrompt } from '@/lib/video/shot-plan-mapping';
import type {
  ShotPlan,
  ShotPlanShot,
  ShotPlanFloorPlan,
  ShotPlanCastMember,
  ShotPlanLayout,
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

/** Featured (close-up / costume) view labels vs. full-body turnaround views. */
const FEATURED_VIEW = /close|detail|face|costume/i;

/** Doc layout weight for a subject column: leads and groups get more width. */
function subjectWeight(member: ShotPlanCastMember): number {
  return member.subjectKind === 'group' || member.billing === 'lead' ? 1.4 : 1;
}

/** The labeled views to show for a subject (model sheet, or refs as a fallback). */
function subjectViews(member: ShotPlanCastMember): { label: string; imageUrl: string }[] {
  if (member.modelSheet && member.modelSheet.length > 0) {
    return member.modelSheet;
  }
  return member.referenceImageUrls.map((url) => ({ label: 'REF', imageUrl: url }));
}

// ── Small presentational atoms ──────────────────────────────────────────────

function SectionLabel({ n, children, onEdit }: { n: number; children: ReactNode; onEdit?: () => void }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-zinc-900 text-[11px] font-bold text-amber-400">
        {n}
      </span>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-200">{children}</h3>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="ml-auto inline-flex items-center gap-1 rounded border border-zinc-600 px-2 py-0.5 text-[9px] uppercase tracking-wider text-zinc-400 transition-colors hover:border-amber-400/60 hover:text-amber-400"
          data-no-pan
        >
          <Pencil className="h-2.5 w-2.5" /> Edit
        </button>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) {
    return null;
  }
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</div>
      <div className="text-xs leading-snug text-zinc-100" title={value}>{value}</div>
    </div>
  );
}

function RefImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded border border-zinc-600 bg-zinc-800 ${className ?? 'h-20 w-20'}`}>
      <Image src={src} alt={alt} fill sizes="160px" unoptimized className="object-cover" />
    </div>
  );
}

function EmptyImage({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded border border-dashed border-zinc-600 bg-zinc-800 text-zinc-500 ${className ?? 'h-20 w-full'}`}
    >
      <ImageOff className="h-5 w-5" />
      <span className="text-[9px] uppercase tracking-wider">{label}</span>
    </div>
  );
}

/**
 * A compact one-line identity strip for a cast member — `apparentAge · build ·
 * hairColor hairStyle` plus a short wardrobe line (with a "signature" tag when
 * the wardrobe is locked). Lean by design: every piece is omitted if absent, and
 * the strip renders nothing at all when no identity fields are present. Full
 * detail lives in the editor popup, not here.
 */
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
        <div className="text-[10px] leading-snug text-zinc-300" title={identityBits.join(' · ')}>
          {identityBits.join(' · ')}
        </div>
      )}
      {wardrobe && (
        <div className="flex items-center gap-1.5 text-[10px] leading-snug text-zinc-300">
          <span className="min-w-0 truncate" title={wardrobe}>{wardrobe}</span>
          {isSignature && (
            <span className="shrink-0 rounded-sm border border-amber-400/60 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-amber-400">
              Signature
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** A reusable palette swatch strip (used in §1, both single- and multi-subject). */
function PaletteRow({ swatches }: { swatches: { name: string; hex: string }[] }) {
  if (swatches.length === 0) {
    return <span className="text-xs text-zinc-500">—</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {swatches.slice(0, 8).map((sw, i) => (
        <span
          key={`${sw.hex}-${i}`}
          title={`${sw.name} (${sw.hex})`}
          className="h-8 w-8 rounded-sm border border-zinc-600"
          style={{ backgroundColor: sw.hex }}
        />
      ))}
    </div>
  );
}

// ── Storyboard panel (display) ──────────────────────────────────────────────

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
  const specs = [
    shot.camera.lensType ?? shot.camera.lens ?? shot.camera.focalLength,
    shot.camera.movement,
    shot.camera.shotType,
  ]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));

  return (
    <button
      type="button"
      onClick={onEdit}
      className="group relative flex w-full flex-col overflow-hidden rounded border border-zinc-600 bg-zinc-800 text-left transition-colors hover:border-amber-400/60"
    >
      <div className="relative aspect-video bg-zinc-800">
        {still ? (
          <Image src={still} alt={`Cut ${position + 1}`} fill sizes="320px" unoptimized className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
          <span className="rounded-sm bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-amber-400">
            {position + 1}
          </span>
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-black/80 px-1 py-0.5 text-[9px] uppercase tracking-wide text-zinc-100">
            {shot.transitionIn === 'continue' ? (
              <><Link2 className="h-2.5 w-2.5 text-amber-400" /> cont</>
            ) : (
              <><Scissors className="h-2.5 w-2.5 text-amber-400" /> cut</>
            )}
          </span>
          {shot.timeOfDay?.trim() && (
            <span className="rounded-sm bg-black/80 px-1 py-0.5 text-[9px] uppercase tracking-wide text-zinc-100" title={shot.timeOfDay}>
              {shot.timeOfDay}
            </span>
          )}
          {shot.weather?.trim() && (
            <span className="rounded-sm bg-black/80 px-1 py-0.5 text-[9px] uppercase tracking-wide text-zinc-100" title={shot.weather}>
              {shot.weather}
            </span>
          )}
        </div>
        <span className="absolute right-1.5 top-1.5 rounded-sm bg-black/70 p-1 text-zinc-100 opacity-0 transition-opacity group-hover:opacity-100">
          <Pencil className="h-3 w-3" />
        </span>
      </div>
      <div className="space-y-1 border-t border-zinc-600 p-2">
        <div className="truncate font-mono text-[10px] uppercase tracking-wide text-amber-400">
          {specs.length > 0 ? specs.join(' · ') : 'camera —'} · {shot.durationSeconds}s
        </div>
        <div className="line-clamp-3 text-[11px] leading-snug text-zinc-200">
          {shot.action?.trim() || shot.title?.trim() || 'Untitled shot'}
        </div>
      </div>
    </button>
  );
}

// ── §1 — a single subject's column (used in the multi-subject grid) ──────────

function SubjectColumn({ member }: { member: ShotPlanCastMember }) {
  const views = subjectViews(member);
  const fullBody = views.filter((v) => !FEATURED_VIEW.test(v.label));
  const closeUps = views.filter((v) => FEATURED_VIEW.test(v.label));
  const noteLines = (member.notes ?? '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* 1. Header — name + role + optional GROUP tag */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[12px] font-bold uppercase tracking-wider text-zinc-50">{member.name}</span>
        {member.role && <span className="text-[9px] uppercase tracking-wider text-amber-400">{member.role}</span>}
        {member.subjectKind === 'group' && (
          <span className="rounded-sm border border-amber-400/60 px-1 py-px text-[8px] font-bold uppercase tracking-wider text-amber-400">
            Group
          </span>
        )}
      </div>

      {/* 1b. Compact identity strip — age · build · hair, + wardrobe (omit-if-empty) */}
      <IdentityStrip member={member} />

      {/* 2. Full-body turnaround row — tall 3:8 frames */}
      {fullBody.length > 0 ? (
        <div className="grid grid-cols-3 gap-1.5">
          {fullBody.slice(0, 6).map((v, i) => (
            <figure key={`${v.imageUrl}-${i}`} className="min-w-0">
              <div className="relative aspect-[3/8] overflow-hidden rounded border border-zinc-600 bg-zinc-800">
                <Image src={v.imageUrl} alt={`${member.name} ${v.label}`} fill sizes="96px" unoptimized className="object-cover" />
              </div>
              <figcaption className="mt-0.5 truncate text-center text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                {v.label}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <EmptyImage label="no refs" className="aspect-[3/8] w-full" />
      )}

      {/* 3. Close-up row — wider 3:4 frames (omitted entirely if none) */}
      {closeUps.length > 0 && (
        <div className="grid grid-cols-2 gap-1.5">
          {closeUps.slice(0, 4).map((v, i) => (
            <figure key={`${v.imageUrl}-${i}`} className="min-w-0">
              <div className="relative aspect-[3/4] overflow-hidden rounded border border-zinc-600 bg-zinc-800">
                <Image src={v.imageUrl} alt={`${member.name} ${v.label}`} fill sizes="160px" unoptimized className="object-cover" />
              </div>
              <figcaption className="mt-0.5 truncate text-center text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                {v.label}
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {/* 4. Notes — 2–3 lines, omitted if empty */}
      {noteLines.length > 0 && (
        <p className="line-clamp-3 text-[11px] leading-snug text-zinc-300">{noteLines.join(' ')}</p>
      )}
    </div>
  );
}

// ── The document ────────────────────────────────────────────────────────────

// ── AI-COMPOSED LAYOUT CANVAS ────────────────────────────────────────────────
// The planner DESIGNS the page (plan.layout). This paints whatever it designed:
// a fixed landscape canvas, rows distributed by heightWeight (so the page ALWAYS
// fills — no dead space), columns by widthWeight, each block drawn by its type.

/** Deterministic layout rule (not left to the blind AI): the floor plan is a rich,
 * editable diagram, so it ALWAYS gets its OWN full-width row at natural size — never
 * crammed into a shared cell where it shrinks to a scrollbox. */
function withFloorplanOwnRow(rows: ShotPlanLayout['rows']): ShotPlanLayout['rows'] {
  const out: ShotPlanLayout['rows'] = [];
  for (const row of rows) {
    const fps = row.blocks.filter((b) => b.type === 'floorplan');
    const rest = row.blocks.filter((b) => b.type !== 'floorplan');
    if (rest.length > 0) {
      out.push({ ...row, blocks: rest });
    }
    for (const fp of fps) {
      out.push({ heightWeight: row.heightWeight, blocks: [{ ...fp, widthWeight: 1 }] });
    }
  }
  return out.length > 0 ? out : rows;
}

/** Fallback composition when the planner didn't author one (older docs). */
const DEFAULT_LAYOUT: ShotPlanLayout = {
  rows: [
    {
      heightWeight: 5,
      blocks: [
        { type: 'characters', title: '1. Character Reference', widthWeight: 6 },
        { type: 'environment', title: '2. Environment / Set Design', widthWeight: 7 },
      ],
    },
    { heightWeight: 4, blocks: [{ type: 'floorplan', title: 'Floor Plan · Camera Blocking', widthWeight: 1 }] },
    {
      heightWeight: 3,
      blocks: [
        { type: 'cinematography', title: 'Cinematography', widthWeight: 1 },
        { type: 'lighting', title: 'Lighting', widthWeight: 1 },
        { type: 'mood', title: 'Mood & Notes', widthWeight: 1 },
      ],
    },
    { heightWeight: 4, blocks: [{ type: 'storyboard', title: 'Storyboard', widthWeight: 1 }] },
    { heightWeight: 1, blocks: [{ type: 'prompt', title: 'Video Prompt', widthWeight: 1 }] },
  ],
};

/** Which editor a block's "Edit" button opens (null = no section editor). */
function sectionForBlock(type: ShotPlanBlockType): ShotPlanSection | null {
  if (type === 'characters' || type === 'notes') {
    return 'characters';
  }
  if (type === 'environment' || type === 'floorplan') {
    return 'environment';
  }
  if (type === 'lighting' || type === 'cinematography' || type === 'mood' || type === 'palette') {
    return 'lighting';
  }
  return null;
}

function HeaderMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">{label}</div>
      <div className="text-xs text-zinc-100" title={value}>{value}</div>
    </div>
  );
}

function ShotPlanLayoutCanvas({ plan, onEdit, onEditSection, onFloorPlanChange }: ShotPlanDocumentProps) {
  const { sharedChoices } = plan;
  const look = sharedChoices.lookBible ?? {};
  const orderedShots = [...plan.shots].sort((a, b) => a.index - b.index);
  const objects = sharedChoices.objects ?? [];
  const envImages = sharedChoices.environmentReferenceImageUrls ?? [];
  const zones = sharedChoices.environmentZones ?? [];
  const billingRank = (m: ShotPlanCastMember): number => (m.billing === 'lead' ? 0 : m.billing === 'supporting' ? 1 : 2);
  const subjects = [...sharedChoices.cast]
    .map((member, i) => ({ member, i }))
    .sort((a, b) => billingRank(a.member) - billingRank(b.member) || a.i - b.i)
    .map((e) => e.member);
  const notesLabel = sharedChoices.adaptiveLabels?.characterNotes ?? 'Character notes';
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
  // DETERMINISTIC: always use the curated template, never the AI's improvised layout.
  // A blind text model can't arrange a page — it scatters content and leaves gaps.
  // The specialist authors the CONTENT; this fixed template guarantees the ARRANGEMENT.
  const rows = DEFAULT_LAYOUT.rows;

  const objectsBlock =
    objects.length > 0 ? (
      <div className="space-y-3 border-t border-zinc-600 pt-4">
        <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">Key props</div>
        {objects.map((obj) => (
          <div key={obj.id}>
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-50">{obj.name}</span>
              <span className="text-[9px] uppercase tracking-wider text-zinc-400">
                {obj.subjectKind === 'creature' ? 'Creature' : 'Object'}
              </span>
            </div>
            {obj.referenceImageUrls.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {obj.referenceImageUrls.slice(0, 5).map((url, i) => (
                  <RefImage key={`${url}-${i}`} src={url} alt={`${obj.name} reference ${i + 1}`} className="h-24 w-24" />
                ))}
              </div>
            ) : (
              <EmptyImage label="no refs" className="h-16 w-full" />
            )}
          </div>
        ))}
      </div>
    ) : null;

  const renderBlock = (type: ShotPlanBlockType): ReactNode => {
    switch (type) {
      case 'characters':
        return subjects.length === 0 && objects.length === 0 ? (
          <p className="text-xs text-zinc-500">No cast or objects yet.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {subjects.length <= 1 ? (
              <>
                <div className="space-y-5">
                  {subjects.map((member) => {
                    const views = subjectViews(member);
                    return (
                      <div key={member.characterId}>
                        {views.length > 0 ? (
                          <div className="flex flex-wrap items-start gap-2">
                            {views.slice(0, 5).map((v, i) => {
                              const featured = FEATURED_VIEW.test(v.label);
                              return (
                                <figure key={`${v.imageUrl}-${i}`} className={featured ? 'w-40' : 'w-24'}>
                                  <div className={`relative h-64 overflow-hidden rounded border border-zinc-600 bg-zinc-800 ${featured ? 'w-40' : 'w-24'}`}>
                                    <Image src={v.imageUrl} alt={`${member.name} ${v.label}`} fill sizes={featured ? '160px' : '96px'} unoptimized className="object-cover" />
                                  </div>
                                  <figcaption className="mt-1 text-center text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-400">{v.label}</figcaption>
                                </figure>
                              );
                            })}
                          </div>
                        ) : (
                          <EmptyImage label="no refs" className="h-16 w-full" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-[auto_1fr] gap-6 border-t border-zinc-600 pt-4">
                  <div>
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">Palette</div>
                    <div className="w-28"><PaletteRow swatches={sharedChoices.colorPalette} /></div>
                  </div>
                  <div className="min-w-0">
                    {subjects.length === 1 && <div className="mb-2"><IdentityStrip member={subjects[0]} /></div>}
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">{notesLabel}</div>
                    <ul className="list-disc space-y-1 pl-4 marker:text-amber-400/60">
                      {subjects.flatMap((m) => {
                        const sentences = (m.notes ?? '').split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
                        if (sentences.length === 0) {
                          return [
                            <li key={m.characterId} className="text-[11px] leading-snug text-zinc-400">
                              <span className="font-semibold text-zinc-50">{m.name}</span>
                              {m.role ? ` — ${m.role}` : ''}
                            </li>,
                          ];
                        }
                        return sentences.map((s, i) => (
                          <li key={`${m.characterId}-${i}`} className="text-[11px] leading-snug text-zinc-200">{s}</li>
                        ));
                      })}
                    </ul>
                  </div>
                </div>
                {objectsBlock}
              </>
            ) : (
              <>
                <div className="grid gap-5" style={{ gridTemplateColumns: subjects.map((s) => `${subjectWeight(s)}fr`).join(' ') }}>
                  {subjects.map((member) => (<SubjectColumn key={member.characterId} member={member} />))}
                </div>
                <div className="border-t border-zinc-600 pt-4">
                  <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">Palette</div>
                  <PaletteRow swatches={sharedChoices.colorPalette} />
                </div>
                {objectsBlock}
              </>
            )}
          </div>
        );

      case 'environment': {
        const heroFallback = sharedChoices.environmentHeroImageUrl;
        if (zones.length > 0) {
          return (
            <div className="grid h-full gap-3" style={{ gridTemplateColumns: `repeat(${zones.length}, minmax(0, 1fr))` }}>
              {zones.map((zone, zi) => {
                const hero = zone.heroImageUrl ?? (zi === 0 ? heroFallback : undefined);
                return (
                  <div key={zone.id} className="flex min-h-0 flex-col gap-2">
                    <div className="relative min-h-0 flex-1 overflow-hidden rounded border border-zinc-600 bg-zinc-800">
                      {hero ? (
                        <Image src={hero} alt={`${zone.label} hero render`} fill sizes="600px" unoptimized className="object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-zinc-600"><ImageOff className="h-6 w-6" /></div>
                      )}
                    </div>
                    <div className="truncate text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-400" title={zone.label}>{zone.label}</div>
                    {zone.setDesign && zone.setDesign.length > 0 && (
                      <ul className="list-disc space-y-0.5 pl-4 marker:text-amber-400/60">
                        {zone.setDesign.slice(0, 5).map((item, i) => (<li key={i} className="text-[10px] leading-snug text-zinc-300">{item}</li>))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          );
        }
        return (
          <div className="flex h-full flex-col gap-2">
            <div className="relative min-h-0 flex-1 overflow-hidden rounded border border-zinc-600 bg-zinc-800">
              {heroFallback ? (
                <Image src={heroFallback} alt="Environment hero render" fill sizes="900px" unoptimized className="object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-zinc-600"><ImageOff className="h-8 w-8" /></div>
              )}
            </div>
            <div className="text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-400">
              EXT. — {(sharedChoices.environmentFingerprint || 'Environment').slice(0, 90)}
            </div>
            {envImages.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {envImages.slice(0, 4).map((url, i) => (<RefImage key={`${url}-${i}`} src={url} alt={`Environment ${i + 1}`} className="h-12 w-20" />))}
              </div>
            )}
          </div>
        );
      }

      case 'floorplan':
        return (
          <div className="mx-auto w-full max-w-[1180px]">
            <FloorPlanCanvas
              floorPlan={plan.floorPlan}
              shots={orderedShots.map((s) => ({ id: s.id, index: s.index, title: s.title }))}
              cast={sharedChoices.cast.map((c) => ({ characterId: c.characterId, name: c.name }))}
              objects={objects.map((o) => ({ id: o.id, name: o.name }))}
              onChange={onFloorPlanChange}
            />
          </div>
        );

      case 'storyboard':
        return orderedShots.length === 0 ? (
          <p className="text-xs text-zinc-500">No shots yet.</p>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(orderedShots.length, 5)}, minmax(0, 1fr))` }}>
            {orderedShots.map((shot, i) => (<DocStoryboardPanel key={shot.id} shot={shot} position={i} onEdit={() => onEdit(shot.id)} />))}
          </div>
        );

      case 'lighting':
        return (
          <div className="space-y-4">
            {sharedChoices.lightingSwatches && sharedChoices.lightingSwatches.length > 0 && (
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
                {sharedChoices.lightingSwatches.map((sw, i) => (
                  <figure key={`${sw.imageUrl}-${i}`}>
                    <div className="relative aspect-square w-full overflow-hidden rounded border border-zinc-600 bg-zinc-800">
                      <Image src={sw.imageUrl} alt={sw.label} fill sizes="160px" unoptimized className="object-cover" />
                    </div>
                    <figcaption className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-wider text-zinc-400" title={sw.label}>{sw.label}</figcaption>
                  </figure>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Field label="Base lighting" value={look.lighting} />
              <Field label="Atmosphere" value={look.atmosphere} />
              <Field label="Color temperature" value={tempValue} />
              <Field label="Filters / grade" value={look.filters && look.filters.length > 0 ? look.filters.join(', ') : undefined} />
            </div>
          </div>
        );

      case 'cinematography':
        return (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-400">Camera &amp; lens</div>
              <Field label="Camera body" value={look.camera} />
              <Field label="Lens / focal" value={lensValue} />
              <Field label="Framing" value={framingBits.length > 0 ? framingBits.join(' · ') : undefined} />
              <Field label="Composition" value={look.composition} />
              <Field label="Aspect ratio" value={look.aspectRatio} />
            </div>
            <div className="space-y-2">
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-400">Look &amp; style</div>
              <Field label="Art style" value={look.artStyle ?? sharedChoices.artStyle} />
              <Field label="Movie look" value={look.movieLook} />
              <Field label="Film stock" value={look.filmStock} />
              <Field label="DP style" value={dpStyle} />
            </div>
          </div>
        );

      case 'mood':
        return (
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-400">Mood</div>
              <div className="flex flex-wrap gap-1.5">
                {sharedChoices.moodKeywords.length > 0 ? (
                  sharedChoices.moodKeywords.map((k) => (
                    <span key={k} className="rounded-sm border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-200">{k}</span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">—</span>
                )}
              </div>
            </div>
            {sharedChoices.cinematographyNotes.length > 0 && (
              <div>
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-400">Cinematography notes</div>
                <ul className="list-disc space-y-1 pl-4 marker:text-amber-400/60">
                  {sharedChoices.cinematographyNotes.map((note, i) => (<li key={i} className="text-[11px] leading-snug text-zinc-200">{note}</li>))}
                </ul>
              </div>
            )}
          </div>
        );

      case 'palette':
        return <PaletteRow swatches={sharedChoices.colorPalette} />;

      case 'notes':
        return (
          <ul className="space-y-2">
            {subjects.map((m) => (
              <li key={m.characterId}>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-50">{m.name}</span>
                  {m.role && <span className="text-[9px] uppercase tracking-wider text-amber-400">{m.role}</span>}
                </div>
                <IdentityStrip member={m} />
                {m.notes?.trim() && <p className="mt-0.5 text-[11px] leading-snug text-zinc-300">{m.notes}</p>}
              </li>
            ))}
          </ul>
        );

      case 'prompt':
        return (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Clapperboard className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">Assembled video prompt — opening shot</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed text-zinc-300">{videoPrompt || '—'}</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex w-[1920px] flex-col overflow-hidden rounded-2xl border border-zinc-600 bg-zinc-700 text-zinc-100 shadow-2xl">
      {/* Header chrome */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-zinc-600 bg-gradient-to-b from-zinc-800 to-zinc-700 px-6 py-3">
        <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Shot Doc</span>
        <span className="text-[10px] uppercase tracking-wider text-zinc-400">{plan.title || 'Untitled production'}</span>
        <HeaderMeta label="Cuts" value={String(orderedShots.length)} />
        {sharedChoices.timePeriod?.trim() && <HeaderMeta label="Period" value={sharedChoices.timePeriod} />}
        {sharedChoices.genre?.trim() && <HeaderMeta label="Genre" value={sharedChoices.genre} />}
        <div className="min-w-[160px] flex-1">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">Environment</div>
          <div className="line-clamp-1 text-[11px] text-zinc-200">{sharedChoices.environmentFingerprint || '—'}</div>
        </div>
        <button
          type="button"
          onClick={() => onEditSection('shared')}
          className="inline-flex items-center gap-1 rounded border border-zinc-600 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-300 transition-colors hover:border-amber-400/60 hover:text-amber-400"
          data-no-pan
        >
          <Pencil className="h-3 w-3" /> Edit
        </button>
      </div>

      {/* Body — the AI's rows fill the canvas height by weight (no dead space). */}
      <div className="flex flex-col">
        {withFloorplanOwnRow(rows).map((row, ri) => (
          <div
            key={ri}
            className="grid"
            style={{ gridTemplateColumns: row.blocks.map((b) => `${b.widthWeight}fr`).join(' ') }}
          >
            {row.blocks.map((b, bi) => {
              const section = sectionForBlock(b.type);
              // The floor plan renders at its natural (big) size — it is never the
              // scrollable one. Text-heavy blocks are capped and scroll, so they
              // conserve space for the visual aids.
              const isFloorplan = b.type === 'floorplan';
              // Text-heavy blocks cap + scroll (space-savers); visual blocks fill their
              // cell; the floor plan renders at natural size and is never the scrollbox.
              const isText =
                b.type === 'cinematography' || b.type === 'mood' || b.type === 'notes' || b.type === 'prompt' || b.type === 'palette';
              return (
                <div key={bi} className="flex min-h-0 min-w-0 flex-col border-b border-r border-zinc-600 px-5 py-3">
                  <div className="mb-2 flex items-center gap-2">
                    <h3 className="truncate text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-200">{b.title ?? ''}</h3>
                    {section && (
                      <button
                        type="button"
                        onClick={() => onEditSection(section)}
                        className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-zinc-600 px-2 py-0.5 text-[9px] uppercase tracking-wider text-zinc-400 transition-colors hover:border-amber-400/60 hover:text-amber-400"
                        data-no-pan
                      >
                        <Pencil className="h-2.5 w-2.5" /> Edit
                      </button>
                    )}
                  </div>
                  <div className={isFloorplan ? 'min-w-0' : isText ? 'min-h-0 max-h-[360px] flex-1 overflow-y-auto pr-1' : 'min-h-0 flex-1'}>
                    {renderBlock(b.type)}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── The document ────────────────────────────────────────────────────────────

export function ShotPlanDocument(props: ShotPlanDocumentProps) {
  const { plan, onEdit, onEditSection, onFloorPlanChange } = props;
  // AI-composed page: the planner designed the layout → paint it. Fixed canvas,
  // rows fill by weight, so there is never dead space.
  if (plan.layout && plan.layout.rows.length > 0) {
    return <ShotPlanLayoutCanvas {...props} />;
  }
  const { sharedChoices } = plan;
  const look = sharedChoices.lookBible ?? {};
  const orderedShots = [...plan.shots].sort((a, b) => a.index - b.index);
  const objects = sharedChoices.objects ?? [];
  const envImages = sharedChoices.environmentReferenceImageUrls ?? [];
  const zones = sharedChoices.environmentZones ?? [];

  // §1 — cast ordered: leads first, then supporting, then the rest (stable).
  const billingRank = (m: ShotPlanCastMember): number =>
    m.billing === 'lead' ? 0 : m.billing === 'supporting' ? 1 : 2;
  const subjects = [...sharedChoices.cast]
    .map((member, i) => ({ member, i }))
    .sort((a, b) => billingRank(a.member) - billingRank(b.member) || a.i - b.i)
    .map((entry) => entry.member);
  const notesLabel = sharedChoices.adaptiveLabels?.characterNotes ?? 'Character notes';

  // Dynamic column template for the multi-subject §1 grid (sanctioned inline style).
  const subjectGridTemplate = subjects.map((s) => `${subjectWeight(s)}fr`).join(' ');

  // The assembled "video prompt" — the composed prompt of the opening shot, the
  // single best representation of how the doc reads to the engine.
  const videoPrompt = orderedShots[0] ? composeShotGenerationPrompt(plan, orderedShots[0]) : '';

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

  return (
    <div className="w-[1920px] overflow-hidden rounded-2xl border border-zinc-600 bg-zinc-700 text-zinc-100 shadow-2xl">
      {/* ══ SHARED CHOICES header bar ══ */}
      <div className="border-b border-zinc-600 bg-gradient-to-b from-zinc-800 to-zinc-700 px-6 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Shot Doc</span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-400">{plan.title || 'Untitled production'}</span>
          <button
            type="button"
            onClick={() => onEditSection('shared')}
            className="ml-auto inline-flex items-center gap-1 rounded border border-zinc-600 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-300 transition-colors hover:border-amber-400/60 hover:text-amber-400"
            data-no-pan
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">Cut count</div>
            <div className="font-mono text-lg font-bold text-amber-400">{orderedShots.length}</div>
          </div>
          {sharedChoices.timePeriod?.trim() && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">Time period</div>
              <div className="text-xs text-zinc-100" title={sharedChoices.timePeriod}>{sharedChoices.timePeriod}</div>
            </div>
          )}
          {sharedChoices.genre?.trim() && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">Genre</div>
              <div className="text-xs text-zinc-100" title={sharedChoices.genre}>{sharedChoices.genre}</div>
            </div>
          )}
          <div>
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">Color palette</div>
            {sharedChoices.colorPalette.length > 0 ? (
              <div className="flex items-end gap-1.5">
                {sharedChoices.colorPalette.slice(0, 8).map((sw, i) => (
                  <figure key={`${sw.hex}-${i}`} className="text-center">
                    <span
                      title={sw.name}
                      className="block h-6 w-10 rounded-sm border border-zinc-600"
                      style={{ backgroundColor: sw.hex }}
                    />
                    <figcaption className="mt-0.5 font-mono text-[7px] uppercase tracking-tight text-zinc-400">{sw.hex}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <span className="text-xs text-zinc-500">—</span>
            )}
          </div>
          <div className="min-w-[200px] flex-1">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-400">Environment fingerprint</div>
            <div className="line-clamp-2 text-xs text-zinc-200">{sharedChoices.environmentFingerprint || '—'}</div>
          </div>
        </div>
      </div>

      {/* ══ Top row: Section 1 (Character Reference) | Section 2 (Environment + Floor Plan) ══
           Measured from OpenArt's sheet: Section 1 : Section 2 width = 766 : 916 ≈ 6 : 7. */}
      <div className="grid grid-cols-[6fr_7fr]">
        {/* SECTION 1 — CHARACTER REFERENCE (adaptive by subject count) */}
        <section className="border-b border-r border-zinc-600 px-6 py-5">
          <SectionLabel n={1} onEdit={() => onEditSection('characters')}>Character Reference</SectionLabel>
          {subjects.length === 0 && objects.length === 0 ? (
            <p className="text-xs text-zinc-500">No cast or objects yet.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {subjects.length <= 1 ? (
                // ── SINGLE-SUBJECT: turnaround row across the top + Palette | notes below ──
                <>
                  <div className="space-y-5">
                    {subjects.map((member) => {
                      const views = subjectViews(member);
                      return (
                        <div key={member.characterId}>
                          {views.length > 0 ? (
                            <div className="flex flex-wrap items-start gap-2">
                              {views.slice(0, 5).map((v, i) => {
                                // Measured from OpenArt: full-body figures are tall (3:8);
                                // the face / costume close-ups are wider featured frames (3:4).
                                const featured = FEATURED_VIEW.test(v.label);
                                return (
                                  <figure key={`${v.imageUrl}-${i}`} className={featured ? 'w-40' : 'w-24'}>
                                    <div className={`relative h-64 overflow-hidden rounded border border-zinc-600 bg-zinc-800 ${featured ? 'w-40' : 'w-24'}`}>
                                      <Image src={v.imageUrl} alt={`${member.name} ${v.label}`} fill sizes={featured ? '160px' : '96px'} unoptimized className="object-cover" />
                                    </div>
                                    <figcaption className="mt-1 text-center text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                                      {v.label}
                                    </figcaption>
                                  </figure>
                                );
                              })}
                            </div>
                          ) : (
                            <EmptyImage label="no refs" className="h-16 w-full" />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Palette + descriptive character notes (bulleted, like a real call sheet) */}
                  <div className="grid grid-cols-[auto_1fr] gap-6 border-t border-zinc-600 pt-4">
                    <div>
                      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">Palette</div>
                      <div className="w-28">
                        <PaletteRow swatches={sharedChoices.colorPalette} />
                      </div>
                    </div>
                    <div className="min-w-0">
                      {subjects.length === 1 && (
                        <div className="mb-2">
                          <IdentityStrip member={subjects[0]} />
                        </div>
                      )}
                      <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">{notesLabel}</div>
                      <ul className="list-disc space-y-1 pl-4 marker:text-amber-400/60">
                        {subjects.flatMap((m) => {
                          const sentences = (m.notes ?? '')
                            .split(/(?<=[.!?])\s+/)
                            .map((s) => s.trim())
                            .filter(Boolean);
                          if (sentences.length === 0) {
                            return [
                              <li key={m.characterId} className="text-[11px] leading-snug text-zinc-400">
                                <span className="font-semibold text-zinc-50">{m.name}</span>
                                {m.role ? ` — ${m.role}` : ''}
                              </li>,
                            ];
                          }
                          return sentences.map((s, i) => (
                            <li key={`${m.characterId}-${i}`} className="text-[11px] leading-snug text-zinc-200">
                              {s}
                            </li>
                          ));
                        })}
                      </ul>
                    </div>
                  </div>
                </>
              ) : (
                // ── MULTI-SUBJECT: N adaptive columns + full-width palette row ──
                <>
                  <div className="grid gap-5" style={{ gridTemplateColumns: subjectGridTemplate }}>
                    {subjects.map((member) => (
                      <SubjectColumn key={member.characterId} member={member} />
                    ))}
                  </div>
                  <div className="border-t border-zinc-600 pt-4">
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">Palette</div>
                    <PaletteRow swatches={sharedChoices.colorPalette} />
                  </div>
                </>
              )}

              {/* Objects / props — secondary, below the cast */}
              {objects.length > 0 && (
                <div className="space-y-3 border-t border-zinc-600 pt-4">
                  <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-400">Key props</div>
                  {objects.map((obj) => (
                    <div key={obj.id}>
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-50">{obj.name}</span>
                        <span className="text-[9px] uppercase tracking-wider text-zinc-400">
                          {obj.subjectKind === 'creature' ? 'Creature' : 'Object'}
                        </span>
                      </div>
                      {obj.referenceImageUrls.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {obj.referenceImageUrls.slice(0, 5).map((url, i) => (
                            <RefImage key={`${url}-${i}`} src={url} alt={`${obj.name} reference ${i + 1}`} className="h-24 w-24" />
                          ))}
                        </div>
                      ) : (
                        <EmptyImage label="no refs" className="h-16 w-full" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* SECTION 2 — ENVIRONMENT / SET DESIGN (adaptive by zone count) */}
        <section className="border-b border-zinc-600 px-6 py-5">
          <SectionLabel n={2} onEdit={() => onEditSection('environment')}>Environment / Set Design</SectionLabel>
          {zones.length > 0 ? (
            // ── MULTI-ZONE: a row of zone panels + the cross-zone route strip below ──
            <div className="space-y-4">
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${zones.length}, minmax(0, 1fr))` }}>
                {zones.map((zone) => (
                  <div key={zone.id} className="space-y-2">
                    {zone.heroImageUrl ? (
                      <div className="relative aspect-video w-full overflow-hidden rounded border border-zinc-600 bg-zinc-800">
                        <Image src={zone.heroImageUrl} alt={`${zone.label} hero render`} fill sizes="600px" unoptimized className="object-cover" />
                      </div>
                    ) : (
                      <EmptyImage label="zone hero" className="aspect-video w-full" />
                    )}
                    <div className="truncate text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-400" title={zone.label}>
                      {zone.label}
                    </div>
                    {zone.setDesign && zone.setDesign.length > 0 && (
                      <ul className="list-disc space-y-0.5 pl-4 marker:text-amber-400/60">
                        {zone.setDesign.map((item, i) => (
                          <li key={i} className="text-[10px] leading-snug text-zinc-300">{item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-400">Floor plan — top-down · cross-zone route · camera blocking</div>
                <FloorPlanCanvas
                  floorPlan={plan.floorPlan}
                  shots={orderedShots.map((s) => ({ id: s.id, index: s.index, title: s.title }))}
                  cast={sharedChoices.cast.map((c) => ({ characterId: c.characterId, name: c.name }))}
                  objects={objects.map((o) => ({ id: o.id, name: o.name }))}
                  onChange={onFloorPlanChange}
                />
              </div>
            </div>
          ) : (
            // ── SINGLE-ENVIRONMENT: hero + elevation strip on the left, floor plan on the right ──
            // Measured from OpenArt: environment hero ≈ 469 of section-2's 916 width → ~50/50.
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                {sharedChoices.environmentHeroImageUrl ? (
                  <figure>
                    <div className="relative aspect-video w-full overflow-hidden rounded border border-zinc-600 bg-zinc-800">
                      <Image src={sharedChoices.environmentHeroImageUrl} alt="Environment hero render" fill sizes="600px" unoptimized className="object-cover" />
                    </div>
                    <figcaption className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-400">
                      EXT. — {(sharedChoices.environmentFingerprint || 'Environment').slice(0, 64)}
                    </figcaption>
                  </figure>
                ) : (
                  <EmptyImage label="environment hero" className="aspect-video w-full" />
                )}
                {envImages.length > 0 && (
                  <figure>
                    <div className="relative h-20 w-full overflow-hidden rounded border border-zinc-600 bg-zinc-800">
                      <Image src={envImages[0]} alt="Set elevation / reference" fill sizes="600px" unoptimized className="object-cover" />
                    </div>
                    <figcaption className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-400">Set elevation / reference</figcaption>
                  </figure>
                )}
                {envImages.length > 1 && (
                  <div className="flex flex-wrap gap-1.5">
                    {envImages.slice(1, 4).map((url, i) => (
                      <RefImage key={`${url}-${i}`} src={url} alt={`Environment ${i + 2}`} className="h-16 w-24" />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <div className="mb-1.5 text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-400">Floor plan — top-down · camera blocking</div>
                <FloorPlanCanvas
                  floorPlan={plan.floorPlan}
                  shots={orderedShots.map((s) => ({ id: s.id, index: s.index, title: s.title }))}
                  cast={sharedChoices.cast.map((c) => ({ characterId: c.characterId, name: c.name }))}
                  objects={objects.map((o) => ({ id: o.id, name: o.name }))}
                  onChange={onFloorPlanChange}
                />
              </div>
            </div>
          )}
        </section>
      </div>

      {/* ══ SECTION 3 — LIGHTING / MOOD / CINEMATOGRAPHY (richer than OpenArt — every captured field) ══ */}
      <section className="border-b border-zinc-600 px-6 py-5">
        <SectionLabel n={3} onEdit={() => onEditSection('lighting')}>Lighting · Mood · Cinematography</SectionLabel>
        {sharedChoices.lightingSwatches && sharedChoices.lightingSwatches.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
            {sharedChoices.lightingSwatches.map((sw, i) => (
              <figure key={`${sw.imageUrl}-${i}`}>
                <div className="relative aspect-square w-full overflow-hidden rounded border border-zinc-600 bg-zinc-800">
                  <Image src={sw.imageUrl} alt={sw.label} fill sizes="160px" unoptimized className="object-cover" />
                </div>
                <figcaption className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-wider text-zinc-400" title={sw.label}>
                  {sw.label}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
          {/* Lighting & atmosphere */}
          <div className="space-y-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-400">Lighting &amp; atmosphere</div>
            <Field label="Base lighting" value={look.lighting} />
            <Field label="Atmosphere" value={look.atmosphere} />
            <Field label="Color temperature" value={tempValue} />
            <Field label="Filters / grade" value={look.filters && look.filters.length > 0 ? look.filters.join(', ') : undefined} />
          </div>
          {/* Camera & lens */}
          <div className="space-y-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-400">Camera &amp; lens</div>
            <Field label="Camera body" value={look.camera} />
            <Field label="Lens / focal" value={lensValue} />
            <Field label="Framing" value={framingBits.length > 0 ? framingBits.join(' · ') : undefined} />
            <Field label="Composition" value={look.composition} />
            <Field label="Aspect ratio" value={look.aspectRatio} />
          </div>
          {/* Look & style */}
          <div className="space-y-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-amber-400">Look &amp; style</div>
            <Field label="Art style" value={look.artStyle ?? sharedChoices.artStyle} />
            <Field label="Movie look" value={look.movieLook} />
            <Field label="Film stock" value={look.filmStock} />
            <Field label="DP style" value={dpStyle} />
          </div>
          {/* Mood + cinematography notes */}
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-400">Mood</div>
              <div className="flex flex-wrap gap-1.5">
                {sharedChoices.moodKeywords.length > 0 ? (
                  sharedChoices.moodKeywords.map((k) => (
                    <span key={k} className="rounded-sm border border-zinc-600 bg-zinc-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-200">
                      {k}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-zinc-500">—</span>
                )}
              </div>
            </div>
            {sharedChoices.cinematographyNotes.length > 0 && (
              <div>
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-amber-400">Cinematography notes</div>
                <ul className="list-disc space-y-1 pl-4 marker:text-amber-400/60">
                  {sharedChoices.cinematographyNotes.map((note, i) => (
                    <li key={i} className="text-[11px] leading-snug text-zinc-200">{note}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══ SECTION 4 — STORYBOARD (full-width strip, at the bottom) ══ */}
      <section className="border-b border-zinc-600 px-6 py-5">
        <SectionLabel n={4}>Storyboard</SectionLabel>
        {orderedShots.length === 0 ? (
          <p className="text-xs text-zinc-500">No shots yet.</p>
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {orderedShots.map((shot, i) => (
              <DocStoryboardPanel key={shot.id} shot={shot} position={i} onEdit={() => onEdit(shot.id)} />
            ))}
          </div>
        )}
      </section>

      {/* ══ FOOTER — assembled video prompt ══ */}
      <div className="bg-gradient-to-b from-zinc-700 to-zinc-800 px-6 py-4">
        <div className="mb-1 flex items-center gap-2">
          <Clapperboard className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">Video prompt — opening shot</span>
        </div>
        <p className="font-mono text-[11px] leading-relaxed text-zinc-300">{videoPrompt || '—'}</p>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500">
          <CameraIcon className="h-3 w-3" /> Click any shot, or “Edit”, to change the Shot Doc.
        </div>
      </div>
    </div>
  );
}
