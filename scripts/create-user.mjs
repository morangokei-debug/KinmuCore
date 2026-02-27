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
  console.error('NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('Usage: node create-user.mjs <email> <password>');
  process.exit(1);
}

const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

if (error) {
  if (error.message?.includes('already been registered') || error.message?.includes('already exists')) {
    const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    const user = list?.users?.find((u) => u.email === email);
    if (!user) {
      console.error('ユーザーが見つかりません:', email);
      process.exit(1);
    }
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, { password });
    if (updateError) {
      console.error('パスワード更新エラー:', updateError.message);
      process.exit(1);
    }
    console.log('既存ユーザーのパスワードを更新しました:', email);
  } else {
    console.error('エラー:', error.message);
    process.exit(1);
  }
} else {
  console.log('ユーザーを作成しました:', email);
}
