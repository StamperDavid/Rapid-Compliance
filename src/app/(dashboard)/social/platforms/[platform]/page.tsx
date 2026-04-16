'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { MediaUploader } from '@/components/social/MediaUploader';
import type { SocialPlatform } from '@/types/social';

interface ContentTypeConfig {
  id: string;
  label: string;
  description: string;
  fields: Array<{
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'select';
    placeholder?: string;
    maxLength?: number;
    options?: Array<{ value: string; label: string }>;
    required?: boolean;
  }>;
}

const PLATFORM_CONTENT_TYPES: Record<string, ContentTypeConfig[]> = {
  twitter: [
    {
      id: 'post', label: 'Post', description: 'A single tweet (up to 280 characters)',
      fields: [
        { key: 'content', label: 'Post', type: 'textarea', placeholder: 'What\'s happening?', maxLength: 280, required: true },
      ],
    },
    {
      id: 'thread', label: 'Thread', description: 'A series of connected posts',
      fields: [
        { key: 'content', label: 'Thread (separate tweets with ---)', type: 'textarea', placeholder: 'First tweet\n---\nSecond tweet\n---\nThird tweet', required: true },
      ],
    },
  ],
  linkedin: [
    {
      id: 'post', label: 'Post', description: 'A LinkedIn post (up to 3,000 characters)',
      fields: [
        { key: 'content', label: 'Post', type: 'textarea', placeholder: 'Share an update...', maxLength: 3000, required: true },
      ],
    },
    {
      id: 'article', label: 'Article', description: 'A long-form LinkedIn article',
      fields: [
        { key: 'title', label: 'Article Title', type: 'text', placeholder: 'Article headline', required: true },
        { key: 'content', label: 'Article Body', type: 'textarea', placeholder: 'Write your article...', required: true },
      ],
    },
  ],
  facebook: [
    {
      id: 'post', label: 'Post', description: 'A Facebook page post',
      fields: [
        { key: 'content', label: 'Post', type: 'textarea', placeholder: 'Write something...', required: true },
      ],
    },
    {
      id: 'story', label: 'Story', description: 'A Facebook story (text overlay on image)',
      fields: [
        { key: 'content', label: 'Story Text', type: 'textarea', placeholder: 'Story text overlay...', maxLength: 250, required: true },
      ],
    },
  ],
  instagram: [
    {
      id: 'post', label: 'Feed Post', description: 'A single image/video post with caption',
      fields: [
        { key: 'content', label: 'Caption', type: 'textarea', placeholder: 'Write a caption...', maxLength: 2200, required: true },
        { key: 'hashtags', label: 'Hashtags', type: 'text', placeholder: '#marketing #ai #salesautomation' },
      ],
    },
    {
      id: 'carousel', label: 'Carousel', description: 'Multiple slides with individual captions',
      fields: [
        { key: 'content', label: 'Carousel Caption', type: 'textarea', placeholder: 'Main caption for the carousel...', maxLength: 2200, required: true },
        { key: 'slideCount', label: 'Number of Slides', type: 'number', placeholder: '5' },
        { key: 'slideDescriptions', label: 'Slide Descriptions (one per line)', type: 'textarea', placeholder: 'Slide 1: Hook\nSlide 2: Problem\nSlide 3: Solution\nSlide 4: Proof\nSlide 5: CTA' },
      ],
    },
    {
      id: 'reel', label: 'Reel', description: 'Short-form video with script',
      fields: [
        { key: 'content', label: 'Reel Script', type: 'textarea', placeholder: 'Write your reel script...', required: true },
        { key: 'hashtags', label: 'Hashtags', type: 'text', placeholder: '#reels #trending' },
        { key: 'audioSuggestion', label: 'Suggested Audio', type: 'text', placeholder: 'Trending sound or original audio' },
      ],
    },
  ],
  youtube: [
    {
      id: 'video', label: 'Video', description: 'YouTube video with title, description, tags',
      fields: [
        { key: 'title', label: 'Video Title', type: 'text', placeholder: 'Video title (max 100 chars)', maxLength: 100, required: true },
        { key: 'content', label: 'Description', type: 'textarea', placeholder: 'Video description...', maxLength: 5000, required: true },
        { key: 'tags', label: 'Tags (comma-separated)', type: 'text', placeholder: 'ai, sales, automation' },
        { key: 'chapterMarkers', label: 'Chapter Markers', type: 'textarea', placeholder: '0:00 Intro\n1:30 Problem\n3:00 Solution\n5:00 Demo' },
      ],
    },
    {
      id: 'short', label: 'Short', description: 'YouTube Short (under 60 seconds)',
      fields: [
        { key: 'title', label: 'Title', type: 'text', placeholder: 'Short title', maxLength: 100, required: true },
        { key: 'content', label: 'Script', type: 'textarea', placeholder: 'Short script (keep it punchy)...', required: true },
      ],
    },
  ],
  tiktok: [
    {
      id: 'video', label: 'Video', description: 'TikTok video with caption',
      fields: [
        { key: 'content', label: 'Caption', type: 'textarea', placeholder: 'Video caption...', maxLength: 2200, required: true },
        { key: 'hashtags', label: 'Hashtags', type: 'text', placeholder: '#fyp #business #ai' },
        { key: 'soundSuggestion', label: 'Suggested Sound', type: 'text', placeholder: 'Trending sound or original' },
      ],
    },
  ],
  bluesky: [
    {
      id: 'post', label: 'Post', description: 'A Bluesky post (up to 300 characters)',
      fields: [
        { key: 'content', label: 'Post', type: 'textarea', placeholder: 'What\'s on your mind?', maxLength: 300, required: true },
      ],
    },
  ],
  threads: [
    {
      id: 'post', label: 'Post', description: 'A Threads post (up to 500 characters)',
      fields: [
        { key: 'content', label: 'Post', type: 'textarea', placeholder: 'Start a thread...', maxLength: 500, required: true },
      ],
    },
  ],
  truth_social: [
    {
      id: 'post', label: 'Truth', description: 'A Truth Social post',
      fields: [
        { key: 'content', label: 'Truth', type: 'textarea', placeholder: 'Post a truth...', maxLength: 500, required: true },
      ],
    },
  ],
  telegram: [
    {
      id: 'message', label: 'Channel Message', description: 'Send a message to your Telegram channel',
      fields: [
        { key: 'content', label: 'Message', type: 'textarea', placeholder: 'Write a message...', required: true },
      ],
    },
  ],
  reddit: [
    {
      id: 'post', label: 'Text Post', description: 'A Reddit text post',
      fields: [
        { key: 'title', label: 'Post Title', type: 'text', placeholder: 'Post title', maxLength: 300, required: true },
        { key: 'content', label: 'Body', type: 'textarea', placeholder: 'Post body (markdown supported)...' },
        { key: 'subreddit', label: 'Subreddit', type: 'text', placeholder: 'r/smallbusiness', required: true },
      ],
    },
    {
      id: 'link', label: 'Link Post', description: 'Share a link to a subreddit',
      fields: [
        { key: 'title', label: 'Post Title', type: 'text', placeholder: 'Post title', maxLength: 300, required: true },
        { key: 'url', label: 'URL', type: 'text', placeholder: 'https://...', required: true },
        { key: 'subreddit', label: 'Subreddit', type: 'text', placeholder: 'r/smallbusiness', required: true },
      ],
    },
  ],
  pinterest: [
    {
      id: 'pin', label: 'Pin', description: 'Create a pin with image and link',
      fields: [
        { key: 'title', label: 'Pin Title', type: 'text', placeholder: 'Pin title', maxLength: 100, required: true },
        { key: 'content', label: 'Pin Description', type: 'textarea', placeholder: 'Describe your pin...', maxLength: 500, required: true },
        { key: 'destinationUrl', label: 'Destination URL', type: 'text', placeholder: 'https://your-site.com/page' },
        { key: 'boardName', label: 'Board', type: 'text', placeholder: 'Board name' },
      ],
    },
  ],
  whatsapp_business: [
    {
      id: 'message', label: 'Broadcast', description: 'Send a WhatsApp Business broadcast message',
      fields: [
        { key: 'content', label: 'Message', type: 'textarea', placeholder: 'Write your broadcast message...', maxLength: 4096, required: true },
      ],
    },
  ],
  google_business: [
    {
      id: 'post', label: 'Business Update', description: 'Post an update to your Google Business Profile',
      fields: [
        { key: 'content', label: 'Update', type: 'textarea', placeholder: 'Share a business update...', maxLength: 1500, required: true },
        { key: 'callToAction', label: 'Call to Action', type: 'select', options: [
          { value: 'LEARN_MORE', label: 'Learn More' },
          { value: 'BOOK', label: 'Book' },
          { value: 'ORDER', label: 'Order Online' },
          { value: 'SHOP', label: 'Shop' },
          { value: 'SIGN_UP', label: 'Sign Up' },
          { value: 'CALL', label: 'Call' },
        ] },
        { key: 'ctaUrl', label: 'CTA Link', type: 'text', placeholder: 'https://your-site.com' },
      ],
    },
    {
      id: 'offer', label: 'Offer', description: 'Post a special offer',
      fields: [
        { key: 'title', label: 'Offer Title', type: 'text', placeholder: '20% Off This Week', required: true },
        { key: 'content', label: 'Offer Details', type: 'textarea', placeholder: 'Describe the offer...', required: true },
        { key: 'couponCode', label: 'Coupon Code', type: 'text', placeholder: 'SAVE20' },
      ],
    },
  ],
};

interface PostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

export default function PlatformPage() {
  const params = useParams();
  const router = useRouter();
  const authFetch = useAuthFetch();
  const toast = useToast();
  const platform = params.platform as string;

  const meta = PLATFORM_META[platform as SocialPlatform];
  const contentTypes = PLATFORM_CONTENT_TYPES[platform] ?? [
    {
      id: 'post', label: 'Post', description: 'Create a post',
      fields: [{ key: 'content', label: 'Content', type: 'textarea' as const, placeholder: 'Write something...', required: true }],
    },
  ];

  const [selectedContentType, setSelectedContentType] = useState(contentTypes[0]?.id ?? 'post');
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [posting, setPosting] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [recentPosts, setRecentPosts] = useState<Array<{ id: string; content: string; publishedAt: string; status: string }>>([]);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);

  const activeContentType = contentTypes.find((ct) => ct.id === selectedContentType) ?? contentTypes[0];

  const checkConnection = useCallback(async () => {
    try {
      const res = await authFetch(`/api/social/accounts?platform=${platform}`);
      if (res.ok) {
        const data = (await res.json()) as { accounts?: Array<{ status: string }> };
        setConnected(data.accounts?.some((a) => a.status === 'active') ?? false);
      }
    } catch {
      setConnected(false);
    }
  }, [authFetch, platform]);

  const fetchRecentPosts = useCallback(async () => {
    try {
      const res = await authFetch(`/api/social/posts?platform=${platform}&limit=5`);
      if (res.ok) {
        const data = (await res.json()) as { posts?: Array<{ id: string; content: string; publishedAt: string; status: string }> };
        setRecentPosts(data.posts ?? []);
      }
    } catch {
      // Non-critical
    }
  }, [authFetch, platform]);

  useEffect(() => {
    void checkConnection();
    void fetchRecentPosts();
  }, [checkConnection, fetchRecentPosts]);

  const handlePost = async () => {
    const missingRequired = activeContentType.fields
      .filter((f) => f.required && !formData[f.key]?.trim())
      .map((f) => f.label);
    if (missingRequired.length > 0) {
      toast.error(`Please fill in: ${missingRequired.join(', ')}`);
      return;
    }

    setPosting(true);
    try {
      const res = await authFetch('/api/social/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          contentType: selectedContentType,
          content: formData.content ?? '',
          metadata: {
            ...formData,
            ...(mediaUrl ? { mediaUrl } : {}),
          },
        }),
      });
      const result = (await res.json()) as PostResult;
      if (result.success) {
        toast.success(`Posted to ${meta?.label ?? platform}!`);
        setFormData({});
        setMediaUrl(null);
        void fetchRecentPosts();
      } else {
        toast.error(result.error ?? 'Post failed');
      }
    } catch {
      toast.error('Failed to post. Check your connection.');
    } finally {
      setPosting(false);
    }
  };

  if (!meta) {
    return (
      <div className="p-8">
        <PageTitle>Platform not found</PageTitle>
        <SectionDescription>
          &ldquo;{platform}&rdquo; is not a supported platform.{' '}
          <button onClick={() => router.push('/social/command-center')} className="text-primary underline">
            Back to Social Command Center
          </button>
        </SectionDescription>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl font-bold"
          style={{ backgroundColor: meta.color }}
        >
          {meta.icon}
        </div>
        <div>
          <PageTitle>{meta.label}</PageTitle>
          <SectionDescription>
            {connected === true && <span className="text-success font-medium">Connected</span>}
            {connected === false && (
              <span>
                <span className="text-destructive font-medium">Not connected</span>
                {' — '}
                <button onClick={() => router.push('/settings/integrations')} className="text-primary underline">
                  Connect in Settings
                </button>
              </span>
            )}
            {connected === null && <span className="text-muted-foreground">Checking connection...</span>}
          </SectionDescription>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Composer */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Create {meta.label} Content</CardTitle>
              <CardDescription>
                Choose a content type and compose your post. Your {meta.label} specialist agent can also generate this for you via Jasper.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {contentTypes.length > 1 && (
                <div className="flex gap-2 flex-wrap">
                  {contentTypes.map((ct) => (
                    <Button
                      key={ct.id}
                      variant={selectedContentType === ct.id ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedContentType(ct.id);
                        setFormData({});
                        setMediaUrl(null);
                      }}
                    >
                      {ct.label}
                    </Button>
                  ))}
                </div>
              )}

              <div className="text-xs text-muted-foreground">{activeContentType.description}</div>

              {activeContentType.fields.map((field) => (
                <div key={field.key}>
                  <label className="text-sm font-medium text-foreground" htmlFor={`${platform}-${field.key}`}>
                    {field.label} {field.required && <span className="text-destructive">*</span>}
                  </label>
                  {field.type === 'textarea' ? (
                    <Textarea
                      id={`${platform}-${field.key}`}
                      placeholder={field.placeholder}
                      value={formData[field.key] ?? ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      rows={field.key === 'content' ? 6 : 3}
                      maxLength={field.maxLength}
                      disabled={posting || connected === false}
                      className="mt-1"
                    />
                  ) : field.type === 'select' && field.options ? (
                    <select
                      id={`${platform}-${field.key}`}
                      value={formData[field.key] ?? ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      disabled={posting || connected === false}
                      className="mt-1 w-full rounded-md border border-border-strong bg-card px-3 py-2 text-sm text-foreground"
                    >
                      <option value="">Select...</option>
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  ) : (
                    <Input
                      id={`${platform}-${field.key}`}
                      type={field.type === 'number' ? 'number' : 'text'}
                      placeholder={field.placeholder}
                      value={formData[field.key] ?? ''}
                      onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                      maxLength={field.maxLength}
                      disabled={posting || connected === false}
                      className="mt-1"
                    />
                  )}
                  {field.maxLength && formData[field.key] && (
                    <div className="text-xs text-muted-foreground mt-1 text-right">
                      {formData[field.key].length} / {field.maxLength}
                    </div>
                  )}
                </div>
              ))}

              {/* Media upload */}
              <div>
                <label className="text-sm font-medium text-foreground">Attach Media</label>
                <div className="mt-1">
                  <MediaUploader
                    onUpload={(url) => setMediaUrl(url)}
                    onRemove={() => setMediaUrl(null)}
                    disabled={posting || connected === false}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={() => void handlePost()}
                  disabled={posting || connected === false}
                  style={{ backgroundColor: meta.color, color: '#fff' }}
                >
                  {posting ? 'Posting...' : `Post to ${meta.label}`}
                </Button>
                <Button
                  variant="outline"
                  disabled={posting}
                  onClick={() => router.push('/social/calendar')}
                >
                  Schedule for Later
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Recent Posts</CardTitle>
            </CardHeader>
            <CardContent>
              {recentPosts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No recent posts on {meta.label}</div>
              ) : (
                <div className="space-y-3">
                  {recentPosts.map((post) => (
                    <div key={post.id} className="border-b border-border-light pb-2 last:border-0 last:pb-0">
                      <div className="text-sm text-foreground line-clamp-2">{post.content}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {new Date(post.publishedAt).toLocaleDateString()} · {post.status}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Let AI Write It</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground mb-3">
                Tell Jasper what you want to post and your {meta.label} specialist will draft it for you.
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/dashboard')}
                className="w-full"
              >
                Open Jasper Chat
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
