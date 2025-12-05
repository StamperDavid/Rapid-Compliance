# 🔥 Quick Firebase Setup for AI Agent Training

Your AI Agent Training Center requires Firebase. Here's how to set it up in **5 minutes**:

## Step 1: Create Firebase Project (2 minutes)

1. Go to **https://console.firebase.google.com**
2. Click **"Add project"** (or use an existing one)
3. Name it (e.g., "AI Sales Platform")
4. Disable Google Analytics (optional, not needed)
5. Click **Create Project**

## Step 2: Enable Required Services (1 minute)

### Enable Firestore Database
1. In Firebase Console sidebar, click **"Firestore Database"**
2. Click **"Create database"**
3. Select **"Start in test mode"** (we'll add security rules later)
4. Choose a location (closest to you)
5. Click **"Enable"**

### Enable Authentication
1. In Firebase Console sidebar, click **"Authentication"**
2. Click **"Get started"**
3. Click on **"Email/Password"** tab
4. Enable **Email/Password** authentication
5. Click **"Save"**

## Step 3: Get Your Firebase Config (1 minute)

1. Click the **⚙️ gear icon** next to "Project Overview"
2. Click **"Project settings"**
3. Scroll down to **"Your apps"** section
4. Click the **`</>`** (web) icon
5. Register app (name: "AI Sales Platform")
6. **Copy** the `firebaseConfig` object

It looks like this:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project-12345.firebaseapp.com",
  projectId: "your-project-12345",
  storageBucket: "your-project-12345.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef123456"
};
```

## Step 4: Create `.env.local` File (1 minute)

1. In your project root (same folder as `package.json`), create a new file named `.env.local`
2. Copy and paste this, replacing with YOUR values:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-12345.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-12345
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-12345.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# AI Service (for training the agent)
NEXT_PUBLIC_GEMINI_API_KEY=your_gemini_key_here
```

### Get Gemini API Key (for AI Training)
1. Go to **https://aistudio.google.com/app/apikey**
2. Click **"Create API key"**
3. Copy the key and paste it as `NEXT_PUBLIC_GEMINI_API_KEY` in `.env.local`

## Step 5: Restart Server

Stop your development server (Ctrl+C in terminal) and restart:

```powershell
npm run dev
```

## ✅ Verify Setup

1. Open **http://localhost:3002** (or whatever port it's running on)
2. Navigate to **Settings > AI Agents > Training Center**
3. You should see the training interface (not an error)

---

## 🎯 What You Can Do After Setup

Once Firebase is configured, you can:

✅ **Train your AI sales agent** through conversation simulations  
✅ **Upload training materials** (PDFs, sales scripts, product guides)  
✅ **Give feedback** on agent responses to improve performance  
✅ **Track training scores** and measure improvement  
✅ **Save Golden Master versions** when agent reaches 80%+ quality  
✅ **Deploy trained agents** to handle real customer conversations  

The AI agent will learn to sell **your platform** (the AI CRM) to prospective clients!

---

## 🆘 Troubleshooting

### "Internal Server Error" still showing?
- Check that `.env.local` is in the **project root** (same folder as `package.json`)
- Verify file name is exactly `.env.local` (not `.env.local.txt`)
- Restart the dev server after creating the file
- Check browser console (F12) for specific errors

### Firebase errors in console?
- Double-check that you copied ALL values correctly
- Make sure there are no extra spaces or quotes
- Verify Firestore and Authentication are enabled in Firebase Console

### Can't access Firebase Console?
- Make sure you're logged in with your Google account
- Try accessing from an incognito/private window
- Clear browser cache and cookies

---

## 📚 Next Steps

After Firebase is set up:
1. Create your first user account
2. Complete the onboarding flow
3. Start training your AI sales agent!

Need help? Check `FIREBASE_SETUP.md` for detailed instructions.





