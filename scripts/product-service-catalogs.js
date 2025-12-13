/**
 * Product and Service Catalogs for Test Companies
 * To be integrated into seed-complete-data.js
 */

const PRODUCT_CATALOGS = {
  ecommerce: [ // Adventure Gear Shop
    {
      name: 'Everest Trekking Pack 80L',
      sku: 'AGS-BP-001',
      category: 'Backpacks',
      price: 349.99,
      cost: 175.00,
      inventory: 24,
      description: 'Professional-grade 80L backpack designed for multi-day treks. Field-tested by guides for 100+ days. Features reinforced stitching, adjustable torso, and lifetime warranty.',
      features: ['80L capacity', 'Adjustable torso (15-22")', 'Waterproof base', 'Lifetime warranty'],
      weight: '4.2 lbs',
      images: ['https://example.com/everest-pack-1.jpg'],
      tags: ['backpacking', 'hiking', 'expedition'],
      active: true
    },
    {
      name: 'All-Weather Shell Jacket - Gore-Tex',
      sku: 'AGS-JK-001',
      category: 'Jackets',
      price: 449.99,
      cost: 225.00,
      inventory: 45,
      description: '3-layer Gore-Tex shell jacket. 20,000mm waterproof rating, 20,000g breathability. Tested in extreme alpine conditions.',
      features: ['Gore-Tex 3-layer', '20k/20k rating', 'Pit zips', 'Helmet-compatible hood', 'Lifetime warranty'],
      sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Black', 'Navy', 'Red'],
      images: ['https://example.com/shell-jacket-1.jpg'],
      tags: ['mountaineering', 'skiing', 'waterproof'],
      active: true
    },
    {
      name: 'Merino Base Layer Set',
      sku: 'AGS-BL-001',
      category: 'Base Layers',
      price: 129.99,
      cost: 65.00,
      inventory: 78,
      description: '100% Merino wool base layer set (top + bottom). Temperature regulating, odor-resistant, and naturally antimicrobial.',
      features: ['100% Merino wool', '260gsm weight', 'Flatlock seams', 'Machine washable'],
      sizes: ['S', 'M', 'L', 'XL'],
      images: ['https://example.com/base-layer-1.jpg'],
      tags: ['layering', 'winter', 'merino'],
      active: true
    },
    {
      name: 'Ultralight 2-Person Tent',
      sku: 'AGS-TN-001',
      category: 'Tents',
      price: 399.99,
      cost: 200.00,
      inventory: 18,
      description: 'Ultralight freestanding tent. Only 3.2 lbs. Withstands 60mph winds. Easy setup in under 5 minutes.',
      features: ['3.2 lbs trail weight', 'Freestanding', '2-person', 'Double-wall construction', '3-season'],
      weight: '3.2 lbs',
      images: ['https://example.com/tent-1.jpg'],
      tags: ['camping', 'backpacking', 'ultralight'],
      active: true
    },
    {
      name: 'Summit Down Sleeping Bag -15°F',
      sku: 'AGS-SB-001',
      category: 'Sleeping Bags',
      price: 299.99,
      cost: 150.00,
      inventory: 32,
      description: '800-fill down sleeping bag rated to -15°F. Lightweight and compressible for cold-weather expeditions.',
      features: ['800-fill down', '-15°F rating', 'Water-resistant shell', 'Compression sack included'],
      weight: '2.8 lbs',
      images: ['https://example.com/sleeping-bag-1.jpg'],
      tags: ['camping', 'winter', 'down'],
      active: true
    },
    {
      name: 'Trekking Poles - Carbon Fiber',
      sku: 'AGS-PL-001',
      category: 'Trekking Poles',
      price: 149.99,
      cost: 75.00,
      inventory: 56,
      description: 'Ultra-light carbon fiber trekking poles. Adjustable from 24-55 inches. Cork grips for comfort.',
      features: ['Carbon fiber construction', 'Adjustable 24-55"', 'Cork grips', 'Interchangeable tips'],
      weight: '8 oz per pole',
      images: ['https://example.com/poles-1.jpg'],
      tags: ['hiking', 'trekking'],
      active: true
    }
  ],
  
  manufacturing: [ // Midwest Plastics Supply
    {
      name: 'Custom ABS Injection Molded Housing',
      partNumber: 'MPS-ABS-4521',
      category: 'Custom Molded Parts',
      material: 'ABS Plastic',
      pricePerUnit: 2.45,
      moq: 5000,
      description: 'Custom injection molded ABS housing for electronic components. Tolerance: ±0.005". Available in custom colors.',
      specifications: {
        material: 'ABS (Acrylonitrile Butadiene Styrene)',
        dimensions: '4.5" x 3.2" x 1.8"',
        tolerance: '±0.005"',
        finish: 'Matte or Glossy',
        customColors: true,
        leadTime: '6-8 weeks for tooling, 1-2 weeks production'
      },
      applications: ['Electronics housings', 'Automotive components', 'Consumer products'],
      certifications: ['ISO 9001', 'RoHS compliant'],
      active: true
    },
    {
      name: 'Medical Grade Polypropylene Container',
      partNumber: 'MPS-PP-8934',
      category: 'Medical Components',
      material: 'Polypropylene (Medical Grade)',
      pricePerUnit: 1.89,
      moq: 10000,
      description: 'FDA-approved medical grade polypropylene container. Autoclavable and chemical resistant.',
      specifications: {
        material: 'Polypropylene (USP Class VI)',
        capacity: '250ml',
        tolerance: '±0.010"',
        sterilizable: 'Autoclave safe',
        leadTime: '8-12 weeks for tooling, 1 week production'
      },
      certifications: ['FDA approved', 'ISO 13485', 'USP Class VI'],
      active: true
    },
    {
      name: 'High-Impact Nylon Gear',
      partNumber: 'MPS-NY-2341',
      category: 'Industrial Parts',
      material: 'Nylon 6/6',
      pricePerUnit: 4.75,
      moq: 2500,
      description: 'High-strength nylon gear for industrial applications. Precision-molded with tight tolerances.',
      specifications: {
        material: 'Nylon 6/6 (30% glass-filled)',
        diameter: '3.0"',
        teeth: 48,
        tolerance: '±0.003"',
        tempRating: '-40°F to 220°F'
      },
      applications: ['Industrial machinery', 'Automotive', 'Power transmission'],
      active: true
    }
  ]
};

const SERVICE_CATALOGS = {
  landscaping: [ // GreenThumb Landscaping
    {
      name: 'Lush Lawn Weekly Package',
      serviceId: 'GTL-PKG-001',
      category: 'Maintenance Plans',
      price: 120,
      billingCycle: 'monthly',
      description: 'Our most popular package! Weekly mowing, trimming, edging, and blowing. Plus seasonal treatments.',
      includes: [
        'Weekly mowing (April-October)',
        'String trimming and edging',
        'Blowing of all hard surfaces',
        'Spring fertilization',
        'Fall aeration',
        '100% satisfaction guarantee'
      ],
      lotSizeMax: '1/4 acre',
      duration: 'Ongoing subscription',
      active: true
    },
    {
      name: 'Premium Estate Care',
      serviceId: 'GTL-PKG-002',
      category: 'Maintenance Plans',
      price: 350,
      billingCycle: 'monthly',
      description: 'Complete property care for larger estates. Includes shrub trimming, mulching, and seasonal color.',
      includes: [
        'All Lush Lawn services',
        'Bi-monthly shrub trimming',
        'Seasonal mulch installation',
        'Seasonal flower planting',
        'Gutter cleaning (2x/year)',
        'Priority scheduling'
      ],
      lotSizeMax: '1+ acre',
      duration: 'Ongoing subscription',
      active: true
    },
    {
      name: 'Spring Cleanup & Dethatching',
      serviceId: 'GTL-SVC-001',
      category: 'Seasonal Services',
      price: 275,
      billingCycle: 'one-time',
      description: 'Prepare your lawn for growing season. Includes dethatching, cleanup, and first fertilization.',
      includes: [
        'Complete yard cleanup',
        'Dethatching',
        'First fertilization',
        'Mulch bed refreshing',
        'Gutter cleaning'
      ],
      duration: '4-6 hours',
      season: 'March-April',
      active: true
    },
    {
      name: 'Fall Aeration & Overseeding',
      serviceId: 'GTL-SVC-002',
      category: 'Seasonal Services',
      price: 225,
      billingCycle: 'one-time',
      description: 'Strengthen your lawn for winter. Core aeration followed by premium overseeding.',
      includes: [
        'Core aeration',
        'Premium grass seed',
        'Fall fertilization',
        'Lime application (if needed)'
      ],
      duration: '3-4 hours',
      season: 'September-October',
      active: true
    },
    {
      name: 'Snow Removal Service',
      serviceId: 'GTL-SVC-003',
      category: 'Winter Services',
      price: 85,
      billingCycle: 'per occurrence',
      description: 'Priority snow removal for driveways and walkways. Available 24/7 during snow events.',
      includes: [
        'Driveway plowing',
        'Walkway shoveling',
        'Ice melt application',
        '24/7 availability'
      ],
      season: 'November-March',
      active: true
    }
  ],
  
  healthcare: [ // Balance Physical Therapy
    {
      name: 'Initial Evaluation & Assessment',
      serviceId: 'BPT-SVC-001',
      category: 'Assessment',
      price: 175,
      duration: 60,
      description: 'Comprehensive 60-minute initial evaluation. Includes movement assessment, pain analysis, and custom treatment plan.',
      includes: [
        'Detailed medical history review',
        'Functional movement assessment',
        'Pain and mobility evaluation',
        'Goal setting',
        'Custom treatment plan creation'
      ],
      requiresReferral: false,
      insuranceAccepted: true,
      active: true
    },
    {
      name: 'Standard Physical Therapy Session',
      serviceId: 'BPT-SVC-002',
      category: 'Treatment',
      price: 125,
      duration: 45,
      description: 'Standard 45-minute treatment session with licensed Physical Therapist.',
      includes: [
        '1-on-1 therapist time',
        'Manual therapy techniques',
        'Therapeutic exercises',
        'Modalities as needed',
        'Home exercise program'
      ],
      requiresReferral: true,
      insuranceAccepted: true,
      active: true
    },
    {
      name: 'Sports Injury Rehabilitation Program',
      serviceId: 'BPT-PKG-001',
      category: 'Specialized Programs',
      price: 950,
      duration: '6 weeks',
      description: 'Intensive 6-week program for sports injury recovery. 12 sessions (2x/week) with our sports specialist.',
      includes: [
        '12 treatment sessions',
        'Sport-specific training',
        'Return-to-play protocol',
        'Performance testing',
        'Injury prevention education'
      ],
      requiresReferral: false,
      insuranceAccepted: false,
      sessions: 12,
      active: true
    },
    {
      name: 'Chronic Pain Management Program',
      serviceId: 'BPT-PKG-002',
      category: 'Specialized Programs',
      price: 1200,
      duration: '8 weeks',
      description: 'Comprehensive 8-week program for chronic pain. Combines manual therapy, exercise, and pain science education.',
      includes: [
        '16 treatment sessions',
        'Pain neuroscience education',
        'Mindfulness training',
        'Home exercise program',
        'Lifestyle coaching'
      ],
      sessions: 16,
      active: true
    }
  ],
  
  creative: [ // PixelPerfect Design Co.
    {
      name: 'Starter Website Package',
      serviceId: 'PPD-PKG-001',
      category: 'Web Design',
      price: 7500,
      description: 'Perfect for small businesses. Modern 5-page website with mobile-responsive design and basic SEO.',
      includes: [
        '5 custom pages',
        'Mobile-responsive design',
        'Basic SEO setup',
        'Contact form',
        'CMS integration (WordPress/Webflow)',
        '30-day post-launch support',
        '1 round of revisions'
      ],
      timeline: '4-6 weeks',
      active: true
    },
    {
      name: 'Conversion-Focused Website',
      serviceId: 'PPD-PKG-002',
      category: 'Web Design',
      price: 15000,
      description: 'CRO-optimized website designed to convert visitors into leads. Includes A/B testing and analytics.',
      includes: [
        '10 custom pages',
        'Conversion rate optimization',
        'Advanced SEO',
        'Google Analytics setup',
        'Lead capture forms',
        'Email integration',
        '60-day post-launch support',
        '2 rounds of revisions'
      ],
      timeline: '8-10 weeks',
      active: true
    },
    {
      name: 'Complete Brand Identity Package',
      serviceId: 'PPD-PKG-003',
      category: 'Branding',
      price: 5000,
      description: 'Full brand identity system. Logo, color palette, typography, and brand guidelines.',
      includes: [
        'Logo design (3 concepts)',
        'Color palette development',
        'Typography selection',
        'Brand style guide',
        'Business card design',
        'Letterhead template',
        'Social media templates',
        '3 rounds of revisions'
      ],
      timeline: '3-4 weeks',
      deliverables: 'All source files included',
      active: true
    },
    {
      name: 'Landing Page Design & Build',
      serviceId: 'PPD-SVC-001',
      category: 'Web Design',
      price: 2500,
      description: 'High-converting single-page landing page for campaigns or product launches.',
      includes: [
        'Custom design',
        'Mobile-responsive',
        'Fast loading (<2s)',
        'Lead capture integration',
        'Basic SEO'
      ],
      timeline: '2 weeks',
      active: true
    }
  ],
  
  edtech: [ // CodeMaster Academy
    {
      name: 'Full-Stack Web Development Bootcamp',
      courseId: 'CMA-COURSE-001',
      category: 'Bootcamps',
      price: 15000,
      duration: '24 weeks',
      description: 'Intensive full-time program. Learn React, Node.js, databases, and more. Job placement guarantee.',
      curriculum: [
        'HTML/CSS/JavaScript fundamentals',
        'React.js and modern frontend',
        'Node.js and Express',
        'SQL and NoSQL databases',
        'Authentication and security',
        'Deployment and DevOps',
        'Data structures and algorithms',
        'System design',
        'Portfolio projects'
      ],
      commitment: '40 hours/week',
      format: 'Remote live instruction',
      jobGuarantee: true,
      nextCohort: '2024-02-05',
      active: true
    },
    {
      name: 'Part-Time Web Development Course',
      courseId: 'CMA-COURSE-002',
      category: 'Part-Time Programs',
      price: 8500,
      duration: '36 weeks',
      description: 'Learn to code while working full-time. Evening and weekend classes.',
      curriculum: [
        'HTML/CSS/JavaScript',
        'React fundamentals',
        'Backend basics with Node.js',
        'Database fundamentals',
        'Final capstone project'
      ],
      commitment: '15-20 hours/week',
      format: 'Remote evening classes',
      jobGuarantee: false,
      active: true
    },
    {
      name: 'Data Science & Machine Learning Bootcamp',
      courseId: 'CMA-COURSE-003',
      category: 'Bootcamps',
      price: 17000,
      duration: '24 weeks',
      description: 'Become a data scientist. Python, machine learning, and real-world projects.',
      curriculum: [
        'Python for data science',
        'Statistics and probability',
        'Machine learning algorithms',
        'Deep learning with TensorFlow',
        'Data visualization',
        'SQL and data engineering',
        'ML deployment',
        'Capstone project'
      ],
      commitment: '40 hours/week',
      prerequisites: 'Basic programming knowledge',
      active: true
    }
  ],
  
  financial: [ // Summit Wealth Management
    {
      name: 'Comprehensive Retirement Planning',
      serviceId: 'SWM-SVC-001',
      category: 'Planning Services',
      fee: 0.85,
      feeType: 'percentage_aum',
      minimumAssets: 500000,
      description: 'Complete retirement planning and portfolio management for high-net-worth individuals.',
      includes: [
        'Detailed financial plan',
        'Tax-optimized portfolio management',
        'Quarterly portfolio reviews',
        'Annual tax planning session',
        'Estate planning coordination',
        'Unlimited phone/email access'
      ],
      fiduciaryStandard: true,
      active: true
    },
    {
      name: 'Premium Wealth Management',
      serviceId: 'SWM-SVC-002',
      category: 'Planning Services',
      fee: 0.65,
      feeType: 'percentage_aum',
      minimumAssets: 2000000,
      description: 'Concierge-level service for significant wealth. Priority access and family office services.',
      includes: [
        'All Comprehensive Planning services',
        'Family wealth transfer planning',
        'Charitable giving strategies',
        'Monthly portfolio updates',
        'Priority phone access',
        'Semi-annual in-person meetings'
      ],
      fiduciaryStandard: true,
      active: true
    }
  ],
  
  realestate: [ // Metro Property Group
    {
      name: 'Buyer\'s Agent Representation',
      serviceId: 'MPG-SVC-001',
      category: 'Buyer Services',
      commission: 3.0,
      commissionType: 'percentage',
      description: 'Full buyer representation. We help you find and negotiate your perfect home.',
      includes: [
        'Neighborhood market analysis',
        'Property search and showings',
        'Offer preparation and negotiation',
        'Inspection coordination',
        'Closing assistance',
        'Post-closing support'
      ],
      guarantees: ['Find your home in 12 months or release from agreement'],
      active: true
    },
    {
      name: 'Seller Listing Service - Premium',
      serviceId: 'MPG-SVC-002',
      category: 'Seller Services',
      commission: 6.0,
      commissionType: 'percentage',
      description: 'Full-service listing with professional marketing and staging consultation.',
      includes: [
        'Comparative market analysis',
        'Professional photography',
        'Virtual 3D tour',
        'Staging consultation',
        'MLS and syndication to 100+ sites',
        'Open houses',
        'Negotiation expertise',
        'Marketing on social media'
      ],
      active: true
    }
  ],
  
  coaching: [ // Executive Edge Coaching
    {
      name: '12-Month Executive Coaching Program',
      serviceId: 'EEC-PKG-001',
      category: 'Executive Coaching',
      price: 75000,
      duration: '12 months',
      description: 'Year-long transformational program for C-suite executives. Based on our proven "3 Pillars" methodology.',
      includes: [
        '24 one-on-one coaching sessions (2/month)',
        'Unlimited email/text support',
        '360-degree leadership assessment',
        'Quarterly strategic planning sessions',
        'Access to executive peer network',
        'Custom leadership development plan'
      ],
      eligibility: 'C-suite or VP-level only',
      companyRevenue: '$50M+',
      active: true
    },
    {
      name: 'Quarterly Strategic Offsite Facilitation',
      serviceId: 'EEC-SVC-001',
      category: 'Team Services',
      price: 15000,
      duration: '2 days',
      description: 'Intensive 2-day offsite for leadership team alignment and strategic planning.',
      includes: [
        'Pre-work assessments',
        '2-day facilitated offsite',
        'Strategic planning framework',
        'Team alignment exercises',
        'Action plan creation',
        '30-day follow-up session'
      ],
      maxParticipants: 12,
      active: true
    }
  ],
  
  saas: [ // AuraFlow Analytics
    {
      name: 'AuraFlow Pro - Starter',
      planId: 'AF-PLAN-001',
      category: 'Software Subscription',
      price: 9600,
      billingCycle: 'annual',
      description: 'Perfect for small manufacturers. Real-time capacity planning with essential forecasting.',
      features: [
        'Up to 10,000 data points/day',
        'Real-time capacity dashboard',
        'Basic predictive analytics',
        '1 ERP integration',
        'Email support',
        'Monthly reporting'
      ],
      users: 'Up to 5 users',
      dataRetention: '12 months',
      sla: '99.5% uptime',
      active: true
    },
    {
      name: 'AuraFlow Pro - Enterprise',
      planId: 'AF-PLAN-002',
      category: 'Software Subscription',
      price: 30000,
      billingCycle: 'annual',
      description: 'Full-featured platform for large manufacturers. Advanced ML forecasting and unlimited integrations.',
      features: [
        'Unlimited data points',
        'Advanced ML forecasting (99.5% accuracy)',
        'Predictive inventory engine',
        'Supplier risk dashboard',
        'Unlimited ERP integrations',
        'Custom API access',
        'Dedicated account manager',
        'Phone + email support',
        'Custom reporting'
      ],
      users: 'Unlimited users',
      dataRetention: 'Unlimited',
      sla: '99.9% uptime',
      active: true
    }
  ]
};

module.exports = { PRODUCT_CATALOGS, SERVICE_CATALOGS };









