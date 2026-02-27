import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const envContent = readFileSync(envPath, 'utf8');
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) process.env[m[1].trim()] = m[2].trim();
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const anon = createClient(url, anonKey);

const tableNames = ['stores', 'staff', 'policies', 'time_records', 'daily_attendance', 'correction_requests', 'shift_templates', 'shifts'];

console.log('=== 1. 全テーブルの存在確認 ===');
for (const t of tableNames) {
  const { data, error } = await admin.from(t).select('*').limit(1);
  console.log(`  ${t}: ${error ? 'ERROR: ' + error.message : 'OK'}`);
}

console.log('\n=== 2. ログイン＆認証済み操作テスト ===');
const { data: authData, error: authErr } = await anon.auth.signInWithPassword({
  email: 'logicworks.k@gmail.com',
  password: 'a18241824',
});
console.log('  Login:', authErr ? 'FAILED: ' + authErr.message : 'OK');

console.log('\n=== 3. 店舗登録テスト（認証済みユーザー） ===');
const { data: store, error: storeErr } = await anon.from('stores').insert({
  name: 'テスト薬局',
  address: '東京都渋谷区1-1-1',
  phone: '03-0000-0000',
}).select().single();
console.log('  Insert:', storeErr ? 'ERROR: ' + storeErr.message : 'OK - ' + store.name + ' (id: ' + store.id + ')');

if (store) {
  const { error: delErr } = await anon.from('stores').delete().eq('id', store.id);
  console.log('  Delete:', delErr ? 'ERROR: ' + delErr.message : 'OK (cleaned up)');
}

console.log('\n=== DONE ===');
