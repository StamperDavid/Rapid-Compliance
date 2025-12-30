/**
 * Run the cleanup API to delete test organizations
 * Usage: node scripts/run-cleanup-api.js [--dry-run]
 */

const https = require('https');
const http = require('http');

// Check for dry run flag
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Get API URL from environment or use localhost
const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const isHttps = API_URL.startsWith('https');
const httpModule = isHttps ? https : http;

console.log('🧹 Test Organization Cleanup Tool\n');
console.log(`API URL: ${API_URL}`);
console.log(`Mode: ${dryRun ? 'DRY RUN (preview only)' : 'LIVE (will delete)'}\n`);

// You need to provide your admin credentials
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

if (!ADMIN_PASSWORD) {
  console.error('❌ Error: ADMIN_PASSWORD environment variable not set');
  console.log('\nUsage:');
  console.log('  ADMIN_PASSWORD=your-password node scripts/run-cleanup-api.js');
  console.log('  ADMIN_PASSWORD=your-password node scripts/run-cleanup-api.js --dry-run');
  process.exit(1);
}

async function getAdminToken() {
  console.log('🔐 Authenticating as admin...');
  
  // This would need to call your Firebase Auth
  // For now, we'll use a simpler approach - you'll need to get the token from browser
  console.log('\n⚠️  To run this script, you need to:');
  console.log('1. Open your browser');
  console.log('2. Navigate to /admin/login');
  console.log('3. Open DevTools (F12)');
  console.log('4. Run this in console:');
  console.log('   firebase.auth().currentUser.getIdToken().then(t => console.log(t))');
  console.log('5. Copy the token and set it as ADMIN_TOKEN environment variable');
  console.log('\nOr use the web-based cleanup tool at /admin/organizations\n');
  process.exit(1);
}

async function runCleanup(token) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${API_URL}/api/admin/cleanup-test-orgs`);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };

    const req = httpModule.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(JSON.stringify({ dryRun }));
    req.end();
  });
}

// Check if ADMIN_TOKEN is provided
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  getAdminToken();
} else {
  console.log('🚀 Running cleanup...\n');
  
  runCleanup(ADMIN_TOKEN)
    .then(result => {
      if (result.dryRun) {
        console.log('📋 DRY RUN RESULTS:\n');
        console.log(`Total organizations: ${result.analysis.totalOrganizations}`);
        console.log(`Test organizations: ${result.analysis.testOrganizations}`);
        console.log(`Real organizations: ${result.analysis.realOrganizations}\n`);
        
        if (result.testOrgsToDelete.length > 0) {
          console.log('Test organizations to be deleted:');
          result.testOrgsToDelete.forEach((org, i) => {
            console.log(`  ${i + 1}. ${org.name} (${org.id})`);
            console.log(`     Created: ${org.createdAt || 'unknown'}`);
            console.log(`     Reason: ${org.reason}\n`);
          });
        }
        
        console.log('Real organizations to keep:');
        result.realOrgsToKeep.forEach((org, i) => {
          console.log(`  ${i + 1}. ${org.name} (${org.id})`);
        });
        
        console.log('\n✅ Dry run complete!');
        console.log('\nTo actually delete, run:');
        console.log(`ADMIN_TOKEN=${ADMIN_TOKEN} node scripts/run-cleanup-api.js\n`);
      } else {
        console.log('✅ CLEANUP COMPLETE!\n');
        console.log(`Deleted: ${result.deleted} test organization(s)`);
        console.log(`Remaining: ${result.remaining} real organization(s)\n`);
        
        if (result.deletedOrgs.length > 0) {
          console.log('Deleted organizations:');
          result.deletedOrgs.forEach((org, i) => {
            console.log(`  ${i + 1}. ${org.name} (${org.id})`);
          });
        }
        
        console.log('\n🎉 Your database is now clean!');
      }
    })
    .catch(error => {
      console.error('\n❌ Error:', error.message);
      process.exit(1);
    });
}
