/**
 * Schema Markup Service
 * Generates JSON-LD structured data for different page types.
 * Produces schema.org-compliant objects ready for <script type="application/ld+json">.
 */

import type { Page, BlogPost, SiteConfig } from '@/types/website';

// ============================================================================
// TYPES
// ============================================================================

interface SchemaBase {
  '@context': 'https://schema.org';
  '@type': string;
  [key: string]: unknown;
}

interface OrganizationSchemaInput {
  name: string;
  url: string;
  description?: string;
  logo?: string;
}

interface WebSiteSchemaInput {
  name: string;
  url: string;
  description?: string;
}

interface WebPageSchemaInput {
  name: string;
  url: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  breadcrumbs?: Array<{ name: string; url: string }>;
}

interface BlogPostingSchemaInput {
  title: string;
  url: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  authorName?: string;
  featuredImage?: string;
  keywords?: string[];
  wordCount?: number;
}

interface ProductSchemaInput {
  name: string;
  url: string;
  description?: string;
  image?: string;
  price?: number;
  currency?: string;
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder';
  brand?: string;
  sku?: string;
}

interface BreadcrumbItem {
  name: string;
  url: string;
}

export interface SchemaMarkupReport {
  organizationSchema: SchemaBase;
  websiteSchema: SchemaBase;
  pageSchemas: Array<{ pageId: string; schema: SchemaBase }>;
  blogSchemas: Array<{ postId: string; schema: SchemaBase }>;
  coverage: {
    totalPages: number;
    pagesWithSchema: number;
    totalPosts: number;
    postsWithSchema: number;
    coveragePercent: number;
  };
}

// ============================================================================
// SCHEMA GENERATORS
// ============================================================================

export function generateOrganizationSchema(input: OrganizationSchemaInput): SchemaBase {
  const schema: SchemaBase = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.name,
    url: input.url,
  };

  if (input.description) {
    schema.description = input.description;
  }
  if (input.logo) {
    schema.logo = {
      '@type': 'ImageObject',
      url: input.logo,
    };
  }

  return schema;
}

export function generateWebSiteSchema(input: WebSiteSchemaInput): SchemaBase {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: input.name,
    url: input.url,
    description: input.description ?? '',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${input.url}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function generateWebPageSchema(input: WebPageSchemaInput): SchemaBase {
  const schema: SchemaBase = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: input.name,
    url: input.url,
  };

  if (input.description) {
    schema.description = input.description;
  }
  if (input.datePublished) {
    schema.datePublished = input.datePublished;
  }
  if (input.dateModified) {
    schema.dateModified = input.dateModified;
  }

  if (input.breadcrumbs && input.breadcrumbs.length > 0) {
    schema.breadcrumb = generateBreadcrumbSchema(input.breadcrumbs);
  }

  return schema;
}

export function generateBlogPostingSchema(input: BlogPostingSchemaInput): SchemaBase {
  const schema: SchemaBase = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.title,
    url: input.url,
  };

  if (input.description) {
    schema.description = input.description;
  }
  if (input.datePublished) {
    schema.datePublished = input.datePublished;
  }
  if (input.dateModified) {
    schema.dateModified = input.dateModified;
  }
  if (input.authorName) {
    schema.author = {
      '@type': 'Person',
      name: input.authorName,
    };
  }
  if (input.featuredImage) {
    schema.image = input.featuredImage;
  }
  if (input.keywords && input.keywords.length > 0) {
    schema.keywords = input.keywords.join(', ');
  }
  if (input.wordCount) {
    schema.wordCount = input.wordCount;
  }

  return schema;
}

export function generateProductSchema(input: ProductSchemaInput): SchemaBase {
  const schema: SchemaBase = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    url: input.url,
  };

  if (input.description) {
    schema.description = input.description;
  }
  if (input.image) {
    schema.image = input.image;
  }
  if (input.brand) {
    schema.brand = {
      '@type': 'Brand',
      name: input.brand,
    };
  }
  if (input.sku) {
    schema.sku = input.sku;
  }
  if (input.price !== undefined) {
    schema.offers = {
      '@type': 'Offer',
      price: input.price,
      priceCurrency: input.currency ?? 'USD',
      availability: input.availability
        ? `https://schema.org/${input.availability}`
        : 'https://schema.org/InStock',
    };
  }

  return schema;
}

export function generateBreadcrumbSchema(items: BreadcrumbItem[]): SchemaBase {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

// ============================================================================
// FULL-SITE SCHEMA REPORT
// ============================================================================

/**
 * Generate a complete schema markup report for the entire site.
 * Used by the AI Search monitoring dashboard.
 */
export function generateSiteSchemaReport(
  siteConfig: Partial<SiteConfig>,
  baseUrl: string,
  pages: Page[],
  posts: BlogPost[]
): SchemaMarkupReport {
  const siteName = siteConfig.seo?.title ?? 'SalesVelocity.ai';
  const siteDescription = siteConfig.seo?.description ?? '';

  const organizationSchema = generateOrganizationSchema({
    name: siteName,
    url: baseUrl,
    description: siteDescription,
    logo: siteConfig.seo?.ogImage,
  });

  const websiteSchema = generateWebSiteSchema({
    name: siteName,
    url: baseUrl,
    description: siteDescription,
  });

  const pageSchemas = pages.map((page) => ({
    pageId: page.id,
    schema: generateWebPageSchema({
      name: page.seo?.metaTitle ?? page.title,
      url: `${baseUrl}/${page.slug}`,
      description: page.seo?.metaDescription,
      datePublished: page.publishedAt,
      dateModified: page.updatedAt,
      breadcrumbs: [
        { name: 'Home', url: baseUrl },
        { name: page.title, url: `${baseUrl}/${page.slug}` },
      ],
    }),
  }));

  const blogSchemas = posts.map((post) => ({
    postId: post.id,
    schema: generateBlogPostingSchema({
      title: post.title,
      url: `${baseUrl}/blog/${post.slug}`,
      description: post.excerpt,
      datePublished: post.publishedAt ?? post.createdAt,
      dateModified: post.updatedAt,
      authorName: post.authorName,
      featuredImage: post.featuredImage,
      keywords: post.tags,
      wordCount: post.readTime ? post.readTime * 200 : undefined,
    }),
  }));

  const totalPages = pages.length;
  const totalPosts = posts.length;
  const pagesWithSchema = pageSchemas.length;
  const postsWithSchema = blogSchemas.length;
  const total = totalPages + totalPosts;
  const covered = pagesWithSchema + postsWithSchema;

  return {
    organizationSchema,
    websiteSchema,
    pageSchemas,
    blogSchemas,
    coverage: {
      totalPages,
      pagesWithSchema,
      totalPosts,
      postsWithSchema,
      coveragePercent: total > 0 ? Math.round((covered / total) * 100) : 100,
    },
  };
}
