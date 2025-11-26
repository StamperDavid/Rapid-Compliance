# Installation Instructions

## Step 1: Install Dependencies

```powershell
npm install
```

This will install:
- Next.js (the framework)
- React
- TypeScript
- Tailwind CSS
- Firebase
- All other dependencies

**This may take a few minutes...**

---

## Step 2: Start the Dev Server

After installation completes, run:

```powershell
npm run dev
```

---

## Quick Command Sequence:

```powershell
# Run these commands in order:
cd "E:\AI Sales Platform"
npm install
npm run dev
```

---

## What's Happening:

The `npm install` command:
1. Reads package.json
2. Downloads all dependencies from npm
3. Installs them in node_modules folder
4. May take 2-5 minutes depending on internet speed

---

## After Installation:

Once complete, you'll see:
```
added 500+ packages in 2m
```

Then run:
```powershell
npm run dev
```

And you'll see:
```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- event compiled client and server successfully
```

Then open: http://localhost:3000

---

## Or Use the Script (which does this automatically):

```powershell
.\scripts\quick-start.ps1
```

This script checks for node_modules and runs npm install automatically if needed!


