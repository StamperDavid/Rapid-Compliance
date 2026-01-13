'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';
import Tooltip from '@/components/Tooltip';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { adminUser, loading } = useAdminAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  useEffect(() => {
    if (!loading && !adminUser) {
      // Redirect to admin login if not authenticated
      router.push('/admin-login');
    }
  }, [adminUser, loading, router]);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        backgroundColor: '#000',
        color: '#fff'
      }}>
        Loading...
      </div>
    );
  }

  if (!adminUser) {
    return null;
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#000', flexDirection: 'column' }}>
      {/* Mobile Header with Hamburger */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #1a1a1a',
        backgroundColor: '#0a0a0a',
      }} className="md:hidden flex items-center justify-between">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            padding: '0.5rem',
            backgroundColor: '#1a1a1a',
            color: '#999',
            border: 'none',
            borderRadius: '0.375rem',
            cursor: 'pointer',
            fontSize: '1.25rem',
          }}
          aria-label="Toggle menu"
        >
          ☰
        </button>
        <span style={{ color: '#fff', fontWeight: '600' }}>Platform Admin</span>
      </div>

      <div style={{ display: 'flex', flex: 1, position: 'relative' }}>
        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 40,
            }}
            className="md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside style={{
          width: '260px',
          backgroundColor: '#0a0a0a',
          borderRight: '1px solid #1a1a1a',
          display: 'flex',
          flexDirection: 'column',
          position: 'fixed',
          height: '100%',
          zIndex: 50,
          transform: mobileMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s',
        }}
        className="md:relative md:translate-x-0"
        >
        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #1a1a1a' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>
            Platform Admin
          </h1>
          <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
            {adminUser.displayName}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#999', marginTop: '0.25rem' }}>
            {adminUser.role.replace('_', ' ').toUpperCase()}
          </p>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
          <NavSection title="Overview">
            <NavLink href="/admin" icon="📊" tooltip="Platform overview dashboard with key metrics, system health, and quick actions">Dashboard</NavLink>
          </NavSection>

          <NavSection title="Organizations">
            <NavLink href="/admin/organizations" icon="🏢" tooltip="View and manage all customer organizations. Create new organizations from this page.">Organizations</NavLink>
          </NavSection>

          <NavSection title="Users">
            <NavLink href="/admin/users" icon="👥" tooltip="View all platform users across all organizations">All Users</NavLink>
          </NavSection>

          <NavSection title="Billing">
            <NavLink href="/admin/billing" icon="💳" tooltip="View subscriptions, payments, and invoices (all tabs on one page)">Billing</NavLink>
            <NavLink href="/admin/subscriptions" icon="💰" tooltip="Manage customer subscriptions and plans">Subscriptions</NavLink>
          </NavSection>

          <NavSection title="Analytics">
            <NavLink href="/admin/analytics" icon="📈" tooltip="Platform-wide usage analytics: API calls, storage, feature usage">Usage Analytics</NavLink>
            <NavLink href="/admin/revenue" icon="💵" tooltip="Revenue reports, MRR, ARR, and revenue trends">Revenue</NavLink>
            <NavLink href="/admin/sales-agent" icon="🤖" tooltip="Your AI sales agent performance, conversations, and training">Sales Agent</NavLink>
          </NavSection>
          
          <NavSection title="Sales Agent Tools">
            <NavLink href="/admin/sales-agent/persona" icon="🎭" tooltip="Configure comprehensive expert persona: identity, cognitive logic, knowledge, and execution rules">Agent Persona</NavLink>
            <NavLink href="/admin/sales-agent/training" icon="🎓" tooltip="Train your sales agent on objection handling, pricing, and demos">Training Center</NavLink>
            <NavLink href="/admin/sales-agent/knowledge" icon="📚" tooltip="Manage platform knowledge base, features, and pricing information">Knowledge Base</NavLink>
          </NavSection>

          <NavSection title="System">
            <NavLink href="/admin/system/health" icon="🏥" tooltip="Monitor system health: database, storage, AI, email, SMS services status">System Health</NavLink>
            <NavLink href="/admin/system/api-keys" icon="🔑" tooltip="Manage YOUR platform API keys: Firebase, Stripe, Gemini, etc. (separate from client keys)">Platform API Keys</NavLink>
            <NavLink href="/admin/system/flags" icon="🎚️" tooltip="Enable/disable platform features for all organizations">Feature Controls</NavLink>
            <NavLink href="/admin/system/logs" icon="📋" tooltip="View audit logs of all platform actions and changes">Audit Logs</NavLink>
            <NavLink href="/admin/system/settings" icon="⚙️" tooltip="Platform-wide settings: limits, maintenance mode, system parameters">Settings</NavLink>
          </NavSection>

          <NavSection title="Support">
            <NavLink href="/admin/support/impersonate" icon="👤" tooltip="Impersonate a user to help with support issues (view their account as them)">Impersonate User</NavLink>
            <NavLink href="/admin/support/exports" icon="📤" tooltip="Export organization data, user data, or full platform backups">Data Exports</NavLink>
            <NavLink href="/admin/support/bulk-ops" icon="⚡" tooltip="Perform bulk operations: suspend multiple orgs, send bulk emails, etc.">Bulk Operations</NavLink>
          </NavSection>

          <NavSection title="Advanced">
            <NavLink href="/admin/advanced/compliance" icon="🛡️" tooltip="Compliance settings: GDPR, data retention, privacy policies">Compliance</NavLink>
          </NavSection>
        </nav>

        {/* Footer */}
        <div style={{ padding: '1rem', borderTop: '1px solid #1a1a1a' }}>
          <Tooltip content="Return to the main CRM platform (client view)">
            <Link 
              href="/" 
              style={{ 
                display: 'block',
                padding: '0.5rem',
                color: '#999',
                textDecoration: 'none',
                fontSize: '0.875rem',
                textAlign: 'center'
              }}
            >
              ← Back to Platform
            </Link>
          </Tooltip>
        </div>
      </aside>

        {/* Main Content */}
        <main style={{ flex: 1, backgroundColor: '#000', width: '100%' }} className="md:ml-0">
          {children}
        </main>
      </div>
    </div>
  );
}

function NavSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '1.5rem' }}>
      <h3 style={{
        fontSize: '0.75rem',
        fontWeight: '600',
        color: '#666',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        padding: '0 1.25rem',
        marginBottom: '0.5rem'
      }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function NavLink({ href, icon, children, tooltip }: { 
  href: string; 
  icon: string; 
  children: React.ReactNode;
  tooltip?: string;
}) {
  const link = (
    <Link
      href={href}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        padding: '0.75rem 1.25rem',
        color: '#999',
        textDecoration: 'none',
        fontSize: '0.875rem',
        transition: 'all 0.2s'
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
      <span style={{ fontSize: '1.25rem' }}>{icon}</span>
      <span>{children}</span>
    </Link>
  );

  if (tooltip) {
    return <Tooltip content={tooltip} position="right">{link}</Tooltip>;
  }

  return link;
}

