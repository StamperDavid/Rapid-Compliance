'use client';

import { useMemo } from 'react';
import DOMPurify, { type Config } from 'dompurify';

type SanitizePreset = 'strict' | 'email' | 'rich-text';

const PRESET_CONFIGS: Record<SanitizePreset, Config> = {
  strict: {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br', 'span'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style'],
  },
  email: {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'div', 'span',
      'b', 'i', 'em', 'strong', 'u', 'a',
      'ul', 'ol', 'li',
      'img', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
      'blockquote', 'pre', 'code',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'width', 'height',
      'style', 'class', 'colspan', 'rowspan', 'align', 'valign',
      'border', 'cellpadding', 'cellspacing',
    ],
  },
  'rich-text': {
    ALLOWED_TAGS: [
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
      'p', 'br', 'hr', 'div', 'span', 'section', 'article',
      'header', 'footer', 'nav', 'main',
      'b', 'i', 'em', 'strong', 'u', 'a', 'sub', 'sup', 'mark',
      'ul', 'ol', 'li',
      'img', 'figure', 'figcaption', 'video', 'audio', 'source',
      'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
      'caption', 'colgroup', 'col',
      'blockquote', 'pre', 'code',
      'details', 'summary',
    ],
    ALLOWED_ATTR: [
      'href', 'target', 'rel', 'src', 'alt', 'width', 'height',
      'style', 'class', 'id', 'colspan', 'rowspan', 'align', 'valign',
      'border', 'cellpadding', 'cellspacing', 'title', 'loading',
      'type', 'controls', 'autoplay', 'loop', 'muted', 'poster',
    ],
  },
};

interface SafeHtmlProps {
  html: string;
  preset?: SanitizePreset;
  className?: string;
  style?: React.CSSProperties;
}

export default function SafeHtml({ html, preset = 'strict', className, style }: SafeHtmlProps) {
  const sanitizedHtml = useMemo(
    () => {
      const config: Config = PRESET_CONFIGS[preset];
      return DOMPurify.sanitize(html, config);
    },
    [html, preset]
  );

  return (
    <div
      className={className}
      style={style}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
}
