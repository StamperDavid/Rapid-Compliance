/**
 * Public Contact Form API
 *
 * Receives contact form submissions and sends notification email.
 * No authentication required — this is a public endpoint.
 * Rate limited to prevent abuse.
 *
 * @route POST /api/public/contact - Submit contact form
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { sendEmail } from '@/lib/email/email-service';
import { z } from 'zod';
import { db } from '@/lib/firebase/config';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getSubCollection } from '@/lib/firebase/collections';

const ContactFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Valid email is required').max(320),
  company: z.string().max(200).optional().default(''),
  message: z.string().min(1, 'Message is required').max(5000),
});

export async function POST(request: NextRequest) {
  // Rate limit: public endpoint
  const rateLimitResult = await rateLimitMiddleware(request, 'contact-form');
  if (rateLimitResult) { return rateLimitResult; }

  try {
    const body: unknown = await request.json();
    const parsed = ContactFormSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid form data', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, company, message } = parsed.data;

    // Store submission in Firestore for record-keeping
    if (db) {
      const submissionsPath = getSubCollection('contactSubmissions');
      await addDoc(collection(db, submissionsPath), {
        name,
        email,
        company,
        message,
        submittedAt: serverTimestamp(),
        ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown',
        status: 'new',
      });
    }

    // Send notification email to platform owner
    const notificationHtml = `
      <h2>New Contact Form Submission</h2>
      <table style="border-collapse:collapse;width:100%;max-width:600px;">
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(email)}</td></tr>
        ${company ? `<tr><td style="padding:8px;font-weight:bold;border-bottom:1px solid #eee;">Company</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(company)}</td></tr>` : ''}
        <tr><td style="padding:8px;font-weight:bold;vertical-align:top;">Message</td><td style="padding:8px;white-space:pre-wrap;">${escapeHtml(message)}</td></tr>
      </table>
    `;

    const emailResult = await sendEmail({
      to: process.env.FROM_EMAIL ?? 'support@salesvelocity.ai',
      subject: `Contact Form: ${name}${company ? ` (${company})` : ''}`,
      html: notificationHtml,
      text: `New contact form submission:\n\nName: ${name}\nEmail: ${email}\nCompany: ${company || 'N/A'}\nMessage: ${message}`,
      replyTo: email,
    });

    if (!emailResult.success) {
      logger.warn('Contact form email failed to send, but submission was saved', {
        emailError: emailResult.error,
        contactEmail: email,
      });
    }

    logger.info('Contact form submitted', { email, company, emailSent: emailResult.success });

    return NextResponse.json({ success: true });
  } catch (err) {
    logger.error('Contact form submission failed', err instanceof Error ? err : new Error(String(err)));
    return NextResponse.json(
      { error: 'Failed to process contact form submission' },
      { status: 500 }
    );
  }
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
