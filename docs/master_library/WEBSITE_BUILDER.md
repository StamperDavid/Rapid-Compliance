# FEATURE NAME: Visual Website Builder (Page Editor)

## FILE PATH
`src/app/(dashboard)/website/editor/page.tsx`

## AUDIT STATUS: NEW

**Created:** February 12, 2026

---

## OVERVIEW

The Visual Website Builder is a three-panel drag-and-drop page editor that allows users to create, edit, and publish website pages without code. It uses a Page > PageSection > Widget hierarchy and supports 35 widget types across 5 categories.

### Architecture

| Component | Path | Purpose |
|-----------|------|---------|
| Page Editor | `src/app/(dashboard)/website/editor/page.tsx` | Main 3-panel visual editor |
| Blog Editor | `src/app/(dashboard)/website/blog/editor/page.tsx` | Blog post editor (shares editor components) |
| Editor Canvas | `src/components/website-builder/EditorCanvas.tsx` | Center panel: content editing canvas |
| Widgets Panel | `src/components/website-builder/WidgetsPanel.tsx` | Left panel: widget library with search/categories |
| Properties Panel | `src/components/website-builder/PropertiesPanel.tsx` | Right panel: element properties editor |
| Editor Toolbar | `src/components/website-builder/EditorToolbar.tsx` | Top toolbar: save, publish, undo/redo, breakpoints |
| Widget Renderer | `src/components/website-builder/WidgetRenderer.tsx` | Renders individual widgets |
| Version History | `src/components/website-builder/VersionHistory.tsx` | Version restore panel |
| Schedule Publish | `src/components/website-builder/SchedulePublishModal.tsx` | Scheduled publishing modal |
| Onboarding | `src/components/website-builder/Onboarding.tsx` | First-use editor onboarding |
| Responsive Renderer | `src/components/website-builder/ResponsiveRenderer.tsx` | Desktop/tablet/mobile preview |
| Accessible Widget | `src/components/website-builder/AccessibleWidget.tsx` | Accessibility wrapper for widgets |
| Optimized Image | `src/components/website-builder/OptimizedImage.tsx` | Lazy-loaded image component |
| Mobile Navigation | `src/components/website-builder/MobileNavigation.tsx` | Mobile nav for published sites |
| Widget Definitions | `src/lib/website-builder/widget-definitions.ts` | All 35 widget default configs |
| Editor History Hook | `src/hooks/useEditorHistory.ts` | Undo/redo state management (50 states max) |

---

## RELATED PAGES

| Route | File | Purpose |
|-------|------|---------|
| `/website/pages` | `src/app/(dashboard)/website/pages/page.tsx` | Pages listing |
| `/website/editor` | `src/app/(dashboard)/website/editor/page.tsx` | Visual page editor |
| `/website/templates` | `src/app/(dashboard)/website/templates/page.tsx` | Template library |
| `/website/domains` | `src/app/(dashboard)/website/domains/page.tsx` | Custom domain management |
| `/website/seo` | `src/app/(dashboard)/website/seo/page.tsx` | Site-wide SEO settings |
| `/website/navigation` | `src/app/(dashboard)/website/navigation/page.tsx` | Header/footer nav editor |
| `/website/settings` | `src/app/(dashboard)/website/settings/page.tsx` | Site configuration |
| `/website/audit-log` | `src/app/(dashboard)/website/audit-log/page.tsx` | Change audit log |
| `/website/blog` | `src/app/(dashboard)/website/blog/page.tsx` | Blog posts listing |
| `/website/blog/editor` | `src/app/(dashboard)/website/blog/editor/page.tsx` | Blog post editor |
| `/website/blog/categories` | `src/app/(dashboard)/website/blog/categories/page.tsx` | Blog category management |

---

## WIDGET TYPES (35 Total)

### Layout (5 widgets)
| Widget | Type Key | Description |
|--------|----------|-------------|
| Container | `container` | Content wrapper with padding |
| Row | `row` | Horizontal flex layout |
| Column | `column` | Vertical flex layout |
| Spacer | `spacer` | Vertical spacing element |
| Divider | `divider` | Horizontal line separator |

### Content (13 widgets)
| Widget | Type Key | Description |
|--------|----------|-------------|
| Heading | `heading` | H1-H6 headings |
| Text | `text` | Paragraph text |
| Button | `button` | Call-to-action button |
| Link | `link` | Text hyperlink |
| Image | `image` | Single image with alt text |
| Video | `video` | YouTube/Vimeo embed |
| Hero Section | `hero` | Large hero banner with CTA |
| Feature Grid | `features` | 3-column feature showcase |
| Pricing Table | `pricing` | Pricing plan comparison |
| Testimonial | `testimonial` | Customer review/quote |
| CTA Block | `cta` | Call-to-action section |
| Stats | `stats` | Key statistics display |
| Counter | `counter` | Animated number counter |

### Interactive (5 widgets)
| Widget | Type Key | Description |
|--------|----------|-------------|
| Modal | `modal` | Popup dialog |
| Tabs | `tabs` | Tabbed content panels |
| Accordion | `accordion` | Collapsible content sections |
| Progress Bar | `progress` | Skill/progress indicator |
| FAQ | `faq` | Frequently asked questions |

### Forms (3 widgets)
| Widget | Type Key | Description |
|--------|----------|-------------|
| Contact Form | `contact-form` | Name/email/message form (saves to CRM) |
| Newsletter | `newsletter` | Email signup form |
| Custom Form | `custom-form` | User-defined form fields |

### Media (4 widgets)
| Widget | Type Key | Description |
|--------|----------|-------------|
| Gallery | `gallery` | Image grid with configurable columns |
| Slider | `slider` | Image carousel with autoplay |
| Icon Box | `icon-box` | Icon with title and description |
| Logo Grid | `logo-grid` | Client/partner logo display |

### Advanced (5 widgets)
| Widget | Type Key | Description |
|--------|----------|-------------|
| HTML Block | `html` | Custom HTML injection |
| Code Block | `code` | Syntax-highlighted code |
| Map | `map` | Google Maps embed |
| Countdown | `countdown` | Event countdown timer |
| Social Icons | `social-icons` | Social media icon links |
| Blog List | `blog-list` | Dynamic blog post listing |
| Blog Post | `blog-post` | Single blog post embed |
| E-commerce | `ecommerce` | Product showcase grid |

---

## API ENDPOINTS

### Pages
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/website/pages` | List all pages (optional `?status=` filter) |
| POST | `/api/website/pages` | Create new page |
| GET | `/api/website/pages/[pageId]` | Get single page |
| PUT | `/api/website/pages/[pageId]` | Update page |
| DELETE | `/api/website/pages/[pageId]` | Delete page |
| POST | `/api/website/pages/[pageId]/publish` | Publish or schedule page |
| DELETE | `/api/website/pages/[pageId]/publish` | Unpublish page |
| POST | `/api/website/pages/[pageId]/preview` | Generate preview URL |
| GET | `/api/website/pages/[pageId]/versions` | List page versions |
| POST | `/api/website/pages/[pageId]/versions` | Create version snapshot |

### Blog
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/website/blog/posts` | List blog posts |
| POST | `/api/website/blog/posts` | Create blog post |
| GET | `/api/website/blog/posts/[postId]` | Get single post |
| PUT | `/api/website/blog/posts/[postId]` | Update post |
| DELETE | `/api/website/blog/posts/[postId]` | Delete post |
| POST | `/api/website/blog/posts/[postId]/publish` | Publish post |
| POST | `/api/website/blog/posts/[postId]/preview` | Generate preview |
| GET | `/api/website/blog/categories` | List categories |
| GET | `/api/website/blog/feed.xml` | RSS feed |

### Site Configuration
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET/PUT | `/api/website/settings` | Site configuration |
| GET/POST | `/api/website/templates` | Template library |
| GET/PUT | `/api/website/navigation` | Header/footer navigation |
| GET/POST | `/api/website/domains` | Custom domain management |
| GET/PUT/DELETE | `/api/website/domains/[domainId]` | Single domain CRUD |
| POST | `/api/website/domains/[domainId]/verify` | Verify domain DNS |
| GET | `/api/website/audit-log` | Site change log |
| GET | `/api/website/sitemap.xml` | Generated sitemap |
| GET | `/api/website/robots.txt` | Generated robots.txt |
| POST | `/api/website/preview/validate` | Validate preview token |
| GET | `/api/website/domain/[domain]` | Resolve custom domain |
| GET | `/api/website/subdomain/[subdomain]` | Resolve subdomain |

---

## DATA STRUCTURE

### Type Hierarchy
```
Page
├── id, slug, title, status, version
├── seo: PageSEO (metaTitle, metaDescription, ogImage, etc.)
├── customCSS?: string
└── content: PageSection[]
    ├── id, type ('section'), name?
    ├── backgroundColor?, backgroundImage?, padding?, margin?
    ├── fullWidth?, maxWidth?, mobileLayout?
    └── columns: PageColumn[]
        ├── id, width (percentage)
        └── widgets: Widget[]
            ├── id, type (WidgetType), hidden?
            ├── data: WidgetData (varies by type)
            ├── style?: WidgetStyle (padding, margin, colors, fonts, borders, etc.)
            ├── responsive?: { mobile?: Partial<WidgetStyle>, tablet?: Partial<WidgetStyle> }
            └── animation?: AnimationConfig (fade/slide/zoom/bounce)
```

### BlogPost (extends Page pattern)
```
BlogPost
├── id, slug, title, excerpt, status
├── content: PageSection[] (same as Page)
├── seo: PageSEO
├── author, authorName, authorAvatar
├── categories: string[], tags: string[]
├── featured: boolean, featuredImage?: string (URL input only)
├── views: number, readTime?: number
└── createdAt, updatedAt, createdBy, lastEditedBy
```

### Firestore Paths
```
organizations/{orgId}/website/pages/items/{pageId}         — Page documents
organizations/{orgId}/website/pages/items/{pageId}/versions — Version history
organizations/{orgId}/website/config/blog-posts/{postId}   — Blog posts
organizations/{orgId}/website/config/templates/{templateId} — Page templates
organizations/{orgId}/website/config/navigation             — Navigation config
organizations/{orgId}/website/config/settings               — Site settings
organizations/{orgId}/website/config/domains/{domainId}     — Custom domains
```

---

## EDITOR FEATURES

### Three-Panel Layout
- **Left Panel (280px):** Widget library with 5 categories (Layout, Content, Forms, Media, Advanced), search filter, drag-to-add
- **Center Panel (flex):** WYSIWYG canvas with section/widget selection, add section button, responsive preview
- **Right Panel (~300px):** Properties editor for selected section or widget (styling, content, SEO)

### Toolbar Capabilities
- Responsive breakpoint toggle: Desktop / Tablet / Mobile
- Undo / Redo (50-state history, Ctrl+Z / Ctrl+Shift+Z)
- Manual Save (Ctrl+S) with auto-save every 30 seconds
- Publish / Unpublish / Schedule Publish
- Preview (generates shareable link valid 24 hours)
- Save as Template
- Version History (view and restore previous versions)
- Auto-save toggle

### Keyboard Shortcuts
| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + Z | Undo |
| Ctrl/Cmd + Shift + Z | Redo |
| Ctrl/Cmd + Y | Redo (alternative) |
| Ctrl/Cmd + S | Save |

### Auto-Load Homepage
When navigating to `/website/editor` without a `?pageId=` parameter, the editor automatically loads the homepage (first page with slug `/`, `home`, or `index`). If no homepage exists, it falls back to the blank page creation flow.

---

## MANUAL SOP

### Purpose
The Visual Website Builder allows team members to create and manage website pages using a drag-and-drop interface without developer involvement.

### Steps to Execute Manually

1. **Access the Website Builder**
   - Navigate to `/website/pages` from the sidebar
   - View all existing pages with their status (draft/published/scheduled)

2. **Create a New Page**
   - Click "New Page" to open the editor with a blank canvas
   - Or click "Edit" on an existing page to load it in the editor

3. **Build Page Content**
   - Browse widget categories in the left panel (Layout, Content, Forms, Media, Advanced)
   - Click a widget to add it to the first section, or drag it to a specific position
   - Click any widget on the canvas to select it and edit properties in the right panel

4. **Configure Sections**
   - Click "+ Add Section" on the canvas to add a new section
   - Select a section to configure background color/image, padding, column layout
   - Sections contain columns, and columns contain widgets

5. **Edit Widget Properties**
   - Select a widget on the canvas
   - Use the right panel to modify content (text, images, URLs)
   - Adjust styling (colors, fonts, spacing, borders, shadows)
   - Configure responsive overrides for tablet/mobile

6. **Preview and Publish**
   - Use the toolbar breakpoint toggle to preview Desktop / Tablet / Mobile
   - Click "Preview" to generate a shareable preview link
   - Click "Publish" for immediate publishing, or "Schedule" for future publishing
   - Use "Unpublish" to revert a published page to draft

7. **Manage Versions**
   - Click "Versions" in the toolbar to view version history
   - Click "Restore" on any previous version to revert (changes remain in draft until saved)

8. **Save as Template**
   - Click "Save as Template" in the toolbar
   - Enter a template name and optional description
   - Templates appear in `/website/templates` for reuse

---

## VIDEO PRODUCTION SCRIPT

### Duration: 120 seconds

---

**[Visual]:** Open SalesVelocity.ai dashboard. Click "Website" in the sidebar, then "Pages."

**[Audio]:** "The SalesVelocity Website Builder lets you create professional pages without writing a single line of code."

---

**[Visual]:** Click "New Page." Editor opens with three-panel layout.

**[Audio]:** "The editor has three panels: widgets on the left, your canvas in the center, and properties on the right."

---

**[Visual]:** Click through widget categories: Layout, Content, Forms, Media, Advanced. Click "Hero Section" to add it.

**[Audio]:** "Choose from 35 pre-built widgets across five categories. Click any widget to add it to your page."

---

**[Visual]:** Click the hero section on canvas. Right panel shows properties. Change heading text, background image, button text.

**[Audio]:** "Select any element to customize it. Change text, images, colors, spacing - everything updates live."

---

**[Visual]:** Add a Feature Grid widget, then a CTA Block. Click "+ Add Section" to create a new section.

**[Audio]:** "Build your page section by section. Add features, testimonials, pricing tables, contact forms - whatever you need."

---

**[Visual]:** Click tablet icon in toolbar, then mobile icon. Page reflows.

**[Audio]:** "Preview how your page looks on desktop, tablet, and mobile. Everything is responsive by default."

---

**[Visual]:** Click "Publish" button. Success notification appears.

**[Audio]:** "When you're ready, hit Publish and your page goes live instantly. You can also schedule it for later or generate a preview link to share with your team."

---

**[Visual]:** Click "Versions" in toolbar. Show version history panel. Click "Restore" on an older version.

**[Audio]:** "Every save creates a version. You can restore any previous version with one click - nothing is ever lost."

---

**[Visual]:** Zoom out to show the finished page. Fade to SalesVelocity.ai logo.

**[Audio]:** "That's the SalesVelocity Website Builder - professional pages, zero code, total control."

---

## DATA DEPENDENCIES

### Firestore Collections
- `organizations/{orgId}/website/pages/items` - Page documents
- `organizations/{orgId}/website/config/blog-posts` - Blog post documents
- `organizations/{orgId}/website/config/templates` - Page templates
- `organizations/{orgId}/website/config/navigation` - Navigation structure
- `organizations/{orgId}/website/config/settings` - Site-wide settings
- `organizations/{orgId}/website/config/domains` - Custom domain records

### External Dependencies
- Firebase Admin SDK (Firestore read/write)
- Authentication via `requireAuth` middleware
- Platform constants from `src/lib/constants/platform.ts`

### Related Types
- `src/types/website.ts` - All website builder type definitions (Page, PageSection, Widget, BlogPost, SiteConfig, Navigation, PageTemplate, CustomDomain, etc.)

---

**Last Updated:** February 12, 2026 (Initial creation)
