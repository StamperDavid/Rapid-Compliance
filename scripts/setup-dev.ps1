# PowerShell Setup Script for AI CRM Platform
# Run this to set up your development environment

Write-Host "🚀 AI CRM Platform - Development Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
$nodeVersion = node --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
Write-Host "✓ Node.js $nodeVersion detected" -ForegroundColor Green

# Check if npm is installed
$npmVersion = npm --version 2>$null
Write-Host "✓ npm $npmVersion detected" -ForegroundColor Green
Write-Host ""

# Create project directory if it doesn't exist
Write-Host "Setting up project structure..." -ForegroundColor Yellow

# Initialize Next.js project
Write-Host "Initializing Next.js project..." -ForegroundColor Yellow
npx create-next-app@latest . --typescript --tailwind --app --no-src --import-alias "@/*" --yes

Write-Host ""
Write-Host "Installing dependencies..." -ForegroundColor Yellow

# Install Firebase and GCP dependencies
npm install firebase @google-cloud/firestore @google-cloud/storage @google-cloud/secret-manager

# Install state management
npm install zustand @tanstack/react-query

# Install form libraries
npm install react-hook-form zod @hookform/resolvers

# Install UI libraries
npm install @headlessui/react @heroicons/react framer-motion
npm install react-hot-toast

# Install date utilities
npm install date-fns

# Install payment processing
npm install stripe @stripe/stripe-js @stripe/react-stripe-js

# Install development dependencies
npm install -D @types/node @types/react @types/react-dom
npm install -D eslint prettier eslint-config-prettier
npm install -D autoprefixer postcss tailwindcss

Write-Host ""
Write-Host "✓ Dependencies installed" -ForegroundColor Green

# Create directory structure
Write-Host ""
Write-Host "Creating project structure..." -ForegroundColor Yellow

$directories = @(
    "src/app/(auth)/login",
    "src/app/(auth)/register",
    "src/app/(platform)/[orgId]/[workspaceId]/schemas",
    "src/app/(platform)/[orgId]/[workspaceId]/entities/[entityName]",
    "src/app/(platform)/[orgId]/[workspaceId]/ai-agents",
    "src/app/(platform)/[orgId]/[workspaceId]/workflows",
    "src/app/(platform)/[orgId]/[workspaceId]/settings",
    "src/app/api/entities",
    "src/app/api/schemas",
    "src/app/api/ai",
    "src/app/api/workflows",
    "src/app/api/ecommerce",
    "src/components/ui",
    "src/components/schema",
    "src/components/views/TableView",
    "src/components/views/KanbanView",
    "src/components/views/FormView",
    "src/components/views/CalendarView",
    "src/components/theme",
    "src/components/ai",
    "src/components/layout",
    "src/components/widgets",
    "src/lib/firebase",
    "src/lib/ai",
    "src/lib/schema",
    "src/lib/theme",
    "src/lib/workflow",
    "src/lib/auth",
    "src/lib/utils",
    "src/lib/widgets",
    "src/hooks",
    "src/stores",
    "src/styles",
    "public/widgets",
    "functions/src",
    "infrastructure/modules",
    "infrastructure/environments/dev",
    "docs",
    "scripts"
)

foreach ($dir in $directories) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

Write-Host "✓ Directory structure created" -ForegroundColor Green

# Create environment file
Write-Host ""
Write-Host "Creating environment configuration..." -ForegroundColor Yellow

$envContent = @"
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (Server-side)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="your_private_key_here"

# GCP Configuration
NEXT_PUBLIC_GCP_PROJECT_ID=your_project_id
GCP_REGION=us-central1

# Gemini API
GEMINI_API_KEY=your_gemini_api_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# App Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WIDGET_URL=http://localhost:3000/widgets

# Redis (for caching)
REDIS_URL=redis://localhost:6379

# Email (SendGrid, etc.)
EMAIL_FROM=noreply@yourplatform.com
SENDGRID_API_KEY=your_sendgrid_api_key

# Feature Flags
NEXT_PUBLIC_ENABLE_ECOMMERCE=true
NEXT_PUBLIC_ENABLE_AI_AGENTS=true
NEXT_PUBLIC_ENABLE_WORKFLOWS=true
"@

$envContent | Out-File -FilePath ".env.local" -Encoding UTF8
Write-Host "✓ .env.local created (remember to add your API keys)" -ForegroundColor Green

# Create .gitignore
$gitignoreContent = @"
# Dependencies
node_modules/
/.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build
/dist

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local
.env.development.local
.env.test.local
.env.production.local

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts

# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# Firebase
.firebase/
firebase-debug.log
firestore-debug.log

# Terraform
infrastructure/**/.terraform/
infrastructure/**/*.tfstate
infrastructure/**/*.tfstate.*
infrastructure/**/.terraform.lock.hcl

# Secrets
*.key
*.pem
service-account*.json
"@

$gitignoreContent | Out-File -FilePath ".gitignore" -Encoding UTF8

Write-Host ""
Write-Host "✓ .gitignore created" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "✅ Setup Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Update .env.local with your Firebase and API keys" -ForegroundColor White
Write-Host "2. Run: npm run dev" -ForegroundColor White
Write-Host "3. Open http://localhost:3000 in your browser" -ForegroundColor White
Write-Host ""
Write-Host "To start the development server now, run:" -ForegroundColor Yellow
Write-Host "  npm run dev" -ForegroundColor Cyan
Write-Host ""


