# FEATURE NAME: Website Blog Editor

## FILE PATH
`src/app/(dashboard)/website/blog/editor/page.tsx`

## AUDIT STATUS: PASS

All data is fetched from Firestore. No hard-coded mocks detected. Theme compliant with CSS variables.

---

## MANUAL SOP

### Purpose
The Blog Editor is a visual WYSIWYG editor for creating and managing blog content on your SalesVelocity.ai website. It supports rich text formatting, image embedding, SEO optimization, and scheduled publishing.

### Steps to Execute Manually

1. **Access Blog Editor**
   - Navigate to `/(dashboard)` (Main Dashboard)
   - Click "Website" in the sidebar
   - Select "Blog" → "New Post"
   - Alternatively, navigate to `/(dashboard)/website/blog/editor`

2. **Start New Post**
   - Editor opens with blank post
   - Cursor focuses on title field

3. **Enter Post Title**
   - Type title in large heading field
   - Title auto-generates URL slug
   - Edit slug manually if needed

4. **Write Content**
   - Rich text editor supports:
     - Headings (H1-H6)
     - Bold, italic, underline
     - Bullet and numbered lists
     - Block quotes
     - Code blocks
     - Links
     - Images and media
     - Tables

5. **Add Featured Image**
   - Click "Featured Image" in right panel
   - Paste image URL or external image link
   - Add alt text for SEO

6. **Configure SEO**
   - Scroll to SEO section in right panel
   - Edit meta title (60 char max)
   - Edit meta description (160 char max)
   - Preview search result appearance

7. **Add Excerpt**
   - Write 2-3 sentence summary
   - Used in blog listing and social shares

8. **Select Category**
   - Choose from existing categories
   - Or create new category inline

9. **Add Tags**
   - Enter comma-separated tags
   - Helps with content discovery

10. **Preview Post**
    - Click "Preview" button
    - Opens post in new tab
    - See exactly how readers see it

11. **Set Publication Status**
    - **Draft**: Save without publishing
    - **Published**: Live immediately
    - **Scheduled**: Set future date/time

12. **Publish Post**
    - Click "Publish" button
    - Select visibility (Public, Members Only)
    - Confirm publication

13. **Edit Published Post**
    - Navigate to Blog list
    - Click post to edit
    - Make changes
    - Click "Update" to save

---

## VIDEO PRODUCTION SCRIPT

### Duration: 90 seconds

---

**[Visual]:** Empty blog page. Click "New Post". Editor loads with clean interface.

**[Audio]:** "Great content drives traffic. Great tools make content easy. Welcome to the SalesVelocity.ai Blog Editor."

---

**[Visual]:** Type title "5 Ways AI Transforms Sales in 2026". URL slug auto-generates.

**[Audio]:** "Start with a compelling title. Watch as your URL slug generates automatically, optimized for sharing."

---

**[Visual]:** Rich text editor shows content being written. Formatting toolbar visible.

**[Audio]:** "Write like you would in any modern editor. Headers, lists, bold, links - everything you need is one click away."

---

**[Visual]:** Click image button. URL input modal appears. Paste image URL. Image inserts into content.

**[Audio]:** "Add images by URL. Simply paste the link and your image appears, ready for the web."

---

**[Visual]:** SEO panel on right shows meta title, description, and search preview.

**[Audio]:** "Built-in SEO tools help you rank. Edit your meta title and description, see exactly how you'll appear in Google."

---

**[Visual]:** Click "Schedule" button. Calendar picker appears. Select future date.

**[Audio]:** "Publish immediately or schedule for later. Plan your content calendar weeks in advance."

---

**[Visual]:** Click "Publish". Success animation. Blog post appears live on website.

**[Audio]:** "Hit publish and you're live. Your content is out in the world, working to attract leads while you focus on selling."

---

**[Visual]:** Blog listing shows post with view count incrementing.

**[Audio]:** "Track performance with built-in analytics. See views, read time, and engagement for every post."

---

**[Visual]:** Logo with pencil/document icon.

**[Audio]:** "SalesVelocity.ai Blog Editor. Your stories. Your voice. Amplified."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Status |
|------------|----------------|--------|
| Blog Posts | `organizations/rapid-compliance-root/website/config/blog-posts/{postId}` | LIVE |
| Categories | `organizations/rapid-compliance-root/blogCategories` | LIVE |
| Tags | Stored as array in post document | LIVE |
| Post Analytics | `organizations/rapid-compliance-root/blogAnalytics/{postId}` | LIVE |

---

## Planned Features (Not Yet Implemented)

- **Media Library**: Upload and manage images directly in the platform with file browser and organization
- **Image Upload**: Direct file upload from computer instead of URL-only input
- **Image Editing**: Built-in crop, resize, and basic editing tools

---

*Last Updated: February 12, 2026*
