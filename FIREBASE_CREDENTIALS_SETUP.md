# Firebase Admin Credentials Setup

## Step 1: Go to Firebase Console
1. Open: https://console.firebase.google.com/
2. Select your project (or create one if you haven't)

## Step 2: Generate Service Account Key
1. Click the **⚙️ gear icon** (Settings) in the left sidebar
2. Click **"Project settings"**
3. Click the **"Service accounts"** tab at the top
4. Click **"Generate new private key"** button
5. Click **"Generate key"** in the popup
6. A JSON file will download (save it somewhere safe!)

## Step 3: Extract Credentials from JSON

Open the downloaded JSON file. It will look like this:

```json
{
  "type": "service_account",
  "project_id": "your-project-id-here",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com",
  "client_id": "1234567890",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

You need these 3 values:
- `project_id`
- `client_email`
- `private_key`

## Step 4: Add to .env.local

Open your `.env.local` file and add these lines:

```env
# Firebase Admin SDK (for backend/seeding scripts)
FIREBASE_ADMIN_PROJECT_ID=your-project-id-here
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEv...\n-----END PRIVATE KEY-----\n"
```

⚠️ **IMPORTANT:** 
- Keep the quotes around `FIREBASE_ADMIN_PRIVATE_KEY`
- Keep the `\n` characters in the private key (they represent line breaks)
- Copy the ENTIRE private key including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`

## Step 5: Also Add Client-Side Firebase Config

While you're at it, add your client-side Firebase config too (from Firebase Console → Project Settings → General):

```env
# Firebase Client SDK (for frontend)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
```

## Step 6: Run the Seed Script

```powershell
node scripts/seed-production-test-orgs.js
```

## Troubleshooting

**"Could not load credentials"** → Make sure all 3 admin variables are set in .env.local

**"Permission denied"** → Make sure your Firebase project has Firestore enabled (Firebase Console → Build → Firestore Database)

**"Invalid private key"** → Make sure you copied the entire private key with quotes and \n characters

---

**Keep this file for reference!** 📌









