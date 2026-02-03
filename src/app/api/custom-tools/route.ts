import { NextResponse, type NextRequest } from 'next/server';
import { orderBy } from 'firebase/firestore';
import { FirestoreService } from '@/lib/db/firestore-service';
import { validateToolUrl, type CustomTool } from '@/types/custom-tools';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

/**
 * Custom Tools API Route
 *
 * Handles CRUD operations for RapidCompliance.US custom tools.
 * Tools are stored in: organizations/{orgId}/customTools/{toolId}
 */

/**
 * Request body for POST endpoint
 */
interface CreateToolRequestBody {
  name: unknown;
  icon?: unknown;
  url: unknown;
  enabled?: unknown;
  order?: unknown;
  description?: unknown;
  allowedRoles?: unknown;
}

/**
 * Request body for PUT endpoint
 */
interface UpdateToolRequestBody {
  id: unknown;
  name?: unknown;
  icon?: unknown;
  url?: unknown;
  enabled?: unknown;
  order?: unknown;
  description?: unknown;
  allowedRoles?: unknown;
}

/**
 * Request body for DELETE endpoint
 */
interface DeleteToolRequestBody {
  id: unknown;
}

/**
 * Type guard to check if value is a string
 */
function isString(value: unknown): value is string {
  return typeof value === 'string';
}

/**
 * Type guard to check if value is a boolean
 */
function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Type guard to check if value is a number
 */
function isNumber(value: unknown): value is number {
  return typeof value === 'number';
}

/**
 * Type guard to check if value is a string array
 */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

// Collection path helper
function getCollectionPath(): string {
  return `organizations/${DEFAULT_ORG_ID}/customTools`;
}

/**
 * GET /api/custom-tools
 *
 * Get all custom tools for RapidCompliance.US, or a single tool by ID.
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
    console.error('Failed to fetch custom tools:', error);
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
    const body = (await request.json()) as CreateToolRequestBody;
    const { name, icon, url, enabled, order, description, allowedRoles } = body;

    // Validate required fields
    if (!isString(name) || name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!isString(url) || url.trim() === '') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

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
      icon: isString(icon) ? icon : '🔧',
      url: url.trim(),
      enabled: enabled !== false,
      order: isNumber(order) ? order : 0,
      description: isString(description) ? (description.trim() || undefined) : undefined,
      allowedRoles: isStringArray(allowedRoles) ? allowedRoles : undefined,
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
    console.error('Failed to create custom tool:', error);
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
    const body = (await request.json()) as UpdateToolRequestBody;
    const { id, name, icon, url, enabled, order, description, allowedRoles } = body;

    if (!isString(id)) {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      );
    }

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
    if (isString(url)) {
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

    if (isString(name)) {
      updateData.name = name.trim();
    }
    if (icon !== undefined) {
      updateData.icon = isString(icon) ? icon : '🔧';
    }
    if (isString(url)) {
      updateData.url = url.trim();
    }
    if (isBoolean(enabled)) {
      updateData.enabled = enabled;
    }
    if (isNumber(order)) {
      updateData.order = order;
    }
    if (description !== undefined) {
      updateData.description = isString(description) ? (description.trim() || undefined) : undefined;
    }
    if (allowedRoles !== undefined) {
      updateData.allowedRoles = isStringArray(allowedRoles) ? allowedRoles : undefined;
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
    console.error('Failed to update custom tool:', error);
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
    const body = (await request.json()) as DeleteToolRequestBody;
    const { id } = body;

    if (!isString(id)) {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      );
    }

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
    console.error('Failed to delete custom tool:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete custom tool';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
