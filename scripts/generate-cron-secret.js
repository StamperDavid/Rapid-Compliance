#!/usr/bin/env node

/**
 * Generate Strong CRON_SECRET
 * 
 * Creates a cryptographically secure random string for CRON_SECRET
 */

const crypto = require('crypto');

function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('base64');
}

console.log('\n🔐 Generated CRON_SECRET:\n');
console.log(generateSecret(32));
console.log('\n📋 Add to your environment variables:');
console.log(`CRON_SECRET=${generateSecret(32)}\n`);
