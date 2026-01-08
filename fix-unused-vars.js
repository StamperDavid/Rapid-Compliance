#!/usr/bin/env node
/**
 * AUTO-FIX UNUSED VARIABLES
 * Systematically fixes @typescript-eslint/no-unused-vars violations
 * 
 * Rules:
 * 1. Imports: Delete the unused import
 * 2. Function parameters: Prefix with _
 * 3. Destructured variables: Prefix with _ (safer than removing)
 * 4. Standalone variables: Delete the declaration
 */

const fs = require('fs');
const path = require('path');

// Read the eslint output
const eslintOutput = fs.readFileSync('unused-vars.txt', 'utf-8').replace(/^\uFEFF/, ''); // Remove BOM
const lines = eslintOutput.split('\n').filter(Boolean);

// Parse violations
const violations = [];
for (const line of lines) {
  const match = line.match(/^(.+?):\s*line\s+(\d+),\s+col\s+(\d+),\s+Warning\s+-\s+'([^']+)'\s+(is defined but never used|is assigned a value but never used)/);
  if (match) {
    const filepath = match[1].replace(/^\uFEFF/, '').trim(); // Clean up filepath
    violations.push({
      file: filepath,
      line: parseInt(match[2]),
      col: parseInt(match[3]),
      varName: match[4],
      type: match[5]
    });
  }
}

console.log(`Found ${violations.length} unused variable violations`);

// Group by file
const byFile = {};
for (const v of violations) {
  if (!byFile[v.file]) {
    byFile[v.file] = [];
  }
  byFile[v.file].push(v);
}

let fixCount = 0;
let skipCount = 0;

// Process each file
for (const [filepath, fileViolations] of Object.entries(byFile)) {
  console.log(`\nProcessing ${filepath} (${fileViolations.length} violations)`);
  
  let content = fs.readFileSync(filepath, 'utf-8');
  const originalLines = content.split('\n');
  
  // Sort violations by line number (descending) to avoid line number shifts
  fileViolations.sort((a, b) => b.line - a.line);
  
  for (const v of fileViolations) {
    const lineIdx = v.line - 1;
    const line = originalLines[lineIdx];
    
    if (!line) {
      console.log(`  ⚠️  Line ${v.line} not found for ${v.varName}`);
      skipCount++;
      continue;
    }
    
    // Determine fix strategy
    let fixed = false;
    
    // Strategy 1: Import statement - remove the import
    if (line.includes('import') && line.includes(v.varName)) {
      // Check if it's a single import or part of multiple
      if (line.match(new RegExp(`import\\s+${v.varName}\\s+from`))) {
        // Single default import - remove entire line
        originalLines[lineIdx] = '';
        console.log(`  ✓ Deleted import: ${v.varName}`);
        fixed = true;
      } else if (line.match(new RegExp(`import\\s+type\\s+${v.varName}\\s+from`))) {
        // Single type import - remove entire line
        originalLines[lineIdx] = '';
        console.log(`  ✓ Deleted type import: ${v.varName}`);
        fixed = true;
      } else if (line.match(/import\s*\{[^}]+\}/)) {
        // Multiple named imports - remove just this one
        const newLine = line
          .replace(new RegExp(`${v.varName}\\s*,\\s*`), '')
          .replace(new RegExp(`,\\s*${v.varName}`), '')
          .replace(new RegExp(`\\{\\s*${v.varName}\\s*\\}`), '{}');
        
        // If the import is now empty, remove the line
        if (newLine.includes('{}')) {
          originalLines[lineIdx] = '';
        } else {
          originalLines[lineIdx] = newLine;
        }
        console.log(`  ✓ Removed from import: ${v.varName}`);
        fixed = true;
      }
    }
    
    // Strategy 2: Function parameter or destructured variable - prefix with _
    else if (line.match(new RegExp(`(const|let|var)\\s+\\{[^}]*${v.varName}[^}]*\\}|\\(\\s*[^)]*\\b${v.varName}\\b`))) {
      const newLine = line.replace(new RegExp(`\\b${v.varName}\\b`), `_${v.varName}`);
      originalLines[lineIdx] = newLine;
      console.log(`  ✓ Prefixed with _: ${v.varName} → _${v.varName}`);
      fixed = true;
    }
    
    // Strategy 3: Standalone const/let/var - check if entire line can be removed
    else if (line.match(new RegExp(`^\\s*(const|let|var)\\s+${v.varName}\\s*=`))) {
      originalLines[lineIdx] = '';
      console.log(`  ✓ Deleted variable: ${v.varName}`);
      fixed = true;
    }
    
    // Strategy 4: Safe fallback - prefix with _
    else {
      const newLine = line.replace(new RegExp(`\\b${v.varName}\\b`), `_${v.varName}`);
      if (newLine !== line) {
        originalLines[lineIdx] = newLine;
        console.log(`  ✓ Prefixed (fallback): ${v.varName} → _${v.varName}`);
        fixed = true;
      } else {
        console.log(`  ⚠️  Could not fix: ${v.varName} at line ${v.line}`);
        skipCount++;
      }
    }
    
    if (fixed) {
      fixCount++;
    }
  }
  
  // Write back the file
  const newContent = originalLines.join('\n');
  if (newContent !== content) {
    fs.writeFileSync(filepath, newContent, 'utf-8');
    console.log(`  💾 Saved changes to ${path.basename(filepath)}`);
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`✅ Fixed: ${fixCount} violations`);
console.log(`⚠️  Skipped: ${skipCount} violations`);
console.log(`📁 Files processed: ${Object.keys(byFile).length}`);
