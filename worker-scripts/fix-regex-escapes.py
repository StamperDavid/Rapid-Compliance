#!/usr/bin/env python3
"""Fix unnecessary regex escapes in conversation-engine.ts line 631"""

filepath = 'src/lib/conversation/conversation-engine.ts'

with open(filepath, 'r') as f:
    lines = f.readlines()

# Line 631 (index 630): Fix unnecessary escapes in character class
# OLD: /^[\[\(]?([^:\]\)]+)[\]\)]?\s*[:\-]\s*(.+)$/
# NEW: /^[[()]?([^:\])]+ )[\])]?\s*[:-]\s*(.+)$/
if len(lines) > 630:
    old_line = lines[630]
    if r'[\[\(]' in old_line:
        new_line = old_line.replace(
            r'/^[\[\(]?([^:\]\)]+)[\]\)]?\s*[:\-]\s*(.+)$/',
            r'/^[[()]?([^:\])]+ )[\])]?\s*[:-]\s*(.+)$/'
        )
        lines[630] = new_line
        print(f"✓ Fixed line 631: removed 5 unnecessary escapes")

with open(filepath, 'w') as f:
    f.writelines(lines)

print("✅ Regex escape fix complete")
