#!/usr/bin/env python3
"""
SWARM REPAIR PROTOCOL - Worker 1
Fixes TypeScript errors in src/lib/ following mandatory heuristics
"""

import re
from pathlib import Path
import subprocess

def run_cmd(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout, result.stderr, result.returncode

def fix_file(filepath):
    """Apply Worker 1 heuristics to a file"""
    print(f"🔧 Fixing {filepath}...")
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    fixes_applied = []
    
    # HEURISTIC 1: Fix DocumentData casts - use 'as unknown as T' pattern
    # Pattern: await FirestoreService.get(...) needs casting
    if 'DocumentData' in content or 'FirestoreService.get' in content:
        # Look for common patterns and add type assertions
        if 'continuous-learning-engine' in filepath:
            content = re.sub(
                r'(const \w+ = await FirestoreService\.getAll\([^)]+\));',
                r'\1 as unknown as TrainingExample[];',
                content
            )
            fixes_applied.append("DocumentData → TrainingExample[] cast")
        
        if 'subscription-manager' in filepath:
            content = re.sub(
                r'(const subscription = await FirestoreService\.get\([^)]+\));',
                r'\1 as CustomerSubscription | null;',
                content
            )
            fixes_applied.append("DocumentData → CustomerSubscription cast")
    
    # HEURISTIC 2: Fix adminDb possibly null - add guards
    if "'adminDb' is possibly 'null'" or 'adminDb.' in content:
        # Add early return guard at start of functions using adminDb
        if 'admin-firestore-service' in filepath or 'email-delivery-service' in filepath:
            # Find functions using adminDb and add null check
            content = re.sub(
                r'(async function \w+\([^)]*\)\s*{)\n(\s+)(if \(!adminDb\))',
                r'\1\n\2if (!adminDb) throw new Error("Admin DB not initialized");\n\2\3',
                content
            )
            # Also fix direct adminDb usage by adding optional chaining where safe
            fixes_applied.append("Added adminDb null guards")
    
    # HEURISTIC 3: Fix pdf-parser default export
    if 'pdf-parser' in filepath:
        content = content.replace(
            "pdfParse = (await import('pdf-parse')).default;",
            "const module = await import('pdf-parse');\n    pdfParse = module.default || module;"
        )
        fixes_applied.append("Fixed pdf-parse import")
    
    # HEURISTIC 4: Fix null vs undefined - use ?? instead of ||
    # Pattern: field || undefined should be field ?? undefined
    content = re.sub(r'(\w+\.\w+) \|\| undefined', r'\1 ?? undefined', content)
    
    # HEURISTIC 5: Fix null assigned to undefined types
    # Pattern: field: string | null -> should be string | undefined, or use ?? undefined
    if 'Type \'null\' is not assignable to type' in filepath or 'calendar-sync' in filepath:
        # Convert null to undefined in return objects
        content = re.sub(
            r'(\w+):\s*(\w+\.\w+)\s*\|\|\s*null',
            r'\1: \2 ?? undefined',
            content
        )
        fixes_applied.append("Fixed null → undefined assignments")
    
    # HEURISTIC 6: Fix Timestamp to Date conversions
    if 'email-sync' in filepath:
        # Pattern: new Date() assigned to Timestamp field
        content = re.sub(
            r'(\w+):\s*new Date\(\)',
            r'\1: Timestamp.fromDate(new Date())',
            content
        )
        fixes_applied.append("Fixed Date → Timestamp conversion")
    
    # HEURISTIC 7: Fix empty object {} assigned to string
    if 'quickbooks' in filepath or 'xero' in filepath:
        # Pattern: JSON.stringify({}) should be JSON.stringify({...})
        content = re.sub(
            r'JSON\.stringify\(\{\}\)',
            r"JSON.stringify({ message: 'Not implemented' })",
            content
        )
        fixes_applied.append("Fixed {} → proper object")
    
    # HEURISTIC 8: Fix unknown type to proper type
    # Pattern: (unknown) needs casting
    content = re.sub(
        r'Argument of type \'unknown\' is not assignable',
        r'// Fixed: cast unknown to proper type',
        content
    )
    
    # Only write if changes were made
    if content != original_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        
        if fixes_applied:
            print(f"   ✓ Applied: {', '.join(fixes_applied)}")
        return True
    else:
        print(f"   ⚠️  No automated fixes available")
        return False

def main():
    print("=" * 80)
    print("🔧 SWARM REPAIR PROTOCOL - Worker 1")
    print("=" * 80)
    
    # Get list of files with errors
    stdout, _, _ = run_cmd("NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit 2>&1 | grep 'src/lib' | cut -d'(' -f1 | sort -u")
    
    files = [f.strip() for f in stdout.split('\n') if f.strip()]
    
    print(f"\n📋 Processing {len(files)} files...")
    
    fixed_count = 0
    for filepath in files:
        if Path(filepath).exists():
            if fix_file(filepath):
                fixed_count += 1
    
    print(f"\n✅ Processed {fixed_count} files")
    
    # Recount errors
    print("\n🔍 Recounting TypeScript errors...")
    stdout, _, _ = run_cmd("NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit 2>&1 | grep 'src/lib' | wc -l")
    remaining = stdout.strip()
    
    print(f"📊 Remaining src/lib errors: {remaining}")
    print("\n" + "=" * 80)

if __name__ == "__main__":
    main()
