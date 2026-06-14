import type { NextConfig } from 'next';

const isCF = process.env.CF_PAGES === '1' || !!process.env.CF_PAGES_URL;

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // For better portability on pure static hosts (GitHub Pages, Surge, etc.)
  // you can experiment with output: 'export' but note app-router limitations
  // (no server components/actions). Current setup works for most static + edge.
};

export default nextConfig;
