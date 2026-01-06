#!/usr/bin/env python3
"""
TypeScript Error Surgery - Systematic Type Error Fixes
Designed for Worker 1 (Build/Error Resolution)
"""

import subprocess
import re
from pathlib import Path

def run_cmd(cmd):
    """Run shell command and return output"""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout, result.stderr, result.returncode

def count_tsc_errors():
    """Count current TypeScript errors"""
    stdout, _, _ = run_cmd("NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit 2>&1 | wc -l")
    return int(stdout.strip())

def fix_pdf_parser():
    """Fix pdf-parser default export issue"""
    print("🔧 Fixing pdf-parser.ts...")
    file_path = "src/lib/agent/parsers/pdf-parser.ts"
    
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Replace the problematic line
    content = content.replace(
        "pdfParse = (await import('pdf-parse')).default;",
        "const module = await import('pdf-parse'); pdfParse = module.default || module;"
    )
    
    with open(file_path, 'w') as f:
        f.write(content)
    
    print(f"   ✓ Fixed {file_path}")

def fix_admin_db_null_checks():
    """Add null checks for adminDb"""
    print("🔧 Fixing adminDb null checks...")
    files = [
        "src/lib/db/admin-firestore-service.ts",
        "src/lib/email-writer/email-delivery-service.ts"
    ]
    
    for file_path in files:
        if not Path(file_path).exists():
            continue
            
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Add early return if adminDb is null at function starts
        # This is a simplified approach - may need more sophisticated handling
        if 'if (!adminDb)' not in content:
            # Find first function that uses adminDb and add null check
            # This would require more complex AST parsing for production
            print(f"   ⚠️  Manual review needed for {file_path}")
    
    print("   ℹ️  adminDb fixes require manual intervention")

def fix_null_vs_undefined():
    """Fix 'null' assigned to 'undefined' type issues"""
    print("🔧 Fixing null vs undefined type mismatches...")
    
    files_with_null_undefined = [
        "src/lib/integrations/calendar-sync-service.ts",
        "src/lib/integrations/google-calendar-service.ts"
    ]
    
    for file_path in files_with_null_undefined:
        if not Path(file_path).exists():
            continue
            
        with open(file_path, 'r') as f:
            content = f.read()
        
        # Convert `field || null` to `field || undefined` in return objects
        # This is complex and file-specific, needs AST parsing
        print(f"   ⚠️  Manual review needed for {file_path}")
    
    print("   ℹ️  Null/undefined fixes require manual intervention")

def main():
    print("=" * 80)
    print("TypeScript Error Surgery - Worker 1")
    print("=" * 80)
    
    initial_errors = count_tsc_errors()
    print(f"\n📊 Initial TypeScript errors: {initial_errors}")
    
    # Category 1: PDF Parser fix
    fix_pdf_parser()
    after_pdf = count_tsc_errors()
    print(f"   → Errors after PDF fix: {after_pdf} (fixed {initial_errors - after_pdf})")
    
    # Category 2: AdminDB null checks (complex, needs manual work)
    print("\n" + "=" * 80)
    fix_admin_db_null_checks()
    
    # Category 3: Null vs Undefined (complex, needs manual work)  
    print("\n" + "=" * 80)
    fix_null_vs_undefined()
    
    # Final count
    print("\n" + "=" * 80)
    final_errors = count_tsc_errors()
    print(f"📊 Final TypeScript errors: {final_errors}")
    print(f"✅ Automatically fixed: {initial_errors - final_errors} errors")
    print(f"⚠️  Remaining errors need manual intervention")
    
    # Generate detailed error report
    print("\n🔍 Generating detailed error categorization...")
    stdout, _, _ = run_cmd("NODE_OPTIONS='--max-old-space-size=8192' npx tsc --noEmit 2>&1 > tsc-categorized-errors.txt")
    print("   → Saved to tsc-categorized-errors.txt")

if __name__ == "__main__":
    main()
