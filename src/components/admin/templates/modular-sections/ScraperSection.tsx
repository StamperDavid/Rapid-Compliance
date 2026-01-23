'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, Globe, Trash2 } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface ScraperSectionProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
  onRemove?: () => void;
  canRemove?: boolean;
  errors: Record<string, string>;
}

export function ScraperSection({ template, onUpdate, disabled, onRemove, canRemove, errors }: ScraperSectionProps) {
  const sectionErrors = Object.entries(errors).filter(([key]) =>
    key.startsWith('research.scrapingStrategy')
  );

  const handleScrapingStrategyChange = (field: string, value: string | number | boolean) => {
    onUpdate({
      research: {
        ...template.research,
        scrapingStrategy: {
          ...template.research?.scrapingStrategy,
          [field]: value,
        },
      } as IndustryTemplate['research'],
    });
  };

  return (
    <Card id="scraper" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            <div>
              <CardTitle>Web Scraper Configuration</CardTitle>
              <CardDescription>Configure how data is collected for this industry</CardDescription>
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
        {sectionErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {sectionErrors.map(([key, message]) => (
                <div key={key}>• {message}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

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
  );
}
