'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { PageTitle, SectionDescription } from '@/components/ui/typography';

interface Tutorial {
  id: string;
  title: string;
  description: string;
  category: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  duration: number; // seconds
  status: 'published' | 'draft';
  order: number;
  createdAt: Date;
}

const CATEGORIES = [
  { id: 'all', label: 'All Tutorials' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'ai-agents', label: 'AI Agents' },
  { id: 'crm', label: 'CRM & Leads' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'video', label: 'Video Creation' },
  { id: 'website', label: 'Website Builder' },
  { id: 'advanced', label: 'Advanced' },
];

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default function AcademyPage() {
  const { user: _user } = useAuth();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedTutorial, setSelectedTutorial] = useState<Tutorial | null>(null);

  const fetchTutorials = useCallback(async () => {
    if (!db) { return; }
    try {
      const ref = collection(db, 'organizations', PLATFORM_ID, 'academy_tutorials');
      const q = query(ref, orderBy('order', 'asc'));
      const snapshot = await getDocs(q);
      const items: Tutorial[] = snapshot.docs.map((doc) => {
        const data = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          title: (data.title as string) ?? '',
          description: (data.description as string) ?? '',
          category: (data.category as string) ?? 'getting-started',
          videoUrl: (data.videoUrl as string | null) ?? null,
          thumbnailUrl: (data.thumbnailUrl as string | null) ?? null,
          duration: (data.duration as number) ?? 0,
          status: (data.status as 'published' | 'draft') ?? 'published',
          order: (data.order as number) ?? 0,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        };
      });
      setTutorials(items.filter((t) => t.status === 'published'));
    } catch (err) {
      logger.error('Failed to fetch tutorials', err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchTutorials();
  }, [fetchTutorials]);

  const filteredTutorials = activeCategory === 'all'
    ? tutorials
    : tutorials.filter((t) => t.category === activeCategory);

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div>
        <PageTitle className="mb-1">Academy</PageTitle>
        <SectionDescription>
          Learn how to use SalesVelocity.ai with step-by-step tutorials and courses.
        </SectionDescription>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 flex-wrap">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all cursor-pointer ${
              activeCategory === cat.id
                ? 'bg-primary border-primary text-white'
                : 'bg-transparent border-border text-foreground'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Video Player */}
      {selectedTutorial && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="aspect-video bg-black flex items-center justify-center">
            {selectedTutorial.videoUrl ? (
              <video
                src={selectedTutorial.videoUrl}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            ) : (
              <p className="text-muted-foreground">Video coming soon</p>
            )}
          </div>
          <div className="p-5">
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {selectedTutorial.title}
            </h2>
            <SectionDescription>{selectedTutorial.description}</SectionDescription>
          </div>
        </div>
      )}

      {/* Tutorial Grid */}
      {loading ? (
        <div className="text-center p-12 text-muted-foreground">
          Loading tutorials...
        </div>
      ) : filteredTutorials.length === 0 ? (
        <div className="text-center p-16 bg-card border border-border rounded-xl">
          <div className="text-5xl mb-4">🎓</div>
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {activeCategory === 'all' ? 'No tutorials yet' : `No ${CATEGORIES.find(c => c.id === activeCategory)?.label ?? ''} tutorials yet`}
          </h3>
          <SectionDescription>
            Tutorial content is being created. Check back soon or ask Jasper to create a tutorial video.
          </SectionDescription>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredTutorials.map((tutorial) => (
            <button
              key={tutorial.id}
              onClick={() => setSelectedTutorial(tutorial)}
              className={`text-left rounded-xl border overflow-hidden cursor-pointer transition-all p-0 w-full ${
                selectedTutorial?.id === tutorial.id
                  ? 'bg-surface-elevated border-primary'
                  : 'bg-card border-border'
              }`}
            >
              <div className="aspect-video bg-[#1a1a2e] flex items-center justify-center relative">
                {tutorial.thumbnailUrl ? (
                  <Image
                    src={tutorial.thumbnailUrl}
                    alt={tutorial.title}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span className="text-4xl">🎬</span>
                )}
                {tutorial.duration > 0 && (
                  <span className="absolute bottom-2 right-2 bg-black/80 text-white px-1.5 py-0.5 rounded text-xs">
                    {formatDuration(tutorial.duration)}
                  </span>
                )}
              </div>
              <div className="px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {tutorial.title}
                </h3>
                <p
                  className="text-muted-foreground text-xs line-clamp-2"
                  style={{
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {tutorial.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
