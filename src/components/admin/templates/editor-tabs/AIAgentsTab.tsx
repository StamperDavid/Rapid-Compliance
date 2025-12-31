'use client';

/**
 * AI Agents Tab
 * 
 * Edit the base system prompts, tone, and persona configuration
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Bot } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface AIAgentsTabProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
}

export function AIAgentsTab({ template, onUpdate, disabled }: AIAgentsTabProps) {
  const updateCoreIdentity = (field: string, value: string) => {
    onUpdate({
      coreIdentity: {
        ...template.coreIdentity,
        [field]: value,
      },
    });
  };

  const updateCognitiveLogic = (field: string, value: string) => {
    onUpdate({
      cognitiveLogic: {
        ...template.cognitiveLogic,
        [field]: value,
      },
    });
  };

  const updateKnowledgeRAG = (field: 'static' | 'dynamic', value: string) => {
    const items = value.split('\n').filter(item => item.trim());
    onUpdate({
      knowledgeRAG: {
        ...template.knowledgeRAG,
        [field]: items,
      },
    });
  };

  const updateLearningLoops = (field: string, value: string) => {
    onUpdate({
      learningLoops: {
        ...template.learningLoops,
        [field]: value,
      },
    });
  };

  const updateTacticalExecution = (field: string, value: string | string[]) => {
    if (field === 'secondaryActions' && typeof value === 'string') {
      const actions = value.split('\n').filter(action => action.trim());
      onUpdate({
        tacticalExecution: {
          ...template.tacticalExecution,
          secondaryActions: actions,
        },
      });
    } else {
      onUpdate({
        tacticalExecution: {
          ...template.tacticalExecution,
          [field]: value,
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Core Identity */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <div>
              <CardTitle>Core Identity</CardTitle>
              <CardDescription>
                The fundamental personality and positioning of the AI agent
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Agent Title</Label>
            <Input
              id="title"
              value={template.coreIdentity.title}
              onChange={e => updateCoreIdentity('title', e.target.value)}
              disabled={disabled}
              placeholder="e.g., The Reassuring Patient Advocate"
            />
            <p className="text-xs text-muted-foreground">
              The role or archetype the agent embodies
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="positioning">Positioning</Label>
            <Textarea
              id="positioning"
              value={template.coreIdentity.positioning}
              onChange={e => updateCoreIdentity('positioning', e.target.value)}
              disabled={disabled}
              rows={3}
              placeholder="e.g., Clinical, gentle, and highly organized. Focuses on 'Gentle Care'"
            />
            <p className="text-xs text-muted-foreground">
              How the agent positions itself to prospects
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tone">Communication Tone</Label>
            <Input
              id="tone"
              value={template.coreIdentity.tone}
              onChange={e => updateCoreIdentity('tone', e.target.value)}
              disabled={disabled}
              placeholder="e.g., Warm, reassuring, professional"
            />
            <p className="text-xs text-muted-foreground">
              The overall tone of communication
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Cognitive Logic */}
      <Card>
        <CardHeader>
          <CardTitle>Cognitive Logic</CardTitle>
          <CardDescription>
            The reasoning framework and decision-making process
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="framework">Framework</Label>
            <Input
              id="framework"
              value={template.cognitiveLogic.framework}
              onChange={e => updateCognitiveLogic('framework', e.target.value)}
              disabled={disabled}
              placeholder="e.g., The Anxiety-to-Action Framework"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reasoning">Reasoning Approach</Label>
            <Textarea
              id="reasoning"
              value={template.cognitiveLogic.reasoning}
              onChange={e => updateCognitiveLogic('reasoning', e.target.value)}
              disabled={disabled}
              rows={3}
              placeholder="Logic that identifies concerns and counters with solutions"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="decisionProcess">Decision Process</Label>
            <Input
              id="decisionProcess"
              value={template.cognitiveLogic.decisionProcess}
              onChange={e => updateCognitiveLogic('decisionProcess', e.target.value)}
              disabled={disabled}
              placeholder="e.g., Discovery → Solution → Action"
            />
          </div>
        </CardContent>
      </Card>

      {/* Knowledge RAG */}
      <Card>
        <CardHeader>
          <CardTitle>Knowledge Base (RAG)</CardTitle>
          <CardDescription>
            Static and dynamic knowledge sources for the agent
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staticKnowledge">Static Knowledge</Label>
            <Textarea
              id="staticKnowledge"
              value={template.knowledgeRAG.static.join('\n')}
              onChange={e => updateKnowledgeRAG('static', e.target.value)}
              disabled={disabled}
              rows={5}
              placeholder="One item per line&#10;Industry standards&#10;Best practices&#10;Terminology"
            />
            <p className="text-xs text-muted-foreground">
              <Badge variant="outline" className="mr-2">
                {template.knowledgeRAG.static.length} items
              </Badge>
              Unchanging industry knowledge (one per line)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dynamicKnowledge">Dynamic Knowledge</Label>
            <Textarea
              id="dynamicKnowledge"
              value={template.knowledgeRAG.dynamic.join('\n')}
              onChange={e => updateKnowledgeRAG('dynamic', e.target.value)}
              disabled={disabled}
              rows={5}
              placeholder="One item per line&#10;Current offerings&#10;Pricing&#10;Availability"
            />
            <p className="text-xs text-muted-foreground">
              <Badge variant="outline" className="mr-2">
                {template.knowledgeRAG.dynamic.length} items
              </Badge>
              Company-specific, frequently updated knowledge (one per line)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Learning Loops */}
      <Card>
        <CardHeader>
          <CardTitle>Learning Loops</CardTitle>
          <CardDescription>
            How the agent learns and adapts over time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="patternRecognition">Pattern Recognition</Label>
            <Textarea
              id="patternRecognition"
              value={template.learningLoops.patternRecognition}
              onChange={e => updateLearningLoops('patternRecognition', e.target.value)}
              disabled={disabled}
              rows={2}
              placeholder="What patterns the agent detects in conversations"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="adaptation">Adaptation Strategy</Label>
            <Textarea
              id="adaptation"
              value={template.learningLoops.adaptation}
              onChange={e => updateLearningLoops('adaptation', e.target.value)}
              disabled={disabled}
              rows={2}
              placeholder="How the agent adjusts its approach based on patterns"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="feedbackIntegration">Feedback Integration</Label>
            <Textarea
              id="feedbackIntegration"
              value={template.learningLoops.feedbackIntegration}
              onChange={e => updateLearningLoops('feedbackIntegration', e.target.value)}
              disabled={disabled}
              rows={2}
              placeholder="How the agent learns from outcomes"
            />
          </div>
        </CardContent>
      </Card>

      {/* Tactical Execution */}
      <Card>
        <CardHeader>
          <CardTitle>Tactical Execution</CardTitle>
          <CardDescription>
            Conversion tactics and action priorities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="primaryAction">Primary Action</Label>
            <Input
              id="primaryAction"
              value={template.tacticalExecution.primaryAction}
              onChange={e => updateTacticalExecution('primaryAction', e.target.value)}
              disabled={disabled}
              placeholder="e.g., Schedule Consultation"
            />
            <p className="text-xs text-muted-foreground">
              The main conversion goal for this industry
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="conversionRhythm">Conversion Rhythm</Label>
            <Textarea
              id="conversionRhythm"
              value={template.tacticalExecution.conversionRhythm}
              onChange={e => updateTacticalExecution('conversionRhythm', e.target.value)}
              disabled={disabled}
              rows={3}
              placeholder="How the agent guides conversations toward conversion"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="secondaryActions">Secondary Actions</Label>
            <Textarea
              id="secondaryActions"
              value={template.tacticalExecution.secondaryActions.join('\n')}
              onChange={e => updateTacticalExecution('secondaryActions', e.target.value)}
              disabled={disabled}
              rows={5}
              placeholder="One action per line&#10;Send information&#10;Answer questions&#10;Provide pricing"
            />
            <p className="text-xs text-muted-foreground">
              <Badge variant="outline" className="mr-2">
                {template.tacticalExecution.secondaryActions.length} actions
              </Badge>
              Alternative actions to move the conversation forward (one per line)
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Summary Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-base">Persona Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <span className="font-semibold">Role:</span> {template.coreIdentity.title}
          </div>
          <div>
            <span className="font-semibold">Tone:</span> {template.coreIdentity.tone}
          </div>
          <div>
            <span className="font-semibold">Framework:</span> {template.cognitiveLogic.framework}
          </div>
          <div>
            <span className="font-semibold">Primary Goal:</span> {template.tacticalExecution.primaryAction}
          </div>
          <div>
            <span className="font-semibold">Knowledge Items:</span>{' '}
            {template.knowledgeRAG.static.length + template.knowledgeRAG.dynamic.length} total
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
