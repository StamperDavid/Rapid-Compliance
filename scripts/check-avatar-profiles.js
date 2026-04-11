const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function main() {
  console.log('Querying organizations/rapid-compliance-root/avatar_profiles where userId == "system"...\n');

  const snapshot = await db
    .collection('organizations/rapid-compliance-root/avatar_profiles')
    .where('userId', '==', 'system')
    .get();

  console.log(`Found ${snapshot.size} document(s).\n`);

  if (snapshot.empty) {
    console.log('No documents matched the query.');
  } else {
    snapshot.forEach((doc) => {
      console.log(`--- Document ID: ${doc.id} ---`);
      console.log(JSON.stringify(doc.data(), null, 2));
      console.log('');
    });
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
