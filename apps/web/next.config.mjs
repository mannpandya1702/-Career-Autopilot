import { withSentryConfig } from '@sentry/nextjs';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  transpilePackages: [
    '@career-autopilot/shared',
    '@career-autopilot/db',
  ],
};

const sentryOptions = {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;
