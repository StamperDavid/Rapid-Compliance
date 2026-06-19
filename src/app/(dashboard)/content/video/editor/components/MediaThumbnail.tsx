'use client';

/**
 * MediaThumbnail
 * Renders a real preview image for a media tile when a `thumbnailUrl` exists,
 * falling back to a type-appropriate icon (film / image / music) on a tinted
 * placeholder. Shared by the editor media bin's Library, Projects, and Upload
 * surfaces so every clip/scene tile looks the same.
 */

import Image from 'next/image';
import { Film, Image as ImageIcon, Music } from 'lucide-react';

type ThumbnailMediaType = 'video' | 'image' | 'audio';

const ICON_MAP: Record<ThumbnailMediaType, React.ElementType> = {
  video: Film,
  image: ImageIcon,
  audio: Music,
};

const TINT_MAP: Record<ThumbnailMediaType, string> = {
  video: 'bg-primary/10 text-primary-light',
  image: 'bg-info/10 text-info-light',
  audio: 'bg-primary/10 text-primary-light',
};

export function MediaThumbnail({
  type,
  thumbnailUrl,
  alt,
  className = 'w-full aspect-video',
}: {
  type: ThumbnailMediaType;
  thumbnailUrl?: string | null;
  alt: string;
  /** Tailwind classes controlling the outer size/aspect. */
  className?: string;
}) {
  const Icon = ICON_MAP[type] ?? Film;
  const tint = TINT_MAP[type] ?? 'bg-surface-elevated text-muted-foreground';

  return (
    <div
      className={`relative overflow-hidden rounded-md flex items-center justify-center flex-shrink-0 ${tint} ${className}`}
    >
      {thumbnailUrl ? (
        <Image
          src={thumbnailUrl}
          alt={alt}
          fill
          unoptimized
          sizes="240px"
          className="object-cover"
        />
      ) : (
        <Icon className="w-1/3 h-1/3 max-w-7 max-h-7 opacity-80" />
      )}
    </div>
  );
}
