#!/usr/bin/env python3
"""
Refactor script v2 - more precise handling of orgId/organizationId removal.
Uses line-by-line analysis to avoid breaking template literals.
"""

import re
from pathlib import Path

def refactor_file(file_path):
    """Refactor a single file."""
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    modified = False
    has_org_id_const = False
    has_organization_id_const = False

    # First pass: identify which constants exist and remove them
    new_lines = []
    for line in lines:
        # Check for const assignments
        if re.match(r'^\s*const orgId = DEFAULT_ORG_ID;?\s*$', line):
            has_org_id_const = True
            modified = True
            continue  # Remove this line
        elif re.match(r'^\s*const organizationId = DEFAULT_ORG_ID;?\s*$', line):
            has_organization_id_const = True
            modified = True
            continue  # Remove this line
        new_lines.append(line)

    if not modified:
        return False

    # Second pass: replace usages
    content = ''.join(new_lines)

    if has_organization_id_const:
        # Replace organizationId with DEFAULT_ORG_ID
        # Template literals: ${organizationId}
        content = re.sub(r'\$\{organizationId\}', '${DEFAULT_ORG_ID}', content)

        # Object properties: organizationId: organizationId
        content = re.sub(r'\borganizationId:\s*organizationId\b', 'organizationId: DEFAULT_ORG_ID', content)

        # Object properties: orgId: organizationId
        content = re.sub(r'\borgId:\s*organizationId\b', 'orgId: DEFAULT_ORG_ID', content)

        # Standalone references (not in property names, not in template literals already handled)
        # This matches organizationId when it's not part of a property definition
        content = re.sub(r'(?<![${\w])\borganizationId\b(?!\s*:)', 'DEFAULT_ORG_ID', content)

    if has_org_id_const:
        # Replace orgId with DEFAULT_ORG_ID
        # Template literals: ${orgId}
        content = re.sub(r'\$\{orgId\}', '${DEFAULT_ORG_ID}', content)

        # Object properties: orgId: orgId
        content = re.sub(r'\borgId:\s*orgId\b', 'orgId: DEFAULT_ORG_ID', content)

        # Standalone references
        content = re.sub(r'(?<![${\w])\borgId\b(?!\s*:)', 'DEFAULT_ORG_ID', content)

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)

    return True

def main():
    """Process all API route files."""
    api_dir = Path('src/app/api')

    if not api_dir.exists():
        print(f"Error: {api_dir} not found")
        return

    files_modified = 0

    for ts_file in api_dir.rglob('*.ts'):
        if refactor_file(ts_file):
            print(f"[OK] {ts_file}")
            files_modified += 1

    print(f"\nTotal files modified: {files_modified}")

if __name__ == '__main__':
    main()
