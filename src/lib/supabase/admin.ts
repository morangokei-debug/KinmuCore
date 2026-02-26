import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Admin client (service role).
 * RLSをバイパスするため、管理者操作にのみ使用する。
 * サーバーサイド専用・環境変数に必ず設定すること。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY が設定されていません。Supabaseダッシュボードの Project Settings > API から取得してください。'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
