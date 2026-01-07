'use client';

/**
 * Intelligence & Signals Tab
 * 
 * Edit high-value signals, fluff patterns, and scoring rules
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface IntelligenceSignalsTabProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
}

export function IntelligenceSignalsTab({ template, onUpdate, disabled }: IntelligenceSignalsTabProps) {
  const [activeSection, setActiveSection] = useState('signals');

  const addSignal = () => {
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
      } as any,
    });
  };

  const removeSignal = (index: number) => {
    const signals = template.research?.highValueSignals ?? [];
    onUpdate({
      research: {
        ...template.research,
        highValueSignals: signals.filter((_, i) => i !== index),
      } as any,
    });
  };

  const updateSignal = (index: number, updates: any) => {
    const signals = [...(template.research?.highValueSignals ?? [])];
    signals[index] = { ...signals[index], ...updates };
    onUpdate({
      research: {
        ...template.research,
        highValueSignals: signals,
      } as any,
    });
  };

  const addFluffPattern = () => {
    const id = prompt('Pattern ID (e.g., copyright):');
    if (!id) {return;}

    const newPattern = {
      id,
      pattern: 'pattern_regex',
      description: 'Pattern description',
      context: 'all' as const,
    };

    onUpdate({
      research: {
        ...template.research,
        fluffPatterns: [...(template.research?.fluffPatterns ?? []), newPattern],
      } as any,
    });
  };

  const removeFluffPattern = (index: number) => {
    const patterns = template.research?.fluffPatterns ?? [];
    onUpdate({
      research: {
        ...template.research,
        fluffPatterns: patterns.filter((_, i) => i !== index),
      } as any,
    });
  };

  const updateFluffPattern = (index: number, updates: any) => {
    const patterns = [...(template.research?.fluffPatterns ?? [])];
    patterns[index] = { ...patterns[index], ...updates };
    onUpdate({
      research: {
        ...template.research,
        fluffPatterns: patterns,
      } as any,
    });
  };

  const addScoringRule = () => {
    const id = prompt('Rule ID (e.g., growing_business):');
    if (!id) {return;}

    const newRule = {
      id,
      name: id.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      description: 'Rule description',
      condition: 'signals.length > 0',
      scoreBoost: 10,
      priority: 1,
      enabled: true,
    };

    onUpdate({
      research: {
        ...template.research,
        scoringRules: [...(template.research?.scoringRules ?? []), newRule],
      } as any,
    });
  };

  const removeScoringRule = (index: number) => {
    const rules = template.research?.scoringRules ?? [];
    onUpdate({
      research: {
        ...template.research,
        scoringRules: rules.filter((_, i) => i !== index),
      } as any,
    });
  };

  const updateScoringRule = (index: number, updates: any) => {
    const rules = [...(template.research?.scoringRules ?? [])];
    rules[index] = { ...rules[index], ...updates };
    onUpdate({
      research: {
        ...template.research,
        scoringRules: rules,
      } as any,
    });
  };

  return (
    <Tabs value={activeSection} onValueChange={setActiveSection}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="signals">
          High-Value Signals ({template.research?.highValueSignals?.length || 0})
        </TabsTrigger>
        <TabsTrigger value="fluff">
          Fluff Patterns ({template.research?.fluffPatterns?.length || 0})
        </TabsTrigger>
        <TabsTrigger value="scoring">
          Scoring Rules ({template.research?.scoringRules?.length || 0})
        </TabsTrigger>
      </TabsList>

      {/* High-Value Signals */}
      <TabsContent value="signals" className="space-y-4 mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>High-Value Signals</CardTitle>
                <CardDescription>
                  Keywords and patterns that indicate high-value leads
                </CardDescription>
              </div>
              <Button size="sm" onClick={addSignal} disabled={disabled}>
                <Plus className="h-4 w-4 mr-2" />
                Add Signal
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!template.research?.highValueSignals || template.research.highValueSignals.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
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
      </TabsContent>

      {/* Fluff Patterns */}
      <TabsContent value="fluff" className="space-y-4 mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Fluff Patterns</CardTitle>
                <CardDescription>
                  Patterns to filter out noise and boilerplate content
                </CardDescription>
              </div>
              <Button size="sm" onClick={addFluffPattern} disabled={disabled}>
                <Plus className="h-4 w-4 mr-2" />
                Add Pattern
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!template.research?.fluffPatterns || template.research.fluffPatterns.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No patterns defined. At least one pattern is required.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {template.research.fluffPatterns.map((pattern, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">ID</Label>
                          <Input
                            value={pattern.id}
                            onChange={e => updateFluffPattern(index, { id: e.target.value })}
                            disabled={disabled}
                            size={undefined}
                          />
                        </div>
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs">Pattern (Regex)</Label>
                          <Input
                            value={pattern.pattern}
                            onChange={e => updateFluffPattern(index, { pattern: e.target.value })}
                            disabled={disabled}
                            placeholder="©\s*\d{4}"
                            className="font-mono text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Context</Label>
                          <Select
                            value={pattern.context}
                            onValueChange={val => updateFluffPattern(index, { context: val })}
                          >
                            <SelectTrigger disabled={disabled}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="header">Header</SelectItem>
                              <SelectItem value="footer">Footer</SelectItem>
                              <SelectItem value="sidebar">Sidebar</SelectItem>
                              <SelectItem value="body">Body</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFluffPattern(index)}
                        disabled={disabled}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <Input
                      value={pattern.description}
                      onChange={e => updateFluffPattern(index, { description: e.target.value })}
                      disabled={disabled}
                      placeholder="Description"
                      className="text-xs"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Scoring Rules */}
      <TabsContent value="scoring" className="space-y-4 mt-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Scoring Rules</CardTitle>
                <CardDescription>
                  Conditional logic for lead qualification scoring
                </CardDescription>
              </div>
              <Button size="sm" onClick={addScoringRule} disabled={disabled}>
                <Plus className="h-4 w-4 mr-2" />
                Add Rule
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!template.research?.scoringRules || template.research.scoringRules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No rules defined. At least one scoring rule is required.</p>
              </div>
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
      </TabsContent>
    </Tabs>
  );
}
