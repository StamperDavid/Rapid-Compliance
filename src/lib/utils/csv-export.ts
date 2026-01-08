/**
 * CSV Export Utilities
 * 
 * Provides utilities for exporting analytics data to CSV format.
 * Hunter-Closer compliant - native implementation, no third-party libraries.
 */

export interface SequencePerformanceData {
  sequenceId: string;
  sequenceName: string;
  isActive: boolean;
  channel: string;
  totalEnrolled: number;
  activeEnrollments: number;
  completedEnrollments: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  replyRate: number;
  createdAt: Date;
  lastExecutedAt?: Date;
}

export interface AnalyticsSummaryData {
  totalSequences: number;
  activeSequences: number;
  totalEnrollments: number;
  activeEnrollments: number;
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  totalReplied: number;
  avgDeliveryRate: number;
  avgOpenRate: number;
  avgClickRate: number;
  avgReplyRate: number;
}

/**
 * Export sequence performance data to CSV
 */
export function exportSequencePerformanceToCSV(
  sequences: SequencePerformanceData[],
  filename?: string
): void {
  const headers = [
    'Sequence ID',
    'Sequence Name',
    'Status',
    'Channel',
    'Total Enrolled',
    'Active Enrollments',
    'Completed Enrollments',
    'Total Sent',
    'Total Delivered',
    'Total Opened',
    'Total Clicked',
    'Total Replied',
    'Delivery Rate (%)',
    'Open Rate (%)',
    'Click Rate (%)',
    'Reply Rate (%)',
    'Created At',
    'Last Executed At',
  ];

  const rows = sequences.map(seq => [
    seq.sequenceId,
    seq.sequenceName,
    seq.isActive ? 'Active' : 'Inactive',
    seq.channel,
    seq.totalEnrolled,
    seq.activeEnrollments,
    seq.completedEnrollments,
    seq.totalSent,
    seq.totalDelivered,
    seq.totalOpened,
    seq.totalClicked,
    seq.totalReplied,
    seq.deliveryRate.toFixed(2),
    seq.openRate.toFixed(2),
    seq.clickRate.toFixed(2),
    seq.replyRate.toFixed(2),
    seq.createdAt.toISOString(),
    (() => { const v = seq.lastExecutedAt?.toISOString(); return (v !== '' && v != null) ? v : 'N/A'; })(),
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => escapeCsvCell(String(cell))).join(','))
    .join('\n');

  downloadCSV(
    csvContent,
(filename !== '' && filename != null) ? filename : `sequence-performance-${formatDateForFilename(new Date())}.csv`
  );
}

/**
 * Export analytics summary to CSV
 */
export function exportSummaryToCSV(
  summary: AnalyticsSummaryData,
  dateRange: { startDate: Date; endDate: Date },
  filename?: string
): void {
  const headers = ['Metric', 'Value'];
  
  const rows = [
    ['Report Generated', new Date().toISOString()],
    ['Date Range Start', dateRange.startDate.toISOString()],
    ['Date Range End', dateRange.endDate.toISOString()],
    ['', ''],
    ['Total Sequences', summary.totalSequences],
    ['Active Sequences', summary.activeSequences],
    ['Total Enrollments', summary.totalEnrollments],
    ['Active Enrollments', summary.activeEnrollments],
    ['', ''],
    ['Total Sent', summary.totalSent],
    ['Total Delivered', summary.totalDelivered],
    ['Total Opened', summary.totalOpened],
    ['Total Clicked', summary.totalClicked],
    ['Total Replied', summary.totalReplied],
    ['', ''],
    ['Avg Delivery Rate (%)', summary.avgDeliveryRate.toFixed(2)],
    ['Avg Open Rate (%)', summary.avgOpenRate.toFixed(2)],
    ['Avg Click Rate (%)', summary.avgClickRate.toFixed(2)],
    ['Avg Reply Rate (%)', summary.avgReplyRate.toFixed(2)],
  ];

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => escapeCsvCell(String(cell))).join(','))
    .join('\n');

  downloadCSV(
    csvContent,
(filename !== '' && filename != null) ? filename : `analytics-summary-${formatDateForFilename(new Date())}.csv`
  );
}

/**
 * Export channel performance to CSV
 */
export function exportChannelPerformanceToCSV(
  channelData: {
    email: { sent: number; delivered: number; opened: number; replied: number };
    linkedin: { sent: number; delivered: number; opened: number; replied: number };
    sms: { sent: number; delivered: number; replied: number };
    phone: { sent: number; replied: number };
  },
  filename?: string
): void {
  const headers = ['Channel', 'Sent', 'Delivered', 'Opened', 'Replied', 'Delivery Rate (%)', 'Open Rate (%)', 'Reply Rate (%)'];
  
  const calculateRate = (numerator: number, denominator: number) => 
    denominator > 0 ? ((numerator / denominator) * 100).toFixed(2) : '0.00';

  const rows = [
    [
      'Email',
      channelData.email.sent,
      channelData.email.delivered,
      channelData.email.opened,
      channelData.email.replied,
      calculateRate(channelData.email.delivered, channelData.email.sent),
      calculateRate(channelData.email.opened, channelData.email.delivered),
      calculateRate(channelData.email.replied, channelData.email.delivered),
    ],
    [
      'LinkedIn',
      channelData.linkedin.sent,
      channelData.linkedin.delivered,
      channelData.linkedin.opened,
      channelData.linkedin.replied,
      calculateRate(channelData.linkedin.delivered, channelData.linkedin.sent),
      calculateRate(channelData.linkedin.opened, channelData.linkedin.delivered),
      calculateRate(channelData.linkedin.replied, channelData.linkedin.delivered),
    ],
    [
      'SMS',
      channelData.sms.sent,
      channelData.sms.delivered,
      'N/A',
      channelData.sms.replied,
      calculateRate(channelData.sms.delivered, channelData.sms.sent),
      'N/A',
      calculateRate(channelData.sms.replied, channelData.sms.delivered),
    ],
    [
      'Phone',
      channelData.phone.sent,
      'N/A',
      'N/A',
      channelData.phone.replied,
      'N/A',
      'N/A',
      calculateRate(channelData.phone.replied, channelData.phone.sent),
    ],
  ];

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => escapeCsvCell(String(cell))).join(','))
    .join('\n');

  downloadCSV(
    csvContent,
(filename !== '' && filename != null) ? filename : `channel-performance-${formatDateForFilename(new Date())}.csv`
  );
}

/**
 * Export step-by-step performance data to CSV
 */
export function exportStepPerformanceToCSV(
  sequenceName: string,
  steps: Array<{
    stepIndex: number;
    channel: string;
    action: string;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    replied: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    replyRate: number;
  }>,
  filename?: string
): void {
  const headers = [
    'Step #',
    'Channel',
    'Action',
    'Sent',
    'Delivered',
    'Opened',
    'Clicked',
    'Replied',
    'Delivery Rate (%)',
    'Open Rate (%)',
    'Click Rate (%)',
    'Reply Rate (%)',
  ];

  const rows = steps.map(step => [
    step.stepIndex + 1,
    step.channel,
    step.action,
    step.sent,
    step.delivered,
    step.opened,
    step.clicked,
    step.replied,
    step.deliveryRate.toFixed(2),
    step.openRate.toFixed(2),
    step.clickRate.toFixed(2),
    step.replyRate.toFixed(2),
  ]);

  const csvContent = [
    [`Sequence: ${sequenceName}`],
    [''],
    headers,
    ...rows,
  ]
    .map(row => row.map(cell => escapeCsvCell(String(cell))).join(','))
    .join('\n');

  downloadCSV(
    csvContent,
(filename !== '' && filename != null) ? filename : `${sequenceName.toLowerCase().replace(/\s+/g, '-')}-steps-${formatDateForFilename(new Date())}.csv`
  );
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Escape CSV cell content
 */
function escapeCsvCell(value: string): string {
  // If value contains comma, newline, or quote, wrap in quotes and escape quotes
  if (value.includes(',') || value.includes('\n') || value.includes('"')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Format date for filename (YYYY-MM-DD)
 */
function formatDateForFilename(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Download CSV file
 */
function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    // Feature detection for download attribute
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
