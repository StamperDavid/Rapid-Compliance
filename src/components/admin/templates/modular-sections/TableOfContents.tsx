'use client';

/**
 * Table of Contents Sidebar
 * 
 * Sticky navigation for jumping to document sections
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';
import type { SectionConfig } from '../ModularTemplateEditor';

interface TableOfContentsProps {
  sections: SectionConfig[];
  onNavigate: (sectionId: string) => void;
  validationErrors: Record<string, string>;
}

export function TableOfContents({ sections, onNavigate, validationErrors }: TableOfContentsProps) {
  const getSectionErrors = (sectionId: string): number => {
    // Count errors that belong to this section
    const sectionPrefixes: Record<string, string[]> = {
      'basic-info': ['id', 'name', 'description', 'category'],
      'scraper': ['research.scrapingStrategy'],
      'crm-fields': ['research.customFields'],
      'signals': ['research.highValueSignals'],
      'fluff': ['research.fluffPatterns'],
      'scoring': ['research.scoringRules'],
      'core-identity': ['coreIdentity'],
      'cognitive': ['cognitiveLogic'],
      'knowledge': ['knowledgeRAG'],
      'learning': ['learningLoops'],
      'tactical': ['tacticalExecution'],
    };

    const prefixes = sectionPrefixes[sectionId] || [];
    return Object.keys(validationErrors).filter(key =>
      prefixes.some(prefix => key.startsWith(prefix))
    ).length;
  };

  return (
    <div className="sticky top-32 w-64 flex-shrink-0">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Table of Contents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {sections.map(section => {
            const errorCount = getSectionErrors(section.id);
            return (
              <Button
                key={section.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start text-left font-normal"
                onClick={() => onNavigate(section.id)}
              >
                <span className="flex-1 truncate">{section.title}</span>
                {section.required && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Required
                  </Badge>
                )}
                {errorCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    <AlertCircle className="h-3 w-3 mr-1" />
                    {errorCount}
                  </Badge>
                )}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardContent className="pt-6">
          <div className="text-xs text-muted-foreground space-y-2">
            <p>
              <strong>Tip:</strong> Click any section to jump to it.
            </p>
            <p>
              Required sections must have valid data before saving.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
