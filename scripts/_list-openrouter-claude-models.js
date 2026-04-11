/**
 * List Anthropic models currently available on OpenRouter
 *
 * Throwaway read-only script. No Firestore writes, no code changes, no agent
 * execution. Hits OpenRouter's public /models endpoint and prints the
 * anthropic/* family with context sizes and per-million-token pricing.
 *
 * Usage: node scripts/_list-openrouter-claude-models.js
 */

async function main() {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) {
    console.error(`OpenRouter /models failed: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.error(body.slice(0, 500));
    process.exit(1);
  }
  const body = await res.json();
  const models = Array.isArray(body?.data) ? body.data : [];
  const anthropic = models
    .filter((m) => typeof m?.id === 'string' && m.id.startsWith('anthropic/'))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (anthropic.length === 0) {
    console.log('No anthropic/* models returned. Raw first 5:');
    console.log(JSON.stringify(models.slice(0, 5), null, 2));
    process.exit(0);
  }

  console.log('\nAnthropic models currently available on OpenRouter:\n');
  const header =
    'MODEL ID'.padEnd(52) +
    'CTX'.padEnd(12) +
    '$/1M IN'.padEnd(14) +
    '$/1M OUT';
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const m of anthropic) {
    const inPrice = m.pricing?.prompt != null
      ? ('$' + (parseFloat(m.pricing.prompt) * 1_000_000).toFixed(2))
      : '?';
    const outPrice = m.pricing?.completion != null
      ? ('$' + (parseFloat(m.pricing.completion) * 1_000_000).toFixed(2))
      : '?';
    const ctx = typeof m.context_length === 'number'
      ? m.context_length.toLocaleString()
      : '?';
    console.log(
      m.id.padEnd(52) +
      ctx.padEnd(12) +
      inPrice.padEnd(14) +
      outPrice
    );
  }

  console.log(`\nTotal: ${anthropic.length} Anthropic models\n`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.stack : err);
  process.exit(1);
});
