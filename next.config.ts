import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Remove turbopack.root - Next.js will use the project root by default
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'commondatastorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'commondatastorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.fal.media',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'fal.media',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.letz.ai',
        port: '',
        pathname: '/**',
      },
      // Supabase Storage (local development)
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '54321',
        pathname: '/storage/v1/**',
      },
      // Cloudflare R2 Storage
      {
        protocol: 'https',
        hostname: '**.r2.cloudflarestorage.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

// Cloudflare Pages build uses @cloudflare/next-on-pages adapter
// The adapter runs post-build to transform Next.js output for Workers
// See: scripts/build-cloudflare.sh and .github/workflows/cloudflare-deploy.yml
// For Cloudflare Image Optimization, see: https://developers.cloudflare.com/images/

export default nextConfig;
