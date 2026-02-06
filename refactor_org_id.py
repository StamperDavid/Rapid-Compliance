#!/usr/bin/env python3
"""
Refactor script to eliminate intermediate orgId/organizationId variables in API routes.
Replaces `const orgId = DEFAULT_ORG_ID` and `const organizationId = DEFAULT_ORG_ID`
with direct usage of DEFAULT_ORG_ID throughout the file.
"""

import os
import re
from pathlib import Path

def refactor_file(file_path):
    """Refactor a single file to remove intermediate org ID variables."""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    original_content = content
    modified = False

    # Pattern 1: Remove `const organizationId = DEFAULT_ORG_ID;`
    if re.search(r'^\s*const organizationId = DEFAULT_ORG_ID;?\s*$', content, re.MULTILINE):
        content = re.sub(r'^\s*const organizationId = DEFAULT_ORG_ID;?\s*\n', '', content, flags=re.MULTILINE)
        # Replace usages of organizationId with DEFAULT_ORG_ID
        # Object property with same value: orgId: organizationId
        content = re.sub(r'\borgId:\s*organizationId\b', 'orgId: DEFAULT_ORG_ID', content)
        # Object property with same name: organizationId: organizationId
        content = re.sub(r'\borganizationId:\s*organizationId\b', 'organizationId: DEFAULT_ORG_ID', content)
        # Object shorthand: { organizationId } or { organizationId, ... }
        content = re.sub(r'\{\s*organizationId\s*,', '{ organizationId: DEFAULT_ORG_ID,', content)
        content = re.sub(r'\{\s*organizationId\s*\}', '{ organizationId: DEFAULT_ORG_ID }', content)
        content = re.sub(r',\s*organizationId\s*\}', ', organizationId: DEFAULT_ORG_ID }', content)
        # Replace standalone references (not after a dot, not before a colon)
        content = re.sub(r'(?<!\.)(?<!\w)\borganizationId\b(?!\s*:)(?!:)', 'DEFAULT_ORG_ID', content)
        modified = True

    # Pattern 2: Remove `const orgId = DEFAULT_ORG_ID;`
    if re.search(r'^\s*const orgId = DEFAULT_ORG_ID;?\s*$', content, re.MULTILINE):
        content = re.sub(r'^\s*const orgId = DEFAULT_ORG_ID;?\s*\n', '', content, flags=re.MULTILINE)
        # Replace usages of orgId with DEFAULT_ORG_ID
        # Object properties: orgId: orgId
        content = re.sub(r'\borgId:\s*orgId\b', 'orgId: DEFAULT_ORG_ID', content)
        # Object shorthand
        content = re.sub(r'\{\s*orgId\s*,', '{ orgId: DEFAULT_ORG_ID,', content)
        content = re.sub(r'\{\s*orgId\s*\}', '{ orgId: DEFAULT_ORG_ID }', content)
        content = re.sub(r',\s*orgId\s*\}', ', orgId: DEFAULT_ORG_ID }', content)
        # Replace standalone references (not after a dot, not before a colon)
        content = re.sub(r'(?<!\.)(?<!\w)\borgId\b(?!\s*:)(?!:)', 'DEFAULT_ORG_ID', content)
        modified = True

    if modified and content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

def main():
    """Main function to process all API route files."""
    api_dir = Path('src/app/api')

    if not api_dir.exists():
        print(f"Error: {api_dir} not found")
        return

    files_modified = 0

    # Find all TypeScript files in src/app/api
    for ts_file in api_dir.rglob('*.ts'):
        if refactor_file(ts_file):
            print(f"[OK] Refactored: {ts_file}")
            files_modified += 1

    print(f"\nTotal files modified: {files_modified}")

if __name__ == '__main__':
    main()
