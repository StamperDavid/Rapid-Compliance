# Testing Setup Checklist — April 16, 2026

> **Purpose:** Everything needed to test the full system from front to back.
> **Where to enter API keys:** `localhost:3000/settings/api-keys`
> **Where to connect social accounts:** `localhost:3000/settings/integrations`

---

## MUST HAVE (system won't function without these)

| Service | Where to Enter | What Happens Without It |
|---------|---------------|------------------------|
| **OpenRouter API key** | Settings > API Keys > `openrouter` | ALL agent work fails — Jasper, every specialist, every manager. This is the backbone. |
| **Firebase config** | Already in `.env.local` | App won't start. Already configured. |
| **Google OAuth (sign-in)** | Already in `.env.local` (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`) | Can't sign in. Already configured. |

## SHOULD HAVE (important features break without these)

| Service | Where to Enter | What It Enables |
|---------|---------------|-----------------|
| **Hedra API key** | Settings > API Keys > `hedra` | Video generation (storyboards work without it, rendering doesn't) |
| **Stripe keys** | Settings > API Keys > `stripe_publishable` + `stripe_secret` | Payment processing, checkout, subscription management |
| **SendGrid API key** | Settings > API Keys > `sendgrid` | Email sending (campaigns, sequences, notifications). Graceful fallback if missing. |
| **Serper API key** | Settings > API Keys > `serper` | SEO keyword research, SERP analysis |
| **DataForSEO credentials** | Settings > API Keys > `dataforseo_login` + `dataforseo_password` | Advanced SEO metrics, competitor domain analysis |

## SOCIAL MEDIA PLATFORMS — setup per platform

Each platform needs credentials entered via Settings > Integrations or Settings > API Keys.

### Platforms with OAuth flow (click-to-authorize in the app)
| Platform | Setup Steps |
|----------|------------|
| **Twitter/X** | 1. Create app at developer.twitter.com. 2. Enter consumer key + secret in API Keys. 3. Click authorize in Integrations. |
| **YouTube** | 1. Create Google Cloud project + enable YouTube Data API. 2. Enter OAuth client ID/secret. 3. Authorize via OAuth. |
| **TikTok** | 1. Register at TikTok Developers. 2. Enter client key/secret. 3. Authorize via OAuth. |
| **Reddit** | 1. Create app at reddit.com/prefs/apps. 2. Enter client ID/secret. 3. Authorize via OAuth. |
| **Pinterest** | 1. Create app at developers.pinterest.com. 2. Get OAuth token. 3. Enter in API Keys. |
| **Google Business** | 1. Enable Business Profile API in Google Cloud. 2. Authorize via OAuth. 3. Enter account + location IDs. |

### Platforms with direct API key/token (enter in Settings > API Keys)
| Platform | What to Enter | How to Get It |
|----------|--------------|---------------|
| **Facebook** | `pageAccessToken` + `pageId` | Facebook Graph API Explorer — generate long-lived page token |
| **Instagram** | `accessToken` + `instagramAccountId` | Facebook Login → Instagram Graph API token |
| **LinkedIn** | `accessToken` + organization URN, OR `rapidApiKey` | LinkedIn Developer Portal or RapidAPI subscription |
| **Bluesky** | Username + app password | Bluesky Settings > App Passwords |
| **Threads** | `accessToken` + `userId` | Meta Business Suite > Threads API |
| **Truth Social** | `accessToken` | Mastodon-compatible API token from account settings |
| **Telegram** | `botToken` + `defaultChatId` | Create bot via @BotFather, get chat ID from getUpdates |
| **WhatsApp Business** | `accessToken` + `phoneNumberId` | Meta Business Platform > WhatsApp section |

### Not implemented (no code exists)
| Platform | Status |
|----------|--------|
| **Nextdoor** | No posting code. Low priority. |
| **Rumble** | No posting code. Low priority. |

## OTHER OPTIONAL SERVICES

| Service | Where to Enter | What It Enables |
|---------|---------------|-----------------|
| **Apollo.io** | Settings > API Keys > `apollo` | Lead enrichment (company data, contact info) |
| **Twilio** | Settings > API Keys > `twilio_account_sid` + `twilio_auth_token` + `twilio_phone_number` | Voice AI calls, SMS sending |
| **ElevenLabs** | Settings > API Keys > `elevenlabs` | High-quality text-to-speech for video |
| **Unreal Speech** | Settings > API Keys > `unreal_speech` | Alternative TTS provider |
| **Slack webhook** | Settings > API Keys > `slack_webhook` | Slack notifications |
| **Zapier webhook** | Settings > API Keys > `zapier_webhook` | Zapier automation triggers |
| **OpenAI** | Settings > API Keys > `openai` | DALL-E image generation, alternative LLM |
| **Anthropic** | Settings > API Keys > `anthropic` | Alternative LLM provider |
| **Google Gemini** | Settings > API Keys > `gemini` | Alternative LLM, image generation |

## TESTING ORDER RECOMMENDATION

1. **Sign in** — verify auth works
2. **Settings > API Keys** — enter OpenRouter key first (unlocks everything else)
3. **Jasper chat** — type a simple request, verify the agent responds
4. **Mission Control** — type a multi-step request, verify plan appears
5. **CRM** — create a lead, enrich it, score it
6. **Social media** — connect one platform, post a test
7. **Email** — enter SendGrid key, send a test email
8. **Website builder** — create a page, add a widget
9. **E-commerce** — enter Stripe keys, test checkout
10. **Video** — enter Hedra key, create a storyboard
11. **Voice** — enter Twilio keys, test a call

## WHAT'S VERIFIED IN CODE (don't need to re-verify manually)

- 53 AI agents (1 Jasper + 9 managers + 42 LLM-backed + 1 Voice AI) — pirate-tested
- Mission Control M3-M8 — 68 assertions on real Firestore
- Training loop — standing rule safety nets pass
- Manager review gates — 6/6 fixtures pass
- Rollback — full loop verified
- All 46 specialist files load from Firestore Golden Masters at runtime
