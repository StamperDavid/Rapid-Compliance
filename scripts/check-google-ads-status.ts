/**
 * One-shot: dump the current Google Ads connection state. Tells me which
 * step of the walkthrough we start on (Google connected? adwords scope?
 * developer token? customer ID?).
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';

const envPath = 'D:/Future Rapid Compliance/.env.local';
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) {
    const v = m[2].replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}
const sa = JSON.parse(
  fs.readFileSync('D:/Future Rapid Compliance/serviceAccountKey.json', 'utf-8'),
);
admin.initializeApp({ credential: admin.credential.cert(sa) });

(async () => {
  console.log('\n=== Google Ads connection state ===\n');

  const { getGoogleAdsStatus } = await import('../src/lib/integrations/google-ads-service');
  const status = await getGoogleAdsStatus();

  console.log('Configured (ready to call API):', status.configured);
  console.log('Google account connected:      ', status.googleAccountConnected);
  console.log('adwords scope granted:         ', status.hasAdwordsScope);
  console.log('Developer token saved:         ', status.developerToken);
  console.log('Customer ID saved:             ', status.customerId ?? '<not set>');
  console.log('Login (MCC) customer ID:       ', status.loginCustomerId ?? '<not set>');
  console.log('\nDiagnostic:', status.diagnostic);

  // Also surface the connected Google account email if any (for context).
  const { getConnectedGoogleTokens } = await import('../src/lib/integrations/google-tokens');
  const tokens = await getConnectedGoogleTokens();
  if (tokens) {
    console.log('\nConnected Google account:', tokens.accountEmail || '<no email captured>');
    console.log('Scopes granted (raw):', tokens.scope || '<empty>');
  } else {
    console.log('\nNo Google account connected via central OAuth.');
  }

  process.exit(0);
})().catch((err) => {
  console.error('Status check crashed:', err);
  process.exit(1);
});
