'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AdminBar from '@/components/AdminBar';
import { usePermission, useAuth } from '@/hooks/useAuth';
import { useOrgTheme } from '@/hooks/useOrgTheme';
import { STANDARD_SCHEMAS } from '@/lib/schema/standard-schemas';
import RevenueChart from '@/components/analytics/RevenueChart';
import PipelineChart from '@/components/analytics/PipelineChart';
import ForecastChart from '@/components/analytics/ForecastChart';
import WinLossChart from '@/components/analytics/WinLossChart';
import ReportBuilder from '@/components/analytics/ReportBuilder';
import { CustomReport } from '@/types/analytics';

type AnalyticsView = 'overview' | 'revenue' | 'pipeline' | 'forecasting' | 'win-loss' | 'reports';
type RevenueSubView = 'overview' | 'by-source' | 'by-product' | 'by-rep';

// Component that uses useSearchParams - wrapped in Suspense
function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { theme, loading: themeLoading } = useOrgTheme(); // Load organization-specific theme
  const [dateRange, setDateRange] = useState('30d');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [analyticsView, setAnalyticsView] = useState<AnalyticsView>('overview');
  const [revenueSubView, setRevenueSubView] = useState<RevenueSubView>('overview');
  const [forecastPeriod, setForecastPeriod] = useState<'month' | 'quarter' | 'year'>('quarter');
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [editingReport, setEditingReport] = useState<CustomReport | null>(null);
  const [reports, setReports] = useState<CustomReport[]>([]);
  const canViewReports = usePermission('canViewReports');
  const canCreateRecords = usePermission('canCreateRecords');

  // Check URL params
  useEffect(() => {

    // Check URL params for analytics view
    const viewParam = searchParams.get('view') as AnalyticsView | null;
    if (viewParam && ['overview', 'revenue', 'pipeline', 'forecasting', 'win-loss', 'reports'].includes(viewParam)) {
      setAnalyticsView(viewParam);
    }
  }, [searchParams]);

  // Load reports from Firestore
  useEffect(() => {
    if (!user?.organizationId) return;

    const loadReports = async () => {
      try {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        const reportsData = await FirestoreService.getAll(
          `${COLLECTIONS.ORGANIZATIONS}/${user.organizationId}/customReports`,
          []
        );

        if (reportsData && reportsData.length > 0) {
          // Convert Firestore timestamps to Date objects
          const reports = reportsData.map((r: any) => ({
            ...r,
            createdAt: r.createdAt ? new Date(r.createdAt) : new Date(),
            updatedAt: r.updatedAt ? new Date(r.updatedAt) : new Date(),
          }));
          setReports(reports);
        } else {
          // Initialize with mock reports if none exist
          const mockReports: CustomReport[] = [
            {
              id: '1',
              name: 'Monthly Sales Summary',
              description: 'Overview of monthly sales performance',
              organizationId: user.organizationId,
              createdBy: user.id,
              createdAt: new Date('2024-01-15'),
              updatedAt: new Date('2024-01-15'),
              dataSource: 'deals',
              filters: [{ field: 'status', operator: 'equals', value: 'closed' }],
              grouping: [],
              metrics: [
                { field: 'amount', aggregation: 'sum', label: 'Total Revenue' },
                { field: 'id', aggregation: 'count', label: 'Total Deals' },
              ],
              visualization: { type: 'bar' },
              sharedWith: [],
              isPublic: false,
            },
          ];
          setReports(mockReports);
          
          // Save initial report to Firestore
          if (mockReports[0]) {
            await FirestoreService.set(
              `${COLLECTIONS.ORGANIZATIONS}/${user.organizationId}/customReports`,
              mockReports[0].id,
              {
                ...mockReports[0],
                createdAt: mockReports[0].createdAt.toISOString(),
                updatedAt: mockReports[0].updatedAt.toISOString(),
              },
              false
            );
          }
        }
      } catch (error) {
        console.error('Failed to load reports:', error);
        // Fallback to empty array
        setReports([]);
      }
    };

    loadReports();
  }, [user]);

  const brandName = theme?.branding?.companyName || 'AI CRM';
  const logoUrl = theme?.branding?.logoUrl;
  const primaryColor = theme?.colors?.primary?.main || '#6366f1';
  const textColor = theme?.colors?.text?.primary || '#ffffff';
  const bgPaper = theme?.colors?.background?.paper || '#1a1a1a';
  const borderColor = theme?.colors?.border?.main || '#333333';

  // Dashboard Stats
  const stats = [
    { label: 'Total Revenue', value: '$284,500', change: '+12.5%', trend: 'up', icon: '💰', color: '#10b981' },
    { label: 'Active Deals', value: '47', change: '+8', trend: 'up', icon: '💼', color: '#6366f1' },
    { label: 'New Leads', value: '128', change: '+23%', trend: 'up', icon: '🎯', color: '#ec4899' },
    { label: 'Tasks Due', value: '12', change: '3 overdue', trend: 'down', icon: '✅', color: '#f59e0b' },
  ];

  // Sales Pipeline
  const pipeline = [
    { stage: 'Prospecting', count: 15, value: '$125K', color: '#94a3b8' },
    { stage: 'Qualification', count: 12, value: '$98K', color: '#6366f1' },
    { stage: 'Proposal', count: 8, value: '$156K', color: '#8b5cf6' },
    { stage: 'Negotiation', count: 5, value: '$285K', color: '#ec4899' },
    { stage: 'Closed Won', count: 7, value: '$342K', color: '#10b981' },
  ];

  // Recent Activity
  const recentActivity = [
    { type: 'deal', action: 'Deal closed', detail: 'Enterprise License - $125,000', time: '5 minutes ago', icon: '🎉', color: '#10b981' },
    { type: 'lead', action: 'New lead', detail: 'Sarah Williams from NewTech Inc', time: '23 minutes ago', icon: '🎯', color: '#6366f1' },
    { type: 'task', action: 'Task completed', detail: 'Follow up with Acme Corp', time: '1 hour ago', icon: '✅', color: '#8b5cf6' },
    { type: 'email', action: 'Email sent', detail: 'Quote sent to Global Industries', time: '2 hours ago', icon: '📧', color: '#f59e0b' },
    { type: 'meeting', action: 'Meeting scheduled', detail: 'Demo with Tech Solutions - Tomorrow 2PM', time: '3 hours ago', icon: '📅', color: '#ec4899' },
  ];

  // Todos
  const todos = [
    { id: 1, task: 'Follow up with Acme Corp', priority: 'High', dueDate: 'Today', completed: false },
    { id: 2, task: 'Send proposal to Global Industries', priority: 'Urgent', dueDate: 'Today', completed: false },
    { id: 3, task: 'Review contract with Tech Solutions', priority: 'High', dueDate: 'Tomorrow', completed: false },
    { id: 4, task: 'Prepare Q1 sales report', priority: 'Normal', dueDate: 'This week', completed: false },
  ];

  // AI Performance
  const aiMetrics = [
    { label: 'Lead Scoring Accuracy', value: '94%', change: '+3%', icon: '🎯' },
    { label: 'Response Time', value: '2.3s', change: '-0.4s', icon: '⚡' },
    { label: 'Recommendations', value: '156', change: '+12', icon: '🤖' },
    { label: 'Auto-Actions', value: '89', change: '+7', icon: '🔄' },
  ];

  // Top Performers
  const topPerformers = [
    { name: 'John Doe', deals: 12, revenue: '$342K', avatar: '👨' },
    { name: 'Jane Smith', deals: 10, revenue: '$298K', avatar: '👩' },
    { name: 'Bob Johnson', deals: 8, revenue: '$215K', avatar: '👨' },
  ];

  // Analytics Mock Data
  const mockRevenueData = [
    { date: 'Jan', revenue: 45000, deals: 12, averageDealSize: 3750 },
    { date: 'Feb', revenue: 52000, deals: 15, averageDealSize: 3467 },
    { date: 'Mar', revenue: 48000, deals: 14, averageDealSize: 3429 },
    { date: 'Apr', revenue: 61000, deals: 18, averageDealSize: 3389 },
    { date: 'May', revenue: 55000, deals: 16, averageDealSize: 3438 },
    { date: 'Jun', revenue: 67000, deals: 20, averageDealSize: 3350 },
  ];

  const mockPipelineData = [
    { stage: 'Qualified', value: 125000, deals: 25, averageDealSize: 5000 },
    { stage: 'Proposal', value: 85000, deals: 12, averageDealSize: 7083 },
    { stage: 'Negotiation', value: 45000, deals: 6, averageDealSize: 7500 },
    { stage: 'Closed Won', value: 180000, deals: 20, averageDealSize: 9000 },
  ];

  const mockForecastData = [
    { date: 'Jul', forecasted: 72000, bestCase: 85000, worstCase: 60000, actual: null },
    { date: 'Aug', forecasted: 68000, bestCase: 80000, worstCase: 55000, actual: null },
    { date: 'Sep', forecasted: 75000, bestCase: 90000, worstCase: 62000, actual: null },
    { date: 'Oct', forecasted: 71000, bestCase: 85000, worstCase: 58000, actual: null },
  ];

  const winLossData = { won: 68, lost: 32 };
  const lossReasons = [
    { reason: 'Price too high', count: 12, value: 145000 },
    { reason: 'Chose competitor', count: 8, value: 98000 },
    { reason: 'Budget constraints', count: 6, value: 75000 },
    { reason: 'Timing not right', count: 4, value: 52000 },
    { reason: 'Feature gaps', count: 2, value: 28000 },
  ];

  // Enhanced Revenue Data
  const totalRevenue = mockRevenueData.reduce((sum, d) => sum + d.revenue, 0);
  const totalDeals = mockRevenueData.reduce((sum, d) => sum + (d.deals || 0), 0);
  const averageDealSize = totalRevenue / totalDeals;
  const revenueBySource = [
    { source: 'Website', revenue: 125000, deals: 35, percentage: 38 },
    { source: 'Referral', revenue: 98000, deals: 28, percentage: 30 },
    { source: 'Cold Outreach', revenue: 75000, deals: 22, percentage: 23 },
    { source: 'Partner', revenue: 30000, deals: 8, percentage: 9 },
  ];
  const revenueByProduct = [
    { productName: 'Product A', revenue: 150000, units: 45, averagePrice: 3333 },
    { productName: 'Product B', revenue: 98000, units: 32, averagePrice: 3063 },
    { productName: 'Product C', revenue: 50000, units: 18, averagePrice: 2778 },
    { productName: 'Product D', revenue: 30000, units: 12, averagePrice: 2500 },
  ];
  const revenueByRep = [
    { repName: 'John Smith', revenue: 125000, deals: 35, averageDealSize: 3571 },
    { repName: 'Sarah Johnson', revenue: 98000, deals: 28, averageDealSize: 3500 },
    { repName: 'Mike Davis', revenue: 75000, deals: 22, averageDealSize: 3409 },
    { repName: 'Emily Brown', revenue: 30000, deals: 8, averageDealSize: 3750 },
  ];

  // Enhanced Pipeline Data
  const totalValue = mockPipelineData.reduce((sum, d) => sum + d.value, 0);
  const totalPipelineDeals = mockPipelineData.reduce((sum, d) => sum + d.deals, 0);
  const conversionRates = [
    { fromStage: 'Qualified', toStage: 'Proposal', rate: 48, deals: 12 },
    { fromStage: 'Proposal', toStage: 'Negotiation', rate: 50, deals: 6 },
    { fromStage: 'Negotiation', toStage: 'Closed Won', rate: 100, deals: 6 },
  ];
  const velocity = {
    averageSalesCycle: 45,
    averageTimeToClose: 38,
    averageTimePerStage: {
      'Qualified': 12,
      'Proposal': 15,
      'Negotiation': 11,
    }
  };

  // Enhanced Forecasting Data
  const totalForecasted = mockForecastData.reduce((sum, d) => sum + d.forecasted, 0);
  const confidence = 72;
  const scenarios = [
    { name: 'Best Case', revenue: 340000, probability: 25, description: 'All deals close, new opportunities emerge' },
    { name: 'Likely', revenue: 286000, probability: 50, description: 'Normal conversion rates, steady pipeline' },
    { name: 'Worst Case', revenue: 235000, probability: 25, description: 'Some deals delayed, lower conversion' },
  ];
  const forecastByRep = [
    { repName: 'John Smith', forecastedRevenue: 125000, openDeals: 12, weightedValue: 98000 },
    { repName: 'Sarah Johnson', forecastedRevenue: 98000, openDeals: 9, weightedValue: 75000 },
    { repName: 'Mike Davis', forecastedRevenue: 85000, openDeals: 8, weightedValue: 68000 },
    { repName: 'Emily Brown', forecastedRevenue: 45000, openDeals: 4, weightedValue: 36000 },
  ];
  const factors = [
    { factor: 'Q4 Seasonality', impact: 'positive' as const, description: 'Historical increase in Q4 sales', weight: 0.8 },
    { factor: 'New Product Launch', impact: 'positive' as const, description: 'Expected boost from new product', weight: 0.6 },
    { factor: 'Economic Uncertainty', impact: 'negative' as const, description: 'Potential delays in enterprise deals', weight: 0.4 },
  ];

  // Enhanced Win/Loss Data
  const totalWinLossDeals = winLossData.won + winLossData.lost;
  const winRate = ((winLossData.won / totalWinLossDeals) * 100).toFixed(1);
  const winFactors = [
    { factor: 'Strong relationship', frequency: 45, percentage: 66, averageDealSize: 7200 },
    { factor: 'Competitive pricing', frequency: 38, percentage: 56, averageDealSize: 6800 },
    { factor: 'Product fit', frequency: 32, percentage: 47, averageDealSize: 7500 },
    { factor: 'Quick response time', frequency: 28, percentage: 41, averageDealSize: 6900 },
  ];
  const competitorAnalysis = [
    { competitor: 'Competitor A', wins: 8, losses: 12, winRate: 40, averageDealSize: 6500, commonReasons: ['Price', 'Features'] },
    { competitor: 'Competitor B', wins: 5, losses: 8, winRate: 38, averageDealSize: 7200, commonReasons: ['Brand', 'Support'] },
    { competitor: 'Competitor C', wins: 3, losses: 6, winRate: 33, averageDealSize: 5800, commonReasons: ['Price'] },
  ];
  const winLossByRep = [
    { repName: 'John Smith', won: 25, lost: 8, winRate: 76, averageDealSize: 7200 },
    { repName: 'Sarah Johnson', won: 18, lost: 10, winRate: 64, averageDealSize: 6800 },
    { repName: 'Mike Davis', won: 15, lost: 9, winRate: 63, averageDealSize: 6500 },
    { repName: 'Emily Brown', won: 10, lost: 5, winRate: 67, averageDealSize: 7100 },
  ];

  // Report Builder Handlers
  const handleSaveReport = async (reportData: Partial<CustomReport>) => {
    if (!user?.organizationId) return;

    try {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      const orgId = user.organizationId;

      if (editingReport) {
        const updated = reports.map(r => 
          r.id === editingReport.id 
            ? { ...r, ...reportData, updatedAt: new Date() }
            : r
        );
        setReports(updated);
        
        // Save to Firestore
        const reportToSave = updated.find(r => r.id === editingReport.id);
        if (reportToSave) {
          await FirestoreService.set(
            `${COLLECTIONS.ORGANIZATIONS}/${orgId}/customReports`,
            reportToSave.id,
            {
              ...reportToSave,
              createdAt: reportToSave.createdAt.toISOString(),
              updatedAt: reportToSave.updatedAt.toISOString(),
            },
            false
          );
        }
        setEditingReport(null);
      } else {
        const newReport: CustomReport = {
          id: Date.now().toString(),
          name: reportData.name || 'Untitled Report',
          description: reportData.description,
          organizationId: orgId,
          createdBy: user.id,
          createdAt: new Date(),
          updatedAt: new Date(),
          dataSource: reportData.dataSource || '',
          filters: reportData.filters || [],
          grouping: reportData.grouping || [],
          metrics: reportData.metrics || [],
          visualization: reportData.visualization || { type: 'table' },
          sharedWith: [],
          isPublic: false,
        };
        const updated = [...reports, newReport];
        setReports(updated);
        
        // Save to Firestore
        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${orgId}/customReports`,
          newReport.id,
          {
            ...newReport,
            createdAt: newReport.createdAt.toISOString(),
            updatedAt: newReport.updatedAt.toISOString(),
          },
          false
        );
      }
      setShowReportBuilder(false);
    } catch (error) {
      console.error('Failed to save report:', error);
      // Still update UI even if Firestore save fails
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!user?.organizationId) return;
    
    if (confirm('Are you sure you want to delete this report?')) {
      try {
        const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
        
        // Delete from Firestore
        await FirestoreService.delete(
          `${COLLECTIONS.ORGANIZATIONS}/${user.organizationId}/customReports`,
          reportId
        );
        
        // Update UI
        const updated = reports.filter(r => r.id !== reportId);
        setReports(updated);
      } catch (error) {
        console.error('Failed to delete report:', error);
        // Still update UI even if Firestore delete fails
        const updated = reports.filter(r => r.id !== reportId);
        setReports(updated);
      }
    }
  };

  const handleEditReport = (report: CustomReport) => {
    setEditingReport(report);
    setShowReportBuilder(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: '#000000' }}>
      <AdminBar />

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left Sidebar */}
        <div style={{ 
          width: sidebarOpen ? '260px' : '70px',
          backgroundColor: '#0a0a0a',
          borderRight: '1px solid #1a1a1a',
          transition: 'width 0.3s',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <nav style={{ flex: 1, padding: '1rem 0', overflowY: 'auto' }}>
            <Link
              href="/dashboard"
              style={{
                width: '100%',
                padding: '0.875rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                backgroundColor: analyticsView === 'overview' ? '#1a1a1a' : 'transparent',
                color: analyticsView === 'overview' ? primaryColor : '#999',
                borderLeft: analyticsView === 'overview' ? `3px solid ${primaryColor}` : '3px solid transparent',
                fontSize: '0.875rem',
                fontWeight: analyticsView === 'overview' ? '600' : '400',
                textDecoration: 'none'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>📊</span>
              {sidebarOpen && <span>Dashboard</span>}
            </Link>

            {/* Analytics Link - Show when viewing analytics */}
            {analyticsView !== 'overview' && (
              <Link
                href="/dashboard?view=overview"
                onClick={(e) => {
                  e.preventDefault();
                  setAnalyticsView('overview');
                  router.push('/dashboard?view=overview');
                }}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: '#1a1a1a',
                  color: primaryColor,
                  borderLeft: `3px solid ${primaryColor}`,
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>📈</span>
                {sidebarOpen && <span>Analytics</span>}
              </Link>
            )}

            {Object.entries(STANDARD_SCHEMAS).map(([key, schema]) => (
              <Link
                key={key}
                href={`/crm?view=${key}`}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.25rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  backgroundColor: 'transparent',
                  color: '#999',
                  borderLeft: '3px solid transparent',
                  fontSize: '0.875rem',
                  fontWeight: '400',
                  textDecoration: 'none'
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{schema.icon}</span>
                {sidebarOpen && <span>{schema.pluralName}</span>}
              </Link>
            ))}
          </nav>

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
        <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h1 style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>Dashboard</h1>
                  <p style={{ color: '#666', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                    {analyticsView === 'overview' 
                      ? "Welcome back! Here's what's happening today."
                      : analyticsView === 'revenue' 
                      ? "Track revenue performance and trends"
                      : analyticsView === 'pipeline'
                      ? "Track pipeline value, velocity, and conversion rates"
                      : analyticsView === 'forecasting'
                      ? "Predict future revenue based on pipeline and historical data"
                      : analyticsView === 'win-loss'
                      ? "Understand why deals are won or lost"
                      : "Create and manage custom analytics reports"
                    }
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <select
                    value={analyticsView}
                    onChange={(e) => {
                      const view = e.target.value as AnalyticsView;
                      setAnalyticsView(view);
                      router.push(`/dashboard?view=${view}`);
                    }}
                    style={{ 
                      padding: '0.625rem 1rem', 
                      backgroundColor: '#1a1a1a', 
                      color: '#fff', 
                      border: '1px solid #333', 
                      borderRadius: '0.5rem', 
                      fontSize: '0.875rem',
                      minWidth: '200px',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="overview">📊 Overview</option>
                    <option value="revenue">💰 Revenue Reports</option>
                    <option value="pipeline">📈 Pipeline Reports</option>
                    <option value="forecasting">🔮 Sales Forecasting</option>
                    <option value="win-loss">📉 Win/Loss Analysis</option>
                    <option value="reports">📋 Custom Reports</option>
                  </select>
                  <select
                    value={dateRange}
                    onChange={(e) => setDateRange(e.target.value)}
                    style={{ padding: '0.625rem 1rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                    <option value="1y">Last year</option>
                  </select>
                  {canCreateRecords && (
                    <Link href="/crm?action=new" style={{ padding: '0.625rem 1.5rem', backgroundColor: primaryColor, color: '#fff', borderRadius: '0.5rem', textDecoration: 'none', fontSize: '0.875rem', fontWeight: '600' }}>
                      + Quick Add
                    </Link>
                  )}
                </div>
              </div>
            </div>

            {/* Analytics Content - Show based on selected view */}
            {analyticsView === 'overview' && (
              <>
                {/* Stats Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                  {stats.map((stat, idx) => (
                <div key={idx} style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '1rem' }}>
                    <div>
                      <p style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>{stat.label}</p>
                      <p style={{ fontSize: '2rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>{stat.value}</p>
                    </div>
                    <div style={{ fontSize: '2.5rem', opacity: 0.3 }}>{stat.icon}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.875rem', color: stat.trend === 'up' ? '#10b981' : '#ef4444', fontWeight: '600' }}>
                      {stat.trend === 'up' ? '↑' : '↓'} {stat.change}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#666' }}>vs last period</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
              {/* Sales Pipeline */}
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Sales Pipeline</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {pipeline.map((stage, idx) => (
                    <div key={idx}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: '#fff', fontWeight: '500' }}>{stage.stage}</span>
                        <span style={{ fontSize: '0.875rem', color: '#666' }}>{stage.count} deals • {stage.value}</span>
                      </div>
                      <div style={{ height: '8px', backgroundColor: '#0a0a0a', borderRadius: '9999px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${(stage.count / 20) * 100}%`, backgroundColor: stage.color, transition: 'width 0.3s' }}></div>
                      </div>
                    </div>
                  ))}
                </div>
                <Link href="/crm?view=deals" style={{ display: 'block', marginTop: '1.5rem', textAlign: 'center', color: primaryColor, fontSize: '0.875rem', fontWeight: '600', textDecoration: 'none' }}>
                  View All Deals →
                </Link>
              </div>

              {/* AI Performance */}
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
                  <span style={{ fontSize: '1.5rem' }}>🤖</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', margin: 0 }}>AI Performance</h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {aiMetrics.map((metric, idx) => (
                    <div key={idx} style={{ backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '0.75rem', padding: '1rem' }}>
                      <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{metric.icon}</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '0.25rem' }}>{metric.value}</div>
                      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem' }}>{metric.label}</div>
                      <div style={{ fontSize: '0.75rem', color: '#10b981' }}>{metric.change}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
              {/* Recent Activity */}
              <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Recent Activity</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {recentActivity.map((activity, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '1rem', padding: '1rem', backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '0.75rem' }}>
                      <div style={{ fontSize: '1.5rem' }}>{activity.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff', marginBottom: '0.25rem' }}>{activity.action}</div>
                        <div style={{ fontSize: '0.875rem', color: '#999', marginBottom: '0.5rem' }}>{activity.detail}</div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>{activity.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Todos & Top Performers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {/* Todos */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Today&apos;s Tasks</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {todos.map((todo) => (
                      <div key={todo.id} style={{ display: 'flex', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#0a0a0a', border: '1px solid #222', borderRadius: '0.5rem' }}>
                        <input type="checkbox" checked={todo.completed} style={{ width: '18px', height: '18px', marginTop: '2px' }} readOnly />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.875rem', color: '#fff', marginBottom: '0.25rem' }}>{todo.task}</div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>
                            <span style={{ 
                              padding: '2px 6px', 
                              backgroundColor: todo.priority === 'Urgent' ? '#7f1d1d' : todo.priority === 'High' ? '#7c2d12' : '#374151',
                              color: todo.priority === 'Urgent' ? '#fca5a5' : todo.priority === 'High' ? '#fdba74' : '#9ca3af',
                              borderRadius: '4px',
                              fontSize: '0.7rem',
                              marginRight: '0.5rem'
                            }}>
                              {todo.priority}
                            </span>
                            {todo.dueDate}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Link href="/crm?view=tasks" style={{ display: 'block', marginTop: '1rem', textAlign: 'center', color: primaryColor, fontSize: '0.875rem', fontWeight: '600', textDecoration: 'none' }}>
                    View All Tasks →
                  </Link>
                </div>

                {/* Top Performers */}
                <div style={{ backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '1rem', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 'bold', color: '#fff', marginBottom: '1.5rem' }}>Top Performers</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {topPerformers.map((performer, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: primaryColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>
                      {performer.avatar}
                    </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>{performer.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>{performer.deals} deals • {performer.revenue}</div>
                        </div>
                        <div style={{ fontSize: '1.5rem', color: idx === 0 ? '#fbbf24' : idx === 1 ? '#c0c0c0' : '#cd7f32' }}>
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div style={{ marginTop: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <Link href="/crm?view=leads" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', textDecoration: 'none', transition: 'all 0.2s' }}>
                <span style={{ fontSize: '2rem' }}>🎯</span>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Leads</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>128 active</div>
                </div>
              </Link>
              <Link href="/crm?view=companies" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', textDecoration: 'none', transition: 'all 0.2s' }}>
                <span style={{ fontSize: '2rem' }}>🏢</span>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Companies</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>89 total</div>
                </div>
              </Link>
              <Link href="/crm?view=contacts" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', textDecoration: 'none', transition: 'all 0.2s' }}>
                <span style={{ fontSize: '2rem' }}>👤</span>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Contacts</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>342 total</div>
                </div>
              </Link>
              <Link href="/crm?view=deals" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.75rem', textDecoration: 'none', transition: 'all 0.2s' }}>
                <span style={{ fontSize: '2rem' }}>💼</span>
                <div>
                  <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#fff' }}>Deals</div>
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>47 active</div>
                </div>
              </Link>
            </div>
              </>
            )}

            {/* Revenue Reports View */}
            {analyticsView === 'revenue' && (
              <div>
                {/* Summary Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Total Revenue</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>${totalRevenue.toLocaleString()}</div>
                  </div>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Total Deals</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>{totalDeals}</div>
                  </div>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Average Deal Size</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>${Math.round(averageDealSize).toLocaleString()}</div>
                  </div>
                </div>

                {/* View Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: `1px solid ${borderColor}` }}>
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'by-source', label: 'By Source' },
                    { id: 'by-product', label: 'By Product' },
                    { id: 'by-rep', label: 'By Sales Rep' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setRevenueSubView(tab.id as RevenueSubView)}
                      style={{
                        padding: '0.75rem 1.5rem',
                        borderBottom: `2px solid ${revenueSubView === tab.id ? primaryColor : 'transparent'}`,
                        color: revenueSubView === tab.id ? primaryColor : '#666',
                        fontSize: '0.875rem',
                        fontWeight: revenueSubView === tab.id ? '600' : '400',
                        backgroundColor: 'transparent',
                        border: 'none',
                        borderTop: 'none',
                        borderLeft: 'none',
                        borderRight: 'none',
                        cursor: 'pointer',
                        marginBottom: '-1px'
                      }}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Revenue Chart */}
                <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                    Revenue Trend
                  </h3>
                  <RevenueChart data={mockRevenueData} type="line" showDeals={true} showAverage={true} />
                </div>

                {/* Data Tables */}
                {revenueSubView === 'by-source' && (
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                      Revenue by Source
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                          <th style={{ textAlign: 'left', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Source</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Revenue</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Deals</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Percentage</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueBySource.map((item, index) => (
                          <tr key={index} style={{ borderBottom: `1px solid ${borderColor}` }}>
                            <td style={{ padding: '0.75rem', color: textColor }}>{item.source}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${item.revenue.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{item.deals}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{item.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {revenueSubView === 'by-product' && (
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                      Revenue by Product
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                          <th style={{ textAlign: 'left', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Product</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Revenue</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Units</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Avg Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueByProduct.map((item, index) => (
                          <tr key={index} style={{ borderBottom: `1px solid ${borderColor}` }}>
                            <td style={{ padding: '0.75rem', color: textColor }}>{item.productName}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${item.revenue.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{item.units}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${item.averagePrice.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {revenueSubView === 'by-rep' && (
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                      Revenue by Sales Rep
                    </h3>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                          <th style={{ textAlign: 'left', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Sales Rep</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Revenue</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Deals</th>
                          <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Avg Deal Size</th>
                        </tr>
                      </thead>
                      <tbody>
                        {revenueByRep.map((item, index) => (
                          <tr key={index} style={{ borderBottom: `1px solid ${borderColor}` }}>
                            <td style={{ padding: '0.75rem', color: textColor }}>{item.repName}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${item.revenue.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{item.deals}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${item.averageDealSize.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Pipeline Reports View */}
            {analyticsView === 'pipeline' && (
              <div>
                {/* Summary Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Total Pipeline Value</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>${totalValue.toLocaleString()}</div>
                  </div>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Total Deals</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>{totalPipelineDeals}</div>
                  </div>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Avg Sales Cycle</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>{velocity.averageSalesCycle} days</div>
                  </div>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Avg Time to Close</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>{velocity.averageTimeToClose} days</div>
                  </div>
                </div>

                {/* Pipeline Chart */}
                <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                    Pipeline by Stage
                  </h3>
                  <PipelineChart data={mockPipelineData} showDeals={true} />
                </div>

                {/* Conversion Rates */}
                <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                    Conversion Rates
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>From Stage</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>To Stage</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Conversion Rate</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Deals</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversionRates.map((rate, index) => (
                        <tr key={index} style={{ borderBottom: `1px solid ${borderColor}` }}>
                          <td style={{ padding: '0.75rem', color: textColor }}>{rate.fromStage}</td>
                          <td style={{ padding: '0.75rem', color: textColor }}>{rate.toStage}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{rate.rate}%</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{rate.deals}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Stage Details */}
                <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                    Stage Details
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Stage</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Value</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Deals</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Avg Deal Size</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Avg Days</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockPipelineData.map((stage, index) => (
                        <tr key={index} style={{ borderBottom: `1px solid ${borderColor}` }}>
                          <td style={{ padding: '0.75rem', color: textColor }}>{stage.stage}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${stage.value.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{stage.deals}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${stage.averageDealSize.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>
                            {(velocity.averageTimePerStage as any)[stage.stage] || 'N/A'} days
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Forecasting View */}
            {analyticsView === 'forecasting' && (
              <div>
                {/* Period Selector */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', justifyContent: 'flex-end' }}>
                  {(['month', 'quarter', 'year'] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setForecastPeriod(period)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: forecastPeriod === period ? primaryColor : 'transparent',
                        border: `1px solid ${forecastPeriod === period ? primaryColor : borderColor}`,
                        borderRadius: '0.375rem',
                        color: forecastPeriod === period ? '#fff' : textColor,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        textTransform: 'capitalize'
                      }}
                    >
                      {period}
                    </button>
                  ))}
                </div>

                {/* Summary Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Forecasted Revenue</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>${totalForecasted.toLocaleString()}</div>
                  </div>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Confidence Score</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>{confidence}%</div>
                  </div>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Open Deals</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>
                      {forecastByRep.reduce((sum, r) => sum + r.openDeals, 0)}
                    </div>
                  </div>
                </div>

                {/* Forecast Chart */}
                <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                    Revenue Forecast with Confidence Bands
                  </h3>
                  <ForecastChart data={mockForecastData} showConfidence={true} />
                </div>

                {/* Scenarios */}
                <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                    Forecast Scenarios
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                    {scenarios.map((scenario, index) => (
                      <div
                        key={index}
                        style={{
                          padding: '1rem',
                          backgroundColor: '#0a0a0a',
                          border: `1px solid ${borderColor}`,
                          borderRadius: '0.5rem'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <div style={{ fontSize: '0.875rem', fontWeight: '600', color: textColor }}>{scenario.name}</div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>{scenario.probability}% probability</div>
                        </div>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: textColor, marginBottom: '0.5rem' }}>
                          ${scenario.revenue.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#666' }}>{scenario.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Forecast by Rep */}
                <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                    Forecast by Sales Rep
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Sales Rep</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Forecasted Revenue</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Open Deals</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Weighted Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecastByRep.map((rep, index) => (
                        <tr key={index} style={{ borderBottom: `1px solid ${borderColor}` }}>
                          <td style={{ padding: '0.75rem', color: textColor }}>{rep.repName}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${rep.forecastedRevenue.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{rep.openDeals}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${rep.weightedValue.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Factors */}
                <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                    Forecast Factors
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {factors.map((factor, index) => (
                      <div
                        key={index}
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
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: textColor }}>{factor.factor}</span>
                            <span style={{
                              fontSize: '0.75rem',
                              padding: '0.125rem 0.5rem',
                              borderRadius: '0.25rem',
                              backgroundColor: factor.impact === 'positive' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: factor.impact === 'positive' ? '#10b981' : '#ef4444'
                            }}>
                              {factor.impact}
                            </span>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#666' }}>{factor.description}</div>
                        </div>
                        <div style={{ fontSize: '0.875rem', color: '#666' }}>
                          Weight: {(factor.weight * 100).toFixed(0)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Win/Loss View */}
            {analyticsView === 'win-loss' && (
              <div>
                {/* Summary Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Total Deals</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>{totalWinLossDeals}</div>
                  </div>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Won</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#10b981' }}>{winLossData.won}</div>
                  </div>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Lost</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: '#ef4444' }}>{winLossData.lost}</div>
                  </div>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.5rem' }}>Win Rate</div>
                    <div style={{ fontSize: '1.75rem', fontWeight: 'bold', color: textColor }}>{winRate}%</div>
                  </div>
                </div>

                {/* Win/Loss Charts */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', marginBottom: '2rem' }}>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>Win/Loss Overview</h3>
                    <WinLossChart winLossData={winLossData} type="pie" />
                  </div>
                  <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>Loss Reasons</h3>
                    <WinLossChart winLossData={winLossData} lossReasons={lossReasons} type="bar" />
                  </div>
                </div>

                {/* Loss Reasons Table */}
                <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                    Top Loss Reasons
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Reason</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Count</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Value Lost</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lossReasons.map((reason, index) => {
                        const percentage = ((reason.count / winLossData.lost) * 100).toFixed(1);
                        return (
                          <tr key={index} style={{ borderBottom: `1px solid ${borderColor}` }}>
                            <td style={{ padding: '0.75rem', color: textColor }}>{reason.reason}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{reason.count}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${reason.value.toLocaleString()}</td>
                            <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{percentage}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Win Factors */}
                <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                    Key Win Factors
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Factor</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Frequency</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Percentage</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Avg Deal Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {winFactors.map((factor, index) => (
                        <tr key={index} style={{ borderBottom: `1px solid ${borderColor}` }}>
                          <td style={{ padding: '0.75rem', color: textColor }}>{factor.factor}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{factor.frequency}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{factor.percentage}%</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${factor.averageDealSize.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Competitor Analysis */}
                <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem', marginBottom: '2rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                    Competitor Analysis
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Competitor</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Wins</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Losses</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Win Rate</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Avg Deal Size</th>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Common Reasons</th>
                      </tr>
                    </thead>
                    <tbody>
                      {competitorAnalysis.map((comp, index) => (
                        <tr key={index} style={{ borderBottom: `1px solid ${borderColor}` }}>
                          <td style={{ padding: '0.75rem', color: textColor }}>{comp.competitor}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{comp.wins}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{comp.losses}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{comp.winRate}%</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${comp.averageDealSize.toLocaleString()}</td>
                          <td style={{ padding: '0.75rem', color: textColor }}>{comp.commonReasons.join(', ')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Win/Loss by Rep */}
                <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor, marginBottom: '1rem' }}>
                    Win/Loss by Sales Rep
                  </h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <th style={{ textAlign: 'left', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Sales Rep</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Won</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Lost</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Win Rate</th>
                        <th style={{ textAlign: 'right', padding: '0.75rem', color: '#666', fontSize: '0.875rem', fontWeight: '600' }}>Avg Deal Size</th>
                      </tr>
                    </thead>
                    <tbody>
                      {winLossByRep.map((rep, index) => (
                        <tr key={index} style={{ borderBottom: `1px solid ${borderColor}` }}>
                          <td style={{ padding: '0.75rem', color: textColor }}>{rep.repName}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: '#10b981' }}>{rep.won}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: '#ef4444' }}>{rep.lost}</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>{rep.winRate}%</td>
                          <td style={{ textAlign: 'right', padding: '0.75rem', color: textColor }}>${rep.averageDealSize.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Reports View - Full ReportBuilder Integration */}
            {analyticsView === 'reports' && (
              <div>
                {showReportBuilder ? (
                  <ReportBuilder
                    report={editingReport || undefined}
                    onSave={handleSaveReport}
                    onCancel={() => {
                      setShowReportBuilder(false);
                      setEditingReport(null);
                    }}
                  />
                ) : (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                      <div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', color: textColor, marginBottom: '0.5rem' }}>
                          Custom Reports
                        </h2>
                        <p style={{ color: '#666', fontSize: '0.875rem' }}>
                          Create and manage custom analytics reports
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setEditingReport(null);
                          setShowReportBuilder(true);
                        }}
                        style={{
                          padding: '0.625rem 1.25rem',
                          backgroundColor: primaryColor,
                          color: '#fff',
                          border: 'none',
                          borderRadius: '0.5rem',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          cursor: 'pointer'
                        }}
                      >
                        + Create Report
                      </button>
                    </div>

                    {/* Reports Grid */}
                    {reports.length === 0 ? (
                      <div style={{
                        backgroundColor: bgPaper,
                        border: `1px solid ${borderColor}`,
                        borderRadius: '0.75rem',
                        padding: '3rem',
                        textAlign: 'center'
                      }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '600', color: textColor, marginBottom: '0.5rem' }}>
                          No Reports Yet
                        </h3>
                        <p style={{ color: '#666', marginBottom: '1.5rem' }}>
                          Create your first custom report to get started
                        </p>
                        <button
                          onClick={() => setShowReportBuilder(true)}
                          style={{
                            padding: '0.625rem 1.25rem',
                            backgroundColor: primaryColor,
                            color: '#fff',
                            border: 'none',
                            borderRadius: '0.5rem',
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            cursor: 'pointer'
                          }}
                        >
                          Create Your First Report
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
                        {reports.map((report) => (
                          <div
                            key={report.id}
                            style={{
                              backgroundColor: bgPaper,
                              border: `1px solid ${borderColor}`,
                              borderRadius: '0.75rem',
                              padding: '1.5rem',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '1rem'
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: textColor }}>
                                  {report.name}
                                </h3>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                  <button
                                    onClick={() => handleEditReport(report)}
                                    style={{
                                      padding: '0.375rem 0.75rem',
                                      backgroundColor: 'transparent',
                                      border: `1px solid ${borderColor}`,
                                      borderRadius: '0.375rem',
                                      color: textColor,
                                      fontSize: '0.75rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => handleDeleteReport(report.id)}
                                    style={{
                                      padding: '0.375rem 0.75rem',
                                      backgroundColor: 'transparent',
                                      border: `1px solid ${borderColor}`,
                                      borderRadius: '0.375rem',
                                      color: '#ef4444',
                                      fontSize: '0.75rem',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              {report.description && (
                                <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '0.75rem' }}>
                                  {report.description}
                                </p>
                              )}
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <span style={{
                                  fontSize: '0.75rem',
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: '#0a0a0a',
                                  borderRadius: '0.25rem',
                                  color: textColor
                                }}>
                                  {report.dataSource}
                                </span>
                                <span style={{
                                  fontSize: '0.75rem',
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: '#0a0a0a',
                                  borderRadius: '0.25rem',
                                  color: textColor
                                }}>
                                  {report.visualization.type}
                                </span>
                                <span style={{
                                  fontSize: '0.75rem',
                                  padding: '0.25rem 0.5rem',
                                  backgroundColor: '#0a0a0a',
                                  borderRadius: '0.25rem',
                                  color: textColor
                                }}>
                                  {report.metrics.length} metrics
                                </span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#666' }}>
                                Updated {new Date(report.updatedAt).toLocaleDateString()}
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                // TODO: Run report and show results (will be implemented with backend)
                                alert('Report execution will be implemented with backend integration');
                              }}
                              style={{
                                width: '100%',
                                padding: '0.625rem',
                                backgroundColor: primaryColor,
                                color: '#fff',
                                border: 'none',
                                borderRadius: '0.5rem',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                cursor: 'pointer'
                              }}
                            >
                              Run Report
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Export with Suspense boundary as required by Next.js for useSearchParams
export default function DashboardPage() {
  return (
    <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center' }}>Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
