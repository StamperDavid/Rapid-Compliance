import fs from 'fs';
import readline from 'readline';

async function analyzeESLint() {
  const fileStream = fs.createReadStream('eslint-output.txt', { encoding: 'utf8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const ruleCounts = {};
  const severityCounts = { error: 0, warning: 0 };
  let totalIssues = 0;
  let filesWithIssues = 0;

  const issuePattern = /^\s+(\d+):(\d+)\s+(error|warning)\s+(.+)$/;
  const filePattern = /^[A-Z]:\\.+\.(tsx?|jsx?|css)$/;

  for await (const line of rl) {
    // Check if it's a file path
    if (filePattern.test(line.trim())) {
      filesWithIssues++;
      continue;
    }

    // Check if it's an issue line
    const match = line.match(issuePattern);
    if (match) {
      const [, lineNum, col, severity, rest] = match;
      
      // Split by 2+ spaces to separate message from rule name
      const parts = rest.split(/\s{2,}/);
      if (parts.length >= 2) {
        const ruleId = parts[parts.length - 1].trim();
        const message = parts.slice(0, -1).join(' ').trim();
        
        if (!ruleCounts[ruleId]) {
          ruleCounts[ruleId] = { total: 0, errors: 0, warnings: 0, sampleMessage: message };
        }
        
        ruleCounts[ruleId].total++;
        if (severity === 'error') {
          ruleCounts[ruleId].errors++;
          severityCounts.error++;
        } else {
          ruleCounts[ruleId].warnings++;
          severityCounts.warning++;
        }
        totalIssues++;
      }
    }
  }

  // Sort by total count
  const sortedRules = Object.entries(ruleCounts)
    .sort((a, b) => b[1].total - a[1].total);

  // Print summary
  console.log('='.repeat(105));
  console.log('ESLINT DIAGNOSTIC REPORT - src/app/**');
  console.log('='.repeat(105));
  console.log();
  console.log(`Files with Issues: ${filesWithIssues}`);
  console.log(`Total Errors: ${severityCounts.error}`);
  console.log(`Total Warnings: ${severityCounts.warning}`);
  console.log(`Total Issues: ${totalIssues}`);
  console.log(`Unique Rules Triggered: ${sortedRules.length}`);
  console.log();
  console.log('='.repeat(105));
  console.log('TOP 10 MOST FREQUENT ESLINT RULES');
  console.log('='.repeat(105));
  console.log();
  console.log('Rank'.padStart(5) + ' ' + 'Rule Name'.padEnd(55) + 'Total'.padStart(10) + ' ' + 'Errors'.padStart(8) + ' ' + 'Warns'.padStart(8) + ' ' + '%'.padStart(8));
  console.log('-'.repeat(105));

  sortedRules.slice(0, 10).forEach(([rule, counts], index) => {
    const percentage = ((counts.total / totalIssues) * 100).toFixed(1);
    console.log(
      (index + 1).toString().padStart(5) + ' ' +
      rule.padEnd(55) + 
      counts.total.toString().padStart(10) + ' ' +
      counts.errors.toString().padStart(8) + ' ' +
      counts.warnings.toString().padStart(8) + ' ' +
      (percentage + '%').padStart(8)
    );
  });

  const top10Total = sortedRules.slice(0, 10).reduce((sum, [_, counts]) => sum + counts.total, 0);
  const top10Percentage = ((top10Total / totalIssues) * 100).toFixed(1);
  console.log('-'.repeat(105));
  console.log('TOP 10 TOTAL:'.padEnd(61) + top10Total.toString().padStart(10) + ''.padStart(10) + ''.padStart(10) + (top10Percentage + '%').padStart(8));

  console.log();
  console.log('='.repeat(105));
  console.log('RULES 11-20');
  console.log('='.repeat(105));
  console.log();
  console.log('Rank'.padStart(5) + ' ' + 'Rule Name'.padEnd(55) + 'Total'.padStart(10) + ' ' + 'Errors'.padStart(8) + ' ' + 'Warns'.padStart(8) + ' ' + '%'.padStart(8));
  console.log('-'.repeat(105));

  sortedRules.slice(10, 20).forEach(([rule, counts], index) => {
    const percentage = ((counts.total / totalIssues) * 100).toFixed(1);
    console.log(
      (index + 11).toString().padStart(5) + ' ' +
      rule.padEnd(55) + 
      counts.total.toString().padStart(10) + ' ' +
      counts.errors.toString().padStart(8) + ' ' +
      counts.warnings.toString().padStart(8) + ' ' +
      (percentage + '%').padStart(8)
    );
  });

  console.log();
  console.log('='.repeat(105));
  console.log('GHOST ERRORS ANALYSIS');
  console.log('='.repeat(105));
  console.log();
  console.log('Checking for rules that trigger actual "error" severity...');
  console.log('(These rules are configured as "error" but may need to be "warn" or vice versa)');
  console.log();

  const rulesWithErrors = sortedRules.filter(([_, counts]) => counts.errors > 0);
  if (rulesWithErrors.length > 0) {
    console.log(`⚠️  Found ${rulesWithErrors.length} rules with ERROR severity:`);
    console.log();
    rulesWithErrors.forEach(([rule, counts]) => {
      console.log(`  ${rule}:`);
      console.log(`    ${counts.errors} errors, ${counts.warnings} warnings`);
      console.log(`    Sample: ${counts.sampleMessage}`);
      console.log();
    });
  } else {
    console.log('  ✓ No "ghost errors" found');
    console.log('  All violations are at "warning" level (as configured in .eslintrc.json)');
  }

  console.log();
  console.log('='.repeat(105));
  console.log('TOP 10 RULES - SAMPLE VIOLATIONS');
  console.log('='.repeat(105));
  console.log();

  sortedRules.slice(0, 10).forEach(([rule, counts], index) => {
    console.log(`${index + 1}. ${rule}`);
    console.log(`   Count: ${counts.total} | Sample: ${counts.sampleMessage}`);
    console.log();
  });

  console.log();
  console.log('='.repeat(105));
  console.log('ALL RULES SUMMARY (' + sortedRules.length + ' unique rules)');
  console.log('='.repeat(105));
  console.log();

  sortedRules.forEach(([rule, counts], index) => {
    const percentage = ((counts.total / totalIssues) * 100).toFixed(1);
    console.log(`${(index + 1).toString().padStart(3)}. ${rule.padEnd(55)} ${counts.total.toString().padStart(6)} (${percentage.padStart(5)}%)`);
  });

  // Save detailed analysis
  const analysis = {
    summary: {
      filesWithIssues,
      totalErrors: severityCounts.error,
      totalWarnings: severityCounts.warning,
      totalIssues,
      uniqueRules: sortedRules.length
    },
    topRules: sortedRules.slice(0, 20).map(([rule, counts]) => ({
      rule,
      total: counts.total,
      errors: counts.errors,
      warnings: counts.warnings,
      percentage: ((counts.total / totalIssues) * 100).toFixed(2),
      sampleMessage: counts.sampleMessage
    })),
    allRules: sortedRules.map(([rule, counts]) => ({
      rule,
      total: counts.total,
      errors: counts.errors,
      warnings: counts.warnings,
      percentage: ((counts.total / totalIssues) * 100).toFixed(2)
    }))
  };

  fs.writeFileSync('eslint-analysis.json', JSON.stringify(analysis, null, 2));
  console.log();
  console.log('='.repeat(105));
  console.log('✅ Detailed JSON analysis saved to: eslint-analysis.json');
  console.log('='.repeat(105));
}

analyzeESLint().catch(console.error);
