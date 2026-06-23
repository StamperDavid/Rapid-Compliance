import { redirect } from 'next/navigation';

/**
 * The classic storyboard editor (System A) was retired in the video-path consolidation
 * (Phase 2, Jun 22 2026). All video creation now goes through the single script-first
 * front door at /content/video/projects. This route is kept ONLY as a redirect so old
 * links/bookmarks — and the Content Calendar's `?brief=` hand-off — land in the right
 * place. See the video-path consolidation note in CONTINUATION_PROMPT.md.
 *
 * (The shared clip editor at /content/video/editor is unrelated and unaffected.)
 */
export default async function LegacyVideoRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<never> {
  const params = await searchParams;
  const brief = typeof params.brief === 'string' ? params.brief : undefined;
  const title = typeof params.title === 'string' ? params.title : undefined;

  // A brief hand-off (e.g. the Content Calendar) goes straight into the script front
  // door with the brief pre-filled; everything else lands on the projects home.
  if (brief) {
    const qs = new URLSearchParams({ brief });
    if (title) {
      qs.set('title', title);
    }
    redirect(`/content/video/projects/new?${qs.toString()}`);
  }
  redirect('/content/video/projects');
}
