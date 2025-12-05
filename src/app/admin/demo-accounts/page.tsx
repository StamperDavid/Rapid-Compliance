'use client';

import { useState } from 'react';
import { PlayIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';

interface DemoAccount {
  id: string;
  companyName: string;
  email: string;
  password: string;
  industry: string;
  plan: string;
  bestFor: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'auraflow',
    companyName: 'AuraFlow Analytics (TEST)',
    email: 'admin@auraflow.test',
    password: 'Testing123!',
    industry: 'B2B Software as a Service (SaaS)',
    plan: 'Starter',
    bestFor: 'Demonstrating B2B SaaS, technical sales, formal professional tone'
  },
  {
    id: 'greenthumb',
    companyName: 'GreenThumb Landscaping (TEST)',
    email: 'admin@greenthumb.test',
    password: 'Testing123!',
    industry: 'Home Services (Landscaping & Lawn Care)',
    plan: 'Starter',
    bestFor: 'Local service business, casual friendly tone, subscription services'
  },
  {
    id: 'adventuregear',
    companyName: 'The Adventure Gear Shop (TEST)',
    email: 'admin@adventuregear.test',
    password: 'Testing123!',
    industry: 'E-commerce (Outdoor Apparel and Gear)',
    plan: 'Professional',
    bestFor: 'E-commerce, customer support, product-focused conversations'
  },
  {
    id: 'summitwm',
    companyName: 'Summit Wealth Management (TEST)',
    email: 'admin@summitwm.test',
    password: 'Testing123!',
    industry: 'Financial Services (Investment Advisory)',
    plan: 'Professional',
    bestFor: 'High-trust industries, compliance-aware, formal communication'
  },
  {
    id: 'pixelperfect',
    companyName: 'PixelPerfect Design Co. (TEST)',
    email: 'admin@pixelperfect.test',
    password: 'Testing123!',
    industry: 'Creative Services (Web Design & Branding)',
    plan: 'Starter',
    bestFor: 'Creative services, consultative sales, project-based work'
  },
  {
    id: 'codemaster',
    companyName: 'CodeMaster Academy (TEST)',
    email: 'admin@codemaster.test',
    password: 'Testing123!',
    industry: 'E-Learning/EdTech (Coding Bootcamp)',
    plan: 'Professional',
    bestFor: 'Education/training, career changers, motivational tone'
  },
  {
    id: 'midwestplastics',
    companyName: 'Midwest Plastics Supply (TEST)',
    email: 'admin@midwestplastics.test',
    password: 'Testing123!',
    industry: 'B2B Manufacturing/Wholesale',
    plan: 'Professional',
    bestFor: 'Manufacturing, technical specifications, B2B wholesale'
  },
  {
    id: 'metroproperty',
    companyName: 'Metro Property Group (TEST)',
    email: 'admin@metroproperty.test',
    password: 'Testing123!',
    industry: 'Residential Real Estate Brokerage',
    plan: 'Starter',
    bestFor: 'Real estate, local expertise, emotional high-stakes decisions'
  },
  {
    id: 'executiveedge',
    companyName: 'Executive Edge Coaching (TEST)',
    email: 'admin@executiveedge.test',
    password: 'Testing123!',
    industry: 'B2B Executive Coaching',
    plan: 'Professional',
    bestFor: 'High-end consulting, executive-level communication, results-focused'
  }
];

export default function DemoAccountsPage() {
  const [loggingIn, setLoggingIn] = useState<string | null>(null);

  const handleQuickLogin = async (account: DemoAccount) => {
    setLoggingIn(account.id);

    try {
      // Call API to get a custom token for this demo account
      const response = await fetch('/api/admin/demo-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: account.email,
          password: account.password,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate demo login');
      }

      const data = await response.json();
      
      // Open new window with the custom token
      const loginUrl = `${window.location.origin}/demo-login?token=${data.customToken}`;
      window.open(loginUrl, '_blank');
      
    } catch (error) {
      console.error('Demo login error:', error);
      const message = error instanceof Error ? error.message : 'Failed to login to demo account';
      alert(message);
    } finally {
      setLoggingIn(null);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000', color: '#fff', padding: '2rem' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>Demo Accounts</h1>
          <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1rem' }}>
            Quick access to demo accounts for presentations and testing.
            Click any account to automatically log in (opens in new tab).
          </p>
          <div style={{ 
            padding: '1rem',
            backgroundColor: '#7c2d12',
            border: '1px solid #ea580c',
            borderRadius: '0.5rem',
            marginTop: '1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: '0.75rem' }}>
              <span style={{ fontSize: '1.25rem' }}>⚠️</span>
              <p style={{ fontSize: '0.875rem', color: '#fed7aa' }}>
                <strong style={{ color: '#fff' }}>Important:</strong> These are TEST accounts. All company names include (TEST) for easy identification. Remove before production.
              </p>
            </div>
          </div>
        </div>

        {/* Demo Accounts Grid */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '1.5rem',
          marginBottom: '2rem'
        }}>
          {DEMO_ACCOUNTS.map((account) => (
            <div
              key={account.id}
              style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '0.75rem',
                padding: '1.5rem',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#6366f1';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#333';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                      {account.companyName}
                    </h3>
                    <p style={{ fontSize: '0.875rem', color: '#666' }}>{account.industry}</p>
                  </div>
                  <span style={{
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    backgroundColor: account.plan === 'Professional' ? '#4c1d95' : '#1e3a8a',
                    color: account.plan === 'Professional' ? '#c4b5fd' : '#93c5fd'
                  }}>
                    {account.plan}
                  </span>
                </div>

                <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Email</p>
                    <p style={{ fontSize: '0.875rem', fontFamily: 'monospace', color: '#fff' }}>{account.email}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>Best For</p>
                    <p style={{ fontSize: '0.875rem', color: '#999' }}>{account.bestFor}</p>
                  </div>
                </div>

                <button
                  onClick={() => handleQuickLogin(account)}
                  disabled={loggingIn === account.id}
                  style={{
                    marginTop: '1.5rem',
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0.75rem 1rem',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    backgroundColor: '#6366f1',
                    border: 'none',
                    cursor: loggingIn === account.id ? 'not-allowed' : 'pointer',
                    opacity: loggingIn === account.id ? 0.5 : 1,
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    if (loggingIn !== account.id) {
                      e.currentTarget.style.backgroundColor = '#4f46e5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = '#6366f1';
                  }}
                >
                  {loggingIn === account.id ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Logging in...
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-4 w-4 mr-2" />
                      Quick Demo Login
                      <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-2" />
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Info Section */}
        <div style={{ 
          marginTop: '2rem',
          backgroundColor: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '0.75rem',
          padding: '1.5rem'
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '1rem' }}>How It Works</h2>
          <ol style={{ 
            paddingLeft: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            fontSize: '0.875rem',
            color: '#999'
          }}>
            <li>Click "Quick Demo Login" on any demo account above</li>
            <li>A new browser tab will open and automatically log you in</li>
            <li>You'll be redirected to that organization's dashboard</li>
            <li>Use this for quick demos, testing, or presentations</li>
          </ol>
          
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #333' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>Creating Demo Accounts</h3>
            <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.75rem' }}>
              If demo accounts don't exist yet, run the seed script:
            </p>
            <code style={{ 
              display: 'block',
              backgroundColor: '#0a0a0a',
              padding: '0.75rem',
              borderRadius: '0.375rem',
              fontSize: '0.75rem',
              fontFamily: 'monospace',
              color: '#10b981',
              border: '1px solid #333'
            }}>
              node scripts/seed-test-accounts.js
            </code>
          </div>
        </div>
      </div>
    </div>
  );
}

