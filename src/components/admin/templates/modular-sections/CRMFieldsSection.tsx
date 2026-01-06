'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Database } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface CRMFieldsSectionProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
  onRemove?: () => void;
  canRemove?: boolean;
  errors: Record<string, string>;
}

export function CRMFieldsSection({ template, onUpdate, disabled, onRemove, canRemove }: CRMFieldsSectionProps) {
  const addCustomField = () => {
    const key = prompt('Field key (e.g., company_size):');
    if (!key) {return;}

    const newField = {
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      type: 'string' as const,
      description: 'Custom field description',
      extractionHints: [],
      required: false,
      defaultValue: '',
    };

    onUpdate({
      research: {
        ...template.research,
        customFields: [...(template.research?.customFields || []), newField],
      } as any,
    });
  };

  const removeCustomField = (index: number) => {
    const fields = template.research?.customFields || [];
    onUpdate({
      research: {
        ...template.research,
        customFields: fields.filter((_, i) => i !== index),
      } as any,
    });
  };

  const updateCustomField = (index: number, updates: any) => {
    const fields = [...(template.research?.customFields || [])];
    fields[index] = { ...fields[index], ...updates };
    onUpdate({
      research: {
        ...template.research,
        customFields: fields,
      } as any,
    });
  };

  return (
    <Card id="crm-fields" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            <div>
              <CardTitle>CRM Custom Fields</CardTitle>
              <CardDescription>Industry-specific data fields to extract</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={addCustomField} disabled={disabled}>
              <Plus className="h-4 w-4 mr-2" />
              Add Field
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
        {!template.research?.customFields || template.research.customFields.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No custom fields defined. Click &quot;Add Field&quot; to create one.
          </p>
        ) : (
          <div className="space-y-4">
            {template.research.customFields.map((field, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Key</Label>
                      <Input
                        value={field.key}
                        onChange={e => updateCustomField(index, { key: e.target.value })}
                        disabled={disabled}
                        placeholder="field_key"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Label</Label>
                      <Input
                        value={field.label}
                        onChange={e => updateCustomField(index, { label: e.target.value })}
                        disabled={disabled}
                        placeholder="Field Label"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Type</Label>
                      <Select
                        value={field.type}
                        onValueChange={val => updateCustomField(index, { type: val })}
                      >
                        <SelectTrigger disabled={disabled}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="string">String</SelectItem>
                          <SelectItem value="number">Number</SelectItem>
                          <SelectItem value="boolean">Boolean</SelectItem>
                          <SelectItem value="array">Array</SelectItem>
                          <SelectItem value="date">Date</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2"
                    onClick={() => removeCustomField(index)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Description</Label>
                  <Input
                    value={field.description}
                    onChange={e => updateCustomField(index, { description: e.target.value })}
                    disabled={disabled}
                    placeholder="Field description"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={field.required ? 'default' : 'outline'}>
                    {field.required ? 'Required' : 'Optional'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Default: {JSON.stringify(field.defaultValue)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
