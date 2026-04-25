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
    '@career-autopilot/llm',
    '@career-autopilot/parsers',
    '@career-autopilot/resume',
  ],
  // The resume package's PDF renderer pulls in fs/path/etc. for the
  // Tectonic shellout. The browser bundle never touches it, but Next's
  // server bundle needs this opt-in for native modules used in serverside
  // imports.
  serverExternalPackages: ['docx'],
};

const sentryOptions = {
  silent: true,
  hideSourceMaps: true,
  disableLogger: true,
};

export default process.env.SENTRY_DSN
  ? withSentryConfig(nextConfig, sentryOptions)
  : nextConfig;
