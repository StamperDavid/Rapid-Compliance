/**
 * Check Firebase Authentication Users
 * Lists ALL users in Firebase Auth (not just Firestore)
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const auth = admin.auth();

async function listAllUsers() {
  console.log('🔍 Listing ALL Firebase Authentication Users...\n');
  
  try {
    let allUsers = [];
    let nextPageToken;
    
    // Paginate through all users
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);
      allUsers = allUsers.concat(listUsersResult.users);
      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
    
    console.log(`Found ${allUsers.length} total users in Firebase Auth\n`);
    
    // Group by email
    const usersByEmail = new Map();
    
    allUsers.forEach(user => {
      const email = user.email?.toLowerCase();
      if (!email) return;
      
      if (!usersByEmail.has(email)) {
        usersByEmail.set(email, []);
      }
      
      usersByEmail.get(email).push({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        createdAt: new Date(user.metadata.creationTime),
      });
    });
    
    console.log(`Unique emails: ${usersByEmail.size}\n`);
    
    // Find duplicates
    const duplicates = [];
    usersByEmail.forEach((users, email) => {
      if (users.length > 1) {
        duplicates.push({ email, users });
      }
    });
    
    if (duplicates.length > 0) {
      console.log(`⚠️  Found ${duplicates.length} emails with duplicate Auth users:\n`);
      duplicates.forEach(({ email, users }) => {
        console.log(`📧 ${email} (${users.length} auth users)`);
        users.forEach(u => {
          console.log(`   - ${u.uid} | ${u.createdAt.toISOString().split('T')[0]}`);
        });
      });
    } else {
      console.log('✅ No duplicate Auth users\n');
    }
    
    // Show all users
    console.log('\nAll Firebase Auth users:');
    allUsers.slice(0, 20).forEach(user => {
      console.log(`   ${user.email} | ${user.uid}`);
    });
    
    if (allUsers.length > 20) {
      console.log(`   ... and ${allUsers.length - 20} more`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

listAllUsers().then(() => process.exit(0));
