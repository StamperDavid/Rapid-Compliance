/**
 * Update Demo Account Passwords in DEV
 */

const admin = require('firebase-admin');
require('dotenv').config({ path: require('path').join(__dirname, '../.env.local') });

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
  })
});

const auth = admin.auth();

const DEMO_ACCOUNTS = [
  { email: 'demo-auraflow@test.com', password: 'Testing123!' },
  { email: 'demo-greenthumb@test.com', password: 'Testing123!' },
  { email: 'demo-adventuregear@test.com', password: 'Testing123!' },
  { email: 'demo-summitwm@test.com', password: 'Testing123!' },
  { email: 'demo-pixelperfect@test.com', password: 'Testing123!' }
];

async function updatePasswords() {
  console.log('Updating demo account passwords in: ' + process.env.FIREBASE_ADMIN_PROJECT_ID);
  console.log('');
  
  for (const demo of DEMO_ACCOUNTS) {
    try {
      const user = await auth.getUserByEmail(demo.email);
      await auth.updateUser(user.uid, { password: demo.password });
      console.log('✅ Updated: ' + demo.email);
    } catch (error) {
      console.error('❌ Failed: ' + demo.email + ' - ' + error.message);
    }
  }
  
  console.log('\n✅ All demo account passwords updated to: Testing123!\n');
}

updatePasswords().then(() => process.exit(0));
