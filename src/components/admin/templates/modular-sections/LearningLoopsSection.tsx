'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RefreshCw, Trash2 } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface LearningLoopsSectionProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
  onRemove?: () => void;
  canRemove?: boolean;
  errors: Record<string, string>;
}

export function LearningLoopsSection({ template, onUpdate, disabled, onRemove, canRemove }: LearningLoopsSectionProps) {
  const updateLearningLoops = (field: string, value: string) => {
    onUpdate({
      learningLoops: {
        ...template.learningLoops,
        [field]: value,
      },
    });
  };

  return (
    <Card id="learning" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            <div>
              <CardTitle>Learning Loops</CardTitle>
              <CardDescription>How the agent learns and adapts over time</CardDescription>
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
  );
}
