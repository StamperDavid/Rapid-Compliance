const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
if (admin.apps.length === 0) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function test() {
  // Find all real users
  const listResult = await admin.auth().listUsers(50);
  console.log('Firebase Auth users (non-agent/test):');
  for (const u of listResult.users) {
    const isAgent = u.email && u.email.includes('agent');
    const isE2e = u.email && u.email.includes('e2e');
    if (!isAgent && !isE2e) {
      console.log('  UID:', u.uid, '| email:', u.email);

      // Check if this user has avatar profiles
      const snap = await db.collection('organizations/rapid-compliance-root/avatar_profiles')
        .where('userId', '==', u.uid)
        .get();
      if (snap.size > 0) {
        console.log('    -> Has', snap.size, 'avatar profile(s)');
        snap.docs.forEach(d => console.log('       -', d.id, ':', d.data().name));
      }
    }
  }
}

test().catch(console.error);
