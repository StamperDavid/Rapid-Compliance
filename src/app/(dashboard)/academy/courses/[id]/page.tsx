'use client';

import React, { useState, useEffect, useCallback, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getSubCollection } from '@/lib/firebase/collections';
import { FirestoreService } from '@/lib/db/firestore-service';

interface Lesson {
  id: string;
  title: string;
  description: string;
  type: 'video' | 'text' | 'quiz';
  videoUrl?: string;
  content?: string;
  duration: number; // minutes
  order: number;
}

interface CourseDetail {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  lessonCount: number;
  duration: number;
  lessons: Lesson[];
  createdAt: string;
}

const coursesPath = getSubCollection('academyCourses');

export default function CourseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const toast = useToast();

  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);

  const loadCourse = useCallback(async () => {
    try {
      setLoading(true);
      const data = await FirestoreService.get<CourseDetail>(coursesPath, id);
      if (data) {
        setCourse(data);
        const lessons = data.lessons ?? [];
        if (lessons.length > 0) {
          setActiveLesson(lessons[0] ?? null);
        }
      }
    } catch {
      toast.error('Failed to load course');
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    if (user) {
      void loadCourse();
    }
  }, [user, loadCourse]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
        Loading course...
      </div>
    );
  }

  if (!course) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>Course Not Found</h2>
        <Link href="/academy/courses" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
          Back to Courses
        </Link>
      </div>
    );
  }

  const lessons = course.lessons ?? [];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}>
      {/* Header */}
      <div style={{
        padding: '1.5rem 2rem',
        borderBottom: '1px solid var(--color-bg-elevated)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
          <Link href="/academy" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
            Academy
          </Link>
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <Link href="/academy/courses" style={{ color: 'var(--color-text-secondary)', textDecoration: 'none', fontSize: '0.875rem' }}>
            Courses
          </Link>
          <span style={{ color: 'var(--color-text-muted)' }}>/</span>
          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{course.title}</span>
        </div>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>{course.title}</h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: '0.25rem 0 0 0' }}>
          {course.description}
        </p>
      </div>

      <div style={{ display: 'flex', maxWidth: '1200px', margin: '0 auto' }}>
        {/* Lesson List */}
        <div style={{
          width: '300px',
          borderRight: '1px solid var(--color-bg-elevated)',
          padding: '1rem',
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {lessons.length} Lesson{lessons.length !== 1 ? 's' : ''}
          </div>
          {lessons.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
              No lessons yet. Content is being developed.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              {lessons.sort((a, b) => a.order - b.order).map((lesson, idx) => (
                <button
                  key={lesson.id}
                  onClick={() => setActiveLesson(lesson)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    textAlign: 'left',
                    backgroundColor: activeLesson?.id === lesson.id ? 'var(--color-bg-elevated)' : 'transparent',
                    border: activeLesson?.id === lesson.id ? '1px solid var(--color-primary)' : '1px solid transparent',
                    borderRadius: '0.5rem',
                    cursor: 'pointer',
                    color: 'inherit',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--color-bg-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lesson.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {lesson.type === 'video' ? '🎬' : lesson.type === 'quiz' ? '❓' : '📝'} {lesson.duration} min
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lesson Content */}
        <div style={{ flex: 1, padding: '2rem' }}>
          {activeLesson ? (
            <div>
              <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem' }}>
                {activeLesson.title}
              </h2>
              {activeLesson.description && (
                <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
                  {activeLesson.description}
                </p>
              )}

              {activeLesson.type === 'video' && activeLesson.videoUrl ? (
                <div style={{
                  aspectRatio: '16/9',
                  backgroundColor: '#000',
                  borderRadius: '0.5rem',
                  overflow: 'hidden',
                  marginBottom: '1.5rem',
                }}>
                  <video
                    src={activeLesson.videoUrl}
                    controls
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              ) : activeLesson.type === 'video' ? (
                <div style={{
                  aspectRatio: '16/9',
                  backgroundColor: 'var(--color-bg-elevated)',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '1.5rem',
                }}>
                  <div style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🎬</div>
                    <div style={{ fontSize: '0.875rem' }}>Video coming soon</div>
                  </div>
                </div>
              ) : null}

              {activeLesson.content && (
                <div style={{
                  backgroundColor: 'var(--color-bg-card)',
                  border: '1px solid var(--color-bg-elevated)',
                  borderRadius: '0.5rem',
                  padding: '1.5rem',
                  fontSize: '0.9375rem',
                  lineHeight: 1.7,
                  whiteSpace: 'pre-wrap',
                }}>
                  {activeLesson.content}
                </div>
              )}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
              Select a lesson from the sidebar to begin
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
