'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Brain, Trash2 } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface CognitiveLogicSectionProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
  onRemove?: () => void;
  canRemove?: boolean;
  errors: Record<string, string>;
}

export function CognitiveLogicSection({ template, onUpdate, disabled, onRemove, canRemove }: CognitiveLogicSectionProps) {
  const updateCognitiveLogic = (field: string, value: string) => {
    onUpdate({
      cognitiveLogic: {
        ...template.cognitiveLogic,
        [field]: value,
      },
    });
  };

  return (
    <Card id="cognitive" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            <div>
              <CardTitle>Cognitive Logic</CardTitle>
              <CardDescription>The reasoning framework and decision-making process</CardDescription>
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
  );
}
