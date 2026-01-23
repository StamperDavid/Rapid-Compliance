'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Filter } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface FluffPatternsSectionProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
  onRemove?: () => void;
  canRemove?: boolean;
  errors?: Record<string, string>;
}

type FluffPatternUpdate = Partial<{
  id: string;
  pattern: string;
  description: string;
  context: 'header' | 'footer' | 'sidebar' | 'body' | 'all';
  examples: string[];
}>;

export function FluffPatternsSection({ template, onUpdate, disabled, onRemove, canRemove }: FluffPatternsSectionProps) {
  const addFluffPattern = () => {
    // eslint-disable-next-line no-alert
    const id = prompt('Pattern ID (e.g., copyright):');
    if (!id) {return;}

    const newPattern: import('@/types/scraper-intelligence').FluffPattern = {
      id,
      pattern: 'pattern_regex',
      description: 'Pattern description',
      context: 'all',
    };

    if (!template.research) {
      return;
    }

    onUpdate({
      research: {
        ...template.research,
        fluffPatterns: [...(template.research.fluffPatterns ?? []), newPattern],
      },
    });
  };

  const removeFluffPattern = (index: number) => {
    if (!template.research) {
      return;
    }

    const patterns = template.research.fluffPatterns ?? [];
    onUpdate({
      research: {
        ...template.research,
        fluffPatterns: patterns.filter((_, i) => i !== index),
      },
    });
  };

  const updateFluffPattern = (index: number, updates: FluffPatternUpdate) => {
    if (!template.research) {
      return;
    }

    const patterns = [...(template.research.fluffPatterns ?? [])];
    patterns[index] = { ...patterns[index], ...updates };
    onUpdate({
      research: {
        ...template.research,
        fluffPatterns: patterns,
      },
    });
  };

  return (
    <Card id="fluff" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            <div>
              <CardTitle>Fluff Patterns</CardTitle>
              <CardDescription>Patterns to filter out noise and boilerplate content</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={addFluffPattern} disabled={disabled}>
              <Plus className="h-4 w-4 mr-2" />
              Add Pattern
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
        {!template.research?.fluffPatterns || template.research.fluffPatterns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No patterns defined. Click &quot;Add Pattern&quot; to create one.
          </p>
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
                        onValueChange={val => updateFluffPattern(index, { context: val as 'header' | 'footer' | 'sidebar' | 'body' | 'all' })}
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
  );
}
