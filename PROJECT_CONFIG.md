# Project Configuration - AI Sales Platform

## Core Architecture
- [cite_start]**Framework:** Next.js [cite: 1, 12, 13]
- [cite_start]**Firebase (Client):** Used for Auth, Firestore, and Storage 
- **Firebase (Admin):** Used for backend services and Cron security
- **Primary Branch:** main

## Environment Strategy
- [cite_start]**Local Dev:** Uses `.env.local` for Firebase keys and Admin credentials [cite: 1]
- [cite_start]**AI Providers:** OpenAI, Anthropic, and Google AI keys are managed via environment variables 
- [cite_start]**Line Endings:** Force LF for all configuration and web files [cite: 2]

## Quality Standards
- [cite_start]**Linter:** ESLint with strict TypeScript rules [cite: 4, 11]
- [cite_start]**Type Safety:** No `any` allowed; use `import type` for declarations [cite: 7, 8]
- [cite_start]**Safety:** Use nullish coalescing `??` strictly for null/undefined checks [cite: 9]
