/**
 * Interactive Onboarding Flow
 * Guide new users through platform setup
 */

'use client';

import React, { useState } from 'react';
import { Spinner } from '../ui/LoadingStates';

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
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  
  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  
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
        backgroundColor: '#1a1a1a',
        border: '1px solid #2a2a2a',
        borderRadius: '1rem',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
      }}>
        {/* Header */}
        <div style={{
          padding: '2rem',
          borderBottom: '1px solid #2a2a2a',
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
              color: '#fff',
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
                  color: '#999',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Skip Setup
              </button>
            )}
          </div>
          
          <p style={{
            color: '#999',
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
                  backgroundColor: '#2a2a2a',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div style={{
                  height: '100%',
                  backgroundColor: i <= currentStep ? '#6366f1' : 'transparent',
                  transition: 'background-color 0.3s',
                }} />
              </div>
            ))}
          </div>
          
          <div style={{
            fontSize: '0.875rem',
            color: '#666',
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
          borderTop: '1px solid #2a2a2a',
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
              border: '1px solid #2a2a2a',
              backgroundColor: 'transparent',
              color: currentStep === 0 ? '#666' : '#fff',
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
                  border: '1px solid #2a2a2a',
                  backgroundColor: 'transparent',
                  color: '#999',
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
                backgroundColor: '#6366f1',
                color: '#fff',
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
        <h3 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '1rem' }}>
          Ready to supercharge your sales?
        </h3>
        <p style={{ color: '#999', maxWidth: '500px', margin: '0 auto' }}>
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
          <label style={{ display: 'block', color: '#fff', marginBottom: '0.5rem' }}>
            Agent Name
          </label>
          <input
            type="text"
            placeholder="e.g., Sales Assistant"
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #2a2a2a',
              backgroundColor: '#0a0a0a',
              color: '#fff',
            }}
          />
        </div>
        
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', color: '#fff', marginBottom: '0.5rem' }}>
            Agent Role
          </label>
          <select style={{
            width: '100%',
            padding: '0.75rem',
            borderRadius: '0.5rem',
            border: '1px solid #2a2a2a',
            backgroundColor: '#0a0a0a',
            color: '#fff',
          }}>
            <option>Sales Agent</option>
            <option>Support Agent</option>
            <option>Custom</option>
          </select>
        </div>
        
        <div style={{
          backgroundColor: '#1a2e1a',
          border: '1px solid #2a4a2a',
          borderRadius: '0.5rem',
          padding: '1rem',
        }}>
          <div style={{ color: '#4ade80', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>
            💡 Pro Tip
          </div>
          <div style={{ color: '#86efac', fontSize: '0.875rem' }}>
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
          border: '2px dashed #2a2a2a',
          borderRadius: '0.75rem',
          padding: '3rem',
          textAlign: 'center',
          marginBottom: '1.5rem',
          cursor: 'pointer',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📄</div>
          <div style={{ color: '#fff', marginBottom: '0.5rem' }}>
            Drop files here or click to browse
          </div>
          <div style={{ color: '#666', fontSize: '0.875rem' }}>
            Supports PDF, Excel, Word, and more
          </div>
        </div>
        
        <div style={{ fontSize: '0.875rem', color: '#999' }}>
          <div style={{ marginBottom: '0.5rem', fontWeight: '600', color: '#fff' }}>
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
        <h3 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '1rem' }}>
          Congratulations!
        </h3>
        <p style={{ color: '#999', maxWidth: '500px', margin: '0 auto 2rem' }}>
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
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}>
            <div style={{ color: '#6366f1', fontSize: '2rem', marginBottom: '0.5rem' }}>📚</div>
            <div style={{ color: '#fff', fontWeight: '600', marginBottom: '0.25rem' }}>
              View Docs
            </div>
            <div style={{ color: '#666', fontSize: '0.875rem' }}>
              Learn advanced features
            </div>
          </div>
          
          <div style={{
            backgroundColor: '#1a1a1a',
            border: '1px solid #2a2a2a',
            borderRadius: '0.75rem',
            padding: '1.5rem',
          }}>
            <div style={{ color: '#6366f1', fontSize: '2rem', marginBottom: '0.5rem' }}>🎥</div>
            <div style={{ color: '#fff', fontWeight: '600', marginBottom: '0.25rem' }}>
              Watch Tutorials
            </div>
            <div style={{ color: '#666', fontSize: '0.875rem' }}>
              Video guides
            </div>
          </div>
        </div>
      </div>
    ),
  },
];





















