'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Calculator } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface ScoringRulesSectionProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
  onRemove?: () => void;
  canRemove?: boolean;
  errors?: Record<string, string>;
}

type ScoringRuleUpdate = Partial<{
  id: string;
  name: string;
  description: string;
  condition: string;
  scoreBoost: number;
  priority: number;
  enabled: boolean;
}>;

export function ScoringRulesSection({ template, onUpdate, disabled, onRemove, canRemove }: ScoringRulesSectionProps) {
  const addScoringRule = () => {
    // eslint-disable-next-line no-alert
    const id = prompt('Rule ID (e.g., growing_business):');
    if (!id) {return;}

    const newRule: import('@/types/scraper-intelligence').ScoringRule = {
      id,
      name: id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: 'Rule description',
      condition: 'signals.length > 0',
      scoreBoost: 10,
      priority: 1,
      enabled: true,
    };

    if (!template.research) {
      return;
    }

    onUpdate({
      research: {
        ...template.research,
        scoringRules: [...(template.research.scoringRules ?? []), newRule],
      },
    });
  };

  const removeScoringRule = (index: number) => {
    if (!template.research) {
      return;
    }

    const rules = template.research.scoringRules ?? [];
    onUpdate({
      research: {
        ...template.research,
        scoringRules: rules.filter((_, i) => i !== index),
      },
    });
  };

  const updateScoringRule = (index: number, updates: ScoringRuleUpdate) => {
    if (!template.research) {
      return;
    }

    const rules = [...(template.research.scoringRules ?? [])];
    rules[index] = { ...rules[index], ...updates };
    onUpdate({
      research: {
        ...template.research,
        scoringRules: rules,
      },
    });
  };

  return (
    <Card id="scoring" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            <div>
              <CardTitle>Scoring Rules</CardTitle>
              <CardDescription>Conditional logic for lead qualification scoring</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={addScoringRule} disabled={disabled}>
              <Plus className="h-4 w-4 mr-2" />
              Add Rule
            </Button>
            {canRemove && onRemove && (
              <Button variant="ghost" size="sm" onClick={onRemove} disabled={disabled}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!template.research?.scoringRules || template.research.scoringRules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No rules defined. Click &quot;Add Rule&quot; to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {template.research.scoringRules.map((rule, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">ID</Label>
                      <Input
                        value={rule.id}
                        onChange={e => updateScoringRule(index, { id: e.target.value })}
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Name</Label>
                      <Input
                        value={rule.name}
                        onChange={e => updateScoringRule(index, { name: e.target.value })}
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Priority</Label>
                      <Input
                        type="number"
                        value={rule.priority}
                        onChange={e => updateScoringRule(index, { priority: parseInt(e.target.value) })}
                        disabled={disabled}
                        min={1}
                        max={100}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeScoringRule(index)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={rule.description}
                    onChange={e => updateScoringRule(index, { description: e.target.value })}
                    disabled={disabled}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Condition (JavaScript)</Label>
                  <Textarea
                    value={rule.condition}
                    onChange={e => updateScoringRule(index, { condition: e.target.value })}
                    disabled={disabled}
                    rows={2}
                    className="font-mono text-xs"
                    placeholder="signals.some(s => s.signalId === 'hiring')"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <div className="space-y-1 flex-1">
                    <Label className="text-xs">Score Boost</Label>
                    <Input
                      type="number"
                      value={rule.scoreBoost}
                      onChange={e => updateScoringRule(index, { scoreBoost: parseInt(e.target.value) })}
                      disabled={disabled}
                      min={-100}
                      max={100}
                    />
                  </div>
                  <div className="pt-6">
                    <Badge variant={rule.enabled ? 'default' : 'outline'}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
