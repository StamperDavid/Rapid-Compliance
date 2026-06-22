/**
 * VERIFICATION (one-off, real Firestore): the media-library FOLDER system end to end.
 *
 * Proves: nested folder create (Brand ▸ Campaign ▸ Sub-campaign), filing an asset into
 * a folder, listing by folder + Unfiled, moving to Unfiled, project auto-file
 * (getOrCreateProjectFolder idempotent + auto-file on createAsset), the move-cycle
 * guard, and delete-reparent (a deleted folder's children move up to its parent).
 * Cleans up everything it creates.
 *
 * Run: npx tsx scripts/verify-media-folders.ts
 */

/* eslint-disable no-console */

import {
  createFolder,
  getFolder,
  updateFolder,
  deleteFolder,
  getOrCreateProjectFolder,
} from '../src/lib/media/media-folders-service';
import {
  createAsset,
  getAsset,
  deleteAsset,
  setAssetFolder,
  listAssets,
} from '../src/lib/media/media-library-service';

let passed = 0;
function assert(cond: boolean, msg: string): void {
  if (!cond) {
    throw new Error(`ASSERT FAILED: ${msg}`);
  }
  passed += 1;
  console.log(`  ok: ${msg}`);
}

async function main(): Promise<void> {
  console.log('=== MEDIA FOLDERS — real-path verification ===\n');
  const created: { folders: string[]; assets: string[] } = { folders: [], assets: [] };

  try {
    // 1. Nested folders: Geico ▸ Gecko ▸ Gecko on Motorcycle
    console.log('STEP 1 — nested folder create…');
    const brand = await createFolder({ name: 'Geico (verify)', createdBy: 'verify' });
    const campaign = await createFolder({ name: 'Gecko', parentFolderId: brand.id, createdBy: 'verify' });
    const sub = await createFolder({ name: 'Gecko on Motorcycle', parentFolderId: campaign.id, createdBy: 'verify' });
    created.folders.push(brand.id, campaign.id, sub.id);
    assert(brand.parentFolderId === null, 'brand is a root folder');
    assert(campaign.parentFolderId === brand.id, 'campaign nests under brand');
    assert(sub.parentFolderId === campaign.id, 'sub-campaign nests under campaign');

    // 2. File an asset into the sub-campaign folder
    console.log('\nSTEP 2 — file an asset into a folder…');
    const asset = await createAsset({
      type: 'image',
      category: 'photo',
      name: 'verify folder asset',
      url: 'https://example.com/verify-folder-asset.png',
      mimeType: 'image/png',
      fileSize: 1234,
      source: 'imported',
      createdBy: 'verify',
    });
    created.assets.push(asset.id);
    assert(!asset.folderId, 'new asset starts Unfiled');
    await setAssetFolder(asset.id, sub.id);
    const inFolder = await listAssets({ folderId: sub.id });
    assert(inFolder.assets.some((a) => a.id === asset.id), 'asset shows in its folder via listAssets(folderId)');

    // 3. Move to Unfiled (clears the field)
    console.log('\nSTEP 3 — move to Unfiled…');
    await setAssetFolder(asset.id, null);
    const refetched = await getAsset(asset.id);
    assert(!refetched?.folderId, 'asset folderId cleared after move to Unfiled');
    const stillInFolder = await listAssets({ folderId: sub.id });
    assert(!stillInFolder.assets.some((a) => a.id === asset.id), 'asset no longer in the folder');
    const unfiled = await listAssets({ unfiledOnly: true });
    assert(unfiled.assets.some((a) => a.id === asset.id), 'asset shows under Unfiled');

    // 4. Project auto-file: getOrCreateProjectFolder idempotent + createAsset auto-files
    console.log('\nSTEP 4 — project auto-file…');
    const projId = `verify-proj-${asset.id.slice(0, 8)}`;
    const f1 = await getOrCreateProjectFolder(projId, 'Verify Project');
    const f2 = await getOrCreateProjectFolder(projId, 'Verify Project');
    created.folders.push(f1);
    assert(f1 === f2, 'getOrCreateProjectFolder is idempotent (same id for same project)');
    const projAsset = await createAsset({
      type: 'image',
      category: 'photo',
      name: 'verify auto-file asset',
      url: 'https://example.com/verify-autofile.png',
      mimeType: 'image/png',
      fileSize: 999,
      source: 'ai-generated',
      createdBy: 'verify',
      projectId: projId,
      projectName: 'Verify Project',
    });
    created.assets.push(projAsset.id);
    assert(projAsset.folderId === f1, 'asset with a projectId auto-files into the project folder');

    // 5. Cycle guard: cannot move a folder under its own descendant
    console.log('\nSTEP 5 — move cycle guard…');
    let threw = false;
    try {
      await updateFolder(brand.id, { parentFolderId: sub.id });
    } catch {
      threw = true;
    }
    assert(threw, 'moving a folder into its own subfolder is rejected');

    // 6. Delete-reparent: delete the middle folder; its child moves up to the brand
    console.log('\nSTEP 6 — delete-reparent…');
    await deleteFolder(campaign.id);
    created.folders = created.folders.filter((id) => id !== campaign.id);
    const orphanCheck = await getFolder(sub.id);
    assert(orphanCheck?.parentFolderId === brand.id, "deleted folder's child reparented to the grandparent");
    assert((await getFolder(campaign.id)) === null, 'deleted folder is gone');

    console.log(`\n=== RESULT === ${passed} assertions passed.`);
  } finally {
    // Cleanup — best-effort.
    console.log('\nCleaning up test data…');
    for (const id of created.assets) {
      await deleteAsset(id).catch(() => null);
    }
    for (const id of created.folders) {
      await deleteFolder(id).catch(() => null);
    }
    console.log('  cleanup done.');
  }
}

main()
  .then(() => {
    console.log('\nMEDIA FOLDERS VERIFY OK — all green on real Firestore.');
    process.exit(0);
  })
  .catch((e: unknown) => {
    console.error('\nMEDIA FOLDERS VERIFY FAILED');
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
