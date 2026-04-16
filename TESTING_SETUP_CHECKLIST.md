# Every Account, API Key, and Sign-in Needed to Test the Full System

Work through this list top to bottom. Check off each one as you complete it. Enter all API keys at `localhost:3000/settings/api-keys` unless noted otherwise.

---

## AI Services

- [ ] **OpenRouter** — ALREADY CONFIGURED. No action needed.
- [ ] **OpenAI** — ALREADY CONFIGURED. No action needed.
- [ ] **Anthropic** — Get API key from https://console.anthropic.com. Enter in Settings > API Keys. (Optional — OpenRouter already covers Claude models.)
- [ ] **Google Gemini** — Get API key from https://aistudio.google.com/apikey. Enter in Settings > API Keys. (Optional — OpenRouter already covers Gemini.)

## Email

- [ ] **SendGrid** — ALREADY CONFIGURED. No action needed.
- [ ] **Resend** (backup email provider) — Get API key from https://resend.com/api-keys. Enter in Settings > API Keys. (Optional — SendGrid already works.)

## Payments

- [ ] **Stripe** — ALREADY CONFIGURED. No action needed. Make sure you have test-mode keys (starts with `sk_test_`) for testing without real charges.

## Video Generation

- [ ] **Hedra** — ALREADY CONFIGURED. No action needed.

## Voice & SMS

- [ ] **Twilio** — ALREADY CONFIGURED (account SID + auth token + phone number). No action needed.
- [ ] **ElevenLabs** (text-to-speech) — ALREADY CONFIGURED. No action needed.
- [ ] **Unreal Speech** (text-to-speech) — ALREADY CONFIGURED. No action needed.

## SEO & Research

- [ ] **Serper** (Google search results) — ALREADY CONFIGURED. No action needed.
- [ ] **DataForSEO** — Login is configured. Verify the password is also entered in Settings > API Keys.
- [ ] **PageSpeed** — ALREADY CONFIGURED. No action needed.

## Lead Enrichment

- [ ] **Apollo.io** — ALREADY CONFIGURED. No action needed.
- [ ] **Clay** — ALREADY CONFIGURED. No action needed.

---

## Social Media Accounts — THESE ALL NEED SETUP

For each platform below, you need to create a developer app (or get API credentials), then enter the credentials in Settings > API Keys or connect via Settings > Integrations.

### Twitter/X
- [ ] Token is configured but verify it still works
- [ ] Test by posting from the Social Command Center

### LinkedIn
- [ ] Go to https://www.linkedin.com/developers/
- [ ] Create an app (or use existing one)
- [ ] Get OAuth access token OR get a RapidAPI key for LinkedIn posting
- [ ] Enter in Settings > API Keys under the LinkedIn section

### Facebook
- [ ] Go to https://developers.facebook.com/tools/explorer/
- [ ] Generate a long-lived Page Access Token for your Facebook Page
- [ ] Copy your Page ID from your Facebook Page's About section
- [ ] Enter both in Settings > API Keys

### Instagram
- [ ] Requires a Facebook-connected Instagram Business account
- [ ] Get an access token via Facebook Login (same developer app as Facebook)
- [ ] Get your Instagram Account ID from the Graph API
- [ ] Enter both in Settings > API Keys

### YouTube
- [ ] Go to https://console.cloud.google.com
- [ ] Enable the YouTube Data API v3
- [ ] Create OAuth 2.0 credentials (client ID + secret)
- [ ] Authorize and get a refresh token
- [ ] Enter client ID, client secret, refresh token, and channel ID in Settings > API Keys

### TikTok
- [ ] Go to https://developers.tiktok.com
- [ ] Register an app and get approved for the Content Posting API
- [ ] Get client key + client secret
- [ ] Authorize and get a refresh token
- [ ] Enter in Settings > API Keys

### Bluesky
- [ ] Log into your Bluesky account
- [ ] Go to Settings > App Passwords
- [ ] Create an app password
- [ ] Enter your handle (e.g., yourname.bsky.social) and the app password in Settings > API Keys

### Threads
- [ ] Requires a Meta developer account (same as Facebook/Instagram)
- [ ] Get an access token from the Threads API in Meta Business Suite
- [ ] Get your Threads user ID
- [ ] Enter both in Settings > API Keys

### Truth Social
- [ ] Log into your Truth Social account
- [ ] Generate an API token from account settings (Mastodon-compatible)
- [ ] Enter the token in Settings > API Keys

### Telegram
- [ ] Open Telegram, search for @BotFather
- [ ] Send `/newbot` and follow the prompts to create a bot
- [ ] Copy the bot token BotFather gives you
- [ ] Create a channel or group, add the bot, and get the chat ID (send a message then check https://api.telegram.org/bot{TOKEN}/getUpdates)
- [ ] Enter bot token + chat ID in Settings > API Keys

### Reddit
- [ ] Go to https://www.reddit.com/prefs/apps
- [ ] Create a "script" type app
- [ ] Get the client ID and secret
- [ ] Authorize and get a refresh token
- [ ] Enter in Settings > API Keys

### Pinterest
- [ ] Go to https://developers.pinterest.com
- [ ] Create an app
- [ ] Get an OAuth access token
- [ ] Enter in Settings > API Keys

### WhatsApp Business
- [ ] Go to https://business.facebook.com (Meta Business Platform)
- [ ] Set up WhatsApp Business API access
- [ ] Get an access token and phone number ID
- [ ] Enter both in Settings > API Keys

### Google Business Profile
- [ ] Go to https://console.cloud.google.com
- [ ] Enable the Business Profile API
- [ ] Create OAuth credentials and authorize
- [ ] Get your account ID and location ID from the API
- [ ] Enter in Settings > API Keys

### Nextdoor — NOT AVAILABLE
- No posting code exists in the system. Skip.

### Rumble — NOT AVAILABLE
- No posting code exists in the system. Skip.

---

## Other Optional Services

- [ ] **Slack** — Get a webhook URL from https://api.slack.com/messaging/webhooks. Enter in Settings > API Keys. Only needed if you want Slack notifications.
- [ ] **Zapier** — Get a webhook URL from your Zapier account. Enter in Settings > API Keys. Only needed if you want Zapier automation.

---

## Firebase / Auth (already done, don't touch)

- [x] Firebase project configured in `.env.local`
- [x] Google OAuth client ID + secret in `.env.local`
- [x] Firebase Admin credentials (serviceAccountKey.json)

---

## Quick Summary

| Category | Already Done | Need to Set Up |
|---|---|---|
| AI (LLM providers) | OpenRouter, OpenAI | Anthropic (optional), Gemini (optional) |
| Email | SendGrid | Resend (optional) |
| Payments | Stripe | — |
| Video | Hedra | — |
| Voice/SMS | Twilio, ElevenLabs, Unreal Speech | — |
| SEO | Serper, PageSpeed, DataForSEO | Verify DataForSEO password |
| Enrichment | Apollo, Clay | — |
| Social Media | Twitter | LinkedIn, Facebook, Instagram, YouTube, TikTok, Bluesky, Threads, Truth Social, Telegram, Reddit, Pinterest, WhatsApp, Google Business |
