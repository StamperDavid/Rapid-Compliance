# FEATURE NAME: Forms Manager & Builder

## FILE PATH
`src/app/(dashboard)/forms/page.tsx`

## AUDIT STATUS: PASS

All data is fetched from Firestore. No hard-coded mocks detected. Theme compliant with CSS variables.

---

## MANUAL SOP

### Purpose
The Forms Manager is a comprehensive tool for creating, managing, and analyzing web forms. Forms can be used for lead capture, surveys, registrations, and data collection. Built-in analytics track views, submissions, and conversion rates.

### Steps to Execute Manually

1. **Access Forms Manager**
   - Navigate to `/(dashboard)` (Main Dashboard)
   - Click "Lead Gen" in the sidebar
   - Select "Forms"
   - Alternatively, navigate to `/(dashboard)/forms`

2. **View Existing Forms**
   - Forms display in card or list view
   - Filter by status: All | Draft | Published | Archived
   - Each form card shows:
     - Form name
     - Status badge
     - Submission count
     - View count
     - Conversion rate

3. **Create New Form**
   - Click "New Form" button
   - Choose starting point:
     - **Blank Form**: Start from scratch
     - **Contact Form**: Pre-built contact fields
     - **Lead Capture**: Optimized for leads
     - **Survey**: Rating scales and feedback
     - **Registration**: Event signup
     - **Job Application**: Candidate intake

4. **Build Form Fields**
   - Drag field types from palette:
     - Text Input
     - Email
     - Phone
     - Dropdown
     - Radio Buttons
     - Checkboxes
     - Text Area
     - File Upload
     - Date Picker
     - Hidden Field

5. **Configure Each Field**
   - Click field to configure:
     - Label text
     - Placeholder text
     - Required/Optional
     - Validation rules
     - Help text

6. **Configure Field Display**
   - Set field visibility and ordering
   - Organize fields into sections

7. **Configure Submission Actions**
   - What happens after submit:
     - Create Lead record
     - Send notification email
     - Trigger workflow
     - Redirect to URL
     - Show thank-you message

8. **Style the Form**
   - Choose theme (Light/Dark/Brand)
   - Customize colors
   - Add logo
   - Set button text

9. **Preview Form**
   - Click "Preview"
   - Test on desktop/mobile views
   - Submit test entry
   - Verify logic works

10. **Publish Form**
    - Click "Publish"
    - Get embed code (HTML)
    - Get direct link
    - Share on landing pages

11. **Monitor Performance**
    - View analytics:
      - Total views
      - Total submissions
      - Conversion rate
      - Drop-off by field
    - Export submissions to CSV

---

## VIDEO PRODUCTION SCRIPT

### Duration: 90 seconds

---

**[Visual]:** Landing page with empty space where form should be. Form builder opens.

**[Audio]:** "Every lead starts somewhere. With SalesVelocity.ai Forms, you build high-converting capture forms in minutes."

---

**[Visual]:** Template gallery shows 6 options. Click "Lead Capture". Form skeleton appears.

**[Audio]:** "Start with a template or build from scratch. Lead capture forms come pre-optimized with the fields that actually convert."

---

**[Visual]:** Drag "Text Input" field to form. Configure label as "Company Name". Mark as required.

**[Audio]:** "Drag and drop any field you need. Text inputs, dropdowns, file uploads. Make fields required or optional with one click."

---


**[Visual]:** Click "Submission Actions". Check "Create Lead" and "Send Notification".

**[Audio]:** "Configure what happens after submit. Automatically create a lead record, notify your team, trigger a workflow. Zero manual data entry."

---

**[Visual]:** Preview shows form on mobile and desktop. Submit test entry.

**[Audio]:** "Preview exactly how it looks on any device. Test the experience before publishing. Perfection takes seconds."

---

**[Visual]:** Click "Publish". Embed code copies. Form appears on website.

**[Audio]:** "Publish and embed anywhere. Your website, landing pages, email campaigns. One form, unlimited placements."

---

**[Visual]:** Analytics dashboard showing funnel: Views → Started → Submitted.

**[Audio]:** "Track every metric. Views, submissions, conversion rates. See which fields cause drop-offs and optimize accordingly."

---

**[Visual]:** Logo with form icon capturing a lead.

**[Audio]:** "SalesVelocity.ai Forms. Capture leads. Convert visitors. Grow revenue."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Status |
|------------|----------------|--------|
| Form Definitions | `organizations/rapid-compliance-root/workspaces/{workspaceId}/forms/{formId}` | LIVE |
| Form Fields | `organizations/rapid-compliance-root/workspaces/{workspaceId}/forms/{formId}/fields/{fieldId}` | LIVE |
| Submissions | `organizations/rapid-compliance-root/workspaces/{workspaceId}/forms/{formId}/submissions/{submissionId}` | LIVE |
| Form Templates | `organizations/rapid-compliance-root/workspaces/{workspaceId}/formTemplates/{templateId}` | LIVE |
| Analytics | `organizations/rapid-compliance-root/workspaces/{workspaceId}/forms/{formId}/analytics/{date}` | LIVE |
| View Events | `organizations/rapid-compliance-root/workspaces/{workspaceId}/forms/{formId}/views/{viewId}` | LIVE |

---

## Implementation Notes

**Field Storage**: Form fields are stored as documents in a subcollection (`forms/{formId}/fields/{fieldId}`), not as nested arrays within the form document. Each field has its own document with configuration, validation rules, and ordering information.

**Workspace Isolation**: All forms are workspace-scoped. Forms in one workspace cannot be accessed by another workspace.

---

## Planned Features (Not Yet Implemented)

- **Conditional Logic**: Show/hide fields based on user responses
- **Branching Paths**: Skip to different sections based on answers
- **Field Dependencies**: Dynamic field validation based on other field values
- **Multi-page Conditional Flow**: Page visibility controlled by previous answers

---

*Last Updated: February 12, 2026*
