import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', 'assemblyai', '@llamaindex/liteparse', 'pngjs'],
  devIndicators: { position: 'bottom-right' },
};

export default nextConfig;
