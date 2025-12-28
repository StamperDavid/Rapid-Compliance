/**
 * Website Builder Onboarding
 * First-time user experience
 */

'use client';

import { useState } from 'react';

interface OnboardingProps {
  organizationId: string;
  onComplete: () => void;
}

export function WebsiteBuilderOnboarding({ organizationId, onComplete }: OnboardingProps) {
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
          <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '32px', maxWidth: '500px', margin: '0 auto' }}>
            With our drag-and-drop editor, professional templates, and powerful features,
            you'll have a stunning website up and running in no time.
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
              What's your website name?
            </label>
            <input
              type="text"
              value={siteData.siteName}
              onChange={(e) => setSiteData({ ...siteData, siteName: e.target.value })}
              placeholder="My Awesome Company"
              style={{
                width: '100%',
                padding: '12px',
                border: '2px solid #e5e7eb',
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
                  border: '2px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '16px',
                }}
              />
              <span style={{ color: '#6b7280', fontSize: '16px' }}>.yourplatform.com</span>
            </div>
            {siteData.subdomain && (
              <div style={{ marginTop: '8px', fontSize: '14px', color: '#3b82f6' }}>
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
          <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '14px', color: '#6b7280' }}>
            Don't worry, you can customize everything later or start from scratch!
          </div>
        </div>
      ),
    },
    {
      title: "You're All Set! 🎊",
      description: 'Your website is ready to customize',
      content: (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '80px', marginBottom: '24px' }}>✨</div>
          <h2 style={{ fontSize: '32px', fontWeight: 'bold', marginBottom: '16px' }}>
            Ready to Build!
          </h2>
          <p style={{ fontSize: '18px', color: '#6b7280', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
            We've set up your website with the {siteData.template} template.
            Now let's make it yours!
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
      await fetch('/api/website/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          settings: {
            siteName: siteData.siteName,
            subdomain: siteData.subdomain,
          },
        }),
      });

      // Apply template if selected
      if (siteData.template) {
        await fetch('/api/website/templates/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            templateId: siteData.template.toLowerCase(),
          }),
        });
      }
    } catch (error) {
      console.error('[Onboarding] Failed to save:', error);
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
        backgroundColor: 'white',
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
          borderBottom: '1px solid #e5e7eb',
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
                  backgroundColor: idx <= currentStep ? '#3b82f6' : '#e5e7eb',
                  borderRadius: '2px',
                  transition: 'background-color 0.3s',
                }}
              />
            ))}
          </div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '4px' }}>
            {steps[currentStep].title}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '14px' }}>
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
          borderTop: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <button
            onClick={handleBack}
            disabled={currentStep === 0}
            style={{
              padding: '12px 24px',
              backgroundColor: 'white',
              border: '1px solid #d1d5db',
              borderRadius: '8px',
              fontSize: '16px',
              fontWeight: '500',
              cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
              opacity: currentStep === 0 ? 0.5 : 1,
            }}
          >
            Back
          </button>
          
          <div style={{ fontSize: '14px', color: '#6b7280', alignSelf: 'center' }}>
            Step {currentStep + 1} of {steps.length}
          </div>

          <button
            onClick={handleNext}
            disabled={!canProceed()}
            style={{
              padding: '12px 32px',
              backgroundColor: canProceed() ? '#3b82f6' : '#9ca3af',
              color: 'white',
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
      backgroundColor: '#f9fafb',
      borderRadius: '12px',
      textAlign: 'center',
    }}>
      <div style={{ fontSize: '48px', marginBottom: '12px' }}>{icon}</div>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>{title}</h3>
      <p style={{ fontSize: '14px', color: '#6b7280' }}>{description}</p>
    </div>
  );
}

function TemplateCard({ name, selected, onClick }: { name: string; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: '24px',
        border: `2px solid ${selected ? '#3b82f6' : '#e5e7eb'}`,
        borderRadius: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        backgroundColor: selected ? '#eff6ff' : 'white',
      }}
    >
      <div style={{
        width: '100%',
        height: '120px',
        backgroundColor: '#f3f4f6',
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
        color: selected ? '#3b82f6' : '#111827',
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
      backgroundColor: '#f9fafb',
      borderRadius: '12px',
      textAlign: 'left',
    }}>
      <div style={{ fontSize: '32px', marginBottom: '8px' }}>{icon}</div>
      <h4 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>{title}</h4>
      <p style={{ fontSize: '13px', color: '#6b7280' }}>{description}</p>
    </div>
  );
}

