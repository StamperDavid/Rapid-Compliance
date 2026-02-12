import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getContact, updateContact, deleteContact } from '@/lib/crm/contact-service';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const updateContactSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  linkedInUrl: z.string().url().optional(),
  twitterHandle: z.string().optional(),
  website: z.string().url().optional(),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    zip: z.string().optional(),
    country: z.string().optional(),
  }).optional(),
  isVIP: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  ownerId: z.string().optional(),
  workspaceId: z.string().optional().default('default'),
});

/**
 * GET /api/contacts/[contactId] - Get a single contact
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') ?? 'default';

    const contact = await getContact(contactId, workspaceId);
    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, contact });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch contact';
    logger.error('Failed to fetch contact', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/contacts/[contactId] - Update a contact
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const bodyResult = updateContactSchema.safeParse(body);

    if (!bodyResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: bodyResult.error.errors },
        { status: 400 }
      );
    }

    const { workspaceId, ...updates } = bodyResult.data;
    const contact = await updateContact(contactId, updates, workspaceId);

    return NextResponse.json({ success: true, contact });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to update contact';
    logger.error('Failed to update contact', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/contacts/[contactId] - Delete a contact
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ contactId: string }> }
) {
  try {
    const { contactId } = await params;

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId') ?? 'default';

    await deleteContact(contactId, workspaceId);

    return NextResponse.json({ success: true, deleted: contactId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to delete contact';
    logger.error('Failed to delete contact', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
