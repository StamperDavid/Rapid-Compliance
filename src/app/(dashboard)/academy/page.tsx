'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

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
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Academy
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
          Learn how to use SalesVelocity.ai with step-by-step tutorials and courses.
        </p>
      </div>

      {/* Category Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.5rem',
              border: '1px solid',
              borderColor: activeCategory === cat.id ? 'var(--color-primary)' : 'var(--color-border)',
              background: activeCategory === cat.id ? 'var(--color-primary)' : 'transparent',
              color: activeCategory === cat.id ? '#fff' : 'var(--color-text)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 500,
              transition: 'all 0.2s',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Video Player */}
      {selectedTutorial && (
        <div style={{
          marginBottom: '2rem',
          background: 'var(--color-bg-secondary)',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
        }}>
          <div style={{
            aspectRatio: '16/9',
            background: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {selectedTutorial.videoUrl ? (
              <video
                src={selectedTutorial.videoUrl}
                controls
                autoPlay
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            ) : (
              <p style={{ color: '#888' }}>Video coming soon</p>
            )}
          </div>
          <div style={{ padding: '1.25rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
              {selectedTutorial.title}
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
              {selectedTutorial.description}
            </p>
          </div>
        </div>
      )}

      {/* Tutorial Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
          Loading tutorials...
        </div>
      ) : filteredTutorials.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '4rem 2rem',
          background: 'var(--color-bg-secondary)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border)',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎓</div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            {activeCategory === 'all' ? 'No tutorials yet' : `No ${CATEGORIES.find(c => c.id === activeCategory)?.label ?? ''} tutorials yet`}
          </h3>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.9rem' }}>
            Tutorial content is being created. Check back soon or ask Jasper to create a tutorial video.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1.25rem',
        }}>
          {filteredTutorials.map((tutorial) => (
            <button
              key={tutorial.id}
              onClick={() => setSelectedTutorial(tutorial)}
              style={{
                textAlign: 'left',
                background: selectedTutorial?.id === tutorial.id
                  ? 'var(--color-bg-tertiary)'
                  : 'var(--color-bg-secondary)',
                borderRadius: '0.75rem',
                border: '1px solid',
                borderColor: selectedTutorial?.id === tutorial.id
                  ? 'var(--color-primary)'
                  : 'var(--color-border)',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'all 0.2s',
                padding: 0,
                width: '100%',
              }}
            >
              <div style={{
                aspectRatio: '16/9',
                background: '#1a1a2e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                {tutorial.thumbnailUrl ? (
                  <Image
                    src={tutorial.thumbnailUrl}
                    alt={tutorial.title}
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: '2.5rem' }}>🎬</span>
                )}
                {tutorial.duration > 0 && (
                  <span style={{
                    position: 'absolute',
                    bottom: 8,
                    right: 8,
                    background: 'rgba(0,0,0,0.8)',
                    color: '#fff',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                  }}>
                    {formatDuration(tutorial.duration)}
                  </span>
                )}
              </div>
              <div style={{ padding: '0.75rem 1rem' }}>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {tutorial.title}
                </h3>
                <p style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: '0.8rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
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
