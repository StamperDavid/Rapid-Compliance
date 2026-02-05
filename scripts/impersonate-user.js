/**
 * Impersonate User Script
 * 
 * Usage: node scripts/impersonate-user.js <adminEmail> <targetUserEmail> <reason>
 * Example: node scripts/impersonate-user.js admin@example.com customer@acme.com "Debugging workflow issue"
 * 
 * This script creates an impersonation session for support purposes.
 * All impersonation sessions are logged and audited.
 * 
 * Manual Reference: Document 3 - Manual Intervention Guide, Section 3.1
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  // Check if service account key file exists
  let serviceAccount;
  try {
    serviceAccount = require('../serviceAccountKey.json');
  } catch (error) {
    console.error('❌ Error: serviceAccountKey.json not found');
    console.error('Please ensure serviceAccountKey.json exists in the project root');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

/**
 * Create an impersonation session
 * @param {string} adminEmail - Admin performing the impersonation
 * @param {string} targetUserEmail - Target user to impersonate
 * @param {string} reason - Reason for impersonation (required for audit)
 */
async function impersonateUser(adminEmail, targetUserEmail, reason) {
  try {
    console.log(`\n🔍 Looking up users...`);
    
    // Get admin user
    console.log(`   Admin: ${adminEmail}`);
    const adminSnapshot = await db.collection('users')
      .where('email', '==', adminEmail)
      .limit(1)
      .get();
    
    if (adminSnapshot.empty) {
      console.error(`❌ Error: Admin user not found: ${adminEmail}`);
      process.exit(1);
    }
    
    const adminUser = adminSnapshot.docs[0];
    const adminData = adminUser.data();
    
    // Verify admin has admin role
    if (adminData.role !== 'admin') {
      console.error(`❌ Error: User ${adminEmail} is not an admin (role: ${adminData.role})`);
      console.log('Only admin users can impersonate other users');
      process.exit(1);
    }

    console.log('   ✅ Admin verified (admin)');
    
    // Get target user
    console.log(`   Target: ${targetUserEmail}`);
    const targetSnapshot = await db.collection('users')
      .where('email', '==', targetUserEmail)
      .limit(1)
      .get();
    
    if (targetSnapshot.empty) {
      console.error(`❌ Error: Target user not found: ${targetUserEmail}`);
      process.exit(1);
    }
    
    const targetUser = targetSnapshot.docs[0];
    const targetData = targetUser.data();
    
    console.log(`   ✅ Target user found (Organization: ${targetData.organizationId})`);
    
    // Create impersonation session
    const sessionId = `impersonation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.log('\n📝 Creating impersonation session...');
    
    const sessionData = {
      adminId: adminUser.id,
      adminEmail: adminEmail,
      targetUserId: targetUser.id,
      targetUserEmail: targetUserEmail,
      targetOrgId: targetData.organizationId,
      reason: reason,
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      endedAt: null,
      status: 'active'
    };
    
    // Store session in admin collection
    await db.collection('admin')
      .doc('impersonationSessions')
      .collection('sessions')
      .doc(sessionId)
      .set(sessionData);
    
    console.log('✅ Impersonation session created');
    
    // Create audit log
    console.log('\n📋 Creating audit log...');
    try {
      await db.collection('admin').doc('auditLogs').collection('entries').add({
        action: 'impersonation_started',
        performedBy: adminEmail,
        targetUserId: targetUser.id,
        organizationId: targetData.organizationId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: {
          sessionId: sessionId,
          targetEmail: targetUserEmail,
          reason: reason
        }
      });
      console.log('✅ Audit log created');
    } catch (auditError) {
      console.error('⚠️  Warning: Failed to create audit log');
      console.error(auditError.message);
    }
    
    console.log('\n✅ SUCCESS: Impersonation session started');
    console.log(`   Session ID: ${sessionId}`);
    console.log(`   Admin: ${adminEmail}`);
    console.log(`   Target: ${targetUserEmail}`);
    console.log(`   Organization: ${targetData.organizationId}`);
    console.log(`   Reason: ${reason}`);
    console.log('\n📎 Login URL:');
    console.log(`   https://app.salesvelocity.ai/workspace/${targetData.organizationId}/dashboard?impersonate=${sessionId}`);
    console.log('\n⚠️  IMPORTANT:');
    console.log('   - All actions performed will be visible in audit logs');
    console.log('   - Session will remain active until explicitly ended');
    console.log(`   - To end session, run: node scripts/end-impersonation.js ${sessionId}`);
    
  } catch (error) {
    console.error('\n❌ Error creating impersonation session:', error);
    process.exit(1);
  }
}

// Main execution
const adminEmail = process.argv[2];
const targetEmail = process.argv[3];
const reason = process.argv[4];

if (!adminEmail || !targetEmail) {
  console.error('❌ Error: Missing required arguments');
  console.log('\nUsage: node scripts/impersonate-user.js <adminEmail> <targetUserEmail> <reason>');
  console.log('Example: node scripts/impersonate-user.js admin@example.com customer@acme.com "Debugging workflow issue"');
  console.log('\nArguments:');
  console.log('  adminEmail       Email of admin performing impersonation (must be admin)');
  console.log('  targetUserEmail  Email of user to impersonate');
  console.log('  reason           Reason for impersonation (required for audit trail)');
  console.log('\nSecurity:');
  console.log('  - Only admin users can impersonate');
  console.log('  - All impersonation sessions are logged and audited');
  console.log('  - Sessions remain active until explicitly ended');
  process.exit(1);
}

if (!reason) {
  console.error('❌ Error: Reason is required');
  console.log('You must provide a reason for impersonation (for audit trail)');
  console.log('Example: "Debugging workflow issue", "Customer support request #1234"');
  process.exit(1);
}

// Confirm action
console.log('⚠️  USER IMPERSONATION');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`Admin: ${adminEmail}`);
console.log(`Target: ${targetEmail}`);
console.log(`Reason: ${reason}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('\n⚠️  WARNING: You will have full access to the target user\'s account and data.');
console.log('All actions will be logged and audited.');
console.log('Proceeding in 3 seconds... (Press Ctrl+C to cancel)');

setTimeout(() => {
  impersonateUser(adminEmail, targetEmail, reason)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}, 3000);
