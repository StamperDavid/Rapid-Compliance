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
import { useOrgTheme } from '@/hooks/useOrgTheme';
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
    if (!user) {return;}

    const loadConfig = async () => {
      try {
        const { DEFAULT_ORG_ID } = await import('@/lib/constants/platform');
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const configData = await FirestoreService.get(
          `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/crmConfig`,
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
  }, [user]);

  // Entity data (loaded from Firestore)
  const [leads, setLeads] = useState<Lead[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

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

  // Load entity records from Firestore
  useEffect(() => {
    if (!user) { return; }

    const setters: Record<ViewType, React.Dispatch<React.SetStateAction<CRMRecord[]>>> = {
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

    const loadRecords = async () => {
      try {
        setRecordsLoading(true);
        const { FirestoreService } = await import('@/lib/db/firestore-service');
        const { DEFAULT_ORG_ID } = await import('@/lib/constants/platform');
        const collectionPath = `organizations/${DEFAULT_ORG_ID}/workspaces/default/entities/${activeView}/records`;
        const records = await FirestoreService.getAll<CRMRecord>(collectionPath);
        const setter = setters[activeView];
        if (setter) {
          setter(records);
        }
      } catch (error: unknown) {
        logger.error('Failed to load CRM records:', error instanceof Error ? error : new Error(String(error)), { entity: activeView });
      } finally {
        setRecordsLoading(false);
      }
    };

    void loadRecords();
  }, [user, activeView]);

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
  const primaryColor = theme?.colors?.primary?.main || 'var(--color-primary)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: 'var(--color-bg-main)' }}>
      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? '260px' : '70px',
        backgroundColor: 'var(--color-bg-paper)',
        borderRight: '1px solid var(--color-border-main)',
        transition: 'width 0.3s',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative'
      }}>
        {/* Brand */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border-main)' }}>
          <Link href={user ? `/dashboard` : '/login'} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', cursor: 'pointer' }}>
            {logoUrl ? (
              <Image src={logoUrl} alt={brandName} width={sidebarOpen ? 150 : 32} height={sidebarOpen ? 40 : 32} style={{ maxHeight: sidebarOpen ? '40px' : '32px', maxWidth: sidebarOpen ? '150px' : '32px', objectFit: 'contain' }} />
            ) : (
              <>
                <div style={{ fontSize: '1.5rem' }}>🚀</div>
                {sidebarOpen && (
                  <div>
                    <h1 style={{ fontSize: '1.125rem', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>
                      {brandName}
                    </h1>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', margin: 0 }}>
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
            href={user ? `/dashboard` : '/login'}
            style={{
              width: '100%',
              padding: '0.875rem 1.25rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              backgroundColor: 'transparent',
              color: 'var(--color-text-secondary)',
              border: 'none',
              fontSize: '0.875rem',
              fontWeight: '400',
              borderLeft: '3px solid transparent',
              textAlign: 'left',
              transition: 'all 0.2s',
              textDecoration: 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-bg-main)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <span style={{ fontSize: '1.25rem' }}>📊</span>
            {sidebarOpen && <span>Dashboard</span>}
          </Link>

          {/* Divider */}
          <div style={{ height: '1px', backgroundColor: 'var(--color-bg-paper)', margin: '0.5rem 0' }}></div>

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
                  backgroundColor: activeView === key ? 'var(--color-bg-paper)' : 'transparent',
                  color: activeView === key ? primaryColor : 'var(--color-text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: activeView === key ? '600' : '400',
                  borderLeft: activeView === key ? `3px solid ${primaryColor}` : '3px solid transparent',
                  textAlign: 'left',
                  transition: 'all 0.2s'
                }}
              onMouseEnter={(e) => {
                if (activeView !== key) {e.currentTarget.style.backgroundColor = 'var(--color-bg-main)';}
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
        <div style={{ padding: '1rem', borderTop: '1px solid var(--color-border-light)' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={{
              width: '100%',
              padding: '0.5rem',
              backgroundColor: 'var(--color-bg-paper)',
              color: 'var(--color-text-secondary)',
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
          backgroundColor: 'var(--color-bg-main)',
          borderBottom: '1px solid var(--color-border-light)',
          padding: '1.25rem 2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ fontSize: '1.75rem', fontWeight: 'bold', color: 'var(--color-text-primary)', margin: 0 }}>
              {getSchema().pluralName}
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)', marginTop: '0.25rem' }}>
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
                backgroundColor: 'var(--color-bg-paper)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                minWidth: '200px'
              }}
            />
            <button
              onClick={() => setShowFilterBuilder(true)}
              style={{
                padding: '0.625rem 1rem',
                backgroundColor: activeFilter ? primaryColor : 'var(--color-bg-paper)',
                color: activeFilter ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                border: `1px solid ${activeFilter ? primaryColor : 'var(--color-border-strong)'}`,
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
                <span style={{ padding: '2px 6px', backgroundColor: theme?.colors?.primary?.dark || 'var(--color-primary-dark)', borderRadius: '9999px', fontSize: '0.7rem', fontWeight: '600' }}>
                  {activeFilter.groups.reduce((sum, g) => sum + g.conditions.length, 0)}
                </span>
              )}
            </button>
            {activeFilter && (
              <button
                onClick={() => setActiveFilter(null)}
                style={{
                  padding: '0.625rem',
                  backgroundColor: 'var(--color-bg-paper)',
                  color: 'var(--color-error)',
                  border: '1px solid var(--color-border-strong)',
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
                backgroundColor: 'var(--color-bg-paper)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-strong)',
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
                backgroundColor: 'var(--color-bg-paper)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border-strong)',
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
        <div style={{ flex: 1, padding: '2rem', overflow: 'auto', backgroundColor: 'var(--color-bg-main)' }}>
          <div style={{ backgroundColor: 'var(--color-bg-main)', borderRadius: '0.75rem', border: '1px solid var(--color-border-light)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead style={{ backgroundColor: 'var(--color-bg-main)' }}>
                <tr>
                  {getSchema().fields.slice(0, 6).map((field: SchemaField) => (
                    <th key={field.key} style={{
                      padding: '1rem 1.5rem',
                      textAlign: 'left',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      color: 'var(--color-text-secondary)',
                      textTransform: 'uppercase',
                      borderBottom: '2px solid var(--color-border-light)'
                    }}>
                      {field.label}
                    </th>
                  ))}
                  <th style={{
                    padding: '1rem 1.5rem',
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    fontWeight: '600',
                    color: 'var(--color-text-secondary)',
                    textTransform: 'uppercase',
                    borderBottom: '2px solid var(--color-border-light)'
                  }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {recordsLoading ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '4rem', textAlign: 'center' }}>
                      <div style={{ color: 'var(--color-text-disabled)' }}>Loading {getSchema().pluralName}...</div>
                    </td>
                  </tr>
                ) : getActiveData().length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '4rem', textAlign: 'center' }}>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{getSchema().icon}</div>
                      <div style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                        No {getSchema().pluralName.toLowerCase()} yet
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)', marginBottom: '1.5rem' }}>
                        Get started by adding your first {getSchema().singularName.toLowerCase()} or importing from CSV.
                      </div>
                      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
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
                          + Add {getSchema().singularName}
                        </button>
                        <button
                          onClick={() => setShowImportModal(true)}
                          style={{
                            padding: '0.625rem 1rem',
                            backgroundColor: 'var(--color-bg-paper)',
                            color: 'var(--color-text-secondary)',
                            border: '1px solid var(--color-border-strong)',
                            borderRadius: '0.5rem',
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            fontWeight: '500'
                          }}>
                          Import CSV
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  getActiveData().map((record: CRMRecord) => {
                    const recordData = record as unknown as Record<string, unknown>;
                    return (
                    <tr key={record.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      {getSchema().fields.slice(0, 6).map((field: SchemaField) => (
                        <td key={field.key} style={{ padding: '1rem 1.5rem', color: 'var(--color-text-primary)' }}>
                          {field.type === 'currency' ? (
                            <span style={{ fontWeight: '600' }}>${Number(recordData[field.key] ?? 0).toLocaleString()}</span>
                          ) : field.type === 'lookup' && field.key === 'company_id' ? (
                            <span style={{ color: primaryColor }}>{getCompanyName(String(recordData[field.key] ?? ''))}</span>
                          ) : field.type === 'checkbox' ? (
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              backgroundColor: recordData[field.key] ? 'var(--color-success-dark)' : 'var(--color-border-strong)',
                              color: recordData[field.key] ? 'var(--color-success-light)' : 'var(--color-text-secondary)',
                              borderRadius: '0.25rem',
                              fontSize: '0.75rem'
                            }}>
                              {recordData[field.key] ? 'Yes' : 'No'}
                            </span>
                          ) : field.key.includes('status') || field.key.includes('stage') ? (
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              backgroundColor: 'var(--color-bg-paper)',
                              color: recordData[field.key] === 'Active' || recordData[field.key] === 'Paid' ? theme?.colors?.success?.main || 'var(--color-success)' : primaryColor,
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              border: '1px solid var(--color-border-strong)'
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
                          style={{ color: theme?.colors?.error?.main || 'var(--color-error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem' }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ backgroundColor: 'var(--color-bg-main)', borderRadius: '1rem', border: '1px solid var(--color-border-strong)', padding: '2rem', minWidth: '500px', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
              Add New {getSchema().singularName}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {getSchema().fields.map((field: SchemaField) => {
                const formDataRecord = formData as Record<string, unknown>;
                return (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={String(formDataRecord[field.key] ?? '')}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
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
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
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
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    />
                  )}
                </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
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
          <div style={{ backgroundColor: 'var(--color-bg-main)', borderRadius: '1rem', border: '1px solid var(--color-border-strong)', padding: '2rem', minWidth: '500px', maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1.5rem' }}>
              Edit {getSchema().singularName}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {getSchema().fields.map((field: SchemaField) => {
                const formDataRecord = formData as Record<string, unknown>;
                return (
                <div key={field.key}>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-secondary)', marginBottom: '0.5rem' }}>
                    {field.label}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={String(formDataRecord[field.key] ?? '')}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
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
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
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
                      style={{ width: '100%', padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                    />
                  )}
                </div>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => setShowEditModal(false)}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
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
          <div style={{ backgroundColor: 'var(--color-bg-main)', borderRadius: '1rem', border: '1px solid var(--color-border-strong)', padding: '2rem', minWidth: '400px' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
              Confirm Delete
            </h3>
            <p style={{ color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
              Are you sure you want to delete this {getSchema().singularName}? This action cannot be undone.
            </p>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                style={{ flex: 1, padding: '0.75rem', backgroundColor: theme?.colors?.error?.main || 'var(--color-error)', color: 'white', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
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
          <div style={{ backgroundColor: 'var(--color-bg-main)', borderRadius: '1rem', border: '1px solid var(--color-border-strong)', padding: '2rem', minWidth: '700px', maxWidth: '900px', maxHeight: '80vh', overflowY: 'auto' }}>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
              Import {getSchema().pluralName}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
              Upload a CSV file. We&apos;ll automatically map columns to your {getSchema().singularName} schema.
            </p>

            {!importFile ? (
              // File Upload
              <div>
                <label 
                  htmlFor="import-file-upload"
                  style={{
                    display: 'block',
                    border: '2px dashed var(--color-border-strong)',
                    borderRadius: '0.75rem',
                    padding: '3rem',
                    textAlign: 'center',
                    cursor: 'pointer',
                    backgroundColor: 'var(--color-bg-main)',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = primaryColor;
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-paper)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--color-border-strong)';
                    e.currentTarget.style.backgroundColor = 'var(--color-bg-main)';
                  }}
                >
                  <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📄</div>
                  <p style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                    Click to upload or drag and drop
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--color-text-disabled)' }}>
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

                <div style={{ marginTop: '1.5rem', padding: '1rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.5rem', border: '1px solid var(--color-border-strong)' }}>
                  <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                    💡 Expected Columns for {getSchema().pluralName}:
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {getSchema().fields.slice(0, 8).map((field: SchemaField) => (
                      <span key={field.key} style={{ padding: '0.25rem 0.75rem', backgroundColor: 'var(--color-bg-elevated)', color: primaryColor, borderRadius: '9999px', fontSize: '0.75rem', border: '1px solid var(--color-border-strong)' }}>
                        {field.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              // Preview and Mapping
              <div>
                <div style={{ marginBottom: '1.5rem', padding: '1rem', backgroundColor: 'var(--color-bg-paper)', borderRadius: '0.5rem', border: '1px solid var(--color-border-strong)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)' }}>📄 {importFile.name}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--color-text-disabled)', marginTop: '0.25rem' }}>
                        {importPreview.length} records found (showing first 5)
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setImportFile(null);
                        setImportPreview([]);
                        setColumnMapping({});
                      }}
                      style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.75rem' }}
                    >
                      Change File
                    </button>
                  </div>
                </div>

                <div style={{ marginBottom: '1.5rem' }}>
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
                    Column Mapping (auto-detected):
                  </h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxHeight: '200px', overflowY: 'auto', padding: '0.5rem' }}>
                    {Object.keys(columnMapping).map((csvColumn) => (
                      <div key={csvColumn} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--color-text-secondary)', flex: 1 }}>{csvColumn}</span>
                        <span style={{ color: 'var(--color-text-disabled)' }}>→</span>
                        <select
                          value={columnMapping[csvColumn]}
                          onChange={(e) => setColumnMapping(prev => ({ ...prev, [csvColumn]: e.target.value }))}
                          style={{ flex: 1, padding: '0.375rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.375rem', fontSize: '0.75rem' }}
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
                  <h4 style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text-primary)', marginBottom: '0.75rem' }}>
                    Preview (first 5 rows):
                  </h4>
                  <div style={{ backgroundColor: 'var(--color-bg-main)', borderRadius: '0.5rem', border: '1px solid var(--color-border-light)', overflow: 'auto', maxHeight: '300px' }}>
                    <table style={{ width: '100%', fontSize: '0.75rem' }}>
                      <thead style={{ backgroundColor: 'var(--color-bg-paper)', position: 'sticky', top: 0 }}>
                        <tr>
                          {Object.keys(importPreview[0] ?? {}).map(col => (
                            <th key={col} style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: '600', textTransform: 'uppercase', borderBottom: '1px solid var(--color-border-strong)' }}>
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.map((row, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                            {Object.values(row).map((val: string, i) => (
                              <td key={i} style={{ padding: '0.75rem', color: 'var(--color-text-primary)' }}>{val}</td>
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
                style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--color-bg-paper)', color: 'var(--color-text-secondary)', border: '1px solid var(--color-border-strong)', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}
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
          backgroundColor: toast.type === 'success' ? 'var(--color-success-dark)' : 'var(--color-error-dark)',
          color: toast.type === 'success' ? 'var(--color-success-light)' : 'var(--color-error-light)',
          borderRadius: '0.5rem',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
          zIndex: 100,
          fontWeight: '600',
          border: `1px solid ${toast.type === 'success' ? 'var(--color-success)' : 'var(--color-error)'}`
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

