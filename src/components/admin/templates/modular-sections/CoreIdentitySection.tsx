'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Bot, Trash2 } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface CoreIdentitySectionProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
  onRemove?: () => void;
  canRemove?: boolean;
  errors: Record<string, string>;
}

export function CoreIdentitySection({ template, onUpdate, disabled, onRemove, canRemove }: CoreIdentitySectionProps) {
  const updateCoreIdentity = (field: string, value: string) => {
    onUpdate({
      coreIdentity: {
        ...template.coreIdentity,
        [field]: value,
      },
    });
  };

  return (
    <Card id="core-identity" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            <div>
              <CardTitle>Core Identity (AI Agent)</CardTitle>
              <CardDescription>The fundamental personality and positioning of the AI agent</CardDescription>
            </div>
          </div>
          {canRemove && onRemove && (
            <Button variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
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
  );
}
