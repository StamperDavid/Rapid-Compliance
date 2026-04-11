require('dotenv').config({ path: '.env.local' });
const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  const email = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!email || !key) { console.error('Firebase admin env vars not set'); process.exit(1); }
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: 'rapid-compliance-65f87',
      clientEmail: email,
      privateKey: key.replace(/\\n/g, '\n'),
    }),
  });
}
const db = admin.firestore();
db.collection('organizations/rapid-compliance-root/video_pipeline_projects')
  .orderBy('createdAt', 'desc')
  .limit(5)
  .get()
  .then(snap => {
    if (snap.empty) { console.log('NO VIDEO PROJECTS FOUND - tool was NOT called'); return; }
    console.log(`Found ${snap.size} video project(s):`);
    snap.forEach(doc => {
      const d = doc.data();
      console.log(JSON.stringify({
        id: doc.id,
        name: d.name,
        status: d.status,
        step: d.currentStep,
        createdBy: d.createdBy,
        sceneCount: d.scenes ? d.scenes.length : 0,
        generatedScenes: d.generatedScenes ? d.generatedScenes.length : 0,
      }, null, 2));
    });
  })
  .catch(e => console.error('Error:', e.message));
