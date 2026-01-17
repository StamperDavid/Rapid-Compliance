/**
 * Ultra-final pass to eliminate ALL remaining any types and unsafe operations
 */

const fs = require('fs');
const path = require('path');

const ecommercePath = path.join(__dirname, 'src', 'lib', 'ecommerce');

console.log('Ultra-final fix pass...\n');

// Tax service fixes
const taxServicePath = path.join(ecommercePath, 'tax-service.ts');
let taxContent = fs.readFileSync(taxServicePath, 'utf8');

// Replace the filter callback with fully typed version
taxContent = taxContent.replace(
  /const applicableRates = taxRates\.filter\(\(rate: any\) => \{[\s\S]*?\}\) \?\? \[\];/g,
  `const applicableRates = taxRates.filter((rateItem) => {
    const rate = rateItem as Record<string, unknown>;
    if (rate.enabled !== true) {return false;}
    if (rate.country !== address.country) {return false;}
    if (rate.state && rate.state !== address.state) {return false;}
    if (rate.city && rate.city !== address.city) {return false;}
    if (rate.zipCode && rate.zipCode !== address.zip) {return false;}
    return true;
  });`
);

// Fix sort with typed parameters
taxContent = taxContent.replace(
  /applicableRates\.sort\(\(a: any, b: any\) => b\.priority - a\.priority\);/g,
  `applicableRates.sort((a, b) => {
    const aPriority = ((a as Record<string, unknown>).priority as number) ?? 0;
    const bPriority = ((b as Record<string, unknown>).priority as number) ?? 0;
    return bPriority - aPriority;
  });`
);

// Fix the for loop iteration
taxContent = taxContent.replace(
  /for \(const rate of applicableRates\) \{[\s\S]*?const taxAmount = \(taxableAmount \* \(\(rate\.rate as number\) \?\? 0\)\) \/ 100;/g,
  `for (const rateItem of applicableRates) {
    const rate = rateItem as Record<string, unknown>;
    const taxAmount = (taxableAmount * ((rate.rate as number) ?? 0)) / 100;`
);

fs.writeFileSync(taxServicePath, taxContent, 'utf8');
console.log('✓ Fixed tax-service.ts\n');

// Shipping service fixes
const shippingServicePath = path.join(ecommercePath, 'shipping-service.ts');
let shippingContent = fs.readFileSync(shippingServicePath, 'utf8');

// Fix calculateMethodCost to remove async/await
shippingContent = shippingContent.replace(
  /\/\/ Calculate costs for all methods and return cheapest\s+const calculations = await Promise\.all\(\s+availableMethods\.map\(\(method: Record<string, unknown>\) => calculateMethodCost\(method, cart, address\)\)\s+\);/gs,
  `// Calculate costs for all methods and return cheapest
  const calculations = availableMethods.map((method: Record<string, unknown>) => calculateMethodCost(method, cart, address));`
);

// Fix return statement type
shippingContent = shippingContent.replace(
  /return calculations\.sort\(\(a, b\) => a\.cost - b\.cost\)\[0\];/g,
  `const sortedCalculations = [...calculations].sort((a, b) => a.cost - b.cost);
  const cheapest = sortedCalculations[0];
  if (!cheapest) {
    return {
      cost: 0,
      methodId: 'default',
      methodName: 'Standard Shipping',
    };
  }
  return cheapest;`
);

// Remove unnecessary type assertion
shippingContent = shippingContent.replace(
  /const methodData = method as Record<string, unknown>;\s+switch \(methodData\.rateType\)/g,
  'switch (method.rateType as string)'
);

// Update all methodData references to method
shippingContent = shippingContent.replace(/methodData\./g, 'method.');
shippingContent = shippingContent.replace(/\(methodData\.estimatedDays/g, '(method.estimatedDays');

fs.writeFileSync(shippingServicePath, shippingContent, 'utf8');
console.log('✓ Fixed shipping-service.ts\n');

console.log('Ultra-final pass completed!\n');
console.log('Run: npx eslint "src/lib/ecommerce/**" to check final status\n');
