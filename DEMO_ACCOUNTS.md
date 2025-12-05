# 🎭 Demo Accounts - Quick Access

**⚠️ IMPORTANT: These are TEST accounts - Remove before going live in production!**

All accounts are clearly marked with **(TEST)** in their company names for easy identification.

---

## 🔑 Quick Login Credentials

**Universal Password for ALL demo accounts:** `Testing123!`

---

## 📋 All Demo Accounts

### 1️⃣ AuraFlow Analytics (TEST)
**Industry:** B2B Software as a Service (SaaS)  
**Email:** `admin@auraflow.test`  
**Password:** `Testing123!`  
**Plan:** Starter  
**Best For:** Demonstrating B2B SaaS, technical sales, formal professional tone

---

### 2️⃣ GreenThumb Landscaping (TEST)
**Industry:** Home Services (Landscaping & Lawn Care)  
**Email:** `admin@greenthumb.test`  
**Password:** `Testing123!`  
**Plan:** Starter  
**Best For:** Local service business, casual friendly tone, subscription services

---

### 3️⃣ The Adventure Gear Shop (TEST)
**Industry:** E-commerce (Outdoor Apparel and Gear)  
**Email:** `admin@adventuregear.test`  
**Password:** `Testing123!`  
**Plan:** Professional  
**Best For:** E-commerce, customer support, product-focused conversations

---

### 4️⃣ Summit Wealth Management (TEST)
**Industry:** Financial Services (Investment Advisory)  
**Email:** `admin@summitwm.test`  
**Password:** `Testing123!`  
**Plan:** Professional  
**Best For:** High-trust industries, compliance-aware, formal communication

---

### 5️⃣ PixelPerfect Design Co. (TEST)
**Industry:** Creative Services (Web Design & Branding)  
**Email:** `admin@pixelperfect.test`  
**Password:** `Testing123!`  
**Plan:** Starter  
**Best For:** Creative services, consultative sales, project-based work

---

### 6️⃣ CodeMaster Academy (TEST)
**Industry:** E-Learning/EdTech (Coding Bootcamp)  
**Email:** `admin@codemaster.test`  
**Password:** `Testing123!`  
**Plan:** Professional  
**Best For:** Education/training, career changers, motivational tone

---

### 7️⃣ Midwest Plastics Supply (TEST)
**Industry:** B2B Manufacturing/Wholesale  
**Email:** `admin@midwestplastics.test`  
**Password:** `Testing123!`  
**Plan:** Professional  
**Best For:** Manufacturing, technical specifications, B2B wholesale

---

### 8️⃣ Metro Property Group (TEST)
**Industry:** Residential Real Estate Brokerage  
**Email:** `admin@metroproperty.test`  
**Password:** `Testing123!`  
**Plan:** Starter  
**Best For:** Real estate, local expertise, emotional high-stakes decisions

---

### 9️⃣ Executive Edge Coaching (TEST)
**Industry:** B2B Executive Coaching  
**Email:** `admin@executiveedge.test`  
**Password:** `Testing123!`  
**Plan:** Professional  
**Best For:** High-end consulting, executive-level communication, results-focused

---

## 🚀 Quick Demo Script

### For Investor/Customer Demos:

1. **Pick your industry** based on audience:
   - Tech audience? → Use AuraFlow Analytics or CodeMaster Academy
   - E-commerce? → Use Adventure Gear Shop
   - Local business? → Use GreenThumb Landscaping
   - Professional services? → Use Summit Wealth Management or Executive Edge

2. **Login:** Go to http://localhost:3000 (or your deployed URL)
   - Copy/paste email from above
   - Password: `Testing123!`

3. **Show configured AI agent** with industry-specific knowledge

4. **Demonstrate different industries** by switching accounts to show versatility

---

## 🔧 Creating These Accounts

**Step 1:** Start Firebase Emulators
```bash
firebase emulators:start --import=./emulator-data --export-on-exit
```

**Step 2:** Run Seed Script (in new terminal)
```bash
node scripts/seed-test-accounts.js
```

**Result:** All 9 demo accounts created with full onboarding data

---

## 🗑️ Removing Demo Accounts (Before Production)

### Option 1: Manual Deletion
1. Go to Admin Dashboard
2. Search for companies with "(TEST)" in name
3. Delete each organization

### Option 2: Database Query (Firebase Console)
```javascript
// Filter organizations where name contains "(TEST)"
// Bulk delete
```

### Option 3: Script (Recommended)
Create cleanup script:
```javascript
// scripts/remove-test-accounts.js
// Query all orgs where name contains "(TEST)"
// Delete org, users, and related data
```

---

## 📊 What Each Account Demonstrates

| Demo Account | Demonstrates |
|--------------|--------------|
| AuraFlow Analytics | Technical B2B SaaS sales, data-driven messaging |
| GreenThumb Landscaping | Local service scheduling, eco-friendly positioning |
| Adventure Gear Shop | E-commerce support, warranty handling, product knowledge |
| Summit Wealth Management | Compliance-aware, fiduciary responsibility, formal tone |
| PixelPerfect Design | Creative consultative sales, project scoping |
| CodeMaster Academy | Career transformation, educational sales, motivation |
| Midwest Plastics | Technical B2B, specifications, wholesale pricing |
| Metro Property Group | Real estate, local expertise, emotional intelligence |
| Executive Edge Coaching | Executive-level communication, ROI focus, exclusivity |

---

## 💡 Pro Tips

1. **Use different accounts for different audiences:**
   - Show SaaS investors → AuraFlow Analytics
   - Show e-commerce prospects → Adventure Gear Shop
   - Show service businesses → GreenThumb or Metro Property

2. **Each account has pre-configured:**
   - Complete onboarding data (16 steps)
   - Industry-specific personality
   - Agent goals and escalation rules
   - Tone and formality settings

3. **Quick Account Switching:**
   - Keep this file open during demos
   - Copy/paste credentials quickly
   - Show multiple industries in one demo

4. **Account Status:**
   - All accounts start on 14-day trial
   - Assigned to Starter or Professional plans
   - No payment method required for demos

---

## ⚠️ Security Notes

- **DO NOT** use these in production
- **DO NOT** store real customer data in these accounts
- **REMEMBER** to delete before launch
- All emails use `.test` TLD (not real domains)
- Passwords are intentionally simple for demo purposes

---

## 📝 Quick Copy/Paste Credentials

```
# B2B SaaS Demo
Email: admin@auraflow.test
Password: Testing123!

# E-commerce Demo
Email: admin@adventuregear.test
Password: Testing123!

# Local Services Demo
Email: admin@greenthumb.test
Password: Testing123!

# Financial Services Demo
Email: admin@summitwm.test
Password: Testing123!

# Creative Services Demo
Email: admin@pixelperfect.test
Password: Testing123!

# EdTech Demo
Email: admin@codemaster.test
Password: Testing123!

# Manufacturing Demo
Email: admin@midwestplastics.test
Password: Testing123!

# Real Estate Demo
Email: admin@metroproperty.test
Password: Testing123!

# Executive Coaching Demo
Email: admin@executiveedge.test
Password: Testing123!
```

---

**Last Updated:** December 2025  
**Total Demo Accounts:** 9  
**Status:** Active for development/demo purposes only


