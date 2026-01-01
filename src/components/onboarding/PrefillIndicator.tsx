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
  suggestedAction,
  showLabel = true,
}) => {
  const getConfidenceColor = () => {
    if (confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
      return {
        bg: '#1a3a1a',
        border: '#2a5a2a',
        text: '#4ade80',
      };
    } else if (confidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
      return {
        bg: '#3a3a1a',
        border: '#5a5a2a',
        text: '#fbbf24',
      };
    } else {
      return {
        bg: '#1a1a2a',
        border: '#2a2a4a',
        text: '#60a5fa',
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
            color: '#4ade80',
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
            color: '#666',
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
            ? '2px solid #2a5a2a'
            : isRejected
            ? '2px solid #666'
            : fieldConfidence.suggestedAction === 'hint'
            ? '2px dashed #2a2a4a'
            : '2px solid #5a5a2a',
          borderRadius: '0.5rem',
          padding: '0.125rem',
          backgroundColor: isConfirmed ? '#1a3a1a' : 'transparent',
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
              backgroundColor: '#2a5a2a',
              border: '1px solid #4ade80',
              borderRadius: '0.375rem',
              color: '#4ade80',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1a4a1a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#2a5a2a';
            }}
          >
            ✓ Looks good
          </button>
          
          <button
            onClick={onReject}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              border: '1px solid #666',
              borderRadius: '0.375rem',
              color: '#999',
              fontSize: '0.75rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1a1a';
              e.currentTarget.style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#999';
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
            backgroundColor: '#1a1a2a',
            border: '1px solid #2a2a4a',
            borderRadius: '0.375rem',
            fontSize: '0.75rem',
            color: '#60a5fa',
          }}
        >
          💡 <strong>Suggestion:</strong> {String(fieldConfidence.value)}
          <div style={{ marginTop: '0.25rem', color: '#888', fontSize: '0.7rem' }}>
            We found this information but aren't very confident. Please verify.
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
  totalFieldsCount,
  fromCache,
  onStartFresh,
}) => {
  const getConfidenceMessage = () => {
    if (overallConfidence >= CONFIDENCE_THRESHOLDS.HIGH) {
      return {
        emoji: '🎉',
        title: 'Great news!',
        message: `We auto-filled ${fieldsPrefilledCount} fields with high confidence from your website.`,
        color: '#4ade80',
        bg: '#1a3a1a',
        border: '#2a5a2a',
      };
    } else if (overallConfidence >= CONFIDENCE_THRESHOLDS.MEDIUM) {
      return {
        emoji: '👍',
        title: 'Almost there!',
        message: `We found ${fieldsPrefilledCount} fields from your website. Please confirm the suggestions.`,
        color: '#fbbf24',
        bg: '#3a3a1a',
        border: '#5a5a2a',
      };
    } else {
      return {
        emoji: '💡',
        title: 'We found some hints',
        message: `We found ${fieldsPrefilledCount} suggestions from your website. You'll need to verify most fields.`,
        color: '#60a5fa',
        bg: '#1a1a2a',
        border: '#2a2a4a',
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
          
          <div style={{ color: '#ccc', fontSize: '0.875rem', marginBottom: '0.75rem' }}>
            {msg.message}
          </div>
          
          <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.75rem', color: '#888' }}>
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
              border: '1px solid #666',
              borderRadius: '0.375rem',
              color: '#999',
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
        backgroundColor: '#1a1a1a',
        border: '2px solid #2a2a2a',
        borderRadius: '0.75rem',
        marginBottom: '2rem',
      }}
    >
      <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'pulse 2s infinite' }}>
        🔍
      </div>
      
      <div style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '700', marginBottom: '0.5rem' }}>
        Analyzing your website...
      </div>
      
      <div style={{ color: '#999', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
        We're discovering information about your business to pre-fill this form.
        This usually takes 10-30 seconds.
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem' }}>
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#6366f1',
            animation: 'bounce 1.4s infinite ease-in-out',
            animationDelay: '0s',
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#6366f1',
            animation: 'bounce 1.4s infinite ease-in-out',
            animationDelay: '0.2s',
          }}
        />
        <div
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: '#6366f1',
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
