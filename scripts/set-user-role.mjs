#!/usr/bin/env node
/**
 * ユーザーのロールを設定する
 * Usage: node scripts/set-user-role.mjs <email> <admin|staff>
 *
 * 既存テーブル・既存データには一切触れません。
 * user_roles テーブルにのみ挿入・更新します。
 */
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
  console.error('NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を設定してください');
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = process.argv[2];
const role = process.argv[3];

if (!email || !role) {
  console.error('Usage: node scripts/set-user-role.mjs <email> <admin|staff>');
  process.exit(1);
}

if (role !== 'admin' && role !== 'staff') {
  console.error('ロールは admin または staff を指定してください');
  process.exit(1);
}

const { data: users, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
if (listError) {
  console.error('ユーザー一覧の取得に失敗:', listError.message);
  process.exit(1);
}

const user = users?.users?.find((u) => u.email === email);
if (!user) {
  console.error(`ユーザーが見つかりません: ${email}`);
  process.exit(1);
}

const { data: existing, error: selectError } = await supabase
  .from('user_roles')
  .select('id, role')
  .eq('user_id', user.id)
  .single();

if (selectError && selectError.code !== 'PGRST116') {
  console.error('user_roles の取得に失敗:', selectError.message);
  process.exit(1);
}

if (existing) {
  const { error: updateError } = await supabase
    .from('user_roles')
    .update({ role })
    .eq('user_id', user.id);

  if (updateError) {
    console.error('ロールの更新に失敗:', updateError.message);
    process.exit(1);
  }
  console.log(`ロールを更新しました: ${email} → ${role}`);
} else {
  const { error: insertError } = await supabase.from('user_roles').insert({
    user_id: user.id,
    role,
  });

  if (insertError) {
    console.error('ロールの設定に失敗:', insertError.message);
    process.exit(1);
  }
  console.log(`ロールを設定しました: ${email} → ${role}`);
}
