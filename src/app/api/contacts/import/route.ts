/**
 * POST /api/contacts/import
 *
 * Bulk-import contacts from a parsed CSV. Modeled on
 * `src/app/api/leads/import/route.ts`: validates each row independently,
 * never throws on a single bad row, and returns a structured
 * { created, skipped, errors } summary.
 *
 * Body (see `importBodySchema`): { rows | csvText, mapping } where `mapping`
 * is originalCsvHeader -> target Contact field.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createContact, type Contact } from '@/lib/crm/contact-service';
import { logger } from '@/lib/logger/logger';
import { requireRole } from '@/lib/auth/api-auth';
import {
  importBodySchema,
  parseImportBody,
  applyMapping,
  splitTags,
  zodMessage,
  type ImportSummary,
} from '@/lib/crm/csv-import-helpers';

export const dynamic = 'force-dynamic';

// Target fields the importer understands → exposed to the modal for auto-match.
const contactRowSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  name: z.string().min(1).optional(),
  email: z.string().email('looks like an invalid email address').optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  department: z.string().optional(),
  website: z.string().optional(),
  linkedInUrl: z.string().optional(),
  twitterHandle: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
}).refine(
  (r) => Boolean(r.name ?? r.firstName ?? r.lastName ?? r.email),
  { message: 'a contact needs at least a name or an email address' }
);

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireRole(request, ['owner', 'admin', 'manager']);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json();
    const parsedBody = importBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: 'Invalid import request', details: parsedBody.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    let sourceRows: Record<string, string>[];
    try {
      sourceRows = parseImportBody(parsedBody.data);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'No rows to import' },
        { status: 422 }
      );
    }

    if (sourceRows.length === 0) {
      return NextResponse.json({ error: 'The file has no data rows to import' }, { status: 422 });
    }

    const summary: ImportSummary = {
      total: sourceRows.length,
      created: 0,
      skipped: 0,
      errors: [],
    };

    const seenEmails = new Set<string>();

    for (let i = 0; i < sourceRows.length; i++) {
      const rowNumber = i + 2; // +2: row 1 is the header
      const mapped = applyMapping(sourceRows[i], parsedBody.data.mapping);

      const parsed = contactRowSchema.safeParse(mapped);
      if (!parsed.success) {
        summary.skipped++;
        summary.errors.push({ row: rowNumber, message: zodMessage(parsed.error) });
        continue;
      }

      const data = parsed.data;

      // Skip duplicate emails within the same import (only when an email exists).
      const emailKey = data.email?.toLowerCase();
      if (emailKey) {
        if (seenEmails.has(emailKey)) {
          summary.skipped++;
          summary.errors.push({ row: rowNumber, message: `Duplicate email "${data.email}" in this file — row skipped` });
          continue;
        }
        seenEmails.add(emailKey);
      }

      const contactInput: Omit<Contact, 'id' | 'createdAt'> = {
        firstName: data.firstName,
        lastName: data.lastName,
        name: data.name,
        email: data.email,
        phone: data.phone,
        company: data.company,
        title: data.title,
        department: data.department,
        website: data.website,
        linkedInUrl: data.linkedInUrl,
        twitterHandle: data.twitterHandle,
        notes: data.notes,
        tags: splitTags(data.tags),
      };

      try {
        await createContact(contactInput);
        summary.created++;
      } catch (createError) {
        const reason = createError instanceof Error ? createError.message : String(createError);
        summary.skipped++;
        summary.errors.push({ row: rowNumber, message: `Could not save this contact: ${reason}` });
        logger.error(
          'CSV contact import: create failed',
          createError instanceof Error ? createError : new Error(String(createError)),
          { file: 'contacts/import/route.ts', row: rowNumber }
        );
      }
    }

    logger.info('CSV contact import completed', {
      file: 'contacts/import/route.ts',
      total: summary.total,
      created: summary.created,
      skipped: summary.skipped,
    });

    return NextResponse.json(summary, { status: 200 });
  } catch (error: unknown) {
    logger.error(
      'CSV contact import failed unexpectedly',
      error instanceof Error ? error : new Error(String(error)),
      { file: 'contacts/import/route.ts' }
    );
    const message = error instanceof Error ? error.message : 'Contact import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
