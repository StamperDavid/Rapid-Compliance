import { redirect } from 'next/navigation';

/** The Media Library now lives as a section inside the unified Library. */
export default function MediaLibraryRedirectPage() {
  redirect('/content/library/media');
}
