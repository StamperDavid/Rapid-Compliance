/**
 * EmailWriterCard Component
 * 
 * AI-powered sales email generator with:
 * - Email type selection (5 types)
 * - Recipient context input
 * - AI email generation
 * - Email editor with preview
 * - Copy to clipboard and send actions
 * 
 * Integrates with:
 * - Deal scoring for personalization
 * - Battlecards for competitive positioning
 * - Industry templates for best practices
 */

'use client';

import React, { useState, useCallback } from 'react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { 
  type EmailType, 
  type GeneratedEmail,
  getAllEmailTypes,
  getEmailTemplate,
} from '@/lib/email-writer';

// ============================================================================
// TYPES
// ============================================================================

interface EmailWriterCardProps {
  organizationId: string;
  workspaceId: string;
  userId: string;
  dealId?: string;
  onEmailSent?: (email: GeneratedEmail) => void;
}

interface EmailGenerationState {
  isGenerating: boolean;
  error: string | null;
  generatedEmail: GeneratedEmail | null;
  suggestedImprovements: string[];
}

// ============================================================================
// EMAIL WRITER CARD (WITHOUT ERROR BOUNDARY)
// ============================================================================

function EmailWriterCardInner({
  organizationId,
  workspaceId,
  userId,
  dealId: initialDealId,
  onEmailSent,
}: EmailWriterCardProps) {
  // State
  const [emailType, setEmailType] = useState<EmailType>('intro');
  const [dealId, setDealId] = useState(initialDealId ?? '');
  const [recipientName, setRecipientName] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientTitle, setRecipientTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [competitorDomain, setCompetitorDomain] = useState('');
  const [tone, setTone] = useState<'professional' | 'casual' | 'consultative' | 'urgent' | 'friendly'>('professional');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [includeCompetitive, setIncludeCompetitive] = useState(false);
  const [customInstructions, setCustomInstructions] = useState('');
  
  const [generationState, setGenerationState] = useState<EmailGenerationState>({
    isGenerating: false,
    error: null,
    generatedEmail: null,
    suggestedImprovements: [],
  });
  
  const [editedSubject, setEditedSubject] = useState('');
  const [editedBody, setEditedBody] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Get current template info
  const currentTemplate = getEmailTemplate(emailType);
  
  // ============================================================================
  // HANDLERS
  // ============================================================================
  
  /**
   * Generate email with AI
   */
  const handleGenerateEmail = useCallback(async () => {
    // Validation
    if (!dealId) {
      setGenerationState({
        isGenerating: false,
        error: 'Please select a deal',
        generatedEmail: null,
        suggestedImprovements: [],
      });
      return;
    }
    
    setGenerationState({
      isGenerating: true,
      error: null,
      generatedEmail: null,
      suggestedImprovements: [],
    });
    
    try {
      const response = await fetch('/api/email-writer/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          organizationId,
          workspaceId,
          userId,
          emailType,
          dealId,
          recipientName: recipientName || undefined,
          recipientEmail: recipientEmail || undefined,
          recipientTitle: recipientTitle || undefined,
          companyName: companyName || undefined,
          competitorDomain: competitorDomain || undefined,
          tone,
          length,
          includeCompetitive,
          customInstructions: customInstructions || undefined,
        }),
      });
      
      const data = await response.json() as {
        success?: boolean;
        email?: GeneratedEmail;
        error?: string;
        suggestedImprovements?: string[];
      };

      if (!response.ok) {
        throw new Error((data.error !== '' && data.error != null) ? data.error : 'Failed to generate email');
      }

      if (!data.success || !data.email) {
        throw new Error((data.error !== '' && data.error != null) ? data.error : 'No email generated');
      }
      
      setGenerationState({
        isGenerating: false,
        error: null,
        generatedEmail: data.email,
        suggestedImprovements:data.suggestedImprovements ?? [],
      });
      
      // Pre-fill editor
      setEditedSubject(data.email.subject);
      setEditedBody(data.email.bodyPlain);
      setIsEditing(false);
      
    } catch (error) {
      setGenerationState({
        isGenerating: false,
        error: error instanceof Error ? error.message : 'Failed to generate email',
        generatedEmail: null,
        suggestedImprovements: [],
      });
    }
  }, [
    organizationId,
    workspaceId,
    userId,
    emailType,
    dealId,
    recipientName,
    recipientEmail,
    recipientTitle,
    companyName,
    competitorDomain,
    tone,
    length,
    includeCompetitive,
    customInstructions,
  ]);
  
  /**
   * Copy email to clipboard
   */
  const handleCopyEmail = useCallback(() => {
    const emailText = `Subject: ${editedSubject}\n\n${editedBody}`;
    void navigator.clipboard.writeText(emailText);
    // TODO: Show toast notification
  }, [editedSubject, editedBody]);
  
  /**
   * Mark as sent (future: actually send email)
   */
  const handleSendEmail = useCallback(() => {
    if (generationState.generatedEmail) {
      onEmailSent?.(generationState.generatedEmail);
      // TODO: Implement actual email sending
      // TODO: Emit email.sent signal
    }
  }, [generationState.generatedEmail, onEmailSent]);
  
  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-white">AI Email Writer</h2>
          <p className="text-sm text-gray-400 mt-1">
            Generate personalized sales emails powered by deal scoring and battlecards
          </p>
        </div>
        <div className="text-3xl">✉️</div>
      </div>
      
      {/* Email Type Selection */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-300">
          Email Type
        </label>
        <div className="grid grid-cols-5 gap-2">
          {getAllEmailTypes().map((type) => {
            const template = getEmailTemplate(type);
            return (
              <button
                key={type}
                onClick={() => setEmailType(type)}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  emailType === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                }`}
              >
                {template.name.split(' ')[0]}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 mt-1">
          {currentTemplate.description}
        </p>
      </div>
      
      {/* Deal Context */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Deal ID *
          </label>
          <input
            type="text"
            value={dealId}
            onChange={(e) => setDealId(e.target.value)}
            placeholder="deal_123"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Company Name
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Corp"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      {/* Recipient Context */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Recipient Name
          </label>
          <input
            type="text"
            value={recipientName}
            onChange={(e) => setRecipientName(e.target.value)}
            placeholder="John Doe"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Email
          </label>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value)}
            placeholder="john@acme.com"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Title
          </label>
          <input
            type="text"
            value={recipientTitle}
            onChange={(e) => setRecipientTitle(e.target.value)}
            placeholder="VP of Sales"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      {/* Email Customization */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tone
          </label>
          <select
            value={tone}
            onChange={(e) => setTone(e.target.value as typeof tone)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="consultative">Consultative</option>
            <option value="urgent">Urgent</option>
            <option value="friendly">Friendly</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Length
          </label>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as typeof length)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="short">Short (50-100 words)</option>
            <option value="medium">Medium (100-200 words)</option>
            <option value="long">Long (200-300 words)</option>
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Competitor (optional)
          </label>
          <input
            type="url"
            value={competitorDomain}
            onChange={(e) => setCompetitorDomain(e.target.value)}
            placeholder="https://competitor.com"
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      {/* Competitive Positioning */}
      <div className="flex items-center">
        <input
          type="checkbox"
          id="includeCompetitive"
          checked={includeCompetitive}
          onChange={(e) => setIncludeCompetitive(e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-600 rounded bg-gray-800"
        />
        <label htmlFor="includeCompetitive" className="ml-2 text-sm text-gray-300">
          Include competitive positioning (requires competitor domain)
        </label>
      </div>
      
      {/* Custom Instructions */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Custom Instructions (optional)
        </label>
        <textarea
          value={customInstructions}
          onChange={(e) => setCustomInstructions(e.target.value)}
          placeholder="Add any specific requirements or context for the email..."
          rows={3}
          maxLength={1000}
          className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
        />
        <p className="text-xs text-gray-500 mt-1">
          {customInstructions.length}/1000 characters
        </p>
      </div>
      
      {/* Generate Button */}
      <button
        onClick={() => { void handleGenerateEmail(); }}
        disabled={generationState.isGenerating || !dealId}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors"
      >
        {generationState.isGenerating ? (
          <span className="flex items-center justify-center">
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Generating Email...
          </span>
        ) : (
          'Generate Email with AI'
        )}
      </button>
      
      {/* Error Message */}
      {generationState.error && (
        <div className="p-4 bg-red-900/20 border border-red-700 rounded-md">
          <p className="text-sm text-red-400">
            ❌ {generationState.error}
          </p>
        </div>
      )}
      
      {/* Generated Email */}
      {generationState.generatedEmail && (
        <div className="space-y-4 pt-4 border-t border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">Generated Email</h3>
            <div className="flex gap-2">
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors"
              >
                {isEditing ? 'Preview' : 'Edit'}
              </button>
              <button
                onClick={handleCopyEmail}
                className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md transition-colors"
              >
                📋 Copy
              </button>
              <button
                onClick={handleSendEmail}
                className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
              >
                📧 Send
              </button>
            </div>
          </div>
          
          {/* Email Content */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Subject:
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              ) : (
                <p className="text-white font-medium">{editedSubject}</p>
              )}
            </div>
            
            {/* Body */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">
                Body:
              </label>
              {isEditing ? (
                <textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={12}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-sm"
                />
              ) : (
                <div className="text-gray-300 whitespace-pre-wrap">
                  {editedBody}
                </div>
              )}
            </div>
          </div>
          
          {/* Metadata */}
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Email Type</p>
              <p className="text-white font-medium">{generationState.generatedEmail.emailType}</p>
            </div>
            <div>
              <p className="text-gray-500">Deal Score</p>
              <p className="text-white font-medium">
                {generationState.generatedEmail.dealScore ?? 'N/A'}
                {generationState.generatedEmail.dealTier && (
                  <span className="ml-1 text-xs text-gray-400">
                    ({generationState.generatedEmail.dealTier})
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-gray-500">Tone</p>
              <p className="text-white font-medium capitalize">{generationState.generatedEmail.tone}</p>
            </div>
            <div>
              <p className="text-gray-500">Tokens Used</p>
              <p className="text-white font-medium">{generationState.generatedEmail.totalTokens}</p>
            </div>
          </div>
          
          {/* Improvement Suggestions */}
          {generationState.suggestedImprovements.length > 0 && (
            <div className="p-4 bg-blue-900/20 border border-blue-700 rounded-md">
              <p className="text-sm font-medium text-blue-400 mb-2">
                💡 Suggested Improvements:
              </p>
              <ul className="text-sm text-blue-300 space-y-1">
                {generationState.suggestedImprovements.map((suggestion, index) => (
                  <li key={index}>• {suggestion}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EMAIL WRITER CARD (WITH ERROR BOUNDARY)
// ============================================================================

/**
 * EmailWriterCard - Wrapped with ErrorBoundary
 */
export function EmailWriterCard(props: EmailWriterCardProps) {
  return (
    <ErrorBoundary
      componentName="EmailWriterCard"
      fallback={
        <div className="bg-gray-900 border border-red-700 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-3xl">⚠️</div>
            <div>
              <h3 className="text-lg font-semibold text-red-400">
                Email Writer Error
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Failed to load email writer component
              </p>
            </div>
          </div>
          
          <div className="bg-red-900/20 border border-red-800 rounded p-3 mb-4">
            <p className="text-sm text-red-300">
              An unexpected error occurred. Please try refreshing the page.
            </p>
          </div>
          
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm transition-colors"
          >
            Reload Page
          </button>
        </div>
      }
    >
      <EmailWriterCardInner {...props} />
    </ErrorBoundary>
  );
}
