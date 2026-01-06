import fs from 'fs';
import path from 'path';

// Files that need organizationId checks
const files = [
  'src/app/api/crm/activities/stats/route.ts',
  'src/app/api/crm/activities/timeline/route.ts',
  'src/app/api/crm/deals/[dealId]/health/route.ts',
  'src/app/api/meetings/schedule/route.ts',
  'src/app/api/team/leaderboard/route.ts',
  'src/app/api/leads/route-lead/route.ts',
  'src/app/api/team/tasks/route.ts',
  'src/app/api/crm/duplicates/merge/route.ts',
  'src/app/api/crm/analytics/velocity/route.ts',
  'src/app/api/proposals/generate/route.ts',
  'src/app/api/crm/duplicates/route.ts',
];

let fixedCount = 0;

files.forEach(filePath => {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Pattern: const organizationId = token.organizationId; followed by next line
    const pattern = /(const organizationId = token\.organizationId;)\n(\s+)(const |let )/;
    
    if (pattern.test(content)) {
      content = content.replace(
        pattern,
        `$1\n$2\n$2if (!organizationId) {\n$2  return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });\n$2}\n$2\n$2$3`
      );
      
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
      fixedCount++;
    } else {
      console.log(`⏭️  Skipped (pattern not found): ${filePath}`);
    }
  } catch (error) {
    console.log(`❌ Error processing ${filePath}:`, error.message);
  }
});

console.log(`\n✅ Fixed ${fixedCount} files`);
