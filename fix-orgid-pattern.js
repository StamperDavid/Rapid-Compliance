const fs = require('fs');
const path = require('path');

const files = [
  './src/lib/ab-testing/ab-test-service.ts',
  './src/lib/agent/embeddings-service.ts',
  './src/lib/agent/knowledge-analyzer.ts',
  './src/lib/agent/onboarding-processor.ts',
  './src/lib/agent/vector-search.ts',
  './src/lib/ai/gemini-service.ts',
  './src/lib/ai/learning/ab-testing-service.ts',
  './src/lib/ai/learning/continuous-learning-engine.ts',
  './src/lib/api-keys/api-key-service.ts',
  './src/lib/battlecard/competitive-monitor.ts',
  './src/lib/brand/brand-dna-service.ts',
  './src/lib/ecommerce/cart-service.ts',
  './src/lib/email/email-service.ts',
  './src/lib/integrations/email-sync.ts',
  './src/lib/integrations/outlook-sync-service.ts',
  './src/lib/integrations/video/zoom.ts',
  './src/lib/notifications/index.ts',
  './src/lib/notifications/signal-handlers.ts',
  './src/lib/orchestrator/jasper-tools.ts',
  './src/lib/orchestrator/system-state-service.ts',
  './src/lib/outbound/apis/builtwith-service.ts',
  './src/lib/outbound/apis/clearbit-service.ts',
  './src/lib/outbound/apis/crunchbase-service.ts',
  './src/lib/outbound/apis/linkedin-service.ts',
  './src/lib/outbound/apis/news-service.ts',
  './src/lib/outbound/email-writer.ts',
  './src/lib/outbound/prospect-research.ts',
  './src/lib/outbound/sequence-scheduler.ts',
  './src/lib/performance/monitoring.ts',
  './src/lib/plugins/plugin-manager.ts',
  './src/lib/recovery/recovery-engine.ts',
  './src/lib/services/sequencer.ts',
  './src/lib/sms/sms-service.ts',
  './src/lib/social/autonomous-posting-agent.ts',
  './src/lib/templates/deal-scoring-engine.ts',
  './src/lib/templates/workforce-orchestrator.ts',
  './src/lib/video/video-job-service.ts',
  './src/lib/voice/ai-conversation-service.ts',
  './src/lib/voice/call-transfer-service.ts',
  './src/lib/voice/twilio-service.ts'
];

let processedCount = 0;
let errorCount = 0;

files.forEach(file => {
  const filePath = path.join(__dirname, file);

  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${file} (not found)`);
    return;
  }

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // Remove local variable declarations
    content = content.replace(/  const orgId = DEFAULT_ORG_ID;\n/g, '');
    content = content.replace(/  const organizationId = DEFAULT_ORG_ID;\n/g, '');

    // Replace orgId references with DEFAULT_ORG_ID (but not in comments or strings)
    // This is a simplified replacement - handles most cases
    content = content.replace(/\borganizations\/\$\{orgId\}/g, 'organizations/${DEFAULT_ORG_ID}');
    content = content.replace(/\borgId: orgId\b/g, 'orgId: DEFAULT_ORG_ID');
    content = content.replace(/\borganizationId: organizationId\b/g, 'organizationId: DEFAULT_ORG_ID');
    content = content.replace(/\(\s*orgId\s*\)/g, '(DEFAULT_ORG_ID)');
    content = content.replace(/,\s*orgId\s*\)/g, ', DEFAULT_ORG_ID)');
    content = content.replace(/\$\{orgId\}/g, '${DEFAULT_ORG_ID}');
    content = content.replace(/\$\{organizationId\}/g, '${DEFAULT_ORG_ID}');

    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`FIXED: ${file}`);
      processedCount++;
    } else {
      console.log(`NO CHANGE: ${file}`);
    }
  } catch (error) {
    console.error(`ERROR: ${file} - ${error.message}`);
    errorCount++;
  }
});

console.log(`\n========================================`);
console.log(`Processed: ${processedCount} files`);
console.log(`Errors: ${errorCount} files`);
console.log(`========================================`);
