#!/usr/bin/env python3
"""Fix ResponsiveRenderer.tsx case block declarations"""
import re

filepath = 'src/components/website-builder/ResponsiveRenderer.tsx'

with open(filepath, 'r') as f:
    content = f.read()

# Fix case 'heading': block (lines 233-240)
content = content.replace(
    """    case 'heading':
      const level = widget.data.level || 1;
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      return (
        <HeadingTag style={style}>
          {String(widget.data.text || 'Heading')}
        </HeadingTag>
      );""",
    """    case 'heading': {
      const level = widget.data.level || 1;
      const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
      return (
        <HeadingTag style={style}>
          {String(widget.data.text || 'Heading')}
        </HeadingTag>
      );
    }"""
)

print(f"✓ Fixed {filepath}")

with open(filepath, 'w') as f:
    f.write(content)
