'use client';

import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, RefreshCw, Play, ThumbsUp, ThumbsDown, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SceneGenerationResult } from '@/types/video-pipeline';
import { StarRating } from './StarRating';
import { AutoGradeMetrics } from './AutoGradeMetrics';

type ReviewStatus = 'pending' | 'approved' | 'rejected';

interface SceneProgressCardProps {
  sceneNumber: number;
  result: SceneGenerationResult;
  shotGroupLabel?: string | null;  // e.g., "Shot 1, Part 2 of 3"
  onRetry?: (sceneId: string) => void;
  onRegenerate?: (sceneId: string, feedback: string) => void;
  onApprove?: (sceneId: string) => void;
  onStarRate?: (sceneId: string, grade: number) => void;
}

export function SceneProgressCard({ sceneNumber, result, shotGroupLabel, onRetry, onRegenerate, onApprove, onStarRate }: SceneProgressCardProps) {
  const [reviewStatus, setReviewStatus] = useState<ReviewStatus>('pending');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [humanGrade, setHumanGrade] = useState(0);

  const statusConfig = {
    draft: { icon: Loader2, color: 'text-muted-foreground', bg: 'bg-surface-elevated/50', label: 'Pending' },
    approved: { icon: Loader2, color: 'text-muted-foreground', bg: 'bg-surface-elevated/50', label: 'Queued' },
    generating: { icon: Loader2, color: 'text-primary-light', bg: 'bg-primary/10', label: 'Generating' },
    persisting: { icon: Loader2, color: 'text-primary-light', bg: 'bg-primary/10', label: 'Saving' },
    completed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Complete' },
    failed: { icon: XCircle, color: 'text-destructive', bg: 'bg-destructive/10', label: 'Failed' },
  };

  const config = statusConfig[result.status];
  const Icon = config.icon;
  const isAnimating = result.status === 'generating' || result.status === 'persisting';
  const isComplete = result.status === 'completed' && result.videoUrl;

  const handleApprove = () => {
    setReviewStatus('approved');
    setShowFeedback(false);
    setFeedback('');
    if (onApprove) {
      onApprove(result.sceneId);
    }
  };

  const handleReject = () => {
    setReviewStatus('rejected');
    setShowFeedback(true);
  };

  const handleSubmitFeedback = () => {
    if (onRegenerate && feedback.trim()) {
      onRegenerate(result.sceneId, feedback.trim());
      setReviewStatus('pending');
      setShowFeedback(false);
      setFeedback('');
    }
  };

  return (
    <div className={cn(
      'rounded-lg border border-border-strong/50 overflow-hidden',
      config.bg,
      reviewStatus === 'approved' && isComplete && 'border-green-500/30',
      reviewStatus === 'rejected' && isComplete && 'border-destructive/30',
    )}>
      {/* Main Row */}
      <div className="flex items-center gap-4 p-4">
        {/* Scene Number */}
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-border-strong/50 text-foreground text-sm font-bold">
          {sceneNumber}
        </div>

        {/* Status Icon */}
        <Icon className={cn('w-5 h-5 flex-shrink-0', config.color, isAnimating && 'animate-spin')} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={cn('text-sm font-medium', config.color)}>{config.label}</span>
            <span className="text-xs text-muted-foreground">Hedra</span>
            {reviewStatus === 'approved' && isComplete && (
              <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[9px] font-bold rounded">APPROVED</span>
            )}
            {reviewStatus === 'rejected' && isComplete && (
              <span className="px-1.5 py-0.5 bg-destructive/20 text-destructive text-[9px] font-bold rounded">NEEDS REVISION</span>
            )}
            {shotGroupLabel && (
              <span className="px-1.5 py-0.5 bg-blue-500/20 text-blue-400 text-[9px] font-bold rounded">
                {shotGroupLabel}
              </span>
            )}
          </div>

          {/* Progress Bar */}
          {result.status === 'generating' && (
            <div className="mt-2 w-full h-1.5 bg-border-strong rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-500"
                style={{ width: `${result.progress}%` }}
              />
            </div>
          )}

          {/* Error Message */}
          {result.status === 'failed' && result.error && (
            <p className="text-xs text-destructive mt-1 truncate">{result.error}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Preview toggle for completed scenes */}
          {isComplete && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPreview(!showPreview)}
              className={cn(
                'h-8 gap-1',
                showPreview ? 'text-primary-light hover:text-primary-light' : 'text-green-400 hover:text-green-300'
              )}
            >
              <Play className="w-3.5 h-3.5" />
              {showPreview ? 'Hide' : 'Preview'}
            </Button>
          )}

          {/* Review buttons for completed scenes */}
          {isComplete && reviewStatus === 'pending' && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleApprove}
                className="h-8 w-8 p-0 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                title="Approve this scene"
              >
                <ThumbsUp className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReject}
                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                title="Request revision"
              >
                <ThumbsDown className="w-3.5 h-3.5" />
              </Button>
            </>
          )}

          {/* Undo approval */}
          {isComplete && reviewStatus === 'approved' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setReviewStatus('pending')}
              className="h-8 gap-1 text-muted-foreground hover:text-foreground text-[10px]"
            >
              Undo
            </Button>
          )}

          {/* Failed scene retry */}
          {result.status === 'failed' && onRetry && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRetry(result.sceneId)}
              className="h-8 gap-1 text-primary-light hover:text-primary-light"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry
            </Button>
          )}
        </div>
      </div>

      {/* Inline Video Preview — use proxy URL so expired Hedra CDN links are re-resolved */}
      {isComplete && showPreview && (
        <div className="px-4 pb-3">
          <video
            src={result.providerVideoId ? `/api/video/stream/${result.providerVideoId}` : (result.videoUrl ?? undefined)}
            controls
            className="w-full max-h-64 rounded-lg bg-black"
            preload="metadata"
          />
        </div>
      )}

      {/* Auto-Grade Metrics — shown when auto-grade data available */}
      {isComplete && (
        <div className="px-4 pb-2">
          <AutoGradeMetrics
            autoGrade={result.autoGrade ?? null}
            status={result.autoGradeStatus ?? null}
          />
        </div>
      )}

      {/* Star Rating + Feedback — shown for completed scenes */}
      {isComplete && reviewStatus === 'pending' && (
        <div className="px-4 pb-2 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rate this scene:</span>
            <StarRating
              value={humanGrade}
              onChange={(grade) => {
                setHumanGrade(grade);
                // Show feedback field for ratings below 4 stars
                if (grade < 4) {
                  setShowFeedback(true);
                } else {
                  // Good rating — submit immediately
                  if (onStarRate) { onStarRate(result.sceneId, grade); }
                }
              }}
            />
            {humanGrade > 0 && (
              <span className="text-xs text-muted-foreground">{humanGrade}/5</span>
            )}
          </div>

          {/* Feedback input appears for low ratings */}
          {showFeedback && humanGrade > 0 && humanGrade < 4 && (
            <div className="space-y-2">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="What's wrong with this scene? (e.g., 'actor speaks too fast', 'wrong background', 'words are cut off at the end')..."
                rows={2}
                className="w-full px-3 py-2 bg-card/80 border border-primary/20 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                autoFocus
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowFeedback(false);
                    setHumanGrade(0);
                    setFeedback('');
                  }}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (onStarRate) { onStarRate(result.sceneId, humanGrade); }
                    if (feedback.trim() && onRegenerate) {
                      onRegenerate(result.sceneId, feedback.trim());
                      setReviewStatus('pending');
                    }
                    setShowFeedback(false);
                    setFeedback('');
                  }}
                  className="h-7 gap-1 text-xs text-primary-light hover:text-primary-light"
                >
                  <Send className="w-3 h-3" />
                  {feedback.trim() ? 'Submit & Regenerate' : 'Submit Rating'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Feedback Input (when rejected via thumbs-down) */}
      {showFeedback && reviewStatus === 'rejected' && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex items-start gap-2">
            <MessageSquare className="w-4 h-4 text-destructive flex-shrink-0 mt-1.5" />
            <div className="flex-1">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Describe what needs to change (e.g., 'lighting too dark, character should face camera, more energetic expression')..."
                rows={2}
                className="w-full px-3 py-2 bg-card/80 border border-destructive/20 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-destructive/30 resize-none"
                autoFocus
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowFeedback(false);
                setReviewStatus('pending');
                setFeedback('');
              }}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              Cancel
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSubmitFeedback}
              disabled={!feedback.trim()}
              className="h-7 gap-1 text-xs text-primary-light hover:text-primary-light disabled:opacity-40"
            >
              <Send className="w-3 h-3" />
              Regenerate with Feedback
            </Button>
            {!onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (onRetry) {
                    onRetry(result.sceneId);
                    setReviewStatus('pending');
                    setShowFeedback(false);
                    setFeedback('');
                  }
                }}
                disabled={!onRetry}
                className="h-7 gap-1 text-xs text-primary-light hover:text-primary-light disabled:opacity-40"
              >
                <RefreshCw className="w-3 h-3" />
                Retry Scene
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
