import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { processKnowledgeBase } from '@/lib/agent/knowledge-processor';
import { indexKnowledgeBase } from '@/lib/agent/vector-search';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/knowledge/upload');
    if (rateLimitResponse) {return rateLimitResponse;}

    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // Parse form data (multipart/form-data for file uploads)
    const formData = await request.formData();
    const organizationId = formData.get('organizationId') as string;
    const files = formData.getAll('files') as File[];
    const urls = formData.get('urls') ? JSON.parse(formData.get('urls') as string) : [];
    const faqs = formData.get('faqs') as string;

    // Verify user has access
    if (user.organizationId !== organizationId) {
      return errors.forbidden('Access denied');
    }

    // Process knowledge base
    const knowledgeBase = await processKnowledgeBase({
      organizationId,
      uploadedFiles: files,
      urls,
      faqs,
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
    } catch (error) {
      logger.warn('Failed to index knowledge base (embeddings)', { route: '/api/agent/knowledge/upload', error });
      // Continue even if indexing fails
    }

    return NextResponse.json({
      success: true,
      knowledgeBase: {
        documents: knowledgeBase.documents.length,
        urls: knowledgeBase.urls.length,
        faqs: knowledgeBase.faqs.length,
        products: knowledgeBase.productCatalog?.products.length || 0,
      },
    });
  } catch (error: any) {
    logger.error('Knowledge upload error', error, { route: '/api/agent/knowledge/upload' });
    return errors.internal('Failed to upload knowledge', error);
  }
}



















