import { redirect } from 'next/navigation';

/** /content/library → default to the Media section. */
export default function LibraryIndexPage() {
  redirect('/content/library/media');
}
