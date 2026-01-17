'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { auth } from '@/lib/firebase/config';

interface PlatformPost {
  id: string;
  platform: 'twitter' | 'linkedin';
  content: string;
  scheduledAt?: string;
  postedAt?: string;
  status: 'draft' | 'scheduled' | 'posted' | 'failed';
  engagement?: {
    likes: number;
    retweets?: number;
    comments: number;
    impressions: number;
  };
}

interface SocialAnalytics {
  twitter: {
    followers: number;
    followersGrowth: number;
    impressions: number;
    engagement: number;
  };
  linkedin: {
    followers: number;
    followersGrowth: number;
    impressions: number;
    engagement: number;
  };
}

export default function AdminSocialPage() {
  useAdminAuth();
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [tweetContent, setTweetContent] = useState('');
  const [linkedInContent, setLinkedInContent] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [recentPosts, setRecentPosts] = useState<PlatformPost[]>([]);
  const [analytics, setAnalytics] = useState<SocialAnalytics | null>(null);
  const [activeTab, setActiveTab] = useState<'compose' | 'scheduled' | 'analytics'>('compose');
  const [postResult, setPostResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    // Load mock data for demonstration
    setTimeout(() => {
      setRecentPosts([
        {
          id: '1',
          platform: 'twitter',
          content: 'Excited to announce our new AI-powered sales automation features! #SalesVelocity #AIAutomation',
          postedAt: new Date(Date.now() - 86400000).toISOString(),
          status: 'posted',
          engagement: { likes: 127, retweets: 34, comments: 18, impressions: 15420 },
        },
        {
          id: '2',
          platform: 'linkedin',
          content: 'How AI is transforming sales teams in 2025. Our latest blog post explores the future of sales automation.',
          postedAt: new Date(Date.now() - 172800000).toISOString(),
          status: 'posted',
          engagement: { likes: 89, comments: 23, impressions: 8750 },
        },
        {
          id: '3',
          platform: 'twitter',
          content: 'Join our webinar next Tuesday: "Scale Your Sales with AI Agents" - Link in bio!',
          scheduledAt: new Date(Date.now() + 86400000).toISOString(),
          status: 'scheduled',
        },
      ]);

      setAnalytics({
        twitter: {
          followers: 12847,
          followersGrowth: 342,
          impressions: 245000,
          engagement: 4.2,
        },
        linkedin: {
          followers: 8523,
          followersGrowth: 189,
          impressions: 156000,
          engagement: 5.8,
        },
      });

      setLoading(false);
    }, 500);
  }, []);

  const handlePostTweet = async () => {
    if (!tweetContent.trim()) {
      return;
    }

    setPosting(true);
    setPostResult(null);

    try {
      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch('/api/admin/social/post', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'twitter',
          content: tweetContent,
          scheduledAt: scheduleTime || undefined,
        }),
      });

      const data = await response.json() as { error?: string };

      if (response.ok) {
        setPostResult({ success: true, message: scheduleTime ? 'Tweet scheduled successfully!' : 'Tweet posted successfully!' });
        setTweetContent('');
        setScheduleTime('');
      } else {
        setPostResult({ success: false, message: data.error ?? 'Failed to post tweet' });
      }
    } catch {
      setPostResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setPosting(false);
    }
  };

  const handlePostLinkedIn = async () => {
    if (!linkedInContent.trim()) {
      return;
    }

    setPosting(true);
    setPostResult(null);

    try {
      const token = await auth?.currentUser?.getIdToken();
      const response = await fetch('/api/admin/social/post', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: 'linkedin',
          content: linkedInContent,
          scheduledAt: scheduleTime || undefined,
        }),
      });

      const data = await response.json() as { error?: string };

      if (response.ok) {
        setPostResult({ success: true, message: scheduleTime ? 'Post scheduled successfully!' : 'Posted to LinkedIn successfully!' });
        setLinkedInContent('');
        setScheduleTime('');
      } else {
        setPostResult({ success: false, message: data.error ?? 'Failed to post to LinkedIn' });
      }
    } catch {
      setPostResult({ success: false, message: 'Network error. Please try again.' });
    } finally {
      setPosting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#fff' }}>
        Loading platform social management...
      </div>
    );
  }

  const bgPaper = '#1a1a1a';
  const borderColor = '#333';
  const indigoColor = '#6366f1';

  return (
    <div style={{ padding: '2rem', color: '#fff' }}>
      {/* Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Platform Social Media
        </h1>
        <p style={{ color: '#666', fontSize: '0.875rem' }}>
          Manage SalesVelocity.ai official social media presence
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: `1px solid ${borderColor}`, paddingBottom: '1rem', flexWrap: 'wrap' }}>
        {(['compose', 'scheduled', 'analytics'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.625rem 1.25rem',
              backgroundColor: activeTab === tab ? indigoColor : 'transparent',
              border: `1px solid ${activeTab === tab ? indigoColor : borderColor}`,
              borderRadius: '0.5rem',
              color: '#fff',
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontWeight: activeTab === tab ? '600' : '400',
              minWidth: '100px',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Post Result Message */}
      {postResult && (
        <div style={{
          padding: '1rem',
          marginBottom: '1.5rem',
          borderRadius: '0.5rem',
          backgroundColor: postResult.success ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
          border: `1px solid ${postResult.success ? '#10b981' : '#ef4444'}`,
          color: postResult.success ? '#10b981' : '#ef4444',
        }}>
          {postResult.message}
        </div>
      )}

      {/* Compose Tab */}
      {activeTab === 'compose' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }} className="md:grid-cols-2">
          {/* Twitter Compose */}
          <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem' }}>X</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Post to Twitter/X</h2>
            </div>
            <textarea
              value={tweetContent}
              onChange={(e) => setTweetContent(e.target.value)}
              placeholder="What's happening at SalesVelocity.ai?"
              maxLength={280}
              style={{
                width: '100%',
                height: '120px',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                resize: 'none',
                fontSize: '0.9375rem',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: tweetContent.length > 260 ? '#f59e0b' : '#666' }}>
                {tweetContent.length}/280
              </span>
              <button
                onClick={() => { void handlePostTweet(); }}
                disabled={!tweetContent.trim() || posting}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: indigoColor,
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  cursor: tweetContent.trim() && !posting ? 'pointer' : 'not-allowed',
                  opacity: tweetContent.trim() && !posting ? 1 : 0.5,
                }}
              >
                {posting ? 'Posting...' : scheduleTime ? 'Schedule Tweet' : 'Post Tweet'}
              </button>
            </div>
          </div>

          {/* LinkedIn Compose */}
          <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <span style={{ fontSize: '1.5rem', color: '#0a66c2' }}>in</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Post to LinkedIn</h2>
            </div>
            <textarea
              value={linkedInContent}
              onChange={(e) => setLinkedInContent(e.target.value)}
              placeholder="Share an update from SalesVelocity.ai..."
              maxLength={3000}
              style={{
                width: '100%',
                height: '120px',
                padding: '0.75rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                resize: 'none',
                fontSize: '0.9375rem',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
              <span style={{ fontSize: '0.75rem', color: linkedInContent.length > 2900 ? '#f59e0b' : '#666' }}>
                {linkedInContent.length}/3000
              </span>
              <button
                onClick={() => { void handlePostLinkedIn(); }}
                disabled={!linkedInContent.trim() || posting}
                style={{
                  padding: '0.625rem 1.25rem',
                  backgroundColor: '#0a66c2',
                  border: 'none',
                  borderRadius: '0.5rem',
                  color: '#fff',
                  cursor: linkedInContent.trim() && !posting ? 'pointer' : 'not-allowed',
                  opacity: linkedInContent.trim() && !posting ? 1 : 0.5,
                }}
              >
                {posting ? 'Posting...' : scheduleTime ? 'Schedule Post' : 'Post to LinkedIn'}
              </button>
            </div>
          </div>

          {/* Schedule Option */}
          <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }} className="md:col-span-2">
            <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem' }}>Schedule Post (Optional)</h3>
            <input
              type="datetime-local"
              value={scheduleTime}
              onChange={(e) => setScheduleTime(e.target.value)}
              style={{
                padding: '0.625rem 1rem',
                backgroundColor: '#0a0a0a',
                border: `1px solid ${borderColor}`,
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem',
              }}
            />
            {scheduleTime && (
              <button
                onClick={() => setScheduleTime('')}
                style={{
                  marginLeft: '1rem',
                  padding: '0.625rem 1rem',
                  backgroundColor: 'transparent',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem',
                  color: '#666',
                  cursor: 'pointer',
                }}
              >
                Clear Schedule
              </button>
            )}
          </div>
        </div>
      )}

      {/* Scheduled Tab */}
      {activeTab === 'scheduled' && (
        <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1rem' }}>Scheduled & Recent Posts</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentPosts.map((post) => (
              <div
                key={post.id}
                style={{
                  padding: '1rem',
                  backgroundColor: '#0a0a0a',
                  border: `1px solid ${borderColor}`,
                  borderRadius: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ color: post.platform === 'twitter' ? '#fff' : '#0a66c2' }}>
                      {post.platform === 'twitter' ? 'X' : 'in'}
                    </span>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '0.25rem',
                      backgroundColor: post.status === 'posted' ? 'rgba(16, 185, 129, 0.1)' : post.status === 'scheduled' ? 'rgba(99, 102, 241, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: post.status === 'posted' ? '#10b981' : post.status === 'scheduled' ? '#6366f1' : '#ef4444',
                    }}>
                      {post.status}
                    </span>
                  </div>
                  <span style={{ fontSize: '0.75rem', color: '#666' }}>
                    {post.postedAt
                      ? `Posted ${new Date(post.postedAt).toLocaleDateString()}`
                      : post.scheduledAt
                      ? `Scheduled for ${new Date(post.scheduledAt).toLocaleDateString()}`
                      : ''}
                  </span>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#ccc', margin: 0 }}>{post.content}</p>
                {post.engagement && (
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: '#666' }}>
                    <span>{post.engagement.likes.toLocaleString()} likes</span>
                    {post.engagement.retweets !== undefined && <span>{post.engagement.retweets.toLocaleString()} retweets</span>}
                    <span>{post.engagement.comments.toLocaleString()} comments</span>
                    <span>{post.engagement.impressions.toLocaleString()} impressions</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }} className="md:grid-cols-2">
          {/* Twitter Analytics */}
          <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '1.5rem' }}>X</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Twitter/X Analytics</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }} className="sm:grid-cols-2">
              <AnalyticCard label="Followers" value={analytics.twitter.followers.toLocaleString()} change={`+${analytics.twitter.followersGrowth}`} />
              <AnalyticCard label="Impressions (30d)" value={analytics.twitter.impressions.toLocaleString()} />
              <AnalyticCard label="Engagement Rate" value={`${analytics.twitter.engagement}%`} />
            </div>
          </div>

          {/* LinkedIn Analytics */}
          <div style={{ backgroundColor: bgPaper, border: `1px solid ${borderColor}`, borderRadius: '0.75rem', padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <span style={{ fontSize: '1.5rem', color: '#0a66c2' }}>in</span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>LinkedIn Analytics</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }} className="sm:grid-cols-2">
              <AnalyticCard label="Followers" value={analytics.linkedin.followers.toLocaleString()} change={`+${analytics.linkedin.followersGrowth}`} />
              <AnalyticCard label="Impressions (30d)" value={analytics.linkedin.impressions.toLocaleString()} />
              <AnalyticCard label="Engagement Rate" value={`${analytics.linkedin.engagement}%`} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticCard({ label, value, change }: { label: string; value: string; change?: string }) {
  return (
    <div style={{ padding: '1rem', backgroundColor: '#0a0a0a', borderRadius: '0.5rem' }}>
      <div style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#fff' }}>{value}</div>
      {change && <div style={{ fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>{change} this month</div>}
    </div>
  );
}
