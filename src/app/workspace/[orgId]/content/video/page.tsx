'use client';

import React, { useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

// Video Engine Types
type VideoObjective = 'awareness' | 'consideration' | 'conversion' | 'retention';
type VideoPlatform = 'youtube' | 'tiktok' | 'instagram' | 'linkedin' | 'website';
type VideoAspectRatio = '16:9' | '9:16' | '1:1' | '4:3';
type VideoResolution = '720p' | '1080p' | '4k';
type VideoPacing = 'slow' | 'medium' | 'fast' | 'dynamic';

interface VideoBrief {
  objective: VideoObjective;
  message: string;
  callToAction: string;
  targetPlatform: VideoPlatform;
}

interface VideoConstraints {
  maxDuration: number;
  aspectRatio: VideoAspectRatio;
  resolution: VideoResolution;
}

interface CreativeDirection {
  mood: string;
  pacing: VideoPacing;
  visualStyle: string;
}

interface StoryboardScene {
  id: string;
  name: string;
  description: string;
  duration: number;
  shotType: string;
  cameraMotion: string;
}

interface GeneratedStoryboard {
  id: string;
  title: string;
  scenes: StoryboardScene[];
  totalDuration: number;
  estimatedCost: {
    total: number;
    currency: string;
  };
  warnings: string[];
  suggestions: string[];
}

/**
 * AI Video Studio - Functional Implementation
 * Connected to Director Service & Stitcher Pipeline
 */
// API Response Interfaces
interface StoryboardGenerationResponse {
  storyboard: GeneratedStoryboard;
}

interface VideoProjectResponse {
  projectId: string;
}

interface ErrorResponse {
  error: string;
}

// Type guard for StoryboardGenerationResponse
function isStoryboardGenerationResponse(data: unknown): data is StoryboardGenerationResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'storyboard' in data &&
    typeof (data as Record<string, unknown>).storyboard === 'object'
  );
}

// Type guard for VideoProjectResponse
function isVideoProjectResponse(data: unknown): data is VideoProjectResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'projectId' in data &&
    typeof (data as Record<string, unknown>).projectId === 'string'
  );
}

// Type guard for ErrorResponse
function isErrorResponse(data: unknown): data is ErrorResponse {
  return (
    typeof data === 'object' &&
    data !== null &&
    'error' in data &&
    typeof (data as Record<string, unknown>).error === 'string'
  );
}

export default function VideoStudioPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;
  const { user: _user } = useAuth();

  // State Management
  const [activeTab, setActiveTab] = useState<'create' | 'projects' | 'templates'>('create');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedStoryboard, setGeneratedStoryboard] = useState<GeneratedStoryboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Brief State
  const [brief, setBrief] = useState<VideoBrief>({
    objective: 'awareness',
    message: '',
    callToAction: '',
    targetPlatform: 'youtube',
  });

  // Constraints State
  const [constraints, setConstraints] = useState<VideoConstraints>({
    maxDuration: 60,
    aspectRatio: '16:9',
    resolution: '1080p',
  });

  // Creative Direction State
  const [creative, setCreative] = useState<CreativeDirection>({
    mood: 'professional',
    pacing: 'medium',
    visualStyle: 'modern and sleek',
  });

  // Voiceover Script
  const [voiceoverScript, setVoiceoverScript] = useState('');

  // Theme colors
  const amberColor = '#f59e0b';
  const amberDark = '#d97706';

  // Generate Storyboard via API
  const handleGenerateStoryboard = useCallback(async () => {
    if (!brief.message.trim()) {
      setError('Please enter a message for your video');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/video/storyboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          brief,
          constraints,
          creativeDirection: creative,
          voiceoverScript: voiceoverScript || brief.message,
        }),
      });

      if (!response.ok) {
        const errData: unknown = await response.json();
        const errorMessage = isErrorResponse(errData)
          ? errData.error
          : 'Failed to generate storyboard';
        throw new Error(errorMessage);
      }

      const data: unknown = await response.json();
      if (!isStoryboardGenerationResponse(data)) {
        throw new Error('Invalid storyboard response from server');
      }
      setGeneratedStoryboard(data.storyboard);
    } catch (err) {
      console.error('Storyboard generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate storyboard');
    } finally {
      setIsGenerating(false);
    }
  }, [orgId, brief, constraints, creative, voiceoverScript]);

  // Start Video Generation
  const handleStartGeneration = useCallback(async () => {
    if (!generatedStoryboard) {
      return;
    }

    try {
      const response = await fetch(`/api/video/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          storyboardId: generatedStoryboard.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start video generation');
      }

      const data: unknown = await response.json();
      if (!isVideoProjectResponse(data)) {
        throw new Error('Invalid project response from server');
      }
      router.push(`/workspace/${orgId}/content/video/project/${data.projectId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start generation');
    }
  }, [orgId, generatedStoryboard, router]);

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)',
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: '#fff',
              marginBottom: '0.5rem',
            }}>
              AI Video Studio
            </h1>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
              Powered by Director Engine + Multi-Model Orchestration
            </p>
          </div>

          {/* Status Badge */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '2rem',
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              backgroundColor: '#22c55e',
              borderRadius: '50%',
            }} />
            <span style={{ color: '#22c55e', fontSize: '0.75rem', fontWeight: '600' }}>
              ENGINE ACTIVE
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          borderBottom: '1px solid #333',
          paddingBottom: '1rem',
        }}>
          {[
            { id: 'create', label: 'Create Video', icon: '🎬' },
            { id: 'projects', label: 'My Projects', icon: '📁' },
            { id: 'templates', label: 'Templates', icon: '📋' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'create' | 'projects' | 'templates')}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: activeTab === tab.id ? `${amberColor}22` : 'transparent',
                border: `1px solid ${activeTab === tab.id ? amberColor : '#333'}`,
                borderRadius: '0.5rem',
                color: activeTab === tab.id ? amberColor : '#999',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Create Tab Content */}
        {activeTab === 'create' && (
          <div style={{ display: 'grid', gridTemplateColumns: generatedStoryboard ? '1fr 1fr' : '1fr', gap: '2rem' }}>
            {/* Left Column - Input Form */}
            <div style={{
              backgroundColor: 'rgba(26, 26, 26, 0.8)',
              border: '1px solid #333',
              borderRadius: '1rem',
              padding: '1.5rem',
            }}>
              <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>
                Video Brief
              </h2>

              {/* Objective Selection */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#999', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Objective
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                  {[
                    { id: 'awareness', label: 'Brand Awareness', icon: '👁️' },
                    { id: 'consideration', label: 'Consideration', icon: '🤔' },
                    { id: 'conversion', label: 'Conversion', icon: '💰' },
                    { id: 'retention', label: 'Retention', icon: '🔄' },
                  ].map((obj) => (
                    <button
                      key={obj.id}
                      onClick={() => setBrief({ ...brief, objective: obj.id as VideoObjective })}
                      style={{
                        padding: '0.75rem',
                        backgroundColor: brief.objective === obj.id ? `${amberColor}22` : '#1a1a1a',
                        border: `1px solid ${brief.objective === obj.id ? amberColor : '#333'}`,
                        borderRadius: '0.5rem',
                        color: brief.objective === obj.id ? amberColor : '#999',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{obj.icon}</div>
                      {obj.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Platform Selection */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#999', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Target Platform
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {[
                    { id: 'youtube', label: 'YouTube' },
                    { id: 'tiktok', label: 'TikTok' },
                    { id: 'instagram', label: 'Instagram' },
                    { id: 'linkedin', label: 'LinkedIn' },
                    { id: 'website', label: 'Website' },
                  ].map((platform) => (
                    <button
                      key={platform.id}
                      onClick={() => setBrief({ ...brief, targetPlatform: platform.id as VideoPlatform })}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: brief.targetPlatform === platform.id ? `${amberColor}22` : '#1a1a1a',
                        border: `1px solid ${brief.targetPlatform === platform.id ? amberColor : '#333'}`,
                        borderRadius: '0.25rem',
                        color: brief.targetPlatform === platform.id ? amberColor : '#999',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      {platform.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Input */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#999', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Video Message *
                </label>
                <textarea
                  value={brief.message}
                  onChange={(e) => setBrief({ ...brief, message: e.target.value })}
                  placeholder="What's the core message of your video? E.g., 'Introduce our new AI-powered sales platform that helps businesses close deals 3x faster...'"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Call to Action */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#999', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Call to Action
                </label>
                <input
                  type="text"
                  value={brief.callToAction}
                  onChange={(e) => setBrief({ ...brief, callToAction: e.target.value })}
                  placeholder="E.g., Start your free trial today"
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '0.875rem',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Voiceover Script */}
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', color: '#999', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                  Voiceover Script (Optional)
                </label>
                <textarea
                  value={voiceoverScript}
                  onChange={(e) => setVoiceoverScript(e.target.value)}
                  placeholder="Leave blank to auto-generate from message, or write your own script..."
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    backgroundColor: '#0a0a0a',
                    border: '1px solid #333',
                    borderRadius: '0.5rem',
                    color: '#fff',
                    fontSize: '0.875rem',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Constraints Section */}
              <div style={{
                padding: '1rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '0.5rem',
                marginBottom: '1.5rem',
              }}>
                <h3 style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
                  Video Settings
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {/* Duration */}
                  <div>
                    <label style={{ display: 'block', color: '#666', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Duration (sec)
                    </label>
                    <select
                      value={constraints.maxDuration}
                      onChange={(e) => setConstraints({ ...constraints, maxDuration: parseInt(e.target.value) })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '0.25rem',
                        color: '#fff',
                        fontSize: '0.75rem',
                      }}
                    >
                      <option value={15}>15s</option>
                      <option value={30}>30s</option>
                      <option value={60}>60s</option>
                      <option value={90}>90s</option>
                      <option value={120}>120s</option>
                    </select>
                  </div>

                  {/* Aspect Ratio */}
                  <div>
                    <label style={{ display: 'block', color: '#666', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Aspect Ratio
                    </label>
                    <select
                      value={constraints.aspectRatio}
                      onChange={(e) => setConstraints({ ...constraints, aspectRatio: e.target.value as VideoAspectRatio })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '0.25rem',
                        color: '#fff',
                        fontSize: '0.75rem',
                      }}
                    >
                      <option value="16:9">16:9 (Landscape)</option>
                      <option value="9:16">9:16 (Portrait)</option>
                      <option value="1:1">1:1 (Square)</option>
                      <option value="4:3">4:3 (Standard)</option>
                    </select>
                  </div>

                  {/* Resolution */}
                  <div>
                    <label style={{ display: 'block', color: '#666', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Resolution
                    </label>
                    <select
                      value={constraints.resolution}
                      onChange={(e) => setConstraints({ ...constraints, resolution: e.target.value as VideoResolution })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '0.25rem',
                        color: '#fff',
                        fontSize: '0.75rem',
                      }}
                    >
                      <option value="720p">720p HD</option>
                      <option value="1080p">1080p Full HD</option>
                      <option value="4k">4K Ultra HD</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Creative Direction */}
              <div style={{
                padding: '1rem',
                backgroundColor: '#0a0a0a',
                borderRadius: '0.5rem',
                marginBottom: '1.5rem',
              }}>
                <h3 style={{ color: '#fff', fontSize: '0.875rem', fontWeight: '600', marginBottom: '1rem' }}>
                  Creative Direction
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  {/* Mood */}
                  <div>
                    <label style={{ display: 'block', color: '#666', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Mood
                    </label>
                    <select
                      value={creative.mood}
                      onChange={(e) => setCreative({ ...creative, mood: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '0.25rem',
                        color: '#fff',
                        fontSize: '0.75rem',
                      }}
                    >
                      <option value="professional">Professional</option>
                      <option value="warm">Warm</option>
                      <option value="dramatic">Dramatic</option>
                      <option value="energetic">Energetic</option>
                      <option value="calm">Calm</option>
                      <option value="innovative">Innovative</option>
                    </select>
                  </div>

                  {/* Pacing */}
                  <div>
                    <label style={{ display: 'block', color: '#666', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Pacing
                    </label>
                    <select
                      value={creative.pacing}
                      onChange={(e) => setCreative({ ...creative, pacing: e.target.value as VideoPacing })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '0.25rem',
                        color: '#fff',
                        fontSize: '0.75rem',
                      }}
                    >
                      <option value="slow">Slow & Elegant</option>
                      <option value="medium">Medium</option>
                      <option value="fast">Fast & Energetic</option>
                      <option value="dynamic">Dynamic Mix</option>
                    </select>
                  </div>

                  {/* Visual Style */}
                  <div>
                    <label style={{ display: 'block', color: '#666', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                      Visual Style
                    </label>
                    <select
                      value={creative.visualStyle}
                      onChange={(e) => setCreative({ ...creative, visualStyle: e.target.value })}
                      style={{
                        width: '100%',
                        padding: '0.5rem',
                        backgroundColor: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '0.25rem',
                        color: '#fff',
                        fontSize: '0.75rem',
                      }}
                    >
                      <option value="modern and sleek">Modern & Sleek</option>
                      <option value="cinematic">Cinematic</option>
                      <option value="minimalist">Minimalist</option>
                      <option value="vibrant">Vibrant & Bold</option>
                      <option value="corporate">Corporate</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Error Display */}
              {error && (
                <div style={{
                  padding: '0.75rem 1rem',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '0.5rem',
                  color: '#f87171',
                  fontSize: '0.875rem',
                  marginBottom: '1rem',
                }}>
                  {error}
                </div>
              )}

              {/* Generate Button */}
              <button
                onClick={() => void handleGenerateStoryboard()}
                disabled={isGenerating || !brief.message.trim()}
                style={{
                  width: '100%',
                  padding: '1rem',
                  background: `linear-gradient(135deg, ${amberColor} 0%, ${amberDark} 100%)`,
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#000',
                  fontSize: '1rem',
                  fontWeight: '700',
                  cursor: isGenerating || !brief.message.trim() ? 'not-allowed' : 'pointer',
                  opacity: isGenerating || !brief.message.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {isGenerating ? (
                  <>
                    <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>
                    Generating Storyboard...
                  </>
                ) : (
                  <>
                    <span>🎬</span>
                    Generate Storyboard
                  </>
                )}
              </button>
            </div>

            {/* Right Column - Storyboard Preview */}
            {generatedStoryboard && (
              <div style={{
                backgroundColor: 'rgba(26, 26, 26, 0.8)',
                border: '1px solid #333',
                borderRadius: '1rem',
                padding: '1.5rem',
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1.5rem',
                }}>
                  <h2 style={{ color: '#fff', fontSize: '1.25rem', fontWeight: '600' }}>
                    Generated Storyboard
                  </h2>
                  <div style={{
                    padding: '0.25rem 0.75rem',
                    backgroundColor: `${amberColor}22`,
                    border: `1px solid ${amberColor}`,
                    borderRadius: '1rem',
                    color: amberColor,
                    fontSize: '0.75rem',
                    fontWeight: '600',
                  }}>
                    {generatedStoryboard.estimatedCost.total} credits
                  </div>
                </div>

                {/* Scenes List */}
                <div style={{ marginBottom: '1.5rem' }}>
                  {generatedStoryboard.scenes.map((scene, index) => (
                    <div
                      key={scene.id}
                      style={{
                        padding: '1rem',
                        backgroundColor: '#0a0a0a',
                        border: '1px solid #333',
                        borderRadius: '0.5rem',
                        marginBottom: '0.5rem',
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.5rem',
                      }}>
                        <span style={{ color: '#fff', fontWeight: '600', fontSize: '0.875rem' }}>
                          Scene {index + 1}: {scene.name}
                        </span>
                        <span style={{ color: '#666', fontSize: '0.75rem' }}>
                          {(scene.duration / 1000).toFixed(1)}s
                        </span>
                      </div>
                      <p style={{ color: '#999', fontSize: '0.75rem', margin: 0 }}>
                        {scene.description}
                      </p>
                      <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginTop: '0.5rem',
                      }}>
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          backgroundColor: '#333',
                          borderRadius: '0.25rem',
                          color: '#999',
                          fontSize: '0.625rem',
                        }}>
                          {scene.shotType}
                        </span>
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          backgroundColor: '#333',
                          borderRadius: '0.25rem',
                          color: '#999',
                          fontSize: '0.625rem',
                        }}>
                          {scene.cameraMotion}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Warnings & Suggestions */}
                {(generatedStoryboard.warnings.length > 0 || generatedStoryboard.suggestions.length > 0) && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    {generatedStoryboard.warnings.map((warning, i) => (
                      <div
                        key={`warn-${i}`}
                        style={{
                          padding: '0.5rem 0.75rem',
                          backgroundColor: 'rgba(234, 179, 8, 0.1)',
                          border: '1px solid rgba(234, 179, 8, 0.3)',
                          borderRadius: '0.25rem',
                          color: '#eab308',
                          fontSize: '0.75rem',
                          marginBottom: '0.5rem',
                        }}
                      >
                        ⚠️ {warning}
                      </div>
                    ))}
                    {generatedStoryboard.suggestions.map((suggestion, i) => (
                      <div
                        key={`sug-${i}`}
                        style={{
                          padding: '0.5rem 0.75rem',
                          backgroundColor: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          borderRadius: '0.25rem',
                          color: '#3b82f6',
                          fontSize: '0.75rem',
                          marginBottom: '0.5rem',
                        }}
                      >
                        💡 {suggestion}
                      </div>
                    ))}
                  </div>
                )}

                {/* Total Duration */}
                <div style={{
                  padding: '1rem',
                  backgroundColor: '#0a0a0a',
                  borderRadius: '0.5rem',
                  marginBottom: '1.5rem',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#999',
                    fontSize: '0.875rem',
                  }}>
                    <span>Total Duration</span>
                    <span style={{ color: '#fff', fontWeight: '600' }}>
                      {(generatedStoryboard.totalDuration / 1000).toFixed(1)} seconds
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => void handleStartGeneration()}
                    style={{
                      flex: 1,
                      padding: '0.875rem',
                      background: `linear-gradient(135deg, #22c55e 0%, #16a34a 100%)`,
                      border: 'none',
                      borderRadius: '0.5rem',
                      color: '#fff',
                      fontSize: '0.875rem',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                    }}
                  >
                    <span>🚀</span>
                    Start Generation
                  </button>
                  <button
                    onClick={() => setGeneratedStoryboard(null)}
                    style={{
                      padding: '0.875rem 1rem',
                      backgroundColor: 'transparent',
                      border: '1px solid #333',
                      borderRadius: '0.5rem',
                      color: '#999',
                      fontSize: '0.875rem',
                      cursor: 'pointer',
                    }}
                  >
                    Edit
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Projects Tab */}
        {activeTab === 'projects' && (
          <div style={{
            backgroundColor: 'rgba(26, 26, 26, 0.8)',
            border: '1px solid #333',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
            <h3 style={{ color: '#fff', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Your Video Projects
            </h3>
            <p style={{ color: '#666', marginBottom: '1.5rem' }}>
              Create your first video to see it here
            </p>
            <button
              onClick={() => setActiveTab('create')}
              style={{
                padding: '0.75rem 1.5rem',
                background: `linear-gradient(135deg, ${amberColor} 0%, ${amberDark} 100%)`,
                border: 'none',
                borderRadius: '0.5rem',
                color: '#000',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Create New Video
            </button>
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {[
              { id: 'product-demo', name: 'Product Demo', icon: '🎥', description: 'Showcase your product features' },
              { id: 'sales-pitch', name: 'Sales Pitch', icon: '💼', description: 'Compelling sales presentation' },
              { id: 'explainer', name: 'Explainer Video', icon: '📚', description: 'Break down complex concepts' },
              { id: 'testimonial', name: 'Testimonial', icon: '⭐', description: 'Customer success stories' },
              { id: 'social-ad', name: 'Social Ad', icon: '📱', description: 'Scroll-stopping social content' },
              { id: 'announcement', name: 'Announcement', icon: '📢', description: 'Company news and updates' },
            ].map((template) => (
              <div
                key={template.id}
                style={{
                  backgroundColor: 'rgba(26, 26, 26, 0.8)',
                  border: '1px solid #333',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => {
                  setBrief({ ...brief, message: `Create a ${template.name.toLowerCase()} for our business...` });
                  setActiveTab('create');
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = amberColor;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = '#333';
                }}
              >
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>{template.icon}</div>
                <h3 style={{ color: '#fff', fontSize: '1rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                  {template.name}
                </h3>
                <p style={{ color: '#666', fontSize: '0.75rem', margin: 0 }}>
                  {template.description}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Provider Badges */}
        <div style={{
          marginTop: '2rem',
          padding: '1rem',
          backgroundColor: 'rgba(26, 26, 26, 0.5)',
          borderRadius: '0.5rem',
          display: 'flex',
          justifyContent: 'center',
          gap: '1rem',
          flexWrap: 'wrap',
        }}>
          <span style={{ color: '#666', fontSize: '0.75rem' }}>Powered by:</span>
          {['Google Veo', 'Runway ML', 'Kling AI', 'Pika Labs', 'HeyGen', 'Sora'].map((provider) => (
            <span
              key={provider}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '0.25rem',
                color: '#999',
                fontSize: '0.625rem',
              }}
            >
              {provider}
            </span>
          ))}
        </div>
      </div>

      <style jsx global>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
