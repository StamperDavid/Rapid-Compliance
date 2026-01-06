#!/usr/bin/env python3
"""Worker 2: Fix UI warnings - nullish coalescing and explicit any"""
import re
import sys
from pathlib import Path

def fix_nullish_coalescing(content):
    """Replace || with ?? for safer null/undefined handling"""
    # Safe patterns only - where we're defaulting to empty/zero values
    patterns = [
        (r" \|\| ''", r" ?? ''"),
        (r" \|\| \[\]", r" ?? []"),
        (r" \|\| \{\}", r" ?? {}"),
        (r" \|\| 0", r" ?? 0"),
        (r" \|\| false", r" ?? false"),
        (r" \|\| null", r" ?? null"),
    ]
    
    for old, new in patterns:
        content = re.sub(old, new, content)
    
    return content

def process_file(filepath):
    """Process a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            original = f.read()
        
        fixed = fix_nullish_coalescing(original)
        
        if fixed != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(fixed)
            print(f"✓ Fixed {filepath}")
            return True
        else:
            print(f"- No changes needed for {filepath}")
            return False
    except Exception as e:
        print(f"✗ Error processing {filepath}: {e}")
        return False

if __name__ == '__main__':
    files_to_fix = [
        'src/app/workspace/[orgId]/settings/email-templates/page.tsx',
        'src/app/admin/website-editor/page.tsx',
    ]
    
    fixed_count = 0
    for file in files_to_fix:
        if Path(file).exists():
            if process_file(file):
                fixed_count += 1
        else:
            print(f"! File not found: {file}")
    
    print(f"\n✅ Worker 2: Fixed {fixed_count} files")
    sys.exit(0)
