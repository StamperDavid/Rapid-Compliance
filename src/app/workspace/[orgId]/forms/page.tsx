'use client';

/**
 * Forms Management Page
 *
 * Lists all forms for the organization with status, analytics,
 * and quick actions. Includes create form modal with templates.
 *
 * @route /workspace/[orgId]/forms
 * @version 2.0.0
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Eye,
  Pencil,
  Mail,
  Target,
  BarChart3,
  Calendar,
  Briefcase,
  X,
  TrendingUp,
  Users,
} from 'lucide-react';
import type { FormDefinition, FormStatus } from '@/lib/forms/types';

// ============================================================================
// TYPES
// ============================================================================

interface FormTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: React.ReactNode;
}

interface CreateFormResponse {
  id: string;
}

function isCreateFormResponse(data: unknown): data is CreateFormResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'id' in data &&
    typeof (data as Record<string, unknown>).id === 'string'
  );
}

// ============================================================================
// MOCK TEMPLATES
// ============================================================================

const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'blank',
    name: 'Blank Form',
    description: 'Start from scratch with a blank form',
    category: 'Basic',
    icon: <FileText className="w-6 h-6" />,
  },
  {
    id: 'contact',
    name: 'Contact Form',
    description: 'Simple contact form with name, email, and message',
    category: 'Basic',
    icon: <Mail className="w-6 h-6" />,
  },
  {
    id: 'lead-capture',
    name: 'Lead Capture',
    description: 'Capture leads with company and qualification fields',
    category: 'Sales',
    icon: <Target className="w-6 h-6" />,
  },
  {
    id: 'survey',
    name: 'Customer Survey',
    description: 'Multi-step survey with rating and feedback',
    category: 'Feedback',
    icon: <BarChart3 className="w-6 h-6" />,
  },
  {
    id: 'registration',
    name: 'Event Registration',
    description: 'Event signup with attendee details',
    category: 'Events',
    icon: <Calendar className="w-6 h-6" />,
  },
  {
    id: 'application',
    name: 'Job Application',
    description: 'Application form with file uploads',
    category: 'HR',
    icon: <Briefcase className="w-6 h-6" />,
  },
];

// ============================================================================
// SKELETON LOADER
// ============================================================================

function FormCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 0.7, y: 0 }}
      className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden"
    >
      <div className="p-5 border-b border-white/10">
        <div className="h-6 w-3/5 bg-white/5 rounded animate-pulse" />
        <div className="h-4 w-4/5 bg-white/5 rounded mt-2 animate-pulse" />
      </div>
      <div className="p-5">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="text-center">
              <div className="h-7 w-10 bg-white/5 rounded mx-auto animate-pulse" />
              <div className="h-3 w-15 bg-white/5 rounded mx-auto mt-1 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex justify-between items-center px-5 py-4 border-t border-white/10 bg-black/20">
        <div className="h-6 w-20 bg-white/5 rounded-full animate-pulse" />
        <div className="h-7 w-24 bg-white/5 rounded animate-pulse" />
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function FormsPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const [forms, setForms] = useState<FormDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | FormStatus>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newFormName, setNewFormName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('blank');
  const [creating, setCreating] = useState(false);

  // Fetch forms
  const fetchForms = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/workspace/${orgId}/forms?workspaceId=default`);

      if (!response.ok) {
        throw new Error('Failed to fetch forms');
      }

      const data: unknown = await response.json();
      const forms = (data as { forms?: FormDefinition[] }).forms ?? [];
      setForms(forms);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load forms');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void fetchForms();
  }, [fetchForms]);

  // Filter forms
  const filteredForms = forms.filter((form) => {
    if (activeFilter === 'all') {
      return true;
    }
    return form.status === activeFilter;
  });

  // Handle create form
  const handleCreateForm = async () => {
    if (!newFormName.trim()) {
      return;
    }

    try {
      setCreating(true);

      const response = await fetch(`/api/workspace/${orgId}/forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'default',
          name: newFormName,
          templateId: selectedTemplate,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create form');
      }

      const data: unknown = await response.json();

      if (!isCreateFormResponse(data)) {
        throw new Error('Invalid response from server');
      }

      router.push(`/workspace/${orgId}/forms/${data.id}/edit`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create form');
      setCreating(false);
    }
  };

  // Get status badge classes
  const getStatusBadgeClasses = (status: FormStatus) => {
    switch (status) {
      case 'published':
        return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
      case 'archived':
        return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border border-gray-500/30';
    }
  };

  // Format date
  const formatDate = (timestamp: unknown) => {
    if (!timestamp) {
      return 'N/A';
    }
    const date = (timestamp as { toDate?: () => Date }).toDate
      ? (timestamp as { toDate: () => Date }).toDate()
      : new Date(timestamp as string | number | Date);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-between items-start mb-8"
        >
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">Forms</h1>
              <p className="text-sm text-gray-400">
                Create and manage forms to capture leads and collect data
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-200"
          >
            <Plus className="w-5 h-5" />
            <span>Create New Form</span>
          </motion.button>
        </motion.div>

        {/* Filter Tabs */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex gap-2 mb-6 border-b border-white/10 pb-4"
        >
          {(['all', 'draft', 'published', 'archived'] as const).map((filter) => (
            <motion.button
              key={filter}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveFilter(filter)}
              className={`
                px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                ${
                  activeFilter === filter
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }
              `}
            >
              {filter.charAt(0).toUpperCase() + filter.slice(1)}
              <span className="ml-1.5">
                ({filter === 'all' ? forms.length : forms.filter((f) => f.status === filter).length})
              </span>
            </motion.button>
          ))}
        </motion.div>

        {/* Error State */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <FormCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredForms.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16 px-8 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl"
          >
            <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center mx-auto mb-6 opacity-50">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">
              {activeFilter === 'all' ? 'No forms yet' : `No ${activeFilter} forms`}
            </h3>
            <p className="text-sm text-gray-400 mb-6">
              {activeFilter === 'all'
                ? 'Create your first form to start capturing leads and collecting data.'
                : `You don't have any ${activeFilter} forms.`}
            </p>
            {activeFilter === 'all' && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                Create New Form
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Forms Grid */}
        {!loading && filteredForms.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {filteredForms.map((form, index) => (
              <motion.div
                key={form.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                whileHover={{ y: -4, scale: 1.01 }}
                onClick={() => router.push(`/workspace/${orgId}/forms/${form.id}/edit`)}
                className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden cursor-pointer hover:border-white/20 transition-all duration-300 group"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-white/10">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-semibold text-white truncate group-hover:text-violet-400 transition-colors">
                        {form.name}
                      </h3>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {form.description ?? 'No description'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card Body - Stats */}
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-xl font-semibold text-white mb-1">
                        <Users className="w-4 h-4 text-violet-400" />
                        {form.submissionCount || 0}
                      </div>
                      <div className="text-xs text-gray-400">Submissions</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-xl font-semibold text-white mb-1">
                        <Eye className="w-4 h-4 text-purple-400" />
                        {form.viewCount || 0}
                      </div>
                      <div className="text-xs text-gray-400">Views</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-xl font-semibold text-white mb-1">
                        <TrendingUp className="w-4 h-4 text-emerald-400" />
                        {form.viewCount > 0
                          ? `${Math.round((form.submissionCount / form.viewCount) * 100)}%`
                          : '0%'}
                      </div>
                      <div className="text-xs text-gray-400">Conversion</div>
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="flex justify-between items-center px-5 py-4 border-t border-white/10 bg-black/20">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadgeClasses(form.status)}`}>
                      {form.status.charAt(0).toUpperCase() + form.status.slice(1)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(form.updatedAt)}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/workspace/${orgId}/forms/${form.id}/edit`}
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                      title="Edit form"
                    >
                      <Pencil className="w-4 h-4" />
                    </Link>
                    {form.status === 'published' && (
                      <Link
                        href={`/forms/${form.id}`}
                        target="_blank"
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                        title="View form"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Create Form Modal */}
        <AnimatePresence>
          {showCreateModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-8"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-auto shadow-2xl"
              >
                {/* Modal Header */}
                <div className="flex justify-between items-center p-6 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-purple-500 flex items-center justify-center">
                      <Plus className="w-5 h-5 text-white" />
                    </div>
                    <h2 className="text-xl font-semibold text-white">Create New Form</h2>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 90 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowCreateModal(false)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-all"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>

                {/* Modal Body */}
                <div className="p-6 space-y-6">
                  {/* Form Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Form Name
                    </label>
                    <input
                      type="text"
                      value={newFormName}
                      onChange={(e) => setNewFormName(e.target.value)}
                      placeholder="Enter form name..."
                      autoFocus
                      className="w-full px-4 py-3 text-sm bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 transition-all"
                    />
                  </div>

                  {/* Template Selection */}
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-3">
                      Choose a Template
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {FORM_TEMPLATES.map((template) => (
                        <motion.div
                          key={template.id}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setSelectedTemplate(template.id)}
                          className={`
                            p-4 rounded-xl cursor-pointer transition-all duration-200
                            ${
                              selectedTemplate === template.id
                                ? 'bg-gradient-to-br from-violet-600/20 to-purple-600/20 border-2 border-violet-500/50 shadow-lg shadow-violet-500/20'
                                : 'bg-black/40 backdrop-blur-xl border border-white/10 hover:border-white/20'
                            }
                          `}
                        >
                          <div className={`
                            w-10 h-10 rounded-lg flex items-center justify-center mb-3
                            ${
                              selectedTemplate === template.id
                                ? 'bg-gradient-to-br from-violet-500 to-purple-500 text-white'
                                : 'bg-white/5 text-gray-400'
                            }
                          `}>
                            {template.icon}
                          </div>
                          <div className="text-sm font-semibold text-white mb-1">
                            {template.name}
                          </div>
                          <div className="text-xs text-gray-400 line-clamp-2">
                            {template.description}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-white/10 bg-black/20">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowCreateModal(false)}
                    className="px-6 py-2.5 text-sm font-medium text-gray-400 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-all"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: !newFormName.trim() || creating ? 1 : 1.02 }}
                    whileTap={{ scale: !newFormName.trim() || creating ? 1 : 0.98 }}
                    onClick={() => {
                      void handleCreateForm();
                    }}
                    disabled={!newFormName.trim() || creating}
                    className={`
                      px-6 py-2.5 text-sm font-semibold rounded-xl transition-all
                      ${
                        !newFormName.trim() || creating
                          ? 'bg-gradient-to-r from-violet-600/50 to-purple-600/50 text-white/50 cursor-not-allowed'
                          : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white shadow-lg shadow-violet-500/25'
                      }
                    `}
                  >
                    {creating ? 'Creating...' : 'Create Form'}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
