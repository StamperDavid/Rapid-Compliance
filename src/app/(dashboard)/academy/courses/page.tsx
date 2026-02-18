'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getSubCollection } from '@/lib/firebase/collections';
import { FirestoreService } from '@/lib/db/firestore-service';
import { orderBy } from 'firebase/firestore';

interface Course {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  lessonCount: number;
  duration: number; // total minutes
  thumbnailUrl?: string;
  status: 'published' | 'draft';
  createdAt: string;
}

const DIFFICULTY_CONFIG: Record<string, { label: string; color: string }> = {
  beginner: { label: 'Beginner', color: '#059669' },
  intermediate: { label: 'Intermediate', color: '#d97706' },
  advanced: { label: 'Advanced', color: '#dc2626' },
};

const CATEGORIES = [
  { id: 'all', label: 'All Courses' },
  { id: 'getting-started', label: 'Getting Started' },
  { id: 'ai-agents', label: 'AI Agents' },
  { id: 'crm', label: 'CRM & Sales' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'advanced', label: 'Advanced' },
];

const coursesPath = getSubCollection('academyCourses');

export default function CoursesPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  const loadCourses = useCallback(async () => {
    try {
      setLoading(true);
      const data = await FirestoreService.getAll<Course>(
        coursesPath,
        [orderBy('createdAt', 'desc')]
      );
      setCourses(data.filter((c) => c.status === 'published'));
    } catch {
      toast.error('Failed to load courses');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user) {
      void loadCourses();
    }
  }, [user, loadCourses]);

  const filteredCourses = activeCategory === 'all'
    ? courses
    : courses.filter((c) => c.category === activeCategory);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem 2rem',
        borderBottom: '1px solid var(--color-bg-elevated)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.25rem' }}>
            <Link href="/academy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
              Academy
            </Link>
            <span style={{ color: 'var(--color-text-muted)' }}>/</span>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Courses</h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            Structured learning paths to master SalesVelocity.ai
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
        {/* Category Filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '0.375rem',
                border: 'none',
                backgroundColor: activeCategory === cat.id ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                color: activeCategory === cat.id ? '#fff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 500,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            Loading courses...
          </div>
        ) : filteredCourses.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            backgroundColor: 'var(--color-bg-card)',
            border: '2px dashed var(--color-bg-elevated)',
            borderRadius: '0.75rem',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Courses Available Yet</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Courses are being developed. Check back soon for structured learning paths.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}>
            {filteredCourses.map((course) => {
              const difficulty = DIFFICULTY_CONFIG[course.difficulty] ?? DIFFICULTY_CONFIG.beginner;
              return (
                <Link
                  key={course.id}
                  href={`/academy/courses/${course.id}`}
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    border: '1px solid var(--color-bg-elevated)',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'border-color 0.2s',
                  }}
                >
                  {/* Thumbnail */}
                  <div style={{
                    height: '160px',
                    backgroundColor: 'var(--color-bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '3rem',
                    position: 'relative',
                  }}>
                    {course.thumbnailUrl ? (
                      <Image
                        src={course.thumbnailUrl}
                        alt={course.title}
                        fill
                        style={{ objectFit: 'cover' }}
                      />
                    ) : (
                      '📖'
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: '1.25rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        backgroundColor: `${difficulty.color}20`,
                        color: difficulty.color,
                      }}>
                        {difficulty.label}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {course.lessonCount} lesson{course.lessonCount !== 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {course.duration} min
                      </span>
                    </div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                      {course.title}
                    </h3>
                    <p style={{
                      fontSize: '0.8125rem',
                      color: 'var(--color-text-secondary)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      margin: 0,
                    }}>
                      {course.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
