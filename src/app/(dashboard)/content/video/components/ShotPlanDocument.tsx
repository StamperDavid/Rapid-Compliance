/**
 * Shot Plan DOCUMENT — the cinematic, film-studio "production sheet" view.
 *
 * This is a DISPLAY-first rendering of a ShotPlan (the OpenArt-style document):
 * image-forward, dense, dark, with small uppercase technical labels — NOT a form.
 * Editing lives in the form view (toggled by the parent); this surface is for
 * review, plus the inline-interactive floor-plan canvas and click-a-shot-to-edit.
 *
 * Styling latitude (operator-approved, Jun 13 2026): this one surface deliberately
 * breaks from the standard dashboard tokens to achieve a cinematic dark "printed
 * production sheet" feel, using Tailwind's zinc/amber scale (no raw hex).
 */

'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { Clapperboard, Link2, Scissors, Camera as CameraIcon, Pencil, ImageOff } from 'lucide-react';

import { FloorPlanCanvas } from './FloorPlanCanvas';
import { composeShotGenerationPrompt } from '@/lib/video/shot-plan-mapping';
import type { ShotPlan, ShotPlanShot, ShotPlanFloorPlan } from '@/types/shot-plan';

interface ShotPlanDocumentProps {
  plan: ShotPlan;
  /** Switch to the form/edit view focused on a shot (or the whole plan when null). */
  onEdit: (shotId: string | null) => void;
  /** Floor plan is editable inline on the document (drag), committed via this. */
  onFloorPlanChange: (floorPlan: ShotPlanFloorPlan) => void;
}

// ── Small presentational atoms ──────────────────────────────────────────────

function SectionLabel({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-amber-400/20 text-[11px] font-bold text-amber-400">
        {n}
      </span>
      <h3 className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-300">{children}</h3>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  if (!value?.trim()) {
    return null;
  }
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">{label}</div>
      <div className="truncate text-xs text-zinc-200" title={value}>{value}</div>
    </div>
  );
}

function RefImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded border border-zinc-700 bg-zinc-900 ${className ?? 'h-20 w-20'}`}>
      <Image src={src} alt={alt} fill sizes="160px" unoptimized className="object-cover" />
    </div>
  );
}

function EmptyImage({ label, className }: { label: string; className?: string }) {
  return (
    <div
      className={`flex flex-col items-center justify-center gap-1 rounded border border-dashed border-zinc-700 bg-zinc-900 text-zinc-600 ${className ?? 'h-20 w-full'}`}
    >
      <ImageOff className="h-5 w-5" />
      <span className="text-[9px] uppercase tracking-wider">{label}</span>
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
      className="group relative flex w-60 flex-shrink-0 flex-col overflow-hidden rounded border border-zinc-700 bg-zinc-900 text-left transition-colors hover:border-amber-400/60"
    >
      <div className="relative aspect-video bg-zinc-950">
        {still ? (
          <Image src={still} alt={`Cut ${position + 1}`} fill sizes="240px" unoptimized className="object-cover" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-zinc-700">
            <ImageOff className="h-6 w-6" />
          </div>
        )}
        <div className="absolute left-1.5 top-1.5 flex items-center gap-1">
          <span className="rounded-sm bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-amber-400">
            {position + 1}
          </span>
          <span className="inline-flex items-center gap-0.5 rounded-sm bg-black/80 px-1 py-0.5 text-[9px] uppercase tracking-wide text-zinc-300">
            {shot.transitionIn === 'continue' ? (
              <><Link2 className="h-2.5 w-2.5 text-amber-400" /> cont</>
            ) : (
              <><Scissors className="h-2.5 w-2.5 text-amber-400" /> cut</>
            )}
          </span>
        </div>
        <span className="absolute right-1.5 top-1.5 rounded-sm bg-black/70 p-1 text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">
          <Pencil className="h-3 w-3" />
        </span>
      </div>
      <div className="space-y-1 border-t border-zinc-800 p-2">
        <div className="truncate font-mono text-[10px] uppercase tracking-wide text-amber-400/90">
          {specs.length > 0 ? specs.join(' · ') : 'camera —'} · {shot.durationSeconds}s
        </div>
        <div className="line-clamp-2 text-[11px] leading-snug text-zinc-300">
          {shot.action?.trim() || shot.title?.trim() || 'Untitled shot'}
        </div>
      </div>
    </button>
  );
}

// ── The document ────────────────────────────────────────────────────────────

export function ShotPlanDocument({ plan, onEdit, onFloorPlanChange }: ShotPlanDocumentProps) {
  const { sharedChoices } = plan;
  const look = sharedChoices.lookBible ?? {};
  const orderedShots = [...plan.shots].sort((a, b) => a.index - b.index);
  const objects = sharedChoices.objects ?? [];
  const envImages = sharedChoices.environmentReferenceImageUrls ?? [];

  // The assembled "video prompt" — the composed prompt of the opening shot, the
  // single best representation of how the plan reads to the engine.
  const videoPrompt = orderedShots[0] ? composeShotGenerationPrompt(plan, orderedShots[0]) : '';

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 text-zinc-200 shadow-2xl">
      {/* ══ SHARED CHOICES header bar ══ */}
      <div className="border-b border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 px-6 py-4">
        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400">Shared Choices</span>
          <span className="text-[10px] uppercase tracking-wider text-zinc-500">{plan.title || 'Untitled production'}</span>
          <button
            type="button"
            onClick={() => onEdit(null)}
            className="ml-auto inline-flex items-center gap-1 rounded border border-zinc-700 px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-300 transition-colors hover:border-amber-400/60 hover:text-amber-400"
          >
            <Pencil className="h-3 w-3" /> Edit
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">Cut count</div>
            <div className="font-mono text-lg font-bold text-amber-400">{orderedShots.length}</div>
          </div>
          <div>
            <div className="mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">Color palette</div>
            {sharedChoices.colorPalette.length > 0 ? (
              <div className="flex items-end gap-1.5">
                {sharedChoices.colorPalette.slice(0, 8).map((sw, i) => (
                  <figure key={`${sw.hex}-${i}`} className="text-center">
                    <span
                      title={sw.name}
                      className="block h-6 w-10 rounded-sm border border-zinc-700"
                      style={{ backgroundColor: sw.hex }}
                    />
                    <figcaption className="mt-0.5 font-mono text-[7px] uppercase tracking-tight text-zinc-500">{sw.hex}</figcaption>
                  </figure>
                ))}
              </div>
            ) : (
              <span className="text-xs text-zinc-600">—</span>
            )}
          </div>
          <div className="min-w-[200px] flex-1">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">Environment fingerprint</div>
            <div className="line-clamp-2 text-xs text-zinc-300">{sharedChoices.environmentFingerprint || '—'}</div>
          </div>
        </div>
      </div>

      {/* ══ Top row: Section 1 (Characters & Objects) | Section 2 (Environment + Floor Plan) ══ */}
      <div className="grid grid-cols-1 lg:grid-cols-2">
        {/* SECTION 1 — CHARACTERS & OBJECTS */}
        <section className="border-b border-zinc-800 px-6 py-5 lg:border-r">
          <SectionLabel n={1}>Characters &amp; Objects</SectionLabel>
          {sharedChoices.cast.length === 0 && objects.length === 0 ? (
            <p className="text-xs text-zinc-600">No cast or objects yet.</p>
          ) : (
            <div className="space-y-4">
              {sharedChoices.cast.map((member) => {
                const views =
                  member.modelSheet && member.modelSheet.length > 0
                    ? member.modelSheet
                    : member.referenceImageUrls.map((url) => ({ label: 'REF', imageUrl: url }));
                return (
                  <div key={member.characterId}>
                    <div className="mb-2 flex items-center gap-2 border-b border-zinc-800 pb-1">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-100">{member.name}</span>
                      {member.role && <span className="text-[9px] uppercase tracking-wider text-amber-400/80">{member.role}</span>}
                      <span className="ml-auto text-[9px] uppercase tracking-wider text-zinc-600">Model sheet</span>
                    </div>
                    {views.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {views.slice(0, 6).map((v, i) => (
                          <figure key={`${v.imageUrl}-${i}`} className="w-[74px]">
                            <div className="relative h-24 w-[74px] overflow-hidden rounded border border-zinc-700 bg-zinc-900">
                              <Image src={v.imageUrl} alt={`${member.name} ${v.label}`} fill sizes="74px" unoptimized className="object-cover" />
                            </div>
                            <figcaption className="mt-0.5 text-center text-[8px] font-bold uppercase tracking-[0.1em] text-zinc-500">
                              {v.label}
                            </figcaption>
                          </figure>
                        ))}
                      </div>
                    ) : (
                      <EmptyImage label="no refs" className="h-16 w-full" />
                    )}
                  </div>
                );
              })}
              {objects.map((obj) => (
                <div key={obj.id}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-200">{obj.name}</span>
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500">object</span>
                  </div>
                  {obj.referenceImageUrls.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {obj.referenceImageUrls.slice(0, 6).map((url, i) => (
                        <RefImage key={`${url}-${i}`} src={url} alt={`${obj.name} reference ${i + 1}`} className="h-16 w-16" />
                      ))}
                    </div>
                  ) : (
                    <EmptyImage label="no refs" className="h-16 w-full" />
                  )}
                </div>
              ))}
            </div>
          )}
          {/* Material language / look chips */}
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-zinc-800 pt-3">
            <Field label="Art style" value={look.artStyle ?? sharedChoices.artStyle} />
            <Field label="Film stock" value={look.filmStock} />
            <Field label="Camera" value={look.camera} />
            <Field label="Movie look" value={look.movieLook} />
          </div>
        </section>

        {/* SECTION 2 — ENVIRONMENT + FLOOR PLAN */}
        <section className="border-b border-zinc-800 px-6 py-5">
          <SectionLabel n={2}>Environment &amp; Floor Plan</SectionLabel>
          {sharedChoices.environmentHeroImageUrl && (
            <figure className="mb-3">
              <div className="relative aspect-video w-full overflow-hidden rounded border border-zinc-700 bg-zinc-900">
                <Image src={sharedChoices.environmentHeroImageUrl} alt="Environment hero render" fill sizes="600px" unoptimized className="object-cover" />
              </div>
              <figcaption className="mt-1 text-[8px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                EXT. — {(sharedChoices.environmentFingerprint || 'Environment').slice(0, 64)}
              </figcaption>
            </figure>
          )}
          {envImages.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {envImages.slice(0, 4).map((url, i) => (
                <RefImage key={`${url}-${i}`} src={url} alt={`Environment ${i + 1}`} className="h-20 w-28" />
              ))}
            </div>
          )}
          <FloorPlanCanvas
            floorPlan={plan.floorPlan}
            shots={orderedShots.map((s) => ({ id: s.id, index: s.index, title: s.title }))}
            cast={sharedChoices.cast.map((c) => ({ characterId: c.characterId, name: c.name }))}
            objects={objects.map((o) => ({ id: o.id, name: o.name }))}
            onChange={onFloorPlanChange}
          />
        </section>
      </div>

      {/* ══ SECTION 3 — STORYBOARD (full-width strip) ══ */}
      <section className="border-b border-zinc-800 px-6 py-5">
        <SectionLabel n={3}>Storyboard</SectionLabel>
        {orderedShots.length === 0 ? (
          <p className="text-xs text-zinc-600">No shots yet.</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {orderedShots.map((shot, i) => (
              <DocStoryboardPanel key={shot.id} shot={shot} position={i} onEdit={() => onEdit(shot.id)} />
            ))}
          </div>
        )}
      </section>

      {/* ══ SECTION 4 — LIGHTING / MOOD / STYLE ══ */}
      <section className="border-b border-zinc-800 px-6 py-5">
        <SectionLabel n={4}>Lighting · Mood · Style</SectionLabel>
        {sharedChoices.lightingSwatches && sharedChoices.lightingSwatches.length > 0 && (
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {sharedChoices.lightingSwatches.map((sw, i) => (
              <figure key={`${sw.imageUrl}-${i}`}>
                <div className="relative aspect-square w-full overflow-hidden rounded border border-zinc-700 bg-zinc-900">
                  <Image src={sw.imageUrl} alt={sw.label} fill sizes="140px" unoptimized className="object-cover" />
                </div>
                <figcaption className="mt-0.5 truncate text-[8px] font-bold uppercase tracking-wider text-zinc-500" title={sw.label}>
                  {sw.label}
                </figcaption>
              </figure>
            ))}
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="space-y-2">
            <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">Lighting &amp; cinematography</div>
            <Field label="Base lighting" value={look.lighting} />
            <Field label="Atmosphere" value={look.atmosphere} />
            <Field label="DP style" value={look.videographerStyle ?? look.photographerStyle} />
            {sharedChoices.cinematographyNotes.length > 0 && (
              <p className="text-[11px] leading-snug text-zinc-400">{sharedChoices.cinematographyNotes.join('. ')}</p>
            )}
          </div>
          <div>
            <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-zinc-500">Build keywords</div>
            <div className="flex flex-wrap gap-1.5">
              {sharedChoices.moodKeywords.length > 0 ? (
                sharedChoices.moodKeywords.map((k) => (
                  <span key={k} className="rounded-sm border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-wide text-zinc-300">
                    {k}
                  </span>
                ))
              ) : (
                <span className="text-xs text-zinc-600">—</span>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Field label="Composition" value={look.composition} />
            <Field label="Lens / focal" value={look.lensType ?? look.focalLength} />
            <Field label="Aspect ratio" value={look.aspectRatio} />
          </div>
        </div>
      </section>

      {/* ══ FOOTER — assembled video prompt ══ */}
      <div className="bg-gradient-to-b from-zinc-950 to-zinc-900 px-6 py-4">
        <div className="mb-1 flex items-center gap-2">
          <Clapperboard className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Video prompt — opening shot</span>
        </div>
        <p className="font-mono text-[11px] leading-relaxed text-zinc-400">{videoPrompt || '—'}</p>
        <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-600">
          <CameraIcon className="h-3 w-3" /> Click any shot, or “Edit”, to change the plan.
        </div>
      </div>
    </div>
  );
}
