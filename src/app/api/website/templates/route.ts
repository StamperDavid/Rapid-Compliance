/**
 * Templates API
 * Manage custom page templates
 * CRITICAL: Multi-tenant - custom templates scoped to organizationId
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin';
import { PageTemplate } from '@/types/website';

/**
 * GET /api/website/templates
 * List custom templates for an organization
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId required' },
        { status: 400 }
      );
    }

    // Get custom templates for this org
    const templatesRef = db
      .collection('organizations')
      .doc(organizationId)
      .collection('website')
      .doc('config')
      .collection('templates');

    const snapshot = await templatesRef.get();
    const templates: PageTemplate[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      // CRITICAL: Double-check organizationId matches
      if (data.organizationId === organizationId) {
        templates.push({
          id: doc.id,
          ...data,
        } as PageTemplate);
      }
    });

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('[Templates API] GET error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/website/templates
 * Create a custom template from a page
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, template } = body;

    // CRITICAL: Validate organizationId
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId required' },
        { status: 400 }
      );
    }

    // Validate template data
    if (!template || !template.name || !template.content) {
      return NextResponse.json(
        { error: 'Invalid template data' },
        { status: 400 }
      );
    }

    // Create template document
    const templateData: PageTemplate = {
      id: `template_${Date.now()}`,
      organizationId, // CRITICAL: Set org ownership
      name: template.name,
      description: template.description || '',
      category: template.category || 'other',
      thumbnail: template.thumbnail,
      content: template.content,
      isPublic: template.isPublic || false,
      isPremium: false,
      createdAt: new Date().toISOString(),
      createdBy: template.createdBy || 'current-user', // TODO: Get from auth
      usageCount: 0,
    };

    // Save to Firestore
    const templateRef = db
      .collection('organizations')
      .doc(organizationId) // CRITICAL: Scoped to org
      .collection('website')
      .doc('config')
      .collection('templates')
      .doc(templateData.id);

    await templateRef.set(templateData);

    return NextResponse.json({ template: templateData }, { status: 201 });
  } catch (error) {
    console.error('[Templates API] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/website/templates/:id
 * Delete a custom template
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const templateId = searchParams.get('templateId');

    // CRITICAL: Validate organizationId
    if (!organizationId || !templateId) {
      return NextResponse.json(
        { error: 'organizationId and templateId required' },
        { status: 400 }
      );
    }

    // Delete template
    const templateRef = db
      .collection('organizations')
      .doc(organizationId) // CRITICAL: Scoped to org
      .collection('website')
      .doc('config')
      .collection('templates')
      .doc(templateId);

    // Verify template belongs to this org
    const templateDoc = await templateRef.get();
    if (!templateDoc.exists) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    const templateData = templateDoc.data();
    if (templateData?.organizationId !== organizationId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    await templateRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Templates API] DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete template' },
      { status: 500 }
    );
  }
}

