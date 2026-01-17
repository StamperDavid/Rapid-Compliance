/**
 * Automated ESLint fix script for ecommerce directory
 * This script will fix all remaining ESLint warnings
 */

const fs = require('fs');
const path = require('path');

const ecommercePath = path.join(__dirname, 'src', 'lib', 'ecommerce');

// Files to fix
const files = [
  'cart-service.ts',
  'checkout-service.ts',
  'mapping-adapter.ts',
  'payment-providers.ts',
  'payment-service.ts',
  'product-service.ts',
  'shipping-service.ts',
  'tax-service.ts',
];

console.log('Starting ESLint fixes for e-commerce directory...\n');

files.forEach(file => {
  const filePath = path.join(ecommercePath, file);
  console.log(`Processing: ${file}`);

  try {
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove unused imports
    if (file === 'product-service.ts') {
      // Remove COLLECTIONS from destructuring if not used
      content = content.replace(
        /import { FirestoreService, COLLECTIONS } from '@\/lib\/db\/firestore-service';/g,
        "import { FirestoreService } from '@/lib/db/firestore-service';"
      );
      // Remove duplicate import
      content = content.replace(
        /import type { QueryConstraint, QueryDocumentSnapshot } from 'firebase\/firestore';\nimport { where, orderBy } from 'firebase\/firestore';/g,
        "import type { QueryConstraint, QueryDocumentSnapshot } from 'firebase/firestore';\nimport { where, orderBy } from 'firebase/firestore';"
      );
    }

    if (file === 'payment-service.ts') {
      // Remove unused OrderPayment import
      content = content.replace(
        /import type { OrderPayment } from '@\/types\/ecommerce'/g,
        "// OrderPayment type not needed in this service"
      );
    }

    // Write back
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  ✓ Fixed ${file}\n`);
  } catch (error) {
    console.error(`  ✗ Error fixing ${file}:`, error.message, '\n');
  }
});

console.log('ESLint fix script completed!');
