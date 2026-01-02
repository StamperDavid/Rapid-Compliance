/**
 * Check for environment variable mismatch
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

console.log('\n🔍 ENVIRONMENT VARIABLE CHECK\n');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('FRONTEND (Client-side) Config:');
console.log(`  NEXT_PUBLIC_FIREBASE_PROJECT_ID: ${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'NOT SET'}`);
console.log(`  NEXT_PUBLIC_FIREBASE_API_KEY: ${process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? '✅ Set' : '❌ NOT SET'}`);
console.log(`  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: ${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'NOT SET'}`);
console.log('');

console.log('BACKEND (Admin SDK) Config:');
console.log(`  FIREBASE_ADMIN_PROJECT_ID: ${process.env.FIREBASE_ADMIN_PROJECT_ID || 'NOT SET'}`);
console.log(`  FIREBASE_ADMIN_CLIENT_EMAIL: ${process.env.FIREBASE_ADMIN_CLIENT_EMAIL || 'NOT SET'}`);
console.log(`  FIREBASE_ADMIN_PRIVATE_KEY: ${process.env.FIREBASE_ADMIN_PRIVATE_KEY ? '✅ Set' : '❌ NOT SET'}`);
console.log('');

console.log('═══════════════════════════════════════════════════════════\n');

// Check for mismatch
const frontendProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const backendProject = process.env.FIREBASE_ADMIN_PROJECT_ID;

if (frontendProject && backendProject) {
  if (frontendProject === backendProject) {
    console.log('✅ FRONTEND AND BACKEND ARE USING THE SAME PROJECT');
    console.log(`   Both pointing to: ${frontendProject}\n`);
  } else {
    console.log('🚨 MISMATCH DETECTED!\n');
    console.log(`   Frontend writes to: ${frontendProject}`);
    console.log(`   Backend reads from:  ${backendProject}`);
    console.log('');
    console.log('   This explains why:');
    console.log('   - You create orgs in admin dashboard but scripts can\'t see them');
    console.log('   - Ghost orgs persist in Firebase Console');
    console.log('   - Database appears "clean" but UI shows data');
    console.log('');
    console.log('   FIX: Update .env.local so both use the same project ID\n');
  }
} else {
  console.log('⚠️  WARNING: One or both project IDs are not set!\n');
}

console.log('═══════════════════════════════════════════════════════════\n');
