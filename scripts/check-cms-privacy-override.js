/**
 * One-off: check whether platform/website-editor-config in Firestore has
 * a `pages[]` entry for `privacy` and/or `terms`. If yes, usePageContent
 * will override the in-code FallbackContent — which means the new SMS
 * section the Twilio TFV submission depends on won't render.
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id,
});

const db = admin.firestore();

async function main() {
  console.log(`Project: ${serviceAccount.project_id}`);
  console.log('Reading platform/website-editor-config ...\n');

  const docRef = db.collection('platform').doc('website-editor-config');
  const snap = await docRef.get();

  if (!snap.exists) {
    console.log('✅ Doc does NOT exist. Fallback content will render. No CMS override risk.');
    return;
  }

  const data = snap.data() || {};
  const pages = Array.isArray(data.pages) ? data.pages : [];
  console.log(`Doc exists. pages[] length: ${pages.length}`);

  const targets = ['privacy', 'terms', 'sms-opt-in'];
  for (const id of targets) {
    const found = pages.find(p => p && p.id === id);
    if (!found) {
      console.log(`  ✅ No CMS override for /${id} — code fallback will render`);
      continue;
    }
    const sectionCount = Array.isArray(found.sections) ? found.sections.length : 0;
    console.log(`  ⚠️  CMS OVERRIDE for /${id} — id=${found.id} sections=${sectionCount}`);
    if (sectionCount > 0) {
      console.log(`     This means the in-code fallback at src/app/(public)/${id}/page.tsx will NOT render.`);
      console.log(`     The Twilio reviewer will see whatever was authored in the website editor.`);
    } else {
      console.log(`     But sections is empty, so PageRenderer returns null and the fallback renders.`);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
