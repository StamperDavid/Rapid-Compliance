'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';
import FilterBuilder from '@/components/FilterBuilder';
import { FilterEngine } from '@/lib/filters/filter-engine';
import type { ViewFilter } from '@/types/filters';
import { useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme'
import { logger } from '@/lib/logger/logger';

type ViewType = 'leads' | 'companies' | 'contacts' | 'deals' | 'products' | 'quotes' | 'invoices' | 'payments' | 'orders' | 'tasks';

// Type definitions for CRM entities
interface BaseRecord {
  id: string;
}

interface Lead extends BaseRecord {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  lead_source: string;
  lead_status: string;
  rating: string;
  estimated_value: number;
}

interface Company extends BaseRecord {
  name: string;
  website: string;
  phone: string;
  industry: string;
  status: string;
  annual_revenue: number;
}

interface Contact extends BaseRecord {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  title: string;
  company_id: string;
  status: string;
}

interface Deal extends BaseRecord {
  name: string;
  company_id: string;
  contact_id: string;
  amount: number;
  stage: string;
  probability: number;
  expected_close_date: string;
}

interface Product extends BaseRecord {
  name: string;
  sku: string;
  price: number;
  category: string;
  active: boolean;
  stock_quantity: number;
}

interface Quote extends BaseRecord {
  quote_number: string;
  company_id: string;
  quote_date: string;
  expiry_date: string;
  total: number;
  status: string;
}

interface Invoice extends BaseRecord {
  invoice_number: string;
  company_id: string;
  invoice_date: string;
  due_date: string;
  total: number;
  paid_amount: number;
  balance: number;
  status: string;
}

interface Payment extends BaseRecord {
  payment_number: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  transaction_id: string;
  status: string;
}

interface Order extends BaseRecord {
  order_number: string;
  company_id: string;
  order_date: string;
  total: number;
  status: string;
}

interface Task extends BaseRecord {
  subject: string;
  due_date: string;
  priority: string;
  status: string;
}

type CRMRecord = Lead | Company | Contact | Deal | Product | Quote | Invoice | Payment | Order | Task;

interface CRMConfig {
  businessName?: string;
  industry?: string;
  [key: string]: unknown;
}

interface SchemaField {
  key: string;
  label: string;
  type: string;
  options?: string[];
}

interface ImportPreviewRow {
  [key: string]: string;
}

interface _CapacityCheckResponse {
  allowed: boolean;
  message: string;
}

// Component that uses useSearchParams - wrapped in Suspense
function CRMContent() {
  const { user } = useAuth();
  const { theme } = useOrgTheme(); // Load organization-specific theme
  const searchParams = useSearchParams();
  const [config, setConfig] = useState<CRMConfig | null>(null);
  const [activeView, setActiveView] = useState<ViewType>('leads');
  
  // Update activeView based on URL query parameter
  useEffect(() => {
    const viewParam = searchParams.get('view') as ViewType | null;
    if (viewParam && ['leads', 'companies', 'contacts', 'deals', 'products', 'quotes', 'invoices', 'payments', 'orders', 'tasks'].includes(viewParam)) {
      setActiveView(viewParam);
    }
  }, [searchParams]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showFilterBuilder, setShowFilterBuilder] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ViewFilter | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<CRMRecord | null>(null);
  const [formData, setFormData] = useState<Partial<CRMRecord>>({});
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Load configuration from Firestore
  useEffect(() => {
    if (!user?.organizationId) {return;}
    
    const loadConfig = async () => {
      try {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const configData = await FirestoreService.get(
          `${COLLECTIONS.ORGANIZATIONS}/${user.organizationId}/crmConfig`,
          'default'
        );
        
        if (configData) {
          setConfig(configData as CRMConfig);
        }
      } catch (error: unknown) {
        logger.error('Failed to load CRM config:', error instanceof Error ? error : new Error(String(error)), { file: 'page.tsx' });
        // Continue with null config (defaults will be used)
      }
    };

    void loadConfig();
  }, [user?.organizationId]);

  // Sample data with setters
  const [leads, setLeads] = useState<Lead[]>([
    { id: '1', first_name: 'Sarah', last_name: 'Williams', email: 'sarah@newtech.com', phone: '555-0400', company: 'NewTech Inc', title: 'Marketing Director', lead_source: 'Website', lead_status: 'New', rating: 'Hot', estimated_value: 75000 },
    { id: '2', first_name: 'Michael', last_name: 'Brown', email: 'mbrown@startup.io', phone: '555-0500', company: 'Startup.io', title: 'CEO', lead_source: 'Referral', lead_status: 'Contacted', rating: 'Warm', estimated_value: 150000 },
    { id: '3', first_name: 'Emily', last_name: 'Davis', email: 'emily@enterprise.com', phone: '555-0600', company: 'Enterprise Corp', title: 'VP Operations', lead_source: 'Cold Call', lead_status: 'Qualified', rating: 'Hot', estimated_value: 200000 },
  ]);

  const [companies, setCompanies] = useState<Company[]>([
    { id: '1', name: 'Acme Corp', website: 'acme.com', phone: '555-0100', industry: 'Technology', status: 'Active', annual_revenue: 5000000 },
    { id: '2', name: 'Global Industries', website: 'global.com', phone: '555-0200', industry: 'Manufacturing', status: 'Active', annual_revenue: 12000000 },
    { id: '3', name: 'Tech Solutions', website: 'techsol.com', phone: '555-0300', industry: 'Technology', status: 'Prospect', annual_revenue: 2500000 },
  ]);

  const [contacts, setContacts] = useState<Contact[]>([
    { id: '1', first_name: 'John', last_name: 'Doe', email: 'john@acme.com', phone: '555-0101', title: 'CEO', company_id: '1', status: 'Active' },
    { id: '2', first_name: 'Jane', last_name: 'Smith', email: 'jane@global.com', phone: '555-0201', title: 'VP Sales', company_id: '2', status: 'Active' },
    { id: '3', first_name: 'Bob', last_name: 'Johnson', email: 'bob@techsol.com', phone: '555-0301', title: 'CTO', company_id: '3', status: 'Active' },
  ]);

  const [deals, setDeals] = useState<Deal[]>([
    { id: '1', name: 'Q1 2024 Contract', company_id: '1', contact_id: '1', amount: 50000, stage: 'Proposal', probability: 60, expected_close_date: '2024-03-31' },
    { id: '2', name: 'Enterprise License', company_id: '2', contact_id: '2', amount: 125000, stage: 'Negotiation', probability: 80, expected_close_date: '2024-02-28' },
    { id: '3', name: 'Consulting Package', company_id: '3', contact_id: '3', amount: 75000, stage: 'Qualification', probability: 40, expected_close_date: '2024-04-15' },
  ]);

  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'Premium Plan', sku: 'PLAN-PREM', price: 299, category: 'Subscription', active: true, stock_quantity: 999 },
    { id: '2', name: 'Enterprise Plan', sku: 'PLAN-ENT', price: 999, category: 'Subscription', active: true, stock_quantity: 999 },
    { id: '3', name: 'Consulting Hours', sku: 'CONS-HR', price: 200, category: 'Service', active: true, stock_quantity: 0 },
  ]);

  const [quotes, setQuotes] = useState<Quote[]>([
    { id: '1', quote_number: 'QUO-001', company_id: '1', quote_date: '2024-01-10', expiry_date: '2024-02-10', total: 50000, status: 'Sent' },
    { id: '2', quote_number: 'QUO-002', company_id: '2', quote_date: '2024-01-15', expiry_date: '2024-02-15', total: 125000, status: 'Accepted' },
  ]);

  const [invoices, setInvoices] = useState<Invoice[]>([
    { id: '1', invoice_number: 'INV-001', company_id: '1', invoice_date: '2024-01-15', due_date: '2024-02-15', total: 50000, paid_amount: 25000, balance: 25000, status: 'Partial' },
    { id: '2', invoice_number: 'INV-002', company_id: '2', invoice_date: '2024-01-20', due_date: '2024-02-20', total: 125000, paid_amount: 125000, balance: 0, status: 'Paid' },
  ]);

  const [payments, setPayments] = useState<Payment[]>([
    { id: '1', payment_number: 'PAY-001', invoice_id: '1', payment_date: '2024-01-20', amount: 25000, payment_method: 'Stripe', transaction_id: 'ch_3abc123xyz', status: 'Completed' },
    { id: '2', payment_number: 'PAY-002', invoice_id: '2', payment_date: '2024-01-25', amount: 125000, payment_method: 'Bank Transfer', transaction_id: 'ACH-987654', status: 'Completed' },
    { id: '3', payment_number: 'PAY-003', invoice_id: '1', payment_date: '2024-02-01', amount: 25000, payment_method: 'Credit Card', transaction_id: 'ch_4def456uvw', status: 'Completed' },
  ]);

  const [orders, setOrders] = useState<Order[]>([
    { id: '1', order_number: 'ORD-001', company_id: '1', order_date: '2024-01-15', total: 50000, status: 'Processing' },
  ]);

  const [tasks, setTasks] = useState<Task[]>([
    { id: '1', subject: 'Follow up with Acme', due_date: '2024-01-25', priority: 'High', status: 'In Progress' },
    { id: '2', subject: 'Send proposal to Global', due_date: '2024-01-26', priority: 'Urgent', status: 'Not Started' },
    { id: '3', subject: 'Schedule demo with Tech Solutions', due_date: '2024-01-27', priority: 'Normal', status: 'Not Started' },
  ]);

  const dataMap: Record<ViewType, CRMRecord[]> = {
    leads, companies, contacts, deals, products, quotes, invoices, payments, orders, tasks
  };

  const setterMap: Record<ViewType, React.Dispatch<React.SetStateAction<CRMRecord[]>>> = {
    leads: setLeads as React.Dispatch<React.SetStateAction<CRMRecord[]>>,
    companies: setCompanies as React.Dispatch<React.SetStateAction<CRMRecord[]>>,
    contacts: setContacts as React.Dispatch<React.SetStateAction<CRMRecord[]>>,
    deals: setDeals as React.Dispatch<React.SetStateAction<CRMRecord[]>>,
    products: setProducts as React.Dispatch<React.SetStateAction<CRMRecord[]>>,
    quotes: setQuotes as React.Dispatch<React.SetStateAction<CRMRecord[]>>,
    invoices: setInvoices as React.Dispatch<React.SetStateAction<CRMRecord[]>>,
    payments: setPayments as React.Dispatch<React.SetStateAction<CRMRecord[]>>,
    orders: setOrders as React.Dispatch<React.SetStateAction<CRMRecord[]>>,
    tasks: setTasks as React.Dispatch<React.SetStateAction<CRMRecord[]>>,
  };

  const getActiveData = (): CRMRecord[] => {
    let data: CRMRecord[] = dataMap[activeView] || [];

    // Apply filters first
    if (activeFilter) {
      const filtered = FilterEngine.applyFilter(data as unknown as Record<string, unknown>[], activeFilter);
      data = filtered as unknown as CRMRecord[];
    }

    // Then apply search
    if (searchQuery) {
      data = data.filter((record: CRMRecord) => {
        return Object.values(record).some((value: unknown) =>
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
        );
      });
    }

    return data;
  };

  const getSchema = () => STANDARD_SCHEMAS[activeView];
  
  const getCompanyName = (companyId: string) => {
    const company = companies.find(c => c.id === companyId);
    const companyName = company?.name;
    return (companyName !== '' && companyName != null) ? companyName : '-';
  };

  // CRUD Operations
  const handleAdd = () => {
    setFormData({});
    setShowAddModal(true);
  };

  const handleEdit = (record: CRMRecord) => {
    setSelectedRecord(record);
    setFormData({ ...record });
    setShowEditModal(true);
  };

  const handleDelete = (record: CRMRecord) => {
    setSelectedRecord(record);
    setShowDeleteConfirm(true);
  };

  const handleSaveNew = () => {
    const newRecord = {
      ...formData,
      id: Date.now().toString(),
    } as CRMRecord;

    const setter = setterMap[activeView];
    setter((prev: CRMRecord[]) => [...prev, newRecord]);
    setShowAddModal(false);
    setFormData({});
    showToast(`${getSchema().singularName} added successfully!`, 'success');
  };

  const handleSaveEdit = () => {
    if (!selectedRecord) {return;}
    const setter = setterMap[activeView];
    setter((prev: CRMRecord[]) =>
      prev.map(item => item.id === selectedRecord.id ? { ...item, ...formData } as CRMRecord : item)
    );
    setShowEditModal(false);
    setFormData({});
    setSelectedRecord(null);
    showToast(`${getSchema().singularName} updated successfully!`, 'success');
  };

  const confirmDelete = () => {
    if (!selectedRecord) {return;}
    const setter = setterMap[activeView];
    setter((prev: CRMRecord[]) => prev.filter(item => item.id !== selectedRecord.id));
    setShowDeleteConfirm(false);
    setSelectedRecord(null);
    showToast(`${getSchema().singularName} deleted successfully!`, 'success');
  };

  const handleExport = () => {
    const data = getActiveData();
    const csv = [
      Object.keys(data[0] ?? {}).join(','),
      ...data.map((row: CRMRecord) => Object.values(row).join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeView}-${Date.now()}.csv`;
    a.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {return;}

    setImportFile(file);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length < 2) {
        showToast('Invalid CSV file', 'error');
        return;
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const totalRows = lines.length - 1; // Subtract header row

      // NEW: Check record capacity before importing
      try {
        const capacityResponse = await fetch('/api/subscription/check-capacity', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId: user?.organizationId,
            additionalRecords: totalRows,
          }),
        });

        if (capacityResponse.ok) {
          const capacityCheck = await capacityResponse.json() as unknown;

          if (
            capacityCheck &&
            typeof capacityCheck === 'object' &&
            'allowed' in capacityCheck &&
            'message' in capacityCheck &&
            typeof capacityCheck.message === 'string'
          ) {
            if (!capacityCheck.allowed) {
              showToast(
                `⚠️ Cannot import ${totalRows} records. ${capacityCheck.message}`,
                'error'
              );
              setImportFile(null);
              return;
            }

            // Show capacity info
            showToast(
              `✅ ${capacityCheck.message}`,
              'success'
            );
          }
        }
      } catch (error: unknown) {
        console.error('Error checking capacity:', error instanceof Error ? error.message : String(error));
        // Continue anyway - don't block import on capacity check failure
      }

      const data = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        return headers.reduce((obj: ImportPreviewRow, header, idx) => {
          obj[header] = values[idx] || '';
          return obj;
        }, {} as ImportPreviewRow);
      });

      setImportPreview(data);

      // Auto-map columns intelligently
      const schema = getSchema();
      const mapping: Record<string, string> = {};
      headers.forEach(header => {
        const lowerHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
        const matchedField = schema.fields.find((f: SchemaField) =>
          f.key.toLowerCase() === lowerHeader ||
          f.label.toLowerCase() === header.toLowerCase() ||
          lowerHeader.includes(f.key.toLowerCase())
        );
        if (matchedField) {
          mapping[header] = matchedField.key;
        }
      });
      setColumnMapping(mapping);
    };
    reader.readAsText(file);
  };

  const handleImportConfirm = () => {
    if (!importFile) {return;}

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      const newRecords = lines.slice(1).map((line, idx) => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const record: Partial<CRMRecord> = { id: `import-${Date.now()}-${idx}` };

        headers.forEach((header, i) => {
          const targetField = columnMapping[header];
          if (targetField && values[i]) {
            (record as Record<string, unknown>)[targetField] = values[i];
          }
        });

        return record as CRMRecord;
      });

      const setter = setterMap[activeView];
      setter((prev: CRMRecord[]) => [...prev, ...newRecords]);
      
      setShowImportModal(false);
      setImportFile(null);
      setImportPreview([]);
      setColumnMapping({});
      showToast(`Successfully imported ${newRecords.length} ${getSchema().pluralName}!`, 'success');
    };
    reader.readAsText(importFile);
  };

  const configBusinessName = config?.businessName;
  const brandName = theme?.branding?.companyName || ((configBusinessName !== '' && configBusinessName != null) ? configBusinessName : 'AI CRM');
  const logoUrl = theme?.branding?.logoUrl;
  const primaryColor = theme?.colors?.primary?.main || '#6366f1';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
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
          <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', cursor: 'pointer' }}>
            {logoUrl ? (
              <Image src={logoUrl} alt={brandName} width={sidebarOpen ? 150 : 32} height={sidebarOpen ? 40 : 32} style={{ maxHeight: sidebarOpen ? '40px' : '32px', maxWidth: sidebarOpen ? '150px' : '32px', objectFit: 'contain' }} />
            ) : (
              <>
                <div style={{ fontSize: '1.5rem' }}>🚀</div>
                {sidebarOpen && (
                  <div>
                    <h1 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: '#ffffff', margin: 0 }}>
                      {brandName}
                    </h1>
                    <p style={{ fontSize: '0.75rem', color: '#666', margin: 0 }}>
                      {config?.industry ? STANDARD_SCHEMAS[config.industry as keyof typeof STANDARD_SCHEMAS]?.name : 'Platform'}
                    </p>
                  </div>
                )}
              </>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
          {/* Dashboard Link */}
          <Link
            href="/dashboard"
            style={{
              width: '100%',
              padding: '0.875rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              backgroundColor: 'transparent',
              color: '#999',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: '400',
              borderLeft: '3px solid transparent',
              textAlign: 'left',
              transition: 'all 0.2s',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#111';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>📊</span>
            {sidebarOpen && <span>Dashboard</span>}
          </Link>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: '#1a1a1a', margin: '0.5rem 0' }}></div>

          {/* Entity Navigation */}
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
                  color: activeView === key ? primaryColor : '#999',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: activeView === key ? '600' : '400',
                  borderLeft: activeView === key ? `3px solid ${primaryColor}` : '3px solid transparent',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              onMouseEnter={(e) => {
                if (activeView !== key) {e.currentTarget.style.backgroundColor = '#111';}
              }}
              onMouseLeave={(e) => {
                if (activeView !== key) {e.currentTarget.style.backgroundColor = 'transparent';}
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
              {sidebarOpen && <span>{schema.pluralName}</span>}
            </button>
          ))}
        </nav>

        {/* Settings Links - REMOVED (now in AdminBar) */}
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

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.625rem 1rem',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: '1px solid #333',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                minWidth: '200px'
              }}
            />
            <button
              onClick={() => setShowFilterBuilder(true)}
              style={{
                padding: '0.625rem 1rem',
                backgroundColor: activeFilter ? primaryColor : '#1a1a1a',
                color: activeFilter ? '#fff' : '#999',
                border: `1px solid ${activeFilter ? primaryColor : '#333'}`,
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              🔍 Filter
              {activeFilter && activeFilter.groups[0]?.conditions.length > 0 && (
                <span style={{ padding: '2px 6px', backgroundColor: theme?.colors?.primary?.dark || '#4f46e5', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '600' }}>
                  {activeFilter.groups.reduce((sum, g) => sum + g.conditions.length, 0)}
                </span>
              )}
            </button>
            {activeFilter && (
              <button
                onClick={() => setActiveFilter(null)}
                style={{
                  padding: '0.625rem',
                  backgroundColor: '#1a1a1a',
                  color: '#dc2626',
                  border: '1px solid #333',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
                title="Clear filters"
              >
                ×
              </button>
            )}
            <button 
              onClick={() => setShowImportModal(true)}
              style={{
                padding: '0.625rem 1rem',
                backgroundColor: '#1a1a1a',
                color: '#999',
                border: '1px solid #333',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500'
              }}>
              📥 Import
            </button>
            <button 
              onClick={handleExport}
              style={{
                padding: '0.625rem 1rem',
                backgroundColor: '#1a1a1a',
                color: '#999',
                border: '1px solid #333',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}>
              📤 Export
            </button>
            <button 
              onClick={handleAdd}
              style={{
                padding: '0.625rem 1.25rem',
                backgroundColor: primaryColor,
                color: 'white',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem'
              }}>
              + New {getSchema().singularName}
            </button>
          </div>
        </div>

        {/* Content Area with Data Table */}
        <div style={{ flex: 1, padding: '2rem', overflow: 'auto', backgroundColor: '#000' }}>
          <div style={{ backgroundColor: '#0a0a0a', borderRadius: '0.75rem', border: '1px solid #1a1a1a', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: '#111' }}>
                <tr>
                  {getSchema().fields.slice(0, 6).map((field: SchemaField) => (
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
                {getActiveData().map((record: CRMRecord) => {
                  const recordData = record as unknown as Record<string, unknown>;
                  return (
                  <tr key={record.id} style={{ borderBottom: '1px solid #1a1a1a' }}>
                    {getSchema().fields.slice(0, 6).map((field: SchemaField) => (
                      <td key={field.key} style={{ padding: '1rem 1.5rem', color: '#ffffff' }}>
                        {field.type === 'currency' ? (
                          <span style={{ fontWeight: '600' }}>${Number(recordData[field.key] ?? 0).toLocaleString()}</span>
                        ) : field.type === 'lookup' && field.key === 'company_id' ? (
                          <span style={{ color: primaryColor }}>{getCompanyName(String(recordData[field.key] ?? ''))}</span>
                        ) : field.type === 'checkbox' ? (
                          <span style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: recordData[field.key] ? '#065f46' : '#333',
                            color: recordData[field.key] ? '#6ee7b7' : '#999',
                            borderRadius: '0.25rem',
                            fontSize: '0.75rem'
                          }}>
                            {recordData[field.key] ? 'Yes' : 'No'}
                          </span>
                        ) : field.key.includes('status') || field.key.includes('stage') ? (
                          <span style={{
                            padding: '0.25rem 0.75rem',
                            backgroundColor: '#1a1a1a',
                            color: recordData[field.key] === 'Active' || recordData[field.key] === 'Paid' ? theme?.colors?.success?.main || '#10b981' : primaryColor,
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            border: '1px solid #333'
                          }}>
                            {String(recordData[field.key] ?? '')}
                          </span>
                        ) : (
(recordData[field.key] !== '' && recordData[field.key] != null) ? String(recordData[field.key]) : '-'
                        )}
                      </td>
                    ))}
                    <td style={{ padding: '1rem 1.5rem', textAlign: 'right' }}>
                      <button
                        onClick={() => handleEdit(record)}
                        style={{ color: primaryColor, background: 'none', border: 'none', cursor: 'pointer', marginRight: '1rem', fontSize: '0.875rem' }}>
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(record)}
                        style={{ color: theme?.colors?.error?.main || '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: '#0a0a0a', borderRadius: '1rem', border: '1px solid #333', padding: '2rem', minWidth: '500px', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>
              Add New {getSchema().singularName}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {getSchema().fields.map((field: SchemaField) => {
                const formDataRecord = formData as Record<string, unknown>;
                return (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={String(formDataRecord[field.key] ?? '')}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(formDataRecord[field.key] ?? false)}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                  ) : field.type === 'lookup' && field.key === 'company_id' ? (
                    <select
                      value={String(formDataRecord[field.key] ?? '')}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    >
                      <option value="">Select Company...</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'currency' || field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={String(formDataRecord[field.key] ?? '')}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    />
                  )}
                </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#999', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNew}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: primaryColor, color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Add {getSchema().singularName}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: '#0a0a0a', borderRadius: '1rem', border: '1px solid #333', padding: '2rem', minWidth: '500px', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>
              Edit {getSchema().singularName}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {getSchema().fields.map((field: SchemaField) => {
                const formDataRecord = formData as Record<string, unknown>;
                return (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={String(formDataRecord[field.key] ?? '')}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    >
                      <option value="">Select...</option>
                      {field.options?.map((opt: string) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                  ) : field.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      checked={Boolean(formDataRecord[field.key] ?? false)}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.checked })}
                      style={{ width: '1.25rem', height: '1.25rem' }}
                    />
                  ) : field.type === 'lookup' && field.key === 'company_id' ? (
                    <select
                      value={String(formDataRecord[field.key] ?? '')}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    >
                      <option value="">Select Company...</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type === 'currency' || field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={String(formDataRecord[field.key] ?? '')}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    />
                  )}
                </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#999', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: primaryColor, color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: '#0a0a0a', borderRadius: '1rem', border: '1px solid #333', padding: '2rem', minWidth: '400px' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
              Confirm Delete
            </h3>
            <p style={{ color: '#999', marginBottom: '1.5rem' }}>
              Are you sure you want to delete this {getSchema().singularName}? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#999', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: theme?.colors?.error?.main || '#dc2626', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Filter Builder Modal */}
      {showFilterBuilder && (
        <FilterBuilder
          fields={getSchema().fields.map((f: SchemaField) => ({
            key: f.key,
            label: f.label,
            type: f.type,
            options: f.options
          }))}
          onApply={(filter) => setActiveFilter(filter)}
          onClose={() => setShowFilterBuilder(false)}
          initialFilter={activeFilter ?? undefined}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: '#0a0a0a', borderRadius: '1rem', border: '1px solid #333', padding: '2rem', minWidth: '700px', maxWidth: '900px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '1rem' }}>
              Import {getSchema().pluralName}
            </h3>
            <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '1.5rem' }}>
              Upload a CSV file. We&apos;ll automatically map columns to your {getSchema().singularName} schema.
            </p>

            {!importFile ? (
              // File Upload
              <div>
                <label 
                  htmlFor="import-file-upload"
                  style={{
                    display: 'block',
                    border: '2px dashed #333',
                    borderRadius: '0.75rem',
                    padding: '3rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: '#111',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = primaryColor;
                    e.currentTarget.style.backgroundColor = '#1a1a1a';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.backgroundColor = '#111';
                  }}
                >
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
                  <p style={{ fontSize: '1.125rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                    Click to upload or drag and drop
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#666' }}>
                    CSV files only (Max 10MB)
                  </p>
                  <input
                    id="import-file-upload"
                    type="file"
                    accept=".csv"
                    onChange={(e) => void handleImportFile(e)}
                    style={{ display: 'none' }}
                  />
                </label>

                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', border: '1px solid #333' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff', marginBottom: '0.5rem' }}>
                    💡 Expected Columns for {getSchema().pluralName}:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {getSchema().fields.slice(0, 8).map((field: SchemaField) => (
                      <span key={field.key} style={{ padding: '0.25rem 0.75rem', backgroundColor: '#222', color: primaryColor, borderRadius: '9999px', fontSize: '0.75rem', border: '1px solid #333' }}>
                        {field.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Preview and Mapping
              <div>
                <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#1a1a1a', borderRadius: '0.5rem', border: '1px solid #333' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>📄 {importFile.name}</p>
                      <p style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>
                        {importPreview.length} records found (showing first 5)
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setImportFile(null);
                        setImportPreview([]);
                        setColumnMapping({});
                      }}
                      style={{ padding: '0.5rem 0.75rem', backgroundColor: '#222', color: '#999', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Change File
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem' }}>
                    Column Mapping (auto-detected):
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto', padding: '0.5rem' }}>
                    {Object.keys(columnMapping).map((csvColumn) => (
                      <div key={csvColumn} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                        <span style={{ color: '#999', flex: 1 }}>{csvColumn}</span>
                        <span style={{ color: '#666' }}>→</span>
                        <select
                          value={columnMapping[csvColumn]}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, [csvColumn]: e.target.value }))}
                          style={{ flex: 1, padding: '0.375rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.375rem', fontSize: '0.75rem' }}
                        >
                          <option value="">Skip</option>
                          {getSchema().fields.map((field: SchemaField) => (
                            <option key={field.key} value={field.key}>{field.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview Table */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#ccc', marginBottom: '0.75rem' }}>
                    Preview (first 5 rows):
                  </h4>
                  <div style={{ backgroundColor: '#111', borderRadius: '0.5rem', border: '1px solid #1a1a1a', overflow: 'auto', maxHeight: '300px' }}>
                    <table style={{ width: '100%', fontSize: '0.75rem' }}>
                      <thead style={{ backgroundColor: '#1a1a1a', position: 'sticky', top: 0 }}>
                        <tr>
                          {Object.keys(importPreview[0] ?? {}).map(col => (
                            <th key={col} style={{ padding: '0.75rem', textAlign: 'left', color: '#999', fontWeight: '600', textTransform: 'uppercase', borderBottom: '1px solid #333' }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid #1a1a1a' }}>
                            {Object.values(row).map((val: string, i) => (
                              <td key={i} style={{ padding: '0.75rem', color: '#fff' }}>{val}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportPreview([]);
                  setColumnMapping({});
                }}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: '#1a1a1a', color: '#999', border: '1px solid #333', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
              {importFile && (
                <button
                  onClick={handleImportConfirm}
                  style={{ flex: 1, padding: '0.75rem', backgroundColor: primaryColor, color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
                >
                  Import {importPreview.length} Records
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '2rem',
          right: '2rem',
          padding: '1rem 1.5rem',
          backgroundColor: toast.type === 'success' ? '#065f46' : '#7f1d1d',
          color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          zIndex: 100,
          fontWeight: '600',
          border: `1px solid ${toast.type === 'success' ? '#10b981' : '#dc2626'}`
        }}>
          {toast.message}
        </div>
      )}
      </div>
    </div>
  );
}

// Export with Suspense boundary as required by Next.js for useSearchParams
export default function CRMPage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading CRM...</div>}>
      <CRMContent />
    </Suspense>
  );
}

