# Template Manager - Quick Start Guide

## Access the Template Manager

1. **Login as Admin**: Ensure your user has role `admin`, `super_admin`, or `owner`
2. **Navigate**: Go to `/admin/templates`
3. **View Templates**: See all 49 industry templates organized by category

## Edit a Template

### Step 1: Select Template
- Use search bar to find templates
- Click category tabs to filter
- Click any template card to edit

### Step 2: Edit Content

**Tab 1 - Scraper & CRM:**
- Update basic info (name, category, description)
- Configure scraping strategy (frequency, timeout, caching)
- Add/edit custom CRM fields for this industry

**Tab 2 - Intelligence & Signals:**
- **Signals**: Keywords that indicate high-value leads
  - Add keywords, set priority (CRITICAL/HIGH/MEDIUM/LOW)
  - Configure score boost and platform
- **Fluff Patterns**: Regex to filter out noise
  - Define patterns for common boilerplate
- **Scoring Rules**: Conditional logic for lead qualification
  - Write JavaScript conditions
  - Set score boosts for combinations

**Tab 3 - AI Agents:**
- **Core Identity**: Agent role, positioning, tone
- **Cognitive Logic**: Reasoning framework and process
- **Knowledge RAG**: Static and dynamic knowledge (one per line)
- **Learning Loops**: Pattern recognition and adaptation
- **Tactical Execution**: Primary goal and secondary actions

### Step 3: Save
- Click "Save Changes" (button enables when changes made)
- Validation runs automatically
- If errors, review and fix them
- Template saves to Firestore

## Revert to Default

If you want to undo all customizations:

1. Open the template in editor
2. Click "Revert to Default" button
3. Confirm the action
4. System deletes Firestore override
5. Template automatically uses code default

**Note**: This button only appears if a Firestore override exists.

## Add New Industry

1. Click "Add New Industry" button
2. Editor opens with standard base template
3. Update all required fields:
   - Change ID to `your-industry-id` (lowercase with hyphens)
   - Update name, category, description
   - Customize persona and signals
4. Save

**Required Fields** (validation will fail without these):
- Template ID, Name, Description, Category
- At least 1 high-value signal
- At least 1 fluff pattern  
- At least 1 scoring rule
- Complete Core Identity section
- Complete Cognitive Logic section
- At least 1 static and 1 dynamic knowledge item

## How It Works

### Firestore Override System
```
┌─────────────────────────────────────┐
│  getIndustryTemplate('dental')      │
└──────────────┬──────────────────────┘
               │
               ▼
    ┌──────────────────────┐
    │ Check Firestore      │
    │ global_templates/    │
    │ dental-practices     │
    └──────┬───────────────┘
           │
     ┌─────┴─────┐
     │ Exists?   │
     └─────┬─────┘
           │
    ┏━━━━━┷━━━━━┓
    ┃ YES       ┃ NO
    ┃           ┃
    ▼           ▼
┌───────┐  ┌──────────────┐
│Return │  │Load from code│
│Firestore│  │src/lib/persona│
│override│  │/templates/   │
└───────┘  └──────────────┘
```

### Data Persistence
- **Saves**: Create/update document in Firestore `globalTemplates` collection
- **Deletes**: Remove Firestore document (code remains unchanged)
- **Reads**: Firestore first, then fallback to code

### Impact
- Changes take effect **immediately** (no deploy needed)
- All systems using templates automatically get updates
- Code remains as fallback if Firestore unavailable

## Validation Rules

Templates are validated before saving:

### Template ID
- ✅ Lowercase letters, numbers, hyphens only
- ❌ No spaces, underscores, or special characters
- Example: `dental-practices` ✅ | `Dental_Practices` ❌

### Required Arrays
- High-value signals: minimum 1
- Fluff patterns: minimum 1
- Scoring rules: minimum 1
- Static knowledge: minimum 1
- Dynamic knowledge: minimum 1
- Secondary actions: minimum 1

### Numeric Ranges
- Timeout: 1,000 - 60,000 ms
- Cache TTL: 0 - 3,600 seconds
- Score Boost: -100 to +100
- Priority: 1 to 100

### String Fields
- All text fields must be non-empty
- Multi-line arrays separated by newlines

## Best Practices

### Signals
- Use 15-25 signals per template (more coverage)
- Include CRITICAL signals for expansion (hiring, new locations)
- Include HIGH signals for revenue indicators
- Include MEDIUM/LOW for general interest

### Fluff Patterns
- Start with common patterns (copyright, privacy, cookies)
- Add industry-specific boilerplate
- Use `context` to target specific areas (footer, header, etc.)

### Scoring Rules
- Order by priority (1 = highest)
- Combine multiple signals for bonus points
- Use clear, testable JavaScript conditions
- Example: `signals.some(s => s.signalId === "hiring") && signals.some(s => s.signalId === "expansion")`

### Knowledge Base
- **Static**: Industry standards, terminology, best practices
- **Dynamic**: Company-specific, pricing, availability, current offers
- Keep items concise (one concept per line)

### AI Persona
- Make tone match industry expectations
- Define clear decision process (3-4 steps)
- List 4-6 secondary actions
- Include industry-specific terminology in knowledge base

## Troubleshooting

### "Validation failed"
- Read error messages carefully
- Check all required fields are filled
- Verify arrays have at least 1 item
- Confirm numeric values are in range

### "Access Denied"
- Verify your user role is admin/super_admin/owner
- Contact system administrator to update role

### Template not updating in app
- Changes are immediate, try hard refresh (Ctrl+Shift+R)
- Check browser console for errors
- Verify Firestore write succeeded (check logs)

### Can't find template
- Use search bar (searches name, description, ID)
- Check correct category tab
- Template might be in "Other" category

## Support

For issues or questions:
1. Check validation error messages
2. Review this guide
3. Check implementation doc: `GLOBAL_TEMPLATE_MANAGER_IMPLEMENTATION.md`
4. Contact platform administrator

---

**Last Updated**: December 30, 2025  
**Version**: 1.0  
**Status**: Production Ready ✅
