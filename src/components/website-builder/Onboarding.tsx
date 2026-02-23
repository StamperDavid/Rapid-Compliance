/**
 * Website Builder Onboarding
 * First-time user experience
 */

'use client';

import { useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';

interface OnboardingProps {
  onComplete: () => void;
}

export function WebsiteBuilderOnboarding({ onComplete }: OnboardingProps) {
  const authFetch = useAuthFetch();
  const [currentStep, setCurrentStep] = useState(0);
  const [siteData, setSiteData] = useState({
    siteName: '',
    subdomain: '',
    template: '',
  });

  const steps = [
    {
      title: 'Welcome to Website Builder! 🎉',
      description: 'Create a professional website in minutes without any coding',
      content: (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '80px', marginBottom: '24px' }}>🌐</div>
          <h2 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '16px' }}>
            Build Your Dream Website
          </h2>
          <p style={{ fontSize: '18px', color: 'var(--color-text-disabled)', marginBottom: '32px', maxWidth: '500px', margin: '0 auto' }}>
            With our drag-and-drop editor, professional templates, and powerful features,
            you&apos;ll have a stunning website up and running in no time.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '24px', marginTop: '40px' }}>
            <FeatureCard icon="🎨" title="35+ Widgets" description="Drag and drop to build" />
            <FeatureCard icon="📱" title="Mobile Ready" description="Looks great on all devices" />
            <FeatureCard icon="🚀" title="Fast & SEO" description="Optimized for performance" />
          </div>
        </div>
      ),
    },
    {
      title: 'Basic Information',
      description: 'Tell us about your website',
      content: (
        <div style={{ padding: '40px' }}>
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              What&apos;s your website name?
            </label>
            <input
              type="text"
              value={siteData.siteName}
              onChange={(e) => setSiteData({ ...siteData, siteName: e.target.value })}
              placeholder="My Awesome Company"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid var(--color-border-light)',
                borderRadius: '8px',
                fontSize: '16px',
              }}
            />
          </div>
          
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '8px' }}>
              Choose your free subdomain
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="text"
                value={siteData.subdomain}
                onChange={(e) => setSiteData({ ...siteData, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                placeholder="mycompany"
                style={{
                  flex: 1,
                  padding: '12px',
                  border: '2px solid var(--color-border-light)',
                  borderRadius: '8px',
                  fontSize: '16px',
                }}
              />
              <span style={{ color: 'var(--color-text-disabled)', fontSize: '16px' }}>.yourplatform.com</span>
            </div>
            {siteData.subdomain && (
              <div style={{ marginTop: '8px', fontSize: '14px', color: 'var(--color-info)' }}>
                ✓ Your site will be at: {siteData.subdomain}.yourplatform.com
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: 'Choose a Template',
      description: 'Start with a professional design',
      content: (
        <div style={{ padding: '40px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
            {['Business', 'SaaS', 'E-commerce', 'Portfolio', 'Agency', 'Blog'].map((template) => (
              <TemplateCard
                key={template}
                name={template}
                selected={siteData.template === template}
                onClick={() => setSiteData({ ...siteData, template })}
              />
            ))}
          </div>
          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: 'var(--color-text-disabled)' }}>
            Don&apos;t worry, you can customize everything later or start from scratch!
          </div>
        </div>
      ),
    },
    {
      title: "You&apos;re All Set! 🎊",
      description: 'Your website is ready to customize',
      content: (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '80px', marginBottom: '24px' }}>✨</div>
          <h2 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '16px' }}>
            Ready to Build!
          </h2>
          <p style={{ fontSize: '18px', color: 'var(--color-text-disabled)', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
            We&apos;ve set up your website with the {siteData.template} template.
            Now let&apos;s make it yours!
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', maxWidth: '600px', margin: '0 auto' }}>
            <NextStepCard
              icon="✏️"
              title="Edit Pages"
              description="Customize content and design"
            />
            <NextStepCard
              icon="🎨"
              title="Add Widgets"
              description="Drag and drop components"
            />
            <NextStepCard
              icon="🌐"
              title="Custom Domain"
              description="Use your own domain"
            />
            <NextStepCard
              icon="📝"
              title="Add Blog Posts"
              description="Start content marketing"
            />
          </div>
        </div>
      ),
    },
  ];

  const handleNext = async () => {
    if (currentStep === steps.length - 1) {
      // Complete onboarding
      await saveOnboardingData();
      onComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const saveOnboardingData = async () => {
    try {
      // Save site settings
      await authFetch('/api/website/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            siteName: siteData.siteName,
            subdomain: siteData.subdomain,
          },
        }),
      });

      // Apply template if selected
      if (siteData.template) {
        await authFetch('/api/website/templates/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateId: siteData.template.toLowerCase(),
          }),
        });
      }
    } catch (error) {
      logger.error('[Onboarding] Failed to save', error instanceof Error ? error : new Error(String(error)));
    }
  };

  const canProceed = () => {
    if (currentStep === 1) {
      return siteData.siteName && siteData.subdomain;
    }
    return true;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
    }}>
      <div style={{
        backgroundColor: 'var(--color-text-primary)',
        borderRadius: '16px',
        maxWidth: '900px',
        width: '90%',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {/* Progress Bar */}
        <div style={{
          padding: '24px 40px',
          borderBottom: '1px solid var(--color-border-light)',
        }}>
          <div style={{
            display: 'flex',
            gap: '8px',
            marginBottom: '16px',
          }}>
            {steps.map((_, idx) => (
              <div
                key={idx}
                style={{
                  flex: 1,
                  height: '4px',
                  backgroundColor: idx <= currentStep ? 'var(--color-info)' : 'var(--color-border-light)',
                  borderRadius: '2px',
                  transition: 'background-color 0.3s',
                }}
              />
            ))}
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
            {steps[currentStep].title}
          </h2>
          <p style={{ color: 'var(--color-text-disabled)', fontSize: '14px' }}>
            {steps[currentStep].description}
          </p>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
        }}>
          {steps[currentStep].content}
        </div>

        {/* Actions */}
        <div style={{
          padding: '24px 40px',
          borderTop: '1px solid var(--color-border-light)',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            style={{
              padding: '12px 24px',
              backgroundColor: 'var(--color-text-primary)',
              border: '1px solid var(--color-text-primary)',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              opacity: currentStep === 0 ? 0.5 : 1,
            }}
          >
            Back
          </button>
          
          <div style={{ fontSize: '14px', color: 'var(--color-text-disabled)', alignSelf: 'center' }}>
            Step {currentStep + 1} of {steps.length}
          </div>

          <button
            onClick={() => void handleNext()}
            disabled={!canProceed()}
            style={{
              padding: '12px 32px',
              backgroundColor: canProceed() ? 'var(--color-info)' : 'var(--color-text-secondary)',
              color: 'var(--color-text-primary)',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: canProceed() ? 'pointer' : 'not-allowed',
            }}
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{
      padding: '24px',
      backgroundColor: 'var(--color-bg-elevated)',
      borderRadius: '12px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>{icon}</div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>{title}</h3>
      <p style={{ fontSize: '14px', color: 'var(--color-text-disabled)' }}>{description}</p>
    </div>
  );
}

function TemplateCard({ name, selected, onClick }: { name: string; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '24px',
        border: `2px solid ${selected ? 'var(--color-info)' : 'var(--color-border-light)'}`,
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        backgroundColor: selected ? 'var(--color-info-light)' : 'var(--color-text-primary)',
      }}
    >
      <div style={{
        width: '100%',
        height: '120px',
        backgroundColor: 'var(--color-bg-elevated)',
        borderRadius: '8px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '32px',
      }}>
        🖼️
      </div>
      <h3 style={{
        fontSize: '16px',
        fontWeight: '600',
        color: selected ? 'var(--color-info)' : 'var(--color-bg-main)',
      }}>
        {name}
      </h3>
    </div>
  );
}

function NextStepCard({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div style={{
      padding: '20px',
      backgroundColor: 'var(--color-bg-elevated)',
      borderRadius: '12px',
      textAlign: 'left',
    }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</div>
      <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>{title}</h4>
      <p style={{ fontSize: '13px', color: 'var(--color-text-disabled)' }}>{description}</p>
    </div>
  );
}

