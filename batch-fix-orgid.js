import fs from 'fs';
import glob from 'glob';

// Find all API route files
const apiFiles = glob.sync('src/app/api/**/*.ts', { nodir: true });

let fixCount = 0;

apiFiles.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    let modified = false;

    // Pattern 1: const organizationId = token.organizationId; (without check)
    const pattern1 = /(const organizationId = token\.organizationId;)\n(\s+)(const |let |if |const\s*{|\/\/)/;
    if (pattern1.test(content) && !content.includes('if (!organizationId)')) {
      content = content.replace(
        pattern1,
        `$1\n$2\n$2if (!organizationId) {\n$2  return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });\n$2}\n$2\n$2$3`
      );
      modified = true;
    }

    // Pattern 2: const { user } = authResult; await ...user.organizationId (without check in between)
    const pattern2 = /(const { user } = authResult;)\n(\s+)(await .+user\.organizationId)/;
    if (pattern2.test(content) && !content.match(/const { user } = authResult;\s+if \(!user\.organizationId\)/)) {
      content = content.replace(
        pattern2,
        `$1\n$2\n$2if (!user.organizationId) {\n$2  return errors.badRequest('Organization ID required');\n$2}\n$2\n$2$3`
      );
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`✅ Fixed: ${file}`);
      fixCount++;
    }
  } catch (error) {
    // Silently skip files that don't match
  }
});

console.log(`\n✅ Total files fixed: ${fixCount}`);
