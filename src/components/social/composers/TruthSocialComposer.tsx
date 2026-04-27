'use client';

/**
 * TruthSocialComposer — PARKED.
 *
 * Cloudflare TLS-fingerprint blocking prevents server-side posts. Renders a
 * disabled notice card only — no form fields.
 */

import * as React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { PlatformComposerFormProps } from './PlatformComposer';

export function TruthSocialComposer(_props: PlatformComposerFormProps): React.ReactElement {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-destructive" />
      <div className="text-lg font-bold text-foreground">Posting Parked</div>
      <p className="text-sm text-foreground mt-2 max-w-md mx-auto">
        Cloudflare TLS-fingerprint wall blocks server-side posts. No path forward
        without browser-class infra.
      </p>
      <p className="text-xs text-muted-foreground mt-3">Code preserved for future.</p>
    </div>
  );
}

export default TruthSocialComposer;
