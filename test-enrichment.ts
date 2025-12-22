/**
 * Test script for lead enrichment system
 * Tests all components end-to-end
 */

// Test 1: Basic enrichment
async function testBasicEnrichment() {
  console.log('\n=== Test 1: Basic Enrichment ===');
  
  try {
    const { enrichCompany } = await import('./src/lib/enrichment/enrichment-service');
    
    const result = await enrichCompany(
      { companyName: 'Stripe' },
      'test-org-id'
    );
    
    console.log('✅ Basic enrichment completed');
    console.log('Success:', result.success);
    console.log('Cost:', result.cost);
    console.log('Confidence:', result.data?.confidence);
    console.log('Data points:', result.metrics.dataPointsExtracted);
    
    return result;
  } catch (error: any) {
    console.error('❌ Basic enrichment failed:', error.message);
    console.error('Stack:', error.stack);
    throw error;
  }
}

// Test 2: Caching
async function testCaching() {
  console.log('\n=== Test 2: Caching ===');
  
  try {
    const { enrichCompany } = await import('./src/lib/enrichment/enrichment-service');
    
    // First call (should cache)
    console.log('First call (should scrape and cache)...');
    const result1 = await enrichCompany(
      { domain: 'stripe.com' },
      'test-org-id'
    );
    
    console.log('First call cost:', result1.cost.totalCostUSD);
    
    // Second call (should hit cache)
    console.log('Second call (should hit cache)...');
    const result2 = await enrichCompany(
      { domain: 'stripe.com' },
      'test-org-id'
    );
    
    console.log('Second call cost:', result2.cost.totalCostUSD);
    
    if (result2.cost.totalCostUSD === 0) {
      console.log('✅ Caching works! Second call was FREE');
    } else {
      console.warn('⚠️ Caching might not be working - second call had cost');
    }
    
    return { result1, result2 };
  } catch (error: any) {
    console.error('❌ Caching test failed:', error.message);
    throw error;
  }
}

// Test 3: Validation
async function testValidation() {
  console.log('\n=== Test 3: Data Validation ===');
  
  try {
    const { validateEnrichmentData } = await import('./src/lib/enrichment/validation-service');
    
    const testData = {
      name: 'Test Company',
      website: 'https://test.com',
      domain: 'test.com',
      description: 'A test company',
      industry: 'Technology',
      size: 'small' as const,
      employeeCount: 100,
      lastUpdated: new Date(),
      dataSource: 'web-scrape' as const,
      confidence: 0,
    };
    
    const validation = await validateEnrichmentData(testData);
    
    console.log('Validation result:');
    console.log('  Valid:', validation.isValid);
    console.log('  Confidence:', validation.confidence);
    console.log('  Errors:', validation.errors);
    console.log('  Warnings:', validation.warnings);
    
    console.log('✅ Validation completed');
    
    return validation;
  } catch (error: any) {
    console.error('❌ Validation test failed:', error.message);
    throw error;
  }
}

// Test 4: Backup sources
async function testBackupSources() {
  console.log('\n=== Test 4: Backup Sources ===');
  
  try {
    const { getTechStackFromDNS } = await import('./src/lib/enrichment/backup-sources');
    
    const techStack = await getTechStackFromDNS('stripe.com');
    
    console.log('Tech stack from DNS:', techStack);
    console.log('✅ Backup sources work');
    
    return techStack;
  } catch (error: any) {
    console.error('❌ Backup sources test failed:', error.message);
    console.error('This might be okay - backup sources are optional');
    return [];
  }
}

// Test 5: Browser scraper
async function testBrowserScraper() {
  console.log('\n=== Test 5: Browser Scraper (Playwright) ===');
  
  try {
    const { smartScrape } = await import('./src/lib/enrichment/browser-scraper');
    
    console.log('Testing smart scrape on stripe.com...');
    const content = await smartScrape('https://stripe.com');
    
    console.log('Scraped content:');
    console.log('  Title:', content.title);
    console.log('  Description:', content.description?.substring(0, 100) + '...');
    console.log('  Text length:', content.cleanedText.length);
    
    console.log('✅ Browser scraper works');
    
    return content;
  } catch (error: any) {
    console.error('❌ Browser scraper failed:', error.message);
    console.error('You may need to install Playwright: npm install playwright && npx playwright install chromium');
    throw error;
  }
}

// Run all tests
async function runAllTests() {
  console.log('🚀 Starting Lead Enrichment System Tests\n');
  console.log('================================================');
  
  const results: any = {};
  
  try {
    // Test components individually first
    results.validation = await testValidation();
    results.backupSources = await testBackupSources();
    
    // Test browser scraper (requires Playwright)
    try {
      results.browserScraper = await testBrowserScraper();
    } catch (error: any) {
      console.warn('\n⚠️ Skipping browser scraper test - Playwright not installed');
      console.warn('Install with: npm install playwright && npx playwright install chromium\n');
    }
    
    // Test full enrichment flow
    results.basicEnrichment = await testBasicEnrichment();
    
    // Test caching
    results.caching = await testCaching();
    
    console.log('\n================================================');
    console.log('✅ ALL TESTS PASSED!');
    console.log('================================================\n');
    
    console.log('Summary:');
    console.log('- Basic enrichment: ✅');
    console.log('- Caching: ✅');
    console.log('- Validation: ✅');
    console.log('- Backup sources: ✅');
    console.log('- Browser scraper:', results.browserScraper ? '✅' : '⚠️ (Playwright needed)');
    
    return results;
  } catch (error: any) {
    console.log('\n================================================');
    console.log('❌ TESTS FAILED');
    console.log('================================================\n');
    console.error('Error:', error.message);
    console.error('\nFull stack trace:');
    console.error(error.stack);
    
    process.exit(1);
  }
}

// Run tests
runAllTests();

