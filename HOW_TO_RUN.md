# How to Run This Project

## Windows (PowerShell)

### Option 1: Automated Quick Start (Recommended)
```powershell
# Navigate to project directory
cd "E:\AI Sales Platform"

# Run quick start (installs dependencies and starts server)
.\scripts\quick-start.ps1
```

This will:
1. Check for Node.js
2. Install all dependencies if needed
3. Create .env.local if it doesn't exist
4. Start the Next.js dev server in a new window
5. Open your browser to http://localhost:3000

### Option 2: Full Setup (First Time)
```powershell
# Complete setup with all dependencies
.\scripts\setup-dev.ps1

# Then start the server
.\scripts\quick-start.ps1
```

### Option 3: Start with Additional Services
```powershell
# Start with Firebase Emulators
.\scripts\start-dev.ps1 -WithFirebase

# Start with Redis
.\scripts\start-dev.ps1 -WithRedis

# Start everything (Next.js + Firebase + Redis + PostgreSQL)
.\scripts\start-dev.ps1 -All
```

### Option 4: Manual Start
```powershell
# Install dependencies (first time only)
npm install

# Start development server
npm run dev
```

Then open http://localhost:3000 in your browser.

---

## Before You Start

### 1. Install Node.js
If you don't have Node.js installed:
- Download from: https://nodejs.org/
- Version required: 18.0.0 or higher
- Includes npm automatically

### 2. Set Up Environment Variables
After first run, edit `.env.local` with your API keys:

```env
# Firebase (Get from Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id

# Gemini AI (Get from Google AI Studio)
GEMINI_API_KEY=your_gemini_key

# Stripe (Get from Stripe Dashboard)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

### 3. Optional Services

#### Firebase Emulators (for local testing)
```powershell
# Install Firebase CLI globally
npm install -g firebase-tools

# Login to Firebase
firebase login

# Start emulators
npm run firebase:emulators
```

#### Redis (for caching)
Download from: https://redis.io/download
Or use Docker:
```powershell
docker run -p 6379:6379 redis
```

---

## What Happens When You Run

1. **Next.js Dev Server** starts on http://localhost:3000
2. **Hot reload** enabled - changes reflect immediately
3. **TypeScript** compilation in watch mode
4. **Tailwind CSS** processing with JIT compiler

---

## Stopping the Server

- Press `Ctrl + C` in the terminal
- Or close the PowerShell window

---

## Troubleshooting

### "npm is not recognized"
- Node.js is not installed or not in PATH
- Install from https://nodejs.org/ and restart PowerShell

### "Cannot find module"
- Dependencies not installed
- Run: `npm install`

### "Port 3000 already in use"
- Another app is using port 3000
- Kill the process or use different port:
  ```powershell
  $env:PORT=3001
  npm run dev
  ```

### ".env.local not found" warnings
- This is normal on first run
- Update `.env.local` with your API keys when ready

---

## Development Workflow

1. **Start the server**: `.\scripts\quick-start.ps1`
2. **Make changes**: Edit files in `src/`
3. **See changes**: Browser auto-refreshes
4. **Test features**: Use http://localhost:3000
5. **Stop server**: `Ctrl + C`

---

## Next Steps

Once the server is running:

1. **Create Workspace**: Set up your first organization/workspace
2. **Build Objects**: Create custom objects (Companies, Deals, etc.)
3. **Customize Theme**: Apply gradients, logos, colors
4. **Enable E-Commerce**: Turn on storefront features
5. **Generate Widgets**: Create embeddable shortcodes

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `.\scripts\quick-start.ps1` | Start dev server (quickest) |
| `.\scripts\setup-dev.ps1` | Full setup with dependencies |
| `.\scripts\start-dev.ps1 -All` | Start all services |
| `npm run dev` | Start Next.js only |
| `npm run build` | Create production build |
| `npm run lint` | Check code quality |
| `npm test` | Run tests |

---

## Current File Location

Your project is at: `E:\AI Sales Platform`

**You're ready to go!** Just run `.\scripts\quick-start.ps1` and start building! 🚀


