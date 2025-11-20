'use client';

import { useState } from 'react';
import { INDUSTRY_TEMPLATES, SETUP_QUESTIONS } from '@/lib/setup/industry-templates';

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [isConfiguring, setIsConfiguring] = useState(false);

  const currentQuestion = SETUP_QUESTIONS[step];
  const isLastStep = step === SETUP_QUESTIONS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      configureCRM();
    } else {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const configureCRM = () => {
    setIsConfiguring(true);
    
    // Simulate AI configuration
    setTimeout(() => {
      // Get selected industry template
      const template = INDUSTRY_TEMPLATES[answers.industry || 'general'];
      
      // Store configuration
      localStorage.setItem('crmConfig', JSON.stringify({
        industry: answers.industry,
        businessName: answers.business_name,
        template: template,
        answers: answers,
        setupComplete: true
      }));
      
      // Redirect to dashboard
      window.location.href = '/crm';
    }, 3000);
  };

  if (isConfiguring) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#fff' }}>
          <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🤖</div>
          <h2 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>AI Manager is configuring your CRM...</h2>
          <div style={{ maxWidth: '500px', margin: '0 auto' }}>
            <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', marginBottom: '0.5rem', border: '1px solid #333' }}>
              <p style={{ fontSize: '0.875rem', color: '#6366f1' }}>✓ Creating standard objects (Companies, Contacts, Deals, Invoices...)</p>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', marginBottom: '0.5rem', border: '1px solid #333' }}>
              <p style={{ fontSize: '0.875rem', color: '#6366f1' }}>✓ Configuring {INDUSTRY_TEMPLATES[answers.industry]?.name} specific features...</p>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', marginBottom: '0.5rem', border: '1px solid #333' }}>
              <p style={{ fontSize: '0.875rem', color: '#6366f1' }}>✓ Setting up relationships and workflows...</p>
            </div>
            <div style={{ padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', border: '1px solid #333' }}>
              <p style={{ fontSize: '0.875rem', color: '#999' }}>⏳ Training AI agent for your industry...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ backgroundColor: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)', borderRadius: '1rem', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', padding: '3rem', width: '100%', maxWidth: '600px' }}>
        {/* Progress */}
        <div style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>Step {step + 1} of {SETUP_QUESTIONS.length}</span>
            <span style={{ fontSize: '0.875rem', color: '#6b7280' }}>{Math.round(((step + 1) / SETUP_QUESTIONS.length) * 100)}%</span>
          </div>
          <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{ width: `${((step + 1) / SETUP_QUESTIONS.length) * 100}%`, height: '100%', backgroundColor: '#6366f1', transition: 'width 0.3s' }}></div>
          </div>
        </div>

        {/* Question */}
        <div style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#111827', marginBottom: '1rem' }}>
            {currentQuestion.question}
          </h2>

          {currentQuestion.type === 'select' && currentQuestion.id === 'industry' ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              {currentQuestion.options.map((option: string) => {
                const template = INDUSTRY_TEMPLATES[option];
                return (
                  <button
                    key={option}
                    onClick={() => setAnswers({ ...answers, [currentQuestion.id]: option })}
                    style={{
                      padding: '1.5rem',
                      backgroundColor: answers[currentQuestion.id] === option ? '#eef2ff' : 'white',
                      border: answers[currentQuestion.id] === option ? '2px solid #6366f1' : '1px solid #e5e7eb',
                      borderRadius: '0.75rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                  >
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>{template.icon}</div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111827', marginBottom: '0.25rem' }}>{template.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{template.description}</div>
                  </button>
                );
              })}
            </div>
          ) : currentQuestion.type === 'select' ? (
            <select
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            >
              <option value="">Select an option...</option>
              {currentQuestion.options?.map((option: string) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          ) : currentQuestion.type === 'longText' ? (
            <textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
              placeholder="Tell us what you need..."
              rows={4}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                resize: 'vertical'
              }}
            />
          ) : (
            <input
              type="text"
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => setAnswers({ ...answers, [currentQuestion.id]: e.target.value })}
              placeholder="Type your answer..."
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem'
              }}
            />
          )}
        </div>

        {/* Navigation */}
        <div style={{ display: 'flex', gap: '1rem' }}>
          {step > 0 && (
            <button
              onClick={handleBack}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            disabled={currentQuestion.required && !answers[currentQuestion.id]}
            style={{
              flex: 1,
              padding: '0.75rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '600',
              opacity: currentQuestion.required && !answers[currentQuestion.id] ? 0.5 : 1
            }}
          >
            {isLastStep ? '🚀 Setup My CRM' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
