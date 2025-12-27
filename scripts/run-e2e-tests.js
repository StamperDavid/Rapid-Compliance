/**
 * E2E Test Runner
 * Best Practice: Automated testing pipeline with real Firebase
 * 
 * This script:
 * 1. Starts Firebase emulators
 * 2. Seeds test data
 * 3. Runs E2E tests
 * 4. Cleans up
 * 5. Stops emulators
 */

const { spawn, exec } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

// Step 1: Start Firebase Emulators
async function startEmulators() {
  return new Promise((resolve, reject) => {
    log('\n🚀 Step 1: Starting Firebase Emulators...', colors.blue);
    
    const emulatorProcess = spawn('firebase', ['emulators:start'], {
      cwd: process.cwd(),
      shell: true,
    });

    let emulatorReady = false;

    emulatorProcess.stdout.on('data', (data) => {
      const output = data.toString();
      
      // Check if emulators are ready
      if (output.includes('All emulators ready') || output.includes('View Emulator UI at')) {
        if (!emulatorReady) {
          emulatorReady = true;
          log('✅ Firebase Emulators ready\n', colors.green);
          setTimeout(() => resolve(emulatorProcess), 2000); // Wait 2s for stability
        }
      }
    });

    emulatorProcess.stderr.on('data', (data) => {
      // Ignore warnings
      const output = data.toString();
      if (!output.includes('warning')) {
        console.error(output);
      }
    });

    emulatorProcess.on('error', (error) => {
      log(`❌ Failed to start emulators: ${error.message}`, colors.red);
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!emulatorReady) {
        emulatorProcess.kill();
        reject(new Error('Emulators failed to start within 30 seconds'));
      }
    }, 30000);
  });
}

// Step 2: Seed Test Data
async function seedTestData() {
  return new Promise((resolve, reject) => {
    log('🌱 Step 2: Seeding test data...', colors.blue);
    
    const seedProcess = spawn('node', ['scripts/seed-test-accounts.js'], {
      cwd: process.cwd(),
      shell: true,
      stdio: 'inherit',
    });

    seedProcess.on('close', (code) => {
      if (code === 0) {
        log('✅ Test data seeded\n', colors.green);
        resolve();
      } else {
        log(`❌ Seeding failed with code ${code}`, colors.red);
        reject(new Error(`Seeding failed with code ${code}`));
      }
    });

    seedProcess.on('error', (error) => {
      log(`❌ Seeding error: ${error.message}`, colors.red);
      reject(error);
    });
  });
}

// Step 3: Run E2E Tests
async function runE2ETests() {
  return new Promise((resolve, reject) => {
    log('🧪 Step 3: Running E2E tests...', colors.blue);
    
    const testProcess = spawn('npm', ['run', 'test:e2e'], {
      cwd: process.cwd(),
      shell: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV: 'test',
        FIRESTORE_EMULATOR_HOST: 'localhost:8080',
        FIREBASE_AUTH_EMULATOR_HOST: 'localhost:9099',
      },
    });

    testProcess.on('close', (code) => {
      if (code === 0) {
        log('\n✅ All E2E tests passed!\n', colors.green);
        resolve();
      } else {
        log(`\n❌ E2E tests failed with code ${code}\n`, colors.red);
        reject(new Error(`Tests failed with code ${code}`));
      }
    });

    testProcess.on('error', (error) => {
      log(`❌ Test error: ${error.message}`, colors.red);
      reject(error);
    });
  });
}

// Main execution
async function runFullE2ETests() {
  let emulatorProcess;
  
  try {
    log('═'.repeat(70), colors.blue);
    log('  E2E TEST RUNNER - Best Practice Integration Testing', colors.blue);
    log('═'.repeat(70), colors.blue);
    
    // Start emulators
    emulatorProcess = await startEmulators();
    
    // Seed test data
    await seedTestData();
    
    // Run tests
    await runE2ETests();
    
    log('═'.repeat(70), colors.green);
    log('  ✅ E2E TEST PIPELINE COMPLETE', colors.green);
    log('═'.repeat(70), colors.green);
    
    // Cleanup
    if (emulatorProcess) {
      emulatorProcess.kill();
      log('\n🛑 Stopped Firebase Emulators', colors.yellow);
    }
    
    process.exit(0);
  } catch (error) {
    log(`\n❌ E2E pipeline failed: ${error.message}`, colors.red);
    
    // Cleanup
    if (emulatorProcess) {
      emulatorProcess.kill();
      log('🛑 Stopped Firebase Emulators', colors.yellow);
    }
    
    process.exit(1);
  }
}

// Handle ctrl+c
process.on('SIGINT', () => {
  log('\n\n🛑 Test run cancelled', colors.yellow);
  process.exit(1);
});

// Run if called directly
if (require.main === module) {
  runFullE2ETests();
}

module.exports = { runFullE2ETests };

