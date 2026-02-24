import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    '@brayford/core',
    '@brayford/firebase-utils',
  ],
  images: {
    remotePatterns: [
      {
        // Google profile photos served via Firebase Auth / Google Workspace
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
};

export default nextConfig;
