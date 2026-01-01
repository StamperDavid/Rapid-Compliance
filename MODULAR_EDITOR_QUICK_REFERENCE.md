# Modular Template Editor - Quick Reference

## 🎨 What Changed

### Before: Tabbed Interface
```
┌─────────────────────────────────────┐
│ [Scraper & CRM] [Intelligence] [AI] │ ← Tabs
├─────────────────────────────────────┤
│                                     │
│     Only one tab visible            │
│     at a time                       │
│                                     │
└─────────────────────────────────────┘
```

### After: Single-Page Modular Document
```
┌─────────┬────────────────────────────┐
│ TOC     │  Basic Info               │
│ ─────   │  ─────────────            │
│ Basic   │  Web Scraper              │
│ Scraper │  ─────────────            │
│ CRM     │  CRM Fields               │
│ Signals │  ─────────────            │
│ Fluff   │  High-Value Signals       │
│ Scoring │  ─────────────            │
│ AI      │  Fluff Patterns           │
│ ...     │  ─────────────            │
│ ↑       │  ... all sections ...     │
│ Sticky  │  ↓ scroll through all ↓   │
└─────────┴────────────────────────────┘
```

## 🚀 Key Features

### 1. Sticky Sidebar (Table of Contents)
- Always visible on left side
- Shows all active sections
- Click to jump to any section
- Error badges on sections with issues
- Required badges for mandatory sections

### 2. Dynamic Sections
**Add Section**:
- Click "Add Section" button (top right)
- Choose from hidden sections
- Section appears in document
- Auto-scrolls to new section

**Remove Section**:
- Click trash icon on section header (optional sections only)
- Section hidden but data preserved
- Can re-add anytime

### 3. Inline Editing
- Edit all fields directly in document
- No need to switch tabs
- See relationships between sections
- Natural scrolling workflow

### 4. Validation Highlighting
- Errors show in sticky header
- Error count badges in TOC
- Red alert at top of each section with errors
- Red border on invalid fields

### 5. Standard Base Template
New industries start with complete document:
- Basic information
- Web scraper config
- High-value signals (1 default)
- Fluff patterns (2 defaults)
- Scoring rules (1 default)
- Complete AI persona

## 📋 Section Reference

| Section | ID | Required | Icon | Description |
|---------|-----|----------|------|-------------|
| **Basic Information** | `basic-info` | ✅ | 📄 | ID, name, category, description |
| **Web Scraper** | `scraper` | ✅ | 🌐 | Scraping strategy and config |
| **CRM Fields** | `crm-fields` | ❌ | 💾 | Custom data fields |
| **High-Value Signals** | `signals` | ✅ | 📈 | Keywords for lead scoring |
| **Fluff Patterns** | `fluff` | ✅ | 🔍 | Noise filtering regex |
| **Scoring Rules** | `scoring` | ✅ | 🧮 | Qualification logic |
| **Core Identity** | `core-identity` | ✅ | 🤖 | AI agent personality |
| **Cognitive Logic** | `cognitive` | ✅ | 🧠 | Reasoning framework |
| **Knowledge Base** | `knowledge` | ✅ | 📚 | RAG knowledge items |
| **Learning Loops** | `learning` | ✅ | 🔄 | Adaptation strategy |
| **Tactical Execution** | `tactical` | ✅ | 🎯 | Conversion tactics |

## 🎯 Common Workflows

### Edit Existing Template
1. Navigate to `/admin/templates`
2. Click template card
3. Scroll through document or use TOC
4. Edit fields inline
5. Click "Save Changes"

### Add New Industry
1. Click "Add New Industry"
2. Document opens with base template
3. Edit ID (lowercase with hyphens)
4. Update name, category, description
5. Customize all sections
6. Save

### Remove Optional Section
1. Find section with trash icon
2. Click trash icon
3. Section hidden (data preserved)
4. Re-add via "Add Section" if needed

### Handle Validation Errors
1. Try to save
2. See error alert at top
3. Check TOC for error badges
4. Click section with errors
5. See specific errors in section
6. Fix invalid fields (red border)
7. Save again

### Revert to Default
1. Click "Revert to Default" (top right)
2. Confirm action
3. Firestore override deleted
4. Returns to template list
5. Template uses code default

## 🔧 Technical Details

### Components Created
```
ModularTemplateEditor.tsx           - Main editor wrapper
modular-sections/
  ├── TableOfContents.tsx          - Sidebar navigation
  ├── AddSectionDialog.tsx         - Add section modal
  ├── BasicInfoSection.tsx         - 11 section components
  ├── ScraperSection.tsx
  ├── CRMFieldsSection.tsx
  ├── HighValueSignalsSection.tsx
  ├── FluffPatternsSection.tsx
  ├── ScoringRulesSection.tsx
  ├── CoreIdentitySection.tsx
  ├── CognitiveLogicSection.tsx
  ├── KnowledgeRAGSection.tsx
  ├── LearningLoopsSection.tsx
  └── TacticalExecutionSection.tsx
```

### State Management
```typescript
// Single document state
const [editedTemplate, setEditedTemplate] = 
  useState<IndustryTemplate>(template);

// Section visibility
const [sections, setSections] = 
  useState<SectionConfig[]>([...]);

// Validation errors
const [validationErrors, setValidationErrors] = 
  useState<Record<string, string>>({});
```

### Navigation
```typescript
// Section refs for scrolling
const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

// Scroll to section
const scrollToSection = (sectionId: string) => {
  const element = sectionRefs.current[sectionId];
  if (element) {
    element.scrollIntoView({ 
      behavior: 'smooth',
      block: 'start'
    });
  }
};
```

## 🎨 UI Classes

### Sticky Elements
```css
/* Sticky header */
.sticky.top-0.z-50

/* Sticky sidebar */
.sticky.top-32.w-64

/* Section scroll offset */
.scroll-mt-24
```

### Error States
```css
/* Error border on inputs */
.border-destructive

/* Error alert */
<Alert variant="destructive">

/* Error badge in TOC */
<Badge variant="destructive">
```

## 🔐 Security

Same as before:
- Admin role required (`admin`, `super_admin`, `owner`)
- Server-side checks on all API routes
- Client-side UI blocking
- All actions logged with user ID

## 📊 Comparison

| Feature | Tabs | Modular |
|---------|------|---------|
| **Visibility** | One at a time | All sections |
| **Navigation** | Click tabs | Scroll or TOC |
| **Context** | Limited | Full overview |
| **Sections** | Fixed | Add/remove |
| **Errors** | Hidden in tabs | Visible in TOC |
| **Workflow** | Tab switching | Natural scrolling |
| **Flexibility** | Static layout | Dynamic layout |
| **Spatial Awareness** | Low | High |

## ✅ Benefits

1. **Better Overview**: See entire template structure
2. **Faster Navigation**: Click TOC instead of tabs
3. **More Intuitive**: Natural scrolling workflow
4. **Better Errors**: See validation issues in context
5. **More Flexible**: Customize which sections to show
6. **Less Cognitive Load**: No tab mental model needed
7. **Better Relationships**: See how sections connect

## 🚀 Status

**✅ Complete and Production Ready**

- All 11 sections implemented
- Full validation support
- Error highlighting
- Dynamic add/remove
- Sticky navigation
- Admin security
- Same API as tabs
- Zero breaking changes

---

**Ready to use!** Navigate to `/admin/templates` and start editing! 🎉
