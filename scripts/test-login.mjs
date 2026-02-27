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
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('URL:', url);
console.log('Key:', key?.substring(0, 30) + '...');

const supabase = createClient(url, key);

console.log('\n--- 1. signInWithPassword ---');
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'logicworks.k@gmail.com',
  password: 'a18241824',
});

if (error) {
  console.log('LOGIN FAILED:', error.message);
  process.exit(1);
}

console.log('LOGIN SUCCESS');
console.log('  User:', data.user.email);
console.log('  Session:', data.session ? 'YES' : 'NO');

console.log('\n--- 2. stores table access ---');
const { data: stores, error: storesError } = await supabase.from('stores').select('*');
console.log('  Error:', storesError?.message || 'none');
console.log('  Count:', stores?.length);
if (stores?.length > 0) console.log('  First:', stores[0].name);

console.log('\n--- 3. attendance page (no cookie) ---');
const r1 = await fetch('https://kinmucore-iota.vercel.app/attendance', { redirect: 'manual' });
console.log('  Status:', r1.status);
console.log('  Location:', r1.headers.get('location'));

console.log('\n--- 4. login page ---');
const r2 = await fetch('https://kinmucore-iota.vercel.app/login', { redirect: 'manual' });
console.log('  Status:', r2.status);

console.log('\n--- 5. Database tables check ---');
const tables = ['stores', 'staff', 'policies', 'attendance_records'];
for (const t of tables) {
  const { data: rows, error: err } = await supabase.from(t).select('id', { count: 'exact', head: true });
  console.log(`  ${t}: ${err ? 'ERROR: ' + err.message : 'OK'}`);
}

console.log('\n--- DONE ---');
