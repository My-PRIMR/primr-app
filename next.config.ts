import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['pdf-parse', 'mammoth', 'assemblyai', '@llamaindex/liteparse', 'pngjs', 'pdfjs-dist', 'sharp'],
  devIndicators: { position: 'bottom-right' },
  async headers() {
    return [
      {
        source: '/embed/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
        ],
      },
    ]
  },
};

export default nextConfig;
