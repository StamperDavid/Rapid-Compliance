/**
 * Quick script to check if Firebase credentials are configured
 */

require('dotenv').config({ path: '.env.local' });

console.log('\n🔍 Checking Firebase Configuration...\n');

const requiredVars = [
  'FIREBASE_ADMIN_PROJECT_ID',
  'FIREBASE_ADMIN_CLIENT_EMAIL',
  'FIREBASE_ADMIN_PRIVATE_KEY'
];

let allSet = true;

requiredVars.forEach(varName => {
  const value = process.env[varName];
  if (value) {
    if (varName === 'FIREBASE_ADMIN_PRIVATE_KEY') {
      // Just check if it looks like a private key
      const isValid = value.includes('BEGIN PRIVATE KEY');
      console.log(`✅ ${varName}: ${isValid ? 'SET (valid format)' : 'SET (invalid format - missing BEGIN PRIVATE KEY)'}`);
      if (!isValid) allSet = false;
    } else {
      console.log(`✅ ${varName}: ${value.substring(0, 30)}...`);
    }
  } else {
    console.log(`❌ ${varName}: NOT SET`);
    allSet = false;
  }
});

console.log('\n' + '='.repeat(60));

if (allSet) {
  console.log('✅ All Firebase Admin credentials are configured!');
  console.log('You can now run: node scripts/seed-production-test-orgs.js');
} else {
  console.log('❌ Missing Firebase credentials!');
  console.log('\n📖 Follow the instructions in FIREBASE_CREDENTIALS_SETUP.md');
  console.log('   to get your Firebase service account credentials.');
}

console.log('='.repeat(60) + '\n');

process.exit(allSet ? 0 : 1);










