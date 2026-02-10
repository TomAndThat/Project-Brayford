import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    '@brayford/core',
    '@brayford/email-utils',
    '@brayford/firebase-utils',
  ],
};

export default nextConfig;
