'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { getSubCollection } from '@/lib/firebase/collections';
import { FirestoreService } from '@/lib/db/firestore-service';
import { orderBy } from 'firebase/firestore';

interface Certification {
  id: string;
  title: string;
  description: string;
  category: string;
  questionCount: number;
  passingScore: number; // percentage
  duration: number; // minutes
  status: 'published' | 'draft';
  badge: string; // emoji
  createdAt: string;
}

interface CertAttempt {
  id: string;
  certificationId: string;
  userId: string;
  score: number;
  passed: boolean;
  completedAt: string;
}

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const CATEGORY_FILTER = [
  { id: 'all', label: 'All Certifications' },
  { id: 'platform', label: 'Platform' },
  { id: 'ai', label: 'AI & Automation' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'sales', label: 'Sales' },
];

const certificationsPath = getSubCollection('academyCertifications');
const certAttemptsPath = getSubCollection('certificationAttempts');

export default function CertificationsPage() {
  const { user } = useAuth();
  const toast = useToast();

  const [certifications, setCertifications] = useState<Certification[]>([]);
  const [attempts, setAttempts] = useState<CertAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');

  // Quiz state
  const [activeCert, setActiveCert] = useState<Certification | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [showResult, setShowResult] = useState(false);
  const [quizScore, setQuizScore] = useState(0);

  const loadCertifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await FirestoreService.getAll<Certification>(
        certificationsPath,
        [orderBy('createdAt', 'desc')]
      );
      setCertifications(data.filter((c) => c.status === 'published'));
    } catch {
      toast.error('Failed to load certifications');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const loadAttempts = useCallback(async () => {
    if (!user) { return; }
    try {
      const data = await FirestoreService.getAll<CertAttempt>(certAttemptsPath);
      setAttempts(data.filter((a) => a.userId === user.id));
    } catch {
      // Silent fail — attempts are supplementary
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void loadCertifications();
      void loadAttempts();
    }
  }, [user, loadCertifications, loadAttempts]);

  const filteredCerts = activeCategory === 'all'
    ? certifications
    : certifications.filter((c) => c.category === activeCategory);

  const getBestAttempt = (certId: string): CertAttempt | undefined => {
    const certAttempts = attempts.filter((a) => a.certificationId === certId);
    if (certAttempts.length === 0) { return undefined; }
    return certAttempts.reduce((best, curr) => curr.score > best.score ? curr : best);
  };

  const startQuiz = async (cert: Certification) => {
    try {
      const questionsPath = `${certificationsPath}/${cert.id}/questions`;
      const qs = await FirestoreService.getAll<QuizQuestion>(questionsPath);
      if (qs.length === 0) {
        toast.info('Quiz questions are being developed. Check back soon.');
        return;
      }
      setQuestions(qs);
      setActiveCert(cert);
      setCurrentQuestion(0);
      setSelectedAnswer(null);
      setAnswers({});
      setShowResult(false);
      setQuizScore(0);
    } catch {
      toast.error('Failed to load quiz questions');
    }
  };

  const submitAnswer = () => {
    if (selectedAnswer === null) { return; }
    const newAnswers = { ...answers, [currentQuestion]: selectedAnswer };
    setAnswers(newAnswers);

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer(null);
    } else {
      // Calculate score
      let correct = 0;
      for (let i = 0; i < questions.length; i++) {
        if (newAnswers[i] === questions[i].correctIndex) {
          correct++;
        }
      }
      const score = Math.round((correct / questions.length) * 100);
      setQuizScore(score);
      setShowResult(true);

      // Save attempt
      if (activeCert && user) {
        const attemptId = `attempt-${Date.now()}`;
        const attempt: CertAttempt = {
          id: attemptId,
          certificationId: activeCert.id,
          userId: user.id,
          score,
          passed: score >= activeCert.passingScore,
          completedAt: new Date().toISOString(),
        };
        void FirestoreService.set(certAttemptsPath, attemptId, attempt, false);
        setAttempts((prev) => [...prev, attempt]);
      }
    }
  };

  const closeQuiz = () => {
    setActiveCert(null);
    setQuestions([]);
    setCurrentQuestion(0);
    setSelectedAnswer(null);
    setAnswers({});
    setShowResult(false);
  };

  // Quiz view
  if (activeCert && questions.length > 0) {
    const q = questions[currentQuestion];

    if (showResult) {
      const passed = quizScore >= activeCert.passingScore;
      return (
        <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}>
          <div style={{ maxWidth: '600px', margin: '0 auto', padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>
              {passed ? '🏆' : '📝'}
            </div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
              {passed ? 'Congratulations!' : 'Keep Practicing'}
            </h1>
            <p style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', marginBottom: '1.5rem' }}>
              {passed
                ? `You passed the ${activeCert.title} certification!`
                : `You scored ${quizScore}%. You need ${activeCert.passingScore}% to pass.`}
            </p>

            <div style={{
              backgroundColor: 'var(--color-bg-card)',
              border: '1px solid var(--color-bg-elevated)',
              borderRadius: '0.75rem',
              padding: '2rem',
              marginBottom: '2rem',
            }}>
              <div style={{ fontSize: '3rem', fontWeight: 700, color: passed ? '#059669' : '#dc2626' }}>
                {quizScore}%
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
                {Object.values(answers).filter((a, i) => a === questions[i].correctIndex).length} of {questions.length} correct
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button
                onClick={closeQuiz}
                style={{
                  padding: '0.625rem 1.5rem',
                  backgroundColor: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-primary)',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                }}
              >
                Back to Certifications
              </button>
              {!passed && (
                <button
                  onClick={() => void startQuiz(activeCert)}
                  style={{
                    padding: '0.625rem 1.5rem',
                    backgroundColor: 'var(--color-primary)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                  }}
                >
                  Retry Quiz
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ minHeight: '100vh', backgroundColor: 'var(--color-bg-main)', color: 'var(--color-text-primary)' }}>
        <div style={{
          padding: '1rem 2rem',
          borderBottom: '1px solid var(--color-bg-elevated)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>
              {activeCert.title}
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>
              Question {currentQuestion + 1} of {questions.length}
            </div>
          </div>
          <button
            onClick={closeQuiz}
            style={{
              padding: '0.375rem 0.75rem',
              backgroundColor: 'transparent',
              border: '1px solid var(--color-bg-elevated)',
              color: 'var(--color-text-secondary)',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
          >
            Exit Quiz
          </button>
        </div>

        {/* Progress bar */}
        <div style={{ height: '3px', backgroundColor: 'var(--color-bg-elevated)' }}>
          <div style={{
            height: '100%',
            width: `${((currentQuestion + 1) / questions.length) * 100}%`,
            backgroundColor: 'var(--color-primary)',
            transition: 'width 0.3s',
          }} />
        </div>

        <div style={{ maxWidth: '700px', margin: '0 auto', padding: '2.5rem 2rem' }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1.5rem', lineHeight: 1.5 }}>
            {q.question}
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '2rem' }}>
            {q.options.map((option, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedAnswer(idx)}
                style={{
                  width: '100%',
                  padding: '1rem 1.25rem',
                  textAlign: 'left',
                  backgroundColor: selectedAnswer === idx ? 'var(--color-bg-elevated)' : 'var(--color-bg-card)',
                  border: selectedAnswer === idx ? '2px solid var(--color-primary)' : '1px solid var(--color-bg-elevated)',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  color: 'var(--color-text-primary)',
                  fontSize: '0.9375rem',
                  lineHeight: 1.5,
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: selectedAnswer === idx ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                  color: selectedAnswer === idx ? '#fff' : 'var(--color-text-muted)',
                  textAlign: 'center',
                  lineHeight: '24px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  marginRight: '0.75rem',
                }}>
                  {String.fromCharCode(65 + idx)}
                </span>
                {option}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={submitAnswer}
              disabled={selectedAnswer === null}
              style={{
                padding: '0.625rem 2rem',
                backgroundColor: selectedAnswer !== null ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                color: selectedAnswer !== null ? '#fff' : 'var(--color-text-muted)',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: selectedAnswer !== null ? 'pointer' : 'not-allowed',
                fontSize: '0.875rem',
                fontWeight: 600,
              }}
            >
              {currentQuestion < questions.length - 1 ? 'Next Question' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Certifications list
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
            <h1 style={{ fontSize: '1.25rem', fontWeight: 600, margin: 0 }}>Certifications</h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            Earn certifications to demonstrate your SalesVelocity.ai expertise
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>
        {/* Category Filter */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
          {CATEGORY_FILTER.map((cat) => (
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

        {/* Earned badges summary */}
        {attempts.filter((a) => a.passed).length > 0 && (
          <div style={{
            backgroundColor: 'var(--color-bg-card)',
            border: '1px solid var(--color-bg-elevated)',
            borderRadius: '0.75rem',
            padding: '1.25rem 1.5rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}>
            <span style={{ fontSize: '1.5rem' }}>🏆</span>
            <div>
              <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>
                {attempts.filter((a) => a.passed).length} Certification{attempts.filter((a) => a.passed).length !== 1 ? 's' : ''} Earned
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-text-muted)' }}>
                Keep going to earn more badges
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-secondary)' }}>
            Loading certifications...
          </div>
        ) : filteredCerts.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '4rem 2rem',
            backgroundColor: 'var(--color-bg-card)',
            border: '2px dashed var(--color-bg-elevated)',
            borderRadius: '0.75rem',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎓</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>No Certifications Available Yet</h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.875rem' }}>
              Certification exams are being developed. Check back soon.
            </p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.25rem',
          }}>
            {filteredCerts.map((cert) => {
              const best = getBestAttempt(cert.id);
              const passed = best?.passed ?? false;

              return (
                <div
                  key={cert.id}
                  style={{
                    backgroundColor: 'var(--color-bg-card)',
                    border: passed ? '2px solid #059669' : '1px solid var(--color-bg-elevated)',
                    borderRadius: '0.75rem',
                    overflow: 'hidden',
                  }}
                >
                  {/* Badge header */}
                  <div style={{
                    height: '100px',
                    backgroundColor: 'var(--color-bg-elevated)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                  }}>
                    <span style={{ fontSize: '2.5rem' }}>{cert.badge || '🎓'}</span>
                    {passed && (
                      <span style={{
                        position: 'absolute',
                        top: '0.5rem',
                        right: '0.5rem',
                        padding: '0.125rem 0.5rem',
                        borderRadius: '9999px',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        backgroundColor: '#05966920',
                        color: '#059669',
                      }}>
                        CERTIFIED
                      </span>
                    )}
                  </div>

                  {/* Content */}
                  <div style={{ padding: '1.25rem' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.375rem' }}>
                      {cert.title}
                    </h3>
                    <p style={{
                      fontSize: '0.8125rem',
                      color: 'var(--color-text-secondary)',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      margin: '0 0 0.75rem 0',
                    }}>
                      {cert.description}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {cert.questionCount} questions
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {cert.duration} min
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {cert.passingScore}% to pass
                      </span>
                    </div>

                    {best && (
                      <div style={{
                        fontSize: '0.75rem',
                        color: best.passed ? '#059669' : 'var(--color-text-muted)',
                        marginBottom: '0.75rem',
                      }}>
                        Best score: {best.score}%
                      </div>
                    )}

                    <button
                      onClick={() => void startQuiz(cert)}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: passed ? 'var(--color-bg-elevated)' : 'var(--color-primary)',
                        color: passed ? 'var(--color-text-secondary)' : '#fff',
                        border: 'none',
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                      }}
                    >
                      {passed ? 'Retake Exam' : best ? 'Retry Exam' : 'Start Exam'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
