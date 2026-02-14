import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { orderBy } from 'firebase/firestore';
import { FirestoreService } from '@/lib/db/firestore-service';
import { validateToolUrl, type CustomTool } from '@/types/custom-tools';
import { getSubCollection } from '@/lib/firebase/collections';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

/**
 * Custom Tools API Route
 *
 * Handles CRUD operations for SalesVelocity.ai custom tools.
 * Tools are stored in: organizations/{PLATFORM_ID}/customTools/{toolId}
 */

/**
 * Zod schema for POST endpoint
 */
const createToolRequestSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().optional(),
  url: z.string(),
  enabled: z.boolean().optional(),
  order: z.number().optional(),
  description: z.string().max(500).optional(),
  allowedRoles: z.array(z.string()).optional(),
});

/**
 * Zod schema for PUT endpoint
 */
const updateToolRequestSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  icon: z.string().optional(),
  url: z.string().optional(),
  enabled: z.boolean().optional(),
  order: z.number().optional(),
  description: z.string().max(500).optional(),
  allowedRoles: z.array(z.string()).optional(),
});

/**
 * Zod schema for DELETE endpoint
 */
const deleteToolRequestSchema = z.object({
  id: z.string(),
});

// Collection path helper
function getCollectionPath(): string {
  return getSubCollection('customTools');
}

/**
 * GET /api/custom-tools
 *
 * Get all custom tools for SalesVelocity.ai, or a single tool by ID.
 * Query params:
 *   - id: (optional) specific tool ID to fetch
 */
export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('id');

    const collectionPath = getCollectionPath();

    // Fetch single tool
    if (toolId) {
      const tool = await FirestoreService.get<CustomTool>(collectionPath, toolId);

      if (!tool) {
        return NextResponse.json(
          { error: 'Tool not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ tool });
    }

    // Fetch all tools, ordered by order field
    const tools = await FirestoreService.getAll<CustomTool>(
      collectionPath,
      [orderBy('order', 'asc')]
    );

    return NextResponse.json({ tools });
  } catch (error: unknown) {
    logger.error('Failed to fetch custom tools', error instanceof Error ? error : new Error(String(error)), { file: 'custom-tools/route.ts' });
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch custom tools';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * POST /api/custom-tools
 *
 * Create a new custom tool.
 * Body: CustomToolFormData + order
 */
export async function POST(
  request: NextRequest
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parseResult = createToolRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: `Invalid request body: ${errorMessage}` },
        { status: 400 }
      );
    }

    const { name, icon, url, enabled, order, description, allowedRoles } = parseResult.data;

    // Validate URL
    const validation = validateToolUrl(url);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error ?? 'Invalid URL' },
        { status: 400 }
      );
    }

    // Generate unique ID
    const toolId = `tool_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

    const now = new Date();
    const toolData: Omit<CustomTool, 'id'> = {
      name: name.trim(),
      icon: icon ?? '🔧',
      url: url.trim(),
      enabled: enabled ?? true,
      order: order ?? 0,
      description: description?.trim() ?? undefined,
      allowedRoles: allowedRoles ?? undefined,
      createdAt: now,
      updatedAt: now,
    };

    const collectionPath = getCollectionPath();
    await FirestoreService.set(collectionPath, toolId, toolData, false);

    const tool: CustomTool = {
      id: toolId,
      ...toolData,
    };

    return NextResponse.json({ tool }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Failed to create custom tool', error instanceof Error ? error : new Error(String(error)), { file: 'custom-tools/route.ts' });
    const errorMessage = error instanceof Error ? error.message : 'Failed to create custom tool';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/custom-tools
 *
 * Update an existing custom tool.
 * Body: { id: string } + CustomToolFormData fields to update
 */
export async function PUT(
  request: NextRequest
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parseResult = updateToolRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: `Invalid request body: ${errorMessage}` },
        { status: 400 }
      );
    }

    const { id, name, icon, url, enabled, order, description, allowedRoles } = parseResult.data;

    const collectionPath = getCollectionPath();

    // Check if tool exists
    const existingTool = await FirestoreService.get<CustomTool>(collectionPath, id);
    if (!existingTool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      );
    }

    // Validate URL if provided
    if (url !== undefined) {
      const validation = validateToolUrl(url);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error ?? 'Invalid URL' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Partial<CustomTool> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) {
      updateData.name = name.trim();
    }
    if (icon !== undefined) {
      updateData.icon = icon;
    }
    if (url !== undefined) {
      updateData.url = url.trim();
    }
    if (enabled !== undefined) {
      updateData.enabled = enabled;
    }
    if (order !== undefined) {
      updateData.order = order;
    }
    if (description !== undefined) {
      updateData.description = description.trim() ? description.trim() : undefined;
    }
    if (allowedRoles !== undefined) {
      updateData.allowedRoles = allowedRoles;
    }

    await FirestoreService.update(collectionPath, id, updateData);

    // Return updated tool
    const updatedTool: CustomTool = {
      ...existingTool,
      ...updateData,
      id,
    };

    return NextResponse.json({ tool: updatedTool });
  } catch (error: unknown) {
    logger.error('Failed to update custom tool', error instanceof Error ? error : new Error(String(error)), { file: 'custom-tools/route.ts' });
    const errorMessage = error instanceof Error ? error.message : 'Failed to update custom tool';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/custom-tools
 *
 * Delete a custom tool.
 * Body: { id: string }
 */
export async function DELETE(
  request: NextRequest
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parseResult = deleteToolRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMessage = parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return NextResponse.json(
        { error: `Invalid request body: ${errorMessage}` },
        { status: 400 }
      );
    }

    const { id } = parseResult.data;

    const collectionPath = getCollectionPath();

    // Check if tool exists
    const existingTool = await FirestoreService.get<CustomTool>(collectionPath, id);
    if (!existingTool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      );
    }

    await FirestoreService.delete(collectionPath, id);

    return NextResponse.json({ success: true, deleted: id });
  } catch (error: unknown) {
    logger.error('Failed to delete custom tool', error instanceof Error ? error : new Error(String(error)), { file: 'custom-tools/route.ts' });
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete custom tool';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
