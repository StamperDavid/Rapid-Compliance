/**
 * Runner script for TypeScript seeding
 * Compiles and runs the TypeScript seed file
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 Starting test organization seeding...\n');

const tsNodePath = path.join(__dirname, '..', 'node_modules', '.bin', 'ts-node');
const seedScriptPath = path.join(__dirname, 'seed-test-organizations.ts');

const child = spawn('node', [
  '--loader', 'ts-node/esm',
  '--experimental-specifier-resolution=node',
  seedScriptPath
], {
  stdio: 'inherit',
  shell: true,
  env: {
    ...process.env,
    NODE_OPTIONS: '--loader ts-node/esm --experimental-specifier-resolution=node'
  }
});

child.on('error', (error) => {
  console.error('Failed to start seeding:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code || 0);
});


















