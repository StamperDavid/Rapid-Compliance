'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, TrendingUp, AlertCircle } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface HighValueSignalsSectionProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
  onRemove?: () => void;
  canRemove?: boolean;
  errors: Record<string, string>;
}

interface SignalUpdate {
  id?: string;
  label?: string;
  description?: string;
  keywords?: string[];
  priority?: string;
  action?: string;
  scoreBoost?: number;
  platform?: string;
}

export function HighValueSignalsSection({ template, onUpdate, disabled, onRemove, canRemove, errors }: HighValueSignalsSectionProps) {
  const sectionErrors = Object.entries(errors).filter(([key]) =>
    key.startsWith('research.highValueSignals')
  );

  const addSignal = () => {
    // eslint-disable-next-line no-alert
    const id = prompt('Signal ID (e.g., hiring_staff):');
    if (!id) {return;}

    const newSignal = {
      id,
      label: id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: 'Signal description',
      keywords: ['keyword1', 'keyword2'],
      priority: 'MEDIUM' as const,
      action: 'increase-score' as const,
      scoreBoost: 10,
      platform: 'website' as const,
    };

    onUpdate({
      research: {
        ...template.research,
        highValueSignals: [...(template.research?.highValueSignals ?? []), newSignal],
      },
    });
  };

  const removeSignal = (index: number) => {
    const signals = template.research?.highValueSignals ?? [];
    onUpdate({
      research: {
        ...template.research,
        highValueSignals: signals.filter((_, i) => i !== index),
      },
    });
  };

  const updateSignal = (index: number, updates: SignalUpdate) => {
    const signals = [...(template.research?.highValueSignals ?? [])];
    signals[index] = { ...signals[index], ...updates };
    onUpdate({
      research: {
        ...template.research,
        highValueSignals: signals,
      },
    });
  };

  return (
    <Card id="signals" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            <div>
              <CardTitle>High-Value Signals</CardTitle>
              <CardDescription>Keywords and patterns that indicate high-value leads</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={addSignal} disabled={disabled}>
              <Plus className="h-4 w-4 mr-2" />
              Add Signal
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
        {sectionErrors.length > 0 && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {sectionErrors.map(([key, message]) => (
                <div key={key}>• {message}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {!template.research?.highValueSignals || template.research.highValueSignals.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No signals defined. At least one signal is required.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {template.research.highValueSignals.map((signal, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">ID</Label>
                      <Input
                        value={signal.id}
                        onChange={e => updateSignal(index, { id: e.target.value })}
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={signal.label}
                        onChange={e => updateSignal(index, { label: e.target.value })}
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Priority</Label>
                      <Select
                        value={signal.priority}
                        onValueChange={val => updateSignal(index, { priority: val })}
                      >
                        <SelectTrigger disabled={disabled}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CRITICAL">Critical</SelectItem>
                          <SelectItem value="HIGH">High</SelectItem>
                          <SelectItem value="MEDIUM">Medium</SelectItem>
                          <SelectItem value="LOW">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSignal(index)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={signal.description}
                    onChange={e => updateSignal(index, { description: e.target.value })}
                    disabled={disabled}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Keywords (comma-separated)</Label>
                  <Input
                    value={signal.keywords?.join(', ') || ''}
                    onChange={e =>
                      updateSignal(index, {
                        keywords: e.target.value.split(',').map(k => k.trim()),
                      })
                    }
                    disabled={disabled}
                    placeholder="keyword1, keyword2, keyword3"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Action</Label>
                    <Select
                      value={signal.action}
                      onValueChange={val => updateSignal(index, { action: val })}
                    >
                      <SelectTrigger disabled={disabled}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="increase-score">Increase Score</SelectItem>
                        <SelectItem value="decrease-score">Decrease Score</SelectItem>
                        <SelectItem value="add-to-segment">Add to Segment</SelectItem>
                        <SelectItem value="trigger-workflow">Trigger Workflow</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Score Boost</Label>
                    <Input
                      type="number"
                      value={signal.scoreBoost}
                      onChange={e => updateSignal(index, { scoreBoost: parseInt(e.target.value) })}
                      disabled={disabled}
                      min={-100}
                      max={100}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Platform</Label>
                    <Select
                      value={signal.platform}
                      onValueChange={val => updateSignal(index, { platform: val })}
                    >
                      <SelectTrigger disabled={disabled}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="website">Website</SelectItem>
                        <SelectItem value="linkedin-company">LinkedIn Company</SelectItem>
                        <SelectItem value="linkedin-jobs">LinkedIn Jobs</SelectItem>
                        <SelectItem value="google-business">Google Business</SelectItem>
                        <SelectItem value="any">Any</SelectItem>
                      </SelectContent>
                    </Select>
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
