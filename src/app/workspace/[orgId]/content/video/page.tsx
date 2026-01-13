'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { useAuth } from '@/hooks/useAuth';
import type { VideoWaitlistInterest } from '@/types/video';

/**
 * AI Video Generation - Coming Soon Page
 * Video Factory module preview with waitlist signup
 */
export default function VideoComingSoonPage() {
  const params = useParams();
  const orgId = params.orgId as string;
  const { user } = useAuth();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<VideoWaitlistInterest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Amber theme color
  const amberColor = '#f59e0b';
  const amberDark = '#d97706';
  const amberLight = '#fbbf24';

  const features = [
    {
      icon: '🎭',
      title: 'AI Avatars',
      description: 'Create professional video presenters with HeyGen AI avatars that speak any script naturally.',
      provider: 'HeyGen',
      interest: 'ai-avatars' as VideoWaitlistInterest,
    },
    {
      icon: '🎬',
      title: 'Text-to-Video',
      description: 'Transform text prompts into stunning video content with OpenAI Sora technology.',
      provider: 'Sora',
      interest: 'text-to-video' as VideoWaitlistInterest,
    },
    {
      icon: '📺',
      title: 'Automated Ads',
      description: 'Generate scroll-stopping video ads optimized for social platforms automatically.',
      provider: 'Runway',
      interest: 'automated-ads' as VideoWaitlistInterest,
    },
    {
      icon: '🎯',
      title: 'Personalized Outreach',
      description: 'Create unique videos for each prospect with dynamic personalization.',
      provider: 'Multi-platform',
      interest: 'personalized-outreach' as VideoWaitlistInterest,
    },
    {
      icon: '🎥',
      title: 'Product Demos',
      description: 'Auto-generate product demonstration videos from screen recordings and scripts.',
      provider: 'AI Pipeline',
      interest: 'product-demos' as VideoWaitlistInterest,
    },
    {
      icon: '📱',
      title: 'Social Content',
      description: 'Produce TikTok, Reels, and Shorts-optimized vertical video content at scale.',
      provider: 'Multi-format',
      interest: 'social-content' as VideoWaitlistInterest,
    },
  ];

  const toggleInterest = (interest: VideoWaitlistInterest) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!db) {
        throw new Error('Database not available');
      }

      // Save to Firestore waitlist collection
      await addDoc(collection(db, 'organizations', orgId, 'video_waitlist'), {
        email: email.trim(),
        name: name.trim() || null,
        userId: user?.id || null,
        interests: selectedInterests.length > 0 ? selectedInterests : ['ai-avatars', 'text-to-video'],
        source: 'video-coming-soon-page',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // Also log to analytics collection for tracking
      await addDoc(collection(db, 'organizations', orgId, 'analytics_events'), {
        event: 'video_waitlist_signup',
        userId: user?.id || null,
        email: email.trim(),
        interests: selectedInterests,
        timestamp: serverTimestamp(),
      });

      setIsSubmitted(true);
      setEmail('');
      setName('');
      setSelectedInterests([]);
    } catch (err) {
      console.error('Failed to join waitlist:', err);
      setError('Failed to join waitlist. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)',
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Hero Section */}
        <div style={{
          textAlign: 'center',
          marginBottom: '4rem',
          padding: '3rem 2rem',
          background: `linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.05) 100%)`,
          borderRadius: '1.5rem',
          border: `1px solid ${amberColor}33`,
          backdropFilter: 'blur(10px)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Glassmorphism overlay */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'radial-gradient(ellipse at top, rgba(245, 158, 11, 0.15) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {/* Coming Soon Badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: `${amberColor}22`,
            border: `1px solid ${amberColor}`,
            borderRadius: '2rem',
            marginBottom: '1.5rem',
            position: 'relative',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              backgroundColor: amberColor,
              borderRadius: '50%',
              animation: 'pulse 2s infinite',
            }} />
            <span style={{
              color: amberColor,
              fontSize: '0.875rem',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
            }}>
              Coming Soon
            </span>
          </div>

          {/* Title */}
          <h1 style={{
            fontSize: '3.5rem',
            fontWeight: '800',
            marginBottom: '1rem',
            background: `linear-gradient(135deg, ${amberLight} 0%, ${amberColor} 50%, ${amberDark} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            position: 'relative',
          }}>
            AI Video Generation
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: '1.5rem',
            color: '#999',
            marginBottom: '1rem',
            fontWeight: '300',
            position: 'relative',
          }}>
            Your Autonomous Video Workforce
          </p>

          <p style={{
            fontSize: '1rem',
            color: '#666',
            maxWidth: '600px',
            margin: '0 auto',
            lineHeight: '1.6',
            position: 'relative',
          }}>
            Generate professional videos at scale with AI avatars, text-to-video,
            and automated ad creation. Transform your content strategy.
          </p>
        </div>

        {/* Features Grid */}
        <div style={{ marginBottom: '4rem' }}>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: '600',
            color: '#fff',
            marginBottom: '2rem',
            textAlign: 'center',
          }}>
            Powered by Industry-Leading AI
          </h2>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '1.5rem',
          }}>
            {features.map((feature, index) => (
              <div
                key={index}
                onClick={() => toggleInterest(feature.interest)}
                style={{
                  backgroundColor: selectedInterests.includes(feature.interest)
                    ? `${amberColor}15`
                    : 'rgba(26, 26, 26, 0.8)',
                  border: `1px solid ${selectedInterests.includes(feature.interest) ? amberColor : '#333'}`,
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = amberColor;
                  e.currentTarget.style.transform = 'translateY(-4px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = selectedInterests.includes(feature.interest) ? amberColor : '#333';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Selection indicator */}
                {selectedInterests.includes(feature.interest) && (
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    width: '24px',
                    height: '24px',
                    backgroundColor: amberColor,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                  }}>
                    ✓
                  </div>
                )}

                {/* Icon */}
                <div style={{
                  fontSize: '2.5rem',
                  marginBottom: '1rem',
                }}>
                  {feature.icon}
                </div>

                {/* Provider badge */}
                <div style={{
                  display: 'inline-block',
                  padding: '0.25rem 0.5rem',
                  backgroundColor: `${amberColor}22`,
                  border: `1px solid ${amberColor}44`,
                  borderRadius: '0.25rem',
                  fontSize: '0.625rem',
                  fontWeight: '600',
                  color: amberColor,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: '0.75rem',
                }}>
                  {feature.provider}
                </div>

                {/* Title */}
                <h3 style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: '#fff',
                  marginBottom: '0.5rem',
                }}>
                  {feature.title}
                </h3>

                {/* Description */}
                <p style={{
                  fontSize: '0.875rem',
                  color: '#999',
                  lineHeight: '1.6',
                  margin: 0,
                }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>

          <p style={{
            textAlign: 'center',
            color: '#666',
            fontSize: '0.875rem',
            marginTop: '1.5rem',
          }}>
            Click on features you're most interested in
          </p>
        </div>

        {/* Waitlist Form */}
        <div style={{
          backgroundColor: 'rgba(26, 26, 26, 0.9)',
          border: `1px solid ${amberColor}33`,
          borderRadius: '1.5rem',
          padding: '3rem',
          maxWidth: '500px',
          margin: '0 auto',
          backdropFilter: 'blur(10px)',
        }}>
          {isSubmitted ? (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#fff',
                marginBottom: '0.75rem',
              }}>
                You're on the list!
              </h3>
              <p style={{ color: '#999', marginBottom: '1.5rem' }}>
                We'll notify you as soon as AI Video Generation is ready.
                Get ready to transform your content strategy.
              </p>
              <button
                onClick={() => setIsSubmitted(false)}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: 'transparent',
                  border: `1px solid ${amberColor}`,
                  color: amberColor,
                  borderRadius: '0.5rem',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = `${amberColor}22`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                Add Another Email
              </button>
            </div>
          ) : (
            <>
              <h3 style={{
                fontSize: '1.5rem',
                fontWeight: '600',
                color: '#fff',
                marginBottom: '0.5rem',
                textAlign: 'center',
              }}>
                Join the Waitlist
              </h3>
              <p style={{
                color: '#999',
                marginBottom: '2rem',
                textAlign: 'center',
                fontSize: '0.875rem',
              }}>
                Be the first to access AI Video Generation when it launches.
              </p>

              <form onSubmit={handleSubmit}>
                {/* Name input */}
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{
                    display: 'block',
                    color: '#999',
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                  }}>
                    Name (optional)
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    style={{
                      width: '100%',
                      padding: '0.875rem 1rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = amberColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#333'}
                  />
                </div>

                {/* Email input */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{
                    display: 'block',
                    color: '#999',
                    fontSize: '0.875rem',
                    marginBottom: '0.5rem',
                  }}>
                    Email address *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@company.com"
                    required
                    style={{
                      width: '100%',
                      padding: '0.875rem 1rem',
                      backgroundColor: '#0a0a0a',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '1rem',
                      outline: 'none',
                      transition: 'border-color 0.2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = amberColor}
                    onBlur={(e) => e.currentTarget.style.borderColor = '#333'}
                  />
                </div>

                {/* Selected interests display */}
                {selectedInterests.length > 0 && (
                  <div style={{
                    marginBottom: '1.5rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: `${amberColor}11`,
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    color: '#999',
                  }}>
                    <span style={{ color: amberColor, fontWeight: '500' }}>Interested in: </span>
                    {selectedInterests.map(i => i.replace(/-/g, ' ')).join(', ')}
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div style={{
                    marginBottom: '1rem',
                    padding: '0.75rem 1rem',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '0.5rem',
                    color: '#f87171',
                    fontSize: '0.875rem',
                  }}>
                    {error}
                  </div>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !email}
                  style={{
                    width: '100%',
                    padding: '1rem',
                    background: `linear-gradient(135deg, ${amberColor} 0%, ${amberDark} 100%)`,
                    border: 'none',
                    borderRadius: '0.5rem',
                    color: '#000',
                    fontSize: '1rem',
                    fontWeight: '700',
                    cursor: isSubmitting || !email ? 'not-allowed' : 'pointer',
                    opacity: isSubmitting || !email ? 0.6 : 1,
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting && email) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = `0 10px 30px ${amberColor}44`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {isSubmitting ? 'Joining...' : 'Join Waitlist'}
                </button>
              </form>
            </>
          )}
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: 'center',
          color: '#666',
          fontSize: '0.75rem',
          marginTop: '2rem',
        }}>
          Powered by HeyGen, OpenAI Sora, and Runway
        </p>
      </div>

      {/* CSS for pulse animation */}
      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
