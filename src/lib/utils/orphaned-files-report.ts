/**
 * Orphaned Files Report
 *
 * This module provides a programmatic way to track and manage orphaned, redundant,
 * and deprecated files discovered during system audits.
 *
 * Based on GROUND_TRUTH_DISCOVERY audit findings.
 *
 * NOTE: This file is designed to use console.log for reporting purposes.
 * ESLint console warnings are intentionally disabled for this module.
 *
 * @module lib/utils/orphaned-files-report
 */

/* eslint-disable no-console */

/**
 * Action types for orphaned files
 */
export type OrphanedFileAction =
  | 'DELETE'       // File should be removed entirely
  | 'DEPRECATE'    // File should be marked deprecated but kept for now
  | 'CONSOLIDATE'  // File should be merged/consolidated with another
  | 'KEEP';        // File should be kept despite being flagged

/**
 * Classification types for orphaned files
 */
export type OrphanedFileType =
  | 'duplicate'    // Exact duplicate of another file
  | 'orphaned'     // No longer used by any active code
  | 'deprecated'   // Marked as deprecated, replacement exists
  | 'redundant'    // Functionality duplicated elsewhere
  | 'overlap'      // Overlapping functionality with another file
  | 'junk'         // Backup files, temporary files, etc.
  | 'stub';        // Minimal re-export or placeholder file

/**
 * Metadata for an orphaned file
 */
export interface OrphanedFile {
  /** Relative path from project root */
  path: string;

  /** Classification type */
  type: OrphanedFileType;

  /** Human-readable reason for flagging */
  reason: string;

  /** Recommended action */
  action: OrphanedFileAction;

  /** File size (optional, for prioritization) */
  size?: string;

  /** Related files (e.g., replacement file, duplicate source) */
  relatedFiles?: string[];

  /** Additional notes or context */
  notes?: string;
}

/**
 * Complete list of orphaned files discovered in system audit
 */
export const ORPHANED_FILES: readonly OrphanedFile[] = [
  {
    path: 'src/app/admin/system/api-keys/page-new.tsx',
    type: 'duplicate',
    reason: 'Exact copy of page.tsx',
    action: 'DELETE',
    size: '514 lines',
    relatedFiles: ['src/app/admin/system/api-keys/page.tsx'],
    notes: 'Appears to be a failed rename or accidental copy. page.tsx is the active version.'
  },
  {
    path: 'src/components/admin/templates/TemplateEditor.tsx',
    type: 'orphaned',
    reason: 'Replaced by ModularTemplateEditor',
    action: 'DELETE',
    relatedFiles: ['src/components/admin/templates/ModularTemplateEditor.tsx'],
    notes: 'Old monolithic template editor. All references updated to ModularTemplateEditor.'
  },
  {
    path: 'src/components/admin/templates/editor-tabs/ScraperCRMTab.tsx',
    type: 'orphaned',
    reason: 'Only used by unused TemplateEditor',
    action: 'DELETE',
    size: '14KB',
    relatedFiles: ['src/components/admin/templates/TemplateEditor.tsx'],
    notes: 'Tab component for deprecated TemplateEditor. ModularTemplateEditor uses different structure.'
  },
  {
    path: 'src/components/admin/templates/editor-tabs/IntelligenceSignalsTab.tsx',
    type: 'orphaned',
    reason: 'Only used by unused TemplateEditor',
    action: 'DELETE',
    size: '22KB',
    relatedFiles: ['src/components/admin/templates/TemplateEditor.tsx'],
    notes: 'Tab component for deprecated TemplateEditor. ModularTemplateEditor uses different structure.'
  },
  {
    path: 'src/components/admin/templates/editor-tabs/AIAgentsTab.tsx',
    type: 'orphaned',
    reason: 'Only used by unused TemplateEditor',
    action: 'DELETE',
    size: '13KB',
    relatedFiles: ['src/components/admin/templates/TemplateEditor.tsx'],
    notes: 'Tab component for deprecated TemplateEditor. ModularTemplateEditor uses different structure.'
  },
  {
    path: 'src/lib/outbound/apis/clearbit-service.ts',
    type: 'deprecated',
    reason: 'Marked @deprecated, replaced by discovery-engine.ts',
    action: 'DEPRECATE',
    relatedFiles: ['src/lib/outbound/apis/discovery-engine.ts'],
    notes: 'Contains @deprecated JSDoc tags. Keep temporarily for backwards compatibility, remove in next major version.'
  },
  {
    path: 'src/lib/agent/knowledge-processor-enhanced.ts',
    type: 'redundant',
    reason: 'Thin 39-line wrapper around existing functionality',
    action: 'CONSOLIDATE',
    size: '39 lines',
    notes: 'Minimal abstraction layer. Should be merged into primary knowledge processor or eliminated if unused.'
  },
  {
    path: 'src/lib/training/golden-master-updater.ts',
    type: 'overlap',
    reason: 'Overlapping functionality with golden-master-builder.ts',
    action: 'CONSOLIDATE',
    relatedFiles: ['src/lib/training/golden-master-builder.ts'],
    notes: 'Both files handle golden master operations. Should consolidate into single unified module.'
  },
  {
    path: '.env.local.backup',
    type: 'junk',
    reason: 'Stale backup file',
    action: 'DELETE',
    size: '1.7KB',
    notes: 'Backup files should not be committed to version control. Remove and add to .gitignore.'
  },
  {
    path: 'package.json.backup',
    type: 'junk',
    reason: 'Stale backup file',
    action: 'DELETE',
    size: '1.6KB',
    notes: 'Backup files should not be committed to version control. Remove and add to .gitignore.'
  },
  {
    path: 'src/lib/agents/trust/gmb/index.ts',
    type: 'stub',
    reason: '4-line re-export stub',
    action: 'KEEP',
    size: '4 lines',
    notes: 'Standard barrel export pattern. Acceptable for module organization despite being minimal.'
  }
] as const;

/**
 * Console formatting utilities
 */
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
} as const;

/**
 * Get color for action type
 */
function getActionColor(action: OrphanedFileAction): string {
  switch (action) {
    case 'DELETE':
      return COLORS.red;
    case 'DEPRECATE':
      return COLORS.yellow;
    case 'CONSOLIDATE':
      return COLORS.blue;
    case 'KEEP':
      return COLORS.green;
    default:
      return COLORS.reset;
  }
}

/**
 * Get color for file type
 */
function getTypeColor(type: OrphanedFileType): string {
  switch (type) {
    case 'duplicate':
    case 'junk':
      return COLORS.red;
    case 'orphaned':
    case 'deprecated':
      return COLORS.yellow;
    case 'redundant':
    case 'overlap':
      return COLORS.cyan;
    case 'stub':
      return COLORS.gray;
    default:
      return COLORS.reset;
  }
}

/**
 * Print formatted orphaned files report to console
 *
 * Displays a comprehensive table of all orphaned files with color coding
 * and summary statistics.
 *
 * @example
 * ```typescript
 * import { printOrphanedFilesReport } from '@/lib/utils/orphaned-files-report';
 *
 * printOrphanedFilesReport();
 * ```
 */
export function printOrphanedFilesReport(): void {
  console.log(`\n${COLORS.bold}${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}  ORPHANED FILES REPORT - GROUND TRUTH DISCOVERY AUDIT${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);

  ORPHANED_FILES.forEach((file, index) => {
    const actionColor = getActionColor(file.action);
    const typeColor = getTypeColor(file.type);

    console.log(`${COLORS.bold}${index + 1}. ${file.path}${COLORS.reset}`);
    console.log(`   Type:   ${typeColor}${file.type.toUpperCase()}${COLORS.reset}`);
    console.log(`   Action: ${actionColor}${file.action}${COLORS.reset}`);
    console.log(`   Reason: ${file.reason}`);

    if (file.size) {
      console.log(`   Size:   ${COLORS.gray}${file.size}${COLORS.reset}`);
    }

    if (file.relatedFiles && file.relatedFiles.length > 0) {
      console.log(`   Related: ${COLORS.gray}${file.relatedFiles.join(', ')}${COLORS.reset}`);
    }

    if (file.notes) {
      console.log(`   Notes:  ${COLORS.gray}${file.notes}${COLORS.reset}`);
    }

    console.log('');
  });

  // Summary statistics
  const actionCounts = ORPHANED_FILES.reduce((acc, file) => {
    acc[file.action] = (acc[file.action] || 0) + 1;
    return acc;
  }, {} as Record<OrphanedFileAction, number>);

  const typeCounts = ORPHANED_FILES.reduce((acc, file) => {
    acc[file.type] = (acc[file.type] || 0) + 1;
    return acc;
  }, {} as Record<OrphanedFileType, number>);

  console.log(`${COLORS.bold}${COLORS.cyan}───────────────────────────────────────────────────────────────${COLORS.reset}`);
  console.log(`${COLORS.bold}SUMMARY${COLORS.reset}`);
  console.log(`${COLORS.bold}${COLORS.cyan}───────────────────────────────────────────────────────────────${COLORS.reset}\n`);

  console.log(`${COLORS.bold}Total Files: ${COLORS.reset}${ORPHANED_FILES.length}\n`);

  console.log(`${COLORS.bold}By Action:${COLORS.reset}`);
  Object.entries(actionCounts).forEach(([action, count]) => {
    const color = getActionColor(action as OrphanedFileAction);
    console.log(`  ${color}${action}${COLORS.reset}: ${count}`);
  });

  console.log(`\n${COLORS.bold}By Type:${COLORS.reset}`);
  Object.entries(typeCounts).forEach(([type, count]) => {
    const color = getTypeColor(type as OrphanedFileType);
    console.log(`  ${color}${type}${COLORS.reset}: ${count}`);
  });

  console.log(`\n${COLORS.bold}${COLORS.cyan}═══════════════════════════════════════════════════════════════${COLORS.reset}\n`);
}

/**
 * Get list of files marked for deletion
 *
 * @returns Array of file paths that should be deleted
 *
 * @example
 * ```typescript
 * const filesToDelete = getFilesToDelete();
 * console.log(`Found ${filesToDelete.length} files to delete`);
 * ```
 */
export function getFilesToDelete(): string[] {
  return ORPHANED_FILES
    .filter(file => file.action === 'DELETE')
    .map(file => file.path);
}

/**
 * Get list of files marked for consolidation
 *
 * @returns Array of objects with file path and related consolidation targets
 *
 * @example
 * ```typescript
 * const filesToConsolidate = getFilesToConsolidate();
 * filesToConsolidate.forEach(({ path, relatedFiles }) => {
 *   console.log(`Consolidate ${path} with ${relatedFiles?.join(', ')}`);
 * });
 * ```
 */
export function getFilesToConsolidate(): Array<{
  path: string;
  relatedFiles?: string[];
  notes?: string;
}> {
  return ORPHANED_FILES
    .filter(file => file.action === 'CONSOLIDATE')
    .map(file => ({
      path: file.path,
      relatedFiles: file.relatedFiles,
      notes: file.notes
    }));
}

/**
 * Get list of files by action type
 *
 * @param action - The action type to filter by
 * @returns Array of orphaned files matching the action
 *
 * @example
 * ```typescript
 * const deprecatedFiles = getFilesByAction('DEPRECATE');
 * ```
 */
export function getFilesByAction(action: OrphanedFileAction): readonly OrphanedFile[] {
  return ORPHANED_FILES.filter(file => file.action === action);
}

/**
 * Get list of files by type
 *
 * @param type - The file type to filter by
 * @returns Array of orphaned files matching the type
 *
 * @example
 * ```typescript
 * const duplicateFiles = getFilesByType('duplicate');
 * ```
 */
export function getFilesByType(type: OrphanedFileType): readonly OrphanedFile[] {
  return ORPHANED_FILES.filter(file => file.type === type);
}

/**
 * Get total count of orphaned files
 *
 * @returns Total number of files in the report
 */
export function getTotalCount(): number {
  return ORPHANED_FILES.length;
}

/**
 * Get breakdown of files by action
 *
 * @returns Record mapping each action to its count
 */
export function getActionBreakdown(): Record<OrphanedFileAction, number> {
  return ORPHANED_FILES.reduce((acc, file) => {
    acc[file.action] = (acc[file.action] || 0) + 1;
    return acc;
  }, {} as Record<OrphanedFileAction, number>);
}

/**
 * Get breakdown of files by type
 *
 * @returns Record mapping each type to its count
 */
export function getTypeBreakdown(): Record<OrphanedFileType, number> {
  return ORPHANED_FILES.reduce((acc, file) => {
    acc[file.type] = (acc[file.type] || 0) + 1;
    return acc;
  }, {} as Record<OrphanedFileType, number>);
}
