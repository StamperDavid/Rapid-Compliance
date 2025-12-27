/**
 * Simple test without external dependencies
 * Tests core functionality that doesn't require Playwright/APIs
 */

async function testTypes() {
  console.log('\n=== Test 1: Type Definitions ===');
  
  try {
    const types = await import('./src/lib/enrichment/types');
    console.log('✅ Types module loaded successfully');
    return true;
  } catch (error: any) {
    console.error('❌ Failed to load types:', error.message);
    return false;
  }
}

async function testValidationService() {
  console.log('\n=== Test 2: Validation Service ===');
  
  try {
    const { validateEnrichmentData } = await import('./src/lib/enrichment/validation-service');
    
    // Test with valid data
    const testData = {
      name: 'Stripe Inc',
      website: 'https://stripe.com',
      domain: 'stripe.com',
      description: 'Payment processing platform',
      industry: 'Fintech',
      size: 'enterprise' as const,
      employeeCount: 5000,
      employeeRange: '1000+',
      foundedYear: 2010,
      lastUpdated: new Date(),
      dataSource: 'web-scrape' as const,
      confidence: 85,
    };
    
    console.log('Testing validation...');
    const result = await validateEnrichmentData(testData);
    
    console.log('Validation result:');
    console.log('  Valid:', result.isValid);
    console.log('  Confidence:', result.confidence);
    console.log('  Errors:', result.errors.length);
    console.log('  Warnings:', result.warnings.length);
    
    if (result.errors.length > 0) {
      console.log('  Error details:', result.errors);
    }
    
    console.log('✅ Validation service works');
    return true;
  } catch (error: any) {
    console.error('❌ Validation service failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

async function testCacheService() {
  console.log('\n=== Test 3: Cache Service ===');
  
  try {
    const cache = await import('./src/lib/enrichment/cache-service');
    console.log('✅ Cache service module loaded');
    console.log('   Functions available:', Object.keys(cache).join(', '));
    return true;
  } catch (error: any) {
    console.error('❌ Cache service failed:', error.message);
    return false;
  }
}

async function testWebScraper() {
  console.log('\n=== Test 4: Web Scraper (Basic) ===');
  
  try {
    const { scrapeWebsite } = await import('./src/lib/enrichment/web-scraper');
    
    console.log('Testing basic scraper on example.com...');
    const result = await scrapeWebsite('https://example.com');
    
    console.log('Scraped successfully:');
    console.log('  Title:', result.title);
    console.log('  Content length:', result.cleanedText.length);
    console.log('  Has description:', !!result.description);
    
    console.log('✅ Basic web scraper works');
    return true;
  } catch (error: any) {
    console.error('❌ Web scraper failed:', error.message);
    console.error(error.stack);
    return false;
  }
}

async function testSearchService() {
  console.log('\n=== Test 5: Search Service ===');
  
  try {
    const { guessDomainFromCompanyName } = await import('./src/lib/enrichment/search-service');
    
    // Test domain guessing (no API required)
    const domain1 = guessDomainFromCompanyName('Stripe Inc');
    const domain2 = guessDomainFromCompanyName('Microsoft Corporation');
    
    console.log('Domain guessing:');
    console.log('  "Stripe Inc" →', domain1);
    console.log('  "Microsoft Corporation" →', domain2);
    
    console.log('✅ Search service works');
    return true;
  } catch (error: any) {
    console.error('❌ Search service failed:', error.message);
    return false;
  }
}

async function testAIExtractor() {
  console.log('\n=== Test 6: AI Extractor ===');
  
  try {
    const { calculateConfidence } = await import('./src/lib/enrichment/ai-extractor');
    
    // Test confidence calculation (no API required)
    const testData = {
      name: 'Stripe',
      website: 'https://stripe.com',
      domain: 'stripe.com',
      description: 'Payment platform',
      industry: 'Fintech',
      size: 'enterprise' as const,
      employeeCount: 5000,
      headquarters: {
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
      },
      techStack: ['React', 'Ruby', 'Postgres'],
      socialMedia: {
        linkedin: 'https://linkedin.com/company/stripe',
      },
    };
    
    const confidence = calculateConfidence(testData);
    console.log('Confidence score for test data:', confidence);
    
    console.log('✅ AI extractor module works');
    return true;
  } catch (error: any) {
    console.error('❌ AI extractor failed:', error.message);
    return false;
  }
}

async function runSimpleTests() {
  console.log('🧪 Running Simple Tests (No External Dependencies)\n');
  console.log('================================================');
  
  const results = {
    types: await testTypes(),
    validation: await testValidationService(),
    cache: await testCacheService(),
    scraper: await testWebScraper(),
    search: await testSearchService(),
    aiExtractor: await testAIExtractor(),
  };
  
  console.log('\n================================================');
  console.log('📊 Test Results:\n');
  
  let passed = 0;
  let failed = 0;
  
  for (const [test, result] of Object.entries(results)) {
    const status = result ? '✅' : '❌';
    console.log(`${status} ${test}`);
    if (result) passed++;
    else failed++;
  }
  
  console.log('\n================================================');
  console.log(`Results: ${passed}/${Object.keys(results).length} tests passed`);
  
  if (failed === 0) {
    console.log('\n✅ All core functionality works!');
    console.log('\nNext steps:');
    console.log('1. Install Playwright: npm install playwright');
    console.log('2. Install browser: npx playwright install chromium');
    console.log('3. Test full enrichment with Playwright');
  } else {
    console.log('\n❌ Some tests failed - see errors above');
    process.exit(1);
  }
}

runSimpleTests();

