/**
 * Interactive Onboarding Flow
 * Guide new users through platform setup
 */

'use client';

import React, { useState } from 'react';

export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
  optional?: boolean;
}

export interface OnboardingFlowProps {
  steps: OnboardingStep[];
  onComplete: () => void;
  onSkip?: () => void;
}

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  steps,
  onComplete,
  onSkip,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [_completed, setCompleted] = useState<Set<string>>(new Set());

  const step = steps[currentStep];
  const _progress = ((currentStep + 1) / steps.length) * 100;
  
  const handleNext = () => {
    setCompleted(prev => new Set([...prev, step.id]));
    
    if (currentStep === steps.length - 1) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };
  
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };
  
  const handleSkipStep = () => {
    if (step.optional) {
      handleNext();
    }
  };
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '2rem',
    }}>
      <div style={{
        backgroundColor: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-border-main)',
        borderRadius: '1rem',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '2rem',
          borderBottom: '1px solid var(--color-border-main)',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
          }}>
            <h2 style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: 'var(--color-text-primary)',
              margin: 0,
            }}>
              {step.title}
            </h2>
            {onSkip && (
              <button
                onClick={onSkip}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Skip Setup
              </button>
            )}
          </div>
          
          <p style={{
            color: 'var(--color-text-secondary)',
            margin: 0,
            marginBottom: '1rem',
          }}>
            {step.description}
          </p>
          
          {/* Progress bar */}
          <div style={{
            display: 'flex',
            gap: '0.5rem',
            marginBottom: '0.5rem',
          }}>
            {steps.map((s, i) => (
              <div
                key={s.id}
                style={{
                  flex: 1,
                  height: '4px',
                  backgroundColor: 'var(--color-border-main)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  height: '100%',
                  backgroundColor: i <= currentStep ? 'var(--color-primary)' : 'transparent',
                  transition: 'background-color 0.3s',
                }} />
              </div>
            ))}
          </div>
          
          <div style={{
            fontSize: '0.875rem',
            color: 'var(--color-text-disabled)',
          }}>
            Step {currentStep + 1} of {steps.length}
          </div>
        </div>
        
        {/* Content */}
        <div style={{
          padding: '2rem',
          minHeight: '300px',
        }}>
          {step.component}
        </div>
        
        {/* Footer */}
        <div style={{
          padding: '2rem',
          borderTop: '1px solid var(--color-border-main)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border-main)',
              backgroundColor: 'transparent',
              color: currentStep === 0 ? 'var(--color-text-disabled)' : 'var(--color-text-primary)',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Back
          </button>
          
          <div style={{ display: 'flex', gap: '1rem' }}>
            {step.optional && (
              <button
                onClick={handleSkipStep}
                style={{
                  padding: '0.75rem 1.5rem',
                  borderRadius: '0.5rem',
                  border: '1px solid var(--color-border-main)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Skip this step
              </button>
            )}
            
            <button
              onClick={handleNext}
              style={{
                padding: '0.75rem 2rem',
                borderRadius: '0.5rem',
                border: 'none',
                backgroundColor: 'var(--color-primary)',
                color: 'var(--color-text-primary)',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '600',
              }}
            >
              {currentStep === steps.length - 1 ? 'Complete Setup' : 'Continue'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Example onboarding steps
 */
export const defaultOnboardingSteps: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to SalesVelocity.ai! 🎉',
    description: "Let's get you set up in just a few minutes.",
    component: (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🚀</div>
        <h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.25rem', marginBottom: '1rem' }}>
          Ready to supercharge your sales?
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', maxWidth: '500px', margin: '0 auto' }}>
          This quick setup will help you create your first AI agent, import customers,
          and start seeing results immediately.
        </p>
      </div>
    ),
  },
  {
    id: 'create-agent',
    title: 'Create Your First AI Agent',
    description: 'AI agents can chat with customers, answer questions, and close sales 24/7.',
    component: (
      <div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            Agent Name
          </label>
          <input
            type="text"
            placeholder="e.g., Sales Assistant"
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border-main)',
              backgroundColor: 'var(--color-bg-paper)',
              color: 'var(--color-text-primary)',
            }}
          />
        </div>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            Agent Role
          </label>
          <select style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border-main)',
            backgroundColor: 'var(--color-bg-paper)',
            color: 'var(--color-text-primary)',
          }}>
            <option>Sales Agent</option>
            <option>Support Agent</option>
            <option>Custom</option>
          </select>
        </div>
        
        <div style={{
          backgroundColor: 'var(--color-bg-paper)',
          border: '1px solid var(--color-border-main)',
          borderRadius: '0.5rem',
          padding: '1rem',
        }}>
          <div style={{ color: 'var(--color-success)', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            💡 Pro Tip
          </div>
          <div style={{ color: 'var(--color-success-light)', fontSize: '0.875rem' }}>
            Enable Ensemble Mode for best quality - it queries multiple AI models and picks the best answer!
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 'upload-knowledge',
    title: 'Upload Your Knowledge Base',
    description: 'Teach your AI agent about your products, services, and policies.',
    component: (
      <div>
        <div style={{
          border: '2px dashed var(--color-border-main)',
          borderRadius: '0.75rem',
          padding: '3rem',
          textAlign: 'center',
          marginBottom: '1.5rem',
          cursor: 'pointer',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
          <div style={{ color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
            Drop files here or click to browse
          </div>
          <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
            Supports PDF, Excel, Word, and more
          </div>
        </div>
        
        <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>
            Good knowledge sources:
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.5rem' }}>
            <li>Product documentation</li>
            <li>FAQs</li>
            <li>Pricing guides</li>
            <li>Return/refund policies</li>
          </ul>
        </div>
      </div>
    ),
    optional: true,
  },
  {
    id: 'complete',
    title: "You're All Set! 🎉",
    description: "Your AI agent is ready to start helping customers.",
    component: (
      <div style={{ textAlign: 'center', padding: '2rem' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✨</div>
        <h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.25rem', marginBottom: '1rem' }}>
          Congratulations!
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', maxWidth: '500px', margin: '0 auto 2rem' }}>
          Your AI agent is live and ready to chat with customers. Start seeing
          results immediately!
        </p>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '1rem',
          marginTop: '2rem',
        }}>
          <div style={{
            backgroundColor: 'var(--color-bg-main)',
            border: '1px solid var(--color-border-main)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}>
            <div style={{ color: 'var(--color-primary)', fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: '600', marginBottom: '0.25rem' }}>
              View Docs
            </div>
            <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
              Learn advanced features
            </div>
          </div>
          
          <div style={{
            backgroundColor: 'var(--color-bg-main)',
            border: '1px solid var(--color-border-main)',
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}>
            <div style={{ color: 'var(--color-primary)', fontSize: '2rem', marginBottom: '0.5rem' }}>🎥</div>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: '600', marginBottom: '0.25rem' }}>
              Watch Tutorials
            </div>
            <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
              Video guides
            </div>
          </div>
        </div>
      </div>
    ),
  },
];






















