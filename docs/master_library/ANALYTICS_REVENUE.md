# FEATURE NAME: Revenue Analytics Dashboard

## FILE PATH
`src/app/(dashboard)/analytics/revenue/page.tsx`

## AUDIT STATUS: PASS

All data is fetched from Firestore. No hard-coded mocks detected. Theme compliant with CSS variables.

---

## MANUAL SOP

### Purpose
The Revenue Analytics Dashboard provides comprehensive visibility into revenue performance across time periods, sources, products, and team members. It enables data-driven forecasting and identifies trends and opportunities.

### Steps to Execute Manually

1. **Access Revenue Analytics**
   - Navigate to `/dashboard` (Main Dashboard)
   - Click "Analytics" in the sidebar
   - Select "Revenue"
   - Alternatively, navigate to `/analytics/revenue`

2. **Select Time Period**
   - Use period selector at top
   - Quick selections:
     - Last 7 Days (7d)
     - Last 30 Days (30d)
     - Last 90 Days (90d)
     - All Time (all)

3. **Review Key Metrics**
   - Top KPI cards show:
     - Total Revenue (selected period)
     - Revenue Growth (vs. previous period)
     - Average Deal Size
     - Win Rate
     - Revenue per Rep

4. **View Revenue Trend**
   - Line chart shows revenue over time
   - Toggle daily/weekly/monthly view
   - Hover for exact values
   - Compare to previous period

5. **Analyze by Source**
   - Pie/bar chart shows revenue by source:
     - Inbound (web, forms)
     - Outbound (email, calls)
     - Referral
     - Partner
     - Marketing campaigns
   - Click segment to drill down

6. **Analyze by Product**
   - Bar chart shows revenue by product/service
   - Sort by total revenue or units sold
   - Identify top performers

7. **Analyze by Rep**
   - Table shows revenue per sales rep
   - Columns: Rep name, deals closed, revenue, quota attainment
   - Sort by any column
   - Identify top and bottom performers

8. **View Forecast**
   - AI-generated forecast section shows:
     - Predicted month-end revenue
     - Confidence interval
     - Risk factors
     - Upside opportunities

9. **View Forecast**
    - AI-generated forecast shows predicted revenue
    - Confidence intervals displayed
    - Based on pipeline and historical trends

---

## Planned Features (Not Yet Implemented)

### Period Comparison
- **Comparison Mode**: Overlay previous period or year-over-year comparison
- **Growth Indicators**: Automated trend detection and anomaly alerts
- **Benchmark Comparison**: Compare against industry standards

### Data Export
- **Export to PDF**: Professional revenue reports for stakeholders
- **Export to CSV/Excel**: Raw data export for further analysis
- **Scheduled Reports**: Automated report delivery via email

### Alerts & Notifications
- **Revenue Alerts**: Get notified when revenue drops below threshold
- **Goal Tracking**: Set revenue targets and track progress
- **Anomaly Detection**: AI-powered alerts for unusual revenue patterns

---

## VIDEO PRODUCTION SCRIPT

### Duration: 90 seconds

---

**[Visual]:** Spreadsheet with numbers fades out. Revenue dashboard fades in with animated charts.

**[Audio]:** "Revenue is the scoreboard that matters. SalesVelocity.ai Revenue Analytics shows you exactly where you stand - in real time."

---

**[Visual]:** KPI cards animate with numbers counting up. Green arrows show growth.

**[Audio]:** "Key metrics at a glance: total revenue, growth rate, average deal size, win rate. No spreadsheets, no formulas. Just the numbers that drive your business."

---

**[Visual]:** Revenue trend line chart. Mouse hovers over points showing values.

**[Audio]:** "Track revenue over any time period. See the trend. Understand seasonality. Know if you're on track before month-end surprises."

---

**[Visual]:** Pie chart shows revenue by source. Click "Inbound" segment - drills down to show channels.

**[Audio]:** "Understand where revenue comes from. Inbound leads, outbound efforts, referrals. Double down on what's working."

---

**[Visual]:** Bar chart shows products ranked by revenue. Hover shows details.

**[Audio]:** "See which products drive the most revenue. Identify your winners and focus your team's energy accordingly."

---

**[Visual]:** Sales rep table with quota attainment percentages. Green/red indicators.

**[Audio]:** "Track individual performance against quota. Celebrate your top performers. Coach those who need help. Data makes it objective."

---

**[Visual]:** Forecast section with predicted revenue and confidence band.

**[Audio]:** "AI predicts where you'll land. See your forecast with confidence intervals. Know your risks and opportunities before they become surprises."

---

**[Visual]:** Export button clicked. Professional PDF report downloads.

**[Audio]:** "Board meeting tomorrow? Export a professional report in seconds. Revenue analytics, beautifully presented."

---

**[Visual]:** Logo with upward revenue chart.

**[Audio]:** "SalesVelocity.ai Revenue Analytics. Know your numbers. Grow your numbers."

---

## DATA DEPENDENCY

| Data Point | Firestore Path | Status |
|------------|----------------|--------|
| Closed Deals | `organizations/rapid-compliance-root/workspaces/{wsId}/entities/deals/records` where stage='closed_won' | LIVE |
| Revenue by Source | Aggregated from deal.source field | LIVE |
| Revenue by Product | Aggregated from deal.products array | LIVE |
| Revenue by Rep | Aggregated from deal.ownerId field | LIVE |
| Quota Data | `users/{userId}/quotas` | LIVE |
| Forecast | AI-calculated from pipeline and historical data | LIVE |

---

*Last Audited: February 12, 2026*
