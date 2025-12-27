# Website Builder User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Creating Your First Page](#creating-your-first-page)
3. [Using Templates](#using-templates)
4. [Visual Page Editor](#visual-page-editor)
5. [Publishing & Preview](#publishing--preview)
6. [Custom Domains](#custom-domains)
7. [Blog & Content Management](#blog--content-management)
8. [SEO Optimization](#seo-optimization)
9. [Navigation Management](#navigation-management)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

The Website Builder allows you to create professional, mobile-responsive websites without any coding knowledge.

### Initial Setup

1. Navigate to **Workspace → Website → Settings**
2. Configure your basic site settings:
   - **Site Name**: Your company or website name
   - **Subdomain**: Choose your free subdomain (e.g., `yourcompany.platform.com`)
   - **SEO Settings**: Add site-wide meta tags for search engines

3. Click **Save Settings** to apply changes

### Key Features

- ✅ Visual drag-and-drop editor
- ✅ 35+ pre-built widgets
- ✅ 8 professional templates
- ✅ Mobile-responsive design
- ✅ SEO optimization tools
- ✅ Custom domain support
- ✅ Blog/CMS system
- ✅ Publishing workflow with preview

---

## Creating Your First Page

### Step 1: Navigate to Pages

Go to **Workspace → Website → Pages** to see all your pages.

### Step 2: Create New Page

1. Click **Create Page**
2. Fill in page details:
   - **Title**: Page name (e.g., "About Us")
   - **Slug**: URL path (e.g., "about" → `/about`)
3. Choose creation method:
   - **Blank Page**: Start from scratch
   - **From Template**: Use a pre-built template
4. Click **Create**

### Step 3: Edit Your Page

Click **Edit** on your new page to open the visual editor.

---

## Using Templates

### Available Templates

1. **Business Landing Page** - Hero, features, testimonials, CTA
2. **SaaS Homepage** - Modern, feature-rich, pricing
3. **E-commerce Storefront** - Product showcase, categories
4. **Portfolio** - Project gallery, about, contact
5. **Agency** - Services, team, case studies
6. **Blog/Magazine** - Post grid, featured content
7. **Coming Soon** - Launch countdown, email capture
8. **Contact/About** - Form, map, team bios

### How to Use Templates

1. Go to **Workspace → Website → Templates**
2. Browse available templates
3. Click **Preview** to see a demo
4. Click **Use Template**
5. Enter page name and slug
6. Click **Create**

### Customizing Templates

All templates are fully customizable:
- Change text, images, and colors
- Add or remove sections
- Rearrange widgets
- Adjust spacing and layout

---

## Visual Page Editor

### Editor Layout

The editor consists of three panels:

1. **Widgets Panel (Left)** - Available widgets to add
2. **Canvas (Center)** - Your page preview
3. **Properties Panel (Right)** - Edit selected widget

### Adding Widgets

**Method 1: Drag & Drop**
1. Find widget in left panel
2. Drag it to the canvas
3. Drop it where you want it

**Method 2: Click to Add**
1. Click widget in left panel
2. Click location on canvas

### Widget Categories

#### Layout Widgets
- Section, Container, Row, Column
- Spacer, Divider

#### Content Widgets
- Heading, Text, Button, Link
- Image, Video, Hero
- Feature Grid, Pricing Table
- Testimonial, CTA, Stats

#### Form Widgets
- Contact Form, Newsletter
- Custom Forms (submit to CRM)

#### Media Widgets
- Gallery, Slider, Icon Box
- Logo Grid

#### Advanced Widgets
- HTML/Code Block, Map
- Countdown, Social Icons
- Blog Post List

### Editing Widget Content

1. Click on any widget in the canvas
2. Properties panel opens on the right
3. Edit content, style, and settings
4. Changes preview in real-time

### Styling Widgets

#### Typography
- Font family, size, weight
- Color, alignment
- Line height, letter spacing

#### Layout
- Padding, margin
- Width, height
- Display mode (block, flex, grid)

#### Colors
- Background color
- Text color
- Border color

#### Effects
- Box shadow
- Border radius
- Opacity
- Hover effects

### Responsive Design

Switch between breakpoints to optimize for different devices:

- **Desktop** (1200px+)
- **Tablet** (768-1199px)
- **Mobile** (<768px)

Each breakpoint can have different styling.

### Keyboard Shortcuts

- `Ctrl + Z` - Undo
- `Ctrl + Shift + Z` - Redo
- `Ctrl + S` - Save
- `Delete` - Remove selected widget
- `Ctrl + D` - Duplicate widget

---

## Publishing & Preview

### Publishing Workflow

Pages have three states:

1. **Draft** - Not visible to public
2. **Scheduled** - Publish at future date/time
3. **Published** - Live on your site

### How to Publish

1. Click **Publish** button in editor
2. Choose publish option:
   - **Publish Now** - Make live immediately
   - **Schedule** - Set future date/time
3. Confirm publication

### Preview Before Publishing

1. Click **Preview** button
2. Get a shareable preview link
3. Preview link expires in 24 hours
4. Share with team for review

### Unpublishing

1. Go to published page
2. Click **Unpublish**
3. Page reverts to draft

### Version History

Every time you publish, a version snapshot is saved:

1. Go to page settings
2. Click **Version History**
3. View all published versions
4. Restore previous version if needed

---

## Custom Domains

### Adding Your Domain

1. Go to **Workspace → Website → Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `www.yourcompany.com`)
4. Click **Add**

### DNS Configuration

After adding your domain, you'll see DNS records to configure:

#### For CNAME (www subdomain):
```
Type: CNAME
Name: www
Value: cname.vercel-dns.com
```

#### For A Record (apex domain):
```
Type: A
Name: @
Value: 76.76.21.21
```

### Verification

1. Add DNS records at your domain provider
2. Wait 5-60 minutes for DNS propagation
3. Click **Verify DNS** in the platform
4. SSL certificate automatically provisions (5-10 minutes)

### SSL Certificate

- Automatically provisioned via Let's Encrypt
- Renews automatically before expiration
- No manual configuration required

---

## Blog & Content Management

### Creating Blog Posts

1. Go to **Workspace → Website → Blog**
2. Click **New Post**
3. Fill in post details:
   - Title
   - Slug (URL)
   - Excerpt (preview text)
   - Featured image
   - Content (use visual editor)

### Categories & Tags

**Categories** (hierarchical):
- Main topics (e.g., "Technology", "Business")
- One primary category per post
- Multiple secondary categories allowed

**Tags** (flat):
- Specific topics (e.g., "AI", "Machine Learning")
- Multiple tags per post

### Publishing Blog Posts

Same workflow as pages:
- Save as draft
- Schedule for future
- Publish immediately

### RSS Feed

Automatically generated at `/feed.xml`

---

## SEO Optimization

### Page-Level SEO

For each page, configure:

- **Meta Title** - Search result title (50-60 chars)
- **Meta Description** - Search result snippet (150-160 chars)
- **Keywords** - Target search terms
- **Open Graph Tags** - Social media sharing
- **Canonical URL** - Preferred URL version
- **No-Index** - Hide from search engines

### Site-Wide SEO

Configure in **Website → Settings**:

- **Site Title** - Your brand name
- **Site Description** - What your site is about
- **Default OG Image** - Social media preview
- **Favicon** - Browser tab icon
- **Analytics** - Google Analytics, Facebook Pixel

### SEO Best Practices

✅ **Use descriptive URLs**: `/about-us` not `/page-1`
✅ **Optimize images**: Add alt text, compress files
✅ **Mobile-friendly**: All templates are responsive
✅ **Fast loading**: Use optimized images, minimize widgets
✅ **Quality content**: Write for humans, not search engines
✅ **Internal linking**: Link related pages together

### Auto-Generated Features

- **sitemap.xml** - Search engine site map
- **robots.txt** - Search engine instructions
- **Schema markup** - Rich search results

---

## Navigation Management

### Header Navigation

1. Go to **Workspace → Website → Navigation**
2. Click **Add Item**
3. Configure menu item:
   - Label (display text)
   - URL (link destination)
   - Icon (optional)
   - Open in new tab (yes/no)

### Reordering Menu Items

Drag and drop items to reorder

### Dropdown Menus

1. Add parent item
2. Click **Add Child Item**
3. Configure submenu item

### Footer Navigation

Configure footer in **Website → Settings → Footer**:

- Multiple footer columns
- Copyright text
- Social media links
- Newsletter signup

---

## Troubleshooting

### Common Issues

#### DNS Not Verifying

**Problem**: Custom domain shows "Pending Verification"

**Solution**:
1. Wait 5-60 minutes for DNS propagation
2. Check DNS records are exactly as shown
3. Use DNS checker tool (whatsmydns.net)
4. Contact your domain provider if issues persist

#### Page Not Updating

**Problem**: Changes not visible on live site

**Solution**:
1. Click **Publish** to make changes live
2. Clear browser cache (Ctrl + Shift + R)
3. Wait 1-2 minutes for CDN to update

#### Images Not Loading

**Problem**: Images show broken icon

**Solution**:
1. Check image URL is valid
2. Use HTTPS URLs, not HTTP
3. Upload to platform instead of external links
4. Check image file size (<5MB recommended)

#### Mobile Menu Not Working

**Problem**: Hamburger menu doesn't open

**Solution**:
1. Check browser console for errors
2. Disable browser extensions
3. Try different browser
4. Clear browser cache

### Getting Help

- **Documentation**: docs.yourplatform.com
- **Video Tutorials**: yourplatform.com/videos
- **Support Email**: support@yourplatform.com
- **Live Chat**: Available in dashboard

---

## Best Practices

### Performance

✅ Optimize images before uploading
✅ Limit widgets per page to 20-30
✅ Use lazy loading for images
✅ Minimize custom code widgets

### Design

✅ Maintain consistent branding
✅ Use white space effectively
✅ Limit fonts to 2-3 families
✅ Ensure good color contrast
✅ Test on multiple devices

### Content

✅ Write clear, concise copy
✅ Use headings hierarchically (H1 → H2 → H3)
✅ Include clear calls-to-action
✅ Keep paragraphs short (3-4 lines)

### Security

✅ Use custom domains with SSL
✅ Keep platform updated
✅ Don't share preview links publicly
✅ Review audit logs regularly

---

## Quick Reference

### Publishing Checklist

- [ ] Content proofread
- [ ] Images optimized
- [ ] SEO fields filled
- [ ] Mobile preview checked
- [ ] Links tested
- [ ] Preview shared with team
- [ ] Published!

### Launch Checklist

- [ ] Homepage complete
- [ ] Navigation configured
- [ ] Contact page with form
- [ ] About page
- [ ] Custom domain added
- [ ] SSL verified
- [ ] Analytics connected
- [ ] Social media links
- [ ] Favicon uploaded
- [ ] 404 page customized

---

**Need more help?** Contact our support team or join our community forum!

