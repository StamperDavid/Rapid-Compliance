#!/usr/bin/env node

/**
 * Verify Production Environment Variables
 * 
 * Validates that all required environment variables are set
 * for production deployment.
 */

const required = {
  P0_CRITICAL: [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
    'FIREBASE_ADMIN_PROJECT_ID',
    'FIREBASE_ADMIN_CLIENT_EMAIL',
    'FIREBASE_ADMIN_PRIVATE_KEY',
    'OPENAI_API_KEY',
    'SENDGRID_API_KEY',
    'FROM_EMAIL',
    'NEXT_PUBLIC_APP_URL',
  ],
  P1_HIGH: [
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GOOGLE_REDIRECT_URI',
    'CRON_SECRET',
  ],
  P2_MEDIUM: [
    'SENTRY_DSN',
    'NEXT_PUBLIC_BASE_DOMAIN',
    'VERCEL_TOKEN',
    'VERCEL_PROJECT_ID',
  ],
};

function validateEnvironment() {
  console.log('🔍 Verifying Production Environment Variables\n');
  
  let allValid = true;
  let totalRequired = 0;
  let totalSet = 0;

  for (const [priority, vars] of Object.entries(required)) {
    console.log(`\n📋 ${priority.replace('_', ' ')}:`);
    
    const missing = [];
    const present = [];
    
    vars.forEach(varName => {
      totalRequired++;
      if (process.env[varName]) {
        totalSet++;
        present.push(varName);
        console.log(`  ✅ ${varName}`);
      } else {
        missing.push(varName);
        console.log(`  ❌ ${varName} - MISSING`);
        if (priority === 'P0_CRITICAL') {
          allValid = false;
        }
      }
    });
    
    if (missing.length > 0) {
      console.log(`\n  Missing ${missing.length}/${vars.length} variables`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\n📊 Summary: ${totalSet}/${totalRequired} variables set (${Math.round(totalSet/totalRequired*100)}%)\n`);

  // Validation checks
  console.log('🔐 Security Checks:');
  
  // Check NODE_ENV
  if (process.env.NODE_ENV === 'production') {
    console.log('  ✅ NODE_ENV=production');
  } else {
    console.log(`  ⚠️  NODE_ENV=${process.env.NODE_ENV || 'not set'} (should be "production")`);
  }

  // Check Stripe keys are live mode
  if (process.env.STRIPE_SECRET_KEY) {
    if (process.env.STRIPE_SECRET_KEY.startsWith('sk_live_')) {
      console.log('  ✅ Stripe secret key is LIVE mode');
    } else {
      console.log('  ⚠️  Stripe secret key is TEST mode (should be sk_live_*)');
      allValid = false;
    }
  }

  if (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    if (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.startsWith('pk_live_')) {
      console.log('  ✅ Stripe publishable key is LIVE mode');
    } else {
      console.log('  ⚠️  Stripe publishable key is TEST mode (should be pk_live_*)');
    }
  }

  // Check Firebase private key format
  if (process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    if (process.env.FIREBASE_ADMIN_PRIVATE_KEY.includes('\\n')) {
      console.log('  ✅ Firebase private key has newline characters');
    } else {
      console.log('  ⚠️  Firebase private key might be malformed (missing \\n)');
    }
  }

  // Check CRON_SECRET length
  if (process.env.CRON_SECRET) {
    if (process.env.CRON_SECRET.length >= 32) {
      console.log('  ✅ CRON_SECRET is strong (32+ characters)');
    } else {
      console.log(`  ⚠️  CRON_SECRET is weak (${process.env.CRON_SECRET.length} chars, should be 32+)`);
    }
  }

  // Check APP_URL format
  if (process.env.NEXT_PUBLIC_APP_URL) {
    if (process.env.NEXT_PUBLIC_APP_URL.startsWith('https://')) {
      console.log('  ✅ APP_URL uses HTTPS');
    } else {
      console.log('  ⚠️  APP_URL should use HTTPS for production');
    }
    
    if (!process.env.NEXT_PUBLIC_APP_URL.endsWith('/')) {
      console.log('  ✅ APP_URL has no trailing slash');
    } else {
      console.log('  ⚠️  APP_URL has trailing slash (remove it)');
    }
  }

  console.log('\n' + '='.repeat(60));

  if (allValid && totalSet >= 13) {
    console.log('\n✅ PRODUCTION READY - All critical variables configured!\n');
    process.exit(0);
  } else {
    console.log('\n❌ NOT READY - Missing critical environment variables\n');
    console.log('See PRODUCTION_ENVIRONMENT_VARIABLES.md for details\n');
    process.exit(1);
  }
}

validateEnvironment();
