import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel本番環境での最適化
  reactStrictMode: true,
  
  // 画像最適化設定
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  
  // 本番環境でのソースマップ生成（デバッグ用）
  productionBrowserSourceMaps: false,
};

export default nextConfig;
