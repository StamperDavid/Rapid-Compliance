'use client';

/**
 * Industry List Component
 * 
 * Displays all 49 industry templates grouped by category
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Edit, CheckCircle, Circle } from 'lucide-react';

interface TemplateOption {
  value: string;
  label: string;
  description: string;
  category: string;
  hasOverride: boolean;
}

interface IndustryListProps {
  templates: TemplateOption[];
  onSelect: (templateId: string) => void;
  isLoading: boolean;
}

export function IndustryList({ templates, onSelect, isLoading }: IndustryListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Group templates by category
  const categorizedTemplates = useMemo(() => {
    const categories: Record<string, TemplateOption[]> = {};
    
    templates.forEach(template => {
      if (!categories[template.category]) {
        categories[template.category] = [];
      }
      categories[template.category].push(template);
    });

    // Sort templates within each category by name
    Object.keys(categories).forEach(category => {
      categories[category].sort((a, b) => a.label.localeCompare(b.label));
    });

    return categories;
  }, [templates]);

  // Get unique categories
  const categories = useMemo(() => {
    return Object.keys(categorizedTemplates).sort();
  }, [categorizedTemplates]);

  // Filter templates by search term
  const filteredTemplates = useMemo(() => {
    if (!searchTerm) {
      return categorizedTemplates;
    }

    const filtered: Record<string, TemplateOption[]> = {};
    const searchLower = searchTerm.toLowerCase();

    Object.entries(categorizedTemplates).forEach(([category, templates]) => {
      const matchingTemplates = templates.filter(
        template =>
          template.label.toLowerCase().includes(searchLower) ||
          template.description.toLowerCase().includes(searchLower) ||
          template.value.toLowerCase().includes(searchLower)
      );

      if (matchingTemplates.length > 0) {
        filtered[category] = matchingTemplates;
      }
    });

    return filtered;
  }, [categorizedTemplates, searchTerm]);

  // Get templates for selected category
  const displayTemplates = useMemo(() => {
    if (selectedCategory === 'all') {
      return filteredTemplates;
    }

    return {
      [selectedCategory]: filteredTemplates[selectedCategory] || [],
    };
  }, [filteredTemplates, selectedCategory]);

  // Count templates
  const totalCount = templates.length;
  const customizedCount = templates.filter(t => t.hasOverride).length;
  const filteredCount = Object.values(filteredTemplates).reduce(
    (sum, arr) => sum + arr.length,
    0
  );

  if (isLoading && templates.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">
            Loading templates...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="text-sm text-muted-foreground whitespace-nowrap">
          {searchTerm ? `${filteredCount} of ${totalCount}` : `${totalCount} templates`} • {customizedCount} customized
        </div>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
        <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
          <TabsTrigger value="all" className="flex-shrink-0">
            All ({totalCount})
          </TabsTrigger>
          {categories.map(category => (
            <TabsTrigger
              key={category}
              value={category}
              className="flex-shrink-0"
            >
              {category} ({categorizedTemplates[category]?.length || 0})
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          {Object.keys(displayTemplates).length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <div className="text-center text-muted-foreground">
                  No templates found matching &quot;{searchTerm}&quot;
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(displayTemplates).map(([category, templates]) => (
                <div key={category}>
                  {selectedCategory === 'all' && (
                    <h3 className="text-lg font-semibold mb-4">{category}</h3>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {templates.map(template => (
                      <Card
                        key={template.value}
                        className="hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => onSelect(template.value)}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <CardTitle className="text-base flex items-center gap-2">
                              {template.hasOverride ? (
                                <CheckCircle className="h-4 w-4 text-success flex-shrink-0" />
                              ) : (
                                <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                              )}
                              {template.label}
                            </CardTitle>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={e => {
                                e.stopPropagation();
                                onSelect(template.value);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground mb-3">
                            {template.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <Badge variant={template.hasOverride ? 'default' : 'outline'}>
                              {template.hasOverride ? 'Customized' : 'Default'}
                            </Badge>
                            <code className="text-xs text-muted-foreground">
                              {template.value}
                            </code>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
