import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { FirestoreService } from '@/lib/db/firestore-service';
import { validateToolUrl } from '@/types/custom-tools';
import type { CustomTool, CustomToolFormData } from '@/types/custom-tools';
import { serverTimestamp } from 'firebase/firestore';
import { where, orderBy } from 'firebase/firestore';

/**
 * Custom Tools API Route
 *
 * Handles CRUD operations for organization custom tools.
 * Tools are stored in: organizations/{orgId}/customTools/{toolId}
 */

// Collection path helper
function getCollectionPath(orgId: string): string {
  return `organizations/${orgId}/customTools`;
}

/**
 * GET /api/workspace/[orgId]/custom-tools
 *
 * Get all custom tools for an organization, or a single tool by ID.
 * Query params:
 *   - id: (optional) specific tool ID to fetch
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { searchParams } = new URL(request.url);
    const toolId = searchParams.get('id');

    const collectionPath = getCollectionPath(params.orgId);

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
  } catch (error: any) {
    console.error('Failed to fetch custom tools:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch custom tools' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/workspace/[orgId]/custom-tools
 *
 * Create a new custom tool.
 * Body: CustomToolFormData + order
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const body = await request.json();
    const { name, icon, url, enabled, order, description, allowedRoles } = body;

    // Validate required fields
    if (!name || name.trim() === '') {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    if (!url || url.trim() === '') {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      );
    }

    // Validate URL
    const validation = validateToolUrl(url);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid URL' },
        { status: 400 }
      );
    }

    // Generate unique ID
    const toolId = `tool_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const now = new Date();
    const toolData: Omit<CustomTool, 'id'> = {
      organizationId: params.orgId,
      name: name.trim(),
      icon: icon || '🔧',
      url: url.trim(),
      enabled: enabled !== false,
      order: typeof order === 'number' ? order : 0,
      description: description?.trim() || undefined,
      allowedRoles: allowedRoles || undefined,
      createdAt: now,
      updatedAt: now,
    };

    const collectionPath = getCollectionPath(params.orgId);
    await FirestoreService.set(collectionPath, toolId, toolData, false);

    const tool: CustomTool = {
      id: toolId,
      ...toolData,
    };

    return NextResponse.json({ tool }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create custom tool:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create custom tool' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/workspace/[orgId]/custom-tools
 *
 * Update an existing custom tool.
 * Body: { id: string } + CustomToolFormData fields to update
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const body = await request.json();
    const { id, name, icon, url, enabled, order, description, allowedRoles } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      );
    }

    const collectionPath = getCollectionPath(params.orgId);

    // Check if tool exists
    const existingTool = await FirestoreService.get<CustomTool>(collectionPath, id);
    if (!existingTool) {
      return NextResponse.json(
        { error: 'Tool not found' },
        { status: 404 }
      );
    }

    // Validate URL if provided
    if (url) {
      const validation = validateToolUrl(url);
      if (!validation.valid) {
        return NextResponse.json(
          { error: validation.error || 'Invalid URL' },
          { status: 400 }
        );
      }
    }

    // Build update data
    const updateData: Partial<CustomTool> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name.trim();
    if (icon !== undefined) updateData.icon = icon;
    if (url !== undefined) updateData.url = url.trim();
    if (enabled !== undefined) updateData.enabled = enabled;
    if (order !== undefined) updateData.order = order;
    if (description !== undefined) updateData.description = description?.trim() || undefined;
    if (allowedRoles !== undefined) updateData.allowedRoles = allowedRoles;

    await FirestoreService.update(collectionPath, id, updateData);

    // Return updated tool
    const updatedTool: CustomTool = {
      ...existingTool,
      ...updateData,
      id,
    };

    return NextResponse.json({ tool: updatedTool });
  } catch (error: any) {
    console.error('Failed to update custom tool:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update custom tool' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/workspace/[orgId]/custom-tools
 *
 * Delete a custom tool.
 * Body: { id: string }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Tool ID is required' },
        { status: 400 }
      );
    }

    const collectionPath = getCollectionPath(params.orgId);

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
  } catch (error: any) {
    console.error('Failed to delete custom tool:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete custom tool' },
      { status: 500 }
    );
  }
}
