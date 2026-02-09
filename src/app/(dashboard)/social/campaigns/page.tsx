'use client';

import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

interface SocialPost {
  id: string;
  platform: 'linkedin' | 'twitter' | 'facebook' | 'instagram';
  content: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  scheduledFor?: string;
  publishedAt?: string;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
    views: number;
  };
}

interface Campaign {
  id: string;
  name: string;
  status: 'active' | 'paused' | 'completed';
  platforms: string[];
  postsCount: number;
  engagement: number;
  startDate: string;
  endDate?: string;
}

/**
 * Social Media Campaign Manager
 * Connected to Autonomous Posting Agent
 */
export default function SocialMediaCampaignsPage() {
  const { user: _user } = useAuth();

  const [activeTab, setActiveTab] = useState<'campaigns' | 'posts' | 'analytics' | 'settings'>('campaigns');

  // Mock campaigns data
  const [campaigns] = useState<Campaign[]>([
    {
      id: 'camp-1',
      name: 'Q1 Product Launch',
      status: 'active',
      platforms: ['linkedin', 'twitter'],
      postsCount: 24,
      engagement: 4520,
      startDate: '2026-01-01',
      endDate: '2026-03-31',
    },
    {
      id: 'camp-2',
      name: 'Thought Leadership Series',
      status: 'active',
      platforms: ['linkedin'],
      postsCount: 12,
      engagement: 2340,
      startDate: '2026-01-10',
    },
    {
      id: 'camp-3',
      name: 'Holiday Promotion',
      status: 'completed',
      platforms: ['facebook', 'instagram', 'twitter'],
      postsCount: 30,
      engagement: 8920,
      startDate: '2025-12-01',
      endDate: '2025-12-31',
    },
  ]);

  // Mock posts queue
  const [posts] = useState<SocialPost[]>([
    {
      id: 'post-1',
      platform: 'linkedin',
      content: 'Excited to announce our new AI-powered video generation feature! Create professional videos in minutes, not days. #AIMarketing #VideoContent',
      status: 'scheduled',
      scheduledFor: '2026-01-14T14:00:00Z',
    },
    {
      id: 'post-2',
      platform: 'twitter',
      content: 'The future of sales is autonomous. Our AI agents just closed 3 deals while you read this tweet. Want to see how?',
      status: 'scheduled',
      scheduledFor: '2026-01-14T16:30:00Z',
    },
    {
      id: 'post-3',
      platform: 'linkedin',
      content: 'Case Study: How TechCorp increased their conversion rate by 340% using AI-powered lead scoring. Full breakdown inside.',
      status: 'published',
      publishedAt: '2026-01-13T10:00:00Z',
      engagement: { likes: 127, comments: 23, shares: 45, views: 3420 },
    },
    {
      id: 'post-4',
      platform: 'instagram',
      content: 'Behind the scenes of our AI Video Studio. Watch how our Director Agent creates storyboards in real-time.',
      status: 'draft',
    },
  ]);

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'linkedin': return '💼';
      case 'twitter': return '🐦';
      case 'facebook': return '👤';
      case 'instagram': return '📷';
      default: return '🌐';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': case 'published': return 'var(--color-success)';
      case 'scheduled': return 'var(--color-primary)';
      case 'paused': case 'draft': return 'var(--color-warning)';
      case 'completed': return 'var(--color-text-disabled)';
      case 'failed': return 'var(--color-error)';
      default: return 'var(--color-text-disabled)';
    }
  };

  const primaryColor = 'var(--color-primary)';

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      background: 'linear-gradient(135deg, var(--color-bg-main) 0%, var(--color-bg-paper) 50%, var(--color-bg-main) 100%)',
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: 'var(--color-text-primary)',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <span>📱</span> Social Media Hub
            </h1>
            <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
              Powered by Autonomous Posting Agent
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              style={{
                padding: '0.75rem 1.5rem',
                background: `linear-gradient(135deg, ${primaryColor} 0%, var(--color-primary-dark) 100%)`,
                border: 'none',
                borderRadius: '0.5rem',
                color: 'var(--color-text-primary)',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <span>✨</span> AI Generate Post
            </button>
            <button
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: 'transparent',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.5rem',
                color: 'var(--color-text-secondary)',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              + New Campaign
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          {[
            { label: 'Active Campaigns', value: campaigns.filter(c => c.status === 'active').length.toString(), color: 'var(--color-success)', icon: '📊' },
            { label: 'Posts This Week', value: '18', color: 'var(--color-primary)', icon: '📝' },
            { label: 'Total Engagement', value: '15.7K', color: 'var(--color-warning)', icon: '💬' },
            { label: 'Agent Status', value: 'Active', color: 'var(--color-success)', icon: '🤖' },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                backgroundColor: 'var(--color-bg-elevated)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '1rem',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{stat.icon}</span>
                <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>{stat.label}</span>
              </div>
              <div style={{ color: stat.color, fontSize: '1.5rem', fontWeight: '700' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Tab Navigation */}
        <div style={{
          display: 'flex',
          gap: '0.5rem',
          marginBottom: '2rem',
          borderBottom: '1px solid var(--color-border-strong)',
          paddingBottom: '1rem',
        }}>
          {[
            { id: 'campaigns', label: 'Campaigns', icon: '📊' },
            { id: 'posts', label: 'Post Queue', icon: '📝' },
            { id: 'analytics', label: 'Analytics', icon: '📈' },
            { id: 'settings', label: 'Settings', icon: '⚙️' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: activeTab === tab.id ? `${primaryColor}22` : 'transparent',
                border: `1px solid ${activeTab === tab.id ? primaryColor : 'var(--color-border-strong)'}`,
                borderRadius: '0.5rem',
                color: activeTab === tab.id ? primaryColor : 'var(--color-text-secondary)',
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

        {/* Campaigns Tab */}
        {activeTab === 'campaigns' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {campaigns.map((campaign) => (
              <div
                key={campaign.id}
                style={{
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                      <h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.125rem', fontWeight: '600', margin: 0 }}>
                        {campaign.name}
                      </h3>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        backgroundColor: `${getStatusColor(campaign.status)}22`,
                        border: `1px solid ${getStatusColor(campaign.status)}`,
                        borderRadius: '0.25rem',
                        color: getStatusColor(campaign.status),
                        fontSize: '0.625rem',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                      }}>
                        {campaign.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                      <span>
                        {campaign.platforms.map(p => getPlatformIcon(p)).join(' ')}
                      </span>
                      <span>{campaign.postsCount} posts</span>
                      <span>{campaign.engagement.toLocaleString()} engagements</span>
                      <span>{campaign.startDate} - {campaign.endDate ?? 'Ongoing'}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.375rem',
                        color: 'var(--color-text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      View Posts
                    </button>
                    <button
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.375rem',
                        color: 'var(--color-text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Analytics
                    </button>
                    <button
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.375rem',
                        color: 'var(--color-text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {posts.map((post) => (
              <div
                key={post.id}
                style={{
                  backgroundColor: 'var(--color-bg-elevated)',
                  border: '1px solid var(--color-border-strong)',
                  borderRadius: '1rem',
                  padding: '1.5rem',
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '1rem',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>{getPlatformIcon(post.platform)}</span>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      backgroundColor: `${getStatusColor(post.status)}22`,
                      border: `1px solid ${getStatusColor(post.status)}`,
                      borderRadius: '0.25rem',
                      color: getStatusColor(post.status),
                      fontSize: '0.625rem',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                    }}>
                      {post.status}
                    </span>
                    {post.scheduledFor && (
                      <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                        Scheduled: {new Date(post.scheduledFor).toLocaleString()}
                      </span>
                    )}
                    {post.publishedAt && (
                      <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                        Published: {new Date(post.publishedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: 'var(--color-bg-paper)',
                        border: '1px solid var(--color-border-strong)',
                        borderRadius: '0.375rem',
                        color: 'var(--color-text-secondary)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                      }}
                    >
                      Edit
                    </button>
                    {post.status === 'draft' && (
                      <button
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: `${primaryColor}22`,
                          border: `1px solid ${primaryColor}`,
                          borderRadius: '0.375rem',
                          color: primaryColor,
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Schedule
                      </button>
                    )}
                  </div>
                </div>

                <p style={{
                  color: 'var(--color-text-primary)',
                  fontSize: '0.875rem',
                  lineHeight: '1.6',
                  margin: 0,
                }}>
                  {post.content}
                </p>

                {post.engagement && (
                  <div style={{
                    display: 'flex',
                    gap: '1.5rem',
                    marginTop: '1rem',
                    padding: '0.75rem',
                    backgroundColor: 'var(--color-bg-main)',
                    borderRadius: '0.5rem',
                  }}>
                    <div>
                      <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.625rem' }}>Likes</span>
                      <div style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '600' }}>
                        {post.engagement.likes}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.625rem' }}>Comments</span>
                      <div style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '600' }}>
                        {post.engagement.comments}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.625rem' }}>Shares</span>
                      <div style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '600' }}>
                        {post.engagement.shares}
                      </div>
                    </div>
                    <div>
                      <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.625rem' }}>Views</span>
                      <div style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '600' }}>
                        {post.engagement.views.toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div style={{
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: '1rem',
            padding: '2rem',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📈</div>
            <h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Social Analytics Dashboard
            </h3>
            <p style={{ color: 'var(--color-text-disabled)', marginBottom: '1.5rem' }}>
              Detailed engagement metrics and AI-powered insights coming soon
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '1rem',
              maxWidth: '800px',
              margin: '0 auto',
            }}>
              {[
                { label: 'Total Reach', value: '45.2K' },
                { label: 'Engagement Rate', value: '4.8%' },
                { label: 'Best Performing', value: 'LinkedIn' },
                { label: 'Posts This Month', value: '67' },
              ].map((stat, i) => (
                <div
                  key={i}
                  style={{
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-main)',
                    borderRadius: '0.5rem',
                  }}
                >
                  <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                    {stat.label}
                  </div>
                  <div style={{ color: 'var(--color-text-primary)', fontSize: '1.25rem', fontWeight: '600' }}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <div style={{
            backgroundColor: 'var(--color-bg-elevated)',
            border: '1px solid var(--color-border-strong)',
            borderRadius: '1rem',
            padding: '1.5rem',
          }}>
            <h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.125rem', fontWeight: '600', marginBottom: '1.5rem' }}>
              Connected Accounts
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[
                { platform: 'LinkedIn', icon: '💼', connected: true, account: '@yourcompany' },
                { platform: 'Twitter / X', icon: '🐦', connected: true, account: '@yourcompany' },
                { platform: 'Facebook', icon: '👤', connected: false },
                { platform: 'Instagram', icon: '📷', connected: false },
              ].map((account, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '1rem',
                    backgroundColor: 'var(--color-bg-main)',
                    borderRadius: '0.5rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '1.5rem' }}>{account.icon}</span>
                    <div>
                      <div style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '500' }}>
                        {account.platform}
                      </div>
                      {account.connected && (
                        <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                          {account.account}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    style={{
                      padding: '0.5rem 1rem',
                      backgroundColor: account.connected ? 'rgba(var(--color-error-rgb), 0.1)' : `${primaryColor}22`,
                      border: `1px solid ${account.connected ? 'var(--color-error)' : primaryColor}`,
                      borderRadius: '0.375rem',
                      color: account.connected ? 'var(--color-error)' : primaryColor,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {account.connected ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>

            <h3 style={{ color: 'var(--color-text-primary)', fontSize: '1.125rem', fontWeight: '600', margin: '2rem 0 1rem' }}>
              Autonomous Posting Settings
            </h3>
            <div style={{
              padding: '1rem',
              backgroundColor: 'var(--color-bg-main)',
              borderRadius: '0.5rem',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}>
                <div>
                  <div style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '500' }}>
                    Enable Autonomous Posting
                  </div>
                  <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                    Let AI schedule and post content automatically
                  </div>
                </div>
                <button
                  style={{
                    width: '48px',
                    height: '26px',
                    backgroundColor: 'var(--color-success)',
                    borderRadius: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: '25px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'var(--color-text-primary)',
                    borderRadius: '50%',
                  }} />
                </button>
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ color: 'var(--color-text-primary)', fontSize: '0.875rem', fontWeight: '500' }}>
                    Require Approval Before Posting
                  </div>
                  <div style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>
                    Review AI-generated posts before they go live
                  </div>
                </div>
                <button
                  style={{
                    width: '48px',
                    height: '26px',
                    backgroundColor: 'var(--color-success)',
                    borderRadius: '13px',
                    border: 'none',
                    cursor: 'pointer',
                    position: 'relative',
                  }}
                >
                  <span style={{
                    position: 'absolute',
                    top: '3px',
                    left: '25px',
                    width: '20px',
                    height: '20px',
                    backgroundColor: 'var(--color-text-primary)',
                    borderRadius: '50%',
                  }} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
