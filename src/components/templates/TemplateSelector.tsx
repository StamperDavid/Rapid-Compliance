/**
 * Template Selector Component
 * 
 * Displays industry templates in a beautiful grid with:
 * - Template cards with icons and descriptions
 * - Category filtering
 * - Template comparison
 * - Preview before applying
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary, InlineErrorFallback } from '@/components/common/ErrorBoundary';

interface TemplateSelectorProps {
  organizationId: string;
  onTemplateSelect?: (templateId: string) => void;
  selectedTemplateId?: string;
}

interface TemplatesApiResponse {
  success: boolean;
  templates: Array<{
    id: string;
    name: string;
    description: string;
    industry: string;
    category: string;
    icon: string;
    stagesCount: number;
    fieldsCount: number;
    workflowsCount: number;
  }>;
}

function TemplateSelectorInner({
  organizationId: _organizationId,
  onTemplateSelect,
  selectedTemplateId
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<Array<{
    id: string;
    name: string;
    description: string;
    industry: string;
    category: string;
    icon: string;
    stagesCount: number;
    fieldsCount: number;
    workflowsCount: number;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const fetchTemplates = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await fetch('/api/templates');
      const data = await response.json() as TemplatesApiResponse;

      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTemplates();
  }, [fetchTemplates]);

  const categories = Array.from(new Set(templates.map(t => t.category)));
  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(t => t.category === selectedCategory);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            selectedCategory === 'all'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          All Templates
        </button>
        {categories.map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedCategory === category
                ? 'bg-blue-500 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {category.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            onClick={() => onTemplateSelect?.(template.id)}
            className={`group bg-gray-800 border-2 rounded-lg p-6 cursor-pointer transition-all hover:scale-105 ${
              selectedTemplateId === template.id
                ? 'border-blue-500 shadow-lg shadow-blue-500/20'
                : 'border-gray-700 hover:border-blue-400'
            }`}
          >
            {/* Icon and Name */}
            <div className="flex items-start gap-4 mb-4">
              <div className="text-4xl">{template.icon}</div>
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-white mb-1">
                  {template.name}
                </h3>
                <p className="text-sm text-gray-400">{template.industry}</p>
              </div>
              {selectedTemplateId === template.id && (
                <div className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center">
                  ✓
                </div>
              )}
            </div>

            {/* Description */}
            <p className="text-gray-300 text-sm mb-4 line-clamp-2">
              {template.description}
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-700">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-400">
                  {template.stagesCount}
                </div>
                <div className="text-xs text-gray-400">Stages</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-400">
                  {template.fieldsCount}
                </div>
                <div className="text-xs text-gray-400">Fields</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-400">
                  {template.workflowsCount}
                </div>
                <div className="text-xs text-gray-400">Workflows</div>
              </div>
            </div>

            {/* Hover Preview */}
            <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="text-xs text-blue-400 font-medium">
                Click to select →
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredTemplates.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-400">No templates found for this category</p>
        </div>
      )}
    </div>
  );
}

// Export with error boundary
export default function TemplateSelector(props: TemplateSelectorProps) {
  return (
    <ErrorBoundary
      componentName="TemplateSelector"
      fallback={<InlineErrorFallback message="Failed to load templates" />}
    >
      <TemplateSelectorInner {...props} />
    </ErrorBoundary>
  );
}
