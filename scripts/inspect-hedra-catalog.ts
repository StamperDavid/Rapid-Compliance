/**
 * One-off: inspect the LIVE Hedra model catalog to confirm which generation
 * capabilities the API actually exposes — specifically input_video (video-to-video,
 * the chroma-clip character-placement path) and reference (image conditioning).
 * Run: npx tsx scripts/inspect-hedra-catalog.ts
 */
import {
  getHedraCatalog,
  modelInputRoles,
  maxReferenceImages,
} from '../src/lib/video/hedra-capability-service';

async function main(): Promise<void> {
  const catalog = await getHedraCatalog();
  const video = catalog.filter((m) => m.type === 'video');
  console.log(`Total models: ${catalog.length} | video: ${video.length} | image: ${catalog.length - video.length}`);

  const inputVideo = video.filter((m) => modelInputRoles(m).includes('input_video'));
  console.log(`\n=== VIDEO models with input_video (video-to-video) role: ${inputVideo.length} ===`);
  for (const m of inputVideo) {
    console.log(
      `- ${m.slug ?? m.id} | requires_input_video=${Boolean(m.requires_input_video)} | roles=[${modelInputRoles(m).join(', ')}] | tags=[${(m.tags ?? []).join(', ')}]`,
    );
  }

  const ref = video.filter((m) => modelInputRoles(m).includes('reference'));
  console.log(`\n=== VIDEO models with reference (image) role: ${ref.length} ===`);
  for (const m of ref.slice(0, 20)) {
    console.log(`- ${m.slug ?? m.id} | maxRef=${maxReferenceImages(m)} | roles=[${modelInputRoles(m).join(', ')}]`);
  }

  // Distinct roles seen across all video models, to learn the real role vocabulary.
  const allRoles = new Set<string>();
  for (const m of video) {
    for (const r of modelInputRoles(m)) {
      allRoles.add(r);
    }
  }
  console.log(`\n=== Distinct input roles across video models ===\n${Array.from(allRoles).sort().join(', ')}`);

  // Hunt for the model the operator used in the web app (hedra_omnia) + any
  // character / omni / video-to-video model, and dump its FULL input modes/slots.
  const re = /omni|omnia|hedra|character|act|edit|v2v|video.?to.?video/i;
  const matches = catalog.filter((m) => re.test(`${m.slug ?? ''} ${m.id ?? ''} ${(m.tags ?? []).join(' ')}`));
  console.log(`\n=== Models matching omni/character/hedra/v2v: ${matches.length} ===`);
  for (const m of matches) {
    console.log(`\n• slug=${m.slug ?? '(none)'} id=${m.id} type=${m.type} tags=[${(m.tags ?? []).join(', ')}]`);
    console.log(`  inputs=${JSON.stringify(m.inputs ?? [], null, 0)}`);
  }
  // Also: is anything literally named omnia present anywhere?
  const omnia = catalog.filter((m) => /omnia/i.test(`${m.slug ?? ''}${m.id ?? ''} ${(m.tags ?? []).join(' ')}`));
  console.log(`\n=== Models with 'omnia' in slug/id/tags: ${omnia.length} ===`);
  for (const m of omnia) { console.log(`- ${m.slug ?? m.id} (${m.type})`); }

  // DEFINITIVE TEST of Gemini's claim: does ANY model (video OR image) set
  // requires_input_video === true, or expose an input_video slot role?
  const reqVid = catalog.filter((m) => m.requires_input_video === true);
  console.log(`\n=== Models with requires_input_video===true (ANY type): ${reqVid.length} ===`);
  for (const m of reqVid) { console.log(`- ${m.slug ?? m.id} (${m.type}) roles=[${modelInputRoles(m).join(', ')}]`); }
  const anyInputVideoRole = catalog.filter((m) => modelInputRoles(m).includes('input_video'));
  console.log(`Models (ANY type) exposing an input_video slot role: ${anyInputVideoRole.length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error('ERROR:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
