const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Image optimization
  images: {
    domains: ['localhost', 'firebasestorage.googleapis.com'],
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
            value: 'origin-when-cross-origin',
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
    // Optimize for large files (industry templates)
    config.optimization = {
      ...config.optimization,
      minimize: true,
      // Increase chunk size limits
      splitChunks: {
        ...config.optimization.splitChunks,
        maxSize: 500000, // 500KB chunks max
      },
    };
    
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
      
      // Exclude firebase-admin and playwright from client bundle
      config.externals = config.externals || [];
      config.externals.push('firebase-admin');
      config.externals.push('playwright');
      config.externals.push('playwright-core');
    }
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
  
  // Disable upload of source maps if no DSN is configured
  dryRun: !process.env.NEXT_PUBLIC_SENTRY_DSN && !process.env.SENTRY_DSN,
};

// Export config wrapped with Sentry
module.exports = withSentryConfig(nextConfig, sentryWebpackPluginOptions);
