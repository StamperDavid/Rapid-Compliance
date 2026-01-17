// Temporary fix script for batch processing workflows
const fs = require('fs');
const path = require('path');

const files = [
  'src/lib/workflows/actions/entity-action.ts',
  'src/lib/workflows/actions/loop-action.ts',
  'src/lib/workflows/actions/slack-action.ts',
  'src/lib/workflows/triggers/firestore-trigger.ts',
  'src/lib/workflows/triggers/schedule-trigger.ts',
  'src/lib/workflows/triggers/webhook-trigger.ts',
  'src/lib/workflows/workflow-engine.ts',
  'src/lib/workflows/workflow-executor.ts',
  'src/lib/workflows/workflow-service.ts',
  'src/lib/workflows/workflow-triggers.ts',
];

const basePath = 'C:\\Users\\David\\PycharmProjects\\AI Sales Platform';

files.forEach(file => {
  const filePath = path.join(basePath, file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Fix duplicate imports - consolidate
    // Fix unused imports by prefixing with _

    // Replace common any types patterns
    content = content.replace(/triggerData: any/g, 'triggerData: Record<string, unknown>');
    content = content.replace(/workflow: any/g, 'workflow: Record<string, unknown>');
    content = content.replace(/: Promise<any>/g, ': Promise<Record<string, unknown>>');
    content = content.replace(/: any\[\]/g, ': Array<unknown>');

    // Fix async without await
    //content = content.replace(/async function (\w+)\(/g, 'function $1(');

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Processed: ${file}`);
  } else {
    console.log(`File not found: ${file}`);
  }
});
