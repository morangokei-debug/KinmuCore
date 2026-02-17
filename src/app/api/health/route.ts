import { NextResponse } from 'next/server';

/**
 * ヘルスチェックエンドポイント
 * Vercelのモニタリングやアップタイムチェックに使用
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'KinmuCore',
    environment: process.env.NODE_ENV,
  });
}
