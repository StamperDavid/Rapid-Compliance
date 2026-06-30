/**
 * Icon
 * -----------------------------------------------------------------------------
 * Renders a single lucide icon by its PascalCase name (e.g. `Heart`, `Users`,
 * `Accessibility`). Used by the icon picker in the editor and, once wired in, by
 * the live page renderer.
 *
 * Render mechanism:
 *  - lucide: `DynamicIcon` (`lucide-react/dynamic`) looks the icon up in a
 *    registry of lazy `() => import()` thunks and loads only the requested icon
 *    on demand — so we never eager-bundle all ~1900 lucide glyphs.
 *  - brands (`si:<slug>`): the ~3,400-strong simple-icons set. The svg path data
 *    is sharded by first letter under `brand-icon-paths/` and pulled in ONLY via
 *    lazy `import()` (one small shard per first-letter, cached). Nothing brand
 *    related lands in the live page bundle until a brand icon actually renders —
 *    the only statically-imported brand module is the tiny `loaders` thunk map.
 *
 * Backward compatibility: older content stored a literal emoji/text string in
 * `data.icon` (the legacy icon-box rendered it directly). If `name` isn't a known
 * lucide icon (and isn't a brand value), we render it as plain text instead of
 * returning null, so existing content never silently disappears.
 */

'use client';

import { useEffect, useState } from 'react';
import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { brandSlug, isBrandIcon, pascalToKebab } from '@/lib/website-builder/icon-catalog';
import {
  BRAND_SHARD_LOADERS,
  brandShardKey,
} from '@/lib/website-builder/brand-icon-paths/loaders';

// --- Brand path lazy loading ------------------------------------------------
// Module-level caches shared across every <Icon> instance. The path cache is
// empty during SSR + first client paint (so hydration matches: both render the
// loading placeholder), then fills in after the shard's dynamic import resolves.

/** slug → svg path string. `''` means "loaded, but no such brand". */
const brandPathCache = new Map<string, string>();
/** shard key → in-flight/settled load promise, so each shard loads at most once. */
const shardLoadCache = new Map<string, Promise<void>>();

function loadBrandShard(shardKey: string): Promise<void> {
  const existing = shardLoadCache.get(shardKey);
  if (existing) {
    return existing;
  }
  const loader = BRAND_SHARD_LOADERS[shardKey];
  const promise = loader
    ? loader().then((mod) => {
        for (const [slug, path] of Object.entries(mod.BRAND_PATHS)) {
          if (!brandPathCache.has(slug)) {
            brandPathCache.set(slug, path);
          }
        }
      })
    : Promise.resolve();
  shardLoadCache.set(shardKey, promise);
  return promise;
}

interface BrandIconProps {
  slug: string;
  size: number;
  color?: string;
  className?: string;
}

/**
 * Renders one simple-icons brand logo, lazily resolving its svg path from the
 * matching first-letter shard. Brand glyphs are solid (fill-based), so `color`
 * maps to `fill` and defaults to `currentColor` (the brand's official hex is
 * available in the picker metadata but intentionally not bundled here to keep
 * the published `<Icon>` lean).
 */
function BrandIcon({ slug, size, color, className }: BrandIconProps): React.JSX.Element {
  const [path, setPath] = useState<string | undefined>(() => brandPathCache.get(slug));

  useEffect(() => {
    let active = true;
    const cached = brandPathCache.get(slug);
    if (cached !== undefined) {
      setPath(cached);
      return;
    }
    void loadBrandShard(brandShardKey(slug)).then(() => {
      if (active) {
        setPath(brandPathCache.get(slug) ?? '');
      }
    });
    return () => {
      active = false;
    };
  }, [slug]);

  // Still loading → reserve the square so layout doesn't jump.
  if (path === undefined) {
    return (
      <span
        className={className}
        style={{ display: 'inline-block', width: size, height: size }}
        aria-hidden="true"
      />
    );
  }

  // Loaded but unknown slug → legacy-style text fallback so nothing vanishes.
  if (path === '') {
    return (
      <span
        className={className}
        style={{ fontSize: size * 0.5, lineHeight: 1, display: 'inline-flex' }}
        aria-hidden="true"
      >
        {slug}
      </span>
    );
  }

  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={color ?? 'currentColor'}
      className={className}
      aria-label={slug}
    >
      <path d={path} />
    </svg>
  );
}

export interface IconProps {
  /** PascalCase lucide name (e.g. `Star`), or a legacy emoji/text string. */
  name: string;
  /** Pixel size of the square icon. Defaults to 24. */
  size?: number;
  /** Stroke colour. Defaults to `currentColor`. */
  color?: string;
  /** Stroke width. Defaults to lucide's 2. */
  strokeWidth?: number;
  className?: string;
}

export function Icon({
  name,
  size = 24,
  color,
  strokeWidth,
  className,
}: IconProps): React.JSX.Element | null {
  if (!name) {
    return null;
  }

  // Brand (simple-icons) value, e.g. `si:github` → lazily-loaded brand logo.
  if (isBrandIcon(name)) {
    const slug = brandSlug(name);
    if (slug) {
      return <BrandIcon slug={slug} size={size} color={color} className={className} />;
    }
  }

  const kebab = pascalToKebab(name);

  // Unknown name → treat as legacy emoji / literal text so content survives.
  if (!kebab) {
    return (
      <span
        className={className}
        style={{ fontSize: size, lineHeight: 1, display: 'inline-flex' }}
        aria-hidden="true"
      >
        {name}
      </span>
    );
  }

  return (
    <DynamicIcon
      // `kebab` is sourced from lucide's authoritative `iconNames`, so it is a
      // valid registry key — the cast just narrows `string` to the name union.
      name={kebab as IconName}
      size={size}
      color={color}
      strokeWidth={strokeWidth}
      className={className}
    />
  );
}

export default Icon;
