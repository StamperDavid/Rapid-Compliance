# GMB (Google My Business) Specialist

## Status: FUNCTIONAL

Expert in Local SEO and Google Business Profile optimization. Specializes in drafting Local Updates, Photo Posts, and Map Pack optimization strategies.

## Core Capabilities

### 1. Local Update Drafting
- 5 post types: Local Update, Offer, Event, Product
- Template-based content generation
- Local keyword integration
- SEO scoring and optimization
- Estimated reach calculation

### 2. Photo Post Strategy
- 6 photo categories: Storefront, Interior, Team, Product, Behind-the-Scenes, Customer Experience
- SEO-optimized captions and alt text
- Geotagging recommendations
- Optimal posting time calculation
- Best practice guidelines

### 3. Map Pack Optimization
- 3 ranking factors analysis: Proximity, Relevance, Prominence
- Actionable improvement plans
- Competitor gap analysis
- Impact estimation
- Implementation roadmaps

### 4. Content Scheduling
- Weekly posting calendars
- Photo upload schedules
- Engagement task planning
- Optimal timing recommendations

### 5. Competitor Analysis
- Local competitor profiling
- Strength/weakness gap analysis
- Actionable competitive insights
- Benchmarking metrics

### 6. NAP Consistency Auditing
- Name, Address, Phone verification
- Format standardization
- Consistency scoring
- Citation prioritization

### 7. Category Optimization
- Primary category recommendations
- Secondary category strategies
- Search volume analysis
- Implementation guides

## Domain Knowledge

### GMB Post Types Configuration
- LOCAL_UPDATE: 1500 char max, 9 CTA options, 5 templates
- OFFER: Requires dates, coupon code optional
- EVENT: Requires date/time, title
- PRODUCT: Requires pricing

### Photo Post Strategies
- 6 categories with frequency recommendations
- SEO impact ratings (HIGH/MEDIUM/LOW)
- Best practice checklists
- Optimal timing windows

### Map Pack Ranking Factors
- Proximity (30% weight, not controllable)
- Relevance (30% weight, controllable)
- Prominence (40% weight, controllable)
- 10 prominence optimization actions

### Local Keywords
- 8 industry templates
- City/neighborhood/area targeting
- "Near me" optimization
- Service-specific keywords

### Optimal Posting Times
- Day-specific recommendations
- Post type optimization
- Engagement window targeting

### NAP Consistency Rules
- USPS address verification
- Phone format standardization
- Name variation detection
- Citation audit process

## Methods

### Core Execution Methods
- `execute(message)`: Main entry point, routes to specific actions
- `draftLocalUpdate(business, type, keywords)`: Generate GMB post
- `draftPhotoPost(business, photoType)`: Create photo caption/strategy
- `optimizeForMapPack(business)`: Full Map Pack audit
- `generatePostingSchedule(business, weeks)`: Weekly content calendar
- `analyzeLocalCompetitors(business, category, radius)`: Competition analysis

### Analysis Methods
- `calculateLocalRelevance(content, business)`: Score 0-1
- `calculateSEOScore(content, keywords)`: Score 0-1
- `estimatePostReach(business, relevance, seo)`: Estimated impressions
- `analyzeCurrentRankingFactors(business)`: Proximity/Relevance/Prominence scores

### Content Generation Methods
- `generateLocalUpdateContent(business, template, keywords)`: Full post content
- `generatePhotoCaption(business, strategy)`: SEO-optimized captions
- `generateLocalKeywords(business)`: Industry-specific keywords
- `selectOptimalCTA(business, postType, options)`: CTA selection

### Optimization Methods
- `generateMapPackActions(business, factors)`: Prioritized action items
- `optimizeCategories(business)`: Category recommendations
- `auditNAPConsistency(business)`: NAP verification
- `identifyQuickWins(optimization)`: High-impact, low-effort actions

## Statistics

- **Total Lines**: 1,887
- **Functional Lines**: 1,570
- **Boilerplate Lines**: 50
- **Methods**: 60+
- **Domain Configurations**: 8 major datasets
- **Post Templates**: 15+
- **Photo Strategies**: 6 categories

## Usage Example

```typescript
import { GMBSpecialist } from './trust/gmb';

const specialist = new GMBSpecialist({
  identity: {
    id: 'gmb-specialist-001',
    name: 'GMB Specialist',
    role: 'Local SEO Expert',
    status: 'FUNCTIONAL',
    reportsTo: 'trust-manager',
    capabilities: [
      'local-seo',
      'gmb-posting',
      'map-pack-optimization',
      'competitor-analysis',
    ],
  },
  systemPrompt: 'Expert in Google Business Profile optimization...',
  tools: ['content-generator', 'seo-analyzer'],
  outputSchema: {},
  maxTokens: 4000,
  temperature: 0.7,
});

await specialist.initialize();

// Draft a local update
const updateReport = await specialist.execute({
  id: 'task-001',
  timestamp: new Date(),
  from: 'trust-manager',
  to: 'gmb-specialist',
  type: 'COMMAND',
  priority: 'NORMAL',
  payload: {
    action: 'draftLocalUpdate',
    business: {
      id: 'biz-123',
      name: 'Local Coffee Shop',
      category: 'restaurant',
      location: {
        address: '123 Main St',
        city: 'Portland',
        state: 'OR',
        zip: '97201',
        neighborhood: 'Downtown',
      },
      phone: '(503) 555-1234',
      website: 'https://localcoffee.com',
    },
    options: {
      type: 'seasonal',
    },
  },
  requiresResponse: true,
  traceId: 'trace-001',
});

// Generate posting schedule
const scheduleReport = await specialist.execute({
  id: 'task-002',
  timestamp: new Date(),
  from: 'trust-manager',
  to: 'gmb-specialist',
  type: 'COMMAND',
  priority: 'NORMAL',
  payload: {
    action: 'generatePostingSchedule',
    business: businessData,
    options: { weeks: 4 },
  },
  requiresResponse: true,
  traceId: 'trace-002',
});

// Optimize for Map Pack
const mapPackReport = await specialist.execute({
  id: 'task-003',
  timestamp: new Date(),
  from: 'trust-manager',
  to: 'gmb-specialist',
  type: 'COMMAND',
  priority: 'HIGH',
  payload: {
    action: 'optimizeForMapPack',
    business: businessData,
  },
  requiresResponse: true,
  traceId: 'trace-003',
});
```

## Integration Points

- Reports to: Trust & Reputation Manager
- Collaborates with: Review Specialist, Reputation Specialist
- Signals: Listens for local SEO triggers, ranking changes
- Output: GMB posts, optimization reports, competitor analysis

## Future Enhancements

- Real-time GMB API integration
- Automated posting via GMB API
- Review sentiment integration
- Photo quality analysis with AI
- Competitor tracking automation
- Ranking position monitoring
- Post performance analytics
