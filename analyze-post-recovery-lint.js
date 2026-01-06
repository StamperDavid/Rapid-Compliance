const fs = require('fs');

// Read the ESLint JSON output
const rawData = fs.readFileSync('post_recovery_lint.json', 'utf8');
const results = JSON.parse(rawData);

// Calculate totals
let totalErrors = 0;
let totalWarnings = 0;
const fileWarnings = [];

results.forEach(file => {
  totalErrors += file.errorCount || 0;
  totalWarnings += file.warningCount || 0;
  
  if (file.warningCount > 0) {
    fileWarnings.push({
      filePath: file.filePath,
      warningCount: file.warningCount,
      errorCount: file.errorCount || 0
    });
  }
});

// Sort files by warning count (descending)
fileWarnings.sort((a, b) => b.warningCount - a.warningCount);

// Get top 5 files with most warnings
const top5Files = fileWarnings.slice(0, 5);

// Original count (from user's mention of 21,000)
const originalWarnings = 21000;
const ghostFactor = originalWarnings - totalWarnings;

// Output results
const report = {
  totalErrors,
  totalWarnings,
  ghostFactor,
  ghostFactorPercentage: ((ghostFactor / originalWarnings) * 100).toFixed(2),
  top5Files: top5Files.map(f => ({
    file: f.filePath.replace(/\\/g, '/').split('/').slice(-3).join('/'), // Show last 3 path segments
    fullPath: f.filePath,
    warnings: f.warningCount,
    errors: f.errorCount
  }))
};

console.log(JSON.stringify(report, null, 2));

// Also save to a file for reference
fs.writeFileSync('post_recovery_lint_analysis.json', JSON.stringify(report, null, 2));
