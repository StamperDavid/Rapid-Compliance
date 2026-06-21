import { redirect } from 'next/navigation';

/** Locations now live as a section inside the unified Library. */
export default function LocationsRedirectPage() {
  redirect('/content/library/locations');
}
