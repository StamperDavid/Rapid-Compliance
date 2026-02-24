/**
 * Site Migration Service
 * Orchestrates the full website migration pipeline:
 * deepScrape → crawlSite → extractBlueprint → generatePage (loop) → save pages → configure site
 *
 * Emits mission events at each step for Mission Control visibility.
 */

import { crawlSite } from './deep-scraper';
import { extractSiteBlueprint, type SiteBlueprint, type SiteBlueprintPage } from './site-blueprint-extractor';
import { generatePageFromPrompt, type GeneratedPage } from './ai-page-generator';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import {
  addMissionStep,
  updateMissionStep,
} from '@/lib/orchestrator/mission-persistence';

// ============================================================================
// TYPES
// ============================================================================

export interface MigrationRequest {
  sourceUrl: string;
  maxPages?: number;
  includeImages?: boolean;
  missionId?: string;
}

export interface MigrationPageResult {
  slug: string;
  title: string;
  status: 'success' | 'failed';
  error?: string;
}

export interface MigrationResult {
  status: 'COMPLETED' | 'PARTIAL' | 'FAILED';
  sourceUrl: string;
  blueprint: SiteBlueprint;
  pages: MigrationPageResult[];
  totalPages: number;
  successCount: number;
  failedCount: number;
  editorLink: string;
  durationMs: number;
}

// ============================================================================
// ORCHESTRATOR
// ============================================================================

/**
 * Run the full website migration pipeline.
 */
export async function migrateSite(request: MigrationRequest): Promise<MigrationResult> {
  const start = Date.now();
  const { sourceUrl, maxPages = 10, missionId } = request;

  logger.info('Starting site migration', { sourceUrl, maxPages, file: 'site-migration-service.ts' });

  // ── Step 1: Crawl ──────────────────────────────────────────────
  const crawlStepId = `step_crawl_${Date.now()}`;
  if (missionId) {
    void addMissionStep(missionId, {
      stepId: crawlStepId,
      toolName: 'crawl_site',
      delegatedTo: 'SCRAPER',
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      summary: `Crawling ${sourceUrl} (up to ${maxPages} pages)`,
    });
  }

  let crawlResult;
  try {
    crawlResult = await crawlSite(sourceUrl, maxPages);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    if (missionId) {
      void updateMissionStep(missionId, crawlStepId, {
        status: 'FAILED',
        error: errMsg,
        durationMs: Date.now() - start,
        completedAt: new Date().toISOString(),
      });
    }
    return {
      status: 'FAILED',
      sourceUrl,
      blueprint: emptyBlueprint(sourceUrl),
      pages: [],
      totalPages: 0,
      successCount: 0,
      failedCount: 0,
      editorLink: '/website/editor',
      durationMs: Date.now() - start,
    };
  }

  if (missionId) {
    void updateMissionStep(missionId, crawlStepId, {
      status: 'COMPLETED',
      summary: `Crawled ${crawlResult.totalPages} pages`,
      durationMs: Date.now() - start,
      completedAt: new Date().toISOString(),
    });
  }

  // ── Step 2: Extract Blueprint ──────────────────────────────────
  const blueprintStepId = `step_blueprint_${Date.now()}`;
  const blueprintStart = Date.now();
  if (missionId) {
    void addMissionStep(missionId, {
      stepId: blueprintStepId,
      toolName: 'extract_blueprint',
      delegatedTo: 'ARCHITECT',
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      summary: 'Analyzing site structure and extracting blueprint',
    });
  }

  let blueprint: SiteBlueprint;
  try {
    blueprint = await extractSiteBlueprint(crawlResult);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Blueprint extraction failed', error instanceof Error ? error : new Error(errMsg), {
      file: 'site-migration-service.ts',
    });

    if (missionId) {
      void updateMissionStep(missionId, blueprintStepId, {
        status: 'FAILED',
        error: errMsg,
        durationMs: Date.now() - blueprintStart,
        completedAt: new Date().toISOString(),
      });
    }

    return {
      status: 'FAILED',
      sourceUrl,
      blueprint: emptyBlueprint(sourceUrl),
      pages: [],
      totalPages: 0,
      successCount: 0,
      failedCount: 0,
      editorLink: '/website/editor',
      durationMs: Date.now() - start,
    };
  }

  if (missionId) {
    void updateMissionStep(missionId, blueprintStepId, {
      status: 'COMPLETED',
      summary: `Blueprint: ${blueprint.pages.length} pages, brand "${blueprint.brand.name}"`,
      durationMs: Date.now() - blueprintStart,
      completedAt: new Date().toISOString(),
    });
  }

  // ── Step 3: Generate Pages ─────────────────────────────────────
  const pageResults: MigrationPageResult[] = [];
  const generatedPages: GeneratedPage[] = [];

  for (const [idx, bpPage] of blueprint.pages.entries()) {
    const pageStepId = `step_page_${idx}_${Date.now()}`;
    const pageStart = Date.now();

    if (missionId) {
      void addMissionStep(missionId, {
        stepId: pageStepId,
        toolName: 'generate_page',
        delegatedTo: 'BUILDER',
        status: 'RUNNING',
        startedAt: new Date().toISOString(),
        summary: `Generating page ${idx + 1}/${blueprint.pages.length}: "${bpPage.title}"`,
      });
    }

    try {
      const prompt = buildPagePrompt(bpPage, blueprint.brand);
      const generated = await generatePageFromPrompt(prompt, {
        pageType: bpPage.type,
        style: {
          primaryColor: blueprint.brand.colors[0],
        },
        brandInfo: {
          name: blueprint.brand.name,
          tagline: blueprint.brand.tagline,
          industry: blueprint.brand.industry,
        },
      });

      // Override slug with blueprint slug
      generated.slug = bpPage.slug || generated.slug;
      generatedPages.push(generated);

      pageResults.push({
        slug: generated.slug,
        title: generated.title,
        status: 'success',
      });

      if (missionId) {
        void updateMissionStep(missionId, pageStepId, {
          status: 'COMPLETED',
          summary: `Page "${bpPage.title}" generated`,
          durationMs: Date.now() - pageStart,
          completedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      pageResults.push({
        slug: bpPage.slug,
        title: bpPage.title,
        status: 'failed',
        error: errMsg,
      });

      if (missionId) {
        void updateMissionStep(missionId, pageStepId, {
          status: 'FAILED',
          error: errMsg,
          durationMs: Date.now() - pageStart,
          completedAt: new Date().toISOString(),
        });
      }
    }
  }

  // ── Step 4: Save to Firestore ──────────────────────────────────
  const saveStepId = `step_save_${Date.now()}`;
  const saveStart = Date.now();
  if (missionId) {
    void addMissionStep(missionId, {
      stepId: saveStepId,
      toolName: 'save_pages',
      delegatedTo: 'BUILDER',
      status: 'RUNNING',
      startedAt: new Date().toISOString(),
      summary: `Saving ${generatedPages.length} pages to website builder`,
    });
  }

  try {
    await saveGeneratedPages(generatedPages, blueprint);

    if (missionId) {
      void updateMissionStep(missionId, saveStepId, {
        status: 'COMPLETED',
        summary: `${generatedPages.length} pages saved to website builder`,
        durationMs: Date.now() - saveStart,
        completedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logger.error('Failed to save migrated pages', error instanceof Error ? error : new Error(errMsg), {
      file: 'site-migration-service.ts',
    });

    if (missionId) {
      void updateMissionStep(missionId, saveStepId, {
        status: 'FAILED',
        error: errMsg,
        durationMs: Date.now() - saveStart,
        completedAt: new Date().toISOString(),
      });
    }
  }

  const successCount = pageResults.filter((p) => p.status === 'success').length;
  const failedCount = pageResults.filter((p) => p.status === 'failed').length;
  const status = failedCount === 0 ? 'COMPLETED' : successCount > 0 ? 'PARTIAL' : 'FAILED';

  return {
    status,
    sourceUrl,
    blueprint,
    pages: pageResults,
    totalPages: pageResults.length,
    successCount,
    failedCount,
    editorLink: '/website/editor',
    durationMs: Date.now() - start,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function buildPagePrompt(page: SiteBlueprintPage, brand: SiteBlueprint['brand']): string {
  const lines: string[] = [];
  lines.push(`Recreate a "${page.type}" page titled "${page.title}" for "${brand.name}".`);

  if (brand.industry) {
    lines.push(`Industry: ${brand.industry}`);
  }

  lines.push('');
  lines.push('The page should include these sections in order:');

  for (const section of page.sections) {
    const parts = [`- ${section.type}:`];
    if (section.heading) {
      parts.push(`heading "${section.heading}"`);
    }
    if (section.body) {
      parts.push(`body: "${section.body.slice(0, 200)}"`);
    }
    if (section.buttonText) {
      parts.push(`CTA: "${section.buttonText}"`);
    }
    if (section.items && section.items.length > 0) {
      parts.push(`(${section.items.length} items)`);
    }
    lines.push(parts.join(' '));
  }

  return lines.join('\n');
}

async function saveGeneratedPages(
  pages: GeneratedPage[],
  blueprint: SiteBlueprint
): Promise<void> {
  if (!adminDal) {
    throw new Error('Firestore admin DAL not available');
  }

  const now = new Date().toISOString();
  const pagesCollection = adminDal.getNestedCollection(
    `${getSubCollection('website')}/pages/items`
  );

  for (const page of pages) {
    const pageId = `migrated_${page.slug || 'home'}_${Date.now()}`;

    const pageData = {
      id: pageId,
      title: page.title,
      slug: page.slug,
      status: 'draft',
      content: page.sections,
      seo: page.seo,
      version: 1,
      createdAt: now,
      updatedAt: now,
      createdBy: 'migration-pipeline',
      lastEditedBy: 'migration-pipeline',
      migratedFrom: blueprint.sourceUrl,
    };

    await pagesCollection.doc(pageId).set(pageData);
  }

  // Save brand/navigation to site settings
  const settingsRef = adminDal.getNestedDocRef(
    `${getSubCollection('website')}/settings`
  );
  const existingSettings = await settingsRef.get();
  const existing = existingSettings.data() as Record<string, unknown> | undefined;
  const existingSeo = existing?.seo;

  await settingsRef.set({
    ...(existing ?? {}),
    seo: {
      ...(typeof existingSeo === 'object' && existingSeo !== null ? existingSeo as Record<string, unknown> : {}),
      title: blueprint.seo.title,
      description: blueprint.seo.description,
      keywords: blueprint.seo.keywords,
    },
    migratedFrom: blueprint.sourceUrl,
    migratedAt: now,
    updatedAt: now,
  }, { merge: true });
}

function emptyBlueprint(sourceUrl: string): SiteBlueprint {
  return {
    brand: { name: '', colors: [], fonts: [] },
    pages: [],
    navigation: [],
    seo: { title: '', description: '', keywords: [] },
    sourceUrl,
    extractedAt: new Date().toISOString(),
  };
}
