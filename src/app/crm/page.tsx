'use client';

import { useState, useEffect } from 'react';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';

type ViewType = 'companies' | 'contacts' | 'deals' | 'products' | 'quotes' | 'invoices' | 'orders' | 'tasks';

export default function CRMPage() {
  const [config, setConfig] = useState<any>(null);
  const [activeView, setActiveView] = useState<ViewType>('companies');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Load configuration
  useEffect(() => {
    const stored = localStorage.getItem('crmConfig');
    if (stored) {
      setConfig(JSON.parse(stored));
    }
  }, []);

  // Sample data
  const [companies] = useState([
    { id: '1', name: 'Acme Corp', website: 'acme.com', phone: '555-0100', industry: 'Technology', status: 'Active', annual_revenue: 5000000 },
    { id: '2', name: 'Global Industries', website: 'global.com', phone: '555-0200', industry: 'Manufacturing', status: 'Active', annual_revenue: 12000000 },
    { id: '3', name: 'Tech Solutions', website: 'techsol.com', phone: '555-0300', industry: 'Technology', status: 'Prospect', annual_revenue: 2500000 },
  ]);

  const [contacts] = useState([
    { id: '1', first_name: 'John', last_name: 'Doe', email: 'john@acme.com', phone: '555-0101', title: 'CEO', company_id: '1', status: 'Active' },
    { id: '2', first_name: 'Jane', last_name: 'Smith', email: 'jane@global.com', phone: '555-0201', title: 'VP Sales', company_id: '2', status: 'Active' },
    { id: '3', first_name: 'Bob', last_name: 'Johnson', email: 'bob@techsol.com', phone: '555-0301', title: 'CTO', company_id: '3', status: 'Active' },
  ]);

  const [deals] = useState([
    { id: '1', name: 'Q1 2024 Contract', company_id: '1', contact_id: '1', amount: 50000, stage: 'Proposal', probability: 60, expected_close_date: '2024-03-31' },
    { id: '2', name: 'Enterprise License', company_id: '2', contact_id: '2', amount: 125000, stage: 'Negotiation', probability: 80, expected_close_date: '2024-02-28' },
    { id: '3', name: 'Consulting Package', company_id: '3', contact_id: '3', amount: 75000, stage: 'Qualification', probability: 40, expected_close_date: '2024-04-15' },
  ]);

  const [products] = useState([
    { id: '1', name: 'Premium Plan', sku: 'PLAN-PREM', price: 299, category: 'Subscription', active: true, stock_quantity: 999 },
    { id: '2', name: 'Enterprise Plan', sku: 'PLAN-ENT', price: 999, category: 'Subscription', active: true, stock_quantity: 999 },
    { id: '3', name: 'Consulting Hours', sku: 'CONS-HR', price: 200, category: 'Service', active: true, stock_quantity: 0 },
  ]);

  const [quotes] = useState([
    { id: '1', quote_number: 'QUO-001', company_id: '1', quote_date: '2024-01-10', expiry_date: '2024-02-10', total: 50000, status: 'Sent' },
    { id: '2', quote_number: 'QUO-002', company_id: '2', quote_date: '2024-01-15', expiry_date: '2024-02-15', total: 125000, status: 'Accepted' },
  ]);

  const [invoices] = useState([
    { id: '1', invoice_number: 'INV-001', company_id: '1', invoice_date: '2024-01-15', due_date: '2024-02-15', total: 50000, paid_amount: 25000, balance: 25000, status: 'Partial' },
    { id: '2', invoice_number: 'INV-002', company_id: '2', invoice_date: '2024-01-20', due_date: '2024-02-20', total: 125000, paid_amount: 125000, balance: 0, status: 'Paid' },
  ]);

  const [orders] = useState([
    { id: '1', order_number: 'ORD-001', company_id: '1', order_date: '2024-01-15', total: 50000, status: 'Processing' },
  ]);

  const [tasks] = useState([
    { id: '1', subject: 'Follow up with Acme', due_date: '2024-01-25', priority: 'High', status: 'In Progress' },
    { id: '2', subject: 'Send proposal to Global', due_date: '2024-01-26', priority: 'Urgent', status: 'Not Started' },
    { id: '3', subject: 'Schedule demo with Tech Solutions', due_date: '2024-01-27', priority: 'Normal', status: 'Not Started' },
  ]);

  const dataMap: Record<ViewType, any[]> = {
    companies, contacts, deals, products, quotes, invoices, orders, tasks
  };

  const getActiveData = () => dataMap[activeView] || [];
  const getSchema = () => STANDARD_SCHEMAS[activeView];
  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    return company?.name || '-';
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#000000' }}>
      {/* Sidebar */}
      <div style={{ 
        width: sidebarOpen ? '260px' : '70px',
        backgroundColor: '#0a0a0a',
        borderRight: '1px solid #1a1a1a',
        transition: 'width 0.3s',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Brand */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #1a1a1a' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ fontSize: '1.5rem' }}>🚀</div>
            {sidebarOpen && (
              <div>
                <h1 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>
                  {config?.businessName || 'AI CRM'}
                </h1>
                <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>
                  {config?.industry ? STANDARD_SCHEMAS[config.industry]?.name : 'Platform'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
          {Object.entries(STANDARD_SCHEMAS).map(([key, schema]) => (
            <button
              key={key}
              onClick={() => setActiveView(key as ViewType)}
              style={{
                width: '100%',
                padding: '0.875rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: activeView === key ? '#1a1a1a' : 'transparent',
                color: activeView === key ? '#6366f1' : '#999',
                border: 'none',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: activeView === key ? '600' : '400',
                borderLeft: activeView === key ? '3px solid #6366f1' : '3px solid transparent',
                textAlign: 'left',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (activeView !== key) e.currentTarget.style.backgroundColor = '#111';
              }}
              onMouseLeave={(e) => {
                if (activeView !== key) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
              {sidebarOpen && <span>{schema.pluralName}</span>}
            </button>
          ))}
        </nav>

        {/* Collapse Button */}
        <div style={{ padding: '1rem', borderTop: '1px solid #1a1a1a' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: '#1a1a1a',
              color: '#999',
              border: 'none',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            {sidebarOpen ? '← Collapse' : '→'}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Bar */}
        <div style={{ 
          backgroundColor: '#0a0a0a',
          borderBottom: '1px solid #1a1a1a',
          padding: '1.25rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>
              {getSchema().pluralName}
            </h2>
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
              {getActiveData().length} total records
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: '#6366f1',
              color: 'white',
              border: 'none',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.875rem'
            }}>
              + New {getSchema().singularName}
            </button>
            <button style={{
              padding: '0.625rem 1rem',
              backgroundColor: '#1a1a1a',
              color: '#999',
              border: '1px solid #333',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}>
              Import
            </button>
            <button style={{
              padding: '0.625rem 1rem',
              backgroundColor: '#1a1a1a',
              color: '#999',
              border: '1px solid #333',
              borderRadius: '0.5rem',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}>
              Export
            </button>
          </div>
        </div>

        {/* Content Area with Data Table */}
        <div style={{ flex: 1, padding: '2rem', overflow: 'auto', backgroundColor: '#000' }}>
          <div style={{ backgroundColor: '#0a0a0a', borderRadius: '0.75rem', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#111' }}>
                <tr>
                  {getSchema().fields.slice(0, 6).map((field: any) => (
                    <th key={field.key} style={{
                      padding: '1rem 1.5rem',
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: '#999',
                      textTransform: 'uppercase',
                      borderBottom: '2px solid #1a1a1a'
                    }}>
                      {field.label}
                    </th>
                  ))}
                  <th style={{
                    padding: '1rem 1.5rem',
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: '#999',
                    textTransform: 'uppercase',
                    borderBottom: '2px solid #1a1a1a'
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {getActiveData().map((record: any, idx: number) => (
                  <tr key={record.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    {getSchema().fields.slice(0, 6).map((field: any) => (
                      <td key={field.key} style={{ padding: '1rem 1.5rem', color: '#ffffff' }}>
                        {field.type === 'currency' ? (
                          <span style={{ fontWeight: '600' }}>${Number(record[field.key] || 0).toLocaleString()}</span>
                        ) : field.type === 'lookup' && field.key === 'company_id' ? (
                          <span style={{ color: '#6366f1' }}>{getCompanyName(record[field.key])}</span>
                        ) : field.type === 'checkbox' ? (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: record[field.key] ? '#065f46' : '#333',
                            color: record[field.key] ? '#6ee7b7' : '#999',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem'
                          }}>
                            {record[field.key] ? 'Yes' : 'No'}
                          </span>
                        ) : field.key.includes('status') || field.key.includes('stage') ? (
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#1a1a1a',
                            color: record[field.key] === 'Active' || record[field.key] === 'Paid' ? '#10b981' : '#6366f1',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            border: '1px solid #333'
                          }}>
                            {record[field.key]}
                          </span>
                        ) : (
                          record[field.key] || '-'
                        )}
                      </td>
                    ))}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <button style={{ color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem', fontSize: '0.875rem' }}>
                        View
                      </button>
                      <button style={{ color: '#999', background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem', fontSize: '0.875rem' }}>
                        Edit
                      </button>
                      <button style={{ color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  function getCompanyName(companyId: string) {
    const company = companies.find((c: any) => c.id === companyId);
    return company?.name || '-';
  }
}

