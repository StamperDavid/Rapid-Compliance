// Injected content via Sentry wizard below
const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable modern JavaScript features
  swcMinify: true,
  
  // Webpack configuration to handle modern syntax
  webpack: (config, { isServer }) => {
    // Handle node_modules that use modern JavaScript
    config.module = {
      ...config.module,
      rules: [
        ...(config.module?.rules || []),
        {
          test: /\.m?js$/,
          resolve: {
            fullySpecified: false,
          },
        },
      ],
    };

    // Exclude undici from transpilation issues
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }

    return config;
  },

  // Transpile packages that need it
  transpilePackages: [],

  // Sentry configuration
  sentry: {
    // Suppresses source map uploading logs during build
    hideSourceMaps: true,
    
    // Automatically tree-shake Sentry logger statements to reduce bundle size
    disableLogger: false,
  },
}

// Only wrap with Sentry if DSN is configured
const sentryOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Suppresses source map uploading logs during build
  silent: true,
  
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  
  // Only upload source maps in production
  widenClientFileUpload: true,
  transpileClientSDK: true,
  tunnelRoute: '/monitoring',
  hideSourceMaps: true,
  disableLogger: true,
  automaticVercelMonitors: true,
};

// Export with Sentry if DSN is configured, otherwise export without
module.exports = (process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN)
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;


