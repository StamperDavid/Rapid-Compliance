/**
 * Bypass Budget Ratchet
 * Ensures eslint-disable comment counts only go DOWN, never UP.
 * Cross-platform (works on Windows, Mac, Linux).
 */

const fs = require('fs');
const path = require('path');

const BUDGET_FILE = '.eslint-bypass-budget.json';

if (!fs.existsSync(BUDGET_FILE)) {
  console.log('No bypass budget file found. Skipping ratchet check.');
  process.exit(0);
}

let count = 0;

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      walk(full);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(full, 'utf8');
      const matches = content.match(/eslint-disable/g);
      if (matches) {
        count += matches.length;
      }
    }
  }
}

walk('src');

const budget = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8'))._total;

if (count > budget) {
  console.error('Bypass budget exceeded! Current: ' + count + ', Budget: ' + budget);
  console.error('You added new eslint-disable comments. Remove them and fix the underlying code.');
  process.exit(1);
}

console.log('Bypass ratchet OK (' + count + '/' + budget + ')');
process.exit(0);
