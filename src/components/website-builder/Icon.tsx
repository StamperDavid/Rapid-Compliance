/**
 * Icon
 * -----------------------------------------------------------------------------
 * Renders a single lucide icon by its PascalCase name (e.g. `Heart`, `Users`,
 * `Accessibility`). Used by the icon picker in the editor and, once wired in, by
 * the live page renderer.
 *
 * Render mechanism: lucide's `DynamicIcon` (`lucide-react/dynamic`). It looks the
 * icon up in a registry of lazy `() => import()` thunks and loads only the one
 * requested icon on demand — so we never eager-bundle all ~1900 lucide glyphs.
 *
 * Backward compatibility: older content stored a literal emoji/text string in
 * `data.icon` (the legacy icon-box rendered it directly). If `name` isn't a known
 * lucide icon, we render it as plain text instead of returning null, so existing
 * content never silently disappears.
 */

'use client';

import { DynamicIcon, type IconName } from 'lucide-react/dynamic';
import { pascalToKebab } from '@/lib/website-builder/icon-catalog';

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
