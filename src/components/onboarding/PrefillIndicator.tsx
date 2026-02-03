/**
 * Prefill Indicator Components
 * 
 * UI components for displaying prefilled data with confidence indicators.
 */

'use client';

import React from 'react';
import type { FieldConfidence } from '@/lib/onboarding/types';
import { CONFIDENCE_THRESHOLDS } from '@/lib/onboarding/constants';

// ============================================================================
// CONFIDENCE BADGE COMPONENT
// ============================================================================

export interface ConfidenceBadgeProps {
  confidence: number;
  suggestedAction: 'auto-fill' | 'confirm' | 'hint';
  showLabel?: boolean;
}

export const ConfidenceBadge: React.FC<ConfidenceBadgeProps> = ({
  confidence,
  suggestedAction: _suggestedAction,
  showLabel = true,
}) => {
  const getConfidenceColor = () => {
    if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
      return {
        bg: 'var(--color-success-dark)',
        border: 'var(--color-success-dark)',
        text: 'var(--color-success-light)',
      };
    } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
      return {
        bg: 'var(--color-warning-dark)',
        border: 'var(--color-warning-dark)',
        text: 'var(--color-warning-light)',
      };
    } else {
      return {
        bg: 'var(--color-bg-elevated)',
        border: 'var(--color-border-main)',
        text: 'var(--color-info-light)',
      };
    }
  };

  const getConfidenceLabel = () => {
    if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
      return '✓ Auto-filled';
    } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
      return '⚠ Please confirm';
    } else {
      return '💡 Suggestion';
    }
  };

  const colors = getConfidenceColor();
  const confidencePercent = Math.round(confidence * 100);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.25rem 0.75rem',
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: '0.375rem',
        fontSize: '0.75rem',
        fontWeight: '600',
        color: colors.text,
      }}
    >
      {showLabel && <span>{getConfidenceLabel()}</span>}
      <span style={{ opacity: 0.8 }}>({confidencePercent}%)</span>
    </div>
  );
};

// ============================================================================
// PREFILLED FIELD WRAPPER
// ============================================================================

export interface PrefilledFieldWrapperProps {
  fieldConfidence: FieldConfidence;
  children: React.ReactNode;
  onConfirm?: () => void;
  onReject?: () => void;
  isConfirmed?: boolean;
  isRejected?: boolean;
}

export const PrefilledFieldWrapper: React.FC<PrefilledFieldWrapperProps> = ({
  fieldConfidence,
  children,
  onConfirm,
  onReject,
  isConfirmed = false,
  isRejected = false,
}) => {
  const showActions =
    fieldConfidence.suggestedAction === 'confirm' && !isConfirmed && !isRejected;

  return (
    <div style={{ position: 'relative' }}>
      {/* Confidence Badge */}
      <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <ConfidenceBadge
          confidence={fieldConfidence.confidence}
          suggestedAction={fieldConfidence.suggestedAction}
        />
        
        {isConfirmed && (
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--color-success-light)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}>
            ✓ Confirmed
          </div>
        )}
        
        {isRejected && (
          <div style={{
            fontSize: '0.75rem',
            color: 'var(--color-text-disabled)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}>
            ✎ Modified
          </div>
        )}
      </div>

      {/* Field Content */}
      <div
        style={{
          position: 'relative',
          border: isConfirmed
            ? '2px solid var(--color-success-dark)'
            : isRejected
            ? '2px solid var(--color-text-disabled)'
            : fieldConfidence.suggestedAction === 'hint'
            ? '2px dashed var(--color-border-main)'
            : '2px solid var(--color-warning-dark)',
          borderRadius: '0.5rem',
          padding: '0.125rem',
          backgroundColor: isConfirmed ? 'var(--color-success-dark)' : 'transparent',
        }}
      >
        {children}
      </div>

      {/* Confirmation Actions */}
      {showActions && (
        <div
          style={{
            marginTop: '0.5rem',
            display: 'flex',
            gap: '0.5rem',
          }}
        >
          <button
            onClick={onConfirm}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'var(--color-success-dark)',
              border: '1px solid var(--color-success-light)',
              borderRadius: '0.375rem',
              color: 'var(--color-success-light)',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-success-dark)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-success-dark)';
            }}
          >
            ✓ Looks good
          </button>
          
          <button
            onClick={onReject}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-text-disabled)',
              borderRadius: '0.375rem',
              color: 'var(--color-text-secondary)',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-elevated)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
          >
            ✎ Let me edit
          </button>
        </div>
      )}

      {/* Hint for low-confidence fields */}
      {fieldConfidence.suggestedAction === 'hint' && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-main)',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            color: 'var(--color-info-light)',
          }}
        >
          💡 <strong>Suggestion:</strong> {String(fieldConfidence.value)}
          <div style={{ marginTop: '0.25rem', color: 'var(--color-text-secondary)', fontSize: '0.7rem' }}>
            We found this information but aren&apos;t very confident. Please verify.
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// PREFILL STATUS BANNER
// ============================================================================

export interface PrefillStatusBannerProps {
  overallConfidence: number;
  fieldsPrefilledCount: number;
  totalFieldsCount: number;
  fromCache: boolean;
  onStartFresh?: () => void;
}

export const PrefillStatusBanner: React.FC<PrefillStatusBannerProps> = ({
  overallConfidence,
  fieldsPrefilledCount,
  totalFieldsCount: _totalFieldsCount,
  fromCache,
  onStartFresh,
}) => {
  const getConfidenceMessage = () => {
    if (overallConfidence >= CONFIDENCE_THRESHOLDS.HIGH) {
      return {
        emoji: '🎉',
        title: 'Great news!',
        message: `We auto-filled ${fieldsPrefilledCount} fields with high confidence from your website.`,
        color: 'var(--color-success-light)',
        bg: 'var(--color-success-dark)',
        border: 'var(--color-success-dark)',
      };
    } else if (overallConfidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
      return {
        emoji: '👍',
        title: 'Almost there!',
        message: `We found ${fieldsPrefilledCount} fields from your website. Please confirm the suggestions.`,
        color: 'var(--color-warning-light)',
        bg: 'var(--color-warning-dark)',
        border: 'var(--color-warning-dark)',
      };
    } else {
      return {
        emoji: '💡',
        title: 'We found some hints',
        message: `We found ${fieldsPrefilledCount} suggestions from your website. You'll need to verify most fields.`,
        color: 'var(--color-info-light)',
        bg: 'var(--color-bg-elevated)',
        border: 'var(--color-border-main)',
      };
    }
  };

  const msg = getConfidenceMessage();

  return (
    <div
      style={{
        padding: '1.5rem',
        backgroundColor: msg.bg,
        border: `2px solid ${msg.border}`,
        borderRadius: '0.75rem',
        marginBottom: '2rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
        <div style={{ fontSize: '2.5rem', lineHeight: '1' }}>{msg.emoji}</div>
        
        <div style={{ flex: 1 }}>
          <div style={{ color: msg.color, fontSize: '1.125rem', fontWeight: '700', marginBottom: '0.5rem' }}>
            {msg.title}
          </div>
          
          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            {msg.message}
          </div>
          
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
            <div>
              <strong style={{ color: msg.color }}>{fieldsPrefilledCount}</strong> fields prefilled
            </div>
            <div>
              <strong style={{ color: msg.color }}>{Math.round(overallConfidence * 100)}%</strong> confidence
            </div>
            {fromCache && (
              <div>
                ⚡ <strong>Instant</strong> (cached)
              </div>
            )}
          </div>
        </div>
        
        {onStartFresh && (
          <button
            onClick={onStartFresh}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-text-disabled)',
              borderRadius: '0.375rem',
              color: 'var(--color-text-secondary)',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Start Fresh
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// LOADING STATE
// ============================================================================

export const PrefillLoadingState: React.FC = () => {
  return (
    <div
      style={{
        padding: '3rem',
        textAlign: 'center',
        backgroundColor: 'var(--color-bg-elevated)',
        border: '2px solid var(--color-border-main)',
        borderRadius: '0.75rem',
        marginBottom: '2rem',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>
        🔍
      </div>
      
      <div style={{ color: 'var(--color-text-primary)', fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
        Analyzing your website...
      </div>
      
      <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        We&apos;re discovering information about your business to pre-fill this form.
        This usually takes 10-30 seconds.
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary)',
            animation: 'bounce 1.4s infinite ease-in-out',
            animationDelay: '0s',
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary)',
            animation: 'bounce 1.4s infinite ease-in-out',
            animationDelay: '0.2s',
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-primary)',
            animation: 'bounce 1.4s infinite ease-in-out',
            animationDelay: '0.4s',
          }}
        />
      </div>
      
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }
        
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-10px); }
        }
      `}</style>
    </div>
  );
};
