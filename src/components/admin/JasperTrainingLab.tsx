'use client';

/**
 * Jasper Training Lab
 * Comprehensive training interface for Jasper (the AI orchestrator)
 *
 * Features:
 * - Persona configuration (name, tone, system prompt)
 * - Specialist Instructions (27 specialists management)
 * - Training Examples (input/output pairs for fine-tuning)
 * - Knowledge Base upload and management
 * - Test Chat interface for conversation simulation
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface JasperTrainingLabProps {
}

interface PersonaConfig {
  name: string;
  title: string;
  tone: 'professional' | 'friendly' | 'authoritative' | 'casual';
  systemPrompt: string;
}

interface SpecialistInstruction {
  specialistId: string;
  customInstructions: string;
  isEnabled: boolean;
  priority: number;
}

interface TrainingExample {
  id: string;
  userInput: string;
  expectedResponse: string;
  category: string;
  tags: string[];
}

interface KnowledgeBaseDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  uploadedAt: Date;
  fileSize: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ============================================================================
// SPECIALIST REGISTRY - 27 Specialists
// ============================================================================

const SPECIALIST_REGISTRY = [
  // Intelligence Specialists (3)
  { id: 'competitor_researcher', name: 'Competitor Researcher', category: 'Intelligence', description: 'Market intelligence and competitive analysis' },
  { id: 'sentiment_analyst', name: 'Sentiment Analyst', category: 'Intelligence', description: 'Sentiment analysis and emotional intelligence' },
  { id: 'technographic_scout', name: 'Technographic Scout', category: 'Intelligence', description: 'Technology stack detection and analysis' },

  // Marketing Specialists (5)
  { id: 'tiktok_expert', name: 'TikTok Expert', category: 'Marketing', description: 'TikTok content strategy and execution' },
  { id: 'x_expert', name: 'X (Twitter) Expert', category: 'Marketing', description: 'X/Twitter social media management' },
  { id: 'facebook_ads_expert', name: 'Facebook Ads Expert', category: 'Marketing', description: 'Facebook advertising campaigns' },
  { id: 'linkedin_expert', name: 'LinkedIn Expert', category: 'Marketing', description: 'LinkedIn B2B marketing strategy' },
  { id: 'seo_expert', name: 'SEO Expert', category: 'Marketing', description: 'Search engine optimization and content ranking' },

  // Builder Specialists (3)
  { id: 'ux_ui_architect', name: 'UX/UI Architect', category: 'Builder', description: 'User experience and interface design' },
  { id: 'funnel_engineer', name: 'Funnel Engineer', category: 'Builder', description: 'Conversion funnel optimization' },
  { id: 'asset_generator', name: 'Asset Generator', category: 'Builder', description: 'Visual and media asset creation' },

  // Commerce Specialists (2)
  { id: 'pricing_strategist', name: 'Pricing Strategist', category: 'Commerce', description: 'Pricing models and revenue optimization' },
  { id: 'inventory_manager', name: 'Inventory Manager', category: 'Commerce', description: 'Inventory tracking and management' },

  // Outreach Specialists (2)
  { id: 'email_specialist', name: 'Email Specialist', category: 'Outreach', description: 'Email campaign execution and deliverability' },
  { id: 'sms_specialist', name: 'SMS Specialist', category: 'Outreach', description: 'SMS messaging and compliance' },

  // Content Specialists (2)
  { id: 'copywriter', name: 'Copywriter', category: 'Content', description: 'Content creation and messaging' },
  { id: 'calendar_coordinator', name: 'Calendar Coordinator', category: 'Content', description: 'Content calendar and scheduling' },

  // Sales Specialists (3)
  { id: 'outreach_specialist', name: 'Outreach Specialist', category: 'Sales', description: 'Personalized outreach message generation' },
  { id: 'lead_qualifier', name: 'Lead Qualifier', category: 'Sales', description: 'BANT scoring and lead qualification' },
  { id: 'merchandiser', name: 'Merchandiser', category: 'Sales', description: 'Discount strategy and coupon management' },

  // Trust Specialists (2)
  { id: 'gmb_specialist', name: 'GMB Specialist', category: 'Trust', description: 'Google My Business optimization' },
  { id: 'review_specialist', name: 'Review Specialist', category: 'Trust', description: 'Review management and response' },

  // Architect Specialists (3)
  { id: 'copy_architect', name: 'Copy Architect', category: 'Architect', description: 'Messaging architecture and positioning' },
  { id: 'funnel_architect', name: 'Funnel Architect', category: 'Architect', description: 'Funnel design and strategy' },
  { id: 'ux_ui_designer', name: 'UX/UI Designer', category: 'Architect', description: 'Design systems and patterns' },

  // Intelligence Specialist (1)
  { id: 'scraper_specialist', name: 'Scraper Specialist', category: 'Intelligence', description: 'Web scraping and data extraction' },
] as const;

// ============================================================================
// PERSONA EDITOR COMPONENT
// ============================================================================

const PersonaEditor = React.memo<{ persona: PersonaConfig; onSave: (persona: PersonaConfig) => void }>(
  ({ persona, onSave }) => {
    const [localPersona, setLocalPersona] = useState<PersonaConfig>(persona);
    const [isSaving, setIsSaving] = useState(false);

    const handleSave = useCallback(async () => {
      setIsSaving(true);
      try {
        await new Promise((resolve) => { setTimeout(resolve, 500); }); // Simulate API call
        onSave(localPersona);
      } finally {
        setIsSaving(false);
      }
    }, [localPersona, onSave]);

    const handleFieldChange = useCallback(<K extends keyof PersonaConfig>(
      field: K,
      value: PersonaConfig[K]
    ) => {
      setLocalPersona((prev) => ({ ...prev, [field]: value }));
    }, []);

    return (
      <Card>
        <CardHeader>
          <CardTitle>Persona Configuration</CardTitle>
          <CardDescription>
            Define Jasper&apos;s personality, tone, and base instructions
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="persona-name">Persona Name</Label>
              <Input
                id="persona-name"
                value={localPersona.name}
                onChange={(e) => handleFieldChange('name', e.target.value)}
                placeholder="e.g., Jasper AI Assistant"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="persona-title">Title/Role</Label>
              <Input
                id="persona-title"
                value={localPersona.title}
                onChange={(e) => handleFieldChange('title', e.target.value)}
                placeholder="e.g., AI Sales Orchestrator"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="persona-tone">Communication Tone</Label>
            <Select
              value={localPersona.tone}
              onValueChange={(value) => handleFieldChange('tone', value as PersonaConfig['tone'])}
            >
              <SelectTrigger id="persona-tone">
                <SelectValue placeholder="Select a tone" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professional">Professional - Formal, business-focused</SelectItem>
                <SelectItem value="friendly">Friendly - Warm, approachable</SelectItem>
                <SelectItem value="authoritative">Authoritative - Expert, confident</SelectItem>
                <SelectItem value="casual">Casual - Relaxed, conversational</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="persona-system-prompt">System Prompt</Label>
            <Textarea
              id="persona-system-prompt"
              value={localPersona.systemPrompt}
              onChange={(e) => handleFieldChange('systemPrompt', e.target.value)}
              placeholder="Enter the base system prompt that defines Jasper's behavior..."
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              This prompt is used as the foundation for all Jasper interactions. It defines the AI&apos;s core behavior, knowledge, and constraints.
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => setLocalPersona(persona)}
            >
              Reset
            </Button>
            <Button
              onClick={() => { void handleSave(); }}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Persona'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
);
PersonaEditor.displayName = 'PersonaEditor';

// ============================================================================
// SPECIALIST INSTRUCTIONS COMPONENT
// ============================================================================

const SpecialistInstructions = React.memo<{
  specialists: SpecialistInstruction[];
  onUpdate: (instructions: SpecialistInstruction[]) => void;
}>(({ specialists, onUpdate }) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedSpecialistId, setSelectedSpecialistId] = useState<string | null>(null);
  const [editingInstructions, setEditingInstructions] = useState<string>('');
  const [editingPriority, setEditingPriority] = useState<number>(50);
  const [editingEnabled, setEditingEnabled] = useState<boolean>(true);

  const categories = useMemo(() => {
    const cats = new Set(SPECIALIST_REGISTRY.map((s) => s.category));
    return ['All', ...Array.from(cats)];
  }, []);

  const filteredSpecialists = useMemo(() => {
    if (selectedCategory === 'All') {
      return SPECIALIST_REGISTRY;
    }
    return SPECIALIST_REGISTRY.filter((s) => s.category === selectedCategory);
  }, [selectedCategory]);

  const selectedSpecialist = useMemo(() => {
    if (!selectedSpecialistId) {return null;}
    return SPECIALIST_REGISTRY.find((s) => s.id === selectedSpecialistId) ?? null;
  }, [selectedSpecialistId]);


  const handleSelectSpecialist = useCallback((specialistId: string) => {
    setSelectedSpecialistId(specialistId);
    const instruction = specialists.find((s) => s.specialistId === specialistId);
    if (instruction) {
      setEditingInstructions(instruction.customInstructions);
      setEditingPriority(instruction.priority);
      setEditingEnabled(instruction.isEnabled);
    } else {
      setEditingInstructions('');
      setEditingPriority(50);
      setEditingEnabled(true);
    }
  }, [specialists]);

  const handleSaveInstructions = useCallback(() => {
    if (!selectedSpecialistId) {return;}

    const updatedInstructions = [...specialists];
    const existingIndex = updatedInstructions.findIndex((s) => s.specialistId === selectedSpecialistId);

    const newInstruction: SpecialistInstruction = {
      specialistId: selectedSpecialistId,
      customInstructions: editingInstructions,
      isEnabled: editingEnabled,
      priority: editingPriority,
    };

    if (existingIndex >= 0) {
      updatedInstructions[existingIndex] = newInstruction;
    } else {
      updatedInstructions.push(newInstruction);
    }

    onUpdate(updatedInstructions);
  }, [selectedSpecialistId, editingInstructions, editingEnabled, editingPriority, specialists, onUpdate]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Specialist Instructions</CardTitle>
        <CardDescription>
          Customize instructions for each of the 27 specialists in the swarm
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-12 gap-4">
          {/* Specialist List */}
          <div className="col-span-4 space-y-4">
            <div>
              <Label>Filter by Category</Label>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border rounded-md" style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {filteredSpecialists.map((spec) => {
                const instruction = specialists.find((s) => s.specialistId === spec.id);
                const isSelected = selectedSpecialistId === spec.id;

                return (
                  <button
                    key={spec.id}
                    onClick={() => handleSelectSpecialist(spec.id)}
                    className="w-full text-left p-3 border-b transition-colors"
                    style={{
                      backgroundColor: isSelected ? 'var(--color-primary-bg)' : 'transparent',
                      borderLeftWidth: isSelected ? '3px' : '0',
                      borderLeftColor: isSelected ? 'var(--color-primary)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-sm">{spec.name}</span>
                      {instruction && (
                        <Badge variant={instruction.isEnabled ? 'default' : 'outline'} className="text-xs">
                          {instruction.isEnabled ? 'Active' : 'Disabled'}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {spec.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Instructions Editor */}
          <div className="col-span-8 space-y-4">
            {selectedSpecialist ? (
              <>
                <div>
                  <h3 className="text-lg font-semibold">{selectedSpecialist.name}</h3>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {selectedSpecialist.description}
                  </p>
                  <Badge variant="secondary" className="mt-2">
                    {selectedSpecialist.category}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="specialist-enabled">Status</Label>
                    <Select
                      value={editingEnabled ? 'enabled' : 'disabled'}
                      onValueChange={(value) => setEditingEnabled(value === 'enabled')}
                    >
                      <SelectTrigger id="specialist-enabled">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enabled">Enabled</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="specialist-priority">Priority (0-100)</Label>
                    <Input
                      id="specialist-priority"
                      type="number"
                      min={0}
                      max={100}
                      value={editingPriority}
                      onChange={(e) => setEditingPriority(Number(e.target.value))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="specialist-instructions">Custom Instructions</Label>
                  <Textarea
                    id="specialist-instructions"
                    value={editingInstructions}
                    onChange={(e) => setEditingInstructions(e.target.value)}
                    placeholder={`Enter custom instructions for ${selectedSpecialist.name}...\n\nExample:\n- Focus on B2B messaging\n- Prioritize enterprise clients\n- Use technical language`}
                    className="min-h-[400px] font-mono text-sm"
                  />
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    These instructions will be appended to the specialist&apos;s base system prompt
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setEditingInstructions('')}>
                    Clear
                  </Button>
                  <Button onClick={handleSaveInstructions}>
                    Save Instructions
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-center" style={{ color: 'var(--color-text-muted)' }}>
                <p>Select a specialist from the list to view and edit instructions</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
SpecialistInstructions.displayName = 'SpecialistInstructions';

// ============================================================================
// TRAINING EXAMPLES MANAGER COMPONENT
// ============================================================================

const TrainingExamplesManager = React.memo<{
  examples: TrainingExample[];
  onUpdate: (examples: TrainingExample[]) => void;
}>(({ examples, onUpdate }) => {
  const [newUserInput, setNewUserInput] = useState('');
  const [newExpectedResponse, setNewExpectedResponse] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newTags, setNewTags] = useState('');

  const handleAddExample = useCallback(() => {
    if (!newUserInput.trim() || !newExpectedResponse.trim()) {return;}

    const newExample: TrainingExample = {
      id: `example_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userInput: newUserInput.trim(),
      expectedResponse: newExpectedResponse.trim(),
      category: newCategory,
      tags: newTags.split(',').map((t) => t.trim()).filter(Boolean),
    };

    onUpdate([...examples, newExample]);

    // Reset form
    setNewUserInput('');
    setNewExpectedResponse('');
    setNewCategory('General');
    setNewTags('');
  }, [newUserInput, newExpectedResponse, newCategory, newTags, examples, onUpdate]);

  const handleDeleteExample = useCallback((id: string) => {
    onUpdate(examples.filter((ex) => ex.id !== id));
  }, [examples, onUpdate]);

  const categories = useMemo(() => {
    const cats = new Set(examples.map((ex) => ex.category));
    return ['General', ...Array.from(cats)];
  }, [examples]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Training Examples</CardTitle>
        <CardDescription>
          Add input/output pairs to fine-tune Jasper&apos;s responses
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Add New Example Form */}
        <div className="border rounded-lg p-4 space-y-4" style={{ backgroundColor: 'var(--color-surface)' }}>
          <h3 className="font-semibold">Add New Training Example</h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="example-category">Category</Label>
              <Select value={newCategory} onValueChange={setNewCategory}>
                <SelectTrigger id="example-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="example-tags">Tags (comma-separated)</Label>
              <Input
                id="example-tags"
                value={newTags}
                onChange={(e) => setNewTags(e.target.value)}
                placeholder="e.g., sales, email, B2B"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="example-input">User Input</Label>
            <Textarea
              id="example-input"
              value={newUserInput}
              onChange={(e) => setNewUserInput(e.target.value)}
              placeholder="Enter what the user would say..."
              className="min-h-[100px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="example-output">Expected Response</Label>
            <Textarea
              id="example-output"
              value={newExpectedResponse}
              onChange={(e) => setNewExpectedResponse(e.target.value)}
              placeholder="Enter how Jasper should respond..."
              className="min-h-[150px]"
            />
          </div>

          <Button onClick={handleAddExample} className="w-full">
            Add Training Example
          </Button>
        </div>

        {/* Existing Examples List */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Existing Examples ({examples.length})</h3>
          </div>

          <div className="space-y-3" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {examples.length === 0 ? (
              <p className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                No training examples yet. Add your first example above.
              </p>
            ) : (
              examples.map((example) => (
                <div key={example.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{example.category}</Badge>
                      {example.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteExample(example.id)}
                    >
                      Delete
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                      User Input:
                    </p>
                    <p className="text-sm">{example.userInput}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
                      Expected Response:
                    </p>
                    <p className="text-sm">{example.expectedResponse}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
TrainingExamplesManager.displayName = 'TrainingExamplesManager';

// ============================================================================
// TEST CHAT INTERFACE COMPONENT
// ============================================================================

const TestChatInterface = React.memo<{
  persona: PersonaConfig;
}>(({ persona }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = useCallback(async () => {
    if (!inputMessage.trim() || isLoading) {return;}

    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user`,
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    // Simulate AI response
    try {
      await new Promise((resolve) => { setTimeout(resolve, 1500); });

      const assistantMessage: ChatMessage = {
        id: `msg_${Date.now()}_assistant`,
        role: 'assistant',
        content: `[Simulated Response]\n\nHello! I'm ${persona.name}, your ${persona.title}. This is a test response in a ${persona.tone} tone.\n\nYou said: "${userMessage.content}"\n\nIn a real environment, I would process this through the orchestrator and route it to the appropriate specialists.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputMessage, isLoading, persona]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test Chat Interface</CardTitle>
        <CardDescription>
          Simulate conversations with Jasper
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Chat Messages */}
        <div
          className="border rounded-lg p-4 space-y-3"
          style={{
            minHeight: '500px',
            maxHeight: '500px',
            overflowY: 'auto',
            backgroundColor: 'var(--color-surface)',
          }}
        >
          {messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center" style={{ color: 'var(--color-text-muted)' }}>
              <p>Start a conversation to test Jasper&apos;s responses</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-lg p-3"
                style={{
                  backgroundColor: msg.role === 'user' ? 'var(--color-primary-bg)' : 'var(--color-card)',
                  marginLeft: msg.role === 'user' ? '20%' : '0',
                  marginRight: msg.role === 'user' ? '0' : '20%',
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold">
                    {msg.role === 'user' ? 'User' : persona.name}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {msg.timestamp.toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              </div>
            ))
          )}

          {isLoading && (
            <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--color-card)' }}>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                {persona.name} is typing...
              </p>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="flex gap-2">
          <Textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSendMessage();
              }
            }}
            placeholder="Type your message... (Shift+Enter for new line)"
            className="min-h-[80px]"
            disabled={isLoading}
          />
          <div className="flex flex-col gap-2">
            <Button onClick={() => { void handleSendMessage(); }} disabled={isLoading || !inputMessage.trim()}>
              Send
            </Button>
            <Button variant="outline" onClick={handleClearChat} disabled={messages.length === 0}>
              Clear
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
TestChatInterface.displayName = 'TestChatInterface';

// ============================================================================
// KNOWLEDGE BASE MANAGER COMPONENT
// ============================================================================

const KnowledgeBaseManager = React.memo<{
  documents: KnowledgeBaseDocument[];
  onUpdate: (documents: KnowledgeBaseDocument[]) => void;
}>(({ documents, onUpdate }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('General');
  const [isUploading, setIsUploading] = useState(false);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {return;}

    setIsUploading(true);
    try {
      // Simulate file upload
      await new Promise((resolve) => { setTimeout(resolve, 1000); });

      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;

        const newDocument: KnowledgeBaseDocument = {
          id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: uploadTitle,
          content: content.substring(0, 5000), // Limit content for demo
          category: uploadCategory,
          uploadedAt: new Date(),
          fileSize: selectedFile.size,
        };

        onUpdate([...documents, newDocument]);

        // Reset form
        setSelectedFile(null);
        setUploadTitle('');
        setUploadCategory('General');
      };
      reader.readAsText(selectedFile);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile, uploadTitle, uploadCategory, documents, onUpdate]);

  const handleDeleteDocument = useCallback((id: string) => {
    onUpdate(documents.filter((doc) => doc.id !== id));
  }, [documents, onUpdate]);

  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) {return `${bytes} B`;}
    if (bytes < 1024 * 1024) {return `${(bytes / 1024).toFixed(1)} KB`;}
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Knowledge Base</CardTitle>
        <CardDescription>
          Upload and manage documents for Jasper&apos;s knowledge base
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Form */}
        <div className="border rounded-lg p-4 space-y-4" style={{ backgroundColor: 'var(--color-surface)' }}>
          <h3 className="font-semibold">Upload New Document</h3>

          <div className="space-y-2">
            <Label htmlFor="file-upload">Select File (TXT, MD, JSON)</Label>
            <Input
              id="file-upload"
              type="file"
              accept=".txt,.md,.json"
              onChange={handleFileSelect}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="upload-title">Document Title</Label>
              <Input
                id="upload-title"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                placeholder="Enter document title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="upload-category">Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger id="upload-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="General">General</SelectItem>
                  <SelectItem value="Product">Product Knowledge</SelectItem>
                  <SelectItem value="Sales">Sales Playbook</SelectItem>
                  <SelectItem value="Support">Support Documentation</SelectItem>
                  <SelectItem value="Policy">Policies & Guidelines</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={() => { void handleUpload(); }}
            disabled={!selectedFile || !uploadTitle.trim() || isUploading}
            className="w-full"
          >
            {isUploading ? 'Uploading...' : 'Upload Document'}
          </Button>
        </div>

        {/* Documents List */}
        <div className="space-y-4">
          <h3 className="font-semibold">Uploaded Documents ({documents.length})</h3>

          <div className="space-y-2" style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {documents.length === 0 ? (
              <p className="text-center py-8" style={{ color: 'var(--color-text-muted)' }}>
                No documents uploaded yet. Add your first document above.
              </p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{doc.title}</span>
                      <Badge variant="secondary">{doc.category}</Badge>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id)}
                    >
                      Delete
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    <span>{formatFileSize(doc.fileSize)}</span>
                    <span>Uploaded {doc.uploadedAt.toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
});
KnowledgeBaseManager.displayName = 'KnowledgeBaseManager';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const JasperTrainingLab: React.FC<JasperTrainingLabProps> = () => {
  const [persona, setPersona] = useState<PersonaConfig>({
    name: 'Jasper',
    title: 'AI Sales Orchestrator',
    tone: 'professional',
    systemPrompt: `You are Jasper, an AI-powered sales orchestrator designed to help businesses succeed.\n\nYour core responsibilities:\n1. Coordinate a swarm of 27 specialist AI agents\n2. Provide intelligent recommendations and insights\n3. Automate sales and marketing workflows\n4. Maintain a professional yet approachable demeanor\n\nAlways prioritize accuracy, helpfulness, and clarity in your responses.`,
  });

  const [specialists, setSpecialists] = useState<SpecialistInstruction[]>([]);
  const [trainingExamples, setTrainingExamples] = useState<TrainingExample[]>([]);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBaseDocument[]>([]);

  const handlePersonaSave = useCallback((newPersona: PersonaConfig) => {
    setPersona(newPersona);
    // TODO: Persist to backend
  }, []);

  const handleSpecialistsUpdate = useCallback((newSpecialists: SpecialistInstruction[]) => {
    setSpecialists(newSpecialists);
    // TODO: Persist to backend
  }, []);

  const handleTrainingExamplesUpdate = useCallback((newExamples: TrainingExample[]) => {
    setTrainingExamples(newExamples);
    // TODO: Persist to backend
  }, []);

  const handleKnowledgeBaseUpdate = useCallback((newDocuments: KnowledgeBaseDocument[]) => {
    setKnowledgeBase(newDocuments);
    // TODO: Persist to backend
  }, []);

  return (
    <div className="jasper-training-lab space-y-6 p-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Jasper Training Lab</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Comprehensive training and configuration interface for the AI orchestrator
        </p>
      </header>

      <Tabs defaultValue="persona" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="persona">Persona</TabsTrigger>
          <TabsTrigger value="specialists">Specialists</TabsTrigger>
          <TabsTrigger value="training">Training Data</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="test">Test Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="persona">
          <PersonaEditor
            persona={persona}
            onSave={handlePersonaSave}
          />
        </TabsContent>

        <TabsContent value="specialists">
          <SpecialistInstructions
            specialists={specialists}
            onUpdate={handleSpecialistsUpdate}
          />
        </TabsContent>

        <TabsContent value="training">
          <TrainingExamplesManager
            examples={trainingExamples}
            onUpdate={handleTrainingExamplesUpdate}
          />
        </TabsContent>

        <TabsContent value="knowledge">
          <KnowledgeBaseManager
            documents={knowledgeBase}
            onUpdate={handleKnowledgeBaseUpdate}
          />
        </TabsContent>

        <TabsContent value="test">
          <TestChatInterface
            persona={persona}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

JasperTrainingLab.displayName = 'JasperTrainingLab';

// ============================================================================
// EXPORTS
// ============================================================================

export default JasperTrainingLab;

export {
  JasperTrainingLab,
  type JasperTrainingLabProps,
  type PersonaConfig,
  type SpecialistInstruction,
  type TrainingExample,
  type KnowledgeBaseDocument,
  type ChatMessage,
};
