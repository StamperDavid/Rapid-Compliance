'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Target, Trash2 } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface TacticalExecutionSectionProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
  onRemove?: () => void;
  canRemove?: boolean;
  errors: Record<string, string>;
}

export function TacticalExecutionSection({ template, onUpdate, disabled, onRemove, canRemove }: TacticalExecutionSectionProps) {
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
    <Card id="tactical" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            <div>
              <CardTitle>Tactical Execution</CardTitle>
              <CardDescription>Conversion tactics and action priorities</CardDescription>
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
  );
}
