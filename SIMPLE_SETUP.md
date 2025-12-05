# Simple Setup Guide (No BS Version)

## What You Just Built

You built an **API Keys page** in your app. Go there instead of messing with .env files.

**URL:** `/workspace/[your-org-id]/settings/api-keys`

Or navigate: Settings → API Keys

---

## What You Need (Plain English)

### 1. OpenAI ($10-50/month) ⚡ REQUIRED

**What it is:** The AI brain. Powers email generation, chat, reply handling.

**Why:** Without this, no AI features work at all.

**How to get it:**
1. Go to [platform.openai.com](https://platform.openai.com)
2. Sign up (use credit card, they charge per use)
3. Click "API Keys" on left
4. Click "Create new secret key"
5. Copy it (starts with `sk-`)
6. Paste into your app's API Keys page

**Cost:** ~$10-50/month depending on how much you use it

---

### 2. SendGrid ($20/month) ⚡ REQUIRED

**What it is:** The email delivery service. Actually sends your emails.

**Why:** You can't send emails from your own server - they'll go to spam. SendGrid is like the post office that delivers them properly.

**How to get it:**
1. Go to [sendgrid.com](https://sendgrid.com)
2. Sign up (they have a free tier for testing)
3. Verify your sender email address (the email you'll send FROM)
4. Go to Settings → API Keys → Create API Key
5. Give it "Full Access"
6. Copy it (starts with `SG.`)
7. Paste into your app's API Keys page

**Cost:** $20/month for 40,000 emails (or free for 100/day)

---

### 3. Google OAuth (FREE) 📅 Optional but Recommended

**What it is:** Lets users connect THEIR Gmail and Google Calendar to your app.

**Why:** For meeting scheduler and Gmail sync features.

**How to get it:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Click "Create Project" (name it anything, like "My Sales Platform")
3. Once created, click "Enable APIs and Services"
4. Search for and enable:
   - "Google Calendar API"
   - "Gmail API"
5. Click "Credentials" on the left
6. Click "Create Credentials" → "OAuth client ID"
7. Choose "Web application"
8. Under "Authorized redirect URIs", add:
   - `http://localhost:3000/api/integrations/google/callback`
   - (When you deploy, add your live URL too)
9. Click "Create"
10. Copy BOTH:
    - Client ID (ends in `.apps.googleusercontent.com`)
    - Client Secret (starts with `GOCSPX-`)
11. Paste BOTH into your app's API Keys page

**Cost:** FREE

---

### 4. Stripe (FREE, pay per transaction) 💳 Optional

**What it is:** Processes credit card payments for e-commerce.

**Why:** Only needed if you're selling products through the platform.

**How to get it:**
1. Go to [dashboard.stripe.com](https://dashboard.stripe.com)
2. Sign up
3. Go to Developers → API keys
4. Copy BOTH:
   - Publishable key (starts with `pk_test_`)
   - Secret key (starts with `sk_test_`)
5. Paste BOTH into your app's API Keys page

**Cost:** FREE (Stripe takes 2.9% + 30¢ per transaction)

---

## Testing Your Setup

After adding each key in the app:
1. Click the "Test" button next to it
2. It will tell you if it's working or not
3. Green checkmark = working
4. Red X = something's wrong

---

## What Works Without Any Setup

- ✅ AI Chat (if you add OpenAI key)
- ✅ CRM (leads, contacts, companies, deals)
- ✅ Product management
- ✅ Widgets (but can't process payments without Stripe)
- ✅ Analytics

## What Needs Keys

- ❌ Email sequences (needs SendGrid + OpenAI)
- ❌ AI email generation (needs OpenAI)
- ❌ Meeting scheduler (needs Google)
- ❌ Gmail sync (needs Google)
- ❌ Payments (needs Stripe)

---

## Simple Test Flow

1. **Add OpenAI key**
   - Test it (click Test button)
   - Should say "✅ OpenAI is working!"

2. **Add SendGrid key**
   - Test it
   - Should say "✅ SendGrid is working!"

3. **Try generating an email**
   - Go to Outbound → Email Writer
   - Fill in a prospect name and company
   - Click "Generate Email"
   - Should work now!

4. **(Optional) Add Google keys**
   - Test them
   - Go to Integrations
   - Click "Connect Google Calendar"
   - Should redirect to Google to authorize

---

## Common Issues

**"OpenAI test failed"**
- Check you copied the FULL key (they're long)
- Make sure it starts with `sk-`
- Make sure you didn't include any extra spaces

**"SendGrid test failed"**
- Check you verified your sender email in SendGrid
- Make sure the key has "Full Access"
- Make sure it starts with `SG.`

**"Google Client ID should end with .apps.googleusercontent.com"**
- You copied the wrong thing
- Go back to Google Cloud Console
- Copy the FULL Client ID

---

## Where's My .env File?

**You don't need it anymore.**

The API Keys page stores everything in your database (Firestore). 

But if you want to use .env anyway (for testing), you can still add:
- `OPENAI_API_KEY=sk-...`
- `SENDGRID_API_KEY=SG....`
- `GOOGLE_CLIENT_ID=....apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET=GOCSPX-...`

The app checks the database first, then falls back to .env if not found.

---

## Done!

After adding OpenAI + SendGrid (takes 30 min total):
- Email sequences work
- AI email generation works
- Reply handling works
- Everything outbound works

After adding Google too (takes 1 hour total):
- Meeting scheduler works
- Calendar sync works
- Gmail sync works

That's it. No more .env confusion.





