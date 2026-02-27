#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');

if (!existsSync(envPath)) {
  console.error('.env.local が見つかりません');
  process.exit(1);
}

const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log('🔍 Supabase 認証設定チェック\n');

// List users
const { data: usersData, error: usersError } = await supabase.auth.admin.listUsers();
if (usersError) {
  console.error('❌ ユーザー一覧の取得に失敗:', usersError.message);
} else {
  console.log(`✅ ユーザー数: ${usersData.users.length}`);
  usersData.users.forEach(user => {
    console.log(`   - ${user.email} (confirmed: ${user.email_confirmed_at ? 'Yes' : 'No'})`);
  });
}

console.log('\n📝 次のステップ:');
console.log('1. Supabase Dashboard で URL 設定を確認');
console.log('   https://supabase.com/dashboard/project/xnbzwibqypkgvqmulptn/auth/url-configuration');
console.log('2. Site URL を設定: https://kinmucore-iota.vercel.app');
console.log('3. Redirect URLs に追加: https://kinmucore-iota.vercel.app/**');
console.log('4. ログインページでテスト: https://kinmucore-iota.vercel.app/login');
