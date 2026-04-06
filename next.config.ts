import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', 'assemblyai', '@llamaindex/liteparse', 'pngjs', 'pdfjs-dist', 'sharp'],
  devIndicators: { position: 'bottom-right' },
};

export default nextConfig;
