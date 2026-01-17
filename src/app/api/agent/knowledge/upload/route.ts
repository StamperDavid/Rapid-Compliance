import { type NextRequest, NextResponse } from 'next/server';
import { requireOrganization } from '@/lib/auth/api-auth';
import { processKnowledgeBase } from '@/lib/agent/knowledge-processor';
import { indexKnowledgeBase } from '@/lib/agent/vector-search';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { successResponse } from '@/lib/api/error-handler';

/**
 * Request payload structure for knowledge upload
 */
interface KnowledgeUploadFormData {
  organizationId: string | null;
  files: File[];
  urls: string | null;
  faqs: string | null;
}

/**
 * Response structure for successful knowledge upload
 */
interface KnowledgeUploadSuccessResponse {
  knowledgeBase: {
    documents: number;
    urls: number;
    faqs: number;
    products: number;
  };
}

/**
 * Parse and validate form data with proper type safety
 */
function parseKnowledgeUploadFormData(formData: FormData): KnowledgeUploadFormData {
  const organizationId = formData.get('organizationId');
  const files = formData.getAll('files');
  const urlsRaw = formData.get('urls');
  const faqs = formData.get('faqs');

  return {
    organizationId: typeof organizationId === 'string' ? organizationId : null,
    files: files.filter((file): file is File => file instanceof File),
    urls: typeof urlsRaw === 'string' ? urlsRaw : null,
    faqs: typeof faqs === 'string' ? faqs : null,
  };
}

/**
 * Parse URLs from JSON string with proper error handling
 */
function parseUrlsArray(urlsJson: string | null): string[] {
  if (!urlsJson) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(urlsJson);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/knowledge/upload');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse form data (multipart/form-data for file uploads)
    const rawFormData = await request.formData();
    const formData = parseKnowledgeUploadFormData(rawFormData);

    // Validate organizationId
    const organizationId = formData.organizationId;
    if (!organizationId) {
      return errors.badRequest('Organization ID is required');
    }

    // Verify user has access
    if (user.organizationId !== organizationId) {
      return errors.forbidden('Access denied');
    }

    // Parse URLs array
    const urls = parseUrlsArray(formData.urls);

    // Process knowledge base
    const knowledgeBase = await processKnowledgeBase({
      organizationId,
      uploadedFiles: formData.files,
      urls,
      faqs: formData.faqs ?? undefined,
    });

    // Save to Firestore
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/knowledgeBase`,
      'current',
      {
        ...knowledgeBase,
        organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      false
    );

    // Index knowledge base (generate embeddings)
    try {
      await indexKnowledgeBase(organizationId);
    } catch (indexError: unknown) {
      logger.warn('Failed to index knowledge base (embeddings)', {
        route: '/api/agent/knowledge/upload',
        error: indexError instanceof Error ? indexError.message : String(indexError)
      });
      // Continue even if indexing fails
    }

    const responseData: KnowledgeUploadSuccessResponse = {
      knowledgeBase: {
        documents: knowledgeBase.documents.length,
        urls: knowledgeBase.urls.length,
        faqs: knowledgeBase.faqs.length,
        products: knowledgeBase.productCatalog?.products.length ?? 0,
      },
    };

    return successResponse(responseData);
  } catch (error: unknown) {
    logger.error('Knowledge upload error', error instanceof Error ? error : undefined, { route: '/api/agent/knowledge/upload' });
    return errors.internal('Failed to upload knowledge', error instanceof Error ? error : undefined);
  }
}



















