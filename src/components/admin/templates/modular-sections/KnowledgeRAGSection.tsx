'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { BookOpen, Trash2 } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface KnowledgeRAGSectionProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
  onRemove?: () => void;
  canRemove?: boolean;
  errors: Record<string, string>;
}

export function KnowledgeRAGSection({ template, onUpdate, disabled, onRemove, canRemove }: KnowledgeRAGSectionProps) {
  const updateKnowledgeRAG = (field: 'static' | 'dynamic', value: string) => {
    const items = value.split('\n').filter(item => item.trim());
    onUpdate({
      knowledgeRAG: {
        ...template.knowledgeRAG,
        [field]: items,
      },
    });
  };

  return (
    <Card id="knowledge" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <div>
              <CardTitle>Knowledge Base (RAG)</CardTitle>
              <CardDescription>Static and dynamic knowledge sources for the agent</CardDescription>
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
  );
}
