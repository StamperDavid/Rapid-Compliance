'use client';

import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

export interface Deal {
  id: string;
  name: string;
  company?: string;
  companyName?: string;
  value?: number;
  stage?: string;
  probability?: number;
  source?: string;
  leadId?: string;
  pipelineId?: string;
}

/** A renderable stage column: the persisted `key` plus its display `label`. */
export interface BoardStage {
  key: string;
  label: string;
}

interface StageColor {
  bgStyle: React.CSSProperties;
  borderStyle: React.CSSProperties;
  textStyle: React.CSSProperties;
  icon: string;
}

interface PipelineBoardProps {
  stages: BoardStage[];
  stageColors: Record<string, StageColor>;
  deals: Deal[];
  getCompanyName: (deal: Deal) => string;
  /** Optimistically update the board's deal list (updater-function form, matching usePagination.setData). */
  setDeals: (updater: (prev: Deal[]) => Deal[]) => void;
  /** Persists the stage change. Returns true on success, false on failure. */
  onMoveDeal: (dealId: string, stage: string) => Promise<boolean>;
  /** Navigate to a deal's detail page (only fires on a genuine click, not a drag). */
  onOpenDeal: (dealId: string) => void;
}

interface DealCardProps {
  deal: Deal;
  getCompanyName: (deal: Deal) => string;
  onOpenDeal: (dealId: string) => void;
}

/** Visual card content shared by the draggable card and the drag overlay. */
function DealCardContent({ deal, getCompanyName }: Pick<DealCardProps, 'deal' | 'getCompanyName'>) {
  return (
    <>
      <div className="font-medium text-foreground text-sm mb-1 group-hover:text-primary-light transition-colors">
        {deal.name}
      </div>
      <div className="text-xs text-muted-foreground mb-2">{getCompanyName(deal)}</div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-primary">${(deal.value ?? 0).toLocaleString()}</span>
        <span className="text-xs text-muted-foreground">{deal.probability ?? 0}%</span>
      </div>
    </>
  );
}

function DealCard({ deal, getCompanyName, onOpenDeal }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { stage: deal.stage },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      role="button"
      tabIndex={0}
      onClick={() => onOpenDeal(deal.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpenDeal(deal.id);
        }
      }}
      className="bg-surface-elevated hover:bg-surface-elevated border border-border-light hover:border-primary rounded-xl p-3 cursor-grab active:cursor-grabbing transition-colors group touch-none focus:outline-none focus:ring-2 focus:ring-primary"
    >
      <DealCardContent deal={deal} getCompanyName={getCompanyName} />
    </div>
  );
}

interface StageColumnProps {
  stageKey: string;
  stageLabel: string;
  colors: StageColor;
  deals: Deal[];
  getCompanyName: (deal: Deal) => string;
  onOpenDeal: (dealId: string) => void;
  stageIdx: number;
}

function StageColumn({ stageKey, stageLabel, colors, deals, getCompanyName, onOpenDeal, stageIdx }: StageColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stageKey });
  const stageValue = deals.reduce((sum, d) => sum + (d.value ?? 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: stageIdx * 0.05 }}
      className={`rounded-2xl bg-surface-paper backdrop-blur-xl border overflow-hidden transition-colors ${
        isOver ? 'border-primary ring-2 ring-primary/40' : 'border-border-light'
      }`}
    >
      {/* Stage Header */}
      <div className="p-4 border-b border-border-light" style={colors.bgStyle}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">{colors.icon}</span>
          <h3 className="font-semibold text-foreground text-sm">{stageLabel}</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{deals.length} deals</span>
          <span>&bull;</span>
          <span className="text-primary font-medium">${stageValue.toLocaleString()}</span>
        </div>
      </div>

      {/* Deal Cards (droppable area) */}
      <div ref={setNodeRef} className="p-3 space-y-2 min-h-24 max-h-96 overflow-y-auto">
        {deals.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground text-sm">
            {isOver ? 'Drop here' : 'No deals'}
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              getCompanyName={getCompanyName}
              onOpenDeal={onOpenDeal}
            />
          ))
        )}
      </div>
    </motion.div>
  );
}

export default function PipelineBoard({
  stages,
  stageColors,
  deals,
  getCompanyName,
  setDeals,
  onMoveDeal,
  onOpenDeal,
}: PipelineBoardProps) {
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  // Require a small drag distance before activating so plain clicks still open the deal.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const getDealsByStage = (stageKey: string) => deals.filter((d) => d.stage === stageKey);

  const handleDragStart = (event: DragStartEvent) => {
    const deal = deals.find((d) => d.id === event.active.id);
    setActiveDeal(deal ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveDeal(null);

    if (!over) { return; }

    const dealId = String(active.id);
    const targetStage = String(over.id);
    const deal = deals.find((d) => d.id === dealId);

    if (!deal) { return; }
    const previousStage = deal.stage;
    if (previousStage === targetStage) { return; }
    if (!stages.some((s) => s.key === targetStage)) { return; }

    setMoveError(null);

    // Optimistically move the card.
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: targetStage } : d)));

    const ok = await onMoveDeal(dealId, targetStage);
    if (!ok) {
      // Revert on failure.
      setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: previousStage } : d)));
      setMoveError(`Couldn't move "${deal.name}". Please try again.`);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={(event) => void handleDragEnd(event)}
      onDragCancel={() => setActiveDeal(null)}
    >
      {moveError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 rounded-xl border border-error/20 flex items-center gap-3"
          style={{ backgroundColor: 'rgba(var(--color-error-rgb), 0.1)' }}
        >
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0" />
          <span className="text-error-light text-sm">{moveError}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stages.map((stage, stageIdx) => (
          <StageColumn
            key={stage.key}
            stageKey={stage.key}
            stageLabel={stage.label}
            colors={stageColors[stage.key]}
            deals={getDealsByStage(stage.key)}
            getCompanyName={getCompanyName}
            onOpenDeal={onOpenDeal}
            stageIdx={stageIdx}
          />
        ))}
      </div>

      <DragOverlay>
        {activeDeal ? (
          <div className="bg-surface-elevated border border-primary rounded-xl p-3 shadow-2xl shadow-primary/30 cursor-grabbing w-64">
            <DealCardContent deal={activeDeal} getCompanyName={getCompanyName} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
