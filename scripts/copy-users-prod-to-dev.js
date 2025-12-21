/**
 * Copy Authentication Users from Production to Development
 * This will copy all users from prod Firebase to dev Firebase
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Production Firebase
const prodServiceAccount = require(path.join(__dirname, '..', 'serviceAccountKey-prod.json'));
const prodApp = admin.initializeApp({
  credential: admin.credential.cert(prodServiceAccount),
}, 'prod');
const prodAuth = prodApp.auth();

// Initialize Dev Firebase
const devServiceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
const devApp = admin.initializeApp({
  credential: admin.credential.cert(devServiceAccount),
}, 'dev');
const devAuth = devApp.auth();

async function copyUsers() {
  console.log('🔄 Starting user migration from PRODUCTION to DEV...\n');
  
  let usersCount = 0;
  let skippedCount = 0;
  let nextPageToken;
  
  try {
    do {
      // List users from production
      const listUsersResult = await prodAuth.listUsers(1000, nextPageToken);
      
      console.log(`📥 Fetched ${listUsersResult.users.length} users from production...`);
      
      // Prepare users for batch import
      const usersToImport = [];
      
      for (const user of listUsersResult.users) {
        try {
          // Check if user already exists in dev
          try {
            await devAuth.getUser(user.uid);
            console.log(`⏭️  User already exists: ${user.email || user.uid}`);
            skippedCount++;
            continue;
          } catch (error) {
            // User doesn't exist, proceed to import
          }
          
          // Prepare user record for import
          const userImportRecord = {
            uid: user.uid,
            email: user.email,
            emailVerified: user.emailVerified,
            displayName: user.displayName,
            photoURL: user.photoURL,
            phoneNumber: user.phoneNumber,
            disabled: user.disabled,
            metadata: {
              creationTime: user.metadata.creationTime,
              lastSignInTime: user.metadata.lastSignInTime,
            },
          };
          
          // Add password hash if available (this preserves passwords!)
          if (user.passwordHash && user.passwordSalt) {
            userImportRecord.passwordHash = Buffer.from(user.passwordHash);
            userImportRecord.passwordSalt = Buffer.from(user.passwordSalt);
          }
          
          // Add provider data (Google, etc.)
          if (user.providerData && user.providerData.length > 0) {
            userImportRecord.providerData = user.providerData;
          }
          
          // Add custom claims
          if (user.customClaims && Object.keys(user.customClaims).length > 0) {
            userImportRecord.customClaims = user.customClaims;
          }
          
          usersToImport.push(userImportRecord);
          
        } catch (error) {
          console.error(`❌ Failed to prepare user ${user.email || user.uid}:`, error.message);
        }
      }
      
      // Batch import users to dev (this properly handles password hashes)
      if (usersToImport.length > 0) {
        try {
          const importResult = await devAuth.importUsers(usersToImport, {
            hash: {
              algorithm: 'SCRYPT',
              key: Buffer.from(prodServiceAccount.private_key),
              saltSeparator: Buffer.from(''),
              rounds: 8,
              memoryCost: 14,
            }
          });
          
          console.log(`✅ Successfully imported ${importResult.successCount} users`);
          if (importResult.failureCount > 0) {
            console.log(`⚠️  Failed to import ${importResult.failureCount} users`);
            importResult.errors.forEach((indexedError) => {
              console.log(`   Error importing user ${usersToImport[indexedError.index].email}:`, indexedError.error.message);
            });
          }
          usersCount += importResult.successCount;
        } catch (error) {
          console.error(`❌ Batch import failed:`, error.message);
          // Fallback: try creating users without passwords
          console.log('⚠️  Falling back to creating users without passwords...');
          for (const userRecord of usersToImport) {
            try {
              // Remove password hash fields for basic creation
              const basicRecord = { ...userRecord };
              delete basicRecord.passwordHash;
              delete basicRecord.passwordSalt;
              
              await devAuth.createUser(basicRecord);
              console.log(`✅ Created user (no password): ${basicRecord.email || basicRecord.uid}`);
              usersCount++;
            } catch (err) {
              console.error(`❌ Failed to create user ${userRecord.email}:`, err.message);
            }
          }
        }
      }
      
      nextPageToken = listUsersResult.pageToken;
      
    } while (nextPageToken);
    
    console.log(`\n${'='.repeat(50)}`);
    console.log('🎉 Migration Complete!');
    console.log(`${'='.repeat(50)}`);
    console.log(`✅ Successfully copied: ${usersCount} users`);
    console.log(`⏭️  Skipped (already exist): ${skippedCount} users`);
    console.log(`\n⚠️  Important Notes:`);
    console.log('   - User passwords have been preserved where possible');
    console.log('   - Users can log in with their existing passwords');
    console.log('   - Custom claims and provider data have been copied');
    console.log('   - If password import failed, users will need to reset passwords');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

copyUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });



