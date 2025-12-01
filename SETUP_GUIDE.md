# 🚀 Setup Guide - AI Sales Platform

## Quick Start

### 1. Clone and Install

```bash
git clone <your-repo>
cd ai-sales-platform
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env.local
```

Now fill in the required values in `.env.local`:

---

## Required Services Setup

### 🔥 Firebase (Required)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication** → Email/Password
4. Enable **Firestore Database**
5. Get your config from Project Settings
6. Fill in `.env.local`:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
```

7. Generate Admin SDK private key:
   - Project Settings → Service Accounts → Generate New Private Key
   - Copy values to:

```env
FIREBASE_ADMIN_PROJECT_ID=...
FIREBASE_ADMIN_CLIENT_EMAIL=...
FIREBASE_ADMIN_PRIVATE_KEY="..."
```

---

### 🤖 AI Providers (At least one required)

#### OpenAI (Recommended)

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create API key
3. Add to `.env.local`:

```env
OPENAI_API_KEY=sk-...
```

#### Anthropic (Optional)

```env
ANTHROPIC_API_KEY=sk-ant-...
```

#### Google AI (Optional)

```env
GOOGLE_AI_API_KEY=...
```

---

### 📧 SendGrid (For Outbound Features)

1. Go to [SendGrid](https://sendgrid.com/)
2. Create account and verify sender email
3. Create API key with Full Access
4. Add to `.env.local`:

```env
SENDGRID_API_KEY=SG....
FROM_EMAIL=noreply@yourdomain.com
FROM_NAME=Your Company
```

5. Configure Event Webhook:
   - Settings → Mail Settings → Event Webhook
   - URL: `https://yourdomain.com/api/webhooks/email`
   - Select events: Delivered, Opened, Clicked, Bounced

---

### 📅 Google Calendar & Gmail (For Meeting Scheduler)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project
3. Enable APIs:
   - Gmail API
   - Google Calendar API
4. Create OAuth 2.0 Credentials:
   - Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/integrations/google/callback` (development)
     - `https://yourdomain.com/api/integrations/google/callback` (production)

5. Add to `.env.local`:

```env
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google/callback
```

---

### 💳 Stripe (For Payments)

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Get API keys from Developers → API keys
3. Add to `.env.local`:

```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

4. Set up webhook:
   - Developers → Webhooks → Add endpoint
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `payment_intent.succeeded`
   - Copy webhook secret:

```env
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

### ⏰ Cron Jobs (For Sequences)

Generate a random secret for cron job authentication:

```bash
openssl rand -base64 32
```

Add to `.env.local`:

```env
CRON_SECRET=your_random_secret_here
```

#### Vercel Cron Setup:

`vercel.json` is already configured. When you deploy to Vercel, the cron job will run automatically every hour.

#### Manual cron setup (alternative):

Use a service like [cron-job.org](https://cron-job.org/):
- URL: `https://yourdomain.com/api/cron/process-sequences`
- Schedule: Every hour
- Header: `Authorization: Bearer your_random_secret_here`

---

## Optional Services

### 📊 PostHog (Analytics)

```env
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### 🐛 Sentry (Error Tracking)

```env
SENTRY_DSN=https://...@sentry.io/...
```

### 📱 Twilio (SMS - Optional)

```env
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1...
```

---

## Running the Platform

### Development:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build:

```bash
npm run build
npm start
```

### Deploy to Vercel:

```bash
vercel
```

---

## Initial Setup

### 1. Create First User

1. Go to `/auth/signup`
2. Create account with email/password
3. Verify email (check Firebase console)

### 2. Create Organization

1. After login, you'll be prompted to create organization
2. Fill in organization details
3. Choose subscription plan

### 3. Configure AI Agent

1. Go to Settings → AI Agents → Persona
2. Choose AI model (GPT-4 recommended)
3. Upload knowledge base documents
4. Test chat interface

### 4. Set Up Integrations

1. Go to Integrations page
2. Connect Google Calendar:
   - Click "Connect Google Calendar"
   - Authorize access
   - Verify connection

3. Connect Gmail (optional):
   - Click "Connect Gmail"
   - Authorize access
   - Sync will start automatically

### 5. Configure Outbound

1. Go to Settings → Subscription
2. Enable outbound features you want
3. Go to Outbound → Email Writer
4. Test email generation

### 6. Create Test Sequence

1. Go to Outbound → Sequences
2. Create new sequence
3. Add 2-3 steps with delays
4. Enroll test prospect (use your own email)
5. Verify emails are sent

---

## Troubleshooting

### Emails not sending?

- Check SendGrid API key
- Verify sender email is verified in SendGrid
- Check SendGrid activity feed for errors
- Look at server logs for errors

### Calendar not working?

- Verify Google Cloud project has Calendar API enabled
- Check OAuth redirect URI matches exactly
- Look for errors in browser console
- Check server logs for token issues

### Firebase errors?

- Verify all Firebase config variables are set
- Check Firestore security rules allow access
- Ensure Authentication is enabled

### Build errors?

```bash
rm -rf .next node_modules
npm install
npm run build
```

---

## Production Checklist

Before deploying to production:

- [ ] All environment variables set in Vercel
- [ ] Firebase security rules configured
- [ ] SendGrid webhook configured with production URL
- [ ] Google OAuth redirect URI updated for production
- [ ] Stripe webhook configured with production URL
- [ ] Cron job secret is secure and random
- [ ] Domain configured and SSL working
- [ ] Test complete user flow end-to-end
- [ ] Error tracking (Sentry) configured
- [ ] Analytics (PostHog) configured

---

## Support

For issues:
1. Check server logs: `vercel logs` (if on Vercel)
2. Check browser console for frontend errors
3. Check Firebase console for database errors
4. Check SendGrid activity for email issues

---

## Next Steps

1. **Customize branding**: Settings → White Label
2. **Add products**: E-commerce → Products
3. **Import leads**: CRM → Import
4. **Create workflows**: Workflows → New Workflow
5. **Set up team**: Settings → Team Members

---

**Platform is ready to use! 🎉**

