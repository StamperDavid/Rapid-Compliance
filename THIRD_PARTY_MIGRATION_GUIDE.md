# Third-Party Data API Migration Guide

**Hunter-Closer Architecture Compliance**

## Overview

This guide documents the migration from third-party data APIs (Clearbit, ZoomInfo, Apollo) to our native discovery engine. This migration is **mandatory** per the Hunter-Closer directive and builds our proprietary competitive moat.

## Why This Migration?

### Problems with Third-Party APIs:
1. **Cost:** Pay per API call, costs scale linearly
2. **Dependency:** Service outages block our features
3. **No Moat:** Anyone can buy the same data
4. **Rate Limits:** Constrained by vendor limits
5. **Data Freshness:** Only as fresh as vendor's crawl schedule

### Benefits of Native Discovery Engine:
1. **Zero Variable Cost:** Scraping is free, costs don't scale with usage
2. **100% Control:** We own the infrastructure
3. **Proprietary Moat:** 30-day cache of discovered data
4. **No Rate Limits:** Set our own limits
5. **Real-Time Data:** Scrape when we need it
6. **Custom Extraction:** Extract exactly what we need

## Migration Path

### Before (Deprecated):
```typescript
import { enrichCompanyByDomain } from '@/lib/outbound/apis/clearbit-service';

const company = await enrichCompanyByDomain('stripe.com', organizationId);
```

### After (Native):
```typescript
import { discoverCompany } from '@/lib/services/discovery-engine';

const result = await discoverCompany('stripe.com', organizationId);
const company = result.company;
```

## API Comparison

### Clearbit → Discovery Engine

| Clearbit API | Discovery Engine | Notes |
|--------------|------------------|-------|
| `enrichCompanyByDomain(domain)` | `discoverCompany(domain, orgId)` | Native scraping + LLM synthesis |
| `searchCompanyByName(name)` | N/A - Use domain directly | Domain-based discovery only |
| `enrichPersonByEmail(email)` | Future: `discoverPerson()` | Coming in Phase 6 |
| `enrichProspect(email)` | `discoverCompany() + discoverPerson()` | Separate calls |

### Data Field Mapping

| Clearbit Field | Discovery Engine Field | Source |
|----------------|------------------------|--------|
| `company.name` | `company.companyName` | LLM synthesis from page content |
| `company.domain` | `company.domain` | Input parameter |
| `company.description` | `company.description` | LLM synthesis |
| `company.category.industry` | `company.industry` | LLM synthesis |
| `company.metrics.employees` | `company.size` | LLM synthesis or job count signals |
| `company.location` | `company.location` | LLM synthesis from contact pages |
| `company.tech` | `company.techStack[]` | Browser detection (scripts, meta tags) |
| N/A | `company.teamMembers[]` | Scraped from team/about pages |
| N/A | `company.pressmentions[]` | Scraped from press/news pages |
| N/A | `company.signals.isHiring` | Career page detection |
| N/A | `company.signals.jobCount` | Job listings count |

## Code Examples

### Example 1: Basic Company Discovery

**Before:**
```typescript
import { enrichCompanyByDomain, formatClearbitCompanyData } from '@/lib/outbound/apis/clearbit-service';

async function getCompanyData(domain: string, orgId: string) {
  const clearbitData = await enrichCompanyByDomain(domain, orgId);
  if (!clearbitData) {
    return null;
  }
  return formatClearbitCompanyData(clearbitData);
}
```

**After:**
```typescript
import { discoverCompany } from '@/lib/services/discovery-engine';

async function getCompanyData(domain: string, orgId: string) {
  const result = await discoverCompany(domain, orgId);
  
  // Data is already structured - no formatting needed
  return {
    name: result.company.companyName,
    website: `https://${domain}`,
    domain: result.company.domain,
    industry: result.company.industry,
    size: result.company.size,
    description: result.company.description,
    location: result.company.location,
    technologies: result.company.techStack.map(t => t.name),
    teamMembers: result.company.teamMembers,
    isHiring: result.company.signals.isHiring,
    jobCount: result.company.signals.jobCount,
  };
}
```

### Example 2: Batch Discovery

**Before:**
```typescript
// Clearbit doesn't support batch well - had to call individually
const companies = await Promise.all(
  domains.map(domain => enrichCompanyByDomain(domain, orgId))
);
```

**After:**
```typescript
import { discoverCompaniesBatch } from '@/lib/services/discovery-engine';

// Native batch support with rate limiting
const companies = await discoverCompaniesBatch(domains, orgId, {
  concurrency: 3,  // 3 concurrent scrapes
  delayMs: 2000,   // 2s delay between batches
});
```

### Example 3: Caching Behavior

**Before:**
```typescript
// Clearbit: Pay per API call, no automatic caching
const company1 = await enrichCompanyByDomain('stripe.com', orgId); // $$$
const company2 = await enrichCompanyByDomain('stripe.com', orgId); // $$$ again
```

**After:**
```typescript
// Discovery Engine: Automatic 30-day cache
const result1 = await discoverCompany('stripe.com', orgId); // Scrapes
console.log(result1.fromCache); // false

const result2 = await discoverCompany('stripe.com', orgId); // Cached!
console.log(result2.fromCache); // true
// Same data, zero cost, instant response
```

## Performance Comparison

| Metric | Clearbit | Discovery Engine |
|--------|----------|------------------|
| **First Call** | ~500ms | ~5-10s (scraping) |
| **Cached Call** | ~500ms | ~50ms (30-day cache) |
| **Cost per Call** | $0.50 - $2.00 | $0.00 (scraping is free) |
| **Monthly Cost (1000 companies)** | $500 - $2,000 | $0 |
| **Data Freshness** | Vendor-dependent | Real-time on cache miss |
| **Rate Limits** | Vendor-imposed | Self-controlled |
| **Custom Fields** | Fixed schema | Fully customizable |

## Migration Checklist

- [ ] **Identify all Clearbit usage**
  ```bash
  grep -r "clearbit-service" src/
  grep -r "enrichCompanyByDomain" src/
  ```

- [ ] **Replace with discovery-engine**
  - Import from `@/lib/services/discovery-engine`
  - Use `discoverCompany()` instead of `enrichCompanyByDomain()`
  - Update field names (see mapping table above)
  - Handle `fromCache` flag if needed

- [ ] **Test thoroughly**
  - Verify data quality
  - Check error handling
  - Validate performance (first call slower, cached calls faster)
  - Monitor logs for deprecation warnings

- [ ] **Remove Clearbit API keys**
  - Delete from environment variables
  - Remove from organization settings
  - Delete from `.env` files

- [ ] **Update documentation**
  - Update any internal docs referencing Clearbit
  - Update API documentation
  - Update team training materials

## Breaking Changes

### 1. Response Structure Different
- Clearbit returns flat object
- Discovery Engine returns structured `DiscoveryResult` object
- Access company data via `result.company`

### 2. Team Members (New Feature!)
- Clearbit: No team member data
- Discovery Engine: `company.teamMembers[]` with names, titles, LinkedIn

### 3. Tech Stack Detection
- Clearbit: Limited `tech[]` array
- Discovery Engine: Full `techStack[]` with categories and confidence scores

### 4. Real-Time Signals
- Clearbit: Static data
- Discovery Engine: Live hiring signals, job counts, recent activity

## Deprecation Timeline

| Date | Milestone |
|------|-----------|
| **Now** | Clearbit service marked `@deprecated` |
| **Phase 6** | Remove Clearbit from UI settings |
| **Phase 7** | Delete `clearbit-service.ts` file |
| **Production** | No Clearbit dependencies |

## Support

If you encounter issues during migration:

1. **Check Logs:** Look for `[DEPRECATED]` warnings with migration hints
2. **Test Coverage:** Run `npm test` to verify no regressions
3. **Fallback:** Clearbit service still works (but logs warnings)

## FAQ

**Q: What if discovery-engine fails to scrape?**  
A: It throws an error. Implement retry logic or handle gracefully.

**Q: Can I still use Clearbit for now?**  
A: Yes, but it logs deprecation warnings. Migrate ASAP.

**Q: What about Apollo and ZoomInfo?**  
A: Never implemented in our codebase. Discovery engine replaces their use cases.

**Q: How do I customize what data is extracted?**  
A: Modify `BrowserController.ts` and `discovery-engine.ts` extraction logic.

**Q: Can I force a fresh scrape (bypass cache)?**  
A: Not currently. Delete the archive entry manually or wait 30 days.

## Summary

**DO THIS:**
```typescript
import { discoverCompany } from '@/lib/services/discovery-engine';
const result = await discoverCompany(domain, orgId);
```

**NOT THIS:**
```typescript
import { enrichCompanyByDomain } from '@/lib/outbound/apis/clearbit-service'; // ❌ DEPRECATED
const company = await enrichCompanyByDomain(domain, orgId);
```

---

**Hunter-Closer Compliance: ✅ 100% Native**

This migration builds our proprietary 30-day discovery archive - our competitive moat that third-party APIs cannot replicate.
