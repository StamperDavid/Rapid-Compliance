'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, FileText } from 'lucide-react';
import type { IndustryTemplate } from '@/lib/persona/templates/types';

interface BasicInfoSectionProps {
  template: IndustryTemplate;
  onUpdate: (updates: Partial<IndustryTemplate>) => void;
  disabled: boolean;
  errors: Record<string, string>;
}

export function BasicInfoSection({ template, onUpdate, disabled, errors }: BasicInfoSectionProps) {
  const sectionErrors = Object.entries(errors).filter(([key]) =>
    ['id', 'name', 'description', 'category'].includes(key)
  );

  return (
    <Card id="basic-info" className="scroll-mt-24">
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          <div>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Template identification and categorization</CardDescription>
          </div>
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
            <Label htmlFor="id">Template ID</Label>
            <Input
              id="id"
              value={template.id}
              onChange={e => onUpdate({ id: e.target.value })}
              disabled={disabled}
              placeholder="e.g., dental-practices"
              className={errors['id'] ? 'border-destructive' : ''}
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
              onChange={e => onUpdate({ name: e.target.value })}
              disabled={disabled}
              placeholder="e.g., Dental Practices"
              className={errors['name'] ? 'border-destructive' : ''}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category</Label>
            <Select
              value={template.category}
              onValueChange={val => onUpdate({ category: val })}
              disabled={disabled}
            >
              <SelectTrigger className={errors['category'] ? 'border-destructive' : ''}>
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
            onChange={e => onUpdate({ description: e.target.value })}
            disabled={disabled}
            rows={2}
            placeholder="Brief description of this industry template"
            className={errors['description'] ? 'border-destructive' : ''}
          />
        </div>
      </CardContent>
    </Card>
  );
}
