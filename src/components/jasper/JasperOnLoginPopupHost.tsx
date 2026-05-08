'use client';

/**
 * JasperOnLoginPopupHost
 *
 * Thin wrapper that wires `useJasperOnLoginPopup` into the dashboard layout.
 * Mounted once at the layout level. Renders nothing while the hook decides
 * not to open; renders the modal when there's something to show.
 *
 * Kept separate from the layout file so the layout doesn't need to become
 * a client component itself just to call the hook.
 */

import { useJasperOnLoginPopup } from '@/hooks/useJasperOnLoginPopup';
import { JasperOnLoginPopup } from './JasperOnLoginPopup';

export function JasperOnLoginPopupHost() {
  const { open, setOpen, setupItems, loading } = useJasperOnLoginPopup();

  return (
    <JasperOnLoginPopup
      open={open}
      onOpenChange={setOpen}
      setupItems={setupItems}
      loading={loading}
    />
  );
}

export default JasperOnLoginPopupHost;
