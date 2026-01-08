'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export default function AdminSalesAgentPage() {
  const { _adminUser } = useAdminAuth();
  const [goldenMaster, setGoldenMaster] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeConversations, setActiveConversations] = useState<any[]>([]);

  useEffect(() => {
    // Load platform sales agent Golden Master
    // In production, fetch from Firestore
    setTimeout(() => {
      setGoldenMaster({
        id: 'platform-sales-agent-gm',
        version: 1,
        name: 'Platform Sales Agent',
        status: 'active',
        trainingScore: 0,
        lastTrainingDate: new Date(),
        totalConversations: 0,
        successRate: 0,
        businessContext: {
          businessName: 'AI Sales Platform',
          industry: 'SaaS / AI Technology',
          problemSolved: 'Help businesses build and deploy AI sales agents that replace entire sales departments',
          uniqueValue: 'Golden Master architecture ensures infinite scalability with perfect customer continuity',
        },
      });
      
      setActiveConversations([
        { id: '1', customerName: 'John Doe', status: 'active', duration: '5m', stage: 'Demo Request' },
        { id: '2', customerName: 'Jane Smith', status: 'paused', duration: '12m', stage: 'Pricing Discussion' },
      ]);
      
      setLoading(false);
    }, 500);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
        <div>Loading sales agent...</div>
      </div>
    );
  }

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const primaryColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', backgroundColor: '#000', minHeight: '100vh', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          🤖 Platform Sales Agent
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Your AI-powered sales team for selling the CRM platform to prospects
        </p>
      </div>

      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard
          label="Golden Master Version"
          value={`v${goldenMaster.version}`}
          sublabel={`Training Score: ${goldenMaster.trainingScore}/100`}
          icon="🎯"
          color={primaryColor}
        />
        <StatCard
          label="Active Conversations"
          value={activeConversations.length.toString()}
          sublabel="Live prospect chats"
          icon="💬"
          color="#10b981"
        />
        <StatCard
          label="Total Demos Given"
          value={goldenMaster.totalConversations.toString()}
          sublabel={`${goldenMaster.successRate}% conversion`}
          icon="📊"
          color="#ec4899"
        />
        <StatCard
          label="Status"
          value={goldenMaster.status === 'active' ? 'Live' : 'Training'}
          sublabel={goldenMaster.status === 'active' ? 'Ready to sell' : 'Needs training'}
          icon="⚡"
          color="#f59e0b"
        />
      </div>

      {/* Agent Status */}
      {goldenMaster.status !== 'active' && (
        <div style={{
          padding: '1rem',
          backgroundColor: '#7c2d12',
          border: '1px solid #991b1b',
          borderRadius: '0.5rem',
          marginBottom: '2rem',
          color: '#fff'
        }}>
          <div style={{ fontWeight: '600', marginBottom: '0.5rem' }}>⚠️ Agent Not Ready for Production</div>
          <div style={{ fontSize: '0.875rem' }}>
            Your sales agent needs training before it can sell the platform to prospects. Complete at least 10 training scenarios with a score of 80+ to activate.
          </div>
        </div>
      )}

      {/* Main Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <ActionCard
          title="🎭 Agent Persona"
          description="Configure comprehensive expert persona: identity, cognitive logic, knowledge, and execution rules"
          href="/admin/sales-agent/persona"
          buttonText="View Persona"
          buttonColor={primaryColor}
        />
        <ActionCard
          title="🎓 Training Center"
          description="Train your sales agent on objection handling, pricing, feature explanations, and more"
          href="/admin/sales-agent/training"
          buttonText="Start Training"
          buttonColor="#10b981"
        />
        <ActionCard
          title="📚 Knowledge Base"
          description="Manage platform features, pricing, case studies, and competitive intelligence"
          href="/admin/sales-agent/knowledge"
          buttonText="Manage Knowledge"
          buttonColor="#f59e0b"
        />
        <ActionCard
          title="🚀 Live Demo Mode"
          description="Use the agent to give live demos to prospects - watch it in action"
          href="/admin/sales-agent/demo"
          buttonText="Start Demo"
          buttonColor="#ec4899"
          disabled={goldenMaster.status !== 'active'}
        />
      </div>

      {/* Active Conversations */}
      <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Active Conversations</h2>
        
        {activeConversations.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💤</div>
            <div>No active conversations</div>
            <div style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
              Start a demo or deploy the agent to your marketing site to begin conversations
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeConversations.map((conv) => (
              <div
                key={conv.id}
                style={{
                  padding: '1rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', marginBottom: '0.25rem' }}>{conv.customerName}</div>
                  <div style={{ fontSize: '0.875rem', color: '#666' }}>
                    {conv.stage} • {conv.duration} • {conv.status}
                  </div>
                </div>
                <Link
                  href={`/admin/sales-agent/conversation/${conv.id}`}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: primaryColor,
                    color: '#fff',
                    borderRadius: '0.375rem',
                    textDecoration: 'none',
                    fontSize: '0.875rem',
                    fontWeight: '600'
                  }}
                >
                  View Chat
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Golden Master Info */}
      <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Golden Master Configuration</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', fontSize: '0.875rem' }}>
          <div>
            <div style={{ color: '#666', marginBottom: '0.25rem' }}>Business Name</div>
            <div style={{ color: '#fff' }}>{goldenMaster.businessContext.businessName}</div>
          </div>
          <div>
            <div style={{ color: '#666', marginBottom: '0.25rem' }}>Industry</div>
            <div style={{ color: '#fff' }}>{goldenMaster.businessContext.industry}</div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ color: '#666', marginBottom: '0.25rem' }}>Value Proposition</div>
            <div style={{ color: '#fff' }}>{goldenMaster.businessContext.problemSolved}</div>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <div style={{ color: '#666', marginBottom: '0.25rem' }}>Unique Selling Point</div>
            <div style={{ color: '#fff' }}>{goldenMaster.businessContext.uniqueValue}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sublabel, icon, _color }: {
  label: string;
  value: string;
  sublabel: string;
  icon: string;
  color: string;
}) {
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '0.75rem',
      padding: '1.5rem'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
        <div>
          <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>{label}</p>
          <p style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>{value}</p>
        </div>
        <div style={{ fontSize: '2rem', opacity: 0.3 }}>{icon}</div>
      </div>
      <div style={{ fontSize: '0.875rem', color: '#666' }}>{sublabel}</div>
    </div>
  );
}

function ActionCard({ title, description, href, buttonText, buttonColor, disabled }: {
  title: string;
  description: string;
  href: string;
  buttonText: string;
  buttonColor: string;
  disabled?: boolean;
}) {
  const borderColor = '#333';
  
  return (
    <div style={{
      backgroundColor: '#1a1a1a',
      border: `1px solid ${borderColor}`,
      borderRadius: '0.75rem',
      padding: '1.5rem',
      display: 'flex',
      flexDirection: 'column',
      opacity: disabled ? 0.5 : 1
    }}>
      <div style={{ fontSize: '1.5rem', marginBottom: '0.75rem' }}>{title.split(' ')[0]}</div>
      <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
        {title.substring(title.indexOf(' ') + 1)}
      </div>
      <div style={{ fontSize: '0.875rem', color: '#666', flex: 1, marginBottom: '1rem' }}>
        {description}
      </div>
      {disabled ? (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#4b5563',
            color: '#9ca3af',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            textAlign: 'center'
          }}
        >
          Not Available
        </div>
      ) : (
        <Link
          href={href}
          style={{
            display: 'block',
            padding: '0.75rem',
            backgroundColor: buttonColor,
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.875rem',
            fontWeight: '600',
            textDecoration: 'none',
            textAlign: 'center'
          }}
        >
          {buttonText}
        </Link>
      )}
    </div>
  );
}





