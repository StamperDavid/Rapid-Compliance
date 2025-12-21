'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState('features');
  const [features, setFeatures] = useState<any[]>([]);
  const [pricing, setPricing] = useState<any[]>([]);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [caseStudies, setCaseStudies] = useState<any[]>([]);

  useEffect(() => {
    // Load platform knowledge base
    setFeatures([
      {
        id: '1',
        category: 'AI Agents',
        title: 'Golden Master Architecture',
        description: 'Infinite scalability with perfect customer continuity. One Golden Master can power thousands of conversations simultaneously.',
        keyPoints: [
          'No hallucinations - structured memory system',
          'Perfect continuity across sessions',
          'Infinite scalability',
          'Version control & rollback'
        ],
        enabled: true
      },
      {
        id: '2',
        category: 'AI Agents',
        title: 'Training Center',
        description: 'Train AI agents through realistic scenarios with feedback loops and continuous improvement.',
        keyPoints: [
          'Role-playing scenarios',
          'Real-time feedback',
          'Auto-learning from conversations',
          'Industry-specific templates'
        ],
        enabled: true
      },
      {
        id: '3',
        category: 'CRM',
        title: 'Custom Entity Builder',
        description: 'Create any business object - leads, deals, support tickets, inventory items, and more.',
        keyPoints: [
          'Drag-and-drop schema builder',
          'Custom fields & validations',
          'Relationships between entities',
          'API auto-generation'
        ],
        enabled: true
      },
      {
        id: '4',
        category: 'Automation',
        title: 'Workflow Engine',
        description: 'Automate any business process with triggers, conditions, and actions.',
        keyPoints: [
          'Visual workflow builder',
          'Multi-step automations',
          'Conditional logic',
          'External integrations'
        ],
        enabled: true
      },
      {
        id: '5',
        category: 'E-Commerce',
        title: 'Headless Commerce',
        description: 'Complete e-commerce engine with cart, checkout, payments, and order management.',
        keyPoints: [
          'Stripe integration',
          'Inventory management',
          'Discount codes',
          'Tax calculations'
        ],
        enabled: true
      }
    ]);

    setPricing([
      {
        id: '1',
        plan: 'Starter',
        price: 99,
        billingPeriod: 'month',
        features: [
          'Up to 1,000 CRM records',
          '1 AI Agent',
          '5 users',
          'Email support',
          'Basic workflows'
        ],
        idealFor: 'Small businesses just getting started',
        enabled: true
      },
      {
        id: '2',
        plan: 'Professional',
        price: 299,
        billingPeriod: 'month',
        features: [
          'Up to 10,000 CRM records',
          '3 AI Agents',
          '25 users',
          'Priority support',
          'Advanced workflows',
          'E-commerce features',
          'Custom integrations'
        ],
        idealFor: 'Growing businesses with sales teams',
        enabled: true,
        popular: true
      },
      {
        id: '3',
        plan: 'Enterprise',
        price: 'Custom',
        billingPeriod: 'month',
        features: [
          'Unlimited records',
          'Unlimited AI Agents',
          'Unlimited users',
          'Dedicated support',
          'Custom development',
          'SLA guarantees',
          'On-premise deployment option'
        ],
        idealFor: 'Large organizations with complex needs',
        enabled: true
      }
    ]);

    setCompetitors([
      {
        id: '1',
        name: 'Salesforce',
        strengths: ['Market leader', 'Comprehensive features', 'Large ecosystem'],
        weaknesses: ['Expensive', 'Complex setup', 'No AI agents', 'Requires consultants'],
        ourAdvantage: 'We focus on AI-first automation. While Salesforce manages data, we automate the entire sales process with AI agents.',
        enabled: true
      },
      {
        id: '2',
        name: 'HubSpot',
        strengths: ['Easy to use', 'Good marketing features', 'Free tier'],
        weaknesses: ['Limited customization', 'Gets expensive fast', 'Basic AI capabilities'],
        ourAdvantage: 'Our AI agents are far more sophisticated. HubSpot has chatbots; we have AI sales teams.',
        enabled: true
      },
      {
        id: '3',
        name: 'Pipedrive',
        strengths: ['Simple interface', 'Pipeline-focused', 'Affordable'],
        weaknesses: ['Limited features', 'No AI', 'Manual processes', 'Weak automation'],
        ourAdvantage: 'Everything Pipedrive does manually, our AI does automatically - plus infinitely more.',
        enabled: true
      }
    ]);

    setCaseStudies([
      {
        id: '1',
        company: 'TechStart Solutions',
        industry: 'B2B SaaS',
        challenge: 'No dedicated sales team, founder was doing all sales calls',
        solution: 'Deployed AI sales agent trained on their product knowledge',
        results: [
          '24/7 lead qualification',
          '300% increase in qualified demos',
          'Founder freed up to focus on product',
          'Closed 12 deals in first month'
        ],
        metrics: {
          roi: '480%',
          timeToValue: '2 weeks',
          costSavings: '$15,000/month'
        },
        enabled: true
      },
      {
        id: '2',
        company: 'GrowthCo',
        industry: 'E-commerce',
        challenge: 'Manual order processing, customer service bottleneck',
        solution: 'Implemented CRM + E-commerce + Support AI agent',
        results: [
          '95% of customer questions answered by AI',
          'Order processing fully automated',
          '4.8/5 customer satisfaction',
          'Support team scaled from 5 to 100k customers without hiring'
        ],
        metrics: {
          roi: '620%',
          timeToValue: '3 weeks',
          costSavings: '$25,000/month'
        },
        enabled: true
      }
    ]);
  }, []);

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <Link
          href="/admin/sales-agent"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#999',
            textDecoration: 'none',
            fontSize: '0.875rem',
            marginBottom: '1rem'
          }}
        >
          ← Back to Sales Agent
        </Link>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          📚 Platform Knowledge Base
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Manage what your sales agent knows about the platform
        </p>
      </div>

      {/* Tabs */}
      <div style={{ 
        display: 'flex',
        gap: '0.5rem',
        marginBottom: '2rem',
        borderBottom: `1px solid ${borderColor}`
      }}>
        {[
          { id: 'features', label: 'Features', icon: '⚡' },
          { id: 'pricing', label: 'Pricing', icon: '💰' },
          { id: 'competitors', label: 'Competitors', icon: '🎯' },
          { id: 'case-studies', label: 'Case Studies', icon: '📈' }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? `2px solid ${primaryColor}` : '2px solid transparent',
              color: activeTab === tab.id ? '#fff' : '#666',
              fontSize: '0.875rem',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Features Tab */}
      {activeTab === 'features' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
          {features.map((feature) => (
            <div
              key={feature.id}
              style={{
                backgroundColor: bgPaper,
                border: `1px solid ${borderColor}`,
                borderRadius: '0.75rem',
                padding: '1.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>
                    {feature.category}
                  </div>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff' }}>
                    {feature.title}
                  </h3>
                </div>
                <div style={{
                  width: '40px',
                  height: '24px',
                  backgroundColor: feature.enabled ? '#065f46' : '#4b5563',
                  borderRadius: '12px',
                  position: 'relative',
                  cursor: 'pointer'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: feature.enabled ? '18px' : '2px',
                    transition: 'left 0.2s'
                  }} />
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '1rem' }}>
                {feature.description}
              </p>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', marginBottom: '0.5rem' }}>
                  Key Points for Agent:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#999' }}>
                  {feature.keyPoints.map((point, idx) => (
                    <li key={idx} style={{ marginBottom: '0.25rem' }}>{point}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pricing Tab */}
      {activeTab === 'pricing' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
          {pricing.map((plan) => (
            <div
              key={plan.id}
              style={{
                backgroundColor: bgPaper,
                border: plan.popular ? `2px solid ${primaryColor}` : `1px solid ${borderColor}`,
                borderRadius: '0.75rem',
                padding: '1.5rem',
                position: 'relative'
              }}
            >
              {plan.popular && (
                <div style={{
                  position: 'absolute',
                  top: '-12px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  padding: '0.25rem 1rem',
                  backgroundColor: primaryColor,
                  color: '#fff',
                  borderRadius: '1rem',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  Most Popular
                </div>
              )}

              <h3 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                {plan.plan}
              </h3>

              <div style={{ marginBottom: '1rem' }}>
                {typeof plan.price === 'number' ? (
                  <>
                    <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                      ${plan.price}
                    </span>
                    <span style={{ fontSize: '0.875rem', color: '#666' }}>
                      /{plan.billingPeriod}
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {plan.price}
                  </span>
                )}
              </div>

              <div style={{ fontSize: '0.875rem', color: '#999', fontStyle: 'italic', marginBottom: '1.5rem' }}>
                {plan.idealFor}
              </div>

              <div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#666', marginBottom: '0.75rem' }}>
                  What's Included:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#999' }}>
                  {plan.features.map((feature, idx) => (
                    <li key={idx} style={{ marginBottom: '0.5rem' }}>{feature}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Competitors Tab */}
      {activeTab === 'competitors' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {competitors.map((competitor) => (
            <div
              key={competitor.id}
              style={{
                backgroundColor: bgPaper,
                border: `1px solid ${borderColor}`,
                borderRadius: '0.75rem',
                padding: '1.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1.5rem' }}>
                <h3 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fff' }}>
                  {competitor.name}
                </h3>
                <div style={{
                  width: '40px',
                  height: '24px',
                  backgroundColor: competitor.enabled ? '#065f46' : '#4b5563',
                  borderRadius: '12px',
                  position: 'relative',
                  cursor: 'pointer'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: competitor.enabled ? '18px' : '2px',
                    transition: 'left 0.2s'
                  }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#10b981', marginBottom: '0.5rem' }}>
                    Their Strengths:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#999' }}>
                    {competitor.strengths.map((strength, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>{strength}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#ef4444', marginBottom: '0.5rem' }}>
                    Their Weaknesses:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#999' }}>
                    {competitor.weaknesses.map((weakness, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>{weakness}</li>
                    ))}
                  </ul>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: primaryColor, marginBottom: '0.5rem' }}>
                    Our Advantage:
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#fff', margin: 0 }}>
                    {competitor.ourAdvantage}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Case Studies Tab */}
      {activeTab === 'case-studies' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {caseStudies.map((study) => (
            <div
              key={study.id}
              style={{
                backgroundColor: bgPaper,
                border: `1px solid ${borderColor}`,
                borderRadius: '0.75rem',
                padding: '1.5rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>
                    {study.company}
                  </h3>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>{study.industry}</div>
                </div>
                <div style={{
                  width: '40px',
                  height: '24px',
                  backgroundColor: study.enabled ? '#065f46' : '#4b5563',
                  borderRadius: '12px',
                  position: 'relative',
                  cursor: 'pointer'
                }}>
                  <div style={{
                    width: '20px',
                    height: '20px',
                    backgroundColor: '#fff',
                    borderRadius: '50%',
                    position: 'absolute',
                    top: '2px',
                    left: study.enabled ? '18px' : '2px',
                    transition: 'left 0.2s'
                  }} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#ef4444', marginBottom: '0.5rem' }}>
                    Challenge:
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>
                    {study.challenge}
                  </p>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: primaryColor, marginBottom: '0.5rem' }}>
                    Solution:
                  </div>
                  <p style={{ fontSize: '0.875rem', color: '#999', margin: 0 }}>
                    {study.solution}
                  </p>
                </div>

                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#10b981', marginBottom: '0.5rem' }}>
                    Results:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.875rem', color: '#999' }}>
                    {study.results.map((result, idx) => (
                      <li key={idx} style={{ marginBottom: '0.25rem' }}>{result}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '1rem',
                padding: '1rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '0.5rem'
              }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>ROI</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                    {study.metrics.roi}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Time to Value</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>
                    {study.metrics.timeToValue}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Cost Savings</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                    {study.metrics.costSavings}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


















