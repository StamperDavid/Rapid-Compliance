# 🗑️ Recursive Ghost Data Cleanup

## What This Script Does

Deletes ALL organizations from `ai-sales-platform-dev` EXCEPT the 5 protected demo organizations.

### Protected Organizations (WILL NOT DELETE):
- ✅ `org_1767162182929_zybiwt` - AuraFlow
- ✅ `org_1767162183846_33y89i` - GreenThumb
- ✅ `org_1767162184756_5xf9a9` - Adventure Gear
- ✅ `org_1767162185614_xo5ryr` - Summit
- ✅ `org_1767162186490_tptncm` - PixelPerfect

### Protected User:
- ✅ `dstamper@rapidcompliance.us`

---

## How to Run

### Prerequisites
Make sure your `.env.local` has the DEV credentials:
```bash
FIREBASE_ADMIN_PROJECT_ID=ai-sales-platform-dev
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-fbsvc@ai-sales-platform-dev.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="..."
```

### Execute the Cleanup

```bash
# Load environment variables and run the script
node -r dotenv/config scripts/recursive-nuke.js
```

**OR** if you have the env vars already exported:

```bash
node scripts/recursive-nuke.js
```

---

## What Gets Deleted

- ❌ All `test-org-*` organizations
- ❌ Any organization NOT in the protected list
- ❌ ALL subcollections recursively (using Firebase's `recursiveDelete`)

---

## Safety Features

1. **Protected List**: The 5 demo orgs are hardcoded and will NEVER be deleted
2. **Dry Run Available**: You can modify the script to add a `--dry-run` flag
3. **Detailed Logging**: Shows exactly what's being deleted

---

## After Running

Check your Firebase Console:
https://console.firebase.google.com/project/ai-sales-platform-dev/firestore

You should only see:
- The 5 protected demo organizations
- Clean, ghost-free data

---

## ⚠️ WARNING

**THIS SCRIPT DELETES DATA PERMANENTLY!**

- Only run on `ai-sales-platform-dev` (development environment)
- NEVER run on `ai-sales-platform-4f5e4` (production)
- The script is configured to only target the dev project

---

## Troubleshooting

### Error: "Firebase Admin not initialized"
- Make sure your `.env.local` has the correct credentials
- Check that `FIREBASE_ADMIN_PRIVATE_KEY` is properly escaped

### Error: "recursiveDelete is not a function"
- Update your firebase-admin package: `npm install firebase-admin@latest`
- Requires firebase-admin@9.9.0 or higher
