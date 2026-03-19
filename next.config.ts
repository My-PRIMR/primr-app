import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', 'assemblyai'],
  devIndicators: { position: 'bottom-right' },
};

export default nextConfig;
