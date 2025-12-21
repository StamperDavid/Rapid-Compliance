# Firebase Setup Instructions

## Error: `Firebase: Error (auth/invalid-api-key)`

This error means Firebase is not properly configured. Follow these steps:

## Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com
2. Click "Add project" or select an existing project
3. Follow the setup wizard
4. Enable **Firestore Database** (Native mode)
5. Enable **Authentication** (Email/Password, Google, Microsoft)

## Step 2: Get Firebase Configuration

1. In Firebase Console, click the gear icon ⚙️ next to "Project Overview"
2. Select "Project settings"
3. Scroll down to "Your apps" section
4. Click the web icon `</>` to add a web app
5. Register your app (name it "AI Sales Platform")
6. Copy the Firebase configuration object

It will look like this:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

## Step 3: Create `.env.local` File

1. In your project root, create a file named `.env.local`
2. Copy the contents from `.env.example`
3. Fill in your Firebase credentials:

```env
# Firebase Configuration (from Step 2)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abc123
```

## Step 4: Restart Development Server

After creating `.env.local`:

```powershell
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Step 5: Verify Setup

1. Open http://localhost:3000
2. Check browser console - you should NOT see Firebase errors
3. Try navigating to any page - it should work

## Quick Setup Script

If you already have Firebase credentials, you can quickly create `.env.local`:

```powershell
# Copy the example file
Copy-Item .env.example .env.local

# Then edit .env.local with your Firebase credentials
notepad .env.local
```

## Troubleshooting

### Still seeing errors?

1. **Check file name**: Must be exactly `.env.local` (not `.env.local.txt`)
2. **Check location**: Must be in project root (same folder as `package.json`)
3. **Restart server**: Environment variables are loaded at startup
4. **Check values**: Make sure there are no extra spaces or quotes around values

### Running in Demo Mode

If Firebase is not configured, the app will run in **demo mode** with:
- Mock authentication (no real login)
- LocalStorage for data (data lost on refresh)
- Limited functionality

To enable full features, complete the Firebase setup above.

## Next Steps After Firebase Setup

1. **Set up Firestore Security Rules** (important for production)
2. **Configure OAuth providers** (Google, Microsoft) if needed
3. **Set up other services**:
   - Gemini API key (for AI features)
   - Stripe keys (for billing)
   - SendGrid/Resend (for email)

See `IMPLEMENTATION_COMPLETE.md` for full setup instructions.



















