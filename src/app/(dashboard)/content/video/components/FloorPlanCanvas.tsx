'use client';

/**
 * FloorPlanCanvas — interactive TOP-DOWN floor-plan / blocking editor for a Shot
 * Plan. This is the spatial choreography layer that DRIVES the camera: the
 * operator places actors, objects, set pieces, entries and zones on a top-down
 * stage, drops one numbered camera node per shot, aims each camera, draws its
 * movement route, and draws subject motion paths. All of that gets translated
 * into concrete camera-direction prompt language by
 * `describeBlockingForShot(plan, shot)` in `shot-plan-mapping.ts`.
 *
 * CONTROLLED: everything is derived from the `floorPlan` prop; every edit is an
 * immutable update pushed through `onChange`. The only LOCAL state is transient
 * UI (current selection + which marker is being dragged + route/path draw mode).
 *
 * Pure SVG + pointer events — no charting or drag library.
 *
 * TODO (future): an "Auto-block with AI" action that proposes camera positions +
 * subject paths from the shot actions. For now this editor is manual-only plus a
 * deterministic "Auto-place cameras" spread.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Trash2,
  X,
  Camera,
  User,
  Box,
  Square,
  DoorOpen,
  Route as RouteIcon,
  Footprints,
  Eraser,
  LayoutGrid,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CardTitle, Caption, SectionDescription } from '@/components/ui/typography';
import {
  FLOOR_PLAN_ELEMENT_KINDS,
  type ShotPlanFloorPlan,
  type FloorPlanElement,
  type FloorPlanElementKind,
  type FloorPlanCamera,
  type FloorPlanSubjectPath,
  type FloorPlanPoint,
} from '@/types/shot-plan';

// ============================================================================
// Stage geometry — the SVG is a fixed 1000×600 viewBox; all model coordinates
// are normalized [0,1] and scaled into stage units for rendering.
// ============================================================================

const STAGE_W = 1000;
const STAGE_H = 600;
const GRID_STEP = 50;

const EMPTY_FLOOR_PLAN: ShotPlanFloorPlan = { elements: [], cameras: [], subjectPaths: [] };

/** Default lens-cone half-angle when a camera has no explicit fov. */
const DEFAULT_FOV = 50;

/** Clamp a number into [0,1]. */
function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Normalized x → stage x. */
function sx(x: number): number {
  return x * STAGE_W;
}

/** Normalized y → stage y. */
function sy(y: number): number {
  return y * STAGE_H;
}

// ============================================================================
// Selection — what the inline control row below the canvas is editing.
// ============================================================================

type Selection =
  | { kind: 'element'; id: string }
  | { kind: 'camera'; shotId: string }
  | null;

/** Which draw mode is active (each click appends a point to the target). */
type DrawMode =
  | { kind: 'camera-route'; shotId: string }
  | { kind: 'subject-path'; elementId: string }
  | null;

// ============================================================================
// Per-kind marker presentation (design-system tokens only).
// ============================================================================

const ELEMENT_KIND_LABEL: Record<FloorPlanElementKind, string> = {
  actor: 'Actor',
  object: 'Object',
  'set-piece': 'Set piece',
  entry: 'Entry',
  zone: 'Zone',
};

interface FloorPlanCanvasProps {
  floorPlan: ShotPlanFloorPlan | undefined;
  shots: { id: string; index: number; title: string }[];
  cast: { characterId: string; name: string }[];
  objects: { id: string; name: string }[];
  /** Commit handler for edits. Omitted in `readOnly` mode (the diagram is inert). */
  onChange?: (next: ShotPlanFloorPlan) => void;
  /**
   * Display-only mode: hides the toolbar + all inline editing chrome and makes
   * every pointer interaction an inert no-op. The full 1000×600 diagram is still
   * rendered and SCALES TO FIT its parent (height-filling, no clipping) so it can
   * be embedded in a short document cell. Defaults to false (full editor).
   */
  readOnly?: boolean;
}

export function FloorPlanCanvas({
  floorPlan,
  shots,
  cast,
  objects,
  onChange,
  readOnly = false,
}: FloorPlanCanvasProps) {
  const plan = floorPlan ?? EMPTY_FLOOR_PLAN;
  const svgRef = useRef<SVGSVGElement>(null);

  const [selection, setSelection] = useState<Selection>(null);
  const [drawMode, setDrawMode] = useState<DrawMode>(null);
  // The marker currently being dragged (element id or camera shotId) + its type.
  const dragRef = useRef<{ kind: 'element'; id: string } | { kind: 'camera'; shotId: string } | null>(null);

  const orderedShots = useMemo(
    () => [...shots].sort((a, b) => a.index - b.index),
    [shots],
  );

  // ── Immutable mutators — every edit goes through onChange ──
  const setElements = useCallback(
    (elements: FloorPlanElement[]) => {
      onChange?.({ ...plan, elements });
    },
    [plan, onChange],
  );
  const setCameras = useCallback(
    (cameras: FloorPlanCamera[]) => {
      onChange?.({ ...plan, cameras });
    },
    [plan, onChange],
  );
  const setSubjectPaths = useCallback(
    (subjectPaths: FloorPlanSubjectPath[]) => {
      onChange?.({ ...plan, subjectPaths });
    },
    [plan, onChange],
  );

  const patchElement = useCallback(
    (id: string, fields: Partial<FloorPlanElement>) => {
      setElements(plan.elements.map((el) => (el.id === id ? { ...el, ...fields } : el)));
    },
    [plan.elements, setElements],
  );
  const patchCamera = useCallback(
    (shotId: string, fields: Partial<FloorPlanCamera>) => {
      setCameras(plan.cameras.map((c) => (c.shotId === shotId ? { ...c, ...fields } : c)));
    },
    [plan.cameras, setCameras],
  );

  // ── Pointer → normalized coordinate conversion (clamped) ──
  const pointerToNorm = useCallback((clientX: number, clientY: number): FloorPlanPoint => {
    const svg = svgRef.current;
    if (!svg) {
      return { x: 0.5, y: 0.5 };
    }
    const rect = svg.getBoundingClientRect();
    const x = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
    const y = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;
    return { x: clamp01(x), y: clamp01(y) };
  }, []);

  // ── Add-element helpers (toolbar) ──
  const addElement = useCallback(
    (kind: FloorPlanElementKind) => {
      const sameKind = plan.elements.filter((e) => e.kind === kind).length;
      const baseLabel = `${ELEMENT_KIND_LABEL[kind]} ${sameKind + 1}`;
      const el: FloorPlanElement = {
        id: crypto.randomUUID(),
        kind,
        label: baseLabel,
        x: 0.5,
        y: 0.5,
      };
      // Pre-link actor/object to the first available reference, if any.
      if (kind === 'actor' && cast.length > 0) {
        el.refId = cast[0].characterId;
        el.label = cast[0].name;
      } else if (kind === 'object' && objects.length > 0) {
        el.refId = objects[0].id;
        el.label = objects[0].name;
      }
      setElements([...plan.elements, el]);
      setSelection({ kind: 'element', id: el.id });
    },
    [plan.elements, cast, objects, setElements],
  );

  // ── Auto-place cameras: one per shot that lacks a node, spread along y=0.8 ──
  const autoPlaceCameras = useCallback(() => {
    const existing = new Set(plan.cameras.map((c) => c.shotId));
    const missing = orderedShots.filter((s) => !existing.has(s.id));
    if (missing.length === 0) {
      return;
    }
    const newCameras: FloorPlanCamera[] = missing.map((shot, i) => {
      // Spread evenly across x, all on the front row looking up (north).
      const x = missing.length === 1 ? 0.5 : 0.1 + (0.8 * i) / (missing.length - 1);
      return {
        shotId: shot.id,
        x: clamp01(x),
        y: 0.8,
        facing: 0,
        fovDegrees: DEFAULT_FOV,
      };
    });
    setCameras([...plan.cameras, ...newCameras]);
  }, [plan.cameras, orderedShots, setCameras]);

  // ── Drag handling (pointer capture) ──
  const handleMarkerPointerDown = useCallback(
    (
      e: React.PointerEvent,
      target: { kind: 'element'; id: string } | { kind: 'camera'; shotId: string },
    ) => {
      // Display-only: markers are inert (no select, no drag).
      if (readOnly) {
        return;
      }
      // A drag should never also register as a stage click (route/path append).
      e.stopPropagation();
      // While in a draw mode, a marker press selects but does not drag.
      if (drawMode) {
        return;
      }
      e.preventDefault();
      dragRef.current = target;
      setSelection(
        target.kind === 'element'
          ? { kind: 'element', id: target.id }
          : { kind: 'camera', shotId: target.shotId },
      );
      (e.target as Element).setPointerCapture?.(e.pointerId);
    },
    [readOnly, drawMode],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly) {
        return;
      }
      const drag = dragRef.current;
      if (!drag) {
        return;
      }
      const { x, y } = pointerToNorm(e.clientX, e.clientY);
      if (drag.kind === 'element') {
        patchElement(drag.id, { x, y });
      } else {
        patchCamera(drag.shotId, { x, y });
      }
    },
    [readOnly, pointerToNorm, patchElement, patchCamera],
  );

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (readOnly) {
      return;
    }
    if (dragRef.current) {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
      dragRef.current = null;
    }
  }, [readOnly]);

  // ── Stage click — appends a point when a draw mode is active ──
  const handleStageClick = useCallback(
    (e: React.PointerEvent) => {
      if (readOnly || !drawMode) {
        return;
      }
      const point = pointerToNorm(e.clientX, e.clientY);
      if (drawMode.kind === 'camera-route') {
        const cam = plan.cameras.find((c) => c.shotId === drawMode.shotId);
        if (!cam) {
          return;
        }
        patchCamera(drawMode.shotId, { route: [...(cam.route ?? []), point] });
      } else {
        const existing = plan.subjectPaths.find((p) => p.elementId === drawMode.elementId);
        if (existing) {
          setSubjectPaths(
            plan.subjectPaths.map((p) =>
              p.elementId === drawMode.elementId ? { ...p, path: [...p.path, point] } : p,
            ),
          );
        } else {
          setSubjectPaths([...plan.subjectPaths, { elementId: drawMode.elementId, path: [point] }]);
        }
      }
    },
    [readOnly, drawMode, pointerToNorm, plan.cameras, plan.subjectPaths, patchCamera, setSubjectPaths],
  );

  // ── Derived selection objects ──
  const selectedElement =
    selection?.kind === 'element'
      ? plan.elements.find((el) => el.id === selection.id) ?? null
      : null;
  const selectedCamera =
    selection?.kind === 'camera'
      ? plan.cameras.find((c) => c.shotId === selection.shotId) ?? null
      : null;
  const selectedCameraShotIndex =
    selectedCamera != null
      ? orderedShots.findIndex((s) => s.id === selectedCamera.shotId)
      : -1;

  // Camera node → its shot's display number (index+1 in plan order).
  const shotNumberFor = useCallback(
    (shotId: string): number => {
      const i = orderedShots.findIndex((s) => s.id === shotId);
      return i === -1 ? plan.cameras.findIndex((c) => c.shotId === shotId) + 1 : i + 1;
    },
    [orderedShots, plan.cameras],
  );

  const subjectPathFor = useCallback(
    (elementId: string): FloorPlanSubjectPath | undefined =>
      plan.subjectPaths.find((p) => p.elementId === elementId),
    [plan.subjectPaths],
  );

  return (
    <div className={readOnly ? 'flex h-full min-h-0 flex-col gap-2' : 'space-y-4'}>
      {/* Toolbar — editor only */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 border-stone-300 bg-white text-stone-700 hover:border-amber-600 hover:bg-amber-50 hover:text-amber-700" onClick={() => addElement('actor')}>
            <User className="h-3.5 w-3.5" /> Add actor
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-stone-300 bg-white text-stone-700 hover:border-amber-600 hover:bg-amber-50 hover:text-amber-700" onClick={() => addElement('object')}>
            <Box className="h-3.5 w-3.5" /> Add object
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-stone-300 bg-white text-stone-700 hover:border-amber-600 hover:bg-amber-50 hover:text-amber-700" onClick={() => addElement('zone')}>
            <Square className="h-3.5 w-3.5" /> Add zone
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-stone-300 bg-white text-stone-700 hover:border-amber-600 hover:bg-amber-50 hover:text-amber-700" onClick={() => addElement('entry')}>
            <DoorOpen className="h-3.5 w-3.5" /> Add entry
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-stone-300 bg-white text-stone-700 hover:border-amber-600 hover:bg-amber-50 hover:text-amber-700"
            onClick={autoPlaceCameras}
            disabled={orderedShots.length === 0}
            title="Drop a camera node for every shot that doesn't have one"
          >
            <LayoutGrid className="h-3.5 w-3.5" /> Auto-place cameras
          </Button>
        </div>
      )}

      {/* Legend (compact + non-shrinking in read-only so markers stay readable) */}
      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1.5${readOnly ? ' shrink-0' : ''}`}>
        <LegendItem swatch={<span className="h-3 w-3 rounded-full bg-primary" />} label="Actor" />
        <LegendItem swatch={<span className="h-3 w-3 rounded-sm border border-foreground" />} label="Object" />
        <LegendItem swatch={<span className="h-3 w-3 rotate-45 border border-foreground" />} label="Entry" />
        <LegendItem swatch={<span className="h-3 w-3 rounded-sm bg-primary/20 border border-primary/40" />} label="Zone / set piece" />
        <LegendItem swatch={<Camera className="h-3 w-3 text-primary" />} label="Camera (per shot)" />
        <LegendItem swatch={<span className="h-0.5 w-4 bg-primary" />} label="Camera route" />
        <LegendItem
          swatch={<span className="h-0.5 w-4 border-t-2 border-dashed border-muted-foreground" />}
          label="Subject path"
        />
      </div>

      {/* The SVG stage — in read-only mode it fills the parent height and the
          whole viewBox scales to fit (centered, never clipped) inside a
          min-h-0 flex-1 wrapper; in the editor it keeps its fixed 5:3 aspect
          derived from width with no wrapper. */}
      <SvgStageFrame readOnly={readOnly}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
        preserveAspectRatio="xMidYMid meet"
        className={
          readOnly
            ? 'h-full w-full rounded-xl border border-border-strong bg-surface-elevated cursor-default'
            : `aspect-[5/3] w-full rounded-xl border border-border-strong bg-surface-elevated ${
                drawMode ? 'cursor-crosshair' : 'cursor-default'
              }`
        }
        onPointerMove={readOnly ? undefined : handlePointerMove}
        onPointerUp={readOnly ? undefined : handlePointerUp}
        onPointerDown={readOnly ? undefined : handleStageClick}
      >
        {/* Semi-transparent top-down render underlaying the blocking — a birds-eye
            of the set so the camera/marker overlay reads clearly on top of it. */}
        {plan.backdropImageUrl && (
          <image
            href={plan.backdropImageUrl}
            x={0}
            y={0}
            width={STAGE_W}
            height={STAGE_H}
            preserveAspectRatio="xMidYMid slice"
            opacity={0.55}
          />
        )}

        {/* Faint grid */}
        <g className="text-border-light" stroke="currentColor" strokeWidth={1} opacity={0.35}>
          {Array.from({ length: Math.floor(STAGE_W / GRID_STEP) - 1 }, (_, i) => (i + 1) * GRID_STEP).map((x) => (
            <line key={`v-${x}`} x1={x} y1={0} x2={x} y2={STAGE_H} />
          ))}
          {Array.from({ length: Math.floor(STAGE_H / GRID_STEP) - 1 }, (_, i) => (i + 1) * GRID_STEP).map((y) => (
            <line key={`h-${y}`} x1={0} y1={y} x2={STAGE_W} y2={y} />
          ))}
        </g>

        {/* Subject paths (dashed). Keyed by array INDEX too — the same element can
            have more than one path (a character moving across multiple scenes), so
            elementId alone is not unique. */}
        {plan.subjectPaths.map((sp, spi) =>
          sp.path.length >= 2 ? (
            <polyline
              key={`sp-${sp.elementId}-${spi}`}
              points={sp.path.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none"
              className="text-muted-foreground"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeDasharray="8 6"
            />
          ) : null,
        )}
        {plan.subjectPaths.map((sp, spi) =>
          sp.path.map((p, i) => (
            <circle
              key={`spdot-${sp.elementId}-${spi}-${i}`}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={3.5}
              className="text-muted-foreground"
              fill="currentColor"
            />
          )),
        )}

        {/* Camera routes (solid primary polylines + vertex dots) */}
        {plan.cameras.map((cam) =>
          cam.route && cam.route.length >= 2 ? (
            <polyline
              key={`route-${cam.shotId}`}
              points={cam.route.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none"
              className="text-primary"
              stroke="currentColor"
              strokeWidth={3}
            />
          ) : null,
        )}
        {plan.cameras.map((cam) =>
          (cam.route ?? []).map((p, i) => (
            <circle
              key={`routedot-${cam.shotId}-${i}`}
              cx={sx(p.x)}
              cy={sy(p.y)}
              r={4}
              className="text-primary"
              fill="currentColor"
            />
          )),
        )}

        {/* Elements — no selection chrome / drag wiring in read-only mode */}
        {plan.elements.map((el) => (
          <ElementMarker
            key={el.id}
            element={el}
            selected={!readOnly && selection?.kind === 'element' && selection.id === el.id}
            onPointerDown={
              readOnly
                ? undefined
                : (e) => handleMarkerPointerDown(e, { kind: 'element', id: el.id })
            }
          />
        ))}

        {/* Camera nodes — no selection chrome / drag wiring in read-only mode */}
        {plan.cameras.map((cam) => (
          <CameraMarker
            key={`cam-${cam.shotId}`}
            camera={cam}
            number={shotNumberFor(cam.shotId)}
            selected={!readOnly && selection?.kind === 'camera' && selection.shotId === cam.shotId}
            onPointerDown={
              readOnly
                ? undefined
                : (e) => handleMarkerPointerDown(e, { kind: 'camera', shotId: cam.shotId })
            }
          />
        ))}
      </svg>
      </SvgStageFrame>

      {/* Active draw-mode banner — editor only */}
      {!readOnly && drawMode && (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2">
          <Caption className="text-primary">
            {drawMode.kind === 'camera-route'
              ? 'Click on the stage to add camera-route points. Click "Done drawing" when finished.'
              : 'Click on the stage to add subject-path points. Click "Done drawing" when finished.'}
          </Caption>
          <Button variant="outline" size="sm" onClick={() => setDrawMode(null)}>
            Done drawing
          </Button>
        </div>
      )}

      {/* Inline control row for the current selection — editor only */}
      {!readOnly && selectedElement && (
        <ElementControls
          element={selectedElement}
          cast={cast}
          objects={objects}
          drawingPath={drawMode?.kind === 'subject-path' && drawMode.elementId === selectedElement.id}
          hasPath={(subjectPathFor(selectedElement.id)?.path.length ?? 0) > 0}
          onPatch={(fields) => patchElement(selectedElement.id, fields)}
          onToggleDrawPath={() =>
            setDrawMode((cur) =>
              cur?.kind === 'subject-path' && cur.elementId === selectedElement.id
                ? null
                : { kind: 'subject-path', elementId: selectedElement.id },
            )
          }
          onClearPath={() => {
            setSubjectPaths(plan.subjectPaths.filter((p) => p.elementId !== selectedElement.id));
            setDrawMode((cur) =>
              cur?.kind === 'subject-path' && cur.elementId === selectedElement.id ? null : cur,
            );
          }}
          onDelete={() => {
            setElements(plan.elements.filter((el) => el.id !== selectedElement.id));
            setSubjectPaths(plan.subjectPaths.filter((p) => p.elementId !== selectedElement.id));
            setSelection(null);
            setDrawMode(null);
          }}
        />
      )}

      {!readOnly && selectedCamera && (
        <CameraControls
          camera={selectedCamera}
          shotNumber={selectedCameraShotIndex === -1 ? shotNumberFor(selectedCamera.shotId) : selectedCameraShotIndex + 1}
          shotTitle={orderedShots[selectedCameraShotIndex]?.title ?? ''}
          drawingRoute={drawMode?.kind === 'camera-route' && drawMode.shotId === selectedCamera.shotId}
          hasRoute={(selectedCamera.route?.length ?? 0) > 0}
          onPatch={(fields) => patchCamera(selectedCamera.shotId, fields)}
          onToggleDrawRoute={() =>
            setDrawMode((cur) =>
              cur?.kind === 'camera-route' && cur.shotId === selectedCamera.shotId
                ? null
                : { kind: 'camera-route', shotId: selectedCamera.shotId },
            )
          }
          onClearRoute={() => {
            patchCamera(selectedCamera.shotId, { route: [] });
            setDrawMode((cur) =>
              cur?.kind === 'camera-route' && cur.shotId === selectedCamera.shotId ? null : cur,
            );
          }}
          onDelete={() => {
            setCameras(plan.cameras.filter((c) => c.shotId !== selectedCamera.shotId));
            setSelection(null);
            setDrawMode(null);
          }}
        />
      )}

      {!readOnly && !selectedElement && !selectedCamera && (
        <SectionDescription>
          Click a marker to select it. Drag any marker to move it. Use the toolbar to add
          actors, objects, zones and entries, and &quot;Auto-place cameras&quot; to drop a camera
          for every shot.
        </SectionDescription>
      )}
    </div>
  );
}

// ============================================================================
// SVG stage frame — in read-only mode the diagram must fill the parent height
// and scale to fit, so the <svg> is wrapped in a `min-h-0 flex-1` div. In the
// editor there is no wrapper (the <svg> keeps its width-derived 5:3 aspect).
// ============================================================================

function SvgStageFrame({
  readOnly,
  children,
}: {
  readOnly: boolean;
  children: React.ReactNode;
}) {
  if (readOnly) {
    return <div className="min-h-0 flex-1">{children}</div>;
  }
  return <>{children}</>;
}

// ============================================================================
// Legend item
// ============================================================================

function LegendItem({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex h-3 w-4 items-center justify-center">{swatch}</span>
      <Caption>{label}</Caption>
    </span>
  );
}

// ============================================================================
// Element marker (SVG) — distinct shape per kind, label beside it.
// ============================================================================

function ElementMarker({
  element,
  selected,
  onPointerDown,
}: {
  element: FloorPlanElement;
  selected: boolean;
  /** Omitted in read-only mode — the marker is then a non-interactive glyph. */
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const cx = sx(element.x);
  const cy = sy(element.y);
  const selRing = selected ? (
    <circle cx={cx} cy={cy} r={22} className="text-primary" fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="4 4" />
  ) : null;

  // Facing indicator (short line) when set.
  const facingLine =
    element.facing != null ? (
      <line
        x1={cx}
        y1={cy}
        x2={cx + 26 * Math.sin((element.facing * Math.PI) / 180)}
        y2={cy - 26 * Math.cos((element.facing * Math.PI) / 180)}
        className="text-foreground"
        stroke="currentColor"
        strokeWidth={2}
      />
    ) : null;

  let shape: React.ReactNode;
  switch (element.kind) {
    case 'actor':
      shape = <circle cx={cx} cy={cy} r={11} className="text-primary" fill="currentColor" />;
      break;
    case 'object':
      shape = (
        <rect
          x={cx - 10}
          y={cy - 10}
          width={20}
          height={20}
          className="text-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        />
      );
      break;
    case 'entry':
      shape = (
        <rect
          x={cx - 9}
          y={cy - 9}
          width={18}
          height={18}
          transform={`rotate(45 ${cx} ${cy})`}
          className="text-foreground"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
        />
      );
      break;
    case 'zone':
    case 'set-piece':
    default:
      shape = (
        <rect
          x={cx - 28}
          y={cy - 20}
          width={56}
          height={40}
          rx={8}
          className="text-primary"
          fill="currentColor"
          fillOpacity={0.18}
          stroke="currentColor"
          strokeOpacity={0.5}
          strokeWidth={2}
        />
      );
      break;
  }

  return (
    <g onPointerDown={onPointerDown} style={onPointerDown ? { cursor: 'grab' } : undefined}>
      {selRing}
      {facingLine}
      {shape}
      <text
        x={cx + 16}
        y={cy + 4}
        className="fill-foreground"
        fontSize={15}
        fontWeight={500}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {element.label}
      </text>
    </g>
  );
}

// ============================================================================
// Camera marker (SVG) — numbered node + facing line + lens-cone wedge.
// ============================================================================

function CameraMarker({
  camera,
  number,
  selected,
  onPointerDown,
}: {
  camera: FloorPlanCamera;
  number: number;
  selected: boolean;
  /** Omitted in read-only mode — the marker is then a non-interactive glyph. */
  onPointerDown?: (e: React.PointerEvent) => void;
}) {
  const cx = sx(camera.x);
  const cy = sy(camera.y);
  const fov = camera.fovDegrees ?? DEFAULT_FOV;
  const reach = 150;

  // Wedge: two rays at facing ± fov/2 (0° = north / toward top, clockwise).
  const half = (fov / 2) * (Math.PI / 180);
  const facingRad = (camera.facing * Math.PI) / 180;
  const a1 = facingRad - half;
  const a2 = facingRad + half;
  const p1 = { x: cx + reach * Math.sin(a1), y: cy - reach * Math.cos(a1) };
  const p2 = { x: cx + reach * Math.sin(a2), y: cy - reach * Math.cos(a2) };

  const facingEnd = { x: cx + 40 * Math.sin(facingRad), y: cy - 40 * Math.cos(facingRad) };

  return (
    <g onPointerDown={onPointerDown} style={onPointerDown ? { cursor: 'grab' } : undefined}>
      {/* Lens cone */}
      <path
        d={`M ${cx} ${cy} L ${p1.x} ${p1.y} L ${p2.x} ${p2.y} Z`}
        className="text-primary"
        fill="currentColor"
        fillOpacity={0.12}
        stroke="currentColor"
        strokeOpacity={0.35}
        strokeWidth={1.5}
      />
      {/* Facing line */}
      <line x1={cx} y1={cy} x2={facingEnd.x} y2={facingEnd.y} className="text-primary" stroke="currentColor" strokeWidth={2.5} />
      {/* Selection ring */}
      {selected && (
        <circle cx={cx} cy={cy} r={20} className="text-primary" fill="none" stroke="currentColor" strokeWidth={2} strokeDasharray="4 4" />
      )}
      {/* Node */}
      <circle cx={cx} cy={cy} r={14} className="text-primary" fill="currentColor" />
      <text
        x={cx}
        y={cy + 5}
        textAnchor="middle"
        className="fill-card"
        fontSize={15}
        fontWeight={700}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {number}
      </text>
    </g>
  );
}

// ============================================================================
// Two-step-confirm delete (project rule for destructive actions).
// ============================================================================

function ConfirmDelete({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const disarm = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setArmed(false);
  }, []);

  const handleClick = useCallback(() => {
    if (armed) {
      disarm();
      onConfirm();
      return;
    }
    setArmed(true);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setArmed(false);
    }, 5000);
  }, [armed, disarm, onConfirm]);

  if (armed) {
    return (
      <span className="inline-flex items-center gap-1">
        <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={handleClick}>
          <Trash2 className="h-3.5 w-3.5" /> Click again to confirm
        </Button>
        <button
          type="button"
          onClick={disarm}
          aria-label="Cancel delete"
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={handleClick} aria-label={label} title={label}>
      <Trash2 className="h-3.5 w-3.5" /> Delete
    </Button>
  );
}

// ============================================================================
// Inline element controls
// ============================================================================

function ElementControls({
  element,
  cast,
  objects,
  drawingPath,
  hasPath,
  onPatch,
  onToggleDrawPath,
  onClearPath,
  onDelete,
}: {
  element: FloorPlanElement;
  cast: { characterId: string; name: string }[];
  objects: { id: string; name: string }[];
  drawingPath: boolean;
  hasPath: boolean;
  onPatch: (fields: Partial<FloorPlanElement>) => void;
  onToggleDrawPath: () => void;
  onClearPath: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="space-y-3 rounded-2xl border border-border-strong bg-card p-4">
      <CardTitle className="flex items-center gap-2">
        <User className="h-4 w-4 text-primary" /> {ELEMENT_KIND_LABEL[element.kind]} settings
      </CardTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="space-y-1">
          <Caption className="font-medium text-muted-foreground">Label</Caption>
          <Input
            value={element.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            placeholder="e.g. Bear start zone"
            className="bg-surface-elevated border-border-strong text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="space-y-1">
          <Caption className="font-medium text-muted-foreground">Kind</Caption>
          <select
            value={element.kind}
            onChange={(e) => onPatch({ kind: e.target.value as FloorPlanElementKind })}
            className="w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground"
          >
            {FLOOR_PLAN_ELEMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {ELEMENT_KIND_LABEL[k]}
              </option>
            ))}
          </select>
        </div>
        {element.kind === 'actor' && (
          <div className="space-y-1">
            <Caption className="font-medium text-muted-foreground">Linked cast member</Caption>
            <select
              value={element.refId ?? ''}
              onChange={(e) => onPatch({ refId: e.target.value || undefined })}
              className="w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground"
            >
              <option value="">Not linked</option>
              {cast.map((c) => (
                <option key={c.characterId} value={c.characterId}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {element.kind === 'object' && (
          <div className="space-y-1">
            <Caption className="font-medium text-muted-foreground">Linked object</Caption>
            <select
              value={element.refId ?? ''}
              onChange={(e) => onPatch({ refId: e.target.value || undefined })}
              className="w-full rounded-md border border-border-strong bg-surface-elevated px-3 py-2 text-sm text-foreground"
            >
              <option value="">Not linked</option>
              {objects.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border-light pt-3">
        <Button
          variant={drawingPath ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5 border-stone-300 bg-white text-stone-700 hover:border-amber-600 hover:bg-amber-50 hover:text-amber-700"
          onClick={onToggleDrawPath}
        >
          <Footprints className="h-3.5 w-3.5" />
          {drawingPath ? 'Click stage to add points' : 'Draw motion path'}
        </Button>
        {hasPath && (
          <Button variant="outline" size="sm" className="gap-1.5 border-stone-300 bg-white text-stone-700 hover:border-amber-600 hover:bg-amber-50 hover:text-amber-700" onClick={onClearPath}>
            <Eraser className="h-3.5 w-3.5" /> Clear path
          </Button>
        )}
        <span className="ml-auto">
          <ConfirmDelete onConfirm={onDelete} label={`Delete ${element.label}`} />
        </span>
      </div>
    </div>
  );
}

// ============================================================================
// Inline camera controls
// ============================================================================

function CameraControls({
  camera,
  shotNumber,
  shotTitle,
  drawingRoute,
  hasRoute,
  onPatch,
  onToggleDrawRoute,
  onClearRoute,
  onDelete,
}: {
  camera: FloorPlanCamera;
  shotNumber: number;
  shotTitle: string;
  drawingRoute: boolean;
  hasRoute: boolean;
  onPatch: (fields: Partial<FloorPlanCamera>) => void;
  onToggleDrawRoute: () => void;
  onClearRoute: () => void;
  onDelete: () => void;
}) {
  const fov = camera.fovDegrees ?? DEFAULT_FOV;
  return (
    <div className="space-y-3 rounded-2xl border border-border-strong bg-card p-4">
      <CardTitle className="flex items-center gap-2">
        <Camera className="h-4 w-4 text-primary" /> Camera for shot {shotNumber}
        {shotTitle ? <span className="text-muted-foreground">— {shotTitle}</span> : null}
      </CardTitle>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Caption className="font-medium text-muted-foreground">Facing</Caption>
            <Caption>{Math.round(camera.facing)}°</Caption>
          </div>
          <input
            type="range"
            min={0}
            max={359}
            value={Math.round(camera.facing)}
            onChange={(e) => onPatch({ facing: Number(e.target.value) })}
            aria-label="Camera facing angle"
            className="w-full accent-primary"
          />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <Caption className="font-medium text-muted-foreground">Field of view</Caption>
            <Caption>{Math.round(fov)}°</Caption>
          </div>
          <input
            type="range"
            min={20}
            max={120}
            value={Math.round(fov)}
            onChange={(e) => onPatch({ fovDegrees: Number(e.target.value) })}
            aria-label="Camera field of view"
            className="w-full accent-primary"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-border-light pt-3">
        <Button
          variant={drawingRoute ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5 border-stone-300 bg-white text-stone-700 hover:border-amber-600 hover:bg-amber-50 hover:text-amber-700"
          onClick={onToggleDrawRoute}
        >
          <RouteIcon className="h-3.5 w-3.5" />
          {drawingRoute ? 'Click stage to add points' : 'Draw route'}
        </Button>
        {hasRoute && (
          <Button variant="outline" size="sm" className="gap-1.5 border-stone-300 bg-white text-stone-700 hover:border-amber-600 hover:bg-amber-50 hover:text-amber-700" onClick={onClearRoute}>
            <Eraser className="h-3.5 w-3.5" /> Clear route
          </Button>
        )}
        <span className="ml-auto">
          <ConfirmDelete onConfirm={onDelete} label={`Delete camera for shot ${shotNumber}`} />
        </span>
      </div>
    </div>
  );
}
