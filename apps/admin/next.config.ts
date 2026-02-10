import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    '@brayford/core',
    '@brayford/firebase-utils',
  ],
};

export default nextConfig;
