'use client';

import { useState, useEffect } from 'react';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import Link from 'next/link';

interface PageSection {
  id: string;
  type: 'hero' | 'features' | 'pricing' | 'testimonials' | 'cta' | 'content' | 'faq';
  title?: string;
  subtitle?: string;
  content?: string;
  buttonText?: string;
  buttonLink?: string;
  items?: any[];
  backgroundColor?: string;
  textColor?: string;
  visible: boolean;
}

interface WebsitePage {
  id: string;
  name: string;
  slug: string;
  sections: PageSection[];
  published: boolean;
}

const DEFAULT_PAGES: WebsitePage[] = [
  {
    id: 'home',
    name: 'Homepage',
    slug: '/',
    published: true,
    sections: [
      {
        id: 'hero-1',
        type: 'hero',
        title: 'AI-Powered Sales Platform',
        subtitle: 'Transform your sales process with intelligent automation',
        buttonText: 'Get Started Free',
        buttonLink: '/signup',
        backgroundColor: '#000000',
        textColor: '#ffffff',
        visible: true,
      },
      {
        id: 'features-1',
        type: 'features',
        title: 'Powerful Features',
        subtitle: 'Everything you need to close more deals',
        backgroundColor: '#0a0a0a',
        textColor: '#ffffff',
        visible: true,
        items: [
          { icon: '🤖', title: 'AI Chat Agent', description: 'Intelligent conversations that convert' },
          { icon: '📊', title: 'CRM & Pipeline', description: 'Track leads and deals effortlessly' },
          { icon: '⚡', title: 'Automation', description: 'Workflows that run on autopilot' },
          { icon: '📧', title: 'Email Campaigns', description: 'Reach customers at scale' },
        ],
      },
      {
        id: 'cta-1',
        type: 'cta',
        title: 'Ready to 10x your sales?',
        subtitle: 'Join thousands of teams using our platform',
        buttonText: 'Start Free Trial',
        buttonLink: '/signup',
        backgroundColor: '#6366f1',
        textColor: '#ffffff',
        visible: true,
      },
    ],
  },
  {
    id: 'features',
    name: 'Features',
    slug: '/features',
    published: true,
    sections: [
      {
        id: 'hero-2',
        type: 'hero',
        title: 'Features that Drive Results',
        subtitle: 'Comprehensive tools for modern sales teams',
        backgroundColor: '#000000',
        textColor: '#ffffff',
        visible: true,
      },
    ],
  },
  {
    id: 'pricing',
    name: 'Pricing',
    slug: '/pricing',
    published: true,
    sections: [
      {
        id: 'pricing-1',
        type: 'pricing',
        title: 'Simple, Transparent Pricing',
        subtitle: 'Choose the plan that fits your needs',
        backgroundColor: '#0a0a0a',
        textColor: '#ffffff',
        visible: true,
        items: [
          {
            name: 'Starter',
            price: '$29',
            period: '/month',
            features: ['Up to 1,000 contacts', 'Basic CRM', 'Email support', '1 user'],
            highlighted: false,
          },
          {
            name: 'Professional',
            price: '$99',
            period: '/month',
            features: ['Up to 10,000 contacts', 'Full CRM + AI', 'Priority support', 'Up to 5 users', 'Integrations'],
            highlighted: true,
          },
          {
            name: 'Enterprise',
            price: '$299',
            period: '/month',
            features: ['Unlimited contacts', 'Advanced AI', '24/7 support', 'Unlimited users', 'Custom integrations', 'White-label'],
            highlighted: false,
          },
        ],
      },
    ],
  },
  {
    id: 'about',
    name: 'About Us',
    slug: '/about',
    published: true,
    sections: [
      {
        id: 'content-1',
        type: 'content',
        title: 'About Our Company',
        content: 'We are building the future of sales automation...',
        backgroundColor: '#000000',
        textColor: '#ffffff',
        visible: true,
      },
    ],
  },
];

export default function WebsiteEditorPage() {
  const { adminUser } = useAdminAuth();
  const [pages, setPages] = useState<WebsitePage[]>(DEFAULT_PAGES);
  const [selectedPageId, setSelectedPageId] = useState<string>('home');
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const selectedPage = pages.find(p => p.id === selectedPageId);
  const selectedSection = selectedPage?.sections.find(s => s.id === selectedSectionId);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to Firestore
      const { FirestoreService } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        'platform/website',
        'pages',
        { pages, updatedAt: new Date().toISOString() },
        false
      );
    } catch (error) {
      console.error('Failed to save:', error);
    } finally {
      setTimeout(() => setIsSaving(false), 1000);
    }
  };

  const updateSection = (updates: Partial<PageSection>) => {
    if (!selectedPageId || !selectedSectionId) return;
    
    setPages(pages.map(page => 
      page.id === selectedPageId
        ? {
            ...page,
            sections: page.sections.map(section =>
              section.id === selectedSectionId
                ? { ...section, ...updates }
                : section
            ),
          }
        : page
    ));
  };

  const addSection = (type: PageSection['type']) => {
    if (!selectedPageId) return;
    
    const newSection: PageSection = {
      id: `${type}-${Date.now()}`,
      type,
      title: `New ${type} Section`,
      subtitle: 'Edit this section',
      backgroundColor: '#0a0a0a',
      textColor: '#ffffff',
      visible: true,
    };

    setPages(pages.map(page =>
      page.id === selectedPageId
        ? { ...page, sections: [...page.sections, newSection] }
        : page
    ));
  };

  const deleteSection = (sectionId: string) => {
    if (!selectedPageId || !confirm('Delete this section?')) return;
    
    setPages(pages.map(page =>
      page.id === selectedPageId
        ? { ...page, sections: page.sections.filter(s => s.id !== sectionId) }
        : page
    ));
    setSelectedSectionId(null);
  };

  const moveSectionUp = (sectionId: string) => {
    if (!selectedPageId) return;
    
    setPages(pages.map(page => {
      if (page.id !== selectedPageId) return page;
      
      const sections = [...page.sections];
      const index = sections.findIndex(s => s.id === sectionId);
      if (index > 0) {
        [sections[index], sections[index - 1]] = [sections[index - 1], sections[index]];
      }
      return { ...page, sections };
    }));
  };

  const moveSectionDown = (sectionId: string) => {
    if (!selectedPageId) return;
    
    setPages(pages.map(page => {
      if (page.id !== selectedPageId) return page;
      
      const sections = [...page.sections];
      const index = sections.findIndex(s => s.id === sectionId);
      if (index < sections.length - 1) {
        [sections[index], sections[index + 1]] = [sections[index + 1], sections[index]];
      }
      return { ...page, sections };
    }));
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#000000', color: '#fff' }}>
      {/* Header */}
      <div style={{ backgroundColor: '#0a0a0a', borderBottom: '1px solid #1a1a1a', padding: '1rem 2rem', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <Link href="/admin" style={{ color: '#6366f1', fontSize: '0.875rem', fontWeight: '500', textDecoration: 'none', display: 'inline-block', marginBottom: '0.5rem' }}>
              ← Back to Admin Dashboard
            </Link>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', margin: 0 }}>🌐 Website Editor</h1>
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
              Edit your public-facing website pages
            </p>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <button
              onClick={() => setShowPreview(!showPreview)}
              style={{ padding: '0.75rem 1.25rem', backgroundColor: '#1a1a1a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}
            >
              {showPreview ? '👁️ Hide Preview' : '👁️ Show Preview'}
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{ padding: '0.75rem 1.5rem', backgroundColor: '#6366f1', color: 'white', borderRadius: '0.5rem', border: 'none', cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '0.875rem', fontWeight: '600', opacity: isSaving ? 0.5 : 1 }}
            >
              {isSaving ? 'Saving...' : '💾 Publish Changes'}
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', height: 'calc(100vh - 88px)' }}>
        {/* Sidebar - Page List */}
        <div style={{ width: '250px', backgroundColor: '#0a0a0a', borderRight: '1px solid #1a1a1a', overflowY: 'auto' }}>
          <div style={{ padding: '1.5rem 1rem' }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: '600', color: '#666', textTransform: 'uppercase', marginBottom: '1rem' }}>Pages</h3>
            {pages.map(page => (
              <button
                key={page.id}
                onClick={() => setSelectedPageId(page.id)}
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  marginBottom: '0.5rem',
                  backgroundColor: selectedPageId === page.id ? '#1a1a1a' : 'transparent',
                  border: selectedPageId === page.id ? '1px solid #6366f1' : '1px solid transparent',
                  borderRadius: '0.5rem',
                  color: selectedPageId === page.id ? '#6366f1' : '#fff',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>{page.name}</span>
                  <span style={{ fontSize: '0.75rem', color: page.published ? '#10b981' : '#666' }}>
                    {page.published ? '🟢' : '⚪'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.25rem' }}>{page.slug}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content - Sections */}
        <div style={{ flex: showPreview ? '0 0 35%' : '1', borderRight: '1px solid #1a1a1a', overflowY: 'auto', padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Sections</h2>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => {
                  const menu = document.getElementById('add-section-menu');
                  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
                }}
                style={{ padding: '0.5rem 1rem', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '0.375rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer' }}
              >
                + Add Section
              </button>
              <div
                id="add-section-menu"
                style={{ display: 'none', position: 'absolute', right: 0, marginTop: '0.5rem', backgroundColor: '#1a1a1a', border: '1px solid #333', borderRadius: '0.5rem', minWidth: '200px', zIndex: 10 }}
              >
                {['hero', 'features', 'pricing', 'testimonials', 'cta', 'content', 'faq'].map(type => (
                  <button
                    key={type}
                    onClick={() => {
                      addSection(type as PageSection['type']);
                      const menu = document.getElementById('add-section-menu');
                      if (menu) menu.style.display = 'none';
                    }}
                    style={{ width: '100%', padding: '0.75rem 1rem', backgroundColor: 'transparent', border: 'none', color: '#fff', textAlign: 'left', cursor: 'pointer', fontSize: '0.875rem', borderBottom: '1px solid #333' }}
                  >
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Sections List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {selectedPage?.sections.map((section, index) => (
              <div
                key={section.id}
                onClick={() => setSelectedSectionId(section.id)}
                style={{
                  padding: '1rem',
                  backgroundColor: selectedSectionId === section.id ? '#1a1a1a' : '#0a0a0a',
                  border: selectedSectionId === section.id ? '1px solid #6366f1' : '1px solid #1a1a1a',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  opacity: section.visible ? 1 : 0.5,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                  <div>
                    <div style={{ fontSize: '0.75rem', color: '#666', textTransform: 'uppercase', marginBottom: '0.25rem' }}>
                      {section.type}
                    </div>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600' }}>{section.title || 'Untitled Section'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveSectionUp(section.id); }}
                      disabled={index === 0}
                      style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff', cursor: index === 0 ? 'not-allowed' : 'pointer', opacity: index === 0 ? 0.3 : 1 }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); moveSectionDown(section.id); }}
                      disabled={index === (selectedPage?.sections.length || 0) - 1}
                      style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: '1px solid #333', borderRadius: '0.25rem', color: '#fff', cursor: index === (selectedPage?.sections.length || 0) - 1 ? 'not-allowed' : 'pointer', opacity: index === (selectedPage?.sections.length || 0) - 1 ? 0.3 : 1 }}
                    >
                      ↓
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteSection(section.id); }}
                      style={{ padding: '0.25rem 0.5rem', backgroundColor: 'transparent', border: '1px solid #991b1b', borderRadius: '0.25rem', color: '#ef4444', cursor: 'pointer' }}
                    >
                      ×
                    </button>
                  </div>
                </div>
                {section.subtitle && (
                  <div style={{ fontSize: '0.75rem', color: '#666' }}>{section.subtitle}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Section Editor */}
        <div style={{ flex: showPreview ? '0 0 30%' : '1', borderRight: showPreview ? '1px solid #1a1a1a' : 'none', overflowY: 'auto', padding: '1.5rem' }}>
          {selectedSection ? (
            <>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>Edit Section</h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Visibility Toggle */}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', backgroundColor: '#0a0a0a', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={selectedSection.visible}
                    onChange={(e) => updateSection({ visible: e.target.checked })}
                    style={{ width: '1.25rem', height: '1.25rem' }}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>Visible on Page</span>
                </label>

                {/* Title */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                    Title
                  </label>
                  <input
                    type="text"
                    value={selectedSection.title || ''}
                    onChange={(e) => updateSection({ title: e.target.value })}
                    placeholder="Section title"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                {/* Subtitle */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                    Subtitle
                  </label>
                  <input
                    type="text"
                    value={selectedSection.subtitle || ''}
                    onChange={(e) => updateSection({ subtitle: e.target.value })}
                    placeholder="Section subtitle"
                    style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                  />
                </div>

                {/* Content (for content sections) */}
                {selectedSection.type === 'content' && (
                  <div>
                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                      Content
                    </label>
                    <textarea
                      value={selectedSection.content || ''}
                      onChange={(e) => updateSection({ content: e.target.value })}
                      placeholder="Section content..."
                      rows={6}
                      style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </div>
                )}

                {/* Button (for hero/cta sections) */}
                {(selectedSection.type === 'hero' || selectedSection.type === 'cta') && (
                  <>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                        Button Text
                      </label>
                      <input
                        type="text"
                        value={selectedSection.buttonText || ''}
                        onChange={(e) => updateSection({ buttonText: e.target.value })}
                        placeholder="Get Started"
                        style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                        Button Link
                      </label>
                      <input
                        type="text"
                        value={selectedSection.buttonLink || ''}
                        onChange={(e) => updateSection({ buttonLink: e.target.value })}
                        placeholder="/signup"
                        style={{ width: '100%', padding: '0.625rem 0.875rem', backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem' }}
                      />
                    </div>
                  </>
                )}

                {/* Colors */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                    Background Color
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="color"
                      value={selectedSection.backgroundColor || '#0a0a0a'}
                      onChange={(e) => updateSection({ backgroundColor: e.target.value })}
                      style={{ width: '60px', height: '40px', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={selectedSection.backgroundColor || '#0a0a0a'}
                      onChange={(e) => updateSection({ backgroundColor: e.target.value })}
                      style={{ flex: 1, padding: '0.625rem 0.875rem', backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: '#999', marginBottom: '0.5rem' }}>
                    Text Color
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="color"
                      value={selectedSection.textColor || '#ffffff'}
                      onChange={(e) => updateSection({ textColor: e.target.value })}
                      style={{ width: '60px', height: '40px', border: '1px solid #333', borderRadius: '0.375rem', cursor: 'pointer' }}
                    />
                    <input
                      type="text"
                      value={selectedSection.textColor || '#ffffff'}
                      onChange={(e) => updateSection({ textColor: e.target.value })}
                      style={{ flex: 1, padding: '0.625rem 0.875rem', backgroundColor: '#0a0a0a', color: '#fff', border: '1px solid #333', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#666' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👈</div>
              <p>Select a section to edit</p>
            </div>
          )}
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div style={{ flex: '0 0 35%', backgroundColor: '#f9fafb', overflowY: 'auto' }}>
            <div style={{ padding: '1rem', backgroundColor: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: '600', color: '#111' }}>Live Preview</div>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>{selectedPage?.name}</div>
            </div>
            
            {selectedPage?.sections.filter(s => s.visible).map(section => (
              <div
                key={section.id}
                style={{
                  padding: '4rem 2rem',
                  backgroundColor: section.backgroundColor || '#0a0a0a',
                  color: section.textColor || '#ffffff',
                  borderBottom: '2px solid #e5e7eb',
                }}
              >
                {section.type === 'hero' && (
                  <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                    <h1 style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                      {section.title || 'Hero Title'}
                    </h1>
                    <p style={{ fontSize: '1.25rem', opacity: 0.8, marginBottom: '2rem' }}>
                      {section.subtitle || 'Hero subtitle goes here'}
                    </p>
                    {section.buttonText && (
                      <button style={{ padding: '1rem 2rem', backgroundColor: '#6366f1', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>
                        {section.buttonText}
                      </button>
                    )}
                  </div>
                )}

                {section.type === 'features' && (
                  <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                      <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
                        {section.title || 'Features'}
                      </h2>
                      <p style={{ fontSize: '1.125rem', opacity: 0.8 }}>
                        {section.subtitle || 'Subtitle'}
                      </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '2rem' }}>
                      {section.items?.map((item, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>{item.icon}</div>
                          <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem' }}>{item.title}</h3>
                          <p style={{ opacity: 0.7 }}>{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {section.type === 'pricing' && (
                  <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                      <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>
                        {section.title || 'Pricing'}
                      </h2>
                      <p style={{ fontSize: '1.125rem', opacity: 0.8 }}>
                        {section.subtitle || 'Subtitle'}
                      </p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
                      {section.items?.map((plan, i) => (
                        <div
                          key={i}
                          style={{
                            padding: '2rem',
                            backgroundColor: plan.highlighted ? '#6366f1' : 'rgba(255,255,255,0.05)',
                            border: plan.highlighted ? '2px solid #818cf8' : '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '1rem',
                          }}
                        >
                          <h3 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>{plan.name}</h3>
                          <div style={{ fontSize: '3rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>{plan.price}</div>
                          <div style={{ opacity: 0.7, marginBottom: '2rem' }}>{plan.period}</div>
                          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                            {plan.features?.map((feature: string, j: number) => (
                              <li key={j} style={{ padding: '0.5rem 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                                ✓ {feature}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {section.type === 'cta' && (
                  <div style={{ textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                      {section.title || 'Call to Action'}
                    </h2>
                    <p style={{ fontSize: '1.125rem', opacity: 0.8, marginBottom: '2rem' }}>
                      {section.subtitle || 'Subtitle'}
                    </p>
                    {section.buttonText && (
                      <button style={{ padding: '1rem 2rem', backgroundColor: '#fff', color: '#000', border: 'none', borderRadius: '0.5rem', fontSize: '1rem', fontWeight: '600', cursor: 'pointer' }}>
                        {section.buttonText}
                      </button>
                    )}
                  </div>
                )}

                {section.type === 'content' && (
                  <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <h2 style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
                      {section.title || 'Content Section'}
                    </h2>
                    <p style={{ fontSize: '1.125rem', lineHeight: '1.8', opacity: 0.9 }}>
                      {section.content || 'Content goes here...'}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}






