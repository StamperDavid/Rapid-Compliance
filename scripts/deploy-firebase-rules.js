#!/usr/bin/env node

/**
 * Deploy Firebase Security Rules and Indexes
 * 
 * Automates deployment of Firestore rules and indexes to production
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function execute(command, description) {
  console.log(`\n📦 ${description}...`);
  try {
    const output = execSync(command, { 
      encoding: 'utf8',
      stdio: 'inherit' 
    });
    console.log(`✅ ${description} - SUCCESS`);
    return true;
  } catch (error) {
    console.error(`❌ ${description} - FAILED`);
    console.error(error.message);
    return false;
  }
}

async function deployFirebase() {
  console.log('🚀 Firebase Production Deployment\n');
  console.log('='.repeat(60));

  // Check Firebase CLI installed
  try {
    execSync('firebase --version', { encoding: 'utf8' });
  } catch (error) {
    console.error('\n❌ Firebase CLI not installed!');
    console.error('\nInstall with: npm install -g firebase-tools');
    console.error('Then run: firebase login');
    process.exit(1);
  }

  // Check if firestore.rules exists
  const rulesPath = path.join(__dirname, '..', 'firestore.rules');
  if (!fs.existsSync(rulesPath)) {
    console.error('\n❌ firestore.rules not found!');
    process.exit(1);
  }
  console.log('✅ Found firestore.rules');

  // Check if firestore.indexes.json exists
  const indexesPath = path.join(__dirname, '..', 'firestore.indexes.json');
  if (!fs.existsSync(indexesPath)) {
    console.error('\n❌ firestore.indexes.json not found!');
    process.exit(1);
  }
  console.log('✅ Found firestore.indexes.json');

  console.log('\n⚠️  WARNING: This will deploy to PRODUCTION Firebase project');
  console.log('Make sure you have selected the correct project:');
  console.log('\nRun: firebase use --add');
  console.log('     firebase projects:list\n');

  // Get current project
  try {
    const currentProject = execSync('firebase use', { encoding: 'utf8' }).trim();
    console.log(`Current project: ${currentProject}\n`);
  } catch (error) {
    console.log('⚠️  No Firebase project selected. Run: firebase use --add\n');
  }

  // Deploy security rules
  const rulesDeployed = execute(
    'firebase deploy --only firestore:rules',
    'Deploying Firestore Security Rules'
  );

  if (!rulesDeployed) {
    console.error('\n❌ Failed to deploy security rules');
    process.exit(1);
  }

  // Deploy indexes
  const indexesDeployed = execute(
    'firebase deploy --only firestore:indexes',
    'Deploying Firestore Indexes'
  );

  if (!indexesDeployed) {
    console.error('\n❌ Failed to deploy indexes');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('\n✅ Firebase deployment COMPLETE!\n');
  console.log('Next steps:');
  console.log('1. Verify rules in Firebase Console → Firestore → Rules');
  console.log('2. Verify indexes in Firebase Console → Firestore → Indexes');
  console.log('3. Wait for index builds to complete (can take 5-10 minutes)');
  console.log('4. Test security rules with test accounts\n');
}

deployFirebase().catch(error => {
  console.error('\n❌ Deployment failed:', error);
  process.exit(1);
});
