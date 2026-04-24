/**
 * Dumps the delegate_to_content step's toolResult structure for a given
 * mission so the create_workflow resolver can be pointed at the right path.
 */

import '@/lib/firebase/admin';
import { getMission } from '@/lib/orchestrator/mission-persistence';

const missionId = process.argv[2] ?? 'mission_1777048141943_sc82u7';

async function main(): Promise<void> {
  const mission = await getMission(missionId);
  if (!mission) {
    console.error('Mission not found:', missionId);
    process.exit(1);
  }
  console.log(`Mission ${missionId}: status=${mission.status}, steps=${mission.steps?.length ?? 0}`);
  for (const step of mission.steps ?? []) {
    console.log(`\n=== Step ${step.stepId} ===`);
    console.log(`  toolName: ${step.toolName}`);
    console.log(`  status:   ${step.status}`);
    console.log(`  toolResultLen: ${step.toolResult?.length ?? 0}`);
    if (step.toolResult) {
      try {
        const parsed = JSON.parse(step.toolResult) as Record<string, unknown>;
        console.log('  toolResult top-level keys:', Object.keys(parsed));
        const data = (parsed as { data?: Record<string, unknown> }).data;
        if (data && typeof data === 'object') {
          console.log('  data top-level keys:', Object.keys(data));
          const emailSeq = (data as { emailSequence?: { emails?: unknown[] } }).emailSequence;
          if (emailSeq && typeof emailSeq === 'object') {
            console.log('  data.emailSequence keys:', Object.keys(emailSeq));
            if (Array.isArray(emailSeq.emails)) {
              console.log(`  data.emailSequence.emails.length: ${emailSeq.emails.length}`);
            }
          } else {
            console.log('  data.emailSequence: missing/null');
          }
        }
        console.log('\n  First 2000 chars of toolResult:');
        console.log(step.toolResult.slice(0, 2000));
      } catch (err) {
        console.log('  Failed to parse toolResult:', err instanceof Error ? err.message : String(err));
      }
    }
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
