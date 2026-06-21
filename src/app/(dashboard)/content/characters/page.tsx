import { redirect } from 'next/navigation';

/** Characters now live as a section inside the unified Library. */
export default function CharactersRedirectPage() {
  redirect('/content/library/characters');
}
