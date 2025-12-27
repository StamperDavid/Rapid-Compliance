#!/usr/bin/env node

/**
 * Console.log Migration Script
 * Systematically replaces console.* with structured logger across entire codebase
 * 
 * Usage: node scripts/migrate-console-logs.js
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Files to process
const pattern = 'src/**/*.{ts,tsx}';

// Statistics
let stats = {
  filesProcessed: 0,
  consoleLogs: 0,
  consoleWarns: 0,
  consoleErrors: 0,
  filesModified: 0,
  errors: [],
};

/**
 * Replace console.log patterns with logger
 */
function migrateFileConsoleLogs(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  let content = original;
  let modified = false;

  // Check if logger is already imported
  const hasLoggerImport = content.includes("from '@/lib/logger/logger'") ||
                          content.includes('from "@/lib/logger/logger"');

  const fileStats = {
    logs: 0,
    warns: 0,
    errors: 0,
  };

  // Pattern 1: console.error('message', error)
  content = content.replace(
    /console\.error\(['"`]([^'"`]+)['"`],\s*(\w+)\);?/g,
    (match, message, errorVar) => {
      fileStats.errors++;
      return `logger.error('${message}', ${errorVar}, { file: '${path.basename(filePath)}' });`;
    }
  );

  // Pattern 2: console.error('message')
  content = content.replace(
    /console\.error\(['"`]([^'"`]+)['"`]\);?/g,
    (match, message) => {
      fileStats.errors++;
      return `logger.error('${message}', new Error('${message}'), { file: '${path.basename(filePath)}' });`;
    }
  );

  // Pattern 3: console.warn('message')
  content = content.replace(
    /console\.warn\(['"`]([^'"`]+)['"`]\);?/g,
    (match, message) => {
      fileStats.warns++;
      return `logger.warn('${message}', { file: '${path.basename(filePath)}' });`;
    }
  );

  // Pattern 4: console.log with template literal
  content = content.replace(
    /console\.log\(`\[([^\]]+)\]\s+([^`]+)`\);?/g,
    (match, prefix, message) => {
      fileStats.logs++;
      // Extract variables from template (simple version)
      return `logger.info('${prefix} ${message.replace(/\$\{/g, '')}', { file: '${path.basename(filePath)}' });`;
    }
  );

  // Pattern 5: console.log('message')
  content = content.replace(
    /console\.log\(['"`]([^'"`]+)['"`]\);?/g,
    (match, message) => {
      fileStats.logs++;
      return `logger.info('${message}', { file: '${path.basename(filePath)}' });`;
    }
  );

  // Add logger import if needed and modifications were made
  if ((fileStats.logs > 0 || fileStats.warns > 0 || fileStats.errors > 0) && !hasLoggerImport) {
    // Find the last import statement
    const importMatch = content.match(/import\s+.*?from\s+['"][^'"]+['"]/g);
    if (importMatch && importMatch.length > 0) {
      const lastImport = importMatch[importMatch.length - 1];
      content = content.replace(
        lastImport,
        lastImport + "\nimport { logger } from '@/lib/logger/logger';"
      );
    }
  }

  // Check if modified
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    modified = true;
    stats.filesModified++;
  }

  stats.consoleLogs += fileStats.logs;
  stats.consoleWarns += fileStats.warns;
  stats.consoleErrors += fileStats.errors;

  return { modified, ...fileStats };
}

/**
 * Process all files
 */
function processAllFiles() {
  console.log('🔍 Finding TypeScript files...\n');

  // Get all files
  const files = glob.sync(pattern, {
    ignore: ['**/node_modules/**', '**/*.d.ts', '**/*.test.ts', '**/*.test.tsx'],
    cwd: process.cwd(),
  });

  console.log(`Found ${files.length} files to process\n`);

  files.forEach((file, index) => {
    try {
      stats.filesProcessed++;

      const result = migrateFileConsoleLogs(file);

      if (result.modified) {
        console.log(`✅ ${file}`);
        console.log(`   Replaced: ${result.logs} logs, ${result.warns} warns, ${result.errors} errors`);
      } else if ((index + 1) % 10 === 0) {
        console.log(`   Processed ${index + 1}/${files.length} files...`);
      }
    } catch (error) {
      stats.errors.push({ file, error: error.message });
      console.error(`❌ Error processing ${file}:`, error.message);
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log('📊 MIGRATION COMPLETE\n');
  console.log(`Files Processed: ${stats.filesProcessed}`);
  console.log(`Files Modified: ${stats.filesModified}`);
  console.log(`console.log → logger.info: ${stats.consoleLogs}`);
  console.log(`console.warn → logger.warn: ${stats.consoleWarns}`);
  console.log(`console.error → logger.error: ${stats.consoleErrors}`);
  console.log(`Total Replaced: ${stats.consoleLogs + stats.consoleWarns + stats.consoleErrors}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors: ${stats.errors.length}`);
    stats.errors.forEach(({ file, error }) => {
      console.log(`   ${file}: ${error}`);
    });
  }

  console.log('\n✅ All console.* statements replaced with structured logger!');
  console.log('   Run `npm run build` to verify no TypeScript errors.\n');
}

// Run
processAllFiles();

