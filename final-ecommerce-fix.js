/**
 * Final ESLint Fix Pass
 * Handles remaining type assertions and error types
 */

const fs = require('fs');
const path = require('path');

const ecommercePath = path.join(__dirname, 'src', 'lib', 'ecommerce');

console.log('Starting final fix pass...\n');

// Final type-safe fixes
const finalFixes = {
  'cart-service.ts': [
    // Fix product assignment issues
    {
      search: /const product = await getProduct\(workspaceId, productId, organizationId\);\s+if \(!product\) {\s+throw new Error\('Product not found'\);\s+}/gs,
      replace: `const product = await getProduct(workspaceId, productId, organizationId);
  if (!product) {
    throw new Error('Product not found');
  }`
    },
  ],

  'checkout-service.ts': [
    // Fix product typing
    {
      search: /const product = await getProduct\(cart\.workspaceId, cart\.organizationId, item\.productId\);/g,
      replace: 'const product = await getProduct(cart.workspaceId, cart.organizationId, item.productId) as Record<string, unknown> | null;'
    },
    // Fix product member access
    {
      search: /if \(product\.stockLevel !== undefined && product\.stockLevel < item\.quantity\)/g,
      replace: "if (typeof product?.stockLevel === 'number' && product.stockLevel < item.quantity)"
    },
    {
      search: /if \(product\.price !== item\.price\)/g,
      replace: "if (typeof product?.price === 'number' && product.price !== item.price)"
    },
  ],

  'mapping-adapter.ts': [
    // Fix mappings[field] access
    {
      search: /if \(mappings\[field\] === oldFieldKey\)/g,
      replace: 'if (typeof mappings[field] === \'string\' && mappings[field] === oldFieldKey)'
    },
    {
      search: /const currentMapping = \(mappings as Record<string, string>\)\[mappingKey\];/g,
      replace: 'const mappingsRecord = mappings as Record<string, string>;\n    const currentMapping = mappingsRecord[mappingKey];'
    },
    {
      search: /\(mappings as Record<string, string>\)\[mappingKey\] = resolved\.fieldKey;/g,
      replace: 'mappingsRecord[mappingKey] = resolved.fieldKey;'
    },
  ],

  'payment-providers.ts': [
    // Fix error message access
    {
      search: /const errorMessage = err\.message;/g,
      replace: 'const errorMessage = err?.message ?? \'Unknown error\';'
    },
  ],

  'payment-service.ts': [
    // Fix card type assertions
    {
      search: /cardLast4 = \(pm as Record<string, unknown>\)\.card\?\.last4;/g,
      replace: 'cardLast4 = ((pm as Record<string, unknown>).card as Record<string, unknown> | undefined)?.last4 as string | undefined;'
    },
    {
      search: /cardBrand = \(pm as Record<string, unknown>\)\.card\?\.brand;/g,
      replace: 'cardBrand = ((pm as Record<string, unknown>).card as Record<string, unknown> | undefined)?.brand as string | undefined;'
    },
    // Fix order payment access
    {
      search: /const order = orders\[0\] as Record<string, unknown>;\s+const provider = order\.payment\.provider;/gs,
      replace: 'const order = orders[0] as Record<string, unknown>;\n  const payment = order.payment as Record<string, unknown>;\n  const provider = payment.provider;'
    },
  ],

  'product-service.ts': [
    // Already fixed earlier
  ],

  'shipping-service.ts': [
    // Fix method access patterns
    {
      search: /const method = shippingConfig\.methods\?\.find\(\(m: Record<string, unknown>\) => m\.id === methodId && m\.enabled\);/g,
      replace: 'const methods = (shippingConfig?.methods ?? []) as Array<Record<string, unknown>>;\n  const method = methods.find((m: Record<string, unknown>) => m.id === methodId && m.enabled);'
    },
    {
      search: /const availableMethods = shippingConfig\.methods\?\.filter\(\(m: Record<string, unknown>\) => m\.enabled\) \?\? \[\];/g,
      replace: 'const allMethods = (shippingConfig?.methods ?? []) as Array<Record<string, unknown>>;\n  const availableMethods = allMethods.filter((m: Record<string, unknown>) => m.enabled);'
    },
    // Fix method property access
    {
      search: /switch \(method\.rateType\)/g,
      replace: 'const methodData = method as Record<string, unknown>;\n  switch (methodData.rateType)'
    },
    {
      search: /cost: method\.flatRate \?\? 0,/g,
      replace: 'cost: typeof methodData.flatRate === \'number\' ? methodData.flatRate : 0,'
    },
    {
      search: /methodId: method\.id,/g,
      replace: 'methodId: methodData.id as string,'
    },
    {
      search: /methodName: method\.name,/g,
      replace: 'methodName: methodData.name as string,'
    },
    {
      search: /carrier: method\.carrier,/g,
      replace: 'carrier: methodData.carrier as string | undefined,'
    },
    {
      search: /service: method\.service,/g,
      replace: 'service: methodData.service as string | undefined,'
    },
    {
      search: /estimatedDelivery: method\.estimatedDays/g,
      replace: 'estimatedDelivery: methodData.estimatedDays'
    },
    {
      search: /\? calculateEstimatedDelivery\(method\.estimatedDays\.min, method\.estimatedDays\.max\)/g,
      replace: '? calculateEstimatedDelivery(\n          (methodData.estimatedDays as Record<string, unknown>).min as number,\n          (methodData.estimatedDays as Record<string, unknown>).max as number\n        )'
    },
  ],

  'tax-service.ts': [
    // Fix taxConfig access
    {
      search: /if \(taxConfig\.calculationType === 'automated'\)/g,
      replace: "if ((taxConfig as Record<string, unknown>)?.calculationType === 'automated')"
    },
    // Fix calculateManualTax parameter
    {
      search: /function calculateManualTax\(\s+taxConfig: Record<string, unknown>,/gs,
      replace: 'function calculateManualTax(\n  taxConfigParam: Record<string, unknown>,'
    },
    // Fix all taxConfig references in calculateManualTax
    {
      search: /const applicableRates = taxConfig\.taxRates\?\.filter/g,
      replace: 'const taxConfig = taxConfigParam;\n  const taxRates = (taxConfig.taxRates ?? []) as Array<Record<string, unknown>>;\n  const applicableRates = taxRates.filter'
    },
    {
      search: /\(rate: Record<string, unknown>\) => \{/g,
      replace: '(rateItem: Record<string, unknown>) => {\n    const rate = rateItem;'
    },
    {
      search: /if \(!rate\.enabled\)/g,
      replace: 'if (!rate.enabled)'
    },
    {
      search: /if \(rate\.country !== address\.country\)/g,
      replace: "if (rate.country !== address.country)"
    },
    {
      search: /if \(rate\.state && rate\.state !== address\.state\)/g,
      replace: "if (rate.state && rate.state !== address.state)"
    },
    {
      search: /if \(rate\.city && rate\.city !== address\.city\)/g,
      replace: "if (rate.city && rate.city !== address.city)"
    },
    {
      search: /if \(rate\.zipCode && rate\.zipCode !== address\.zip\)/g,
      replace: "if (rate.zipCode && rate.zipCode !== address.zip)"
    },
    {
      search: /\} \?\? \[\];/g,
      replace: '});'
    },
    // Fix sort
    {
      search: /applicableRates\.sort\(\(a: Record<string, unknown>, b: Record<string, unknown>\) => b\.priority - a\.priority\);/g,
      replace: 'applicableRates.sort((a, b) => ((b.priority as number) ?? 0) - ((a.priority as number) ?? 0));'
    },
    // Fix settings access
    {
      search: /if \(taxConfig\.settings\?\.pricesIncludeTax\)/g,
      replace: "if (((taxConfig.settings as Record<string, unknown> | undefined)?.pricesIncludeTax ?? false) === true)"
    },
    // Fix applicableRates[0] access
    {
      search: /taxableAmount = cart\.subtotal \/ \(1 \+ applicableRates\[0\]\.rate \/ 100\);/g,
      replace: 'taxableAmount = cart.subtotal / (1 + ((applicableRates[0].rate as number) ?? 0) / 100);'
    },
    {
      search: /const taxAmount = \(taxableAmount \* rate\.rate\) \/ 100;/g,
      replace: 'const taxAmount = (taxableAmount * ((rate.rate as number) ?? 0)) / 100;'
    },
    {
      search: /name: rate\.name,/g,
      replace: 'name: rate.name as string,'
    },
    {
      search: /rate: rate\.rate,/g,
      replace: 'rate: (rate.rate as number) ?? 0,'
    },
    {
      search: /if \(!rate\.compound\)/g,
      replace: 'if (!rate.compound)'
    },
    {
      search: /if \(applicableRates\[0\]\?\.applyToShipping\)/g,
      replace: "if (applicableRates[0]?.applyToShipping === true)"
    },
    {
      search: /const shippingTax = \(cart\.shipping \* applicableRates\[0\]\.rate\) \/ 100;/g,
      replace: 'const shippingTax = (cart.shipping * ((applicableRates[0].rate as number) ?? 0)) / 100;'
    },
    {
      search: /rate: applicableRates\[0\]\.rate,/g,
      replace: 'rate: (applicableRates[0].rate as number) ?? 0,'
    },
  ],
};

// Apply final fixes
Object.entries(finalFixes).forEach(([filename, replacements]) => {
  const filePath = path.join(ecommercePath, filename);
  console.log(`Final fixes for ${filename}...`);

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changeCount = 0;

    replacements.forEach(({ search, replace }) => {
      const before = content;
      content = content.replace(search, replace);
      if (before !== content) {
        changeCount++;
      }
    });

    if (changeCount > 0) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✓ Applied ${changeCount} final fixes to ${filename}\n`);
    } else {
      console.log(`  - No changes needed for ${filename}\n`);
    }
  } catch (error) {
    console.error(`  ✗ Error fixing ${filename}:`, error.message, '\n');
  }
});

console.log('Final fix pass completed!');
console.log('\nRun: npx eslint "src/lib/ecommerce/**" to verify all fixes\n');
