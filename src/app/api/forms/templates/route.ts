/**
 * Form Templates API
 * GET /api/forms/templates — List all form templates from Firestore
 *
 * Templates are stored in the `formTemplates` collection and include
 * full field definitions, settings, and metadata.
 */

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import type { FormFieldType } from '@/lib/forms/types';

export const dynamic = 'force-dynamic';

/** Template field definition for seeding */
interface TemplateFieldDef {
  type: FormFieldType;
  label: string;
  name: string;
  placeholder?: string;
  helpText?: string;
  order: number;
  pageIndex: number;
  width: 'full' | 'half' | 'third' | 'quarter';
  validation?: {
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    customMessage?: string;
    maxFileSize?: number;
    allowedFileTypes?: string[];
    maxFiles?: number;
  };
  options?: Array<{ label: string; value: string }>;
}

/** Stored form template */
interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  iconName: string;
  fields: TemplateFieldDef[];
  settings: {
    submitButtonText: string;
    confirmationType: 'message' | 'redirect';
    confirmationMessage?: string;
  };
  createdAt: string;
  updatedAt: string;
}

/**
 * Default templates — used for seeding if the Firestore collection is empty.
 */
const DEFAULT_TEMPLATES: FormTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Form',
    description: 'Start from scratch with a blank form',
    category: 'Basic',
    iconName: 'FileText',
    fields: [],
    settings: {
      submitButtonText: 'Submit',
      confirmationType: 'message',
      confirmationMessage: 'Thank you for your submission!',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'contact',
    name: 'Contact Form',
    description: 'Simple contact form with name, email, and message',
    category: 'Basic',
    iconName: 'Mail',
    fields: [
      { type: 'name', label: 'Full Name', name: 'fullName', placeholder: 'John Doe', order: 0, pageIndex: 0, width: 'full', validation: { required: true, minLength: 2, maxLength: 100 } },
      { type: 'email', label: 'Email Address', name: 'email', placeholder: 'john@example.com', order: 1, pageIndex: 0, width: 'half', validation: { required: true } },
      { type: 'phone', label: 'Phone Number', name: 'phone', placeholder: '+1 (555) 123-4567', order: 2, pageIndex: 0, width: 'half' },
      { type: 'textarea', label: 'Message', name: 'message', placeholder: 'How can we help you?', order: 3, pageIndex: 0, width: 'full', validation: { required: true, minLength: 10, maxLength: 2000 } },
    ],
    settings: {
      submitButtonText: 'Send Message',
      confirmationType: 'message',
      confirmationMessage: 'Thank you for reaching out! We\'ll get back to you within 24 hours.',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lead-capture',
    name: 'Lead Capture',
    description: 'Capture leads with company and qualification fields',
    category: 'Sales',
    iconName: 'Target',
    fields: [
      { type: 'text', label: 'First Name', name: 'firstName', placeholder: 'John', order: 0, pageIndex: 0, width: 'half', validation: { required: true } },
      { type: 'text', label: 'Last Name', name: 'lastName', placeholder: 'Doe', order: 1, pageIndex: 0, width: 'half', validation: { required: true } },
      { type: 'email', label: 'Work Email', name: 'workEmail', placeholder: 'john@company.com', order: 2, pageIndex: 0, width: 'half', validation: { required: true } },
      { type: 'phone', label: 'Phone', name: 'phone', placeholder: '+1 (555) 123-4567', order: 3, pageIndex: 0, width: 'half' },
      { type: 'text', label: 'Company Name', name: 'company', placeholder: 'Acme Inc.', order: 4, pageIndex: 0, width: 'half', validation: { required: true } },
      { type: 'text', label: 'Job Title', name: 'jobTitle', placeholder: 'Marketing Director', order: 5, pageIndex: 0, width: 'half' },
      { type: 'dropdown', label: 'Company Size', name: 'companySize', order: 6, pageIndex: 0, width: 'half', options: [
        { label: '1-10 employees', value: '1-10' },
        { label: '11-50 employees', value: '11-50' },
        { label: '51-200 employees', value: '51-200' },
        { label: '201-1000 employees', value: '201-1000' },
        { label: '1000+ employees', value: '1000+' },
      ] },
      { type: 'dropdown', label: 'Budget Range', name: 'budget', order: 7, pageIndex: 0, width: 'half', options: [
        { label: 'Under $5,000', value: 'under-5k' },
        { label: '$5,000 - $25,000', value: '5k-25k' },
        { label: '$25,000 - $100,000', value: '25k-100k' },
        { label: 'Over $100,000', value: 'over-100k' },
      ] },
      { type: 'textarea', label: 'How can we help?', name: 'notes', placeholder: 'Tell us about your needs...', order: 8, pageIndex: 0, width: 'full', validation: { maxLength: 1000 } },
    ],
    settings: {
      submitButtonText: 'Get Started',
      confirmationType: 'message',
      confirmationMessage: 'Thanks! A member of our team will be in touch shortly.',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'survey',
    name: 'Customer Survey',
    description: 'Multi-step survey with rating and feedback',
    category: 'Feedback',
    iconName: 'BarChart3',
    fields: [
      { type: 'heading', label: 'Overall Experience', name: 'heading1', order: 0, pageIndex: 0, width: 'full' },
      { type: 'rating', label: 'How would you rate your overall experience?', name: 'overallRating', order: 1, pageIndex: 0, width: 'full', validation: { required: true } },
      { type: 'scale', label: 'How likely are you to recommend us? (1-10)', name: 'npsScore', order: 2, pageIndex: 0, width: 'full', validation: { required: true, min: 1, max: 10 } },
      { type: 'pagebreak', label: 'Page Break', name: 'pagebreak1', order: 3, pageIndex: 0, width: 'full' },
      { type: 'heading', label: 'Detailed Feedback', name: 'heading2', order: 4, pageIndex: 1, width: 'full' },
      { type: 'radio', label: 'What did you like most?', name: 'bestAspect', order: 5, pageIndex: 1, width: 'full', options: [
        { label: 'Product quality', value: 'quality' },
        { label: 'Customer service', value: 'service' },
        { label: 'Pricing', value: 'pricing' },
        { label: 'Speed of delivery', value: 'delivery' },
        { label: 'Other', value: 'other' },
      ] },
      { type: 'textarea', label: 'Any additional feedback?', name: 'additionalFeedback', placeholder: 'Share your thoughts...', order: 6, pageIndex: 1, width: 'full', validation: { maxLength: 2000 } },
      { type: 'email', label: 'Email (optional — for follow-up)', name: 'email', placeholder: 'you@example.com', order: 7, pageIndex: 1, width: 'full' },
    ],
    settings: {
      submitButtonText: 'Submit Survey',
      confirmationType: 'message',
      confirmationMessage: 'Thank you for your feedback! Your input helps us improve.',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'registration',
    name: 'Event Registration',
    description: 'Event signup with attendee details',
    category: 'Events',
    iconName: 'Calendar',
    fields: [
      { type: 'text', label: 'First Name', name: 'firstName', placeholder: 'John', order: 0, pageIndex: 0, width: 'half', validation: { required: true } },
      { type: 'text', label: 'Last Name', name: 'lastName', placeholder: 'Doe', order: 1, pageIndex: 0, width: 'half', validation: { required: true } },
      { type: 'email', label: 'Email', name: 'email', placeholder: 'john@example.com', order: 2, pageIndex: 0, width: 'half', validation: { required: true } },
      { type: 'phone', label: 'Phone', name: 'phone', placeholder: '+1 (555) 123-4567', order: 3, pageIndex: 0, width: 'half', validation: { required: true } },
      { type: 'text', label: 'Company / Organization', name: 'company', placeholder: 'Acme Inc.', order: 4, pageIndex: 0, width: 'full' },
      { type: 'dropdown', label: 'Ticket Type', name: 'ticketType', order: 5, pageIndex: 0, width: 'half', validation: { required: true }, options: [
        { label: 'General Admission', value: 'general' },
        { label: 'VIP', value: 'vip' },
        { label: 'Virtual', value: 'virtual' },
      ] },
      { type: 'number', label: 'Number of Attendees', name: 'attendeeCount', placeholder: '1', order: 6, pageIndex: 0, width: 'half', validation: { required: true, min: 1, max: 20 } },
      { type: 'checkbox', label: 'Dietary Requirements', name: 'dietary', order: 7, pageIndex: 0, width: 'full', options: [
        { label: 'Vegetarian', value: 'vegetarian' },
        { label: 'Vegan', value: 'vegan' },
        { label: 'Gluten-free', value: 'gluten-free' },
        { label: 'Halal', value: 'halal' },
        { label: 'None', value: 'none' },
      ] },
      { type: 'textarea', label: 'Special Requests', name: 'specialRequests', placeholder: 'Any accessibility or special requirements...', order: 8, pageIndex: 0, width: 'full', validation: { maxLength: 500 } },
    ],
    settings: {
      submitButtonText: 'Register Now',
      confirmationType: 'message',
      confirmationMessage: 'You\'re registered! Check your email for confirmation details.',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'application',
    name: 'Job Application',
    description: 'Application form with file uploads',
    category: 'HR',
    iconName: 'Briefcase',
    fields: [
      { type: 'text', label: 'Full Name', name: 'fullName', placeholder: 'John Doe', order: 0, pageIndex: 0, width: 'full', validation: { required: true } },
      { type: 'email', label: 'Email Address', name: 'email', placeholder: 'john@example.com', order: 1, pageIndex: 0, width: 'half', validation: { required: true } },
      { type: 'phone', label: 'Phone Number', name: 'phone', placeholder: '+1 (555) 123-4567', order: 2, pageIndex: 0, width: 'half', validation: { required: true } },
      { type: 'text', label: 'Position Applied For', name: 'position', placeholder: 'Software Engineer', order: 3, pageIndex: 0, width: 'full', validation: { required: true } },
      { type: 'text', label: 'LinkedIn Profile', name: 'linkedin', placeholder: 'https://linkedin.com/in/...', order: 4, pageIndex: 0, width: 'full' },
      { type: 'file', label: 'Resume / CV', name: 'resume', helpText: 'PDF, DOC, or DOCX (max 10MB)', order: 5, pageIndex: 0, width: 'full', validation: { required: true, maxFileSize: 10485760, allowedFileTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] } },
      { type: 'file', label: 'Cover Letter (optional)', name: 'coverLetter', helpText: 'PDF or DOC (max 5MB)', order: 6, pageIndex: 0, width: 'full', validation: { maxFileSize: 5242880, allowedFileTypes: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] } },
      { type: 'textarea', label: 'Why do you want to join our team?', name: 'motivation', placeholder: 'Tell us about yourself and why you\'re excited about this role...', order: 7, pageIndex: 0, width: 'full', validation: { required: true, minLength: 50, maxLength: 3000 } },
      { type: 'dropdown', label: 'How did you hear about us?', name: 'referralSource', order: 8, pageIndex: 0, width: 'full', options: [
        { label: 'Job Board (Indeed, LinkedIn, etc.)', value: 'job-board' },
        { label: 'Company Website', value: 'website' },
        { label: 'Employee Referral', value: 'referral' },
        { label: 'Social Media', value: 'social' },
        { label: 'Other', value: 'other' },
      ] },
    ],
    settings: {
      submitButtonText: 'Submit Application',
      confirmationType: 'message',
      confirmationMessage: 'Thank you for applying! We\'ll review your application and get back to you within 5 business days.',
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

/**
 * GET /api/forms/templates
 * Returns all form templates. Seeds Firestore with defaults on first call.
 */
export async function GET() {
  try {
    if (!adminDb) {
      logger.warn('[Form Templates] Admin Firestore not initialized — returning defaults', { route: '/api/forms/templates' });
      return NextResponse.json({ templates: DEFAULT_TEMPLATES });
    }

    const collectionPath = getSubCollection('formTemplates');
    const snapshot = await adminDb.collection(collectionPath).orderBy('name').get();

    // If empty, seed with defaults
    if (snapshot.empty) {
      logger.info('[Form Templates] Seeding default templates to Firestore', { route: '/api/forms/templates' });

      const batch = adminDb.batch();
      for (const template of DEFAULT_TEMPLATES) {
        batch.set(adminDb.collection(collectionPath).doc(template.id), template);
      }
      await batch.commit();

      return NextResponse.json({ templates: DEFAULT_TEMPLATES });
    }

    const templates = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ templates });
  } catch (error) {
    logger.error(
      '[Form Templates] Failed to fetch templates',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/forms/templates' },
    );
    // Fallback to default templates if Firestore fails
    return NextResponse.json({ templates: DEFAULT_TEMPLATES });
  }
}
