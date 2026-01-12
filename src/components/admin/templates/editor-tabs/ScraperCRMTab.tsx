'use client';

/**
 * Scraper & CRM Tab
 * 
 * Edit scraping strategy, custom fields, and basic template info
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface ScraperCRMTabProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
}

export function ScraperCRMTab({ template, onUpdate, disabled }: ScraperCRMTabProps) {
  const handleBasicInfoChange = (field: string, value: string) => {
    onUpdate({ [field]: value });
  };

  const handleScrapingStrategyChange = (field: string, value: any) => {
    onUpdate({
      research: {
        ...template.research,
        scrapingStrategy: {
          ...template.research?.scrapingStrategy,
          [field]: value,
        },
      } as any,
    });
  };

  const addSeedUrl = () => {
    const newUrl = prompt('Enter seed URL:');
    if (newUrl) {
      const currentUrls = (template.research?.scrapingStrategy as any)?.seedUrls ?? [];
      handleScrapingStrategyChange('seedUrls', [...currentUrls, newUrl]);
    }
  };

  const removeSeedUrl = (index: number) => {
    const currentUrls = (template.research?.scrapingStrategy as any)?.seedUrls ?? [];
    handleScrapingStrategyChange('seedUrls', currentUrls.filter((_: any, i: number) => i !== index));
  };

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
        customFields: [...(template.research?.customFields ?? []), newField],
      } as any,
    });
  };

  const removeCustomField = (index: number) => {
    const fields = template.research?.customFields ?? [];
    onUpdate({
      research: {
        ...template.research,
        customFields: fields.filter((_, i) => i !== index),
      } as any,
    });
  };

  const updateCustomField = (index: number, updates: any) => {
    const fields = [...(template.research?.customFields ?? [])];
    fields[index] = { ...fields[index], ...updates };
    onUpdate({
      research: {
        ...template.research,
        customFields: fields,
      } as any,
    });
  };

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Template identification and categorization</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="id">Template ID</Label>
              <Input
                id="id"
                value={template.id}
                onChange={e => handleBasicInfoChange('id', e.target.value)}
                disabled={disabled}
                placeholder="e.g., dental-practices"
              />
              <p className="text-xs text-muted-foreground">
                Lowercase with hyphens only
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={template.name}
                onChange={e => handleBasicInfoChange('name', e.target.value)}
                disabled={disabled}
                placeholder="e.g., Dental Practices"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={template.category}
                onValueChange={val => handleBasicInfoChange('category', val)}
              >
                <SelectTrigger disabled={disabled}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Healthcare & Wellness">Healthcare & Wellness</SelectItem>
                  <SelectItem value="Real Estate">Real Estate</SelectItem>
                  <SelectItem value="Technology">Technology</SelectItem>
                  <SelectItem value="Home Services">Home Services</SelectItem>
                  <SelectItem value="Professional Services">Professional Services</SelectItem>
                  <SelectItem value="Hospitality">Hospitality</SelectItem>
                  <SelectItem value="Nonprofit">Nonprofit</SelectItem>
                  <SelectItem value="Restaurant">Restaurant</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={template.description}
              onChange={e => handleBasicInfoChange('description', e.target.value)}
              disabled={disabled}
              rows={2}
              placeholder="Brief description of this industry template"
            />
          </div>
        </CardContent>
      </Card>

      {/* Scraping Strategy */}
      <Card>
        <CardHeader>
          <CardTitle>Scraping Strategy</CardTitle>
          <CardDescription>Configure how data is collected for this industry</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary Source</Label>
              <Select
                value={template.research?.scrapingStrategy?.primarySource ?? 'website'}
                onValueChange={val => handleScrapingStrategyChange('primarySource', val)}
              >
                <SelectTrigger disabled={disabled}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="website">Website</SelectItem>
                  <SelectItem value="linkedin-company">LinkedIn Company</SelectItem>
                  <SelectItem value="google-business">Google Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select
                value={template.research?.scrapingStrategy?.frequency ?? 'per-lead'}
                onValueChange={val => handleScrapingStrategyChange('frequency', val)}
              >
                <SelectTrigger disabled={disabled}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="per-lead">Per Lead</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Timeout (ms)</Label>
              <Input
                type="number"
                value={template.research?.scrapingStrategy?.timeoutMs ?? 30000}
                onChange={e => handleScrapingStrategyChange('timeoutMs', parseInt(e.target.value))}
                disabled={disabled}
                min={1000}
                max={60000}
              />
            </div>

            <div className="space-y-2">
              <Label>Cache TTL (seconds)</Label>
              <Input
                type="number"
                value={template.research?.scrapingStrategy?.cacheTtlSeconds ?? 300}
                onChange={e => handleScrapingStrategyChange('cacheTtlSeconds', parseInt(e.target.value))}
                disabled={disabled}
                min={0}
                max={3600}
              />
            </div>

            <div className="space-y-2">
              <Label>Enable Caching</Label>
              <Select
                value={template.research?.scrapingStrategy?.enableCaching ? 'true' : 'false'}
                onValueChange={val => handleScrapingStrategyChange('enableCaching', val === 'true')}
              >
                <SelectTrigger disabled={disabled}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Enabled</SelectItem>
                  <SelectItem value="false">Disabled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Fields */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Custom CRM Fields</CardTitle>
              <CardDescription>Industry-specific data fields to extract</CardDescription>
            </div>
            <Button size="sm" onClick={addCustomField} disabled={disabled}>
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
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
    </div>
  );
}
