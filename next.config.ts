import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // For better portability on pure static hosts (GitHub Pages, Surge, etc.)
  // you can experiment with output: 'export' but note app-router limitations
  // (no server components/actions). Current setup works for most static + edge.
};

export default nextConfig;
