const { withSentryConfig } = require('@sentry/nextjs');
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // ESLint - ZERO SUPPRESSION POLICY (per Project Constitution)
  // All builds must be 100% clean. No bypass mechanisms allowed.

  // Image optimization.
  // NOTE: the email builder canvas previews user/template image URLs via
  // next/image. Common email image sources are allowlisted here so the
  // built-in seeded templates render without console errors. A future
  // Phase 4 task will add a proper image upload flow that puts user images
  // on Firebase Storage (already in this allowlist).
  images: {
    domains: [
      'localhost',
      'firebasestorage.googleapis.com',
      'files2.heygen.ai',
      'files.heygen.ai',
      'imagedelivery.net',
      'placehold.co',
      'picsum.photos',
      'images.unsplash.com',
    ],
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 31536000, // 1 year
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  
  // Disable static optimization for auth-dependent pages
  experimental: {
    missingSuspenseWithCSRBailout: false,
    // optimizeCss: true, // Disabled - requires critters package
    optimizePackageImports: ['lucide-react', 'recharts'], // Tree-shake large packages
    // Next.js 14 requires these under experimental (promoted to top-level in 15)
    // Packages listed here are NOT bundled into each serverless function.
    // They're loaded from node_modules at runtime instead — drops function
    // size dramatically. Only safe for packages that:
    //   (a) are CommonJS-friendly,
    //   (b) only ever run server-side, and
    //   (c) are present at runtime in the deployed node_modules tree.
    // Trimmed here to keep individual function bundles under Vercel's
    // 250 MB hard limit after the May 4 calendar/OAuth feature additions.
    serverComponentsExternalPackages: [
      'ffmpeg-static',
      '@ffmpeg-installer/ffmpeg',
      // Google stack
      'googleapis',
      'googleapis-common',
      'google-auth-library',
      '@google-cloud/local-auth',
      '@google-cloud/firestore',
      '@google-cloud/secret-manager',
      '@google-cloud/storage',
      '@google/generative-ai',
      'gcp-metadata',
      // AI provider SDKs
      '@anthropic-ai/sdk',
      'openai',
      '@deepgram/sdk',
      // Firebase
      'firebase-admin',
      // Image / media
      'sharp',
      // node-fetch + friends
      'node-fetch',
      'fetch-blob',
      'formdata-polyfill',
      'node-domexception',
      // Microsoft stack
      '@microsoft/microsoft-graph-client',
      '@azure/identity',
      '@azure/msal-node',
      // Communication
      'twilio',
      '@slack/web-api',
      '@sendgrid/mail',
      'nodemailer',
      // Payment SDKs
      'stripe',
      'square',
      'chargebee',
      '@adyen/api-library',
      '@paddle/paddle-node-sdk',
      '@juspay-tech/hyperswitch-node',
      // Doc / parsing
      'pdf-parse',
      'cheerio',
      'turndown',
      'xlsx',
      // Cache
      'ioredis',
      // Sentry (heavy dep tree)
      '@sentry/nextjs',
    ],
    outputFileTracingIncludes: {
      '/api/video/*': [
        './node_modules/ffmpeg-static/ffmpeg',
        './node_modules/ffmpeg-static/**/*',
        './node_modules/@ffmpeg-installer/linux-x64/**/*',
      ],
    },
    // Stop the file tracer from sweeping these heavy folders into every
    // function bundle. Vercel still ships node_modules separately so the
    // packages remain reachable via require() at runtime — they just
    // aren't traced+bundled per function.
    outputFileTracingExcludes: {
      '*': [
        // Build tooling — not needed at runtime
        'node_modules/@swc/core-linux-x64-gnu',
        'node_modules/@swc/core-linux-x64-musl',
        'node_modules/@esbuild/**',
        'node_modules/webpack/**',
        'node_modules/terser/**',
        'node_modules/typescript/**',
        'node_modules/.cache/**',
        'node_modules/canvas/**',
        'node_modules/@next/swc-*/**',
        // Headless browsers — Vercel can't run them; pure bloat
        'node_modules/playwright/**',
        'node_modules/playwright-core/**',
        'node_modules/playwright-extra/**',
        'node_modules/puppeteer/**',
        'node_modules/puppeteer-core/**',
        'node_modules/puppeteer-extra/**',
        'node_modules/puppeteer-extra-plugin-stealth/**',
        // Source maps and types
        'node_modules/**/*.map',
        'node_modules/**/*.d.ts',
        // Test infrastructure pulled by some deps
        'node_modules/jest*/**',
        'node_modules/@types/**',
      ],
    },
  },
  
  // Skip pre-rendering for API routes (all are dynamic)
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,
  
  // Headers for caching and security
  async headers() {
    return [
      {
        // Cache static assets forever
        source: '/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Cache published pages with revalidation
        source: '/sites/:orgId/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600, stale-while-revalidate=86400',
          },
        ],
      },
      {
        // Security headers
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self), geolocation=()',
          },
        ],
      },
    ];
  },
  // Environment variables available to the browser
  env: {
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME || 'AI Sales Platform',
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  },
  // Webpack configuration to handle server-only modules
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve these modules on the client side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        path: false,
        os: false,
        child_process: false,
        http2: false,
        dns: false,
        dgram: false,
        module: false,
        'node:events': false,
        'node:process': false,
        'node:stream': false,
        'node:util': false,
      };
      
      // Stub out server-only packages on the client side
      // Using resolve.alias (not externals) so webpack provides an empty module
      // instead of emitting a global-variable reference that crashes at runtime.
      config.resolve.alias = {
        ...config.resolve.alias,
        'firebase-admin': false,
        'firebase-admin/app': false,
        'firebase-admin/auth': false,
        'firebase-admin/firestore': false,
        'firebase-admin/storage': false,
        playwright: false,
        'playwright-core': false,
      };
    }

    // Skip locked temp file that crashes webpack glob scanner
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/UTLB7F9.tmp.dir/**'],
    };

    return config;
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // Suppress all Sentry logs
  silent: true,
  
  // Only upload source maps in production
  hideSourceMaps: true,
  
  // Disable automatic instrumentation in development
  disableLogger: process.env.NODE_ENV === 'development',
  
  // Don't automatically inject Sentry (we do it manually)
  autoInstrumentServerFunctions: false,
  
  // BEST PRACTICE: Disable webpack plugins to prevent OOM, but keep runtime instrumentation
  // - Runtime error tracking still works (sentry.client.config.ts, sentry.server.config.ts)
  // - Source maps can be uploaded separately via Sentry CLI in CI/CD if needed
  // - Prevents build hangs and memory issues on large codebases
  disableServerWebpackPlugin: true,
  disableClientWebpackPlugin: true,
  
  // Disable upload of source maps if no DSN is configured
  dryRun: !process.env.NEXT_PUBLIC_SENTRY_DSN && !process.env.SENTRY_DSN,
};

// Export config wrapped with Sentry (runtime instrumentation only, no webpack plugins)
// Build trigger
module.exports = withBundleAnalyzer(withSentryConfig(nextConfig, sentryWebpackPluginOptions));
