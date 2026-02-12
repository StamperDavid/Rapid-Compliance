# FEATURE NAME: Contacts Directory

## FILE PATH
`src/app/(dashboard)/contacts/page.tsx`

## AUDIT STATUS: PASS

All data is fetched from Firestore. No hard-coded mocks detected. Theme compliant with CSS variables.

---

## MANUAL SOP

### Purpose
The Contacts Directory is the central repository for all contact records in your CRM. It provides a searchable, filterable view of contacts with quick access to detailed profiles, communication history, and relationship mapping.

### Steps to Execute Manually

1. **Access Contacts**
   - Navigate to `/(dashboard)` (Main Dashboard)
   - Click "Contacts" in the CRM section
   - Alternatively, navigate to `/(dashboard)/contacts`

2. **Browse Contact Cards**
   - Contacts display in a card-based grid
   - Each card shows:
     - Contact name
     - Job title
     - Company
     - Email (clickable)
     - Phone (clickable)
     - VIP badge (if applicable)

3. **Search Contacts**
   - Use search bar at top
   - Search by:
     - Name
     - Email
     - Company
     - Phone

4. **Filter Contacts**
   - Basic filtering available by search
   - VIP status badge visible on cards

5. **View Contact Details**
   - Click any contact card
   - Full profile loads:
     - Complete contact information
     - Company details
     - Associated deals
     - Notes and tags
     - Files/documents

6. **Create New Contact**
   - Click "New Contact" button
   - Fill required fields:
     - First Name (required)
     - Last Name (required)
     - Email (required)
     - Phone (optional)
     - Company (optional)
     - Title (optional)
   - Click "Create"

7. **Edit Contact**
   - Open contact profile
   - Click "Edit"
   - Update any fields
   - Save changes

8. **Mark as VIP**
   - In contact profile
   - Toggle "VIP" switch
   - VIP contacts highlighted in list
   - VIP status factors into lead scoring

9. **Add Tags**
   - In contact profile
   - Click "Add Tag"
   - Select existing or create new
   - Tags stored in contact document

10. **Export Contacts**
    - Click "Export" button
    - Select fields to export
    - Choose format (CSV)
    - Download file

---

## VIDEO PRODUCTION SCRIPT

### Duration: 90 seconds

---

**[Visual]:** Rolodex spinning, transforms into modern contact cards on screen.

**[Audio]:** "Your contacts are your most valuable asset. SalesVelocity.ai keeps them organized, accessible, and always up to date."

---

**[Visual]:** Contact directory loads. Cards populate with names, titles, companies.

**[Audio]:** "See everyone at a glance. Names, titles, companies, contact info - everything you need to know, displayed cleanly."

---

**[Visual]:** Type "healthcare" in search. Results filter in real-time.

**[Audio]:** "Find anyone in seconds. Search by name, company, email, or phone. Instant results as you type."

---

**[Visual]:** Click VIP filter. Grid shows only VIP contacts with gold badges.

**[Audio]:** "Mark your most important contacts as VIPs. Filter to focus on key relationships when it matters most."

---

**[Visual]:** Click a contact card. Full profile slides in with rich detail.

**[Audio]:** "Every contact has a complete profile. Job history, company details, communication timeline, linked deals. Your AI workforce logs every interaction automatically."

---

**[Visual]:** Timeline section scrolls showing emails, calls, meetings with timestamps.

**[Audio]:** "See every touchpoint in chronological order. Emails sent, calls made, meetings held. Know exactly where the relationship stands before every conversation."

---

**[Visual]:** Click "Link Deal". Select deal from list. Connection animation.

**[Audio]:** "Connect contacts to deals with one click. Know who's involved in every opportunity and what role they play."

---

**[Visual]:** Pull back to show full contact grid. Export button clicks.

**[Audio]:** "Export any time for reports, mail merges, or backups. Your data, your way."

---

**[Visual]:** Logo with connected people icons.

**[Audio]:** "SalesVelocity.ai Contacts. Relationships, organized."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Status |
|------------|----------------|--------|
| Contact Records | `organizations/rapid-compliance-root/workspaces/{wsId}/entities/contacts/records` | LIVE |
| Contact Schema | `organizations/rapid-compliance-root/workspaces/{wsId}/schemas/contacts` | LIVE |
| Activity Timeline | `organizations/rapid-compliance-root/workspaces/{wsId}/entities/contacts/records/{contactId}/activities` | LIVE |
| Deal Links | Referenced in deal documents | LIVE |
| Tags | Stored as array in contact document | LIVE |

---

## Planned Features (Not Yet Implemented)

- **Advanced Filters** - Filtering by company, tags, VIP status, and last contact date in the UI
- **Activity Timeline UI** - Logging activities (calls, emails, meetings, notes) directly from the contact profile
- **Deal Linking UI** - Linking contacts to deals with role assignment from the contact profile
- **Tag Management UI** - Visual tag selection and management interface

---

*Last Audited: February 12, 2026*
